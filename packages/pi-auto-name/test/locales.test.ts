import { describe, it, expect } from "vitest";
import { LOCALE_STRINGS, type LocaleStrings } from "../src/locales.js";

const REQUIRED_FIELDS: (keyof LocaleStrings)[] = [
  "naturalSystemPrompt",
  "slugSystemPrompt",
  "topicProjectSystemPrompt",
  "naturalRules",
  "topicProjectPromptTemplate",
  "namingContextTemplate",
  "conversationSection",
  "projectLabel",
  "firstUserMessageLabel",
  "firstAssistantMessageLabel",
  "noneLabel",
  "projectSuffixLines",
  "dedupIntro",
  "responseFormat",
  "languageDirective",
];

describe("LOCALE_STRINGS registry", () => {
  it("contains the English fallback table", () => {
    expect(LOCALE_STRINGS.en).toBeDefined();
  });

  it("every table implements every LocaleStrings field as a non-empty string", () => {
    for (const [key, table] of Object.entries(LOCALE_STRINGS)) {
      for (const field of REQUIRED_FIELDS) {
        const value = table[field];
        expect(typeof value, `${key}.${field}`).toBe("string");
        expect(value.length, `${key}.${field} must be non-empty`).toBeGreaterThan(0);
      }
    }
  });

  it("every languageDirective preserves the {language} placeholder (output-language instruction)", () => {
    for (const [key, table] of Object.entries(LOCALE_STRINGS)) {
      expect(table.languageDirective, `${key}.languageDirective must keep {language}`).toContain(
        "{language}",
      );
    }
  });
});

describe("English table (en) content", () => {
  const en = LOCALE_STRINGS.en;

  it("keeps the WINDOW:/SESSION: response labels", () => {
    expect(en.responseFormat).toContain("WINDOW:");
    expect(en.responseFormat).toContain("SESSION:");
  });

  it("keeps every {placeholder} used by the naming templates", () => {
    expect(en.topicProjectPromptTemplate).toContain("{language}");
    expect(en.topicProjectPromptTemplate).toContain("{maxChars}");
    expect(en.topicProjectPromptTemplate).toContain("{projectLines}");
    expect(en.topicProjectPromptTemplate).toContain("{projectLine}");
    expect(en.topicProjectPromptTemplate).toContain("{cwd}");
    expect(en.topicProjectPromptTemplate).toContain("{firstUserBlock}");
    expect(en.topicProjectPromptTemplate).toContain("{firstAssistantBlock}");
    expect(en.namingContextTemplate).toContain("{firstUserMessageLabel}");
    expect(en.namingContextTemplate).toContain("{first}");
    expect(en.namingContextTemplate).toContain("{recent}");
    expect(en.conversationSection).toContain("{conversation}");
    expect(en.projectSuffixLines).toContain("{separator}");
    expect(en.projectSuffixLines).toContain("{projectName}");
  });

  it("keeps the word-count shape guidance in naturalRules", () => {
    expect(en.naturalRules).toContain("2-4 words");
    expect(en.naturalRules).toContain("8-12 words");
  });

  it("naturalRules is newline-joined with exactly 10 lines", () => {
    expect(en.naturalRules.split("\n")).toHaveLength(10);
  });
});

describe("budget placeholders ({windowMaxChars}/{sessionMaxChars})", () => {
  const LENGTH_BEARING_FIELDS = [
    "naturalSystemPrompt",
    "slugSystemPrompt",
    "topicProjectSystemPrompt",
    "naturalRules",
  ] as const;

  it("every table marks WINDOW/SESSION lengths with both budget placeholders", () => {
    for (const [key, table] of Object.entries(LOCALE_STRINGS)) {
      for (const field of LENGTH_BEARING_FIELDS) {
        expect(table[field], `${key}.${field} must keep {windowMaxChars}`).toContain(
          "{windowMaxChars}",
        );
        expect(table[field], `${key}.${field} must keep {sessionMaxChars}`).toContain(
          "{sessionMaxChars}",
        );
      }
    }
  });
});

