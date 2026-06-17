import { workspace } from '../../test/__mocks__/vscode';
import { config } from '../../config';

const mockGet = vi.fn();
const mockGetConfiguration = vi.fn().mockReturnValue({ get: mockGet });

(workspace as any).getConfiguration = mockGetConfiguration;

describe('config.tables.cjkWidthRatio', () => {
  beforeEach(() => {
    mockGet.mockReset();
  });

  it('defaults to 2.25 when unset', () => {
    mockGet.mockImplementation((key: string, defaultValue?: unknown) => {
      if (key === 'tables.cjkWidthRatio') return defaultValue;
      return undefined;
    });
    expect(config.tables.cjkWidthRatio()).toBe(2.25);
  });

  it('returns configured numeric value', () => {
    mockGet.mockImplementation((key: string) => {
      if (key === 'tables.cjkWidthRatio') return 2;
      return undefined;
    });
    expect(config.tables.cjkWidthRatio()).toBe(2);
  });

  it('clamps values below minimum', () => {
    mockGet.mockImplementation((key: string) => {
      if (key === 'tables.cjkWidthRatio') return 0.5;
      return undefined;
    });
    expect(config.tables.cjkWidthRatio()).toBe(1);
  });

  it('clamps values above maximum', () => {
    mockGet.mockImplementation((key: string) => {
      if (key === 'tables.cjkWidthRatio') return 4;
      return undefined;
    });
    expect(config.tables.cjkWidthRatio()).toBe(3);
  });

  it('falls back to default for non-numeric values', () => {
    mockGet.mockImplementation((key: string) => {
      if (key === 'tables.cjkWidthRatio') return 'wide';
      return undefined;
    });
    expect(config.tables.cjkWidthRatio()).toBe(2.25);
  });
});
