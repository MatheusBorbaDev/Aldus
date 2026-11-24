import { useEffect,useRef } from 'react';
import type { CatalogPlan } from '@/src/domain/saas/accountPlan';
import { catalogPrice,featureLabels,formatBytes } from '@/src/domain/saas/planPresentation';
import { planLabel } from '@/src/presentation/i18n/ptBR';
import { initialCatalogReference } from './catalogReference.generated';
import { landingCss } from './landingStyles';
import { MedalDefs, Medal } from './AldusMedal';
import { PressHero } from './PressHero';
import { pressCss } from './pressStyles';
import { useLandingScrollEffects } from './landingScrollEffects';

export interface LandingProps { signedIn?:boolean; catalog?:CatalogPlan[]; contactEmail?:string|null; }
const faqs=[
 ['O Aldus é gratuito?','Sim. Leitura local, importação e ferramentas básicas de estudo fazem parte do plano Gratuito. A proposta inclui sincronização e armazenamento privado com franquia; os serviços de nuvem estão em ativação.'],
 ['Posso importar meus próprios livros?','Você pode adicionar arquivos EPUB e PDF ao aplicativo. Importe apenas obras que você tem direito de usar. Seus arquivos locais continuam disponíveis independentemente de plano pago.'],
 ['Posso compartilhar livros pelo Aldus?','Não. Leia o que é seu. O Aldus abre os EPUB e PDF que você já tem; não vende livros e não tem função para compartilhar arquivos.'],
 ['Posso ler sem internet?','Livros locais podem ser lidos sem conexão no aplicativo Android. Na Web, mantenha o aplicativo carregado e o arquivo disponível no navegador; abrir o site pela primeira vez pode exigir internet. Importe ou baixe seus livros antes de ficar offline.'],
 ['Minha biblioteca pode sincronizar entre dispositivos?','O Aldus já possui recursos de sincronização de biblioteca, progresso e estudos. A disponibilidade dos envios e das franquias de nuvem está em ativação. Consulte Meu Plano no aplicativo antes de contar com esse serviço entre dispositivos.'],
 ['O que acontece quando o armazenamento fica cheio?','A leitura local continua. Arquivos, notas e progresso existentes são preservados. Novos envios que ultrapassem a franquia aguardam capacidade disponível; alterações permitidas de livros existentes podem continuar sincronizando.'],
 ['Preciso pagar para usar o Reader?','Não. Leitura EPUB e PDF e importação local fazem parte da experiência gratuita. O Pro amplia a capacidade prevista de nuvem, tem preço ainda não definido e não está disponível para contratação.'],
];
function Arrow(){return <span aria-hidden="true">↗</span>;}
export function LandingDocument({signedIn=false,catalog,contactEmail=null}:LandingProps){
 const root=useRef<HTMLDivElement>(null),menu=useRef<HTMLDetailsElement>(null);
 const plans=catalog??initialCatalogReference;
 useLandingScrollEffects(root);
 useEffect(()=>{
  const media=window.matchMedia('(prefers-reduced-motion: reduce)');
  let observer:IntersectionObserver|undefined;
  const reveal=()=>{observer?.disconnect();root.current?.querySelectorAll('[data-reveal]').forEach(n=>n.setAttribute('data-visible','true'));};
  if(!media.matches&&typeof IntersectionObserver!=='undefined'){
   observer=new IntersectionObserver(entries=>{for(const entry of entries)if(entry.isIntersecting){entry.target.setAttribute('data-visible','true');observer?.unobserve(entry.target);}},{threshold:.08});
   root.current?.querySelectorAll('[data-reveal]').forEach(n=>{n.setAttribute('data-visible','false');observer!.observe(n);});
  }
  const motion=()=>{if(media.matches)reveal();};media.addEventListener('change',motion);
  const escape=(event:KeyboardEvent)=>{if(event.key==='Escape'&&menu.current?.open){menu.current.open=false;menu.current.querySelector('summary')?.focus();}};
  window.addEventListener('keydown',escape);
  return()=>{observer?.disconnect();media.removeEventListener('change',motion);window.removeEventListener('keydown',escape);};
 },[]);
 const closeMenu=()=>{if(menu.current)menu.current.open=false;};
 const cta=signedIn?'/library':'/auth/signup';
 const ctaText=signedIn?'Abrir minha biblioteca':'Criar minha conta';
 const nav=<><a href="#recursos" onClick={closeMenu}>Recursos</a><a href="#como-funciona" onClick={closeMenu}>Como funciona</a><a href="#planos" onClick={closeMenu}>Planos</a><a href="#perguntas" onClick={closeMenu}>Perguntas frequentes</a></>;
 return <div data-aldus-landing ref={root}>
  <style>{landingCss+pressCss}</style><MedalDefs/>
  <a className="al-skip" href="#conteudo">Pular para o conteúdo</a>
  <header className="al-header"><div className="al-header-inner">
   <a href="/" className="al-brand" aria-label="Aldus Reader, início"><Medal/><span>Aldus<span className="al-brand-reader"> Reader</span></span></a>
   <nav className="al-desktop-nav" aria-label="Navegação principal">{nav}</nav>
   <div className="al-header-actions">{!signedIn&&<a className="al-login" href="/auth/login">Entrar</a>}<a className="al-button al-button-small" href={cta}>{signedIn?'Biblioteca':'Criar conta'} <Arrow/></a></div>
   <details className="al-mobile-menu" ref={menu}><summary aria-label="Menu de navegação"><span aria-hidden="true">☰</span></summary><nav aria-label="Navegação para celular">{nav}{!signedIn&&<a href="/auth/login">Entrar</a>}<a href={cta}>{ctaText} <Arrow/></a></nav></details>
  </div></header>
  <main id="conteudo" tabIndex={-1}>
   <PressHero cta={cta} ctaText={ctaText}/>
   <div className="al-ribbon" aria-label="EPUB + PDF, leitura local, organização pessoal, deck + flashcard, no seu ritmo"><div className="al-ribbon-track" aria-hidden="true">{[0,1].flatMap(copy=>['EPUB + PDF','Leitura local','Organização pessoal','deck + flashcard','No seu ritmo'].map(item=><span key={copy+item}>{item}</span>))}</div></div>
   <section id="experiencia" className="al-container al-section" data-reveal><div className="al-section-heading"><div><p className="al-eyebrow">DA PRIMEIRA PÁGINA À PRÓXIMA IDEIA</p><h2>Seu universo de leitura.<br/><em>Bem perto de você.</em></h2></div><p className="al-read-text" data-read-text>Uma experiência que acompanha o livro inteiro: o que você lê, <span className="al-read-mark" data-read-mark>o que marca</span> e o que quer guardar.</p></div>
    <div className="al-experience-grid"><article className="al-feature-reader"><div className="al-mini-page" aria-hidden="true"><small>ALDUS READER</small><div>Encontre seu<br/><em>próprio ritmo.</em></div><p>Uma página aberta.<br/>Espaço para novas ideias.</p><div className="al-page-lines"/></div><div><span className="al-kicker">01 · LEITURA</span><h3>O Reader se adapta a você.</h3><p>Escolha fonte, tema e espaçamento. Leia EPUB ou preserve o layout do PDF Original. A Leitura Livre adapta PDFs compatíveis.</p></div></article>
     <article className="al-feature-study"><div className="al-study-art" aria-hidden="true"><span>Uma passagem importante.</span><div>Uma pergunta para depois.</div><small>SEU PRÓXIMO FLASHCARD</small></div><div><span className="al-kicker">02 · ESTUDO</span><h3>Da leitura ao aprendizado.</h3><p>Retome notas e grifos, reúna flashcards em um deck e revise com repetição espaçada nos recursos de estudo do aplicativo.</p></div></article>
    </div>
   </section>
   <section id="recursos" className="al-dark-section"><div className="al-container al-section" data-reveal><div className="al-section-heading"><div><p className="al-eyebrow">MENOS DISPERSÃO. MAIS LEITURA.</p><h2>Um lugar para ler.<br/><em>E continuar descobrindo.</em></h2></div><p>Ferramentas que ajudam a cuidar da sua biblioteca, sem tirar o foco da próxima página.</p></div>
    <div className="al-resources" data-stack>{[
     ['↳','Seus livros, com você','Importe EPUB e PDF e mantenha arquivos locais para ler sem depender de conexão.','Disponível no aplicativo'],
     ['▤','Tudo encontra seu lugar','Organize livros, acompanhe o progresso e retome suas leituras.','Disponível no aplicativo'],
     ['Aa','Uma leitura mais sua','Temas, fontes e ajustes de leitura para diferentes momentos e preferências.','Disponível no aplicativo'],
     ['✧','Ideias para revisitar','Notas, grifos e ferramentas de estudo ajudam a construir o seu repertório.','Conforme suporte do formato'],
     ['☁','Uma biblioteca entre dispositivos','Sincronização e espaço privado fazem parte do modelo gratuito, sujeitos à franquia.','Serviços de nuvem em ativação'],
     ['◎','Novas formas de compartilhar','Comunidade literária e batalhas de estudo fazem parte da evolução do Aldus.','Em desenvolvimento e homologação'],
    ].map(([icon,title,copy,status],i)=><article key={title} style={{['--al-i' as string]:i}}><span className="al-resource-icon" aria-hidden="true">{icon}</span><h3>{title}</h3><p>{copy}</p><small>{status}</small></article>)}</div>
   </div></section>
   <section id="como-funciona" className="al-container al-section" data-reveal><p className="al-eyebrow">SIMPLES DESDE O COMEÇO</p><h2>Abra espaço para<br/><em>a próxima história.</em></h2><ol className="al-steps">{[['Crie sua conta','Entre no Aldus pelo cadastro do aplicativo.'],['Adicione seus livros','Importe seus arquivos EPUB e PDF.'],['Organize sua biblioteca','Encontre um lugar para cada leitura.'],['Leia e estude','Ajuste o Reader e revisite suas ideias.']].map(([title,copy],i)=><li key={title}><span aria-hidden="true">0{i+1}</span><h3>{title}</h3><p>{copy}</p></li>)}</ol></section>
   <section id="planos" className="al-plans-section"><div className="al-container al-section" data-reveal><div className="al-section-heading"><div><p className="al-eyebrow">LEITURA PARA TODOS</p><h2>Comece com o essencial.<br/><em>Cresça no seu ritmo.</em></h2></div><p>Leitura e importação local são gratuitas. A diferença de capacidade está na franquia de nuvem, sem transformar o Reader em um recurso pago.</p></div>
    <p className="al-catalog-notice" role="note">{catalog?'Catálogo consultado com sua sessão. Valores informativos; nenhuma contratação está ativa.':'Referência inicial do catálogo, gerada da configuração do produto. O catálogo público em tempo real ainda não está disponível.'} Os serviços de nuvem estão em ativação. Consulte Meu Plano no aplicativo.</p>
    <div className="al-plan-grid">{plans.map(plan=><article key={plan.id} className={`al-plan ${plan.id==='pro'?'al-plan-pro':''}`}>
     <div className="al-plan-top"><span className="al-kicker">{plan.id==='free'?'SEU PONTO DE PARTIDA':'MAIS ESPAÇO PARA SUA BIBLIOTECA'}</span><span className="al-plan-state">{plan.id==='free'?'Sem mensalidade':'Contratação indisponível'}</span></div><h3>{planLabel(plan.id,plan.name)}</h3><p className={`al-plan-price ${plan.priceBrlCentavos===null?'al-plan-price-pending':''}`}>{catalogPrice(plan)}</p>
     {plan.id!=='free'&&plan.priceBrlCentavos!==null?<p>Preço de catálogo, apenas informativo.</p>:null}
     <div className="al-plan-capacity"><div><strong>{plan.limits.syncedBooks.toLocaleString('pt-BR')}</strong><span>livros sincronizados</span></div><div><strong>{formatBytes(plan.limits.storageBytes)}</strong><span>armazenamento privado</span></div></div>
     <ul>{Object.entries(featureLabels).filter(([id])=>plan.features[id]===true).map(([id,label])=><li key={id}><span aria-hidden="true">✓</span>{label}</li>)}</ul>
     {plan.id==='free'?<a className="al-button" href={cta}>{ctaText} <Arrow/></a>:<><button className="al-button" disabled>Contratação ainda indisponível</button><p className="al-plan-footnote">Preço e disponibilidade comercial serão informados quando houver uma oferta ativa.</p></>}
    </article>)}</div><p className="al-plans-note">As franquias descrevem o catálogo do Aldus, sem garantir capacidade agregada da infraestrutura de nuvem. Nenhum pagamento é iniciado aqui.</p>
   </div></section>
   <section id="perguntas" className="al-container al-section al-faq-section" data-reveal><div><p className="al-eyebrow">ANTES DA PRÓXIMA PÁGINA</p><h2>Boas perguntas.<br/><em>Respostas claras.</em></h2><p>A leitura começa com confiança.</p></div><div className="al-faq">{faqs.map(([question,answer])=><details key={question}><summary>{question}<span aria-hidden="true">+</span></summary><p>{answer}</p></details>)}</div></section>
   <section className="al-final al-container" data-reveal><Medal/><p className="al-eyebrow">UM NOVO CAPÍTULO</p><h2>Sua próxima leitura<br/>começa <em>aqui.</em></h2><p>Traga seus livros. Encontre seu ritmo.<br/>O resto começa na primeira página.</p><a className="al-button" href={cta}>{ctaText} <Arrow/></a></section>
  </main>
  <footer className="al-container al-footer"><div><a href="/" className="al-brand"><Medal/><span>Aldus Reader</span></a><p>Leia. Organize. Descubra.</p></div><nav aria-label="Informações legais"><a href="/legal/privacy">Privacidade</a><a href="/legal/terms">Termos de uso</a><a href="/legal/copyright">Direitos autorais</a><a href={contactEmail?`mailto:${contactEmail}`:'/legal/about'}>Contato</a></nav><p className="al-footer-note">© {new Date().getFullYear()} Aldus Reader. Respeite os direitos de cada obra.</p></footer>
 </div>;
}
