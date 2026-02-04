
/**
 * A high-performance word-level diffing utility.
 * Specifically optimized for CJK languages and Ruby syntax [Kanji](furigana).
 * Uses a windowed anchor search to avoid O(N^2) performance hits on long texts.
 */
export function calculateDiff(oldStr: string, newStr: string): string {
  if (!oldStr) return `<add>${newStr || ''}</add>`;
  if (!newStr) return `<rem>${oldStr || ''}</rem>`;

  /**
   * Tokenizer rules:
   * 1. Match Ruby patterns [text](ruby) as one token.
   * 2. Match whitespace sequences.
   * 3. Match individual CJK characters (Kanji, Hiragana, Katakana).
   * 4. Match sequences of non-whitespace punctuation/symbols.
   */
  const tokenize = (s: string) => 
    s.split(/(\s+|\[.*?\]\(.*?\)|[\u4e00-\u9fa5\u3040-\u309f\u30a0-\u30ff]|[^\s\w\u4e00-\u9fa5\u3040-\u309f\u30a0-\u30ff]+)/g)
     .filter(Boolean);

  /**
   * Helper to strip Ruby markup to get the base text.
   * e.g., "[家](いえ)" -> "家"
   */
  const getBase = (token: string) => token.replace(/\[(.*?)\]\(.*?\)/g, '$1');

  const oldTokens = tokenize(oldStr);
  const newTokens = tokenize(newStr);

  let i = 0; // Pointer for oldTokens
  let j = 0; // Pointer for newTokens
  let result = '';

  const SEARCH_WINDOW = 20;

  while (i < oldTokens.length || j < newTokens.length) {
    // Case 1: Base words match exactly (e.g., "家" vs "[家](いえ)")
    // We treat this as a MATCH to avoid redundant highlighting.
    // We use the NEW token to ensure furigana is shown, but without tags.
    if (i < oldTokens.length && j < newTokens.length && getBase(oldTokens[i]) === getBase(newTokens[j])) {
      result += newTokens[j];
      i++;
      j++;
    } else {
      // Case 2: Mismatch - search for the next matching anchor point within a window
      let found = false;
      
      for (let oi = 0; oi < SEARCH_WINDOW && i + oi < oldTokens.length; oi++) {
        for (let ni = 0; ni < SEARCH_WINDOW && j + ni < newTokens.length; ni++) {
          // Use getBase for alignment search too
          if (getBase(oldTokens[i + oi]) === getBase(newTokens[j + ni])) {
            if (oi > 0) result += `<rem>${oldTokens.slice(i, i + oi).join('')}</rem>`;
            if (ni > 0) result += `<add>${newTokens.slice(j, j + ni).join('')}</add>`;
            
            i += oi;
            j += ni;
            found = true;
            break;
          }
        }
        if (found) break;
      }

      if (!found) {
        // Case 3: No anchor found. 
        if (i < oldTokens.length && j < newTokens.length) {
          result += `<rem>${oldTokens[i]}</rem><add>${newTokens[j]}</add>`;
          i++;
          j++;
        } else if (i < oldTokens.length) {
          result += `<rem>${oldTokens[i]}</rem>`;
          i++;
        } else if (j < newTokens.length) {
          result += `<add>${newTokens[j]}</add>`;
          j++;
        }
      }
    }
  }

  // Final cleanup: merge consecutive tags and handle empty tags
  return result
    .replace(/<\/add><add>/g, '')
    .replace(/<\/rem><rem>/g, '')
    .replace(/<add><\/add>/g, '')
    .replace(/<rem><\/rem>/g, '');
}
