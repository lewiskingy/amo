// Modal fixes have been consolidated into app-record-modal.js.
// Load browser-local workspace memory only after every core module has initialised.
window.addEventListener('load',()=>{const s=document.createElement('script');s.src='app-workspace-memory.js';s.defer=true;document.body.appendChild(s)});