describe("CJK tables (zh / zh-hant / ja / ko)", () => {
  const CJK_KEYS = ["zh", "zh-hant", "ja", "ko"] as const;

  it("registers all four tables", () => {
    for (const key of CJK_KEYS) {
      expect(LOCALE_STRINGS[key]).toBeDefined();
    }
  });

  it("keeps the ASCII WINDOW:/SESSION: output labels in responseFormat (parser contract)", () => {
    for (const key of CJK_KEYS) {
      const t = LOCALE_STRINGS[key];
      expect(t.responseFormat, `${key}.responseFormat`).toContain("WINDOW:");
      expect(t.responseFormat, `${key}.responseFormat`).toContain("SESSION:");
    }
  });

  it("keeps every {placeholder} used by the naming templates", () => {
    for (const key of CJK_KEYS) {
      const t = LOCALE_STRINGS[key];
      const template = t.topicProjectPromptTemplate;
      expect(template, `${key}`).toContain("{language}");
      expect(template, `${key}`).toContain("{maxChars}");
      expect(template, `${key}`).toContain("{projectLines}");
      expect(template, `${key}`).toContain("{projectLine}");
      expect(template, `${key}`).toContain("{cwd}");
      expect(template, `${key}`).toContain("{firstUserBlock}");
      expect(template, `${key}`).toContain("{firstAssistantBlock}");
      expect(t.namingContextTemplate, `${key}`).toContain("{firstUserMessageLabel}");
      expect(t.namingContextTemplate, `${key}`).toContain("{first}");
      expect(t.namingContextTemplate, `${key}`).toContain("{recent}");
      expect(t.conversationSection, `${key}`).toContain("{conversation}");
      expect(t.projectSuffixLines, `${key}`).toContain("{separator}");
      expect(t.projectSuffixLines, `${key}`).toContain("{projectName}");
    }
  });

  it("naturalRules is newline-joined with exactly 10 lines for each CJK table", () => {
    for (const key of CJK_KEYS) {
      expect(LOCALE_STRINGS[key].naturalRules.split("\n")).toHaveLength(10);
    }
  });
});

describe("pt-br table (Brazilian Portuguese)", () => {
  const t = LOCALE_STRINGS["pt-br"];

  it("registers the table", () => {
    expect(t).toBeDefined();
  });

  it("keeps the ASCII WINDOW:/SESSION: output labels in responseFormat (parser contract)", () => {
    expect(t.responseFormat).toContain("WINDOW:");
    expect(t.responseFormat).toContain("SESSION:");
  });

  it("keeps every {placeholder} used by the naming templates", () => {
    const template = t.topicProjectPromptTemplate;
    expect(template).toContain("{language}");
    expect(template).toContain("{maxChars}");
    expect(template).toContain("{projectLines}");
    expect(template).toContain("{projectLine}");
    expect(template).toContain("{cwd}");
    expect(template).toContain("{firstUserBlock}");
    expect(template).toContain("{firstAssistantBlock}");
    expect(t.namingContextTemplate).toContain("{firstUserMessageLabel}");
    expect(t.namingContextTemplate).toContain("{first}");
    expect(t.namingContextTemplate).toContain("{recent}");
    expect(t.conversationSection).toContain("{conversation}");
    expect(t.projectSuffixLines).toContain("{separator}");
    expect(t.projectSuffixLines).toContain("{projectName}");
  });

  it("sizes names by words (like English), not characters", () => {
    expect(t.naturalRules).toContain("2 a 4 palavras");
    expect(t.naturalRules).toContain("8 a 12 palavras");
  });

  it("naturalRules is newline-joined with exactly 10 lines", () => {
    expect(t.naturalRules.split("\n")).toHaveLength(10);
  });
});

