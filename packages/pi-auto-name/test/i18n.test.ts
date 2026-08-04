import { describe, it, expect } from "vitest";
import { normalizeLanguageTag, fill, buildLocale } from "../src/i18n.js";
import { LOCALE_STRINGS } from "../src/locales.js";

describe("normalizeLanguageTag", () => {
  it("lowercases a plain tag", () => {
    expect(normalizeLanguageTag("en")).toBe("en");
    expect(normalizeLanguageTag("EN")).toBe("en");
  });

  it("lowercases multi-subtag tags", () => {
    expect(normalizeLanguageTag("zh-CN")).toBe("zh-cn");
    expect(normalizeLanguageTag("pt-BR")).toBe("pt-br");
    expect(normalizeLanguageTag("zh-Hant")).toBe("zh-hant");
    expect(normalizeLanguageTag("zh-Hans")).toBe("zh-hans");
    expect(normalizeLanguageTag("ko-KR")).toBe("ko-kr");
    expect(normalizeLanguageTag("ja-JP")).toBe("ja-jp");
  });

  it("accepts 3-letter primary languages", () => {
    expect(normalizeLanguageTag("fil")).toBe("fil");
  });

  it("accepts digit subtags", () => {
    expect(normalizeLanguageTag("zh-hans-cn")).toBe("zh-hans-cn");
  });

  it("rejects natural-language names", () => {
    expect(normalizeLanguageTag("English")).toBe("en");
    expect(normalizeLanguageTag("Simplified Chinese")).toBe("en");
  });

  it("rejects single letters", () => {
    expect(normalizeLanguageTag("e")).toBe("en");
  });

  it("rejects underscores", () => {
    expect(normalizeLanguageTag("en_US")).toBe("en");
  });

  it("rejects empty and whitespace values", () => {
    expect(normalizeLanguageTag("")).toBe("en");
    expect(normalizeLanguageTag("   ")).toBe("en");
  });
});

describe("fill", () => {
  it("replaces known {name} placeholders with string values", () => {
    expect(fill("Hello {name}", { name: "World" })).toBe("Hello World");
  });

  it("replaces known {name} placeholders with number values", () => {
    expect(fill("max {maxLength}", { maxLength: 200 })).toBe("max 200");
  });

  it("leaves unknown placeholders intact", () => {
    expect(fill("Hi {missing}", { name: "x" })).toBe("Hi {missing}");
  });

  it("replaces multiple placeholders in one template", () => {
    expect(fill("{a}-{b}-{a}", { a: "1", b: "2" })).toBe("1-2-1");
  });

  it("inserts values verbatim (no escaping)", () => {
    expect(fill("v={value}", { value: "a {b} c" })).toBe("v=a {b} c");
  });
});

