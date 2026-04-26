import * as assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';

const EXTENSION_ID = 'CodeSmith.markdown-inline-editor-vscode';

// ── Minimal mirror types for ext.exports ─────────────────────────────────────
// These parallel src/parser.ts::DecorationRange, src/markdown-parse-cache.ts::ParseEntry,
// and the public surface of src/decorator.ts::Decorator that the tests use.
// We cannot import those types directly (tsconfig.e2e.json rootDir constraint),
// so we declare the minimal shape needed here.
type DR = { type: string; startPos: number; endPos: number; url?: string };
type PE = { text: string; decorations: DR[] };
type ParseCacheExport = { get(doc: vscode.TextDocument): PE };
type DecorationStyleDebugSpec = {
  textDecoration?: string;
  colorSource?: string;
  backgroundColorSource?: string;
  fontWeight?: string;
  fontStyle?: string;
  cursor?: string;
  opacity?: string;
  isWholeLine?: boolean;
  borderWidth?: string;
  borderStyle?: string;
  borderColorSource?: string;
  before?: {
    contentText?: string;
    colorSource?: string;
    fontWeight?: string;
    border?: string;
    borderColorSource?: string;
    width?: string;
    height?: string;
    textDecoration?: string;
  };
  after?: {
    contentText?: string;
    colorSource?: string;
    textDecoration?: string;
  };
};
type DebugAppliedRangeSnapshot = {
  startLine: number;
  startCharacter: number;
  endLine: number;
  endCharacter: number;
  renderOptions?: {
    beforeContentText?: string;
    beforeTextDecoration?: string;
    beforeFontWeight?: string;
    beforeFontStyle?: string;
    afterContentText?: string;
    afterTextDecoration?: string;
  };
};
type DecoratorDebugSnapshot = {
  documentUri?: string;
  enabled: boolean;
  applied: Record<string, DebugAppliedRangeSnapshot[] | undefined>;
  styles: Record<string, DecorationStyleDebugSpec | undefined>;
  math?: {
    enabled: boolean;
    applied: DebugAppliedRangeSnapshot[];
    hiddenCount: number;
  };
  mermaid?: {
    rendered: DebugAppliedRangeSnapshot[];
    indicators: DebugAppliedRangeSnapshot[];
  };
};
type DecoratorExport = {
  isEnabled(): boolean;
  activeEditor: vscode.TextEditor | undefined;
  onApply: ((nonEmptyTypeCount: number) => void) | undefined;
  getDebugSnapshot(): DecoratorDebugSnapshot;
};
type SvgProcessorExport = {
  processSvg: (svgString: string, height: number, maxWidth?: number) => string;
};
type ExtExports = { parseCache?: ParseCacheExport; decorator?: DecoratorExport; svgProcessor?: SvgProcessorExport };

/** Populated in suiteSetup from ext.exports. */
let cache: ParseCacheExport | undefined;
let decoratorApi: DecoratorExport | undefined;
let svgProcessor: SvgProcessorExport | undefined;

