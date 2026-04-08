/**
 * Pipeline integration tests: verifies isMarkdownDocument() recognises all
 * expected language IDs and rejects unknown ones.
 *
 * isMarkdownDocument() is private; we reach it by casting the Decorator to an
 * internal shape, which is the same pattern used in decorator-filtering.test.ts.
 */

vi.mock('../../parser', () => ({
  MarkdownParser: class {
    extractDecorations() {
      return [];
    }
  },
}));

import { Decorator } from '../../decorator';
import { TextDocument, TextEditor, Selection, Position, Uri } from '../../test/__mocks__/vscode';

type DecoratorInternal = {
  activeEditor: InstanceType<typeof TextEditor>;
  isMarkdownDocument: () => boolean;
};

function makeEditor(languageId: string): InstanceType<typeof TextEditor> {
  const doc = new TextDocument(Uri.file(`test.${languageId}`), languageId, 1, '**bold**');
  return new TextEditor(doc, [new Selection(new Position(0, 0), new Position(0, 0))]);
}

function makeDecorator(): DecoratorInternal {
  const parseCache = {
    get: () => ({ version: 1, text: '', decorations: [], scopes: [] }),
    invalidate: () => {},
    clear: () => {},
  };
  return new Decorator(parseCache as any) as unknown as DecoratorInternal;
}

describe('isMarkdownDocument()', () => {
  it('returns true for languageId "markdown"', () => {
    const d = makeDecorator();
    d.activeEditor = makeEditor('markdown');
    expect(d.isMarkdownDocument()).toBe(true);
  });

  it('returns true for languageId "md"', () => {
    const d = makeDecorator();
    d.activeEditor = makeEditor('md');
    expect(d.isMarkdownDocument()).toBe(true);
  });

  it('returns true for languageId "mdx"', () => {
    const d = makeDecorator();
    d.activeEditor = makeEditor('mdx');
    expect(d.isMarkdownDocument()).toBe(true);
  });

  // Regression for issue #58: SKILL.md files receive languageId 'skill' from
  // the SKILL language extension, so they were never decorated.
  it('returns true for languageId "skill" (#58)', () => {
    const d = makeDecorator();
    d.activeEditor = makeEditor('skill');
    expect(d.isMarkdownDocument()).toBe(true);
  });

  // #61: markdoc files use languageId 'markdoc' (Markdoc language server)
  it('returns true for languageId "markdoc" (#61)', () => {
    const d = makeDecorator();
    d.activeEditor = makeEditor('markdoc');
    expect(d.isMarkdownDocument()).toBe(true);
  });

  // #61: Nuxt Content .mdc files use languageId 'mdc' (vscode-mdc extension)
  it('returns true for languageId "mdc" (#61)', () => {
    const d = makeDecorator();
    d.activeEditor = makeEditor('mdc');
    expect(d.isMarkdownDocument()).toBe(true);
  });

  // #61: Julia Markdown files use built-in languageId 'juliamarkdown'
  it('returns true for languageId "juliamarkdown" (#61)', () => {
    const d = makeDecorator();
    d.activeEditor = makeEditor('juliamarkdown');
    expect(d.isMarkdownDocument()).toBe(true);
  });

  // #61: R Markdown files use languageId 'rmarkdown' (vscode-R extension)
  it('returns true for languageId "rmarkdown" (#61)', () => {
    const d = makeDecorator();
    d.activeEditor = makeEditor('rmarkdown');
    expect(d.isMarkdownDocument()).toBe(true);
  });

  it('returns false for languageId "plaintext"', () => {
    const d = makeDecorator();
    d.activeEditor = makeEditor('plaintext');
    expect(d.isMarkdownDocument()).toBe(false);
  });

  it('returns false for languageId "typescript"', () => {
    const d = makeDecorator();
    d.activeEditor = makeEditor('typescript');
    expect(d.isMarkdownDocument()).toBe(false);
  });

  it('returns false when no active editor is set', () => {
    const d = makeDecorator();
    // activeEditor is undefined by default
    expect(d.isMarkdownDocument()).toBe(false);
  });
});
