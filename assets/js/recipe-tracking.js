/*!
 * recipe-tracking.js — Het Proeven
 * Sitebrede GA4-tracking van receptkaart-kliks (event: recipe_card_click).
 *
 * Ontwerp:
 *  - Eén gedelegeerde click-listener (capture-fase) op document-niveau.
 *  - Herkenning op COMPONENT-structuur, nooit op pagina-URL's:
 *      .collectie-kaart            -> collection   (elke huidige én toekomstige collectiepagina)
 *      #recipe-grid kaarten        -> homepage, of search bij gevulde #zoek-input
 *      (a.card / a.recipe-card)
 *      #rvdd-card / #rvdd-link     -> recommended  (recept van de dag)
 *      .collectie-extra-link       -> recommended  (aanbevelingslink op collectiepagina's)
 *      overige /recepten/-links    -> other        (kale tekstlinks in lopende tekst worden overgeslagen)
 *  - source_page komt altijd dynamisch uit location.pathname.
 *  - Verstuurt niets en faalt stil als gtag ontbreekt.
 *  - Maximaal één event per klik; navigatie wordt nooit geblokkeerd of vertraagd;
 *    ctrl/cmd-klik en middenklik blijven onaangetast (geen preventDefault, geen delay).
 *  - Dynamisch toegevoegde kaarten werken automatisch (delegation = geen re-init nodig).
 *  - Verouderde inline onclick-trackers (recipe_card_click) worden geneutraliseerd
 *    zodat er nooit dubbele events ontstaan.
 */
(function () {
  'use strict';

  var RECIPE_PATH = /^\/recepten\/([^\/]+)\/?$/;

  /* ---------- helpers ---------- */

  function fireGtag(params) {
    if (typeof window.gtag !== 'function') return; // GA4 ontbreekt: stil niets doen
    try {
      window.gtag('event', 'recipe_card_click', params);
    } catch (e) { /* nooit een console-fout veroorzaken */ }
  }

  function sourcePage() {
    var p = window.location.pathname || '/';
    return p.replace(/\/index\.html$/, '/') || '/';
  }

  function recipeSlugFromHref(href) {
    if (!href) return null;
    var u;
    try { u = new URL(href, window.location.origin); } catch (e) { return null; }
    if (u.origin !== window.location.origin) return null;
    var m = u.pathname.match(RECIPE_PATH);
    if (!m) return null;
    try { return decodeURIComponent(m[1]); } catch (e) { return m[1]; }
  }

  function cleanText(s) {
    return (s || '').replace(/\s+/g, ' ').trim().slice(0, 120);
  }

  /* ---------- componentdetectie ---------- */

  // Titel: data-attribuut eerst, dan bekende titel-elementen, dan img-alt, dan linktekst.
  var TITLE_SELECTORS = [
    '.collectie-kaart-titel',
    '.card-title',
    '.recipe-card-title',
    'h1,h2,h3,h4'
  ];

  function titleFor(card) {
    var t = card.getAttribute && card.getAttribute('data-recipe-title');
    if (t) return cleanText(t);
    for (var i = 0; i < TITLE_SELECTORS.length; i++) {
      var el = card.querySelector && card.querySelector(TITLE_SELECTORS[i]);
      if (el && el.textContent.trim()) return cleanText(el.textContent);
    }
    var img = card.querySelector && card.querySelector('img[alt]');
    if (img && img.getAttribute('alt')) return cleanText(img.getAttribute('alt'));
    return cleanText(card.textContent);
  }

  // Meest specifieke context wint: recommended > collection > search/homepage > other.
  function sourceTypeFor(el) {
    if (el.closest('#rvdd-card') || el.closest('#rvdd-link')) return 'recommended';
    if (el.closest('.collectie-extra-link')) return 'recommended'; // aanbevelingslink op collectiepagina's
    if (el.closest('.collectie-kaart')) return 'collection';
    if (el.closest('#recipe-grid, .recipe-grid')) {
      var zoek = document.getElementById('zoek-input');
      if (zoek && zoek.value && zoek.value.trim() !== '') return 'search';
      return 'homepage';
    }
    return 'other';
  }

  // Is dit een kaart-achtig element, of een kale tekstlink in lopende tekst?
  function isPlainTextLink(a) {
    if (a.closest('.collectie-kaart, .collectie-extra-link, .card, .recipe-card, .card-wrap, #rvdd-card')) return false;
    if (a.querySelector('img') || a.querySelector('[class*="img"]')) return false;
    if (a.hasAttribute('data-recipe-slug') || a.hasAttribute('data-recipe-title')) return false;
    return !!a.closest('p'); // linkje in een alinea zonder kaartkenmerken -> overslaan
  }

  /* ---------- verouderde inline tracking neutraliseren ---------- */

  function stripLegacyInline(root) {
    var nodes = (root || document).querySelectorAll('[onclick*="recipe_card_click"]');
    for (var i = 0; i < nodes.length; i++) {
      nodes[i].removeAttribute('onclick');
      nodes[i].setAttribute('data-legacy-tracking-removed', '1');
    }
  }

  /* ---------- centrale click-handler (capture-fase) ---------- */

  function onClick(e) {
    // Alleen echte (linker/keyboard) kliks; auxclick/middenklik triggert dit event niet.
    if (e.defaultPrevented && !e.isTrusted) return;

    var target = e.target instanceof Element ? e.target : null;
    if (!target) return;

    var card = null, href = null, type = null;

    // 1. Recept van de dag: div-kaart die via inline onclick navigeert (geen <a> nodig)
    var rvdd = target.closest('#rvdd-card');
    if (rvdd) {
      var link = document.getElementById('rvdd-link');
      href = link ? link.getAttribute('href') : null;
      card = rvdd;
      type = 'recommended';
    } else {
      // 2. Elke gewone link
      var a = target.closest('a[href]');
      if (!a) return;
      href = a.getAttribute('href');
      if (!recipeSlugFromHref(href)) return;
      if (isPlainTextLink(a)) return; // lopende-tekstlink: niet tracken
      card = a;
      type = sourceTypeFor(a);
    }

    var slug = recipeSlugFromHref(href);
    if (!slug) return;

    // Maximaal één event per klik (ook bij geneste componenten)
    if (e.__hpRecipeTracked) return;
    e.__hpRecipeTracked = true;

    // Verdedigend: mocht een (dynamisch toegevoegde) kaart nog oude inline
    // tracking dragen, verwijder die vóór hij kan vuren (capture komt eerst).
    if (card.getAttribute && card.getAttribute('onclick') &&
        card.getAttribute('onclick').indexOf('recipe_card_click') !== -1) {
      card.removeAttribute('onclick');
    }

    fireGtag({
      recipe_title: titleFor(card),
      recipe_slug: slug,
      source_page: sourcePage(),
      source_type: type
    });
    // Geen preventDefault, geen setTimeout: navigatie (ook ctrl/cmd/nieuw tabblad)
    // verloopt volledig ongewijzigd; gtag verstuurt via beacon.
  }

  /* ---------- init ---------- */

  function init() {
    stripLegacyInline(document);
    document.addEventListener('click', onClick, true);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
