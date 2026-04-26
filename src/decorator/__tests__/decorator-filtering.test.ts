vi.mock('../../parser', () => ({
  MarkdownParser: class {
    extractDecorations() {
      return [];
    }
  }
}));

import { Decorator } from '../../decorator';
import type { DecorationRange, DecorationType } from '../../parser';
import { isMarkerDecorationType } from '../decoration-categories';
import { TextDocument, TextEditor, Selection, Position, Uri, Range } from '../../test/__mocks__/vscode';

type ScopeEntry = {
  startPos: number;
  endPos: number;
  range: ReturnType<typeof Range>;
};

function filterDecorationsForSelection(
  text: string,
  decorations: DecorationRange[],
  scopeRanges: Array<[number, number]>,
  selection: ReturnType<typeof Selection>
): Map<DecorationType, unknown[]> {
  const document = new TextDocument(Uri.file('test.md'), 'markdown', 1, text);
  const editor = new TextEditor(document, [selection]);
  const scopes: ScopeEntry[] = scopeRanges.map(([startPos, endPos]) => ({
    startPos,
    endPos,
    range: new Range(document.positionAt(startPos), document.positionAt(endPos)),
  }));
  const parseCache = {
    get: () => ({ version: 1, text, decorations: [], scopes: [] }),
    invalidate: () => {},
    clear: () => {},
  };
  const decorator = new Decorator(parseCache as any) as unknown as {
    activeEditor: ReturnType<typeof TextEditor>;
    filterDecorations: (
      ranges: DecorationRange[],
      scopes: ScopeEntry[],
      originalText: string
    ) => Map<DecorationType, unknown[]>;
  };

  decorator.activeEditor = editor;
  return decorator.filterDecorations(decorations, scopes, text);
}

