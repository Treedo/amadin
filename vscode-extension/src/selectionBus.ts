import * as vscode from 'vscode';
import type { ConfigurationNodeData } from './tree/types';

export class SelectionBus implements vscode.Disposable {
  private readonly emitter = new vscode.EventEmitter<ConfigurationNodeData | undefined>();
  private currentSelection: ConfigurationNodeData | undefined;

  readonly onDidChangeSelection = this.emitter.event;

  setSelection(node: ConfigurationNodeData | undefined): void {
    this.currentSelection = node;
    this.emitter.fire(node);
  }

  getSelection(): ConfigurationNodeData | undefined {
    return this.currentSelection;
  }

  dispose(): void {
    this.emitter.dispose();
  }
}
