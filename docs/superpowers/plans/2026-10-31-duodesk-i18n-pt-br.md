# DuoDesk i18n & Tradução para Português (Brasil) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar arquitetura de internacionalização (i18n) completa e traduzir 100% do DuoDesk para Português do Brasil (pt-BR) abrangendo Desktop (Windows/macOS/Linux), Documentação, Android e Website.

**Architecture:** Módulo core `shared/i18n.js` isomórfico (Node + Browser) zero-dependency com dicionários `shared/locales/en.js` e `shared/locales/pt-BR.js`. Integração em renderers Electron via script tags e persistência via store local. No Android, extração para `values-pt-rBR/strings.xml` com integração Jetpack Compose. Na documentação, `README.pt-BR.md` completo com seletor de idiomas.

**Tech Stack:** JavaScript (ES6 vanilla, Node.js assert), HTML5/CSS3, Electron, Android Kotlin (Jetpack Compose, XML resources), Markdown.

**Spec:** [duodesk-i18n-spec.md](file:///C:/Users/Mau/.gemini/antigravity/brain/2ead9a51-f63f-4695-b736-2f0c7af12ec9/duodesk-i18n-spec.md)

## Global Constraints

- Zero dependências npm externas adicionadas aos pacotes de runtime do Electron.
- Compatibilidade estrita com Content-Security-Policy (`script-src 'self'`).
- Carregamento síncrono das traduções evitando Cumulative Layout Shift (CLS) e flashes de conteúdo sem tradução (FOUT).
- Fallback automático para `en` quando uma chave não existir no idioma selecionado.
- Preservar integridade de código, testes existentes e compatibilidade com macOS, Windows e Linux.

## Review Focus

1. Interpolação de variáveis ausentes ou nulas em `t(key, params)` não deve lançar erro nem quebrar a UI, retornando a string original ou o placeholder intacto.
2. Troca de idioma em runtime em Configurações Gerais deve atualizar imediatamente os textos visíveis sem exigir reinicialização manual do app.
3. Chave inexistente deve retornar a chave original ou o `defaultText` em vez de `undefined`.
4. Detecção de idioma do sistema (`navigator.language`) deve mapear variantes como `pt`, `pt-BR`, `pt_BR` para o catálogo `pt-BR`.
5. Recursos Android não devem falhar em tempo de compilação ou execução caso o dispositivo utilize um locale não traduzido (fallback para `values/strings.xml`).

---

### Task 1: Core i18n Engine & Catálogos de Idioma (Desktop & Shared)

**Files:**
- Create: `shared/locales/en.js`
- Create: `shared/locales/pt-BR.js`
- Create: `shared/i18n.js`
- Test: `shared/test/i18n.js`

**Interfaces:**
- Produces:
  - `i18n.t(key: string, params?: object, defaultText?: string): string`
  - `i18n.setLanguage(lang: string): string`
  - `i18n.getLanguage(): string`
  - `i18n.getAvailableLanguages(): Array<{code: string, label: string}>`
  - `i18n.onLanguageChange(listener: (lang: string) => void): () => void`

- [ ] **Step 1: Escrever teste de unidade que falha para o motor i18n**

Criar `shared/test/i18n.js`:
```javascript
'use strict';
const assert = require('assert');
const i18n = require('../i18n.js');

// Teste 1: Chave básica em inglês padrão
i18n.setLanguage('en');
assert.strictEqual(i18n.t('app.name'), 'DuoDesk');

// Teste 2: Alternância para pt-BR
i18n.setLanguage('pt-BR');
assert.strictEqual(i18n.t('nav.overview'), 'Visão Geral');

// Teste 3: Interpolação de parâmetros
assert.strictEqual(
  i18n.t('pair.hint_code', { code: '1234' }),
  'Digite o código 1234 no outro computador'
);

// Teste 4: Fallback para chave inexistente
assert.strictEqual(i18n.t('non.existent.key', null, 'Texto Fallback'), 'Texto Fallback');

// Teste 5: Listener de mudança de idioma
let changedTo = null;
const unsubscribe = i18n.onLanguageChange((lang) => { changedTo = lang; });
i18n.setLanguage('en');
assert.strictEqual(changedTo, 'en');
unsubscribe();

console.log('i18n: ok');
```

- [ ] **Step 2: Executar teste para verificar falha inicial**

Comando: `node shared/test/i18n.js`
Esperado: FAIL com `Cannot find module '../i18n.js'`

- [ ] **Step 3: Implementar catálogos e motor core `shared/i18n.js`**

Criar `shared/locales/en.js`:
```javascript
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else {
    root.DuoDeskLocales = root.DuoDeskLocales || {};
    root.DuoDeskLocales['en'] = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  return {
    'app.name': 'DuoDesk',
    'app.not_paired': 'Not paired',
    'app.paired_with': 'Paired with {name}',
    'nav.overview': 'Overview',
    'nav.screens': 'Screens',
    'nav.cursor': 'Mouse & Keys',
    'nav.audio': 'Audio',
    'nav.files': 'Files',
    'nav.apps': 'Apps',
    'nav.phone': 'Phone',
    'nav.settings': 'General',
    'nav.about': 'About',
    'pair.title': 'Pairing',
    'pair.code_label': 'Code',
    'pair.match': 'Codes match',
    'pair.cancel': 'Cancel',
    'pair.hint_code': 'Type the code {code} on the other computer',
    'general.language': 'Language',
    'general.lang_auto': 'Automatic (System)',
    'general.lang_en': 'English',
    'general.lang_pt_br': 'Português (Brasil)'
  };
});
```

Criar `shared/locales/pt-BR.js`:
```javascript
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else {
    root.DuoDeskLocales = root.DuoDeskLocales || {};
    root.DuoDeskLocales['pt-BR'] = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  return {
    'app.name': 'DuoDesk',
    'app.not_paired': 'Não pareado',
    'app.paired_with': 'Pareado com {name}',
    'nav.overview': 'Visão Geral',
    'nav.screens': 'Telas',
    'nav.cursor': 'Mouse e Teclado',
    'nav.audio': 'Áudio',
    'nav.files': 'Arquivos',
    'nav.apps': 'Aplicativos',
    'nav.phone': 'Telefone',
    'nav.settings': 'Geral',
    'nav.about': 'Sobre',
    'pair.title': 'Pareamento',
    'pair.code_label': 'Código',
    'pair.match': 'Códigos coincidem',
    'pair.cancel': 'Cancelar',
    'pair.hint_code': 'Digite o código {code} no outro computador',
    'general.language': 'Idioma',
    'general.lang_auto': 'Automático (Sistema)',
    'general.lang_en': 'English',
    'general.lang_pt_br': 'Português (Brasil)'
  };
});
```

Criar `shared/i18n.js`:
```javascript
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

  function normalizeLang(lang) {
    if (!lang) return 'en';
    const lower = String(lang).toLowerCase();
    if (lower.startsWith('pt')) return 'pt-BR';
    if (lower.startsWith('en')) return 'en';
    return locales[lang] ? lang : 'en';
  }

  function t(key, params, defaultText) {
    const dict = locales[currentLang] || locales['en'] || {};
    const fallbackDict = locales['en'] || {};
    let text = dict[key] !== undefined ? dict[key] : (fallbackDict[key] !== undefined ? fallbackDict[key] : (defaultText !== undefined ? defaultText : key));
    if (params && typeof params === 'object') {
      text = String(text).replace(/\{(\w+)\}/g, (_, k) => (params[k] !== undefined && params[k] !== null ? params[k] : `{${k}}`));
    }
    return text;
  }

  function setLanguage(lang) {
    currentLang = normalizeLang(lang);
    listeners.forEach(fn => { try { fn(currentLang); } catch (e) { console.error(e); } });
    return currentLang;
  }

  function getLanguage() { return currentLang; }

  function getAvailableLanguages() {
    return [
      { code: 'en', label: 'English' },
      { code: 'pt-BR', label: 'Português (Brasil)' }
    ];
  }

  function onLanguageChange(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  }

  return { t, setLanguage, getLanguage, normalizeLang, getAvailableLanguages, onLanguageChange };
});
```

- [ ] **Step 4: Executar teste para verificar sucesso**

Comando: `node shared/test/i18n.js`
Esperado: `i18n: ok` com exit code 0.

- [ ] **Step 5: Commit**

```bash
git add shared/locales/ shared/i18n.js shared/test/i18n.js
git commit -m "feat(i18n): add zero-dependency i18n core engine and pt-BR locale"
```

---

### Task 2: Integração Desktop & Seletor de Idioma em Configurações

**Files:**
- Modify: `windows/app.html:52-56`
- Modify: `windows/ui-general.js`
- Modify: `shared/sidebar-model.js`
- Modify: `windows/main.js` (ou detecção via preload)
- Test: Carregar `windows/app.html` via Electron ou validação de script tags.

**Interfaces:**
- Consumes: `DuoDeskI18n.setLanguage`, `DuoDeskI18n.t`, `DuoDeskI18n.onLanguageChange`
- Produces: Seleção persistente em `store.set('general.language', value)` e re-render dos rótulos de navegação e status.

- [ ] **Step 1: Adicionar scripts de i18n em `windows/app.html`**

Inserir as tags de script antes dos demais módulos de interface:
```html
<script src="../shared/locales/en.js"></script>
<script src="../shared/locales/pt-BR.js"></script>
<script src="../shared/i18n.js"></script>
```

- [ ] **Step 2: Atualizar `shared/sidebar-model.js` para usar chaves de i18n dinâmicas**

Garantir que a renderização dos títulos dos menus passe por `t('nav.' + pageId)`.

- [ ] **Step 3: Adicionar campo seletor de idioma em `windows/ui-general.js`**

Implementar card "Idioma / Language" na tela Geral:
```javascript
const langRow = renderSelect({
  label: t('general.language'),
  value: store.get('general.language') || 'auto',
  options: [
    { value: 'auto', label: t('general.lang_auto') },
    { value: 'pt-BR', label: 'Português (Brasil)' },
    { value: 'en', label: 'English' }
  ],
  onChange: (val) => {
    store.set('general.language', val);
    const target = val === 'auto' ? navigator.language : val;
    DuoDeskI18n.setLanguage(target);
    location.reload();
  }
});
```

- [ ] **Step 4: Validar sintaxe e integridade dos arquivos modificados**

Comando: `node -c windows/ui-general.js shared/sidebar-model.js`
Esperado: Exit code 0 sem erros de sintaxe.

- [ ] **Step 5: Commit**

```bash
git add windows/app.html windows/ui-general.js shared/sidebar-model.js
git commit -m "feat(ui): integrate i18n into desktop shell and general settings"
```

---

### Task 3: Tradução Completa dos Dicionários e Sub-sistemas Desktop

**Files:**
- Modify: `shared/locales/en.js`
- Modify: `shared/locales/pt-BR.js`
- Modify: `windows/ui-overview.js`
- Modify: `windows/ui-cursor.js`
- Modify: `windows/ui-clipboard.js`
- Modify: `windows/ui-files.js`
- Modify: `shared/phonehub.js`

**Interfaces:**
- Consumes: `t()` em todas as mensagens de status, cards e ações do usuário.

- [ ] **Step 1: Expandir catálogo `shared/locales/pt-BR.js` e `en.js` com todos os termos dos módulos**

Mapear termos de:
- Pareamento e KVM (Bordas, ativação suave, troca de comando).
- Compartilhamento de arquivos (arrastar e soltar, downloads recebidos).
- Telefone (chamadas, mensagens, câmera remota, espelhamento).
- Áudio e tela secundária.

- [ ] **Step 2: Substituir strings hardcoded por chamadas `t()` nos componentes de tela**

Atualizar `ui-overview.js`, `ui-cursor.js`, `ui-clipboard.js`, `ui-files.js` e `phonehub.js` usando `t(key, params, defaultEnglish)`.

- [ ] **Step 3: Testar consistência dos catálogos**

Adicionar em `shared/test/i18n.js` verificação de paridade de chaves:
```javascript
const enKeys = Object.keys(require('../locales/en.js')());
const ptKeys = Object.keys(require('../locales/pt-BR.js')());
assert.deepStrictEqual(enKeys.sort(), ptKeys.sort(), 'Chaves en e pt-BR devem ser idênticas');
```

- [ ] **Step 4: Executar teste de paridade de chaves**

Comando: `node shared/test/i18n.js`
Esperado: `i18n: ok`

- [ ] **Step 5: Commit**

```bash
git add shared/locales/ windows/ui-*.js shared/phonehub.js shared/test/i18n.js
git commit -m "feat(i18n): expand full pt-BR translation across desktop components"
```

---

### Task 4: Tradução da Documentação (`README.pt-BR.md` e `docs/`)

**Files:**
- Create: `README.pt-BR.md`
- Modify: `README.md:1-20`
- Create: `docs/mesh.pt-BR.md`
- Create: `docs/screen-mesh.pt-BR.md`

- [ ] **Step 1: Criar o `README.pt-BR.md` completo e localizado**

Traduzir todas as seções:
- Apresentação: "Todos os seus computadores e seu telefone funcionando em uma única mesa."
- Recursos: Computadores, Telefones e tablets, Conexões, Primeiros passos.
- Instruções de compilação e execução para Windows, macOS, Linux, NixOS e Android.

- [ ] **Step 2: Adicionar banner de alternância de idioma no topo do `README.md` original**

Inserir no topo de `README.md`:
```markdown
<p align="center">
  🌐 <b>Idiomas / Languages:</b> <a href="README.md">English</a> · <a href="README.pt-BR.md">Português (Brasil)</a>
</p>
```

- [ ] **Step 3: Traduzir guias de arquitetura em `docs/*.pt-BR.md`**

Traduzir `docs/mesh.md` e `docs/screen-mesh.md` mantendo precisão técnica e formatação.

- [ ] **Step 4: Validar links e referências entre os arquivos Markdown**

Verificar existência de links relativos e integridade de imagens.

- [ ] **Step 5: Commit**

```bash
git add README.pt-BR.md README.md docs/*.pt-BR.md
git commit -m "docs: add full Portuguese (Brazil) translation for README and docs"
```

---

### Task 5: Localização do Aplicativo Android (Kotlin / Jetpack Compose)

**Files:**
- Modify: `android/app/src/main/res/values/strings.xml`
- Create: `android/app/src/main/res/values-pt-rBR/strings.xml`
- Modify: `android/app/src/main/java/com/twindesk/android/MainActivity.kt`

- [ ] **Step 1: Definir recursos em `values/strings.xml` e `values-pt-rBR/strings.xml`**

Criar `values-pt-rBR/strings.xml` com traduções completas:
```xml
<?xml version="1.0" encoding="utf-8"?>
<resources>
    <string name="app_name">DuoDesk</string>
    <string name="sc_adb_short">Depuração sem fio</string>
    <string name="sc_adb_long">Ativar depuração sem fio</string>
    <string name="sc_screen_short">Tela do computador</string>
    <string name="sc_screen_long">Exibir a tela do computador</string>
    <string name="input_service">DuoDesk: mouse e teclado do computador</string>
    <string name="input_service_desc">Permite que o computador pareado no DuoDesk toque, role e digite neste celular com mouse e teclado quando a depuração sem fio não estiver disponível.</string>
</resources>
```

- [ ] **Step 2: Mapear textos do Jetpack Compose para recursos traduzíveis**

Ajustar `MainActivity.kt` para garantir que o app reflita automaticamente o idioma do sistema operacional do smartphone.

- [ ] **Step 3: Commit**

```bash
git add android/app/src/main/res/ android/app/src/main/java/
git commit -m "feat(android): add pt-BR string resources and localization"
```

---

### Task 6: Localização do Website (`website/`)

**Files:**
- Modify: `website/index.html`
- Create: `website/locales/pt-BR.json` (ou script de tradução dinâmica)
- Modify: `website/app.js`

- [ ] **Step 1: Adicionar suporte a pt-BR no website**

Configurar alternância de idioma no cabeçalho do site com armazenamento em `localStorage`.

- [ ] **Step 2: Commit**

```bash
git add website/
git commit -m "feat(website): add Portuguese (Brazil) support to DuoDesk website"
```
