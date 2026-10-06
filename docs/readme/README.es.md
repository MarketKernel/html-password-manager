# html-password-manager

<!-- languages -->
<h3 align="center">
<a href="../../README.md">🇬🇧 English</a> ·
<a href="README.zh.md">🇨🇳 中文</a> ·
<a href="README.hi.md">🇮🇳 हिन्दी</a> ·
<b>🇪🇸 Español</b> ·
<a href="README.fr.md">🇫🇷 Français</a> ·
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

**Deterministic Password** calcula las contraseñas en lugar de limitarse a guardarlas. La contraseña
de un sitio se deriva de tu contraseña maestra, el sitio, tu usuario y un número de versión, con
Argon2id y HMAC-SHA-256. Si se pierde el archivo de la base de datos, los mismos datos vuelven a dar
las mismas contraseñas en cualquier equipo: perder el archivo ya no da miedo. Para cambiar la
contraseña de un sitio, sube la versión. Cómo funciona: «[Contraseñas derivadas](#contraseñas-derivadas)».

Además es un gestor de contraseñas KeePass completo: abre, edita y guarda archivos `.kdbx` normales
(KDBX 4, AES-256, Argon2id), así que la misma base de datos sigue funcionando en KeePassXC, KeePass
o KeeWeb. Una contraseña derivada se guarda en la entrada como cualquier otra, y las demás
aplicaciones de KeePass la muestran igual.

Todo funciona sin conexión: sin cuenta, sin nube, sin peticiones de red. La aplicación entera es un
único archivo HTML independiente; la base de datos se descifra en la memoria de la página y se
guarda directamente en el disco, y la contraseña maestra nunca sale de la página. La misma página es
también una [extensión para Chrome](#extensión-para-chrome) que rellena los inicios de sesión en la
pestaña de al lado:
**[instálala desde la Chrome Web Store](https://chromewebstore.google.com/detail/hiahfdknjchamepclnokcalkcjcfhahf)**.

**[Versión en línea](https://password.marketkernel.com/)**: la misma página
como PWA (Progressive Web App). Se puede instalar en el sistema y entonces funciona como una
aplicación aparte, con su propia ventana y su propio icono, y también sin conexión. En un ordenador,
en Chrome, Edge y Arc, usa el botón de instalación de la barra de direcciones; en Android, el menú ⋮
de Chrome → Instalar aplicación; en iOS, Compartir → Añadir a pantalla de inicio, en Safari o en
Chrome. También ahí la base de datos se queda en tu disco; consulta «[GitHub Pages](#github-pages)».

![html-password-manager: grupos, entradas y una entrada en edición](../password-manager.jpg)

## Cómo usarlo

1. Compila `build/password-manager.html` (consulta «[Compilación](#compilación)») y ábrelo en un
   navegador; vale abrirlo directamente desde el disco.
2. «Abrir archivo» → elige una base de datos `.kdbx`, o arrástrala a la ventana.
3. Escribe la contraseña maestra (y elige el archivo de clave, si la base de datos lo tiene) → Desbloquear.

En Chrome, Edge y Arc el archivo se abre mediante la File System Access API: los cambios se
escriben en el mismo archivo, un instante después de cada edición si el guardado automático está
activado, y el archivo se vuelve a ofrecer en la siguiente visita; solo se recuerda su identificador
(handle), nunca su contenido ni la contraseña. En Safari y Firefox el archivo se abre en modo de solo
lectura, y Guardar descarga una copia actualizada de la base de datos; lo mismo ocurre en los
teléfonos: Chrome en Android no tiene File System Access, y todos los navegadores de iOS, Chrome
incluido, funcionan con el motor de Safari. En iOS, Guardar pasa la copia al menú Compartir; consulta
«[En un móvil](#en-un-móvil)».

«Nueva base de datos» crea una base de datos KDBX 4 vacía cifrada con AES-256 y Argon2id
(64 MiB, 10 pasadas: los valores predeterminados de KeePassXC, alrededor de medio segundo en un navegador).

### En un móvil

Con un ancho de hasta 900 píxeles (un teléfono o una tableta en vertical), la página muestra una sola
cosa a la vez. La lista de entradas ocupa la pantalla; un toque abre una entrada en una pantalla
propia, y ‹ en la barra de herramientas, el botón Atrás del sistema o un gesto hacia atrás vuelven a
la lista. Una edición se conserva al volver, igual que en un ordenador se conserva al elegir otra
entrada; una entrada nueva que se deja vacía se descarta. ☰ despliega los grupos, las etiquetas y la
papelera de reciclaje sobre la lista. Los menús, el generador y los ajustes suben desde la parte
inferior de la pantalla; Atrás los cierra primero, y cancela un cuadro de diálogo. El generador, los
ajustes y el bloqueo están en el menú ⋯ de la barra de herramientas.

Una pantalla táctil no tiene clic derecho ni arrastre: el ⋯ junto a un grupo abre el menú que en un
ordenador abre el clic derecho, y su «Mover al grupo…» hace lo que hace un arrastre. El menú de una
entrada es su ⋯ en la pantalla de la entrada.

El archivo se abre en modo de solo lectura. En iOS, Guardar pasa la base de datos actualizada al menú
Compartir, donde «Guardar en Archivos» puede ponerla en lugar del original; cerrar el menú deja los
cambios sin guardar. Chrome en Android solo comparte imágenes, sonido, vídeo y texto, así que allí
Guardar descarga la copia.

Con más ancho, y en una tableta, los tres paneles se quedan como en un ordenador; una pantalla táctil
de cualquier tamaño recibe botones más grandes y el ⋯ junto a los grupos.

## Extensión para Chrome

**[Instalar desde la Chrome Web Store](https://chromewebstore.google.com/detail/hiahfdknjchamepclnokcalkcjcfhahf)**

`npm run build` también genera `build/extension/`: la misma aplicación como extensión para Chrome, y
`build/password-manager-extension-<version>.zip` con ella para la Chrome Web Store. Para probar una
compilación propia: `chrome://extensions` → Modo de desarrollador → Cargar descomprimida → `build/extension`.

El icono de la barra de herramientas abre una ventana emergente compacta: las entradas del sitio de
la pestaña, un clic en una para rellenarla, botones para copiar su usuario, su contraseña o su código
de un solo uso, y una búsqueda en toda la base de datos. **Modo completo**, en su parte inferior, abre
la aplicación en el panel lateral de Chrome, junto a la página (con el diseño de teléfono, ya que un
panel es estrecho), donde se mantiene al cambiar de pestaña. Allí todo funciona como en el archivo;
lo que añade la extensión es rellenar los inicios de sesión:

- **La ventana emergente** desbloquea, solo con la contraseña maestra, el archivo que el panel abrió
  por última vez: el panel elige los archivos y los archivos de clave, y hace todos los cambios. En
  un sitio sin entrada, su **Nueva contraseña** abre el panel en el generador, igual que Rellenar en
  el menú.
- **Rellenar** en el menú contextual de una página (un clic derecho en la página o en un campo)
  rellena el usuario y la contraseña de la entrada del sitio de la pestaña, o su código de un solo
  uso, en el paso de un inicio de sesión que lo pide. Con una sola entrada para el sitio rellena al
  instante, con el panel abierto o no; con varias, con ninguna o con la base de datos bloqueada, abre
  el panel para elegir una, crear una contraseña o desbloquear, y continúa desde ahí. Un inicio de
  sesión en dos pasos (Google, Microsoft) toma el usuario en el primero y la contraseña en el segundo:
  la entrada elegida para la pestaña se recuerda. El botón **Rellenar** de una entrada en el panel
  rellena esa entrada en la pestaña.
- **La base de datos sigue abierta** cuando se cierra el panel, hasta que se bloquea: tras el tiempo
  de inactividad de los ajustes, cuando se bloquea la pantalla del ordenador, desde el panel, desde
  la ventana emergente o desde **Bloquear** en el menú del icono de la barra de herramientas. Al
  volver a abrirse, el panel la retoma sin la contraseña, y la ventana emergente la muestra al instante.
- **Para este sitio**, en la parte superior del panel de grupos, muestra las entradas del sitio de la
  pestaña, y la lista se abre en él; sigue a la pestaña.
- **Una contraseña nueva para una página.** En un sitio sin entrada, Rellenar abre el generador
  Derivada v3 con el sitio de la pestaña y el usuario escrito en la página. Su botón Rellenar
  introduce la contraseña (en los dos campos de un formulario de registro) y la guarda como una
  entrada normal.

Una entrada corresponde a una pestaña cuando su sitio web nombra exactamente el sitio de la pestaña:
ambas direcciones pasan por `siteOf()` del generador 3, sin esquema, puerto, ruta ni `www.`, y con los
IDN en punycode. `google.com` no corresponde a `accounts.google.com`, ni `mail.site.com` a `site.com`.
Una entrada con `https://`, o sin esquema, nunca se rellena en una página `http://`: un sitio que se
usa por http necesita `http://` en su sitio web. Las entradas de la papelera de reciclaje no se
ofrecen, y una entrada elegida a mano para otro sitio solo se rellena tras un aviso que nombra a ambos.

**Cómo está hecha.** El panel es la propia página: `panel.html`, con su script en `panel.js`, como
exige Manifest V3. En cada desbloqueo y cada guardado entrega el archivo y su clave (la contraseña en
un `ProtectedValue`, el archivo de clave) a un documento offscreen, que los guarda, junto con una
copia de solo lectura de la base de datos descifrada a partir de ellos, en memoria hasta el bloqueo;
al bloquear se cierra, y la clave se va con él. No se escribe nada en ningún sitio. El service worker
tiene los menús. Un clic en Rellenar solo puede abrir el panel antes de esperar a nada, así que el
worker tiene que saber al instante si puede rellenar: guarda los sitios web de las entradas (ni
nombres ni contraseñas) a medida que el documento offscreen se los envía, y el documento offscreen lo
mantiene en marcha. La ventana emergente (`popup.html`, `popup.js`) no descifra nada: pide al
documento offscreen los títulos y usuarios que corresponden a la pestaña, y luego la entrada en la que
se hizo clic; si está bloqueada, lee el archivo reciente y se lo entrega, con la contraseña, a ese
documento para que lo abra.

**Qué llega a una página.**

- Solo lo que pide un clic, y solo los valores de una entrada. No se ejecuta ningún content script en
  ningún sitio: con un clic, `chrome.scripting.executeScript` pregunta primero a cada frame de la
  pestaña dónde está y qué campos de inicio de sesión tiene, sin enviar valores; después solo los
  reciben los frames del sitio de la entrada, y la función vuelve a comprobar su propia dirección
  antes de escribir. Un frame de otro sitio en la misma página no recibe nada.
- Solo se rellenan los campos que una persona puede ver: visibles, habilitados, editables, de cierto
  tamaño y dentro de la ventana. Un campo oculto como trampa se queda vacío.
- Los valores se asignan desde el mundo aislado de la extensión, saltándose cualquier setter que una
  página ponga en sus campos, y los eventos `input` y `change` avisan a React, Vue o Angular.
- La contraseña maestra, las demás entradas y la lista de sitios nunca llegan a una página.

**Permisos.** `activeTab` en lugar de todos los sitios: un clic en el icono o en Rellenar da a la
extensión esa única pestaña. Por eso el panel se abre desde la ventana emergente o desde el menú,
nunca con el ajuste propio de Chrome (`openPanelOnActionClick`): un panel abierto así no recibe
ninguna pestaña. Rellenar en el panel, en una pestaña que no se le dio, pide una vez el sitio de la
entrada (`optional_host_permissions`). `contextMenus`, `scripting` y `sidePanel` para lo anterior,
`offscreen` para el documento, `idle` para el bloqueo de pantalla, `clipboardWrite` para borrar un
secreto copiado con el panel cerrado. No hay `externally_connectable`: las partes de la extensión se
comunican por `chrome.runtime`, y cada una solo acepta mensajes de las propias páginas de la
extensión. Sus páginas tienen `connect-src 'none'`, igual que el archivo; la compilación lo comprueba,
y también que ninguna página tenga un script en línea ni una dirección externa.

Una diferencia con el archivo: al volver a abrirse, el panel escribe la base de datos en su sitio solo
si Chrome todavía lo permite; si no, la barra de estado lo indica, y el primer Guardar lo pide.

## Seguridad

- **Nada sale de la página.** Una Content-Security-Policy en el archivo prohíbe cualquier petición de
  red, envío de formulario y recurso externo; la compilación falla si falta la política o aparece una
  referencia externa. La copia de la PWA admite tres cosas más, todas de su propio origen: el
  manifiesto, el service worker y los iconos; `connect-src` sigue siendo `'none'`.
- El código del formato es [kdbxweb](https://github.com/keeweb/kdbxweb), la biblioteca sobre la que
  está construido KeeWeb; Argon2 es el WebAssembly de [hash-wasm](https://github.com/Daninet/hash-wasm),
  que también va incrustado en el archivo.
- Los campos protegidos se guardan en memoria enmascarados con XOR (el `ProtectedValue` de kdbxweb) y
  se ocultan en pantalla hasta que se muestran. La búsqueda nunca mira dentro de los campos protegidos.
- **Contraseñas en cualquier idioma.** Cuando un navegador toma un campo por una contraseña, macOS
  activa Secure Input y fuerza una distribución de teclado latina, de modo que no se puede escribir
  una contraseña maestra en cirílico. Chrome toma por contraseña no solo `type=password` sino, por
  heurística, cualquier campo con el estilo `-webkit-text-security` o que contenga un valor de puntos,
  y sigue haciéndolo una vez que lo ha hecho. Aquí los campos secretos no dan esa pista: son campos de
  texto normales con texto transparente, y encima se dibuja una capa de puntos (en una fuente
  monoespaciada, para que el cursor no se desplace). Una etiqueta indica si el texto oculto se está
  escribiendo en cirílico (РУС) o en alfabeto latino (ENG). La contrapartida: Secure Input, que además
  oculta las pulsaciones a otras aplicaciones, nunca se activa.
- Un secreto copiado se borra del portapapeles a los 30 segundos y al bloquear.
- La base de datos se bloquea tras 15 minutos de inactividad, y con `⌘L`. Al bloquear se elimina de la
  memoria la base de datos descifrada; un bloqueo con cambios sin guardar que no se pueden escribir
  espera en lugar de descartar los cambios.
- Los enlaces de las entradas solo se abren para `http`, `https`, `ftp` y `mailto`, con `noopener`.
- Las contraseñas se generan con `crypto.getRandomValues` y muestreo por rechazo: todos los caracteres
  son igual de probables.

## Funciones

- **Grupos**: un árbol plegable; crear, cambiar el nombre y eliminar desde el menú contextual; mover
  arrastrando y soltando (entradas y grupos); un panel redimensionable y ocultable (`⌘\`).
- **Entradas**: título, usuario, contraseña, sitio web, notas, campos personalizados (sin cifrar o
  protegidos), etiquetas, fecha de caducidad, adjuntos. Ordenación por título, usuario, sitio web y fechas.
- **Códigos de un solo uso** (TOTP): de un campo `otp` (URL `otpauth://` o un secreto sin más, como lo
  guardan KeePassXC y KeeWeb), de los campos `TimeOtp-*` de KeePass o del `TOTP Seed` de TrayTOTP.
  SHA-1, SHA-256, SHA-512; el código se renueva con una cuenta atrás. **+ Código de un solo uso** en el
  editor acepta la clave de configuración que un sitio muestra junto a su código QR (o un enlace
  `otpauth://`) y muestra el código al instante, para confirmarlo en el sitio; una clave sin más se
  guarda como enlace `otpauth://`, el formato que lee KeePassXC.
- **La edición** se hace sobre un borrador: Guardar almacena primero el estado anterior en el
  historial de la entrada, como hace KeePass; Cancelar descarta el borrador. Las versiones anteriores
  se pueden consultar y restaurar.
- **Papelera de reciclaje**: eliminar mueve a la papelera; desde allí, restaurar o eliminar definitivamente.
- **Búsqueda** en el título, el usuario, el sitio web, las notas, las etiquetas, los campos
  personalizados y los nombres de los adjuntos; tienen que coincidir todas las palabras de la consulta.
- **Generador de contraseñas** (el dado, `⌘G`): crea una contraseña del tipo elegido en su lista, con
  la derivación más reciente primero; se recuerda la última elección:
  - **Derivada v3**: se calcula a partir de la contraseña maestra, el usuario, el sitio y una versión,
    así que se puede volver a calcular sin el archivo; consulta
    «[Contraseñas derivadas](#contraseñas-derivadas)»;
  - **Derivada v2** y **Derivada v1**: las calculadoras de dos programas antiguos (legacy 2 y
    legacy 1), que aparecen cuando Ajustes → «Mostrar los algoritmos de contraseñas antiguos» está
    activado; consulta «[Algoritmos antiguos](#algoritmos-antiguos)»;
  - **Aleatoria**: longitud, conjuntos de caracteres, caracteres parecidos, estimación de la entropía.

  Medidor de robustez para las contraseñas escritas.
- **Base de datos**: cambiar el nombre, cambiar la contraseña maestra y el archivo de clave, guardar una copia.
- **Idiomas**: English, 中文, हिन्दी, Español, Français, العربية, বাংলা, Português, Русский,
  اردو, Bahasa Indonesia, Deutsch, 日本語, मराठी, తెలుగు, Türkçe (los dieciséis más hablados) y
  Українська. Se elige en Ajustes o se toma del navegador; el árabe y el urdu disponen la ventana de
  derecha a izquierda.
- **Tema**: sistema, claro, oscuro, en Ajustes. Se recuerdan el idioma, el tema, el ancho de los
  paneles, la ordenación, las opciones del generador y los grupos plegados.

## Contraseñas derivadas

**Derivada v3** en el generador calcula una contraseña a partir de

- la contraseña maestra de la base de datos (el archivo de clave, si lo hay, no interviene), u otra
  escrita allí,
- el usuario,
- el sitio: el dominio en el que está la cuenta (`https://www.github.com/login` → `github.com`),
- la versión: 1, 2, … hasta 2³² − 1; «+1» da a la misma cuenta una contraseña nueva.

Esos cuatro producen 32 bytes de entropía. Los requisitos (longitud, conjuntos de caracteres,
caracteres parecidos) solo convierten esos bytes en caracteres: cambiarlos no cambia la entropía.
**Usar** pone el resultado en la entrada como una contraseña guardada normal. No se guarda nada de
cómo se creó: la entrada es como cualquier otra, y otras aplicaciones de KeePass muestran la misma
contraseña. Si el archivo se pierde, la misma contraseña maestra, el mismo usuario, sitio, versión y
requisitos dan la misma contraseña en cualquier equipo. Los valores predeterminados son 20
caracteres, los cuatro conjuntos de caracteres y sin caracteres parecidos; una contraseña creada con
otros obliga a recordarlos también.

El generador pide primero el usuario (desde una entrada, el de la propia entrada: lo que se escribe
allí aparece también en el formulario) y después el sitio; ambos son obligatorios, y la contraseña
que producen está abajo, sobre **Usar**.

- Un usuario que es una dirección de correo electrónico nombra su sitio: `test@site.com` rellena
  `site.com`, y el sitio web de la entrada se deja como está; bien puede ser `mail.site.com`. Sin
  embargo, la misma dirección sirve para iniciar sesión en muchos sitios, y el generador lo indica
  bajo el campo: para GitHub con `test@gmail.com`, escribe `github.com` en lugar del `gmail.com` que
  puso allí.
- Cualquier otro usuario requiere escribir el sitio, y desde una entrada lo escrito pasa a ser
  también su sitio web. Para empezar, se rellena con el sitio web que ya tiene la entrada.

De lo que se escribe como sitio, no importan el esquema, la ruta, el puerto ni un `www.` inicial; un
subdominio sí: `login.github.com` y `github.com` son dos sitios. Un sitio que no es una URL («Mi
banco») se usa tal cual. Desde la barra de herramientas, el generador funciona igual, con campos
propios, y copia el resultado.

«Usar la contraseña maestra de la base» está marcado cada vez que se abre el generador. Desmárcalo
para derivar a partir de otra contraseña maestra, escrita allí y no guardada en ningún sitio: para
recuperar una contraseña creada en otra base de datos, o antes de que se cambiara la contraseña
maestra. Cambiarla deja las contraseñas del archivo como están; solo cambia lo que el generador
calcula a partir de entonces.

### El algoritmo: generador 3

Todo lo que sigue está congelado: cambiar cualquier constante haría imposible volver a calcular todas
las contraseñas creadas con él. Un generador futuro llegaría como un tipo nuevo en la lista y dejaría
este tal como está. El código está en `src/core/derived.ts`; `npm test` lo comprueba con vectores
fijos y con una implementación independiente escrita a partir de esta descripción con el propio
`crypto` de Node. Las primitivas son estándar (SHA-256, HMAC-SHA-256, Argon2id), así que el algoritmo
se puede reconstruir en cualquier lenguaje.

Funciona en dos etapas: los secretos se convierten en 32 bytes de entropía, y después los requisitos
extraen caracteres de esos bytes.

**Etapa 1: entropía.**

1. *Normalizar las entradas.* Todas las cadenas están en UTF-8.
   - `site`: el host de lo que se escribió como sitio; el texto se analiza como una URL WHATWG
     (se antepone `https://` cuando el texto no tiene `scheme://`): en minúsculas, IDN en punycode,
     sin puerto, sin usuario ni contraseña y sin un `www.` inicial; el texto que no se puede analizar
     como URL se usa tal cual. Después se recortan los espacios, se normaliza a NFC y se pasa a minúsculas.
   - `user`: el usuario, sin espacios en los extremos y normalizado a NFC; se conservan las mayúsculas.
   - `master`: la contraseña maestra, normalizada a NFC, sin recortar nada. Una «é» escrita como un
     solo carácter o como «e» más un acento combinable da la misma contraseña.
2. *Sal.*
   ```
   salt = SHA-256( "html-password-manager/derived/v3" ‖ 0x00
                   ‖ u32be(byte length of site) ‖ site
                   ‖ u32be(byte length of user) ‖ user
                   ‖ u32be(version) )
   ```
   Los prefijos de longitud mantienen separados `ab` + `c` y `a` + `bc`; la etiqueta separa estos
   bytes de cualquier otro uso de las mismas entradas. `u32be` es un entero de 4 bytes big-endian.
3. *Estiramiento.*
   ```
   entropy = Argon2id(password = master, salt, memory = 64 MiB, passes = 3,
                      lanes = 1, version 0x13, output = 32 bytes)
   ```
   Argon2id hace que cada intento de adivinar la contraseña maestra cueste 64 MiB de memoria, que es
   lo que frena a las GPU y los ASIC. Como el sitio, el usuario y la versión están en la sal, cada
   cuenta tiene la suya: no se puede precalcular ninguna tabla, y cada cuenta tiene que atacarse por
   separado.

**Etapa 2: conformación.** Los requisitos solo se usan aquí, así que cambian el aspecto de la
contraseña, no la entropía que hay detrás.

4. *Un flujo de bytes aleatorios*, tan largo como haga falta (32 bytes no bastan para una contraseña
   larga y su barajado):
   ```
   block(i) = HMAC-SHA-256(key = entropy, "hpm-v3-stream" ‖ u32be(i)),  i = 0, 1, 2, …
   ```
5. *Un número sin sesgo menor que n.* Toma los siguientes 4 bytes del flujo como un u32 big-endian
   `x`. Si `x ≥ 2³² − (2³² mod n)`, descártalo y toma el siguiente; si no, el resultado es
   `x mod n`. (Un `x mod n` sin más favorecería el principio del alfabeto.)
6. *Caracteres.* Los conjuntos, en este orden, cada uno solo si está elegido:
   ```
   A–Z      ABCDEFGHIJKLMNOPQRSTUVWXYZ
   a–z      abcdefghijklmnopqrstuvwxyz
   0–9      0123456789
   symbols  !#$%&*+-=?@^_~.,:;()[]{}<>/|
   ```
   Sin caracteres parecidos, se eliminan de ellos `O 0 o I l 1 |`. Después:
   ```
   chars = []
   for each chosen set:            chars.push(set[draw(|set|)])      # every set is present
   while |chars| < length:         chars.push(all[draw(|all|)])      # all = the sets joined
   for i = length − 1 down to 1:   j = draw(i + 1); swap chars[i], chars[j]   # Fisher–Yates
   password = chars joined
   ```
   La longitud va de 4 a 128. Tomar primero un carácter de cada conjunto es lo que garantiza «tiene
   un dígito» y «tiene un símbolo»; el barajado oculta adónde fueron esos caracteres.

**Vector de prueba.** Contraseña maestra `Тестовый пароль`, sitio `https://www.github.com/login`
(`github.com`), usuario `me@example.com`, versión 1, los requisitos predeterminados
(20 caracteres, los cuatro conjuntos, sin caracteres parecidos):

```
password  A6qVXXF]7<%a)aa<x7*U
```

La misma entropía con 12 caracteres y sin símbolos da `yaM6VJaJFYUQ`; la versión 2 con los valores
predeterminados da `3q_bwppbE8P2+ufKr:P6`.

### Cuán robusta es

- Una contraseña derivada tiene como máximo 256 bits de entropía (los 32 bytes); 20 caracteres de los
  cuatro conjuntos sin caracteres parecidos son unos 128 bits. En la práctica, el límite lo pone la
  contraseña maestra.
- **El punto débil de cualquier esquema de contraseñas derivadas:** una contraseña filtrada por un
  sitio permite a un atacante probar contraseñas maestras sin conexión, ya que el sitio y el usuario
  se conocen. Cada intento cuesta una ejecución de Argon2id sobre 64 MiB: alrededor de 0,15–0,4 s en
  un navegador, menos en hardware especializado. Una contraseña maestra corta o común se encontrará;
  una frase de contraseña larga, no. Las contraseñas aleatorias no tienen esta debilidad, y por eso
  el generador ofrece ambas.
- Mientras la contraseña maestra resista, una contraseña filtrada no revela nada de los demás sitios
  ni versiones: proceden de otras sales y, por tanto, de otras ejecuciones de Argon2.

Mientras la base de datos está abierta, la contraseña maestra se guarda en memoria enmascarada con
XOR, junto con la entropía calculada hasta el momento; al bloquear se eliminan ambas.

## Algoritmos antiguos

Dos programas antiguos para Windows calculaban contraseñas a partir de frases secretas; **Derivada v1**
(legacy 1) y **Derivada v2** (legacy 2) en el generador los reproducen exactamente, de modo que las
contraseñas creadas con ellos se pueden recuperar. Son calculadoras: no se guarda nada de lo que se
escribe en ellas, las frases desaparecen al cerrar el generador, y **Usar** pone el resultado en la
entrada como una contraseña guardada normal. Ajustes → «Mostrar los algoritmos de contraseñas
antiguos» hace que aparezcan.

Abiertos desde una entrada, ambos proponen el identificador: un usuario que ya nombra su sitio
(`mail@site.com`) tal cual, y si no, el usuario, `@` y el sitio sin `www.` (`dmytro@github.com`); se
puede cambiar. Cada frase (la clave maestra y la clave secundaria, la frase secreta primaria y la
secundaria) tiene su propia casilla «Recordar hasta que se bloquee la base»: una marcada se guarda en
la memoria de la página, enmascarada con XOR, y se rellena la próxima vez; con la primera frase
guardada, la clave se calcula al instante. Ambos pueden tomar además como primera frase la propia
contraseña maestra de la base de datos (aquella con la que se desbloqueó): la clave maestra de
legacy 1 o la frase secreta primaria de legacy 2 («Usar la contraseña maestra de la base», que se
recuerda en los ajustes para cada uno); ese campo y su casilla quedan entonces desactivados. Nada de
ello se escribe en el disco; bloquear, cerrar la base de datos o desactivar los algoritmos antiguos
lo olvida todo. El código está en `src/core/legacy.ts`; `npm test` lo comprueba con vectores
calculados por los programas .NET originales.

**Legacy 1**: clave maestra, identificador, clave primaria, clave secundaria, resultado:

```
short(bytes) = Base64(bytes) without "=", "/", "+", first 10 characters
primary key  = short(SHA-1 applied 1 000 000 times to UTF-8(master key ‖ identifier))
result       = short(SHA-1(UTF-8(primary key ‖ secondary key)))
```

La clave primaria está ligada al identificador y se puede guardar aparte (en papel), así que la clave
maestra no tiene por qué escribirse en ningún sitio: se puede introducir directamente. La clave
secundaria hace que una nota robada no sirva por sí sola.

**Legacy 2** (Password.Generator 1.0): protección primaria: identificador, frase secreta primaria,
longitud de la clave, conjuntos de caracteres; protección secundaria: la clave, frase secreta
secundaria, versión de la contraseña, longitud de la contraseña, conjuntos de caracteres:

```
digest(a, b, v, n) = SHA-1 applied n times to UTF-8(a) ‖ UTF-8(b) ‖ (v > 0 ? u32le(v) : nothing)
key                = select(digest(identifier, primary phrase, 1, 100 000), key length + 2)
password           = select(digest(key, secondary phrase, version, 1), password length + 2)
```

`select` lee el resumen como cinco u32 little-endian, activa el bit superior de cada uno, lo escribe
en base N del alfabeto (`!#$%&'()+,-.` (si está elegido), dígitos (siempre), A–Z, a–z (si está
elegido)), empezando por el dígito menos significativo, conserva 5 caracteres de cada uno y recorta
a la longitud (1–18). Los dos primeros caracteres son una firma para comparar a simple vista con la
que mostraba el programa; el resto es la clave o la contraseña. La versión de la clave es siempre 1:
el programa no tiene un campo para ella. Identificador `1`, frase `1`, longitud 10, dígitos y letras
dan la clave `E8 8pgYm9fZha`.

Ambos son mucho más débiles que la versión 3: un intento de adivinar las frases le cuesta a un
atacante unas pocas ejecuciones de SHA-1 en lugar de una ejecución de Argon2id sobre 64 MiB, y un
resultado de Legacy 1 tiene 10 caracteres, unos 60 bits. Úsalos para recuperar contraseñas antiguas,
no para crear otras nuevas.

## Atajos de teclado

| Acción | Teclas |
| --- | --- |
| Guardar | `⌘S` |
| Bloquear | `⌘L` |
| Buscar | `⌘F` |
| Nueva entrada | `⌘N` |
| Editar · guardar la edición | `⌘E` o `Enter` · `⌘Enter` |
| Cancelar la edición | `Esc` |
| Generador de contraseñas | `⌘G` |
| Copiar contraseña · usuario · sitio web | `⌘C` · `⌘B` · `⌘U` |
| Entrada anterior · siguiente | `↑` · `↓` |
| Eliminar la entrada | `⌫` |
| Panel de grupos | `⌘\` |

## Traducciones

El texto en inglés se queda en el código: `t('menu', 'Delete')`, `tn('status', '{count} entry',
'{count} entries', n)`, y `data-i18n="context"` / `data-i18n-attr="context"` en la plantilla. El
primer argumento es el contexto, la parte de la interfaz a la que pertenece una cadena, de modo que la
misma palabra inglesa se puede traducir de forma distinta en dos lugares. Un diccionario,
`src/locales/<code>.json`, asigna contexto → texto en inglés → traducción:

```json
{
  "menu": { "Delete": "Удалить" },
  "status": { "{count} entries": { "one": "{count} запись", "few": "{count} записи", "many": "{count} записей", "other": "{count} записи" } }
}
```

Una cadena que falta en el diccionario se muestra en inglés. Un texto con un número tiene una forma
por cada categoría de plural del idioma (`Intl.PluralRules`), con la forma plural inglesa como clave.
`npm run i18n` muestra, por idioma, las cadenas que aún no están traducidas y las que ya no se usan;
`npm test` comprueba que cada traducción conserva los marcadores de posición del inglés y tiene todas
las formas de plural.

Lo que Chrome muestra de la propia extensión (su nombre y su descripción, el título del botón de la
barra de herramientas) sigue el idioma del navegador y no el del panel, mediante `chrome.i18n`. Esos
textos son los ingleses de `src/extension/manifest.json`, traducidos en los mismos diccionarios bajo
el contexto `manifest`; la compilación los escribe en `_locales/<code>/messages.json` y pone
`__MSG_appName__` y similares en el manifiesto. Chrome tiene sus propios códigos e ignora el resto:
`pt` se convierte en `pt_BR` y `pt_PT`, `zh` en `zh_CN`, y el urdu no tiene ninguno, así que allí
Chrome nombra la extensión en inglés. La compilación se detiene ante un nombre de más de 75
caracteres o una descripción de más de 132.

Este README también está traducido: `docs/readme/README.<code>.md`, uno por idioma, con la lista de
idiomas al principio de cada uno. Un cambio aquí debe llevarse también a las traducciones.

## Compilación

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

`build.mjs` empaqueta `src/app/main.ts` con esbuild en una IIFE y la sustituye, junto con los estilos
y el icono (una data URI), en `src/app/template.html`. Los sustitutos de kdbxweb para Node (`crypto`,
`@xmldom/xmldom`) se reemplazan por stubs vacíos: un navegador tiene `crypto.subtle` y `DOMParser`.
El resultado es `build/password-manager.html`, de unos 500 KB, una cuarta parte de ellos diccionarios.

La misma ejecución genera `build/pages/`: esa página como PWA instalable, con `index.html` con un
enlace al manifiesto y una `<meta name="service-worker">` que indica a la página que registre su
worker, `manifest.webmanifest`, los iconos y `sw.js`, que guarda la página en caché para que se
abra sin conexión. El propio `build/password-manager.html` sigue siendo un único archivo sin
referencias externas.

Y `build/extension/`: `panel.html` es la plantilla con su script en `panel.js` (el mismo
`src/app/main.ts`, con `src/extension/extension.ts` en lugar de `src/app/platform.ts`, cuyos hooks no
hacen nada en el archivo), junto a `popup.html` (con los estilos de la página y `popup.css`) y
`popup.js`, `background.js`, `offscreen.html` y `offscreen.js`, los iconos y `manifest.json`, cuya
versión es la de `package.json`. `build/password-manager-extension-<version>.zip` contiene los mismos
archivos, con fechas fijas: las mismas fuentes dan los mismos bytes.

`tests/extension.mjs` carga esa extensión en Chrome headless mediante el protocolo DevTools
(`Extensions.loadUnpacked` a través de una tubería; `--load-extension` ya no existe en Chrome desde la
versión 137) y rellena sitios de prueba en un servidor local: un formulario sencillo, uno al estilo de
React, un inicio de sesión en tres pasos con un código de un solo uso, frames del propio sitio y de
otro sitio, campos ocultos como trampa, una página http para una entrada https, un registro rellenado
con una contraseña Derivada v3, con el panel cerrado y después del bloqueo; y la ventana emergente,
que desbloquea, rellena, busca, copia y bloquea. Un menú contextual no se puede pulsar desde DevTools,
así que la prueba dispara ella misma el `onClicked` del worker; sin un clic real, Chrome no concede
`activeTab`, de modo que la copia que se prueba puede acceder a los sitios de prueba, `*.test`, como
permisos de host. El icono de la barra de herramientas sí se puede pulsar desde DevTools
(`Extensions.triggerAction`): un Chrome propio, con la extensión tal como se compiló, comprueba que el
clic da la pestaña a la ventana emergente. Chrome 153 headless falla con ese clic, sea cual sea la
extensión, y la comprobación se omite entonces; Chrome for Testing la ejecuta
(`CHROME=/path/to/chrome-for-testing npm run test:browser`).

`tests/fixtures/Database.kdbx` es una base de datos de ejemplo para las pruebas; su contraseña es `Тестовый пароль`.

## Versiones y publicaciones

La versión se escribe en un solo lugar, `package.json`. La compilación la pone en la página (la línea
bajo la pantalla de entrada, la parte inferior de los ajustes), en el `manifest.json` de la extensión
y en el nombre de la caché de la PWA. Una compilación del commit etiquetado `v<version>` la muestra tal
cual; cualquier otra añade su commit, `0.8.0+1a2b3c4`, para que una página de `main` en GitHub Pages
no se tome por la versión publicada. El campo `version` de Chrome solo admite números, así que allí el
commit va en `version_name`.

```sh
npm version minor           # 0.7.2 -> 0.8.0: package.json, package-lock.json, a commit and the tag v0.8.0
git push --follow-tags      # the tag starts .github/workflows/release.yml
```

El flujo de publicación se detiene si la etiqueta y `package.json` no coinciden, y después adjunta
`password-manager-<tag>.html`, `password-manager-extension-<tag>.zip` y `SHA256SUMS.txt`.

## GitHub Pages

`.github/workflows/pages.yml` compila y prueba cada push a `main` y despliega `build/pages/` en GitHub
Pages (Settings → Pages → Source: GitHub Actions), en
<https://password.marketkernel.com/>. Los archivos se abren igual que en el archivo
único; los archivos recientes, los ajustes y los identificadores recordados pertenecen a esa dirección,
separados de los de una copia abierta desde el disco.

Cada despliegue cambia el nombre de la caché en `sw.js`, así que el navegador recoge el nuevo
worker por sí solo: al iniciar con conexión, o cuando Ajustes → Buscar actualizaciones lo pide.
El nuevo worker descarga su versión en una caché propia y espera; el que está en marcha sigue
sirviendo la página anterior, también sin conexión. Los ajustes y la pantalla de desbloqueo dicen
entonces «La versión … está lista. Actualizar»: Actualizar bloquea la base de datos (guardándola,
o preguntando, como cualquier bloqueo), deja entrar al nuevo worker y recarga la página. Sin el
botón, la nueva versión arranca en cuanto se cierran todas las ventanas de la app. Esa es también
la contrapartida: una PWA instalada ejecuta lo que haya puesto allí el último despliegue, mientras
que un archivo descargado sigue siendo la versión que es. Para tener una versión fija en el disco,
toma `password-manager-<tag>.html` de una versión publicada y compáralo con `SHA256SUMS.txt`.

`npm run test:browser` abre también `build/pages/`: el service worker se hace cargo de la página,
Chrome considera instalable el manifiesto y, sin el servidor, la página sigue cargando y desbloquea la
base de datos de ejemplo; luego se encuentra un nuevo despliegue, espera, y Actualizar lo deja entrar.

## Estructura

```
src/core/             sin DOM: las pruebas lo ejecutan en Node
  kdbx.ts             kdbxweb + Argon2: abrir, guardar, crear; campos, grupos, papelera de reciclaje
  generator.ts        generador de contraseñas y estimación de robustez
  derived.ts          contraseñas derivadas: generador 3, el sitio de una dirección de correo, la contraseña maestra de la sesión
  site.ts             siteOf(): el sitio de un sitio web, para el generador 3 y para emparejar pestañas
  legacy.ts           los algoritmos antiguos: legacy 1 y legacy 2
  otp.ts              TOTP (RFC 6238) y las formas de guardar los secretos
  match.ts            qué entradas corresponden a una pestaña
  i18n.ts             t()/tn(), la lista de idiomas, la traducción del marcado de la página
src/app/              la página: el archivo único, la PWA y el panel lateral de la extensión
  template.html       marcado con los marcadores __STYLES__/__APP__/__ICON__, la CSP; también el panel.html de la extensión
  styles.css          paleta, temas claro y oscuro, tres paneles; en un teléfono, una pantalla a la vez
  main.ts             la pantalla de entrada, desbloqueo, guardado, bloqueo, barra de herramientas, atajos, ajustes
  files.ts            File System Access API, arrastrar y soltar, selector de archivos; archivos recientes
  groups.ts           el árbol de grupos, las etiquetas y la papelera de reciclaje en el panel izquierdo
  list.ts             la lista de entradas
  details.ts          una entrada: lectura, edición sobre un borrador, historial, adjuntos, TOTP
  search.ts           búsqueda, ordenación, enlaces seguros
  genpanel.ts         la ventana emergente del generador: aleatoria, versión 3, legacy 1 y 2
  clipboard.ts        copia con borrado temporizado
  avatar.ts           iconos de las entradas: iconos personalizados de la base de datos o una letra de color
  settings.ts         localStorage: idioma, tema, paneles, temporizadores de bloqueo y del portapapeles
  ui.ts               cuadros de diálogo, menú contextual, ventanas emergentes, avisos, iconos; hojas en un teléfono
  screens.ts          el diseño de teléfono: la lista o la entrada, el cajón de grupos, el botón Atrás
  platform.ts         lo que la página hace más allá de sí misma: nada, en el archivo y en la PWA
  update.ts           las actualizaciones de la PWA: registra sw.js, encuentra una versión en espera y la deja entrar
src/extension/        la extensión para Chrome
  manifest.json       su manifiesto; la compilación añade la versión
  extension.ts        platform.ts del panel lateral: el documento offscreen, la pestaña, Rellenar
  popup.ts            la ventana emergente del icono de la barra (popup.html, popup.css): las entradas del sitio, Modo completo
  background.ts       el service worker: los menús, el bloqueo de pantalla, rellenar una pestaña
  offscreen.ts        el documento offscreen (offscreen.html): la base de datos abierta hasta el bloqueo
  fill.ts             la función que se inserta en una página: encuentra los campos de inicio de sesión y los rellena
  messages.ts         cómo se comunican las partes de la extensión
src/pwa/sw.js         el service worker de la compilación para Pages
src/locales/          un diccionario por idioma
assets/               el icono; pwa/, sus tamaños PNG para la PWA; extension/, el icono de la extensión
tests/                ciclos de ida y vuelta de .kdbx, generador y TOTP, contraseñas derivadas, algoritmos antiguos, emparejamiento de pestañas,
                      diccionarios, la página y la extensión en Chrome headless; fixtures/, la base de datos de ejemplo
tools/                load.mjs compila los módulos de src/ para las pruebas; i18n.mjs compara los diccionarios con el código
docs/                 la captura de pantalla de arriba; readme/, este README en los demás idiomas; notas de trabajo (fuera de git)
build/                el resultado de la compilación; build/pages/ es la PWA para GitHub Pages, build/extension/ la extensión
```

## Limitaciones

- Se admiten KDBX 3.1 y 4.x; los archivos cifrados con Twofish y los de KeePass 1 (`.kdb`) no.
- No hay sincronización, autoescritura ni fusión de copias modificadas.
- La extensión es solo para Chrome, y no tiene sugerencias en los campos, ni guarda una contraseña al
  enviar un formulario, ni atajo de teclado, y admite un solo sitio web por entrada.
- Solo los navegadores basados en Chromium pueden escribir el archivo en su sitio.

## Licencia

MIT; consulta [LICENSE](../../LICENSE). kdbxweb y hash-wasm también tienen licencia MIT.
