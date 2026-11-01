// Loaded as a file, not inline: the CSP (vercel.json) allows only script-src 'self'.
let lang = '';
try { lang = localStorage.getItem('duodesk_web_lang') || ''; } catch (_) {}
if ((lang || navigator.language || '').toLowerCase().startsWith('pt')) {
  document.documentElement.lang = 'pt-BR';
  document.title = 'Não encontrado · DuoDesk';
  const h1 = document.querySelector('h1');
  if (h1) h1.innerHTML = 'Esta página não está em <span class="spec">nenhuma&nbsp;mesa</span>.';
  const lede = document.querySelector('.sec-lede');
  if (lede) lede.textContent = 'O link pode ser antigo ou a página foi movida.';
  const btn = document.querySelector('.cta a');
  if (btn) btn.textContent = 'Voltar para o DuoDesk';
}
