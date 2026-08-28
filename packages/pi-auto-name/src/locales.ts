// locales.ts — LocaleStrings interface + per-locale string tables + registry.
// Source of truth for prompt strings: LOCALES.md. English is the scaffolding
// fallback; CJK locales (Simplified/Traditional Chinese, Japanese, Korean) are
// added here. The registry is additive — append tables (plus §1 map rows in
// i18n.ts) later.

export interface LocaleStrings {
  /** System prompts — one per style. */
  naturalSystemPrompt: string;
  slugSystemPrompt: string;
  topicProjectSystemPrompt: string;
  /** Natural style — user-side rules block (prepended to the naming context). */
  naturalRules: string;
  /** Full user-prompt templates; labels are baked in, values are {placeholders}. */
  topicProjectPromptTemplate: string; // {language} {maxChars} {projectLines} {projectLine} {cwd} {firstUserBlock} {firstAssistantBlock} {conversationBlock} {conversationBlock}
  namingContextTemplate: string; // {firstUserMessageLabel} {first} {recent}
  conversationSection: string; // "\n\nConversation:\n{conversation}" (full-conversation depth only)
  /** Short shared labels used to assemble conditional lines. */
  projectLabel: string; // "Project:"
  firstUserMessageLabel: string; // "First user message:"
  firstAssistantMessageLabel: string; // "First assistant message:"
  noneLabel: string; // "none"
  /** The two conditional project-suffix lines ({separator} {projectName}). */
  projectSuffixLines: string;
  /** Dedup wrapper prepended in generateNames (§9.4). */
  dedupIntro: string;
  /** Two-line response format suffixed to every rendered prompt (§9.3). */
  responseFormat: string;
  /** Explicit "output in {language}" directive, injected into natural/slug prompts. */
  languageDirective: string;
}

// The model output contract (`WINDOW:` / `SESSION:` and the `window:` /
// `session:` line prefixes the parser keys off) stays ASCII in every locale —
// only the surrounding instruction scaffolding is translated. Sanitizers key
// off these exact ASCII labels via WINDOW_LABEL_RE / SESSION_LABEL_RE.

const EN: LocaleStrings = {
  naturalSystemPrompt:
    "You create session names for AI chat sessions. Return exactly two lines.\n" +
    "WINDOW: a short 2-4 word label in Title Case for a terminal tab bar (up to {windowMaxChars} characters).\n" +
    "SESSION: a descriptive 8-12 word name in Title Case for a session list (up to {sessionMaxChars} characters).\n" +
    'Anchor the WINDOW name on a specific entity — a file, function, service, subsystem, or branch concern — so it stays distinguishable from sibling sessions working on related tasks. Prefer "OAuth token refresh" over "Fix OAuth issue".\n' +
    "For task-oriented sessions, foreground the action being done and its goal — lead with a verb or the intent, not just the bare subject.\n" +
    "No quotes, no punctuation at the end, no extra text.",
  slugSystemPrompt: `Name this coding-agent session. Return exactly two lines.

WINDOW: a lowercase hyphen-separated label under {windowMaxChars} characters.
SESSION: a lowercase hyphen-separated name under {sessionMaxChars} characters.
Anchor the WINDOW on a specific entity (file, function, service, subsystem, or branch concern) so it stays distinguishable from sibling sessions.
Prefer an action-oriented name: an imperative verb first, then a noun or short noun phrase, all lowercase and hyphen-separated — e.g. fix-auth-callback, migrate-stripe-webhooks, add-login-tests. Lead with the verb so it reads as the thing being done, not a bare descriptor. Prefer a crisp, specific pair like fix-auth-callback over a vague one like auth-issues.
Be concise and specific.
Use plain text, no quotes, no markdown, no trailing punctuation, no extra text.`,
  topicProjectSystemPrompt:
    "You generate concise terminal tab titles. Return exactly two lines:\n" +
    "WINDOW: a short title with the project suffix (up to {windowMaxChars} characters).\n" +
    "SESSION: a longer descriptive name under {sessionMaxChars} characters.\n" +
    "Anchor the WINDOW on a specific entity — a file, function, service, subsystem, or branch concern — so it stays distinguishable from sibling sessions.\n" +
    "Foreground the action being done and its goal — lead with the verb or intent, not just the subject.\n" +
    "Be concise and specific: prefer a precise, informative phrase over a vague category.\n" +
    "Output ONLY the two lines.",
  naturalRules: [
    "Name this session based on the context below.",
    "Return exactly two lines: WINDOW and SESSION.",
    "WINDOW: 2-4 words in Title Case (a terminal tab label), up to {windowMaxChars} characters.",
    "SESSION: 8-12 words in Title Case (a session name), up to {sessionMaxChars} characters.",
    "Pick a WINDOW name different from existing session names.",
    "Be concise and specific.",
    "Focus on the main topic or intent.",
    "No quotes or punctuation at end.",
    "If unclear, use a generic but relevant title.",
    "Reply with ONLY the two lines, nothing else.",
  ].join("\n"),
  topicProjectPromptTemplate:
    "Generate two terminal tab titles for this Pi conversation.\n" +
    "Language: {language}.\n" +
    "SESSION maximum characters: {maxChars}.\n" +
    "Output rules:\n" +
    "- Output exactly two lines: WINDOW and SESSION, each on a single line.\n" +
    "- Do not use Markdown, bullets, code fences, or quotes.\n" +
    "- Do not explain the titles.\n" +
    "{projectLines}\n" +
    "Context:\n" +
    "{projectLine}" +
    "Cwd: {cwd}\n" +
    "{firstUserBlock}" +
    "{firstAssistantBlock}" +
    "{conversationBlock}",
  namingContextTemplate: "{firstUserMessageLabel}\n{first}\n\nRecent user messages:\n{recent}",
  conversationSection: "\n\nConversation:\n{conversation}",
  projectLabel: "Project:",
  firstUserMessageLabel: "First user message:",
  firstAssistantMessageLabel: "First assistant message:",
  noneLabel: "none",
  projectSuffixLines:
    "- Include the project name as a suffix in this exact shape: <short topic>{separator}{projectName}.\n" +
    "- Do not place the project name before the topic.",
  dedupIntro: "Existing session titles to avoid duplicating:",
  responseFormat:
    "Return exactly two lines:\nWINDOW: <short name>\nSESSION: <long name>\nDo not add any other text.",
  languageDirective:
    "Important: generate the names in English ({language}). Do not use any other language.",
};

const ZH: LocaleStrings = {
  naturalSystemPrompt:
    "你为 AI 聊天会话创建会话名称。请恰好返回两行。\n" +
    "WINDOW: 用于终端标签栏的简短名称，约 4-12 个字（不超过 {windowMaxChars} 个字符）。\n" +
    "SESSION: 用于会话列表的描述性名称，约 15-40 个字（不超过 {sessionMaxChars} 个字符）。\n" +
    "把 WINDOW 名称锚定在具体的对象上——文件、函数、服务、子系统或分支相关事项——以便与处理相关任务的同类会话区分开。优先用「OAuth Token 刷新」，而不是「修复 OAuth 问题」。\n" +
    "对于任务型会话，突出正在进行的动作及其目标——用动词或意图开头，而不是只写主题。\n" +
    "不要加引号，结尾不要加标点，不要任何多余文本。",
  slugSystemPrompt: `为这个编程助手会话命名。请恰好返回两行。

WINDOW: 不超过 {windowMaxChars} 个字符、用连字符分隔的标签。
SESSION: 不超过 {sessionMaxChars} 个字符、用连字符分隔的名称。
把 WINDOW 锚定在具体的对象上（文件、函数、服务、子系统或分支相关事项），以便与其他会话区分。
优先使用体现动作的名称：先是祈使动词，再是名词或简短名词短语，用连字符分隔——例如 fix-auth-callback、migrate-stripe-webhooks、add-login-tests。以动词开头，让名称读起来是正在做的事，而不是单纯的描述。优先选择像 fix-auth-callback 这样精准具体的组合，而不是含糊的 auth-issues。
简洁明确。
使用纯文本，不加引号、不加标记、结尾不加标点，不要任何多余文本。`,
  topicProjectSystemPrompt:
    "你生成简洁的终端标签页标题。请恰好返回两行：\n" +
    "WINDOW: 带项目后缀的简短标题（不超过 {windowMaxChars} 个字符）。\n" +
    "SESSION: 不超过 {sessionMaxChars} 个字符的描述性名称。\n" +
    "把 WINDOW 锚定在具体的对象上——文件、函数、服务、子系统或分支相关事项——以便与处理相关任务的同类会话区分。\n" +
    "突出正在进行的动作及其目标——用动词或意图开头，而不是只写主题。\n" +
    "简洁明确：优先选择精准、信息丰富的短语，而不是含糊的分类。\n" +
    "只输出这两行。",
  naturalRules: [
    "根据下面的上下文为这个会话命名。",
    "请恰好返回两行：WINDOW 和 SESSION。",
    "WINDOW: 约 4-12 个字（终端标签页标签），不超过 {windowMaxChars} 个字符。",
    "SESSION: 约 15-40 个字（会话名称），不超过 {sessionMaxChars} 个字符。",
    "为 WINDOW 选择一个与现有会话名称不同的名称。",
    "简洁明确。",
    "聚焦主要话题或意图。",
    "末尾不要加引号或标点。",
    "如果不确定，使用通用但相关的标题。",
    "只回复这两行，不要其他内容。",
  ].join("\n"),
  topicProjectPromptTemplate:
    "为这次 Pi 对话生成两个终端标签页标题。\n" +
    "语言：{language}。\n" +
    "SESSION 最大字符数：{maxChars}。\n" +
    "输出规则：\n" +
    "- 恰好输出两行：WINDOW 和 SESSION，各占一行。\n" +
    "- 不要使用标记语言、列表、代码块或引号。\n" +
    "- 不要解释标题。\n" +
    "{projectLines}\n" +
    "上下文：\n" +
    "{projectLine}" +
    "工作目录：{cwd}\n" +
    "{firstUserBlock}" +
    "{firstAssistantBlock}" +
    "{conversationBlock}",
  namingContextTemplate: "{firstUserMessageLabel}\n{first}\n\n最近的用户消息：\n{recent}",
  conversationSection: "\n\n对话内容：\n{conversation}",
  projectLabel: "项目：",
  firstUserMessageLabel: "第一条用户消息：",
  firstAssistantMessageLabel: "第一条助手消息：",
  noneLabel: "无",
  projectSuffixLines:
    "- 以这种确切形式把项目名作为后缀加入：<短主题>{separator}{projectName}。\n" +
    "- 不要把项目名放在主题之前。",
  dedupIntro: "需要避免重复的现有会话名称：",
  responseFormat:
    "请恰好返回两行：\nWINDOW: <short name>\nSESSION: <long name>\n不要添加任何其他文本。",
  languageDirective: "重要：请用简体中文生成名称（{language}）。不要使用其他语言。",
};

const ZH_HANT: LocaleStrings = {
  naturalSystemPrompt:
    "你為 AI 聊天會話建立會話名稱。請恰好回傳兩行。\n" +
    "WINDOW: 用於終端機標籤列的簡短名稱，約 4-12 個字（不超過 {windowMaxChars} 個字元）。\n" +
    "SESSION: 用於會話清單的描述性名稱，約 15-40 個字（不超過 {sessionMaxChars} 個字元）。\n" +
    "把 WINDOW 名稱錨定在具體的對象上——檔案、函式、服務、子系統或分支相關事項——以便與處理相關工作的同類會話區分。優先使用「OAuth Token 重新整理」，而不是「修復 OAuth 問題」。\n" +
    "對於任務型會話，凸顯正在進行的動作及其目標——用動詞或意圖開頭，而不是只寫主題。\n" +
    "不要加上引號，結尾不要加標點，不要任何多餘文字。",
  slugSystemPrompt: `為這個程式助理會話命名。請恰好回傳兩行。

WINDOW: 不超過 {windowMaxChars} 個字元、用連字號分隔的標籤。
SESSION: 不超過 {sessionMaxChars} 個字元、用連字號分隔的名稱。
把 WINDOW 錨定在具體的對象上（檔案、函式、服務、子系統或分支相關事項），以便與其他會話區分。
優先使用體現動作的名稱：先是祈使動詞，再是名詞或簡短名詞片語，用連字號分隔——例如 fix-auth-callback、migrate-stripe-webhooks、add-login-tests。以動詞開頭，讓名稱讀起來是正在做的事，而不是單純的描述。優先選擇像 fix-auth-callback 這樣精準具體的組合，而不是含糊的 auth-issues。
簡潔明確。
使用純文字，不加引號、不加標記、結尾不加標點，不要任何多餘文字。`,
  topicProjectSystemPrompt:
    "你產生簡潔的終端機分頁標題。請恰好回傳兩行：\n" +
    "WINDOW: 帶專案後綴的簡短標題（不超過 {windowMaxChars} 個字元）。\n" +
    "SESSION: 不超過 {sessionMaxChars} 個字元的描述性名稱。\n" +
    "把 WINDOW 錨定在具體的對象上——檔案、函式、服務、子系統或分支相關事項——以便與處理相關工作的同類會話區分。\n" +
    "凸顯正在進行的動作及其目標——用動詞或意圖開頭，而不是只寫主題。\n" +
    "簡潔明確：優先選擇精準、資訊豐富的片語，而不是含糊的分類。\n" +
    "只輸出這兩行。",
  naturalRules: [
    "根據下面的上下文為這個會話命名。",
    "請恰好回傳兩行：WINDOW 和 SESSION。",
    "WINDOW: 約 4-12 個字（終端機分頁標籤），不超過 {windowMaxChars} 個字元。",
    "SESSION: 約 15-40 個字（會話名稱），不超過 {sessionMaxChars} 個字元。",
    "為 WINDOW 選擇一個與現有會話名稱不同的名稱。",
    "簡潔明確。",
    "聚焦主要話題或意圖。",
    "末尾不要加引號或標點。",
    "如果不確定，使用通用但相關的標題。",
    "只回覆這兩行，不要其他內容。",
  ].join("\n"),
  topicProjectPromptTemplate:
    "為這次 Pi 對話產生兩個終端機分頁標題。\n" +
    "語言：{language}。\n" +
    "SESSION 最大字元數：{maxChars}。\n" +
    "輸出規則：\n" +
    "- 恰好輸出兩行：WINDOW 和 SESSION，各佔一行。\n" +
    "- 不要使用標記語言、清單、程式碼區塊或引號。\n" +
    "- 不要解釋標題。\n" +
    "{projectLines}\n" +
    "上下文：\n" +
    "{projectLine}" +
    "工作目錄：{cwd}\n" +
    "{firstUserBlock}" +
    "{firstAssistantBlock}" +
    "{conversationBlock}",
  namingContextTemplate: "{firstUserMessageLabel}\n{first}\n\n最近的使用者訊息：\n{recent}",
  conversationSection: "\n\n對話內容：\n{conversation}",
  projectLabel: "專案：",
  firstUserMessageLabel: "第一則使用者訊息：",
  firstAssistantMessageLabel: "第一則助理訊息：",
  noneLabel: "無",
  projectSuffixLines:
    "- 以這種確切形式把專案名稱作為後綴加入：<短主題>{separator}{projectName}。\n" +
    "- 不要把專案名稱放在主題之前。",
  dedupIntro: "需要避免重複的現有會話名稱：",
  responseFormat:
    "請恰好回傳兩行：\nWINDOW: <short name>\nSESSION: <long name>\n不要新增任何其他文字。",
  languageDirective: "重要：請用繁體中文產生名稱（{language}）。請勿使用其他語言。",
};

