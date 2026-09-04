# @normful/pi-auto-name

Tự động đặt tên cho phiên Pi và các bề mặt trình đa hợp thiết bị đầu cuối của bạn dựa trên cuộc trò chuyện。

Hỗ trợ đổi tên một bảng điều khiển herdr hoặc thẻ herdr chứa Pi：

<p align="center">
  <img src="https://media.githubusercontent.com/media/normful/pi-bakery/main/screenshots/auto-name.png" alt="pi-auto-name herdr screenshot" width="800">
</p>

Cũng hỗ trợ đổi tên một cửa sổ tmux chứa Pi：

<p align="center">
  <img src="https://media.githubusercontent.com/media/normful/pi-bakery/main/screenshots/pi-auto-name_tmux.png" alt="pi-auto-name tmux screenshot" width="800">
</p>

Và hỗ trợ đổi tên một bảng điều khiển zellij hoặc thẻ zellij chứa Pi：

<p align="center">
  <img src="https://media.githubusercontent.com/media/normful/pi-bakery/main/screenshots/pi-auto-name_zellij.png" alt="pi-auto-name zellij screenshot" width="800">
</p>

Hỗ trợ nhiều ngôn ngữ khác nhau，ví dụ như tiếng Việt：

<p align="center">
  <img src="https://media.githubusercontent.com/media/normful/pi-bakery/main/screenshots/pi-auto-rename_japanese.png" alt="pi-auto-name ảnh chụp màn hình đổi tên tiếng Việt" width="800">
</p>

Danh sách tất cả các ngôn ngữ được hỗ trợ：English、Español、Deutsch、Français、Italiano、Nederlands、Português、Bahasa Indonesia、Tiếng Việt、Türkçe、Polski、Українська、فارسی、العربية、हिन्दी、简体中文、繁體中文、日本語、한국어、ไทย

## Cài đặt

```bash
pi install npm:@normful/pi-auto-name
```

## Sử dụng

Tiện ích mở rộng này hoàn toàn tự động; không có gì cần chạy。

Cấu hình một lần，là xong。Thiết lập và quên đi。

## Cách hoạt động

Sau khi có đầu vào người dùng đầu tiên（hoặc sự kiện `agent_settled` đầu tiên — xem cấu hình bên dưới），nó đổi tên phiên Pi và đổi tên những gì chứa trong：

- cửa sổ tmux
- bảng điều khiển herdr và thẻ herdr
- bảng điều khiển zellij và thẻ zellij

Ngoài ra，bạn cũng có thể cấu hình để nó đổi tên liên tục khi cuộc trò chuyện phát triển，bằng cách cấu hình `reRenameEveryNTurns`。

## Cấu hình

Lưu cấu hình vào：

- Toàn cục：`~/.pi/agent/pi-auto-name.json`（hoặc `<PI_CODING_AGENT_DIR>/pi-auto-name.json` khi được cấu hình）
- Đường dẫn dự phòng đã lỗi thời：`~/.config/pi-auto-name/config.json` vẫn được đọc với mức ưu tiên thấp nhất
- Ghi đè theo dự án：`.pi/pi-auto-name.json`

Cấu hình mặc định đầy đủ：

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

Mỗi khóa cấu hình đều là tùy chọn。

## Tham chiếu Cấu hình

