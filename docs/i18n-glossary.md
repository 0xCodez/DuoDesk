# Glossário pt-BR do DuoDesk

Termos fixos da interface em português do Brasil. O teste `shared/test/i18n-glossary.js` falha se um termo
proibido aparecer em `shared/locales/pt-BR.js`, em `android/.../values-pt-rBR/strings.xml` ou em
`website/locales/pt-BR.json`. Tratamento: sempre "você".

| Inglês | Use | Não use |
|---|---|---|
| pair, pairing, paired | parear, pareamento, pareado | emparelhar, emparelhamento |
| app (aplicativo) | aplicativo | app, apps |
| on / off (estado de um recurso) | ativado, desativado, ativar, desativar | ligado, desligado, ligar, desligar |
| phone | telefone | celular, smartphone |
| clipboard | área de transferência | clipboard |
| debugging | depuração | debug |
| hotspot | ponto de acesso | hotspot |
| wireless | sem fio | wireless |
| you, your | você, seu/sua | tu, teu/tua |

Exceções: nomes próprios e de produtos (Wi-Fi Direct, Bluetooth, Android, GitHub), a palavra "Ligar" só como
verbo de chamada telefônica, e "desligar o computador" (energia).
Regras de estilo: frase em "sentence case" nos textos corridos; "Title Case" só onde o inglês também usa;
sem gênero preso ao nome do dispositivo (`{phone}`, `{name}`): reescrever na forma neutra.