describe("buildLocale", () => {
  it("returns the English table for 'en'", () => {
    expect(buildLocale("en")).toBe(LOCALE_STRINGS.en);
  });

  it("returns English for an invalid tag", () => {
    expect(buildLocale("English")).toBe(LOCALE_STRINGS.en);
    expect(buildLocale("")).toBe(LOCALE_STRINGS.en);
  });

  it("returns English scaffolding for a valid tag without a built-in table", () => {
    expect(buildLocale("sv")).toBe(LOCALE_STRINGS.en);
  });

  it("resolves Simplified Chinese to the zh table", () => {
    expect(buildLocale("zh")).toBe(LOCALE_STRINGS.zh);
    expect(buildLocale("zh-CN")).toBe(LOCALE_STRINGS.zh);
    expect(buildLocale("zh-Hans")).toBe(LOCALE_STRINGS.zh);
    expect(buildLocale("zh-SG")).toBe(LOCALE_STRINGS.zh);
  });

  it("resolves Traditional Chinese to the zh-hant table", () => {
    expect(buildLocale("zh-hant")).toBe(LOCALE_STRINGS["zh-hant"]);
    expect(buildLocale("zh-Hant")).toBe(LOCALE_STRINGS["zh-hant"]);
    expect(buildLocale("zh-TW")).toBe(LOCALE_STRINGS["zh-hant"]);
    expect(buildLocale("zh-HK")).toBe(LOCALE_STRINGS["zh-hant"]);
    expect(buildLocale("zh-MO")).toBe(LOCALE_STRINGS["zh-hant"]);
  });

  it("resolves Japanese and Korean to their tables", () => {
    expect(buildLocale("ja")).toBe(LOCALE_STRINGS.ja);
    expect(buildLocale("ja-JP")).toBe(LOCALE_STRINGS.ja);
    expect(buildLocale("ko")).toBe(LOCALE_STRINGS.ko);
    expect(buildLocale("ko-KR")).toBe(LOCALE_STRINGS.ko);
  });

  it("resolves Brazilian Portuguese to the pt-br table", () => {
    expect(buildLocale("pt")).toBe(LOCALE_STRINGS["pt-br"]);
    expect(buildLocale("pt-BR")).toBe(LOCALE_STRINGS["pt-br"]);
    expect(buildLocale("pt-br")).toBe(LOCALE_STRINGS["pt-br"]);
  });

  it("falls other Portuguese variants back to the pt-br table", () => {
    expect(buildLocale("pt-PT")).toBe(LOCALE_STRINGS["pt-br"]);
    expect(buildLocale("pt-MO")).toBe(LOCALE_STRINGS["pt-br"]);
    expect(buildLocale("pt-AO")).toBe(LOCALE_STRINGS["pt-br"]);
  });

  it("resolves Spanish to the es table", () => {
    expect(buildLocale("es")).toBe(LOCALE_STRINGS.es);
    expect(buildLocale("es-ES")).toBe(LOCALE_STRINGS.es);
    expect(buildLocale("es-MX")).toBe(LOCALE_STRINGS.es);
  });

  it("resolves German to the de table", () => {
    expect(buildLocale("de")).toBe(LOCALE_STRINGS.de);
    expect(buildLocale("de-DE")).toBe(LOCALE_STRINGS.de);
    expect(buildLocale("de-AT")).toBe(LOCALE_STRINGS.de);
  });

  it("resolves French to the fr table", () => {
    expect(buildLocale("fr")).toBe(LOCALE_STRINGS.fr);
    expect(buildLocale("fr-FR")).toBe(LOCALE_STRINGS.fr);
    expect(buildLocale("fr-CA")).toBe(LOCALE_STRINGS.fr);
  });

  it("resolves Indonesian to the id table", () => {
    expect(buildLocale("id")).toBe(LOCALE_STRINGS.id);
    expect(buildLocale("id-ID")).toBe(LOCALE_STRINGS.id);
  });

  it("resolves Vietnamese to the vi table", () => {
    expect(buildLocale("vi")).toBe(LOCALE_STRINGS.vi);
    expect(buildLocale("vi-VN")).toBe(LOCALE_STRINGS.vi);
  });

  it("resolves Turkish to the tr table", () => {
    expect(buildLocale("tr")).toBe(LOCALE_STRINGS.tr);
    expect(buildLocale("tr-TR")).toBe(LOCALE_STRINGS.tr);
  });

  it("resolves Polish to the pl table", () => {
    expect(buildLocale("pl")).toBe(LOCALE_STRINGS.pl);
    expect(buildLocale("pl-PL")).toBe(LOCALE_STRINGS.pl);
  });

  it("resolves Ukrainian to the uk table", () => {
    expect(buildLocale("uk")).toBe(LOCALE_STRINGS.uk);
    expect(buildLocale("uk-UA")).toBe(LOCALE_STRINGS.uk);
  });

  it("resolves Persian to the fa table", () => {
    expect(buildLocale("fa")).toBe(LOCALE_STRINGS.fa);
    expect(buildLocale("fa-IR")).toBe(LOCALE_STRINGS.fa);
  });

  it("resolves Arabic to the ar table", () => {
    expect(buildLocale("ar")).toBe(LOCALE_STRINGS.ar);
    expect(buildLocale("ar-SA")).toBe(LOCALE_STRINGS.ar);
  });

  it("resolves Hindi to the hi table", () => {
    expect(buildLocale("hi")).toBe(LOCALE_STRINGS.hi);
    expect(buildLocale("hi-IN")).toBe(LOCALE_STRINGS.hi);
  });

  it("resolves Italian to the it table", () => {
    expect(buildLocale("it")).toBe(LOCALE_STRINGS.it);
    expect(buildLocale("it-IT")).toBe(LOCALE_STRINGS.it);
  });

  it("resolves Dutch to the nl table", () => {
    expect(buildLocale("nl")).toBe(LOCALE_STRINGS.nl);
    expect(buildLocale("nl-NL")).toBe(LOCALE_STRINGS.nl);
  });

  it("resolves Thai to the th table", () => {
    expect(buildLocale("th")).toBe(LOCALE_STRINGS.th);
    expect(buildLocale("th-TH")).toBe(LOCALE_STRINGS.th);
  });
});
