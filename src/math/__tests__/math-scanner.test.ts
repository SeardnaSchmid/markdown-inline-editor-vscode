import { scanMathRegions } from '../math-scanner';

describe('scanMathRegions - fence-aware behavior', () => {
  it('normalizes fence language token and accepts math|latex|tex', () => {
    const text = [
      '```Math',
      'x+y',
      '```',
      '``` latex ',
      'a=b',
      '```',
      '```tex numbered',
      'c=d',
      '```',
    ].join('\n');

    const regions = scanMathRegions(text);
    expect(regions).toHaveLength(3);
    expect(regions.every((r) => r.displayMode)).toBe(true);
    expect(regions.map((r) => r.source)).toEqual(['x+y\n', 'a=b\n', 'c=d\n']);
  });

  it('skips $...$ and $$...$$ scanning inside non-math fences', () => {
    const text = [
      'Before $x$',
      '```js',
      'const a = "$y$";',
      'const b = "$$z$$";',
      '```',
      'After $$w$$',
    ].join('\n');

    const regions = scanMathRegions(text);
    expect(regions).toHaveLength(2);
    expect(regions[0].source).toBe('x');
    expect(regions[0].displayMode).toBe(false);
    expect(regions[1].source).toBe('w');
    expect(regions[1].displayMode).toBe(true);
  });

  it('does not emit regions for whitespace-only or unclosed math fences', () => {
    const whitespaceOnly = '```math\n   \n\t\n```';
    const unclosed = '```math\n\\frac{1}{2}';

    expect(scanMathRegions(whitespaceOnly)).toEqual([]);
    expect(scanMathRegions(unclosed)).toEqual([]);
  });

  it('treats tilde fences same as backtick fences', () => {
    const text = ['~~~latex', '\\alpha + \\beta', '~~~'].join('\n');
    const regions = scanMathRegions(text);
    expect(regions).toHaveLength(1);
    expect(regions[0].displayMode).toBe(true);
    expect(regions[0].source).toBe('\\alpha + \\beta\n');
  });

  it('emits whole-block startPos/endPos and numLines for math fence', () => {
    const text = '```math\nE=mc^2\n```';
    const regions = scanMathRegions(text);
    expect(regions).toHaveLength(1);
    expect(regions[0].startPos).toBe(0);
    expect(regions[0].endPos).toBe(text.length);
    expect(text.slice(regions[0].startPos, regions[0].endPos)).toBe(text);
    expect(regions[0].source).toBe('E=mc^2\n');
    expect(regions[0].numLines).toBe(1);
  });

  it('numLines is body line count for multi-line fence', () => {
    const text = ['```math', 'a', 'b', 'c', '```'].join('\n');
    const regions = scanMathRegions(text);
    expect(regions).toHaveLength(1);
    expect(regions[0].numLines).toBe(3);
    expect(regions[0].startPos).toBe(0);
    expect(regions[0].endPos).toBe(text.length);
  });

  it('counts body lines correctly for multi-line align source with spacing directives', () => {
    const text = [
      '```latex',
      '\\begin{align}',
      'E &= mc^2 \\\\[10pt]',
      'a^2+b^2 &= c^2',
      '\\end{align}',
      '```',
    ].join('\n');
    const regions = scanMathRegions(text);
    expect(regions).toHaveLength(1);
    expect(regions[0].numLines).toBe(4);
  });

  it('handles UAT sample with large align block and single-line sum block', () => {
    const text = [
      '## Math (LaTeX) - TODO',
      '',
      '```latex',
      '\\begin{align}',
      'E &= mc^2 \\\\[10pt]',
      'a^2 + b^2 &= c^2 \\\\[10pt]',
      '\\int_0^\\infty e^{-x^2} \\, dx &= \\frac{\\sqrt{\\pi}}{2} \\\\[18pt]',
      "\\text{Euler's Identity:} \\quad e^{i\\pi} + 1 &= 0 \\\\[10pt]",
      '\\text{Quadratic Formula:} \\quad x &= \\frac{ -b \\pm \\sqrt{b^2 - 4ac} }{2a} \\\\[18pt]',
      '\\text{Taylor Series for } e^x: \\quad e^x &= \\sum_{n=0}^{\\infty} \\frac{x^n}{n!}',
      '\\end{align}',
      '```',
      'UAT-CHECK()',
      '',
      '```math',
      '\\sum_{n=1}^{\\infty} \\frac{1}{n^2} = \\frac{\\pi^2}{6}',
      '```',
      'UAT-CHECK()',
    ].join('\n');

    const regions = scanMathRegions(text);
    expect(regions).toHaveLength(2);
    expect(regions[0].displayMode).toBe(true);
    expect(regions[0].numLines).toBe(8);
    expect(regions[1].displayMode).toBe(true);
    expect(regions[1].numLines).toBe(1);
  });

  it('non-math fences never emit math regions', () => {
    const text = [
      '```js',
      'const x = "$y$";',
      '```',
      '```py',
      's = "$$z$$"',
      '```',
    ].join('\n');
    const regions = scanMathRegions(text);
    expect(regions).toHaveLength(0);
  });

  it('empty fence body (opening then closing on next line) produces no region', () => {
    const text = '```math\n```';
    const regions = scanMathRegions(text);
    expect(regions).toHaveLength(0);
  });

  it('unclosed math fence produces no region', () => {
    const text = '```math\na+b';
    expect(scanMathRegions(text)).toHaveLength(0);
  });
});

describe('scanMathRegions - inline code span behavior', () => {
  it('skips $...$ inside inline backtick code (#92)', () => {
    expect(scanMathRegions('`${FOO}`')).toEqual([]);
    expect(scanMathRegions('`$100$`')).toEqual([]);
    expect(scanMathRegions('`const s = "$x$"`')).toEqual([]);
  });

  it('still detects math outside inline code on the same line', () => {
    const text = 'Before $a$ and `const b = "$y$"` and After $c$';
    const regions = scanMathRegions(text);
    expect(regions).toHaveLength(2);
    expect(regions.map((r) => r.source)).toEqual(['a', 'c']);
  });

  it('handles longer backtick runs for inline code', () => {
    expect(scanMathRegions('`` `$z$` ``')).toEqual([]);
  });

  it('skips dollars in inline code inside list items', () => {
    const text = '- `${pkgs.system}` and `$a + $b`';
    expect(scanMathRegions(text)).toEqual([]);
  });
});
