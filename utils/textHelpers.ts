
import { ReadingPair } from '../types';

/**
 * Renders text containing `[Kanji](furigana)` syntax into HTML `<ruby>` tags.
 */
export const renderRuby = (text: string | null | undefined): string => {
  if (!text) return '';
  return text.replace(/\[(.*?)\]\((.*?)\)/g, '<ruby>$1<rt>$2</rt></ruby>');
};

/**
 * Strips `[Kanji](furigana)` syntax.
 */
export const stripRuby = (text: string | null | undefined): string => {
  if (!text) return '';
  return text.replace(/\[(.*?)\]\(.*?\)/g, '$1');
};

/**
 * Helper to check if a character is Japanese Kana (Hiragana or Katakana).
 */
const isKana = (char: string): boolean => {
  return /[\u3040-\u309f\u30a0-\u30ff]/.test(char);
};

/**
 * Dynamically weaves furigana into a text based on a reading map.
 * Returns the format [Kanji](Reading) suitable for later rendering or storage.
 */
export const weaveRubyMarkdown = (text: string, readingPairs?: ReadingPair[], language: string = 'Japanese'): string => {
  if (!readingPairs || readingPairs.length === 0 || language !== 'Japanese') {
    return text;
  }

  const readingMap: Record<string, string> = {};
  readingPairs.forEach(pair => {
    readingMap[pair.kanji] = pair.reading;
  });

  if (!(Intl as any).Segmenter) return text;

  const segmenter = new (Intl as any).Segmenter('ja', { granularity: 'word' });
  const segments = segmenter.segment(text);
  let result = '';

  for (const { segment } of segments) {
    const reading = readingMap[segment];
    if (reading && segment !== reading) {
      let i = segment.length - 1;
      let j = reading.length - 1;
      
      while (i >= 0 && j >= 0 && segment[i] === reading[j] && isKana(segment[i])) {
        i--;
        j--;
      }
      
      const kanjiPart = segment.substring(0, i + 1);
      const readingPart = reading.substring(0, j + 1);
      const suffix = segment.substring(i + 1);

      if (kanjiPart === "") {
        result += segment;
      } else {
        result += `[${kanjiPart}](${readingPart})${suffix}`;
      }
    } else {
      result += segment;
    }
  }
  return result;
};

/**
 * Dynamically weaves furigana into a text based on a reading map into HTML.
 */
export const weaveRuby = (text: string, readingPairs?: ReadingPair[], language: string = 'Japanese'): string => {
  const markdown = weaveRubyMarkdown(text, readingPairs, language);
  return renderRuby(markdown);
};
