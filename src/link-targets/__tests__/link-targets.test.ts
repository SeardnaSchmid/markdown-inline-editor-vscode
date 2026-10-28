import { Uri } from "../../test/__mocks__/vscode";
import {
  resolveImageTarget,
  resolveIssueRefTarget,
  resolveLinkTarget,
  resolveMentionTarget,
  toCommandUri,
} from "../../link-targets";

describe("link-targets", () => {
  const documentUri = Uri.file("/path/to/document.md");

  describe("resolveImageTarget", () => {
    it("resolves absolute filesystem paths", () => {
      const result = resolveImageTarget(
        "/absolute/path/image.png",
        documentUri as any,
      );
      expect(result?.scheme).toBe("file");
    });

    it("resolves relative paths", () => {
      const result = resolveImageTarget("image.png", documentUri as any);
      expect(result?.toString()).toContain("image.png");
    });

    it("resolves external URLs", () => {
      const result = resolveImageTarget(
        "https://example.com/image.png",
        documentUri as any,
      );
      expect(result?.scheme).toBe("https");
    });
  });

  describe("resolveLinkTarget", () => {
    it("creates command targets for anchors", () => {
      const result = resolveLinkTarget("#heading-1", documentUri as any);
      expect(result?.kind).toBe("command");
    });

    it("resolves http URLs", () => {
      const result = resolveLinkTarget(
        "https://example.com",
        documentUri as any,
      );
      expect(result?.kind).toBe("uri");
    });

    it("resolves absolute file paths", () => {
      const result = resolveLinkTarget(
        "/absolute/path/file.md",
        documentUri as any,
      );
      expect(result?.kind).toBe("uri");
      expect(result?.uri.toString()).toContain("/absolute/path/file.md");
    });

    it("resolves relative paths", () => {
      const result = resolveLinkTarget("relative.md", documentUri as any);
      expect(result?.kind).toBe("uri");
      expect(result?.uri.toString()).toContain("relative.md");
    });

    it("creates command targets for relative paths with heading anchors", () => {
      const result = resolveLinkTarget("./foo.md#test", documentUri as any);
      expect(result?.kind).toBe("command");
      if (result?.kind === "command") {
        expect(result.command).toBe("markdown-inline-editor.navigateToAnchor");
        expect(result.args[0]).toBe("test");
        expect(result.args[1]).toContain("foo.md");
        expect(result.args[1]).not.toContain("#test");
      }
    });

    it("creates command targets for absolute file paths with heading anchors", () => {
      const result = resolveLinkTarget("/absolute/path/file.md#section", documentUri as any);
      expect(result?.kind).toBe("command");
      if (result?.kind === "command") {
        expect(result.command).toBe("markdown-inline-editor.navigateToAnchor");
        expect(result.args[0]).toBe("section");
        expect(result.args[1]).toContain("/absolute/path/file.md");
        expect(result.args[1]).not.toContain("#section");
      }
    });
  });

  describe("toCommandUri", () => {
    it("encodes command uris with args", () => {
      const uri = toCommandUri("command.test", ["a", "b"]);
      expect(uri.toString()).toContain("command:command.test");
    });
  });

  describe("mention and issue targets", () => {
    it("resolves mentions against custom forge base URL", () => {
      const result = resolveMentionTarget(
        "alice",
        "https://gitlab.example.com",
      );
      expect(result?.toString()).toBe("https://gitlab.example.com/alice");
    });

    it("resolves issue references with default path segment", () => {
      const result = resolveIssueRefTarget(
        "owner",
        "repo",
        42,
        "https://gitea.example.com",
      );
      expect(result?.toString()).toBe(
        "https://gitea.example.com/owner/repo/issues/42",
      );
    });

    it("resolves issue references with gitlab path segment", () => {
      const result = resolveIssueRefTarget(
        "owner",
        "repo",
        42,
        "https://gitlab.example.com",
        "-/issues",
      );
      expect(result?.toString()).toBe(
        "https://gitlab.example.com/owner/repo/-/issues/42",
      );
    });
  });
});
