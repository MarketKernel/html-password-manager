# html-password-manager

<!-- languages -->
<h3 align="center">
<a href="../../README.md">🇬🇧 English</a> ·
<a href="README.zh.md">🇨🇳 中文</a> ·
<a href="README.hi.md">🇮🇳 हिन्दी</a> ·
<a href="README.es.md">🇪🇸 Español</a> ·
<b>🇫🇷 Français</b> ·
<a href="README.ar.md">🇸🇦 العربية</a> ·
<a href="README.bn.md">🇧🇩 বাংলা</a> ·
<a href="README.pt.md">🇧🇷 Português</a> ·
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

**Deterministic Password** calcule les mots de passe au lieu de se contenter de les stocker. Le
mot de passe d’un site est dérivé de votre mot de passe principal, du site, de votre nom
d’utilisateur et d’un numéro de version, avec Argon2id et HMAC-SHA-256. Si le fichier de la base
est perdu, les mêmes données redonnent les mêmes mots de passe, sur n’importe quel ordinateur —
perdre le fichier n’a plus rien d’effrayant. Pour changer le mot de passe d’un site, il suffit
d’augmenter la version. Comment ça marche : « [Mots de passe dérivés](#mots-de-passe-dérivés) ».

C’est aussi un gestionnaire de mots de passe KeePass complet : il ouvre, modifie et enregistre
des fichiers `.kdbx` ordinaires (KDBX 4, AES-256, Argon2id), si bien que la même base continue de
fonctionner dans KeePassXC, KeePass ou KeeWeb. Un mot de passe dérivé est enregistré dans
l’entrée comme n’importe quel autre, et les autres applications KeePass l’affichent de la même
façon.

Tout fonctionne hors ligne : ni compte, ni cloud, ni requêtes réseau. Toute l’application tient
dans un seul fichier HTML autonome ; la base de données est déchiffrée dans la mémoire de la page
et enregistrée directement sur le disque, et le mot de passe principal ne quitte jamais la page.
La même page est aussi une [extension Chrome](#extension-chrome) qui remplit les identifiants
dans l’onglet d’à côté —
**[installez-la depuis le Chrome Web Store](https://chromewebstore.google.com/detail/hiahfdknjchamepclnokcalkcjcfhahf)**.

**[Version en ligne](https://password.marketkernel.com/)** — la même page
en PWA (Progressive Web App) : elle peut être installée dans le système et fonctionne alors comme
une application à part, avec sa propre fenêtre et sa propre icône, même hors ligne. Sur un
ordinateur, dans Chrome, Edge et Arc, utilisez le bouton d’installation de la barre d’adresse ;
sur Android, menu ⋮ de Chrome → Installer l’application ; sur iOS, Partager → Sur l’écran
d’accueil, dans Safari ou dans Chrome. Là aussi, la base de données reste sur votre disque — voir
« [GitHub Pages](#github-pages) ».

![html-password-manager : groupes, entrées et une entrée en cours de modification](../password-manager.jpg)

## Utilisation

1. Compilez `build/password-manager.html` (voir « [Compilation](#compilation) ») et ouvrez-le
   dans un navigateur — directement depuis le disque, cela fonctionne.
2. « Ouvrir un fichier » → choisissez une base `.kdbx`, ou faites-la glisser dans la fenêtre.
3. Saisissez le mot de passe principal (et choisissez le fichier clé, si la base en a un) →
   Déverrouiller.

Dans Chrome, Edge et Arc, le fichier est ouvert via la File System Access API : les modifications
sont réécrites dans le même fichier, un instant après chaque modification si l’enregistrement
automatique est activé, et le fichier est de nouveau proposé à la visite suivante — seul son
descripteur (handle) est mémorisé, jamais son contenu ni le mot de passe. Dans Safari et Firefox,
le fichier s’ouvre en lecture seule, et Enregistrer télécharge une copie à jour de la base — de
même sur les téléphones : Chrome sur Android n’a pas File System Access, et sur iOS tous les
navigateurs, Chrome compris, utilisent le moteur de Safari. Sur iOS, Enregistrer transmet plutôt
la copie au menu Partager — voir « [Sur un téléphone](#sur-un-téléphone) ».

« Nouvelle base de données » crée une base KDBX 4 vide, chiffrée avec AES-256 et Argon2id
(64 MiB, 10 passes — les valeurs par défaut de KeePassXC, environ une demi-seconde dans un
navigateur).

### Sur un téléphone

Jusqu’à 900 pixels de large — un téléphone, ou une tablette tenue à la verticale — la page
n’affiche qu’une chose à la fois. La liste des entrées occupe l’écran ; un toucher ouvre une
entrée sur un écran qui lui est propre, et ‹ dans la barre d’outils, le bouton Retour du système
ou un balayage vers l’arrière ramènent à la liste. Une modification est conservée au retour,
comme elle l’est sur un ordinateur quand on choisit une autre entrée ; une nouvelle entrée laissée
vide est abandonnée. ☰ fait glisser les groupes, les étiquettes et la corbeille par-dessus la
liste. Les menus, le générateur et les paramètres montent depuis le bas de l’écran ; Retour les
ferme d’abord, et annule une boîte de dialogue. Le générateur, les paramètres et le verrouillage
se trouvent dans le menu ⋯ de la barre d’outils.

Un écran tactile n’a ni clic droit ni glisser-déposer : le ⋯ à côté d’un groupe ouvre le menu
qu’ouvre un clic droit sur un ordinateur, et son « Déplacer vers un groupe… » fait ce que fait un
glisser-déposer. Le menu d’une entrée, c’est son ⋯ sur l’écran de l’entrée.

Le fichier s’ouvre en lecture seule. Sur iOS, Enregistrer transmet la base mise à jour au menu
Partager, où « Enregistrer dans Fichiers » peut la mettre à la place de l’original ; fermer ce
menu laisse les modifications non enregistrées. Chrome sur Android ne partage que des images, du
son, de la vidéo et du texte : là, Enregistrer télécharge donc la copie.

Au-delà de cette largeur, et sur une tablette, les trois volets restent comme sur un ordinateur ;
un écran tactile de toute taille reçoit des boutons plus grands et le ⋯ à côté des groupes.

## Extension Chrome

**[Installer depuis le Chrome Web Store](https://chromewebstore.google.com/detail/hiahfdknjchamepclnokcalkcjcfhahf)**

`npm run build` écrit aussi `build/extension/` : la même application sous forme d’extension
Chrome, ainsi que son archive `build/password-manager-extension-<version>.zip` pour le Chrome Web
Store. Pour essayer votre propre build : `chrome://extensions` → Mode développeur → Charger
l’extension non empaquetée → `build/extension`.

L’icône de la barre d’outils ouvre une pop-up compacte : les entrées du site de l’onglet, un clic
sur l’une d’elles pour la remplir, des boutons pour copier son nom d’utilisateur, son mot de passe
ou son code à usage unique, et une recherche dans toute la base. **Mode complet**, en bas, ouvre
l’application dans le panneau latéral de Chrome, à côté de la page — dans la disposition pour
téléphone, puisqu’un panneau est étroit — où elle reste d’un onglet à l’autre. Tout y fonctionne
comme dans le fichier ; ce que l’extension ajoute, c’est le remplissage des identifiants :

- **La pop-up** déverrouille, avec le seul mot de passe principal, le dernier fichier ouvert par
  le panneau : c’est le panneau qui choisit les fichiers et les fichiers clés, et qui effectue
  toutes les modifications. Sur un site sans entrée, son bouton **Nouveau mot de passe** ouvre le
  panneau sur le générateur, comme le fait Remplir dans le menu.
- **Remplir**, dans le menu contextuel d’une page (un clic droit sur la page ou dans un champ),
  remplit le nom d’utilisateur et le mot de passe de l’entrée du site de l’onglet — ou son code à
  usage unique, à l’étape d’une connexion qui en demande un. S’il y a une seule entrée pour le
  site, il remplit aussitôt, panneau ouvert ou non ; s’il y en a plusieurs, aucune, ou si la base
  est verrouillée, il ouvre le panneau pour en choisir une, créer un mot de passe ou déverrouiller
  — et poursuit à partir de là. Une connexion en deux étapes (Google, Microsoft) reçoit le nom
  d’utilisateur à la première et le mot de passe à la seconde : l’entrée choisie pour l’onglet
  est mémorisée. Le bouton **Remplir** d’une entrée dans le panneau remplit cette entrée dans
  l’onglet.
- **La base reste ouverte** quand le panneau se ferme, jusqu’à son verrouillage : après le délai
  d’inactivité défini dans les paramètres, quand l’écran de l’ordinateur se verrouille, depuis le
  panneau, depuis la pop-up, ou via **Verrouiller** dans le menu de l’icône de la barre d’outils.
  Rouvert, le panneau la reprend sans mot de passe, et la pop-up l’affiche aussitôt.
- **Pour ce site**, en haut du panneau des groupes, liste les entrées du site de l’onglet, et la
  liste s’ouvre dessus ; elle suit l’onglet.
- **Un nouveau mot de passe pour une page.** Sur un site sans entrée, Remplir ouvre le générateur
  Dérivé v3 avec le site de l’onglet et le nom d’utilisateur saisi sur la page. Son bouton Remplir
  insère le mot de passe — dans les deux champs d’un formulaire d’inscription — et le conserve
  comme une entrée ordinaire.

Une entrée convient à un onglet quand son site web désigne exactement le site de l’onglet : les
deux adresses passent par `siteOf()` du générateur 3 — sans schéma, port, chemin ni `www.`, IDN
en punycode. `google.com` ne convient pas à `accounts.google.com`, ni `mail.site.com` à
`site.com`. Une entrée en `https://`, ou sans schéma, n’est jamais remplie dans une page
`http://` : un site utilisé en http doit avoir `http://` dans son site web. Les entrées de la
corbeille ne sont pas proposées, et une entrée choisie à la main pour un autre site n’est remplie
qu’après un avertissement qui nomme les deux.

**Comment c’est fait.** Le panneau est la page elle-même : `panel.html`, avec son script dans
`panel.js`, comme le veut Manifest V3. À chaque déverrouillage et à chaque enregistrement, il
transmet le fichier et sa clé — le mot de passe dans un `ProtectedValue`, le fichier clé — à un
document offscreen, qui les garde en mémoire, ainsi qu’une copie en lecture seule de la base
déchiffrée à partir d’eux, jusqu’au verrouillage ; verrouiller ferme ce document, et la clé
disparaît avec lui. Rien n’est écrit nulle part. Le service worker gère les menus. Un clic sur
Remplir ne peut ouvrir le panneau qu’avant toute attente asynchrone, donc le worker doit savoir
immédiatement s’il peut remplir : il garde les sites web des entrées — pas de noms, pas de mots de
passe — tels que le document offscreen les lui envoie, et le document offscreen le maintient en
activité. La pop-up (`popup.html`, `popup.js`) ne déchiffre rien : elle demande au document
offscreen les titres et noms d’utilisateur qui conviennent à l’onglet, puis l’entrée cliquée ; si
la base est verrouillée, elle lit le fichier récent et le transmet, avec le mot de passe, à ce
document pour qu’il l’ouvre.

**Ce qui parvient à une page.**

- Seulement ce qu’un clic demande, et seulement les valeurs d’une seule entrée. Aucun content
  script ne s’exécute nulle part : au clic, `chrome.scripting.executeScript` demande d’abord à
  chaque cadre de l’onglet où il se trouve et quels champs de connexion il contient, sans envoyer
  aucune valeur ; ensuite seuls les cadres du site de l’entrée les reçoivent, et la fonction
  vérifie de nouveau sa propre adresse avant de saisir quoi que ce soit. Un cadre d’un autre site
  sur la même page ne reçoit rien.
- Seuls les champs qu’une personne peut voir sont remplis : affichés, activés, modifiables, d’une
  taille non nulle, à l’intérieur de la fenêtre. Un champ caché pour servir de piège reste vide.
- Les valeurs sont définies depuis le monde isolé de l’extension, en contournant tout setter
  qu’une page place sur ses champs, et des événements `input` et `change` en informent React, Vue
  ou Angular.
- Le mot de passe principal, les autres entrées et la liste des sites ne vont jamais à une page.

**Autorisations.** `activeTab` plutôt que tous les sites : un clic sur l’icône ou sur Remplir
donne à l’extension cet onglet-là. C’est pourquoi le panneau s’ouvre depuis la pop-up ou le menu,
jamais par le réglage propre de Chrome (`openPanelOnActionClick`) : un panneau ouvert ainsi ne
reçoit aucun onglet. Remplir dans le panneau, sur un onglet qui ne lui a pas été donné, demande
une fois l’accès au site de l’entrée (`optional_host_permissions`). `contextMenus`, `scripting`
et `sidePanel` pour ce qui précède, `offscreen` pour le document, `idle` pour le verrouillage de
l’écran, `clipboardWrite` pour effacer un secret copié quand le panneau est fermé. Il n’y a pas de
`externally_connectable` : les parties de l’extension communiquent via `chrome.runtime`, et
chacune n’accepte de messages que des pages de l’extension elle-même. Ses pages ont
`connect-src 'none'`, comme le fichier ; la compilation le vérifie, et vérifie aussi qu’aucune
page n’a de script inline ni d’adresse extérieure.

Une différence avec le fichier : rouvert, le panneau n’écrit la base sur place que si Chrome
l’autorise encore ; sinon, la barre d’état le signale, et le premier Enregistrer demande
l’autorisation.

## Sécurité

- **Rien ne quitte la page.** Une Content-Security-Policy dans le fichier interdit toute requête
  réseau, tout envoi de formulaire et toute ressource extérieure ; la compilation échoue si la
  politique disparaît ou si une référence externe apparaît. La copie de la PWA laisse passer trois
  choses de plus, toutes depuis sa propre origine : le manifeste, le service worker et les
  icônes — `connect-src` reste `'none'`.
- Le code du format est [kdbxweb](https://github.com/keeweb/kdbxweb), la bibliothèque sur
  laquelle KeeWeb est construit ; Argon2 est le WebAssembly de
  [hash-wasm](https://github.com/Daninet/hash-wasm), lui aussi intégré au fichier.
- Les champs protégés sont conservés en mémoire masqués par XOR (le `ProtectedValue` de kdbxweb)
  et masqués à l’écran jusqu’à ce qu’on les affiche. La recherche ne regarde jamais dans les
  champs protégés.
- **Des mots de passe dans toutes les langues.** Quand un navigateur prend un champ pour un mot de
  passe, macOS active Secure Input et impose une disposition de clavier latine, si bien qu’un mot
  de passe principal en cyrillique ne peut pas être saisi. Chrome considère comme mot de passe non
  seulement `type=password`, mais aussi, par heuristique, tout champ stylé avec
  `-webkit-text-security` ou contenant une suite de points — et continue ainsi une fois qu’il l’a
  fait. Ici, les champs secrets ne donnent aucun indice de ce genre : ce sont de simples champs de
  texte au texte transparent, sur lesquels une couche de points est dessinée (dans une police à
  chasse fixe, pour que le curseur reste en place). Un badge indique si le texte caché est saisi
  en cyrillique (РУС) ou en latin (ENG). La contrepartie : Secure Input, qui cache aussi les
  frappes aux autres applications, n’est jamais activé.
- Un secret copié est effacé du presse-papiers au bout de 30 secondes et au verrouillage.
- La base se verrouille après 15 minutes d’inactivité, et sur `⌘L`. Le verrouillage retire de la
  mémoire la base déchiffrée ; un verrouillage avec des modifications non enregistrées qui ne
  peuvent pas être écrites attend au lieu de jeter ces modifications.
- Les liens des entrées ne s’ouvrent que pour `http`, `https`, `ftp` et `mailto`, avec
  `noopener`.
- Les mots de passe sont générés avec `crypto.getRandomValues` et un échantillonnage par rejet :
  chaque caractère est équiprobable.

## Fonctionnalités

- **Groupes** : une arborescence repliable ; création, renommage et suppression via le menu
  contextuel ; déplacement par glisser-déposer (entrées et groupes) ; panneau redimensionnable et
  masquable (`⌘\`).
- **Entrées** : titre, nom d’utilisateur, mot de passe, site web, notes, champs personnalisés (en
  clair ou protégés), étiquettes, date d’expiration, pièces jointes. Tri par titre, nom
  d’utilisateur, site web, dates.
- **Codes à usage unique** (TOTP) : depuis un champ `otp` (URL `otpauth://` ou secret seul, comme
  les stockent KeePassXC et KeeWeb), depuis les champs `TimeOtp-*` de KeePass, ou depuis le
  `TOTP Seed` de TrayTOTP. SHA-1, SHA-256, SHA-512 ; le code se renouvelle avec un compte à
  rebours. **+ Code à usage unique** dans l’éditeur accepte la clé de configuration qu’un site
  affiche à côté de son code QR (ou un lien `otpauth://`) et affiche aussitôt le code, pour le
  confirmer sur le site ; une clé seule est enregistrée sous forme de lien `otpauth://`, la forme
  que lit KeePassXC.
- **La modification** se fait sur un brouillon : Enregistrer place d’abord l’état précédent dans
  l’historique de l’entrée, comme le fait KeePass ; Annuler abandonne le brouillon. Les versions
  antérieures peuvent être parcourues et restaurées.
- **Corbeille** : supprimer déplace vers la corbeille ; de là — restaurer ou supprimer
  définitivement.
- **Recherche** dans le titre, le nom d’utilisateur, le site web, les notes, les étiquettes, les
  champs personnalisés et les noms des pièces jointes ; chaque mot de la requête doit
  correspondre.
- **Générateur de mots de passe** (le dé, `⌘G`) : il crée un mot de passe du type choisi dans sa
  liste, la dérivation la plus récente en premier ; le dernier choix est mémorisé :
  - **Dérivé v3** — calculé à partir du mot de passe principal, du nom d’utilisateur, du site et
    d’une version, il peut donc être recalculé sans le fichier — voir
    « [Mots de passe dérivés](#mots-de-passe-dérivés) » ;
  - **Dérivé v2** et **Dérivé v1** — les calculatrices de deux programmes plus anciens (ancien 2
    et ancien 1), proposées quand Paramètres → « Afficher les anciens algorithmes de mots de
    passe » est activé — voir « [Anciens algorithmes](#anciens-algorithmes) » ;
  - **Aléatoire** — longueur, jeux de caractères, caractères semblables, estimation de
    l’entropie.

  Indicateur de robustesse pour les mots de passe saisis.
- **Base de données** : renommer, changer le mot de passe principal et le fichier clé, enregistrer
  une copie.
- **Langues** : English, 中文, हिन्दी, Español, Français, العربية, বাংলা, Português, Русский,
  اردو, Bahasa Indonesia, Deutsch, 日本語, मराठी, తెలుగు, Türkçe — les seize les plus parlées —
  et Українська. Choisie dans les Paramètres, ou reprise du navigateur ; l’arabe et l’ourdou
  disposent la fenêtre de droite à gauche.
- **Thème** : système, clair, sombre, dans les Paramètres. La langue, le thème, la largeur des
  panneaux, le tri, les options du générateur et les groupes repliés sont mémorisés.

## Mots de passe dérivés

**Dérivé v3** dans le générateur calcule un mot de passe à partir de

- le mot de passe principal de la base (le fichier clé, s’il y en a un, n’est pas pris en
  compte), ou un autre saisi à cet endroit,
- le nom d’utilisateur,
- le site — le domaine sur lequel se trouve le compte (`https://www.github.com/login` →
  `github.com`),
- la version — 1, 2, … jusqu’à 2³² − 1 ; « +1 » donne un nouveau mot de passe au même compte.

Ces quatre éléments donnent 32 octets d’entropie. Les exigences — longueur, jeux de caractères,
caractères semblables — ne font que mettre ces octets en forme de caractères : les changer ne
change pas l’entropie. **Utiliser** place le résultat dans l’entrée comme un mot de passe
enregistré ordinaire. Rien de la façon dont il a été obtenu n’est conservé : l’entrée est comme
toutes les autres, et les autres applications KeePass affichent le même mot de passe. Si le
fichier est perdu, les mêmes mot de passe principal, nom d’utilisateur, site, version et
exigences redonnent le même mot de passe sur n’importe quelle machine. Par défaut : 20
caractères, les quatre jeux de caractères, sans caractères semblables ; un mot de passe créé avec
d’autres réglages oblige à s’en souvenir aussi.

Le générateur demande d’abord le nom d’utilisateur — depuis une entrée, celui de l’entrée : ce qui
y est saisi apparaît aussi dans le formulaire — puis le site ; les deux sont obligatoires, et le
mot de passe qu’ils donnent se trouve en bas, au-dessus de **Utiliser**.

- Un nom d’utilisateur qui est une adresse e-mail désigne son site : `test@site.com` remplit
  `site.com`, et le site web de l’entrée reste tel quel — il peut très bien être
  `mail.site.com`. La même adresse sert pourtant à se connecter à de nombreux sites, et le
  générateur le rappelle sous le champ : pour GitHub avec `test@gmail.com`, tapez `github.com` à
  la place du `gmail.com` qu’il y a mis.
- Tout autre nom d’utilisateur demande de saisir le site, et depuis une entrée, ce qui est saisi
  devient aussi son site web. Le site web que l’entrée possède déjà est rempli au départ.

Dans ce qui est saisi comme site, le schéma, le chemin, le port et un `www.` initial ne comptent
pas ; un sous-domaine, si — `login.github.com` et `github.com` sont deux sites différents. Un site
qui n’est pas une URL (« Ma banque ») est utilisé tel quel. Depuis la barre d’outils, le
générateur fonctionne de la même façon, avec ses propres champs, et copie le résultat.

« Utiliser le mot de passe principal de la base » est coché à chaque ouverture du générateur.
Décochez-le pour dériver d’un autre mot de passe principal, saisi à cet endroit et conservé nulle
part — pour retrouver un mot de passe créé dans une autre base, ou avant que le mot de passe
principal ait été changé. Changer ce dernier laisse tels quels les mots de passe du fichier ;
seul ce que le générateur calcule ensuite diffère.

### L’algorithme : générateur 3

Tout ce qui suit est figé : changer la moindre constante rendrait impossible de recalculer chaque
mot de passe créé avec. Un futur générateur viendrait comme un nouveau type dans la liste et
laisserait celui-ci tel quel. Le code se trouve dans `src/core/derived.ts` ; `npm test` le vérifie
avec des vecteurs fixes et avec une implémentation indépendante, écrite d’après cette description
avec le `crypto` de Node. Les primitives sont standard — SHA-256, HMAC-SHA-256, Argon2id — donc
l’algorithme peut être reproduit dans n’importe quel langage.

Il fonctionne en deux étapes : les secrets deviennent 32 octets d’entropie, puis les exigences
taillent des caractères dans ces octets.

**Étape 1 — l’entropie.**

1. *Normaliser les données d’entrée.* Toutes les chaînes sont en UTF-8.
   - `site` — l’hôte de ce qui a été saisi comme site : le texte analysé comme une URL WHATWG
     (`https://` est ajouté devant quand le texte n’a pas de `scheme://`) : en minuscules, IDN en
     punycode, sans port, sans nom d’utilisateur ni mot de passe, un `www.` initial retiré ; un
     texte qui ne s’analyse pas comme une URL est utilisé tel quel. Ensuite, espaces de début et
     de fin retirés, normalisation NFC, passage en minuscules.
   - `user` — le nom d’utilisateur, espaces de début et de fin retirés, normalisé en NFC ; la
     casse est conservée.
   - `master` — le mot de passe principal, normalisé en NFC, sans rien retirer. Un « é » tapé
     comme un seul caractère ou comme « e » suivi d’un accent combinant donne le même mot de
     passe.
2. *Sel.*
   ```
   salt = SHA-256( "html-password-manager/derived/v3" ‖ 0x00
                   ‖ u32be(byte length of site) ‖ site
                   ‖ u32be(byte length of user) ‖ user
                   ‖ u32be(version) )
   ```
   Les préfixes de longueur distinguent `ab` + `c` de `a` + `bc` ; le libellé distingue ces
   octets de tout autre usage des mêmes données. `u32be` est un entier de 4 octets big-endian.
3. *Étirement.*
   ```
   entropy = Argon2id(password = master, salt, memory = 64 MiB, passes = 3,
                      lanes = 1, version 0x13, output = 32 bytes)
   ```
   Argon2id fait coûter 64 MiB de mémoire à chaque essai du mot de passe principal, ce qui
   ralentit les GPU et les ASIC. Comme le site, le nom d’utilisateur et la version sont dans le
   sel, chaque compte a le sien : aucune table ne peut être calculée à l’avance, et chaque compte
   doit être attaqué séparément.

**Étape 2 — la mise en forme.** Les exigences ne servent qu’ici : elles changent l’apparence du
mot de passe, pas l’entropie qui se trouve derrière.

4. *Un flux d’octets aléatoires*, aussi long que nécessaire — 32 octets ne suffisent pas pour un
   long mot de passe et son mélange :
   ```
   block(i) = HMAC-SHA-256(key = entropy, "hpm-v3-stream" ‖ u32be(i)),  i = 0, 1, 2, …
   ```
5. *Un nombre sans biais inférieur à n.* Prendre les 4 octets suivants du flux comme un u32
   big-endian `x`. Si `x ≥ 2³² − (2³² mod n)`, l’écarter et prendre le suivant ; sinon, le
   résultat est `x mod n`. (Un simple `x mod n` favoriserait le début de l’alphabet.)
6. *Caractères.* Les jeux, dans cet ordre, chacun seulement s’il est choisi :
   ```
   A–Z      ABCDEFGHIJKLMNOPQRSTUVWXYZ
   a–z      abcdefghijklmnopqrstuvwxyz
   0–9      0123456789
   symbols  !#$%&*+-=?@^_~.,:;()[]{}<>/|
   ```
   Sans caractères semblables, `O 0 o I l 1 |` en sont retirés. Ensuite :
   ```
   chars = []
   for each chosen set:            chars.push(set[draw(|set|)])      # every set is present
   while |chars| < length:         chars.push(all[draw(|all|)])      # all = the sets joined
   for i = length − 1 down to 1:   j = draw(i + 1); swap chars[i], chars[j]   # Fisher–Yates
   password = chars joined
   ```
   La longueur va de 4 à 128. C’est le fait de prendre d’abord un caractère dans chaque jeu qui
   garantit « contient un chiffre » et « contient un symbole » ; le mélange cache où ces
   caractères se sont retrouvés.

**Vecteur de test.** Mot de passe principal `Тестовый пароль`, site `https://www.github.com/login`
(`github.com`), nom d’utilisateur `me@example.com`, version 1, les exigences par défaut
(20 caractères, les quatre jeux, sans caractères semblables) :

```
password  A6qVXXF]7<%a)aa<x7*U
```

La même entropie avec 12 caractères et sans symboles donne `yaM6VJaJFYUQ` ; la version 2 avec
les valeurs par défaut donne `3q_bwppbE8P2+ufKr:P6`.

### Quelle est sa robustesse

- Un mot de passe dérivé a au plus 256 bits d’entropie (les 32 octets) ; 20 caractères des quatre
  jeux sans caractères semblables font environ 128 bits. En pratique, le plafond est le mot de
  passe principal.
- **Le point faible de tout schéma de mots de passe dérivés :** un mot de passe divulgué par un
  site permet à un attaquant de deviner le mot de passe principal hors ligne, puisque le site et
  le nom d’utilisateur sont connus. Chaque essai coûte une exécution d’Argon2id sur 64 MiB —
  environ 0,15 à 0,4 s dans un navigateur, moins sur du matériel dédié. Un mot de passe principal
  court ou courant sera trouvé ; une longue phrase de passe, non. Les mots de passe aléatoires
  n’ont pas cette faiblesse, c’est pourquoi le générateur propose les deux.
- Tant que le mot de passe principal tient, un mot de passe divulgué ne révèle rien des autres
  sites ni des autres versions : ils proviennent d’autres sels, donc d’autres exécutions
  d’Argon2.

Le mot de passe principal est conservé en mémoire, masqué par XOR, tant que la base est ouverte,
avec l’entropie calculée jusque-là ; le verrouillage efface les deux.

## Anciens algorithmes

Deux anciens programmes Windows calculaient des mots de passe à partir de phrases secrètes ;
**Dérivé v1** (ancien 1) et **Dérivé v2** (ancien 2) dans le générateur les reproduisent exactement, afin qu’on puisse
retrouver les mots de passe créés avec eux. Ce sont des calculatrices : rien de ce qui y est
saisi n’est enregistré, les phrases disparaissent à la fermeture du générateur, et **Utiliser**
place le résultat dans l’entrée comme un mot de passe enregistré ordinaire. Paramètres →
« Afficher les anciens algorithmes de mots de passe » les fait apparaître.

Ouverts depuis une entrée, les deux proposent l’identifiant : un nom d’utilisateur qui désigne
déjà son site (`mail@site.com`) tel quel, sinon le nom d’utilisateur, `@` et le site sans `www.`
(`dmytro@github.com`) ; on peut le modifier. Chaque phrase — la clé principale et la clé
secondaire, la phrase secrète primaire et la phrase secrète secondaire — a sa propre case
« Retenir jusqu’au verrouillage de la base » : une phrase dont la case est cochée est gardée dans
la mémoire de la page, masquée par XOR, et remplie la fois suivante ; quand la première phrase est
gardée, la clé est calculée aussitôt. Les deux peuvent aussi prendre comme première phrase le mot
de passe principal de la base elle-même — celui qui l’a déverrouillée —, c’est-à-dire la clé
principale d’ancien 1 ou la phrase secrète primaire d’ancien 2 (« Utiliser le mot de passe
principal de la base », mémorisé dans les paramètres pour chacun d’eux) : ce champ et sa case sont
alors désactivés. Rien de tout cela n’est
écrit sur le disque ; verrouiller,
fermer la base ou désactiver les anciens algorithmes efface tout. Le code se trouve dans
`src/core/legacy.ts` ; `npm test` le vérifie avec des vecteurs calculés par les programmes .NET d’origine.

**Ancien 1** — clé principale, identifiant, clé primaire, clé secondaire, résultat :

```
short(bytes) = Base64(bytes) without "=", "/", "+", first 10 characters
primary key  = short(SHA-1 applied 1 000 000 times to UTF-8(master key ‖ identifier))
result       = short(SHA-1(UTF-8(primary key ‖ secondary key)))
```

La clé primaire est liée à l’identifiant et peut être conservée à part (sur papier), si bien que
la clé principale n’a besoin d’être saisie nulle part : la clé primaire peut être entrée
directement. La clé secondaire fait qu’une note volée ne sert à rien à elle seule.

**Ancien 2** (Password.Generator 1.0) — protection primaire : identifiant, phrase secrète
primaire, longueur de la clé, jeux de caractères ; protection secondaire : la clé, phrase secrète
secondaire, version du mot de passe, longueur du mot de passe, jeux de caractères :

```
digest(a, b, v, n) = SHA-1 applied n times to UTF-8(a) ‖ UTF-8(b) ‖ (v > 0 ? u32le(v) : nothing)
key                = select(digest(identifier, primary phrase, 1, 100 000), key length + 2)
password           = select(digest(key, secondary phrase, version, 1), password length + 2)
```

`select` lit le condensé comme cinq u32 little-endian, met à 1 le bit de poids fort de chacun,
l’écrit en base N de l’alphabet — `!#$%&'()+,-.` (si choisis), chiffres (toujours), A–Z, a–z (si
choisies) — chiffre de poids faible en premier, garde 5 caractères de chacun et coupe à la
longueur (1–18). Les deux premiers caractères sont une signature à comparer à l’œil avec celle
qu’affichait le programme ; le reste est la clé ou le mot de passe. La version de la clé est
toujours 1 : le programme n’a pas de champ pour elle. L’identifiant `1`, la phrase `1`, la
longueur 10, les chiffres et les lettres donnent la clé `E8 8pgYm9fZha`.

Les deux sont bien plus faibles que la version 3 : un essai sur les phrases coûte à un attaquant
quelques exécutions de SHA-1 au lieu d’une exécution d’Argon2id sur 64 MiB, et un résultat
d’ancien 1 fait 10 caractères, soit environ 60 bits. Utilisez-les pour retrouver d’anciens mots
de passe, pas pour en créer de nouveaux.

## Raccourcis clavier

| Action | Touches |
| --- | --- |
| Enregistrer | `⌘S` |
| Verrouiller | `⌘L` |
| Rechercher | `⌘F` |
| Nouvelle entrée | `⌘N` |
| Modifier · enregistrer la modification | `⌘E` ou `Enter` · `⌘Enter` |
| Annuler la modification | `Esc` |
| Générateur de mots de passe | `⌘G` |
| Copier le mot de passe · le nom d’utilisateur · le site web | `⌘C` · `⌘B` · `⌘U` |
| Entrée précédente · suivante | `↑` · `↓` |
| Supprimer l’entrée | `⌫` |
| Panneau des groupes | `⌘\` |

## Traductions

Le texte anglais reste dans le code : `t('menu', 'Delete')`, `tn('status', '{count} entry',
'{count} entries', n)`, et `data-i18n="context"` / `data-i18n-attr="context"` dans le
template. Le premier argument est le contexte — la partie de l’interface à laquelle appartient
une chaîne, pour qu’un même mot anglais puisse être traduit différemment à deux endroits. Un
dictionnaire, `src/locales/<code>.json`, associe contexte → texte anglais → traduction :

```json
{
  "menu": { "Delete": "Удалить" },
  "status": { "{count} entries": { "one": "{count} запись", "few": "{count} записи", "many": "{count} записей", "other": "{count} записи" } }
}
```

Une chaîne absente du dictionnaire s’affiche en anglais. Un texte contenant un nombre a une forme
par catégorie de pluriel de la langue (`Intl.PluralRules`), indexée par la forme plurielle
anglaise. `npm run i18n` liste, pour chaque langue, les chaînes pas encore traduites et celles qui
ne sont plus utilisées ; `npm test` vérifie que chaque traduction conserve les placeholders
anglais et possède toutes les formes de pluriel.

Ce que Chrome affiche de l’extension elle-même — son nom et sa description, le titre du bouton de
la barre d’outils — suit la langue du navigateur plutôt que celle du panneau, via `chrome.i18n`.
Ces textes sont ceux, en anglais, de `src/extension/manifest.json`, traduits dans les mêmes
dictionnaires sous le contexte `manifest` ; la compilation les écrit dans
`_locales/<code>/messages.json` et place `__MSG_appName__` et consorts dans le manifeste.
Chrome a ses propres codes et ignore les autres : `pt` devient `pt_BR` et `pt_PT`, `zh`
devient `zh_CN`, et l’ourdou n’en a pas, si bien que Chrome y nomme l’extension en anglais. La
compilation s’arrête sur un nom de plus de 75 caractères ou une description de plus de 132.

Ce README est lui aussi traduit : `docs/readme/README.<code>.md`, un par langue, avec la liste
des langues en haut de chacun. Une modification ici doit aussi être reportée dans les
traductions.

## Compilation

```sh
./build.sh         # installs the dependencies if needed, then builds build/password-manager.html
npm install
npm run build      # -> build/password-manager.html
npm run watch      # rebuild on changes in src/
npm run typecheck  # tsc --noEmit
npm test           # opening, editing and saving .kdbx files, the generator, TOTP, derived passwords, matching tabs, the dictionaries
npm run test:browser  # the built page and the extension in headless Chrome
npm run i18n       # strings each dictionary lacks or no longer needs
npm run check      # typecheck, test, build and test:browser in a row
npm run shots -- shots/after  # build, then screenshots of the main screens into shots/after
```

`build.mjs` regroupe `src/app/main.ts` avec esbuild en une IIFE et l’insère, avec les styles et
l’icône (une data URI), dans `src/app/template.html`. Les solutions de repli de kdbxweb pour Node
(`crypto`, `@xmldom/xmldom`) sont remplacées par des stubs vides — un navigateur dispose de
`crypto.subtle` et de `DOMParser`. Le résultat est `build/password-manager.html`, environ 500 Ko, dont un quart pour les dictionnaires.

La même exécution écrit `build/pages/` : cette page en PWA installable — `index.html` avec un
lien vers le manifeste et un `<meta name="service-worker">` qui indique à la page d’enregistrer
son service worker, `manifest.webmanifest`, les icônes
et `sw.js`, qui met la page en cache pour qu’elle s’ouvre hors ligne. `build/password-manager.html`
lui-même reste un fichier unique, sans aucune référence externe.

Et `build/extension/` : `panel.html` est le template avec son script dans `panel.js` — le même
`src/app/main.ts`, avec `src/extension/extension.ts` à la place de `src/app/platform.ts`, dont les hooks ne font rien
dans le fichier — à côté de `popup.html` (avec les styles de la page et `popup.css`) et de `popup.js`,
`background.js`, `offscreen.html` et `offscreen.js`, les icônes et
`manifest.json`, dont la version est celle de `package.json`. `build/password-manager-extension-<version>.zip`
contient les mêmes fichiers, avec des dates fixes : les mêmes sources donnent les mêmes octets.

`tests/extension.mjs` charge cette extension dans Chrome headless via le protocole DevTools
(`Extensions.loadUnpacked` par un pipe ; `--load-extension` a disparu de Chrome depuis la
version 137) et remplit des sites de test sur un serveur local : un formulaire simple, un
formulaire à la React, une connexion en trois étapes avec un code à usage unique, des cadres du
site lui-même et d’un autre site, des champs cachés servant de pièges, une page http pour une
entrée https, une inscription remplie avec un mot de passe Dérivé v3 — panneau fermé, et après le
verrouillage ; et la pop-up, qui déverrouille, remplit, recherche, copie et verrouille. Un menu
contextuel ne peut pas être cliqué depuis
DevTools, le test déclenche donc lui-même le `onClicked` du worker ; sans vrai clic, Chrome
n’accorde pas `activeTab`, si bien que la copie testée peut atteindre les sites de test, `*.test`,
au titre d’autorisations d’hôte. L’icône de la barre d’outils peut être cliquée depuis DevTools
(`Extensions.triggerAction`) : un Chrome à part, avec l’extension telle que compilée, vérifie que
le clic donne l’onglet à la pop-up. Chrome headless 153 plante sur ce clic, quelle que soit
l’extension, et la vérification est alors sautée ; Chrome for Testing l’exécute
(`CHROME=/path/to/chrome-for-testing npm run test:browser`).

`tests/fixtures/Database.kdbx` est une base d’exemple pour les tests ; son mot de passe est `Тестовый пароль`.

## Versions et publications

La version est écrite à un seul endroit, `package.json`. La compilation l’inscrit dans la page (la
ligne sous l’écran d’ouverture, le bas des paramètres), dans le `manifest.json` de l’extension et
dans le nom du cache de la PWA. Une compilation du commit marqué du tag `v<version>` l’affiche
telle quelle ; toute autre y ajoute son commit, `0.8.0+1a2b3c4`, pour qu’une page de `main` sur
GitHub Pages ne soit pas prise pour la version publiée. Le champ `version` de Chrome ne contient
que des nombres : le commit va donc dans `version_name`.

```sh
npm version minor           # 0.7.2 -> 0.8.0: package.json, package-lock.json, a commit and the tag v0.8.0
git push --follow-tags      # the tag starts .github/workflows/release.yml
```

Le workflow de publication s’arrête si le tag et `package.json` ne concordent pas, puis joint
`password-manager-<tag>.html`, `password-manager-extension-<tag>.zip` et `SHA256SUMS.txt`.

## GitHub Pages

`.github/workflows/pages.yml` compile et teste chaque push sur `main` et déploie
`build/pages/` sur GitHub Pages (Settings → Pages → Source: GitHub Actions), à l’adresse
<https://password.marketkernel.com/>. Les fichiers s’ouvrent de la même façon
que dans le fichier unique ; les fichiers récents, les paramètres et les descripteurs mémorisés
appartiennent à cette adresse, séparément de ceux d’une copie ouverte depuis le disque.

Chaque déploiement change le nom du cache dans `sw.js`, si bien que le navigateur récupère de
lui-même le nouveau service worker — au lancement avec une connexion, ou quand Paramètres →
Vérifier les mises à jour le demande. Le nouveau service worker télécharge sa version dans un
cache à lui et attend ; celui en cours continue de servir l’ancienne page, hors ligne aussi.
Les paramètres et l’écran de déverrouillage disent alors « La version … est prête. Mettre à
jour » : Mettre à jour verrouille la base (en l’enregistrant, ou en le demandant, comme tout
verrouillage), laisse entrer le nouveau service worker et recharge la page. Sans le bouton, la
nouvelle version démarre d’elle-même une fois toutes les fenêtres de l’application fermées.
C’est aussi la contrepartie : une PWA installée exécute ce que le dernier déploiement y a mis, tandis
qu’un fichier téléchargé reste à sa version. Pour une version figée sur le disque, prenez
`password-manager-<tag>.html` dans une release et comparez-le avec `SHA256SUMS.txt`.

`npm run test:browser` ouvre aussi `build/pages/` : le service worker prend la page en charge,
Chrome trouve le manifeste installable, et une fois le serveur arrêté, la page se charge encore et
déverrouille la base d’exemple ; puis un nouveau déploiement est trouvé, attend, et Mettre à jour
le laisse entrer.

## Structure du projet

```
src/core/             sans DOM : les tests l’exécutent dans Node
  kdbx.ts             kdbxweb + Argon2 : ouvrir, enregistrer, créer ; champs, groupes, corbeille
  generator.ts        générateur de mots de passe et estimation de la robustesse
  derived.ts          mots de passe dérivés : générateur 3, le site d’une adresse e-mail, le mot de passe principal de la session
  site.ts             siteOf() : le site d’un site web, pour le générateur 3 et pour associer les onglets
  legacy.ts           les anciens algorithmes : ancien 1 et ancien 2
  otp.ts              TOTP (RFC 6238) et les façons dont les secrets sont stockés
  match.ts            quelles entrées conviennent à un onglet
  i18n.ts             t()/tn(), la liste des langues, la traduction du balisage de la page
src/app/              la page : le fichier unique, la PWA et le panneau latéral de l’extension
  template.html       balisage avec les placeholders __STYLES__/__APP__/__ICON__, la CSP ; aussi le panel.html de l’extension
  styles.css          palette, thèmes clair et sombre, trois volets ; un seul écran à la fois sur téléphone
  main.ts             l’écran d’ouverture, déverrouillage, enregistrement, verrouillage, barre d’outils, raccourcis, paramètres
  files.ts            File System Access API, glisser-déposer, sélecteur de fichier ; fichiers récents
  groups.ts           l’arborescence des groupes, les étiquettes et la corbeille dans le panneau de gauche
  list.ts             la liste des entrées
  details.ts          une entrée : lecture, modification sur brouillon, historique, pièces jointes, TOTP
  search.ts           recherche, tri, liens sûrs
  genpanel.ts         le popover du générateur : aléatoire, version 3, ancien 1 et 2
  clipboard.ts        copie avec effacement différé
  avatar.ts           icônes des entrées : icônes personnalisées de la base ou une lettre colorée
  settings.ts         localStorage : langue, thème, panneaux, délais de verrouillage et du presse-papiers
  ui.ts               boîtes de dialogue, menu contextuel, popovers, notifications, icônes ; feuilles sur téléphone
  screens.ts          la disposition pour téléphone : la liste ou l’entrée, le tiroir des groupes, le bouton Retour
  platform.ts         ce que la page fait au-delà d’elle-même : rien, dans le fichier et la PWA
  update.ts           les mises à jour de la PWA : enregistre sw.js, trouve une version en attente, la laisse entrer
src/extension/        l’extension Chrome
  manifest.json       son manifeste ; la compilation y ajoute la version
  extension.ts        platform.ts du panneau latéral : le document offscreen, l’onglet, Remplir
  popup.ts            la pop-up de l’icône de la barre d’outils (popup.html, popup.css) : les entrées du site, Mode complet
  background.ts       le service worker : les menus, le verrouillage de l’écran, le remplissage d’un onglet
  offscreen.ts        le document offscreen (offscreen.html) : la base ouverte jusqu’au verrouillage
  fill.ts             la fonction injectée dans une page : trouve les champs de connexion et les remplit
  messages.ts         comment communiquent les parties de l’extension
src/pwa/sw.js         le service worker de la version Pages
src/locales/          un dictionnaire par langue
assets/               l’icône ; pwa/, ses tailles PNG pour la PWA ; extension/, l’icône de l’extension
tests/                allers-retours .kdbx, générateur et TOTP, mots de passe dérivés, anciens algorithmes, association des onglets,
                      dictionnaires, la page et l’extension dans Chrome headless ; fixtures/, la base d’exemple
tools/                load.mjs compile les modules de src/ pour les tests ; i18n.mjs compare les dictionnaires au code
docs/                 la capture d’écran ci-dessus ; readme/, ce README dans les autres langues ; notes de travail (hors git)
build/                le résultat de la compilation ; build/pages/ est la PWA pour GitHub Pages, build/extension/ l’extension
```

## Limites

- KDBX 3.1 et 4.x sont pris en charge ; les fichiers chiffrés avec Twofish et ceux de KeePass 1
  (`.kdb`) ne le sont pas.
- Pas de synchronisation, de saisie automatique (auto-type) ni de fusion de copies modifiées.
- L’extension est réservée à Chrome, et n’offre ni suggestions dans les champs, ni enregistrement
  d’un mot de passe à l’envoi d’un formulaire, ni raccourci clavier ; et un seul site web par
  entrée.
- Seuls les navigateurs basés sur Chromium peuvent écrire le fichier sur place.

## Licence

MIT — voir [LICENSE](../../LICENSE). kdbxweb et hash-wasm sont eux aussi sous licence MIT.
