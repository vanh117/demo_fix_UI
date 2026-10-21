/* Prototype only: shows script errors on screen so a broken file is obvious while reviewing. */
'use strict';

window.addEventListener('error', (e) => {
  let box = document.getElementById('proto-error');
  if (!box) {
    box = document.createElement('pre');
    box.id = 'proto-error';
    box.style.cssText = 'position:fixed;left:8px;right:8px;bottom:8px;z-index:999;max-height:40vh;overflow:auto;padding:12px;border-radius:10px;background:#3a1a18;color:#fdeae8;font:12px/1.4 monospace;white-space:pre-wrap';
    document.body.appendChild(box);
  }
  box.textContent += `${e.message || 'Lỗi'}${e.filename ? ` (${e.filename.split('/').pop()}:${e.lineno})` : ''}\n`;
});
