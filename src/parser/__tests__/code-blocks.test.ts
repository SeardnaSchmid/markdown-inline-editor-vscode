import type { Code } from 'mdast';
import { processCodeBlock } from '../code-blocks';
import type { DecorationRange, MermaidBlock, ScopeRange } from '../types';

function createCodeNode(
  text: string,
  lang?: string,
  value?: string,
  startOffset?: number,
  endOffset?: number
): Code {
  const start = startOffset ?? 0;
  const end = endOffset ?? text.length;

  return {
    type: 'code',
    lang,
    value: value ?? '',
    position: {
      start: { line: 1, column: 1, offset: start },
      end: { line: 3, column: 1, offset: end },
    },
  };
}

describe('processCodeBlock', () => {
  let decorations: DecorationRange[];
  let scopes: ScopeRange[];
  let mermaidBlocks: MermaidBlock[];

  beforeEach(() => {
    decorations = [];
    scopes = [];
    mermaidBlocks = [];
  });

  it('ignores nodes without valid offsets', () => {
    const node = {
      type: 'code',
      value: 'graph TD',
      position: {
        start: { line: 1, column: 1 },
        end: { line: 3, column: 1 },
      },
    } as Code;

    processCodeBlock(node, '```\\ncode\\n```', decorations, scopes, mermaidBlocks);

    expect(decorations).toEqual([]);
    expect(scopes).toEqual([]);
    expect(mermaidBlocks).toEqual([]);
  });

  it('detects an opening fence that appears earlier on the same line as the node start', () => {
    const text = '```ts\nabc\n```';
    const codeStart = 3;
    const codeEnd = text.lastIndexOf('```') + 3;
    const node = createCodeNode(text, 'ts', 'abc', codeStart, codeEnd);

    processCodeBlock(node, text, decorations, scopes, mermaidBlocks);

    expect(decorations.some((d) => d.type === 'codeBlock')).toBe(true);
    expect(decorations.some((d) => d.type === 'codeBlockLanguage')).toBe(true);
    expect(scopes).toEqual([
      expect.objectContaining({ kind: 'codeBlock' }),
    ]);
  });

  it('returns without decorations when no closing fence can be found', () => {
    const text = '```ts\nconst x = 1;\nno close';
    const codeStart = text.indexOf('const x');
    const node = createCodeNode(text, 'ts', 'const x = 1;', codeStart, text.length);

    processCodeBlock(node, text, decorations, scopes, mermaidBlocks);

    expect(decorations).toEqual([]);
    expect(scopes).toEqual([]);
    expect(mermaidBlocks).toEqual([]);
  });

  it('records mermaid blocks and hides fences without adding codeBlock styling', () => {
    const text = '```mermaid\ngraph TD\nA-->B\n```';
    const node = createCodeNode(text, 'mermaid', 'graph TD\nA-->B', 0, text.length);

    processCodeBlock(node, text, decorations, scopes, mermaidBlocks);

    expect(decorations.some((d) => d.type === 'codeBlock')).toBe(false);
    expect(decorations.some((d) => d.type === 'hide')).toBe(true);
    expect(mermaidBlocks).toEqual([
      {
        startPos: 0,
        endPos: text.length,
        source: 'graph TD\nA-->B',
        numLines: 2,
      },
    ]);
  });
});
