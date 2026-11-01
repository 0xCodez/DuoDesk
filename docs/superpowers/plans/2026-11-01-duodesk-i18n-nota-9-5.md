# DuoDesk i18n pt-BR: plano para chegar a 9,5

Data: 2026-11-01. Parte da análise de hoje (nota 8,3) e do plano de publicação
`2026-10-31-duodesk-i18n-implantacao.md`. Este plano diz o que mudar, em que ordem, e como medir cada ganho.

## 1. Meta e como a nota é calculada

Média simples de quatro dimensões. Para 9,5 de média, nenhuma dimensão fica abaixo de 9,0.

| Dimensão | Hoje | Meta | O que falta |
|---|---|---|---|
| Qualidade do português | 8,5 | 9,5 | vocabulário padronizado, revisão de frases longas |
| Cobertura | 7,8 | 9,5 | mesh, janelas pequenas, processo principal, assistente |
| Robustez técnica | 9,0 | 9,5 | portões de CI, cobertura medida, verificação em app rodando |
| Site, README, docs | 9,5 | 9,5 | manter |

Cobertura 9,5 significa: menos de 1% de literais em inglês nas superfícies que o usuário vê, fora das exceções
documentadas (marcas, unidades, texto que vem do telefone ou do outro computador).

## 2. Fase 1: medir (meio dia)

Sem medição, a nota é opinião. Antes de traduzir mais, transformar os scripts soltos em portões do repositório.

1. `shared/test/i18n-coverage.js`: varre os arquivos de interface e do processo principal e conta literais de
   interface em inglês fora de `t()`. Gera `docs/i18n-coverage.md` (tabela por superfície).
   Lista de exceções em `shared/test/i18n-allow.json` (marcas, unidades, campos de definição de aba).
   Falha se a contagem passar do limite gravado. O limite desce a cada fase (nunca sobe).
2. `shared/test/i18n-defaults.js`: todo `t('chave', p, 'inglês')` literal tem o mesmo texto de `en.js`.
3. `shared/test/i18n-orphans.js`: nenhuma chave sem uso (exceto `nav.*`, `tab.*`, `tray.*` montadas em tempo de execução).
4. `shared/test/i18n-params.js`: cada `{x}` do dicionário recebe `x` no ponto de chamada (exceto os tokens do
   `UI.fill`: `me`, `name`, `Name`, `the`, `There`, `them`).
5. `shared/test/i18n-glossary.js`: lê `docs/i18n-glossary.md` (seção 3) e falha se o `pt-BR.js` usar um termo
   proibido (ex.: "emparelh", "app " fora de nomes próprios, "ligar/desligar" para estados).
6. Ligar tudo no CI (`npm test` ou o job existente) e exigir verde antes de merge.

Saída da fase: linha de base numérica por superfície e CI que impede regressão.

## 3. Fase 2: vocabulário e qualidade (1 dia)

Criar `docs/i18n-glossary.md` e aplicar com busca e substituição guiada, revisando cada ocorrência:

| Conceito | Termo padrão | Evitar |
|---|---|---|
| pair / pairing | parear, pareamento, pareado | emparelhar, emparelhamento |
| app | aplicativo (curto: app só em rótulos de espaço apertado, decidir e documentar) | app / apps misturado |
| on / off (estado) | ativado / desativado | ligado / desligado (exceto Bluetooth e Wi-Fi como interruptor físico: decidir) |
| phone | telefone | celular, smartphone |
| clipboard | área de transferência | clipboard |
| debugging | depuração | debug |
| hotspot | ponto de acesso | hotspot |

Regras de revisão:
- Tratamento por "você" em todo texto; sem "tu".
- Sentence case nos textos corridos; Title Case só onde o inglês também usa (títulos de aba).
- Mesmo texto em inglês, mesma tradução (já garantido pelo mesclador; checar as 82 divergências antigas).
- Gênero e concordância com `{phone}`, `{name}`, `{me}`: reescrever frases que dependem do gênero do nome
  (ex.: "{phone} pode ser encontrado") para forma neutra ("É possível encontrar {phone} enquanto...").
- Revisão por falante nativo de 100% dos textos longos (mais de 60 caracteres, ~450 chaves) e de uma amostra de
  20% dos curtos. Registrar as correções no próprio PR.

Saída da fase: qualidade 9,5; `i18n-glossary.js` verde.

## 4. Fase 3: cobertura (3 a 5 dias, lotes paralelos)

Método já provado: lotes sem arquivos em comum, cada um grava um fragmento JSON de chaves novas, um único
passo de mescla grava os dicionários, a validação roda no fim. Regras do lote: inglês idêntico ao original;
tokens do `UI.fill` ficam no texto; sem concatenar fragmentos; plural em `_one`/`_other`; não traduzir logs,
texto comparado no código, mensagens para o outro dispositivo, marcas.

Ordem por ganho de nota e risco:

1. **Mesh** (maior lacuna: ~231 literais). `windows/mesh/ui-{cursor,multi,overview,phone,share}.js`,
   `linux/mesh/ui-{cursor,multi,overview,phone}.js`, `mac/mesh/ui-{cursor,display,multi,overview}.js` e o que
   restar em `mesh/app.js`/`ui-start.js` (estados do pareamento, "Phase N"). Reaproveitar as chaves das páginas
   não-mesh quando o inglês for igual.
