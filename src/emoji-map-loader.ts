// Re-exports lazy access to the emoji map. The map is a large static table; the parser
// only calls getEmojiMap() when processing emoji shortcodes.

import { emojiByShortcode } from './emoji-map';

/**
 * Returns the emoji shortcode → glyph map.
 * Kept as a function so call sites stay stable; data is loaded with this module.
 */
export function getEmojiMap(): Record<string, string> {
  return emojiByShortcode;
}