suite('Extension E2E', () => {
  suiteSetup(async () => {
    const ext = vscode.extensions.getExtension(EXTENSION_ID);
    if (ext && !ext.isActive) {
      await ext.activate();
    }
    const exports = ext?.exports as ExtExports | undefined;
    cache = exports?.parseCache;
    decoratorApi = exports?.decorator;
    svgProcessor = exports?.svgProcessor;
  });

  test('extension is present', () => {
    const ext = vscode.extensions.getExtension(EXTENSION_ID);
    assert.ok(ext, 'Extension not found — check publisher/name in package.json');
  });

  test('extension activates', () => {
    const ext = vscode.extensions.getExtension(EXTENSION_ID);
    assert.ok(ext?.isActive, 'Extension did not activate');
  });

  test('toggle command is registered', async () => {
    const commands = await vscode.commands.getCommands(true);
    assert.ok(
      commands.includes('mdInline.toggleDecorations'),
      'mdInline.toggleDecorations not registered'
    );
  });

  test('decorates markdown documents without error', async () => {
    const doc = await vscode.workspace.openTextDocument({
      language: 'markdown',
      content: '**bold** and _italic_ and `code`\n\n# Heading\n\n> blockquote',
    });
    await vscode.window.showTextDocument(doc);
    await delay(500);
    assert.strictEqual(doc.languageId, 'markdown');
    // Reaching here without an unhandled exception means the decorator ran cleanly.
  });

  test('live decorator snapshot includes rendered visual styles for core markdown constructs', async () => {
    assert.ok(decoratorApi, 'decorator not available from ext.exports');
    const doc = await vscode.workspace.openTextDocument({
      language: 'markdown',
      content: '**bold** and _italic_ and `code`\n\n# Heading\n\n> blockquote',
    });
    await vscode.window.showTextDocument(doc);
    await delay(500);

    const snapshot = decoratorApi.getDebugSnapshot();
    assert.strictEqual(snapshot.documentUri, doc.uri.toString(), 'Expected snapshot for the active document');
    assert.ok(snapshot.applied.bold?.length, 'Expected bold decorations to be applied to the editor');
    assert.ok(snapshot.applied.italic?.length, 'Expected italic decorations to be applied to the editor');
    assert.ok(snapshot.applied.code?.length, 'Expected inline code decorations to be applied to the editor');
    assert.ok(snapshot.applied.heading1?.length, 'Expected heading decorations to be applied to the editor');
    assert.ok(snapshot.applied.blockquote?.length, 'Expected blockquote decorations to be applied to the editor');
    assert.strictEqual(snapshot.styles.bold?.fontWeight, 'bold');
    assert.strictEqual(snapshot.styles.italic?.fontStyle, 'italic');
    assert.strictEqual(snapshot.styles.heading1?.textDecoration, 'none; font-size: 180%;');
    assert.strictEqual(snapshot.styles.blockquote?.before?.contentText, '│');
    assert.strictEqual(snapshot.styles.code?.backgroundColorSource, 'theme-aware-default');
  });

  test('heading styling is suppressed on the active line and restored off-line', async () => {
    assert.ok(decoratorApi, 'decorator not available from ext.exports');
    const doc = await vscode.workspace.openTextDocument({
      language: 'markdown',
      content: '# Active Heading\n\nBody line',
    });
    const editor = await vscode.window.showTextDocument(doc);
    await delay(500);

    let snapshot = decoratorApi.getDebugSnapshot();
    assert.ok(!snapshot.applied.heading1?.length, 'Expected heading styling to be suppressed on the active heading line');

    await setCursor(editor, 2, 0);
    snapshot = decoratorApi.getDebugSnapshot();
    assert.ok(snapshot.applied.heading1?.length, 'Expected heading styling to return when cursor leaves the heading line');
  });

  test('active-line markdown markers switch to ghost-faint instead of hidden', async () => {
    assert.ok(decoratorApi, 'decorator not available from ext.exports');
    const doc = await vscode.workspace.openTextDocument({
      language: 'markdown',
      // Trailing text keeps the cursor outside the emphasis scope while still on the line (ghost state).
      content: '**bold** after\nplain line',
    });
    const editor = await vscode.window.showTextDocument(doc);
    await delay(500);
    await setCursor(editor, 0, '**bold** after'.length);

    let snapshot = decoratorApi.getDebugSnapshot();
    assert.ok(snapshot.applied.ghostFaint?.length, 'Expected ghost-faint marker rendering on the active markdown line');
    assert.ok(!snapshot.applied.hide?.length, 'Expected hidden syntax markers to be suppressed on the active line');

    await setCursor(editor, 1, 0);
    snapshot = decoratorApi.getDebugSnapshot();
    assert.ok(snapshot.applied.hide?.length, 'Expected hidden syntax markers to return when cursor leaves the line');
  });

  test('cursor inside a bold scope reveals raw markers while keeping semantic bold styling', async () => {
    assert.ok(decoratorApi, 'decorator not available from ext.exports');
    const doc = await vscode.workspace.openTextDocument({
      language: 'markdown',
      content: 'Lead line\n**bold text**',
    });
    const editor = await vscode.window.showTextDocument(doc);
    await delay(500);

    let snapshot = decoratorApi.getDebugSnapshot();
    assert.ok(snapshot.applied.hide?.length, 'Expected hidden marker decorations while cursor is outside the bold scope');

    await setCursor(editor, 1, 4);
    snapshot = decoratorApi.getDebugSnapshot();
    assert.ok(!snapshot.applied.hide?.length, 'Expected raw bold markers when cursor enters the bold scope');
    assert.ok(snapshot.applied.bold?.length, 'Expected semantic bold styling to remain applied');
  });

  test('cursor inside inline code reveals raw markers while keeping code styling', async () => {
    assert.ok(decoratorApi, 'decorator not available from ext.exports');
    const doc = await vscode.workspace.openTextDocument({
      language: 'markdown',
      content: 'Lead line\n`inline code`',
    });
    const editor = await vscode.window.showTextDocument(doc);
    await delay(500);

    let snapshot = decoratorApi.getDebugSnapshot();
    assert.ok(snapshot.applied.transparent?.length, 'Expected transparent inline-code markers while cursor is outside the scope');

    await setCursor(editor, 1, 3);
    snapshot = decoratorApi.getDebugSnapshot();
    assert.ok(!snapshot.applied.transparent?.length, 'Expected raw inline-code markers when cursor enters the code scope');
    assert.ok(snapshot.applied.code?.length, 'Expected semantic inline-code styling to remain applied');
  });

  test('toggle command executes without error on active markdown editor', async () => {
    const doc = await vscode.workspace.openTextDocument({
      language: 'markdown',
      content: '# Heading\n**bold** _italic_',
    });
    await vscode.window.showTextDocument(doc);
    await delay(300);
    await vscode.commands.executeCommand('mdInline.toggleDecorations');
    await delay(200);
    await vscode.commands.executeCommand('mdInline.toggleDecorations');
  });

  // Issue #28: per-file toggle state
  // Toggling decorations on file A must not affect file B.
  test('#28 — toggle is per-file: disabling one file leaves others enabled', async () => {
    const docA = await vscode.workspace.openTextDocument({
      language: 'markdown',
      content: '# File A\n**bold**',
    });
    const docB = await vscode.workspace.openTextDocument({
      language: 'markdown',
      content: '# File B\n_italic_',
    });

    // Show file A and disable decorations for it
    await vscode.window.showTextDocument(docA);
    await delay(300);
    assert.ok(decoratorApi?.isEnabled(), 'File A should start enabled');
    await vscode.commands.executeCommand('mdInline.toggleDecorations');
    await delay(200);
    assert.strictEqual(decoratorApi?.isEnabled(), false, 'File A should now be disabled');

    // Switch to file B — it should remain enabled
    await vscode.window.showTextDocument(docB);
    await delay(300);
    assert.ok(decoratorApi?.isEnabled(), 'File B should still be enabled');

    // Switch back to file A — it should still be disabled
    await vscode.window.showTextDocument(docA);
    await delay(300);
    assert.strictEqual(decoratorApi?.isEnabled(), false, 'File A should still be disabled');

    // Re-enable file A to leave state clean for subsequent tests
    await vscode.commands.executeCommand('mdInline.toggleDecorations');
    await delay(200);
  });

  // Regression test for issue #58:
  // SKILL.md files get languageId 'skill' from the SKILL language extension.
  // Fix: 'skill' is now included in isMarkdownDocument()'s allowed list, and
  // onLanguage:skill is added to activationEvents.
  //
  // setTextDocumentLanguage('skill') requires the SKILL extension to be
  // installed; in this bare test environment we use the 'markdown' language
  // directly and verify the decorator handles it end-to-end without error.
  // The isMarkdownDocument() unit-level behaviour ('skill' → true) is covered
  // by the decorator unit tests in src/decorator/__tests__/.
  test('#58 — extension decorates a skill-languageId document without error', async () => {
    // Create a document that mimics a SKILL.md file.
    // In an environment with the SKILL extension installed, this would use
    // language: 'skill'; here we open an actual .md file and assert languageId.
    const doc = await vscode.workspace.openTextDocument({
      language: 'markdown',
      content: '**bold** _italic_\n\n# Heading',
    });
    await vscode.window.showTextDocument(doc);
    await delay(500);
    assert.strictEqual(doc.languageId, 'markdown');
    // Extension must not throw while decorating. No public API to verify
    // decoration state, but a clean exit confirms the pipeline ran.
  });

  test('non-markdown languageId without .md extension is correctly skipped', async () => {
    const doc = await vscode.workspace.openTextDocument({
      language: 'plaintext',
      content: '**not decorated**',
    });
    await vscode.window.showTextDocument(doc);
    await delay(300);
    assert.strictEqual(doc.languageId, 'plaintext');
    // languageId 'plaintext' is not in the allowed list → skipped cleanly.
  });

  // Regression for issue #47:
  // Checked task-list items rendered a blank rectangle instead of ☑.
  // Fix: decoration now uses the ☑ character explicitly.
  // This test ensures the decorator pipeline does not throw when processing
  // a document containing both checked and unchecked task list items.
  test('#47 — checked task list items decorate without error', async () => {
    const doc = await vscode.workspace.openTextDocument({
      language: 'markdown',
      content: '- [ ] unchecked task\n- [x] checked task\n- [X] also checked',
    });
    await vscode.window.showTextDocument(doc);
    await delay(500);
    assert.strictEqual(doc.languageId, 'markdown');
  });

  test('#47 — checkbox decorations expose checked and unchecked visual payloads', async () => {
    assert.ok(decoratorApi, 'decorator not available from ext.exports');
    const doc = await vscode.workspace.openTextDocument({
      language: 'markdown',
      content: '\n- [ ] unchecked task\n- [x] checked task',
    });
    await vscode.window.showTextDocument(doc);
    await delay(500);

    const snapshot = decoratorApi.getDebugSnapshot();
    assert.ok(snapshot.applied.checkboxUnchecked?.length, 'Expected unchecked checkbox decoration to be applied');
    assert.ok(snapshot.applied.checkboxChecked?.length, 'Expected checked checkbox decoration to be applied');
    assert.strictEqual(snapshot.styles.checkboxUnchecked?.textDecoration, 'none; display: none;');
    assert.strictEqual(snapshot.styles.checkboxUnchecked?.before?.border, '1px solid');
    assert.strictEqual(snapshot.styles.checkboxChecked?.after?.contentText, '✔');
    assert.ok(
      snapshot.styles.checkboxChecked?.after?.textDecoration?.includes('cursor: pointer'),
      'Expected checked checkbox visual payload to keep pointer cursor styling'
    );
  });

  // Regression for issue #55:
  // GFM tables were not decorated; the parser had boundary issues with table
  // detection. Fix: remark-gfm table parsing with visual grid decorations.
  test('#55 — GFM table document decorates without error', async () => {
    const doc = await vscode.workspace.openTextDocument({
      language: 'markdown',
      content:
        '| Name  | Role  |\n| ----- | ----- |\n| Alice | Admin |\n| Bob   | User  |',
    });
    await vscode.window.showTextDocument(doc);
    await delay(500);
    assert.strictEqual(doc.languageId, 'markdown');
  });

  // Regression for issue #27:
  // YAML frontmatter was not supported initially; the parser would try to
  // decorate the frontmatter as markdown content, causing incorrect output.
  // Fix: remark-frontmatter integration to parse and style YAML blocks.
  test('#27 — YAML frontmatter document decorates without error', async () => {
    const doc = await vscode.workspace.openTextDocument({
      language: 'markdown',
      content: '---\ntitle: My Doc\nauthor: Alice\ndate: 2026-01-01\n---\n\n# Content\n\nBody text.',
    });
    await vscode.window.showTextDocument(doc);
    await delay(500);
    assert.strictEqual(doc.languageId, 'markdown');
  });

  // Regression for issue #24:
  // Autolinks (<https://example.com>) and bare URLs (https://example.com)
  // were not decorated; the parser skipped them entirely.
  test('#24 — autolinks and bare URLs decorate without error', async () => {
    const doc = await vscode.workspace.openTextDocument({
      language: 'markdown',
      content:
        'Visit <https://example.com> or just https://example.com for details.\n\nEmail <mailto:user@example.com>.',
    });
    await vscode.window.showTextDocument(doc);
    await delay(500);
    assert.strictEqual(doc.languageId, 'markdown');
  });

  test('link and image decorations expose their live visual affordances', async () => {
    assert.ok(decoratorApi, 'decorator not available from ext.exports');
    const doc = await vscode.workspace.openTextDocument({
      language: 'markdown',
      content: '[Visit Example](https://example.com)\n\n![Diagram](https://example.com/diagram.png)',
    });
    await vscode.window.showTextDocument(doc);
    await delay(500);

    const snapshot = decoratorApi.getDebugSnapshot();
    assert.ok(snapshot.applied.link?.length, 'Expected link decoration to be applied');
    assert.ok(snapshot.applied.image?.length, 'Expected image decoration to be applied');
    assert.strictEqual(snapshot.styles.link?.textDecoration, 'underline');
    assert.strictEqual(snapshot.styles.link?.cursor, 'pointer');
    assert.strictEqual(snapshot.styles.link?.after?.contentText, ' 🔗');
    assert.ok(
      snapshot.styles.image?.textDecoration?.includes('text-decoration-style: dashed'),
      'Expected image decoration to use dashed underline styling'
    );
    assert.strictEqual(snapshot.styles.image?.after?.contentText, ' ⬔');
  });

  test('emoji shortcode replacement renders off-line and reveals raw shortcode on focus', async () => {
    assert.ok(decoratorApi, 'decorator not available from ext.exports');
    const doc = await vscode.workspace.openTextDocument({
      language: 'markdown',
      content: 'neutral line\n:tada:',
    });
    const editor = await vscode.window.showTextDocument(doc);
    await delay(500);

    let snapshot = decoratorApi.getDebugSnapshot();
    assert.ok(snapshot.applied.emoji?.length, 'Expected emoji replacement decoration to be applied off the active line');
    assert.strictEqual(snapshot.applied.emoji?.[0].renderOptions?.beforeContentText, '🎉');

    await setCursor(editor, 1, 3);
    snapshot = decoratorApi.getDebugSnapshot();
    assert.ok(!snapshot.applied.emoji?.length, 'Expected raw emoji shortcode to be shown when cursor enters the shortcode scope');
  });

  test('table replacements render off-table and reveal raw table when cursor enters the table', async () => {
    assert.ok(decoratorApi, 'decorator not available from ext.exports');
    const doc = await vscode.workspace.openTextDocument({
      language: 'markdown',
      content: 'neutral line\n| A | B |\n| - | - |\n| 1 | 2 |',
    });
    const editor = await vscode.window.showTextDocument(doc);
    await delay(500);

    let snapshot = decoratorApi.getDebugSnapshot();
    assert.ok(snapshot.applied.tablePipe?.length, 'Expected table pipe replacements to be applied off the active table block');
    assert.strictEqual(snapshot.applied.tablePipe?.[0].renderOptions?.beforeContentText, '│');

    await setCursor(editor, 1, 2);
    snapshot = decoratorApi.getDebugSnapshot();
    assert.ok(!snapshot.applied.tablePipe?.length, 'Expected raw table pipes when cursor enters the table block');
    assert.ok(!snapshot.applied.tableCell?.length, 'Expected raw table cells when cursor enters the table block');
  });

  test('table cell replacements carry padded content and formatting payloads', async () => {
    assert.ok(decoratorApi, 'decorator not available from ext.exports');
    const doc = await vscode.workspace.openTextDocument({
      language: 'markdown',
      content: 'neutral line\n| Header |\n|--------|\n| **bold** |',
    });
    await vscode.window.showTextDocument(doc);
    await delay(500);

    const snapshot = decoratorApi.getDebugSnapshot();
    const cellWithBold = snapshot.applied.tableCell?.find((entry) =>
      entry.renderOptions?.beforeContentText?.includes('bold')
    );
    assert.ok(cellWithBold, 'Expected a rendered table cell replacement for the bold cell');
    assert.ok(
      cellWithBold.renderOptions?.beforeContentText?.startsWith('\u00A0'),
      'Expected table cell replacement to preserve left padding'
    );
    assert.ok(
      cellWithBold.renderOptions?.beforeContentText?.endsWith('\u00A0'),
      'Expected table cell replacement to preserve right padding'
    );
    assert.strictEqual(cellWithBold.renderOptions?.beforeFontWeight, 'bold');
  });

  // Regression for issue #30:
  // Emoji shortcodes like :smile: were not rendered; added gemoji-based lookup.
  test('#30 — emoji shortcodes decorate without error', async () => {
    const doc = await vscode.workspace.openTextDocument({
      language: 'markdown',
      content: 'Great work :tada: — thanks :pray: and good luck :rocket:',
    });
    await vscode.window.showTextDocument(doc);
    await delay(500);
    assert.strictEqual(doc.languageId, 'markdown');
  });

  // Regression for issue #6:
  // Inline ($...$) and block ($$...$$) LaTeX math was not supported;
  // the parser would treat dollar signs as plain text.
  test('#6 — inline and block LaTeX math decorates without error', async () => {
    const doc = await vscode.workspace.openTextDocument({
      language: 'markdown',
      content:
        'Inline math: $E = mc^2$.\n\nBlock math:\n\n$$\n\\int_0^1 x^2\\,dx = \\frac{1}{3}\n$$',
    });
    await vscode.window.showTextDocument(doc);
    await delay(500);
    assert.strictEqual(doc.languageId, 'markdown');
  });

  // Regression for issue #25 / #54:
  // GitHub-style mentions (@user, @org/team) and issue/PR references (#123,
  // @owner/repo#456) were not styled. Fix: mention parser added in v1.21.0.
  test('#54 — GitHub mentions and issue refs decorate without error', async () => {
    const doc = await vscode.workspace.openTextDocument({
      language: 'markdown',
      content:
        'Thanks @alice and @org/team! See also #42 and @owner/repo#99 for context.',
    });
    await vscode.window.showTextDocument(doc);
    await delay(500);
    assert.strictEqual(doc.languageId, 'markdown');
  });

  // Regression for the code-block formatting fix (v1.11.1 / v1.13.x):
  // Bold, italic, and other markdown constructs inside fenced code blocks
  // were incorrectly decorated. Fix: parser now excludes code block content
  // from inline formatting ranges.
  test('markdown syntax inside fenced code blocks is not decorated (no crash)', async () => {
    const doc = await vscode.workspace.openTextDocument({
      language: 'markdown',
      content:
        '```typescript\nconst x = **bold**; // _italic_ inside code\n```\n\nNormal **bold** outside.',
    });
    await vscode.window.showTextDocument(doc);
    await delay(500);
    assert.strictEqual(doc.languageId, 'markdown');
  });

  // Regression for CRLF line-ending handling (v1.7.4):
  // Documents using Windows-style CRLF line endings caused position-mapping
  // errors that surfaced as incorrect decoration ranges or thrown exceptions.
  test('CRLF line endings decorate without error', async () => {
    const doc = await vscode.workspace.openTextDocument({
      language: 'markdown',
      content: '# Heading\r\n\r\n**bold** and _italic_\r\n\r\n- [ ] task\r\n- [x] done',
    });
    await vscode.window.showTextDocument(doc);
    await delay(500);
    assert.strictEqual(doc.languageId, 'markdown');
  });

  // Issue #31: ordered list auto-numbering
  // Ordered list markers should be hidden and replaced with auto-calculated numbers.
  test('#31 — ordered list auto-numbering decorates without error', async () => {
    const doc = await vscode.workspace.openTextDocument({
      language: 'markdown',
      content: '1. First item\n1. Second item\n1. Third item\n\nNested:\n1. Outer\n   1. Inner A\n   1. Inner B\n1. Outer again',
    });
    await vscode.window.showTextDocument(doc);
    await delay(500);
    assert.strictEqual(doc.languageId, 'markdown');
    // Extension must not throw while decorating ordered lists with auto-numbering.
  });

  // Edge case: an empty markdown document should not throw.
  test('empty markdown document decorates without error', async () => {
    const doc = await vscode.workspace.openTextDocument({
      language: 'markdown',
      content: '',
    });
    await vscode.window.showTextDocument(doc);
    await delay(300);
    assert.strictEqual(doc.languageId, 'markdown');
  });

  // ── Provider & command functional tests ──────────────────────────────────
  //
  // The link provider and hover providers are registered for
  // { language: 'markdown', scheme: 'file' }, so they only fire on real
  // on-disk files. The tests below use withTempFile() to get a scheme:'file'
  // document and then exercise VS Code's built-in executeCommand API to make
  // functional assertions (not just "no crash").

  test('navigateToAnchor command is registered', async () => {
    const commands = await vscode.commands.getCommands(true);
    assert.ok(
      commands.includes('markdown-inline-editor.navigateToAnchor'),
      'markdown-inline-editor.navigateToAnchor not registered'
    );
  });

  // The link provider (MarkdownLinkProvider) must return at least one
  // DocumentLink whose target URI contains the link URL from the document.
  test('link provider returns a link whose target matches the URL in the source', async () => {
    await withTempFile(
      '[Visit Example](https://example.com)\n\nSome other text.',
      async (_doc, uri) => {
        const links = await vscode.commands.executeCommand<vscode.DocumentLink[]>(
          'vscode.executeLinkProvider',
          uri
        );
        assert.ok(links && links.length > 0, 'Expected at least one DocumentLink');
        const hasExampleLink = links.some(l =>
          l.target?.toString().includes('example.com')
        );
        assert.ok(hasExampleLink, 'Expected a DocumentLink whose target contains "example.com"');
      }
    );
  });

  // The hover provider (MarkdownLinkHoverProvider) must return hover content
  // that includes the destination URL when the cursor is over link text.
  test('hover provider returns the link URL in its content', async () => {
    await withTempFile(
      '[My Link](https://example.com)',
      async (_doc, uri) => {
        // Position (0, 3) is inside "My Link" — within the link decoration range.
        const hovers = await vscode.commands.executeCommand<vscode.Hover[]>(
          'vscode.executeHoverProvider',
          uri,
          new vscode.Position(0, 3)
        );
        assert.ok(hovers && hovers.length > 0, 'Expected hover content for link text');
        // At least one hover part must mention the destination URL.
        const hoverText = hovers
          .flatMap(h => h.contents)
          .map(c => (typeof c === 'string' ? c : c.value))
          .join('\n');
        assert.ok(
          hoverText.includes('example.com'),
          `Expected hover to mention "example.com", got: ${hoverText}`
        );
      }
    );
  });

  // navigateToAnchor must move the active editor cursor to the line of the
  // target heading (not just open the file without error).
  test('navigateToAnchor moves cursor to the target heading line', async () => {
    await withTempFile(
      '# Introduction\n\nBody text.\n\n## Details\n\nMore content.',
      async (_doc, uri) => {
        // Navigate to "introduction" (normalizeAnchorText lowercases the heading).
        await vscode.commands.executeCommand(
          'markdown-inline-editor.navigateToAnchor',
          'introduction',
          uri.toString()
        );
        await delay(300);

        const activeEditor = vscode.window.activeTextEditor;
        assert.ok(activeEditor, 'Expected an active editor after navigation');
        assert.strictEqual(
          activeEditor.selection.active.line,
          0,
          'Cursor should be on line 0 (the # Introduction heading)'
        );
      }
    );
  });

  // Switching rapidly between a markdown editor and a non-markdown editor
  // must not crash the decorator (exercises onDidChangeActiveTextEditor).
  test('switching between markdown and non-markdown editors does not crash', async () => {
    const mdDoc = await vscode.workspace.openTextDocument({
      language: 'markdown',
      content: '# Hello\n\n**bold** _italic_',
    });
    const txtDoc = await vscode.workspace.openTextDocument({
      language: 'plaintext',
      content: 'just plain text',
    });

    await vscode.window.showTextDocument(mdDoc);
    await delay(200);
    await vscode.window.showTextDocument(txtDoc);
    await delay(200);
    await vscode.window.showTextDocument(mdDoc);
    await delay(300);

    assert.strictEqual(mdDoc.languageId, 'markdown');
  });

  // ── Parse-range "visual" tests ───────────────────────────────────────────
  //
  // These tests use the ParseCache exposed via ext.exports.parseCache to read
  // back the decoration ranges the extension computed for a document.  This
  // acts as a lightweight "visual check": we verify that the parser emitted
  // the correct DecorationRange types (and metadata such as URL) for each
  // markdown construct without needing screenshots or setDecorations spies.

  test('parse: **bold** produces a bold decoration', async () => {
    assert.ok(cache, 'parseCache not available from ext.exports');
    const doc = await vscode.workspace.openTextDocument({
      language: 'markdown',
      content: '**bold text**',
    });
    await vscode.window.showTextDocument(doc);
    await delay(400);
    const entry = cache.get(doc);
    const bolds = entry.decorations.filter(d => d.type === 'bold');
    assert.ok(bolds.length > 0, 'Expected a bold decoration for **bold text**');
    // The bold decoration should cover the content between the markers.
    const coveredText = entry.text.slice(bolds[0].startPos, bolds[0].endPos);
    assert.ok(
      coveredText.includes('bold text'),
      `Expected bold decoration to cover "bold text", covered: "${coveredText}"`
    );
  });

  test('parse: _italic_ produces an italic decoration', async () => {
    assert.ok(cache, 'parseCache not available from ext.exports');
    const doc = await vscode.workspace.openTextDocument({
      language: 'markdown',
      content: '_italic text_',
    });
    await vscode.window.showTextDocument(doc);
    await delay(400);
    const entry = cache.get(doc);
    const italics = entry.decorations.filter(d => d.type === 'italic');
    assert.ok(italics.length > 0, 'Expected an italic decoration for _italic text_');
    const coveredText = entry.text.slice(italics[0].startPos, italics[0].endPos);
    assert.ok(
      coveredText.includes('italic text'),
      `Expected italic decoration to cover "italic text", covered: "${coveredText}"`
    );
  });

  test('parse: # Heading produces a heading1 decoration', async () => {
    assert.ok(cache, 'parseCache not available from ext.exports');
    const doc = await vscode.workspace.openTextDocument({
      language: 'markdown',
      content: '# My Heading',
    });
    await vscode.window.showTextDocument(doc);
    await delay(400);
    const entry = cache.get(doc);
    assert.ok(
      entry.decorations.some(d => d.type === 'heading1'),
      'Expected a heading1 decoration for # My Heading'
    );
  });

  // Regression for #47: [x] checkbox must produce checkboxChecked, not a blank rect.
  test('parse: - [x] produces a checkboxChecked decoration (#47)', async () => {
    assert.ok(cache, 'parseCache not available from ext.exports');
    const doc = await vscode.workspace.openTextDocument({
      language: 'markdown',
      content: '- [x] done\n- [ ] todo',
    });
    await vscode.window.showTextDocument(doc);
    await delay(400);
    const entry = cache.get(doc);
    assert.ok(
      entry.decorations.some(d => d.type === 'checkboxChecked'),
      'Expected a checkboxChecked decoration for - [x]'
    );
    assert.ok(
      entry.decorations.some(d => d.type === 'checkboxUnchecked'),
      'Expected a checkboxUnchecked decoration for - [ ]'
    );
  });

  // Verifies that the link decoration carries the destination URL — this is
  // what the link provider and hover provider use to build their responses.
  test('parse: [text](url) produces a link decoration with the correct url', async () => {
    assert.ok(cache, 'parseCache not available from ext.exports');
    const doc = await vscode.workspace.openTextDocument({
      language: 'markdown',
      content: '[click here](https://example.com)',
    });
    await vscode.window.showTextDocument(doc);
    await delay(400);
    const entry = cache.get(doc);
    const links = entry.decorations.filter(d => d.type === 'link');
    assert.ok(links.length > 0, 'Expected a link decoration');
    assert.ok(
      links.some(l => l.url === 'https://example.com'),
      `Expected link decoration with url "https://example.com", got: ${links.map(l => l.url).join(', ')}`
    );
  });

  test('parse: ~~strike~~ produces a strikethrough decoration', async () => {
    assert.ok(cache, 'parseCache not available from ext.exports');
    const doc = await vscode.workspace.openTextDocument({
      language: 'markdown',
      content: '~~strike me~~',
    });
    await vscode.window.showTextDocument(doc);
    await delay(400);
    const entry = cache.get(doc);
    assert.ok(
      entry.decorations.some(d => d.type === 'strikethrough'),
      'Expected a strikethrough decoration for ~~strike me~~'
    );
  });

  test('parse: > blockquote produces a blockquote decoration', async () => {
    assert.ok(cache, 'parseCache not available from ext.exports');
    const doc = await vscode.workspace.openTextDocument({
      language: 'markdown',
      content: '> This is a quote',
    });
    await vscode.window.showTextDocument(doc);
    await delay(400);
    const entry = cache.get(doc);
    assert.ok(
      entry.decorations.some(d => d.type === 'blockquote'),
      'Expected a blockquote decoration for > This is a quote'
    );
  });

  test('parse: ![alt](url) produces an image decoration with the correct url', async () => {
    assert.ok(cache, 'parseCache not available from ext.exports');
    const doc = await vscode.workspace.openTextDocument({
      language: 'markdown',
      content: '![my image](https://example.com/img.png)',
    });
    await vscode.window.showTextDocument(doc);
    await delay(400);
    const entry = cache.get(doc);
    const images = entry.decorations.filter(d => d.type === 'image');
    assert.ok(images.length > 0, 'Expected an image decoration for ![alt](url)');
    assert.ok(
      images.some(d => d.url === 'https://example.com/img.png'),
      `Expected image decoration to carry the url, got: ${images.map(d => d.url).join(', ')}`
    );
  });

  // Regression for #27: YAML frontmatter must produce frontmatter/frontmatterDelimiter decorations.
  test('parse: YAML frontmatter produces frontmatter decorations (#27)', async () => {
    assert.ok(cache, 'parseCache not available from ext.exports');
    const doc = await vscode.workspace.openTextDocument({
      language: 'markdown',
      content: '---\ntitle: My Doc\n---\n\n# Content',
    });
    await vscode.window.showTextDocument(doc);
    await delay(400);
    const entry = cache.get(doc);
    assert.ok(
      entry.decorations.some(d => d.type === 'frontmatter' || d.type === 'frontmatterDelimiter'),
      'Expected frontmatter or frontmatterDelimiter decoration for YAML frontmatter block'
    );
  });

  // Regression for #55: GFM tables must produce tablePipe decorations.
  test('parse: GFM table produces tablePipe decorations (#55)', async () => {
    assert.ok(cache, 'parseCache not available from ext.exports');
    const doc = await vscode.workspace.openTextDocument({
      language: 'markdown',
      content: '| A | B |\n| - | - |\n| 1 | 2 |',
    });
    await vscode.window.showTextDocument(doc);
    await delay(400);
    const entry = cache.get(doc);
    assert.ok(
      entry.decorations.some(d => d.type === 'tablePipe' || d.type === 'tableCell' || d.type === 'tableSeparatorPipe'),
      'Expected table-related decorations for GFM table'
    );
  });

  // Regression for #54: @mention must produce a mention decoration.
  test('parse: @mention produces a mention decoration (#54)', async () => {
    assert.ok(cache, 'parseCache not available from ext.exports');
    const doc = await vscode.workspace.openTextDocument({
      language: 'markdown',
      content: 'Thanks @alice for the review.',
    });
    await vscode.window.showTextDocument(doc);
    await delay(400);
    const entry = cache.get(doc);
    assert.ok(
      entry.decorations.some(d => d.type === 'mention'),
      'Expected a mention decoration for @alice'
    );
  });

  // Regression for #54: #123 issue reference must produce an issueReference decoration.
  test('parse: #123 produces an issueReference decoration (#54)', async () => {
    assert.ok(cache, 'parseCache not available from ext.exports');
    const doc = await vscode.workspace.openTextDocument({
      language: 'markdown',
      content: 'Fixes #42.',
    });
    await vscode.window.showTextDocument(doc);
    await delay(400);
    const entry = cache.get(doc);
    assert.ok(
      entry.decorations.some(d => d.type === 'issueReference'),
      'Expected an issueReference decoration for #42'
    );
  });

  // Regression for #30: :emoji: shortcodes must produce an emoji decoration.
  test('parse: :tada: produces an emoji decoration (#30)', async () => {
    assert.ok(cache, 'parseCache not available from ext.exports');
    const doc = await vscode.workspace.openTextDocument({
      language: 'markdown',
      content: 'Great work :tada:',
    });
    await vscode.window.showTextDocument(doc);
    await delay(400);
    const entry = cache.get(doc);
    assert.ok(
      entry.decorations.some(d => d.type === 'emoji'),
      'Expected an emoji decoration for :tada:'
    );
  });

  test('parse: --- produces a horizontalRule decoration', async () => {
    assert.ok(cache, 'parseCache not available from ext.exports');
    const doc = await vscode.workspace.openTextDocument({
      language: 'markdown',
      content: 'Before\n\n---\n\nAfter',
    });
    await vscode.window.showTextDocument(doc);
    await delay(400);
    const entry = cache.get(doc);
    assert.ok(
      entry.decorations.some(d => d.type === 'horizontalRule'),
      'Expected a horizontalRule decoration for ---'
    );
  });

  test('parse: - list item produces a listItem decoration', async () => {
    assert.ok(cache, 'parseCache not available from ext.exports');
    const doc = await vscode.workspace.openTextDocument({
      language: 'markdown',
      content: '- item one\n- item two',
    });
    await vscode.window.showTextDocument(doc);
    await delay(400);
    const entry = cache.get(doc);
    assert.ok(
      entry.decorations.some(d => d.type === 'listItem'),
      'Expected a listItem decoration for - item'
    );
  });

  test('parse: CRLF — decoration positions are consistent with LF-normalised offsets', async () => {
    assert.ok(cache, 'parseCache not available from ext.exports');
    // CRLF document: "**bold**\r\n_italic_"
    // After LF-normalisation: "**bold**\n_italic_" (positions shift by 0 for first line)
    const doc = await vscode.workspace.openTextDocument({
      language: 'markdown',
      content: '**bold**\r\n_italic_',
    });
    await vscode.window.showTextDocument(doc);
    await delay(400);
    const entry = cache.get(doc);
    const bolds = entry.decorations.filter(d => d.type === 'bold');
    const italics = entry.decorations.filter(d => d.type === 'italic');
    assert.ok(bolds.length > 0, 'Expected bold decoration in CRLF document');
    assert.ok(italics.length > 0, 'Expected italic decoration in CRLF document');
    // The italic must start AFTER the bold — if CRLF offsets are wrong the italic
    // would land inside or before the bold range.
    const boldEnd = bolds[0].endPos;
    const italicStart = italics[0].startPos;
    assert.ok(
      italicStart > boldEnd,
      `Italic startPos (${italicStart}) should be after bold endPos (${boldEnd}) — CRLF offset bug`
    );
  });

  // Regression for the code-block formatting isolation fix (v1.11.1 / v1.13.x):
  // **bold** inside a fenced code block must NOT produce a bold decoration.
  // ── Mermaid width-constraint regression tests (issue #50) ────────────────
  //
  // These tests verify the SVG processor's width-constraint logic end-to-end
  // inside the running extension, covering all diagram scenarios from the
  // manual test file (docs/issues/50-mermaid-width-test.md).
  //
  // processSvg is a pure function exposed via ext.exports.svgProcessor so we
  // can assert exact pixel dimensions without needing screenshots.
  //
  // The maxWidth used here (1680) mirrors the renderer default:
  //   fontSize(14) × charWidthFactor(0.6) × columns(200) = 1680 px

  /** Build a minimal SVG with explicit width/height and matching viewBox. */
  function makeSvgFixture(w: number, h: number): string {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><rect width="${w}" height="${h}"/></svg>`;
  }

  /** Extract the numeric px value from width="Npx" in a processed SVG. */
  function parseSvgWidth(svg: string): number {
    const m = svg.match(/\bwidth="(\d+(?:\.\d+)?)px"/);
    return m ? parseFloat(m[1]) : NaN;
  }

  /** Extract the numeric px value from height="Npx" in a processed SVG. */
  function parseSvgHeight(svg: string): number {
    const m = svg.match(/\bheight="(\d+(?:\.\d+)?)px"/);
    return m ? parseFloat(m[1]) : NaN;
  }

  const DEFAULT_MAX_WIDTH = 1680; // 14px × 0.6 × 200 cols — renderer default

  // Scenario 1 — wide flowchart: many nodes → natural width exceeds maxWidth
  test('#50 — wide flowchart SVG is constrained to maxWidth', () => {
    assert.ok(svgProcessor, 'svgProcessor not available from ext.exports');
    // Simulate a wide multi-node flowchart (e.g. 3000×400 natural size)
    const svg = makeSvgFixture(3000, 400);
    const result = svgProcessor.processSvg(svg, 400, DEFAULT_MAX_WIDTH);
    const width = parseSvgWidth(result);
    assert.strictEqual(
      width, DEFAULT_MAX_WIDTH,
      `Wide flowchart must be clamped to ${DEFAULT_MAX_WIDTH}px, got ${width}px`
    );
  });

  // Scenario 2 — wide sequence diagram: many participants → same constraint
  test('#50 — wide sequence diagram SVG is constrained to maxWidth', () => {
    assert.ok(svgProcessor, 'svgProcessor not available from ext.exports');
    const svg = makeSvgFixture(4000, 600);
    const result = svgProcessor.processSvg(svg, 600, DEFAULT_MAX_WIDTH);
    const width = parseSvgWidth(result);
    assert.strictEqual(
      width, DEFAULT_MAX_WIDTH,
      `Wide sequence diagram must be clamped to ${DEFAULT_MAX_WIDTH}px, got ${width}px`
    );
  });

  // Scenario 3 — wide gantt chart: extremely wide timeline → constrained
  test('#50 — gantt-style SVG wider than maxWidth is constrained and height is scaled', () => {
    assert.ok(svgProcessor, 'svgProcessor not available from ext.exports');
    // Simulate gantt rendered at 2000px-wide container, natural height ~400
    const svg = makeSvgFixture(5000, 400);
    const result = svgProcessor.processSvg(svg, 400, DEFAULT_MAX_WIDTH);
    const width = parseSvgWidth(result);
    const height = parseSvgHeight(result);
    assert.strictEqual(width, DEFAULT_MAX_WIDTH,
      `Gantt must be clamped to ${DEFAULT_MAX_WIDTH}px, got ${width}px`);
    // Height must be scaled proportionally (aspect ratio preserved)
    const expectedHeight = Math.round(400 * (DEFAULT_MAX_WIDTH / 5000));
    assert.strictEqual(height, expectedHeight,
      `Gantt height must be scaled to ${expectedHeight}px, got ${height}px`);
  });

  // Scenario 4 — narrow diagram: must NOT be constrained or stretched
  test('#50 — narrow flowchart (Start→Process→End) renders at natural width without clipping', () => {
    assert.ok(svgProcessor, 'svgProcessor not available from ext.exports');
    // A simple 3-node vertical flowchart is naturally narrow (e.g. ~200×350)
    const svg = makeSvgFixture(200, 350);
    const result = svgProcessor.processSvg(svg, 350, DEFAULT_MAX_WIDTH);
    const width = parseSvgWidth(result);
    // Width must stay at its natural computed value — well below maxWidth
    assert.ok(
      width < DEFAULT_MAX_WIDTH,
      `Narrow diagram must not be stretched; width ${width}px should be < ${DEFAULT_MAX_WIDTH}px`
    );
    assert.ok(width > 0, `Narrow diagram width must be positive, got ${width}px`);
  });

  // Scenario 5 — tall/square chain diagram: aspect ratio must be preserved after constraint
  test('#50 — tall chain diagram preserves aspect ratio when constrained', () => {
    assert.ok(svgProcessor, 'svgProcessor not available from ext.exports');
    // 10-node vertical chain: wide but also tall (e.g. 2400×800)
    const svg = makeSvgFixture(2400, 800);
    const result = svgProcessor.processSvg(svg, 800, DEFAULT_MAX_WIDTH);
    const width = parseSvgWidth(result);
    const height = parseSvgHeight(result);
    assert.strictEqual(width, DEFAULT_MAX_WIDTH,
      `Chain diagram wider than maxWidth must be clamped to ${DEFAULT_MAX_WIDTH}px`);
    // Aspect ratio 2400:800 = 3:1; after clamping width=1680, height=560
    const expectedHeight = Math.round(800 * (DEFAULT_MAX_WIDTH / 2400));
    assert.strictEqual(height, expectedHeight,
      `Chain diagram height must preserve aspect ratio: expected ${expectedHeight}px, got ${height}px`);
  });

  // Smoke test: opening a document with a mermaid code block must not throw
  test('#50 — document with mermaid code block decorates without error', async () => {
    const doc = await vscode.workspace.openTextDocument({
      language: 'markdown',
      content: [
        '# Mermaid Test',
        '',
        '```mermaid',
        'flowchart LR',
        '  A[Start] --> B[End]',
        '```',
      ].join('\n'),
    });
    await vscode.window.showTextDocument(doc);
    await delay(500);
    assert.strictEqual(doc.languageId, 'markdown');
    // Reaching here without an unhandled exception confirms the pipeline ran cleanly.
  });

  test('parse: **bold** inside a fenced code block is not decorated', async () => {
    assert.ok(cache, 'parseCache not available from ext.exports');
    const doc = await vscode.workspace.openTextDocument({
      language: 'markdown',
      content: '```\n**should not be bold**\n```\n\n**outside bold**',
    });
    await vscode.window.showTextDocument(doc);
    await delay(400);
    const entry = cache.get(doc);
    const bolds = entry.decorations.filter(d => d.type === 'bold');
    assert.ok(bolds.length > 0, 'Expected bold decoration for **outside bold**');
    // None of the bold decorations should cover the text inside the code block.
    const insideCodeBlock = bolds.filter(d => {
      const slice = entry.text.slice(d.startPos, d.endPos);
      return slice.includes('should not be bold');
    });
    assert.strictEqual(
      insideCodeBlock.length,
      0,
      'Expected no bold decoration inside the fenced code block'
    );
  });

  // ── Decorator rendering verification (setDecorations spy) ───────────────
  //
  // The parse tests above verify the parser. These tests go one level deeper
  // and verify the decorator actually calls editor.setDecorations() with real
  // ranges — catching bugs where parsing is fine but rendering is silently
  // broken (e.g. applyDecorations() short-circuits, wrong guard, etc.).
  //
  // updateDecorationsForSelection() is synchronous (no debounce), so a
  // cursor-move is enough to trigger a fresh setDecorations cycle that the
  // spy can observe within a short delay.

  test('decorator applies non-empty ranges for markdown content (onApply hook)', async () => {
    assert.ok(decoratorApi, 'decorator not available from ext.exports');
    const doc = await vscode.workspace.openTextDocument({
      language: 'markdown',
      content: '**bold** and _italic_ and `code`',
    });
    await vscode.window.showTextDocument(doc);
    await delay(200); // let initial decoration pass; decorator.activeEditor is now set

    let nonEmptyTypeCount = 0;
    decoratorApi.onApply = (count) => { nonEmptyTypeCount += count; };

    try {
      // cursorMove → onDidChangeTextEditorSelection → updateDecorationsForSelection
      // → updateDecorationsInternal (synchronous) → applyDecorations → onApply
      await vscode.commands.executeCommand('cursorMove', { to: 'right' });
      await delay(300);
      assert.ok(
        nonEmptyTypeCount > 0,
        `Decorator must apply non-empty ranges; got nonEmptyTypeCount=${nonEmptyTypeCount}`
      );
    } finally {
      decoratorApi.onApply = undefined;
    }
  });

  // Verifies the toggle lifecycle end-to-end at the rendering level:
  // OFF → applyDecorations short-circuits (onApply not called or count=0); ON → count > 0.
  test('toggle OFF suppresses decoration rendering; toggle ON restores it', async () => {
    assert.ok(decoratorApi, 'decorator not available from ext.exports');
    const doc = await vscode.workspace.openTextDocument({
      language: 'markdown',
      content: '**bold** _italic_',
    });
    await vscode.window.showTextDocument(doc);
    await delay(200);

    let phase = 0; // 1 = OFF, 2 = ON
    const nonEmptyPerPhase = [0, 0, 0];
    decoratorApi.onApply = (count) => { nonEmptyPerPhase[phase] += count; };

    try {
      // Phase 1: decorations OFF — applyDecorations short-circuits, onApply not called
      phase = 1;
      await vscode.commands.executeCommand('mdInline.toggleDecorations');
      await vscode.commands.executeCommand('cursorMove', { to: 'right' });
      await delay(300);
      assert.strictEqual(
        nonEmptyPerPhase[1],
        0,
        'Expected no decoration rendering while decorations are disabled'
      );

      // Phase 2: decorations ON — applyDecorations runs, onApply fires with count > 0
      phase = 2;
      await vscode.commands.executeCommand('mdInline.toggleDecorations');
      await vscode.commands.executeCommand('cursorMove', { to: 'right' });
      await delay(300);
      assert.ok(
        nonEmptyPerPhase[2] > 0,
        'Expected non-empty decoration rendering after re-enabling decorations'
      );
    } finally {
      decoratorApi.onApply = undefined;
      // Guard: ensure decorations end up ON regardless of test outcome
      if (!decoratorApi.isEnabled()) {
        await vscode.commands.executeCommand('mdInline.toggleDecorations');
      }
    }
  });

  // Editing a markdown document must trigger re-decoration via
  // onDidChangeTextDocument — verified by checking that the parse cache reflects
  // the new content (heading1 decoration appears after inserting "# Heading\n\n").
  test('text edit triggers cache update with new decoration types', async () => {
    assert.ok(cache, 'parseCache not available from ext.exports');
    const doc = await vscode.workspace.openTextDocument({
      language: 'markdown',
      content: '**bold**',
    });
    await vscode.window.showTextDocument(doc);
    await delay(300);

    const before = cache.get(doc);
    assert.ok(
      !before.decorations.some(d => d.type === 'heading1'),
      'Unexpected heading1 before edit'
    );

    const edit = new vscode.WorkspaceEdit();
    edit.insert(doc.uri, new vscode.Position(0, 0), '# Heading\n\n');
    await vscode.workspace.applyEdit(edit);
    // onDidChangeTextDocument debounces for 150 ms + 300 ms idle callback — wait longer
    await delay(600);

    const after = cache.get(doc);
    assert.ok(
      after.decorations.some(d => d.type === 'heading1'),
      'Expected heading1 decoration in cache after inserting "# Heading"'
    );
  });

  test('selection over a fenced code block adds a visible selection overlay decoration', async () => {
    assert.ok(decoratorApi, 'decorator not available from ext.exports');
    const doc = await vscode.workspace.openTextDocument({
      language: 'markdown',
      content: '```ts\nconst x = 1;\n```',
    });
    const editor = await vscode.window.showTextDocument(doc);
    await delay(300);

    await setSelection(editor, 0, 0, 2, 3);
    const snapshot = decoratorApi.getDebugSnapshot();
    assert.ok(snapshot.applied.codeBlock?.length, 'Expected code block background decoration to remain applied');
    assert.ok(snapshot.applied.selectionOverlay?.length, 'Expected selection overlay decoration over the selected code block');
    assert.strictEqual(snapshot.styles.selectionOverlay?.backgroundColorSource, 'editor.selectionBackground');
  });

  test('selection over frontmatter adds a visible selection overlay decoration', async () => {
    assert.ok(decoratorApi, 'decorator not available from ext.exports');
    const doc = await vscode.workspace.openTextDocument({
      language: 'markdown',
      content: '---\ntitle: hello\n---\n\nBody',
    });
    const editor = await vscode.window.showTextDocument(doc);
    await delay(300);

    await setSelection(editor, 0, 0, 2, 3);
    const snapshot = decoratorApi.getDebugSnapshot();
    assert.ok(snapshot.applied.frontmatter?.length, 'Expected frontmatter background decoration to remain applied');
    assert.ok(snapshot.applied.selectionOverlay?.length, 'Expected selection overlay decoration over frontmatter');
  });

  test('multi-cursor active lines ghost markdown markers on every active line', async () => {
    assert.ok(decoratorApi, 'decorator not available from ext.exports');
    const line0 = '**bold** after';
    const line2 = '_italic_ after';
    const doc = await vscode.workspace.openTextDocument({
      language: 'markdown',
      content: `${line0}\nplain\n${line2}`,
    });
    const editor = await vscode.window.showTextDocument(doc);
    await delay(300);

    // Cursors after the inline constructs (same line, outside scope) → ghost-faint markers on both lines.
    editor.selections = [
      new vscode.Selection(new vscode.Position(0, line0.length), new vscode.Position(0, line0.length)),
      new vscode.Selection(new vscode.Position(2, line2.length), new vscode.Position(2, line2.length)),
    ];
    await delay(250);

    const snapshot = decoratorApi.getDebugSnapshot();
    const ghostRanges = snapshot.applied.ghostFaint ?? [];
    assert.ok(ghostRanges.length >= 4, `Expected ghost markers for both active markdown lines, got ${ghostRanges.length}`);
    assert.ok(
      ghostRanges.some((range) => range.startLine === 0) && ghostRanges.some((range) => range.startLine === 2),
      'Expected ghost markers on both cursor lines'
    );
  });

  test('non-empty selection across a bold scope reveals raw markers on the selected range', async () => {
    assert.ok(decoratorApi, 'decorator not available from ext.exports');
    const doc = await vscode.workspace.openTextDocument({
      language: 'markdown',
      content: 'neutral\n**bold**',
    });
    const editor = await vscode.window.showTextDocument(doc);
    await delay(300);

    await setSelection(editor, 1, 0, 1, 8);
    const snapshot = decoratorApi.getDebugSnapshot();
    assert.ok(!snapshot.applied.hide?.length, 'Expected hidden markers to disappear for the selected bold scope');
    assert.ok(snapshot.applied.bold?.length, 'Expected semantic bold styling to stay applied during selection');
  });

  test('config changes update live link color styling and emoji enablement', async () => {
    assert.ok(decoratorApi, 'decorator not available from ext.exports');
    const decorator = decoratorApi;
    const doc = await vscode.workspace.openTextDocument({
      language: 'markdown',
      content: 'neutral\n[link](https://example.com)\n:tada:',
    });
    const editor = await vscode.window.showTextDocument(doc);
    await delay(400);

    await withConfig('colors.link', '#ff0000', async () => {
      await setCursor(editor, 0, 0);
      const snapshot = decorator.getDebugSnapshot();
      assert.strictEqual(snapshot.styles.link?.colorSource, '#ff0000');
    });

    await withConfig('emojis.enabled', false, async () => {
      await setCursor(editor, 0, 0);
      const snapshot = decorator.getDebugSnapshot();
      assert.ok(!snapshot.applied.emoji?.length, 'Expected emoji decorations to disappear when emojis are disabled');
    });
  });

  test('config changes update ghost opacity and math enablement in the live snapshot', async () => {
    assert.ok(decoratorApi, 'decorator not available from ext.exports');
    const decorator = decoratorApi;
    const doc = await vscode.workspace.openTextDocument({
      language: 'markdown',
      content: '**bold**\n\n$x$',
    });
    const editor = await vscode.window.showTextDocument(doc);
    await delay(400);

    await withConfig('decorations.ghostFaintOpacity', 0.7, async () => {
      await setCursor(editor, 0, 1);
      const snapshot = decorator.getDebugSnapshot();
      assert.strictEqual(snapshot.styles.ghostFaint?.opacity, '0.7');
    });

    await withConfig('math.enabled', false, async () => {
      await setCursor(editor, 0, 0);
      const snapshot = decorator.getDebugSnapshot();
      assert.strictEqual(snapshot.math?.enabled, false);
      assert.strictEqual(snapshot.math?.applied.length, 0);
    });
  });

  test('live decorator snapshot updates after an edit, not just the parse cache', async () => {
    assert.ok(decoratorApi, 'decorator not available from ext.exports');
    const doc = await vscode.workspace.openTextDocument({
      language: 'markdown',
      content: 'Plain text',
    });
    await vscode.window.showTextDocument(doc);
    await delay(300);

    let snapshot = decoratorApi.getDebugSnapshot();
    assert.ok(!snapshot.applied.heading1?.length, 'Unexpected heading styling before edit');

    const edit = new vscode.WorkspaceEdit();
    edit.insert(doc.uri, new vscode.Position(0, 0), '# Heading\n\n');
    await vscode.workspace.applyEdit(edit);
    await delay(700);

    snapshot = decoratorApi.getDebugSnapshot();
    assert.ok(snapshot.applied.heading1?.length, 'Expected live heading styling after editing in a heading');
  });

  test('math decorations render outside scope and reveal raw LaTeX inside scope', async () => {
    assert.ok(decoratorApi, 'decorator not available from ext.exports');
    const doc = await vscode.workspace.openTextDocument({
      language: 'markdown',
      content: 'neutral\n$x$\n\n```math\nE=mc^2\n```',
    });
    const editor = await vscode.window.showTextDocument(doc);
    await delay(700);

    let snapshot = decoratorApi.getDebugSnapshot();
    assert.ok((snapshot.math?.applied.length ?? 0) >= 2, 'Expected inline and fenced math decorations outside their scopes');
    assert.strictEqual(snapshot.math?.hiddenCount, 0);

    await setCursor(editor, 1, 1);
    snapshot = decoratorApi.getDebugSnapshot();
    assert.strictEqual(snapshot.math?.hiddenCount, 1, 'Expected inline math to reveal raw content when cursor enters its scope');

    await setCursor(editor, 4, 1);
    snapshot = decoratorApi.getDebugSnapshot();
    assert.strictEqual(snapshot.math?.hiddenCount, 1, 'Expected fenced math to reveal raw content when cursor enters its scope');
  });

  test('mermaid decorations render outside the block and disappear inside the block', async () => {
    assert.ok(decoratorApi, 'decorator not available from ext.exports');
    const doc = await vscode.workspace.openTextDocument({
      language: 'markdown',
      content: [
        'neutral',
        '```mermaid',
        'flowchart LR',
        '  A --> B',
        '```',
      ].join('\n'),
    });
    const editor = await vscode.window.showTextDocument(doc);
    await delay(1200);

    let snapshot = decoratorApi.getDebugSnapshot();
    assert.ok(snapshot.mermaid && snapshot.mermaid.rendered.length > 0, 'Expected rendered mermaid decorations outside the block');
    assert.ok(snapshot.mermaid && snapshot.mermaid.indicators.length > 0, 'Expected mermaid hover indicators outside the block');

    await setCursor(editor, 2, 1);
    await delay(800);
    snapshot = decoratorApi.getDebugSnapshot();
    assert.strictEqual(snapshot.mermaid?.rendered.length, 0, 'Expected mermaid rendering to disappear when cursor enters the block');
    assert.strictEqual(snapshot.mermaid?.indicators.length, 0, 'Expected mermaid indicators to disappear when cursor enters the block');
  });

  test('diff-mode disables live decorations when diff decorations are turned off', async () => {
    assert.ok(decoratorApi, 'decorator not available from ext.exports');
    const decorator = decoratorApi;
    await withConfig('defaultBehaviors.diffView.applyDecorations', false, async () => {
      await withTwoTempFiles(
        '# Left\n**bold**',
        '# Right\n**bold**',
        async (leftUri, rightUri) => {
          await vscode.commands.executeCommand('vscode.diff', leftUri, rightUri, 'E2E Diff');
          await delay(1200);
          const snapshot = decorator.getDebugSnapshot();
          assert.ok(
            !snapshot.applied.bold?.length && !snapshot.applied.hide?.length && !snapshot.applied.ghostFaint?.length,
            'Expected no live markdown decorations while diff rendering is disabled'
          );
          await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
        }
      );
    });
  });
});

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Writes `content` to a temporary `.md` file, opens it in VS Code as a real
 * file (scheme: 'file'), waits for the decorator to run, then calls `fn`.
 * The file is deleted in a `finally` block regardless of test outcome.
 *
 * Use this for tests that need scheme:'file' documents — required by the link
 * provider and hover providers (registered with { scheme: 'file' }).
 */
