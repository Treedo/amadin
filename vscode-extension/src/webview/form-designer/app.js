const vscode = acquireVsCodeApi();
const appRoot = document.getElementById('app');

let activeNodeId = null;
let currentForm = null;
let activeTab = 'designer';
let jsonBuffer = '';
let jsonNeedsSync = false;
let jsonError = null;
let jsonEditor = null;
let jsonEditorSubscription = null;

const paletteItems = [
  { type: 'group', label: 'Group' },
  { type: 'field', label: 'Field' },
  { type: 'table', label: 'Table Part' },
  { type: 'tabs', label: 'Tab Pane' }
];

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function render() {
  if (!currentForm) {
    appRoot.innerHTML = '<div class="empty-state">Select a form node to start designing.</div>';
    disposeJsonEditor();
    return;
  }

  const toolbar = `
    <div class="toolbar">
      <strong>${escapeHtml(currentForm.name)}</strong>
      <button data-action="undo" disabled>Undo</button>
      <button data-action="redo" disabled>Redo</button>
      <button data-action="add-field">Add Field</button>
      <button data-action="save">Save</button>
    </div>
  `;

  const tabBar = `
    <div class="tabbar">
      <button class="tab-button ${activeTab === 'designer' ? 'active' : ''}" data-action="switch-tab" data-tab="designer">Designer</button>
      <button class="tab-button ${activeTab === 'json' ? 'active' : ''}" data-action="switch-tab" data-tab="json">JSON</button>
    </div>
  `;

  const body = activeTab === 'designer' ? renderDesignerPanel() : renderJsonPanel();

  appRoot.innerHTML = `<div class="designer-shell">${toolbar}${tabBar}<div class="tab-panel">${body}</div></div>`;
  setupJsonEditorIfNeeded();
}

function renderDesignerPanel() {
  const palette = `
    <div class="palette">
      <h4>Palette</h4>
      <ul class="palette-list">
        ${paletteItems
          .map((item) => `<li data-palette="${item.type}">${escapeHtml(item.label)}</li>`)
          .join('')}
      </ul>
    </div>
  `;

  const timeline = `
    <div class="palette timeline">
      <h4>Timeline</h4>
      <div>History coming soon…</div>
    </div>
  `;

  const canvas = `<div class="canvas">${renderLayout(currentForm.layout)}</div>`;

  return `<div class="designer-grid">${palette}${canvas}${timeline}</div>`;
}

function renderJsonPanel() {
  const status = jsonError
    ? `<span class="json-status error">${escapeHtml(jsonError)}</span>`
    : '<span class="json-status">Edit JSON and apply to sync the designer.</span>';
  return `
    <div class="json-panel">
      <div class="json-editor-container">
        <textarea id="json-editor" class="code-editor" spellcheck="false"></textarea>
      </div>
      <div class="json-actions">
        <button data-action="apply-json">Apply JSON</button>
        ${status}
      </div>
    </div>
  `;
}

function renderLayout(nodes) {
  if (!Array.isArray(nodes)) {
    return '';
  }
  return nodes
    .map((node) => {
      if (node.type === 'group') {
        return `
          <div class="group" data-node-id="${node.id}" data-node-type="group">
            <div style="font-weight:600; margin-bottom:0.25rem;">${escapeHtml(node.title)}</div>
            ${renderLayout(node.children)}
          </div>
        `;
      }
      if (node.type === 'field') {
        return `
          <div class="field" data-node-id="${node.id}" data-node-type="field">
            <span>${escapeHtml(node.label)}</span>
            <code>${escapeHtml(node.fieldCode)}</code>
          </div>
        `;
      }
      if (node.type === 'table') {
        const columns = node.columns
          .map((column) => `<li>${escapeHtml(column.label)} → ${escapeHtml(column.fieldCode)}</li>`)
          .join('');
        return `
          <div class="group" data-node-id="${node.id}" data-node-type="table">
            <div style="font-weight:600;">${escapeHtml(node.title)}</div>
            <ul>${columns}</ul>
          </div>
        `;
      }
      if (node.type === 'tabs') {
        const tabs = node.tabs
          .map(
            (tab) => `
              <div class="group" data-node-id="${tab.id}" data-node-type="tab">
                <div style="font-weight:600;">${escapeHtml(tab.title)}</div>
                ${renderLayout(tab.children)}
              </div>
            `
          )
          .join('');
        return `<div class="group" data-node-id="${node.id}" data-node-type="tabs">${tabs}</div>`;
      }
      return '';
    })
    .join('');
}

