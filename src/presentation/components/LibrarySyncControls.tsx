import { useEffect, useState, useSyncExternalStore } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { isRecordBook, LibraryBook } from '@/src/domain/entities/LibraryBook';
import { LibrarySyncEntry, LibraryEntityKind } from '@/src/domain/types/librarySync';
import { appDependencies } from '@/src/presentation/services/dependencies';
import { useAppTheme } from '@/src/presentation/contexts/AppThemeContext';
import { useLibraryStore } from '@/src/presentation/stores/libraryStore';
import { availabilityLabels } from '@/src/data/library/LibrarySyncCoordinator';
import { libraryMutationEvents } from '@/src/data/library/LibrarySyncPayload';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { formatBytes } from '@/src/domain/saas/planPresentation';
import { planLabel,numberLabel } from '@/src/presentation/i18n/ptBR';

export function useLibrarySync(){const sync=appDependencies.librarySync;useSyncExternalStore(sync.subscribe,()=>sync.version,()=>sync.version);return sync;}
const entityLabels:Record<LibraryEntityKind,string>={book:'Livro',progress:'Posição de leitura',bookmark:'Marcador e nota',highlight:'Grifo e comentário',organization:'Organização',pdf_position:'Posições do PDF'};
function describe(payload:Record<string,any>,deleted:boolean){if(deleted)return 'Remover';return [payload.title,payload.author,payload.text,payload.note,payload.comment,typeof payload.percentage==='number'?`${Math.round(payload.percentage*100)}%`:null,payload.favorite===true?'Favorito':null,Array.isArray(payload.collections)?payload.collections.join(', '):null,Array.isArray(payload.tags)?payload.tags.join(', '):null,payload.mode==='reflow'?'PDF em Reflow':payload.mode==='original'?'PDF Original':null].filter(Boolean).join(' · ').slice(0,1000)||'Alteração de posição ou dados pessoais';}
function Action({label,onPress,disabled=false}:{label:string;onPress:()=>void;disabled?:boolean}){const {palette}=useAppTheme();return <Pressable accessibilityRole="button" accessibilityLabel={label} disabled={disabled} onPress={onPress} style={{paddingVertical:12,paddingHorizontal:10,opacity:disabled?.5:1,borderWidth:1,borderColor:palette.border,borderRadius:6}}><Text style={{color:palette.accent}}>{label}</Text></Pressable>;}
function Dialog({children,onClose}:{children:React.ReactNode;onClose:()=>void}){const {palette}=useAppTheme();return <Modal transparent animationType="fade" onRequestClose={onClose}><View style={{flex:1,backgroundColor:'rgba(0,0,0,.6)',justifyContent:'center',padding:20}}><ScrollView style={{maxHeight:'85%',backgroundColor:palette.surface,borderRadius:10}} contentContainerStyle={{padding:20,gap:14}}>{children}<Action label="Fechar" onPress={onClose}/></ScrollView></View></Modal>;}

