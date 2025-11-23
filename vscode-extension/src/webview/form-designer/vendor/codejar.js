// Lightweight textarea code editor helper inspired by CodeJar (MIT)
(function (global) {
  function CodeJar(textarea, _highlight, options) {
    if (!(textarea instanceof HTMLTextAreaElement)) {
      throw new Error('CodeJar expects a <textarea> element.');
    }
    const settings = Object.assign({ tab: '  ', indentOn: /[{[(]$/ }, options);
    const listeners = new Set();

    function handleInput() {
      const code = textarea.value;
      listeners.forEach((cb) => cb(code));
    }

    function insertText(text) {
      const { selectionStart, selectionEnd, value } = textarea;
      const before = value.slice(0, selectionStart);
      const after = value.slice(selectionEnd);
      const nextCursor = selectionStart + text.length;
      textarea.value = before + text + after;
      textarea.selectionStart = textarea.selectionEnd = nextCursor;
      handleInput();
    }

    function handleKeyDown(event) {
      if (event.key === 'Tab') {
        event.preventDefault();
        insertText(settings.tab);
        return;
      }
      if (event.key === 'Enter') {
        const before = textarea.value.slice(0, textarea.selectionStart);
        const currentLine = before.split('\n').pop() ?? '';
        const baseIndent = /^\s*/.exec(currentLine)?.[0] ?? '';
        const extra = settings.indentOn.test(currentLine.trim()) ? settings.tab : '';
        event.preventDefault();
        insertText(`\n${baseIndent}${extra}`);
      }
    }

    function updateCode(code) {
      textarea.value = code;
    }

    function onUpdate(callback) {
      listeners.add(callback);
      return () => listeners.delete(callback);
    }

    function dispose() {
      listeners.clear();
      textarea.removeEventListener('input', handleInput);
      textarea.removeEventListener('keydown', handleKeyDown);
    }

    textarea.addEventListener('input', handleInput);
    textarea.addEventListener('keydown', handleKeyDown);

    return { updateCode, onUpdate, dispose };
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = CodeJar;
  } else {
    global.CodeJar = CodeJar;
  }
})(typeof window !== 'undefined' ? window : this);