describe('Decorator filtering behavior', () => {
  it('keeps semantic styling while revealing markers on active line', () => {
    const text = '**bold**';
    const decorations: DecorationRange[] = [
      { startPos: 0, endPos: 2, type: 'hide' },
      { startPos: 2, endPos: 6, type: 'bold' },
      { startPos: 6, endPos: 8, type: 'hide' },
    ];

    const selection = new Selection(new Position(0, 3), new Position(0, 3));
    const filtered = filterDecorationsForSelection(text, decorations, [[0, 8]], selection);

    expect(filtered.get('bold')?.length).toBe(1);
    expect(filtered.has('hide')).toBe(false);
  });

  it('reveals heading markers and removes heading styling on active line', () => {
    const text = '# Heading';
    const decorations: DecorationRange[] = [
      { startPos: 0, endPos: 2, type: 'hide' },
      { startPos: 2, endPos: 9, type: 'heading1' },
      { startPos: 2, endPos: 9, type: 'heading' },
    ];

    const selection = new Selection(new Position(0, 1), new Position(0, 1));
    const filtered = filterDecorationsForSelection(text, decorations, [[0, 9]], selection);

    expect(filtered.has('heading1')).toBe(false);
    expect(filtered.has('heading')).toBe(false);
    expect(filtered.has('hide')).toBe(false);
    expect(filtered.has('ghostFaint')).toBe(false);
  });

  it('does not suppress marker decorations on non-active lines', () => {
    const text = '- item\nnext';
    const decorations: DecorationRange[] = [
      { startPos: 0, endPos: 2, type: 'listItem' },
    ];

    const selection = new Selection(new Position(1, 0), new Position(1, 0));
    const filtered = filterDecorationsForSelection(text, decorations, [[0, 6]], selection);

    expect(filtered.get('listItem')?.length).toBe(1);
  });

  it('reveals raw checkbox when cursor is inside the checkbox', () => {
    const text = '- [ ] task';
    const decorations: DecorationRange[] = [
      { startPos: 0, endPos: 5, type: 'checkboxUnchecked' },
    ];

    const selection = new Selection(new Position(0, 3), new Position(0, 3));
    const filtered = filterDecorationsForSelection(text, decorations, [], selection);

    expect(filtered.has('checkboxUnchecked')).toBe(false);
    expect(filtered.has('ghostFaint')).toBe(false);
  });

  it('keeps blockquote decoration on active line when cursor is not on marker', () => {
    const text = '> quote';
    const decorations: DecorationRange[] = [
      { startPos: 0, endPos: 1, type: 'blockquote' },
    ];

    const selection = new Selection(new Position(0, 2), new Position(0, 2));
    const filtered = filterDecorationsForSelection(text, decorations, [], selection);

    expect(filtered.get('blockquote')?.length).toBe(1);
    expect(filtered.has('ghostFaint')).toBe(false);
  });

  it('reveals raw blockquote marker when cursor is on marker', () => {
    const text = '> quote';
    const decorations: DecorationRange[] = [
      { startPos: 0, endPos: 1, type: 'blockquote' },
    ];

    const selection = new Selection(new Position(0, 0), new Position(0, 0));
    const filtered = filterDecorationsForSelection(text, decorations, [], selection);

    expect(filtered.has('blockquote')).toBe(false);
  });

  it('reveals raw emoji shortcode when cursor is inside emoji scope', () => {
    const text = ':smile:';
    const decorations: DecorationRange[] = [
      { startPos: 0, endPos: 7, type: 'emoji', emoji: '😄' },
    ];

    const selection = new Selection(new Position(0, 2), new Position(0, 2));
    const filtered = filterDecorationsForSelection(text, decorations, [[0, 7]], selection);

    expect(filtered.has('emoji')).toBe(false);
  });

  it('keeps list item decoration on active line when cursor is not on marker', () => {
    const text = '- item';
    const decorations: DecorationRange[] = [
      { startPos: 0, endPos: 2, type: 'listItem' },
    ];

    const selection = new Selection(new Position(0, 3), new Position(0, 3));
    const filtered = filterDecorationsForSelection(text, decorations, [], selection);

    expect(filtered.get('listItem')?.length).toBe(1);
    expect(filtered.has('ghostFaint')).toBe(false);
  });

  it('reveals raw list item marker when cursor is on marker', () => {
    const text = '- item';
    const decorations: DecorationRange[] = [
      { startPos: 0, endPos: 2, type: 'listItem' },
    ];

    const selection = new Selection(new Position(0, 0), new Position(0, 0));
    const filtered = filterDecorationsForSelection(text, decorations, [], selection);

    expect(filtered.has('listItem')).toBe(false);
  });

  it('reveals horizontal rule in raw state when cursor/selection intersects', () => {
    const text = '---';
    const decorations: DecorationRange[] = [
      { startPos: 0, endPos: 3, type: 'horizontalRule' },
    ];

    // Test with cursor inside horizontal rule
    const selection = new Selection(new Position(0, 1), new Position(0, 1));
    const filtered = filterDecorationsForSelection(text, decorations, [[0, 3]], selection);

    // Horizontal rule decoration should be skipped (raw state - show actual ---)
    expect(filtered.has('horizontalRule')).toBe(false);
  });

  it('shows horizontal rule in rendered state when cursor/selection does not intersect', () => {
    const text = '---\nother text';
    const decorations: DecorationRange[] = [
      { startPos: 0, endPos: 3, type: 'horizontalRule' },
    ];

    // Test with cursor on different line
    const selection = new Selection(new Position(1, 0), new Position(1, 0));
    const filtered = filterDecorationsForSelection(text, decorations, [[0, 3]], selection);

    // Horizontal rule decoration should be applied (rendered state - show visual separator)
    expect(filtered.get('horizontalRule')?.length).toBe(1);
  });

  it('reveals horizontal rule in raw state when selection covers it', () => {
    const text = '---';
    const decorations: DecorationRange[] = [
      { startPos: 0, endPos: 3, type: 'horizontalRule' },
    ];

    // Test with selection covering the entire horizontal rule
    const selection = new Selection(new Position(0, 0), new Position(0, 3));
    const filtered = filterDecorationsForSelection(text, decorations, [[0, 3]], selection);

    // Horizontal rule decoration should be skipped (raw state - show actual ---)
    expect(filtered.has('horizontalRule')).toBe(false);
  });

  it('reveals inline code in raw state when cursor is at the end boundary', () => {
    const text = '`simple inline code`';
    const decorations: DecorationRange[] = [
      { startPos: 0, endPos: 21, type: 'code' }, // code decoration spans entire range including backticks
      { startPos: 0, endPos: 1, type: 'transparent' }, // opening backtick (inline code uses transparent)
      { startPos: 20, endPos: 21, type: 'transparent' }, // closing backtick
    ];

    // Test with cursor at the end boundary (right after closing backtick)
    const selection = new Selection(new Position(0, 21), new Position(0, 21));
    const filtered = filterDecorationsForSelection(text, decorations, [[0, 21]], selection);

    // Transparent decorations should be skipped (raw state - show actual backticks)
    expect(filtered.has('transparent')).toBe(false);
    // Code decoration should still be applied (semantic styling)
    expect(filtered.get('code')?.length).toBe(1);
  });

  it('reveals inline code in raw state when cursor is at the start boundary', () => {
    const text = '`simple inline code`';
    const decorations: DecorationRange[] = [
      { startPos: 0, endPos: 21, type: 'code' }, // code decoration spans entire range including backticks
      { startPos: 0, endPos: 1, type: 'transparent' }, // opening backtick (inline code uses transparent)
      { startPos: 20, endPos: 21, type: 'transparent' }, // closing backtick
    ];

    // Test with cursor at the start boundary (at opening backtick)
    const selection = new Selection(new Position(0, 0), new Position(0, 0));
    const filtered = filterDecorationsForSelection(text, decorations, [[0, 21]], selection);

    // Transparent decorations should be skipped (raw state - show actual backticks)
    expect(filtered.has('transparent')).toBe(false);
    // Code decoration should still be applied (semantic styling)
    expect(filtered.get('code')?.length).toBe(1);
  });

  it('reveals inline code backticks in raw state when cursor is inside the code', () => {
    const text = '`Inline code`';
    const decorations: DecorationRange[] = [
      { startPos: 0, endPos: 13, type: 'code' }, // code decoration spans entire range including backticks
      { startPos: 0, endPos: 1, type: 'transparent' }, // opening backtick
      { startPos: 12, endPos: 13, type: 'transparent' }, // closing backtick
    ];

    // Test with cursor inside the code content
    const selection = new Selection(new Position(0, 5), new Position(0, 5));
    const filtered = filterDecorationsForSelection(text, decorations, [[0, 13]], selection);

    // Transparent decorations should be skipped (raw state - show actual backticks)
    expect(filtered.has('transparent')).toBe(false);
    // Code decoration should still be applied (semantic styling)
    expect(filtered.get('code')?.length).toBe(1);
  });

  it('reveals inline code backticks in raw state when selection covers the code', () => {
    const text = '`Inline code`';
    const decorations: DecorationRange[] = [
      { startPos: 0, endPos: 13, type: 'code' }, // code decoration spans entire range including backticks
      { startPos: 0, endPos: 1, type: 'transparent' }, // opening backtick
      { startPos: 12, endPos: 13, type: 'transparent' }, // closing backtick
    ];

    // Test with selection covering the entire code construct
    const selection = new Selection(new Position(0, 0), new Position(0, 13));
    const filtered = filterDecorationsForSelection(text, decorations, [[0, 13]], selection);

    // Transparent decorations should be skipped (raw state - show actual backticks)
    expect(filtered.has('transparent')).toBe(false);
    // Code decoration should still be applied (semantic styling)
    expect(filtered.get('code')?.length).toBe(1);
  });

  it('keeps code block background and adds selection overlay when selecting inside a code block', () => {
    const text = '```\ncode\n```';
    const decorations: DecorationRange[] = [
      // Background for the whole code block (fenceStart..closingFenceEnd)
      { startPos: 0, endPos: 12, type: 'codeBlock' },
      // Hide opening fence
      { startPos: 0, endPos: 3, type: 'hide' },
      // Hide newline after opening fence
      { startPos: 3, endPos: 4, type: 'hide' },
      // Hide closing fence (and any trailing newline - none here)
      { startPos: 9, endPos: 12, type: 'hide' },
    ];

    // Select inside the code content line ("code")
    const selection = new Selection(new Position(1, 1), new Position(1, 3));
    const filtered = filterDecorationsForSelection(text, decorations, [[0, 12]], selection);

    // In raw state, we show the original markdown (including fences),
    // but keep the background and explicitly overlay selection color so it's visible.
    expect(filtered.get('codeBlock')?.length).toBe(1);
    expect(filtered.has('hide')).toBe(false);
    expect(filtered.get('selectionOverlay')?.length).toBe(1);
  });

  it('keeps code block background decoration when selection is outside the code block', () => {
    const text = '```\ncode\n```\noutside';
    const decorations: DecorationRange[] = [
      { startPos: 0, endPos: 12, type: 'codeBlock' },
    ];

    // Cursor/selection on the outside line
    const selection = new Selection(new Position(3, 0), new Position(3, 0));
    const filtered = filterDecorationsForSelection(text, decorations, [[0, 12]], selection);

    expect(filtered.get('codeBlock')?.length).toBe(1);
  });

  it('reveals link URL in raw state when cursor is inside the link', () => {
    const text = '[link text](https://example.com)';
    const decorations: DecorationRange[] = [
      { startPos: 0, endPos: 1, type: 'hide' }, // opening bracket [
      { startPos: 1, endPos: 10, type: 'link' }, // link content "link text"
      { startPos: 10, endPos: 11, type: 'hide' }, // closing bracket ]
      { startPos: 11, endPos: 12, type: 'hide' }, // opening parenthesis (
      { startPos: 12, endPos: 31, type: 'hide' }, // URL content
      { startPos: 31, endPos: 32, type: 'hide' }, // closing parenthesis )
    ];

    // Test with cursor inside the link text
    const selection = new Selection(new Position(0, 5), new Position(0, 5));
    const filtered = filterDecorationsForSelection(text, decorations, [[0, 32]], selection);

    // All hide decorations should be skipped (raw state - show [text](url))
    expect(filtered.has('hide')).toBe(false);
    // Link decoration should still be applied (semantic styling)
    expect(filtered.get('link')?.length).toBe(1);
  });

  it('reveals link URL in raw state when cursor is in the URL part', () => {
    const text = '[link text](https://example.com)';
    const decorations: DecorationRange[] = [
      { startPos: 0, endPos: 1, type: 'hide' }, // opening bracket [
      { startPos: 1, endPos: 10, type: 'link' }, // link content "link text"
      { startPos: 10, endPos: 11, type: 'hide' }, // closing bracket ]
      { startPos: 11, endPos: 12, type: 'hide' }, // opening parenthesis (
      { startPos: 12, endPos: 31, type: 'hide' }, // URL content
      { startPos: 31, endPos: 32, type: 'hide' }, // closing parenthesis )
    ];

    // Test with cursor in the URL part
    const selection = new Selection(new Position(0, 20), new Position(0, 20));
    const filtered = filterDecorationsForSelection(text, decorations, [[0, 32]], selection);

    // All hide decorations should be skipped (raw state - show [text](url))
    expect(filtered.has('hide')).toBe(false);
    // Link decoration should still be applied (semantic styling)
    expect(filtered.get('link')?.length).toBe(1);
  });

  it('reveals link URL in raw state when selection covers the entire link', () => {
    const text = '[link text](https://example.com)';
    const decorations: DecorationRange[] = [
      { startPos: 0, endPos: 1, type: 'hide' }, // opening bracket [
      { startPos: 1, endPos: 10, type: 'link' }, // link content "link text"
      { startPos: 10, endPos: 11, type: 'hide' }, // closing bracket ]
      { startPos: 11, endPos: 12, type: 'hide' }, // opening parenthesis (
      { startPos: 12, endPos: 31, type: 'hide' }, // URL content
      { startPos: 31, endPos: 32, type: 'hide' }, // closing parenthesis )
    ];

    // Test with selection covering the entire link construct
    const selection = new Selection(new Position(0, 0), new Position(0, 32));
    const filtered = filterDecorationsForSelection(text, decorations, [[0, 32]], selection);

    // All hide decorations should be skipped (raw state - show [text](url))
    expect(filtered.has('hide')).toBe(false);
    // Link decoration should still be applied (semantic styling)
    expect(filtered.get('link')?.length).toBe(1);
  });

  it('reveals image URL in raw state when cursor is inside the image alt text', () => {
    const text = '![alt text](image.png)';
    const decorations: DecorationRange[] = [
      { startPos: 0, endPos: 2, type: 'hide' }, // opening ![
      { startPos: 2, endPos: 10, type: 'image' }, // image content "alt text"
      { startPos: 10, endPos: 11, type: 'hide' }, // closing bracket ]
      { startPos: 11, endPos: 12, type: 'hide' }, // opening parenthesis (
      { startPos: 20, endPos: 21, type: 'hide' }, // closing parenthesis )
    ];

    // Test with cursor inside the alt text
    const selection = new Selection(new Position(0, 5), new Position(0, 5));
    const filtered = filterDecorationsForSelection(text, decorations, [[0, 21]], selection);

    // All hide decorations should be skipped (raw state - show ![alt](url))
    expect(filtered.has('hide')).toBe(false);
    // Image decoration should still be applied (semantic styling)
    expect(filtered.get('image')?.length).toBe(1);
  });

  it('reveals image URL in raw state when cursor is in the URL part', () => {
    const text = '![alt text](image.png)';
    const decorations: DecorationRange[] = [
      { startPos: 0, endPos: 2, type: 'hide' }, // opening ![
      { startPos: 2, endPos: 10, type: 'image' }, // image content "alt text"
      { startPos: 10, endPos: 11, type: 'hide' }, // closing bracket ]
      { startPos: 11, endPos: 12, type: 'hide' }, // opening parenthesis (
      { startPos: 20, endPos: 21, type: 'hide' }, // closing parenthesis )
    ];

    // Test with cursor in the URL part (between parentheses)
    const selection = new Selection(new Position(0, 15), new Position(0, 15));
    const filtered = filterDecorationsForSelection(text, decorations, [[0, 21]], selection);

    // All hide decorations should be skipped (raw state - show ![alt](url))
    expect(filtered.has('hide')).toBe(false);
    // Image decoration should still be applied (semantic styling)
    expect(filtered.get('image')?.length).toBe(1);
  });

  it('reveals image URL in raw state when selection covers the entire image', () => {
    const text = '![alt text](image.png)';
    const decorations: DecorationRange[] = [
      { startPos: 0, endPos: 2, type: 'hide' }, // opening ![
      { startPos: 2, endPos: 10, type: 'image' }, // image content "alt text"
      { startPos: 10, endPos: 11, type: 'hide' }, // closing bracket ]
      { startPos: 11, endPos: 12, type: 'hide' }, // opening parenthesis (
      { startPos: 20, endPos: 21, type: 'hide' }, // closing parenthesis )
    ];

    // Test with selection covering the entire image construct
    const selection = new Selection(new Position(0, 0), new Position(0, 21));
    const filtered = filterDecorationsForSelection(text, decorations, [[0, 21]], selection);

    // All hide decorations should be skipped (raw state - show ![alt](url))
    expect(filtered.has('hide')).toBe(false);
    // Image decoration should still be applied (semantic styling)
    expect(filtered.get('image')?.length).toBe(1);
  });

  it('reveals autolink in raw state when cursor is inside the autolink', () => {
    const text = '<https://example.com>';
    const decorations: DecorationRange[] = [
      { startPos: 0, endPos: 1, type: 'hide' }, // opening <
      { startPos: 1, endPos: 19, type: 'link', url: 'https://example.com' }, // link content
      { startPos: 19, endPos: 20, type: 'hide' }, // closing >
    ];

    // Test with cursor inside the autolink
    const selection = new Selection(new Position(0, 10), new Position(0, 10));
    const filtered = filterDecorationsForSelection(text, decorations, [[0, 20]], selection);

    // All hide decorations should be skipped (raw state - show <url>)
    expect(filtered.has('hide')).toBe(false);
    // Link decoration should still be applied (semantic styling)
    expect(filtered.get('link')?.length).toBe(1);
  });

  it('reveals autolink in raw state when cursor is at the start boundary', () => {
    const text = '<https://example.com>';
    const decorations: DecorationRange[] = [
      { startPos: 0, endPos: 1, type: 'hide' }, // opening <
      { startPos: 1, endPos: 19, type: 'link', url: 'https://example.com' }, // link content
      { startPos: 19, endPos: 20, type: 'hide' }, // closing >
    ];

    // Test with cursor at the start of the autolink
    const selection = new Selection(new Position(0, 0), new Position(0, 0));
    const filtered = filterDecorationsForSelection(text, decorations, [[0, 20]], selection);

    // All hide decorations should be skipped (raw state - show <url>)
    expect(filtered.has('hide')).toBe(false);
    // Link decoration should still be applied (semantic styling)
    expect(filtered.get('link')?.length).toBe(1);
  });

  it('reveals autolink in raw state when selection covers the entire autolink', () => {
    const text = '<https://example.com>';
    const decorations: DecorationRange[] = [
      { startPos: 0, endPos: 1, type: 'hide' }, // opening <
      { startPos: 1, endPos: 19, type: 'link', url: 'https://example.com' }, // link content
      { startPos: 19, endPos: 20, type: 'hide' }, // closing >
    ];

    // Test with selection covering the entire autolink
    const selection = new Selection(new Position(0, 0), new Position(0, 20));
    const filtered = filterDecorationsForSelection(text, decorations, [[0, 20]], selection);

    // All hide decorations should be skipped (raw state - show <url>)
    expect(filtered.has('hide')).toBe(false);
    // Link decoration should still be applied (semantic styling)
    expect(filtered.get('link')?.length).toBe(1);
  });

  it('reveals email autolink in raw state when cursor is inside', () => {
    const text = '<user@example.com>';
    const decorations: DecorationRange[] = [
      { startPos: 0, endPos: 1, type: 'hide' }, // opening <
      { startPos: 1, endPos: 16, type: 'link', url: 'mailto:user@example.com' }, // link content
      { startPos: 16, endPos: 17, type: 'hide' }, // closing >
    ];

    // Test with cursor inside the email autolink
    const selection = new Selection(new Position(0, 8), new Position(0, 8));
    const filtered = filterDecorationsForSelection(text, decorations, [[0, 17]], selection);

    // All hide decorations should be skipped (raw state - show <email>)
    expect(filtered.has('hide')).toBe(false);
    // Link decoration should still be applied (semantic styling)
    expect(filtered.get('link')?.length).toBe(1);
  });

  it('ghosts non-selected markers on the active line when selection is outside the construct', () => {
    const text = '**Bold** text';
    const decorations: DecorationRange[] = [
      { startPos: 0, endPos: 2, type: 'hide' },
      { startPos: 2, endPos: 6, type: 'bold' },
      { startPos: 6, endPos: 8, type: 'hide' },
    ];

    const selection = new Selection(new Position(0, 10), new Position(0, 10));
    const filtered = filterDecorationsForSelection(text, decorations, [[0, 8]], selection);

    expect(filtered.get('bold')?.length).toBe(1);
    expect(filtered.has('hide')).toBe(false);
    expect(filtered.get('ghostFaint')?.length).toBe(2);
  });

  it('renders raw markers only for the selected construct and ghosts others on the same line', () => {
    const text = '**Bold** *Italic*';
    const decorations: DecorationRange[] = [
      { startPos: 0, endPos: 2, type: 'hide' }, // ** (bold open)
      { startPos: 2, endPos: 6, type: 'bold' },
      { startPos: 6, endPos: 8, type: 'hide' }, // ** (bold close)
      { startPos: 9, endPos: 10, type: 'hide' }, // * (italic open)
      { startPos: 10, endPos: 16, type: 'italic' },
      { startPos: 16, endPos: 17, type: 'hide' }, // * (italic close)
    ];

    const selection = new Selection(new Position(0, 4), new Position(0, 4));
    const filtered = filterDecorationsForSelection(
      text,
      decorations,
      [
        [0, 8],
        [9, 17],
      ],
      selection
    );

    expect(filtered.get('bold')?.length).toBe(1);
    expect(filtered.get('italic')?.length).toBe(1);
    expect(filtered.has('hide')).toBe(false);
    expect(filtered.get('ghostFaint')?.length).toBe(2);
  });

  it('does not ghost markers on non-active lines (rendered state)', () => {
    const text = '**Bold**\nnext';
    const decorations: DecorationRange[] = [
      { startPos: 0, endPos: 2, type: 'hide' },
      { startPos: 2, endPos: 6, type: 'bold' },
      { startPos: 6, endPos: 8, type: 'hide' },
    ];

    const selection = new Selection(new Position(1, 0), new Position(1, 0));
    const filtered = filterDecorationsForSelection(text, decorations, [[0, 8]], selection);

    expect(filtered.get('bold')?.length).toBe(1);
    expect(filtered.get('hide')?.length).toBe(2);
    expect(filtered.has('ghostFaint')).toBe(false);
  });
});

describe('Marker decoration categorization', () => {
  it('identifies marker/replacement decorations', () => {
    const markerTypes: DecorationType[] = [
      'hide',
      'transparent',
      'blockquote',
      'heading',
      'heading1',
      'heading2',
      'heading3',
      'heading4',
      'heading5',
      'heading6',
      'listItem',
      'checkboxUnchecked',
      'checkboxChecked',
      'horizontalRule',
    ];

    markerTypes.forEach((type) => {
      expect(isMarkerDecorationType(type)).toBe(true);
    });
    expect(isMarkerDecorationType('bold')).toBe(false);
    expect(isMarkerDecorationType('link')).toBe(false);
  });
});
