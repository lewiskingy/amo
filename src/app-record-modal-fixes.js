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
// Access control installs before remembered-workspace startup so Local and Remote writes use the
// same client capability gate. Local recovery includes a stale-guard repair shim immediately after
// the recovery module so a partial startup cannot permanently suppress the Restore API.
// The final identity-attribution layer owns audit attribution.
window.addEventListener('load',()=>{
  const COMPAT_ASSET_VERSION='20260829-restore-nav-activation-1';
  for(const src of ['app-branding.js','app-team-scope-clarity.js','app-ui-polish.js','app-status-rag-sync.js','app-access.js','app-current-user-pill.js','app-users-admin.js','app-backup-recovery-prelude.js','app-backup-recovery.js','app-backup-recovery-repair.js','app-backup-recovery-open-fix.js','app-workspace-memory.js','app-role-model.js','app-person-user-link.js','app-tenant-domain.js','app-linked-membership-pills.js','app-workspace-startup.js','app-status-report-ui.js','app-status-report-collaboration.js','app-status-report-history-compat.js','app-attention-health.js','app-assistant-link.js','app-command-menu.js','app-auth-profile.js','app-roadmap-groups.js','app-readme-embedded.js','app-readme-assistant.js','app-config-settings.js','app-role-config.js','app-config-organization-effective.js','app-semantic-filters.js','app-semantic-filter-polish.js','app-financial-planning.js','app-report-renderer.js','app-status-report-presentation.js','app-status-report-deep-links.js','app-backup-recovery-ui.js','app-remote-recovery.js','app-restore-rbac-fix.js','app-identity-attribution.js']){
    const s=document.createElement('script');s.src=`${src}?v=${COMPAT_ASSET_VERSION}`;s.async=false;document.body.appendChild(s)
  }
});
