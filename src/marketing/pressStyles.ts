/**
 * Abertura "A prensa" (aprovada pelo dono em 23/11/2026): a medalha é cunhada, os tipos compõem o título, a folha imprime a página e o
 * livro se monta. Em repouso (sem JavaScript, movimento reduzido ou depois da abertura) a página já está impressa e legível.
 * Fonte: EB Garamond (OFL, servida pelo próprio site, a mesma da assinatura da marca). A Cormorant do protótipo foi trocada porque
 * desenha o circunflexo alto e solto ("ê" de "você", "experiência"), estranho em português.
 * `.al-intro-wait` vem do script do <head> do HTML pré-renderizado: segura a tela escura até o JavaScript começar a abertura.
 */
export const pressCss = `
@font-face{font-family:"Aldus Garamond";font-style:normal;font-weight:400;font-display:swap;src:url(/fonts/eb-garamond-latin-400-normal.woff2) format("woff2")}
@font-face{font-family:"Aldus Garamond";font-style:italic;font-weight:400;font-display:swap;src:url(/fonts/eb-garamond-latin-400-italic.woff2) format("woff2")}
[data-aldus-landing]{--al-display:"Aldus Garamond",Georgia,"Times New Roman",serif;--al-night:#13231e}
[data-aldus-landing] :is(h1,h2),.al-brand{font-family:var(--al-display);font-weight:400}
.al-medal{display:block;flex:none}
.al-brand .al-medal{width:34px;height:34px}
.al-press{position:relative;overflow:hidden;min-height:min(calc(100svh - 84px),860px);display:flex;align-items:center;padding-block:64px 72px}
.al-press-grid{position:relative;z-index:3;display:grid;grid-template-columns:minmax(0,1.15fr) minmax(0,.85fr);gap:48px;align-items:center}
.al-press-copy{min-width:0}
.al-press h1{font-size:clamp(50px,8.2vw,116px);line-height:.95;letter-spacing:-.035em;margin:0 0 26px!important}
.al-press h1 em{font-style:italic;color:var(--al-accent)}
.al-press .al-lead{max-width:30em;font-size:18px;margin-bottom:30px}
.al-w{display:inline-block;white-space:nowrap}
.al-ch{display:inline-block}
.al-press-line{transition:color .5s ease}
.al-press-dark{position:absolute;inset:0;z-index:1;background:radial-gradient(120% 90% at 30% 40%,#1d332b,var(--al-night) 70%)}
.al-press-sorts{position:absolute;inset:0;z-index:2;pointer-events:none}
.al-sort{position:absolute;font-family:var(--al-display);line-height:1;color:var(--al-paper);opacity:.08}
.al-press-plate{position:absolute;inset:0;z-index:2;background:var(--al-paper);clip-path:inset(0 0 100% 0)}
.al-press-edge{position:absolute;left:0;right:0;top:0;height:3px;z-index:2;background:linear-gradient(90deg,transparent,var(--al-orange),transparent);box-shadow:0 0 40px 8px #d9775766;opacity:0}
.al-seal{position:fixed;z-index:40;left:50%;top:50%;width:180px;height:180px;margin:-90px 0 0 -90px;pointer-events:none;overflow:visible}
.al-seal-ring{stroke-dasharray:1;stroke-dashoffset:1;transform:rotate(-90deg);transform-origin:470px 712px}
.al-seal-face{transform-origin:470px 712px}
.al-press-stage{perspective:1600px;display:grid;place-items:center;min-height:440px}
.al-press-book{position:relative;width:min(300px,62vw);aspect-ratio:3/4.2;transform-style:preserve-3d;transform:rotateY(-18deg) rotateX(6deg);transition:transform .6s cubic-bezier(.2,.8,.2,1)}
.al-pb-back,.al-pb-front,.al-pb-page{position:absolute;inset:0;border-radius:3px 8px 8px 3px}
.al-pb-back{background:#1f382f;transform:translateZ(-22px);box-shadow:30px 40px 60px -20px #13231e80}
.al-pb-page{background:linear-gradient(90deg,#e9e4d8,#fbf9f4 12%,#f1ede4);inset:4px 6px 4px 0;border:1px solid #d9d3c4}
.al-pb-front{background:linear-gradient(135deg,#2c5345,#1f3c32 60%,#183027);transform-origin:left center;transform:translateZ(2px);display:flex;align-items:center;justify-content:center;color:#e9dcc3;text-align:center;box-shadow:inset 6px 0 10px -4px #0006}
.al-pb-front::before{content:"";position:absolute;inset:14px;border:1px solid #e9dcc355;border-radius:2px}
.al-pb-front::after{content:"";position:absolute;inset:0;border-radius:inherit;background:linear-gradient(110deg,transparent 35%,#fff3 50%,transparent 65%);background-size:250% 100%;background-position:120% 0;opacity:0}
.al-pb-stamp{display:flex;flex-direction:column;align-items:center;gap:4px}
.al-pb-stamp .al-medal{width:64px;height:64px;margin-bottom:10px;--al-medal-ring:#e9dcc3;--al-medal-face:#e9dcc3;--al-medal-ink:#1f3c32}
.al-pb-title{font:400 clamp(40px,6vw,58px)/.95 var(--al-display);letter-spacing:-.02em}
.al-pb-rule{width:46px;height:1px;background:#e9dcc3aa;margin:10px 0}
.al-pb-sub{font-size:9px;letter-spacing:.28em;text-transform:uppercase}
.al-press-skip,.al-press-replay{position:absolute;z-index:5;right:max(16px,env(safe-area-inset-right,0px));bottom:18px;border-radius:999px;padding:9px 15px;font:600 12px/1 system-ui,sans-serif;cursor:pointer}
.al-press-skip{display:none;background:transparent;border:1px solid #f6f3ec55;color:var(--al-paper)}
.al-press-replay{background:var(--al-paper);border:1px solid var(--al-line);color:var(--al-ink)}
.al-press-replay:hover{border-color:var(--al-accent);color:var(--al-accent)}
.al-press-reveal{transition:opacity .8s ease,transform .8s cubic-bezier(.2,.8,.2,1)}
/* Repouso: página impressa. */
.al-press-dark,.al-press-sorts,.al-seal{display:none}
/* Tela escura: segurando (script do <head>) ou tocando a abertura. */
:is(.al-intro-wait .al-press,.al-press[data-playing]) :is(.al-press-dark,.al-press-sorts,.al-press-skip){display:block}
.al-press[data-playing] .al-seal{display:block}
:is(.al-intro-wait .al-press,.al-press[data-playing]) .al-press-replay{display:none}
:is(.al-intro-wait .al-press,.al-press[data-playing]) h1{color:var(--al-paper)}
:is(.al-intro-wait .al-press,.al-press[data-playing]) h1 em{color:#e9a183}
.al-intro-wait .al-press h1,.al-intro-wait .al-press-book{visibility:hidden}
:is(.al-intro-wait .al-press,.al-press[data-playing]) .al-press-reveal{opacity:0;transform:translateY(18px)}
:is(.al-intro-wait [data-aldus-landing],[data-aldus-landing][data-intro]) .al-header{background:var(--al-night);box-shadow:none;border-color:transparent}
:is(.al-intro-wait [data-aldus-landing],[data-aldus-landing][data-intro]) .al-header-inner>:not(.al-brand){opacity:0}
:is(.al-intro-wait [data-aldus-landing],[data-aldus-landing][data-intro]) .al-brand{color:var(--al-paper)}
:is(.al-intro-wait [data-aldus-landing],[data-aldus-landing][data-intro]:not([data-brand-in])) .al-brand{opacity:0}
:is(.al-intro-wait [data-aldus-landing],[data-aldus-landing][data-intro]) .al-ribbon{opacity:0}
.al-header,.al-ribbon{transition:background-color .6s ease,opacity .8s ease}
.al-header-inner>*{transition:opacity .8s ease,color .6s ease}
/* Leitura que acende e grifo que se pinta. */
.al-section-heading>p.al-read-text{grid-column:1/-1;font:400 clamp(26px,3.4vw,44px)/1.25 var(--al-display);max-width:22em;color:var(--al-ink);text-wrap:pretty}
.al-section-heading:has(>.al-read-text){align-items:start}
.al-read-word{transition:opacity .25s}
.al-read-text[data-armed] .al-read-word{opacity:.16}
.al-read-text[data-armed] .al-read-word[data-on]{opacity:1}
.al-read-mark{background:linear-gradient(#d9775755,#d9775755) no-repeat 0 85%/100% 40%;transition:background-size .9s cubic-bezier(.2,.8,.2,1)}
.al-read-text[data-armed] .al-read-mark:not([data-on]){background-size:0% 40%}
/* Fichas de recursos que se empilham. */
.al-resources[data-stack]{display:grid;grid-template-columns:minmax(0,1fr);gap:22px}
.al-resources[data-stack]>article{position:sticky;top:calc(96px + var(--al-i) * 14px);transform-origin:center top;display:grid;grid-template-columns:auto minmax(0,1fr) auto;gap:8px 28px;align-items:center;background:#2b463c;border:1px solid #f7f3e62a;border-radius:10px;padding:30px clamp(20px,4vw,44px);box-shadow:0 22px 44px -26px #000c}
.al-resources[data-stack]>article>.al-resource-icon{grid-row:span 2;width:60px;height:60px;display:grid;place-items:center;border-radius:50%;border:1px solid #f7f3e62a;font:400 26px var(--al-display);color:#e9a47e;margin:0}
.al-resources[data-stack] h3{font:400 clamp(24px,2.6vw,32px)/1.1 var(--al-display);margin:0}
.al-resources[data-stack] p{margin:0;grid-column:2}
.al-resources[data-stack] small{grid-column:3;grid-row:1/span 2;margin:0;text-align:center}
.al-ribbon{background:var(--al-ink);border:0;overflow:hidden}
.al-ribbon>.al-ribbon-track{display:flex;flex-wrap:nowrap;justify-content:flex-start;gap:56px;width:max-content;padding-block:18px;color:var(--al-paper);font:italic 400 24px/1 var(--al-display);letter-spacing:0;text-transform:none;animation:al-track 34s linear infinite}
.al-ribbon-track span::after{content:"❦";font-style:normal;margin-left:56px;color:var(--al-orange)}
@keyframes al-track{to{transform:translateX(-50%)}}
.al-final .al-medal{width:76px;height:76px;margin:0 auto 18px}
.al-footer .al-medal{width:30px;height:30px}
@media(max-width:850px){
 .al-press{min-height:auto;padding-block:44px 64px}
 .al-press-grid{grid-template-columns:minmax(0,1fr);gap:16px}
 .al-press-stage{min-height:330px}
 .al-press-book{width:min(210px,56vw)}
 .al-seal{width:132px;height:132px;margin:-66px 0 0 -66px}
}
@media(max-width:700px){
 .al-resources[data-stack]>article{grid-template-columns:auto minmax(0,1fr);padding-block:24px}
 .al-resources[data-stack]>article>.al-resource-icon{grid-row:auto;width:46px;height:46px;font-size:20px}
 .al-resources[data-stack] p,.al-resources[data-stack] small{grid-column:1/-1;grid-row:auto;text-align:left;justify-self:start}
}
@media(max-width:540px){.al-press h1{font-size:clamp(44px,12.4vw,60px)}.al-press .al-lead{font-size:16px}.al-resources[data-stack]>article{top:calc(76px + var(--al-i) * 10px)}.al-ribbon>.al-ribbon-track{font-size:19px;gap:36px;padding-block:15px}.al-ribbon-track span::after{margin-left:36px}}
@media(prefers-reduced-motion:reduce){.al-resources[data-stack]>article{position:static}}
`;
