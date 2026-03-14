import { MarkdownLinkHoverProvider } from "../../link-hover-provider";
import { MarkdownParser } from "../../parser";
import { MarkdownParseCache } from "../../markdown-parse-cache";
import {
  TextDocument,
  Uri,
  Position,
  workspace,
  CancellationToken,
} from "../../test/__mocks__/vscode";

// Mock workspace.getConfiguration
const mockGetConfiguration = jest.fn().mockReturnValue({
  get: jest.fn().mockReturnValue(false),
});

(workspace as any).getConfiguration = mockGetConfiguration;

describe("MarkdownLinkHoverProvider", () => {
  let provider: MarkdownLinkHoverProvider;
  let parseCache: MarkdownParseCache;

  beforeEach(async () => {
    // Create parser and parse cache
    const parser = await MarkdownParser.create();
    parseCache = new MarkdownParseCache(parser);
    // Create provider with parse cache
    provider = new MarkdownLinkHoverProvider(parseCache);
  });

  describe("provideHover", () => {
    it("should return undefined for non-markdown documents", async () => {
      const document = new TextDocument(
        Uri.file("/test.txt"),
        "plaintext",
        1,
        "[link](url)",
      );
      const position = new Position(0, 3);
      const token = new CancellationToken(false);

      const result = await provider.provideHover(document, position, token);
      expect(result).toBeUndefined();
    });

    it("should return hover for link at position", async () => {
      const document = new TextDocument(
        Uri.file("/test.md"),
        "markdown",
        1,
        "[link text](https://example.com)",
      );
      const position = new Position(0, 5); // Position inside "link text"
      const token = new CancellationToken(false);

      mockGetConfiguration.mockReturnValue({
        get: jest.fn((key: string) => {
          if (key === "defaultBehaviors.diffView.applyDecorations")
            return false;
          if (key === "links.singleClickOpen") return false;
          return false;
        }),
      });

      const result = await provider.provideHover(document, position, token);

      expect(result).toBeDefined();
      if (result) {
        expect(result.contents).toBeDefined();
        expect(result.range).toBeDefined();

        const contents = Array.isArray(result.contents)
          ? result.contents[0]
          : result.contents;
        const contentValue = (contents as any).value || contents;
        expect(contentValue).toContain("Link URL:");
        expect(contentValue).toContain("https://example.com");
      }
    });

    it("should return undefined when position is not on link", async () => {
      const document = new TextDocument(
        Uri.file("/test.md"),
        "markdown",
        1,
        "text [link](url) more text",
      );
      const position = new Position(0, 2); // Position in "text", not on link
      const token = new CancellationToken(false);

      const result = await provider.provideHover(document, position, token);
      expect(result).toBeUndefined();
    });

    it("should respect cancellation token", async () => {
      const document = new TextDocument(
        Uri.file("/test.md"),
        "markdown",
        1,
        "[link](url)",
      );
      const position = new Position(0, 3);
      const token = new CancellationToken(true);

      const result = await provider.provideHover(document, position, token);
      expect(result).toBeUndefined();
    });

    it("should skip in diff view when decorations disabled", async () => {
      const document = new TextDocument(
        Uri.parse("git:/test.md"),
        "markdown",
        1,
        "[link](url)",
      );
      const position = new Position(0, 3);
      const token = new CancellationToken(false);

      mockGetConfiguration.mockReturnValue({
        get: jest.fn().mockReturnValue(false),
      });

      const result = await provider.provideHover(document, position, token);
      expect(result).toBeUndefined();
    });

    it("should show direct click disabled message when single-click is off", async () => {
      const document = new TextDocument(
        Uri.file("/test.md"),
        "markdown",
        1,
        "[link](url)",
      );
      const position = new Position(0, 3);
      const token = new CancellationToken(false);

      mockGetConfiguration.mockReturnValue({
        get: jest.fn((key: string) => {
          if (key === "defaultBehaviors.diffView.applyDecorations")
            return false;
          if (key === "links.singleClickOpen") return false;
          return false;
        }),
      });

      const result = await provider.provideHover(document, position, token);

      expect(result).toBeDefined();
      if (result && result.contents) {
        const contents = Array.isArray(result.contents)
          ? result.contents[0]
          : result.contents;
        expect((contents as any).value || contents).toContain(
          "Direct click disabled",
        );
      }
    });

    it("should not show direct click disabled message when single-click is on", async () => {
      const document = new TextDocument(
        Uri.file("/test.md"),
        "markdown",
        1,
        "[link](url)",
      );
      const position = new Position(0, 3);
      const token = new CancellationToken(false);

      mockGetConfiguration.mockReturnValue({
        get: jest.fn((key: string) => {
          if (key === "defaultBehaviors.diffView.applyDecorations")
            return false;
          if (key === "links.singleClickOpen") return true;
          return false;
        }),
      });

      const result = await provider.provideHover(document, position, token);

      expect(result).toBeDefined();
      if (result && result.contents) {
        const contents = Array.isArray(result.contents)
          ? result.contents[0]
          : result.contents;
        expect((contents as any).value || contents).not.toContain(
          "Direct click disabled",
        );
      }
    });

    it("should handle anchor links", async () => {
      const document = new TextDocument(
        Uri.file("/test.md"),
        "markdown",
        1,
        "[link](#anchor)",
      );
      const position = new Position(0, 3);
      const token = new CancellationToken(false);

      const result = await provider.provideHover(document, position, token);
      expect(result).toBeDefined();

      if (result && result.contents) {
        const contents = Array.isArray(result.contents)
          ? result.contents[0]
          : result.contents;
        expect((contents as any).value || contents).toContain("#anchor");
      }
    });

    it("should use cached decorations on second hover", async () => {
      const document = new TextDocument(
        Uri.file("/test.md"),
        "markdown",
        1,
        "[link](url)",
      );
      const position = new Position(0, 3);
      const token = new CancellationToken(false);

      // Access the parser through the parse cache
      const parser = (parseCache as any).parser;
      const extractSpy = jest.spyOn(parser, "extractDecorationsWithScopes");

      // First hover - should parse
      await provider.provideHover(document, position, token);

      // Second hover - should use cache
      await provider.provideHover(document, position, token);

      // Should only parse once (second call uses cache)
      expect(extractSpy).toHaveBeenCalledTimes(1);

      extractSpy.mockRestore();
    });

    it("should return hover for mention with resolved target URL", async () => {
      const document = new TextDocument(
        Uri.file("/tmp/test.md"),
        "markdown",
        1,
        "Hello @alice",
      );
      const position = new Position(0, 8); // Inside @alice
      const token = new CancellationToken(false);

      mockGetConfiguration.mockReturnValue({
        get: jest.fn((key: string, defaultValue?: unknown) => {
          if (key === "mentions.enabled") return true;
          if (key === "mentions.linksEnabled") return true;
          if (key === "defaultBehaviors.diffView.applyDecorations")
            return false;
          if (key === "links.singleClickOpen") return false;
          return defaultValue;
        }),
      });

      const result = await provider.provideHover(document, position, token);
      expect(result).toBeDefined();
      if (result && result.contents) {
        const contents = Array.isArray(result.contents)
          ? result.contents[0]
          : result.contents;
        const contentValue = (contents as any).value || contents;
        expect(contentValue).toContain("Link URL:");
        expect(contentValue).toContain("https://github.com/alice");
      }
    });

    it("should return hover for repo-scoped issue reference", async () => {
      const document = new TextDocument(
        Uri.file("/tmp/test.md"),
        "markdown",
        1,
        "See @owner/repo#42",
      );
      const position = new Position(0, 10); // Inside @owner/repo#42
      const token = new CancellationToken(false);

      mockGetConfiguration.mockReturnValue({
        get: jest.fn((key: string, defaultValue?: unknown) => {
          if (key === "mentions.enabled") return true;
          if (key === "mentions.linksEnabled") return true;
          if (key === "defaultBehaviors.diffView.applyDecorations")
            return false;
          if (key === "links.singleClickOpen") return false;
          return defaultValue;
        }),
      });

      const result = await provider.provideHover(document, position, token);
      expect(result).toBeDefined();
      if (result && result.contents) {
        const contents = Array.isArray(result.contents)
          ? result.contents[0]
          : result.contents;
        const contentValue = (contents as any).value || contents;
        expect(contentValue).toContain("Link URL:");
        expect(contentValue).toContain(
          "https://github.com/owner/repo/issues/42",
        );
      }
    });
  });
});
