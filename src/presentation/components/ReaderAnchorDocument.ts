/** Runs inside the existing reader closure; commands never replace the document. */
export function readerAnchorDocumentScript(): string {
  return `
  // Literal WebView source: Hermes Function.toString() is not executable source.
  // Domain parity is verified by test-reader-bytecode.cjs.
  function resolveStudyAnchor(text, anchor) {
    function fits(start) {
      return text.slice(start, start + anchor.quote.length) === anchor.quote &&
        (!anchor.prefix || text.slice(Math.max(0, start - anchor.prefix.length), start) === anchor.prefix) &&
        (!anchor.suffix || text.slice(start + anchor.quote.length, start + anchor.quote.length + anchor.suffix.length) === anchor.suffix);
    }
    var matches = [];
    if (!anchor.quote) return { status: "missing" };
    var offset = text.indexOf(anchor.quote);
    while (offset !== -1) {
      if (fits(offset)) matches.push(offset);
      if (matches.length > 1) return { status: "ambiguous" };
      offset = text.indexOf(anchor.quote, offset + 1);
    }
    if (!matches.length) return { status: "missing" };
    var start = matches[0];
    return { status: start === anchor.start ? "exact" : "relocated", start: start, end: start + anchor.quote.length };
  }
  function parseStudyAnchor(value) {
    if (!value || typeof value !== "object") throw new Error("Localização inválida.");
    var a = value;
    if (a.version !== 1) throw new Error("Versão de localização não suportada.");
    if (a.kind === "pdf-page") {
      if (!Number.isSafeInteger(a.sourcePage) || a.sourcePage < 1 || a.sourcePage > 1000000) throw new Error("Página fonte inválida.");
      return { version: 1, kind: "pdf-page", sourcePage: a.sourcePage };
    }
    if (a.kind !== "epub-text" || typeof a.chapterId !== "string" || !a.chapterId || a.chapterId.length > 2000 ||
        !Number.isSafeInteger(a.start) || a.start < 0 || !Number.isSafeInteger(a.end) || a.end <= a.start ||
        typeof a.quote !== "string" || !a.quote.trim() || a.quote.length > 10000 || a.end - a.start !== a.quote.length ||
        typeof a.prefix !== "string" || a.prefix.length > 128 || typeof a.suffix !== "string" || a.suffix.length > 128 ||
        !Array.isArray(a.path) || a.path.length > 100 || a.path.some(function(v) { return !Number.isSafeInteger(v) || v < 0; })) throw new Error("Localização textual inválida.");
    return { version: 1, kind: "epub-text", chapterId: a.chapterId, start: a.start, end: a.end, quote: a.quote, prefix: a.prefix, suffix: a.suffix, path: a.path };
  }
  function studyReply(request, extra) {
    var payload = JSON.stringify(Object.assign({type:'study', id:request.id}, extra));
    if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(payload);
    if (window.parent !== window) window.parent.postMessage(payload, '*');
  }
  var studyTextCache = null;
  function studyText(section) {
    if (studyTextCache && studyTextCache.section === section) return studyTextCache.model;
    var walker = document.createTreeWalker(section, NodeFilter.SHOW_TEXT);
    var nodes = [], text = '', node;
    while ((node = walker.nextNode())) {
      if (node.parentElement.closest('style,script')) continue;
      nodes.push({node:node, start:text.length}); text += node.textContent;
    }
    var model = {text:text,nodes:nodes};
    // The reader's text DOM is immutable; retain only the current chapter model.
    studyTextCache = {section:section,model:model};
    return model;
  }
  function studyRange(model, start, end) {
    var range=document.createRange(), first, last;
    for(var i=0;i<model.nodes.length;i++) {
      var entry=model.nodes[i], limit=entry.start+entry.node.length;
      if(!first && start>=entry.start && start<limit) first={node:entry.node,offset:start-entry.start};
      if(end>entry.start && end<=limit) {last={node:entry.node,offset:end-entry.start}; break;}
    }
    if(!first || !last) return null;
    range.setStart(first.node,first.offset);range.setEnd(last.node,last.offset);return range;
  }
  function studyVisibleAnchor() {
    if(isAnimating || restorationPending || getPageWidth()<=0) throw new Error('Aguarde a página terminar de carregar.');
    var sections=content.querySelectorAll('.epub-chapter'), width=getPageWidth(), height=getPageHeight();
    for(var s=0;s<sections.length;s++) {
      var section=sections[s], bounds=section.getBoundingClientRect();
      if (bounds.right<=0 || bounds.left>=width) continue;
      if (isScrollFlow() && (bounds.bottom<=0 || bounds.top>=height)) continue;
      var model=studyText(section);
      for(var n=0;n<model.nodes.length;n++) {
        var entry=model.nodes[n];if(!entry.node.textContent.trim()) continue;
        var full=document.createRange();full.selectNodeContents(entry.node);
        var visible=Array.from(full.getClientRects()).some(function(r){return r.right>0 && r.left<width && r.bottom>0 && r.top<height;});
        if(!visible) continue;
        var low=0,high=entry.node.length;
        while(low<high){var mid=Math.floor((low+high)/2),r=document.createRange();r.setStart(entry.node,mid);r.setEnd(entry.node,mid+1);var rect=r.getBoundingClientRect();if(isScrollFlow()?rect.bottom<=0:rect.right<=0)low=mid+1;else high=mid;}
        var start=entry.start+low;
        while(start<model.text.length && !model.text[start].trim())start++;
        var quote=model.text.slice(start,start+160);if(!quote.trim())continue;
        var path=[],node=entry.node;while(node && node!==section){path.unshift(Array.prototype.indexOf.call(node.parentNode.childNodes,node));node=node.parentNode;}
        return {version:1,kind:'epub-text',chapterId:section.getAttribute('data-chapter-id'),start:start,end:start+quote.length,quote:quote,prefix:model.text.slice(Math.max(0,start-64),start),suffix:model.text.slice(start+quote.length,start+quote.length+64),path:path};
      }
    }
    throw new Error('Não há texto localizável nesta página. Use outra página para criar o marcador.');
  }
  window.readerStudy = function(request) {
    try {
      if(request.type==='studySelection') {
        window.__studySelectionRequest=request.enabled?request:null;window.__studyLastCapture=null;clearTimeout(studySettleTimer);
        if(!request.enabled){studyPress=null;studyDragPending=null;}
        studySelectionStyle(!!request.enabled);
        if(!request.enabled){var current=window.getSelection();if(current)current.removeAllRanges();}
        return;
      }
      if(request.type==='studySelectAt'){
        var pick=studySelectAt(request);studyPress={request:request,pick:pick,last:pick};studyReplySelection(request,pick);
        var pending=studyDragPending;studyDragPending=null;
        if(pending && Date.now()-studyGestureAt<5000)studyDragTo(pending.x,pending.y,pending.final);
        return;
      }
      if(request.type==='studyDragTo'){studyDragTo(Number(request.x),Number(request.y),!!request.final);return;}
      if(request.type==='studyAdjust'){studyReplySelection(request,studyAdjust(request));return;}
      if(request.type==='studyRenderHighlights') {
        if(!window.CSS || !CSS.highlights || !window.Highlight){studyReply(request,{status:'unsupported',message:'Este motor não exibe grifos sobre o texto. Seus grifos e notas continuam disponíveis no painel.'});return;}
        var colors={yellow:'#ffdd6680',green:'#70d59080',blue:'#7ac5ff80',pink:'#ff9ecb80',purple:'#c7a0ff80'}, rules='',missing=0,ambiguous=0;
        (window.__studyHighlightKeys||[]).forEach(function(key){CSS.highlights.delete(key);});window.__studyHighlightKeys=[];
        (request.highlights||[]).forEach(function(h,index){
          var location,a;try{location=JSON.parse(h.startCfi);a=parseStudyAnchor(location.anchor);}catch(error){missing++;return;}
          if(location.format!=='kindle-study-highlight'||location.version!==1||a.kind!=='epub-text'||a.chapterId!==h.chapterId||a.quote!==h.highlightedText){missing++;return;}
          var section=Array.from(content.querySelectorAll('.epub-chapter')).find(function(s){return s.getAttribute('data-chapter-id')===a.chapterId;});
          if(!section){missing++;return;}var model=studyText(section),resolved=resolveStudyAnchor(model.text,a);
          if(resolved.status==='ambiguous'){ambiguous++;return;}if(resolved.status==='missing'){missing++;return;}
          var range=studyRange(model,resolved.start,resolved.end);if(!range){missing++;return;}
          var key='aldus-study-'+index;CSS.highlights.set(key,new Highlight(range));window.__studyHighlightKeys.push(key);rules+='::highlight('+key+'){background-color:'+(colors[h.colorLabel]||colors.yellow)+';}';
        });
        var style=document.getElementById('reader-study-highlights');if(!style){style=document.createElement('style');style.id='reader-study-highlights';document.head.appendChild(style);}style.textContent=rules;
        studyReply(request,{status:'rendered',missing:missing,ambiguous:ambiguous});return;
      }
      if(request.type==='studyCapture'){studyReply(request,{status:'captured',anchor:studyVisibleAnchor()});return;}
      if(request.type!=='studyNavigate')return;
      if(isAnimating || restorationPending || getPageWidth()<=0)throw new Error('Aguarde a página terminar de carregar.');
      var a=parseStudyAnchor(request.anchor);
      if(a.kind!=='epub-text')throw new Error('Esta localização não é um trecho de texto.');
      var section=Array.from(content.querySelectorAll('.epub-chapter')).find(function(s){return s.getAttribute('data-chapter-id')===a.chapterId;});
      if(!section){studyReply(request,{status:'missing'});return;}
      var model=studyText(section),resolved=resolveStudyAnchor(model.text,a);
      if(resolved.status==='missing'||resolved.status==='ambiguous'){studyReply(request,resolved);return;}
      var range=studyRange(model,resolved.start,resolved.end);
      if(!range){studyReply(request,{status:'missing'});return;}
      var rect=range.getClientRects()[0],page=pageForRect(rect);
      if(isScrollFlow())scrollTargetTop=topForRect(rect);
      studyReply(request,{status:resolved.status,pageNumber:page});window.goToPage(page);
    }catch(error){studyReply(request,{status:'error',message:error.message});}
  };
  window.addEventListener('message',function(event){
    if(window.parent!==window && event.source!==window.parent)return;
    try{var request=typeof event.data==='string'?JSON.parse(event.data):event.data;if(request && /^study/.test(request.type))window.readerStudy(request);}catch(error){}
  });
  // Seleção (Fase B, 16/11/2026). A captura acontece ao levantar o dedo OU quando a seleção para de mudar: as alças nativas do
  // Android ajustam a seleção sem disparar pointerup no documento, e antes disso o trecho nunca chegava ao app.
  function studyIsWord(ch){return !!ch && /[\\p{L}\\p{N}'’-]/u.test(ch);}
  // Robustez do grifo (17/11/2026, relato do dono: "não funcionou da página 106 pra frente"). O modelo do capítulo junta os
  // textos sem separador (as âncoras salvas dependem disso), então a palavra não pode atravessar a troca de bloco ("Capítulo 1" +
  // "primeiro" virava "1primeiro"); o ponto do toque não pode depender só de caretRangeFromPoint; e as pontas da seleção nativa
  // podem cair em elementos ou no capítulo seguinte.
  var STUDY_BLOCKS='p,div,h1,h2,h3,h4,h5,h6,li,blockquote,td,th,pre,figcaption,dd,dt,section,article';
  function studyBreaks(model){
    if(model.breaks)return model.breaks;
    var breaks={};
    for(var i=1;i<model.nodes.length;i++){
      var before=model.nodes[i-1].node.parentElement.closest(STUDY_BLOCKS),after=model.nodes[i].node.parentElement.closest(STUDY_BLOCKS);
      // Parágrafo novo ou <br> dentro do mesmo bloco (poemas, letras): o texto cru do modelo junta as linhas sem espaço.
      if(before!==after || (after && after.getElementsByTagName('br').length && studyBrBetween(model.nodes[i-1].node,model.nodes[i].node)))breaks[model.nodes[i].start]=true;
    }
    model.breaks=breaks;return breaks;
  }
  function studyBrBetween(prev,next){var r=document.createRange();r.setStart(prev,prev.length);r.setEnd(next,0);return !!r.cloneContents().querySelector('br');}
  // Texto para leitura humana (card de trecho): as mesmas letras da âncora, com quebra de linha entre parágrafos e linhas.
  // A âncora em si continua com o texto cru, porque posições e conferência dependem dele.
  function studyReadable(model,start,end){var breaks=studyBreaks(model),out='';for(var i=start;i<end;i++){if(i>start && breaks[i])out+='\\n';var c=model.text[i];out+=/\\s/.test(c)?' ':c;}return out;}
  function studyWordAround(model,at){
    var text=model.text,breaks=studyBreaks(model),start=at,end=at;
    while(start>0 && studyIsWord(text[start-1]) && !breaks[start])start--;
    while(end<text.length && studyIsWord(text[end]) && (end===at || !breaks[end]))end++;
    return [start,end];
  }
  function studyPointPosition(x,y){
    var caret=null,node=null,offset=0;
    try{caret=document.caretRangeFromPoint?document.caretRangeFromPoint(x,y):null;}catch(error){caret=null;}
    if(!caret && document.caretPositionFromPoint){try{var p=document.caretPositionFromPoint(x,y);if(p){caret=document.createRange();caret.setStart(p.offsetNode,p.offset);}}catch(error){caret=null;}}
    if(caret){
      node=caret.startContainer;offset=caret.startOffset;
      if(node && node.nodeType===1){var child=node.childNodes[offset];if(child && child.nodeType===3){node=child;offset=0;}else{child=node.childNodes[offset-1];if(child && child.nodeType===3){node=child;offset=Math.max(0,child.length-1);}else node=null;}}
      if(node && node.nodeType===3 && node.parentElement && content.contains(node) && node.parentElement.closest('.epub-chapter'))return {node:node,offset:offset};
    }
    // Reserva pela geometria: o caractere cujo retângulo contém o ponto (o motor pode devolver nada ou um elemento).
    var element=document.elementFromPoint(x,y),section=element && element.closest && element.closest('.epub-chapter');
    if(!section || !content.contains(section))return null;
    var walker=document.createTreeWalker(element.closest(STUDY_BLOCKS)||section,NodeFilter.SHOW_TEXT),text;
    while((text=walker.nextNode())){
      if(!text.nodeValue.trim())continue;
      var full=document.createRange();full.selectNodeContents(text);
      var inside=Array.prototype.some.call(full.getClientRects(),function(r){return x>=r.left && x<=r.right && y>=r.top && y<=r.bottom;});
      if(!inside)continue;
      for(var i=0;i<text.length;i++){var r=document.createRange();r.setStart(text,i);r.setEnd(text,i+1);var b=r.getBoundingClientRect();if(x>=b.left && x<=b.right && y>=b.top && y<=b.bottom)return {node:text,offset:i};}
    }
    return null;
  }
  function studyTextBoundary(container,offset,section,atEnd){
    if(container.nodeType===3)return {node:container,offset:offset};
    var mark=document.createRange();mark.setStart(container,offset);mark.collapse(true);
    var walker=document.createTreeWalker(section,NodeFilter.SHOW_TEXT),text,found=null;
    while((text=walker.nextNode())){
      if(!text.nodeValue.trim()||text.parentElement.closest('style,script'))continue;
      if(!atEnd){if(mark.comparePoint(text,0)>=0)return {node:text,offset:0};}
      else if(mark.comparePoint(text,text.length)<=0)found={node:text,offset:text.length};
      else break;
    }
    return found;
  }
  function studyTrim(text,start,end){while(start<end && !text[start].trim())start++;while(end>start && !text[end-1].trim())end--;return [start,end];}
  function studyAnchorFor(section,model,start,end){
    var bounds=studyTrim(model.text,start,end);start=bounds[0];end=bounds[1];
    var quote=model.text.slice(start,end);
    if(!quote.trim()||quote.length>10000)throw new Error('Selecione de 1 a 10 mil caracteres.');
    var range=studyRange(model,start,end);if(!range)throw new Error('Este trecho não pode ser selecionado.');
    var path=[],node=range.startContainer;while(node && node!==section){path.unshift(Array.prototype.indexOf.call(node.parentNode.childNodes,node));node=node.parentNode;}
    return {anchor:{version:1,kind:'epub-text',chapterId:section.getAttribute('data-chapter-id'),start:start,end:end,quote:quote,prefix:model.text.slice(Math.max(0,start-64),start),suffix:model.text.slice(end,end+64),path:path},range:range,text:studyReadable(model,start,end)};
  }
  function studyShowSelection(range){
    var selection=window.getSelection();if(!selection)return;
    window.__studyProgrammatic=true;selection.removeAllRanges();selection.addRange(range);
    setTimeout(function(){window.__studyProgrammatic=false;},0);
  }
  function studySelectionStyle(enabled){
    var selectionStyle=document.getElementById('reader-study-selection');
    if(!selectionStyle){selectionStyle=document.createElement('style');selectionStyle.id='reader-study-selection';document.head.appendChild(selectionStyle);}
    selectionStyle.textContent=enabled?'html,body,#reader-content,#reader-content * { user-select:text!important; -webkit-user-select:text!important; }':'';
  }
  function studyCaptureSelection(request){
    var selection=window.getSelection();if(!selection || selection.isCollapsed || !selection.rangeCount)return false;
    try {
      var range=selection.getRangeAt(0),startElement=range.startContainer.nodeType===3?range.startContainer.parentElement:range.startContainer;
      var section=startElement && startElement.closest && startElement.closest('.epub-chapter');
      if(!section || !content.contains(section))throw new Error('Selecione um trecho de texto dentro do capítulo.');
      var startAt=studyTextBoundary(range.startContainer,range.startOffset,section,false);
      var endElement=range.endContainer.nodeType===3?range.endContainer.parentElement:range.endContainer;
      // Seleção que entra no capítulo seguinte: vale até o fim deste capítulo (antes era recusada).
      var endAt=endElement && endElement.closest && endElement.closest('.epub-chapter')===section?studyTextBoundary(range.endContainer,range.endOffset,section,true):studyTextBoundary(section,section.childNodes.length,section,true);
      var model=studyText(section),first=startAt && model.nodes.find(function(e){return e.node===startAt.node;}),last=endAt && model.nodes.find(function(e){return e.node===endAt.node;});
      if(!first || !last)throw new Error('Este trecho não pode ser selecionado.');
      var capturedResult=studyAnchorFor(section,model,first.start+startAt.offset,last.start+endAt.offset),captured=capturedResult.anchor;
      var key=captured.chapterId+':'+captured.start+':'+captured.end;
      if(window.__studyLastCapture===key)return true;
      window.__studyLastCapture=key;
      studyReply(request,{status:'captured',anchor:captured,text:capturedResult.text});
    }catch(error){studyReply(request,{status:'error',message:error.message});}
    return true;
  }
  var studySettleTimer=0;
  document.addEventListener('selectionchange',function(){
    var request=window.__studySelectionRequest;if(!request || window.__studyProgrammatic)return;
    clearTimeout(studySettleTimer);
    studySettleTimer=setTimeout(function(){if(window.__studySelectionRequest===request)studyCaptureSelection(request);},650);
  });
  document.addEventListener('pointerup',function(){
    var request=window.__studySelectionRequest;if(!request)return;
    requestAnimationFrame(function(){
      if(window.__studySelectionRequest!==request)return;
      if(studyCaptureSelection(request))clearTimeout(studySettleTimer);
    });
  });
  // Pressionar e segurar sobre o texto: seleciona a palavra naquele ponto (coordenadas do viewport do documento).
  function studySelectAt(request){
    // Selecionar pelo ponto não move a página nem depende da posição restaurada: só a virada em curso impede.
    if(isAnimating || getPageWidth()<=0)throw new Error('Aguarde a página terminar de carregar.');
    var x=Number(request.x),y=Number(request.y);if(!isFinite(x)||!isFinite(y))throw new Error('Posição inválida.');
    var position=studyPointPosition(x,y);if(!position)throw new Error('Pressione sobre uma palavra do texto.');
    var node=position.node,section=node.parentElement.closest('.epub-chapter'),model=studyText(section),entry=model.nodes.find(function(e){return e.node===node;});
    if(!entry)throw new Error('Pressione sobre uma palavra do texto.');
    var text=model.text,at=entry.start+Math.min(position.offset,Math.max(0,node.length-1));
    if(!studyIsWord(text[at]) && studyIsWord(text[at-1]) && !studyBreaks(model)[at])at--;
    if(!studyIsWord(text[at]))throw new Error('Pressione sobre uma palavra do texto.');
    var word=studyWordAround(model,at),start=word[0],end=word[1];
    // caretRangeFromPoint devolve a palavra mais próxima mesmo longe do texto: exige que o dedo esteja sobre ela.
    var wordRange=studyRange(model,start,end),slack=10;
    var hit=wordRange && Array.from(wordRange.getClientRects()).some(function(r){return x>=r.left-slack && x<=r.right+slack && y>=r.top-slack && y<=r.bottom+slack;});
    if(!hit)throw new Error('Pressione sobre uma palavra do texto.');
    return {section:section,model:model,start:start,end:end};
  }
  // Ajuste do trecho sem depender das alças: uma palavra a mais/a menos em cada ponta, ou a frase inteira.
  function studyAdjust(request){
    var a=parseStudyAnchor(request.anchor);if(a.kind!=='epub-text')throw new Error('Esta localização não é um trecho de texto.');
    var section=Array.from(content.querySelectorAll('.epub-chapter')).find(function(s){return s.getAttribute('data-chapter-id')===a.chapterId;});
    if(!section)throw new Error('O trecho não está mais nesta página.');
    var model=studyText(section),resolved=resolveStudyAnchor(model.text,a);
    if(resolved.status!=='exact' && resolved.status!=='relocated')throw new Error('O trecho não está mais nesta página.');
    var text=model.text,start=resolved.start,end=resolved.end,op=request.op,i,j;
    if(op==='growEnd'){j=end;while(j<text.length && !studyIsWord(text[j]))j++;if(j<text.length)j=studyWordAround(model,j)[1];while(j<text.length && '.,;:!?…»”)'.indexOf(text[j])>=0)j++;end=j;}
    else if(op==='growStart'){i=start;while(i>0 && !studyIsWord(text[i-1]))i--;if(i>0)i=studyWordAround(model,i-1)[0];start=i;}
    else if(op==='shrinkEnd'){j=end;while(j>start && !studyIsWord(text[j-1]))j--;while(j>start && studyIsWord(text[j-1]))j--;while(j>start && !studyIsWord(text[j-1]))j--;if(j>start)end=j;}
    else if(op==='shrinkStart'){i=start;while(i<end && !studyIsWord(text[i]))i++;while(i<end && studyIsWord(text[i]))i++;while(i<end && !studyIsWord(text[i]))i++;if(i<end)start=i;}
    else if(op==='sentence'){
      i=start;while(i>0 && start-i<2000 && '.!?…'.indexOf(text[i-1])<0)i--;start=i;
      j=end;while(j<text.length && j-end<2000 && '.!?…'.indexOf(text[j-1])<0)j++;while(j<text.length && '»”)'.indexOf(text[j])>=0)j++;end=j;
    } else throw new Error('Ajuste desconhecido.');
    return {section:section,model:model,start:start,end:end};
  }
  // Arrastar depois de pressionar e segurar (23/11/2026, pedido do dono: "não dá mais pra ir arrastando e selecionando outras
  // palavras"). A palavra do toque fica como âncora; o trecho vai até a palavra sob o dedo, nos dois sentidos, dentro do capítulo.
  // Enquanto o dedo se move só a seleção visível muda; ao soltar, o trecho final responde ao mesmo pedido do toque longo.
  var studyPress=null,studyDragPending=null,studyGestureAt=0;
  window.studyDragBegin=function(){studyPress=null;studyDragPending=null;studyGestureAt=Date.now();};
  function studyDragPick(x,y){
    var pick=studyPress.pick,position=studyPointPosition(x,y);if(!position)return null;
    var node=position.node,section=node.parentElement.closest('.epub-chapter');if(section!==pick.section)return null;
    var model=pick.model,entry=model.nodes.find(function(e){return e.node===node;});if(!entry)return null;
    var text=model.text,at=entry.start+Math.min(position.offset,Math.max(0,node.length-1));
    if(!studyIsWord(text[at]) && studyIsWord(text[at-1]) && !studyBreaks(model)[at])at--;
    if(!studyIsWord(text[at]))return null;
    var word=studyWordAround(model,at);
    return {section:section,model:model,start:Math.min(pick.start,word[0]),end:Math.max(pick.end,word[1])};
  }
  function studyDragTo(x,y,final){
    if(!isFinite(x)||!isFinite(y))return;
    if(!studyPress){studyDragPending={x:x,y:y,final:final};return;}
    var picked=studyDragPick(x,y)||studyPress.last;studyPress.last=picked;
    if(final){studyReplySelection(studyPress.request,picked);return;}
    var result=studyAnchorFor(picked.section,picked.model,picked.start,picked.end);studySelectionStyle(true);studyShowSelection(result.range);
  }
  window.studyDragTo=function(x,y,final){
    try{studyDragTo(x,y,final);}catch(error){if(final && studyPress)studyReply(studyPress.request,{status:'error',message:error.message});}
  };
  function studyReplySelection(request,picked){
    var result=studyAnchorFor(picked.section,picked.model,picked.start,picked.end);
    window.__studySelectionRequest=request;window.__studyLastCapture=result.anchor.chapterId+':'+result.anchor.start+':'+result.anchor.end;
    studySelectionStyle(true);studyShowSelection(result.range);
    studyReply(request,{status:'captured',anchor:result.anchor,text:result.text});
  }
  `;
}
