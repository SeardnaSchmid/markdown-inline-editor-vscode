import { LinkClickHandler } from "../../link-click-handler";
import { MarkdownParser } from "../../parser";
import { MarkdownParseCache } from "../../markdown-parse-cache";
import {
  TextDocument,
  Uri,
  Position,
  TextEditor,
  Selection,
  workspace,
  commands,
} from "../../test/__mocks__/vscode";

// Mock workspace.getConfiguration
const mockGetConfiguration = jest.fn().mockReturnValue({
  get: jest.fn().mockReturnValue(false),
});

(workspace as any).getConfiguration = mockGetConfiguration;

// Mock commands.executeCommand
const mockExecuteCommand = jest.fn();
(commands as any).executeCommand = mockExecuteCommand;

describe("LinkClickHandler", () => {
  let handler: LinkClickHandler;
  let parseCache: MarkdownParseCache;

  beforeEach(async () => {
    // Create parser and parse cache
    const parser = await MarkdownParser.create();
    parseCache = new MarkdownParseCache(parser);
    // Create handler with parse cache
    handler = new LinkClickHandler(parseCache);
    mockExecuteCommand.mockClear();
  });

  afterEach(() => {
    handler.dispose();
  });

  describe("setEnabled", () => {
    it("should enable click handler", () => {
      handler.setEnabled(true);
      // Handler should be enabled (we can't directly test this, but dispose should work)
      handler.dispose();
    });

    it("should disable click handler", () => {
      handler.setEnabled(true);
      handler.setEnabled(false);
      handler.dispose();
    });

    it("should not re-enable if already enabled", () => {
      handler.setEnabled(true);
      const disposablesBefore = (handler as any).disposables.length;
      handler.setEnabled(true); // Should be no-op
      const disposablesAfter = (handler as any).disposables.length;
      expect(disposablesAfter).toBe(disposablesBefore);
      handler.dispose();
    });
  });

  describe("handleClick", () => {
    it("should not handle clicks when disabled", async () => {
      handler.setEnabled(false);
      const document = new TextDocument(
        Uri.file("/test.md"),
        "markdown",
        1,
        "[link](url)",
      );
      const editor = new TextEditor(document, []);
      const position = new Position(0, 3);

      // Access private method for testing
      await (handler as any).handleClick(editor, position);

      expect(mockExecuteCommand).not.toHaveBeenCalled();
    });

    it("should not handle clicks for non-markdown documents", async () => {
      handler.setEnabled(true);
      const document = new TextDocument(
        Uri.file("/test.txt"),
        "plaintext",
        1,
        "[link](url)",
      );
      const editor = new TextEditor(document, []);
      const position = new Position(0, 3);

      await (handler as any).handleClick(editor, position);

      expect(mockExecuteCommand).not.toHaveBeenCalled();
    });

    it("should handle clicks on links when enabled", async () => {
      handler.setEnabled(true);
      const document = new TextDocument(
        Uri.file("/test.md"),
        "markdown",
        1,
        "[link text](https://example.com)",
      );
      const editor = new TextEditor(document, []);
      const position = new Position(0, 5); // Position inside "link text"

      await (handler as any).handleClick(editor, position);

      // Should attempt to open the link
      expect(mockExecuteCommand).toHaveBeenCalled();
    });

    it("should handle clicks on images when enabled", async () => {
      handler.setEnabled(true);
      const document = new TextDocument(
        Uri.file("/test.md"),
        "markdown",
        1,
        "![alt text](image.png)",
      );
      const editor = new TextEditor(document, []);
      const position = new Position(0, 5); // Position inside "alt text"

      await (handler as any).handleClick(editor, position);

      // Should attempt to open the image
      expect(mockExecuteCommand).toHaveBeenCalled();
    });

    it("should not handle clicks outside link/image range", async () => {
      handler.setEnabled(true);
      const document = new TextDocument(
        Uri.file("/test.md"),
        "markdown",
        1,
        "text [link](url) more text",
      );
      const editor = new TextEditor(document, []);
      const position = new Position(0, 2); // Position in "text", not on link

      await (handler as any).handleClick(editor, position);

      expect(mockExecuteCommand).not.toHaveBeenCalled();
    });

    it("should handle anchor links", async () => {
      handler.setEnabled(true);
      const document = new TextDocument(
        Uri.file("/test.md"),
        "markdown",
        1,
        "[link](#anchor)",
      );
      const editor = new TextEditor(document, []);
      const position = new Position(0, 3);

      await (handler as any).handleClick(editor, position);

      expect(mockExecuteCommand).toHaveBeenCalledWith(
        "markdown-inline-editor.navigateToAnchor",
        "anchor",
        expect.any(String),
      );
    });

    it("should handle external URLs", async () => {
      handler.setEnabled(true);
      const document = new TextDocument(
        Uri.file("/test.md"),
        "markdown",
        1,
        "[link](https://example.com)",
      );
      const editor = new TextEditor(document, []);
      const position = new Position(0, 3);

      await (handler as any).handleClick(editor, position);

      expect(mockExecuteCommand).toHaveBeenCalledWith(
        "vscode.open",
        expect.any(Object),
      );
    });

    it("should handle relative file paths", async () => {
      handler.setEnabled(true);
      const document = new TextDocument(
        Uri.file("/path/to/test.md"),
        "markdown",
        1,
        "[link](./file.md)",
      );
      const editor = new TextEditor(document, []);
      const position = new Position(0, 3);

      await (handler as any).handleClick(editor, position);

      expect(mockExecuteCommand).toHaveBeenCalledWith(
        "vscode.open",
        expect.any(Object),
      );
    });

    it.skip("should handle absolute image paths", async () => {
      handler.setEnabled(true);
      const document = new TextDocument(
        Uri.file("/test.md"),
        "markdown",
        1,
        "![alt](/absolute/path/image.png)",
      );
      const editor = new TextEditor(document, []);
      const position = new Position(0, 5);

      await (handler as any).handleClick(editor, position);

      expect(mockExecuteCommand).toHaveBeenCalledWith(
        "vscode.open",
        expect.any(Object),
      );
    });

    it("should handle external image URLs", async () => {
      handler.setEnabled(true);
      const document = new TextDocument(
        Uri.file("/test.md"),
        "markdown",
        1,
        "![alt](https://example.com/image.png)",
      );
      const editor = new TextEditor(document, []);
      // Position 4 is inside "alt" (positions 2-5, but end is exclusive)
      const position = new Position(0, 4);

      await (handler as any).handleClick(editor, position);

      expect(mockExecuteCommand).toHaveBeenCalledWith(
        "vscode.open",
        expect.any(Object),
      );
    });

    it("should open mention targets when mention links are enabled", async () => {
      mockGetConfiguration.mockReturnValue({
        get: jest.fn((key: string, defaultValue?: unknown) => {
          if (key === "mentions.enabled") return true;
          if (key === "mentions.linksEnabled") return true;
          return defaultValue;
        }),
      });

      handler.setEnabled(true);
      const document = new TextDocument(
        Uri.file("/tmp/test.md"),
        "markdown",
        1,
        "Hello @alice",
      );
      const editor = new TextEditor(document, []);
      const position = new Position(0, 8);

      await (handler as any).handleClick(editor, position);

      expect(mockExecuteCommand).toHaveBeenCalledWith(
        "vscode.open",
        expect.objectContaining({
          toString: expect.any(Function),
        }),
      );
      expect(String(mockExecuteCommand.mock.calls[0][1].toString())).toContain(
        "https://github.com/alice",
      );
    });

    it("should open repo-scoped issue reference targets", async () => {
      mockGetConfiguration.mockReturnValue({
        get: jest.fn((key: string, defaultValue?: unknown) => {
          if (key === "mentions.enabled") return true;
          if (key === "mentions.linksEnabled") return true;
          return defaultValue;
        }),
      });

      handler.setEnabled(true);
      const document = new TextDocument(
        Uri.file("/tmp/test.md"),
        "markdown",
        1,
        "See @owner/repo#42",
      );
      const editor = new TextEditor(document, []);
      const position = new Position(0, 10);

      await (handler as any).handleClick(editor, position);

      expect(mockExecuteCommand).toHaveBeenCalledWith(
        "vscode.open",
        expect.objectContaining({
          toString: expect.any(Function),
        }),
      );
      expect(String(mockExecuteCommand.mock.calls[0][1].toString())).toContain(
        "https://github.com/owner/repo/issues/42",
      );
    });

    it("should not open mention targets when mention links are explicitly disabled", async () => {
      mockGetConfiguration.mockReturnValue({
        get: jest.fn((key: string, defaultValue?: unknown) => {
          if (key === "mentions.enabled") return true;
          if (key === "mentions.linksEnabled") return false;
          return defaultValue;
        }),
      });

      handler.setEnabled(true);
      const document = new TextDocument(
        Uri.file("/tmp/test.md"),
        "markdown",
        1,
        "Hello @alice",
      );
      const editor = new TextEditor(document, []);
      const position = new Position(0, 8);

      await (handler as any).handleClick(editor, position);

      expect(mockExecuteCommand).not.toHaveBeenCalled();
    });

    it("should handle errors gracefully when opening files", async () => {
      handler.setEnabled(true);
      const document = new TextDocument(
        Uri.file("/test.md"),
        "markdown",
        1,
        "[link](./nonexistent.md)",
      );
      const editor = new TextEditor(document, []);
      const position = new Position(0, 3);

      mockExecuteCommand.mockRejectedValueOnce(new Error("File not found"));
      const consoleSpy = jest.spyOn(console, "warn").mockImplementation();

      await (handler as any).handleClick(editor, position);

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe("dispose", () => {
    it("should dispose all event listeners", () => {
      handler.setEnabled(true);
      const disposables = (handler as any).disposables;
      expect(disposables.length).toBeGreaterThan(0);

      handler.dispose();
      // After dispose, the disposables array should be cleared
      expect((handler as any).disposables.length).toBe(0);
    });
  });
});
