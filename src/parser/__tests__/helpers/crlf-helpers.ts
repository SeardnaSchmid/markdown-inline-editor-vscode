import { DecorationRange } from '../../../parser';
import { mapNormalizedToOriginal, normalizeToLF } from '../../../position-mapping';

export { mapNormalizedToOriginal, normalizeToLF };

/**
 * Verifies that a decoration's position in the original text matches expected content.
 * 
 * @param decoration - The decoration to verify
 * @param originalText - Original document text (with CRLF)
 * @param expectedText - Expected text content at decoration position
 * @returns True if decoration text matches expected text
 */
export function verifyDecorationPosition(
  decoration: DecorationRange,
  originalText: string,
  expectedText: string
): boolean {
  // Map normalized positions to original positions
  const originalStart = mapNormalizedToOriginal(decoration.startPos, originalText);
  const originalEnd = mapNormalizedToOriginal(decoration.endPos, originalText);
  
  // Extract actual text at decoration position
  const actualText = originalText.substring(originalStart, originalEnd);
  
  return actualText === expectedText;
}

/**
 * Converts LF text to CRLF text for testing.
 * 
 * @param lfText - Text with LF line endings
 * @returns Text with CRLF line endings
 */
export function createCRLFText(lfText: string): string {
  return lfText.replace(/\n/g, '\r\n');
}

/**
 * Extracts text at a decoration position from original CRLF text.
 * 
 * @param decoration - The decoration range
 * @param originalText - Original document text (with CRLF)
 * @returns The text content at the decoration position
 */
export function extractDecorationText(decoration: DecorationRange, originalText: string): string {
  const originalStart = mapNormalizedToOriginal(decoration.startPos, originalText);
  const originalEnd = mapNormalizedToOriginal(decoration.endPos, originalText);
  return originalText.substring(originalStart, originalEnd);
}
