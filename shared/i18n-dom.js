// Language for the small windows (popups, HUD, viewers): picks the saved choice (General page) or the
// system's, then fills [data-i18n] elements. Load after locales/en.js, locales/pt-BR.js and i18n.js.
//   <span data-i18n="key">English default</span>      → textContent
//   data-i18n-title / -placeholder / -aria-label="key" → that attribute (the English one is the default)
(function () {
  'use strict';
  const I = window.DuoDeskI18n;
  if (!I) return;
  let saved = null;
  try { saved = localStorage.getItem('duodesk.general.language') || localStorage.getItem('duodesk.lang'); } catch (_) {}
  I.setLanguage(saved && saved !== 'auto' ? saved : (navigator.language || 'en'));

  function apply(root) {
    const scope = root || document;
    for (const el of scope.querySelectorAll('[data-i18n]')) el.textContent = I.t(el.dataset.i18n, null, el.textContent);
    for (const a of ['title', 'placeholder', 'aria-label']) {
      for (const el of scope.querySelectorAll('[data-i18n-' + a + ']')) el.setAttribute(a, I.t(el.getAttribute('data-i18n-' + a), null, el.getAttribute(a) || ''));
    }
    if (document.documentElement) document.documentElement.lang = I.getLanguage();
  }
  window.DuoDeskI18nDom = { apply };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => apply());
  else apply();
})();
