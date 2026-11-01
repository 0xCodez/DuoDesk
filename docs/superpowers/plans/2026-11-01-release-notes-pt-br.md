# Notas da release: Português (Brasil) — rascunho

Rascunho para a release que trouxer o pt-BR. A versão e a data ficam para quem publicar
(o `package.json` do desktop está em 2.5.0; nada foi alterado nas versões).

## English

**DuoDesk now speaks Brazilian Portuguese.**

- Desktop (Windows, macOS, Linux): every page, the tray / menu bar, pairing, notifications and the small
  windows follow the language. Pick it in **General › Language**: Automatic (system), Português (Brasil) or English.
- Android: the whole app is available in Portuguese (it follows the system language).
- Website and README: Portuguese versions (`README.pt-BR.md`, `docs/*.pt-BR.md`, EN / PT switch on the site).
- Fixes found along the way: the Camera, Messages, Calls, Media, Files and Support tabs could fail to load
  on some pages because several scripts declared the same top-level name.

Known limits: the assistant bar only understands English commands; messages sent to the other computer
or phone are shown in the sender's language.

## Português (Brasil)

**O DuoDesk agora fala português do Brasil.**

- Desktop (Windows, macOS, Linux): todas as páginas, a bandeja / barra de menus, o pareamento, as notificações e as
  janelas pequenas seguem o idioma. Escolha em **Geral › Idioma**: Automático (sistema), Português (Brasil) ou English.
- Android: o app inteiro está disponível em português (segue o idioma do sistema).
- Site e README: versões em português (`README.pt-BR.md`, `docs/*.pt-BR.md`, alternância EN / PT no site).
- Correções feitas no caminho: as abas Câmera, Mensagens, Chamadas, Mídia, Arquivos e Suporte podiam não carregar em
  algumas páginas, porque vários scripts declaravam o mesmo nome no topo do arquivo.

Limites conhecidos: a barra do assistente só entende comandos em inglês; as mensagens enviadas ao outro computador
ou ao telefone aparecem no idioma de quem envia.

## Antes de publicar

- [ ] Compilar e testar o Android em pt-BR e em inglês.
- [ ] Rodar o desktop nas 3 plataformas (`auto`, `en`, `pt-BR`) com o checklist do plano de 01/11.
- [ ] Definir a versão, atualizar os links de download do `README.md` e do `README.pt-BR.md`.
- [ ] Gerar os instaladores e conferir que `shared/locales/` e `shared/i18n-dom.js` estão no pacote.
- [ ] Deploy do site na Vercel (preview primeiro).
