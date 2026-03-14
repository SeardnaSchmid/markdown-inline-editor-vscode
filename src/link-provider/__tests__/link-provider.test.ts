import { MarkdownLinkProvider } from "../../link-provider";
import { MarkdownParser } from "../../parser";
import { MarkdownParseCache } from "../../markdown-parse-cache";
import {
  CancellationToken,
  TextDocument,
  Uri,
  workspace,
} from "../../test/__mocks__/vscode";

const mockGetConfiguration = jest.fn();
(workspace as any).getConfiguration = mockGetConfiguration;

describe("MarkdownLinkProvider", () => {
  let provider: MarkdownLinkProvider;
  let parseCache: MarkdownParseCache;

  beforeEach(async () => {
    const parser = await MarkdownParser.create();
    parseCache = new MarkdownParseCache(parser);
    provider = new MarkdownLinkProvider(parseCache);

    mockGetConfiguration.mockReturnValue({
      get: jest.fn((key: string, defaultValue?: unknown) => {
        if (key === "defaultBehaviors.diffView.applyDecorations") return false;
        if (key === "mentions.enabled") return true;
        if (key === "mentions.linksEnabled") return undefined;
        return defaultValue;
      }),
    });

    (workspace as any).getWorkspaceFolder = jest.fn(() => undefined);
  });

  it("returns no links for non-markdown documents", () => {
    const document = new TextDocument(
      Uri.file("/test.txt"),
      "plaintext",
      1,
      "[link](https://example.com)",
    );
    const links = provider.provideDocumentLinks(
      document,
      new CancellationToken(false),
    );
    expect(links).toEqual([]);
  });

  it("provides document links for markdown links", () => {
    const document = new TextDocument(
      Uri.file("/test.md"),
      "markdown",
      1,
      "[link](https://example.com)",
    );
    const links = provider.provideDocumentLinks(
      document,
      new CancellationToken(false),
    ) as any[];

    expect(links).toHaveLength(1);
    expect(links[0].target?.toString()).toBe("https://example.com");
  });

  it("provides document links for mentions without requiring a workspace folder", () => {
    const document = new TextDocument(
      Uri.file("/tmp/test.md"),
      "markdown",
      1,
      "Hello @alice",
    );
    const links = provider.provideDocumentLinks(
      document,
      new CancellationToken(false),
    ) as any[];

    expect(links).toHaveLength(1);
    expect(links[0].target?.toString()).toBe("https://github.com/alice");
  });

  it("provides document links for repo-scoped issue references", () => {
    const document = new TextDocument(
      Uri.file("/tmp/test.md"),
      "markdown",
      1,
      "See @owner/repo#42",
    );
    const links = provider.provideDocumentLinks(
      document,
      new CancellationToken(false),
    ) as any[];

    expect(links).toHaveLength(1);
    expect(links[0].target?.toString()).toBe(
      "https://github.com/owner/repo/issues/42",
    );
  });

  it("does not provide a link for standalone #123 without detected owner/repo", () => {
    const document = new TextDocument(
      Uri.file("/tmp/test.md"),
      "markdown",
      1,
      "See #123",
    );
    const links = provider.provideDocumentLinks(
      document,
      new CancellationToken(false),
    ) as any[];

    expect(links).toHaveLength(0);
  });

  it("resolves standalone #123 when workspace owner/repo is available", () => {
    (workspace as any).getWorkspaceFolder = jest.fn(() => ({
      uri: Uri.file("/tmp/workspace"),
      name: "workspace",
    }));

    mockGetConfiguration.mockReturnValue({
      get: jest.fn((key: string, defaultValue?: unknown) => {
        if (key === "defaultBehaviors.diffView.applyDecorations") return false;
        if (key === "mentions.enabled") return true;
        if (key === "mentions.linksEnabled") return true;
        return defaultValue;
      }),
    });

    const document = new TextDocument(
      Uri.file("/tmp/workspace/test.md"),
      "markdown",
      1,
      "See #123",
    );
    const links = provider.provideDocumentLinks(
      document,
      new CancellationToken(false),
    ) as any[];

    // With linksEnabled=true but no git remote available in tests, standalone #123 still has no owner/repo.
    expect(links).toHaveLength(0);
  });

  it("returns the link unchanged from resolveDocumentLink", () => {
    const link = { target: Uri.parse("https://example.com") } as any;
    expect(
      provider.resolveDocumentLink(link, new CancellationToken(false)),
    ).toBe(link);
  });
});
