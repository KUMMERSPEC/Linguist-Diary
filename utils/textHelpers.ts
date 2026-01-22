

// utils/textHelpers.ts

/**
 * Renders text containing `[Kanji](furigana)` syntax into HTML `<ruby>` tags.
 * This is crucial for displaying Japanese text with furigana correctly in the UI.
 * @param text The input string potentially containing `[Kanji](furigana)` markup.
 * @returns A React fragment or string with HTML `<ruby>` tags.
 */
export const renderRuby = (text: string | null | undefined): string => {
  if (!text) return '';
  // Replace `[Kanji](furigana)` with `<ruby>Kanji<rt>furigana</rt></ruby>`
  return text.replace(/\[(.*?)\]\((.*?)\)/g, '<ruby>$1<rt>$2</rt></ruby>');
};

/**
 * Strips `[Kanji](furigana)` syntax, leaving only the Kanji (or main word).
 * This is useful for sending clean text to APIs like TTS that do not understand ruby markup.
 * @param text The input string potentially containing `[Kanji](furigana)` markup.
 * @returns A string with ruby markup removed.
 */
export const stripRuby = (text: string | null | undefined): string => {
  if (!text) return '';
  return text.replace(/\[(.*?)\]\(.*?\)/g, '$1');
};