export function LibrarySyncControls({showPlanLink=true,showQuotaSummary=true}:{showPlanLink?:boolean;showQuotaSummary?:boolean}={}){
  const sync=useLibrarySync(),{palette}=useAppTheme();
  const [error,setError]=useState<string|null>(null),[legacy,setLegacy]=useState<LibraryBook[]|null>(null),[selected,setSelected]=useState<string[]>([]),[conflicts,setConflicts]=useState<Array<LibrarySyncEntry & {parentDeleted?:boolean}>|null>(null),[busy,setBusy]=useState(false);
  const operate=async(work:()=>Promise<unknown>)=>{setBusy(true);setError(null);try{await work();}catch(e){setError(e instanceof Error?e.message:'Não foi possível concluir.');}finally{setBusy(false);}};
  const pending=sync.engine.status.pending+sync.status.pendingFiles;
  return <View style={{gap:10}}>
    <Text style={{color:palette.text,fontWeight:'600'}}>Sincronização da biblioteca</Text>
    <Text style={{color:palette.secondaryText}}>{sync.status.running?'Sincronizando…':pending?`${numberLabel(pending)} ${pending===1?'operação pendente':'operações pendentes'}`:sync.engine.status.lastSync?'Sincronizada':'Ainda não sincronizada'}{sync.engine.status.conflicts?` · ${numberLabel(sync.engine.status.conflicts)} ${sync.engine.status.conflicts===1?'conflito':'conflitos'}`:''}</Text>
    <Text style={{color:palette.secondaryText,fontSize:12}}>Última sincronização: {sync.engine.status.lastSync?new Date(sync.engine.status.lastSync).toLocaleString('pt-BR'):'—'}</Text>
    <Text style={{color:palette.secondaryText,fontSize:12}}>Livros e dados de leitura são sincronizados privadamente com sua conta. Sem conexão, alterações ficam pendentes; arquivos de outro dispositivo são baixados ao abrir.</Text>
    {(error||sync.status.error||sync.engine.status.error||libraryMutationEvents.error)?<Text accessibilityRole="alert" style={{color:palette.accent}}>{error||sync.status.error||sync.engine.status.error||libraryMutationEvents.error}</Text>:null}
    {showQuotaSummary&&sync.engine.quota?<Text style={{color:palette.secondaryText,fontSize:12}}>
      {'Plano '+planLabel(sync.engine.quota.effectivePlan)+': '+numberLabel(sync.engine.quota.usage.syncedBooks)+'/'+numberLabel(sync.engine.quota.limits.syncedBooks)+' livros. '}
      {formatBytes(sync.engine.quota.usage.storageBytes)+' usados'}
      {'. '+formatBytes(sync.engine.quota.usage.reservedBytes)+' reservados em '+sync.engine.quota.usage.reservedUploads+' envios. '}
      {formatBytes(sync.engine.quota.remaining.storageBytes)+' disponíveis'}
      {sync.engine.quota.overLimit?'. Acima da franquia: dados preservados; novos envios ficam pendentes.':''}
    </Text>:null}
    <Action label="Sincronizar agora" disabled={busy||sync.status.running} onPress={()=>void operate(()=>sync.retryQuota())}/>
    {showPlanLink?<Action label="Meu Plano e armazenamento" onPress={()=>router.push('/plan' as never)}/>:null}
    <Action label="Adicionar livros locais à minha conta" disabled={busy} onPress={()=>void operate(async()=>{setSelected([]);setLegacy(await appDependencies.bookRepository.listLegacy());})}/>
    {sync.engine.status.conflicts?<Action label="Revisar conflitos" disabled={busy} onPress={()=>void operate(async()=>setConflicts(await sync.conflicts()))}/>:null}
    {legacy?<Dialog onClose={()=>{if(!busy)setLegacy(null);}}><Text style={{color:palette.text,fontWeight:'600'}}>Vincular livros antigos à conta atual</Text><Text style={{color:palette.secondaryText}}>Escolha os livros deste dispositivo que devem pertencer à sua conta. O vínculo preserva IDs, progresso e anotações e permite o envio privado. Nenhum livro é atribuído automaticamente.</Text>{legacy.length===0?<Text style={{color:palette.text}}>Não há livros locais sem conta.</Text>:legacy.map(book=><Action key={book.id} label={`${selected.includes(book.id)?'✓ ':''}${book.title} · ${book.author}`} disabled={busy} onPress={()=>setSelected(ids=>ids.includes(book.id)?ids.filter(id=>id!==book.id):[...ids,book.id])}/>)}<Action label={`Confirmar vínculo de ${selected.length} livros`} disabled={busy||!selected.length} onPress={()=>void operate(async()=>{await appDependencies.bookRepository.claimLegacy(selected);await useLibraryStore.getState().refresh();setLegacy(null);sync.schedule(0);})}/></Dialog>:null}
    {conflicts?<Dialog onClose={()=>setConflicts(null)}><Text style={{color:palette.text}}>Alterações concorrentes</Text>{conflicts.map(entry=><View key={entry.key} style={{gap:8}}><Text selectable style={{color:palette.text}}>{entityLabels[entry.kind]}</Text><Text style={{color:palette.secondaryText}}>Versão recebida: {describe(entry.payload,entry.deleted)}</Text><Text style={{color:palette.secondaryText}}>Alteração deste dispositivo: {describe(entry.conflict!.payload,entry.conflict!.deleted)}</Text>{!entry.shadow?.deleted_at && !entry.parentDeleted?<Action label="Aplicar alteração deste dispositivo" disabled={busy} onPress={()=>void operate(async()=>{await sync.resolve(entry.key,'local');setConflicts(await sync.conflicts());})}/>:<Text style={{color:palette.secondaryText}}>Livro removido da conta. Para adicioná-lo novamente, importe com uma nova identidade.</Text>}<Action label="Manter versão recebida e descartar conflito" disabled={busy} onPress={()=>void operate(async()=>{await sync.resolve(entry.key,'remote');setConflicts(await sync.conflicts());})}/></View>)}</Dialog>:null}
  </View>;
}

interface BookMenuProps {
  book: LibraryBook;
  /** Título de exibição (o mesmo do cartão); por padrão o título salvo. */
  title?: string;
  /** Situação de leitura mostrada antes da disponibilidade, na mesma linha (ex.: "Lendo"). */
  status?: string;
  onOpen?(): void;
  onOrganize?(): void;
  organizeDisabled?: boolean;
}

