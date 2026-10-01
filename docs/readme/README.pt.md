# html-password-manager

<!-- languages -->
<h3 align="center">
<a href="../../README.md">🇬🇧 English</a> ·
<a href="README.zh.md">🇨🇳 中文</a> ·
<a href="README.hi.md">🇮🇳 हिन्दी</a> ·
<a href="README.es.md">🇪🇸 Español</a> ·
<a href="README.fr.md">🇫🇷 Français</a> ·
<a href="README.ar.md">🇸🇦 العربية</a> ·
<a href="README.bn.md">🇧🇩 বাংলা</a> ·
<b>🇧🇷 Português</b> ·
<a href="README.ru.md">🇷🇺 Русский</a> ·
<a href="README.ur.md">🇵🇰 اردو</a> ·
<a href="README.id.md">🇮🇩 Bahasa Indonesia</a> ·
<a href="README.de.md">🇩🇪 Deutsch</a> ·
<a href="README.ja.md">🇯🇵 日本語</a> ·
<a href="README.mr.md">🇮🇳 मराठी</a> ·
<a href="README.te.md">🇮🇳 తెలుగు</a> ·
<a href="README.tr.md">🇹🇷 Türkçe</a> ·
<a href="README.uk.md">🇺🇦 Українська</a>
</h3>
<!-- /languages -->

**Deterministic Password** calcula as senhas em vez de apenas armazená-las. A senha de um site
é derivada da sua senha mestra, do site, do seu usuário e de um número de versão, com Argon2id
e HMAC-SHA-256. Se o arquivo do banco de dados for perdido, os mesmos dados dão as mesmas
senhas de novo, em qualquer computador — perder o arquivo deixa de ser assustador. Para trocar
a senha de um site, aumente a versão. Como funciona: "[Senhas derivadas](#senhas-derivadas)".

Ele também é um gerenciador de senhas KeePass completo: abre, edita e salva arquivos `.kdbx`
comuns (KDBX 4, AES-256, Argon2id), então o mesmo banco de dados continua funcionando no
KeePassXC, no KeePass ou no KeeWeb. Uma senha derivada é armazenada na entrada como qualquer
outra, e outros aplicativos KeePass a mostram do mesmo jeito.

