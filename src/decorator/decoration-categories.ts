import type { DecorationType } from '../parser';

const markerDecorationTypes: ReadonlySet<DecorationType> = new Set<DecorationType>([
  'hide',
  'transparent',
  'blockquote',
  'heading',
  'heading1',
  'heading2',
  'heading3',
  'heading4',
  'heading5',
  'heading6',
  'listItem',
  'orderedListItem',
  'checkboxUnchecked',
  'checkboxChecked',
  'horizontalRule',
  'frontmatterDelimiter',
  'tablePipe',
  'tableSeparatorPipe',
  'tableSeparatorDash',
  'tableCell',
]);

export function isMarkerDecorationType(type: DecorationType): boolean {
  return markerDecorationTypes.has(type);
}
