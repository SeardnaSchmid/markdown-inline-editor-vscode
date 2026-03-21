import { MarkdownParser } from "../../parser";
import { workspace } from "../../test/__mocks__/vscode";

describe("MarkdownParser - Mentions and Issue References", () => {
  let parser: MarkdownParser;

  beforeEach(async () => {
    parser = await MarkdownParser.create();
  });

  describe("@username mention", () => {
    it("should detect simple @username", () => {
      const markdown = "Hello @alice, welcome!";
      const result = parser.extractDecorations(markdown);
      const mention = result.find(
        (d) => d.type === "mention" && d.slug === "alice",
      );
      expect(mention).toBeDefined();
      expect(markdown.slice(mention!.startPos, mention!.endPos)).toBe("@alice");
    });

    it("should detect @user-name with hyphen", () => {
      const markdown = "See @user-name here";
      const result = parser.extractDecorations(markdown);
      const mention = result.find(
        (d) => d.type === "mention" && d.slug === "user-name",
      );
      expect(mention).toBeDefined();
      expect(markdown.slice(mention!.startPos, mention!.endPos)).toBe(
        "@user-name",
      );
    });

    it("should detect @a1 alphanumeric", () => {
      const markdown = "User @a1 reported";
      const result = parser.extractDecorations(markdown);
      const mention = result.find(
        (d) => d.type === "mention" && d.slug === "a1",
      );
      expect(mention).toBeDefined();
    });

    it("should not treat @-foo as mention (no leading hyphen)", () => {
      const markdown = "Text @-foo bar";
      const result = parser.extractDecorations(markdown);
      const mention = result.find((d) => d.type === "mention");
      expect(mention).toBeUndefined();
    });

    it("should not treat @user_name as mention (underscore not allowed)", () => {
      const markdown = "Text @user_name here";
      const result = parser.extractDecorations(markdown);
      const mention = result.find(
        (d) => d.type === "mention" && d.slug === "user_name",
      );
      expect(mention).toBeUndefined();
      expect(result.some((d) => d.type === "mention")).toBe(false);
    });
  });

  describe("#123 issue reference", () => {
    it("should detect #123", () => {
      const markdown = "See issue #123 for details";
      const result = parser.extractDecorations(markdown);
      const ref = result.find(
        (d) => d.type === "issueReference" && d.issueNumber === 123,
      );
      expect(ref).toBeDefined();
      expect(markdown.slice(ref!.startPos, ref!.endPos)).toBe("#123");
    });

    it("should detect #1", () => {
      const markdown = "Issue #1";
      const result = parser.extractDecorations(markdown);
      const ref = result.find(
        (d) => d.type === "issueReference" && d.issueNumber === 1,
      );
      expect(ref).toBeDefined();
    });

    it("should detect #456 in middle of text", () => {
      const markdown = "Fix in #456 and #789";
      const result = parser.extractDecorations(markdown);
      const ref456 = result.find(
        (d) => d.type === "issueReference" && d.issueNumber === 456,
      );
      const ref789 = result.find(
        (d) => d.type === "issueReference" && d.issueNumber === 789,
      );
      expect(ref456).toBeDefined();
      expect(ref789).toBeDefined();
    });
  });

  describe("@org/team mention", () => {
    it("should not treat @org/team as mention when immediately followed by #", () => {
      // @org/team# is the prefix of a repo-scoped issue ref; org/team alone should not be emitted
      const markdown = "See @org/team#42";
      const result = parser.extractDecorations(markdown);
      const orgTeamMention = result.find(
        (d) => d.type === "mention" && d.slug === "org/team",
      );
      expect(orgTeamMention).toBeUndefined();
      // The full @org/team#42 should be an issueReference
      const ref = result.find(
        (d) => d.type === "issueReference" && d.issueNumber === 42,
      );
      expect(ref).toBeDefined();
    });

    it("should detect @org/team", () => {
      const markdown = "Notify @org/team please";
      const result = parser.extractDecorations(markdown);
      const mention = result.find(
        (d) => d.type === "mention" && d.slug === "org/team",
      );
      expect(mention).toBeDefined();
      expect(markdown.slice(mention!.startPos, mention!.endPos)).toBe(
        "@org/team",
      );
    });

    it("should detect @my-org/team-name", () => {
      const markdown = "CC @my-org/team-name";
      const result = parser.extractDecorations(markdown);
      const mention = result.find(
        (d) => d.type === "mention" && d.slug === "my-org/team-name",
      );
      expect(mention).toBeDefined();
    });
  });

  describe("@user/repo#456 repo-scoped issue", () => {
    it("should detect @owner/repo#42 as single issueReference", () => {
      const markdown = "See @owner/repo#42";
      const result = parser.extractDecorations(markdown);
      const ref = result.find(
        (d) =>
          d.type === "issueReference" &&
          d.issueNumber === 42 &&
          d.ownerRepo === "owner/repo",
      );
      expect(ref).toBeDefined();
      expect(markdown.slice(ref!.startPos, ref!.endPos)).toBe("@owner/repo#42");
      // Should not have a separate mention for @owner/repo
      const mentionOnly = result.filter(
        (d) => d.type === "mention" && d.slug === "owner/repo",
      );
      expect(mentionOnly.length).toBe(0);

      // Should not have any partial org/team mention from backtracking (e.g. @owner/rep)
      const partialMentions = result.filter(
        (d) =>
          d.type === "mention" &&
          typeof d.slug === "string" &&
          d.slug.startsWith("owner/"),
      );
      expect(partialMentions.length).toBe(0);

      // Should not duplicate #42 as a second standalone issueReference
      const issueRefs42 = result.filter(
        (d) => d.type === "issueReference" && d.issueNumber === 42,
      );
      expect(issueRefs42.length).toBe(1);
    });
  });

  describe("email exclusion", () => {
    it("should not emit mention for email-like pattern", () => {
      const markdown = "Contact user@domain.com for help";
      const result = parser.extractDecorations(markdown);
      const mention = result.find((d) => d.type === "mention");
      expect(mention).toBeUndefined();
    });

    it("should not emit mention for foo@bar.baz", () => {
      const markdown = "Email: foo@bar.baz";
      const result = parser.extractDecorations(markdown);
      const mention = result.find((d) => d.type === "mention");
      expect(mention).toBeUndefined();
    });
  });

  describe("code block exclusion", () => {
    it("should not detect @user inside fenced code block", () => {
      const markdown = "```\n@alice and #99\n```";
      const result = parser.extractDecorations(markdown);
      const mention = result.find((d) => d.type === "mention");
      const ref = result.find((d) => d.type === "issueReference");
      expect(mention).toBeUndefined();
      expect(ref).toBeUndefined();
    });

    it("should not detect @user inside inline code", () => {
      const markdown = "Use `@config` in your setup";
      const result = parser.extractDecorations(markdown);
      const mention = result.find((d) => d.type === "mention");
      expect(mention).toBeUndefined();
    });

    it("should detect mention outside code block", () => {
      const markdown = "```\ncode\n```\nThanks @alice!";
      const result = parser.extractDecorations(markdown);
      const mention = result.find(
        (d) => d.type === "mention" && d.slug === "alice",
      );
      expect(mention).toBeDefined();
    });
  });

  describe("scopes for reveal-on-select", () => {
    it("should emit scopes for mention and issueReference", () => {
      const markdown = "See @alice and #42";
      const result = parser.extractDecorationsWithScopes(markdown);
      const mentionDec = result.decorations.find((d) => d.type === "mention");
      const refDec = result.decorations.find(
        (d) => d.type === "issueReference",
      );
      expect(mentionDec).toBeDefined();
      expect(refDec).toBeDefined();
      const scopeTexts = result.scopes.map((s) =>
        markdown.slice(s.startPos, s.endPos),
      );
      expect(scopeTexts.some((t) => t === "@alice")).toBe(true);
      expect(scopeTexts.some((t) => t === "#42")).toBe(true);
    });

    it("each mention and issueReference decoration should have a matching scope (reveal-on-select)", () => {
      const markdown =
        "Contact @alice about #1 and @org/team or @owner/repo#99";
      const result = parser.extractDecorationsWithScopes(markdown);
      const mentionAndRefDecs = result.decorations.filter(
        (d) => d.type === "mention" || d.type === "issueReference",
      );
      for (const dec of mentionAndRefDecs) {
        const hasOverlappingScope = result.scopes.some(
          (s) => s.startPos <= dec.startPos && s.endPos >= dec.endPos,
        );
        expect(hasOverlappingScope).toBe(true);
      }
    });
  });

  describe("multiple refs in same paragraph", () => {
    it("should emit separate decorations for @alice and #42", () => {
      const markdown = "See @alice and #42 and also @bob and #99";
      const result = parser.extractDecorations(markdown);
      const mentions = result.filter((d) => d.type === "mention");
      const refs = result.filter((d) => d.type === "issueReference");
      expect(mentions.length).toBe(2);
      expect(refs.length).toBe(2);
      expect(mentions.some((d) => d.slug === "alice")).toBe(true);
      expect(mentions.some((d) => d.slug === "bob")).toBe(true);
      expect(refs.some((d) => d.issueNumber === 42)).toBe(true);
      expect(refs.some((d) => d.issueNumber === 99)).toBe(true);
    });
  });

  describe("mentions.enabled = false", () => {
    const originalGetConfiguration = workspace.getConfiguration;

    beforeEach(() => {
      (workspace as any).getConfiguration = jest.fn().mockReturnValue({
        get: (key: string, defaultValue: unknown) => {
          if (key === "mentions.enabled") return false;
          return defaultValue;
        },
      });
    });

    afterEach(() => {
      (workspace as any).getConfiguration = originalGetConfiguration;
    });

    it("should emit no mention or issueReference decorations when mentions.enabled is false", () => {
      const markdown = "Hello @alice and see #42 and @org/team and @owner/repo#99";
      const result = parser.extractDecorations(markdown);
      expect(result.some((d) => d.type === "mention")).toBe(false);
      expect(result.some((d) => d.type === "issueReference")).toBe(false);
    });
  });

  describe("large file", () => {
    it("should handle mention/ref scan on >10k line document without hanging", () => {
      const line = "Line with @user and #1\n";
      const lines = Array.from({ length: 10001 }, (_, i) =>
        i === 5000 ? "Check @alice and #42 here\n" : line,
      );
      const markdown = lines.join("");
      const result = parser.extractDecorations(markdown);
      const mention = result.find(
        (d) => d.type === "mention" && d.slug === "alice",
      );
      const ref = result.find(
        (d) => d.type === "issueReference" && d.issueNumber === 42,
      );
      expect(mention).toBeDefined();
      expect(ref).toBeDefined();
    });
  });
});