const JA: LocaleStrings = {
  naturalSystemPrompt:
    "あなたはAIチャットセッションにセッション名を付ける係です。正確に2行だけ返してください。\n" +
    "WINDOW: ターミナルのタブバー用の短い名前（約4〜12文字、{windowMaxChars}文字以内）。\n" +
    "SESSION: セッション一覧用の説明を含む名前（約15〜40文字、{sessionMaxChars}文字以内）。\n" +
    "WINDOW名は、ファイル・関数・サービス・サブシステム・ブランチのトピックなど、具体的な対象に紐づけてください。関連する作業を扱う他のセッションと区別できるようにします。「OAuthの問題を修正」ではなく「OAuthトークンの更新」のように具体的に。\n" +
    "タスク指向のセッションでは、実行中のアクションとその目的を前面に出し、主語だけでなく動詞や意図を先頭に置いてください。\n" +
    "引用符は使わず、末尾に句読点も付けず、余計なテキストは追加しないでください。",
  slugSystemPrompt: `このコーディングエージェントのセッションに名前を付けてください。正確に2行だけ返します。

WINDOW: {windowMaxChars}文字未満のハイフン区切りのラベル。
SESSION: {sessionMaxChars}文字未満のハイフン区切りの名前。
WINDOWは具体的な対象（ファイル・関数・サービス・サブシステム・ブランチのトピックのいずれか）に紐づけ、他のセッションと区別できるようにしてください。
動作を表す名前を優先してください。命令形の動詞を先頭に置き、その後に名詞や短い名詞句を続け、すべてハイフンで区切ります（例：fix-auth-callback、migrate-stripe-webhooks、add-login-tests）。動詞で始めると「やっていること」として読めます。曖昧なauth-issuesより、fix-auth-callbackのような明確で具体的な組み合わせを選んでください。
簡潔かつ具体的に。
引用符・マークダウン・末尾の句読点・余計なテキストは使わず、プレーンテキストで返してください。`,
  topicProjectSystemPrompt:
    "簡潔なターミナルタブのタイトルを生成してください。正確に2行だけ返します：\n" +
    "WINDOW: プロジェクトの接尾辞付きの短いタイトル（{windowMaxChars}文字以内）。\n" +
    "SESSION: {sessionMaxChars}文字未満の説明を含む名前。\n" +
    "WINDOWは具体的な対象（ファイル・関数・サービス・サブシステム・ブランチのトピック）に紐づけ、他のセッションと区別できるようにしてください。\n" +
    "実行中のアクションとその目的を前面に出し、主語だけでなく動詞や意図を先頭に置いてください。\n" +
    "簡潔かつ具体的に：曖昧な分類より、正確で情報量のあるフレーズを選んでください。\n" +
    "2行だけ出力してください。",
  naturalRules: [
    "以下のコンテキストに基づいてセッションに名前を付けてください。",
    "正確に2行だけ返してください：WINDOWとSESSION。",
    "WINDOW: 約4〜12文字（ターミナルタブのラベル）、{windowMaxChars}文字以内。",
    "SESSION: 約15〜40文字（セッション名）、{sessionMaxChars}文字以内。",
    "WINDOWには既存のセッション名と異なる名前を選んでください。",
    "簡潔かつ具体的に。",
    "主要な話題や意図に焦点を当ててください。",
    "末尾に引用符や句読点を付けないでください。",
    "不明な場合は、汎用的だが関連性のあるタイトルを使ってください。",
    "2行だけ返し、それ以外は何も返さないでください。",
  ].join("\n"),
  topicProjectPromptTemplate:
    "このPiの会話について、2つのターミナルタブのタイトルを生成してください。\n" +
    "言語：{language}。\n" +
    "SESSION最大文字数：{maxChars}。\n" +
    "出力ルール：\n" +
    "- 正確に2行（WINDOWとSESSION）を、それぞれ1行ずつ出力してください。\n" +
    "- Markdown・箇条書き・コードブロック・引用符は使わないでください。\n" +
    "- タイトルの説明はしないでください。\n" +
    "{projectLines}\n" +
    "コンテキスト：\n" +
    "{projectLine}" +
    "作業ディレクトリ: {cwd}\n" +
    "{firstUserBlock}" +
    "{firstAssistantBlock}" +
    "{conversationBlock}",
  namingContextTemplate: "{firstUserMessageLabel}\n{first}\n\n最近のユーザーメッセージ：\n{recent}",
  conversationSection: "\n\n会話内容：\n{conversation}",
  projectLabel: "プロジェクト：",
  firstUserMessageLabel: "最初のユーザーメッセージ：",
  firstAssistantMessageLabel: "最初のアシスタントメッセージ：",
  noneLabel: "なし",
  projectSuffixLines:
    "- プロジェクト名をこの正確な形で接尾辞として含めてください：<短いトピック>{separator}{projectName}。\n" +
    "- プロジェクト名をトピックの前には置かないでください。",
  dedupIntro: "重複を避けるための既存セッションタイトル：",
  responseFormat:
    "正確に2行返してください：\nWINDOW: <short name>\nSESSION: <long name>\n他のテキストは追加しないでください。",
  languageDirective:
    "重要：名前は日本語（{language}）で生成してください。他の言語は使用しないでください。",
};

const KO: LocaleStrings = {
  naturalSystemPrompt:
    "AI 채팅 세션의 이름을 만듭니다. 정확히 두 줄을 반환하세요.\n" +
    "WINDOW: 터미널 탭 바용 짧은 이름(약 4~12자, {windowMaxChars}자 이내).\n" +
    "SESSION: 세션 목록용 설명형 이름(약 15~40자, {sessionMaxChars}자 이내).\n" +
    'WINDOW 이름을 파일·함수·서비스·하위 시스템·브랜치 주제처럼 구체적인 대상에 고정하여, 관련 작업을 다루는 다른 세션과 구별되게 하세요. "OAuth 문제 수정"보다는 "OAuth 토큰 갱신"을 선호하세요.\n' +
    "작업 중심 세션에서는 진행 중인 작업과 그 목표를 전면에 내세우고, 주어만 쓰지 말고 동사나 의도로 시작하세요.\n" +
    "따옴표를 쓰지 말고, 끝에 구두점을 붙이지 말고, 추가 텍스트 없이 두 줄만 반환하세요.",
  slugSystemPrompt: `이 코딩 에이전트 세션의 이름을 지으세요. 정확히 두 줄을 반환하세요.

WINDOW: {windowMaxChars}자 미만의 하이픈으로 구분된 라벨.
SESSION: {sessionMaxChars}자 미만의 하이픈으로 구분된 이름.
WINDOW를 구체적인 대상(파일·함수·서비스·하위 시스템·브랜치 주제)에 고정하여 다른 세션과 구별되게 하세요.
동작을 나타내는 이름을 우선하세요. 명령형 동사로 시작하고 그다음 명사 또는 짧은 명사구를 붙이며, 모두 하이픈으로 구분하세요(예: fix-auth-callback, migrate-stripe-webhooks, add-login-tests). 동사로 시작하면 실제 수행하는 작업처럼 읽힙니다. 모호한 auth-issues보다는 fix-auth-callback처럼 명확하고 구체적인 조합을 선호하세요.
간결하고 구체적으로.
따옴표·마크다운·끝 구두점·추가 텍스트 없이 일반 텍스트로만 반환하세요.`,
  topicProjectSystemPrompt:
    "간결한 터미널 탭 제목을 생성하세요. 정확히 두 줄을 반환하세요:\n" +
    "WINDOW: 프로젝트 접미사가 붙은 짧은 제목({windowMaxChars}자 이내).\n" +
    "SESSION: {sessionMaxChars}자 미만의 설명형 이름.\n" +
    "WINDOW를 구체적인 대상(파일·함수·서비스·하위 시스템·브랜치 주제)에 고정하여 다른 세션과 구별되게 하세요.\n" +
    "진행 중인 작업과 목표를 전면에 내세우고, 주어만 쓰지 말고 동사나 의도로 시작하세요.\n" +
    "간결하고 구체적으로: 모호한 분류보다 정확하고 유익한 표현을 선택하세요.\n" +
    "두 줄만 출력하세요.",
  naturalRules: [
    "아래 컨텍스트를 기반으로 이 세션의 이름을 지으세요.",
    "정확히 두 줄만 반환하세요: WINDOW와 SESSION.",
    "WINDOW: 약 4~12자(터미널 탭 라벨), {windowMaxChars}자 이내.",
    "SESSION: 약 15~40자(세션 이름), {sessionMaxChars}자 이내.",
    "기존 세션 이름과 다른 WINDOW 이름을 선택하세요.",
    "간결하고 구체적으로.",
    "주요 주제나 의도에 초점을 맞추세요.",
    "끝에 따옴표나 구두점을 붙이지 마세요.",
    "불확실하면 일반적이지만 관련성 있는 제목을 사용하세요.",
    "두 줄만 반환하고 다른 것은 아무것도 하지 마세요.",
  ].join("\n"),
  topicProjectPromptTemplate:
    "이 Pi 대화에 대한 터미널 탭 제목 두 개를 생성하세요.\n" +
    "언어: {language}.\n" +
    "SESSION 최대 문자 수: {maxChars}.\n" +
    "출력 규칙:\n" +
    "- 정확히 두 줄(WINDOW와 SESSION)을 각각 한 줄씩 출력하세요.\n" +
    "- Markdown·불릿·코드 블록·따옴표를 사용하지 마세요.\n" +
    "- 제목을 설명하지 마세요.\n" +
    "{projectLines}\n" +
    "컨텍스트:\n" +
    "{projectLine}" +
    "작업 디렉터리: {cwd}\n" +
    "{firstUserBlock}" +
    "{firstAssistantBlock}" +
    "{conversationBlock}",
  namingContextTemplate: "{firstUserMessageLabel}\n{first}\n\n최근 사용자 메시지:\n{recent}",
  conversationSection: "\n\n대화 내용:\n{conversation}",
  projectLabel: "프로젝트:",
  firstUserMessageLabel: "첫 번째 사용자 메시지:",
  firstAssistantMessageLabel: "첫 번째 도우미 메시지:",
  noneLabel: "없음",
  projectSuffixLines:
    "- 프로젝트 이름을 이 정확한 형태로 접미사로 포함하세요: <짧은 주제>{separator}{projectName}.\n" +
    "- 프로젝트 이름을 주제 앞에 두지 마세요.",
  dedupIntro: "중복을 피할 기존 세션 제목:",
  responseFormat:
    "정확히 두 줄을 반환하세요:\nWINDOW: <short name>\nSESSION: <long name>\n다른 텍스트는 추가하지 마세요.",
  languageDirective: "중요: 이름은 한국어({language})로 생성하세요. 다른 언어는 사용하지 마세요.",
};

const PT_BR: LocaleStrings = {
  naturalSystemPrompt:
    "Você cria nomes de sessão para sessões de chat de IA. Retorne exatamente duas linhas.\n" +
    "WINDOW: um rótulo curto de 2 a 4 palavras em Title Case para a barra de abas do terminal (até {windowMaxChars} caracteres).\n" +
    "SESSION: um nome descritivo de 8 a 12 palavras em Title Case para a lista de sessões (até {sessionMaxChars} caracteres).\n" +
    'Ancore o nome WINDOW em uma entidade específica — um arquivo, função, serviço, subsistema ou questão de branch — para que ele se diferencie de sessões irmãs trabalhando em tarefas relacionadas. Prefira "atualização de token OAuth" em vez de "corrigir problema OAuth".\n' +
    "Para sessões orientadas a tarefas, destaque a ação em andamento e seu objetivo — comece com um verbo ou a intenção, não apenas o assunto.\n" +
    "Sem aspas, sem pontuação no final, sem texto extra.",
  slugSystemPrompt: `Dê um nome a esta sessão de agente de codificação. Retorne exatamente duas linhas.

WINDOW: um rótulo em minúsculas, separado por hífens, com menos de {windowMaxChars} caracteres.
SESSION: um nome em minúsculas, separado por hífens, com menos de {sessionMaxChars} caracteres.
Ancore o WINDOW em uma entidade específica (arquivo, função, serviço, subsistema ou questão de branch) para diferenciá-lo de sessões irmãs.
Prefira um nome orientado à ação: primeiro um verbo no imperativo, depois um substantivo ou frase nominal curta, tudo em minúsculas e separado por hífens — por exemplo fix-auth-callback, migrate-stripe-webhooks, add-login-tests. Comece com o verbo para que o nome leia como a ação em andamento, não um simples descritor. Prefira um par claro e específico como fix-auth-callback em vez de um vago como auth-issues.
Seja conciso e específico.
Use texto simples, sem aspas, sem markdown, sem pontuação final, sem texto extra.`,
  topicProjectSystemPrompt:
    "Você gera títulos concisos para abas do terminal. Retorne exatamente duas linhas:\n" +
    "WINDOW: um título curto com o sufixo do projeto (até {windowMaxChars} caracteres).\n" +
    "SESSION: um nome descritivo mais longo com menos de {sessionMaxChars} caracteres.\n" +
    "Ancore o WINDOW em uma entidade específica — um arquivo, função, serviço, subsistema ou questão de branch — para diferenciá-lo de sessões irmãs.\n" +
    "Destaque a ação em andamento e seu objetivo — comece com o verbo ou a intenção, não apenas o assunto.\n" +
    "Seja conciso e específico: prefira uma frase precisa e informativa a uma categoria vaga.\n" +
    "Produza SOMENTE as duas linhas.",
  naturalRules: [
    "Nomeie esta sessão com base no contexto abaixo.",
    "Retorne exatamente duas linhas: WINDOW e SESSION.",
    "WINDOW: 2 a 4 palavras em Title Case (um rótulo de aba do terminal), até {windowMaxChars} caracteres.",
    "SESSION: 8 a 12 palavras em Title Case (um nome de sessão), até {sessionMaxChars} caracteres.",
    "Escolha um nome para o WINDOW diferente dos nomes de sessões existentes.",
    "Seja conciso e específico.",
    "Concentre-se no tópico ou intenção principal.",
    "Sem aspas ou pontuação no final.",
    "Se não tiver certeza, use um título genérico, porém relevante.",
    "Responda SOMENTE com as duas linhas, nada mais.",
  ].join("\n"),
  topicProjectPromptTemplate:
    "Gere dois títulos de abas do terminal para esta conversa do Pi.\n" +
    "Idioma: {language}.\n" +
    "Máximo de caracteres de SESSION: {maxChars}.\n" +
    "Regras de saída:\n" +
    "- Produza exatamente duas linhas: WINDOW e SESSION, cada uma em uma única linha.\n" +
    "- Não use Markdown, marcadores, blocos de código ou aspas.\n" +
    "- Não explique os títulos.\n" +
    "{projectLines}\n" +
    "Contexto:\n" +
    "{projectLine}" +
    "Diretório de trabalho: {cwd}\n" +
    "{firstUserBlock}" +
    "{firstAssistantBlock}" +
    "{conversationBlock}",
  namingContextTemplate:
    "{firstUserMessageLabel}\n{first}\n\nMensagens recentes do usuário:\n{recent}",
  conversationSection: "\n\nConversa:\n{conversation}",
  projectLabel: "Projeto:",
  firstUserMessageLabel: "Primeira mensagem do usuário:",
  firstAssistantMessageLabel: "Primeira mensagem do assistente:",
  noneLabel: "nenhum",
  projectSuffixLines:
    "- Inclua o nome do projeto como sufixo neste formato exato: <tópico curto>{separator}{projectName}.\n" +
    "- Não coloque o nome do projeto antes do tópico.",
  dedupIntro: "Títulos de sessão existentes a evitar duplicar:",
  responseFormat:
    "Retorne exatamente duas linhas:\nWINDOW: <short name>\nSESSION: <long name>\nNão adicione nenhum outro texto.",
  languageDirective:
    "Importante: gere os nomes em português ({language}). Não use nenhum outro idioma.",
};

