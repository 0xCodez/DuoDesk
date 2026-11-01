// Runs in <head>, before first paint: hides the page while app.js fetches the pt-BR dictionary, so
// Portuguese visitors don't see the English text first. The timer is a fallback if the fetch hangs.
try {
  const saved = localStorage.getItem('duodesk_web_lang');
  if (saved === 'pt-BR' || (saved !== 'en' && (navigator.language || '').toLowerCase().startsWith('pt'))) {
    document.documentElement.classList.add('i18n-pending');
    setTimeout(() => document.documentElement.classList.remove('i18n-pending'), 2500);
  }
} catch (_) {}
