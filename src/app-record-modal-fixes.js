// Modal fixes have been consolidated into app-record-modal.js.
// Load compatibility UX layers after every core module has initialised.
window.addEventListener('load',()=>{
  for(const src of ['app-branding.js','app-team-scope-clarity.js','app-ui-polish.js','app-status-rag-sync.js','app-storage-scaling.js','app-workspace-memory.js','app-workspace-startup.js','app-status-report-ui.js','app-attention-health.js','app-assistant-link.js','app-command-menu.js','app-roadmap-groups.js','app-readme-embedded.js','app-readme-assistant.js','app-demand-phases.js','app-demand-phases-fixes.js']){
    const s=document.createElement('script');s.src=src;s.async=false;document.body.appendChild(s)
  }
});
