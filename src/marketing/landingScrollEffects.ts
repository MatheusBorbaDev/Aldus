import { type RefObject, useEffect } from 'react';

/**
 * Efeitos de rolagem da landing (23/11/2026): o parágrafo da experiência acende palavra por palavra e o grifo se pinta ao chegar em
 * "o que marca"; as fichas de recursos se empilham e recuam sob a seguinte. Segue o scroller da página (não a janela), só lê a
 * posição num quadro por evento e não prende a rolagem. Sem JavaScript ou com movimento reduzido, tudo fica visível e parado.
 */
export function useLandingScrollEffects(root: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const page = root.current;
    const scroller = page?.closest<HTMLElement>('[data-landing-scroll], .al-page-scroll');
    if (!page || !scroller || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const text = page.querySelector<HTMLElement>('[data-read-text]'), mark = page.querySelector<HTMLElement>('[data-read-mark]');
    const cards = [...page.querySelectorAll<HTMLElement>('[data-stack] > article')];
    const words: HTMLElement[] = [];
    if (text && !text.querySelector('.al-read-word')) {
      const wrap = (node: Node) => [...node.childNodes].forEach(child => {
        if (child.nodeType !== Node.TEXT_NODE) { wrap(child); return; }
        const fragment = document.createDocumentFragment();
        for (const part of (child.textContent ?? '').split(/(\s+)/)) {
          if (!part) continue;
          if (/^\s+$/.test(part)) { fragment.append(part); continue; }
          const word = document.createElement('span'); word.className = 'al-read-word'; word.textContent = part; fragment.append(word);
        }
        child.replaceWith(fragment);
      });
      wrap(text);
    }
    if (text) words.push(...text.querySelectorAll<HTMLElement>('.al-read-word'));
    const markWords = mark ? [...mark.querySelectorAll<HTMLElement>('.al-read-word')] : [];
    text?.setAttribute('data-armed', '');

    let frame = 0;
    const update = () => {
      frame = 0;
      const viewport = scroller.clientHeight;
      if (text) {
        const box = text.getBoundingClientRect(), top = box.top - scroller.getBoundingClientRect().top;
        const progress = Math.min(1, Math.max(0, (viewport * .85 - top) / (box.height + viewport * .35)));
        const lit = Math.round(progress * words.length);
        words.forEach((word, i) => word.toggleAttribute('data-on', i < lit));
        mark?.toggleAttribute('data-on', markWords.length > 0 && markWords.every(word => word.hasAttribute('data-on')));
      }
      cards.forEach((card, i) => {
        const next = cards[i + 1];
        if (!next) return;
        const gap = next.getBoundingClientRect().top - card.getBoundingClientRect().top;
        const cover = Math.min(1, Math.max(0, 1 - gap / (card.offsetHeight + 22)));
        card.style.transform = cover ? `scale(${1 - cover * .05}) rotate(${(i % 2 ? 1 : -1) * cover * .8}deg)` : '';
        card.style.filter = cover ? `brightness(${1 - cover * .12})` : '';
      });
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(update); };
    scroller.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    update();
    return () => {
      if (frame) cancelAnimationFrame(frame);
      scroller.removeEventListener('scroll', schedule); window.removeEventListener('resize', schedule);
      text?.removeAttribute('data-armed');
      cards.forEach(card => { card.style.transform = ''; card.style.filter = ''; });
    };
  }, [root]);
}
