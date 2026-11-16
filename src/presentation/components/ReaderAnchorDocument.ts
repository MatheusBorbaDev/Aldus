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
      var model=studyText(section);
      for(var n=0;n<model.nodes.length;n++) {
        var entry=model.nodes[n];if(!entry.node.textContent.trim()) continue;
        var full=document.createRange();full.selectNodeContents(entry.node);
        var visible=Array.from(full.getClientRects()).some(function(r){return r.right>0 && r.left<width && r.bottom>0 && r.top<height;});
        if(!visible) continue;
        var low=0,high=entry.node.length;
        while(low<high){var mid=Math.floor((low+high)/2),r=document.createRange();r.setStart(entry.node,mid);r.setEnd(entry.node,mid+1);var rect=r.getBoundingClientRect();if(rect.right<=0)low=mid+1;else high=mid;}
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
        studySelectionStyle(!!request.enabled);
        if(!request.enabled){var current=window.getSelection();if(current)current.removeAllRanges();}
        return;
      }
      if(request.type==='studySelectAt'){studyReplySelection(request,studySelectAt(request));return;}
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
      var rect=range.getClientRects()[0],page=Math.floor((rect.left+(currentPage-1)*getPageWidth())/getPageWidth())+1;
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
  function studyTrim(text,start,end){while(start<end && !text[start].trim())start++;while(end>start && !text[end-1].trim())end--;return [start,end];}
  function studyAnchorFor(section,model,start,end){
    var bounds=studyTrim(model.text,start,end);start=bounds[0];end=bounds[1];
    var quote=model.text.slice(start,end);
    if(!quote.trim()||quote.length>10000)throw new Error('Selecione de 1 a 10 mil caracteres.');
    var range=studyRange(model,start,end);if(!range)throw new Error('Este trecho não pode ser selecionado.');
    var path=[],node=range.startContainer;while(node && node!==section){path.unshift(Array.prototype.indexOf.call(node.parentNode.childNodes,node));node=node.parentNode;}
    return {anchor:{version:1,kind:'epub-text',chapterId:section.getAttribute('data-chapter-id'),start:start,end:end,quote:quote,prefix:model.text.slice(Math.max(0,start-64),start),suffix:model.text.slice(end,end+64),path:path},range:range};
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
      var range=selection.getRangeAt(0),startNode=range.startContainer,endNode=range.endContainer;
      if(startNode.nodeType!==3 || endNode.nodeType!==3)throw new Error('Selecione um trecho de texto dentro do capítulo.');
      var section=startNode.parentElement.closest('.epub-chapter');
      if(!section || section!==endNode.parentElement.closest('.epub-chapter'))throw new Error('Selecione um trecho dentro de um único capítulo.');
      var model=studyText(section),first=model.nodes.find(function(e){return e.node===startNode;}),last=model.nodes.find(function(e){return e.node===endNode;});
      if(!first || !last)throw new Error('Este trecho não pode ser selecionado.');
      var captured=studyAnchorFor(section,model,first.start+range.startOffset,last.start+range.endOffset).anchor;
      var key=captured.chapterId+':'+captured.start+':'+captured.end;
      if(window.__studyLastCapture===key)return true;
      window.__studyLastCapture=key;
      studyReply(request,{status:'captured',anchor:captured});
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
    if(isAnimating || restorationPending || getPageWidth()<=0)throw new Error('Aguarde a página terminar de carregar.');
    var x=Number(request.x),y=Number(request.y);if(!isFinite(x)||!isFinite(y))throw new Error('Posição inválida.');
    var caret=document.caretRangeFromPoint?document.caretRangeFromPoint(x,y):null;
    if(!caret && document.caretPositionFromPoint){var p=document.caretPositionFromPoint(x,y);if(p){caret=document.createRange();caret.setStart(p.offsetNode,p.offset);}}
    var node=caret&&caret.startContainer;
    if(!node || node.nodeType!==3 || !node.parentElement.closest('.epub-chapter'))throw new Error('Pressione sobre uma palavra do texto.');
    var section=node.parentElement.closest('.epub-chapter'),model=studyText(section),entry=model.nodes.find(function(e){return e.node===node;});
    if(!entry)throw new Error('Pressione sobre uma palavra do texto.');
    var text=model.text,at=entry.start+caret.startOffset;
    if(!studyIsWord(text[at]) && studyIsWord(text[at-1]))at--;
    if(!studyIsWord(text[at]))throw new Error('Pressione sobre uma palavra do texto.');
    var start=at,end=at;while(start>0 && studyIsWord(text[start-1]))start--;while(end<text.length && studyIsWord(text[end]))end++;
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
    if(op==='growEnd'){j=end;while(j<text.length && !studyIsWord(text[j]))j++;while(j<text.length && studyIsWord(text[j]))j++;while(j<text.length && '.,;:!?…»”)'.indexOf(text[j])>=0)j++;end=j;}
    else if(op==='growStart'){i=start;while(i>0 && !studyIsWord(text[i-1]))i--;while(i>0 && studyIsWord(text[i-1]))i--;start=i;}
    else if(op==='shrinkEnd'){j=end;while(j>start && !studyIsWord(text[j-1]))j--;while(j>start && studyIsWord(text[j-1]))j--;while(j>start && !studyIsWord(text[j-1]))j--;if(j>start)end=j;}
    else if(op==='shrinkStart'){i=start;while(i<end && !studyIsWord(text[i]))i++;while(i<end && studyIsWord(text[i]))i++;while(i<end && !studyIsWord(text[i]))i++;if(i<end)start=i;}
    else if(op==='sentence'){
      i=start;while(i>0 && start-i<2000 && '.!?…'.indexOf(text[i-1])<0)i--;start=i;
      j=end;while(j<text.length && j-end<2000 && '.!?…'.indexOf(text[j-1])<0)j++;while(j<text.length && '»”)'.indexOf(text[j])>=0)j++;end=j;
    } else throw new Error('Ajuste desconhecido.');
    return {section:section,model:model,start:start,end:end};
  }
  function studyReplySelection(request,picked){
    var result=studyAnchorFor(picked.section,picked.model,picked.start,picked.end);
    window.__studySelectionRequest=request;window.__studyLastCapture=result.anchor.chapterId+':'+result.anchor.start+':'+result.anchor.end;
    studySelectionStyle(true);studyShowSelection(result.range);
    studyReply(request,{status:'captured',anchor:result.anchor});
  }
  `;
}
