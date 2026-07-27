<a id="readme-top"></a>

# Claude Aura

<p align="center">
  <a href="../README.md">English</a> ·
  <a href="./README.zh-CN.md">简体中文</a> ·
  <a href="./README.zh-HKTW.md">繁體中文</a> ·
  <a href="./README.hi.md">हिन्दी</a> ·
  <a href="./README.es.md">Español</a> ·
  <a href="./README.fr.md">Français</a> ·
  <strong>Bahasa Indonesia</strong> ·
  <a href="./README.ja.md">日本語</a> ·
  <a href="./README.ko.md">한국어</a> ·
  <a href="./README.pt-BR.md">Português (Brasil)</a> ·
  <a href="./README.de.md">Deutsch</a> ·
  <a href="./README.it.md">Italiano</a> ·
  <a href="./README.vi.md">Tiếng Việt</a> ·
  <a href="./README.pl.md">Polski</a> ·
  <a href="./README.tr.md">Türkçe</a>
</p>

<p align="center">
  <strong>Berikan tema personal yang bisa dibalikkan pada website live Claude di Windows.</strong><br>
  Tema lokal · Tanpa patch Claude Desktop · Kembali ke tampilan awal dengan satu klik
</p>

<p align="center">
  <a href="#getting-started">Mulai</a> ·
  <a href="#theme-showcase">Lihat tema</a> ·
  <a href="#create-a-custom-theme">Buat tema</a> ·
  <a href="../docs/TROUBLESHOOTING.md">Pemecahan masalah</a> ·
  <a href="./SECURITY.md">Keamanan</a>
</p>

<p align="center">
  <a href="https://github.com/kaihuang1425/claude-aura"><strong>Jika Claude Aura berguna untuk Anda, berikan bintang pada proyek ini di GitHub.</strong></a>
</p>

<p align="center">
  <img src="../docs/readme-showcase/japanese-film-editorial-dark-new-chat.png"
       alt="Japanese Film Editorial dark new-chat reference preview"
       width="900"><br>
  <sub>Gelap · Chat baru · showcase dokumentasi dari pengguna</sub>
</p>

<p align="center"><sub>Pratinjau referensi · bukan latar tema yang bisa diimpor atau bukti penerimaan live</sub></p>

> **Independent project.** Claude Aura adalah proyek mandiri dan tidak berafiliasi,
> disetujui, disponsori, atau disahkan oleh Anthropic PBC. Aura menampilkan
> website live di `claude.ai`; ia tidak menyediakan Claude atau memodifikasi
> aplikasi terpasang milik Anthropic. Claude, Anthropic, dan nama/merek terkait
> adalah milik Anthropic PBC. Lisensi proyek tidak memberikan hak apapun atas
> materi tersebut.

<details>
<summary><strong>Public or commercial release trademark note</strong></summary>

