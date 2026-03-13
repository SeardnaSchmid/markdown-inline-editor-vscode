import { Uri } from '../../test/__mocks__/vscode';
import { getGitHubContext, parseGitHubRemoteUrl } from '../../github-context';
import { config } from '../../config';

const mockLinksEnabled = jest.fn();
(config.mentions as any).linksEnabled = mockLinksEnabled;

describe('github-context', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('parseGitHubRemoteUrl', () => {
    it('parses https://github.com/owner/repo', () => {
      const result = parseGitHubRemoteUrl('https://github.com/owner/repo');
      expect(result).toEqual({
        remoteUrl: 'https://github.com/owner/repo',
        owner: 'owner',
        repo: 'repo',
      });
    });

    it('parses https://github.com/owner/repo.git', () => {
      const result = parseGitHubRemoteUrl('https://github.com/owner/repo.git');
      expect(result).toEqual({
        remoteUrl: 'https://github.com/owner/repo.git',
        owner: 'owner',
        repo: 'repo',
      });
    });

    it('parses git@github.com:owner/repo.git', () => {
      const result = parseGitHubRemoteUrl('git@github.com:owner/repo.git');
      expect(result).toEqual({
        remoteUrl: 'git@github.com:owner/repo.git',
        owner: 'owner',
        repo: 'repo',
      });
    });

    it('returns undefined for non-GitHub URL', () => {
      expect(parseGitHubRemoteUrl('https://gitlab.com/owner/repo')).toBeUndefined();
      expect(parseGitHubRemoteUrl('')).toBeUndefined();
    });
  });

  describe('getGitHubContext', () => {
    const workspaceUri = Uri.file('/tmp/workspace');

    it('returns enabled: false when override is false', () => {
      mockLinksEnabled.mockReturnValue(false);
      const result = getGitHubContext(workspaceUri as any);
      expect(result.enabled).toBe(false);
    });

    it('returns enabled: true when override is true (and does not require git)', () => {
      mockLinksEnabled.mockReturnValue(true);
      const result = getGitHubContext(workspaceUri as any);
      expect(result.enabled).toBe(true);
    });

    it('uses config.mentions.linksEnabled() for override', () => {
      mockLinksEnabled.mockReturnValue(undefined);
      getGitHubContext(workspaceUri as any);
      expect(mockLinksEnabled).toHaveBeenCalled();
    });
  });
});
