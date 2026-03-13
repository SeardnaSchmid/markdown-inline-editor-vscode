import type { TextEditorDecorationType } from 'vscode';
import {
  HideDecorationType,
  TransparentDecorationType,
  GhostFaintDecorationType,
  BoldDecorationType,
  ItalicDecorationType,
  BoldItalicDecorationType,
  StrikethroughDecorationType,
  CodeDecorationType,
  CodeBlockDecorationType,
  CodeBlockLanguageDecorationType,
  SelectionOverlayDecorationType,
  HeadingDecorationType,
  Heading1DecorationType,
  Heading2DecorationType,
  Heading3DecorationType,
  Heading4DecorationType,
  Heading5DecorationType,
  Heading6DecorationType,
  LinkDecorationType,
  ImageDecorationType,
  MentionDecorationType,
  IssueReferenceDecorationType,
  BlockquoteDecorationType,
  ListItemDecorationType,
  OrderedListItemDecorationType,
  HorizontalRuleDecorationType,
  CheckboxUncheckedDecorationType,
  CheckboxCheckedDecorationType,
  FrontmatterDecorationType,
  FrontmatterDelimiterDecorationType,
  EmojiDecorationType,
  TablePipeDecorationType,
  TableSeparatorPipeDecorationType,
  TableSeparatorDashDecorationType,
  TableCellDecorationType,
} from '../decorations';
import type { DecorationType } from '../parser';

type RegistryOptions = {
  getGhostFaintOpacity: () => number;
  getFrontmatterDelimiterOpacity: () => number;
  getCodeBlockLanguageOpacity: () => number;
  getHeading1Color?: () => string | undefined;
  getHeading2Color?: () => string | undefined;
  getHeading3Color?: () => string | undefined;
  getHeading4Color?: () => string | undefined;
  getHeading5Color?: () => string | undefined;
  getHeading6Color?: () => string | undefined;
  getLinkColor?: () => string | undefined;
  getListMarkerColor?: () => string | undefined;
  getInlineCodeColor?: () => string | undefined;
  getInlineCodeBackgroundColor?: () => string | undefined;
  getEmphasisColor?: () => string | undefined;
  getBlockquoteColor?: () => string | undefined;
  getImageColor?: () => string | undefined;
  getHorizontalRuleColor?: () => string | undefined;
  getCheckboxColor?: () => string | undefined;
};

export class DecorationTypeRegistry {
  private hideDecorationType!: TextEditorDecorationType;
  private transparentDecorationType!: TextEditorDecorationType;
  private ghostFaintDecorationType!: TextEditorDecorationType;
  private boldDecorationType!: TextEditorDecorationType;
  private italicDecorationType!: TextEditorDecorationType;
  private boldItalicDecorationType!: TextEditorDecorationType;
  private strikethroughDecorationType!: TextEditorDecorationType;
  private codeDecorationType!: TextEditorDecorationType;
  private codeBlockDecorationType!: TextEditorDecorationType;
  private codeBlockLanguageDecorationType!: TextEditorDecorationType;
  private selectionOverlayDecorationType!: TextEditorDecorationType;
  private headingDecorationType!: TextEditorDecorationType;
  private heading1DecorationType!: TextEditorDecorationType;
  private heading2DecorationType!: TextEditorDecorationType;
  private heading3DecorationType!: TextEditorDecorationType;
  private heading4DecorationType!: TextEditorDecorationType;
  private heading5DecorationType!: TextEditorDecorationType;
  private heading6DecorationType!: TextEditorDecorationType;
  private linkDecorationType!: TextEditorDecorationType;
  private imageDecorationType!: TextEditorDecorationType;
  private mentionDecorationType!: TextEditorDecorationType;
  private issueReferenceDecorationType!: TextEditorDecorationType;
  private blockquoteDecorationType!: TextEditorDecorationType;
  private listItemDecorationType!: TextEditorDecorationType;
  private orderedListItemDecorationType!: TextEditorDecorationType;
  private horizontalRuleDecorationType!: TextEditorDecorationType;
  private checkboxUncheckedDecorationType!: TextEditorDecorationType;
  private checkboxCheckedDecorationType!: TextEditorDecorationType;
  private frontmatterDecorationType!: TextEditorDecorationType;
  private frontmatterDelimiterDecorationType!: TextEditorDecorationType;
  private emojiDecorationType!: TextEditorDecorationType;
  private tablePipeDecorationType!: TextEditorDecorationType;
  private tableSeparatorPipeDecorationType!: TextEditorDecorationType;
  private tableSeparatorDashDecorationType!: TextEditorDecorationType;
  private tableCellDecorationType!: TextEditorDecorationType;