2. **Janelas pequenas** (~66 literais): HUD, monitor, appview, phoneview, sender, sound, appsend, audio,
   capture, pcview. HTML com `data-i18n*` e `shared/i18n-dom.js`; renderers com `t()`.
3. **Processo principal** (~53 literais): `callaudio.js`, `apps.js`, `phone-bridge.js`, `smb.js`, `sshd.js`,
   `vdd.js`, `firewall.js`, `kvm.js` e os equivalentes de Linux e macOS. Antes de embrulhar, procurar o texto no
   código e nos testes: se for comparado ou casado por regex, não mexer.
4. **Assistente do `aurora-shell.js`** (~41 literais de `shared/ui-*`): exemplos e respostas. Decidir se os
   comandos de voz/texto aceitos também ganham versão em português (se não, documentar que o assistente
   entende só inglês e traduzir apenas a interface).
5. **Android**: `Clip.kt` e `Input.kt` (textos que sobraram); revisar plurais e os 3 `Text("...")` restantes.
6. **Estados de erro do backend**: mensagens montadas nos módulos que viram `state.message`; traduzir na origem
   (o idioma já está definido no processo principal).

Meta por lote: o contador de `i18n-coverage` cai ao nível da meta (≤1%); atualizar o limite gravado no teste.

## 5. Fase 4: verificação em app rodando (2 dias, precisa das máquinas)

Nada disso foi feito até hoje.

1. **Android**: instalar JDK 17+ e Android SDK; `./gradlew :app:assembleDebug`; corrigir o que o compilador
   acusar; testar em emulador/aparelho em Português (Brasil) e English.
2. **Desktop**: rodar o app em Windows, macOS e Linux (X11 e Wayland) com `lang` = `auto`, `en`, `pt-BR`.
   Checklist por plataforma:
   - cada aba abre sem erro no console; trocar o idioma recarrega e muda nav, cabeçalhos, descrições e bandeja;
   - pareamento completo (outro computador e telefone): banner, códigos, estados;
   - modo Multi-device (mesh) e as janelas pequenas;
   - sem texto cortado ou sobreposto em 1366×768, 1440×900 e 375×812;
   - inglês idêntico ao de `origin/main` (comparar capturas de 3 páginas por plataforma).
3. **Captura automatizada**: com Playwright (já usado para Electron), um teste de fumaça que abre cada aba em
   `pt-BR` e falha se achar texto da lista de "palavras inglesas" (the, and, with, click, open...) fora das
   exceções. Roda no CI quando houver runner gráfico.
4. **Site**: `node website/dev-server.js`; EN e PT, `/404`, recarga com PT salvo (sem flash), CSP sem erro.

## 6. Critérios de aceite para 9,5

- Os cinco testes novos passam no CI; `applog`, `kvm-moves`, `movebench` continuam fora (já falham em `origin/main`).
- `docs/i18n-coverage.md` mostra ≤1% de literais em inglês em todas as superfícies, com a lista de exceções.
- `i18n-glossary.js` verde; nenhuma ocorrência de "emparelh", "celular", "tu/teu".
- 100% dos textos longos revisados por falante nativo, com registro das correções.
- Android compila e foi percorrido em pt-BR; desktop percorrido nas 3 plataformas com o checklist acima.
- Nenhuma regressão no inglês (portão de padrão em inglês + comparação de capturas).

## 7. Cronograma e dependências

| Etapa | Dias | Depende de |
|---|---|---|
| Fase 1: portões | 0,5 | nada |
| Fase 2: vocabulário e revisão | 1 | Fase 1 (glossário no CI) |
| Fase 3: lotes 1 a 3 | 2 a 3 | Fase 1 (limite de cobertura) |
| Fase 3: lotes 4 a 6 | 1 a 2 | lotes 1 a 3 |
| Fase 4: verificação em app | 2 | JDK/SDK e uma máquina de cada sistema |
| Merge e publicação | conforme o plano de 31/10 | fases 1 a 4 |

As fases 2 e 3 podem andar em paralelo. A Fase 4 é o gargalo: sem ela a nota de robustez não passa de 9,0,
porque o que foi medido até agora é código, não o app em uso.

## 8. Riscos

| Risco | Mitigação |
|---|---|
| Embrulhar texto que o código compara e quebrar lógica | procurar o texto no código e nos testes antes; testes de `shared/test` no fim de cada lote |
| Conflito de chaves entre plataformas | mesclador cria variantes `_linux`/`_mac`; o portão de padrão em inglês acusa divergência |
| Texto fixado na carga do módulo (idioma ainda não definido) | traduzir no uso/renderização; o teste de fumaça pega |
| Limite de cobertura virar burocracia | limite só desce; exceções em arquivo versionado e revisado no PR |
| Revisão nativa atrasar | começar a revisão da Fase 2 enquanto a Fase 3 corre; revisar só o delta nas rodadas seguintes |
