import * as vscode from 'vscode';
import { ConfigurationTreeDataProvider } from './tree/configurationTreeDataProvider';
import { buildSampleConfigurationTree } from './tree/sampleData';
import { ConfigurationNodeData } from './tree/types';

export function activate(context: vscode.ExtensionContext): void {
  const rootModel = buildSampleConfigurationTree();
  const dataProvider = new ConfigurationTreeDataProvider(rootModel);
  const treeView = vscode.window.createTreeView('amadin.configurationTree', {
    treeDataProvider: dataProvider,
    showCollapseAll: true
  });

  context.subscriptions.push(treeView);
  context.subscriptions.push(dataProvider);

  const openTree = vscode.commands.registerCommand('amadin.openConfigurationTree', async () => {
    await vscode.commands.executeCommand('workbench.view.extension.amadinConfiguration');
  });

  const openDetails = vscode.commands.registerCommand(
    'amadin.openConfigurationDetails',
    (node: ConfigurationNodeData | undefined) => {
      if (!node) {
        return;
      }
      const message = buildNodeSummary(node);
      vscode.window.showInformationMessage(message);
    }
  );

  context.subscriptions.push(openTree, openDetails);
}

export function deactivate(): void {
  // Nothing to clean up yet.
}

function buildNodeSummary(node: ConfigurationNodeData): string {
  const summaryParts = [node.label];
  if (node.description) {
    summaryParts.push(`(${node.description})`);
  }
  if (node.metadata && Object.keys(node.metadata).length > 0) {
    const metadataPairs = Object.entries(node.metadata).map(([key, value]) => `${key}: ${value}`);
    summaryParts.push(`{ ${metadataPairs.join(', ')} }`);
  }
  return summaryParts.join(' ');
}
