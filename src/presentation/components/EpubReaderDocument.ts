import { StoredChapter } from "@/src/domain/entities/LibraryBook";
import { sanitizeBookHtml } from "@/src/domain/reader/sanitizeBookHtml";
import { readerAnchorDocumentScript } from "@/src/presentation/components/ReaderAnchorDocument";

export interface ReaderDocumentOptions {
  initialRestorePending?: boolean;
  fontSize: number;
  fontFamily: string;
  marginSize: number;
  lineHeight?: number;
  paragraphSpacing?: number;
  maxWidth?: number;
  alignment?: "left" | "justify";
  allowTextSelection?: boolean;
  textColor: string;
  backgroundColor: string;
  /** Nonce da CSP do documento. Só para testes; por padrão é sorteado a cada documento. */
  scriptNonce?: string;
}

/**
 * BUG 17: idioma declarado no próprio capítulo (`<html lang>`/`xml:lang`, ou no `<body>`), validado como etiqueta BCP 47 simples.
 * O navegador só hifeniza com idioma declarado. Sem declaração não há idioma: nada é presumido (um livro em inglês não pode ser
 * hifenizado com regras do português).
 */
export function chapterLanguage(html: string): string | null {
  const tag = html.match(/<(?:html|body)\b[^>]*>/gi) ?? [];
  for (const open of tag) {
    const value = open.match(/\s(?:xml:)?lang\s*=\s*["']([^"']+)["']/i)?.[1]?.trim();
    if (value && /^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/.test(value)) return value;
  }
  return null;
}