  private decorationTypeMap = new Map<DecorationType, TextEditorDecorationType>();

  constructor(private options: RegistryOptions) {
    this.hideDecorationType = HideDecorationType();
    this.transparentDecorationType = TransparentDecorationType();
    this.ghostFaintDecorationType = GhostFaintDecorationType(this.options.getGhostFaintOpacity());
    this.boldDecorationType = BoldDecorationType(this.options.getEmphasisColor?.());
    this.italicDecorationType = ItalicDecorationType(this.options.getEmphasisColor?.());
    this.boldItalicDecorationType = BoldItalicDecorationType(this.options.getEmphasisColor?.());
    this.strikethroughDecorationType = StrikethroughDecorationType();
    this.codeDecorationType = CodeDecorationType(this.options.getInlineCodeColor?.(), this.options.getInlineCodeBackgroundColor?.());
    this.codeBlockDecorationType = CodeBlockDecorationType();
    this.codeBlockLanguageDecorationType = CodeBlockLanguageDecorationType(this.options.getCodeBlockLanguageOpacity());
    this.selectionOverlayDecorationType = SelectionOverlayDecorationType();
    this.headingDecorationType = HeadingDecorationType();
    this.heading1DecorationType = Heading1DecorationType(this.options.getHeading1Color?.());
    this.heading2DecorationType = Heading2DecorationType(this.options.getHeading2Color?.());
    this.heading3DecorationType = Heading3DecorationType(this.options.getHeading3Color?.());
    this.heading4DecorationType = Heading4DecorationType(this.options.getHeading4Color?.());
    this.heading5DecorationType = Heading5DecorationType(this.options.getHeading5Color?.());
    this.heading6DecorationType = Heading6DecorationType(this.options.getHeading6Color?.());
    this.linkDecorationType = LinkDecorationType(this.options.getLinkColor?.());
    this.imageDecorationType = ImageDecorationType(this.options.getImageColor?.());
    this.mentionDecorationType = MentionDecorationType(this.options.getLinkColor?.());
    this.issueReferenceDecorationType = IssueReferenceDecorationType(this.options.getLinkColor?.());
    this.blockquoteDecorationType = BlockquoteDecorationType(this.options.getBlockquoteColor?.());
    this.listItemDecorationType = ListItemDecorationType(this.options.getListMarkerColor?.());
    this.orderedListItemDecorationType = OrderedListItemDecorationType(this.options.getListMarkerColor?.());
    this.horizontalRuleDecorationType = HorizontalRuleDecorationType(this.options.getHorizontalRuleColor?.());
    this.checkboxUncheckedDecorationType = CheckboxUncheckedDecorationType(this.options.getCheckboxColor?.());
    this.checkboxCheckedDecorationType = CheckboxCheckedDecorationType(this.options.getCheckboxColor?.());
    this.frontmatterDecorationType = FrontmatterDecorationType();
    this.frontmatterDelimiterDecorationType = FrontmatterDelimiterDecorationType(this.options.getFrontmatterDelimiterOpacity());
    this.emojiDecorationType = EmojiDecorationType();
    this.tablePipeDecorationType = TablePipeDecorationType();
    this.tableSeparatorPipeDecorationType = TableSeparatorPipeDecorationType();
    this.tableSeparatorDashDecorationType = TableSeparatorDashDecorationType();
    this.tableCellDecorationType = TableCellDecorationType();

    this.decorationTypeMap = new Map<DecorationType, TextEditorDecorationType>([
      ['hide', this.hideDecorationType],
      ['transparent', this.transparentDecorationType],
      ['bold', this.boldDecorationType],
      ['italic', this.italicDecorationType],
      ['boldItalic', this.boldItalicDecorationType],
      ['strikethrough', this.strikethroughDecorationType],
      ['code', this.codeDecorationType],
      ['codeBlock', this.codeBlockDecorationType],
      ['codeBlockLanguage', this.codeBlockLanguageDecorationType],
      ['heading', this.headingDecorationType],
      ['heading1', this.heading1DecorationType],
      ['heading2', this.heading2DecorationType],
      ['heading3', this.heading3DecorationType],
      ['heading4', this.heading4DecorationType],
      ['heading5', this.heading5DecorationType],
      ['heading6', this.heading6DecorationType],
      ['link', this.linkDecorationType],
      ['image', this.imageDecorationType],
      ['mention', this.mentionDecorationType],
      ['issueReference', this.issueReferenceDecorationType],
      ['blockquote', this.blockquoteDecorationType],
      ['listItem', this.listItemDecorationType],
      ['orderedListItem', this.orderedListItemDecorationType],
      ['horizontalRule', this.horizontalRuleDecorationType],
      ['checkboxUnchecked', this.checkboxUncheckedDecorationType],
      ['checkboxChecked', this.checkboxCheckedDecorationType],
      ['frontmatter', this.frontmatterDecorationType],
      ['frontmatterDelimiter', this.frontmatterDelimiterDecorationType],
      ['emoji', this.emojiDecorationType],
      ['tablePipe', this.tablePipeDecorationType],
      ['tableSeparatorPipe', this.tableSeparatorPipeDecorationType],
      ['tableSeparatorDash', this.tableSeparatorDashDecorationType],
      ['tableCell', this.tableCellDecorationType],
      // Keep this last so it is applied after backgrounds.
      ['selectionOverlay', this.selectionOverlayDecorationType],
    ]);
  }

