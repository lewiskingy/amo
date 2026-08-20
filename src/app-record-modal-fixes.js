// Modal fixes have been consolidated into app-record-modal.js.
// Load browser-local workspace memory and enhanced Status Report UX after every core module has initialised.
window.addEventListener('load',()=>{
  for(const src of ['app-workspace-memory.js','app-status-report-ui.js']){
    const s=document.createElement('script');s.src=src;s.async=false;document.body.appendChild(s)
  }
});
