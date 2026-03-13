/**
 * Renders LaTeX to a data URI (SVG) for use in editor decorations.
 * Uses MathJax (mathjax-full) with SVG output so the result is pure SVG—no HTML/foreignObject—
 * which displays correctly in VS Code's contentIconPath (same approach as Markless).
 * On error returns null so decorator shows raw source.
 */

import { svgToDataUriBase64 } from '../mermaid/svg-processor';

/** Options for rendering. */
export interface MathRenderOptions {
  displayMode: boolean;
  /** Optional height in pixels; used for scaling. If not set, defaults are used. */
  height?: number;
  /** Foreground color (hex) for the math; used so SVG currentColor matches theme. If not set, a default is used. */
  foregroundColor?: string;
}

const MATHJAX_CSS = [
  'svg a{fill:blue;stroke:blue}',
  '[data-mml-node="merror"]>g{fill:red;stroke:red}',
  '[data-mml-node="merror"]>rect[data-background]{fill:yellow;stroke:none}',
  '[data-frame],[data-line]{stroke-width:70px;fill:none}',
  '.mjx-dashed{stroke-dasharray:140}',
  '.mjx-dotted{stroke-linecap:round;stroke-dasharray:0,140}',
  'use[data-c]{stroke-width:3px}',
].join('');

let texToSvgImpl: ((tex: string, display: boolean, height?: number, foregroundColor?: string) => string) | null = null;

function getTexToSvg(): (tex: string, display: boolean, height?: number, foregroundColor?: string) => string {
  if (texToSvgImpl) return texToSvgImpl;
  // Use MathJax SVG output (like Markless) so we get pure SVG, not HTML in foreignObject
  /* eslint-disable @typescript-eslint/no-var-requires */
  const { mathjax } = require('mathjax-full/js/mathjax.js');
  const { TeX } = require('mathjax-full/js/input/tex.js');
  const { SVG } = require('mathjax-full/js/output/svg.js');
  const { liteAdaptor } = require('mathjax-full/js/adaptors/liteAdaptor.js');
  const { RegisterHTMLHandler } = require('mathjax-full/js/handlers/html.js');
  const { AllPackages } = require('mathjax-full/js/input/tex/AllPackages.js');
  /* eslint-enable @typescript-eslint/no-var-requires */

  const adaptor = liteAdaptor();
  RegisterHTMLHandler(adaptor);
  const packages = { packages: (AllPackages as string[]).slice().sort() };
  const tex = new TeX(packages);
  const svg = new SVG({ fontCache: 'local' });
  const html = mathjax.document('', { InputJax: tex, OutputJax: svg });

  texToSvgImpl = (texString: string, display: boolean, height?: number, foregroundColor?: string): string => {
    const node = html.convert(texString, { display });
    const attributes = (node as { children: Array<{ attributes: Record<string, string> }> }).children[0].attributes;
    if (height && attributes['width'] && attributes['height']) {
      const w = parseFloat(attributes['width']);
      const h = parseFloat(attributes['height']);
      if (h > 0) {
        attributes['width'] = `${(w * height) / h}px`;
        attributes['height'] = `${height}px`;
      }
    }
    attributes['preserveAspectRatio'] = 'xMinYMin meet';

    // MathJax SVG output uses `currentColor` for fill/stroke on glyphs. VS Code may not honor
    // <style> tags in SVG icons consistently, so set the SVG's inline style color directly.
    if (foregroundColor) {
      const existingStyle = attributes['style'] ?? '';
      const trimmed = existingStyle.trim().replace(/;+\s*$/, '');
      attributes['style'] = trimmed ? `${trimmed}; color: ${foregroundColor};` : `color: ${foregroundColor};`;
    }

    let svgElement = adaptor.innerHTML(node);
    svgElement = svgElement.replace(/<defs>/, `<defs><style>${MATHJAX_CSS}</style>`);
    return svgElement;
  };
  return texToSvgImpl;
}

/** Returns true if the SVG is a MathJax error (invalid LaTeX). Don't match our injected CSS. */
function isMathJaxErrorSvg(svg: string): boolean {
  return /data-mjx-error=/.test(svg);
}

/**
 * Renders LaTeX to an SVG data URI. Returns null on parse/render error so caller can show raw source.
 *
 * @param latex - Raw LaTeX string (between delimiters)
 * @param options - displayMode true for block, false for inline
 * @returns data:image/svg+xml;charset=utf-8,... or null on error
 */
export function renderMathToDataUri(
  latex: string,
  options: MathRenderOptions
): string | null {
  const trimmed = latex.trim();
  if (!trimmed) return null;
  try {
    const height = options.height ?? (options.displayMode ? 40 : 24);
    const texToSvg = getTexToSvg();
    const svg = texToSvg(trimmed, options.displayMode, height, options.foregroundColor);
    if (!svg || isMathJaxErrorSvg(svg)) return null;
    return svgToDataUriBase64(svg);
  } catch {
    return null;
  }
}
