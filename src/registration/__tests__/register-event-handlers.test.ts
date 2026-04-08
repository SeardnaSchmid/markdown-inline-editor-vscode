import * as vscode from 'vscode';
import { config } from '../../config';
import { registerEventHandlers } from '../register-event-handlers';

describe('registerEventHandlers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('registers editor, workspace, and theme listeners', () => {
    const decorator = {
      setActiveEditor: jest.fn(),
      updateDecorationsForSelection: jest.fn(),
      updateDecorationsFromChange: jest.fn(),
      renameFile: jest.fn(),
      updateDiffViewDecorationSetting: jest.fn(),
      recreateGhostFaintDecorationType: jest.fn(),
      recreateFrontmatterDelimiterDecorationType: jest.fn(),
      recreateCodeBlockLanguageDecorationType: jest.fn(),
      recreateColorDependentTypes: jest.fn(),
      clearMathDecorationCache: jest.fn(),
    };
    const linkClickHandler = {
      setEnabled: jest.fn(),
    };

    const disposables = registerEventHandlers(decorator as any, linkClickHandler as any);

    expect(disposables).toHaveLength(6);
  });

  it('routes editor and workspace events to the decorator', () => {
    let activeEditorListener: ((editor: vscode.TextEditor | undefined) => void) | undefined;
    let selectionListener:
      | ((event: { kind: vscode.TextEditorSelectionChangeKind }) => void)
      | undefined;
    let documentChangeListener:
      | ((event: { document: vscode.TextDocument }) => void)
      | undefined;
    let renameListener:
      | ((event: { files: Array<{ oldUri: vscode.Uri; newUri: vscode.Uri }> }) => void)
      | undefined;

    vscode.window.onDidChangeActiveTextEditor = jest.fn((listener) => {
      activeEditorListener = listener;
      return { dispose: jest.fn() };
    }) as any;
    vscode.window.onDidChangeTextEditorSelection = jest.fn((listener) => {
      selectionListener = listener;
      return { dispose: jest.fn() };
    }) as any;
    vscode.workspace.onDidChangeTextDocument = jest.fn((listener) => {
      documentChangeListener = listener;
      return { dispose: jest.fn() };
    }) as any;
    vscode.workspace.onDidRenameFiles = jest.fn((listener) => {
      renameListener = listener;
      return { dispose: jest.fn() };
    }) as any;

    const document = new (vscode.TextDocument as any)(
      vscode.Uri.file('/test.md'),
      'markdown',
      1,
      '# Title'
    );
    const editor = new (vscode.TextEditor as any)(document, []);
    (vscode.window as any).activeTextEditor = editor;

    const decorator = {
      setActiveEditor: jest.fn(),
      updateDecorationsForSelection: jest.fn(),
      updateDecorationsFromChange: jest.fn(),
      renameFile: jest.fn(),
      updateDiffViewDecorationSetting: jest.fn(),
      recreateGhostFaintDecorationType: jest.fn(),
      recreateFrontmatterDelimiterDecorationType: jest.fn(),
      recreateCodeBlockLanguageDecorationType: jest.fn(),
      recreateColorDependentTypes: jest.fn(),
      clearMathDecorationCache: jest.fn(),
    };

    registerEventHandlers(decorator as any, { setEnabled: jest.fn() } as any);

    activeEditorListener?.(editor);
    selectionListener?.({ kind: vscode.TextEditorSelectionChangeKind.Mouse });
    documentChangeListener?.({ document });
    renameListener?.({
      files: [{ oldUri: vscode.Uri.file('/old.md'), newUri: vscode.Uri.file('/new.md') }],
    });

    expect(decorator.setActiveEditor).toHaveBeenCalledWith(editor);
    expect(decorator.updateDecorationsForSelection).toHaveBeenCalledWith(
      vscode.TextEditorSelectionChangeKind.Mouse
    );
    expect(decorator.updateDecorationsFromChange).toHaveBeenCalledWith({ document });
    expect(decorator.renameFile).toHaveBeenCalledWith('file:///old.md', 'file:///new.md');
  });

  it('applies configuration and theme changes', () => {
    let configurationListener:
      | ((event: { affectsConfiguration: (section: string) => boolean }) => void)
      | undefined;
    let themeListener: (() => void) | undefined;

    vscode.workspace.onDidChangeConfiguration = jest.fn((listener) => {
      configurationListener = listener;
      return { dispose: jest.fn() };
    }) as any;
    vscode.window.onDidChangeActiveColorTheme = jest.fn((listener) => {
      themeListener = listener;
      return { dispose: jest.fn() };
    }) as any;

    jest.spyOn(config.diffView, 'applyDecorations').mockReturnValue(false);
    jest.spyOn(config.links, 'singleClickOpen').mockReturnValue(true);

    const decorator = {
      setActiveEditor: jest.fn(),
      updateDecorationsForSelection: jest.fn(),
      updateDecorationsFromChange: jest.fn(),
      renameFile: jest.fn(),
      updateDiffViewDecorationSetting: jest.fn(),
      recreateGhostFaintDecorationType: jest.fn(),
      recreateFrontmatterDelimiterDecorationType: jest.fn(),
      recreateCodeBlockLanguageDecorationType: jest.fn(),
      recreateColorDependentTypes: jest.fn(),
      clearMathDecorationCache: jest.fn(),
    };
    const linkClickHandler = {
      setEnabled: jest.fn(),
    };

    registerEventHandlers(decorator as any, linkClickHandler as any);

    const changedKeys = new Set([
      'markdownInlineEditor.defaultBehaviors.diffView.applyDecorations',
      'markdownInlineEditor.decorations.ghostFaintOpacity',
      'markdownInlineEditor.decorations.frontmatterDelimiterOpacity',
      'markdownInlineEditor.decorations.codeBlockLanguageOpacity',
      'markdownInlineEditor.links.singleClickOpen',
      'markdownInlineEditor.colors',
      'editor.fontSize',
      'editor.lineHeight',
    ]);

    configurationListener?.({
      affectsConfiguration: (section: string) => changedKeys.has(section),
    });
    themeListener?.();

    expect(decorator.updateDiffViewDecorationSetting).toHaveBeenCalledWith(true);
    expect(decorator.updateDecorationsForSelection).toHaveBeenCalled();
    expect(decorator.recreateGhostFaintDecorationType).toHaveBeenCalled();
    expect(decorator.recreateFrontmatterDelimiterDecorationType).toHaveBeenCalled();
    expect(decorator.recreateCodeBlockLanguageDecorationType).toHaveBeenCalled();
    expect(linkClickHandler.setEnabled).toHaveBeenCalledWith(true);
    expect(decorator.recreateColorDependentTypes).toHaveBeenCalledTimes(2);
    expect(decorator.clearMathDecorationCache).toHaveBeenCalledTimes(1);
  });
});
