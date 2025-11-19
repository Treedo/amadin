import * as vscode from 'vscode';
import { ConfigurationNodeData, ConfigurationNodeKind } from './types';

export class ConfigurationTreeDataProvider implements vscode.TreeDataProvider<ConfigurationTreeItem> {
  private readonly changeEmitter = new vscode.EventEmitter<ConfigurationTreeItem | undefined | void>();
  readonly onDidChangeTreeData = this.changeEmitter.event;

  constructor(private readonly root: ConfigurationNodeData) {}

  refresh(element?: ConfigurationTreeItem): void {
    this.changeEmitter.fire(element);
  }

  dispose(): void {
    this.changeEmitter.dispose();
  }

  getTreeItem(element: ConfigurationTreeItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: ConfigurationTreeItem): Promise<ConfigurationTreeItem[]> {
    const source = element ? element.node.children ?? [] : this.root.children ?? [];
    const items = source.map((node) => new ConfigurationTreeItem(node, element));
    return Promise.resolve(items);
  }

  getParent(element: ConfigurationTreeItem): ConfigurationTreeItem | undefined {
    return element.parent;
  }
}

export class ConfigurationTreeItem extends vscode.TreeItem {
  id?: string;
  description?: string;
  tooltip?: string | vscode.MarkdownString;
  contextValue?: string;
  iconPath?: vscode.ThemeIcon;
  command?: vscode.Command;

  constructor(readonly node: ConfigurationNodeData, readonly parent?: ConfigurationTreeItem) {
    super(
      node.label,
      node.children && node.children.length > 0
        ? vscode.TreeItemCollapsibleState.Collapsed
        : vscode.TreeItemCollapsibleState.None
    );
    this.id = node.id;
    this.description = node.description;
    this.tooltip = node.tooltip ?? node.label;
    this.contextValue = node.kind;
    this.iconPath = resolveIcon(node.kind);

    if (!node.children || node.children.length === 0) {
      this.command = {
        command: 'amadin.openConfigurationDetails',
        title: 'Show Configuration Details',
        arguments: [node]
      };
    }
  }
}

function resolveIcon(kind: ConfigurationNodeKind): vscode.ThemeIcon | undefined {
  switch (kind) {
    case 'root':
      return new vscode.ThemeIcon('home');
    case 'section':
      return new vscode.ThemeIcon('folder');
    case 'database':
      return new vscode.ThemeIcon('database');
    case 'module':
      return new vscode.ThemeIcon('package');
    case 'entityDirectory':
      return new vscode.ThemeIcon('library');
    case 'entityDocument':
      return new vscode.ThemeIcon('notebook');
    case 'entityRegister':
      return new vscode.ThemeIcon('list-tree');
    case 'entityReport':
      return new vscode.ThemeIcon('graph');
    case 'form':
      return new vscode.ThemeIcon('symbol-field');
    case 'api':
      return new vscode.ThemeIcon('globe');
    case 'permission':
      return new vscode.ThemeIcon('shield');
    case 'user':
      return new vscode.ThemeIcon('account');
    case 'setting':
      return new vscode.ThemeIcon('gear');
    case 'command':
      return new vscode.ThemeIcon('terminal');
    case 'fieldGroup':
      return new vscode.ThemeIcon('symbol-structure');
    case 'field':
      return new vscode.ThemeIcon('symbol-variable');
    default:
      return undefined;
  }
}