const ES: LocaleStrings = {
  naturalSystemPrompt:
    "Usted crea nombres de sesión para sesiones de chat de IA. Devuelva exactamente dos líneas.\n" +
    "WINDOW: una etiqueta corta de 2 a 4 palabras en Title Case para la barra de pestañas del terminal (hasta {windowMaxChars} caracteres).\n" +
    "SESSION: un nombre descriptivo de 8 a 12 palabras en Title Case para la lista de sesiones (hasta {sessionMaxChars} caracteres).\n" +
    'Ancle el nombre WINDOW en una entidad específica — un archivo, función, servicio, subsistema o asunto de rama — para que se distinga de sesiones hermanas que trabajan en tareas relacionadas. Prefiera "actualización de token OAuth" sobre "arreglar problema OAuth".\n' +
    "Para sesiones orientadas a tareas, resalte la acción en curso y su objetivo — comience con un verbo o la intención, no solo el tema.\n" +
    "Sin comillas, sin puntuación al final, sin texto adicional.",
  slugSystemPrompt: `Ponga nombre a esta sesión de agente de codificación. Devuelva exactamente dos líneas.

WINDOW: una etiqueta en minúsculas y separada por guiones de menos de {windowMaxChars} caracteres.
SESSION: un nombre en minúsculas y separado por guiones de menos de {sessionMaxChars} caracteres.
Ancle el WINDOW en una entidad específica (archivo, función, servicio, subsistema o asunto de rama) para distinguirlo de sesiones hermanas.
Prefiera un nombre orientado a la acción: primero un verbo en imperativo, luego un sustantivo o frase nominal corta, todo en minúsculas y separado por guiones — por ejemplo fix-auth-callback, migrate-stripe-webhooks, add-login-tests. Comience con el verbo para que el nombre lea como la acción en curso, no como un simple descriptor. Prefiera un par claro y específico como fix-auth-callback en lugar de uno vago como auth-issues.
Sea conciso y específico.
Use texto sin formato, sin comillas, sin markdown, sin puntuación final, sin texto adicional.`,
  topicProjectSystemPrompt:
    "Usted genera títulos concisos para pestañas del terminal. Devuelva exactamente dos líneas:\n" +
    "WINDOW: un título corto con el sufijo del proyecto (hasta {windowMaxChars} caracteres).\n" +
    "SESSION: un nombre descriptivo más largo de menos de {sessionMaxChars} caracteres.\n" +
    "Ancle el WINDOW en una entidad específica — un archivo, función, servicio, subsistema o asunto de rama — para distinguirlo de sesiones hermanas.\n" +
    "Resalte la acción en curso y su objetivo — comience con el verbo o la intención, no solo el tema.\n" +
    "Sea conciso y específico: prefiera una frase precisa e informativa a una categoría vaga.\n" +
    "Produzca SOLO las dos líneas.",
  naturalRules: [
    "Ponga nombre a esta sesión según el contexto siguiente.",
    "Devuelva exactamente dos líneas: WINDOW y SESSION.",
    "WINDOW: 2 a 4 palabras en Title Case (una etiqueta de pestaña del terminal), hasta {windowMaxChars} caracteres.",
    "SESSION: 8 a 12 palabras en Title Case (un nombre de sesión), hasta {sessionMaxChars} caracteres.",
    "Elija un nombre para WINDOW diferente de los nombres de sesiones existentes.",
    "Sea conciso y específico.",
    "Concéntrese en el tema o la intención principal.",
    "Sin comillas ni puntuación al final.",
    "Si no está seguro, use un título genérico pero relevante.",
    "Responda SOLO con las dos líneas, nada más.",
  ].join("\n"),
  topicProjectPromptTemplate:
    "Genere dos títulos de pestañas del terminal para esta conversación de Pi.\n" +
    "Idioma: {language}.\n" +
    "Máximo de caracteres de SESSION: {maxChars}.\n" +
    "Reglas de salida:\n" +
    "- Produzca exactamente dos líneas: WINDOW y SESSION, cada una en una sola línea.\n" +
    "- No use Markdown, viñetas, bloques de código ni comillas.\n" +
    "- No explique los títulos.\n" +
    "{projectLines}\n" +
    "Contexto:\n" +
    "{projectLine}" +
    "Directorio de trabajo: {cwd}\n" +
    "{firstUserBlock}" +
    "{firstAssistantBlock}" +
    "{conversationBlock}",
  namingContextTemplate:
    "{firstUserMessageLabel}\n{first}\n\nMensajes recientes del usuario:\n{recent}",
  conversationSection: "\n\nConversación:\n{conversation}",
  projectLabel: "Proyecto:",
  firstUserMessageLabel: "Primer mensaje del usuario:",
  firstAssistantMessageLabel: "Primer mensaje del asistente:",
  noneLabel: "ninguno",
  projectSuffixLines:
    "- Incluya el nombre del proyecto como sufijo en este formato exacto: <tema corto>{separator}{projectName}.\n" +
    "- No coloque el nombre del proyecto antes del tema.",
  dedupIntro: "Títulos de sesión existentes a evitar duplicar:",
  responseFormat:
    "Devuelva exactamente dos líneas:\nWINDOW: <short name>\nSESSION: <long name>\nNo agregue ningún otro texto.",
  languageDirective:
    "Importante: genere los nombres en español ({language}). No use ningún otro idioma.",
};

const DE: LocaleStrings = {
  naturalSystemPrompt:
    "Sie erstellen Sitzungsnamen für KI-Chatsitzungen. Geben Sie genau zwei Zeilen zurück.\n" +
    "WINDOW: ein kurzes Label mit 2 bis 4 Wörtern im Title Case für die Terminal-Tab-Leiste (bis zu {windowMaxChars} Zeichen).\n" +
    "SESSION: ein beschreibender Name mit 8 bis 12 Wörtern im Title Case für die Sitzungsliste (bis zu {sessionMaxChars} Zeichen).\n" +
    'Verankern Sie den WINDOW-Namen an einer konkreten Einheit — einer Datei, Funktion, einem Dienst, Subsystem oder Branch-Anliegen — damit er sich von Schwester-Sitzungen unterscheidet, die an verwandten Aufgaben arbeiten. Bevorzugen Sie "OAuth-Token-Aktualisierung" gegenüber "OAuth-Problem beheben".\n' +
    "Stellen Sie bei aufgabenorientierten Sitzungen die ausgeführte Aktion und ihr Ziel in den Vordergrund — beginnen Sie mit einem Verb oder der Absicht, nicht nur mit dem Thema.\n" +
    "Keine Anführungszeichen, keine Satzzeichen am Ende, kein zusätzlicher Text.",
  slugSystemPrompt: `Benennen Sie diese Sitzung des Programmier-Agenten. Geben Sie genau zwei Zeilen zurück.

WINDOW: ein kleingeschriebenes, mit Bindestrichen getrenntes Label unter {windowMaxChars} Zeichen.
SESSION: ein kleingeschriebener, mit Bindestrichen getrennter Name unter {sessionMaxChars} Zeichen.
Verankern Sie den WINDOW an einer konkreten Einheit (Datei, Funktion, Dienst, Subsystem oder Branch-Anliegen), um ihn von Schwester-Sitzungen zu unterscheiden.
Bevorzugen Sie einen handlungsorientierten Namen: zuerst ein Verb im Imperativ, dann ein Nomen oder eine kurze Nominalphrase, alles kleingeschrieben und mit Bindestrichen getrennt — zum Beispiel fix-auth-callback, migrate-stripe-webhooks, add-login-tests. Beginnen Sie mit dem Verb, damit der Name wie die ausgeführte Aktion klingt, nicht wie ein bloßer Bezeichner. Bevorzugen Sie ein klares, spezifisches Paar wie fix-auth-callback gegenüber einem vagen wie auth-issues.
Seien Sie prägnant und spezifisch.
Verwenden Sie Klartext, keine Anführungszeichen, kein Markdown, keine Satzzeichen am Ende, kein zusätzlicher Text.`,
  topicProjectSystemPrompt:
    "Sie erstellen prägnante Terminal-Tab-Titel. Geben Sie genau zwei Zeilen zurück:\n" +
    "WINDOW: ein kurzer Titel mit dem Projekt-Suffix (bis zu {windowMaxChars} Zeichen).\n" +
    "SESSION: ein beschreibender Name unter {sessionMaxChars} Zeichen.\n" +
    "Verankern Sie den WINDOW an einer konkreten Einheit — einer Datei, Funktion, einem Dienst, Subsystem oder Branch-Anliegen — um ihn von Schwester-Sitzungen zu unterscheiden.\n" +
    "Stellen Sie die ausgeführte Aktion und ihr Ziel in den Vordergrund — beginnen Sie mit dem Verb oder der Absicht, nicht nur mit dem Thema.\n" +
    "Seien Sie prägnant und spezifisch: bevorzugen Sie eine präzise, informative Formulierung gegenüber einer vagen Kategorie.\n" +
    "Geben Sie NUR die zwei Zeilen aus.",
  naturalRules: [
    "Benennen Sie diese Sitzung anhand des untenstehenden Kontexts.",
    "Geben Sie genau zwei Zeilen zurück: WINDOW und SESSION.",
    "WINDOW: 2 bis 4 Wörter im Title Case (ein Terminal-Tab-Label), bis zu {windowMaxChars} Zeichen.",
    "SESSION: 8 bis 12 Wörter im Title Case (ein Sitzungsname), bis zu {sessionMaxChars} Zeichen.",
    "Wählen Sie einen WINDOW-Namen, der sich von bestehenden Sitzungsnamen unterscheidet.",
    "Seien Sie prägnant und spezifisch.",
    "Konzentrieren Sie sich auf das Hauptthema oder die Absicht.",
    "Keine Anführungszeichen oder Satzzeichen am Ende.",
    "Wenn Sie unsicher sind, verwenden Sie einen generischen, aber zutreffenden Titel.",
    "Antworten Sie NUR mit den zwei Zeilen, sonst nichts.",
  ].join("\n"),
  topicProjectPromptTemplate:
    "Generieren Sie zwei Terminal-Tab-Titel für dieses Pi-Gespräch.\n" +
    "Sprache: {language}.\n" +
    "SESSION maximale Zeichen: {maxChars}.\n" +
    "Ausgaberegeln:\n" +
    "- Geben Sie genau zwei Zeilen aus: WINDOW und SESSION, jeweils in einer einzigen Zeile.\n" +
    "- Verwenden Sie kein Markdown, keine Aufzählungszeichen, keine Codeblöcke und keine Anführungszeichen.\n" +
    "- Erklären Sie die Titel nicht.\n" +
    "{projectLines}\n" +
    "Kontext:\n" +
    "{projectLine}" +
    "Arbeitsverzeichnis: {cwd}\n" +
    "{firstUserBlock}" +
    "{firstAssistantBlock}" +
    "{conversationBlock}",
  namingContextTemplate:
    "{firstUserMessageLabel}\n{first}\n\nLetzte Benutzernachrichten:\n{recent}",
  conversationSection: "\n\nKonversation:\n{conversation}",
  projectLabel: "Projekt:",
  firstUserMessageLabel: "Erste Benutzernachricht:",
  firstAssistantMessageLabel: "Erste Assistentennachricht:",
  noneLabel: "keine",
  projectSuffixLines:
    "- Fügen Sie den Projektnamen als Suffix in dieser exakten Form hinzu: <kurzes Thema>{separator}{projectName}.\n" +
    "- Platzieren Sie den Projektnamen nicht vor dem Thema.",
  dedupIntro: "Bestehende Sitzungstitel, um Duplikate zu vermeiden:",
  responseFormat:
    "Geben Sie genau zwei Zeilen zurück:\nWINDOW: <short name>\nSESSION: <long name>\nFügen Sie keinen weiteren Text hinzu.",
  languageDirective:
    "Wichtig: Erstellen Sie die Namen auf Deutsch ({language}). Verwenden Sie keine andere Sprache.",
};

