
/**
 * Surgical character-level diffing utility.
 * Optimized for CJK languages by using LCS (Longest Common Subsequence).
 * Treats [Kanji](reading) as atomic units to prevent breaking furigana.
 */
export function calculateDiff(oldStr: string, newStr: string, language: string = 'English'): string {
  if (!oldStr) return `<add>${newStr || ''}</add>`;
  if (!newStr) return `<rem>${oldStr || ''}</rem>`;

  // Helper to tokenize into characters, keeping Ruby tags [漢](かん) as single tokens
  const tokenize = (text: string) => {
    const tokens: string[] = [];
    let i = 0;
    while (i < text.length) {
      if (text[i] === '[') {
        const match = text.slice(i).match(/^\[.*?\]\(.*?\)/);
        if (match) {
          tokens.push(match[0]);
          i += match[0].length;
          continue;
        }
      }
      tokens.push(text[i]);
      i++;
    }
    return tokens;
  };

  const a = tokenize(oldStr);
  const b = tokenize(newStr);
  const n = a.length;
  const m = b.length;

  // LCS using dynamic programming
  const dp = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));

  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  // Backtracking to find the edit path
  let res: { type: 'add' | 'rem' | 'eq', val: string }[] = [];
  let i = n, j = m;

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && a[i - 1] === b[j - 1]) {
      res.unshift({ type: 'eq', val: a[i - 1] });
      i--; j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      res.unshift({ type: 'add', val: b[j - 1] });
      j--;
    } else {
      res.unshift({ type: 'rem', val: a[i - 1] });
      i--;
    }
  }

  // Formatting and merging consecutive same-type segments
  let finalHtml = '';
  let lastType: 'add' | 'rem' | 'eq' | null = null;
  let buffer = '';

  const flush = () => {
    if (!buffer) return;
    if (lastType === 'add') finalHtml += `<add>${buffer}</add>`;
    else if (lastType === 'rem') finalHtml += `<rem>${buffer}</rem>`;
    else finalHtml += buffer;
    buffer = '';
  };

  for (const token of res) {
    if (token.type !== lastType) {
      flush();
      lastType = token.type;
    }
    buffer += token.val;
  }
  flush();

  // Final cleanup: remove potential empty tags
  return finalHtml.replace(/<(add|rem)><\/\1>/g, '');
}
