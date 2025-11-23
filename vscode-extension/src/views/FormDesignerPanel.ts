import * as vscode from 'vscode';
import * as fs from 'node:fs';
import * as path from 'node:path';

import { SelectionBus } from '../selectionBus';
import { loadFormModel } from '../forms/formResolver';
import type { AmadinFormModel, ConfigurationNodeData } from '../tree/types';

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

export class FormDesignerPanelManager implements vscode.Disposable {
  private readonly panels = new Map<string, FormDesignerPanelInstance>();

  constructor(private readonly extensionUri: vscode.Uri, private readonly selectionBus: SelectionBus) {}

  open(node: ConfigurationNodeData): void {
    if (node.kind !== 'form') {
      void vscode.window.showInformationMessage('Можна відкривати лише форми.');
      return;
    }
    const existing = this.panels.get(node.id);
    if (existing) {
      existing.reveal(node);
      return;
    }

    const instance = new FormDesignerPanelInstance(this.extensionUri, this.selectionBus, node, () => {
      this.panels.delete(node.id);
    });
    this.panels.set(node.id, instance);
  }

  dispose(): void {
    this.panels.forEach((panel) => panel.dispose());
    this.panels.clear();
  }
}

class FormDesignerPanelInstance implements vscode.Disposable {
  public static readonly viewType = 'amadin.formDesignerPanel';

  private readonly panel: vscode.WebviewPanel;
  private readonly disposables: vscode.Disposable[] = [];
  private readonly assetsRoot: vscode.Uri;
  private node: ConfigurationNodeData;
  private currentForm: AmadinFormModel | null = null;
  private loadToken = 0;
  private isDisposing = false;

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly selectionBus: SelectionBus,
    node: ConfigurationNodeData,
    private readonly onDispose: () => void
  ) {
    this.node = node;
    this.assetsRoot = vscode.Uri.joinPath(this.extensionUri, 'src', 'webview', 'form-designer');

    this.panel = vscode.window.createWebviewPanel(
      FormDesignerPanelInstance.viewType,
      `${node.label} — Form Designer`,
      { viewColumn: vscode.ViewColumn.One, preserveFocus: false },
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [this.assetsRoot]
      }
    );

    this.panel.webview.html = this.buildHtml();
    this.registerListeners();
    void this.loadAndSendForm(true);
  }

  reveal(node?: ConfigurationNodeData): void {
    if (node) {
      this.node = node;
      this.panel.title = `${node.label} — Form Designer`;
      void this.loadAndSendForm(true);
    } else {
      this.postFormToWebview(this.currentForm);
    }
    this.panel.reveal(undefined, true);
  }

  dispose(): void {
    if (this.isDisposing) {
      return;
    }
    this.isDisposing = true;
    this.disposables.forEach((item) => item.dispose());
    this.panel.dispose();
    this.onDispose();
  }

  private registerListeners(): void {
    const messageDisposable = this.panel.webview.onDidReceiveMessage((message: FormDesignerMessage) => {
      this.handleMessage(message);
    });
    const disposeDisposable = this.panel.onDidDispose(() => {
      this.handlePanelDisposed();
    });
    this.disposables.push(messageDisposable, disposeDisposable);
  }

  private handlePanelDisposed(): void {
    if (this.isDisposing) {
      return;
    }
    this.isDisposing = true;
    this.disposables.forEach((item) => item.dispose());
    this.onDispose();
  }

  private async loadAndSendForm(forceReload = false): Promise<void> {
    const token = ++this.loadToken;
    if (!forceReload && this.currentForm) {
      this.postFormToWebview(this.currentForm);
      return;
    }

    const form = await loadFormModel(this.node, this.extensionUri);
    if (token !== this.loadToken) {
      return;
    }
    this.currentForm = form;
    if (form) {
      this.node.formModel = cloneForm(form);
    } else {
      this.node.formModel = undefined;
    }
    this.postFormToWebview(form);
  }

  private postFormToWebview(form: AmadinFormModel | null): void {
    const payload: UpdateFormMessage['payload'] = {
      nodeId: this.node.id,
      form
    };
    const message: UpdateFormMessage = {
      type: 'updateForm',
      payload
    };
    void this.panel.webview.postMessage(message);
  }

  private handleMessage(message: FormDesignerMessage): void {
    if (message.type === 'formChanged') {
      this.applyFormChange(message.payload as { nodeId: string; form: AmadinFormModel });
      return;
    }
    if (message.type === 'requestFocus') {
      this.panel.reveal(undefined, false);
      return;
    }
    if (message.type === 'inspectElement') {
      // Future enhancement: sync selection to Properties view when needed.
      return;
    }
  }

  private applyFormChange(payload: { nodeId: string; form: AmadinFormModel }): void {
    if (!payload?.nodeId || !payload.form || payload.nodeId !== this.node.id) {
      return;
    }
    this.currentForm = payload.form;
    this.node.formModel = cloneForm(payload.form);
    this.selectionBus.setSelection(this.node);
  }

  private buildHtml(): string {
    const webview = this.panel.webview;
    const nonce = this.createNonce();
    const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this.assetsRoot, 'app.js'));
    const stylesUri = webview.asWebviewUri(vscode.Uri.joinPath(this.assetsRoot, 'style.css'));
    const codeJarUri = webview.asWebviewUri(vscode.Uri.joinPath(this.assetsRoot, 'vendor', 'codejar.js'));
    const indexPath = path.join(this.assetsRoot.fsPath, 'index.html');
    const rawHtml = fs.readFileSync(indexPath, 'utf8');

    return rawHtml
      .replace(/\{\{cspSource\}\}/g, webview.cspSource)
      .replace(/\{\{nonce\}\}/g, nonce)
      .replace(/\{\{stylesUri\}\}/g, stylesUri.toString())
      .replace(/\{\{scriptUri\}\}/g, scriptUri.toString())
      .replace(/\{\{codeJarUri\}\}/g, codeJarUri.toString());
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

function cloneForm(model: AmadinFormModel): AmadinFormModel {
  return JSON.parse(JSON.stringify(model));
}
