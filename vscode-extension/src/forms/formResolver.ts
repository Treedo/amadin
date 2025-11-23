import * as vscode from 'vscode';
import { promises as fs } from 'node:fs';
import * as path from 'node:path';

import type { AmadinFormModel, ConfigurationNodeData } from '../tree/types';

export async function loadFormModel(
  node: ConfigurationNodeData,
  extensionUri: vscode.Uri
): Promise<AmadinFormModel | null> {
  if (node.formSource) {
    const sourcePath = path.join(extensionUri.fsPath, 'forms', node.formSource);
    try {
      const contents = await fs.readFile(sourcePath, 'utf8');
      return JSON.parse(contents) as AmadinFormModel;
    } catch (error) {
      void vscode.window.showWarningMessage(
        `Не вдалося завантажити форму з ${node.formSource}: ${(error as Error).message}`
      );
    }
  }

  if (node.formModel) {
    return cloneForm(node.formModel);
  }

  return null;
}

function cloneForm(model: AmadinFormModel): AmadinFormModel {
  return JSON.parse(JSON.stringify(model));
}