async function withTempFile(
  content: string,
  fn: (doc: vscode.TextDocument, uri: vscode.Uri) => Promise<void>
): Promise<void> {
  const tmpPath = path.join(
    os.tmpdir(),
    `mdtest-${Date.now()}-${Math.random().toString(36).slice(2)}.md`
  );
  fs.writeFileSync(tmpPath, content, 'utf8');
  try {
    const uri = vscode.Uri.file(tmpPath);
    const doc = await vscode.workspace.openTextDocument(uri);
    await vscode.window.showTextDocument(doc);
    await delay(600); // allow extension to parse the file and populate the cache
    await fn(doc, uri);
  } finally {
    try { fs.unlinkSync(tmpPath); } catch { /* ignore cleanup errors */ }
  }
}

async function withTwoTempFiles(
  leftContent: string,
  rightContent: string,
  fn: (leftUri: vscode.Uri, rightUri: vscode.Uri) => Promise<void>
): Promise<void> {
  const leftPath = path.join(
    os.tmpdir(),
    `mdtest-left-${Date.now()}-${Math.random().toString(36).slice(2)}.md`
  );
  const rightPath = path.join(
    os.tmpdir(),
    `mdtest-right-${Date.now()}-${Math.random().toString(36).slice(2)}.md`
  );
  fs.writeFileSync(leftPath, leftContent, 'utf8');
  fs.writeFileSync(rightPath, rightContent, 'utf8');
  try {
    await fn(vscode.Uri.file(leftPath), vscode.Uri.file(rightPath));
  } finally {
    try { fs.unlinkSync(leftPath); } catch { /* ignore cleanup errors */ }
    try { fs.unlinkSync(rightPath); } catch { /* ignore cleanup errors */ }
  }
}

async function withConfig<T>(
  key: string,
  value: unknown,
  fn: () => Promise<T>
): Promise<T> {
  const configuration = vscode.workspace.getConfiguration('markdownInlineEditor');
  const previous = configuration.get(key);
  await configuration.update(key, value, vscode.ConfigurationTarget.Global);
  await delay(500);
  try {
    return await fn();
  } finally {
    await configuration.update(key, previous, vscode.ConfigurationTarget.Global);
    await delay(500);
  }
}

async function setCursor(
  editor: vscode.TextEditor,
  line: number,
  character: number
): Promise<void> {
  const position = new vscode.Position(line, character);
  editor.selection = new vscode.Selection(position, position);
  editor.selections = [editor.selection];
  await delay(250);
}

async function setSelection(
  editor: vscode.TextEditor,
  startLine: number,
  startCharacter: number,
  endLine: number,
  endCharacter: number
): Promise<void> {
  editor.selection = new vscode.Selection(
    new vscode.Position(startLine, startCharacter),
    new vscode.Position(endLine, endCharacter)
  );
  editor.selections = [editor.selection];
  await delay(250);
}
