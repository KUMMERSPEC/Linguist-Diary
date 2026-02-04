
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
 * Dynamically weaves furigana into a text based on a reading map.
 */
export const weaveRuby = (text: string, readingPairs?: ReadingPair[], language: string = 'Japanese'): string => {
  if (!readingPairs || readingPairs.length === 0 || language !== 'Japanese') {
    return text;
  }

  // Convert array to map for O(1) lookups
  const readingMap: Record<string, string> = {};
  readingPairs.forEach(pair => {
    readingMap[pair.kanji] = pair.reading;
  });

  // Use native Intl.Segmenter if available
  if (!(Intl as any).Segmenter) return text;

  const segmenter = new (Intl as any).Segmenter('ja', { granularity: 'word' });
  const segments = segmenter.segment(text);
  let result = '';

  for (const { segment } of segments) {
    if (readingMap[segment]) {
      result += `<ruby>${segment}<rt>${readingMap[segment]}</rt></ruby>`;
    } else {
      result += segment;
    }
  }
  return result;
};
