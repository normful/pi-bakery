# @normful/pi-auto-name

Secara otomatis menamai sesi Pi dan permukaan multiplexer terminal Anda berdasarkan percakapan。

Mendukung mengubah nama panel herdr atau tab herdr yang berisi Pi：

<p align="center">
  <img src="https://media.githubusercontent.com/media/normful/pi-bakery/main/screenshots/auto-name.png" alt="pi-auto-name herdr screenshot" width="800">
</p>

Juga mendukung mengubah nama jendela tmux yang berisi Pi：

<p align="center">
  <img src="https://media.githubusercontent.com/media/normful/pi-bakery/main/screenshots/pi-auto-name_tmux.png" alt="pi-auto-name tmux screenshot" width="800">
</p>

Dan mendukung mengubah nama panel zellij atau tab zellij yang berisi Pi：

<p align="center">
  <img src="https://media.githubusercontent.com/media/normful/pi-bakery/main/screenshots/pi-auto-name_zellij.png" alt="pi-auto-name zellij screenshot" width="800">
</p>

Berbagai bahasa juga didukung，seperti Bahasa Indonesia：

<p align="center">
  <img src="https://media.githubusercontent.com/media/normful/pi-bakery/main/screenshots/pi-auto-rename_japanese.png" alt="pi-auto-name tangkapan layar pengubahan nama dalam Bahasa Indonesia" width="800">
</p>

Daftar semua bahasa yang didukung：English、Español、Deutsch、Français、Italiano、Nederlands、Português、Bahasa Indonesia、Tiếng Việt、Türkçe、Polski、Українська、فارسی、العربية、हिन्दी、简体中文、繁體中文、日本語、한국어、ไทย

## Instalasi

```bash
pi install npm:@normful/pi-auto-name
```

## Penggunaan

Ekstensi ini sepenuhnya otomatis; tidak ada yang perlu dijalankan。

Konfigurasikan sekali，dan selesai。Atur dan lupakan。

## Cara Kerja

Setelah input pengguna pertama（atau peristiwa `agent_settled` pertama — lihat konfigurasi di bawah），ini mengubah nama sesi Pi dan mengubah nama yang berisi：

- jendela tmux
- panel herdr dan tab herdr
- panel zellij dan tab zellij

Selain itu，Anda juga dapat mengaturnya untuk mengubah nama secara terus-menerus seiring percakapan berkembang，dengan mengonfigurasi `reRenameEveryNTurns`。

## Konfigurasi

Simpan konfigurasi ke：

- Global：`~/.pi/agent/pi-auto-name.json`（atau `<PI_CODING_AGENT_DIR>/pi-auto-name.json` jika dikonfigurasi）
- Fallback usang：`~/.config/pi-auto-name/config.json` masih dibaca dengan prioritas terendah
- Timpa per proyek：`.pi/pi-auto-name.json`

Konfigurasi default lengkap：

```json
{
  "enabled": true,
  "initialRenameTrigger": "first-input",
  "language": "en",
  "namingContextDepth": "recent-user-messages",
  "namingModel": "",
  "namingStyle": "natural",
  "replaceExistingName": "always",
  "reRenameEveryNTurns": 0,
  "respectExternalRenames": true,
  "sessionNameMaxLength": 200,
  "skipSessionNameDedup": false,
  "surfaces": {
    "renameHerdrPane": true,
    "renameHerdrTab": true,
    "renamePiSession": true,
    "renameTmuxWindow": true,
    "renameZellijPane": true,
    "renameZellijTab": true
  },
  "windowNameMaxLength": 30
}
```

Setiap kunci konfigurasi bersifat opsional。

## Referensi Konfigurasi