const FR: LocaleStrings = {
  naturalSystemPrompt:
    "Vous créez des noms de session pour des sessions de chat IA. Renvoyez exactement deux lignes.\n" +
    "WINDOW: une étiquette courte de 2 à 4 mots en Title Case pour la barre d'onglets du terminal (jusqu'à {windowMaxChars} caractères).\n" +
    "SESSION: un nom descriptif de 8 à 12 mots en Title Case pour la liste des sessions (jusqu'à {sessionMaxChars} caractères).\n" +
    "Ancrez le nom WINDOW sur une entité spécifique — un fichier, une fonction, un service, un sous-système ou un sujet de branche — afin qu'il se distingue des sessions sœurs travaillant sur des tâches liées. Préférez « actualisation du jeton OAuth » à « corriger le problème OAuth ».\n" +
    "Pour les sessions orientées tâche, mettez en avant l'action en cours et son objectif — commencez par un verbe ou l'intention, pas seulement le sujet.\n" +
    "Sans guillemets, sans ponctuation à la fin, sans texte supplémentaire.",
  slugSystemPrompt: `Nommez cette session d'agent de codage. Renvoyez exactement deux lignes.

WINDOW: une étiquette en minuscules séparée par des tirets de moins de {windowMaxChars} caractères.
SESSION: un nom en minuscules séparé par des tirets de moins de {sessionMaxChars} caractères.
Ancrez le WINDOW sur une entité spécifique (fichier, fonction, service, sous-système ou sujet de branche) pour le distinguer des sessions sœurs.
Privilégiez un nom orienté action : d'abord un verbe à l'impératif, puis un nom ou une courte locution nominale, le tout en minuscules et séparé par des tirets — par exemple fix-auth-callback, migrate-stripe-webhooks, add-login-tests. Commencez par le verbe pour que le nom se lise comme l'action en cours, et non comme un simple descripteur. Préférez une paire claire et spécifique comme fix-auth-callback plutôt qu'une vague comme auth-issues.
Soyez concis et spécifique.
Utilisez du texte brut, sans guillemets, sans markdown, sans ponctuation finale, sans texte supplémentaire.`,
  topicProjectSystemPrompt:
    "Vous générez des titres concis pour les onglets du terminal. Renvoyez exactement deux lignes :\n" +
    "WINDOW: un titre court avec le suffixe du projet (jusqu'à {windowMaxChars} caractères).\n" +
    "SESSION: un nom descriptif plus long de moins de {sessionMaxChars} caractères.\n" +
    "Ancrez le WINDOW sur une entité spécifique — un fichier, une fonction, un service, un sous-système ou un sujet de branche — pour le distinguer des sessions sœurs.\n" +
    "Mettez en avant l'action en cours et son objectif — commencez par le verbe ou l'intention, pas seulement le sujet.\n" +
    "Soyez concis et spécifique : préférez une formulation précise et informative à une catégorie vague.\n" +
    "Produisez UNIQUEMENT les deux lignes.",
  naturalRules: [
    "Nommez cette session en fonction du contexte ci-dessous.",
    "Renvoyez exactement deux lignes : WINDOW et SESSION.",
    "WINDOW: 2 à 4 mots en Title Case (une étiquette d'onglet du terminal), jusqu'à {windowMaxChars} caractères.",
    "SESSION: 8 à 12 mots en Title Case (un nom de session), jusqu'à {sessionMaxChars} caractères.",
    "Choisissez un nom WINDOW différent des noms de sessions existantes.",
    "Soyez concis et spécifique.",
    "Concentrez-vous sur le sujet ou l'intention principal.",
    "Sans guillemets ni ponctuation à la fin.",
    "Si vous n'êtes pas sûr, utilisez un titre générique mais pertinent.",
    "Répondez UNIQUEMENT avec les deux lignes, rien d'autre.",
  ].join("\n"),
  topicProjectPromptTemplate:
    "Générez deux titres d'onglets du terminal pour cette conversation Pi.\n" +
    "Langue : {language}.\n" +
    "Maximum de caractères de SESSION : {maxChars}.\n" +
    "Règles de sortie :\n" +
    "- Produisez exactement deux lignes : WINDOW et SESSION, chacune sur une seule ligne.\n" +
    "- N'utilisez pas de Markdown, de puces, de blocs de code ni de guillemets.\n" +
    "- N'expliquez pas les titres.\n" +
    "{projectLines}\n" +
    "Contexte :\n" +
    "{projectLine}" +
    "Répertoire de travail : {cwd}\n" +
    "{firstUserBlock}" +
    "{firstAssistantBlock}" +
    "{conversationBlock}",
  namingContextTemplate:
    "{firstUserMessageLabel}\n{first}\n\nMessages récents de l'utilisateur :\n{recent}",
  conversationSection: "\n\nConversation :\n{conversation}",
  projectLabel: "Projet :",
  firstUserMessageLabel: "Premier message de l'utilisateur :",
  firstAssistantMessageLabel: "Premier message de l'assistant :",
  noneLabel: "aucun",
  projectSuffixLines:
    "- Incluez le nom du projet comme suffixe dans cette forme exacte : <sujet court>{separator}{projectName}.\n" +
    "- Ne placez pas le nom du projet avant le sujet.",
  dedupIntro: "Titres de session existants à éviter de dupliquer :",
  responseFormat:
    "Renvoyez exactement deux lignes :\nWINDOW: <short name>\nSESSION: <long name>\nN'ajoutez aucun autre texte.",
  languageDirective:
    "Important : générez les noms en français ({language}). N'utilisez aucune autre langue.",
};

const ID: LocaleStrings = {
  naturalSystemPrompt:
    "Anda membuat nama sesi untuk sesi obrolan AI. Kembalikan tepat dua baris.\n" +
    "WINDOW: label pendek 2-4 kata dalam Title Case untuk bilah tab terminal (hingga {windowMaxChars} karakter).\n" +
    "SESSION: nama deskriptif 8-12 kata dalam Title Case untuk daftar sesi (hingga {sessionMaxChars} karakter).\n" +
    'Ancarkan nama WINDOW pada entitas spesifik — file, fungsi, layanan, subsistem, atau hal terkait cabang — sehingga tetap dapat dibedakan dari sesi lain yang mengerjakan tugas terkait. Utamakan "pembaruan token OAuth" daripada "memperbaiki masalah OAuth".\n' +
    "Untuk sesi berorientasi tugas, tonjolkan tindakan yang sedang dilakukan dan tujuannya — awali dengan kata kerja atau maksud, bukan hanya subjeknya.\n" +
    "Tanpa tanda kutip, tanpa tanda baca di akhir, tanpa teks tambahan.",
  slugSystemPrompt: `Beri nama sesi agen pengodean ini. Kembalikan tepat dua baris.

WINDOW: label huruf kecil dipisahkan tanda hubung di bawah {windowMaxChars} karakter.
SESSION: nama huruf kecil dipisahkan tanda hubung di bawah {sessionMaxChars} karakter.
Ancarkan WINDOW pada entitas spesifik (file, fungsi, layanan, subsistem, atau hal terkait cabang) agar dapat dibedakan dari sesi lain.
Utamakan nama yang berorientasi tindakan: kata kerja imperatif terlebih dahulu, lalu kata benda atau frasa kata benda pendek, semuanya huruf kecil dan dipisahkan tanda hubung — misalnya fix-auth-callback, migrate-stripe-webhooks, add-login-tests. Awali dengan kata kerja sehingga nama terbaca sebagai tindakan yang sedang dilakukan, bukan sekadar deskriptor. Utamakan pasangan yang jelas dan spesifik seperti fix-auth-callback daripada yang samar seperti auth-issues.
Ringkas dan spesifik.
Gunakan teks biasa, tanpa tanda kutip, tanpa markdown, tanpa tanda baca di akhir, tanpa teks tambahan.`,
  topicProjectSystemPrompt:
    "Anda membuat judul tab terminal yang ringkas. Kembalikan tepat dua baris:\n" +
    "WINDOW: judul pendek dengan akhiran proyek (hingga {windowMaxChars} karakter).\n" +
    "SESSION: nama deskriptif lebih panjang di bawah {sessionMaxChars} karakter.\n" +
    "Ancarkan WINDOW pada entitas spesifik — file, fungsi, layanan, subsistem, atau hal terkait cabang — agar dapat dibedakan dari sesi lain.\n" +
    "Tonjolkan tindakan yang sedang dilakukan dan tujuannya — awali dengan kata kerja atau maksud, bukan hanya subjek.\n" +
    "Ringkas dan spesifik: utamakan frasa yang tepat dan informatif daripada kategori yang samar.\n" +
    "Keluarkan HANYA dua baris itu.",
  naturalRules: [
    "Beri nama sesi ini berdasarkan konteks di bawah ini.",
    "Kembalikan tepat dua baris: WINDOW dan SESSION.",
    "WINDOW: 2-4 kata dalam Title Case (label tab terminal), hingga {windowMaxChars} karakter.",
    "SESSION: 8-12 kata dalam Title Case (nama sesi), hingga {sessionMaxChars} karakter.",
    "Pilih nama WINDOW yang berbeda dari nama sesi yang sudah ada.",
    "Ringkas dan spesifik.",
    "Fokus pada topik atau maksud utama.",
    "Tanpa tanda kutip atau tanda baca di akhir.",
    "Jika tidak yakin, gunakan judul generik tetapi relevan.",
    "Balas HANYA dengan dua baris itu, tanpa apa pun lagi.",
  ].join("\n"),
  topicProjectPromptTemplate:
    "Buat dua judul tab terminal untuk percakapan Pi ini.\n" +
    "Bahasa: {language}.\n" +
    "Karakter maksimum SESSION: {maxChars}.\n" +
    "Aturan keluaran:\n" +
    "- Keluarkan tepat dua baris: WINDOW dan SESSION, masing-masing pada satu baris.\n" +
    "- Jangan gunakan Markdown, poin, blok kode, atau tanda kutip.\n" +
    "- Jangan jelaskan judulnya.\n" +
    "{projectLines}\n" +
    "Konteks:\n" +
    "{projectLine}" +
    "Direktori kerja: {cwd}\n" +
    "{firstUserBlock}" +
    "{firstAssistantBlock}" +
    "{conversationBlock}",
  namingContextTemplate: "{firstUserMessageLabel}\n{first}\n\nPesan pengguna terbaru:\n{recent}",
  conversationSection: "\n\nPercakapan:\n{conversation}",
  projectLabel: "Proyek:",
  firstUserMessageLabel: "Pesan pengguna pertama:",
  firstAssistantMessageLabel: "Pesan asisten pertama:",
  noneLabel: "tidak ada",
  projectSuffixLines:
    "- Sertakan nama proyek sebagai akhiran dalam bentuk persis ini: <topik pendek>{separator}{projectName}.\n" +
    "- Jangan letakkan nama proyek sebelum topik.",
  dedupIntro: "Judul sesi yang ada yang harus dihindari duplikasinya:",
  responseFormat:
    "Kembalikan tepat dua baris:\nWINDOW: <short name>\nSESSION: <long name>\nJangan tambahkan teks lain apa pun.",
  languageDirective:
    "Penting: buat nama dalam bahasa Indonesia ({language}). Jangan gunakan bahasa lain.",
};

const VI: LocaleStrings = {
  naturalSystemPrompt:
    "Bạn tạo tên phiên cho các phiên trò chuyện AI. Chỉ trả về chính xác hai dòng.\n" +
    "WINDOW: nhãn ngắn 2-4 từ ở dạng Title Case cho thanh tab của thiết bị đầu cuối (tối đa {windowMaxChars} ký tự).\n" +
    "SESSION: tên mô tả 8-12 từ ở dạng Title Case cho danh sách phiên (tối đa {sessionMaxChars} ký tự).\n" +
    'Gắn tên WINDOW vào một thực thể cụ thể — tệp, hàm, dịch vụ, hệ thống con hoặc vấn đề của nhánh — để dễ phân biệt với các phiên cùng cấp xử lý các tác vụ liên quan. Ưu tiên "cập nhật token OAuth" thay vì "sửa sự cố OAuth".\n' +
    "Đối với phiên hướng tác vụ, hãy làm nổi bật hành động đang thực hiện và mục tiêu của nó — bắt đầu bằng động từ hoặc ý định, không chỉ chủ ngữ.\n" +
    "Không dùng dấu ngoặc kép, không có dấu câu ở cuối, không thêm văn bản nào khác.",
  slugSystemPrompt: `Đặt tên cho phiên của tác nhân lập trình này. Chỉ trả về chính xác hai dòng.

WINDOW: nhãn chữ thường phân tách bằng dấu gạch nối dưới {windowMaxChars} ký tự.
SESSION: tên chữ thường phân tách bằng dấu gạch nối dưới {sessionMaxChars} ký tự.
Gắn WINDOW vào một thực thể cụ thể (tệp, hàm, dịch vụ, hệ thống con hoặc vấn đề của nhánh) để phân biệt với các phiên cùng cấp.
Ưu tiên tên hướng hành động: đầu tiên là động từ mệnh lệnh, sau đó là danh từ hoặc cụm danh từ ngắn, tất cả viết thường và phân tách bằng dấu gạch nối — ví dụ fix-auth-callback, migrate-stripe-webhooks, add-login-tests. Bắt đầu bằng động từ để tên đọc như hành động đang thực hiện, không phải mô tả đơn thuần. Ưu tiên một cặp rõ ràng và cụ thể như fix-auth-callback thay vì một cái mơ hồ như auth-issues.
Ngắn gọn và cụ thể.
Dùng văn bản thuần, không dấu ngoặc kép, không markdown, không dấu câu ở cuối, không thêm văn bản nào khác.`,
  topicProjectSystemPrompt:
    "Bạn tạo tiêu đề tab thiết bị đầu cuối ngắn gọn. Chỉ trả về chính xác hai dòng:\n" +
    "WINDOW: tiêu đề ngắn kèm hậu tố dự án (tối đa {windowMaxChars} ký tự).\n" +
    "SESSION: tên mô tả dài hơn dưới {sessionMaxChars} ký tự.\n" +
    "Gắn WINDOW vào một thực thể cụ thể — tệp, hàm, dịch vụ, hệ thống con hoặc vấn đề của nhánh — để phân biệt với các phiên cùng cấp.\n" +
    "Làm nổi bật hành động đang thực hiện và mục tiêu của nó — bắt đầu bằng động từ hoặc ý định, không chỉ chủ ngữ.\n" +
    "Ngắn gọn và cụ thể: ưu tiên một cụm từ chính xác, giàu thông tin hơn một loại mơ hồ.\n" +
    "Chỉ xuất ra HAI dòng đó.",
  naturalRules: [
    "Đặt tên cho phiên này dựa trên ngữ cảnh bên dưới.",
    "Chỉ trả về chính xác hai dòng: WINDOW và SESSION.",
    "WINDOW: 2-4 từ ở dạng Title Case (nhãn tab thiết bị đầu cuối), tối đa {windowMaxChars} ký tự.",
    "SESSION: 8-12 từ ở dạng Title Case (tên phiên), tối đa {sessionMaxChars} ký tự.",
    "Chọn tên WINDOW khác với tên các phiên hiện có.",
    "Ngắn gọn và cụ thể.",
    "Tập trung vào chủ đề hoặc ý định chính.",
    "Không dấu ngoặc kép hoặc dấu câu ở cuối.",
    "Nếu không chắc chắn, hãy dùng một tiêu đề chung nhưng liên quan.",
    "Chỉ trả lời bằng HAI dòng đó, không gì khác.",
  ].join("\n"),
  topicProjectPromptTemplate:
    "Tạo hai tiêu đề tab thiết bị đầu cuối cho cuộc trò chuyện Pi này.\n" +
    "Ngôn ngữ: {language}.\n" +
    "Số ký tự tối đa của SESSION: {maxChars}.\n" +
    "Quy tắc đầu ra:\n" +
    "- Chỉ xuất ra chính xác hai dòng: WINDOW và SESSION, mỗi dòng trên một dòng.\n" +
    "- Không dùng Markdown, gạch đầu dòng, khối mã hoặc dấu ngoặc kép.\n" +
    "- Không giải thích các tiêu đề.\n" +
    "{projectLines}\n" +
    "Bối cảnh:\n" +
    "{projectLine}" +
    "Thư mục làm việc: {cwd}\n" +
    "{firstUserBlock}" +
    "{firstAssistantBlock}" +
    "{conversationBlock}",
  namingContextTemplate:
    "{firstUserMessageLabel}\n{first}\n\nTin nhắn gần đây của người dùng:\n{recent}",
  conversationSection: "\n\nCuộc trò chuyện:\n{conversation}",
  projectLabel: "Dự án:",
  firstUserMessageLabel: "Tin nhắn đầu tiên của người dùng:",
  firstAssistantMessageLabel: "Tin nhắn đầu tiên của trợ lý:",
  noneLabel: "không có",
  projectSuffixLines:
    "- Thêm tên dự án làm hậu tố theo đúng dạng này: <chủ đề ngắn>{separator}{projectName}.\n" +
    "- Không đặt tên dự án trước chủ đề.",
  dedupIntro: "Tiêu đề phiên hiện có cần tránh trùng lặp:",
  responseFormat:
    "Chỉ trả về chính xác hai dòng:\nWINDOW: <short name>\nSESSION: <long name>\nKhông thêm văn bản nào khác.",
  languageDirective:
    "Quan trọng: hãy tạo tên bằng tiếng Việt ({language}). Không dùng bất kỳ ngôn ngữ nào khác.",
};

