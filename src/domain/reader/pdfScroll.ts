/**
 * Rolagem contínua do PDF Original (Fase E, fatia 1; pedido do dono em 16/11/2026). As páginas ficam uma embaixo da outra na
 * largura da tela; só as próximas da área visível são desenhadas (as distantes são liberadas para poupar memória). A página
 * atual é informada quando a rolagem para; um toque sem arrastar mostra/esconde os controles. A posição salva continua sendo a
 * página (a do topo da tela), no mesmo progresso de sempre; reabrir volta ao topo dessa página.
 */
export type PdfFlow = "paged" | "scroll";

export const PDF_FLOWS: ReadonlyArray<{ value: PdfFlow; label: string }> = [
  { value: "paged", label: "Página a página" },
  { value: "scroll", label: "Rolagem contínua" },
];

export function isPdfFlow(value: unknown): value is PdfFlow {
  return value === "paged" || value === "scroll";
}

/**
 * Controlador em fonte JavaScript literal (o `toString()` do Hermes não é fonte): roda na WebView do Android e no site.
 * `createPdfScroller({ container, pdf, page, zoom, rotation, onPage, onTap, onError })` → `{ goTo, current, destroy }`.
 */
export const PDF_SCROLL_SOURCE = `
function createPdfScroller(o) {
  var c = o.container, pdf = o.pdf, n = pdf.numPages, zoom = o.zoom || 1, rotation = o.rotation || 0, destroyed = false;
  var dpr = Math.min(window.devicePixelRatio || 1, 2.5), slots = [], rendered = {}, tasks = {}, current = Math.max(1, Math.min(n, o.page || 1));
  var suppressUntil = 0, settleTimer = 0, lastReport = '', observer = null, down = null;
  var list = document.createElement('div');
  list.setAttribute('data-pdf-scroll', 'list');
  list.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:12px;padding:12px 0;width:100%';
  c.style.overflowY = 'auto'; c.style.overflowX = 'hidden'; c.style.touchAction = 'pan-y'; c.style.webkitOverflowScrolling = 'touch';
  c.appendChild(list);
  function width() { return Math.max(200, (c.clientWidth || 360) - 16) * zoom; }
  function release(i) {
    if (tasks[i]) { try { tasks[i].cancel(); } catch (e) {} delete tasks[i]; }
    var canvas = slots[i - 1] && slots[i - 1].firstChild; if (canvas && rendered[i]) { canvas.width = 0; canvas.height = 0; }
    delete rendered[i];
  }
  function render(i) {
    if (destroyed || rendered[i] || tasks[i]) return;
    var slot = slots[i - 1];
    pdf.getPage(i).then(function (page) {
      if (destroyed) return;
      var base = page.getViewport({ scale: 1, rotation: (page.rotate + rotation) % 360 }), w = width();
      var viewport = page.getViewport({ scale: (w / base.width) * dpr, rotation: (page.rotate + rotation) % 360 });
      slot.style.height = Math.round(viewport.height / dpr) + 'px';
      var canvas = slot.firstChild; canvas.width = Math.ceil(viewport.width); canvas.height = Math.ceil(viewport.height);
      var task = page.render({ canvasContext: canvas.getContext('2d'), viewport: viewport }); tasks[i] = task;
      return task.promise.then(function () { delete tasks[i]; rendered[i] = true; }, function (error) { delete tasks[i]; if (error && error.name !== 'RenderingCancelledException' && o.onError) o.onError(error.message || String(error)); });
    }).catch(function (error) { if (o.onError) o.onError(error.message || String(error)); });
  }
  function visiblePage() {
    var top = c.scrollTop + c.clientHeight / 3;
    for (var i = 0; i < slots.length; i++) { var s = slots[i]; if (s.offsetTop + s.offsetHeight >= top) return { page: i + 1, offset: Math.max(0, Math.min(1, (c.scrollTop - s.offsetTop) / Math.max(1, s.offsetHeight))) }; }
    return { page: n, offset: 0 };
  }
  function keepNear() { for (var key in rendered) { var i = Number(key); if (Math.abs(i - current) > 3) release(i); } }
  function report() {
    if (destroyed) return; var at = visiblePage(); current = at.page; keepNear();
    var key = at.page + ':' + Math.round(at.offset * 100); if (key === lastReport) return; lastReport = key;
    if (o.onPage) o.onPage(at.page, at.offset);
  }
  function onScroll() { if (Date.now() < suppressUntil) return; clearTimeout(settleTimer); settleTimer = setTimeout(report, 220); }
  function onDown(e) { down = { x: e.clientX, y: e.clientY, top: c.scrollTop }; }
  function onUp(e) { if (!down) return; var moved = Math.abs(e.clientX - down.x) + Math.abs(e.clientY - down.y) + Math.abs(c.scrollTop - down.top); down = null; if (moved < 10 && o.onTap) o.onTap(); }
  function goTo(page) {
    page = Math.max(1, Math.min(n, Math.round(page))); var slot = slots[page - 1]; if (!slot) return;
    current = page; suppressUntil = Date.now() + 450; lastReport = page + ':0';
    c.scrollTop = Math.max(0, slot.offsetTop - 12); render(page); if (page < n) render(page + 1);
  }
  return pdf.getPage(1).then(function (first) {
    var base = first.getViewport({ scale: 1, rotation: (first.rotate + rotation) % 360 }), ratio = base.height / base.width, w = width();
    for (var i = 1; i <= n; i++) {
      var slot = document.createElement('div'); slot.setAttribute('data-pdf-page', String(i));
      slot.style.cssText = 'position:relative;flex:none;background:#fff;box-shadow:0 2px 10px rgba(0,0,0,.18);width:' + Math.round(w) + 'px;height:' + Math.round(w * ratio) + 'px';
      var canvas = document.createElement('canvas'); canvas.style.cssText = 'display:block;width:100%;height:100%';
      slot.appendChild(canvas); list.appendChild(slot); slots.push(slot);
    }
    if (window.IntersectionObserver) {
      observer = new IntersectionObserver(function (entries) { entries.forEach(function (entry) { if (entry.isIntersecting) render(Number(entry.target.getAttribute('data-pdf-page'))); }); }, { root: c, rootMargin: '100% 0px' });
      slots.forEach(function (slot) { observer.observe(slot); });
    }
    c.addEventListener('scroll', onScroll, { passive: true }); c.addEventListener('pointerdown', onDown); c.addEventListener('pointerup', onUp);
    goTo(current);
    return {
      goTo: goTo,
      current: function () { return current; },
      destroy: function () {
        destroyed = true; clearTimeout(settleTimer); if (observer) observer.disconnect();
        for (var key in tasks) { try { tasks[key].cancel(); } catch (e) {} }
        c.removeEventListener('scroll', onScroll); c.removeEventListener('pointerdown', onDown); c.removeEventListener('pointerup', onUp);
        if (list.parentNode) list.parentNode.removeChild(list); c.style.overflowY = ''; c.style.touchAction = '';
      }
    };
  });
}
`;
