import { config } from '../../config';
import { MarkdownParser } from '../../parser';

describe('heading nest decorations', () => {
  let parser: MarkdownParser;

  beforeEach(async () => {
    parser = await MarkdownParser.create();
    vi.spyOn(config.headings.nest, 'enabled').mockReturnValue(true);
    vi.spyOn(config.headings.nest, 'nestContent').mockReturnValue(true);
    vi.spyOn(config.headings.nest, 'maxLevel').mockReturnValue(6);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('adds headingNest with nestSteps for heading lines by depth', () => {
    const text = '# One\n\n## Two\n\n### Three\n';
    const decs = parser.extractDecorations(text);
    const nests = decs.filter((d) => d.type === 'headingNest');
    const headingLineNests = nests.filter((d) => text.slice(d.startPos, d.endPos).startsWith('#'));
    expect(nests.some((d) => d.nestSteps === 0)).toBe(false);
    expect(headingLineNests.filter((d) => d.nestSteps === 1)).toHaveLength(1);
    expect(headingLineNests.filter((d) => d.nestSteps === 2)).toHaveLength(1);
  });

  it('indents body lines when nestContent is true', () => {
    const text = '## H\n\nbody line\n\n# H1\n';
    const decs = parser.extractDecorations(text);
    const nests = decs.filter((d) => d.type === 'headingNest');
    const bodyNest = nests.find((d) => {
      const snippet = text.slice(d.startPos, d.endPos);
      return snippet === 'body line';
    });
    expect(bodyNest).toBeDefined();
    expect(bodyNest!.nestSteps).toBe(1);
  });

  it('does not add headingNest when disabled', () => {
    vi.spyOn(config.headings.nest, 'enabled').mockReturnValue(false);
    const text = '## Two\npara\n';
    const decs = parser.extractDecorations(text);
    expect(decs.some((d) => d.type === 'headingNest')).toBe(false);
  });

  it('does not nest body when nestContent is false', () => {
    vi.spyOn(config.headings.nest, 'nestContent').mockReturnValue(false);
    const text = '## H\n\nbody\n';
    const decs = parser.extractDecorations(text);
    const nests = decs.filter((d) => d.type === 'headingNest');
    expect(nests.length).toBe(1);
    expect(text.slice(nests[0].startPos, nests[0].endPos).includes('##')).toBe(true);
  });

  it('skips fenced code block lines for nest', () => {
    const text = '## H\n\n```js\nx\n```\n\np\n';
    const decs = parser.extractDecorations(text);
    const nests = decs.filter((d) => d.type === 'headingNest');
    const codeLine = nests.find((d) => text.slice(d.startPos, d.endPos) === 'x');
    expect(codeLine).toBeUndefined();
  });
});