export function createEpubReaderDocument(chapters: StoredChapter[], options: ReaderDocumentOptions): string {
  const languages = chapters.map(chapter => chapterLanguage(chapter.html));
  const documentLanguage = languages.find(Boolean) ?? null;
  const sections = chapters.map((chapter, index) => {
    const rawBody = chapter.html.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i)?.[1] ?? chapter.html.replace(/<\/?(?:html|head|body|\?xml)[^>]*>/gi, "");
    // CSS do capítulo é texto de <style>: um "<" ali poderia fechar o bloco e abrir marcação; vira escape de CSS.
    const chapterStyles = [...chapter.html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)].map((match) => `<style>${match[1].replace(/</g, "\\3c ")}</style>`).join("");
    // Conteúdo do livro é entrada não confiável: sanitizeBookHtml reconstrói as tags (ver o módulo). A falha de imagem
    // é marcada por um ouvinte no script do Reader; a CSP com nonce não permite manipuladores embutidos.
    const safeBody = sanitizeBookHtml(rawBody)
      .replace(/<img\b([^>]*?)\s*\/?>/gi, (_match, attrs) => {
        const inlinePdfImage = /\bdata-pdf-reflow-image(?:\s|=|$)/i.test(attrs);
        const loading = inlinePdfImage ? "eager" : "lazy";
        return `<img${attrs.replace(/\sloading="[^"]*"/i, "")} loading="${loading}" />`;
      });
    const lang = languages[index];
    return `<section id="epub-chapter-${index}" class="epub-chapter"${lang ? ` lang="${escapeAttribute(lang)}"` : ""} data-chapter-id="${escapeAttribute(chapter.id)}" data-chapter-index="${index}" data-chapter-title="${escapeAttribute(chapter.title)}">${chapterStyles}${safeBody}</section>`;
  }).join("\n");

  const pagePadding = Math.max(16, Math.min(48, Math.round(options.marginSize)));
  const safeFont = readerCssFontFamily(options.fontFamily);
  const nonce = /^[A-Za-z0-9]{16,64}$/.test(options.scriptNonce ?? "") ? options.scriptNonce! : createScriptNonce();
  const fontSpacing = readerFontSpacingCss(options.fontFamily);
  const safeTextColor = /^#[\da-f]{3,8}$/i.test(options.textColor) ? options.textColor : "#2b2b2b";
  const safeBackgroundColor = /^#[\da-f]{3,8}$/i.test(options.backgroundColor) ? options.backgroundColor : "#f5ebd9";
  const lineHeight = Math.max(1.1, Math.min(2.4, options.lineHeight ?? 1.65));
  const paragraphSpacing = Math.max(0, Math.min(2, options.paragraphSpacing ?? 1));
  const maxWidth = Math.max(320, Math.min(1200, options.maxWidth ?? 900));
  const alignment = options.alignment === "justify" ? "justify" : "left";
  const textSelection = options.allowTextSelection ? "text" : "none";

  return `<!doctype html>
<html${documentLanguage ? ` lang="${escapeAttribute(documentLanguage)}"` : ""}>
<head>
<meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data: blob:; font-src data:; style-src 'unsafe-inline'; script-src 'nonce-${nonce}'; connect-src 'none'; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover">
<style id="base-reader-styles">
  *, *::before, *::after {
    box-sizing: border-box !important;
  }
  html, body {
    width: 100% !important;
    height: 100% !important;
    min-width: 100% !important;
    min-height: 100% !important;
    margin: 0 !important;
    padding: 0 !important;
    overflow: hidden !important;
    -webkit-text-size-adjust: 100%;
    text-size-adjust: 100%;
    user-select: ${textSelection};
    -webkit-user-select: ${textSelection};
    background-color: ${safeBackgroundColor} !important;
    color: ${safeTextColor} !important;
    touch-action: pan-y;
  }
  #reader-viewport {
    position: absolute !important;
    top: 0 !important;
    left: 0 !important;
    width: 100% !important;
    height: 100% !important;
    min-width: 100% !important;
    min-height: 100% !important;
    overflow: hidden !important;
    box-sizing: border-box !important;
  }
  #reader-content {
    width: 100% !important;
    height: 100% !important;
    min-width: 100% !important;
    min-height: 100% !important;
    box-sizing: border-box !important;
    column-width: 100vw !important;
    column-gap: 0px !important;
    column-fill: auto !important;
    overflow: visible !important;
    transition: none;
    transform: translateX(0);
  }
  #reader-content.is-transitioning {
    transition: transform 0.24s cubic-bezier(0.25, 1, 0.5, 1);
  }
  #reader-content.is-transitioning.turn-instant {
    transition: none;
  }
  /* Rolagem contínua (Fase E, 16/11/2026): o livro vira uma coluna vertical; as "páginas" passam a ser telas virtuais. */
  html.reader-scroll #reader-viewport {
    overflow-y: auto !important;
    overflow-x: hidden !important;
    touch-action: pan-y !important;
  }
  html.reader-scroll #reader-content {
    column-width: auto !important;
    columns: auto !important;
    height: auto !important;
    min-height: 100% !important;
    transform: none !important;
    transition: none !important;
  }
  .epub-chapter {
    width: 100% !important;
    max-width: 100% !important;
    display: block !important;
    box-sizing: border-box !important;
    padding: 24px ${pagePadding}px 32px ${pagePadding}px !important;
    break-inside: auto !important;
    color: inherit !important;
    background: transparent !important;
    background-color: transparent !important;
  }
  .epub-chapter > * {
    max-width: min(100%, ${maxWidth}px) !important;
    margin-left: auto !important;
    margin-right: auto !important;
    text-align: ${alignment} !important;
  }
  .reader-toc {
    width: 100%;
    margin: 0 auto 1.5em auto;
    padding: 0;
  }
  .reader-toc ol {
    padding-left: 1.4em;
  }
  .reader-toc li {
    margin: 0 0 0.55em 0;
    break-inside: avoid;
  }
  figure {
    width: 100%;
    margin: 1em auto;
    padding: 0;
    text-align: center;
    break-inside: avoid;
  }
  figure.pdf-reflow-drop-cap {
    float: left;
    width: 3.3em !important;
    max-width: 24% !important;
    margin: 0.12em 0.55em 0.12em 0 !important;
    text-align: left;
    break-inside: auto;
  }
  figure.pdf-reflow-drop-cap img {
    display: block;
    width: 100% !important;
    max-width: 100% !important;
    max-height: 10em !important;
    height: auto !important;
    margin: 0 !important;
    object-fit: contain !important;
  }
  .epub-chapter *,
  .epub-chapter p,
  .epub-chapter div,
  .epub-chapter span,
  .epub-chapter li,
  .epub-chapter a,
  .epub-chapter h1,
  .epub-chapter h2,
  .epub-chapter h3,
  .epub-chapter h4,
  .epub-chapter h5,
  .epub-chapter h6 {
    color: inherit !important;
    background: transparent !important;
    background-color: transparent !important;
    box-sizing: border-box !important;
  }
  p, div, span, li, blockquote {
    word-break: break-word !important;
    overflow-wrap: break-word !important;
    hyphens: auto;
  }
  img, svg, picture {
    max-width: 100% !important;
      max-height: min(80vh, calc(var(--reader-page-height, 100vh) * 0.88)) !important;
      width: auto;
      height: auto;
    object-fit: contain !important;
    display: block;
    margin: 12px auto;
    break-inside: avoid;
    page-break-inside: avoid;
  }
  table, pre {
    max-width: 100% !important;
    overflow-x: auto;
    break-inside: avoid;
  }
  h1, h2, h3, h4, h5, h6 {
      column-width: 100% !important;
    page-break-after: avoid;
    line-height: 1.3;
  }
  p {
    margin: 0 0 ${paragraphSpacing}em 0;
    orphans: 2;
    widows: 2;
  }
  a {
    color: inherit;
    text-decoration: underline;
    opacity: 0.85;
  }
</style>
<style id="dynamic-typography">
  *, body, p, div, span, li, blockquote, h1, h2, h3, h4, h5, h6 {
    font-family: ${safeFont} !important;
    color: ${safeTextColor} !important;
  }
  p, div, span, li, blockquote {
    font-size: ${options.fontSize}px !important;
    line-height: ${Math.round(options.fontSize * lineHeight)}px !important;
    ${fontSpacing}
  }
  body, html, #reader-viewport {
    background-color: ${safeBackgroundColor} !important;
  }
</style>
</head>
<body>
<div id="reader-viewport">
  <div id="reader-content">${sections}</div>
</div>
<script nonce="${nonce}">
(function() {
  // Hermes Function.toString() supplies a bytecode placeholder, not source.
  // Keep this WebView boundary literal; parity is checked against the host helper.
  function readerCssFontFamily(font) {
    if (font === "System") return "system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif";
    if (font === "Verdana") return "Verdana, sans-serif";
    var family = font.replace(/[<>";]/g, "");
    return family.includes("serif") ? family : (family || "Georgia") + ", serif";
  }
  function readerFontSpacingCss(font) {
    return font === "Verdana" ? "letter-spacing: 0.05em !important; word-spacing: 0.16em !important;" : "";
  }
  // Keep the high-volume forensic trace opt-in.
  var console = {
    log: function() {
      try {
        if (window.localStorage.getItem("epubCenterResetDiagnostics") === "1") {
          window.console.log.apply(window.console, arguments);
        }
      } catch {}
    }
  };
  var content = document.getElementById("reader-content");
  var viewport = document.getElementById("reader-viewport");
  var currentPage = 1;
  var totalPages = 1;
  var currentChapterIndex = 0;
  var currentChapterTitle = "";
  var lastReportedKey = "";
  var isAnimating = false;
  var transitionDirection = 0;
  var targetPage = 1;
  var deferredPage = null;
  var recalculateAfterTransition = false;
  var layoutFrame = 0;
  var initialLayoutReady = false;
  var initialLayoutReadinessScheduled = false;
  var restorationPending = ${options.initialRestorePending ? "true" : "false"};
  var typographyPending = false, typographyAnchor = null, typographyGeneration = 0, pendingTypographyOptions = null;
  // Page boundaries change with typography. Keep the reading intent across a
  // settings session instead of repeatedly capturing an earlier page start.
  var typographyLogicalAnchor = null;
  var anchorRestoreStatus = null, restorePositionGeneration = 0;
  var activeOperationId = 0, activeOrigin = 'RESTORE';
  var flowMode = "paged", scrollTargetTop = null, scrollSuppressUntil = 0, scrollSettleTimer = 0;
  var navigationDiagnostics = ${process.env.EXPO_PUBLIC_READER_NAVIGATION_DIAGNOSTICS === "1" ? "true" : "false"};
  function navigationDiagnostic(origin, requestedPage) {
    if (!navigationDiagnostics) return;
    var record = { type: 'navigationDiagnostic', origin: origin, operationId: activeOperationId,
      requestedPage: requestedPage, confirmedPage: currentPage, currentPage: currentPage,
      targetPage: targetPage, totalPages: totalPages, viewerElapsedMs: performance.now() };
    if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify(record));
    if (window.parent && window.parent !== window) window.parent.postMessage(record, '*');
  }
  console.log('[FORENSIC:iframe:init] t=' + (performance.timeOrigin + performance.now()) + ' initial currentPage=' + currentPage + ' targetPage=' + targetPage + ' totalPages=' + totalPages + ' width=' + getPageWidth() + ' height=' + getPageHeight());

  function getPageWidth() {
    return viewport && viewport.getBoundingClientRect().width || document.documentElement.getBoundingClientRect().width || window.innerWidth || 360;
  }

  ${readerAnchorDocumentScript()}

  function getPageHeight() {
    return viewport && viewport.clientHeight || document.documentElement.clientHeight || window.innerHeight || 640;
  }

  function isScrollFlow() { return flowMode === "scroll"; }
  function scrollPageFor(top) { return Math.floor((top + 1) / Math.max(1, getPageHeight())) + 1; }
  // Página de um retângulo do texto: coluna no modo página, tela virtual no modo rolagem.
  function pageForRect(rect) {
    if (isScrollFlow()) return Math.floor((rect.top + viewport.scrollTop) / Math.max(1, getPageHeight())) + 1;
    var w = getPageWidth(); return Math.floor((rect.left + (currentPage - 1) * w) / w) + 1;
  }
  // Na rolagem, o trecho da âncora vai para o topo da tela (sem deriva ao alternar os modos).
  function topForRect(rect) { return Math.max(0, rect.top + viewport.scrollTop - 8); }
  function postReader(message) {
    var text = JSON.stringify(message);
    if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) window.ReactNativeWebView.postMessage(text);
    if (window.parent && window.parent !== window) window.parent.postMessage(text, "*");
  }

  function syncPageDimensions() {
    if (!content || !viewport) return;
    content.style.setProperty("--reader-page-height", getPageHeight() + "px");
  }

  // BUG 20: a seção é um contêiner com margem inferior; quando o texto termina perto do fim de uma coluna, essa margem sozinha cria
  // mais um fragmento da seção e uma página final sem nada para ler. A última página passa a ser a do último conteúdo real (texto
  // não vazio ou mídia), medido pelos retângulos desse conteúdo. Sem conteúdo encontrado, vale a regra anterior (fragmentos).
  var READER_MEDIA = { IMG: 1, SVG: 1, VIDEO: 1, CANVAS: 1, HR: 1, IFRAME: 1, OBJECT: 1, TABLE: 1, svg: 1 };
  function lastContentPage(left, width) {
    var sections = content.children;
    for (var s = sections.length - 1; s >= 0; s--) {
      var walker = document.createTreeWalker(sections[s], NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, null);
      var last = null, node;
      while ((node = walker.nextNode())) {
        // Sem regex aqui: este script mora numa template string e "\S" viraria "S" (texto com a letra S maiúscula).
        if (node.nodeType === 3 ? (node.nodeValue || "").trim().length > 0 : READER_MEDIA[node.nodeName] === 1) last = node;
      }
      if (!last) continue;
      var rects;
      if (last.nodeType === 3) { var range = document.createRange(); range.selectNodeContents(last); rects = range.getClientRects(); }
      else rects = last.getClientRects();
      var page = 0;
      Array.prototype.forEach.call(rects, function(rect) {
        if (rect.width > 0 && rect.height > 0) page = Math.max(page, Math.floor((rect.left - left + 1) / width) + 1);
      });
      if (page > 0) return page;
    }
    return 0;
  }

  function calculateTotalPages() {
    if (content && isScrollFlow()) return Math.max(1, Math.ceil((content.scrollHeight - 2) / Math.max(1, getPageHeight())));
    var width = getPageWidth();
    if (!content || width <= 0) return 1;
    var left = content.getBoundingClientRect().left;
    var byContent = lastContentPage(left, width);
    if (byContent > 0) return byContent;
    // Full-width chapter fragments start at column boundaries. Measuring their
    // integer column indices avoids rounding an extent into a phantom page.
    var pages = 1;
    Array.prototype.forEach.call(content.children, function(section) {
      Array.prototype.forEach.call(section.getClientRects(), function(fragment) {
        if (fragment.width > 0 && fragment.height > 0) {
          pages = Math.max(pages, Math.round((fragment.left - left) / width) + 1);
        }
      });
    });
    return pages;
  }

  function sendPageState() {
    var pageBeforeClamp = currentPage;
    var widthBeforeMeasure = getPageWidth();
    totalPages = calculateTotalPages();
    currentPage = Math.max(1, Math.min(totalPages, currentPage));
    console.log('[FORENSIC:iframe:sendPageState] t=' + (performance.timeOrigin + performance.now()) + ' pageBeforeClamp=' + pageBeforeClamp + ' pageAfterClamp=' + currentPage + ' totalPages=' + totalPages + ' layoutReady=' + initialLayoutReady + ' restorePending=' + restorationPending + ' width=' + widthBeforeMeasure + ' scrollWidth=' + content.scrollWidth);

    var width = getPageWidth();
    var offset = (currentPage - 1) * width;

    // Detect active chapter
    var chapters = document.querySelectorAll(".epub-chapter");
    var chapterLocations = [];
    chapters.forEach(function(section, index) {
      var rect = section.getBoundingClientRect();
      var startPage = isScrollFlow()
        ? Math.max(1, Math.min(totalPages, Math.floor(Math.max(0, rect.top + viewport.scrollTop) / Math.max(1, getPageHeight())) + 1))
        : Math.max(1, Math.min(totalPages, Math.floor(Math.max(0, rect.left + offset) / width) + 1));
      chapterLocations.push({
        chapterIndex: index,
        pageNumber: startPage,
        title: section.getAttribute("data-chapter-title") || ""
      });
      if (isScrollFlow() ? rect.top <= getPageHeight() * 0.3 : rect.left <= width * 0.5) {
        currentChapterIndex = index;
        currentChapterTitle = section.getAttribute("data-chapter-title") || "";
      }
    });

    if (initialLayoutReady && !restorationPending && !isAnimating && !typographyPending && !typographyLogicalAnchor) {
      try { typographyLogicalAnchor = studyVisibleAnchor(); } catch (error) { /* Image-only page: numeric position remains available. */ }
    }
    var state = {
      type: "page",
      pageNumber: currentPage,
      currentPage: currentPage,
      targetPage: targetPage,
      operationId: activeOperationId,
      origin: activeOrigin,
      totalPages: totalPages,
      chapterIndex: currentChapterIndex,
      chapterTitle: currentChapterTitle,
      layoutReady: initialLayoutReady,
      readingAnchor: typographyLogicalAnchor,
      anchorRestoreStatus: anchorRestoreStatus,
      chapterLocations: chapterLocations
    };

    var key = JSON.stringify(state);
    if (key === lastReportedKey) return;
    lastReportedKey = key;

    var message = JSON.stringify(state);
    if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
      window.ReactNativeWebView.postMessage(message);
    }
    if (window.parent && window.parent !== window) {
      window.parent.postMessage(message, "*");
    }
  }

  function recalculateLayout() {
    var reason = arguments.length ? arguments[0] : 'unspecified';
    navigationDiagnostic(reason.indexOf('resize') >= 0 ? 'RESIZE' : 'LAYOUT_RECALC', currentPage);
    if (!content) return;
    if (typographyPending) return;
    if (isAnimating) {
      recalculateAfterTransition = true;
      console.log('[FORENSIC:iframe:recalculateLayout] t=' + (performance.timeOrigin + performance.now()) + ' deferred during animation reason=' + reason + ' currentPage=' + currentPage + ' targetPage=' + targetPage);
      return;
    }
    var currentLayoutFrame = ++layoutFrame;
    console.log('[FORENSIC:iframe:recalculateLayout] t=' + (performance.timeOrigin + performance.now()) + ' reason=' + reason + ' pageAtSchedule=' + currentPage + ' totalBefore=' + totalPages + ' width=' + getPageWidth() + ' scrollWidth=' + content.scrollWidth);
    requestAnimationFrame(function() {
      if (currentLayoutFrame !== layoutFrame) return;
      if (isAnimating) {
        recalculateAfterTransition = true;
        console.log('[FORENSIC:iframe:recalculateLayout:raf] deferred reason=' + reason + ' currentPage=' + currentPage + ' targetPage=' + targetPage);
        return;
      }
      // Read the logical page when the new layout is committed. Capturing it
      // when scheduling the frame can replay page 1 after initial restoration.
      var pageToPreserve = currentPage;
      totalPages = calculateTotalPages();
      var targetPage = Math.max(1, Math.min(totalPages, pageToPreserve));
      console.log('[FORENSIC:iframe:recalculateLayout:raf] t=' + (performance.timeOrigin + performance.now()) + ' reason=' + reason + ' totalPages=' + totalPages + ' pageToPreserve=' + pageToPreserve + ' → targetPage=' + targetPage);
      window.goToPage(targetPage, undefined, 'LAYOUT_RECALC');
    });
  }

  window.goToPage = function(page, operationId, origin, restoredAnchor) {
    if (origin !== 'SETTINGS_LAYOUT' && origin !== 'LAYOUT_RECALC') {
      if (origin !== 'RESTORE') ++restorePositionGeneration;
      typographyLogicalAnchor = origin === 'RESTORE' ? restoredAnchor || null : null;
      if (origin !== 'RESTORE') anchorRestoreStatus = null;
    }
    if (typographyPending) typographyAnchor = null; // An explicit navigation supersedes the old anchor.
    totalPages = calculateTotalPages();
    var requestedPage = Math.max(1, Math.min(totalPages, page));
    console.log('[FORENSIC:iframe:goToPage] t=' + (performance.timeOrigin + performance.now()) + ' requested=' + page + ' actual=' + requestedPage + ' totalPages=' + totalPages + ' currentPage=' + currentPage + ' targetPage=' + targetPage + ' width=' + getPageWidth() + ' scrollWidth=' + content.scrollWidth + ' stack=' + (new Error().stack || '').replace(/\\n/g, ' | '));
    if (isAnimating) {
      deferredPage = { page: requestedPage, operationId: operationId, origin: origin };
      return;
    }
    if (isScrollFlow()) {
      if (typeof operationId === 'number') activeOperationId = operationId;
      if (origin) activeOrigin = origin;
      scrollSuppressUntil = Date.now() + 300;
      if (scrollTargetTop !== null) { viewport.scrollTop = scrollTargetTop; scrollTargetTop = null; }
      // Recalcular o layout não move a leitura; navegação explícita vai ao topo da tela pedida.
      else if (origin !== 'LAYOUT_RECALC' && origin !== 'SETTINGS_LAYOUT') viewport.scrollTop = (requestedPage - 1) * getPageHeight();
      currentPage = Math.max(1, Math.min(totalPages, scrollPageFor(viewport.scrollTop)));
      targetPage = currentPage; transitionDirection = 0;
      navigationDiagnostic(activeOrigin, page);
      sendPageState();
      return;
    }
    if (typeof operationId === 'number') activeOperationId = operationId;
    if (origin) activeOrigin = origin;
    currentPage = requestedPage;
    targetPage = currentPage;
    transitionDirection = 0;
    content.classList.remove("is-transitioning");
    var width = getPageWidth();
    content.style.transform = "translateX(-" + ((currentPage - 1) * width) + "px)";
    navigationDiagnostic(activeOrigin, page);
    sendPageState();
  };

  function finishNavigation() {
    if (!isAnimating) return;
    console.log('[FORENSIC:iframe:transitionend] t=' + (performance.timeOrigin + performance.now()) + ' currentPage=' + currentPage + ' targetPage=' + targetPage);
    content.classList.remove("is-transitioning");
    currentPage = targetPage;
    targetPage = currentPage;
    transitionDirection = 0;
    isAnimating = false;
    navigationDiagnostic('TRANSITION_END', currentPage);
    sendPageState();

    if (deferredPage !== null) {
      var page = deferredPage;
      deferredPage = null;
      window.goToPage(page.page, page.operationId, page.origin);
    } else if (recalculateAfterTransition) {
      recalculateAfterTransition = false;
      recalculateLayout('deferred-after-transitionend');
    }
    if (pendingTypographyOptions) {
      var nextTypography = pendingTypographyOptions;
      pendingTypographyOptions = null;
      window.updateTypography(nextTypography);
    }
  }

  content.addEventListener("transitionend", function(event) {
    if (event.target === content && event.propertyName === "transform") finishNavigation();
  });

  // Virada de página (Fase D, 16/11/2026): "none" (instantânea), "slide" (o deslizar de sempre) e "flip" (a página gira como
  // uma folha). Reduzir movimento (sistema ou app) força "none". A posição só é confirmada quando a virada termina.
  var pageTurnMode = "slide", reduceMotionRequested = false, flipTimer = 0;
  function effectivePageTurn() {
    var systemReduce = false;
    try { systemReduce = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches); } catch (error) {}
    return reduceMotionRequested || systemReduce ? "none" : pageTurnMode;
  }
  window.updateMotion = function(options) {
    var mode = options && options.pageTurn;
    pageTurnMode = mode === "none" || mode === "flip" ? mode : "slide";
    reduceMotionRequested = !!(options && options.reduceMotion);
  };
  function flipToPage(width) {
    var forward = targetPage > currentPage, phase = 0, half = forward ? -90 : 90;
    document.body.style.perspective = "1800px";
    viewport.style.transition = "transform 170ms ease-in, filter 170ms ease-in";
    viewport.style.transformOrigin = forward ? "left center" : "right center";
    function done() {
      if (phase === 2) return; phase = 2; clearTimeout(flipTimer);
      viewport.removeEventListener("transitionend", onEnd);
      viewport.style.transition = ""; viewport.style.transform = ""; viewport.style.transformOrigin = ""; viewport.style.filter = "";
      finishNavigation();
    }
    function swap() {
      phase = 1;
      content.style.transform = "translateX(-" + ((targetPage - 1) * width) + "px)";
      viewport.style.transition = "none";
      viewport.style.transformOrigin = forward ? "right center" : "left center";
      viewport.style.transform = "rotateY(" + (-half) + "deg)";
      void viewport.offsetWidth;
      viewport.style.transition = "transform 190ms ease-out, filter 190ms ease-out";
      viewport.style.transform = "rotateY(0deg)"; viewport.style.filter = "";
    }
    function onEnd(event) { if (event.target !== viewport || event.propertyName !== "transform") return; if (phase === 0) swap(); else done(); }
    viewport.addEventListener("transitionend", onEnd);
    // Sem transitionend (aba oculta, WebView pausada) a virada termina mesmo assim.
    flipTimer = setTimeout(function() { if (phase === 0) swap(); done(); }, 700);
    requestAnimationFrame(function() { viewport.style.transform = "rotateY(" + half + "deg)"; viewport.style.filter = "brightness(0.82)"; });
  }

  window.navigatePage = function(direction, operationId, origin) {
    if (direction !== -1 && direction !== 1) return;
    typographyLogicalAnchor = null;
    anchorRestoreStatus = null;
    ++restorePositionGeneration;
    if (typographyPending) typographyAnchor = null;
    if (isAnimating) {
      // Toques durante a virada se acumulam: três toques avançam três páginas.
      var base = deferredPage ? deferredPage.page : targetPage;
      deferredPage = { page: Math.max(1, Math.min(totalPages, base + direction)), operationId: operationId, origin: origin };
      return;
    }
    if (isScrollFlow()) {
      totalPages = calculateTotalPages();
      scrollTargetTop = Math.max(0, viewport.scrollTop + direction * Math.max(40, getPageHeight() - 32));
      window.goToPage(scrollPageFor(scrollTargetTop), operationId, origin || (direction > 0 ? 'NEXT_PAGE' : 'PREVIOUS_PAGE'));
      return;
    }
    totalPages = calculateTotalPages();
    transitionDirection = direction;
    targetPage = Math.max(1, Math.min(totalPages, currentPage + transitionDirection));
    if (typeof operationId === 'number') activeOperationId = operationId;
    activeOrigin = origin || (direction > 0 ? 'NEXT_PAGE' : 'PREVIOUS_PAGE');
    navigationDiagnostic(activeOrigin, targetPage);
    console.log('[FORENSIC:iframe:navigatePage] t=' + (performance.timeOrigin + performance.now()) + ' direction=' + direction + ' currentPage=' + currentPage + ' targetPage=' + targetPage + ' totalPages=' + totalPages);
    if (targetPage === currentPage) {
      transitionDirection = 0;
      sendPageState();
      return;
    }

    isAnimating = true;
    var turn = effectivePageTurn();
    if (turn === "flip") { flipToPage(getPageWidth()); return; }
    content.classList.toggle("turn-instant", turn === "none");
    content.classList.add("is-transitioning");
    content.style.transform = "translateX(-" + ((targetPage - 1) * getPageWidth()) + "px)";

    var duration = getComputedStyle(content).transitionDuration.split(",")[0].trim();
    if (duration === "0s" || duration === "0ms") finishNavigation();
  };

  window.display = function() {
    if (isAnimating) { recalculateAfterTransition = true; return; }
    if (typographyPending) return;
    var width = getPageWidth();
    console.log('[FORENSIC:iframe:display] t=' + (performance.timeOrigin + performance.now()) + ' called, width=' + width + ' currentPage=' + currentPage);
    if (!width || width <= 0) {
      requestAnimationFrame(window.display);
      return;
    }
    syncPageDimensions();
    totalPages = calculateTotalPages();
    window.goToPage(currentPage, undefined, 'LAYOUT_RECALC');
  };

  window.searchText = function(query) {
    var term = String(query || "").trim();
    if (!term) return;
    var found = window.find(term, false, false, true, false, false, false);
    if (found) {
      var selection = window.getSelection();
      var rect = selection && selection.rangeCount ? selection.getRangeAt(0).getBoundingClientRect() : null;
      var page = rect ? Math.max(1, pageForRect(rect)) : currentPage;
      if (rect && isScrollFlow()) scrollTargetTop = topForRect(rect);
      window.goToPage(page);
    }
    var result = JSON.stringify({ type: "searchResult", found: found });
    if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) window.ReactNativeWebView.postMessage(result);
    if (window.parent && window.parent !== window) window.parent.postMessage(result, "*");
  };

  // Textura de papel (16/11/2026): só a imagem de fundo do viewport. Não toca layout, página, âncora nem tipografia.
  window.updateSurface = function(options) {
    var image = options && typeof options.backgroundImage === "string" ? options.backgroundImage : "none";
    if (image !== "none" && (image.indexOf('url("data:image/svg+xml,') !== 0 || image.length > 20000)) image = "none";
    viewport.style.backgroundImage = image;
    viewport.style.backgroundRepeat = image === "none" ? "" : "repeat, no-repeat";
    viewport.style.backgroundSize = image === "none" ? "" : "400px 400px, 100% 100%";
  };

  window.updateTypography = function(options) {
    if (!options) return;
    if (isAnimating) { pendingTypographyOptions = options; return; }
    if (!typographyPending && !restorationPending) {
      try {
        if (!typographyLogicalAnchor) typographyLogicalAnchor = studyVisibleAnchor();
        typographyAnchor = typographyLogicalAnchor;
      } catch (error) { typographyAnchor = null; typographyLogicalAnchor = null; }
    }
    typographyPending = true;
    var generation = ++typographyGeneration;
    ++layoutFrame; // Invalidate pre-typography geometry work.
    console.log('[FORENSIC:iframe:updateTypography] t=' + (performance.timeOrigin + performance.now()) + ' currentPage=' + currentPage + ' totalPages=' + totalPages);
    var dynamicStyle = document.getElementById("dynamic-typography");
    if (!dynamicStyle) {
      dynamicStyle = document.createElement("style");
      dynamicStyle.id = "dynamic-typography";
      document.head.appendChild(dynamicStyle);
    }

    var font = readerCssFontFamily(options.fontFamily || "Georgia");
    var size = options.fontSize || 16;
    var lineH = Math.round(size * Math.max(1.1, Math.min(2.4, options.lineHeight || 1.65)));
    var color = options.textColor || "#2b2b2b";
    var bg = options.backgroundColor || "#f5ebd9";
    var margin = Math.max(16, Math.min(48, Math.round(options.marginSize || 20)));
    var paragraphSpacing = Math.max(0, Math.min(2, options.paragraphSpacing ?? 1));
    var maxWidth = Math.max(320, Math.min(1200, options.maxWidth || 900));
    var alignment = options.alignment === "justify" ? "justify" : "left";
    var textSelection = options.allowTextSelection ? "text" : "none";

    dynamicStyle.innerHTML =
      "*, body, p, div, span, li, blockquote, h1, h2, h3, h4, h5, h6 { " +
        "font-family: " + font + " !important; " +
        "color: " + color + " !important; " +
      "} " +
      "p, div, span, li, blockquote { " +
        "font-size: " + size + "px !important; " +
        "line-height: " + lineH + "px !important; " +
        "text-align: " + alignment + " !important; " +
        readerFontSpacingCss(options.fontFamily || "Georgia") + " " +
      "} " +
      "p { margin-bottom: " + paragraphSpacing + "em !important; } " +
      ".epub-chapter > * { max-width: min(100%, " + maxWidth + "px) !important; margin-left: auto !important; margin-right: auto !important; " +
      "} " +
      "html, body { user-select: " + textSelection + " !important; -webkit-user-select: " + textSelection + " !important; } " +
      "::selection { background: " + color + " !important; color: " + bg + " !important; } " +
      "body, html, #reader-viewport { " +
        "background-color: " + bg + " !important; " +
      "} " +
      ".epub-chapter { " +
        "padding: 24px " + margin + "px 32px " + margin + "px !important; " +
        "color: inherit !important; " +
        "background: transparent !important; " +
      "} " +
      ".epub-chapter * { " +
        "color: inherit !important; " +
        "background: transparent !important; " +
      "}";

    var fontsReady = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
    fontsReady.then(function() {
      requestAnimationFrame(function() {
        if (generation !== typographyGeneration) return;
        typographyPending = false;
        if (isAnimating) {
          recalculateAfterTransition = true;
          typographyAnchor = null;
          return;
        }
        syncPageDimensions();
        totalPages = calculateTotalPages();
        var pageToPreserve = currentPage;
        if (typographyAnchor && !restorationPending) {
          var section = Array.from(content.querySelectorAll('.epub-chapter')).find(function(s) { return s.getAttribute('data-chapter-id') === typographyAnchor.chapterId; });
          var model = section && studyText(section);
          var range = model && studyRange(model, typographyAnchor.start, typographyAnchor.start + 1);
          var rect = range && range.getClientRects()[0];
          if (rect) { pageToPreserve = pageForRect(rect); if (isScrollFlow()) scrollTargetTop = topForRect(rect); }
        }
        typographyAnchor = null;
        if (restorationPending) {
          recalculateLayout('typography-during-restore');
          return;
        }
        var typographyTargetPage = Math.max(1, Math.min(totalPages, pageToPreserve));
        console.log('[FORENSIC:iframe:updateTypography:apply] t=' + (performance.timeOrigin + performance.now()) + ' pageToPreserve=' + pageToPreserve + ' measuredTotal=' + totalPages + ' target=' + typographyTargetPage);
        window.goToPage(typographyTargetPage, undefined, 'SETTINGS_LAYOUT');
      });
    });
  };

  window.restoreReadingPosition = function(position) {
    var generation = ++restorePositionGeneration;
    function applyPosition() {
      if (generation !== restorePositionGeneration) return;
      if (!initialLayoutReady || typographyPending || isAnimating) { requestAnimationFrame(applyPosition); return; }
      var page = position.pageNumber, restored = null;
      anchorRestoreStatus = null;
      if (position.anchor) {
        try {
          var a = parseStudyAnchor(position.anchor);
          var section = Array.from(content.querySelectorAll('.epub-chapter')).find(function(s) { return s.getAttribute('data-chapter-id') === a.chapterId; });
          var model = section && studyText(section), resolved = model && resolveStudyAnchor(model.text, a);
          anchorRestoreStatus = resolved ? resolved.status : 'missing';
          if (resolved && (resolved.status === 'exact' || resolved.status === 'relocated')) {
            var range = studyRange(model, resolved.start, resolved.start + 1), rect = range && range.getClientRects()[0];
            if (rect) { page = pageForRect(rect); if (isScrollFlow()) scrollTargetTop = topForRect(rect); restored = Object.assign({}, a, { start: resolved.start, end: resolved.end }); }
            else anchorRestoreStatus = 'missing';
          }
        } catch (error) { anchorRestoreStatus = 'missing'; }
      }
      // goToPage emits its ACK synchronously. Install the anchor before sending it.
      window.goToPage(page, 0, 'RESTORE', restored);
    }
    applyPosition();
  };

  // Alternar Páginas ↔ Rolagem: guarda o trecho do topo, troca o layout e volta ao mesmo trecho (âncora mantida).
  window.updateFlow = function(options) {
    var next = options && options.flow === "scroll" ? "scroll" : "paged";
    if (next === flowMode) return;
    if (isAnimating || typographyPending || !initialLayoutReady) { requestAnimationFrame(function() { window.updateFlow(options); }); return; }
    var anchor = typographyLogicalAnchor;
    if (!anchor) { try { anchor = studyVisibleAnchor(); } catch (error) { anchor = null; } }
    flowMode = next;
    content.classList.remove("is-transitioning");
    document.documentElement.classList.toggle("reader-scroll", next === "scroll");
    // Volta ao modo página medindo a partir da primeira coluna: sem a rolagem e sem o deslocamento antigo.
    if (next === "paged") { viewport.scrollTop = 0; content.style.transform = "translateX(0px)"; currentPage = 1; }
    requestAnimationFrame(function() { requestAnimationFrame(function() {
      syncPageDimensions(); totalPages = calculateTotalPages();
      var page = currentPage;
      if (anchor) {
        try {
          var section = Array.from(content.querySelectorAll(".epub-chapter")).find(function(s) { return s.getAttribute("data-chapter-id") === anchor.chapterId; });
          var model = section && studyText(section), range = model && studyRange(model, anchor.start, anchor.start + 1), rect = range && range.getClientRects()[0];
          if (rect) { if (next === "paged") currentPage = 1; page = pageForRect(rect); if (next === "scroll") scrollTargetTop = topForRect(rect); }
        } catch (error) { /* Sem âncora: posição numérica. */ }
      }
      typographyLogicalAnchor = anchor;
      window.goToPage(page, undefined, "SETTINGS_LAYOUT");
    }); });
  };

  viewport.addEventListener("scroll", function() {
    if (!isScrollFlow() || Date.now() < scrollSuppressUntil) return;
    clearTimeout(scrollSettleTimer);
    scrollSettleTimer = setTimeout(function() {
      if (!isScrollFlow() || typographyPending || restorationPending) return;
      // A posição é a do leitor: nova âncora do topo, gravada só quando a rolagem para.
      typographyLogicalAnchor = null; anchorRestoreStatus = null; ++restorePositionGeneration;
      activeOrigin = "SCROLL";
      totalPages = calculateTotalPages();
      currentPage = Math.max(1, Math.min(totalPages, scrollPageFor(viewport.scrollTop))); targetPage = currentPage;
      sendPageState();
    }, 200);
  }, { passive: true });
  // Na rolagem não há zonas de toque por cima: toque sem arrastar mostra os controles; pressionar e segurar abre o grifo.
  var pressStart = null, pressTimer = 0;
  viewport.addEventListener("pointerdown", function(event) {
    if (!isScrollFlow()) return;
    pressStart = { x: event.clientX, y: event.clientY, top: viewport.scrollTop, long: false };
    clearTimeout(pressTimer);
    pressTimer = setTimeout(function() {
      if (!pressStart || Math.abs(viewport.scrollTop - pressStart.top) > 8) return;
      pressStart.long = true; postReader({ type: "longPress", x: pressStart.x, y: pressStart.y });
    }, 500);
  });
  viewport.addEventListener("pointermove", function(event) {
    if (pressStart && Math.abs(event.clientX - pressStart.x) + Math.abs(event.clientY - pressStart.y) > 10) clearTimeout(pressTimer);
  });
  viewport.addEventListener("pointerup", function(event) {
    clearTimeout(pressTimer);
    if (!pressStart || !isScrollFlow()) { pressStart = null; return; }
    var moved = Math.abs(event.clientX - pressStart.x) + Math.abs(event.clientY - pressStart.y) + Math.abs(viewport.scrollTop - pressStart.top), wasLong = pressStart.long;
    pressStart = null;
    if (!wasLong && moved < 10 && !window.__studySelectionRequest) postReader({ type: "tap" });
  });
  viewport.addEventListener("pointercancel", function() { clearTimeout(pressTimer); pressStart = null; });

  function handleMessage(event) {
    var data = event.data;
    if (typeof data === "string") {
      try { data = JSON.parse(data); } catch(e) { return; }
    }
    if (!data) return;
    console.log('[FORENSIC:iframe:message] t=' + (performance.timeOrigin + performance.now()) + ' type=' + data.type + ' pageNumber=' + (data.pageNumber === undefined ? '' : data.pageNumber) + ' direction=' + (data.direction === undefined ? '' : data.direction));
    if (data.type === "beginInitialRestore") {
      restorationPending = true;
      console.log('[FORENSIC:iframe:restore] t=' + (performance.timeOrigin + performance.now()) + ' began; currentPage=' + currentPage + ' totalPages=' + totalPages);
      lastReportedKey = "";
      sendPageState();
    } else if (data.type === "completeInitialRestore") {
      restorationPending = false;
      console.log('[FORENSIC:iframe:restore] t=' + (performance.timeOrigin + performance.now()) + ' confirmed; currentPage=' + currentPage + ' totalPages=' + totalPages);
      sendPageState();
    } else if (data.type === "restoreReadingPosition") {
      window.restoreReadingPosition(data);
    } else if (data.type === "goToPage" && typeof data.pageNumber === "number") {
      window.goToPage(data.pageNumber, data.operationId, data.origin);
    } else if (data.type === "navigatePage" && typeof data.direction === "number") {
      window.navigatePage(data.direction, data.operationId, data.origin);
    } else if (data.type === "search" && typeof data.query === "string") {
      window.searchText(data.query);
    } else if (data.type === "display") {
      window.display();
    } else if (data.type === "updateTypography") {
      window.updateTypography(data);
    } else if (data.type === "updateSurface") {
      window.updateSurface(data);
    } else if (data.type === "updateMotion") {
      window.updateMotion(data);
    } else if (data.type === "updateFlow") {
      window.updateFlow(data);
    }
  }

  document.addEventListener("error", function(event) {
    if (event.target && event.target.tagName === "IMG") event.target.dataset.epubError = "true";
  }, true);

  document.addEventListener("click", function(event) {
    var target = event.target;
    var anchor = target && target.closest ? target.closest("a, area") : null;
    if (!anchor) return;
    var href = anchor.getAttribute("href") || anchor.getAttribute("xlink:href") || "";
    // Links para fora do livro não navegam o Reader: ele não é um navegador e a página de destino tomaria o lugar da leitura.
    if (href && href.charAt(0) !== "#") { event.preventDefault(); return; }
    var link = href.indexOf("#epub-chapter-") === 0 ? anchor : null;
    if (!link) return;
    var chapter = document.getElementById(href.slice(1));
    if (!chapter) return;
    event.preventDefault();
    var width = getPageWidth();
    var baseLeft = chapter.getBoundingClientRect().left + (currentPage - 1) * width;
    window.goToPage(Math.floor(baseLeft / width) + 1);
  });

  document.addEventListener("load", function(event) {
    if (event.target && event.target.tagName === "IMG") recalculateLayout("image-load");
  }, true);

  window.addEventListener("error", function(event) {
    var message = JSON.stringify({ type: "error", message: event.message || "Erro ao renderizar o EPUB." });
    if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
      window.ReactNativeWebView.postMessage(message);
    }
    if (window.parent && window.parent !== window) window.parent.postMessage(message, "*");
  });

  window.addEventListener("message", handleMessage);

  window.addEventListener("resize", function() {
    console.log('[FORENSIC:iframe:resize] t=' + (performance.timeOrigin + performance.now()) + ' window resize event, width=' + getPageWidth() + ' height=' + getPageHeight());
    syncPageDimensions();
    recalculateLayout("window-resize");
  });

  if (window.ResizeObserver) {
    new ResizeObserver(function() {
      console.log('[FORENSIC:iframe:ResizeObserver] t=' + (performance.timeOrigin + performance.now()) + ' viewport resized, width=' + getPageWidth() + ' height=' + getPageHeight());
      syncPageDimensions();
      recalculateLayout("resize-observer");
    }).observe(viewport);
  }

  function waitForImage(image) {
    if (image.complete) return Promise.resolve();
    return new Promise(function(resolve) {
      image.addEventListener("load", resolve, { once: true });
      image.addEventListener("error", resolve, { once: true });
      // Offscreen columns cannot trigger lazy loading while initial restoration
      // waits for every image. Request them after installing both listeners.
      if (image.loading === "lazy") image.loading = "eager";
    });
  }

  function signalInitialLayoutReady() {
    if (initialLayoutReadinessScheduled) return;
    initialLayoutReadinessScheduled = true;
    var fontsReady = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
    var imagesReady = Promise.all(Array.prototype.map.call(document.images, waitForImage));
    Promise.all([fontsReady, imagesReady]).then(function() {
      requestAnimationFrame(function() {
        initialLayoutReady = true;
        console.log('[FORENSIC:iframe:layoutReady] t=' + (performance.timeOrigin + performance.now()) + ' resources settled; totalBefore=' + totalPages + ' currentPage=' + currentPage + ' restorePending=' + restorationPending);
        recalculateLayout('initial-resources-ready');
      });
    });
  }
  signalInitialLayoutReady();

  // Execute display only after full DOM mounting
  if (document.readyState === "complete" || document.readyState === "interactive") {
    requestAnimationFrame(function() {
      setTimeout(window.display, 30);
    });
  } else {
    document.addEventListener("DOMContentLoaded", function() {
      requestAnimationFrame(function() {
        setTimeout(window.display, 30);
      });
    });
  }

})();
</script>
</body>
</html>`;
}

/** Nonce por documento. O livro é estático e não executa nada para lê-lo; basta não ser previsível entre documentos. */
function createScriptNonce(): string {
  const bytes = new Uint8Array(16);
  const source = (globalThis as { crypto?: { getRandomValues?: (array: Uint8Array) => Uint8Array } }).crypto;
  if (source?.getRandomValues) source.getRandomValues(bytes);
  else for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  return Array.from(bytes, byte => byte.toString(16).padStart(2, "0")).join("");
}

function escapeAttribute(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** React Native's System token is not a CSS font; keep initial and dynamic lists equal. */
export function readerCssFontFamily(font: string): string {
  if (font === "System") return "system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif";
  if (font === "Verdana") return "Verdana, sans-serif";
  const family = font.replace(/[<>";]/g, "");
  return family.includes("serif") ? family : `${family || "Georgia"}, serif`;
}

/** "Alta legibilidade (Verdana)" abre letras e palavras; as demais fontes não mudam. Cópia embutida igual no documento. */
export function readerFontSpacingCss(font: string): string {
  return font === "Verdana" ? "letter-spacing: 0.05em !important; word-spacing: 0.16em !important;" : "";
}