const TR: LocaleStrings = {
  naturalSystemPrompt:
    "AI sohbet oturumları için oturum adları oluşturursunuz. Tam olarak iki satır döndürün.\n" +
    "WINDOW: terminal sekme çubuğu için Title Case biçiminde 2-4 kelimelik kısa bir etiket (en fazla {windowMaxChars} karakter).\n" +
    "SESSION: oturum listesi için Title Case biçiminde 8-12 kelimelik açıklayıcı bir ad (en fazla {sessionMaxChars} karakter).\n" +
    'WINDOW adını belirli bir varlığa — bir dosya, işlev, hizmet, alt sistem veya dal konusuna — sabitleyin; böylece ilgili görevlerde çalışan kardeş oturumlardan ayırt edilebilir. "OAuth sorununu düzeltmek" yerine "OAuth belirteci yenileme"yi tercih edin.\n' +
    "Görev odaklı oturumlarda, yürütülen eylemi ve amacını öne çıkarın — yalnızca konuyla değil, bir fiil veya niyetle başlayın.\n" +
    "Tırnak işareti yok, sonda noktalama yok, fazladan metin yok.",
  slugSystemPrompt: `Bu kodlama aracısı oturumunu adlandırın. Tam olarak iki satır döndürün.

WINDOW: {windowMaxChars} karakterin altında, küçük harfli, tire ile ayrılmış bir etiket.
SESSION: {sessionMaxChars} karakterin altında, küçük harfli, tire ile ayrılmış bir ad.
WINDOW'u belirli bir varlığa (dosya, işlev, hizmet, alt sistem veya dal konusu) sabitleyerek kardeş oturumlardan ayırt edin.
Eylem odaklı bir adı tercih edin: önce emir kipinde bir fiil, sonra bir isim veya kısa isim öbeği, tümü küçük harfli ve tire ile ayrılmış — örneğin fix-auth-callback, migrate-stripe-webhooks, add-login-tests. Ad, yapılan eylem gibi okunması için fiille başlayın, salt bir tanımlayıcı olmasın. auth-issues gibi belirsiz bir ad yerine fix-auth-callback gibi net ve belirli bir çifti tercih edin.
Kısa ve belirli olun.
Düz metin kullanın; tırnak işareti, markdown, sonda noktalama veya fazladan metin yok.`,
  topicProjectSystemPrompt:
    "Kısa terminal sekme başlıkları oluşturursunuz. Tam olarak iki satır döndürün:\n" +
    "WINDOW: proje sonekli kısa bir başlık (en fazla {windowMaxChars} karakter).\n" +
    "SESSION: {sessionMaxChars} karakterin altında daha uzun açıklayıcı bir ad.\n" +
    "WINDOW'u belirli bir varlığa — bir dosya, işlev, hizmet, alt sistem veya dal konusuna — sabitleyerek kardeş oturumlardan ayırt edin.\n" +
    "Yürütülen eylemi ve amacını öne çıkarın — yalnızca konuyla değil, fiil veya niyetle başlayın.\n" +
    "Kısa ve belirli olun: belirsiz bir kategori yerine kesin ve bilgilendirici bir ifadeyi tercih edin.\n" +
    "Yalnızca bu iki satırı çıkarın.",
  naturalRules: [
    "Bu oturumu aşağıdaki bağlama göre adlandırın.",
    "Tam olarak iki satır döndürün: WINDOW ve SESSION.",
    "WINDOW: Title Case biçiminde 2-4 kelime (bir terminal sekme etiketi), en fazla {windowMaxChars} karakter.",
    "SESSION: Title Case biçiminde 8-12 kelime (bir oturum adı), en fazla {sessionMaxChars} karakter.",
    "Mevcut oturum adlarından farklı bir WINDOW adı seçin.",
    "Kısa ve belirli olun.",
    "Ana konuya veya amaca odaklanın.",
    "Sonda tırnak işareti veya noktalama yok.",
    "Emin değilseniz genel ama ilgili bir başlık kullanın.",
    "Yalnızca bu iki satırla yanıtlayın, başka bir şey değil.",
  ].join("\n"),
  topicProjectPromptTemplate:
    "Bu Pi konuşması için iki terminal sekme başlığı oluşturun.\n" +
    "Dil: {language}.\n" +
    "SESSION maksimum karakter: {maxChars}.\n" +
    "Çıktı kuralları:\n" +
    "- Tam olarak iki satır çıkarın: WINDOW ve SESSION, her biri tek bir satırda.\n" +
    "- Markdown, madde işareti, kod bloğu veya tırnak işareti kullanmayın.\n" +
    "- Başlıkları açıklamayın.\n" +
    "{projectLines}\n" +
    "Bağlam:\n" +
    "{projectLine}" +
    "Çalışma dizini: {cwd}\n" +
    "{firstUserBlock}" +
    "{firstAssistantBlock}" +
    "{conversationBlock}",
  namingContextTemplate: "{firstUserMessageLabel}\n{first}\n\nSon kullanıcı mesajları:\n{recent}",
  conversationSection: "\n\nKonuşma:\n{conversation}",
  projectLabel: "Proje:",
  firstUserMessageLabel: "İlk kullanıcı mesajı:",
  firstAssistantMessageLabel: "İlk asistan mesajı:",
  noneLabel: "yok",
  projectSuffixLines:
    "- Proje adını tam olarak bu biçimde bir sonek olarak ekleyin: <kısa konu>{separator}{projectName}.\n" +
    "- Proje adını konunun önüne koymayın.",
  dedupIntro: "Çoğaltmaktan kaçınılacak mevcut oturum başlıkları:",
  responseFormat:
    "Tam olarak iki satır döndürün:\nWINDOW: <short name>\nSESSION: <long name>\nBaşka hiçbir metin eklemeyin.",
  languageDirective: "Önemli: adları Türkçe ({language}) oluşturun. Başka hiçbir dil kullanmayın.",
};

const PL: LocaleStrings = {
  naturalSystemPrompt:
    "Tworzysz nazwy sesji dla sesji czatu AI. Zwróć dokładnie dwie linie.\n" +
    "WINDOW: krótka etykieta 2-4 słów w Title Case dla paska kart terminala (do {windowMaxChars} znaków).\n" +
    "SESSION: opisowa nazwa 8-12 słów w Title Case dla listy sesji (do {sessionMaxChars} znaków).\n" +
    'Zakotwicz nazwę WINDOW na konkretnym bycie — pliku, funkcji, usłudze, podsystemie lub kwestii gałęzi — aby odróżnić ją od sesji siostrzanych pracujących nad powiązanymi zadaniami. Preferuj "odświeżanie tokenu OAuth" zamiast "naprawianie problemu z OAuth".\n' +
    "W przypadku sesji zorientowanych na zadania wysuń na pierwszy plan wykonywaną akcję i jej cel — zacznij od czasownika lub intencji, nie tylko od tematu.\n" +
    "Bez cudzysłowów, bez interpunkcji na końcu, bez dodatkowego tekstu.",
  slugSystemPrompt: `Nadaj nazwę tej sesji agenta programistycznego. Zwróć dokładnie dwie linie.

WINDOW: mała litera, etykieta rozdzielona łącznikami, mniej niż {windowMaxChars} znaków.
SESSION: mała litera, nazwa rozdzielona łącznikami, mniej niż {sessionMaxChars} znaków.
Zakotwicz WINDOW na konkretnym bycie (pliku, funkcji, usłudze, podsystemie lub kwestii gałęzi), aby odróżnić go od sesji siostrzanych.
Preferuj nazwę zorientowaną na działanie: najpierw czasownik w trybie rozkazującym, potem rzeczownik lub krótka fraza rzeczownikowa, wszystko małymi literami i rozdzielone łącznikami — np. fix-auth-callback, migrate-stripe-webhooks, add-login-tests. Zacznij od czasownika, aby nazwa brzmiała jak wykonywana czynność, a nie sam opis. Preferuj jasną i konkretną parę, np. fix-auth-callback, zamiast niejasnej, np. auth-issues.
Bądź zwięzły i konkretny.
Użyj zwykłego tekstu: bez cudzysłowów, bez markdownu, bez interpunkcji na końcu, bez dodatkowego tekstu.`,
  topicProjectSystemPrompt:
    "Tworzysz zwięzłe tytuły kart terminala. Zwróć dokładnie dwie linie:\n" +
    "WINDOW: krótki tytuł z przyrostkiem projektu (do {windowMaxChars} znaków).\n" +
    "SESSION: dłuższa opisowa nazwa mniejsza niż {sessionMaxChars} znaków.\n" +
    "Zakotwicz WINDOW na konkretnym bycie — pliku, funkcji, usłudze, podsystemie lub kwestii gałęzi — aby odróżnić go od sesji siostrzanych.\n" +
    "Wysuń na pierwszy plan wykonywaną akcję i jej cel — zacznij od czasownika lub intencji, nie tylko od tematu.\n" +
    "Bądź zwięzły i konkretny: preferuj precyzyjne, informacyjne sformułowanie zamiast niejasnej kategorii.\n" +
    "Wypisz TYLKO te dwie linie.",
  naturalRules: [
    "Nadaj tej sesji nazwę na podstawie poniższego kontekstu.",
    "Zwróć dokładnie dwie linie: WINDOW i SESSION.",
    "WINDOW: 2-4 słowa w Title Case (etykieta karty terminala), do {windowMaxChars} znaków.",
    "SESSION: 8-12 słów w Title Case (nazwa sesji), do {sessionMaxChars} znaków.",
    "Wybierz nazwę WINDOW inną niż istniejące nazwy sesji.",
    "Bądź zwięzły i konkretny.",
    "Skup się na głównym temacie lub intencji.",
    "Bez cudzysłowów i interpunkcji na końcu.",
    "Jeśli nie masz pewności, użyj ogólnego, ale trafnego tytułu.",
    "Odpowiedz TYLKO tymi dwiema liniami, niczym więcej.",
  ].join("\n"),
  topicProjectPromptTemplate:
    "Wygeneruj dwa tytuły kart terminala dla tej rozmowy Pi.\n" +
    "Język: {language}.\n" +
    "Maksymalna liczba znaków SESSION: {maxChars}.\n" +
    "Zasady wyjścia:\n" +
    "- Wypisz dokładnie dwie linie: WINDOW i SESSION, każdą w jednej linii.\n" +
    "- Nie używaj markdownu, wypunktowań, bloków kodu ani cudzysłowów.\n" +
    "- Nie wyjaśniaj tytułów.\n" +
    "{projectLines}\n" +
    "Kontekst:\n" +
    "{projectLine}" +
    "Katalog roboczy: {cwd}\n" +
    "{firstUserBlock}" +
    "{firstAssistantBlock}" +
    "{conversationBlock}",
  namingContextTemplate:
    "{firstUserMessageLabel}\n{first}\n\nOstatnie wiadomości użytkownika:\n{recent}",
  conversationSection: "\n\nRozmowa:\n{conversation}",
  projectLabel: "Projekt:",
  firstUserMessageLabel: "Pierwsza wiadomość użytkownika:",
  firstAssistantMessageLabel: "Pierwsza wiadomość asystenta:",
  noneLabel: "brak",
  projectSuffixLines:
    "- Dodaj nazwę projektu jako przyrostek w dokładnie tej formie: <krótki temat>{separator}{projectName}.\n" +
    "- Nie umieszczaj nazwy projektu przed tematem.",
  dedupIntro: "Istniejące tytuły sesji, których duplikowania należy unikać:",
  responseFormat:
    "Zwróć dokładnie dwie linie:\nWINDOW: <short name>\nSESSION: <long name>\nNie dodawaj żadnego innego tekstu.",
  languageDirective:
    "Ważne: generuj nazwy po polsku ({language}). Nie używaj żadnego innego języka.",
};

