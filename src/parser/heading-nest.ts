import type { Heading, Node, Root } from 'mdast';
import { config } from '../config';
import { hasValidPosition, isInCodeBlock } from './common';
import type { DecorationRange, ScopeRange } from './types';

type VisitFunction = (
  tree: Root,
  visitor: (node: Node, index?: number, parent?: Node) => void,
) => void;

export function addHeadingNestDecorations(
  ast: Root,
  text: string,
  decorations: DecorationRange[],
  scopes: ScopeRange[],
  visit: VisitFunction,
): void {
  if (!config.headings.nest.enabled()) {
    return;
  }

  const maxLevel = config.headings.nest.maxLevel();
  const nestContent = config.headings.nest.nestContent();
  const lineRanges = getLineRanges(text);
  const headings = collectHeadings(ast, visit);
  const excludedLines = collectExcludedLines(scopes, lineRanges);
  const headingLineSet = new Set(headings.map((heading) => heading.line));

  const pushNestLine = (line: number, nestSteps: number): void => {
    if (nestSteps <= 0 || line < 0 || line >= lineRanges.length || excludedLines.has(line)) {
      return;
    }
    const { start, end } = lineRanges[line];
    decorations.push({
      startPos: start,
      endPos: end,
      type: 'headingNest',
      nestSteps,
    });
  };

  const cappedSteps = (level: number): number => {
    const capped = Math.min(level, maxLevel);
    return Math.max(0, capped - 1);
  };

  for (let i = 0; i < headings.length; i++) {
    const { line: headingLine, level } = headings[i];
    const steps = cappedSteps(level);
    pushNestLine(headingLine, steps);

    if (!nestContent) {
      continue;
    }

    let sectionEndLine = lineRanges.length - 1;
    for (let j = i + 1; j < headings.length; j++) {
      if (headings[j].level <= level) {
        sectionEndLine = headings[j].line - 1;
        break;
      }
    }

    for (let line = headingLine + 1; line <= sectionEndLine; line++) {
      if (!headingLineSet.has(line)) {
        pushNestLine(line, steps);
      }
    }
  }
}

function collectHeadings(
  ast: Root,
  visit: VisitFunction,
): Array<{ line: number; level: number }> {
  const headings: Array<{ line: number; level: number }> = [];
  const ancestorMap = new Map<Node, Node[]>();

  visit(ast, (node: Node, _index: number | undefined, parent: Node | undefined) => {
    const currentAncestors: Node[] = [];
    if (parent) {
      currentAncestors.push(parent);
      const parentAncestors = ancestorMap.get(parent);
      if (parentAncestors) {
        currentAncestors.push(...parentAncestors);
      }
    }
    if (currentAncestors.length > 0) {
      ancestorMap.set(node, currentAncestors);
    }

    if (node.type !== 'heading') {
      return;
    }
    const heading = node as Heading;
    if (!hasValidPosition(heading) || isInCodeBlock(currentAncestors)) {
      return;
    }
    headings.push({
      line: heading.position!.start.line - 1,
      level: Math.min(Math.max(heading.depth ?? 1, 1), 6),
    });
  });

  return headings;
}

function getLineRanges(text: string): Array<{ start: number; end: number }> {
  const ranges: Array<{ start: number; end: number }> = [];
  let start = 0;
  for (let i = 0; i <= text.length; i++) {
    if (i === text.length || text[i] === '\n') {
      ranges.push({ start, end: i });
      start = i + 1;
    }
  }
  return ranges;
}

function collectExcludedLines(
  scopes: ScopeRange[],
  lineRanges: Array<{ start: number; end: number }>,
): Set<number> {
  const excluded = new Set<number>();
  const excludedScopes = scopes.filter((scope) => scope.kind === 'codeBlock' || scope.kind === 'frontmatter');

  for (let line = 0; line < lineRanges.length; line++) {
    const range = lineRanges[line];
    if (excludedScopes.some((scope) => rangesOverlap(range.start, range.end, scope.startPos, scope.endPos))) {
      excluded.add(line);
    }
  }

  return excluded;
}

function rangesOverlap(startA: number, endA: number, startB: number, endB: number): boolean {
  return startA <= endB && endA >= startB;
}
