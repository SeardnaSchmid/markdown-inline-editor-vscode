import {
  ThemeColor,
  getLastTextEditorDecorationTypeOptions,
  resetTextEditorDecorationTypeOptionsCapture,
} from '../../test/__mocks__/vscode';
import {
  Heading1DecorationType,
  Heading2DecorationType,
  Heading3DecorationType,
  Heading4DecorationType,
  Heading5DecorationType,
  Heading6DecorationType,
  LinkDecorationType,
  BlockquoteDecorationType,
  ListItemDecorationType,
  OrderedListItemDecorationType,
  CodeDecorationType,
  BoldDecorationType,
  ItalicDecorationType,
  BoldItalicDecorationType,
  ImageDecorationType,
  HorizontalRuleDecorationType,
  CheckboxUncheckedDecorationType,
  CheckboxCheckedDecorationType,
} from '../../decorations';

describe('decoration creation with color (hex vs theme)', () => {
  describe('heading decorations (US1)', () => {
    beforeEach(() => {
      resetTextEditorDecorationTypeOptionsCapture();
    });

    it('creates heading decoration with hex color', () => {
      const dt = Heading1DecorationType('#e06c75');
      expect(dt).toBeDefined();
      expect(typeof dt).toBe('object');
      const opts = getLastTextEditorDecorationTypeOptions() as Record<string, unknown>;
      expect(opts.color).toBe('#e06c75');
    });

    it('creates heading decoration with explicit ThemeColor', () => {
      Heading1DecorationType(new ThemeColor('editor.foreground'));
      const opts = getLastTextEditorDecorationTypeOptions() as Record<string, unknown>;
      expect(opts.color).toBeInstanceOf(ThemeColor);
      expect((opts.color as InstanceType<typeof ThemeColor>).id).toBe('editor.foreground');
    });

    it('omits color when undefined so theme markdown heading tokens apply (empty setting / inherit)', () => {
      Heading1DecorationType();
      const opts = getLastTextEditorDecorationTypeOptions() as Record<string, unknown>;
      expect(opts).toBeDefined();
      expect('color' in opts).toBe(false);
    });

    it('all heading levels accept optional color', () => {
      expect(Heading1DecorationType('#f00')).toBeDefined();
      expect(Heading2DecorationType()).toBeDefined();
      expect(Heading1DecorationType(new ThemeColor('editor.foreground'))).toBeDefined();
    });
  });

  describe('heading levels H1–H6 theme default (US2)', () => {
    beforeEach(() => {
      resetTextEditorDecorationTypeOptionsCapture();
    });

    const headingFactories = [
      Heading1DecorationType,
      Heading2DecorationType,
      Heading3DecorationType,
      Heading4DecorationType,
      Heading5DecorationType,
      Heading6DecorationType,
    ] as const;

    it.each(headingFactories)('omits color when no args for each heading factory', (factory) => {
      factory();
      const opts = getLastTextEditorDecorationTypeOptions() as Record<string, unknown>;
      expect('color' in opts).toBe(false);
    });

    it.each(headingFactories)('sets color when hex provided for each heading factory', (factory) => {
      factory('#0abcff');
      const opts = getLastTextEditorDecorationTypeOptions() as Record<string, unknown>;
      expect(opts.color).toBe('#0abcff');
    });
  });

  describe('syntax decorations (non-heading)', () => {
    it('creates link decoration with hex and without', () => {
      expect(LinkDecorationType('#61afef')).toBeDefined();
      expect(LinkDecorationType()).toBeDefined();
      expect(LinkDecorationType(new ThemeColor('textLink.foreground'))).toBeDefined();
    });

    it('creates blockquote, list, code, emphasis decorations with hex or theme fallback', () => {
      expect(BlockquoteDecorationType('#98c379')).toBeDefined();
      expect(BlockquoteDecorationType()).toBeDefined();
      expect(ListItemDecorationType('#abb2bf')).toBeDefined();
      expect(ListItemDecorationType()).toBeDefined();
      expect(OrderedListItemDecorationType('#abb2bf')).toBeDefined();
      expect(OrderedListItemDecorationType()).toBeDefined();
      expect(CodeDecorationType('#e5c07b')).toBeDefined();
      expect(CodeDecorationType()).toBeDefined();
      expect(BoldDecorationType('#e06c75')).toBeDefined();
      expect(BoldDecorationType()).toBeDefined();
      expect(ItalicDecorationType('#d19a66')).toBeDefined();
      expect(ItalicDecorationType()).toBeDefined();
      expect(BoldItalicDecorationType('#c678dd')).toBeDefined();
      expect(BoldItalicDecorationType()).toBeDefined();
    });

    it('creates image, horizontal rule, checkbox decorations with hex or theme fallback', () => {
      expect(ImageDecorationType('#61afef')).toBeDefined();
      expect(ImageDecorationType()).toBeDefined();
      expect(ImageDecorationType(new ThemeColor('textLink.foreground'))).toBeDefined();
      expect(HorizontalRuleDecorationType('#5c6370')).toBeDefined();
      expect(HorizontalRuleDecorationType()).toBeDefined();
      expect(HorizontalRuleDecorationType(new ThemeColor('editorWidget.border'))).toBeDefined();
      expect(CheckboxUncheckedDecorationType('#abb2bf')).toBeDefined();
      expect(CheckboxUncheckedDecorationType()).toBeDefined();
      expect(CheckboxCheckedDecorationType('#98c379')).toBeDefined();
      expect(CheckboxCheckedDecorationType()).toBeDefined();
    });
  });

  describe('CodeDecorationType backgroundColor parameter', () => {
    it('creates code decoration with color only (uses default background)', () => {
      expect(CodeDecorationType('#e5c07b')).toBeDefined();
    });

    it('creates code decoration with backgroundColor only', () => {
      expect(CodeDecorationType(undefined, '#f0f0f0')).toBeDefined();
    });

    it('creates code decoration with both color and backgroundColor', () => {
      expect(CodeDecorationType('#e5c07b', '#f0f0f0')).toBeDefined();
    });

    it('creates code decoration with undefined backgroundColor (uses default)', () => {
      expect(CodeDecorationType('#e5c07b', undefined)).toBeDefined();
      expect(CodeDecorationType()).toBeDefined();
    });

    it('creates code decoration with ThemeColor background', () => {
      expect(CodeDecorationType('#e5c07b', new ThemeColor('editor.background'))).toBeDefined();
      expect(CodeDecorationType(undefined, new ThemeColor('editor.background'))).toBeDefined();
    });
  });
});