function handleClick(event) {
  const target = event.target;
  if (!(target instanceof HTMLElement)) {
    return;
  }

  const action = target.dataset.action;
  if (action === 'switch-tab') {
    const nextTab = target.dataset.tab;
    if (nextTab) {
      setActiveTab(nextTab);
    }
    return;
  }
  if (action === 'add-field') {
    event.preventDefault();
    addField();
    return;
  }
  if (action === 'save') {
    event.preventDefault();
    persistForm();
    return;
  }
  if (action === 'apply-json') {
    event.preventDefault();
    applyJsonBuffer();
    return;
  }

  const nodeElement = target.closest('[data-node-id]');
  if (nodeElement) {
    const nodeId = nodeElement.getAttribute('data-node-id');
    vscode.postMessage({ type: 'inspectElement', payload: { nodeId } });
  }
}

function handleKeyDown(event) {
  if (activeTab === 'json' && (event.metaKey || event.ctrlKey) && event.key === 'Enter') {
    event.preventDefault();
    applyJsonBuffer();
  }
}

function cloneForm(model) {
  if (typeof structuredClone === 'function') {
    return structuredClone(model);
  }
  return JSON.parse(JSON.stringify(model));
}

function addField() {
  if (!currentForm) {
    return;
  }
  const updated = cloneForm(currentForm);
  const firstGroup = findFirstGroup(updated.layout);
  if (!firstGroup) {
    return;
  }
  firstGroup.children.push({
    id: `field-${Date.now()}`,
    type: 'field',
    label: 'New Field',
    fieldCode: 'newField'
  });
  emitChange(updated);
}

function findFirstGroup(nodes) {
  if (!Array.isArray(nodes)) {
    return undefined;
  }
  for (const node of nodes) {
    if (node.type === 'group') {
      return node;
    }
    if (node.type === 'tabs') {
      for (const tab of node.tabs) {
        const found = findFirstGroup(tab.children);
        if (found) {
          return found;
        }
      }
    }
  }
  return undefined;
}

function persistForm() {
  if (!currentForm || !activeNodeId) {
    return;
  }
  vscode.postMessage({ type: 'formChanged', payload: { nodeId: activeNodeId, form: currentForm } });
}

function emitChange(updatedForm) {
  currentForm = updatedForm;
  jsonBuffer = JSON.stringify(updatedForm, null, 2);
  jsonNeedsSync = true;
  render();
  persistForm();
}

function setActiveTab(tab) {
  if (activeTab === tab) {
    return;
  }
  activeTab = tab;
  if (tab === 'json') {
    jsonNeedsSync = true;
  }
  render();
}

function applyJsonBuffer() {
  if (!jsonBuffer) {
    return;
  }
  try {
    const parsed = JSON.parse(jsonBuffer);
    jsonError = null;
    emitChange(parsed);
  } catch (error) {
    jsonError = (error && error.message) || 'Invalid JSON';
    render();
  }
}

function setupJsonEditorIfNeeded() {
  if (activeTab !== 'json') {
    disposeJsonEditor();
    return;
  }
  const target = document.getElementById('json-editor');
  if (!target) {
    return;
  }
  if (!jsonEditor) {
    jsonEditor = CodeJar(target, null, { tab: '  ' });
    jsonEditorSubscription = jsonEditor.onUpdate((code) => {
      jsonBuffer = code;
      jsonError = null;
    });
  }
  if (jsonNeedsSync) {
    jsonEditor.updateCode(jsonBuffer);
    jsonNeedsSync = false;
  }
}

function disposeJsonEditor() {
  if (jsonEditorSubscription) {
    jsonEditorSubscription();
    jsonEditorSubscription = null;
  }
  if (jsonEditor && typeof jsonEditor.dispose === 'function') {
    jsonEditor.dispose();
  }
  jsonEditor = null;
}

function handleMessage(event) {
  const { type, payload } = event.data;
  if (type === 'updateForm') {
    activeNodeId = payload.nodeId;
    currentForm = payload.form;
    jsonBuffer = payload.form ? JSON.stringify(payload.form, null, 2) : '';
    jsonNeedsSync = true;
    jsonError = null;
    activeTab = 'designer';
    render();
  }
}

appRoot.addEventListener('click', handleClick);
appRoot.addEventListener('keydown', handleKeyDown);
window.addEventListener('message', handleMessage);
render();