describe("es / de / fr tables (Spanish / German / French)", () => {
  const EURO_KEYS = ["es", "de", "fr"] as const;

  it("registers all three tables", () => {
    for (const key of EURO_KEYS) {
      expect(LOCALE_STRINGS[key]).toBeDefined();
    }
  });

  it("keeps the ASCII WINDOW:/SESSION: output labels in responseFormat (parser contract)", () => {
    for (const key of EURO_KEYS) {
      const t = LOCALE_STRINGS[key];
      expect(t.responseFormat, `${key}.responseFormat`).toContain("WINDOW:");
      expect(t.responseFormat, `${key}.responseFormat`).toContain("SESSION:");
    }
  });

  it("keeps every {placeholder} used by the naming templates", () => {
    for (const key of EURO_KEYS) {
      const t = LOCALE_STRINGS[key];
      const template = t.topicProjectPromptTemplate;
      expect(template, `${key}`).toContain("{language}");
      expect(template, `${key}`).toContain("{maxChars}");
      expect(template, `${key}`).toContain("{projectLines}");
      expect(template, `${key}`).toContain("{projectLine}");
      expect(template, `${key}`).toContain("{cwd}");
      expect(template, `${key}`).toContain("{firstUserBlock}");
      expect(template, `${key}`).toContain("{firstAssistantBlock}");
      expect(t.namingContextTemplate, `${key}`).toContain("{firstUserMessageLabel}");
      expect(t.namingContextTemplate, `${key}`).toContain("{first}");
      expect(t.namingContextTemplate, `${key}`).toContain("{recent}");
      expect(t.conversationSection, `${key}`).toContain("{conversation}");
      expect(t.projectSuffixLines, `${key}`).toContain("{separator}");
      expect(t.projectSuffixLines, `${key}`).toContain("{projectName}");
    }
  });

  it("sizes names by words (like English), not characters", () => {
    expect(LOCALE_STRINGS.es.naturalRules).toContain("2 a 4 palabras");
    expect(LOCALE_STRINGS.es.naturalRules).toContain("8 a 12 palabras");
    expect(LOCALE_STRINGS.de.naturalRules).toContain("2 bis 4 Wörter");
    expect(LOCALE_STRINGS.de.naturalRules).toContain("8 bis 12 Wörter");
    expect(LOCALE_STRINGS.fr.naturalRules).toContain("2 à 4 mots");
    expect(LOCALE_STRINGS.fr.naturalRules).toContain("8 à 12 mots");
  });

  it("naturalRules is newline-joined with exactly 10 lines for each table", () => {
    for (const key of EURO_KEYS) {
      expect(LOCALE_STRINGS[key].naturalRules.split("\n")).toHaveLength(10);
    }
  });
});

describe("id / vi / tr / pl / uk tables (Indonesian / Vietnamese / Turkish / Polish / Ukrainian)", () => {
  const LANGS = [
    ["id", "2-4 kata", "8-12 kata"],
    ["vi", "2-4 từ", "8-12 từ"],
    ["tr", "2-4 kelime", "8-12 kelime"],
    ["pl", "2-4 słowa", "8-12 słów"],
    ["uk", "2-4 слова", "8-12 слів"],
  ] as const;

  it("registers all five tables", () => {
    for (const [key] of LANGS) {
      expect(LOCALE_STRINGS[key]).toBeDefined();
    }
  });

  it("keeps the ASCII WINDOW:/SESSION: output labels in responseFormat (parser contract)", () => {
    for (const [key] of LANGS) {
      const t = LOCALE_STRINGS[key];
      expect(t.responseFormat, `${key}.responseFormat`).toContain("WINDOW:");
      expect(t.responseFormat, `${key}.responseFormat`).toContain("SESSION:");
    }
  });

  it("keeps every {placeholder} used by the naming templates", () => {
    for (const [key] of LANGS) {
      const t = LOCALE_STRINGS[key];
      const template = t.topicProjectPromptTemplate;
      expect(template, `${key}`).toContain("{language}");
      expect(template, `${key}`).toContain("{maxChars}");
      expect(template, `${key}`).toContain("{projectLines}");
      expect(template, `${key}`).toContain("{projectLine}");
      expect(template, `${key}`).toContain("{cwd}");
      expect(template, `${key}`).toContain("{firstUserBlock}");
      expect(template, `${key}`).toContain("{firstAssistantBlock}");
      expect(t.namingContextTemplate, `${key}`).toContain("{firstUserMessageLabel}");
      expect(t.namingContextTemplate, `${key}`).toContain("{first}");
      expect(t.namingContextTemplate, `${key}`).toContain("{recent}");
      expect(t.conversationSection, `${key}`).toContain("{conversation}");
      expect(t.projectSuffixLines, `${key}`).toContain("{separator}");
      expect(t.projectSuffixLines, `${key}`).toContain("{projectName}");
    }
  });

  it("sizes names by words (like English), not characters", () => {
    for (const [key, windowPhrase, sessionPhrase] of LANGS) {
      const rules = LOCALE_STRINGS[key].naturalRules;
      expect(rules, `${key} window phrase`).toContain(windowPhrase);
      expect(rules, `${key} session phrase`).toContain(sessionPhrase);
    }
  });

  it("naturalRules is newline-joined with exactly 10 lines for each table", () => {
    for (const [key] of LANGS) {
      expect(LOCALE_STRINGS[key].naturalRules.split("\n")).toHaveLength(10);
    }
  });
});

