import { useEffect, useRef } from 'react';
import { Medal } from './AldusMedal';
import { aldusProfilePath } from './aldusProfilePath';

/** Marca, na sessão do navegador, que a abertura já tocou (ela não se repete a cada visita; o botão "Ver a abertura" continua). */
export const PRESS_INTRO_SEEN_KEY = '@kindle/landing-intro.v1';

/** Script do <head> do HTML pré-renderizado: segura a tela escura até o JavaScript começar a abertura (no máximo 8 s). */
export const pressIntroHeadScript = `<script>try{if(!matchMedia('(prefers-reduced-motion: reduce)').matches&&!sessionStorage.getItem('${PRESS_INTRO_SEEN_KEY}')){var r=document.documentElement;r.classList.add('al-intro-wait');setTimeout(function(){r.classList.remove('al-intro-wait')},8000)}}catch(e){}</script>`;

const SORTS = 'ALDUSaeimnorstuvbcgplq&§¶';

function Word({ text }: { text: string }) {
  return <span className="al-w">{[...text].map((c, i) => <span key={i} className="al-ch" aria-hidden="true">{c}</span>)}</span>;
}

type Props = { cta: string; ctaText: string };

export function PressHero({ cta, ctaText }: Props) {
  const root = useRef<HTMLElement>(null);

  useEffect(() => {
    const hero = root.current;
    const landing = hero?.closest<HTMLElement>('[data-aldus-landing]');
    const scroller = hero?.closest<HTMLElement>('[data-landing-scroll], .al-page-scroll');
    if (!hero || !landing) return;
    const html = document.documentElement;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const $ = <T extends Element>(selector: string) => hero.querySelector<T>(selector)!;
    const h1 = $<HTMLElement>('h1'), book = $<HTMLElement>('.al-press-book'), seal = $<SVGSVGElement>('.al-seal');
    const letters = [...hero.querySelectorAll<HTMLElement>('h1 .al-ch')];
    const lines = [...hero.querySelectorAll<HTMLElement>('.al-press-line')];
    const reveals = [...hero.querySelectorAll<HTMLElement>('.al-press-reveal')];
    const anims: Animation[] = [], timers: number[] = [];
    const rnd = (a: number, b: number) => a + Math.random() * (b - a);
    const at = (ms: number, fn: () => void) => { timers.push(window.setTimeout(fn, ms)); };
    let started = false, disposed = false;

    const settle = () => {
      hero.removeAttribute('data-playing');
      landing.removeAttribute('data-intro'); landing.removeAttribute('data-brand-in');
      html.classList.remove('al-intro-wait');
      h1.style.visibility = ''; book.style.visibility = '';
      lines.forEach(line => { line.style.color = ''; const em = line.querySelector('em'); if (em) em.style.color = ''; });
      reveals.forEach(node => { node.style.transitionDelay = ''; });
    };
    const finish = () => {
      started = true;
      timers.forEach(clearTimeout); timers.length = 0;
      anims.forEach(a => { try { a.finish(); } catch { /* já encerrada */ } });
      settle();
    };

    const intro = () => {
      if (disposed) return;
      started = true;
      anims.forEach(a => { try { a.cancel(); } catch { /* já encerrada */ } }); anims.length = 0;
      timers.forEach(clearTimeout); timers.length = 0;
      try { window.sessionStorage.setItem(PRESS_INTRO_SEEN_KEY, '1'); } catch { /* armazenamento indisponível */ }
      scroller?.scrollTo({ top: 0, behavior: 'auto' });
      hero.setAttribute('data-playing', ''); landing.setAttribute('data-intro', '');
      html.classList.remove('al-intro-wait');
      h1.style.visibility = ''; book.style.visibility = '';
      reveals.forEach((node, i) => { node.style.transitionDelay = `${i * 110}ms`; });

      // Tipos soltos na caixa escura.
      const sorts = $<HTMLElement>('.al-press-sorts');
      sorts.textContent = '';
      const loose: HTMLElement[] = [];
      for (let i = 0; i < 28; i++) {
        const s = document.createElement('span'); s.className = 'al-sort';
        s.textContent = SORTS[Math.floor(Math.random() * SORTS.length)];
        const rotate = `rotate(${rnd(-40, 40)}deg)`;
        Object.assign(s.style, { left: `${rnd(0, 100)}%`, top: `${rnd(0, 100)}%`, fontSize: `${rnd(16, 64)}px`, transform: rotate });
        sorts.append(s); loose.push(s);
        anims.push(s.animate([{ transform: rotate, opacity: 0 }, { transform: `${rotate} translateY(${rnd(-30, 30)}px)`, opacity: rnd(.05, .16) }], { duration: 1600, easing: 'ease-out', fill: 'forwards' }));
      }

      // 0. A medalha é cunhada no centro e voa para o cabeçalho.
      const S = 1400;
      const face = seal.querySelector('.al-seal-face')!, ring = seal.querySelector('.al-seal-ring')!, profile = seal.querySelector('.al-seal-profile')!;
      anims.push(face.animate([{ transform: 'scale(.2)', opacity: 0 }, { transform: 'scale(1)', opacity: 1 }], { duration: 650, delay: 100, easing: 'cubic-bezier(.16,1,.3,1)', fill: 'backwards' }));
      anims.push(ring.animate([{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], { duration: 900, delay: 150, easing: 'cubic-bezier(.65,0,.35,1)', fill: 'both' }));
      anims.push(profile.animate([{ transform: 'translate3d(0,700px,0)' }, { transform: 'translate3d(0,0,0)' }], { duration: 800, delay: 450, easing: 'cubic-bezier(.16,1,.3,1)', fill: 'backwards' }));
      anims.push(seal.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.1)', offset: .4 }, { transform: 'scale(.97)', offset: .75 }, { transform: 'scale(1)' }], { duration: 320, delay: 1150, easing: 'ease-out' }));
      at(S, () => {
        const target = landing.querySelector('.al-header .al-medal')?.getBoundingClientRect(), from = seal.getBoundingClientRect();
        if (!target || !target.width) { anims.push(seal.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 300, fill: 'forwards' })); landing.setAttribute('data-brand-in', ''); return; }
        const dx = target.left + target.width / 2 - (from.left + from.width / 2), dy = target.top + target.height / 2 - (from.top + from.height / 2);
        anims.push(seal.animate([{ transform: 'translate3d(0,0,0) scale(1)' }, { transform: `translate3d(${dx}px,${dy}px,0) scale(${target.width / from.width})` }], { duration: 850, easing: 'cubic-bezier(.65,0,.25,1)', fill: 'forwards' }));
        at(830, () => { landing.setAttribute('data-brand-in', ''); anims.push(seal.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 150, fill: 'forwards' })); });
      });

      // 1. Composição: só transform e opacity (vão para a GPU), sem desfoque por letra.
      letters.forEach((el, i) => {
        const x = rnd(-45, 45), y = rnd(-38, 38), r = rnd(-90, 90), s = rnd(.6, 1.5);
        anims.push(el.animate([
          { transform: `translate3d(${x}vw,${y}vh,0) rotate(${r}deg) scale(${s})`, opacity: 0 },
          { opacity: 1, offset: .3 },
          { transform: `translate3d(0,-6px,0) rotate(${-r * .03}deg) scale(1.02)`, opacity: 1, offset: .82, easing: 'ease-in-out' },
          { transform: 'translate3d(0,0,0) rotate(0deg) scale(1)', opacity: 1 },
        ], { duration: 1300, delay: S + 150 + i * 34, easing: 'cubic-bezier(.16,1,.3,1)', fill: 'backwards' }));
      });

      // 2. Prensa: a folha desce e imprime a página.
      const T = S + 150 + letters.length * 34 + 1300;
      at(T, () => {
        anims.push($<HTMLElement>('.al-press-plate').animate([{ clipPath: 'inset(0 0 100% 0)' }, { clipPath: 'inset(0 0 0% 0)' }], { duration: 900, easing: 'cubic-bezier(.7,0,.2,1)', fill: 'forwards' }));
        anims.push($<HTMLElement>('.al-press-edge').animate([{ transform: 'translateY(0)', opacity: 1 }, { opacity: 1, offset: .85 }, { transform: `translateY(${hero.offsetHeight}px)`, opacity: 0 }], { duration: 900, easing: 'cubic-bezier(.7,0,.2,1)' }));
        loose.forEach(s => anims.push(s.animate([{ opacity: getComputedStyle(s).opacity }, { opacity: 0 }], { duration: 500, delay: rnd(0, 500), fill: 'forwards' })));
        lines.forEach((line, i) => at(380 + i * 220, () => {
          line.style.color = 'var(--al-ink)';
          const em = line.querySelector('em'); if (em) em.style.color = 'var(--al-accent)';
          anims.push(line.animate([{ transform: 'translateY(0)' }, { transform: 'translateY(3px)' }, { transform: 'translateY(0)' }], { duration: 260, easing: 'ease-out' }));
        }));
        at(1000, () => { hero.removeAttribute('data-playing'); });
      });

      // 3. O livro se monta: capa de trás, folhas, capa da frente fecha, medalha e título carimbados, brilho.
      const B = T + 500;
      anims.push($<HTMLElement>('.al-pb-back').animate([{ transform: 'translateZ(-22px) translateY(60px)', opacity: 0 }, { transform: 'translateZ(-22px)', opacity: 1 }], { duration: 700, delay: B, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'backwards' }));
      hero.querySelectorAll<HTMLElement>('.al-pb-page').forEach((page, i) => anims.push(page.animate([
        { transform: `translateZ(${-18 + i * 4}px) translateX(${80 + i * 30}px) rotate(${8 - i * 3}deg)`, opacity: 0 },
        { transform: `translateZ(${-18 + i * 4}px)`, opacity: 1 },
      ], { duration: 600, delay: B + 250 + i * 90, easing: 'cubic-bezier(.2,.8,.2,1.1)', fill: 'both' })));
      const front = $<HTMLElement>('.al-pb-front');
      anims.push(front.animate([{ transform: 'translateZ(2px) rotateY(-165deg)', opacity: 0 }, { opacity: 1, offset: .2 }, { transform: 'translateZ(2px) rotateY(0deg)', opacity: 1 }], { duration: 1100, delay: B + 750, easing: 'cubic-bezier(.3,.7,.2,1)', fill: 'backwards' }));
      anims.push($<HTMLElement>('.al-pb-stamp').animate([{ transform: 'scale(1.5)', opacity: 0 }, { transform: 'scale(.97)', opacity: 1, offset: .75 }, { transform: 'scale(1)', opacity: 1 }], { duration: 650, delay: B + 1750, easing: 'ease-out', fill: 'backwards' }));
      anims.push(front.animate([{ opacity: 1, backgroundPosition: '120% 0' }, { opacity: 1, backgroundPosition: '-60% 0' }], { duration: 1100, delay: B + 2250, easing: 'ease-in-out', pseudoElement: '::after' }));

      at(T + 1200, () => { landing.removeAttribute('data-intro'); landing.removeAttribute('data-brand-in'); });
      at(B + 2600, finish);
    };

    const skip = $<HTMLButtonElement>('.al-press-skip'), replay = $<HTMLButtonElement>('.al-press-replay');
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape' && hero.hasAttribute('data-playing')) finish(); };
    skip.addEventListener('click', finish); replay.addEventListener('click', intro);
    window.addEventListener('keydown', onKey);

    // O livro acompanha o ponteiro (só com mouse, sem movimento reduzido).
    const tilt = (event: PointerEvent) => {
      const x = event.clientX / window.innerWidth - .5, y = event.clientY / window.innerHeight - .5;
      book.style.transform = `rotateY(${-18 + x * 16}deg) rotateX(${6 - y * 10}deg)`;
    };
    const fine = !reduce && window.matchMedia('(pointer: fine)').matches;
    if (fine) window.addEventListener('pointermove', tilt);

    // Só toca sozinha na primeira carga da página pré-renderizada (o <head> já deixou a tela escura); em navegação interna, não.
    if (!reduce && html.classList.contains('al-intro-wait')) {
      const go = () => { if (!started) requestAnimationFrame(() => requestAnimationFrame(intro)); };
      const fonts = document.fonts;
      if (fonts?.load) fonts.load('400 1em "Aldus Garamond"').then(go, go); else go();
      at(1500, go);
    } else settle();

    return () => {
      disposed = true;
      timers.forEach(clearTimeout);
      anims.forEach(a => { try { a.cancel(); } catch { /* já encerrada */ } });
      skip.removeEventListener('click', finish); replay.removeEventListener('click', intro);
      window.removeEventListener('keydown', onKey);
      if (fine) window.removeEventListener('pointermove', tilt);
      settle();
    };
  }, []);

  return <section ref={root} className="al-press" data-press-hero aria-labelledby="al-press-title">
    <div className="al-press-dark" aria-hidden="true" />
    <div className="al-press-plate" aria-hidden="true" />
    <div className="al-press-edge" aria-hidden="true" />
    <div className="al-press-sorts" aria-hidden="true" />
    <svg className="al-seal" viewBox="90 332 760 760" aria-hidden="true" focusable="false">
      <circle className="al-seal-ring" cx="470" cy="712" r="366" fill="none" stroke="#d97757" strokeWidth="12" pathLength={1} />
      <circle className="al-seal-face" cx="470" cy="712" r="360" fill="#EFE6D6" />
      <g clipPath="url(#al-medal-clip)"><g className="al-seal-profile"><path d={aldusProfilePath} fillRule="evenodd" fill="#1B1C30" /></g></g>
    </svg>
    <div className="al-container al-press-grid">
      <div className="al-press-copy">
        <div className="al-eyebrow al-press-reveal"><span /> SUA LEITURA. SEU TEMPO.</div>
        <h1 id="al-press-title" aria-label="Muito mais que uma biblioteca.">
          <span className="al-press-line"><Word text="Muito" /> <Word text="mais" /> <Word text="que" /></span><br />
          <span className="al-press-line"><Word text="uma" /> <em><Word text="biblioteca." /></em></span>
        </h1>
        <p className="al-lead al-press-reveal">Leia, organize e estude. Um lugar para os seus livros — e para tudo o que eles despertam em você.</p>
        <div className="al-hero-actions al-press-reveal"><a href={cta} className="al-button">{ctaText} <span aria-hidden="true">↗</span></a><a className="al-text-link" href="#experiencia">Conhecer o Aldus <span aria-hidden="true">↓</span></a></div>
        <p className="al-hero-note al-press-reveal">Comece pela leitura local, gratuitamente.<br />EPUB e PDF, com o seu jeito de ler.</p>
      </div>
      <div className="al-press-stage" aria-hidden="true">
        <div className="al-press-book">
          <div className="al-pb-back" />
          {[0, 1, 2, 3, 4].map(i => <div key={i} className="al-pb-page" />)}
          <div className="al-pb-front"><div className="al-pb-stamp"><Medal /><span className="al-pb-title">Aldus</span><span className="al-pb-title">Reader</span><span className="al-pb-rule" /><span className="al-pb-sub">Sua leitura</span></div></div>
        </div>
      </div>
    </div>
    <button type="button" className="al-press-skip">Pular abertura</button>
    <button type="button" className="al-press-replay"><span aria-hidden="true">▶ </span>Ver a abertura</button>
  </section>;
}