const UK: LocaleStrings = {
  naturalSystemPrompt:
    "Ви створюєте назви сесій для AI-чатів. Поверніть рівно два рядки.\n" +
    "WINDOW: короткий ярлик 2-4 слів у форматі Title Case для панелі вкладок термінала (до {windowMaxChars} символів).\n" +
    "SESSION: описова назва 8-12 слів у форматі Title Case для списку сесій (до {sessionMaxChars} символів).\n" +
    'Прив\'яжіть назву WINDOW до конкретної сутності — файлу, функції, служби, підсистеми або питання гілки — щоб її можна було відрізнити від сусідніх сесій, що працюють над суміжними завданнями. Надавайте перевагу "оновленню токена OAuth", а не "виправленню проблеми з OAuth".\n' +
    "Для сесій, орієнтованих на завдання, виводьте на перший план дію, що виконується, та її мету — починайте з дієслова або наміру, а не лише з теми.\n" +
    "Без лапок, без пунктуації в кінці, без зайвого тексту.",
  slugSystemPrompt: `Дайте назву цій сесії агента програмування. Поверніть рівно два рядки.

WINDOW: ярлик у нижньому регістрі, розділений дефісами, менше ніж {windowMaxChars} символів.
SESSION: назва в нижньому регістрі, розділена дефісами, менше ніж {sessionMaxChars} символів.
Прив'яжіть WINDOW до конкретної сутності (файлу, функції, служби, підсистеми або питання гілки), щоб відрізнити його від сусідніх сесій.
Надавайте перевагу назві, орієнтованій на дію: спочатку дієслово в наказовому способі, потім іменник або коротка іменникова фраза, усе в нижньому регістрі та розділене дефісами — наприклад fix-auth-callback, migrate-stripe-webhooks, add-login-tests. Почніть з дієслова, щоб назва читалася як дія, що виконується, а не просто опис. Надавайте перевагу чіткій і конкретній парі, як fix-auth-callback, замість розмитої, як auth-issues.
Будьте стислими й конкретними.
Використовуйте звичайний текст: без лапок, без markdown, без пунктуації в кінці, без зайвого тексту.`,
  topicProjectSystemPrompt:
    "Ви створюєте стислі заголовки вкладок термінала. Поверніть рівно два рядки:\n" +
    "WINDOW: короткий заголовок із суфіксом проєкту (до {windowMaxChars} символів).\n" +
    "SESSION: довша описова назва менше ніж {sessionMaxChars} символів.\n" +
    "Прив'яжіть WINDOW до конкретної сутності — файлу, функції, служби, підсистеми або питання гілки — щоб відрізнити його від сусідніх сесій.\n" +
    "Виводьте на перший план дію, що виконується, та її мету — починайте з дієслова або наміру, не лише з теми.\n" +
    "Будьте стислими й конкретними: надавайте перевагу точному, інформативному вислову, а не розмитій категорії.\n" +
    "Виведіть ТІЛЬКИ ці два рядки.",
  naturalRules: [
    "Назвіть цю сесію на основі контексту нижче.",
    "Поверніть рівно два рядки: WINDOW і SESSION.",
    "WINDOW: 2-4 слова у форматі Title Case (ярлик вкладки термінала), до {windowMaxChars} символів.",
    "SESSION: 8-12 слів у форматі Title Case (назва сесії), до {sessionMaxChars} символів.",
    "Виберіть назву WINDOW, відмінну від існуючих назв сесій.",
    "Будьте стислими й конкретними.",
    "Зосередьтеся на головній темі або намірі.",
    "Без лапок і пунктуації в кінці.",
    "Якщо не впевнені, використайте загальний, але доречний заголовок.",
    "Відповідайте ТІЛЬКИ цими двома рядками, нічим більше.",
  ].join("\n"),
  topicProjectPromptTemplate:
    "Згенеруйте два заголовки вкладок термінала для цієї розмови Pi.\n" +
    "Мова: {language}.\n" +
    "Максимальна кількість символів SESSION: {maxChars}.\n" +
    "Правила виводу:\n" +
    "- Виведіть рівно два рядки: WINDOW і SESSION, кожен в одному рядку.\n" +
    "- Не використовуйте Markdown, маркери, блоки коду або лапки.\n" +
    "- Не пояснюйте заголовки.\n" +
    "{projectLines}\n" +
    "Контекст:\n" +
    "{projectLine}" +
    "Робочий каталог: {cwd}\n" +
    "{firstUserBlock}" +
    "{firstAssistantBlock}" +
    "{conversationBlock}",
  namingContextTemplate:
    "{firstUserMessageLabel}\n{first}\n\nОстанні повідомлення користувача:\n{recent}",
  conversationSection: "\n\nРозмова:\n{conversation}",
  projectLabel: "Проєкт:",
  firstUserMessageLabel: "Перше повідомлення користувача:",
  firstAssistantMessageLabel: "Перше повідомлення асистента:",
  noneLabel: "немає",
  projectSuffixLines:
    "- Додайте назву проєкту як суфікс у точно такій формі: <коротка тема>{separator}{projectName}.\n" +
    "- Не ставте назву проєкту перед темою.",
  dedupIntro: "Наявні назви сесій, дублювання яких слід уникати:",
  responseFormat:
    "Поверніть рівно два рядки:\nWINDOW: <short name>\nSESSION: <long name>\nНе додавайте жодного іншого тексту.",
  languageDirective:
    "Важливо: створюйте назви українською мовою ({language}). Не використовуйте жодну іншу мову.",
};

const FA: LocaleStrings = {
  naturalSystemPrompt:
    "شما برای جلسات چت هوش مصنوعی نام جلسه می‌سازید. دقیقاً دو خط برگردانید.\n" +
    "WINDOW: برچسب کوتاه 2 تا 4 کلمه برای نوار تب پایانه (حداکثر {windowMaxChars} کاراکتر).\n" +
    "SESSION: نام توصیفی 8 تا 12 کلمه برای فهرست جلسات (حداکثر {sessionMaxChars} کاراکتر).\n" +
    "نام WINDOW را به یک موجودیت مشخص — یک فایل، تابع، سرویس، زیرسیستم یا موضوع شاخه — گره بزنید تا از جلسات هم‌ترازی که روی کارهای مرتبط کار می‌کنند متمایز بماند. به‌جای «رفع مشکل OAuth»، «به‌روزرسانی توکن OAuth» را ترجیح دهید.\n" +
    "برای جلسات وظیفه‌محور، عمل در حال انجام و هدف آن را برجسته کنید — با فعل یا قصد شروع کنید، نه فقط با موضوع.\n" +
    "بدون نقل‌قول، بدون علامت نگارشی در انتها، بدون متن اضافی.",
  slugSystemPrompt: `به این جلسه عامل کدنویسی نام بدهید. دقیقاً دو خط برگردانید.

WINDOW: برچسبی که با خط تیره جدا شده و کمتر از {windowMaxChars} کاراکتر است.
SESSION: نامی که با خط تیره جدا شده و کمتر از {sessionMaxChars} کاراکتر است.
WINDOW را به یک موجودیت مشخص (فایل، تابع، سرویس، زیرسیستم یا موضوع شاخه) گره بزنید تا از جلسات هم‌تراز متمایز شود.
نام عمل‌محور را ترجیح دهید: ابتدا یک فعل امری، سپس یک اسم یا گروه اسمی کوتاه، همه با خط تیره جدا شده — مانند fix-auth-callback، migrate-stripe-webhooks، add-login-tests. با فعل شروع کنید تا نام مانند عمل در حال انجام خوانده شود، نه صرفاً یک توصیف‌گر. یک جفت روشن و مشخص مانند fix-auth-callback را به جای یک مورد مبهم مانند auth-issues ترجیح دهید.
مختصر و مشخص باشید.
از متن ساده استفاده کنید: بدون نقل‌قول، بدون مارک‌داون، بدون علائم نگارشی در انتها، بدون متن اضافی.`,
  topicProjectSystemPrompt:
    "شما عنوان‌های مختصر تب پایانه می‌سازید. دقیقاً دو خط برگردانید:\n" +
    "WINDOW: عنوان کوتاه با پسوند پروژه (حداکثر {windowMaxChars} کاراکتر).\n" +
    "SESSION: نام توصیفی بلندتر، کمتر از {sessionMaxChars} کاراکتر.\n" +
    "WINDOW را به یک موجودیت مشخص — یک فایل، تابع، سرویس، زیرسیستم یا موضوع شاخه — گره بزنید تا از جلسات هم‌تراز متمایز شود.\n" +
    "عمل در حال انجام و هدف آن را برجسته کنید — با فعل یا قصد شروع کنید، نه فقط با موضوع.\n" +
    "مختصر و مشخص باشید: یک عبارت دقیق و آموزنده را به یک دسته‌بندی مبهم ترجیح دهید.\n" +
    "فقط این دو خط را خروجی دهید.",
  naturalRules: [
    "بر اساس زمینه زیر به این جلسه نام بدهید。",
    "دقیقاً دو خط برگردانید: WINDOW و SESSION.",
    "WINDOW: برچسب کوتاه 2 تا 4 کلمه (برچسب تب پایانه)، حداکثر {windowMaxChars} کاراکتر.",
    "SESSION: نام توصیفی 8 تا 12 کلمه (نام جلسه)، حداکثر {sessionMaxChars} کاراکتر.",
    "نامی برای WINDOW انتخاب کنید که با نام جلسات موجود متفاوت باشد.",
    "مختصر و مشخص باشید.",
    "روی موضوع یا قصد اصلی تمرکز کنید.",
    "بدون نقل‌قول یا علامت نگارشی در انتها.",
    "اگر مطمئن نیستید، از عنوانی کلی اما مرتبط استفاده کنید.",
    "فقط با این دو خط پاسخ دهید، نه چیز دیگری.",
  ].join("\n"),
  topicProjectPromptTemplate:
    "برای این گفتگوی Pi دو عنوان تب پایانه تولید کنید.\n" +
    "زبان: {language}.\n" +
    "حداکثر کاراکتر SESSION: {maxChars}.\n" +
    "قوانین خروجی:\n" +
    "- دقیقاً دو خط خروجی دهید: WINDOW و SESSION، هر یک در یک خط.\n" +
    "- از Markdown، گلوله، بلوک کد یا نقل‌قول استفاده نکنید.\n" +
    "- عنوان‌ها را توضیح ندهید.\n" +
    "{projectLines}\n" +
    "زمینه:\n" +
    "{projectLine}" +
    "پوشه کاری: {cwd}\n" +
    "{firstUserBlock}" +
    "{firstAssistantBlock}" +
    "{conversationBlock}",
  namingContextTemplate: "{firstUserMessageLabel}\n{first}\n\nپیام‌های اخیر کاربر:\n{recent}",
  conversationSection: "\n\nگفتگو:\n{conversation}",
  projectLabel: "پروژه:",
  firstUserMessageLabel: "اولین پیام کاربر:",
  firstAssistantMessageLabel: "اولین پیام دستیار:",
  noneLabel: "هیچ",
  projectSuffixLines:
    "- نام پروژه را به‌صورت پسوند در این شکل دقیق وارد کنید: <موضوع کوتاه>{separator}{projectName}.\n" +
    "- نام پروژه را قبل از موضوع قرار ندهید.",
  dedupIntro: "عنوان‌های جلسه موجود که از تکرار آن‌ها خودداری کنید:",
  responseFormat:
    "دقیقاً دو خط برگردانید:\nWINDOW: <short name>\nSESSION: <long name>\nهیچ متن دیگری اضافه نکنید.",
  languageDirective: "مهم: نام‌ها را به فارسی ({language}) بسازید. از هیچ زبان دیگری استفاده نکنید.",
};

const AR: LocaleStrings = {
  naturalSystemPrompt:
    "أنت تنشئ أسماء جلسات لمحادثات الذكاء الاصطناعي. أعد سطرين بالضبط.\n" +
    "WINDOW: تسمية قصيرة من 2 إلى 4 كلمات لشريط علامات التبويب في الطرفية (حتى {windowMaxChars} حرفًا).\n" +
    "SESSION: اسم وصفي من 8 إلى 12 كلمة لقائمة الجلسات (حتى {sessionMaxChars} حرفًا).\n" +
    "اربط اسم WINDOW بكيان محدد — ملف، دالة، خدمة، نظام فرعي أو موضوع فرع — ليظل متميزًا عن الجلسات الشقيقة التي تعمل على مهام مرتبطة. فضّل «تحديث رمز OAuth» على «إصلاح مشكلة OAuth».\n" +
    "بالنسبة للجلسات الموجهة نحو المهام، أبرز الإجراء الجاري وهدفه — ابدأ بفعل أو نية، وليس فقط بالموضوع.\n" +
    "بدون اقتباسات، بدون علامات ترقيم في النهاية، بدون نص إضافي.",
  slugSystemPrompt: `سمِّ جلسة وكيل البرمجة هذه. أعد سطرين بالضبط.

WINDOW: تسمية مفصولة بشرطات أقل من {windowMaxChars} حرفًا.
SESSION: اسم مفصول بشرطات أقل من {sessionMaxChars} حرفًا.
اربط WINDOW بكيان محدد (ملف، دالة، خدمة، نظام فرعي أو موضوع فرع) لتمييزه عن الجلسات الشقيقة.
فضّل اسمًا موجَّهًا نحو الفعل: أولًا فعل أمر، ثم اسم أو عبارة اسمية قصيرة، كلها مفصولة بشرطات — مثل fix-auth-callback، migrate-stripe-webhooks، add-login-tests. ابدأ بالفعل ليُقرأ الاسم كإجراء جارٍ، لا مجرد وصف. فضّل زوجًا واضحًا ومحددًا مثل fix-auth-callback على زوج غامض مثل auth-issues.
كن موجزًا ومحددًا.
استخدم نصًا عاديًا: بدون اقتباسات، بدون ماركداون، بدون علامات ترقيم في النهاية، بدون نص إضافي.`,
  topicProjectSystemPrompt:
    "تولّد عناوين مختصرة لعلامات تبويب الطرفية. أعد سطرين بالضبط:\n" +
    "WINDOW: عنوان قصير مع لاحقة المشروع (حتى {windowMaxChars} حرفًا).\n" +
    "SESSION: اسم وصفي أطول أقل من {sessionMaxChars} حرفًا.\n" +
    "اربط WINDOW بكيان محدد — ملف، دالة، خدمة، نظام فرعي أو موضوع فرع — لتمييزه عن الجلسات الشقيقة.\n" +
    "أبرز الإجراء الجاري وهدفه — ابدأ بالفعل أو النية، وليس فقط بالموضوع.\n" +
    "كن موجزًا ومحددًا: فضّل صياغة دقيقة وغنية بالمعلومات على فئة غامضة.\n" +
    "أخرج هذين السطرين فقط.",
  naturalRules: [
    "سمِّ هذه الجلسة بناءً على السياق أدناه.",
    "أعد سطرين بالضبط: WINDOW وSESSION.",
    "WINDOW: من 2 إلى 4 كلمات (تسمية علامة تبويب الطرفية)، حتى {windowMaxChars} حرفًا.",
    "SESSION: من 8 إلى 12 كلمة (اسم جلسة)، حتى {sessionMaxChars} حرفًا.",
    "اختر اسمًا لـ WINDOW مختلفًا عن أسماء الجلسات الموجودة.",
    "كن موجزًا ومحددًا.",
    "ركّز على الموضوع أو النية الرئيسية.",
    "بدون اقتباسات أو علامات ترقيم في النهاية.",
    "إذا لم تكن متأكدًا، استخدم عنوانًا عامًا لكن ذا صلة.",
    "أجب بالسطرين فقط، لا شيء آخر.",
  ].join("\n"),
  topicProjectPromptTemplate:
    "ولّد عنوانين لعلامات تبويب الطرفية لهذه المحادثة في Pi.\n" +
    "اللغة: {language}.\n" +
    "الحد الأقصى لأحرف SESSION: {maxChars}.\n" +
    "قواعد الإخراج:\n" +
    "- أخرج سطرين بالضبط: WINDOW وSESSION، كل واحد في سطر واحد.\n" +
    "- لا تستخدم ماركداون أو نقاطًا أو كتل أكواد أو اقتباسات.\n" +
    "- لا تشرح العنوانين.\n" +
    "{projectLines}\n" +
    "السياق:\n" +
    "{projectLine}" +
    "دليل العمل: {cwd}\n" +
    "{firstUserBlock}" +
    "{firstAssistantBlock}" +
    "{conversationBlock}",
  namingContextTemplate: "{firstUserMessageLabel}\n{first}\n\nرسائل المستخدم الأخيرة:\n{recent}",
  conversationSection: "\n\nالمحادثة:\n{conversation}",
  projectLabel: "المشروع:",
  firstUserMessageLabel: "أول رسالة من المستخدم:",
  firstAssistantMessageLabel: "أول رسالة من المساعد:",
  noneLabel: "لا شيء",
  projectSuffixLines:
    "- أدرج اسم المشروع كلاحقة بهذا الشكل الدقيق: <موضوع قصير>{separator}{projectName}.\n" +
    "- لا تضع اسم المشروع قبل الموضوع.",
  dedupIntro: "عناوين الجلسات الحالية لتجنب تكرارها:",
  responseFormat:
    "أعد سطرين بالضبط:\nWINDOW: <short name>\nSESSION: <long name>\nلا تضيف أي نص آخر.",
  languageDirective: "مهم: أنشئ الأسماء باللغة العربية ({language}). لا تستخدم أي لغة أخرى.",
};