describe("fa / ar / hi / it / nl / th tables (Persian / Arabic / Hindi / Italian / Dutch / Thai)", () => {
  const LA = "fa";
  const WORD_LANGS: [string, string, string][] = [
    ["fa", "2 تا 4 کلمه", "8 تا 12 کلمه"],
    ["ar", "2 إلى 4 كلمات", "8 إلى 12 كلمة"],
    ["hi", "2 से 4 शब्द", "8 से 12 शब्द"],
    ["it", "2-4 parole", "8-12 parole"],
    ["nl", "2-4 woorden", "8-12 woorden"],
  ];

  it("registers all six tables", () => {
    for (const key of ["fa", "ar", "hi", "it", "nl", "th"]) {
      expect(LOCALE_STRINGS[key]).toBeDefined();
    }
  });

  it("keeps the ASCII WINDOW:/SESSION: output labels in responseFormat (parser contract)", () => {
    for (const key of ["fa", "ar", "hi", "it", "nl", "th"]) {
      const t = LOCALE_STRINGS[key];
      expect(t.responseFormat, `${key}.responseFormat`).toContain("WINDOW:");
      expect(t.responseFormat, `${key}.responseFormat`).toContain("SESSION:");
    }
  });

  it("keeps every {placeholder} used by the naming templates", () => {
    for (const key of ["fa", "ar", "hi", "it", "nl", "th"]) {
      const t = LOCALE_STRINGS[key];
      const template = t.topicProjectPromptTemplate;
      expect(template, `${key}`).toContain("{language}");
      expect(template, `${key}`).toContain("{maxChars}");
      expect(template, `${key}`).toContain("{projectLines}");
      expect(template, `${key}`).toContain("{projectLine}");
      expect(template, `${key}`).toContain("{cwd}");
      expect(template, `${key}`).toContain("{firstUserBlock}");
      expect(template, `${key}`).toContain("{firstAssistantBlock}");
      expect(t.namingContextTemplate, `${key}`).toContain("{firstUserMessageLabel}");
      expect(t.namingContextTemplate, `${key}`).toContain("{first}");
      expect(t.namingContextTemplate, `${key}`).toContain("{recent}");
      expect(t.conversationSection, `${key}`).toContain("{conversation}");
      expect(t.projectSuffixLines, `${key}`).toContain("{separator}");
      expect(t.projectSuffixLines, `${key}`).toContain("{projectName}");
    }
  });

  it("sizes Spanish-script word languages by words (fa/ar/hi/it/nl)", () => {
    for (const [key, windowPhrase, sessionPhrase] of WORD_LANGS) {
      const rules = LOCALE_STRINGS[key].naturalRules;
      expect(rules, `${key} window phrase`).toContain(windowPhrase);
      expect(rules, `${key} session phrase`).toContain(sessionPhrase);
    }
  });

  it("sizes Thai by characters (no word boundaries, like CJK)", () => {
    const rules = LOCALE_STRINGS.th.naturalRules;
    expect(rules).toContain("ประมาณ 4-12 ตัวอักษร");
    expect(rules).toContain("ประมาณ 15-40 ตัวอักษร");
  });

  it("naturalRules is newline-joined with exactly 10 lines for each table", () => {
    for (const key of ["fa", "ar", "hi", "it", "nl", "th"]) {
      expect(LOCALE_STRINGS[key].naturalRules.split("\n")).toHaveLength(10);
    }
  });
});