| Key                         | Type      | Default                             | Meaning                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| --------------------------- | --------- | ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `enabled`                   | `boolean` | `true`                              | `false` vô hiệu hóa tiện ích mở rộng này hoàn toàn。                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `initialRenameTrigger`      | `string`  | <code>"first-input"</code>          | Khi lần đổi tên đầu tiên được kích hoạt：<br><ul><li><code>"first-input"</code> — sau khi bạn gửi prompt đầu tiên</li><li><code>"first-agent-settled"</code> — sau khi lần chạy LLM đầu tiên hoàn tất（sau sự kiện `agent_settled` đầu tiên）。</li></ul>                                                                                                                                                                                                                              |
| `language`                  | `string`  | `"en"`                              | Một trong：<code>en</code>、<code>es</code>、<code>de</code>、<code>fr</code>、<code>it</code>、<code>nl</code>、<code>pt</code>/<code>pt-BR</code>/<code>pt-PT</code>、<code>id</code>、<code>vi</code>、<code>tr</code>、<code>pl</code>、<code>uk</code>、<code>fa</code>、<code>ar</code>、<code>hi</code>、<code>zh</code>/<code>zh-CN</code>/<code>zh-Hans</code>、<code>zh-Hant</code>/<code>zh-TW</code>/<code>zh-HK</code>、<code>ja</code>、<code>ko</code>、<code>th</code> |
| `namingContextDepth`        | `string`  | <code>"recent-user-messages"</code> | Lượng cuộc trò chuyện gửi đến LLM trong mỗi prompt đổi tên：<br><ul><li><code>"first-user-message"</code> — chỉ tin nhắn người dùng đầu tiên</li><li><code>"recent-user-messages"</code> — tin nhắn người dùng đầu tiên cộng thêm 3 tin nhắn người dùng cuối cùng</li><li><code>"full-conversation"</code> — toàn bộ cuộc trò chuyện（người dùng，trợ lý，gọi công cụ và kết quả），giới hạn ~60k ký tự giữ cả phần mở đầu（ý định chính）và phần đuôi mới nhất</li></ul>              |
| `namingModel`               | `string`  | <code>""</code>                     | Ghi đè <code>provider/modelId</code> cho lời gọi LLM đổi tên。Ví dụ：<code>"openrouter/nvidia/nemotron-3-nano-30b-a3b:free"</code>。Để trống để sử dụng mô hình và nhà cung cấp Pi mặc định đã cấu hình。                                                                                                                                                                                                                                                                              |
| `namingStyle`               | `string`  | <code>"natural"</code>              | Kiểu đặt tên được sử dụng cho cả hai tên：<br><ul><li><code>"natural"</code> — câu tự do</li><li><code>"slug"</code> — chữ thường phân tách bằng dấu gạch nối。</li><li><code>"topic-project"</code> — `<chủ đề>｜<dự án>`，dự án được suy ra từ thư mục làm việc hiện tại</li></ul>                                                                                                                                                                                                   |
| `replaceExistingName`       | `string`  | <code>"always"</code>               | Khi nào ghi đè tên phiên Pi hiện có，tên cửa sổ tmux，tên bảng điều khiển/thẻ herdr，tên bảng điều khiển/thẻ zellij：<br><ul><li><code>"always"</code> — luôn ghi đè</li><li><code>"never"</code> — không bao giờ ghi đè</li></ul>                                                                                                                                                                                                                                                     |
| `reRenameEveryNTurns`       | `integer` | `0`                                 | Đổi tên mỗi N lượt（mỗi sự kiện `agent_settled`）。`0` không bao giờ đổi tên。                                                                                                                                                                                                                                                                                                                                                                                                         |
| `respectExternalRenames`    | `boolean` | `true`                              | Khi `true`，vô hiệu hóa việc đổi tên của tiện ích mở rộng này sau khi phát hiện đổi tên bên ngoài（ví dụ：sau khi bạn chạy thủ công `/name`）。                                                                                                                                                                                                                                                                                                                                        |
| `sessionNameMaxLength`      | `integer` | `200`                               | Giới hạn ký tự tối đa cho tên phiên Pi。                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `skipSessionNameDedup`      | `boolean` | `false`                             | `true` bỏ qua việc gửi tên phiên Pi hiện có vào prompt đổi tên。`false`（mặc định）gửi tối đa 15 tên phiên hiện có để tránh trùng lặp。                                                                                                                                                                                                                                                                                                                                                |
| `surfaces.renamePiSession`  | `boolean` | `true`                              | `false` vô hiệu hóa việc đổi tên phiên Pi。                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `surfaces.renameHerdrPane`  | `boolean` | `true`                              | `false` vô hiệu hóa việc đổi tên bảng điều khiển herdr nơi Pi đang chạy。                                                                                                                                                                                                                                                                                                                                                                                                              |
| `surfaces.renameHerdrTab`   | `boolean` | `true`                              | `false` vô hiệu hóa việc đổi tên thẻ herdr mà tiến trình này đang chạy。                                                                                                                                                                                                                                                                                                                                                                                                               |
| `surfaces.renameTmuxWindow` | `boolean` | `true`                              | `false` vô hiệu hóa việc đổi tên cửa sổ tmux mà tiến trình này đang chạy。                                                                                                                                                                                                                                                                                                                                                                                                             |
| `surfaces.renameZellijPane` | `boolean` | `true`                              | `false` vô hiệu hóa việc đổi tên bảng điều khiển zellij mà tiến trình này đang chạy。                                                                                                                                                                                                                                                                                                                                                                                                  |
| `surfaces.renameZellijTab`  | `boolean` | `true`                              | `false` vô hiệu hóa việc đổi tên thẻ zellij mà tiến trình này đang chạy。                                                                                                                                                                                                                                                                                                                                                                                                              |
| `windowNameMaxLength`       | `integer` | `30`                                | Tối đa ký tự cho mỗi tên cửa sổ terminal/bảng điều khiển（bảng điều khiển/thẻ herdr，cửa sổ tmux，bảng điều khiển/thẻ zellij）。Một trong hai công tắc điều chỉnh độ dài。                                                                                                                                                                                                                                                                                                             |

## Gỡ lỗi

Đặt `PI_AUTO_NAME_DEBUG=1` và tiện ích mở rộng sẽ thêm các mục `pi-auto-name:debug` có cấu trúc vào bản ghi phiên và hiển thị chúng trong TUI。（Các mục gỡ lỗi không được gửi đến LLM。）

## Truy cảm hứng

Tiện ích mở rộng này được truyền cảm hứng từ một số tiện ích mở rộng tương tự khác：

- <https://github.com/ssdiwu/pi-autoname>
- <https://github.com/byteowlz/pi-agent-extensions/tree/main/pi-auto-rename>
- <https://github.com/mkioutcc/pi-title-renamer>
- <https://github.com/default-anton/pi-tmux-window-name>
