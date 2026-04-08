import type * as vscode from 'vscode';

export const SUPPORTED_MARKDOWN_LANGUAGE_IDS = [
  'markdown',
  'md',
  'mdx',
  'skill',
  'markdoc',
  'mdc',
  'juliamarkdown',
  'rmarkdown',
] as const;

export function isSupportedMarkdownLanguage(languageId: string): boolean {
  return (SUPPORTED_MARKDOWN_LANGUAGE_IDS as readonly string[]).includes(languageId);
}

export const FILE_BACKED_MARKDOWN_SELECTOR: vscode.DocumentSelector =
  SUPPORTED_MARKDOWN_LANGUAGE_IDS.map((language) => ({ language, scheme: 'file' }));
