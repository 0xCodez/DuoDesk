<p align="center">
  🌐 <b>Idiomas / Languages:</b> <a href="screen-mesh.md">English</a> · <a href="screen-mesh.pt-BR.md">Português (Brasil)</a>
</p>

# Compartilhamento de tela na malha (screen mesh)

Status: especificação de design, fatias (*slices*) (a) a (e). Construído sobre [docs/mesh.pt-BR.md](mesh.pt-BR.md) (dispositivo selecionado, recursos em pool, layout compartilhado em `shared/layout.js`). A versão 1 do protocolo permanece; todas as adições aqui são aditivas.

## O problema

O compartilhamento de tela atualmente é ponto a ponto (um-para-um) e acompanha o dispositivo selecionado: a página Compartilhar tela transmite um monitor deste computador para um único peer, e um PC com Windows ou Mac estende sua área de trabalho através do único monitor virtual disponível (`windows/vdd.js`). Com múltiplos dispositivos conectados simultaneamente, cada um pode demandar uma visualização diferente: o Mac recebe o monitor 2, o telefone recebe um novo monitor virtual, um tablet não recebe nada.

## Objetivos

1. **Definição de qual tela vai para qual dispositivo.** Para cada dispositivo de destino conectado, a página oferece uma escolha: nada, um monitor real deste computador (exibido como espelhamento daquele monitor), um novo monitor virtual (área de trabalho estendida) ou o espelhamento de todo o conjunto. Múltiplos alvos simultâneos, cada um com sua própria conexão WebRTC. Sem estado global único de compartilhamento de tela.
2. **Modelo de monitores (Display model).** Cada dispositivo informa seus monitores: `{ id, name, x, y, w, h, scale, primary }` em seus próprios pixels físicos, com posições relativas ao canto superior esquerdo do monitor principal (portanto valores negativos de x e y são normais). A página desenha-os como caixas posicionadas conforme a organização do sistema operacional (semelhante às configurações de exibição do Windows). Um monitor virtual é alocado à esquerda, à direita, acima ou abaixo de uma caixa existente, alinhado a uma borda, e nunca se sobrepõe a outra caixa.
3. **Compatibilidade.** Dispositivos que desconhecem essa funcionalidade mantêm o comportamento ponto a ponto tradicional. Novas mensagens utilizam novos tipos; novos campos são opcionais. Mac e Windows mantêm compatibilidade total com peers legados.

## Modelo (shared/screen-mesh.js, código puro, com testes)

- **Display**: `{ id: string, name: string, x, y, w, h, scale, primary }`. Inteiros para `x, y, w, h` dentro de ±32768 (um PC com 3 monitores sendo um em x = -1920 é válido), `w, h` ≥ 16, no máximo 8 monitores por dispositivo. `scale` é um número no intervalo (0, 4]. Entradas não confiáveis são normalizadas, e registros inválidos são descartados.
- **Arranjo (Arrangement)**: `arrange(displays, box)` mapeia a caixa delimitadora unificada (*bounding box*) em uma visualização de dimensões `box` em pixels (escala uniforme, origem nas coordenadas mínimas de x e y). Retorna um retângulo por monitor para renderização na página.
- **Posicionamento de um novo monitor virtual**: `place(displays, anchorId, side, size)` retorna `{ x, y, w, h }` para o novo monitor no lado `side` (left | right | top | bottom) da âncora, alinhado à borda próxima da âncora (borda superior para left/right, borda esquerda para top/bottom), exatamente como o sistema operacional faz por padrão. Retorna `null` caso o espaço coincida com um monitor existente (exibindo o erro correspondente na interface). A função `nudge` desloca o monitor ao longo da borda por um deslocamento (*offset*) e é validada da mesma forma.
- **Tabela de fluxos (Stream table)** (por destino): `{ [deviceId]: { mode, displayId?, size? } }`, onde `mode` é um dentre `none`, `mirror` (monitor físico real, `displayId` obrigatório), `virtual` (novo monitor, `size` = [w, h], no momento limitado a `VIRTUAL_LIMIT` = 1 por computador: um adaptador de monitor virtual) e `all` (espelhamento de todo o arranjo, sem `displayId`). `setChoice(table, deviceId, choice, knownIds)` valida a escolha em relação aos monitores reportados pelo computador e ao conjunto de dispositivos conectados. `streams(table, knownIds)` retorna os fluxos ativos em ordem determinística, removendo destinos que não estejam mais conectados. Um dispositivo de destino sem fluxo ativo não é contatado.
- Qual dispositivo é dono de qual monitor no lado *receptor* não é decidido aqui: o receptor exibe o fluxo em sua própria janela por dispositivo de origem (o visualizador existente), indexado pelo ID do dispositivo transmissor.

## Extensões do protocolo de comunicação (opcionais, aditivas)

- `hello`/`welcome` podem conter `displays: [ ... ]` (modelo de monitores deste dispositivo, na mesma estrutura descrita acima, no máximo 8). Um peer que não envie esse campo é considerado legado: sem modelo de monitores, podendo atuar apenas como destino de espelhamento do monitor padrão (comportamento atual).
- `screen.want { mode, displayId?, size? }` do visualizador para o transmissor, por conexão: a escolha do visualizador para aquele link. Transmissores legados ignoram tipos de mensagens desconhecidos.
- `screen.stream` / `screen.stop` como atualmente, uma sessão WebRTC por link, indexada pelo par de dispositivos.
- Mudanças de monitores são notificadas via `displays {displays}` sempre que ocorrerem (conectar, desconectar, rotação).

## Fatias de desenvolvimento (Slices)

- (a) Este documento.
- (b) `shared/screen-mesh.js` + `shared/test/screen-mesh.js`: normalização de monitores, arranjo, posicionamento, verificação de sobreposição e tabela de fluxos. Cobre este PC com três monitores (primário 2560×1440 em 0,0 e dois monitores em x = -1920).
- (c) Windows: o processo principal constrói o modelo de monitores a partir de `screen.getAllDisplays()`, executa uma captura por fluxo ativo (espelho de um monitor ou monitor virtual), e `ui-share.js` exibe o arranjo e a seleção individual por destino. Testes: `windows/test/screen-mesh.test.js` com fakes.
- (d) Mac: `mac/displays.js` reporta o mesmo modelo e `mac/stream.js` atende a `screen.want`.
- (e) Android: apenas lado receptor (exibe o fluxo por dispositivo de origem); dispensa modelo de monitores.

## Fora do escopo desta alteração

Mais de um monitor virtual por computador (exige um adaptador por monitor), uso do telefone como monitor, edição do arranjo a partir do telefone e arrastar para reposicionar a posição física real de um monitor existente (o sistema operacional controla os monitores físicos; apenas os virtuais são posicionados pelo DuoDesk).