  getMap(): Map<DecorationType, TextEditorDecorationType> {
    return this.decorationTypeMap;
  }

  getGhostFaintDecorationType(): TextEditorDecorationType {
    return this.ghostFaintDecorationType;
  }

  recreateCodeDecorationType(): void {
    this.recreateDecorationType(
      this.codeDecorationType,
      () => CodeDecorationType(this.options.getInlineCodeColor?.(), this.options.getInlineCodeBackgroundColor?.()),
      (newType) => { this.codeDecorationType = newType; },
      'code'
    );
  }

  /**
   * Recreates all decoration types that depend on color settings or theme.
   * Call when config (markdownInlineEditor.colors) or active color theme changes.
   */
  recreateColorDependentTypes(): void {
    this.recreateDecorationType(this.heading1DecorationType, () => Heading1DecorationType(this.options.getHeading1Color?.()), (t) => { this.heading1DecorationType = t; }, 'heading1');
    this.recreateDecorationType(this.heading2DecorationType, () => Heading2DecorationType(this.options.getHeading2Color?.()), (t) => { this.heading2DecorationType = t; }, 'heading2');
    this.recreateDecorationType(this.heading3DecorationType, () => Heading3DecorationType(this.options.getHeading3Color?.()), (t) => { this.heading3DecorationType = t; }, 'heading3');
    this.recreateDecorationType(this.heading4DecorationType, () => Heading4DecorationType(this.options.getHeading4Color?.()), (t) => { this.heading4DecorationType = t; }, 'heading4');
    this.recreateDecorationType(this.heading5DecorationType, () => Heading5DecorationType(this.options.getHeading5Color?.()), (t) => { this.heading5DecorationType = t; }, 'heading5');
    this.recreateDecorationType(this.heading6DecorationType, () => Heading6DecorationType(this.options.getHeading6Color?.()), (t) => { this.heading6DecorationType = t; }, 'heading6');
    this.recreateDecorationType(this.linkDecorationType, () => LinkDecorationType(this.options.getLinkColor?.()), (t) => { this.linkDecorationType = t; }, 'link');
    this.recreateDecorationType(this.blockquoteDecorationType, () => BlockquoteDecorationType(this.options.getBlockquoteColor?.()), (t) => { this.blockquoteDecorationType = t; }, 'blockquote');
    this.recreateDecorationType(this.listItemDecorationType, () => ListItemDecorationType(this.options.getListMarkerColor?.()), (t) => { this.listItemDecorationType = t; }, 'listItem');
    this.recreateDecorationType(this.orderedListItemDecorationType, () => OrderedListItemDecorationType(this.options.getListMarkerColor?.()), (t) => { this.orderedListItemDecorationType = t; }, 'orderedListItem');
    this.recreateDecorationType(this.codeDecorationType, () => CodeDecorationType(this.options.getInlineCodeColor?.(), this.options.getInlineCodeBackgroundColor?.()), (t) => { this.codeDecorationType = t; }, 'code');
    this.recreateDecorationType(this.boldDecorationType, () => BoldDecorationType(this.options.getEmphasisColor?.()), (t) => { this.boldDecorationType = t; }, 'bold');
    this.recreateDecorationType(this.italicDecorationType, () => ItalicDecorationType(this.options.getEmphasisColor?.()), (t) => { this.italicDecorationType = t; }, 'italic');
    this.recreateDecorationType(this.boldItalicDecorationType, () => BoldItalicDecorationType(this.options.getEmphasisColor?.()), (t) => { this.boldItalicDecorationType = t; }, 'boldItalic');
    this.recreateDecorationType(this.imageDecorationType, () => ImageDecorationType(this.options.getImageColor?.()), (t) => { this.imageDecorationType = t; }, 'image');
    this.recreateDecorationType(this.mentionDecorationType, () => MentionDecorationType(this.options.getLinkColor?.()), (t) => { this.mentionDecorationType = t; }, 'mention');
    this.recreateDecorationType(this.issueReferenceDecorationType, () => IssueReferenceDecorationType(this.options.getLinkColor?.()), (t) => { this.issueReferenceDecorationType = t; }, 'issueReference');
    this.recreateDecorationType(this.horizontalRuleDecorationType, () => HorizontalRuleDecorationType(this.options.getHorizontalRuleColor?.()), (t) => { this.horizontalRuleDecorationType = t; }, 'horizontalRule');
    this.recreateDecorationType(this.checkboxUncheckedDecorationType, () => CheckboxUncheckedDecorationType(this.options.getCheckboxColor?.()), (t) => { this.checkboxUncheckedDecorationType = t; }, 'checkboxUnchecked');
    this.recreateDecorationType(this.checkboxCheckedDecorationType, () => CheckboxCheckedDecorationType(this.options.getCheckboxColor?.()), (t) => { this.checkboxCheckedDecorationType = t; }, 'checkboxChecked');
  }

