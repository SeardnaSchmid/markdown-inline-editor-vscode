import { commands, type Memento } from 'vscode';
import { config } from '../config';

export type RenderedMarkdownMode = 'visual' | 'hybrid';
export type MarkdownMode = RenderedMarkdownMode | 'raw';
export type DecorationMode = MarkdownMode;

const GLOBAL_MODE_KEY = 'mdInline.globalMode';
const LAST_RENDERED_MODE_KEY = 'mdInline.lastRenderedMode';

function isValidMode(value: unknown): value is MarkdownMode {
  return value === 'visual' || value === 'hybrid' || value === 'raw';
}

function isRenderedMode(value: unknown): value is RenderedMarkdownMode {
  return value === 'visual' || value === 'hybrid';
}

/**
 * Manages the global Markdown mode (`visual` / `hybrid` / `raw`) shared across all Markdown files
 * and VS Code context keys (`mdInline.mode`, `mdInline.lastRenderedMode`, `mdInline.renderedEditMode`).
 */
export class RenderedEditModeController {
  private currentMode: MarkdownMode | undefined;
  private lastRenderedMode: RenderedMarkdownMode | undefined;

  constructor(private readonly workspaceState?: Memento) {}

  getMode(_uri?: string): MarkdownMode {
    if (this.currentMode !== undefined) {
      return this.currentMode;
    }

    const saved = this.workspaceState?.get<unknown>(GLOBAL_MODE_KEY);
    if (isValidMode(saved)) {
      this.currentMode = saved;
      return saved;
    }

    return config.defaultMode();
  }

  getLastRenderedMode(uri?: string): RenderedMarkdownMode {
    const mode = this.getMode(uri);
    if (isRenderedMode(mode)) {
      return mode;
    }

    if (this.lastRenderedMode !== undefined) {
      return this.lastRenderedMode;
    }

    const saved = this.workspaceState?.get<unknown>(LAST_RENDERED_MODE_KEY);
    if (isRenderedMode(saved)) {
      this.lastRenderedMode = saved;
      return saved;
    }

    const fallback = config.defaultMode();
    return isRenderedMode(fallback) ? fallback : 'hybrid';
  }

  setMode(uri: string | undefined, mode: MarkdownMode): MarkdownMode {
    if (isRenderedMode(mode)) {
      this.lastRenderedMode = mode;
      void this.workspaceState?.update(LAST_RENDERED_MODE_KEY, mode);
    } else if (this.lastRenderedMode === undefined) {
      const previous = this.getLastRenderedMode(uri);
      this.lastRenderedMode = previous;
      void this.workspaceState?.update(LAST_RENDERED_MODE_KEY, previous);
    }

    this.currentMode = mode;
    void this.workspaceState?.update(GLOBAL_MODE_KEY, mode);
    return mode;
  }

  clearCachedDefault(): void {
    const saved = this.workspaceState?.get<unknown>(GLOBAL_MODE_KEY);
    if (!isValidMode(saved)) {
      this.currentMode = undefined;
    }
    const savedRendered = this.workspaceState?.get<unknown>(LAST_RENDERED_MODE_KEY);
    if (!isRenderedMode(savedRendered)) {
      this.lastRenderedMode = undefined;
    }
  }

  syncUI(uri: string | undefined, visualActive: boolean): void {
    const mode = this.getMode(uri);
    const lastRenderedMode = this.getLastRenderedMode(uri);
    if (commands && typeof commands.executeCommand === 'function') {
      void commands.executeCommand('setContext', 'mdInline.mode', mode);
      void commands.executeCommand('setContext', 'mdInline.lastRenderedMode', lastRenderedMode);
      void commands.executeCommand('setContext', 'mdInline.renderedEditMode', visualActive);
    }
  }
}
