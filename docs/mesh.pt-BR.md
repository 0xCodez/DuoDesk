<p align="center">
  🌐 <b>Idiomas / Languages:</b> <a href="mesh.md">English</a> · <a href="mesh.pt-BR.md">Português (Brasil)</a>
</p>

# Mesh: muitos dispositivos conectados ao mesmo tempo

Status: especificação de design para a funcionalidade mesh (consulte a pull request que a adiciona). Desenvolvido para ser implementado em fatias (*slices*), cada uma acompanhada de testes, sem alterar o funcionamento atual de configurações entre dois dispositivos.

No DuoDesk, a topologia em malha (mesh) só é executada com a opção Multidispositivo ativada, funcionando em paralelo ao código ponto a ponto (um-para-um) e não em substituição a ele: veja [multi-device.md](multi-device.md). Os arquivos do Windows citados abaixo (`hub.js`, `server.js`, `kvm.js`, …) referem-se aos localizados em `windows/mesh/`.

## Objetivos

- Conectar um dispositivo a vários outros simultaneamente (até `MAX_DEVICES` = 10).
- Controlar todos os dispositivos com um único mouse e teclado: cada borda da tela pode levar a um dispositivo diferente (topo: um Mac, parte inferior: um telefone). Cruzar a borda transfere a entrada de dados para o dispositivo situado naquela direção.
- Área de transferência unificada (pool de clipboard): copiar em qualquer dispositivo disponibiliza o conteúdo para colagem em todos os outros.
- Grupo unificado de notificações: uma notificação disparada em qualquer dispositivo é exibida em todos os demais.
- Arquivos, terminal, aplicativos, compartilhamento de tela e demais recursos ponto a ponto seguem o dispositivo selecionado pelo usuário ("dispositivo selecionado" / *selected device*): clique no telefone para ver os arquivos dele; clique no Mac para ver os arquivos do Mac.
- Conexões diretas, sem servidor intermediário e sem carga adicional: cada par de dispositivos capaz de se comunicar mantém uma única conexão direta.
- Nada do que funciona atualmente entre dois dispositivos pode quebrar: a versão 1 do protocolo é preservada; um dispositivo sem suporte a mesh comporta-se simplesmente como um peer ponto a ponto comum.

## Topologia e transporte

- Uma conexão WSS por par de dispositivos (utilizando a infraestrutura TLS existente, fingerprint certificado fixado (*pinned fingerprint*) e emparelhamento por código de 6 dígitos). Sem servidores de relay. Mídia (tela, áudio) trafega via WebRTC diretamente entre os dois dispositivos participantes.
- Quem disca (*dials*): o telefone sempre disca (ele não pode escutar conexões de entrada). Entre dois computadores, aquele a partir do qual o emparelhamento foi iniciado ("visitante" / *guest*) disca. Se ambos guardam o outro como visitante, aquele com o menor ID de dispositivo disca e o outro aguarda a conexão de entrada (por no máximo `INBOUND_WAIT_MS`) antes de discar por conta própria.
- O dispositivo escuta na porta `PORT` para receber qualquer visitante e disca para todos os hosts com os quais foi emparelhado. Não existe mais a regra de "uma sessão por vez": o telefone não desconecta mais computadores e os computadores não recusam conexões com status `busy` por já manterem outro link ativo.
- Custos de keep-alive escalam proporcionalmente à quantidade de conexões, portanto a política depende do uso:
  um link ativo transmitindo ou recebendo controle (ou o dispositivo selecionado) envia pings a cada `PING_MS` (1 s) em ambas as pontas (permitindo exibir a latência de ida e volta em ambos os lados) e atinge timeout após `TIMEOUT_MS` (4 s), como atualmente; qualquer outro link ocioso envia ping a cada `IDLE_PING_MS` (5 s) e atinge timeout após `IDLE_TIMEOUT_MS` (15 s). Qualquer mensagem recebida conta como sinal de atividade; o ping só é enviado se nada tiver sido transmitido no intervalo estipulado.

## Camadas

