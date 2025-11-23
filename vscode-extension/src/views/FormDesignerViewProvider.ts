import * as vscode from 'vscode';
import * as fs from 'node:fs';
import * as path from 'node:path';

import { SelectionBus } from '../selectionBus';
import type { ConfigurationNodeData, AmadinFormModel } from '../tree/types';

interface UpdateFormMessage {
  type: 'updateForm';
  payload: {
    nodeId: string | null;
    form: AmadinFormModel | null;
  };
}

interface FormDesignerMessage {
  type: 'formChanged' | 'requestFocus' | 'inspectElement';
  payload?: unknown;
}

export class FormDesignerViewProvider implements vscode.WebviewViewProvider, vscode.Disposable {
  public static readonly viewId = 'amadin.formDesignerView';

  private view?: vscode.WebviewView;
  private readonly disposables: vscode.Disposable[] = [];
  private lastSelection: ConfigurationNodeData | undefined;
  private pendingPayload: UpdateFormMessage['payload'] | undefined;

  constructor(private readonly extensionUri: vscode.Uri, private readonly selectionBus: SelectionBus) {
    const subscription = this.selectionBus.onDidChangeSelection((selection) => {
      this.lastSelection = selection;
      this.syncSelectionWithWebview();
    });
    this.disposables.push(subscription);
  }

  resolveWebviewView(webviewView: vscode.WebviewView): void | Thenable<void> {
    this.view = webviewView;
    const webview = webviewView.webview;
    const assetsRoot = vscode.Uri.joinPath(this.extensionUri, 'src', 'webview', 'form-designer');

    webview.options = {
      enableScripts: true,
      localResourceRoots: [assetsRoot]
    };

    webview.html = this.buildHtml(webview, assetsRoot);

    const messageDisposable = webview.onDidReceiveMessage((message: FormDesignerMessage) => {
      this.handleMessage(message);
    });
    this.disposables.push(messageDisposable);

    this.syncSelectionWithWebview();
  }

  dispose(): void {
    this.disposables.forEach((item) => item.dispose());
  }

  private syncSelectionWithWebview(): void {
    const node = this.lastSelection;
    const update: UpdateFormMessage['payload'] = !node || node.kind !== 'form'
      ? { nodeId: null, form: null }
      : { nodeId: node.id, form: node.formModel ?? null };

    this.pendingPayload = update;
    if (!this.view) {
      return;
    }

    const message: UpdateFormMessage = {
      type: 'updateForm',
      payload: update
    };
    void this.view.webview.postMessage(message);
  }

  private handleMessage(message: FormDesignerMessage): void {
    if (message.type === 'formChanged') {
      this.applyFormChange(message.payload as { nodeId: string; form: AmadinFormModel });
      return;
    }

    if (message.type === 'requestFocus') {
      void vscode.commands.executeCommand('amadin.formDesignerView.focus');
      return;
    }

    if (message.type === 'inspectElement') {
      // Future: forward selection to Properties panel
      return;
    }
  }

  private applyFormChange(payload: { nodeId: string; form: AmadinFormModel }): void {
    if (!payload?.nodeId || !payload.form) {
      return;
    }
    const selected = this.lastSelection;
    if (!selected || selected.id !== payload.nodeId) {
      return;
    }

    selected.formModel = payload.form;
    // Emit selection again so Properties panel updates its JSON view.
    this.selectionBus.setSelection(selected);
  }

  private buildHtml(webview: vscode.Webview, assetsRoot: vscode.Uri): string {
    const nonce = this.createNonce();
    const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(assetsRoot, 'app.js'));
    const stylesUri = webview.asWebviewUri(vscode.Uri.joinPath(assetsRoot, 'style.css'));
    const indexPath = path.join(assetsRoot.fsPath, 'index.html');
    const rawHtml = fs.readFileSync(indexPath, 'utf8');

    return rawHtml
      .replace(/\{\{cspSource\}\}/g, webview.cspSource)
      .replace(/\{\{nonce\}\}/g, nonce)
      .replace(/\{\{stylesUri\}\}/g, stylesUri.toString())
      .replace(/\{\{scriptUri\}\}/g, scriptUri.toString());
  }

  private createNonce(): string {
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let value = '';
    for (let i = 0; i < 16; i += 1) {
      value += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return value;
  }
}