const HI: LocaleStrings = {
  naturalSystemPrompt:
    "आप AI चैट सत्रों के लिए सत्र नाम बनाते हैं। ठीक दो पंक्तियाँ लौटाएँ।\n" +
    "WINDOW: टर्मिनल टैब बार के लिए 2 से 4 शब्दों का छोटा लेबल (अधिकतम {windowMaxChars} वर्ण)।\n" +
    "SESSION: सत्र सूची के लिए 8 से 12 शब्दों का वर्णनात्मक नाम (अधिकतम {sessionMaxChars} वर्ण)।\n" +
    "WINDOW नाम को किसी विशिष्ट इकाई — फ़ाइल, फ़ंक्शन, सेवा, सबसिस्टम या शाखा विषय — से जोड़ें ताकि वह संबंधित कार्यों पर काम करने वाले अन्य सत्रों से अलग पहचाना जा सके। «OAuth समस्या ठीक करना» के बजाय «OAuth टोकन नवीनीकरण» को प्राथमिकता दें।\n" +
    "कार्य-उन्मुख सत्रों के लिए, हो रही क्रिया और उसके लक्ष्य को सामने रखें — केवल विषय से नहीं, क्रिया या आशय से शुरू करें।\n" +
    "बिना उद्धरण चिह्न, अंत में बिना विराम चिह्न, बिना अतिरिक्त पाठ।",
  slugSystemPrompt: `इस कोडिंग एजेंट सत्र को नाम दें। ठीक दो पंक्तियाँ लौटाएँ।

WINDOW: {windowMaxChars} वर्णों से कम का, हाइफ़न से अलग किया गया लेबल।
SESSION: {sessionMaxChars} वर्णों से कम का, हाइफ़न से अलग किया गया नाम।
WINDOW को किसी विशिष्ट इकाई (फ़ाइल, फ़ंक्शन, सेवा, सबसिस्टम या शाखा विषय) से जोड़कर अन्य सत्रों से अलग करें।
क्रिया-उन्मुख नाम को प्राथमिकता दें: पहले अनिवार्य क्रिया, फिर संज्ञा या छोटा संज्ञा वाक्यांश, सब हाइफ़न से अलग — जैसे fix-auth-callback, migrate-stripe-webhooks, add-login-tests। क्रिया से शुरू करें ताकि नाम चल रही क्रिया जैसा पढ़ा जाए, न कि केवल एक वर्णनकर्ता। auth-issues जैसे अस्पष्ट नाम के बजाय fix-auth-callback जैसा स्पष्ट और विशिष्ट जोड़ा चुनें।
संक्षिप्त और विशिष्ट रहें।
सादा पाठ उपयोग करें: बिना उद्धरण चिह्न, बिना मार्कडाउन, अंत में बिना विराम चिह्न, बिना अतिरिक्त पाठ।`,
  topicProjectSystemPrompt:
    "आप संक्षिप्त टर्मिनल टैब शीर्षक बनाते हैं। ठीक दो पंक्तियाँ लौटाएँ:\n" +
    "WINDOW: परियोजना प्रत्यय के साथ छोटा शीर्षक (अधिकतम {windowMaxChars} वर्ण)।\n" +
    "SESSION: {sessionMaxChars} वर्णों से कम का लंबा वर्णनात्मक नाम।\n" +
    "WINDOW को किसी विशिष्ट इकाई — फ़ाइल, फ़ंक्शन, सेवा, सबसिस्टम या शाखा विषय — से जोड़कर अन्य सत्रों से अलग करें।\n" +
    "हो रही क्रिया और उसके लक्ष्य को सामने रखें — केवल विषय से नहीं, क्रिया या आशय से शुरू करें।\n" +
    "संक्षिप्त और विशिष्ट रहें: अस्पष्ट श्रेणी के बजाय सटीक, सूचनाप्रद वाक्यांश चुनें।\n" +
    "केवल ये दो पंक्तियाँ ही आउटपुट करें।",
  naturalRules: [
    "इस सत्र का नाम नीचे दिए गए संदर्भ के आधार पर रखें।",
    "ठीक दो पंक्तियाँ लौटाएँ: WINDOW और SESSION।",
    "WINDOW: 2 से 4 शब्द (टर्मिनल टैब लेबल), अधिकतम {windowMaxChars} वर्ण।",
    "SESSION: 8 से 12 शब्द (सत्र नाम), अधिकतम {sessionMaxChars} वर्ण।",
    "मौजूदा सत्र नामों से अलग WINDOW नाम चुनें।",
    "संक्षिप्त और विशिष्ट रहें।",
    "मुख्य विषय या आशय पर ध्यान दें।",
    "अंत में बिना उद्धरण चिह्न या विराम चिह्न।",
    "यदि अनिश्चित हों, तो सामान्य लेकिन प्रासंगिक शीर्षक उपयोग करें।",
    "केवल इन दो पंक्तियों से उत्तर दें, और कुछ नहीं।",
  ].join("\n"),
  topicProjectPromptTemplate:
    "इस Pi बातचीत के लिए दो टर्मिनल टैब शीर्षक बनाएँ।\n" +
    "भाषा: {language}।\n" +
    "SESSION अधिकतम वर्ण: {maxChars}।\n" +
    "आउटपुट नियम:\n" +
    "- ठीक दो पंक्तियाँ आउटपुट करें: WINDOW और SESSION, प्रत्येक एक पंक्ति में।\n" +
    "- मार्कडाउन, बुलेट, कोड ब्लॉक या उद्धरण चिह्न का उपयोग न करें।\n" +
    "- शीर्षकों की व्याख्या न करें।\n" +
    "{projectLines}\n" +
    "संदर्भ:\n" +
    "{projectLine}" +
    "कार्य निर्देशिका: {cwd}\n" +
    "{firstUserBlock}" +
    "{firstAssistantBlock}" +
    "{conversationBlock}",
  namingContextTemplate: "{firstUserMessageLabel}\n{first}\n\nहाल के उपयोगकर्ता संदेश:\n{recent}",
  conversationSection: "\n\nबातचीत:\n{conversation}",
  projectLabel: "प्रोजेक्ट:",
  firstUserMessageLabel: "पहला उपयोगकर्ता संदेश:",
  firstAssistantMessageLabel: "पहला सहायक संदेश:",
  noneLabel: "कोई नहीं",
  projectSuffixLines:
    "- परियोजना का नाम इस सटीक रूप में प्रत्यय के रूप में जोड़ें: <छोटा विषय>{separator}{projectName}।\n" +
    "- परियोजना का नाम विषय से पहले न रखें।",
  dedupIntro: "डुप्लिकेशन से बचने के लिए मौजूदा सत्र शीर्षक:",
  responseFormat:
    "ठीक दो पंक्तियाँ लौटाएँ:\nWINDOW: <short name>\nSESSION: <long name>\nकोई अन्य पाठ न जोड़ें।",
  languageDirective: "महत्वपूर्ण: नाम हिंदी ({language}) में बनाएँ। कोई अन्य भाषा प्रयोग न करें।",
};

const IT: LocaleStrings = {
  naturalSystemPrompt:
    "Creai nomi di sessione per sessioni di chat IA. Restituisci esattamente due righe.\n" +
    "WINDOW: un'etichetta breve di 2-4 parole in Title Case per la barra delle schede del terminale (fino a {windowMaxChars} caratteri).\n" +
    "SESSION: un nome descrittivo di 8-12 parole in Title Case per l'elenco delle sessioni (fino a {sessionMaxChars} caratteri).\n" +
    "Ancora il nome WINDOW a un'entità specifica — un file, una funzione, un servizio, un sottosistema o una questione di ramo — così da distinguerlo dalle sessioni sorelle che lavorano su attività correlate. Preferisci «aggiornamento token OAuth» rispetto a «correggere problema OAuth».\n" +
    "Per le sessioni orientate alle attività, metti in primo piano l'azione in corso e il suo obiettivo — inizia con un verbo o con l'intenzione, non solo con l'argomento.\n" +
    "Niente virgolette, niente punteggiatura alla fine, nessun testo extra.",
  slugSystemPrompt: `Assegna un nome a questa sessione di agente di codifica. Restituisci esattamente due righe.

WINDOW: un'etichetta in minuscolo separata da trattini, meno di {windowMaxChars} caratteri.
SESSION: un nome in minuscolo separato da trattini, meno di {sessionMaxChars} caratteri.
Ancora il WINDOW a un'entità specifica (file, funzione, servizio, sottosistema o questione di ramo) per distinguerlo dalle sessioni sorelle.
Preferisci un nome orientato all'azione: prima un verbo all'imperativo, poi un nome o una breve locuzione nominale, tutto in minuscolo e separato da trattini — per esempio fix-auth-callback, migrate-stripe-webhooks, add-login-tests. Inizia con il verbo perché il nome legga come l'azione in corso, non come un semplice descrittore. Preferisci una coppia chiara e specifica come fix-auth-callback a una vaga come auth-issues.
Sii conciso e specifico.
Usa testo semplice, niente virgolette, niente markdown, niente punteggiatura finale, nessun testo extra.`,
  topicProjectSystemPrompt:
    "Generi titoli concisi per le schede del terminale. Restituisci esattamente due righe:\n" +
    "WINDOW: un titolo breve con il suffisso del progetto (fino a {windowMaxChars} caratteri).\n" +
    "SESSION: un nome descrittivo più lungo, meno di {sessionMaxChars} caratteri.\n" +
    "Ancora il WINDOW a un'entità specifica — un file, una funzione, un servizio, un sottosistema o una questione di ramo — per distinguerlo dalle sessioni sorelle.\n" +
    "Metti in primo piano l'azione in corso e il suo obiettivo — inizia con il verbo o con l'intenzione, non solo con l'argomento.\n" +
    "Sii conciso e specifico: preferisci una formulazione precisa e informativa a una categoria vaga.\n" +
    "Produci SOLO le due righe.",
  naturalRules: [
    "Nomina questa sessione in base al contesto sottostante.",
    "Restituisci esattamente due righe: WINDOW e SESSION.",
    "WINDOW: 2-4 parole in Title Case (un'etichetta di scheda del terminale), fino a {windowMaxChars} caratteri.",
    "SESSION: 8-12 parole in Title Case (un nome di sessione), fino a {sessionMaxChars} caratteri.",
    "Scegli un nome WINDOW diverso dai nomi delle sessioni esistenti.",
    "Sii conciso e specifico.",
    "Concentrati sull'argomento o sull'intenzione principale.",
    "Niente virgolette o punteggiatura alla fine.",
    "Se non sei sicuro, usa un titolo generico ma pertinente.",
    "Rispondi SOLO con le due righe, nient'altro.",
  ].join("\n"),
  topicProjectPromptTemplate:
    "Genera due titoli di schede del terminale per questa conversazione Pi.\n" +
    "Lingua: {language}.\n" +
    "Massimo di caratteri di SESSION: {maxChars}.\n" +
    "Regole di output:\n" +
    "- Produci esattamente due righe: WINDOW e SESSION, ciascuna su una riga.\n" +
    "- Non usare Markdown, elenchi puntati, blocchi di codice o virgolette.\n" +
    "- Non spiegare i titoli.\n" +
    "{projectLines}\n" +
    "Contesto:\n" +
    "{projectLine}" +
    "Directory di lavoro: {cwd}\n" +
    "{firstUserBlock}" +
    "{firstAssistantBlock}" +
    "{conversationBlock}",
  namingContextTemplate:
    "{firstUserMessageLabel}\n{first}\n\nMessaggi recenti dell'utente:\n{recent}",
  conversationSection: "\n\nConversazione:\n{conversation}",
  projectLabel: "Progetto:",
  firstUserMessageLabel: "Primo messaggio dell'utente:",
  firstAssistantMessageLabel: "Primo messaggio dell'assistente:",
  noneLabel: "nessuno",
  projectSuffixLines:
    "- Includi il nome del progetto come suffisso in questa forma esatta: <argomento breve>{separator}{projectName}.\n" +
    "- Non mettere il nome del progetto prima dell'argomento.",
  dedupIntro: "Titoli di sessione esistenti da evitare di duplicare:",
  responseFormat:
    "Restituisci esattamente due righe:\nWINDOW: <short name>\nSESSION: <long name>\nNon aggiungere altro testo.",
  languageDirective:
    "Importante: genera i nomi in italiano ({language}). Non usare nessun'altra lingua.",
};

