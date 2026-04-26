import { mapNormalizedToOriginal, normalizeAnchorText, normalizeToLF } from '../../position-mapping';

describe('mapNormalizedToOriginal', () => {
  describe('LF-only documents (no CRLF)', () => {
    it('returns the same position when no CRLF present', () => {
      const text = 'Hello\nWorld';
      expect(mapNormalizedToOriginal(0, text)).toBe(0);
      expect(mapNormalizedToOriginal(5, text)).toBe(5);
      expect(mapNormalizedToOriginal(6, text)).toBe(6);
    });

    it('returns normalizedPos when originalText is undefined', () => {
      expect(mapNormalizedToOriginal(7, undefined)).toBe(7);
    });
  });

  describe('CRLF documents', () => {
    // "AB\r\nCD" — normalized: "AB\nCD" (len=5), original: "AB\r\nCD" (len=6)
    // Normalized:  A=0  B=1  \n=2  C=3  D=4
    // Original:    A=0  B=1  \r=2  \n=3  C=4  D=5

    it('maps positions before the CRLF correctly', () => {
      const original = 'AB\r\nCD';
      expect(mapNormalizedToOriginal(0, original)).toBe(0); // A
      expect(mapNormalizedToOriginal(1, original)).toBe(1); // B
    });

    it('maps the normalized \\n position to the \\r position in the original', () => {
      // Exclusive end position pointing at \n in normalized → should land at \r in original
      const original = 'AB\r\nCD';
      expect(mapNormalizedToOriginal(2, original)).toBe(2); // \r
    });

    it('maps positions after the CRLF with correct +1 offset per CRLF', () => {
      const original = 'AB\r\nCD';
      expect(mapNormalizedToOriginal(3, original)).toBe(4); // C
      expect(mapNormalizedToOriginal(4, original)).toBe(5); // D
    });

    it('handles multiple CRLF sequences', () => {
      // "A\r\nB\r\nC" — normalized "A\nB\nC"
      // Norm: A=0 \n=1 B=2 \n=3 C=4
      // Orig: A=0 \r=1 \n=2 B=3 \r=4 \n=5 C=6
      const original = 'A\r\nB\r\nC';
      expect(mapNormalizedToOriginal(0, original)).toBe(0); // A
      expect(mapNormalizedToOriginal(1, original)).toBe(1); // \r (exclusive end before \n)
      expect(mapNormalizedToOriginal(2, original)).toBe(3); // B
      expect(mapNormalizedToOriginal(3, original)).toBe(4); // \r (second CRLF)
      expect(mapNormalizedToOriginal(4, original)).toBe(6); // C
    });

    it('returns originalText.length for out-of-range position', () => {
      const original = 'A\r\nB';
      expect(mapNormalizedToOriginal(99, original)).toBe(original.length);
    });
  });
});

describe('normalizeAnchorText', () => {
  it('lowercases the text', () => {
    expect(normalizeAnchorText('Hello World')).toBe('hello-world');
  });

  it('replaces spaces with hyphens', () => {
    expect(normalizeAnchorText('foo bar baz')).toBe('foo-bar-baz');
  });

  it('removes special characters', () => {
    expect(normalizeAnchorText('Hello, World!')).toBe('hello-world');
    expect(normalizeAnchorText('What is this?')).toBe('what-is-this');
  });

  it('collapses multiple hyphens into one', () => {
    expect(normalizeAnchorText('Multiple---Hyphens')).toBe('multiple-hyphens');
    expect(normalizeAnchorText('a  b')).toBe('a-b'); // spaces → hyphens → collapsed
  });

  it('converts leading/trailing spaces to hyphens (spaces are replaced before trim)', () => {
    // Spaces are first replaced with hyphens, then trim() removes only whitespace — not hyphens.
    // So '  test  ' → '-test-' (spaces at edges become hyphens, trim has nothing to remove).
    expect(normalizeAnchorText('  test  ')).toBe('-test-');
  });

  it('handles numbers', () => {
    expect(normalizeAnchorText('Section 1.2.3')).toBe('section-123');
  });

  it('preserves existing hyphens', () => {
    expect(normalizeAnchorText('my-heading')).toBe('my-heading');
  });

  it('handles an already-normalized string unchanged', () => {
    expect(normalizeAnchorText('introduction')).toBe('introduction');
  });

  it('handles empty string', () => {
    expect(normalizeAnchorText('')).toBe('');
  });
});

describe('normalizeToLF', () => {
  it('normalizes CRLF and CR line endings to LF', () => {
    expect(normalizeToLF('a\r\nb\rc')).toBe('a\nb\nc');
  });

  it('returns the same text when no CR characters are present', () => {
    expect(normalizeToLF('a\nb\nc')).toBe('a\nb\nc');
  });
});
