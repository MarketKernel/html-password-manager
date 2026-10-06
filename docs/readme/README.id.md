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
<b>🇮🇩 Bahasa Indonesia</b> ·
<a href="README.de.md">🇩🇪 Deutsch</a> ·
<a href="README.ja.md">🇯🇵 日本語</a> ·
<a href="README.mr.md">🇮🇳 मराठी</a> ·
<a href="README.te.md">🇮🇳 తెలుగు</a> ·
<a href="README.tr.md">🇹🇷 Türkçe</a> ·
<a href="README.uk.md">🇺🇦 Українська</a>
</h3>
<!-- /languages -->

**Deterministic Password** menghitung sandi, bukan sekadar menyimpannya. Sandi untuk sebuah situs
diturunkan dari sandi utama, situs, nama pengguna, dan nomor versi, dengan Argon2id dan
HMAC-SHA-256. Jika file basis data hilang, masukan yang sama kembali menghasilkan sandi yang sama,
di komputer mana pun — kehilangan file tidak lagi menakutkan. Untuk mengganti sandi sebuah situs,
naikkan versinya. Cara kerjanya: "[Sandi turunan](#sandi-turunan)".

Aplikasi ini juga merupakan pengelola sandi KeePass yang lengkap: ia membuka, mengedit, dan
menyimpan file `.kdbx` biasa (KDBX 4, AES-256, Argon2id), sehingga basis data yang sama tetap
dapat digunakan di KeePassXC, KeePass, atau KeeWeb. Sandi turunan disimpan di entri seperti sandi
lainnya, dan aplikasi KeePass lain menampilkannya dengan cara yang sama.

