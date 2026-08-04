# @normful/pi-auto-name

Konuşmaya göre Pi oturumunuzu ve terminal multiplexer yüzeylerinizi otomatik olarak adlandırır。

Pi içeren bir herdr panelini veya herdr sekmesini yeniden adlandırma desteği：

<p align="center">
  <img src="https://media.githubusercontent.com/media/normful/pi-bakery/main/screenshots/auto-name.png" alt="pi-auto-name herdr screenshot" width="800">
</p>

Ayrıca Pi içeren bir tmux penceresini yeniden adlandırma desteği：

<p align="center">
  <img src="https://media.githubusercontent.com/media/normful/pi-bakery/main/screenshots/pi-auto-name_tmux.png" alt="pi-auto-name tmux screenshot" width="800">
</p>

Ve Pi içeren bir zellij panelini veya zellij sekmesini yeniden adlandırma desteği：

<p align="center">
  <img src="https://media.githubusercontent.com/media/normful/pi-bakery/main/screenshots/pi-auto-name_zellij.png" alt="pi-auto-name zellij screenshot" width="800">
</p>

Japonca dahil çeşitli diller desteklenir：

<p align="center">
  <img src="https://media.githubusercontent.com/media/normful/pi-bakery/main/screenshots/pi-auto-rename_japanese.png" alt="pi-auto-name Japonca yeniden adlandırma ekran görüntüsü" width="800">
</p>

Desteklenen tüm dillerin listesi：English、Español、Deutsch、Français、Italiano、Nederlands、Português、Bahasa Indonesia、Tiếng Việt、Türkçe、Polski、Українська、فارسی、العربية、हिन्दी、简体中文、繁體中文、日本語、한국어、ไทย

## Kurulum

```bash
pi install npm:@normful/pi-auto-name
```

## Kullanım

Eklenti tamamen otomatiktir; çalıştırılacak bir şey yoktur。

Bir kez yapılandırın，bu kadar。Ayarlayın ve unutun。

## Nasıl Çalışır

İlk kullanıcı girdisinden sonra（veya ilk `agent_settled` olayından sonra — aşağıdaki yapılandırmaya bakın），Pi oturumunun adını değiştirir ve şunların adını da değiştirir：

- tmux penceresi
- herdr paneli ve herdr sekmesi
- zellij paneli ve zellij sekmesi

Ayrıca，`reRenameEveryNTurns` yapılandırarak konuşma geliştikçe eklentinin sürekli yeniden adlandırmasını da ayarlayabilirsiniz。

## Yapılandırma

Yapılandırmayı şuraya kaydedin：

- Global：`~/.config/pi-auto-name/config.json`（`XDG_CONFIG_HOME`'u saygı gösterir）
- Proje başına geçersiz kılma：`.pi/pi-auto-name.json`

Tam varsayılan yapılandırma：

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

Her yapılandırma anahtarı isteğe bağlıdır。

## Yapılandırma Referansı

