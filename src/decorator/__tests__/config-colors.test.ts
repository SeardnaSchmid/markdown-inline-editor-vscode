import { workspace } from '../../test/__mocks__/vscode';
import { config } from '../../config';

const mockGet = vi.fn();
const mockGetConfiguration = vi.fn().mockReturnValue({ get: mockGet });

(workspace as any).getConfiguration = mockGetConfiguration;

describe('config.colors', () => {
  beforeEach(() => {
    mockGet.mockReset();
  });

  describe('hex validation', () => {
    it('returns undefined when setting is unset', () => {
      mockGet.mockImplementation((key: string) => {
        if (key.startsWith('colors.')) return undefined;
        return undefined;
      });
      expect(config.colors.heading1()).toBeUndefined();
      expect(config.colors.link()).toBeUndefined();
    });

    it('returns valid 6-digit hex', () => {
      mockGet.mockImplementation((key: string) => {
        if (key === 'colors.heading1') return '#e06c75';
        return undefined;
      });
      expect(config.colors.heading1()).toBe('#e06c75');
    });

    it('returns valid 3-digit hex', () => {
      mockGet.mockImplementation((key: string) => {
        if (key === 'colors.link') return '#f00';
        return undefined;
      });
      expect(config.colors.link()).toBe('#f00');
    });

    it('returns undefined for invalid hex', () => {
      mockGet.mockImplementation((key: string) => {
        if (key === 'colors.heading1') return 'not-a-color';
        return undefined;
      });
      expect(config.colors.heading1()).toBeUndefined();
    });

    it('returns undefined for malformed hex (no #)', () => {
      mockGet.mockImplementation((key: string) => {
        if (key === 'colors.heading1') return 'e06c75';
        return undefined;
      });
      expect(config.colors.heading1()).toBeUndefined();
    });

    it('returns undefined for empty string', () => {
      mockGet.mockImplementation((key: string) => {
        if (key === 'colors.heading1') return '';
        return undefined;
      });
      expect(config.colors.heading1()).toBeUndefined();
    });

    it('trims whitespace and accepts valid hex', () => {
      mockGet.mockImplementation((key: string) => {
        if (key === 'colors.heading1') return '  #e06c75  ';
        return undefined;
      });
      expect(config.colors.heading1()).toBe('#e06c75');
    });

    it('returns valid 8-digit hex (with alpha)', () => {
      mockGet.mockImplementation((key: string) => {
        if (key === 'colors.heading1') return '#e06c75ff';
        return undefined;
      });
      expect(config.colors.heading1()).toBe('#e06c75ff');
    });

    it('returns valid 4-digit hex (with alpha)', () => {
      mockGet.mockImplementation((key: string) => {
        if (key === 'colors.link') return '#f00a';
        return undefined;
      });
      expect(config.colors.link()).toBe('#f00a');
    });

    it('returns lowercase hex as-is', () => {
      mockGet.mockImplementation((key: string) => {
        if (key === 'colors.heading1') return '#abcdef';
        return undefined;
      });
      expect(config.colors.heading1()).toBe('#abcdef');
    });

    it('returns uppercase hex as-is', () => {
      mockGet.mockImplementation((key: string) => {
        if (key === 'colors.heading1') return '#ABCDEF';
        return undefined;
      });
      expect(config.colors.heading1()).toBe('#ABCDEF');
    });

    it('returns mixed case hex as-is', () => {
      mockGet.mockImplementation((key: string) => {
        if (key === 'colors.heading1') return '#AbCdEf';
        return undefined;
      });
      expect(config.colors.heading1()).toBe('#AbCdEf');
    });

    it('returns undefined for invalid 3-digit hex (non-hex chars)', () => {
      mockGet.mockImplementation((key: string) => {
        if (key === 'colors.heading1') return '#xyz';
        return undefined;
      });
      expect(config.colors.heading1()).toBeUndefined();
    });

    it('returns undefined for invalid 6-digit hex (non-hex chars)', () => {
      mockGet.mockImplementation((key: string) => {
        if (key === 'colors.heading1') return '#gggggg';
        return undefined;
      });
      expect(config.colors.heading1()).toBeUndefined();
    });

    it('returns undefined for too few digits', () => {
      mockGet.mockImplementation((key: string) => {
        if (key === 'colors.heading1') return '#ff';
        return undefined;
      });
      expect(config.colors.heading1()).toBeUndefined();
    });

    it('returns undefined for too many digits', () => {
      mockGet.mockImplementation((key: string) => {
        if (key === 'colors.heading1') return '#aabbccddee';
        return undefined;
      });
      expect(config.colors.heading1()).toBeUndefined();
    });

    it('returns undefined for null value', () => {
      mockGet.mockImplementation((key: string) => {
        if (key === 'colors.heading1') return null;
        return undefined;
      });
      expect(config.colors.heading1()).toBeUndefined();
    });

    it('returns undefined for whitespace-only string', () => {
      mockGet.mockImplementation((key: string) => {
        if (key === 'colors.heading1') return '   ';
        return undefined;
      });
      expect(config.colors.heading1()).toBeUndefined();
    });

    it('handles inlineCodeBackground config', () => {
      mockGet.mockImplementation((key: string) => {
        if (key === 'colors.inlineCodeBackground') return '#f0f0f0';
        return undefined;
      });
      expect(config.colors.inlineCodeBackground()).toBe('#f0f0f0');
    });

    it('inlineCodeBackground returns undefined for invalid hex', () => {
      mockGet.mockImplementation((key: string) => {
        if (key === 'colors.inlineCodeBackground') return 'invalid';
        return undefined;
      });
      expect(config.colors.inlineCodeBackground()).toBeUndefined();
    });
  });

  describe('all 15 color getters', () => {
    const keys = [
      'heading1', 'heading2', 'heading3', 'heading4', 'heading5', 'heading6',
      'link', 'listMarker', 'inlineCode', 'inlineCodeBackground', 'emphasis', 'blockquote',
      'image', 'horizontalRule', 'checkbox',
    ] as const;

    it('each getter reads correct config key', () => {
      keys.forEach((key, i) => {
        mockGet.mockImplementation((configKey: string) => {
          return configKey === `colors.${key}` ? '#abc' : undefined;
        });
        const getter = config.colors[key];
        expect(getter()).toBe('#abc');
      });
    });
  });
});