const NL: LocaleStrings = {
  naturalSystemPrompt:
    "U maakt sessienamen voor AI-chatsessies. Geef exact twee regels terug.\n" +
    "WINDOW: een kort label van 2-4 woorden in Title Case voor de tabbalk van de terminal (tot {windowMaxChars} tekens).\n" +
    "SESSION: een beschrijvende naam van 8-12 woorden in Title Case voor de sessielijst (tot {sessionMaxChars} tekens).\n" +
    "Veranker de WINDOW-naam aan een specifieke entiteit — een bestand, functie, service, subsysteem of branch-kwestie — zodat hij zich onderscheidt van zustersessies die aan gerelateerde taken werken. Geef de voorkeur aan «OAuth-token vernieuwen» boven «OAuth-probleem oplossen».\n" +
    "Zet bij taakgerichte sessies de lopende actie en het doel voorop — begin met een werkwoord of de bedoeling, niet alleen met het onderwerp.\n" +
    "Geen aanhalingstekens, geen leestekens aan het einde, geen extra tekst.",
  slugSystemPrompt: `Geef deze sessie van de codeeragent een naam. Geef exact twee regels terug.

WINDOW: een label in kleine letters, gescheiden door streepjes, onder {windowMaxChars} tekens.
SESSION: een naam in kleine letters, gescheiden door streepjes, onder {sessionMaxChars} tekens.
Veranker de WINDOW aan een specifieke entiteit (bestand, functie, service, subsysteem of branch-kwestie) om hem te onderscheiden van zustersessies.
Geef de voorkeur aan een actiegerichte naam: eerst een werkwoord in de gebiedende wijs, dan een zelfstandig naamwoord of korte zelfstandige-naamwoordgroep, alles in kleine letters en gescheiden door streepjes — bijvoorbeeld fix-auth-callback, migrate-stripe-webhooks, add-login-tests. Begin met het werkwoord zodat de naam leest als de lopende actie, niet als een kale omschrijving. Geef de voorkeur aan een helder en specifiek paar zoals fix-auth-callback boven een vaag paar zoals auth-issues.
Wees beknopt en specifiek.
Gebruik gewone tekst: geen aanhalingstekens, geen markdown, geen leestekens aan het einde, geen extra tekst.`,
  topicProjectSystemPrompt:
    "U maakt beknopte titels voor terminaltabbladen. Geef exact twee regels terug:\n" +
    "WINDOW: een korte titel met het projectsuffix (tot {windowMaxChars} tekens).\n" +
    "SESSION: een langere beschrijvende naam onder {sessionMaxChars} tekens.\n" +
    "Veranker de WINDOW aan een specifieke entiteit — een bestand, functie, service, subsysteem of branch-kwestie — om hem te onderscheiden van zustersessies.\n" +
    "Zet de lopende actie en het doel voorop — begin met het werkwoord of de bedoeling, niet alleen met het onderwerp.\n" +
    "Wees beknopt en specifiek: geef de voorkeur aan een precieze, informatieve formulering boven een vage categorie.\n" +
    "Geef ALLEEN de twee regels uit.",
  naturalRules: [
    "Geef deze sessie een naam op basis van de onderstaande context.",
    "Geef exact twee regels terug: WINDOW en SESSION.",
    "WINDOW: 2-4 woorden in Title Case (een label van een terminaltabblad), tot {windowMaxChars} tekens.",
    "SESSION: 8-12 woorden in Title Case (een sessienaam), tot {sessionMaxChars} tekens.",
    "Kies een WINDOW-naam die verschilt van bestaande sessienamen.",
    "Wees beknopt en specifiek.",
    "Richt je op het hoofdonderwerp of de bedoeling.",
    "Geen aanhalingstekens of leestekens aan het einde.",
    "Als je niet zeker bent, gebruik dan een generieke maar relevante titel.",
    "Antwoord ALLEEN met de twee regels, niets anders.",
  ].join("\n"),
  topicProjectPromptTemplate:
    "Genereer twee titels voor terminaltabbladen voor dit Pi-gesprek.\n" +
    "Taal: {language}.\n" +
    "Maximum aantal tekens van SESSION: {maxChars}.\n" +
    "Uitvoerregels:\n" +
    "- Geef exact twee regels uit: WINDOW en SESSION, elk op één regel.\n" +
    "- Gebruik geen Markdown, opsommingstekens, codeblokken of aanhalingstekens.\n" +
    "- Leg de titels niet uit.\n" +
    "{projectLines}\n" +
    "Context:\n" +
    "{projectLine}" +
    "Werkmap: {cwd}\n" +
    "{firstUserBlock}" +
    "{firstAssistantBlock}" +
    "{conversationBlock}",
  namingContextTemplate:
    "{firstUserMessageLabel}\n{first}\n\nRecente gebruikersberichten:\n{recent}",
  conversationSection: "\n\nGesprek:\n{conversation}",
  projectLabel: "Project:",
  firstUserMessageLabel: "Eerste gebruikersbericht:",
  firstAssistantMessageLabel: "Eerste assistentenbericht:",
  noneLabel: "geen",
  projectSuffixLines:
    "- Neem de projectnaam als suffix op in deze exacte vorm: <kort onderwerp>{separator}{projectName}.\n" +
    "- Zet de projectnaam niet vóór het onderwerp.",
  dedupIntro: "Bestaande sessietitels om duplicatie te vermijden:",
  responseFormat:
    "Geef exact twee regels terug:\nWINDOW: <short name>\nSESSION: <long name>\nVoeg geen andere tekst toe.",
  languageDirective:
    "Belangrijk: genereer de namen in het Nederlands ({language}). Gebruik geen andere taal.",
};

const TH: LocaleStrings = {
  naturalSystemPrompt:
    "คุณสร้างชื่อเซสชันสำหรับเซสชันแชท AI โปรดคืนค่าสองบรรทัดเท่านั้น\n" +
    "WINDOW: ป้ายกำกับสั้นประมาณ 4-12 ตัวอักษรสำหรับแถบแท็บเทอร์มินัล (ไม่เกิน {windowMaxChars} ตัวอักษร)\n" +
    "SESSION: ชื่ออธิบายประมาณ 15-40 ตัวอักษรสำหรับรายชื่อเซสชัน (ไม่เกิน {sessionMaxChars} ตัวอักษร)\n" +
    "ยึดชื่อ WINDOW กับเอนทิตีเฉพาะ — ไฟล์ ฟังก์ชัน บริการ ซับซิสเต็ม หรือเรื่องของสาขา — เพื่อให้แยกจากเซสชันอื่นที่ทำงานในงานที่เกี่ยวข้องได้ «รีเฟรชโทเค็น OAuth» ดีกว่า «แก้ไขปัญหา OAuth»\n" +
    "สำหรับเซสชันที่เน้นงาน เน้นการกระทำที่กำลังทำและเป้าหมาย — เริ่มด้วยคำกริยาหรือความตั้งใจ ไม่ใช่แค่หัวข้อ\n" +
    "ไม่ใช้เครื่องหมายคำพูด ไม่มีเครื่องหมายวรรคตอนท้าย ไม่มีข้อความเพิ่มเติม",
  slugSystemPrompt: `ตั้งชื่อเซสชันของเอเจนต์การเขียนโค้ดนี้ โปรดคืนค่าสองบรรทัดเท่านั้น

WINDOW: ป้ายกำกับคั่นด้วยเครื่องหมายยัติภังค์ ภายใน {windowMaxChars} ตัวอักษร
SESSION: ชื่อคั่นด้วยเครื่องหมายยัติภังค์ ภายใน {sessionMaxChars} ตัวอักษร
ยึด WINDOW กับเอนทิตีเฉพาะ (ไฟล์ ฟังก์ชัน บริการ ซับซิสเต็ม หรือเรื่องของสาขา) เพื่อให้แยกจากเซสชันอื่น
เน้นชื่อที่เน้นการกระทำ: เริ่มด้วยคำกริยาในรูปคำสั่ง แล้วตามด้วยคำนามหรือวลีคำนามสั้น ๆ ทั้งหมดคั่นด้วยเครื่องหมายยัติภังค์ — เช่น fix-auth-callback, migrate-stripe-webhooks, add-login-tests เริ่มด้วยคำกริยาเพื่อให้ชื่ออ่านเหมือนการกระทำที่กำลังทำ ไม่ใช่แค่คำอธิบาย เลือกคู่ที่ชัดเจนและเฉพาะ เช่น fix-auth-callback มากกว่าคู่ที่คลุมเครือ เช่น auth-issues
กระชับและเฉพาะเจาะจง
ใช้ข้อความธรรมดา ไม่ใช้เครื่องหมายคำพูด ไม่ใช้มาร์กดาวน์ ไม่มีเครื่องหมายวรรคตอนท้าย ไม่มีข้อความเพิ่มเติม`,
  topicProjectSystemPrompt:
    "คุณสร้างชื่อแท็บเทอร์มินัลที่กระชับ โปรดคืนค่าสองบรรทัดเท่านั้น:\n" +
    "WINDOW: ชื่อสั้นพร้อมคำต่อท้ายโปรเจกต์ (ไม่เกิน {windowMaxChars} ตัวอักษร)\n" +
    "SESSION: ชื่ออธิบายที่ยาวขึ้นภายใน {sessionMaxChars} ตัวอักษร\n" +
    "ยึด WINDOW กับเอนทิตีเฉพาะ — ไฟล์ ฟังก์ชัน บริการ ซับซิสเต็ม หรือเรื่องของสาขา — เพื่อให้แยกจากเซสชันอื่น\n" +
    "เน้นการกระทำที่กำลังทำและเป้าหมาย — เริ่มด้วยคำกริยาหรือความตั้งใจ ไม่ใช่แค่หัวข้อ\n" +
    "กระชับและเฉพาะเจาะจง: เลือกสำนวนที่แม่นยำและให้ข้อมูล มากกว่าหมวดหมู่ที่คลุมเครือ\n" +
    "แสดงผลเพียงสองบรรทัดนี้",
  naturalRules: [
    "ตั้งชื่อเซสชันนี้ตามบริบทด้านล่าง",
    "คืนค่าสองบรรทัดเท่านั้น: WINDOW และ SESSION",
    "WINDOW: ประมาณ 4-12 ตัวอักษร (ป้ายแท็บเทอร์มินัล) ไม่เกิน {windowMaxChars} ตัวอักษร",
    "SESSION: ประมาณ 15-40 ตัวอักษร (ชื่อเซสชัน) ไม่เกิน {sessionMaxChars} ตัวอักษร",
    "เลือกชื่อ WINDOW ที่แตกต่างจากชื่อเซสชันที่มีอยู่",
    "กระชับและเฉพาะเจาะจง",
    "มุ่งเน้นหัวข้อหลักหรือความตั้งใจ",
    "ไม่ใช้เครื่องหมายคำพูดหรือเครื่องหมายวรรคตอนท้าย",
    "หากไม่แน่ใจ ให้ใช้ชื่อทั่วไปแต่เกี่ยวข้อง",
    "ตอบเพียงสองบรรทัดนี้ ไม่มีอย่างอื่น",
  ].join("\n"),
  topicProjectPromptTemplate:
    "สร้างชื่อแท็บเทอร์มินัลสองชื่อสำหรับบทสนทนา Pi นี้\n" +
    "ภาษา: {language}\n" +
    "จำนวนตัวอักษรสูงสุดของ SESSION: {maxChars}\n" +
    "กฎผลลัพธ์:\n" +
    "- แสดงผลสองบรรทัดเท่านั้น: WINDOW และ SESSION แต่ละบรรทัดต่อหนึ่งบรรทัด\n" +
    "- ห้ามใช้มาร์กดาวน์ หัวข้อย่อย บล็อกโค้ด หรือเครื่องหมายคำพูด\n" +
    "- ห้ามอธิบายชื่อ\n" +
    "{projectLines}\n" +
    "บริบท:\n" +
    "{projectLine}" +
    "ไดเรกทอรีทำงาน: {cwd}\n" +
    "{firstUserBlock}" +
    "{firstAssistantBlock}" +
    "{conversationBlock}",
  namingContextTemplate: "{firstUserMessageLabel}\n{first}\n\nข้อความผู้ใช้ล่าสุด:\n{recent}",
  conversationSection: "\n\nบทสนทนา:\n{conversation}",
  projectLabel: "โปรเจกต์:",
  firstUserMessageLabel: "ข้อความผู้ใช้แรก:",
  firstAssistantMessageLabel: "ข้อความผู้ช่วยแรก:",
  noneLabel: "ไม่มี",
  projectSuffixLines:
    "- รวมชื่อโปรเจกต์เป็นคำต่อท้ายในรูปแบบนี้: <หัวข้อสั้น>{separator}{projectName}\n" +
    "- อย่าวางชื่อโปรเจกต์ไว้หน้าหัวข้อ",
  dedupIntro: "ชื่อเซสชันที่มีอยู่เพื่อหลีกเลี่ยงการซ้ำ:",
  responseFormat:
    "คืนค่าสองบรรทัดเท่านั้น:\nWINDOW: <short name>\nSESSION: <long name>\nห้ามเพิ่มข้อความอื่นใด",
  languageDirective: "สำคัญ: สร้างชื่อเป็นภาษาไทย ({language}) ห้ามใช้ภาษาอื่น",
};

/**
 * Built-in locale tables. Keys are lowercase — normalizeLanguageTag lowercases
 * the tag before lookup, so `"zh-Hant"` and `"pt-BR"` config values match the
 * `"zh-hant"` / `"pt-br"` keys here. Add a language by appending a table above
 * and an entry here (plus a row in the §1 map). `en` must always be present:
 * it is the scaffolding fallback for valid tags without a built-in table.
 */
export const LOCALE_STRINGS: Record<string, LocaleStrings> = {
  en: EN,
  zh: ZH,
  "zh-hant": ZH_HANT,
  ja: JA,
  ko: KO,
  "pt-br": PT_BR,
  es: ES,
  de: DE,
  fr: FR,
  id: ID,
  vi: VI,
  tr: TR,
  pl: PL,
  uk: UK,
  fa: FA,
  ar: AR,
  hi: HI,
  it: IT,
  nl: NL,
  th: TH,
};
