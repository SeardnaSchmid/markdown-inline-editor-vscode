import { MarkdownImageHoverProvider } from '../../image-hover-provider';
import { MarkdownParser } from '../../parser';
import { MarkdownParseCache } from '../../markdown-parse-cache';
import { TextDocument, Uri, Position, workspace, CancellationToken } from '../../test/__mocks__/vscode';

// Mock workspace.getConfiguration
const mockGetConfiguration = vi.fn().mockReturnValue({
  get: vi.fn().mockReturnValue(false),
});

(workspace as any).getConfiguration = mockGetConfiguration;

describe('MarkdownImageHoverProvider', () => {
  let provider: MarkdownImageHoverProvider;
  let parseCache: MarkdownParseCache;

  beforeEach(async () => {
    // Create parser and parse cache
    const parser = await MarkdownParser.create();
    parseCache = new MarkdownParseCache(parser);
    // Create provider with parse cache
    provider = new MarkdownImageHoverProvider(parseCache);
  });

  describe('provideHover', () => {
    it('should return undefined for non-markdown documents', async () => {
      const document = new TextDocument(Uri.file('/test.txt'), 'plaintext', 1, '![alt](image.png)');
      // Position 4 is inside "alt"
      const position = new Position(0, 4);
      const token = new CancellationToken(false);

      const result = await provider.provideHover(document, position, token);
      expect(result).toBeUndefined();
    });

    it('should return hover for image at position', async () => {
      const document = new TextDocument(Uri.file('/test.md'), 'markdown', 1, '![alt text](image.png)');
      // Position 6 is inside "alt text" (positions 2-10, but end is exclusive)
      const position = new Position(0, 6);
      const token = new CancellationToken(false);

      mockGetConfiguration.mockReturnValue({
        get: vi.fn((key: string) => {
          if (key === 'defaultBehaviors.diffView.applyDecorations') return false;
          if (key === 'links.singleClickOpen') return false;
          return false;
        }),
      });

      const result = await provider.provideHover(document, position, token);
      
      expect(result).toBeDefined();
      if (result) {
        expect(result.contents).toBeDefined();
        expect(result.range).toBeDefined();
      }
    });

    it('should return undefined when position is not on image', async () => {
      const document = new TextDocument(Uri.file('/test.md'), 'markdown', 1, 'text ![alt](image.png) more text');
      const position = new Position(0, 2); // Position in "text", not on image
      const token = new CancellationToken(false);

      const result = await provider.provideHover(document, position, token);
      expect(result).toBeUndefined();
    });

    it('should handle images with inline formatting in alt text', async () => {
      const document = new TextDocument(Uri.file('/test.md'), 'markdown', 1, '![**Bold** alt](image.png)');
      // Position 7 is inside "Bold" (which is positions 4-8 after ![**)
      const position = new Position(0, 7);
      const token = new CancellationToken(false);

      const result = await provider.provideHover(document, position, token);
      expect(result).toBeDefined();
    });

    it('should respect cancellation token', async () => {
      const document = new TextDocument(Uri.file('/test.md'), 'markdown', 1, '![alt](image.png)');
      // Position 4 is inside "alt"
      const position = new Position(0, 4);
      const token = new CancellationToken(true);

      const result = await provider.provideHover(document, position, token);
      expect(result).toBeUndefined();
    });

    it('should skip in diff view when decorations disabled', async () => {
      const document = new TextDocument(Uri.parse('git:/test.md'), 'markdown', 1, '![alt](image.png)');
      // Position 4 is inside "alt"
      const position = new Position(0, 4);
      const token = new CancellationToken(false);

      mockGetConfiguration.mockReturnValue({
        get: vi.fn().mockReturnValue(false),
      });

      const result = await provider.provideHover(document, position, token);
      expect(result).toBeUndefined();
    });

    it('should show direct click disabled message when single-click is off', async () => {
      const document = new TextDocument(Uri.file('/test.md'), 'markdown', 1, '![alt](image.png)');
      // Position 4 is inside "alt" (positions 2-5, but end is exclusive so use 4)
      const position = new Position(0, 4);
      const token = new CancellationToken(false);

      mockGetConfiguration.mockReturnValue({
        get: vi.fn((key: string) => {
          if (key === 'defaultBehaviors.diffView.applyDecorations') return false;
          if (key === 'links.singleClickOpen') return false;
          return false;
        }),
      });

      const result = await provider.provideHover(document, position, token);
      
      expect(result).toBeDefined();
      if (result && result.contents) {
        const contents = Array.isArray(result.contents) ? result.contents[0] : result.contents;
        expect((contents as any).value || contents).toContain('Direct click disabled');
      }
    });

    it('should not show direct click disabled message when single-click is on', async () => {
      const document = new TextDocument(Uri.file('/test.md'), 'markdown', 1, '![alt](image.png)');
      // Position 4 is inside "alt" (positions 2-5, but end is exclusive so use 4)
      const position = new Position(0, 4);
      const token = new CancellationToken(false);

      mockGetConfiguration.mockReturnValue({
        get: vi.fn((key: string) => {
          if (key === 'defaultBehaviors.diffView.applyDecorations') return false;
          if (key === 'links.singleClickOpen') return true;
          return false;
        }),
      });

      const result = await provider.provideHover(document, position, token);
      
      expect(result).toBeDefined();
      if (result && result.contents) {
        const contents = Array.isArray(result.contents) ? result.contents[0] : result.contents;
        expect((contents as any).value || contents).not.toContain('Direct click disabled');
      }
    });

    it('should handle absolute image paths', async () => {
      const document = new TextDocument(Uri.file('/test.md'), 'markdown', 1, '![alt](/absolute/path/image.png)');
      // Position 4 is inside "alt" (which is positions 2-5, 0-indexed after ![)
      const position = new Position(0, 4);
      const token = new CancellationToken(false);

      const result = await provider.provideHover(document, position, token);
      expect(result).toBeDefined();
    });

    it('should handle external image URLs', async () => {
      const document = new TextDocument(Uri.file('/test.md'), 'markdown', 1, '![alt](https://example.com/image.png)');
      // Position 4 is inside "alt" (which is positions 2-5, 0-indexed after ![)
      const position = new Position(0, 4);
      const token = new CancellationToken(false);

      const result = await provider.provideHover(document, position, token);
      expect(result).toBeDefined();
    });

    it('should use cached decorations on second hover', async () => {
      const document = new TextDocument(Uri.file('/test.md'), 'markdown', 1, '![alt](image.png)');
      // Position 4 is inside "alt"
      const position = new Position(0, 4);
      const token = new CancellationToken(false);

      // Access the parser through the parse cache
      const parser = (parseCache as any).parser;
      const extractSpy = vi.spyOn(parser, 'extractDecorationsWithScopes');
      
      // First hover - should parse
      await provider.provideHover(document, position, token);
      
      // Second hover - should use cache
      await provider.provideHover(document, position, token);
      
      // Should only parse once (second call uses cache)
      expect(extractSpy).toHaveBeenCalledTimes(1);
      
      extractSpy.mockRestore();
    });
  });
});
