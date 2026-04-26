import * as vscode from 'vscode';

const RECOMMENDED_EXTENSIONS = [
  'yzhang.markdown-all-in-one',
  'MermaidChart.vscode-mermaid-chart',
] as const;

function checkRecommendedExtension(
  extensionId: string,
  context: vscode.ExtensionContext,
): void {
  const extension = vscode.extensions.getExtension(extensionId);
  if (extension) {
    return;
  }

  const notificationKey = `recommendationShown.${extensionId}`;
  const hasShownBefore = context.globalState.get<boolean>(notificationKey, false);
  if (hasShownBefore) {
    return;
  }

  const extensionName = extensionId.split('.').pop() || extensionId;
  void vscode.window.showInformationMessage(
    `Enhance your Markdown workflow: Consider installing "${extensionName}"`,
    'Install',
    'Dismiss'
  ).then((selection) => {
    if (selection === 'Install') {
      void vscode.commands.executeCommand('workbench.extensions.installExtension', extensionId);
    }
    void context.globalState.update(notificationKey, true);
  });
}

export function checkRecommendedExtensions(context: vscode.ExtensionContext): void {
  for (const extensionId of RECOMMENDED_EXTENSIONS) {
    checkRecommendedExtension(extensionId, context);
  }
}
