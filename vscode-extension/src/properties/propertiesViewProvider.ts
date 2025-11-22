import * as vscode from 'vscode';
import type { ConfigurationNodeData } from '../tree/types';
import { SelectionBus } from '../selectionBus';

interface SelectionMessage {
  type: 'selection';
  payload: ConfigurationNodeData | undefined;
}

export class PropertiesViewProvider implements vscode.WebviewViewProvider, vscode.Disposable {
  public static readonly viewId = 'amadin.configurationProperties';

  private view?: vscode.WebviewView;
  private readonly disposables: vscode.Disposable[] = [];

  constructor(private readonly extensionUri: vscode.Uri, private readonly selectionBus: SelectionBus) {
    const disposable = this.selectionBus.onDidChangeSelection((selection) => this.postSelection(selection));
    this.disposables.push(disposable);
  }

  resolveWebviewView(webviewView: vscode.WebviewView): void | Thenable<void> {
    this.view = webviewView;
    const webview = webviewView.webview;
    webview.options = {
      enableScripts: true,
      localResourceRoots: [this.extensionUri]
    };

    webview.html = this.renderHtml();
    this.postSelection(this.selectionBus.getSelection());
  }

  dispose(): void {
    this.disposables.forEach((item) => item.dispose());
  }

  private postSelection(node: ConfigurationNodeData | undefined): void {
    if (!this.view) {
      return;
    }
    const message: SelectionMessage = { type: 'selection', payload: node };
    void this.view.webview.postMessage(message);
  }

  private renderHtml(): string {
    const nonce = this.createNonce();
    return /* html */ `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Amadin Properties</title>
    <style>
      :root {
        color-scheme: light dark;
        font-family: var(--vscode-font-family);
      }
      body {
        margin: 0;
        padding: 0;
        font-size: 12px;
        background: transparent;
        color: var(--vscode-foreground);
      }
      .container {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
        padding: 0.75rem;
      }
      .header {
        font-size: 0.95rem;
        font-weight: 600;
      }
      .empty {
        opacity: 0.7;
        font-style: italic;
      }
      dl {
        display: grid;
        grid-template-columns: minmax(90px, 35%) 1fr;
        gap: 0.2rem 0.75rem;
        margin: 0;
      }
      dt {
        font-weight: 600;
      }
      dd {
        margin: 0;
        word-break: break-word;
      }
      .metadata {
        border-top: 1px solid var(--vscode-tree-indentGuidesStroke, rgba(128, 128, 128, 0.4));
        padding-top: 0.5rem;
      }
      .metadata h3 {
        margin: 0 0 0.3rem;
        font-size: 0.85rem;
      }
      .metadata-item {
        display: flex;
        justify-content: space-between;
        gap: 0.5rem;
        font-size: 0.85rem;
      }
      .metadata-item span {
        word-break: break-word;
      }
    </style>
  </head>
  <body>
    <div class="container" id="app">
      <div class="header">Select a node to inspect its properties</div>
    </div>
    <script nonce="${nonce}">
      const vscode = acquireVsCodeApi();
      const app = document.getElementById('app');

      const renderEmpty = () => {
        app.innerHTML = '<div class="header">Amadin Properties</div><div class="empty">Немає вибраного елементу.</div>';
      };

      const escapeHtml = (value) => {
        return String(value)
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#39;');
      };

      const renderNode = (node) => {
        if (!node) {
          renderEmpty();
          return;
        }
        const metadataEntries = node.metadata ? Object.entries(node.metadata) : [];
        const description = node.description ? node.description : '—';
        const children = Array.isArray(node.children) ? node.children.length : 0;
        const metadataHtml = metadataEntries.length
          ? '<div class="metadata"><h3>Metadata</h3>' +
            metadataEntries
              .map(([key, value]) => {
                return (
                  '<div class="metadata-item">' +
                  '<span>' + escapeHtml(key) + '</span>' +
                  '<span>' + escapeHtml(value) + '</span>' +
                  '</div>'
                );
              })
              .join('') +
            '</div>'
          : '';

        const markup = [
          '<div>',
          '<div class="header">' + escapeHtml(node.label) + '</div>',
          '<div style="opacity:0.7; font-size:0.85rem;">' + escapeHtml(node.kind) + '</div>',
          '</div>',
          '<dl>',
          '<dt>ID</dt>',
          '<dd>' + escapeHtml(node.id) + '</dd>',
          '<dt>Опис</dt>',
          '<dd>' + escapeHtml(description) + '</dd>',
          '<dt>Дочірні</dt>',
          '<dd>' + escapeHtml(children) + '</dd>',
          '</dl>',
          metadataHtml
        ].join('');

        app.innerHTML = markup;
      };

      window.addEventListener('message', (event) => {
        const message = event.data;
        if (message.type === 'selection') {
          renderNode(message.payload);
        }
      });

      renderEmpty();
    </script>
  </body>
</html>`;
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