> **Before public or commercial release:** Anthropic's current
> [Trademark Guidelines](https://www.anthropic.com/legal/trademark-guidelines)
> require prior approval for its names and marks and prohibit altered marks. A
> disclaimer is not permission. A release that keeps the **Claude Aura** name
> or theme-styled Claude wordmarks needs written permission and appropriate
> legal review.

</details>

<a id="contents"></a>
<details>
<summary><strong>Daftar isi</strong></summary>

- [Claude Aura](#claude-aura)
  - [Mengapa Aura](#why-aura)
  - [Mulai cepat](#quick-start)
    - [Persyaratan](#requirements)
    - [Instalasi](#installation)
    - [Uninstall](#uninstall)
  - [Showcase tema](#theme-showcase)
    - [Japanese Film Editorial](#japanese-film-editorial)
    - [Japanese Idol](#japanese-idol)
    - [Korean Idol](#korean-idol)
  - [Gunakan Aura](#use-aura)
  - [Buat tema kustom](#create-a-custom-theme)
  - [Cara kerja Aura](#how-aura-works)
  - [Keamanan dan privasi](#safety-and-privacy)
  - [Roadmap](#roadmap)
  - [Bantuan dan dokumentasi](#support-and-documentation)
    - [Peta dokumentasi](#documentation-map)
  - [Dukungan amal](#charitable-support)
  - [Lisensi dan pemberitahuan](#license-and-notices)
  - [Ucapan terima kasih](#acknowledgments)

</details>
<a id="about-claude-aura"></a>
<a id="why-aura"></a>
## Mengapa Aura

- **Gunakan website Claude live.** Aura mempertahankan antarmuka asli dan kontrol native,
tidak menggantinya dengan layar yang direkonstruksi.
- **Tetap lokal dan bisa dibalikkan.** Aura menerapkan styling lokal tanpa patch Claude
  Desktop, dan **Original look** menghapus layer presentasi Aura dalam satu klik.
- **Mulai dengan delapan tema bawaan.** Setiap tema tersedia sebagai titik awal stabil
  yang hanya bisa dibaca untuk workspace yang lebih personal.
- **Buat tema tanpa menimpa yang asli.** Claude Aura Studio mendukung warna lokal,
tipografi, bentuk, efek, dan artwork.

Aura 0.3 saat ini hanya melakukan theme pada website live. Aura belum men-theme native
Claude Desktop Code maupun terminal Claude Code, dan chat biasa di dalam Aura tidak
mendapat akses local-project. Sebelum rilis final, Aura Code harus
lulus bukti penguncian rilis dengan sesi resmi
[Remote Control](https://code.claude.com/docs/en/remote-control) yang bertema di live
`claude.ai/code`; export terminal-theme yang sesuai menutupi lingkungan terbatas
tanpa mem-patch Claude Desktop.

<details>
<summary><strong>Lengkapnya kemampuan dan pengecualian</strong></summary>

Claude Aura membuka website nyata `claude.ai` di jendela Microsoft Edge WebView2
khusus dan menerapkan tema visual lokal. Cocok untuk orang yang ingin workspace
lebih personal tanpa patch Claude Desktop atau mengganti antarmuka live dengan
screenshot.

| Aura melakukan | Aura tidak melakukan |
| --- | --- |
| Memuat antarmuka live `claude.ai` di WebView2 | Mengganti Claude dengan antarmuka rekonstruksi |
| Menerapkan styling lokal yang bisa dibalik | Mem-patch Claude Desktop, `app.asar`, Windows package, atau signature kode |
| Menyertakan delapan tema bawaan | Mengubah akun Claude, chat, API key, model, atau pengaturan provider |
| Menyediakan Studio untuk tema kustom lokal | Mengklaim sebagai produk Anthropic atau sistem tema resmi |
| Menyediakan **Original look** di dalam aplikasi | Menghapus tema tersimpan saat styling dimatikan |

</details>

<p align="right">(<a href="#readme-top">kembali ke atas</a>)</p>
<a id="getting-started"></a>
## Mulai cepat

<a id="requirements"></a>
### Persyaratan

- Windows 10 atau Windows 11
- Akses internet dan akun Claude
- [Node.js 22 atau lebih baru](https://nodejs.org/en/download)
- [Microsoft Edge WebView2 Runtime](https://developer.microsoft.com/en-us/microsoft-edge/webview2/)

WebView2 tersedia di sebagian besar komputer Windows modern. Jika Aura tidak bisa
membuka jendela browser-nya, pasang atau perbaiki Evergreen WebView2 Runtime lalu
coba lagi. Claude Desktop opsional dan tetap aplikasi terpisah.

<a id="installation"></a>
### Instalasi

Buka [rilis terbaru](https://github.com/kaihuang1425/claude-aura/releases) dan pilih salah satu jalur ini. Keduanya menginstal versi yang sama untuk akun Windows saat ini.

| Path | Gunakan saat | Unduh |
| --- | --- | --- |
| **Unsigned Setup** | Anda menginginkan instalator berguided yang lebih sederhana dan Windows membukanya secara normal | `Claude-Aura-Setup-v<version>-UNSIGNED.exe` bersama `.sha256` dan `.manifest.json`-nya |
| **ZIP + CMD fallback** | Windows memperingatkan atau memblokir Setup unsigned, atau Anda lebih suka skrip sumber yang dapat dibaca | `claude-aura-v<version>.zip` bersama `.sha256`-nya |

#### Path 1 ??Unsigned Setup

1. Di bawah **Assets**, unduh `-UNSIGNED.exe`, `.sha256`, dan `.manifest.json`-nya. Jangan gunakan arsip **Source code** otomatis dari GitHub.
2. Bandingkan SHA-256 file Setup dengan kedua file pendamping. Hentikan dan hapus unduhan jika ada nilai yang berbeda.
3. Installer ini tidak dapat memverifikasi penerbitnya karena pengembang tidak memiliki sertifikat code-signing. Jika Windows memperingatkan atau memblokirnya, jangan lewati peringatan; gunakan Jalur 2.
4. Jika terbuka secara normal, ikuti Setup. Ia memeriksa Node.js dan WebView2, menginstal ke bawah `%LOCALAPPDATA%\ClaudeAura`, menambahkan pendaftaran **Installed apps** dan shortcut, lalu membuka Aura.

#### Path 2 ??ZIP + CMD fallback

1. Di bawah **Assets**, unduh `claude-aura-v<version>.zip` dan `.sha256` yang cocok. Jangan gunakan arsip **Source code** otomatis dari GitHub.
2. Bandingkan SHA-256 ZIP dengan file pendampingnya. Hentikan dan hapus kedua file jika nilainya berbeda.
3. Pilih **Extract all**. Pada folder `claude-aura` yang diekstrak, klik dua kali **Install Claude Aura.cmd**. Jangan jalankan dari pratinjau ZIP.
4. Installer CMD/PowerShell yang dapat dibaca memeriksa Node.js dan WebView2, menginstal Aura, membuat shortcut, dan membukanya. Jalur ini tidak memiliki identitas publisher Authenticode dan tidak menambahkan entri **Installed apps**.

Setelah salah satu jalur, masuk ke Aura jika `claude.ai` memintamu. Klik tombol Aura mengambang, pilih **Open Studio**, lalu pilih **Themes**.

Aset bernama `Claude-Aura-Setup-v<version>.exe` tanpa `-UNSIGNED` adalah jalur signed yang berbeda dan harus menampilkan publisher sesuai notes rilis tersebut. Aset yang berakhir dengan `-UNSIGNED-DEV.exe` tidak pernah bersifat publik.

Instalasi tidak mem-patch atau menggantikan Claude Desktop.

<details>
<summary><strong>Perilaku installer, lokasi aplikasi, dan uninstall</strong></summary>

Kedua jalur berjalan tanpa prompt administrator, memvalidasi prasyarat, dan melakukan pertukaran app-tree Aura yang terlindungi. File aplikasi diinstal ke:

```text
%LOCALAPPDATA%\ClaudeAura\app
```

Ini membuat shortcut **Claude Aura**, **Claude Aura Studio**, dan uninstall di menu Start serta Desktop. Pengaturan tema dan data sign-in disimpan terpisah dari aplikasi, sehingga menginstal ulang Aura tidak menggantikannya secara diam-diam. Native Setup menambahkan entri **Installed apps** dan uninstaller native; jalur ZIP/CMD mempertahankan shortcut uninstall script source-nya sendiri.

Developer dapat mengkloning repository dan membangun installer pengembangan unsigned bernama eksplisit untuk inspeksi lokal. Ini berbeda dari Setup public unsigned yang ditandai dengan jelas. Perintah build, compiler pinned, gerbang verifikasi, dan checklist release didokumentasikan di
[Windows installer guide](../docs/WINDOWS_INSTALLER.md).

### Uninstall

Pertama klik kanan tombol floating Aura dan pilih **Exit Claude Aura**.
Untuk instalasi ZIP, buka **Start > Claude Aura > Uninstall Claude Aura** atau klik dua kali **Uninstall Claude Aura.cmd** pada release yang diekstrak. Untuk masing-masing native Setup, Anda juga dapat menggunakan **Settings > Apps > Installed apps > Claude Aura > Uninstall**. Entri `.cmd` mendelegasikan ke uninstaller native terdaftar bila ada. Uninstaller menolak untuk melanjutkan saat Aura masih terbuka.

Secara default, uninstall menghapus aplikasi Aura dan shortcut tetapi menyimpan pengaturan tema lokal dan profil sign-in WebView terpisah Aura untuk reinstall berikutnya. Uninstaller juga meminta konfirmasi sebelum menghapus folder-folder tersebut. Penghapusan opsional tersebut menghapus sesi sign-in lokal Aura; ia tidak pernah menghapus Claude Desktop, akun Anthropic pengguna, atau data akun server-side.

</details>
<p align="right">(<a href="#readme-top">kembali ke atas</a>)

<a id="theme-showcase"></a>
## Showcase tema

Sistem visual Aura ditampilkan di bawah lewat referensi New chat dan Conversation. Referensi
Japanese Film Editorial New chat yang tampil ada di bagian atas README ini.

**Default · Japanese Film Editorial · Korean Prestige · Cartoon Studio · Anime Twilight · Study Library · Japanese Idol · Korean Idol**

<a id="japanese-film-editorial"></a>
### Japanese Film Editorial

Kertas hangat, tinta arang, indigo lembut, dan vermilion yang tertahan.

<details>
<summary>Lihat tampilan Conversation</summary>

<p align="center">
  <img src="../docs/readme-showcase/japanese-film-editorial-dark-conversation.png"
       alt="Japanese Film Editorial dark conversation reference preview"
       width="900"><br>
  <sub>Gelap · Conversation · showcase dokumentasi dari pengguna</sub>
</p>

</details>

<a id="japanese-idol"></a>
### Japanese Idol

Krim hangat, blush, rose, lilac berkilau, dan detail pita halus.

<p align="center">
  <img src="../docs/readme-showcase/japanese-idol-light-new-chat.png"
       alt="Japanese Idol light new-chat reference preview"
       width="900"><br>
  <sub>Terang · Chat baru · showcase dokumentasi dari pengguna</sub>
</p>

<details>
<summary>Lihat tampilan Conversation</summary>

<p align="center">
  <img src="../docs/readme-showcase/japanese-idol-light-conversation.png"
       alt="Japanese Idol light conversation reference preview"
       width="900"><br>
  <sub>Terang · Conversation · showcase dokumentasi dari pengguna</sub>
</p>

</details>

<a id="korean-idol"></a>
### Korean Idol

Putih dingin, periwinkle, perak holografik, dan struktur music glass.

<p align="center">
  <img src="../docs/readme-showcase/korean-idol-light-new-chat.png"
       alt="Korean Idol light new-chat reference preview"
       width="900"><br>
  <sub>Terang · Chat baru · showcase dokumentasi dari pengguna</sub>
</p>

<details>
<summary>Lihat tampilan Conversation</summary>

<p align="center">
  <img src="../docs/readme-showcase/korean-idol-light-conversation.png"
       alt="Korean Idol light conversation reference preview"
       width="900"><br>
  <sub>Terang · Conversation · showcase dokumentasi dari pengguna</sub>
</p>

</details>

<details>
<summary><strong>Status referensi dan batas penggunaan ulang</strong></summary>

> **Status referensi:** gambar ini diberikan pengguna untuk mengkomunikasikan arah visual.
> Bisa berisi konten antarmuka ilustratif dan bukan bukti penerimaan live ataupun
> bukti perilaku `claude.ai` saat ini. Ini bukan latar tema, tidak boleh diimpor ke
> Aura, dan dikeluarkan dari installer rilis.
>
> Preview memuat UI produk pihak ketiga, nama atau merek, dan artwork potret berkarakter
> manusia. Keberadaannya tidak memberi hak penggunaan ulang. Periksa hak terkait
> interface, merek, artwork, dan likeness sebelum publikasi atau redistribusi lebih lanjut.

</details>

<a id="built-in-themes"></a>
<details>
<summary><strong>Semua tema bawaan dan ID stabil</strong></summary>

Aura menyediakan delapan tema bawaan dengan urutan stabil:

| # | Theme | Stable ID |
| ---: | --- | --- |
| 1 | Default | `default` |
| 2 | Japanese Film Editorial | `japanese-film-editorial` |
| 3 | Korean Prestige | `korean-prestige` |
| 4 | Cartoon Studio | `cartoon-studio` |
| 5 | Anime Twilight | `anime-twilight` |
| 6 | Study Library | `study-library` |
| 7 | Japanese Idol | `japanese-idol` |
| 8 | Korean Idol | `korean-idol` |

Tema bawaan bersifat read-only. Studio membuat salinan yang bisa diedit saat ingin
menyesuaikan satu tema.

</details>

<p align="right">(<a href="#readme-top">kembali ke atas</a>)</p>
<a id="use-aura"></a>
## Gunakan Aura

| Aksi | Fungsinya |
| --- | --- |
| Klik tombol melayang Aura | Membuka Claude Aura Studio |
| **Themes** | Membuka galeri bawaan dan menyimpan tema terpilih |
| **Create a theme** | Membuat atau mengedit tema kustom milik Aura |
| **Personal wallpaper > Choose wallpaper*** | Memilih gambar lokal secara terpisah dari tema aktif |
| **Clear wallpaper** | Berhenti memakai wallpaper tanpa menghapus berkas sumber |
| **Original look** | Menghapus styling Aura dan menampilkan situs live tanpa tema terpilih |
| **Apply theme** | Menerapkan lagi tema Aura tersimpan setelah Original look |
| **Open desktop app** | Membuka Claude Desktop tanpa mengubahnya |

Tema terpilih tetap bertahan di antara restart Aura. **Original look** mematikan layer
presentasi Aura; ia tidak menghapus tema tersimpan atau artwork kustom. **Default**
adalah tema bawaan pertama Aura; bukan sama dengan Original look.

Peluncur melayang Aura tetap kontrol lingkaran kecil. Klik untuk membuka Studio,
drag untuk memindahkan, atau klik kanan untuk menu Aura.

Wallpaper personal tetap terhubung ke path gambar asli. Memindahkan atau menghapus berkas
tersebut membuat wallpaper tidak tersedia. Artwork yang diimpor lewat editor mengikuti
jalur berbeda: Studio menyalin atau mengonversinya ke folder tema milik Aura.

<p align="right">(<a href="#readme-top">kembali ke atas</a>)</p>

<a id="create-a-custom-theme"></a>
## Buat tema kustom

1. Buka **Claude Aura Studio** dari Desktop atau Start menu.
2. Buka **Create a theme** dan pilih **Customize Default**, atau buka **Themes**,
pilih bawaan, lalu pilih **Duplicate to customize**.
3. Atur warna Light dan Dark, tipografi, bentuk, efek, dan artwork lokal.
4. Cek layout New chat dan Conversation di pratinjau Studio.
5. Selesaikan semua peringatan kontras atau ukuran file.
6. Pilih **Save theme**.

File bawaan tidak pernah ditimpa. Jika draft jadi tidak valid, tetap bisa diedit
sementara Aura tetap menampilkan versi valid terakhir.

PNG, JPEG, WebP, atau AVIF yang diimpor dikonversi secara lokal ke aset WebP
beranggaran. Studio tidak menyimpan path sumber di dalam tema. Untuk editor lengkap
dan kontrak tema, lihat [Theme Kit Specification](../docs/THEME_KIT_SPEC.md).

Bila tersedia, Studio dapat memakai capture jendela Aura aktual sebagai backdrop
pengeditan. Capture itu dapat berisi konten percakapan, hanya tersimpan di memory
saat sesi pengeditan, dan tidak pernah ditulis ke disk.

<p align="right">(<a href="#readme-top">kembali ke atas</a>)

<a id="built-with"></a>
<a id="how-aura-works"></a>
## Cara kerja Aura

| Bagian | Tujuan |
| --- | --- |
| Windows PowerShell dan WinForms | Installer, jendela Aura, Studio, shortcut, dan kontrol lokal |
| Microsoft Edge WebView2 | Menampilkan website nyata `claude.ai` |
| Node.js 22+ | Memvalidasi tema dan membangun styling lokal |
| HTML, CSS, JavaScript, SVG, dan WebP lokal | Menyediakan styling Aura dan aset tema bawaan |

Proyek ini tidak punya dependensi npm runtime atau font dari CDN.

<p align="right">(<a href="#readme-top">kembali ke atas</a>)</p>

<a id="safety-and-privacy"></a>
## Keamanan dan privasi

- Aura memuat website HTTPS live `claude.ai` di Microsoft Edge WebView2.
- Halaman penyedia sign-in tidak diberi tema.
- Aura tidak membuka port remote-debugging atau mem-patch Claude Desktop.
- Berkas tema dan artwork yang diimpor tetap di folder lokal milik Aura.
- Webpage live tetap terhubung normal ke Anthropic.
- Profil WebView berisi data sesi sign-in dan harus dilindungi.
- Capture Studio live-page tetap di memori untuk sesi edit saat ini dan tidak disimpan
di disk.
- Jangan pilih gambar latar sensitif; halaman live secara teknis bisa mengakses data DOM
dalam prosesnya sendiri.
- Penggunaan layanan live tetap mengikuti [Consumer Terms](https://www.anthropic.com/terms)
  dan [Usage Policy](https://www.anthropic.com/legal/aup) Anthropic.

Baca [SECURITY.md](./SECURITY.md) untuk trust boundary dan
[Troubleshooting](../docs/TROUBLESHOOTING.md) untuk bantu masuk, loading, tema, gambar,
dan WebView2.

<a id="local-data"></a>
<details>
<summary><strong>Folder data lokal dan retensi saat uninstall</strong></summary>

Aura memisahkan application, settings, themes, drafts, dan profil browser:

| Path | Isi |
| --- | --- |
| `%LOCALAPPDATA%\ClaudeAura\app` | Aplikasi Aura terpasang |
| `%LOCALAPPDATA%\ClaudeAura\data` | Pengaturan, log, dan state lokal milik Aura |
| `%LOCALAPPDATA%\ClaudeAura\data\themes` | Tema custom tersimpan dan artwork turunan |
| `%LOCALAPPDATA%\ClaudeAura\data\theme-drafts` | Draft Studio yang sedang dikerjakan |
| `%LOCALAPPDATA%\ClaudeAura\webview` | Profil sign-in WebView2 terpisah Aura |

Perlakukan folder `webview` seperti profil browser tersign-in apa pun. Jangan dipublikasi
atau dibagikan. Uninstall default menyimpan `data` dan `webview`; opsi hapus
 eksplisit hanya jika Anda juga ingin menghapus pengaturan lokal, tema, dan profil
sign-in terpisah.

</details>

<p align="right">(<a href="#readme-top">kembali ke atas</a>)</p>
<a id="roadmap"></a>
## Roadmap

- [x] Komponen Windows WebView2 khusus dan **Original look** yang bisa dibalik
- [x] Delapan tema bawaan stabil dengan dukungan Light dan Dark
- [ ] Selesaikan dan review editor visual Studio no-code
- [ ] Selesaikan dan setujui Aura Code untuk Claude Code Remote Control resmi lokal,
dengan export terminal-theme yang sesuai
- [ ] Publikasikan tutorial tema kustom 30 menit
- [ ] Jalankan sweep verifikasi rilis akhir

Lihat [implementation report](../docs/IMPLEMENTATION_REPORT.md) dan
[repository issues](https://github.com/kaihuang1425/claude-aura/issues) untuk status
publik. Preview referensi bukan pengganti bukti penerimaan live Aura yang diwajibkan.

<p align="right">(<a href="#readme-top">kembali ke atas</a>)</p>

<a id="support"></a>
## Dukungan dan dokumentasi

Mulai dari [Troubleshooting](../docs/TROUBLESHOOTING.md). Untuk bug yang bisa direproduksi
atau request fitur, pakai
[halaman Issues repositori](https://github.com/kaihuang1425/claude-aura/issues).

Saat melaporkan bug, sertakan versi Windows, Node.js, dan WebView2, ID tema aktif,
dan langkah yang mereproduksi masalah. Tinjau log sebelum dibagikan; log UI Aura berada di:

```text
%LOCALAPPDATA%\ClaudeAura\data\aura-ui.log
```

Laporkan masalah keamanan melalui private security advisory repositori, seperti dijelaskan
di [SECURITY.md](./SECURITY.md).

<a id="documentation-map"></a>
### Peta dokumentasi

- [Troubleshooting](../docs/TROUBLESHOOTING.md)
- [Security and trust boundary](./SECURITY.md)
- [Theming guide](../docs/THEMING.md)
- [Theme Kit Specification](../docs/THEME_KIT_SPEC.md)
- [Implementation report](../docs/IMPLEMENTATION_REPORT.md)
- [File Manifest](../docs/FILE_MANIFEST.md)
- [Contributing guide](./CONTRIBUTING.md)
- [Repository issues](https://github.com/kaihuang1425/claude-aura/issues)

<a id="contributing"></a>
<details>
<summary><strong>Pengecekan kontribusi dan batas proyek</strong></summary>

Jalankan pengecekan wajib sebelum mengirimkan perubahan:

```powershell
npm run check
npm run verify:cycle
```

Untuk audit satu tema bawaan:

```powershell
node scripts/theme-cli.mjs qa <id>
```

Jaga tetap batas proyek ini:

- Jangan tambahkan dependensi npm atau font runtime.
- Jaga delapan ID tema stabil dan urutannya tetap.
- Jangan kirimkan HTML antarmuka Claude yang direkonstruksi sebagai konten produk.
- Jangan ajukan gambar referensi sebagai bukti penerimaan UI.
- Sertakan sumber, lisensi, dan informasi distribusi untuk media yang disumbangkan.

Lihat [CONTRIBUTING.md](./CONTRIBUTING.md), [Theming guide](../docs/THEMING.md),
[Theme Kit Specification](../docs/THEME_KIT_SPEC.md), dan [File Manifest](../docs/FILE_MANIFEST.md)
sebelum mengubah sistem tema atau tree release.

</details>

<p align="right">(<a href="#readme-top">kembali ke atas</a>)</p>

<a id="charitable-support"></a>
## Dukungan amal

Claude Aura tidak menerima donasi pribadi, tips, sponsorship, referral payment, atau
bantuan finansial lain. Pemilik saat ini berada di United Kingdom dengan
[Student route conditions](https://www.gov.uk/guidance/immigration-rules/immigration-rules-appendix-student),
yang melarang self-employment atau aktivitas bisnis kecuali kondisi tertentu.
Untuk menghindari konflik dengan kondisi tersebut, pemilik tidak dapat menerima
donasi atau tips terkait proyek selama berlaku.

[Jika Claude Aura berguna bagi Anda, cara paling sederhana dan non-finansial untuk mendukungnya adalah memberi bintang pada repositori di GitHub.](https://github.com/kaihuang1425/claude-aura)

<details>
<summary><strong>Konteks Student-route, nonprofit independen, dan batas donasi</strong></summary>

Pembaca yang ingin mendukung pekerjaan publik terkait dapat berdonasi langsung ke
dua nonprofit independen berikut:

- [International Rescue Committee UK](https://help.rescue-uk.org/donate-web)
  membantu orang terdampak konflik dan bencana, termasuk pengungsi membangun kembali
  hidup mereka di UK. International Rescue Committee yang lebih luas juga terlibat di
  [Claude Corps](https://www.anthropic.com/news/claude-corps).
- [CodePath](https://www.every.org/codepath) menyediakan pendidikan teknis gratis
  dan bekerja dengan Anthropic sebagai mitra nonprofit untuk
  [Claude Corps](https://www.anthropic.com/news/claude-corps).

Tautan ini langsung menuju pihak ketiga. Claude Aura dan pemiliknya tidak mengumpulkan,
mengelola, mengontrol, menerima, atau memperoleh manfaat finansial dari donasi apa pun.
Masing-masing organisasi menanggung pemrosesan donasi dan kuitansinya sendiri. Pencantuman
mereka tidak berarti afiliasi, sponsorship, endorsement, atau kemitraan fundraising resmi
bersama Claude Aura.

</details>

<a id="license-and-notices"></a>
## Lisensi dan pemberitahuan

Perangkat lunak buatan proyek didistribusikan di bawah [MIT License](./LICENSE).
Lihat juga [NOTICE.md](./NOTICE.md) dan [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md).

MIT License tidak memberi hak atas nama, merek, interface, website, atau aplikasi milik
Anthropic. Caption showcase tidak memberi hak penggunaan ulang terhadap UI yang ditampilkan,
artwork, nama, merek, atau kemiripan manusia. Notice sumber dan hak per-file tetap berlaku.

Tinjau [Anthropic Trademark Guidelines](https://www.anthropic.com/legal/trademark-guidelines)
dan [Consumer Terms](https://www.anthropic.com/terms) terbaru. Dapatkan izin yang
relevan dari rightsholder sebelum mempublikasi, memodifikasi, atau mendistribusikan
nama, merek, capture antarmuka, artwork, atau likeness yang dikenali yang dilindungi.
Repositori dan README ini tidak memberi izin tersebut.

<a id="acknowledgments"></a>
## Ucapan terima kasih

- [Codex Dream Skin](https://github.com/Fei-Away/Codex-Dream-Skin) memberi inspirasi
  alur validasi loopback original dan pola showcase yang mudah didekati.
- [claude-desktop-bin](https://github.com/patrickjaja/claude-desktop-bin) memberi
  inspirasi pemetaan tema semantik awal.
- [Best README Template](https://github.com/othneildrew/Best-README-Template) memberi
  inspirasi struktur berbasis pembaca untuk README ini.
- Microsoft Edge WebView2 menyediakan runtime browser tersemat.

Lisensi dan provenance detail tercatat di [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md).
Penyebutan tidak berarti afiliasi, sponsorship, atau endorsement.

<p align="right">(<a href="#readme-top">kembali ke atas</a>)</p>