| Key                         | Type      | Default                             | Meaning                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| --------------------------- | --------- | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `enabled`                   | `boolean` | `true`                              | `false` bu eklentiyi tamamen devre dışı bırakır。                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `initialRenameTrigger`      | `string`  | <code>"first-input"</code>          | İlk yeniden adlandırma ne zaman tetiklenir：<br><ul><li><code>"first-input"</code> — ilk promptu gönderdikten sonra</li><li><code>"first-agent-settled"</code> — ilk LLM çalışması tamamlandıktan sonra（ilk `agent_settled` olayının ardından）。</li></ul>                                                                                                                                                                                                                                |
| `language`                  | `string`  | `"en"`                              | Şunlardan biri：<code>en</code>、<code>es</code>、<code>de</code>、<code>fr</code>、<code>it</code>、<code>nl</code>、<code>pt</code>/<code>pt-BR</code>/<code>pt-PT</code>、<code>id</code>、<code>vi</code>、<code>tr</code>、<code>pl</code>、<code>uk</code>、<code>fa</code>、<code>ar</code>、<code>hi</code>、<code>zh</code>/<code>zh-CN</code>/<code>zh-Hans</code>、<code>zh-Hant</code>/<code>zh-TW</code>/<code>zh-HK</code>、<code>ja</code>、<code>ko</code>、<code>th</code> |
| `namingContextDepth`        | `string`  | <code>"recent-user-messages"</code> | Her yeniden adlandırma promptunda LLM'e gönderilecek konuşma miktarı：<br><ul><li><code>"first-user-message"</code> — yalnızca ilk kullanıcı mesajı</li><li><code>"recent-user-messages"</code> — ilk kullanıcı mesajı son 3 kullanıcı mesajıyla birlikte</li><li><code>"full-conversation"</code> — tüm konuşma（kullanıcılar，asistanlar，araç çağrıları ve sonuçlar），açış（ana niyet）ve en son kuyruğu koruyarak ~60k karaktere sınırlandırılmış</li></ul>                            |
| `namingModel`               | `string`  | <code>""</code>                     | Yeniden adlandırma LLM çağrısı için <code>provider/modelId</code> geçersiz kılma。Örnek：<code>"openrouter/nvidia/nemotron-3-nano-30b-a3b:free"</code>。Boş bırakın，yapılandırılmış Pi varsayılan modelini ve sağlayıcısını kullanmak için。                                                                                                                                                                                                                                               |
| `namingStyle`               | `string`  | <code>"natural"</code>              | Her iki isim için kullanılan yeniden adlandırma stili：<br><ul><li><code>"natural"</code> — serbest cümle</li><li><code>"slug"</code> — küçük harf tire ile ayrılmış。</li><li><code>"topic-project"</code> — `<konu>｜<proje>`，mevcut çalışma dizininden türetilen proje</li></ul>                                                                                                                                                                                                        |
| `replaceExistingName`       | `string`  | <code>"always"</code>               | Mevcut Pi oturumu adı，tmux pencere adı，herdr panel/sekme adı，zellij panel/sekme adının ne zaman üzerine yazılacağı：<br><ul><li><code>"always"</code> — her zaman üzerine yaz</li><li><code>"never"</code> — asla üzerine yazma</li></ul>                                                                                                                                                                                                                                                |
| `reRenameEveryNTurns`       | `integer` | `0`                                 | Her N turda yeniden adlandır（her `agent_settled` olayı）。`0` hiçbir zaman yeniden adlandırmaz。                                                                                                                                                                                                                                                                                                                                                                                           |
| `respectExternalRenames`    | `boolean` | `true`                              | `true` olduğunda，dış bir yeniden adlandırma algılandıktan sonra bu eklentinin yeniden adlandırmasını devre dışı bırakır（örneğin，manuel olarak `/name` çalıştırdıktan sonra）。                                                                                                                                                                                                                                                                                                           |
| `sessionNameMaxLength`      | `integer` | `200`                               | Pi oturumu adı için maksimum karakter sınırı。                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `skipSessionNameDedup`      | `boolean` | `false`                             | `true` yeniden adlandırma promptunda mevcut Pi oturumu adlarını göndermeyi atlar。`false`（varsayılan）çiftlemeyi önlemek için en fazla 15 mevcut oturum adı gönderir。                                                                                                                                                                                                                                                                                                                     |
| `surfaces.renamePiSession`  | `boolean` | `true`                              | `false` Pi oturumu yeniden adlandırmayı devre dışı bırakır。                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `surfaces.renameHerdrPane`  | `boolean` | `true`                              | `false` Pi'nin çalıştığı herdr panelinin yeniden adlandırılmasını devre dışı bırakır。                                                                                                                                                                                                                                                                                                                                                                                                      |
| `surfaces.renameHerdrTab`   | `boolean` | `true`                              | `false` Bu işlemin çalıştığı herdr sekmesinin yeniden adlandırılmasını devre dışı bırakır。                                                                                                                                                                                                                                                                                                                                                                                                 |
| `surfaces.renameTmuxWindow` | `boolean` | `true`                              | `false` Bu işlemin çalıştığı tmux penceresinin yeniden adlandırılmasını devre dışı bırakır。                                                                                                                                                                                                                                                                                                                                                                                                |
| `surfaces.renameZellijPane` | `boolean` | `true`                              | `false` Bu işlemin çalıştığı zellij panelinin yeniden adlandırılmasını devre dışı bırakır。                                                                                                                                                                                                                                                                                                                                                                                                 |
| `surfaces.renameZellijTab`  | `boolean` | `true`                              | `false` Bu işlemin çalıştığı zellij sekmesinin yeniden adlandırılmasını devre dışı bırakır。                                                                                                                                                                                                                                                                                                                                                                                                |
| `windowNameMaxLength`       | `integer` | `30`                                | Her terminal/çerçeve pencere adı için maksimum karakter（herdr panel/sekme，tmux penceresi，zellij panel/sekme）。İki uzunluk düğmesinden biri。                                                                                                                                                                                                                                                                                                                                            |

## Hata Ayıklama

`PI_AUTO_NAME_DEBUG=1` ayarlayın ve eklenti hem oturum transkriptine yapılandırılmış `pi-auto-name:debug` girdilerini ekleyecek hem de TUI'de gösterecektir。（Hata ayıklama girdileri LLM'e gönderilmez。）

## İlham

Bu eklenti birkaç benzer eklenden ilham almıştır：

- <https://github.com/ssdiwu/pi-autoname>
- <https://github.com/byteowlz/pi-agent-extensions/tree/main/pi-auto-rename>
- <https://github.com/mkioutcc/pi-title-renamer>
- <https://github.com/default-anton/pi-tmux-window-name>
