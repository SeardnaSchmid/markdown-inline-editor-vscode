/**
 * Unicode display-width estimation, in monospace columns.
 *
 * Used to decide how much horizontal space a table column needs. Column
 * *alignment* is enforced by the fixed-width box the decorator draws (see
 * `TableCellDecorationType`), so a width that is slightly too large only makes
 * a column airier — it can no longer push the grid out of alignment. That makes
 * over-estimation the safe direction, which is why unresolvable cases below
 * (emoji ZWJ sequences in particular) deliberately round up.
 *
 * Widths follow Unicode Annex #11 East Asian Width: `W` (Wide) and `F`
 * (Fullwidth) count as 2 columns, everything else as 1, and characters with no
 * advance of their own (combining marks, joiners, variation selectors) as 0.
 */

/**
 * Codepoint ranges, inclusive, that occupy two monospace columns.
 *
 * Must stay sorted and non-overlapping — {@link charWidth} binary-searches it.
 * Exported so tests can assert that invariant directly.
 */
export const WIDE_RANGES: ReadonlyArray<readonly [number, number]> = [
  [0x1100, 0x115f], // Hangul Jamo initial consonants
  [0x231a, 0x231b], // ⌚⌛
  [0x2329, 0x232a], // 〈〉
  [0x23e9, 0x23ec],
  [0x23f0, 0x23f0],
  [0x23f3, 0x23f3],
  [0x25fd, 0x25fe],
  [0x2614, 0x2615],
  [0x2648, 0x2653],
  [0x267f, 0x267f],
  [0x2693, 0x2693],
  [0x26a1, 0x26a1],
  [0x26aa, 0x26ab],
  [0x26bd, 0x26be],
  [0x26c4, 0x26c5],
  [0x26ce, 0x26ce],
  [0x26d4, 0x26d4],
  [0x26ea, 0x26ea],
  [0x26f2, 0x26f3],
  [0x26f5, 0x26f5],
  [0x26fa, 0x26fa],
  [0x26fd, 0x26fd],
  [0x2705, 0x2705], // ✅
  [0x270a, 0x270b],
  [0x2728, 0x2728],
  [0x274c, 0x274c],
  [0x274e, 0x274e],
  [0x2753, 0x2755],
  [0x2757, 0x2757],
  [0x2795, 0x2797],
  [0x27b0, 0x27b0],
  [0x27bf, 0x27bf],
  [0x2b1b, 0x2b1c],
  [0x2b50, 0x2b50],
  [0x2b55, 0x2b55],
  [0x2e80, 0x2e99], // CJK Radicals Supplement
  [0x2e9b, 0x2ef3],
  [0x2f00, 0x2fd5], // Kangxi Radicals
  [0x2ff0, 0x2ffb], // Ideographic Description Characters
  [0x3000, 0x303e], // CJK Symbols and Punctuation (incl. ideographic space)
  [0x3041, 0x3096], // Hiragana
  [0x3099, 0x30ff], // Katakana
  [0x3105, 0x312f], // Bopomofo
  [0x3131, 0x318e], // Hangul Compatibility Jamo
  [0x3190, 0x31e3],
  [0x31f0, 0x321e],
  [0x3220, 0x3247],
  [0x3250, 0x4dbf], // Enclosed CJK .. CJK Ext A
  [0x4e00, 0xa48c], // CJK Unified Ideographs .. Yi Syllables
  [0xa490, 0xa4c6], // Yi Radicals
  [0xa960, 0xa97c], // Hangul Jamo Extended-A
  [0xac00, 0xd7a3], // Hangul Syllables
  [0xf900, 0xfaff], // CJK Compatibility Ideographs
  [0xfe10, 0xfe19], // Vertical Forms
  [0xfe30, 0xfe52], // CJK Compatibility Forms
  [0xfe54, 0xfe66],
  [0xfe68, 0xfe6b],
  [0xff01, 0xff60], // Fullwidth Forms
  [0xffe0, 0xffe6], // Fullwidth Signs
  [0x16fe0, 0x16fe4],
  [0x16ff0, 0x16ff1],
  [0x17000, 0x187f7], // Tangut
  [0x18800, 0x18cd5],
  [0x18d00, 0x18d08],
  [0x1aff0, 0x1affe],
  [0x1b000, 0x1b152], // Kana Supplement
  [0x1b164, 0x1b167],
  [0x1b170, 0x1b2fb], // Nushu
  [0x1f004, 0x1f004],
  [0x1f0cf, 0x1f0cf],
  [0x1f18e, 0x1f18e],
  [0x1f191, 0x1f19a],
  [0x1f200, 0x1f320],
  [0x1f32d, 0x1f335],
  [0x1f337, 0x1f37c],
  [0x1f37e, 0x1f393],
  [0x1f3a0, 0x1f3ca],
  [0x1f3cf, 0x1f3d3],
  [0x1f3e0, 0x1f3f0],
  [0x1f3f4, 0x1f3f4],
  [0x1f3f8, 0x1f43e],
  [0x1f440, 0x1f440],
  [0x1f442, 0x1f4fc],
  [0x1f4ff, 0x1f53d],
  [0x1f54b, 0x1f54e],
  [0x1f550, 0x1f567],
  [0x1f57a, 0x1f57a],
  [0x1f595, 0x1f596],
  [0x1f5a4, 0x1f5a4],
  [0x1f5fb, 0x1f64f],
  [0x1f680, 0x1f6c5],
  [0x1f6cc, 0x1f6cc],
  [0x1f6d0, 0x1f6d2],
  [0x1f6d5, 0x1f6d7],
  [0x1f6dd, 0x1f6df],
  [0x1f6eb, 0x1f6ec],
  [0x1f6f4, 0x1f6fc],
  [0x1f7e0, 0x1f7eb],
  [0x1f7f0, 0x1f7f0],
  [0x1f90c, 0x1f93a],
  [0x1f93c, 0x1f945],
  [0x1f947, 0x1f9ff],
  [0x1fa70, 0x1fa74],
  [0x1fa78, 0x1fa7c],
  [0x1fa80, 0x1fa86],
  [0x1fa90, 0x1faac],
  [0x1fab0, 0x1faba],
  [0x1fac0, 0x1fac5],
  [0x1fad0, 0x1fad9],
  [0x1fae0, 0x1fae7],
  [0x1faf0, 0x1faf6],
  [0x20000, 0x2fffd], // CJK Ext B and beyond
  [0x30000, 0x3fffd],
];

