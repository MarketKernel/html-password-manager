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
<a href="README.pt.md">🇧🇷 Português</a> ·
<a href="README.ru.md">🇷🇺 Русский</a> ·
<a href="README.ur.md">🇵🇰 اردو</a> ·
<a href="README.id.md">🇮🇩 Bahasa Indonesia</a> ·
<b>🇩🇪 Deutsch</b> ·
<a href="README.ja.md">🇯🇵 日本語</a> ·
<a href="README.mr.md">🇮🇳 मराठी</a> ·
<a href="README.te.md">🇮🇳 తెలుగు</a> ·
<a href="README.tr.md">🇹🇷 Türkçe</a> ·
<a href="README.uk.md">🇺🇦 Українська</a>
</h3>
<!-- /languages -->

**Deterministic Password** berechnet Passwörter, statt sie nur zu speichern. Das Passwort für
eine Website wird aus Ihrem Hauptpasswort, der Website, Ihrem Benutzernamen und einer
Versionsnummer abgeleitet — mit Argon2id und HMAC-SHA-256. Geht die Datenbankdatei verloren,
ergeben dieselben Angaben auf jedem Rechner wieder dieselben Passwörter — der Verlust der Datei
ist kein Schrecken mehr. Um das Passwort für eine Website zu ändern, erhöhen Sie die Version.
Wie das funktioniert: „[Abgeleitete Passwörter](#abgeleitete-passwörter)“.

Zugleich ist es ein vollwertiger KeePass-Passwortmanager: Er öffnet, bearbeitet und speichert
gewöhnliche `.kdbx`-Dateien (KDBX 4, AES-256, Argon2id), sodass dieselbe Datenbank weiterhin in
KeePassXC, KeePass oder KeeWeb funktioniert. Ein abgeleitetes Passwort wird im Eintrag wie jedes
andere gespeichert, und andere KeePass-Apps zeigen es genauso an.

Alles funktioniert offline: kein Konto, keine Cloud, keine Netzwerkanfragen. Die ganze App ist
eine einzige eigenständige HTML-Datei; die Datenbank wird im Speicher der Seite entschlüsselt
und direkt wieder auf den Datenträger gespeichert, und das Hauptpasswort verlässt die Seite nie.
Dieselbe Seite ist außerdem eine [Chrome-Erweiterung](#chrome-erweiterung), die Anmeldedaten im
Tab daneben ausfüllt —
**[im Chrome Web Store installieren](https://chromewebstore.google.com/detail/hiahfdknjchamepclnokcalkcjcfhahf)**.

**[Online-Version](https://password.marketkernel.com/)** — dieselbe Seite
als PWA (Progressive Web App): Sie lässt sich im System installieren, läuft dann als eigene
App mit eigenem Fenster und Symbol und funktioniert offline. Auf dem Computer verwenden Sie in
Chrome, Edge und Arc die Installationsschaltfläche in der Adressleiste; auf Android das ⋮-Menü
von Chrome → App installieren; auf iOS Teilen → Zum Home-Bildschirm, in Safari oder in Chrome.
Auch dort bleibt die Datenbank auf Ihrem Datenträger — siehe „[GitHub Pages](#github-pages)“.

![html-password-manager: Gruppen, Einträge und ein Eintrag in Bearbeitung](../password-manager.jpg)

## Verwendung

1. `build/password-manager.html` bauen (siehe „[Bauen](#bauen)“) und im Browser öffnen —
   direkt vom Datenträger genügt.
2. „Datei öffnen“ → eine `.kdbx`-Datenbank auswählen oder in das Fenster ziehen.
3. Das Hauptpasswort eingeben (und die Schlüsseldatei auswählen, falls die Datenbank eine hat) → „Entsperren“.

In Chrome, Edge und Arc wird die Datei über die File System Access API geöffnet: Änderungen
werden in dieselbe Datei zurückgeschrieben — bei aktiviertem automatischem Speichern einen
Moment nach jeder Bearbeitung —, und die Datei wird beim nächsten Besuch erneut angeboten;
gemerkt wird nur ihr Handle, nie ihr Inhalt oder das Passwort. In Safari und Firefox wird die
Datei schreibgeschützt geöffnet, und „Speichern“ lädt eine aktualisierte Kopie der Datenbank
herunter — ebenso auf Smartphones: Chrome auf Android hat kein File System Access, und jeder
Browser auf iOS, Chrome eingeschlossen, läuft mit der Engine von Safari. Auf iOS übergibt
„Speichern“ die Kopie stattdessen an das Teilen-Menü — siehe „[Auf dem Smartphone](#auf-dem-smartphone)“.

„Neue Datenbank“ erstellt eine leere KDBX-4-Datenbank, verschlüsselt mit AES-256 und Argon2id
(64 MiB, 10 Durchläufe — die Standardwerte von KeePassXC, etwa eine halbe Sekunde im Browser).

### Auf dem Smartphone

Bis zu einer Breite von 900 Pixeln — auf einem Smartphone oder einem hochkant gehaltenen
Tablet — zeigt die Seite immer nur eine Sache an. Die Eintragsliste füllt den Bildschirm; ein
Tippen öffnet einen Eintrag auf einem eigenen Bildschirm, und ‹ in der Symbolleiste, die
Zurück-Taste des Systems oder eine Zurück-Wischgeste führen zur Liste zurück. Eine Bearbeitung
bleibt auf dem Rückweg erhalten, so wie sie auf dem Computer beim Auswählen eines anderen
Eintrags erhalten bleibt; ein leer gelassener neuer Eintrag wird verworfen. ☰ schiebt Gruppen,
Tags und Papierkorb über die Liste. Menüs, der Generator und die Einstellungen fahren vom
unteren Bildschirmrand herein; „Zurück“ schließt sie zuerst und bricht einen Dialog ab.
Generator, Einstellungen und Sperre befinden sich im ⋯-Menü der Symbolleiste.

Ein Touchscreen kennt weder Rechtsklick noch Ziehen: Das ⋯ neben einer Gruppe öffnet das Menü,
das auf dem Computer ein Rechtsklick öffnet, und dessen „In Gruppe verschieben…“ erledigt, was
das Ziehen erledigt. Das Menü eines Eintrags ist sein ⋯ auf dem Bildschirm des Eintrags.

Die Datei wird schreibgeschützt geöffnet. Auf iOS übergibt „Speichern“ die aktualisierte
Datenbank an das Teilen-Menü, wo „In Dateien sichern“ sie an die Stelle des Originals legen
kann; wird das Menü geschlossen, bleiben die Änderungen ungespeichert. Chrome auf Android teilt
nur Bilder, Audio, Video und Text, daher lädt „Speichern“ die Kopie dort herunter.

Bei größerer Breite und auf einem Tablet bleiben die drei Bereiche wie auf dem Computer; ein
Touchscreen jeder Größe erhält größere Schaltflächen und das ⋯ neben den Gruppen.

## Chrome-Erweiterung

**[Im Chrome Web Store installieren](https://chromewebstore.google.com/detail/hiahfdknjchamepclnokcalkcjcfhahf)**

`npm run build` schreibt außerdem `build/extension/`: dieselbe App als Chrome-Erweiterung, und
daraus `build/password-manager-extension-<version>.zip` für den Chrome Web Store. Um einen
eigenen Build auszuprobieren: `chrome://extensions` → Entwicklermodus → Entpackte Erweiterung
laden → `build/extension`.

Das Symbol in der Symbolleiste öffnet ein kompaktes Pop-up: die Einträge für die Website des
Tabs, ein Klick auf einen davon, um ihn auszufüllen, Schaltflächen zum Kopieren von
Benutzername, Passwort oder Einmalcode und eine Suche in der gesamten Datenbank. **Vollmodus**
unten darin öffnet die App in der Seitenleiste von Chrome neben der Seite — im
Smartphone-Layout, da eine Leiste schmal ist —, wo sie über Tabs hinweg geöffnet bleibt. Dort
funktioniert alles wie in der Datei; was die Erweiterung hinzufügt, ist das Ausfüllen von
Anmeldedaten:

- **Das Pop-up** entsperrt allein mit dem Hauptpasswort die Datei, die die Seitenleiste
  zuletzt geöffnet hat: Die Seitenleiste wählt Dateien und Schlüsseldateien aus und nimmt jede
  Änderung vor. Auf einer Website ohne Eintrag öffnet sein **Neues Passwort** die Seitenleiste
  mit dem Generator, so wie „Ausfüllen“ im Menü.
- **Ausfüllen** im Kontextmenü einer Seite (ein Rechtsklick auf die Seite oder in ein Feld)
  füllt Benutzername und Passwort des Eintrags für die Website des Tabs aus — oder dessen
  Einmalcode bei dem Anmeldeschritt, der danach fragt. Bei einem einzigen Eintrag für die
  Website füllt es sofort aus, ob die Seitenleiste geöffnet ist oder nicht; bei mehreren, bei
  keinem oder bei gesperrter Datenbank öffnet es die Seitenleiste, um einen auszuwählen, ein
  Passwort zu erzeugen oder zu entsperren — und macht von dort aus weiter. Eine Anmeldung in
  zwei Schritten (Google, Microsoft) nimmt im ersten den Benutzernamen und im zweiten das
  Passwort: Der für den Tab ausgewählte Eintrag wird gemerkt. Die Schaltfläche **Ausfüllen**
  eines Eintrags in der Seitenleiste füllt diesen Eintrag im Tab aus.
- **Die Datenbank bleibt geöffnet**, wenn die Seitenleiste geschlossen wird, bis sie gesperrt
  wird: nach der Inaktivitätszeit aus den Einstellungen, wenn der Bildschirm des Computers
  gesperrt wird, aus der Seitenleiste, aus dem Pop-up oder über **Sperren** im Menü des
  Symbolleistensymbols. Erneut geöffnet, übernimmt die Seitenleiste sie ohne Passwort, und das
  Pop-up zeigt sie sofort an.
- **Für diese Website** oben in der Gruppenleiste listet die Einträge der Website des Tabs
  auf, und die Liste öffnet sich damit; sie folgt dem Tab.
- **Ein neues Passwort für eine Seite.** Auf einer Website ohne Eintrag öffnet „Ausfüllen“ den
  Generator „Abgeleitet v3“ mit der Website des Tabs und dem auf der Seite eingegebenen
  Benutzernamen. Seine Schaltfläche „Ausfüllen“ füllt das Passwort ein — in beide Felder eines
  Registrierungsformulars — und speichert es als gewöhnlichen Eintrag.

Ein Eintrag passt zu einem Tab, wenn seine Website genau die Website des Tabs nennt: Beide
Adressen durchlaufen `siteOf()` von Generator 3 — ohne Schema, Port, Pfad oder `www.`, IDN in
Punycode. `google.com` passt nicht zu `accounts.google.com`, und `mail.site.com` nicht zu
`site.com`. Ein Eintrag mit `https://` oder ohne Schema wird nie in eine `http://`-Seite
eingefüllt: Eine über http genutzte Website braucht `http://` in der Website des Eintrags.
Einträge im Papierkorb werden nicht angeboten, und ein von Hand für eine andere Website
ausgewählter Eintrag wird erst nach einer Warnung ausgefüllt, die beide nennt.

**Wie es gebaut ist.** Die Seitenleiste ist die Seite selbst: `panel.html`, ihr Skript in
`panel.js`, wie Manifest V3 es verlangt. Bei jedem Entsperren und Speichern übergibt sie die
Datei und deren Schlüssel — das Passwort in einem `ProtectedValue`, die Schlüsseldatei — an
ein Offscreen-Dokument, das sie und eine daraus entschlüsselte schreibgeschützte Kopie der
Datenbank bis zum Sperren im Speicher hält; das Sperren schließt es, und der Schlüssel
verschwindet mit ihm. Nirgendwo wird etwas geschrieben. Der Service Worker hat die Menüs. Ein
Klick auf „Ausfüllen“ kann die Seitenleiste nur öffnen, bevor auf irgendetwas gewartet wird,
daher muss der Worker sofort wissen, ob er ausfüllen kann: Er hält die Websites der Einträge —
keine Namen, keine Passwörter —, so wie das Offscreen-Dokument sie sendet, und das
Offscreen-Dokument hält ihn am Laufen. Das Pop-up (`popup.html`, `popup.js`) entschlüsselt
nichts: Es fragt das Offscreen-Dokument nach den Titeln und Benutzernamen, die zum Tab passen,
dann nach dem einen angeklickten Eintrag; im gesperrten Zustand liest es die zuletzt geöffnete
Datei und übergibt sie samt Passwort diesem Dokument zum Öffnen.

**Was eine Seite erreicht.**

- Nur das, was ein Klick anfordert, und nur die Werte eines einzigen Eintrags. Nirgendwo läuft
  ein Content Script: Bei einem Klick fragt `chrome.scripting.executeScript` zuerst jeden Frame
  des Tabs, wo er sich befindet und welche Anmeldefelder er hat, ohne Werte zu senden; dann
  erhalten nur die Frames der Website des Eintrags die Werte, und die Funktion prüft vor der
  Eingabe noch einmal ihre eigene Adresse. Ein Frame einer anderen Website auf derselben Seite
  erhält nichts.
- Ausgefüllt werden nur Felder, die ein Mensch sehen kann: angezeigt, aktiviert, beschreibbar,
  von gewisser Größe, innerhalb des Fensters. Ein als Falle verstecktes Feld bleibt leer.
- Die Werte werden aus der isolierten Welt der Erweiterung gesetzt, an jedem Setter vorbei, den
  eine Seite auf ihre Eingabefelder legt, und `input`- und `change`-Events informieren React,
  Vue oder Angular.
- Das Hauptpasswort, andere Einträge und die Liste der Websites gelangen nie zu einer Seite.

**Berechtigungen.** `activeTab` statt jeder Website: Ein Klick auf das Symbol oder auf
„Ausfüllen“ gibt der Erweiterung diesen einen Tab. Deshalb öffnet sich die Seitenleiste aus dem
Pop-up oder dem Menü, nie über Chromes eigene Einstellung (`openPanelOnActionClick`): Eine so
geöffnete Leiste erhält überhaupt keinen Tab. „Ausfüllen“ in der Seitenleiste auf einem Tab, der
ihr nicht gegeben wurde, fragt einmal nach der Website des Eintrags
(`optional_host_permissions`). `contextMenus`, `scripting` und `sidePanel` für das oben
Genannte, `offscreen` für das Dokument, `idle` für die Bildschirmsperre, `clipboardWrite`, um
ein kopiertes Geheimnis bei geschlossener Seitenleiste zu löschen. Es gibt kein
`externally_connectable`: Die Teile der Erweiterung kommunizieren über `chrome.runtime`, und
jeder nimmt Nachrichten nur von den eigenen Seiten der Erweiterung an. Ihre Seiten haben
`connect-src 'none'`, wie die Datei; der Build prüft das und auch, dass keine Seite ein
Inline-Skript oder eine externe Adresse enthält.

Ein Unterschied zur Datei: Erneut geöffnet, schreibt die Seitenleiste die Datenbank nur dann
direkt in die Datei, wenn Chrome es noch erlaubt; andernfalls weist die Statusleiste darauf hin,
und das erste „Speichern“ fragt nach.

## Sicherheit

- **Nichts verlässt die Seite.** Eine Content-Security-Policy in der Datei verbietet jede
  Netzwerkanfrage, jedes Absenden von Formularen und jede externe Ressource; der Build schlägt
  fehl, wenn die Policy fehlt oder ein externer Verweis auftaucht. Die Kopie für die PWA lässt
  drei weitere Dinge zu, alle von ihrem eigenen Origin: das Manifest, den Service Worker und die
  Symbole — `connect-src` bleibt `'none'`.
- Der Formatcode ist [kdbxweb](https://github.com/keeweb/kdbxweb), die Bibliothek, auf der
  KeeWeb aufbaut; Argon2 ist das WebAssembly von [hash-wasm](https://github.com/Daninet/hash-wasm),
  das ebenfalls in die Datei eingebettet ist.
- Geschützte Felder werden im Speicher XOR-maskiert gehalten (`ProtectedValue` von kdbxweb) und
  auf dem Bildschirm maskiert, bis sie eingeblendet werden. Die Suche schaut nie in geschützte
  Felder.
- **Passwörter in jeder Sprache.** Wenn ein Browser ein Feld für ein Passwort hält, schaltet
  macOS Secure Input ein und erzwingt eine lateinische Tastaturbelegung, sodass sich ein
  kyrillisches Hauptpasswort nicht eingeben lässt. Chrome hält nicht nur `type=password` für ein
  Passwort, sondern heuristisch auch jedes Feld, das mit `-webkit-text-security` gestaltet ist
  oder einen Wert aus Punkten enthält — und bleibt dabei, wenn es das einmal getan hat. Geheime
  Felder geben hier keinen solchen Hinweis: Es sind gewöhnliche Texteingabefelder mit
  transparentem Text, über die eine Ebene aus Punkten gezeichnet wird (in einer Monospace-Schrift,
  damit die Einfügemarke an ihrem Platz bleibt). Ein Kennzeichen zeigt, ob der verborgene Text in
  kyrillischer (РУС) oder lateinischer (ENG) Schrift eingegeben wird. Der Preis dafür: Secure
  Input, das Tastenanschläge auch vor anderen Apps verbirgt, wird nie aktiviert.
- Ein kopiertes Geheimnis wird nach 30 Sekunden und beim Sperren aus der Zwischenablage gelöscht.
- Die Datenbank wird nach 15 Minuten Inaktivität und mit `⌘L` gesperrt. Das Sperren entfernt die
  entschlüsselte Datenbank aus dem Speicher; ein Sperren mit nicht gespeicherten Änderungen, die
  sich nicht schreiben lassen, wartet, statt die Änderungen zu verwerfen.
- Links in Einträgen öffnen sich nur für `http`, `https`, `ftp` und `mailto`, mit `noopener`.
- Passwörter werden mit `crypto.getRandomValues` und dem Verwerfungsverfahren (Rejection
  Sampling) erzeugt: Jedes Zeichen ist gleich wahrscheinlich.

## Funktionen

- **Gruppen**: ein einklappbarer Baum, Erstellen, Umbenennen, Löschen über das Kontextmenü,
  Verschieben per Drag-and-drop (Einträge und Gruppen), eine in der Breite veränderbare und
  ausblendbare Leiste (`⌘\`).
- **Einträge**: Titel, Benutzername, Passwort, Website, Notizen, eigene Felder (Klartext oder
  geschützt), Tags, Ablaufdatum, Anhänge. Sortierung nach Titel, Benutzername, Website, Datum.
- **Einmalcodes** (TOTP): aus einem `otp`-Feld (`otpauth://`-URL oder reines Geheimnis, wie
  KeePassXC und KeeWeb es speichern), aus den `TimeOtp-*`-Feldern von KeePass oder aus
  `TOTP Seed` von TrayTOTP. SHA-1, SHA-256, SHA-512; der Code aktualisiert sich mit einem
  Countdown. **+ Einmalcode** im Editor nimmt den Einrichtungsschlüssel, den eine Website neben
  ihrem QR-Code anzeigt (oder einen `otpauth://`-Link), und zeigt den Code sofort an, um ihn auf
  der Website zu bestätigen; ein reiner Schlüssel wird als `otpauth://`-Link gespeichert, in der
  Form, die KeePassXC liest.
- **Bearbeiten** geschieht an einem Entwurf: „Speichern“ legt zuerst den vorherigen Stand im
  Verlauf des Eintrags ab, wie KeePass es tut; „Abbrechen“ verwirft den Entwurf. Frühere
  Versionen lassen sich durchblättern und wiederherstellen.
- **Papierkorb**: Löschen verschiebt in den Papierkorb; von dort — wiederherstellen oder
  endgültig löschen.
- **Suche** in Titel, Benutzername, Website, Notizen, Tags, eigenen Feldern und Namen von
  Anhängen; jedes Wort der Anfrage muss passen.
- **Passwortgenerator** (der Würfel, `⌘G`) erzeugt ein Passwort der in seiner Liste gewählten
  Art, die neueste Ableitung zuerst; die letzte Wahl wird gemerkt:
  - **Abgeleitet v3** — berechnet aus dem Hauptpasswort, dem Benutzernamen, der Website und
    einer Version, sodass es sich ohne die Datei erneut berechnen lässt — siehe
    „[Abgeleitete Passwörter](#abgeleitete-passwörter)“;
  - **Abgeleitet v2** und **Abgeleitet v1** — die Rechner zweier älterer Programme (Legacy 2
    und Legacy 1), aufgeführt, wenn Einstellungen → „Veraltete Passwortalgorithmen anzeigen“
    aktiviert ist — siehe „[Veraltete Algorithmen](#veraltete-algorithmen)“;
  - **Zufällig** — Länge, Zeichensätze, ähnlich aussehende Zeichen, Entropieschätzung.

  Stärkeanzeige für eingegebene Passwörter.
- **Datenbank**: umbenennen, Hauptpasswort und Schlüsseldatei ändern, eine Kopie speichern.
- **Sprachen**: English, 中文, हिन्दी, Español, Français, العربية, বাংলা, Português, Русский,
  اردو, Bahasa Indonesia, Deutsch, 日本語, मराठी, తెలుగు, Türkçe — die sechzehn meistgesprochenen —
  und Українська. Auswahl in den Einstellungen oder vom Browser übernommen; bei Arabisch und Urdu
  ist das Fenster von rechts nach links angeordnet.
- **Design**: System, Hell, Dunkel, in den Einstellungen. Sprache, Design, Leistenbreiten,
  Sortierung, Generatoroptionen und eingeklappte Gruppen werden gemerkt.

## Abgeleitete Passwörter

**Abgeleitet v3** im Generator berechnet ein Passwort aus

- dem Hauptpasswort der Datenbank (eine eventuelle Schlüsseldatei bleibt außen vor) oder einem
  anderen, dort eingegebenen,
- dem Benutzernamen,
- der Website — der Domain, auf der das Konto liegt (`https://www.github.com/login` → `github.com`),
- der Version — 1, 2, … bis 2³² − 1; „+1“ gibt demselben Konto ein neues Passwort.

Diese vier ergeben 32 Byte Entropie. Die Anforderungen — Länge, Zeichensätze, ähnlich
aussehende Zeichen — formen diese Bytes nur zu Zeichen: Ihre Änderung ändert die Entropie
nicht. **Übernehmen** setzt das Ergebnis als gewöhnliches gespeichertes Passwort in den Eintrag.
Nichts darüber, wie es entstanden ist, wird gespeichert: Der Eintrag ist wie jeder andere, und
andere KeePass-Apps zeigen dasselbe Passwort. Sollte die Datei verloren gehen, ergeben dasselbe
Hauptpasswort, derselbe Benutzername, dieselbe Website, Version und Anforderungen auf jedem
Rechner dasselbe Passwort. Die Standardwerte sind 20 Zeichen, alle vier Zeichensätze, keine
ähnlich aussehenden Zeichen; bei einem mit anderen Werten erzeugten Passwort muss man sich auch
diese merken.

Der Generator fragt zuerst nach dem Benutzernamen — aus einem Eintrag heraus nach dem des
Eintrags selbst: Was dort eingegeben wird, erscheint auch im Formular —, dann nach der Website;
beide sind erforderlich, und das Passwort, das sie ergeben, steht unten über **Übernehmen**.

- Ein Benutzername, der eine E-Mail-Adresse ist, nennt seine Website: `test@site.com` trägt
  `site.com` ein, und die Website des Eintrags bleibt, wie sie ist — sie kann durchaus
  `mail.site.com` sein. Mit derselben Adresse meldet man sich allerdings bei vielen Websites an,
  und der Generator weist unter dem Feld darauf hin: Für GitHub mit `test@gmail.com` tippen Sie
  `github.com` über das dort eingetragene `gmail.com`.
- Bei jedem anderen Benutzernamen muss die Website eingegeben werden, und aus einem Eintrag
  heraus wird das Eingegebene auch zu dessen Website. Die Website, die der Eintrag bereits hat,
  ist anfangs eingetragen.

Bei dem, was als Website eingegeben wird, spielen Schema, Pfad, Port und ein führendes `www.`
keine Rolle; eine Subdomain schon — `login.github.com` und `github.com` sind zwei Websites. Eine
Website, die keine URL ist („Meine Bank“), wird unverändert verwendet. Aus der Symbolleiste
funktioniert der Generator genauso, mit eigenen Feldern, und kopiert das Ergebnis.

„Hauptpasswort der Datenbank verwenden“ ist bei jedem Öffnen des Generators angehakt. Entfernen
Sie das Häkchen, um von einem anderen Hauptpasswort abzuleiten, das dort eingegeben und nirgends
gespeichert wird — um ein Passwort wiederherzustellen, das in einer anderen Datenbank oder vor
einer Änderung des Hauptpassworts erzeugt wurde. Eine Änderung des Hauptpassworts lässt die
Passwörter in der Datei, wie sie sind; nur was der Generator von da an berechnet, ist anders.

### Der Algorithmus: Generator 3

Alles Folgende ist eingefroren: Die Änderung irgendeiner Konstante würde es unmöglich machen,
die damit erzeugten Passwörter erneut zu berechnen. Ein künftiger Generator käme als neue Art in
die Liste und ließe diesen unverändert. Der Code ist `src/core/derived.ts`; `npm test` prüft ihn
gegen feste Testvektoren und gegen eine unabhängige Implementierung, die anhand dieser
Beschreibung mit dem eigenen `crypto` von Node geschrieben wurde. Die Primitive sind Standard —
SHA-256, HMAC-SHA-256, Argon2id —, sodass sich der Algorithmus in jeder Sprache nachbauen lässt.

Er läuft in zwei Stufen: Die Geheimnisse werden zu 32 Byte Entropie, dann schneiden die
Anforderungen aus diesen Bytes Zeichen heraus.

**Stufe 1 — Entropie.**

1. *Eingaben normalisieren.* Alle Zeichenketten sind UTF-8.
   - `site` — der Host dessen, was als Website eingegeben wurde: der Text, als WHATWG-URL
     geparst (`https://` wird vorangestellt, wenn der Text kein `scheme://` hat):
     Kleinbuchstaben, IDN in Punycode, kein Port, kein Benutzername oder Passwort, ein
     führendes `www.` entfernt; Text, der sich nicht als URL parsen lässt, wird unverändert
     verwendet. Dann getrimmt, NFC-normalisiert, in Kleinbuchstaben umgewandelt.
   - `user` — der Benutzername, getrimmt und NFC-normalisiert; die Groß- und Kleinschreibung
     bleibt erhalten.
   - `master` — das Hauptpasswort, NFC-normalisiert, nichts getrimmt. Ein „é“, als ein Zeichen
     oder als „e“ plus kombinierender Akzent eingegeben, ergibt dasselbe Passwort.
2. *Salt.*
   ```
   salt = SHA-256( "html-password-manager/derived/v3" ‖ 0x00
                   ‖ u32be(byte length of site) ‖ site
                   ‖ u32be(byte length of user) ‖ user
                   ‖ u32be(version) )
   ```
   Die Längenpräfixe halten `ab` + `c` und `a` + `bc` auseinander; das Label trennt diese Bytes
   von jeder anderen Verwendung derselben Eingaben. `u32be` ist eine 4-Byte-Ganzzahl in
   Big-Endian.
3. *Strecken.*
   ```
   entropy = Argon2id(password = master, salt, memory = 64 MiB, passes = 3,
                      lanes = 1, version 0x13, output = 32 bytes)
   ```
   Argon2id lässt jeden Rateversuch für das Hauptpasswort 64 MiB Speicher kosten, und genau das
   bremst GPUs und ASICs. Da Website, Benutzername und Version im Salt stecken, hat jedes Konto
   sein eigenes: Keine Tabelle lässt sich im Voraus berechnen, und jedes Konto muss einzeln
   angegriffen werden.

**Stufe 2 — Formung.** Die Anforderungen werden nur hier verwendet, daher ändern sie, wie das
Passwort aussieht, nicht die Entropie dahinter.

4. *Ein Strom zufälliger Bytes*, so lang wie nötig — 32 Byte reichen für ein langes Passwort und
   dessen Mischen nicht aus:
   ```
   block(i) = HMAC-SHA-256(key = entropy, "hpm-v3-stream" ‖ u32be(i)),  i = 0, 1, 2, …
   ```
5. *Eine unverzerrte Zahl kleiner als n.* Die nächsten 4 Byte des Stroms als Big-Endian-u32
   `x` nehmen. Wenn `x ≥ 2³² − (2³² mod n)`, diese verwerfen und die nächsten nehmen;
   andernfalls ist das Ergebnis `x mod n`. (Ein bloßes `x mod n` würde den Anfang des Alphabets
   bevorzugen.)
6. *Zeichen.* Die Zeichensätze, in dieser Reihenfolge, jeweils nur, wenn gewählt:
   ```
   A–Z      ABCDEFGHIJKLMNOPQRSTUVWXYZ
   a–z      abcdefghijklmnopqrstuvwxyz
   0–9      0123456789
   symbols  !#$%&*+-=?@^_~.,:;()[]{}<>/|
   ```
   Ohne ähnlich aussehende Zeichen werden `O 0 o I l 1 |` daraus entfernt. Dann:
   ```
   chars = []
   for each chosen set:            chars.push(set[draw(|set|)])      # every set is present
   while |chars| < length:         chars.push(all[draw(|all|)])      # all = the sets joined
   for i = length − 1 down to 1:   j = draw(i + 1); swap chars[i], chars[j]   # Fisher–Yates
   password = chars joined
   ```
   Die Länge beträgt 4 bis 128. Dass zuerst ein Zeichen aus jedem Satz genommen wird, garantiert
   „enthält eine Ziffer“ und „enthält ein Sonderzeichen“; das Mischen verbirgt, wo diese Zeichen
   gelandet sind.

**Testvektor.** Hauptpasswort `Тестовый пароль`, Website `https://www.github.com/login`
(`github.com`), Benutzername `me@example.com`, Version 1, die Standardanforderungen
(20 Zeichen, alle vier Sätze, keine ähnlich aussehenden Zeichen):

```
password  A6qVXXF]7<%a)aa<x7*U
```

Dieselbe Entropie mit 12 Zeichen und ohne Sonderzeichen ergibt `yaM6VJaJFYUQ`; Version 2 mit den
Standardwerten ergibt `3q_bwppbE8P2+ufKr:P6`.

### Wie sicher es ist

- Ein abgeleitetes Passwort hat höchstens 256 Bit Entropie (die 32 Byte); 20 Zeichen aus allen
  vier Sätzen ohne ähnlich aussehende Zeichen sind etwa 128 Bit. In der Praxis ist die
  Obergrenze das Hauptpasswort.
- **Die Schwachstelle jedes Verfahrens mit abgeleiteten Passwörtern:** Ein von einer Website
  geleaktes Passwort erlaubt es einem Angreifer, das Hauptpasswort offline zu erraten, da
  Website und Benutzername bekannt sind. Jeder Versuch kostet einen Argon2id-Durchlauf über
  64 MiB — etwa 0,15–0,4 s im Browser, weniger auf spezialisierter Hardware. Ein kurzes oder
  gängiges Hauptpasswort wird gefunden; eine lange Passphrase nicht. Zufällige Passwörter haben
  diese Schwäche nicht, deshalb bietet der Generator beides.
- Solange das Hauptpasswort standhält, verrät ein geleaktes Passwort nichts über die anderen
  Websites oder Versionen: Sie stammen aus anderen Salts, also aus anderen Argon2-Durchläufen.

Das Hauptpasswort wird, solange die Datenbank geöffnet ist, XOR-maskiert im Speicher gehalten,
zusammen mit der bis dahin berechneten Entropie; das Sperren verwirft beides.

## Veraltete Algorithmen

Zwei ältere Windows-Programme berechneten Passwörter aus geheimen Phrasen; **Abgeleitet v1**
(Legacy 1) und **Abgeleitet v2** (Legacy 2) im Generator bilden sie exakt nach, sodass sich die
damit erzeugten Passwörter wiederherstellen lassen. Sie sind Rechner: Nichts, was in sie
eingegeben wird, wird gespeichert, die Phrasen sind weg, sobald der Generator geschlossen wird,
und **Übernehmen** setzt das Ergebnis als gewöhnliches gespeichertes Passwort in den Eintrag.
Einstellungen → „Veraltete Passwortalgorithmen anzeigen“ blendet sie ein.

Aus einem Eintrag heraus geöffnet, schlagen beide die Kennung vor: einen Benutzernamen, der
bereits seine Website nennt (`mail@site.com`), unverändert, andernfalls den Benutzernamen, `@`
und die Website ohne `www.` (`dmytro@github.com`); sie lässt sich ändern. Jede Phrase — der
Hauptschlüssel und der Sekundärschlüssel, die primäre und die sekundäre Geheimphrase — hat ihr
eigenes Kästchen „Bis zum Sperren der Datenbank merken“: Eine angehakte wird XOR-maskiert im
Speicher der Seite gehalten und beim nächsten Mal eingetragen; ist die erste Phrase gemerkt,
wird der Schlüssel sofort berechnet. Beide können auch das eigene Hauptpasswort der Datenbank —
dasjenige, mit dem sie entsperrt wurde — als erste Phrase übernehmen, als Hauptschlüssel von
Legacy 1 bzw. als primäre Geheimphrase von Legacy 2 („Hauptpasswort der Datenbank verwenden“,
für jeden der beiden in den Einstellungen gemerkt): Dieses Feld und sein Kästchen sind dann
deaktiviert. Nichts davon wird auf den Datenträger geschrieben; Sperren, das Schließen der
Datenbank oder das Ausschalten der veralteten Algorithmen vergisst alles. Der Code ist
`src/core/legacy.ts`; `npm test` prüft ihn gegen Vektoren, die von den ursprünglichen
.NET-Programmen berechnet wurden.

**Legacy 1** — Hauptschlüssel, Kennung, Primärschlüssel, Sekundärschlüssel, Ergebnis:

```
short(bytes) = Base64(bytes) without "=", "/", "+", first 10 characters
primary key  = short(SHA-1 applied 1 000 000 times to UTF-8(master key ‖ identifier))
result       = short(SHA-1(UTF-8(primary key ‖ secondary key)))
```

Der Primärschlüssel ist an die Kennung gebunden und kann getrennt (auf Papier) aufbewahrt
werden, sodass der Hauptschlüssel nirgends eingegeben werden muss: Der Primärschlüssel lässt
sich direkt eingeben. Der Sekundärschlüssel macht eine gestohlene Notiz für sich allein nutzlos.

**Legacy 2** (Password.Generator 1.0) — primärer Schutz: Kennung, primäre Geheimphrase,
Schlüssellänge, Zeichensätze; sekundärer Schutz: der Schlüssel, sekundäre Geheimphrase,
Passwortversion, Passwortlänge, Zeichensätze:

```
digest(a, b, v, n) = SHA-1 applied n times to UTF-8(a) ‖ UTF-8(b) ‖ (v > 0 ? u32le(v) : nothing)
key                = select(digest(identifier, primary phrase, 1, 100 000), key length + 2)
password           = select(digest(key, secondary phrase, version, 1), password length + 2)
```

`select` liest den Digest als fünf Little-Endian-u32, setzt bei jedem das höchste Bit, schreibt
ihn zur Basis N des Alphabets — `!#$%&'()+,-.` (falls gewählt), Ziffern (immer), A–Z, a–z
(falls gewählt) — mit der niedrigstwertigen Stelle zuerst, behält von jedem 5 Zeichen und kürzt
auf die Länge (1–18). Die ersten beiden Zeichen sind eine Signatur, die man mit bloßem Auge mit
der vom Programm angezeigten vergleicht; der Rest ist der Schlüssel bzw. das Passwort. Die
Version des Schlüssels ist immer 1: Das Programm hat kein Feld dafür. Kennung `1`, Phrase `1`,
Länge 10, Ziffern und Buchstaben ergeben den Schlüssel `E8 8pgYm9fZha`.

Beide sind weit schwächer als Version 3: Ein Rateversuch für die Phrasen kostet einen Angreifer
ein paar SHA-1-Durchläufe statt eines Argon2id-Durchlaufs über 64 MiB, und ein Ergebnis von
Legacy 1 hat 10 Zeichen, etwa 60 Bit. Verwenden Sie sie, um alte Passwörter wiederherzustellen,
nicht für neue.

## Tastenkürzel

| Aktion | Tasten |
| --- | --- |
| Speichern | `⌘S` |
| Sperren | `⌘L` |
| Suchen | `⌘F` |
| Neuer Eintrag | `⌘N` |
| Bearbeiten · Bearbeitung speichern | `⌘E` oder `Enter` · `⌘Enter` |
| Bearbeitung abbrechen | `Esc` |
| Passwortgenerator | `⌘G` |
| Passwort · Benutzername · Website kopieren | `⌘C` · `⌘B` · `⌘U` |
| Vorheriger · nächster Eintrag | `↑` · `↓` |
| Eintrag löschen | `⌫` |
| Gruppenleiste | `⌘\` |

## Übersetzungen

Der englische Text bleibt im Code: `t('menu', 'Delete')`, `tn('status', '{count} entry',
'{count} entries', n)` und `data-i18n="context"` / `data-i18n-attr="context"` in der Vorlage.
Das erste Argument ist der Kontext — der Teil der Oberfläche, zu dem ein String gehört, sodass
dasselbe englische Wort an zwei Stellen unterschiedlich übersetzt werden kann. Ein Wörterbuch,
`src/locales/<code>.json`, ordnet Kontext → englischer Text → Übersetzung zu:

```json
{
  "menu": { "Delete": "Удалить" },
  "status": { "{count} entries": { "one": "{count} запись", "few": "{count} записи", "many": "{count} записей", "other": "{count} записи" } }
}
```

Ein String, der im Wörterbuch fehlt, wird auf Englisch angezeigt. Ein Text mit einer Zahl hat
eine Form pro Pluralkategorie der Sprache (`Intl.PluralRules`), mit der englischen Pluralform
als Schlüssel. `npm run i18n` listet pro Sprache die noch nicht übersetzten und die nicht mehr
verwendeten Strings auf; `npm test` prüft, dass jede Übersetzung die englischen Platzhalter
beibehält und alle Pluralformen hat.

Was Chrome von der Erweiterung selbst anzeigt — ihren Namen und ihre Beschreibung, den Titel der
Symbolleistenschaltfläche —, folgt über `chrome.i18n` der Sprache des Browsers statt der der
Seitenleiste. Diese Texte sind die englischen in `src/extension/manifest.json`, übersetzt in
denselben Wörterbüchern unter dem Kontext `manifest`; der Build schreibt sie nach
`_locales/<code>/messages.json` und setzt `__MSG_appName__` und Ähnliches in das Manifest.
Chrome hat eigene Codes und ignoriert den Rest: Aus `pt` werden `pt_BR` und `pt_PT`, aus `zh`
wird `zh_CN`, und für Urdu gibt es keinen, daher nennt Chrome die Erweiterung dort auf
Englisch. Der Build bricht bei einem Namen über 75 Zeichen oder einer Beschreibung über 132
Zeichen ab.

Auch diese README ist übersetzt: `docs/readme/README.<code>.md`, eine pro Sprache, jeweils mit
der Liste der Sprachen oben. Eine Änderung hier gehört auch in die Übersetzungen.

## Bauen

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

`build.mjs` bündelt `src/app/main.ts` mit esbuild zu einer IIFE und setzt sie zusammen mit den
Styles und dem Symbol (als Data-URI) in `src/app/template.html` ein. Die Fallbacks von kdbxweb
für Node (`crypto`, `@xmldom/xmldom`) werden durch leere Stubs ersetzt — ein Browser hat
`crypto.subtle` und `DOMParser`. Das Ergebnis ist `build/password-manager.html`, rund 500 KB,
ein Viertel davon die Wörterbücher.

Derselbe Lauf schreibt `build/pages/`: diese Seite als installierbare PWA — `index.html` mit
einem Manifest-Link und einem `<meta name="service-worker">`, das der Seite sagt, ihren Service
Worker zu registrieren, `manifest.webmanifest`, die Symbole
und `sw.js`, das die Seite zwischenspeichert, damit sie offline öffnet.
`build/password-manager.html` selbst bleibt eine einzelne Datei ohne externe Verweise.

Und `build/extension/`: `panel.html` ist die Vorlage mit ihrem Skript in `panel.js` — demselben
`src/app/main.ts`, mit `src/extension/extension.ts` anstelle von `src/app/platform.ts`, dessen
Hooks in der Datei nichts tun —, daneben `popup.html` (mit den Styles der Seite und
`popup.css`) und `popup.js`, `background.js`, `offscreen.html` und `offscreen.js`, die Symbole
und `manifest.json`, dessen Version die aus `package.json` ist.
`build/password-manager-extension-<version>.zip` enthält dieselben Dateien mit festen
Datumsangaben: Dieselben Quellen ergeben dieselben Bytes.

`tests/extension.mjs` lädt diese Erweiterung über das DevTools-Protokoll in headless Chrome
(`Extensions.loadUnpacked` über eine Pipe; `--load-extension` gibt es in Chrome seit Version 137
nicht mehr) und füllt Testseiten auf einem lokalen Server aus: ein einfaches Formular, ein
React-artiges, eine Anmeldung in drei Schritten mit Einmalcode, Frames der eigenen und einer
fremden Website, als Fallen versteckte Felder, eine http-Seite für einen https-Eintrag, eine mit
einem Passwort „Abgeleitet v3“ ausgefüllte Registrierung — bei geschlossener Seitenleiste und
nach dem Sperren; außerdem das Pop-up, das entsperrt, ausfüllt, sucht, kopiert und sperrt. Ein
Kontextmenü lässt sich aus DevTools nicht anklicken, daher löst der Test das `onClicked` des
Workers selbst aus; ohne echten Klick gewährt Chrome kein `activeTab`, daher darf die getestete
Kopie die Testseiten, `*.test`, als Host-Berechtigungen erreichen. Das Symbolleistensymbol lässt
sich aus DevTools anklicken (`Extensions.triggerAction`): Ein eigenes Chrome mit der
Erweiterung, so wie sie gebaut wurde, prüft, dass der Klick dem Pop-up den Tab gibt. Headless
Chrome 153 stürzt bei diesem Klick ab, unabhängig von der Erweiterung, und die Prüfung wird dann
übersprungen; Chrome for Testing führt sie aus
(`CHROME=/path/to/chrome-for-testing npm run test:browser`).

`tests/fixtures/Database.kdbx` ist eine Beispieldatenbank für die Tests; ihr Passwort ist `Тестовый пароль`.

## Versionen und Releases

Die Version steht an einer einzigen Stelle, `package.json`. Der Build setzt sie in die Seite
(die Zeile unter dem Startbildschirm, unten in den Einstellungen), in das `manifest.json` der
Erweiterung und in den Cache-Namen der PWA. Ein Build des mit `v<version>` getaggten Commits
zeigt sie unverändert; jeder andere hängt seinen Commit an, `0.8.0+1a2b3c4`, damit eine Seite
aus `main` auf GitHub Pages nicht für das Release gehalten wird. Chromes `version` enthält nur
Zahlen, daher kommt der Commit dort in `version_name`.

```sh
npm version minor           # 0.7.2 -> 0.8.0: package.json, package-lock.json, a commit and the tag v0.8.0
git push --follow-tags      # the tag starts .github/workflows/release.yml
```

Der Release-Workflow bricht ab, wenn Tag und `package.json` nicht übereinstimmen, und hängt dann
`password-manager-<tag>.html`, `password-manager-extension-<tag>.zip` und `SHA256SUMS.txt` an.

## GitHub Pages

`.github/workflows/pages.yml` baut und testet jeden Push auf `main` und stellt `build/pages/`
auf GitHub Pages bereit (Settings → Pages → Source: GitHub Actions), unter
<https://password.marketkernel.com/>. Dateien öffnen sich genauso wie in der
Einzeldatei; die zuletzt geöffneten Dateien, die Einstellungen und die gemerkten Handles gehören
zu dieser Adresse, getrennt von denen einer vom Datenträger geöffneten Kopie.

Jedes Deployment ändert den Cache-Namen in `sw.js`, sodass der Browser von selbst den neuen
Service Worker übernimmt — beim Start mit Verbindung, oder wenn Einstellungen → Nach Updates
suchen danach fragt. Der neue Service Worker lädt seine Version in einen eigenen Cache und
wartet; der laufende liefert weiterhin die alte Seite, auch offline. Die Einstellungen und der
Entsperrbildschirm sagen dann „Version … ist bereit. Aktualisieren“: Aktualisieren sperrt die
Datenbank (speichert sie oder fragt nach, wie jede Sperre), lässt den neuen Service Worker
hinein und lädt die Seite neu. Ohne die Schaltfläche startet die neue Version von selbst,
sobald jedes Fenster der App geschlossen wurde. Das ist zugleich
der Kompromiss: Eine installierte PWA führt aus, was das letzte Deployment dort abgelegt hat,
während eine heruntergeladene Datei die Version bleibt, die sie ist. Für eine auf dem
Datenträger fest stehende Version nehmen Sie `password-manager-<tag>.html` aus einem Release und
vergleichen sie mit `SHA256SUMS.txt`.

`npm run test:browser` öffnet auch `build/pages/`: Der Service Worker übernimmt die Seite, Chrome
hält das Manifest für installierbar, und ohne Server lädt die Seite trotzdem und entsperrt die
Beispieldatenbank; danach wird ein neues Deployment gefunden, wartet, und Aktualisieren lässt es
hinein.

## Projektstruktur

```
src/core/             kein DOM: die Tests führen es in Node aus
  kdbx.ts             kdbxweb + Argon2: öffnen, speichern, erstellen; Felder, Gruppen, Papierkorb
  generator.ts        Passwortgenerator und Stärkeschätzung
  derived.ts          abgeleitete Passwörter: Generator 3, die Website einer E-Mail-Adresse, das Hauptpasswort der Sitzung
  site.ts             siteOf(): die Website einer Adresse, für Generator 3 und für den Abgleich von Tabs
  legacy.ts           die veralteten Algorithmen: Legacy 1 und Legacy 2
  otp.ts              TOTP (RFC 6238) und die Arten, wie Geheimnisse gespeichert werden
  match.ts            welche Einträge zu einem Tab passen
  i18n.ts             t()/tn(), die Sprachliste, Übersetzung des Markups der Seite
src/app/              die Seite: die Einzeldatei, die PWA und die Seitenleiste der Erweiterung
  template.html       Markup mit den Platzhaltern __STYLES__/__APP__/__ICON__, die CSP; auch panel.html der Erweiterung
  styles.css          Farbpalette, helles und dunkles Design, drei Bereiche; auf dem Smartphone ein Bildschirm auf einmal
  main.ts             Startbildschirm, Entsperren, Speichern, Sperren, Symbolleiste, Tastenkürzel, Einstellungen
  files.ts            File System Access API, Drag-and-drop, Dateiauswahl; zuletzt geöffnete Dateien
  groups.ts           Gruppenbaum, Tags und Papierkorb in der linken Leiste
  list.ts             die Eintragsliste
  details.ts          ein Eintrag: Ansicht, Bearbeitung an einem Entwurf, Verlauf, Anhänge, TOTP
  search.ts           Suche, Sortierung, sichere Links
  genpanel.ts         das Generator-Popover: zufällig, Version 3, Legacy 1 und 2
  clipboard.ts        Kopieren mit zeitgesteuertem Löschen
  avatar.ts           Eintragssymbole: eigene Symbole aus der Datenbank oder ein farbiger Buchstabe
  settings.ts         localStorage: Sprache, Design, Leisten, Timer für Sperre und Zwischenablage
  ui.ts               Dialoge, Kontextmenü, Popovers, Toasts, Symbole; Sheets auf dem Smartphone
  screens.ts          das Smartphone-Layout: Liste oder Eintrag, die Gruppenschublade, die Zurück-Taste
  platform.ts         was die Seite über sich hinaus tut: nichts, in der Datei und der PWA
  update.ts           die Updates der PWA: registriert sw.js, findet eine wartende Version, lässt sie hinein
src/extension/        die Chrome-Erweiterung
  manifest.json       ihr Manifest; der Build ergänzt die Version
  extension.ts        platform.ts der Seitenleiste: das Offscreen-Dokument, der Tab, Ausfüllen
  popup.ts            das Pop-up des Symbolleistensymbols (popup.html, popup.css): die Einträge der Website, Vollmodus
  background.ts       der Service Worker: die Menüs, die Bildschirmsperre, das Ausfüllen eines Tabs
  offscreen.ts        das Offscreen-Dokument (offscreen.html): die geöffnete Datenbank bis zum Sperren
  fill.ts             die in eine Seite eingefügte Funktion: findet die Anmeldefelder und füllt sie aus
  messages.ts         wie die Teile der Erweiterung miteinander kommunizieren
src/pwa/sw.js         der Service Worker des Pages-Builds
src/locales/          ein Wörterbuch pro Sprache
assets/               das Symbol; pwa/, seine PNG-Größen für die PWA; extension/, das Symbol der Erweiterung
tests/                .kdbx-Rundläufe, Generator und TOTP, abgeleitete Passwörter, veraltete Algorithmen, Tab-Abgleich,
                      Wörterbücher, die Seite und die Erweiterung in headless Chrome; fixtures/, die Beispieldatenbank
tools/                load.mjs kompiliert src/-Module für die Tests; i18n.mjs vergleicht die Wörterbücher mit dem Code
docs/                 der Screenshot oben; readme/, diese README in den anderen Sprachen; Arbeitsnotizen (nicht unter Git)
build/                die Build-Ausgabe; build/pages/ ist die PWA für GitHub Pages, build/extension/ die Erweiterung
```

## Einschränkungen

- KDBX 3.1 und 4.x werden unterstützt; mit Twofish verschlüsselte Dateien und KeePass-1-Dateien
  (`.kdb`) nicht.
- Keine Synchronisierung, kein Auto-Type und kein Zusammenführen geänderter Kopien.
- Die Erweiterung gibt es nur für Chrome, und sie hat keine Vorschläge in den Feldern, kein
  Speichern eines Passworts beim Absenden eines Formulars, kein Tastenkürzel und nur eine
  Website pro Eintrag.
- Nur Chromium-basierte Browser können die Datei direkt überschreiben.

## Lizenz

MIT — siehe [LICENSE](../../LICENSE). kdbxweb und hash-wasm stehen ebenfalls unter der MIT-Lizenz.