1. **Camada de conexão (Link layer)** (por plataforma): um servidor que aceita múltiplos clientes, um gerenciador de links de visitantes (um objeto `Link` por host emparelhado) e um objeto de *sessão* (*session*) por dispositivo remoto, abstraindo se o dispositivo nos chamou ou se nós o chamamos. As mensagens identificam a sessão (ID do dispositivo) de onde se originaram.
2. **Núcleo do Mesh (Mesh core)** (`shared/mesh.js`, JavaScript puro, mesmo código em todas as plataformas que executam JS): registro de peers (*registry*), o gerenciador de mensagens em grupo (`Pool`: fan-out, desduplicação e retransmissão/relay) e a lista de presença (`Roster`: quem está conectado a quem).
3. **Recursos (Features)**
   - *Compartilhados em pool* (área de transferência, notificações) comunicam-se diretamente com o mesh: recebem de qualquer dispositivo e propagam para todos.
   - *Recursos direcionados* (tela, navegador de arquivos, terminal, aplicativos, áudio, wake, SMB, …) mantêm a lógica ponto a ponto existente. Eles comunicam-se com o **dispositivo selecionado** através de uma fachada que replica fielmente a API do objeto `Peer`/`link` atual. A seleção de outro dispositivo redireciona a fachada: os manipuladores recebem `closed` e, em seguida, `welcome` para o novo dispositivo, iniciando o recurso em estado limpo.
   - *Cursor e teclado* (`kvm`): `edges` mapeia cada lado desta tela a um ID de dispositivo. O dispositivo cujos periféricos físicos (mouse e teclado) estão sendo operados atua como o centro de uma estrela; cruzar a borda seleciona e transfere o controle para o dispositivo correspondente. O retorno (borda oposta ou atalho) traz o foco de volta ao centro.

Regra de nomenclatura (um bug da primeira iteração decorreu do reúso do mesmo identificador para finalidades distintas): `selectedId` é uma string; `selected` é o objeto de sessão; nunca confunda ambos.

## Extensões do protocolo de comunicação (todas opcionais, ignoradas por versões antigas)

- `hello` e `welcome` podem carregar o campo `mesh: 1`. Um peer que não envie o campo `mesh` é tratado como um peer ponto a ponto legado: não recebe o roster e itens do pool (tanto do vizinho quanto retransmitidos) chegam até ele como mensagens comuns, sem os metadados abaixo.
- `mesh.roster {peers: [deviceId, …]}`: transmitido após `welcome` e sempre que o conjunto de conexões diretas sofrer alteração. Os nós receptores atualizam seu `Roster`.
- Mensagens distribuídas em pool (`clip`, `notif`) recebem três campos opcionais definidos pelo dispositivo de origem: `o` (ID do dispositivo de origem), `s` (número de sequência na origem, incremental por origem e pool, computado a partir do início da execução em ms, garantindo numeração posterior à execução anterior em caso de reinício) e `d` (as conexões diretas da origem naquele instante, array de IDs). Uma mensagem de pool sem o campo `o` provém de um peer legado: ela é aplicada e republicada no pool assumindo o remetente como sua origem.

## Regras do Pool (`Pool` em `shared/mesh.js`)

- `publish(msg)` atribui os campos `o`, `s`, `d` e envia para todos os peers conectados com suporte a pool.
- `receive(fromId, msg)`:
  - descarta se `o` for este próprio dispositivo (eco próprio) ou se o par `(o, s)` já tiver sido processado (janela delimitada por origem);
  - caso contrário, a mensagem é inédita: o recurso correspondente a processa;
  - retransmissão (*relay*): repassa a mensagem intacta para todos os peers com suporte a pool conectados que não sejam `fromId`, não sejam `o` e não constem em `d` (pois estes já a receberam diretamente da origem). Em uma malha completa (*full mesh*), nenhuma mensagem é retransmitida; quando faltar um link direto, o item ainda assim chega ao destino, exatamente uma vez.
  - um contador de saltos `h` (0 na origem, +1 a cada retransmissão, interrompido ao atingir `POOL_MAX_HOPS` = 9, suficiente para uma cadeia de dez dispositivos) previne loops infinitos.
