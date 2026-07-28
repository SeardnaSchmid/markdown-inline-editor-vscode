import { workspace } from '../../test/__mocks__/vscode';
import { config } from '../../config';

const mockGet = vi.fn();
const mockGetConfiguration = vi.fn().mockReturnValue({ get: mockGet });

(workspace as any).getConfiguration = mockGetConfiguration;

/** Makes the mocked configuration return `value` for `key` and the default for everything else. */
function stub(key: string, value: unknown) {
  mockGet.mockImplementation((requested: string, defaultValue: unknown) =>
    requested === key ? value : defaultValue
  );
}

describe('config.tables', () => {
  beforeEach(() => {
    mockGet.mockReset();
    mockGet.mockImplementation((_key: string, defaultValue: unknown) => defaultValue);
  });

  describe('style', () => {
    it('defaults to grid', () => {
      expect(config.tables.style()).toBe('grid');
    });

    it('returns preview when configured', () => {
      stub('tables.style', 'preview');
      expect(config.tables.style()).toBe('preview');
    });

    it('falls back to grid for an unknown value', () => {
      stub('tables.style', 'nonsense');
      expect(config.tables.style()).toBe('grid');
    });
  });

  describe('cjkWidthRatio', () => {
    it('defaults to 2', () => {
      expect(config.tables.cjkWidthRatio()).toBe(2);
    });

    it('accepts a fractional ratio', () => {
      stub('tables.cjkWidthRatio', 1.8);
      expect(config.tables.cjkWidthRatio()).toBe(1.8);
    });

    it('clamps out-of-range values', () => {
      stub('tables.cjkWidthRatio', 0.1);
      expect(config.tables.cjkWidthRatio()).toBe(1);
      stub('tables.cjkWidthRatio', 99);
      expect(config.tables.cjkWidthRatio()).toBe(3);
    });

    it('falls back to 2 for a non-numeric value', () => {
      stub('tables.cjkWidthRatio', 'wide');
      expect(config.tables.cjkWidthRatio()).toBe(2);
    });
  });

  describe('maxColumnWidth', () => {
    it('defaults to 48', () => {
      expect(config.tables.maxColumnWidth()).toBe(48);
    });

    it('clamps and floors the configured value', () => {
      stub('tables.maxColumnWidth', 20.7);
      expect(config.tables.maxColumnWidth()).toBe(20);
      stub('tables.maxColumnWidth', 1);
      expect(config.tables.maxColumnWidth()).toBe(3);
      stub('tables.maxColumnWidth', 5000);
      expect(config.tables.maxColumnWidth()).toBe(200);
    });
  });

  describe('rowSeparators', () => {
    it('defaults to true', () => {
      expect(config.tables.rowSeparators()).toBe(true);
    });

    it('returns false when disabled', () => {
      stub('tables.rowSeparators', false);
      expect(config.tables.rowSeparators()).toBe(false);
    });
  });
});
