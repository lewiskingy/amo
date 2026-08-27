// Modal fixes have been consolidated into app-record-modal.js.
// Compatibility shell: app-integrations.js predates grouped navigation and expects README to
// exist or to be insertable directly beside Workspace. Create the modern shell first so its
// legacy ensureReadmeTab() becomes a harmless no-op; app-navigation.js later owns placement.
(function ensureReadmeCompatibilityShell(){
  const nav=document.querySelector('.sidebar nav'),content=document.querySelector('.content');
  if(nav&&!nav.querySelector('[data-view="readme"]')){
    const btn=document.createElement('button');btn.className='nav-btn';btn.dataset.view='readme';btn.innerHTML='<span class="nav-dot"></span>README';btn.addEventListener('click',()=>switchView('readme'));
    const firstGroup=nav.querySelector(':scope > details.nav-group');if(firstGroup)nav.insertBefore(btn,firstGroup);else nav.appendChild(btn)
  }
  if(content&&!document.getElementById('readme')){
    const section=document.createElement('section');section.id='readme';section.className='view';section.innerHTML='<div class="hero"><div><h1>README</h1><p>Application usage and operating notes bundled with AMO.</p></div></div><div class="card"><article id="readmeContent" class="readme-markdown"></article></div>';content.appendChild(section)
  }
})();

// Load compatibility UX layers after every core module has initialised.
// Modules already loaded statically by index.html are intentionally excluded here.
window.addEventListener('load',()=>{
  for(const src of ['app-branding.js','app-team-scope-clarity.js','app-ui-polish.js','app-status-rag-sync.js','app-workspace-memory.js','app-role-model.js','app-workspace-startup.js','app-status-report-ui.js','app-attention-health.js','app-assistant-link.js','app-command-menu.js','app-roadmap-groups.js','app-readme-embedded.js','app-readme-assistant.js','app-config-settings.js','app-role-config.js','app-config-organization-effective.js','app-semantic-filters.js','app-semantic-filter-polish.js','app-financial-planning.js']){
    const s=document.createElement('script');s.src=src;s.async=false;document.body.appendChild(s)
  }
});