- Um peer que desativou o pool (`pool:false` no registro) nunca recebe itens e itens enviados por ele são ignorados. Um dispositivo que desativou o pool para si mesmo não invoca a camada de pool, de modo que nem processa nem retransmite mensagens. Falhas de envio em conexões diretas não são retentadas: assume-se que o link caiu e o dispositivo receberá as próximas mensagens após reconectar.
- O processamento de um item não pode republicá-lo (prevenção de eco): o recurso memoriza o conteúdo recém-gravado na área de transferência do SO ou exibido em notificação por 30 s e ignora o evento subsequente do sistema operacional gerado por ele.
- Itens da área de transferência consistem em texto de até `CLIP_MAX_BYTES`. Um dispositivo pode desligar o pool localmente (`clip.policy`, `notif.policy`); ao fazê-lo, ele não processa dados do pool nem retransmite para outros.

## Regras de compatibilidade

- `PROTOCOL_VERSION` permanece 1. Novos campos e tipos de mensagens são aditivos.
- Com exatamente um dispositivo conectado, todos os recursos comportam-se como antes; configurações antigas são migradas automaticamente (`pairing.json` → `pairings.json`, em lista; `kvm.pcSide` → `kvm.edges`).
- O Linux continua operando como peer ponto a ponto até que receba suporte à sua própria porta; nós Linux ou Macs antigos na malha atuam como folhas receptoras de retransmissão (*leaf*).

## Layout compartilhado (um único mapa para toda a malha)

A disposição física dos dispositivos entre si é mantida em UM único mapa compartilhado por todos os nós e editável a partir de qualquer um deles, assegurando visualização idêntica em toda parte: com o Windows à esquerda, o Mac à direita dele e o telefone à direita do Mac, todas as telas exibem precisamente essa configuração. As regras residem em `shared/layout.js` (código puro, com testes).