| Key                         | Type      | Default                             | Meaning                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| --------------------------- | --------- | ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `enabled`                   | `boolean` | `true`                              | `false` menonaktifkan ekstensi ini sepenuhnya。                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `initialRenameTrigger`      | `string`  | <code>"first-input"</code>          | Kapan pengubahan nama pertama dipicu：<br><ul><li><code>"first-input"</code> — setelah Anda mengirim prompt pertama</li><li><code>"first-agent-settled"</code> — setelah eksekusi LLM pertama selesai（setelah peristiwa `agent_settled` pertama）。</li></ul>                                                                                                                                                                                                                               |
| `language`                  | `string`  | `"en"`                              | Salah satu dari：<code>en</code>、<code>es</code>、<code>de</code>、<code>fr</code>、<code>it</code>、<code>nl</code>、<code>pt</code>/<code>pt-BR</code>/<code>pt-PT</code>、<code>id</code>、<code>vi</code>、<code>tr</code>、<code>pl</code>、<code>uk</code>、<code>fa</code>、<code>ar</code>、<code>hi</code>、<code>zh</code>/<code>zh-CN</code>/<code>zh-Hans</code>、<code>zh-Hant</code>/<code>zh-TW</code>/<code>zh-HK</code>、<code>ja</code>、<code>ko</code>、<code>th</code> |
| `namingContextDepth`        | `string`  | <code>"recent-user-messages"</code> | Berapa banyak percakapan yang dikirim ke LLM dalam setiap prompt pengubahan nama：<br><ul><li><code>"first-user-message"</code> — hanya pesan pengguna pertama</li><li><code>"recent-user-messages"</code> — pesan pengguna pertama ditambah 3 pesan pengguna terakhir</li><li><code>"full-conversation"</code> — seluruh percakapan（pengguna，asisten，panggilan alat dan hasil），dibatasi hingga ~60k karakter dengan mempertahankan pembukaan（niat utama）dan ekor terbaru</li></ul>   |
| `namingModel`               | `string`  | <code>""</code>                     | Penimpaan <code>provider/modelId</code> untuk panggilan LLM pengubahan nama。Contoh：<code>"openrouter/nvidia/nemotron-3-nano-30b-a3b:free"</code>。Biarkan kosong untuk menggunakan model dan penyedia Pi default yang dikonfigurasi。                                                                                                                                                                                                                                                      |
| `namingStyle`               | `string`  | <code>"natural"</code>              | Gaya penamaan yang digunakan untuk kedua nama：<br><ul><li><code>"natural"</code> — kalimat bebas</li><li><code>"slug"</code> — huruf kecil dipisahkan tanda hubung。</li><li><code>"topic-project"</code> — `<topik>｜<proyek>`，proyek diturunkan dari direktori kerja saat ini</li></ul>                                                                                                                                                                                                  |
| `replaceExistingName`       | `string`  | <code>"always"</code>               | Kapan menimpa nama sesi Pi，nama jendela tmux，nama panel/tab herdr，nama panel/tab zellij yang ada：<br><ul><li><code>"always"</code> — selalu menimpa</li><li><code>"never"</code> — tidak pernah menimpa</li></ul>                                                                                                                                                                                                                                                                        |
| `reRenameEveryNTurns`       | `integer` | `0`                                 | Ubah nama setiap N giliran（setiap peristiwa `agent_settled`）。`0` tidak pernah mengubah nama。                                                                                                                                                                                                                                                                                                                                                                                             |
| `respectExternalRenames`    | `boolean` | `true`                              | Saat `true`，menonaktifkan pengubahan nama ekstensi ini setelah pengubahan nama eksternal terdeteksi（misalnya setelah Anda menjalankan `/name` secara manual）。                                                                                                                                                                                                                                                                                                                            |
| `sessionNameMaxLength`      | `integer` | `200`                               | Batas karakter maksimum untuk nama sesi Pi。                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `skipSessionNameDedup`      | `boolean` | `false`                             | `true` melewatkan pengiriman nama sesi Pi yang ada ke prompt pengubahan nama。`false`（default）mengirim hingga 15 nama sesi yang ada untuk menghindari duplikasi。                                                                                                                                                                                                                                                                                                                          |
| `surfaces.renamePiSession`  | `boolean` | `true`                              | `false` menonaktifkan pengubahan nama sesi Pi。                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `surfaces.renameHerdrPane`  | `boolean` | `true`                              | `false` menonaktifkan pengubahan nama panel herdr tempat Pi berjalan。                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `surfaces.renameHerdrTab`   | `boolean` | `true`                              | `false` menonaktifkan pengubahan nama tab herdr tempat proses ini berjalan。                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `surfaces.renameTmuxWindow` | `boolean` | `true`                              | `false` menonaktifkan pengubahan nama jendela tmux tempat proses ini berjalan。                                                                                                                                                                                                                                                                                                                                                                                                              |
| `surfaces.renameZellijPane` | `boolean` | `true`                              | `false` menonaktifkan pengubahan nama panel zellij tempat proses ini berjalan。                                                                                                                                                                                                                                                                                                                                                                                                              |
| `surfaces.renameZellijTab`  | `boolean` | `true`                              | `false` menonaktifkan pengubahan nama tab zellij tempat proses ini berjalan。                                                                                                                                                                                                                                                                                                                                                                                                                |
| `windowNameMaxLength`       | `integer` | `30`                                | Maks karakter untuk setiap nama jendela terminal/panel（panel/tab herdr，jendela tmux，panel/tab zellij）。Salah satu dari dua pengatur panjang。                                                                                                                                                                                                                                                                                                                                            |

## Debugging

Atur `PI_AUTO_NAME_DEBUG=1` dan ekstensi akan menambahkan entri `pi-auto-name:debug` terstruktur ke transkrip sesi dan menampilkannya di TUI。（Entri debug tidak dikirim ke LLM。）

## Inspirasi

Ekstensi ini terinspirasi oleh beberapa ekstensi serupa lainnya：

- <https://github.com/ssdiwu/pi-autoname>
- <https://github.com/byteowlz/pi-agent-extensions/tree/main/pi-auto-rename>
- <https://github.com/mkioutcc/pi-title-renamer>
- <https://github.com/default-anton/pi-tmux-window-name>
