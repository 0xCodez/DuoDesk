(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    const en = require('./locales/en.js');
    const ptBR = require('./locales/pt-BR.js');
    module.exports = factory({ 'en': en, 'pt-BR': ptBR });
  } else {
    root.DuoDeskI18n = factory(root.DuoDeskLocales || {});
    root.t = root.DuoDeskI18n.t;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function (locales) {
  'use strict';
  let currentLang = 'en';
  const listeners = new Set();

  function getDict(lang) {
    const d = locales[lang];
    if (typeof d === 'function') return d();
    return d || {};
  }

  function normalizeLang(lang) {
    if (!lang) return 'en';
    const lower = String(lang).toLowerCase();
    if (lower.startsWith('pt')) return 'pt-BR';
    if (lower.startsWith('en')) return 'en';
    return locales[lang] ? lang : 'en';
  }

  function t(key, params, defaultText) {
    if (!key) return defaultText !== undefined ? defaultText : '';
    const dict = getDict(currentLang);
    const fallbackDict = getDict('en');
    let text = dict[key] !== undefined ? dict[key] : (fallbackDict[key] !== undefined ? fallbackDict[key] : (defaultText !== undefined ? defaultText : key));
    if (params && typeof params === 'object') {
      text = String(text).replace(/\{(\w+)\}/g, (_, k) => (params[k] !== undefined && params[k] !== null ? params[k] : `{${k}}`));
    }
    return text;
  }

  function registerLocale(code, dict) {
    locales[code] = dict;
  }

  function setLanguage(lang) {
    currentLang = normalizeLang(lang);
    listeners.forEach(fn => { try { fn(currentLang); } catch (e) { console.error(e); } });
    return currentLang;
  }

  function getLanguage() { return currentLang; }

  function getAvailableLanguages() {
    return Object.keys(locales).map((code) => ({ code, label: getDict(code)['lang.name'] || code }));
  }

  function onLanguageChange(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  }

  return { t, setLanguage, getLanguage, normalizeLang, registerLocale, getAvailableLanguages, onLanguageChange };
});
