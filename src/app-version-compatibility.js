/* Client/backend/schema version presentation and compatibility diagnostics. */
(function initVersionCompatibility(){
  const esc=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const short=value=>{const v=String(value||'').trim();return !v?'—':v.length>12?v.slice(0,12):v};

  function backendState(){
    const repo=window.workspaceRepository;
    if(repo?.mode==='remote'){
      const info=repo.info||window.AMO_BACKEND_INFO||null;
      return {
        mode:'remote',
        version:info?.backendVersion||'Not reported',
        build:info?.backendBuild||'',
        apiVersion:info?.apiVersion||'Not reported'
      }
    }
    return {mode:'local',version:'Local (browser-hosted)',build:'',apiVersion:'—'}
  }

  function renderSidebarIdentity(){
    const sub=document.querySelector('.brand-sub');if(!sub)return;
    const client=window.AMO_APP_VERSION||'—';
    const schema=Number(typeof CURRENT_SCHEMA_VERSION!=='undefined'?CURRENT_SCHEMA_VERSION:0)||'—';
    sub.textContent=`Client ${client} · Schema ${schema}`;
    const backend=backendState();
    sub.title=backend.mode==='remote'
      ?`AMO Client ${client} · Backend ${backend.version} · API contract ${backend.apiVersion} · Schema ${schema}`
      :`AMO Client ${client} · Local browser workspace · Schema ${schema}`
  }

  function stat(label,value,title=''){
    const row=document.createElement('div');row.className='mini-stat';row.dataset.amoVersionComponent=label.toLowerCase().replace(/\s+/g,'-');
    const span=document.createElement('span');span.textContent=label;
    const strong=document.createElement('strong');strong.textContent=value||'—';if(title)strong.title=title;
    row.append(span,strong);return row
  }

  function decorateCard(){
    const card=document.getElementById('amoVersionCompatibilityCard')||document.querySelector('.amo-version-config');
    const list=card?.querySelector('.config-list');if(!card||!list)return;
    const backend=backendState(),client=window.AMO_APP_VERSION||'—',clientBuild=String(window.AMO_BUILD_ID||'').trim();
    const appSchema=Number(typeof CURRENT_SCHEMA_VERSION!=='undefined'?CURRENT_SCHEMA_VERSION:0)||'—';
    const workspaceSchema=(()=>{const v=Number(window.db?.workspace?.schemaVersion||window.db?.settings?.schemaVersion||0);return Number.isFinite(v)&&v>0?v:'—'})();
    const signature=[client,clientBuild,backend.mode,backend.version,backend.build,backend.apiVersion,appSchema,workspaceSchema].join('|');
    if(card.dataset.amoVersionSignature===signature)return;

    list.querySelectorAll('[data-amo-version-component]').forEach(el=>el.remove());
    [...list.querySelectorAll('.mini-stat')].forEach(el=>el.remove());

    const rows=[
      stat('Client version',client),
      stat('Client build',short(clientBuild),clientBuild),
      stat('Backend',backend.version),
    ];
    if(backend.mode==='remote'&&backend.build)rows.push(stat('Backend build',short(backend.build),backend.build));
    rows.push(stat('API contract',backend.apiVersion));
    rows.push(stat('Application schema',String(appSchema)));
    rows.push(stat('Workspace schema',String(workspaceSchema)));
    const note=list.querySelector('.muted');
    rows.forEach(row=>note?list.insertBefore(row,note):list.appendChild(row));
    if(note)note.textContent=backend.mode==='remote'
      ?`Client and backend are independently versioned. Compatibility is governed by API contract ${window.AMO_REQUIRED_API_VERSION||backend.apiVersion}; workspace data compatibility is governed separately by schema version.`
      :'Local Workspace has no separately deployed backend. Workspace data compatibility is governed by schema version.';
    card.dataset.amoVersionSignature=signature
  }

  function refresh(){renderSidebarIdentity();decorateCard()}

  const config=document.getElementById('configContent');
  if(config){
    const observer=new MutationObserver(()=>queueMicrotask(refresh));
    observer.observe(config,{childList:true,subtree:true})
  }
  window.addEventListener('amo-backend-info',refresh);
  window.addEventListener('amo-workspace-connected',refresh);
  window.addEventListener('amo-workspace-disconnected',refresh);
  window.refreshAmoVersionCompatibility=refresh;
  refresh();[100,500,1500].forEach(ms=>setTimeout(refresh,ms))
})();
