/**
 * Utility functions for mapping positions between normalized and original text.
 * 
 * The markdown parser normalizes line endings (CRLF -> LF) before parsing.
 * Remark's positions are based on normalized text. VS Code's positionAt()
 * uses the actual document text. These utilities help map between the two.
 */

/**
 * Normalizes any mix of CRLF/CR line endings to LF.
 *
 * @param text - Source text with arbitrary line endings
 * @returns Text normalized to LF-only line endings
 */
export function normalizeToLF(text: string): string {
  return text.includes('\r') ? text.replace(/\r\n|\r/g, '\n') : text;
}

/**
 * Maps a position from normalized text (LF only) to original document text.
 * This accounts for CRLF -> LF normalization done by the parser.
 * 
 * @param normalizedPos - Position in normalized text
 * @param originalText - Original document text (may contain CRLF)
 * @returns Position in original document text
 * 
 * @example
 * ```typescript
 * const normalized = 'Line 1\nLine 2';  // LF only
 * const original = 'Line 1\r\nLine 2';  // CRLF
 * const pos = mapNormalizedToOriginal(6, original); // Returns 6 (at '\r')
 * ```
 */
export function mapNormalizedToOriginal(normalizedPos: number, originalText?: string): number {
  if (!originalText) {
    return normalizedPos;
  }

  // If no CRLF, positions match exactly
  if (!originalText.includes('\r\n')) {
    return normalizedPos;
  }

  // Build a direct character-by-character mapping
  // Walk through original text character by character, tracking normalized index
  // When normalized index reaches target, return the corresponding original position
  // 
  // Key insight: For exclusive end positions, when normalized position points to '\n',
  // we want to map to the '\r' position (not '\n') so that the content range excludes '\r'
  // This ensures [start:end) in normalized maps to [start:end) in original with same content
  let normalizedIndex = 0;

  for (let i = 0; i < originalText.length; i++) {
    // Check for CRLF first
    if (originalText[i] === '\r' && i + 1 < originalText.length && originalText[i + 1] === '\n') {
      // CRLF: '\r' is skipped in normalized, '\n' maps to normalized position
      // If target is at the normalized '\n' position, return '\r' position (i)
      // This ensures exclusive end positions work correctly
      if (normalizedIndex === normalizedPos) {
        // Target points to '\n' in normalized, map to '\r' in original
        return i;
      }
      // Advance normalized index by 1 (for the single '\n' in normalized)
      normalizedIndex++;
      i++; // Skip the '\n' in original
      // Continue to next iteration - don't check here, let the loop handle it
    } else {
      // Regular character: check if this is our target before incrementing
      if (normalizedIndex === normalizedPos) {
        return i;
      }
      normalizedIndex++;
    }
  }

  // If we didn't find it (shouldn't happen), return the last position
  return originalText.length;
}

/**
 * Normalizes heading text to anchor format.
 * 
 * Converts heading text to the format used in markdown anchor links:
 * - Converts to lowercase
 * - Removes non-word characters (except spaces and hyphens)
 * - Replaces spaces with hyphens
 * - Collapses multiple hyphens into single hyphen
 * - Trims leading/trailing whitespace
 * 
 * This matches the GitHub Flavored Markdown (GFM) anchor link generation algorithm.
 * 
 * @param text - The heading text to normalize
 * @returns Normalized anchor text
 * 
 * @example
 * ```typescript
 * normalizeAnchorText('Hello World!') // Returns 'hello-world'
 * normalizeAnchorText('  Test  123  ') // Returns 'test-123'
 * normalizeAnchorText('Multiple---Hyphens') // Returns 'multiple-hyphens'
 * ```
 */
export function normalizeAnchorText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
}