/**
 * Codepoint ranges, inclusive, that render without advancing the cursor.
 *
 * Same sorted, non-overlapping requirement as {@link WIDE_RANGES}. Checked
 * before it, so entries here win for codepoints listed in both (skin-tone
 * modifiers, for instance).
 */
export const ZERO_WIDTH_RANGES: ReadonlyArray<readonly [number, number]> = [
  [0x0000, 0x001f], // C0 controls
  [0x007f, 0x009f], // DEL + C1 controls
  [0x0300, 0x036f], // Combining Diacritical Marks
  [0x0483, 0x0489],
  [0x0591, 0x05bd],
  [0x05bf, 0x05bf],
  [0x05c1, 0x05c2],
  [0x05c4, 0x05c5],
  [0x05c7, 0x05c7],
  [0x0610, 0x061a],
  [0x064b, 0x065f],
  [0x0670, 0x0670],
  [0x06d6, 0x06dc],
  [0x06df, 0x06e4],
  [0x06e7, 0x06e8],
  [0x06ea, 0x06ed],
  [0x0711, 0x0711],
  [0x0730, 0x074a],
  [0x07a6, 0x07b0],
  [0x07eb, 0x07f3],
  [0x0816, 0x0819],
  [0x081b, 0x0823],
  [0x0825, 0x0827],
  [0x0829, 0x082d],
  [0x0e31, 0x0e31],
  [0x0e34, 0x0e3a],
  [0x0e47, 0x0e4e],
  [0x1ab0, 0x1aff], // Combining Diacritical Marks Extended
  [0x1dc0, 0x1dff], // Combining Diacritical Marks Supplement
  [0x200b, 0x200f], // ZWSP, ZWNJ, ZWJ, LRM, RLM
  [0x202a, 0x202e], // Bidi embedding controls
  [0x2060, 0x2064], // Word joiner and invisible operators
  [0x20d0, 0x20f0], // Combining Diacritical Marks for Symbols
  [0xfe00, 0xfe0f], // Variation Selectors 1-16
  [0xfe20, 0xfe2f], // Combining Half Marks
  [0xfeff, 0xfeff], // BOM / ZWNBSP
  [0x1f3fb, 0x1f3ff], // Emoji skin-tone modifiers (attach to a base emoji)
  [0xe0100, 0xe01ef], // Variation Selectors Supplement
];

