# DuoDesk i18n pt-BR: plano de implantação

Data: 2026-10-31. Complementa `2026-10-31-duodesk-i18n-pt-br.md` (arquitetura). Este plano cobre o que falta
para publicar o pt-BR e como colocá-lo no ar sem regressão no inglês.

## 1. Estado atual

Commits locais à frente de `origin/main`: 12 (motor, dicionários, desktop, Android, site, docs, correções).
Nada foi enviado ao remoto.

Pronto:
- Motor `shared/i18n.js`, dicionários `en`/`pt-BR` (~1.190 chaves, paridade de `{param}` testada).
- Desktop (Windows, Linux, macOS): navegação, cabeçalhos e descrições das abas, todas as páginas principais,
  bandeja/barra de menus, seletor de idioma em Geral, persistência em `settings.app.lang`.
- Shells mesh: carregam o i18n e traduzem a navegação e os cabeçalhos.
- Android: ~550 strings em `values` e `values-pt-rBR`, 5 plurais.
- Site: troca EN/PT, `404.js` e `lang-boot.js` compatíveis com a CSP.
- README e docs em pt-BR.

Pendente (desktop, em inglês):
1. `mesh/ui-*.js` (Windows 5 arquivos, Linux 4, macOS 5).
2. `shared/ui-*.js`, `pairpop.js`, `aurora-shell.js` (hub, chamadas, mensagens, mídia, arquivos do telefone,
   dispositivo, espelho, câmera, suporte, janela de atualização, QR/ADB).
3. Janelas pequenas: HUD, appview, phoneview, sender, sound, monitor, appsend, audio, capture, pcview
   (usar `shared/i18n-dom.js`, já criado).
4. Processo principal: notificações, diálogos, HUD, mensagens de erro/status em `windows/*.js`, `linux/*.js`,
   `mac/*.js` e `shared/*.js` de Node.
5. Android: `Hub.label`, `Files.plural`, `FolderShare.shown()`, rótulos do `AndroidManifest.xml`.

## 2. Fase A: concluir o desktop

Método (o mesmo que funcionou na rodada anterior):
- Um lote por grupo de arquivos, sem arquivos em comum entre lotes. Cada lote envolve o texto em
  `t(chave, params, inglês_exato)` e grava só as chaves novas em um fragmento JSON; ninguém edita
  `shared/locales/*.js` durante o lote.
- Convenção de chave: `<página>.<slug>`; prefixos `mesh_`, `meshm_`, `win_`, `lin_`, `mac_`, `sh_` por grupo.
- Regras: inglês idêntico ao original; `{me}`, `{name}`, `{Name}`, `{the}`, `{There}` ficam no texto
  (o `UI.fill` os preenche); sem concatenação de fragmentos; plural em `_one`/`_other`; não traduzir logs,
  texto comparado no código, mensagens enviadas ao outro dispositivo, nomes de marca.
- Ordem sugerida (menor risco primeiro): janelas pequenas, `shared/ui-*`, mesh, processo principal.
  O processo principal é o mais arriscado: grep do texto antes de embrulhar, para não quebrar comparações.

Mesclar fragmentos (script de mescla):
- Chave igual com inglês diferente entre plataformas vira variante `_linux`/`_mac` e o código dessa
  plataforma é renomeado.
- Chave igual com pt diferente: prevalece a do Windows; revisar a lista de divergências.
- Regravar os dicionários, rodar a validação (seção 4).

Critério de pronto da fase: nenhum literal de interface em inglês fora das exceções documentadas
(marcas, unidades, texto vindo do telefone ou do outro computador).

## 3. Fase B: Android

1. Instalar JDK 17+ e o Android SDK (a máquina atual não tem); `cd android && ./gradlew :app:assembleDebug`.
2. Corrigir o que o compilador acusar (principal risco: `stringResource` fora de contexto composable,
   `pluralStringResource` sem opt-in).
3. Traduzir `Hub.label`, `Files.plural`, `FolderShare.shown()` e os rótulos do manifest
   (`strings.xml` com `@string/...`).
4. Teste em aparelho/emulador com idioma do sistema em Português (Brasil) e em English: percorrer
   Visão Geral, Conexão, Chamadas, Mensagens, Arquivos, Mouse, Ajustes, diálogos de pareamento,
   notificações; procurar texto cortado e quebras de linha.

