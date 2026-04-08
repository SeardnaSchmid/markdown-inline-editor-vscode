vi.mock('../math-renderer', () => ({
  renderMathToDataUri: vi.fn(() => 'data:image/svg+xml;base64,PHN2Zy8+'),
}));

import { window, workspace, ColorThemeKind } from 'vscode';
import { MathDecorations } from '../math-decorations';
import { renderMathToDataUri } from '../math-renderer';

describe('MathDecorations', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  it('uses (numLines + 2) * lineHeight for block regions', () => {
    vi.spyOn(workspace, 'getConfiguration').mockReturnValue({
      get: <T>(key: string, defaultValue: T): T => {
        if (key === 'fontSize') return 14 as T;
        if (key === 'lineHeight') return 0 as T;
        return defaultValue;
      },
    } as unknown as ReturnType<typeof workspace.getConfiguration>);

    const editor = { setDecorations: vi.fn() } as any;
    const decorations = new MathDecorations();
    decorations.apply(editor, [
      {
        region: {
          startPos: 0,
          endPos: 10,
          source: '\\sum_{n=1}^{\\infty} \\frac{1}{n^2}',
          displayMode: true,
          numLines: 3,
        },
        range: {} as any,
      },
    ]);

    const expectedLineHeight = process.platform === 'darwin' ? 21 : 19;
    expect(renderMathToDataUri).toHaveBeenCalledWith(
      '\\sum_{n=1}^{\\infty} \\frac{1}{n^2}',
      expect.objectContaining({
        displayMode: true,
        height: (3 + 2) * expectedLineHeight,
      })
    );
  });

  it('does not set block-only width/height auto styling on decoration before options', () => {
    vi.spyOn(window, 'createTextEditorDecorationType');
    window.activeColorTheme.kind = ColorThemeKind.Dark;

    const editor = { setDecorations: vi.fn() } as any;
    const decorations = new MathDecorations();
    decorations.apply(editor, [
      {
        region: {
          startPos: 0,
          endPos: 5,
          source: 'x',
          displayMode: true,
          numLines: 1,
        },
        range: {} as any,
      },
    ]);

    const options = vi.mocked(window.createTextEditorDecorationType).mock.calls[0][0];
    expect(options.before.width).toBeUndefined();
    expect(options.before.height).toBeUndefined();
  });
});