Tudo funciona offline: sem conta, sem nuvem, sem requisições de rede. O aplicativo inteiro é um
único arquivo HTML independente; o banco de dados é descriptografado na memória da página e
salvo diretamente de volta no disco, e a senha mestra nunca sai da página. A mesma página
também é uma [extensão para Chrome](#extensão-para-chrome) que preenche logins na aba ao lado —
**[instale-a pela Chrome Web Store](https://chromewebstore.google.com/detail/hiahfdknjchamepclnokcalkcjcfhahf)**.

**[Versão online](https://marketkernel.github.io/html-password-manager/)** — a mesma página
como PWA (Progressive Web App): ela pode ser instalada no sistema e então roda como um
aplicativo separado, com janela e ícone próprios, e funciona offline. No computador, no Chrome,
no Edge e no Arc, use o botão de instalação na barra de endereços; no Android, menu ⋮ do Chrome →
Instalar app; no iOS, Compartilhar → Adicionar à Tela de Início, no Safari ou no Chrome. Também
ali o banco de dados fica no seu disco — veja "[GitHub Pages](#github-pages)".

![html-password-manager: grupos, entradas e uma entrada sendo editada](../password-manager.jpg)

## Como usar

1. Compile `build/password-manager.html` (veja "[Compilação](#compilação)") e abra-o em um
   navegador — direto do disco funciona.
2. "Abrir arquivo" → escolha um banco de dados `.kdbx` ou arraste-o para a janela.
3. Digite a senha mestra (e escolha o arquivo-chave, se o banco tiver um) → Desbloquear.

No Chrome, no Edge e no Arc o arquivo é aberto pela File System Access API: as alterações são
gravadas de volta no mesmo arquivo, um instante após cada edição se o salvamento automático
estiver ativado, e o arquivo é oferecido de novo na próxima visita — só o seu identificador
(handle) é lembrado, nunca o conteúdo nem a senha. No Safari e no Firefox o arquivo abre somente
para leitura, e Salvar baixa uma cópia atualizada do banco de dados — e o mesmo acontece nos
celulares: o Chrome no Android não tem File System Access, e todos os navegadores do iOS,
inclusive o Chrome, rodam sobre o motor do Safari. No iOS, Salvar entrega a cópia ao menu
Compartilhar — veja "[No celular](#no-celular)".

"Novo banco de dados" cria um banco de dados KDBX 4 vazio, criptografado com AES-256 e Argon2id
(64 MiB, 10 passagens — os padrões do KeePassXC, cerca de meio segundo em um navegador).

### No celular

Até 900 pixels de largura — um celular ou um tablet na vertical — a página mostra uma coisa de
cada vez. A lista de entradas ocupa a tela; um toque abre a entrada em uma tela própria, e ‹ na
barra de ferramentas, o botão voltar do sistema ou um gesto de voltar retornam à lista. Uma edição
é mantida na volta, assim como escolher outra entrada a mantém no computador; uma entrada nova
deixada vazia é descartada. ☰ desliza os grupos, as etiquetas e a lixeira por cima da lista. Os
menus, o gerador e as configurações sobem da parte de baixo da tela; voltar os fecha primeiro e
cancela uma caixa de diálogo. O gerador, as configurações e o bloqueio ficam no menu ⋯ da barra
de ferramentas.

Uma tela sensível ao toque não tem clique direito nem arrastar: o ⋯ ao lado de um grupo abre o
menu que um clique direito abre no computador, e o seu "Mover para o grupo…" faz o que o arrastar
faz. O menu de uma entrada é o ⋯ na tela da entrada.

O arquivo abre somente para leitura. No iOS, Salvar entrega o banco de dados atualizado ao menu
Compartilhar, onde "Salvar em Arquivos" pode colocá-lo no lugar do original; fechar o menu deixa
as alterações sem salvar. O Chrome no Android compartilha apenas imagens, som, vídeo e texto,
então ali Salvar baixa a cópia.

Em telas mais largas e no tablet, os três painéis ficam como no computador; uma tela sensível ao
toque de qualquer tamanho ganha botões maiores e o ⋯ ao lado dos grupos.

## Extensão para Chrome

**[Instalar pela Chrome Web Store](https://chromewebstore.google.com/detail/hiahfdknjchamepclnokcalkcjcfhahf)**

`npm run build` também grava `build/extension/`: o mesmo aplicativo como extensão para Chrome, e
`build/password-manager-extension-<version>.zip` dela para a Chrome Web Store. Para experimentar
uma compilação sua: `chrome://extensions` → Modo do desenvolvedor → Carregar sem compactação →
`build/extension`.

O ícone na barra de ferramentas abre um popup compacto: as entradas do site da aba, um clique em
uma delas para preenchê-la, botões para copiar o usuário, a senha ou o código de uso único, e uma
pesquisa em todo o banco de dados. **Modo completo**, na parte de baixo, abre o aplicativo no
painel lateral do Chrome, ao lado da página — no layout de celular, já que o painel é estreito —,
onde ele permanece ao trocar de aba. Tudo funciona ali como no arquivo; o que a extensão
acrescenta é o preenchimento de logins:

- **O popup** desbloqueia só com a senha mestra o último arquivo que o painel abriu: é o painel
  que escolhe arquivos e arquivos-chave e faz todas as alterações. Em um site sem entrada, o seu
  botão **Nova senha** abre o painel no gerador, como faz Preencher no menu.
- **Preencher**, no menu de contexto da página (um clique direito na página ou em um campo),
  preenche o usuário e a senha da entrada do site da aba — ou o código de uso único, na etapa de
  um login que o pede. Com uma só entrada para o site, preenche na hora, com o painel aberto ou
  não; com várias, com nenhuma ou com o banco de dados bloqueado, abre o painel para escolher uma,
  criar uma senha ou desbloquear — e continua a partir dali. Um login em duas etapas (Google,
  Microsoft) recebe o usuário na primeira e a senha na segunda: a entrada escolhida para a aba é
  lembrada. O botão **Preencher** de uma entrada no painel preenche essa entrada na aba.
- **O banco de dados continua aberto** quando o painel fecha, até ser bloqueado: após o tempo de
  inatividade das configurações, quando a tela do computador é bloqueada, pelo painel, pelo popup
  ou por **Bloquear** no menu do ícone da barra de ferramentas. Aberto de novo, o painel o retoma
  sem a senha, e o popup o mostra na hora.
- **Para este site**, no topo do painel de grupos, lista as entradas do site da aba, e a lista
  abre nele; ele acompanha a aba.
- **Uma senha nova para uma página.** Em um site sem entrada, Preencher abre o gerador Derivada v3
  com o site da aba e o usuário digitado na página. O seu botão Preencher preenche a senha — nos
  dois campos de um formulário de cadastro — e a guarda como uma entrada comum.

Uma entrada serve para uma aba quando o seu site nomeia exatamente o site da aba: os dois
endereços passam por `siteOf()` do gerador 3 — sem esquema, porta, caminho nem `www.`, IDN em
punycode. `google.com` não serve para `accounts.google.com`, nem `mail.site.com` para `site.com`.
Uma entrada com `https://`, ou sem esquema, nunca é preenchida em uma página `http://`: um site
usado por http precisa de `http://` no seu endereço. As entradas da lixeira não são oferecidas, e
uma entrada escolhida à mão para outro site só é preenchida depois de um aviso que nomeia os dois.

**Como é feita.** O painel é a própria página: `panel.html`, com o script em `panel.js`, como o
Manifest V3 exige. A cada desbloqueio e salvamento, ele entrega o arquivo e a sua chave — a senha
em um `ProtectedValue`, o arquivo-chave — a um documento offscreen, que os guarda, junto com uma
cópia somente leitura do banco de dados descriptografada a partir deles, na memória até o
bloqueio; bloquear o fecha, e a chave vai junto. Nada é gravado em lugar nenhum. O service worker
cuida dos menus. Um clique em Preencher só consegue abrir o painel antes de qualquer espera
(await), então o worker precisa saber na hora se pode preencher: ele guarda os sites das entradas
— sem nomes, sem senhas — conforme o documento offscreen os envia, e o documento offscreen o
mantém rodando. O popup (`popup.html`, `popup.js`) não descriptografa nada: pede ao documento
offscreen os títulos e os usuários que servem para a aba, depois a única entrada clicada;
bloqueado, ele lê o arquivo recente e o entrega, com a senha, a esse documento para abrir.

**O que chega a uma página.**

- Só o que um clique pede, e só os valores de uma entrada. Nenhum content script roda em lugar
  nenhum: no clique, `chrome.scripting.executeScript` primeiro pergunta a cada frame da aba onde
  ele está e quais campos de login tem, sem enviar valores; depois só os frames do site da
  entrada os recebem, e a função confere de novo o próprio endereço antes de digitar. Um frame de
  outro site na mesma página não recebe nada.
- Só são preenchidos campos que uma pessoa consegue ver: exibidos, habilitados, editáveis, com
  algum tamanho, dentro da janela. Um campo escondido como armadilha fica vazio.
- Os valores são definidos a partir do mundo isolado da extensão, contornando qualquer setter
  que a página ponha nos seus inputs, e os eventos `input` e `change` avisam React, Vue ou Angular.
- A senha mestra, as outras entradas e a lista de sites nunca vão para uma página.

**Permissões.** `activeTab` em vez de todos os sites: um clique no ícone ou em Preencher dá à
extensão aquela única aba. Por isso o painel abre pelo popup ou pelo menu, nunca pela
configuração do próprio Chrome (`openPanelOnActionClick`): um painel aberto assim não recebe aba
nenhuma. Preencher no painel, em uma aba que não lhe foi dada, pede uma vez o site da entrada
(`optional_host_permissions`). `contextMenus`, `scripting` e `sidePanel` para o que foi descrito
acima, `offscreen` para o documento, `idle` para o bloqueio de tela, `clipboardWrite` para apagar
um segredo copiado com o painel fechado. Não há `externally_connectable`: as partes da extensão
conversam por `chrome.runtime`, e cada uma aceita mensagens só das páginas da própria extensão.
As suas páginas têm `connect-src 'none'`, como o arquivo; a compilação verifica isso, e também que
nenhuma página tenha script inline ou endereço externo.

Uma diferença em relação ao arquivo: aberto de novo, o painel grava o banco de dados no lugar só
se o Chrome ainda permitir; caso contrário, a barra de status avisa, e o primeiro Salvar pede a
permissão.

## Segurança

- **Nada sai da página.** Uma Content-Security-Policy no arquivo proíbe toda requisição de rede,
  envio de formulário e recurso externo; a compilação falha se a política sumir ou se
  aparecer uma referência externa. A cópia do PWA libera três coisas a mais, todas da própria origem: o manifest, o
  service worker e os ícones — `connect-src` continua `'none'`.
- O código do formato é o [kdbxweb](https://github.com/keeweb/kdbxweb), a biblioteca sobre a
  qual o KeeWeb é construído; o Argon2 é o WebAssembly do
  [hash-wasm](https://github.com/Daninet/hash-wasm), também embutido no arquivo.
- Os campos protegidos ficam na memória mascarados com XOR (o `ProtectedValue` do kdbxweb) e
  aparecem mascarados na tela até serem revelados. A pesquisa nunca olha dentro de campos
  protegidos.
- **Senhas em qualquer idioma.** Quando um navegador trata um campo como senha, o macOS ativa o
  Secure Input e força um layout de teclado latino, de modo que uma senha mestra em cirílico não
  pode ser digitada. O Chrome trata como senha não só `type=password`, mas, por heurística,
  qualquer campo estilizado com `-webkit-text-security` ou que contenha um valor de pontos — e
  continua tratando depois que começa. Os campos secretos aqui não dão essa pista: são campos de
  texto comuns com texto transparente, e uma camada de pontos é desenhada por cima (em fonte
  monoespaçada, para que o cursor fique no lugar). Um selo mostra se o texto oculto está sendo
  digitado em cirílico (РУС) ou no alfabeto latino (ENG). A contrapartida: o Secure Input, que
  também esconde as teclas digitadas de outros aplicativos, nunca é ativado.
- Um segredo copiado é apagado da área de transferência após 30 segundos e no bloqueio.
- O banco de dados é bloqueado após 15 minutos de inatividade e com `⌘L`. Bloquear descarta da
  memória o banco de dados descriptografado; um bloqueio com alterações não salvas que não podem
  ser gravadas espera, em vez de jogar as alterações fora.
- Os links nas entradas só abrem para `http`, `https`, `ftp` e `mailto`, com `noopener`.
- As senhas são geradas com `crypto.getRandomValues` e amostragem por rejeição: todo caractere
  tem a mesma probabilidade.

## Recursos

- **Grupos**: uma árvore recolhível; criar, renomear e excluir pelo menu de contexto; mover
  arrastando e soltando (entradas e grupos); painel redimensionável e ocultável (`⌘\`).
- **Entradas**: título, usuário, senha, site, notas, campos personalizados (simples ou
  protegidos), etiquetas, data de expiração, anexos. Ordenação por título, usuário, site, datas.
- **Códigos de uso único** (TOTP): de um campo `otp` (URL `otpauth://` ou um segredo puro, como o
  KeePassXC e o KeeWeb o guardam), dos campos `TimeOtp-*` do KeePass ou do `TOTP Seed` do
  TrayTOTP. SHA-1, SHA-256, SHA-512; o código se atualiza com uma contagem regressiva.
  **+ Código de uso único** no editor aceita a chave de configuração que um site mostra ao lado
  do código QR (ou um link `otpauth://`) e mostra o código na hora, para confirmá-lo no site; uma
  chave pura é salva como link `otpauth://`, a forma que o KeePassXC lê.
- **A edição** trabalha sobre um rascunho: Salvar primeiro guarda o estado anterior no histórico
  da entrada, como faz o KeePass; Cancelar descarta o rascunho. As versões anteriores podem ser
  consultadas e restauradas.
- **Lixeira**: excluir move para a lixeira; de lá — restaurar ou excluir permanentemente.
- **Pesquisa** em título, usuário, site, notas, etiquetas, campos personalizados e nomes de
  anexos; todas as palavras da consulta precisam corresponder.
- **Gerador de senhas** (o dado, `⌘G`) cria uma senha do tipo escolhido na sua lista, com a
  derivação mais nova primeiro; a última escolha é lembrada:
  - **Derivada v3** — calculada a partir da senha mestra, do usuário, do site e de uma versão, de
    modo que pode ser calculada de novo sem o arquivo — veja
    "[Senhas derivadas](#senhas-derivadas)";
  - **Derivada v2** e **Derivada v1** — as calculadoras de dois programas antigos (antigo 2 e
    antigo 1), listadas quando Configurações → "Mostrar os algoritmos de senha antigos" está
    ativado — veja "[Algoritmos antigos](#algoritmos-antigos)";
  - **Aleatória** — comprimento, conjuntos de caracteres, caracteres parecidos, estimativa de
    entropia.

  Medidor de força para senhas digitadas.
- **Banco de dados**: renomear, alterar a senha mestra e o arquivo-chave, salvar uma cópia.
- **Idiomas**: English, 中文, हिन्दी, Español, Français, العربية, বাংলা, Português, Русский,
  اردو, Bahasa Indonesia, Deutsch, 日本語, मराठी, తెలుగు, Türkçe — os dezesseis mais falados — e
  Українська. Escolhido nas Configurações ou obtido do navegador; em árabe e urdu a janela é
  disposta da direita para a esquerda.
- **Tema**: sistema, claro, escuro, nas Configurações. Idioma, tema, larguras dos painéis,
  ordenação, opções do gerador e grupos recolhidos são lembrados.

## Senhas derivadas

**Derivada v3**, no gerador, calcula uma senha a partir de

- a senha mestra do banco de dados (o arquivo-chave, se houver, fica de fora), ou outra digitada
  ali,
- o usuário,
- o site — o domínio em que a conta está (`https://www.github.com/login` → `github.com`),
- a versão — 1, 2, … até 2³² − 1; "+1" dá à mesma conta uma senha nova.

Esses quatro formam 32 bytes de entropia. Os requisitos — comprimento, conjuntos de caracteres,
caracteres parecidos — apenas moldam esses bytes em caracteres: mudá-los não muda a entropia.
**Usar** coloca o resultado na entrada como uma senha comum armazenada. Nada sobre como ela foi
feita é guardado: a entrada é como qualquer outra, e outros aplicativos KeePass mostram a mesma
senha. Se o arquivo for perdido, a mesma senha mestra, usuário, site, versão e requisitos dão a
mesma senha em qualquer máquina. Os padrões são 20 caracteres, os quatro conjuntos de caracteres,
sem caracteres parecidos; uma senha feita com outros requisitos exige que eles também sejam
lembrados.

O gerador pede primeiro o usuário — a partir de uma entrada, o da própria entrada: o que é
digitado ali aparece também no formulário — e depois o site; os dois são obrigatórios, e a senha
que eles dão fica embaixo, acima de **Usar**.

- Um usuário que é um endereço de e-mail nomeia o seu site: `test@site.com` preenche `site.com`,
  e o site da entrada fica como está — ele pode muito bem ser `mail.site.com`. Mas o mesmo
  endereço serve para entrar em muitos sites, e o gerador avisa isso abaixo do campo: para o
  GitHub com `test@gmail.com`, digite `github.com` por cima do `gmail.com` que ele colocou ali.
- Qualquer outro usuário exige que o site seja digitado, e, a partir de uma entrada, o que é
  digitado passa a ser também o site dela. O site que a entrada já tem é preenchido de início.

Do que é digitado como site, o esquema, o caminho, a porta e um `www.` inicial não importam; um
subdomínio importa — `login.github.com` e `github.com` são dois sites. Um site que não é uma URL
("Meu banco") é usado como está. Pela barra de ferramentas, o gerador funciona do mesmo jeito,
com campos próprios, e copia o resultado.

"Usar a senha mestra do banco" vem marcado toda vez que o gerador abre. Desmarque para derivar a
partir de outra senha mestra, digitada ali e guardada em lugar nenhum — para recuperar uma senha
feita em outro banco de dados, ou antes de a senha mestra ser alterada. Alterá-la deixa as senhas
do arquivo como estão; só o que o gerador calcula daí em diante muda.

### O algoritmo: gerador 3

Tudo o que vem abaixo está congelado: mudar qualquer constante tornaria impossível calcular de
novo todas as senhas feitas com ela. Um gerador futuro viria como um novo tipo na lista e deixaria
este como está. O código é `src/core/derived.ts`; `npm test` o verifica contra vetores fixos e
contra uma implementação independente, escrita a partir desta descrição com o `crypto` do próprio
Node. As primitivas são padrão — SHA-256, HMAC-SHA-256, Argon2id —, então o algoritmo pode ser
reconstruído em qualquer linguagem.

Ele roda em duas etapas: os segredos viram 32 bytes de entropia, e depois os requisitos esculpem
caracteres a partir desses bytes.

**Etapa 1 — entropia.**

1. *Normalizar as entradas.* Todas as strings são UTF-8.
   - `site` — o host do que foi digitado como site: o texto interpretado como URL WHATWG
     (`https://` é colocado na frente quando o texto não tem `scheme://`): em minúsculas, IDN em
     punycode, sem porta, sem usuário nem senha, com um `www.` inicial removido; um texto que não
     é interpretável como URL é usado como está. Depois, aparado, normalizado em NFC e convertido
     para minúsculas.
   - `user` — o usuário, aparado e normalizado em NFC; maiúsculas e minúsculas são mantidas.
   - `master` — a senha mestra, normalizada em NFC, sem nada aparado. Um "é" digitado como um
     único caractere ou como "e" mais um acento combinante dá a mesma senha.
2. *Sal.*
   ```
   salt = SHA-256( "html-password-manager/derived/v3" ‖ 0x00
                   ‖ u32be(comprimento em bytes de site) ‖ site
                   ‖ u32be(comprimento em bytes de user) ‖ user
                   ‖ u32be(version) )
   ```
   Os prefixos de comprimento mantêm `ab` + `c` e `a` + `bc` distintos; o rótulo mantém esses
   bytes distintos de qualquer outro uso das mesmas entradas. `u32be` é um inteiro big-endian de
   4 bytes.
3. *Estiramento.*
   ```
   entropy = Argon2id(password = master, salt, memory = 64 MiB, passes = 3,
                      lanes = 1, version 0x13, output = 32 bytes)
   ```
   O Argon2id faz cada tentativa de adivinhar a senha mestra custar 64 MiB de memória, o que
   desacelera GPUs e ASICs. Como o site, o usuário e a versão estão no sal, cada conta tem o seu:
   nenhuma tabela pode ser calculada antecipadamente, e cada conta precisa ser atacada
   separadamente.

**Etapa 2 — modelagem.** Os requisitos são usados só aqui, então mudam a aparência da senha, não
a entropia por trás dela.

4. *Um fluxo de bytes aleatórios*, tão longo quanto necessário — 32 bytes não bastam para uma
   senha longa e o seu embaralhamento:
   ```
   block(i) = HMAC-SHA-256(key = entropy, "hpm-v3-stream" ‖ u32be(i)),  i = 0, 1, 2, …
   ```
5. *Um número sem viés menor que n.* Tome os próximos 4 bytes do fluxo como um u32 big-endian
   `x`. Se `x ≥ 2³² − (2³² mod n)`, descarte-o e tome o seguinte; caso contrário, o resultado é
   `x mod n`. (Um simples `x mod n` favoreceria o início do alfabeto.)
6. *Caracteres.* Os conjuntos, nesta ordem, cada um só se escolhido:
   ```
   A–Z      ABCDEFGHIJKLMNOPQRSTUVWXYZ
   a–z      abcdefghijklmnopqrstuvwxyz
   0–9      0123456789
   símbolos !#$%&*+-=?@^_~.,:;()[]{}<>/|
   ```
   Sem caracteres parecidos, `O 0 o I l 1 |` são removidos deles. Então:
   ```
   chars = []
   para cada conjunto escolhido:   chars.push(set[draw(|set|)])      # todo conjunto está presente
   enquanto |chars| < length:      chars.push(all[draw(|all|)])      # all = os conjuntos unidos
   para i = length − 1 até 1:      j = draw(i + 1); trocar chars[i], chars[j]   # Fisher–Yates
   password = chars unidos
   ```
   O comprimento vai de 4 a 128. Tirar primeiro um caractere de cada conjunto é o que garante "tem
   um dígito" e "tem um símbolo"; o embaralhamento esconde para onde esses caracteres foram.

**Vetor de teste.** Senha mestra `Тестовый пароль`, site `https://www.github.com/login`
(`github.com`), usuário `me@example.com`, versão 1, os requisitos padrão (20 caracteres, os quatro
conjuntos, sem caracteres parecidos):

```
password  A6qVXXF]7<%a)aa<x7*U
```

A mesma entropia com 12 caracteres e sem símbolos dá `yaM6VJaJFYUQ`; a versão 2 com os padrões dá
`3q_bwppbE8P2+ufKr:P6`.

### Quão forte é

- Uma senha derivada tem no máximo 256 bits de entropia (os 32 bytes); 20 caracteres dos quatro
  conjuntos sem caracteres parecidos dão cerca de 128 bits. Na prática, o teto é a senha mestra.
- **O ponto fraco de qualquer esquema de senhas derivadas:** uma senha vazada por um site permite
  que um atacante tente adivinhar a senha mestra offline, já que o site e o usuário são
  conhecidos. Cada tentativa custa uma execução do Argon2id sobre 64 MiB — cerca de 0,15–0,4 s em
  um navegador, menos em hardware dedicado. Uma senha mestra curta ou comum será encontrada; uma
  frase-senha longa, não. Senhas aleatórias não têm essa fraqueza, e é por isso que o gerador tem
  as duas.
- Enquanto a senha mestra resistir, uma senha vazada não revela nada sobre os outros sites ou
  versões: eles vêm de outros sais, portanto de outras execuções do Argon2.

A senha mestra fica na memória mascarada com XOR enquanto o banco de dados está aberto, junto com
a entropia calculada até então; bloquear descarta as duas.

## Algoritmos antigos

Dois programas antigos para Windows calculavam senhas a partir de frases secretas; **Derivada v1**
(antigo 1) e **Derivada v2** (antigo 2), no gerador, os reproduzem exatamente, para que as senhas
feitas com eles possam ser recuperadas. São calculadoras: nada digitado nelas é salvo, as frases
desaparecem quando o gerador fecha, e **Usar** coloca o resultado na entrada como uma senha comum
armazenada. Configurações → "Mostrar os algoritmos de senha antigos" os faz aparecer.

Abertos a partir de uma entrada, os dois sugerem o identificador: um usuário que já nomeia o seu
site (`mail@site.com`) como está; caso contrário, o usuário, `@` e o site sem `www.`
(`dmytro@github.com`); ele pode ser alterado. Cada frase — a chave mestra e a chave secundária, a
frase secreta primária e a secundária — tem a sua própria caixa "Lembrar até o banco ser
bloqueado": uma marcada fica guardada na memória da página, mascarada com XOR, e é preenchida da
próxima vez; com a primeira frase guardada, a chave é calculada na hora. Os dois também podem usar
a própria senha mestra do banco de dados — aquela com que ele foi desbloqueado — como primeira
frase: a chave mestra do antigo 1 ou a frase secreta primária do antigo 2 ("Usar a senha mestra do
banco", lembrado nas configurações para cada um deles): esse campo e a sua caixa ficam então
desativados. Nada disso é gravado no disco; bloquear, fechar o banco de dados ou desativar os
algoritmos antigos esquece tudo. O código é `src/core/legacy.ts`; `npm test` o verifica contra
vetores calculados pelos programas .NET originais.

**Antigo 1** — chave mestra, identificador, chave primária, chave secundária, resultado:

```
short(bytes) = Base64(bytes) sem "=", "/", "+", os primeiros 10 caracteres
primary key  = short(SHA-1 aplicado 1 000 000 de vezes a UTF-8(master key ‖ identifier))
result       = short(SHA-1(UTF-8(primary key ‖ secondary key)))
```

A chave primária está ligada ao identificador e pode ser guardada à parte (em papel), de modo que
a chave mestra não precisa ser digitada em lugar nenhum: a chave primária pode ser inserida
diretamente. A chave secundária torna inútil, por si só, uma anotação roubada.

**Antigo 2** (Password.Generator 1.0) — proteção primária: identificador, frase secreta primária,
comprimento da chave, conjuntos de caracteres; proteção secundária: a chave, frase secreta
secundária, versão da senha, comprimento da senha, conjuntos de caracteres:

```
digest(a, b, v, n) = SHA-1 aplicado n vezes a UTF-8(a) ‖ UTF-8(b) ‖ (v > 0 ? u32le(v) : nada)
key                = select(digest(identifier, primary phrase, 1, 100 000), key length + 2)
password           = select(digest(key, secondary phrase, version, 1), password length + 2)
```

`select` lê o digest como cinco u32 little-endian, liga o bit mais alto de cada um, escreve-o na
base N do alfabeto — `!#$%&'()+,-.` (se escolhido), dígitos (sempre), A–Z, a–z (se escolhido) —,
do dígito menos significativo para o mais significativo, mantém 5 caracteres de cada um e corta no
comprimento (1–18). Os dois primeiros caracteres são uma assinatura para comparar a olho com a que
o programa mostrava; o resto é a chave ou a senha. A versão da chave é sempre 1: o programa não tem
campo para ela. Identificador `1`, frase `1`, comprimento 10, dígitos e letras dão a chave
`E8 8pgYm9fZha`.

Os dois são muito mais fracos que a versão 3: uma tentativa de adivinhar as frases custa ao
atacante algumas execuções de SHA-1, em vez de uma execução do Argon2id sobre 64 MiB, e um
resultado do Antigo 1 tem 10 caracteres, cerca de 60 bits. Use-os para recuperar senhas antigas,
não para criar novas.

## Atalhos de teclado

| Ação | Teclas |
| --- | --- |
| Salvar | `⌘S` |
| Bloquear | `⌘L` |
| Pesquisar | `⌘F` |
| Nova entrada | `⌘N` |
| Editar · salvar a edição | `⌘E` ou `Enter` · `⌘Enter` |
| Cancelar a edição | `Esc` |
| Gerador de senhas | `⌘G` |
| Copiar senha · usuário · site | `⌘C` · `⌘B` · `⌘U` |
| Entrada anterior · próxima | `↑` · `↓` |
| Excluir a entrada | `⌫` |
| Painel de grupos | `⌘\` |

## Traduções

O texto em inglês fica no código: `t('menu', 'Delete')`, `tn('status', '{count} entry',
'{count} entries', n)`, e `data-i18n="context"` / `data-i18n-attr="context"` no template. O
primeiro argumento é o contexto — a parte da interface a que a string pertence, para que a mesma
palavra em inglês possa ser traduzida de forma diferente em dois lugares. Um dicionário,
`src/locales/<code>.json`, mapeia contexto → texto em inglês → tradução:

```json
{
  "menu": { "Delete": "Удалить" },
  "status": { "{count} entries": { "one": "{count} запись", "few": "{count} записи", "many": "{count} записей", "other": "{count} записи" } }
}
```

Uma string que falta no dicionário é mostrada em inglês. Um texto com número tem uma forma para
cada categoria de plural do idioma (`Intl.PluralRules`), indexada pela forma plural em inglês.
`npm run i18n` lista, por idioma, as strings ainda não traduzidas e as que não são mais usadas;
`npm test` verifica se toda tradução mantém os placeholders do inglês e tem todas as formas de
plural.

O que o Chrome mostra da própria extensão — o nome e a descrição, o título do botão da barra de
ferramentas — segue o idioma do navegador, e não o do painel, por meio de `chrome.i18n`. Esses
textos são os em inglês de `src/extension/manifest.json`, traduzidos nos mesmos dicionários sob o
contexto `manifest`; a compilação os grava em `_locales/<code>/messages.json` e coloca
`__MSG_appName__` e similares no manifest. O Chrome tem códigos próprios e ignora o resto: `pt`
vira `pt_BR` e `pt_PT`, `zh` vira `zh_CN`, e o urdu não tem nenhum, então ali o Chrome mostra o
nome da extensão em inglês. A compilação para diante de um nome com mais de 75 caracteres ou de
uma descrição com mais de 132.

Este README também é traduzido: `docs/readme/README.<code>.md`, um por idioma, com a lista de
idiomas no topo de cada um. Uma mudança aqui também deve ir para as traduções.

## Compilação

```sh
./build.sh         # instala as dependências se necessário e compila build/password-manager.html
npm install
npm run build      # -> build/password-manager.html
npm run watch      # recompila a cada mudança em src/
npm run typecheck  # tsc --noEmit
npm test           # abrir, editar e salvar arquivos .kdbx, o gerador, TOTP, senhas derivadas, correspondência de abas, os dicionários
npm run test:browser  # a página compilada e a extensão no Chrome headless
npm run i18n       # strings que faltam em cada dicionário ou que ele não usa mais
```

`build.mjs` empacota `src/app/main.ts` com o esbuild em um IIFE e o insere, junto com os estilos e
o ícone (uma data URI), em `src/app/template.html`. Os fallbacks do kdbxweb para Node (`crypto`,
`@xmldom/xmldom`) são substituídos por stubs vazios — um navegador tem `crypto.subtle` e
`DOMParser`. O resultado é `build/password-manager.html`, com cerca de 500 KB, um quarto deles
ocupado pelos dicionários.

A mesma execução grava `build/pages/`: essa página como PWA instalável — `index.html` com um link
para o manifest e o registro de um service worker, `manifest.webmanifest`, os ícones e `sw.js`,
que guarda a página em cache para que ela abra offline. O próprio `build/password-manager.html`
continua sendo um único arquivo sem referências externas.

E `build/extension/`: `panel.html` é o template com o script em `panel.js` — o mesmo
`src/app/main.ts`, com `src/extension/extension.ts` no lugar de `src/app/platform.ts`, cujos hooks
não fazem nada no arquivo —, ao lado de `popup.html` (com os estilos da página e `popup.css`) e
`popup.js`, `background.js`, `offscreen.html` e `offscreen.js`, os ícones e `manifest.json`, cuja
versão é a de `package.json`. `build/password-manager-extension-<version>.zip` contém os mesmos
arquivos, com datas fixas: as mesmas fontes dão os mesmos bytes.

`tests/extension.mjs` carrega essa extensão no Chrome headless pelo protocolo DevTools
(`Extensions.loadUnpacked` por um pipe; `--load-extension` sumiu do Chrome desde a versão 137) e
preenche sites de teste em um servidor local: um formulário simples, um no estilo React, um login
em três etapas com código de uso único, frames do próprio site e de outro site, campos escondidos
como armadilha, uma página http para uma entrada https, um cadastro preenchido com uma senha
Derivada v3 — com o painel fechado e depois do bloqueio; e o popup, que desbloqueia, preenche,
pesquisa, copia e bloqueia. Um menu de contexto não pode ser clicado pelo DevTools, então o teste
dispara ele mesmo o `onClicked` do worker; sem um clique real o Chrome não concede `activeTab`,
então a cópia em teste pode acessar os sites de teste, `*.test`, como permissões de host. O ícone
da barra de ferramentas pode ser clicado pelo DevTools (`Extensions.triggerAction`): um Chrome
próprio, com a extensão tal como foi compilada, verifica se o clique dá ao popup a aba. O Chrome
headless 153 trava nesse clique, seja qual for a extensão, e a verificação é então pulada; o
Chrome for Testing a executa (`CHROME=/path/to/chrome-for-testing npm run test:browser`).

`tests/fixtures/Database.kdbx` é um banco de dados de exemplo para os testes; a senha dele é
`Тестовый пароль`.

## Versões e lançamentos

A versão é escrita em um só lugar, `package.json`. A compilação a coloca na página (a linha abaixo
da tela de entrada, o rodapé das configurações), no `manifest.json` da extensão e no nome do cache
do PWA. Uma compilação do commit marcado com a tag `v<version>` a mostra como está; qualquer outra
acrescenta o seu commit, `0.8.0+1a2b3c4`, para que uma página de `main` no GitHub Pages não seja
confundida com o lançamento. O `version` do Chrome aceita só números, então ali o commit vai para
`version_name`.

```sh
npm version minor           # 0.7.2 -> 0.8.0: package.json, package-lock.json, um commit e a tag v0.8.0
git push --follow-tags      # a tag dispara .github/workflows/release.yml
```

O workflow de lançamento para se a tag e o `package.json` não coincidirem e, em seguida, anexa
`password-manager-<tag>.html`, `password-manager-extension-<tag>.zip` e `SHA256SUMS.txt`.

## GitHub Pages

`.github/workflows/pages.yml` compila e testa cada push para `main` e publica `build/pages/` no
GitHub Pages (Settings → Pages → Source: GitHub Actions), em
<https://marketkernel.github.io/html-password-manager/>. Os arquivos abrem do mesmo jeito que no
arquivo único; os arquivos recentes, as configurações e os identificadores lembrados pertencem a
esse endereço, separados dos de uma cópia aberta do disco.

Cada publicação muda o nome do cache em `sw.js`, então o navegador pega a nova versão sozinho; uma
janela aberta passa para ela no próximo recarregamento. Essa também é a contrapartida: um PWA
instalado roda o que a última publicação colocou ali, enquanto um arquivo baixado continua na
versão que é. Para uma versão fixa no disco, pegue `password-manager-<tag>.html` de um lançamento
e confira-o com `SHA256SUMS.txt`.

`npm run test:browser` também abre `build/pages/`: o service worker assume a página, o Chrome
considera o manifest instalável e, com o servidor desligado, a página ainda carrega e desbloqueia o
banco de dados de exemplo.

## Estrutura

```
src/core/             sem DOM: os testes o executam no Node
  kdbx.ts             kdbxweb + Argon2: abrir, salvar, criar; campos, grupos, lixeira
  generator.ts        gerador de senhas e estimativa de força
  derived.ts          senhas derivadas: gerador 3, o site de um endereço de e-mail, a senha mestra da sessão
  site.ts             siteOf(): o site de um endereço web, para o gerador 3 e para a correspondência de abas
  legacy.ts           os algoritmos antigos: antigo 1 e antigo 2
  otp.ts              TOTP (RFC 6238) e as formas como os segredos são guardados
  match.ts            quais entradas servem para uma aba
  i18n.ts             t()/tn(), a lista de idiomas, a tradução da marcação da página
src/app/              a página: o arquivo único, o PWA e o painel lateral da extensão
  template.html       marcação com os placeholders __STYLES__/__APP__/__ICON__, a CSP; também o panel.html da extensão
  styles.css          paleta, temas claro e escuro, três painéis; no celular, uma tela de cada vez
  main.ts             a tela de entrada, desbloqueio, salvamento, bloqueio, barra de ferramentas, atalhos, configurações
  files.ts            File System Access API, arrastar e soltar, seleção de arquivo; arquivos recentes
  groups.ts           a árvore de grupos, as etiquetas e a lixeira no painel esquerdo
  list.ts             a lista de entradas
  details.ts          uma entrada: leitura, edição sobre um rascunho, histórico, anexos, TOTP
  search.ts           pesquisa, ordenação, links seguros
  genpanel.ts         o popover do gerador: aleatória, versão 3, antigos 1 e 2
  clipboard.ts        cópia com apagamento temporizado
  avatar.ts           ícones das entradas: ícones personalizados do banco de dados ou uma letra colorida
  settings.ts         localStorage: idioma, tema, painéis, temporizadores de bloqueio e da área de transferência
  ui.ts               caixas de diálogo, menu de contexto, popovers, toasts, ícones; painéis inferiores no celular
  screens.ts          o layout de celular: a lista ou a entrada, a gaveta de grupos, o botão voltar
  platform.ts         o que a página faz além de si mesma: nada, no arquivo e no PWA
src/extension/        a extensão para Chrome
  manifest.json       o manifest dela; a compilação acrescenta a versão
  extension.ts        o platform.ts do painel lateral: o documento offscreen, a aba, Preencher
  popup.ts            o popup do ícone da barra de ferramentas (popup.html, popup.css): as entradas do site, Modo completo
  background.ts       o service worker: os menus, o bloqueio de tela, o preenchimento de uma aba
  offscreen.ts        o documento offscreen (offscreen.html): o banco de dados aberto até o bloqueio
  fill.ts             a função colocada na página: encontra os campos de login e os preenche
  messages.ts         como as partes da extensão conversam
src/pwa/sw.js         o service worker da compilação para o Pages
src/locales/          um dicionário por idioma
assets/               o ícone; pwa/, os tamanhos PNG dele para o PWA; extension/, o ícone da extensão
tests/                ida e volta de .kdbx, gerador e TOTP, senhas derivadas, algoritmos antigos, correspondência de abas,
                      dicionários, a página e a extensão no Chrome headless; fixtures/, o banco de dados de exemplo
tools/                load.mjs compila os módulos de src/ para os testes; i18n.mjs compara os dicionários com o código
docs/                 a captura de tela acima; readme/, este README nos outros idiomas; notas de trabalho (fora do git)
build/                a saída da compilação; build/pages/ é o PWA para o GitHub Pages, build/extension/ a extensão
```

## Limitações

- Há suporte a KDBX 3.1 e 4.x; arquivos criptografados com Twofish e do KeePass 1 (`.kdb`), não.
- Sem sincronização, auto-type nem mesclagem de cópias alteradas.
- A extensão é só para Chrome e não tem sugestões nos campos, nem salvamento de senha ao enviar um
  formulário, nem atalho de teclado, e tem um só site por entrada.
- Só navegadores baseados em Chromium conseguem gravar o arquivo no lugar.

## Licença

MIT — veja [LICENSE](../../LICENSE). O kdbxweb e o hash-wasm também têm licença MIT.