- O layout é representado como `{ rev, by, cells: { deviceId: { x, y } } }`: uma célula em grade inteira por dispositivo. O destino de cada borda de tela corresponde ao dispositivo mais próximo na mesma linha (esquerda, direita) ou coluna (topo, base). Cada dispositivo calcula suas próprias bordas a partir do layout: `neighbors(view(layout, knownIds), selfId)`. `settings.kvm.edges` é migrado uma vez para o layout (`fromEdges`) e passa a ser derivado a partir de então.
- Sem espaços vazios entre dispositivos: eles formam um bloco coeso, tocando-se lado a lado. Cantos não permitem passagem (bordas levam apenas a faces laterais), logo um dispositivo só pode ocupar uma célula vazia adjacente a outro (`targets`, destacados no editor) ou trocar de lugar com um dispositivo existente. Elementos que se soltam quando um dispositivo é movido ou removido deslizam pelo trajeto mais curto até encostar no conjunto principal (`pack`; o dispositivo recém-posicionado permanece na posição definida). A função `view()` também aplica empacotamento (*pack*), garantindo que layouts salvos com lacunas (de versões anteriores ou com dispositivos desconectados) sejam exibidos e editados de forma contígua.
- Os IDs conhecidos incluem os dispositivos emparelhados e os conhecidos indiretamente por meio de um dispositivo conectado (`hub.peers()` somado aos indiretos, `Mesh.known()`: alcance de dois saltos), de modo que todos desenhem o mesmo mapa. Uma edição preserva as posições de dispositivos do layout armazenado que o nó editor desconhece (`keepUnknown`): um dispositivo a três saltos de distância não é removido por edições feitas onde ele não é conhecido.
- Somente edições feitas por usuários alteram o layout persistido (`place`, `remove`: rev + 1, `by` = nó editor). Dispositivos que surgem ou saem de alcance são processados dinamicamente por `view()`, calculada de maneira idêntica em todos os dispositivos com base no mesmo layout e nos mesmos IDs conhecidos, nunca persistida ou transmitida.
- Sincronização: o layout é um item distribuído pelo pool (em pool próprio, mensagem `{ t: 'layout', layout }`, com os carimbos usuais `o`/`s`/`d`/`h`). Um dispositivo só adota o item recebido quando ele for mais recente (`newer`: maior revisão `rev`, seguido por `by` e pela string canônica: mesmo critério de desempate em toda a rede). O nó onde a alteração ocorreu publica o layout; novos dispositivos que se conectam recebem o layout armazenado do par, assegurando convergência para conexões tardias. Edições concorrentes na mesma revisão: a mesma versão prevalece em todos os nós.
- Cadeias de navegação: o controlador primário é o dispositivo cujo mouse e teclado físicos estão sendo operados. Ele assume o controle do vizinho (`kvm.take`). Enquanto o dispositivo B é controlado, o ponteiro ao atingir uma borda que retorna ao controlador envia `kvm.home` como hoje; ao atingir uma borda direcionada a outro nó T, envia `kvm.next { route, to: T, side, offset }` ao controlador primário, que libera B (`kvm.release`) e assume T (`kvm.take` com `side: opposite(side)` e o mesmo deslocamento *offset*). Assim, Windows, Mac e telefone alinhados em uma linha são percorridos sequencialmente pelo teclado do Windows, e pelo teclado do Mac em ambas as direções. O monitoramento de retorno dos utilitários nativos cobre todas as bordas com vizinhos (`armReturn { sides }`, e o evento `return` carrega `side`). Telefones controlados via depuração sem fio encerram a cadeia: não possuem bordas além daquela por onde o cursor entrou.
- Bloqueio de cursor (`shared/cursorlock.js`): o ponteiro permanece fixo no dispositivo onde se encontra. Quando em repouso na máquina primária, nenhuma borda é monitorada; o controlador instrui o dispositivo sob seu controle via `kvm.lock { on }` (em ambas as direções, restrito ao controlador e seu parceiro), fazendo o dispositivo interromper a vigilância de retorno, evitando tanto `kvm.home` quanto `kvm.next`. Cada dispositivo possui sua própria tecla de trava (Scroll Lock, F14 no Mac); a tecla considerada é a do computador onde o ponteiro está localizado: no próprio teclado físico, o utilitário Linux a captura (`shortcut { action: 'lock' }`) e Mac e Windows a registram como atalho global enquanto houver conexão; quando digitada no teclado do controlador primário, ela chega como `k.kd` e o dispositivo controlado a consome antes da injeção. Telefones não possuem tecla própria: a tecla do computador primário governa. Voltar à base ou mudar de foco por outro meio (atalho de escape, bandeja, desconexão) cancela o bloqueio.
- Alcance (`reach`, no estado de layout para o editor): uma cadeia só alcança dispositivos aos quais o controlador primário está diretamente conectado, já que o próprio controlador assume cada nó (`kvm.next` direcionado a um nó sem conexão direta é ignorado, e um computador controlado apenas repassa comandos a um telefone próprio). A partir deste dispositivo, um bloco é classificado como acessível (adjacente a outro alcançado e conectado localmente), bloqueado (o cursor para antes dele: exibido em vermelho quando pertence à malha mas não possui conexão direta aqui) ou inacessível (situado após um bloco bloqueado: exibido em cinza).
- O editor (aba Multidispositivo, em todos os apps para desktop) renderiza a grade exibindo cada dispositivo como um bloco; clique em um bloco e em uma célula livre, ou em dois blocos para alternar suas posições. O Android armazena e retransmite o layout e pode atuar como ponta final de cadeia; a edição do layout a partir do telefone não faz parte desta mudança.

## Transportes por conexão (Bluetooth, Wi-Fi, cabo USB)

Cada conexão (uma por par de dispositivos) possui seu próprio meio de transporte; nada mais é tratado de forma global.

