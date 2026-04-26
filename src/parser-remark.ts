// Helper module to handle ESM imports for remark
// This allows the parser to work in both CommonJS (VS Code) and test-runner (Vitest) contexts

let unified: any;
let remarkParse: any;
let remarkGfm: any;
let visit: any;

export async function getRemarkProcessor() {
  if (!unified) {
    try {
      // Try CommonJS require first (for VS Code extension runtime)
      unified = require('unified').unified;
      remarkParse = require('remark-parse');
      remarkGfm = require('remark-gfm');
      visit = require('unist-util-visit').visit;
    } catch {
      // Fall back to ESM dynamic import (for Vitest / async paths)
      const unifiedModule = await import('unified');
      unified = unifiedModule.unified;
      remarkParse = await import('remark-parse');
      remarkGfm = await import('remark-gfm');
      const visitModule = await import('unist-util-visit');
      visit = visitModule.visit;
    }
  }

  return {
    unified,
    remarkParse: remarkParse.default || remarkParse,
    remarkGfm: remarkGfm.default || remarkGfm,
    visit,
  };
}

// Synchronous version for VS Code extension (uses require)
export function getRemarkProcessorSync() {
  if (!unified) {
    // Use require - works in VS Code extension CommonJS context
    // Vitest resolves these via the same require path when sync entry is used
    unified = require('unified').unified;
    remarkParse = require('remark-parse');
    remarkGfm = require('remark-gfm');
    visit = require('unist-util-visit').visit;
  }

  return {
    unified,
    remarkParse: remarkParse.default || remarkParse,
    remarkGfm: remarkGfm.default || remarkGfm,
    visit,
  };
}