/** Emoji presentation selector — promotes a text-default char to a wide emoji. */
const VARIATION_SELECTOR_16 = 0xfe0f;
/** Zero-width joiner — glues emoji into a single glyph (👨‍👩‍👧). */
const ZERO_WIDTH_JOINER = 0x200d;
const REGIONAL_INDICATOR_START = 0x1f1e6;
const REGIONAL_INDICATOR_END = 0x1f1ff;

function inRanges(
  codePoint: number,
  ranges: ReadonlyArray<readonly [number, number]>,
): boolean {
  let low = 0;
  let high = ranges.length - 1;
  while (low <= high) {
    const mid = (low + high) >> 1;
    const [start, end] = ranges[mid];
    if (codePoint < start) {
      high = mid - 1;
    } else if (codePoint > end) {
      low = mid + 1;
    } else {
      return true;
    }
  }
  return false;
}

/**
 * Display width of a single codepoint, ignoring any surrounding sequence.
 *
 * Callers that need sequence-aware behaviour (emoji variation selectors,
 * flags, ZWJ) should use {@link measureTextWidth} instead.
 */
export function charWidth(codePoint: number): 0 | 1 | 2 {
  if (inRanges(codePoint, ZERO_WIDTH_RANGES)) return 0;
  if (inRanges(codePoint, WIDE_RANGES)) return 2;
  return 1;
}

/**
 * Estimates how many monospace columns `text` occupies when rendered.
 *
 * Sequence handling beyond per-codepoint width:
 * - `X + U+FE0F` renders as a wide emoji even when `X` alone is narrow (❤️).
 * - A regional-indicator pair renders as one wide flag glyph (🇨🇳).
 * - ZWJ sequences (👨‍👩‍👧) collapse to a single glyph in fonts that support
 *   them, but that support is not knowable here, so each joined component keeps
 *   its own width. This over-estimates, which is the safe direction.
 */
export function measureTextWidth(text: string): number {
  const codePoints = [...text].map((char) => char.codePointAt(0)!);
  let width = 0;

  for (let i = 0; i < codePoints.length; i++) {
    const codePoint = codePoints[i];

    if (
      codePoint >= REGIONAL_INDICATOR_START &&
      codePoint <= REGIONAL_INDICATOR_END &&
      i + 1 < codePoints.length &&
      codePoints[i + 1] >= REGIONAL_INDICATOR_START &&
      codePoints[i + 1] <= REGIONAL_INDICATOR_END
    ) {
      width += 2;
      i++;
      continue;
    }

    if (codePoint === ZERO_WIDTH_JOINER) {
      continue;
    }

    if (codePoints[i + 1] === VARIATION_SELECTOR_16) {
      width += 2;
      i++;
      continue;
    }

    width += charWidth(codePoint);
  }

  return width;
}