- **Bluetooth** (`shared/blepipe.js`): dispositivos próximos fora da rede local são acessados por canal Bluetooth, transmitindo o mesmo tráfego WSS sobre um socket de loopback. O socket Bluetooth recebe a marcação `ws.transport = 'ble'` no servidor (`ctx.transport`) e `link.transport` no cliente, aplicando limites de inatividade maiores: `P.BLE_TIMEOUT_MS` (20 s) em vez de `P.TIMEOUT_MS` (4 s) durante atividade e `P.IDLE_TIMEOUT_MS` (15 s) quando ocioso, além de computar bytes em trânsito no pipe como atividade (mensagens extensas levam segundos para trafegar). O keep-alive permanece uniforme por socket (ping ativo a cada `PING_MS`, ocioso a cada `IDLE_PING_MS`).
- **Migração de sessão** (`hello {resume}`): assim que um dispositivo conectado via Bluetooth é detectado na rede local, o link abre um segundo socket, retoma a sessão sobre ele (`_resume` no servidor) e preserva a conexão Bluetooth como contingência (*fallback*) (`ctx.alt` / `link.alt`). Cada socket é monitorado individualmente: uma contingência silenciosa é encerrada enquanto a sessão principal continua ativa. Um evento `transport` notifica os módulos interessados.
- **Por dispositivo, na malha**: `Session.transport` ('ble' | 'ip') indica o transporte da sessão daquele nó. O módulo KVM consulta essa propriedade para cada parceiro: o interruptor "Via Bluetooth" (`kvm.ble`, sincronizado em ambos os lados) pausa o compartilhamento de cursor apenas com nós conectados via Bluetooth (`kvm._pausedFor(id)`), e movimentos do cursor são agregados e enviados no máximo a cada `KVM_MOVE_BLE_MS` através do Bluetooth. Itens de pool (área de transferência, notificações, layout) continuam sendo propagados para todos os dispositivos independentemente do meio de transporte.
- **Wi-Fi sob demanda para sessões Bluetooth** (`shared/netlink.js`, Wi-Fi Direct, ponto de acesso ou rede Wi-Fi comum): atende ao dispositivo selecionado (os recursos ponto a ponto seguem-no). Transferências de arquivos aguardam o link rápido (`hub.netHold`) e o compartilhamento de tela também; mensagens `net.*` são roteadas a partir do dispositivo selecionado (`hub.netTap`).
- **Desconectar, Alternar e Assumir controle** são individuais por conexão: `link.disconnect()` (sem reconexão até solicitação explícita), `link.connect(true)` (Assumir controle: encerra a sessão pré-existente do outro computador com terceiros) e o estado `stopped` (`released` / `replaced`). A bandeja exibe "Desconectar <nome>" e "Assumir controle de <nome>" para o dispositivo selecionado.
- **Chamadas, Mensagens, Fotos e Arquivos** (`shared/phonehub.js`) são recursos exclusivos do telefone; o hub do telefone é inicializado uma única vez, suas mensagens trafegam pelo link dedicado (`PhoneLink`), e papel de parede e espelhamento de tela operam exclusivamente sobre Wi-Fi (o papel de parede é omitido em conexões Bluetooth).
- **Cabo USB**: telefones conectados via cabo são emparelhados diretamente por ele (`phone.wired`, com token nonce de conexão) e a sessão pode ser migrada para o cabo da mesma forma (`wired.toCable`).
- **UI.via**: a linha de status do link indica o transporte em uso (`Conectado via Bluetooth`, `Conectado via USB`, `Conectado`), para cada dispositivo na lista de dispositivos.

Limitações deste escopo: o aplicativo Android foi integrado sem compilação Kotlin no ambiente de desenvolvimento local (o build do CI atua como verificação de compilação); os aplicativos Windows e Mac foram validados através de seus testes no Node, sem execução completa em Electron.

## Entrada automática de novos dispositivos (Auto-join)

Emparelhe um dispositivo uma vez e a malha propaga o emparelhamento aos demais (`shared/intro.js` implementa o protocolo, `windows/autojoin.js` o lado Windows). Um dispositivo I conectado simultaneamente a dois nós H e G que não possuem conexão entre si atua como apresentador (introducer). H é o computador (que escuta conexões); entre dois computadores, prevalece o menor ID de dispositivo ou a ponta que já disca para a outra; dois telefones não estabelecem conexão direta entre si.

