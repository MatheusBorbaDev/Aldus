// Real panel with controlled platform boundaries; not physical Android proof.
const fs=require('fs'),ts=require('typescript'),assert=require('node:assert/strict');
const React=require('../.expo/auth-test-tools/node_modules/react');
const {act,create}=require('../.expo/auth-test-tools/node_modules/react-test-renderer');
global.IS_REACT_ACT_ENVIRONMENT=true;
const palette={text:'#222',secondaryText:'#555',accent:'#174',onAccent:'#fefefe',separator:'#ddd',panel:'#fff'};
const changes=[];const settings={palette,hideReadingCounts:false,theme:'paper',font:'serif',fontSize:20,lineHeight:1.5,paragraphSpacing:.8,marginSize:24,maxWidth:900,brightness:80,useSystemBrightness:true};
for(const key of ['HideReadingCounts','Theme','Font','FontSize','LineHeight','ParagraphSpacing','Margin','MaxWidth','Brightness','UseSystemBrightness'])settings['set'+key]=value=>changes.push([key,value]);
const output={};new Function('require','exports',ts.transpileModule(fs.readFileSync('src/presentation/components/ReaderSettingsPanel.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText)(name=>{
 if(name==='react')return React;if(name==='react/jsx-runtime')return require('../.expo/auth-test-tools/node_modules/react/jsx-runtime');
 if(name==='react-native')return {Modal:'Modal',View:'View',Text:'Text',Pressable:'Pressable',ScrollView:'ScrollView',Switch:'Switch',TextInput:'TextInput',Platform:{OS:'android'},StyleSheet:{create:x=>x,absoluteFill:{}}};
 if(name.includes('ReaderSettingsContext'))return{useReaderSettings:()=>settings,DEFAULT_READER_LINE_HEIGHT:1.65,DEFAULT_READER_PARAGRAPH_SPACING:1};
 if(name.includes('pdfReader'))return{defaultPdfReaderSettings:{lineHeight:1.6,paragraphSpacing:1}};
 if(name.includes('safe-area'))return{useSafeAreaInsets:()=>({top:24,bottom:24})};
 if(name.includes('ReaderSettingsSlider'))return{ReaderSettingsSlider:'Slider'};
 if(name.includes('MotionCuesControl'))return{MotionCuesControl:'Motion'};
 if(name.includes('readerUiDiagnostics'))return{readerUiDiagnostic(){}};
 if(name.includes('/tokens'))return{pdfReaderThemes:{paper:palette}};
 return{};
},output);
(async()=>{let tree,closed=0,focused=0;await act(async()=>{tree=create(React.createElement(output.ReaderSettingsPanel,{visible:true,panelMode:'appearance',onClose:()=>closed++,onReadInFocus:()=>focused++}));});
 const scroll=tree.root.findByType('ScrollView'),slider=tree.root.findAllByType('Slider').find(x=>x.props.accessibilityLabel==='Tamanho da fonte');
 for(const label of ['Tipografia','Página e layout','Concentração e conforto','Aparência']){
  const category=tree.root.findAllByType('Pressable').find(x=>x.findAllByType('Text').some(t=>t.children.includes(label)));assert(category,label);
  await act(async()=>category.props.onPress());assert.equal(category.props.accessibilityState.selected,true);
  assert.strictEqual(tree.root.findByType('ScrollView'),scroll);assert.strictEqual(tree.root.findAllByType('Slider').find(x=>x.props.accessibilityLabel==='Tamanho da fonte'),slider);
 }
 assert.deepEqual(changes,[],'Category navigation never writes reader preferences');
 await act(async()=>slider.props.onValueChange(24));assert.deepEqual(changes,[['FontSize',24]]);
 const hide=tree.root.findAllByType('Switch').find(x=>x.props.accessibilityLabel==='Ocultar porcentagem e contagem de páginas');await act(async()=>hide.props.onValueChange(true));assert.deepEqual(changes.at(-1),['HideReadingCounts',true]);
 const close=tree.root.findAllByType('Pressable').find(x=>x.props.accessibilityLabel==='Fechar ajustes de leitura');assert(!close.parent.findAllByType('ScrollView').length,'Close remains outside scroll content');await act(async()=>close.props.onPress());assert.equal(closed,1);
 // BUG 15: the saved legacy 1.5/0.8 are not options, so nothing is marked and nothing is rewritten.
 const segmentsFor=label=>{const heading=tree.root.findAllByType('Text').find(t=>t.children.join('')===label);const row=heading.parent.children[heading.parent.children.indexOf(heading)+1];return row.findAllByType('Pressable');};
 assert.deepEqual(segmentsFor('ESPAÇAMENTO ENTRE LINHAS').map(x=>x.props.accessibilityState.selected),[false,false,false],'legacy 1.5 marks no option');
 // Defaults: 'Médio' is exactly the default, so tapping the marked option keeps the reading layout.
 settings.lineHeight=1.65;settings.paragraphSpacing=1;await act(async()=>tree.update(React.createElement(output.ReaderSettingsPanel,{visible:true,panelMode:'appearance',onClose:()=>closed++,onReadInFocus:()=>focused++})));
 for(const [label,key,expected] of [['ESPAÇAMENTO ENTRE LINHAS','LineHeight',[1.4,1.65,1.9]],['ESPAÇO ENTRE PARÁGRAFOS','ParagraphSpacing',[0.5,1,1.5]]]){
  const segments=segmentsFor(label);assert.deepEqual(segments.map(x=>x.props.accessibilityState.selected),[false,true,false],label+' default marked as Médio');
  for(const [i,segment] of segments.entries()){assert.ok(segment.props.style.some(s=>s&&s.minHeight>=44),label+' 44px target');await act(async()=>segment.props.onPress());assert.deepEqual(changes.at(-1),[key,expected[i]]);}
  assert.equal(segments[1].findByType('Text').props.style.at(-1).color,palette.onAccent,'selected text uses onAccent (BUG 16)');
 }
 const source=fs.readFileSync('src/presentation/components/ReaderSettingsPanel.tsx','utf8');
 assert.match(source,/accessibilityLabel="Diminuir zoom"/);assert.match(source,/accessibilityLabel="Aumentar zoom"/);assert.doesNotMatch(source,/["']#fff(fff)?["']/i,'selected text follows the theme (onAccent), never fixed white');
 await act(async()=>tree.unmount());console.log('PASS real settings categories: stable controls, no preference writes on navigation, slider/switch handlers, fixed close; spacing defaults marked as Médio, legacy values untouched, 44px segments, onAccent, zoom labels. Controlled platform, not device proof.');
})().catch(e=>{console.error(e);process.exitCode=1;});