/**
 * Linha de situação do livro + menu "⋯" (redesenho, etapa 3). O menu é uma folha compacta: ações comuns em lista e, separadas,
 * as duas remoções com a consequência de cada uma escrita e uma confirmação. A lógica de remoção é a mesma de antes.
 */
export function BookCloudControls({book,title,status,onOpen,onOrganize,organizeDisabled=false}:BookMenuProps){
  const sync=useLibrarySync(),{palette}=useAppTheme();const [visible,setVisible]=useState(false),[confirm,setConfirm]=useState<'device'|'library'|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState<string|null>(null);
  const state=sync.availability(book),transfer=state==='DOWNLOADING'||state==='UPLOADING';
  const name=title??book.title,danger=palette.danger??palette.accent;
  useEffect(()=>{setVisible(false);setConfirm(null);setError(null);},[book.ownerUserId]);
  const close=()=>{if(!busy){setVisible(false);setConfirm(null);setError(null);}};
  const deviceBlocked=!book.filePath||!book.remotePath||!!book.bundledAssetId;
  const deviceHint=isRecordBook(book)?'Livro sem arquivo: só as informações estão guardadas, não há arquivo para apagar.':book.bundledAssetId?'Livro do acervo do app: não ocupa espaço extra neste aparelho.':!book.remotePath?'Disponível depois que o livro for enviado para a sua conta.':!book.filePath?'O arquivo já não está neste aparelho.':'O arquivo sai deste aparelho. O livro, o progresso e as notas continuam na sua conta e ele é baixado de novo ao abrir.';
  const run=(action:()=>void)=>{setVisible(false);setConfirm(null);action();};
  const remove=async()=>{setBusy(true);setError(null);try{if(confirm==='device')await sync.removeDeviceCopy(book.id);else{await appDependencies.bookRepository.softDelete(book.id);await useLibraryStore.getState().refresh();sync.schedule(0);}setVisible(false);setConfirm(null);}catch(e){setError(e instanceof Error?e.message:'Falha na remoção.');}finally{setBusy(false);}};
  return <><View style={menu.line}>
    <Text numberOfLines={2} style={[menu.lineText,{color:palette.secondaryText}]}>{status?status+' · ':''}{availabilityLabels[state]}</Text>
    {state==='QUOTA_BLOCKED'?<Pressable accessibilityRole="button" accessibilityLabel="Ver franquia em Meu Plano" onPress={()=>router.push('/plan' as never)} style={menu.planLink}><Text style={{color:palette.accent,fontSize:12}}>Meu Plano</Text></Pressable>:null}
    <Pressable accessibilityRole="button" accessibilityLabel={`Ações de ${book.title}`} accessibilityHint="Abrir, organizar ou remover este livro" onPress={()=>setVisible(true)} android_ripple={{color:palette.separator,borderless:true}} style={menu.more}>
      <Ionicons name="ellipsis-horizontal" size={21} color={palette.secondaryText}/>
    </Pressable>
  </View>{visible?<Modal transparent animationType="fade" onRequestClose={close}><View style={menu.backdrop}>
    <Pressable accessibilityLabel="Fechar menu do livro" style={menu.fill} onPress={close}/>
    <View accessibilityViewIsModal style={[menu.sheet,{backgroundColor:palette.panel??palette.surface,borderColor:palette.border}]}>
      <View style={menu.header}>
        <Text accessibilityRole="header" numberOfLines={2} style={[menu.title,{color:palette.text}]}>{name}</Text>
        <Text numberOfLines={1} style={[menu.meta,{color:palette.secondaryText}]}>{[book.author,book.mimeType==='application/pdf'?'PDF':book.mimeType==='application/epub+zip'?'EPUB':null,typeof book.fileSize==='number'&&book.fileSize>0?formatBytes(book.fileSize):null,availabilityLabels[state]].filter(Boolean).join(' · ')}</Text>
      </View>
      {error?<Text accessibilityRole="alert" style={[menu.alert,{color:danger}]}>{error}</Text>:null}
      {confirm?<View style={menu.confirm}>
        <Text style={[menu.confirmTitle,{color:palette.text}]}>{confirm==='device'?'Apagar a cópia deste aparelho?':'Remover da sua biblioteca?'}</Text>
        <Text style={{color:palette.secondaryText,lineHeight:20}}>{confirm==='device'?'O livro permanece na conta e pode ser baixado ao abrir novamente.':'Ele sai de todos os seus dispositivos. A exclusão ficará pendente se estiver offline. O arquivo remoto será excluído após confirmação da sincronização.'}</Text>
        <View style={menu.confirmActions}>
          <Pressable accessibilityRole="button" accessibilityLabel="Confirmar remoção" accessibilityState={{disabled:busy,busy}} disabled={busy} onPress={()=>void remove()} android_ripple={{color:palette.separator}} style={[menu.button,{backgroundColor:danger,borderColor:danger,opacity:busy?.5:1}]}><Text style={[menu.buttonText,{color:palette.onDanger??palette.panel??palette.surface}]}>{busy?'Removendo…':'Confirmar remoção'}</Text></Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Cancelar remoção" disabled={busy} onPress={()=>setConfirm(null)} android_ripple={{color:palette.separator}} style={[menu.button,{borderColor:palette.border}]}><Text style={[menu.buttonText,{color:palette.text}]}>Cancelar</Text></Pressable>
        </View>
      </View>:<>
        {onOpen?<MenuRow icon="book-outline" label="Abrir" onPress={()=>run(onOpen)}/>:null}
        {onOrganize?<MenuRow icon="pricetag-outline" label="Organizar" description="Coleções, etiquetas, série, favorito e situação de leitura" disabled={organizeDisabled} onPress={()=>run(onOrganize)}/>:null}
        {onOpen||onOrganize?<View style={[menu.divider,{backgroundColor:palette.separator??palette.border}]}/>:null}
        <MenuRow icon="phone-portrait-outline" tone="danger" label="Remover deste dispositivo" description={deviceHint} disabled={busy||transfer||deviceBlocked} onPress={()=>setConfirm('device')}/>
        <MenuRow icon="trash-outline" tone="danger" label="Remover da minha biblioteca" description="Sai de todos os seus dispositivos, com progresso e notas." disabled={busy||transfer} onPress={()=>setConfirm('library')}/>
        <Pressable accessibilityRole="button" accessibilityLabel="Fechar" onPress={close} android_ripple={{color:palette.separator}} style={menu.closeRow}><Text style={{color:palette.accent,fontWeight:'600'}}>Fechar</Text></Pressable>
      </>}
    </View>
  </View></Modal>:null}</>;
}