## 4. Verificação (portões antes de qualquer merge)

Automáticos (todos devem passar; `applog`, `kvm-moves`, `movebench` já falham em `origin/main`):
```bash
for t in shared/test/*.js; do node "$t" >/dev/null 2>&1 || echo "FAIL $t"; done
node shared/test/i18n.js        # paridade, chaves usadas existem
node shared/test/packaging.js   # locales e i18n entram nos instaladores
```
Acrescentar ao repositório (hoje só existem como scripts soltos):
- Verificação de padrão em inglês: todo `t('chave', p, 'inglês')` literal deve igualar o valor em `en.js`
  (pegou a regressão de `sidebar.nearby` e da navegação).
- Verificação de chaves órfãs.
- Verificação de parâmetros: toda chave com `{x}` recebe `x` no ponto de chamada (exceto os tokens do `UI.fill`).

Manual, por plataforma (Windows, macOS, Linux X11/Wayland), com `lang` em `auto`, `en` e `pt-BR`:
- Trocar o idioma em Geral: recarrega, nav, cabeçalhos, descrições e bandeja mudam.
- Cada aba abre sem erro no console; conferir texto cortado em 1366×768, 1440×900 e 375×812 (mesh/janela estreita).
- Pareamento completo com outro computador e com o telefone: banner, códigos, estados.
- Bandeja: conectado e desconectado, "Conectar a", "Procurar novamente".
- Migração: perfil que tinha o idioma só no `localStorage` passa a ter `settings.app.lang`.
- Inglês idêntico ao de `origin/main` (comparar capturas de 3 páginas por plataforma).

Site: `node website/dev-server.js`; EN e PT, `/404`, recarga com PT salvo (sem flash), CSP sem erro no console
(sem script inline).

## 5. Fase C: integração e publicação

1. Rebase/merge de `main` na branch de trabalho; resolver conflitos (as páginas `ui-*.js` mudam muito).
2. Abrir PR por área para facilitar a revisão: (a) motor + dicionários + testes; (b) desktop; (c) Android;
   (d) site + docs. Cada PR passa pelos portões da seção 4.
3. Antes do `push`: confirmar com o dono do repositório (o remoto é `0xCodez/DuoDesk`; se não houver
   permissão de push, enviar para um fork e abrir PR do fork).
4. Versão: subir a versão do app (changelog: "Português (Brasil)"), atualizar o `README.md` e `README.pt-BR.md`
   (número da versão, links de download) e as notas da release.
5. CI/instaladores: gerar `.exe`, `.dmg`, `.deb`/AppImage, Nix e APK; instalar cada artefato em máquina limpa e
   confirmar que `shared/locales/` existe no pacote e o idioma troca.
6. Site: deploy na Vercel (preview primeiro); conferir `vercel.json` (CSP com `404.js` e `lang-boot.js`).
7. Anúncio: release no GitHub com as notas em EN e PT.

## 6. Riscos e reversão

| Risco | Mitigação |
|---|---|
| Regressão no inglês (texto padrão diferente do dicionário) | portão de padrão em inglês na seção 4 |
| Texto comparado no código quebra ao traduzir (processo principal) | grep antes de embrulhar; testes de `shared/test` |
| Idioma só definido depois do carregamento (constantes no topo do módulo) | traduzir no uso/renderização, nunca na carga |
| Janela que não carrega `i18n.js` mostra chave | padrão em inglês no `t()` local cobre; checar no manual |
| Android não compila | Fase B antes de qualquer PR do Android |
| Instalador sem `locales/` | `packaging.js` + instalação em máquina limpa |

Reversão: cada área vai em PR próprio e o idioma cai para inglês sozinho se o dicionário `pt-BR` falhar
(`t()` usa `en`). Para desligar o pt-BR sem reverter código: remover a opção `pt-BR` do seletor em Geral
e do `getAvailableLanguages`, e forçar `en` em `applyLanguage`.

## 7. Ordem e estimativa

1. Fase A, janelas pequenas e `shared/ui-*` (lotes paralelos), mescla, validação.
2. Fase A, mesh e processo principal, mescla, validação.
3. Fase B (depende de JDK/SDK).
4. Verificação manual nas 3 plataformas + site.
5. PRs e publicação (Fase C).

As fases A e B são independentes e podem andar em paralelo. A verificação manual é o gargalo:
precisa de uma máquina de cada sistema.
