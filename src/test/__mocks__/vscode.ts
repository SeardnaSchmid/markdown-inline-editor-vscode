// Mock VS Code API for testing
class MockRange {
  constructor(
    public start: { line: number; character: number },
    public end: { line: number; character: number }
  ) {}

  contains(position: { line: number; character: number }): boolean {
    return (
      (this.start.line < position.line ||
        (this.start.line === position.line && this.start.character <= position.character)) &&
      (this.end.line > position.line ||
        (this.end.line === position.line && this.end.character >= position.character))
    );
  }
  intersection(other: MockRange): MockRange | undefined {
    const start = {
      line: Math.max(this.start.line, other.start.line),
      character: Math.max(this.start.character, other.start.character),
    };
    const end = {
      line: Math.min(this.end.line, other.end.line),
      character: Math.min(this.end.character, other.end.character),
    };
    if (start.line > end.line || (start.line === end.line && start.character > end.character)) {
      return undefined;
    }
    return new MockRange(start, end);
  }
}

export const Range = MockRange as any;

class MockSelection extends MockRange {
  constructor(
    public anchor: { line: number; character: number },
    public active: { line: number; character: number }
  ) {
    super(anchor, active);
  }
  get isEmpty(): boolean {
    return (
      this.anchor.line === this.active.line && this.anchor.character === this.active.character
    );
  }
}

export const Selection = MockSelection as any;

export const Position = class {
  constructor(public line: number, public character: number) {}
};

export const Uri = {
  parse: (value: string) => {
    const schemeMatch = value.match(/^([^:]+):/);
    const scheme = schemeMatch ? schemeMatch[1] : 'file';
    return {
      toString: () => value,
      scheme: scheme,
    };
  },
  file: (path: string) => ({
    toString: () => `file://${path}`,
    scheme: 'file',
  }),
  joinPath: (base: any, ...segments: string[]) => {
    const basePath = base.toString().replace('file://', '');
    const joined = [basePath, ...segments].join('/');
    return {
      toString: () => `file://${joined}`,
      scheme: 'file',
    };
  },
};

class MockTextDocument {
  constructor(
    public uri: ReturnType<typeof Uri.file>,
    public languageId: string,
    public version: number,
    public text: string
  ) {}

  getText(): string {
    return this.text;
  }

  lineAt(line: number): { text: string } {
    // Minimal subset of VS Code's TextDocument.lineAt used by tests.
    // Keep line splitting consistent with offsetAt (treat CRLF as single break).
    const lines = this.text.split(/\r\n|\r|\n/);
    const safeLine = Math.max(0, Math.min(line, Math.max(0, lines.length - 1)));
    return { text: lines[safeLine] ?? '' };
  }

  offsetAt(position: { line: number; character: number }): number {
    // Convert position to offset
    const lines = this.text.split(/\r\n|\r|\n/);
    let offset = 0;
    
    for (let i = 0; i < position.line && i < lines.length; i++) {
      offset += lines[i].length + 1; // +1 for newline
    }
    
    if (position.line < lines.length) {
      offset += Math.min(position.character, lines[position.line].length);
    }
    
    return offset;
  }
  positionAt(offset: number): { line: number; character: number } {
    // Handle CRLF correctly: split on \r\n first, then handle remaining \n and \r
    // This matches VS Code's behavior where \r\n is treated as a single line break
    const textBeforeOffset = this.text.substring(0, offset);
    
    // Count lines by splitting on \r\n (CRLF), then on \n (LF), then on \r (CR)
    // This ensures CRLF is treated as a single line break
    let line = 0;
    let character = 0;
    let i = 0;
    
    while (i < textBeforeOffset.length) {
      // Check for CRLF first (Windows line ending)
      if (i + 1 < textBeforeOffset.length && 
          textBeforeOffset[i] === '\r' && 
          textBeforeOffset[i + 1] === '\n') {
        line++;
        character = 0;
        i += 2; // Skip both \r and \n
      } 
      // Check for LF (Unix line ending)
      else if (textBeforeOffset[i] === '\n') {
        line++;
        character = 0;
        i++;
      }
      // Check for CR (old Mac line ending)
      else if (textBeforeOffset[i] === '\r') {
        line++;
        character = 0;
        i++;
      }
      // Regular character
      else {
        character++;
        i++;
      }
    }
    
    return {
      line,
      character,
    };
  }
}

export const TextDocument = MockTextDocument as any;

class MockTextEditor {
  constructor(
    public document: MockTextDocument,
    public selections: MockSelection[]
  ) {}

  setDecorations(_decorationType: any, _ranges: MockRange[]): void {
    // Mock implementation
  }
}

export const TextEditor = MockTextEditor as any;

export enum ColorThemeKind {
  Light = 1,
  Dark = 2,
  HighContrast = 3,
  HighContrastLight = 4,
}

/** Last options passed to `createTextEditorDecorationType` (for tests that need to assert omit-`color` behavior). */
let lastTextEditorDecorationTypeOptions: unknown;

/** @internal test helper */
export function getLastTextEditorDecorationTypeOptions(): unknown {
  return lastTextEditorDecorationTypeOptions;
}

/** @internal test helper */
export function resetTextEditorDecorationTypeOptionsCapture(): void {
  lastTextEditorDecorationTypeOptions = undefined;
}

export const window = {
  createTextEditorDecorationType: (options: unknown) => {
    lastTextEditorDecorationTypeOptions = options;
    return {};
  },
  activeTextEditor: undefined as any,
  visibleTextEditors: [] as any[],
  activeColorTheme: {
    kind: ColorThemeKind.Dark,
  },
  onDidChangeActiveTextEditor: () => ({ dispose: () => {} }),
  onDidChangeTextEditorSelection: () => ({ dispose: () => {} }),
  onDidChangeActiveColorTheme: () => ({ dispose: () => {} }),
};

export const workspace = {
  onDidChangeTextDocument: () => ({ dispose: () => {} }),
  onDidChangeConfiguration: () => ({ dispose: () => {} }),
  getConfiguration: (section?: string) => ({
    get: <T>(key: string, defaultValue: T): T => {
      // Return default value for all configuration keys in tests
      return defaultValue;
    },
  }),
};

export const ExtensionContext = class {
  subscriptions: Array<{ dispose: () => void }> = [];
};

export const ThemeColor = class {
  constructor(public id: string) {}
};

export const MarkdownString = class {
  public value: string = '';
  public isTrusted: boolean = false;
  public supportHtml: boolean = false;

  constructor(value?: string) {
    if (value) {
      this.value = value;
    }
  }

  appendText(text: string): void {
    this.value += text;
  }

  appendMarkdown(markdown: string): void {
    this.value += markdown;
  }
};

export const Hover = class {
  constructor(
    public contents: typeof MarkdownString | string,
    public range?: any
  ) {}
};

export const CancellationToken = class {
  constructor(public isCancellationRequested: boolean = false) {}
};

export const commands = {
  executeCommand: jest.fn(),
};

export enum TextEditorSelectionChangeKind {
  Mouse = 1,
  Keyboard = 2,
  Command = 3,
}