function MenuRow({icon,label,description,onPress,disabled=false,tone='default'}:{icon:React.ComponentProps<typeof Ionicons>['name'];label:string;description?:string;onPress:()=>void;disabled?:boolean;tone?:'default'|'danger'}){
  const {palette}=useAppTheme();const ink=tone==='danger'?palette.danger??palette.accent:palette.text;
  return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityHint={description} accessibilityState={{disabled}} disabled={disabled} onPress={onPress} android_ripple={{color:palette.separator}} style={[menu.row,{opacity:disabled?.5:1}]}>
    <View style={menu.rowIcon}><Ionicons name={icon} size={20} color={ink}/></View>
    <View style={menu.rowText}><Text style={{color:ink,fontSize:15,fontWeight:'600'}}>{label}</Text>{description?<Text style={[menu.rowDescription,{color:palette.secondaryText}]}>{description}</Text>:null}</View>
  </Pressable>;
}

const menu=StyleSheet.create({
  line:{flexDirection:'row',alignItems:'center',gap:6},
  lineText:{flex:1,fontSize:12,lineHeight:16},
  planLink:{minHeight:44,justifyContent:'center',padding:6},
  more:{width:44,height:44,alignItems:'center',justifyContent:'center',borderRadius:22},
  fill:{position:'absolute',top:0,right:0,bottom:0,left:0},
  backdrop:{flex:1,justifyContent:'flex-end',alignItems:'center',backgroundColor:'rgba(0,0,0,.45)'},
  sheet:{width:'100%',maxWidth:480,maxHeight:'88%',borderTopLeftRadius:20,borderTopRightRadius:20,borderWidth:1,paddingTop:18,paddingBottom:14,paddingHorizontal:8},
  header:{paddingHorizontal:12,paddingBottom:10,gap:3},
  title:{fontSize:17,fontWeight:'600',lineHeight:23},
  meta:{fontSize:12},
  alert:{paddingHorizontal:12,paddingBottom:8},
  row:{minHeight:52,flexDirection:'row',alignItems:'center',gap:14,paddingHorizontal:12,paddingVertical:8,borderRadius:10},
  rowIcon:{width:24,alignItems:'center'},
  rowText:{flex:1,minWidth:0,gap:2},
  rowDescription:{fontSize:12,lineHeight:17},
  divider:{height:1,marginVertical:6,marginHorizontal:12},
  closeRow:{minHeight:44,alignItems:'center',justifyContent:'center',marginTop:4},
  confirm:{paddingHorizontal:12,gap:10,paddingBottom:4},
  confirmTitle:{fontSize:16,fontWeight:'600'},
  confirmActions:{flexDirection:'row',flexWrap:'wrap',gap:10,marginTop:4},
  button:{minHeight:44,justifyContent:'center',paddingHorizontal:16,borderRadius:10,borderWidth:1},
  buttonText:{fontWeight:'600'},
});
