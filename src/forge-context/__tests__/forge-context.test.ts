import { Uri } from "../../test/__mocks__/vscode";
import { getForgeContext, parseGitRemoteUrl } from "../../forge-context";
import { config } from "../../config";

const mockLinksEnabled = jest.fn();
(config.mentions as any).linksEnabled = mockLinksEnabled;

describe("forge-context", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("parseGitRemoteUrl", () => {
    it("parses https://github.com/owner/repo", () => {
      const result = parseGitRemoteUrl("https://github.com/owner/repo");
      expect(result).toEqual({
        remoteUrl: "https://github.com/owner/repo",
        webBaseUrl: "https://github.com",
        owner: "owner",
        repo: "repo",
        issuePathSegment: "issues",
      });
    });

    it("parses https://gitlab.com/owner/repo.git", () => {
      const result = parseGitRemoteUrl("https://gitlab.com/owner/repo.git");
      expect(result).toEqual({
        remoteUrl: "https://gitlab.com/owner/repo.git",
        webBaseUrl: "https://gitlab.com",
        owner: "owner",
        repo: "repo",
        issuePathSegment: "-/issues",
      });
    });

    it("parses gitea-style ssh remote", () => {
      const result = parseGitRemoteUrl("git@gitea.example.com:owner/repo.git");
      expect(result).toEqual({
        remoteUrl: "git@gitea.example.com:owner/repo.git",
        webBaseUrl: "https://gitea.example.com",
        owner: "owner",
        repo: "repo",
        issuePathSegment: "issues",
      });
    });

    it("parses localhost remotes and defaults to http base", () => {
      const result = parseGitRemoteUrl("git@localhost:myorg/myrepo.git");
      expect(result).toEqual({
        remoteUrl: "git@localhost:myorg/myrepo.git",
        webBaseUrl: "http://localhost",
        owner: "myorg",
        repo: "myrepo",
        issuePathSegment: "issues",
      });
    });

    it("parses ssh://git@host/owner/repo.git", () => {
      const result = parseGitRemoteUrl(
        "ssh://git@git.example.com/owner/repo.git",
      );
      expect(result).toEqual({
        remoteUrl: "ssh://git@git.example.com/owner/repo.git",
        webBaseUrl: "https://git.example.com",
        owner: "owner",
        repo: "repo",
        issuePathSegment: "issues",
      });
    });

    it("returns undefined for malformed or incomplete URLs", () => {
      expect(parseGitRemoteUrl("https://example.com/owner")).toBeUndefined();
      expect(parseGitRemoteUrl("")).toBeUndefined();
    });
  });

  describe("getForgeContext", () => {
    const workspaceUri = Uri.file("/tmp/workspace");

    it("returns enabled: false only when linksEnabled is explicitly false", () => {
      mockLinksEnabled.mockReturnValue(false);
      const result = getForgeContext(workspaceUri as any);
      expect(result.enabled).toBe(false);
    });

    it("returns enabled: true when linksEnabled is not set (even without a git remote)", () => {
      mockLinksEnabled.mockReturnValue(undefined);
      const result = getForgeContext(workspaceUri as any);
      expect(result.enabled).toBe(true);
    });

    it("returns enabled: true when linksEnabled is explicitly true", () => {
      mockLinksEnabled.mockReturnValue(true);
      const result = getForgeContext(workspaceUri as any);
      expect(result.enabled).toBe(true);
    });

    it("always provides a webBaseUrl defaulting to github.com when no remote is found", () => {
      mockLinksEnabled.mockReturnValue(undefined);
      const result = getForgeContext(workspaceUri as any);
      expect(result.webBaseUrl).toBeTruthy();
    });

    it("uses config.mentions.linksEnabled() for override", () => {
      mockLinksEnabled.mockReturnValue(undefined);
      getForgeContext(workspaceUri as any);
      expect(mockLinksEnabled).toHaveBeenCalled();
    });
  });
});