```
I -> H  mesh.intro.ask    {req, for: G, name, os}
H -> I  mesh.intro.reply  {req, for, ok, macId, macName, os, fp, port, addrs, token}   (ok:false + error otherwise)
I -> G  mesh.intro.grant  {req, macId, macName, os, fp, port, addrs, token}
```

H cria um registro de emparelhamento para G dispensando o código de 6 dígitos (`Pairing.grantFor`) e G armazena a autorização como um emparelhamento concluído (`LinkManager.addGrant`), discando em seguida para H. `addrs` contém os endereços IPv4 de H, priorizando a rede local; G tenta os endereços subsequentes caso o primeiro falhe. O apresentador recalcula conexões sempre que um link ou a lista de membros (`mesh.roster` com `members`) mudar; solicitações para o mesmo par respeitam um intervalo mínimo de 60 s. Dispositivos conhecidos apenas indiretamente são listados (`Mesh.known()`, estado `via` em `hub.peers()`).

Segurança: o apresentador é um dispositivo confiável. Qualquer dispositivo emparelhado pode autorizar a aceitação de um novo nó por este PC (lado H) ou adicionar um novo host (lado G); portanto, emparelhe apenas dispositivos de sua confiança. O apresentador apenas repassa respostas de solicitações originadas por ele próprio, provenientes do host consultado, uma única vez; um host nunca autoriza credenciais para si mesmo nem para o solicitante, tampouco para nós já conectados, limitando-se a uma concessão por dispositivo a cada 10 s. Tokens trafegam exclusivamente por conexões TLS autenticadas. Configuração `mesh.autoJoin` (ativa por padrão em Multidispositivo › "Conectar todos os dispositivos automaticamente"): quando desativada, o computador não apresenta nem aceita apresentações. Versões antigas ignoram mensagens do tipo `mesh.intro.*`.

## Testes

- Unitários: `shared/test/*.js` para o núcleo (topologias aleatórias de 2 a 10 nós: cada mensagem alcança todos os nós exatamente uma vez, sem tempestades de broadcast, malhas parciais realizam retransmissão correta, nós legados operam normalmente).
- Integração com sockets reais: `windows/test/*.js` inicializam múltiplos nós reais com `Server` + `Pairing` + `LinkManager` em loopback, realizam emparelhamento e executam cenários de teste (3 e 5 nós). O teste `mesh-transport.test.js` cobre o tempo limite estendido do Bluetooth e a transição dinâmica de transporte.
- Aplicativo headless: execução com `--user-data-dir` e `--remote-debugging-port` dedicados, inspecionando console e estado do renderizador via CDP; sem erros `Uncaught`, com atualizações contínuas de estado.
- O Android não pode ser compilado na máquina de desenvolvimento: o pipeline de CI é a validação de compilação.

## Fora deste escopo

Edição de layout a partir do telefone, uso do telefone como monitor adicional, bordas em configurações de múltiplos monitores e fragmentação binária de arquivos.

## O telefone na malha (Android)

- **Listagem.** O telefone mantém o registro de membros (`members`) de cada mensagem `mesh.roster` que recebe (`MeshMembers`, Mesh.kt, equivalente a `Mesh.known()`) e transmite seus próprios dados (`members` ao lado de `peers`). A página Visão Geral lista todos os computadores conectados (a ação Usar vincula os recursos ponto a ponto ao selecionado) e todos os dispositivos conhecidos indiretamente (`via <nome>`, não conectáveis por toque direto).
- **Entrada automática.** O telefone atua sempre como cliente visitante (Intro.kt, implementação de `validGrant`). A mensagem `mesh.intro.grant` recebida de um computador conectado na malha é armazenada como emparelhamento válido e discada imediatamente, a menos que o dispositivo já seja conhecido, o registro esteja cheio (`MAX_DEVICES`) ou a opção *Conectar todos os dispositivos automaticamente* (`meshAutoJoin`, ligada por padrão) esteja desativada. O telefone não pode escutar conexões, respondendo a `mesh.intro.ask` com `ok: false`.