  recreateGhostFaintDecorationType(): void {
    this.recreateDecorationType(
      this.ghostFaintDecorationType,
      () => GhostFaintDecorationType(this.options.getGhostFaintOpacity()),
      (newType) => { this.ghostFaintDecorationType = newType; }
    );
  }

  recreateFrontmatterDelimiterDecorationType(): void {
    this.recreateDecorationType(
      this.frontmatterDelimiterDecorationType,
      () => FrontmatterDelimiterDecorationType(this.options.getFrontmatterDelimiterOpacity()),
      (newType) => { this.frontmatterDelimiterDecorationType = newType; }
    );
  }

  recreateCodeBlockLanguageDecorationType(): void {
    this.recreateDecorationType(
      this.codeBlockLanguageDecorationType,
      () => CodeBlockLanguageDecorationType(this.options.getCodeBlockLanguageOpacity()),
      (newType) => { this.codeBlockLanguageDecorationType = newType; },
      'codeBlockLanguage'
    );
  }

  dispose(): void {
    for (const decorationType of this.decorationTypeMap.values()) {
      decorationType.dispose();
    }
    this.ghostFaintDecorationType.dispose();
  }

  private recreateDecorationType(
    oldDecorationType: TextEditorDecorationType,
    createNew: () => TextEditorDecorationType,
    updateProperty: (newType: TextEditorDecorationType) => void,
    mapKey?: DecorationType
  ): void {
    oldDecorationType.dispose();

    const newDecorationType = createNew();
    updateProperty(newDecorationType);

    if (mapKey) {
      this.decorationTypeMap.set(mapKey, newDecorationType);
    }
  }
}