Semuanya berfungsi secara offline: tanpa akun, tanpa cloud, tanpa permintaan jaringan. Seluruh
aplikasi adalah satu file HTML mandiri; basis data didekripsi di memori halaman dan disimpan
langsung kembali ke disk, dan sandi utama tidak pernah meninggalkan halaman. Halaman yang sama juga
merupakan [ekstensi Chrome](#ekstensi-chrome) yang mengisikan data login ke tab di sebelahnya —
**[pasang dari Chrome Web Store](https://chromewebstore.google.com/detail/hiahfdknjchamepclnokcalkcjcfhahf)**.

**[Versi online](https://password.marketkernel.com/)** — halaman yang sama
dalam bentuk PWA (Progressive Web App): dapat dipasang ke sistem lalu berjalan sebagai
aplikasi terpisah, dengan jendela dan ikonnya sendiri, serta berfungsi secara offline. Di
komputer, pada Chrome, Edge, dan Arc, gunakan tombol pasang di bilah alamat; di Android, menu ⋮
Chrome → Instal aplikasi; di iOS, Bagikan → Tambah ke Layar Utama, di Safari maupun di Chrome.
Saat dipasang di Chrome atau Edge di komputer, aplikasi ini juga membuka `.kdbx` dari Finder
atau Explorer (Buka Dengan) dan menyimpannya langsung kembali ke sana.
Di sana pun basis data tetap berada di disk Anda — lihat "[GitHub Pages](#github-pages)".

![html-password-manager: grup, entri, dan entri yang sedang diedit](../password-manager.jpg)

## Cara menggunakan

1. Bangun `build/password-manager.html` (lihat "[Membangun](#membangun)") lalu buka di
   browser — langsung dari disk pun bisa.
2. "Buka file" → pilih basis data `.kdbx`, atau seret ke jendela.
3. Masukkan sandi utama (dan pilih file kunci, jika basis data menggunakannya) → Buka kunci.

Di Chrome, Edge, dan Arc, file dibuka melalui File System Access API: perubahan ditulis kembali
ke file yang sama, sesaat setelah setiap pengeditan jika simpan otomatis aktif, dan file
ditawarkan lagi pada kunjungan berikutnya — yang diingat hanya handle-nya, tidak pernah isinya
ataupun sandinya. Di Safari dan Firefox, file dibuka dalam mode hanya baca, dan Simpan
mengunduh salinan basis data yang diperbarui — begitu pula di ponsel: Chrome di Android tidak
memiliki File System Access, dan setiap browser di iOS, termasuk Chrome, berjalan dengan mesin
Safari. Di iOS, Simpan justru meneruskan salinan ke lembar berbagi — lihat
"[Di ponsel](#di-ponsel)".

"Basis data baru" membuat basis data KDBX 4 kosong yang dienkripsi dengan AES-256 dan Argon2id
(64 MiB, 10 putaran — bawaan KeePassXC, sekitar setengah detik di browser).

### Di ponsel

Hingga lebar 900 piksel — ponsel, atau tablet dalam posisi tegak — halaman menampilkan satu hal
dalam satu waktu. Daftar entri memenuhi layar; satu ketukan membuka entri di layarnya sendiri,
dan ‹ di bilah alat, tombol kembali sistem, atau usapan kembali membawa Anda ke daftar lagi.
Suntingan tetap dipertahankan saat kembali, sama seperti saat memilih entri lain di komputer;
entri baru yang dibiarkan kosong dibuang. ☰ menggeser grup, tag, dan tempat sampah masuk di
atas daftar. Menu, generator, dan setelan muncul dari bagian bawah layar; tombol kembali
menutupnya lebih dulu, dan membatalkan dialog. Generator, setelan, dan penguncian ada di menu ⋯
pada bilah alat.

Layar sentuh tidak memiliki klik kanan maupun seret: ⋯ di samping grup membuka menu yang di
komputer dibuka dengan klik kanan, dan "Pindahkan ke grup…" di dalamnya melakukan apa yang
dilakukan seret. Menu entri adalah ⋯ di layar entri tersebut.

File dibuka dalam mode hanya baca. Di iOS, Simpan meneruskan basis data yang diperbarui ke
lembar berbagi, tempat "Simpan ke File" dapat menaruhnya menggantikan file aslinya; menutup
lembar tersebut membuat perubahan tetap belum tersimpan. Chrome di Android hanya membagikan
gambar, suara, video, dan teks, jadi di sana Simpan mengunduh salinannya.

Pada layar yang lebih lebar, dan di tablet, ketiga panel tetap seperti di komputer; layar sentuh
berukuran berapa pun mendapat tombol yang lebih besar dan ⋯ di samping grup.

## Ekstensi Chrome

**[Pasang dari Chrome Web Store](https://chromewebstore.google.com/detail/hiahfdknjchamepclnokcalkcjcfhahf)**

`npm run build` juga menulis `build/extension/`: aplikasi yang sama sebagai ekstensi Chrome,
beserta `build/password-manager-extension-<version>.zip` darinya untuk Chrome Web Store. Untuk
mencoba build Anda sendiri: `chrome://extensions` → Mode developer → Muat yang belum dikemas →
`build/extension`.

Ikon di bilah alat membuka popup ringkas: entri untuk situs tab, klik pada salah satunya untuk
mengisikannya, tombol untuk menyalin nama pengguna, sandi, atau kode sekali pakainya, serta
pencarian di seluruh basis data. **Mode penuh** di bagian bawahnya membuka aplikasi di panel
samping Chrome, di samping halaman — dalam tata letak ponsel, karena panelnya sempit — dan di
sana aplikasi tetap terbuka saat berpindah tab. Semuanya berfungsi di sana seperti di file; yang
ditambahkan ekstensi adalah pengisian data login:

- **Popup** membuka kunci file yang terakhir dibuka panel hanya dengan sandi utama: panel yang
  memilih file dan file kunci, dan panel pula yang membuat setiap perubahan. Di situs tanpa
  entri, tombol **Sandi baru** di popup membuka panel pada generator, seperti yang dilakukan Isi
  di menu.
- **Isi** di menu konteks halaman (klik kanan di halaman atau di sebuah kolom) mengisikan nama
  pengguna dan sandi dari entri untuk situs tab — atau kode sekali pakainya, pada langkah login
  yang memintanya. Jika ada satu entri untuk situs tersebut, pengisian langsung dilakukan, baik
  panel terbuka maupun tidak; jika ada beberapa, tidak ada sama sekali, atau basis data
  terkunci, panel dibuka untuk memilih salah satu, membuat sandi, atau membuka kunci — lalu
  melanjutkan dari sana. Login dua langkah (Google, Microsoft) menerima nama pengguna pada
  langkah pertama dan sandi pada langkah kedua: entri yang dipilih untuk tab tersebut diingat.
  Tombol **Isi** pada entri di panel mengisikan entri tersebut ke tab.
- **Basis data tetap terbuka** saat panel ditutup, hingga terkunci: setelah waktu tidak aktif
  yang ditetapkan di setelan, saat layar komputer terkunci, dari panel, dari popup, atau dari
  **Kunci** di menu ikon bilah alat. Saat dibuka lagi, panel melanjutkannya tanpa sandi, dan
  popup langsung menampilkannya.
- **Untuk situs ini**, di bagian atas panel grup, menampilkan entri untuk situs tab, dan daftar
  terbuka pada bagian ini; bagian ini mengikuti tab.
- **Sandi baru untuk sebuah halaman.** Di situs tanpa entri, Isi membuka generator Turunan v3
  dengan situs tab dan nama pengguna yang diketik di halaman. Tombol Isi di generator
  mengisikan sandi — ke kedua kolom formulir pendaftaran — dan menyimpannya sebagai entri biasa.

Entri cocok dengan tab jika situs webnya menyebut situs tab secara persis: kedua alamat diproses
dengan `siteOf()` dari generator 3 — tanpa skema, port, path, atau `www.`, IDN dalam punycode.
`google.com` tidak cocok dengan `accounts.google.com`, begitu pula `mail.site.com` dengan
`site.com`. Entri dengan `https://`, atau tanpa skema, tidak pernah diisikan ke halaman
`http://`: situs yang digunakan melalui http memerlukan `http://` di situs webnya. Entri di
tempat sampah tidak ditawarkan, dan entri yang dipilih secara manual untuk situs lain hanya
diisikan setelah peringatan yang menyebutkan keduanya.

**Cara pembuatannya.** Panel adalah halaman itu sendiri: `panel.html`, dengan skripnya di
`panel.js`, sebagaimana dituntut Manifest V3. Pada setiap pembukaan kunci dan penyimpanan, panel
menyerahkan file dan kuncinya — sandi dalam `ProtectedValue`, file kunci — ke dokumen offscreen,
yang menyimpannya, beserta salinan hanya baca dari basis data yang didekripsi dengan keduanya, di
memori hingga penguncian; penguncian menutup dokumen tersebut, dan kuncinya ikut hilang. Tidak
ada yang ditulis di mana pun. Menu ditangani oleh service worker. Klik pada Isi hanya dapat
membuka panel sebelum ada yang ditunggu (await), jadi worker harus langsung tahu apakah ia dapat
mengisi: ia menyimpan situs web dari entri — tanpa nama, tanpa sandi — sebagaimana dikirim oleh
dokumen offscreen, dan dokumen offscreen menjaganya tetap berjalan. Popup (`popup.html`,
`popup.js`) tidak mendekripsi apa pun: ia meminta dari dokumen offscreen judul dan nama pengguna
yang cocok dengan tab, lalu satu entri yang diklik; saat terkunci, ia membaca file terbaru dan
menyerahkannya, bersama sandi, ke dokumen tersebut untuk dibuka.

**Apa yang sampai ke halaman.**

- Hanya yang diminta oleh klik, dan hanya nilai dari satu entri. Tidak ada content script yang
  berjalan di mana pun: saat klik, `chrome.scripting.executeScript` pertama-tama menanyakan
  setiap frame di tab di mana ia berada dan kolom login apa yang dimilikinya, tanpa mengirim
  nilai apa pun; lalu hanya frame dari situs entri yang menerimanya, dan fungsi tersebut
  memeriksa alamatnya sendiri sekali lagi sebelum mengetik. Frame dari situs lain di halaman
  yang sama tidak mendapat apa-apa.
- Hanya kolom yang dapat dilihat orang yang diisi: ditampilkan, aktif, dapat ditulisi, memiliki
  ukuran, dan berada di dalam jendela. Kolom yang disembunyikan sebagai jebakan tetap kosong.
- Nilai diatur dari isolated world ekstensi, melewati setter apa pun yang dipasang halaman pada
  input-nya, dan event `input` serta `change` memberi tahu React, Vue, atau Angular.
- Sandi utama, entri lain, dan daftar situs tidak pernah dikirim ke halaman.

**Izin.** `activeTab` alih-alih semua situs: klik pada ikon atau pada Isi memberi ekstensi akses
ke satu tab tersebut. Karena itu panel dibuka dari popup atau menu, tidak pernah melalui setelan
Chrome sendiri (`openPanelOnActionClick`): panel yang dibuka dengan cara itu tidak mendapat tab
sama sekali. Isi di panel pada tab yang tidak diberikan akan meminta izin sekali untuk situs
entri (`optional_host_permissions`). `contextMenus`, `scripting`, dan `sidePanel` untuk hal-hal
di atas, `offscreen` untuk dokumen tersebut, `idle` untuk kunci layar, `clipboardWrite` untuk
menghapus rahasia yang disalin saat panel tertutup. Tidak ada `externally_connectable`:
bagian-bagian ekstensi berkomunikasi melalui `chrome.runtime`, dan masing-masing hanya menerima
pesan dari halaman milik ekstensi itu sendiri. Halaman-halamannya memiliki `connect-src 'none'`,
sama seperti file; build memeriksa hal itu, serta memastikan tidak ada halaman yang memiliki
skrip inline atau alamat luar.

Satu perbedaan dari file: saat dibuka lagi, panel menulis basis data langsung ke file hanya jika
Chrome masih mengizinkannya; jika tidak, bilah status memberitahukannya, dan Simpan yang pertama
akan meminta izin.

## Keamanan

- **Tidak ada yang keluar dari halaman.** Content-Security-Policy di dalam file melarang setiap
  permintaan jaringan, pengiriman formulir, dan sumber daya luar; build gagal jika kebijakan itu
  hilang atau muncul referensi eksternal. Salinan PWA mengizinkan tiga hal lagi, semuanya dari
  origin-nya sendiri: manifest, service worker, dan ikon — `connect-src` tetap `'none'`.
- Kode format adalah [kdbxweb](https://github.com/keeweb/kdbxweb), pustaka yang menjadi dasar
  KeeWeb; Argon2 adalah WebAssembly dari [hash-wasm](https://github.com/Daninet/hash-wasm), yang
  juga disematkan di dalam file.
- Kolom yang dilindungi disimpan di memori dalam keadaan di-mask dengan XOR (`ProtectedValue`
  dari kdbxweb) dan disamarkan di layar sampai ditampilkan. Pencarian tidak pernah melihat ke
  dalam kolom yang dilindungi.
- **Sandi dalam bahasa apa pun.** Ketika browser menganggap sebuah kolom sebagai kolom sandi,
  macOS mengaktifkan Secure Input dan memaksakan tata letak keyboard Latin, sehingga sandi utama
  dalam huruf Sirilik tidak bisa diketik. Chrome menganggap sebagai kolom sandi tidak hanya
  `type=password`, tetapi juga, secara heuristik, kolom apa pun yang diberi gaya
  `-webkit-text-security` atau berisi nilai berupa titik-titik — dan terus menganggapnya demikian
  setelah sekali melakukannya. Kolom rahasia di sini tidak memberikan petunjuk seperti itu:
  kolom tersebut adalah input teks biasa dengan teks transparan, dan lapisan titik digambar di
  atasnya (dengan font monospace, agar kursor tetap di tempatnya). Sebuah lencana menunjukkan
  apakah teks tersembunyi sedang diketik dalam huruf Sirilik (РУС) atau Latin (ENG).
  Konsekuensinya: Secure Input, yang juga menyembunyikan ketukan tombol dari aplikasi lain, tidak
  pernah diaktifkan.
- Rahasia yang disalin dihapus dari papan klip setelah 30 detik dan saat penguncian.
- Basis data terkunci setelah 15 menit tidak aktif, dan dengan `⌘L`. Penguncian membuang basis
  data yang telah didekripsi dari memori; penguncian dengan perubahan belum tersimpan yang tidak
  dapat ditulis akan menunggu alih-alih membuang perubahan tersebut.
- Tautan di entri hanya dibuka untuk `http`, `https`, `ftp`, dan `mailto`, dengan `noopener`.
- Sandi dibuat dengan `crypto.getRandomValues` dan rejection sampling: setiap karakter memiliki
  peluang yang sama.

## Fitur

- **Grup**: pohon yang dapat diciutkan, pembuatan, penggantian nama, dan penghapusan melalui menu
  konteks, pemindahan dengan seret dan lepas (entri dan grup), panel yang dapat diubah ukurannya
  dan disembunyikan (`⌘\`).
- **Entri**: judul, nama pengguna, sandi, situs web, catatan, kolom khusus (biasa atau
  dilindungi), tag, tanggal kedaluwarsa, lampiran. Pengurutan berdasarkan judul, nama pengguna,
  situs web, tanggal.
- **Kode sekali pakai** (TOTP): dari kolom `otp` (URL `otpauth://` atau rahasia polos, seperti
  yang disimpan KeePassXC dan KeeWeb), dari kolom `TimeOtp-*` milik KeePass, atau dari
  `TOTP Seed` milik TrayTOTP. SHA-1, SHA-256, SHA-512; kode diperbarui dengan hitung mundur.
  **+ Kode sekali pakai** di editor menerima kunci penyiapan yang ditampilkan situs di samping
  kode QR-nya (atau tautan `otpauth://`) dan langsung menampilkan kodenya, untuk dikonfirmasi di
  situs; kunci polos disimpan sebagai tautan `otpauth://`, bentuk yang dibaca KeePassXC.
- **Pengeditan** bekerja pada draf: Simpan terlebih dahulu menyimpan keadaan sebelumnya ke
  riwayat entri, seperti yang dilakukan KeePass; Batal membuang draf. Versi-versi sebelumnya
  dapat dijelajahi dan dipulihkan.
- **Tempat sampah**: menghapus berarti memindahkan ke tempat sampah; dari sana — pulihkan atau
  hapus permanen.
- **Pencarian** di judul, nama pengguna, situs web, catatan, tag, kolom khusus, dan nama
  lampiran; setiap kata dalam kueri harus cocok.
- **Generator sandi** (dadu, `⌘G`) membuat sandi dengan jenis yang dipilih di daftarnya,
  penurunan terbaru lebih dulu; pilihan terakhir diingat:
  - **Turunan v3** — dihitung dari sandi utama, nama pengguna, situs, dan versi, sehingga dapat
    dihitung ulang tanpa file — lihat "[Sandi turunan](#sandi-turunan)";
  - **Turunan v2** dan **Turunan v1** — kalkulator dari dua program lama (legacy 2 dan
    legacy 1), ditampilkan jika Setelan → "Tampilkan algoritme sandi lama" aktif — lihat
    "[Algoritme lama](#algoritme-lama)";
  - **Acak** — panjang, set karakter, karakter yang mirip, perkiraan entropi.

  Pengukur kekuatan untuk sandi yang diketik.
- **Basis data**: ganti nama, ubah sandi utama dan file kunci, simpan salinan.
- **Bahasa**: English, 中文, हिन्दी, Español, Français, العربية, বাংলা, Português, Русский,
  اردو, Bahasa Indonesia, Deutsch, 日本語, मराठी, తెలుగు, Türkçe — enam belas bahasa yang paling
  banyak dituturkan — serta Українська. Dipilih di Setelan, atau diambil dari browser; bahasa
  Arab dan Urdu menata jendela dari kanan ke kiri.
- **Tema**: ikuti sistem, terang, gelap, di Setelan. Bahasa, tema, lebar panel, pengurutan, opsi
  generator, dan grup yang diciutkan akan diingat.

## Sandi turunan

**Turunan v3** di generator menghitung sandi dari

- sandi utama basis data (file kunci, jika ada, tidak disertakan), atau sandi utama lain yang
  diketik di sana,
- nama pengguna,
- situs — domain tempat akun berada (`https://www.github.com/login` → `github.com`),
- versi — 1, 2, … hingga 2³² − 1; "+1" memberi akun yang sama sandi baru.

Keempatnya menghasilkan 32 byte entropi. Persyaratan — panjang, set karakter, karakter yang
mirip — hanya membentuk byte tersebut menjadi karakter: mengubahnya tidak mengubah entropi.
**Gunakan** memasukkan hasilnya ke entri sebagai sandi tersimpan biasa. Tidak ada yang disimpan
tentang cara sandi itu dibuat: entri tersebut sama seperti entri lainnya, dan aplikasi KeePass
lain menampilkan sandi yang sama. Jika file hilang, sandi utama, nama pengguna, situs, versi,
dan persyaratan yang sama menghasilkan sandi yang sama di perangkat mana pun. Bawaannya adalah
20 karakter, keempat set karakter, tanpa karakter yang mirip; sandi yang dibuat dengan
persyaratan lain mengharuskan persyaratan tersebut juga diingat.

Generator menanyakan nama pengguna terlebih dahulu — jika dibuka dari entri, nama pengguna milik
entri itu sendiri: apa yang diketik di sana juga tampil di formulir — lalu situs; keduanya
wajib diisi, dan sandi yang dihasilkan ada di bagian bawah, di atas **Gunakan**.

- Nama pengguna berupa alamat e-mail sudah menyebutkan situsnya: `test@site.com` mengisikan
  `site.com`, dan situs web entri dibiarkan apa adanya — bisa saja `mail.site.com`. Namun, alamat
  yang sama dipakai untuk masuk ke banyak situs, dan generator menyatakannya di bawah kolom:
  untuk GitHub dengan `test@gmail.com`, ketik `github.com` menggantikan `gmail.com` yang
  diisikannya.
- Nama pengguna lainnya mengharuskan situs diketik, dan jika dibuka dari entri, apa yang diketik
  juga menjadi situs web entri tersebut. Situs web yang sudah dimiliki entri diisikan sejak awal.

Dari apa yang diketik sebagai situs, skema, path, port, dan `www.` di awal tidak berpengaruh;
subdomain berpengaruh — `login.github.com` dan `github.com` adalah dua situs berbeda. Situs yang
bukan URL ("Bank saya") digunakan apa adanya. Dari bilah alat, generator bekerja dengan cara yang
sama, dengan kolomnya sendiri, dan menyalin hasilnya.

"Gunakan sandi utama basis data" dicentang setiap kali generator dibuka. Hapus centangnya untuk
menurunkan dari sandi utama lain, yang diketik di sana dan tidak disimpan di mana pun — untuk
memulihkan sandi yang dibuat di basis data lain, atau sebelum sandi utama diubah. Mengubah sandi
utama membiarkan sandi di dalam file apa adanya; hanya yang dihitung generator sejak saat itu
yang berbeda.

### Algoritme: generator 3

Semua yang ada di bawah ini dibekukan: mengubah konstanta mana pun akan membuat setiap sandi
yang dibuat dengannya mustahil dihitung ulang. Generator di masa depan akan hadir sebagai jenis
baru di daftar dan membiarkan yang ini apa adanya. Kodenya ada di `src/core/derived.ts`;
`npm test` mengujinya terhadap vektor tetap dan terhadap implementasi independen yang ditulis
dari deskripsi ini dengan `crypto` bawaan Node. Primitifnya standar — SHA-256, HMAC-SHA-256,
Argon2id — sehingga algoritme ini dapat dibangun ulang dalam bahasa pemrograman apa pun.

Algoritme berjalan dalam dua tahap: rahasia menjadi 32 byte entropi, lalu persyaratan memahat
karakter dari byte tersebut.

**Tahap 1 — entropi.**

1. *Normalisasi input.* Semua string berupa UTF-8.
   - `site` — host dari apa yang diketik sebagai situs: teks diurai sebagai URL WHATWG
     (`https://` ditambahkan di depan jika teks tidak memiliki `scheme://`): huruf kecil, IDN
     dalam punycode, tanpa port, tanpa nama pengguna atau sandi, `www.` di awal dibuang; teks
     yang tidak dapat diurai sebagai URL digunakan apa adanya. Lalu dipangkas spasinya,
     dinormalisasi NFC, dan diubah ke huruf kecil.
   - `user` — nama pengguna, dipangkas spasinya dan dinormalisasi NFC; huruf besar-kecil
     dipertahankan.
   - `master` — sandi utama, dinormalisasi NFC, tanpa pemangkasan apa pun. "é" yang diketik
     sebagai satu karakter atau sebagai "e" ditambah aksen gabung menghasilkan sandi yang sama.
2. *Salt.*
   ```
   salt = SHA-256( "html-password-manager/derived/v3" ‖ 0x00
                   ‖ u32be(byte length of site) ‖ site
                   ‖ u32be(byte length of user) ‖ user
                   ‖ u32be(version) )
   ```
   Prefiks panjang memisahkan `ab` + `c` dari `a` + `bc`; label memisahkan byte ini dari
   penggunaan lain apa pun atas input yang sama. `u32be` adalah bilangan bulat big-endian 4 byte.
3. *Peregangan.*
   ```
   entropy = Argon2id(password = master, salt, memory = 64 MiB, passes = 3,
                      lanes = 1, version 0x13, output = 32 bytes)
   ```
   Argon2id membuat setiap tebakan sandi utama memakan 64 MiB memori, dan itulah yang
   memperlambat GPU dan ASIC. Karena situs, nama pengguna, dan versi ada di dalam salt, setiap
   akun memiliki salt-nya sendiri: tidak ada tabel yang dapat dihitung sebelumnya, dan setiap
   akun harus diserang secara terpisah.

**Tahap 2 — pembentukan.** Persyaratan hanya digunakan di sini, sehingga persyaratan mengubah
tampilan sandi, bukan entropi di baliknya.

4. *Aliran byte acak*, sepanjang yang diperlukan — 32 byte tidak cukup untuk sandi yang panjang
   beserta pengacakannya:
   ```
   block(i) = HMAC-SHA-256(key = entropy, "hpm-v3-stream" ‖ u32be(i)),  i = 0, 1, 2, …
   ```
5. *Bilangan tak bias di bawah n.* Ambil 4 byte berikutnya dari aliran sebagai u32 big-endian
   `x`. Jika `x ≥ 2³² − (2³² mod n)`, buang dan ambil yang berikutnya; jika tidak, hasilnya
   adalah `x mod n`. (`x mod n` saja akan lebih memihak awal alfabet.)
6. *Karakter.* Set-set berikut, dalam urutan ini, masing-masing hanya jika dipilih:
   ```
   A–Z      ABCDEFGHIJKLMNOPQRSTUVWXYZ
   a–z      abcdefghijklmnopqrstuvwxyz
   0–9      0123456789
   symbols  !#$%&*+-=?@^_~.,:;()[]{}<>/|
   ```
   Tanpa karakter yang mirip, `O 0 o I l 1 |` dihapus dari set tersebut. Lalu:
   ```
   chars = []
   for each chosen set:            chars.push(set[draw(|set|)])      # every set is present
   while |chars| < length:         chars.push(all[draw(|all|)])      # all = the sets joined
   for i = length − 1 down to 1:   j = draw(i + 1); swap chars[i], chars[j]   # Fisher–Yates
   password = chars joined
   ```
   Panjangnya 4 hingga 128. Mengambil satu karakter dari setiap set terlebih dahulu itulah yang
   menjamin "ada angka" dan "ada simbol"; pengacakan menyembunyikan ke mana karakter-karakter itu
   ditempatkan.

**Vektor uji.** Sandi utama `Тестовый пароль`, situs `https://www.github.com/login`
(`github.com`), nama pengguna `me@example.com`, versi 1, persyaratan bawaan (20 karakter,
keempat set, tanpa karakter yang mirip):

```
password  A6qVXXF]7<%a)aa<x7*U
```

Entropi yang sama dengan 12 karakter dan tanpa simbol menghasilkan `yaM6VJaJFYUQ`; versi 2
dengan persyaratan bawaan menghasilkan `3q_bwppbE8P2+ufKr:P6`.

### Seberapa kuat

- Sandi turunan memiliki paling banyak 256 bit entropi (32 byte tersebut); 20 karakter dari
  keempat set tanpa karakter yang mirip kira-kira 128 bit. Dalam praktiknya, batas atasnya
  adalah sandi utama.
- **Titik lemah setiap skema sandi turunan:** sandi yang bocor dari satu situs memungkinkan
  penyerang menebak sandi utama secara offline, karena situs dan nama pengguna sudah diketahui.
  Setiap tebakan memerlukan satu kali proses Argon2id atas 64 MiB — sekitar 0,15–0,4 dtk di
  browser, lebih cepat di perangkat keras khusus. Sandi utama yang pendek atau umum akan
  ditemukan; frasa sandi yang panjang tidak. Sandi acak tidak memiliki kelemahan ini, karena
  itulah generator menyediakan keduanya.
- Selama sandi utama bertahan, sandi yang bocor tidak mengungkap apa pun tentang situs atau versi
  lain: semuanya berasal dari salt lain, jadi dari proses Argon2 yang lain.

Sandi utama disimpan di memori dalam keadaan di-mask dengan XOR selama basis data terbuka,
bersama entropi yang telah dihitung sejauh ini; penguncian membuang keduanya.

## Algoritme lama

Dua program Windows lama menghitung sandi dari frasa rahasia; **Turunan v1** (legacy 1) dan
**Turunan v2** (legacy 2) di generator mengulanginya secara persis, sehingga sandi yang dibuat
dengan keduanya dapat dipulihkan. Keduanya adalah kalkulator: tidak ada yang diketik di dalamnya
yang disimpan, frasa hilang saat generator ditutup, dan **Gunakan** memasukkan hasilnya ke entri
sebagai sandi tersimpan biasa. Setelan → "Tampilkan algoritme sandi lama" memunculkan keduanya.

Saat dibuka dari entri, keduanya menyarankan pengenal: nama pengguna yang sudah menyebut situsnya
(`mail@site.com`) apa adanya, selain itu nama pengguna, `@`, dan situs tanpa `www.`
(`dmytro@github.com`); pengenal dapat diubah. Setiap frasa — kunci utama dan kunci sekunder,
frasa rahasia primer dan frasa rahasia sekunder — memiliki kotak "Ingat sampai basis data
dikunci" sendiri: yang dicentang disimpan di memori halaman, di-mask dengan XOR, dan diisikan
lain kali; jika frasa pertama disimpan, kunci langsung dihitung. Keduanya juga dapat memakai
sandi utama basis data itu sendiri — sandi yang digunakan untuk membuka kuncinya — sebagai frasa
pertama, yaitu kunci utama legacy 1 atau frasa rahasia primer legacy 2 ("Gunakan sandi utama
basis data", diingat dalam setelan untuk masing-masing): kolom itu beserta kotaknya kemudian
dinonaktifkan. Tidak ada yang ditulis ke disk; penguncian, penutupan basis data, atau
penonaktifan algoritme lama melupakan semuanya. Kodenya ada di `src/core/legacy.ts`; `npm test`
mengujinya terhadap vektor yang dihitung oleh program .NET aslinya.

**Legacy 1** — kunci utama, pengenal, kunci primer, kunci sekunder, hasil:

```
short(bytes) = Base64(bytes) without "=", "/", "+", first 10 characters
primary key  = short(SHA-1 applied 1 000 000 times to UTF-8(master key ‖ identifier))
result       = short(SHA-1(UTF-8(primary key ‖ secondary key)))
```

Kunci primer terikat pada pengenal dan dapat disimpan terpisah (di kertas), sehingga kunci
utama tidak perlu diketik di mana pun: kunci primer dapat dimasukkan langsung. Kunci sekunder
membuat catatan yang dicuri tidak berguna dengan sendirinya.

**Legacy 2** (Password.Generator 1.0) — perlindungan primer: pengenal, frasa rahasia primer,
panjang kunci, set karakter; perlindungan sekunder: kunci, frasa rahasia sekunder, versi sandi,
panjang sandi, set karakter:

```
digest(a, b, v, n) = SHA-1 applied n times to UTF-8(a) ‖ UTF-8(b) ‖ (v > 0 ? u32le(v) : nothing)
key                = select(digest(identifier, primary phrase, 1, 100 000), key length + 2)
password           = select(digest(key, secondary phrase, version, 1), password length + 2)
```

`select` membaca digest sebagai lima u32 little-endian, menyetel bit teratas masing-masing,
menuliskannya dalam basis N dari alfabet — `!#$%&'()+,-.` (jika dipilih), angka (selalu), A–Z,
a–z (jika dipilih) — mulai dari digit yang paling tidak signifikan, menyimpan 5 karakter dari
masing-masing, lalu memotongnya sesuai panjang (1–18). Dua karakter pertama adalah tanda tangan
untuk dicocokkan secara kasatmata dengan yang ditampilkan program; sisanya adalah kunci atau
sandi. Versi kunci selalu 1: program tidak memiliki kolom untuknya. Pengenal `1`, frasa `1`,
panjang 10, angka dan huruf menghasilkan kunci `E8 8pgYm9fZha`.

Keduanya jauh lebih lemah daripada versi 3: tebakan frasa hanya membebani penyerang beberapa
kali SHA-1, alih-alih satu kali Argon2id atas 64 MiB, dan hasil Legacy 1 terdiri dari 10
karakter, sekitar 60 bit. Gunakan keduanya untuk memulihkan sandi lama, bukan untuk membuat sandi
baru.

## Pintasan keyboard

| Tindakan | Tombol |
| --- | --- |
| Simpan | `⌘S` |
| Kunci | `⌘L` |
| Cari | `⌘F` |
| Entri baru | `⌘N` |
| Edit · simpan suntingan | `⌘E` atau `Enter` · `⌘Enter` |
| Batalkan suntingan | `Esc` |
| Generator sandi | `⌘G` |
| Salin sandi · nama pengguna · situs web | `⌘C` · `⌘B` · `⌘U` |
| Entri sebelumnya · berikutnya | `↑` · `↓` |
| Hapus entri | `⌫` |
| Panel grup | `⌘\` |

## Terjemahan

Teks bahasa Inggris tetap berada di dalam kode: `t('menu', 'Delete')`, `tn('status', '{count} entry',
'{count} entries', n)`, serta `data-i18n="context"` / `data-i18n-attr="context"` di template.
Argumen pertama adalah konteks — bagian antarmuka tempat sebuah string berada, sehingga kata
bahasa Inggris yang sama dapat diterjemahkan secara berbeda di dua tempat. Sebuah kamus,
`src/locales/<code>.json`, memetakan konteks → teks bahasa Inggris → terjemahan:

```json
{
  "menu": { "Delete": "Удалить" },
  "status": { "{count} entries": { "one": "{count} запись", "few": "{count} записи", "many": "{count} записей", "other": "{count} записи" } }
}
```

String yang tidak ada di kamus ditampilkan dalam bahasa Inggris. Teks yang memuat angka memiliki
satu bentuk untuk setiap kategori plural bahasa tersebut (`Intl.PluralRules`), dengan kunci
berupa bentuk plural bahasa Inggris. `npm run i18n` menampilkan, per bahasa, string yang belum
diterjemahkan dan string yang tidak lagi digunakan; `npm test` memeriksa bahwa setiap terjemahan
mempertahankan placeholder bahasa Inggris dan memiliki semua bentuk plural.

Apa yang ditampilkan Chrome tentang ekstensi itu sendiri — nama dan deskripsinya, judul tombol di
bilah alat — mengikuti bahasa browser, bukan bahasa panel, melalui `chrome.i18n`. Teks-teks
tersebut adalah teks bahasa Inggris di `src/extension/manifest.json`, yang diterjemahkan dalam
kamus yang sama di bawah konteks `manifest`; build menuliskannya ke
`_locales/<code>/messages.json` dan memasukkan `__MSG_appName__` dan sejenisnya ke manifest.
Chrome memiliki kode bahasanya sendiri dan mengabaikan sisanya: `pt` menjadi `pt_BR` dan
`pt_PT`, `zh` menjadi `zh_CN`, dan Urdu tidak memiliki kode, sehingga di sana Chrome menamai
ekstensi dalam bahasa Inggris. Build berhenti jika nama lebih dari 75 karakter atau deskripsi
lebih dari 132.

README ini juga diterjemahkan: `docs/readme/README.<code>.md`, satu per bahasa, dengan daftar
bahasa di bagian atas masing-masing. Perubahan di sini juga perlu dimasukkan ke terjemahannya.

## Membangun

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

`build.mjs` membundel `src/app/main.ts` dengan esbuild menjadi IIFE dan menyisipkannya, bersama
gaya dan ikon (sebagai data URI), ke `src/app/template.html`. Fallback kdbxweb untuk Node
(`crypto`, `@xmldom/xmldom`) diganti dengan stub kosong — browser memiliki `crypto.subtle` dan
`DOMParser`. Hasilnya adalah `build/password-manager.html`, sekitar 500 KB, seperempatnya berupa
kamus.

Proses yang sama menulis `build/pages/`: halaman tersebut sebagai PWA yang dapat dipasang —
`index.html` dengan tautan manifest dan sebuah `<meta name="service-worker">` yang memberi tahu
halaman untuk mendaftarkan worker-nya, `manifest.webmanifest`, ikon, dan `sw.js`, yang menyimpan
halaman di cache agar dapat dibuka secara offline. `build/password-manager.html` sendiri tetap
berupa satu file tanpa referensi eksternal.

Serta `build/extension/`: `panel.html` adalah template dengan skripnya di `panel.js` —
`src/app/main.ts` yang sama, dengan `src/extension/extension.ts` menggantikan
`src/app/platform.ts`, yang hook-nya tidak melakukan apa-apa di file — di samping `popup.html`
(dengan gaya halaman dan `popup.css`) dan `popup.js`, `background.js`, `offscreen.html` dan
`offscreen.js`, ikon, serta `manifest.json`, yang versinya diambil dari `package.json`.
`build/password-manager-extension-<version>.zip` berisi file yang sama, dengan tanggal tetap:
sumber yang sama menghasilkan byte yang sama.

`tests/extension.mjs` memuat ekstensi tersebut ke Chrome headless melalui protokol DevTools
(`Extensions.loadUnpacked` melalui pipe; `--load-extension` sudah dihapus dari Chrome sejak
versi 137) dan mengisi situs uji di server lokal: formulir biasa, formulir mirip React, login
tiga langkah dengan kode sekali pakai, frame dari situs itu sendiri dan dari situs lain, kolom
yang disembunyikan sebagai jebakan, halaman http untuk entri https, pendaftaran yang diisi dengan
sandi Turunan v3 — dengan panel tertutup, dan setelah penguncian; serta popup, yang membuka
kunci, mengisi, mencari, menyalin, dan mengunci. Menu konteks tidak dapat diklik dari DevTools,
jadi pengujian memicu `onClicked` milik worker secara langsung; tanpa klik sungguhan Chrome
tidak memberikan `activeTab`, sehingga salinan yang diuji boleh menjangkau situs uji, `*.test`,
sebagai izin host. Ikon bilah alat dapat diklik dari DevTools (`Extensions.triggerAction`):
sebuah Chrome tersendiri, dengan ekstensi sebagaimana hasil build, memeriksa bahwa klik tersebut
memberikan tab kepada popup. Chrome headless 153 mengalami crash pada klik itu, apa pun
ekstensinya, dan pemeriksaan tersebut kemudian dilewati; Chrome for Testing menjalankannya
(`CHROME=/path/to/chrome-for-testing npm run test:browser`).

`tests/fixtures/Database.kdbx` adalah basis data contoh untuk pengujian; sandinya `Тестовый пароль`.

## Versi dan rilis

Versi ditulis di satu tempat, `package.json`. Build memasukkannya ke halaman (baris di bawah
layar buka kunci, bagian bawah setelan), ke `manifest.json` ekstensi, dan ke nama cache PWA.
Build dari commit yang diberi tag `v<version>` menampilkannya apa adanya; build lainnya
menambahkan commit-nya, `0.8.0+1a2b3c4`, sehingga halaman dari `main` di GitHub Pages tidak
dikira sebagai rilis. `version` di Chrome hanya berisi angka, jadi di sana commit dimasukkan ke
`version_name`.

```sh
npm version minor           # 0.7.2 -> 0.8.0: package.json, package-lock.json, a commit and the tag v0.8.0
git push --follow-tags      # the tag starts .github/workflows/release.yml
```

Workflow rilis berhenti jika tag dan `package.json` tidak sesuai, lalu melampirkan
`password-manager-<tag>.html`, `password-manager-extension-<tag>.zip`, dan `SHA256SUMS.txt`.

## GitHub Pages

`.github/workflows/pages.yml` membangun dan menguji setiap push ke `main` dan men-deploy
`build/pages/` ke GitHub Pages (Settings → Pages → Source: GitHub Actions), di
<https://password.marketkernel.com/>. File dibuka dengan cara yang sama seperti
di file tunggal; file terbaru, setelan, dan handle yang diingat menjadi milik alamat tersebut,
terpisah dari milik salinan yang dibuka dari disk.

Setiap deploy mengubah nama cache di `sw.js`, sehingga browser mengambil worker baru dengan
sendirinya — saat dibuka dengan koneksi, setiap beberapa jam selama aplikasi tetap terbuka, atau
ketika Setelan → Periksa pembaruan memintanya. Worker baru mengunduh versinya ke cache miliknya
sendiri dan menunggu; yang sedang berjalan tetap melayani halaman lama, termasuk secara offline.
Setelan — dengan sebuah titik pada tombolnya — dan layar buka kunci kemudian menampilkan
"Versi … sudah siap. Perbarui": Perbarui mengunci basis data (menyimpannya, atau menanyakannya,
seperti penguncian lainnya), membiarkan worker baru masuk, dan memuat ulang halaman, yang
menyatakan sekali bahwa ia telah diperbarui. Tanpa tombol ini, versi baru mulai berjalan begitu
semua jendela aplikasi ditutup — atau, jika "Instal pembaruan dengan sendirinya saat aplikasi
terkunci dan di latar belakang" dicentang di setelan, segera setelah tidak ada basis data yang
terbuka dan jendela tidak terlihat. Itu juga konsekuensinya: PWA yang terpasang menjalankan apa
pun yang ditaruh oleh deploy terakhir, sedangkan file yang diunduh tetap pada versinya. Untuk
versi yang tetap di disk, ambil `password-manager-<tag>.html` dari sebuah rilis dan bandingkan
dengan `SHA256SUMS.txt`.

Manifes menetapkan `.kdbx` sebagai file yang dibuka aplikasi (`file_handlers`) dan membatasinya
pada satu jendela (`launch_handler`, `focus-existing`): file yang dibuka dari sistem akan masuk
ke jendela yang sudah terbuka — dua jendela pada satu file akan saling menimpa penyimpanannya —
dan di sana mengunci basis data terlebih dahulu jika itu basis data lain. Aplikasi yang terpasang
meminta browser untuk mempertahankan penyimpanannya (`navigator.storage.persist()`), seperti yang
dilakukan pengingatan sebuah basis data di mana pun: jika tidak, disk yang kehabisan ruang bisa
turut mengambil salinan offline, file terbaru, dan basis data yang diingat.

`npm run test:browser` juga membuka `build/pages/`: service worker mengambil alih halaman, Chrome
menganggap manifest dapat dipasang, dan setelah server dimatikan, halaman tetap dimuat dan membuka
kunci basis data contoh; lalu sebuah deploy baru ditemukan, menunggu, dan Perbarui membiarkannya
masuk, atau masuk dengan sendirinya begitu halaman disembunyikan. Chrome headless tidak
menyerahkan file ke sebuah aplikasi, sehingga sebuah `launchQueue` pengganti memberi halaman
sebuah handle file sungguhan, yang terbuka dapat ditulis.

## Struktur

```
src/core/             tanpa DOM: pengujian menjalankannya di Node
  kdbx.ts             kdbxweb + Argon2: buka, simpan, buat; kolom, grup, tempat sampah
  generator.ts        generator sandi dan perkiraan kekuatan
  derived.ts          sandi turunan: generator 3, situs dari alamat e-mail, sandi utama sesi
  site.ts             siteOf(): situs dari sebuah situs web, untuk generator 3 dan pencocokan tab
  legacy.ts           algoritme lama: legacy 1 dan legacy 2
  otp.ts              TOTP (RFC 6238) dan berbagai cara rahasia disimpan
  match.ts            entri mana yang cocok dengan tab
  i18n.ts             t()/tn(), daftar bahasa, penerjemahan markup halaman
src/app/              halaman: file tunggal, PWA, dan panel samping ekstensi
  template.html       markup dengan placeholder __STYLES__/__APP__/__ICON__, CSP; juga panel.html ekstensi
  styles.css          palet, tema terang dan gelap, tiga panel; satu layar dalam satu waktu di ponsel
  main.ts             layar buka kunci, pembukaan kunci, penyimpanan, penguncian, bilah alat, pintasan, setelan
  files.ts            File System Access API, seret dan lepas, input file; file terbaru; file yang dibuka sistem dengan aplikasi
  groups.ts           pohon grup, tag, dan tempat sampah di panel kiri
  list.ts             daftar entri
  details.ts          satu entri: tampilan, pengeditan pada draf, riwayat, lampiran, TOTP
  search.ts           pencarian, pengurutan, tautan aman
  genpanel.ts         popover generator: acak, versi 3, legacy 1 dan 2
  clipboard.ts        penyalinan dengan penghapusan berwaktu
  avatar.ts           ikon entri: ikon khusus dari basis data atau huruf berwarna
  settings.ts         localStorage: bahasa, tema, panel, pengatur waktu kunci dan papan klip
  ui.ts               dialog, menu konteks, popover, toast, ikon; lembar (sheet) di ponsel
  screens.ts          tata letak ponsel: daftar atau entri, laci grup, tombol kembali
  platform.ts         apa yang dilakukan halaman di luar dirinya: tidak ada, di file dan PWA
  update.ts           pembaruan PWA: mendaftarkan sw.js, memeriksa secara berkala, menemukan versi yang menunggu, dan membiarkannya masuk
src/extension/        ekstensi Chrome
  manifest.json       manifest-nya; build menambahkan versi
  extension.ts        platform.ts untuk panel samping: dokumen offscreen, tab, Isi
  popup.ts            popup ikon bilah alat (popup.html, popup.css): entri situs, Mode penuh
  background.ts       service worker: menu, kunci layar, pengisian tab
  offscreen.ts        dokumen offscreen (offscreen.html): basis data yang terbuka hingga penguncian
  fill.ts             fungsi yang disisipkan ke halaman: menemukan kolom login dan mengisinya
  messages.ts         cara bagian-bagian ekstensi berkomunikasi
src/pwa/sw.js         service worker untuk build Pages
src/locales/          satu kamus per bahasa
assets/               ikon; pwa/, ukuran PNG-nya untuk PWA; extension/, ikon ekstensi
tests/                round trip .kdbx, generator dan TOTP, sandi turunan, algoritme lama, pencocokan tab,
                      kamus, halaman dan ekstensi di Chrome headless; fixtures/, basis data contoh
tools/                load.mjs mengompilasi modul src/ untuk pengujian; i18n.mjs membandingkan kamus dengan kode
docs/                 tangkapan layar di atas; readme/, README ini dalam bahasa lain; catatan kerja (tidak di git)
build/                hasil build; build/pages/ adalah PWA untuk GitHub Pages, build/extension/ adalah ekstensi
```

## Batasan

- KDBX 3.1 dan 4.x didukung; file yang dienkripsi dengan Twofish dan file KeePass 1 (`.kdb`)
  tidak didukung.
- Tidak ada sinkronisasi, ketik otomatis (auto-type), maupun penggabungan salinan yang telah
  diubah.
- Ekstensi hanya untuk Chrome, dan tidak memiliki saran di kolom, tidak menyimpan sandi saat
  formulir dikirim, tidak memiliki pintasan keyboard, dan hanya mendukung satu situs web per
  entri.
- Hanya browser berbasis Chromium yang dapat menulis langsung ke file.

## Lisensi

MIT — lihat [LICENSE](../../LICENSE). kdbxweb dan hash-wasm juga berlisensi MIT.
