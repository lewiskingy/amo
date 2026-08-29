/* Remote Mongo recovery uses the same Admin -> Restore surface as Local recovery, but recovery
   points are server-side audit transactions. Cosmos continuous PITR remains infrastructure DR. */
(function initRemoteRecovery(){
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const activeRepo=()=>window.workspaceRepository;
  /* The repository contract is authoritative here. A stale/missing /api/info capability flag must
     not suppress a recovery API that the connected repository actually exposes. */
  const supportsRemoteRecovery=()=>activeRepo()?.mode==='remote'&&typeof activeRepo()?.listRecoveryPoints==='function'&&typeof activeRepo()?.previewRestore==='function'&&typeof activeRepo()?.restorePoint==='function';

  function ensureNav(){
    const nav=[...document.querySelectorAll('details.nav-group')].find(d=>/Admin/i.test(d.querySelector('summary')?.textContent||''))?.querySelector('.nav-group-items');
    if(nav&&!nav.querySelector('[data-view="restore"]')){const b=document.createElement('button');b.className='nav-btn';b.dataset.view='restore';b.innerHTML='<span class="nav-dot"></span>Restore';b.addEventListener('click',()=>switchView('restore'));const workspace=nav.querySelector('[data-view="data"]');nav.insertBefore(b,workspace||null)}
    const content=document.querySelector('.content');if(content&&!document.getElementById('restore')){const s=document.createElement('section');s.id='restore';s.className='view';s.innerHTML='<div class="hero"><div><h1>Restore</h1><p>Point-in-time recovery from retained AMO audit transactions.</p></div></div><div id="restoreContent"></div>';content.appendChild(s)}
  }

  async function renderRemoteRestore(){
    ensureNav();const host=document.getElementById('restoreContent'),repo=activeRepo();if(!host)return;
    if(!repo||repo.mode!=='remote'){host.innerHTML='<div class="notice">Open a Remote workspace to view Remote recovery history.</div>';return}
    if(!supportsRemoteRecovery()){host.innerHTML='<div class="notice bad">The connected Remote repository does not expose the AMO recovery API.</div>';return}
    host.innerHTML='<div class="notice">Loading Remote recovery history…</div>';
    try{
      const points=await repo.listRecoveryPoints(250),retention=repo.info?.capabilities?.auditRetentionDays||28,backup=repo.info?.capabilities?.managedBackup||'managed database backup';
      let html=`<div class="card"><h2 style="margin-top:0">Remote recovery</h2><p>The Mongo Remote workspace records every committed business change as an auditable before/after transaction retained for <strong>${retention} days</strong>. Restore applies the selected historical state as a new forward transaction. <strong>${esc(backup)}</strong> protects the database separately for infrastructure disaster recovery.</p></div>`;
      html+='<div class="card" style="margin-top:16px"><div class="section-title" style="margin-top:0"><h2>Point-in-time recovery</h2><span class="muted">Newest changes first</span></div>';
      if(!points.length)html+='<div class="notice">No audit recovery points exist yet. Make and save a Remote workspace change to create the first transaction.</div>';
      else{
        html+='<div class="table-wrap remote-recovery-table"><table><thead><tr><th>Point / action</th><th>Type</th><th>Actor / detail</th><th>Documents</th></tr></thead><tbody>';
        for(const p of points)html+=`<tr><td><div>${esc(new Date(p.timestamp).toLocaleString('en-GB'))}</div><button class="btn remote-recovery-action" data-remote-restore="${esc(p.id)}">Preview Restore</button></td><td>${esc(p.type||'Change')}</td><td>${esc(p.actor||'')}${p.reason?` · ${esc(p.reason)}`:''}</td><td>${Number(p.changed)||0}</td></tr>`;
        html+='</tbody></table></div>'
      }
      html+='</div><div id="remoteRestorePreview" style="margin-top:16px"></div>';host.innerHTML=html;
      host.querySelectorAll('[data-remote-restore]').forEach(b=>b.onclick=()=>preview(b.dataset.remoteRestore))
    }catch(e){host.innerHTML=`<div class="notice bad">Could not load Remote recovery history: ${esc(e.message||e)}</div>`}
  }

  async function preview(transactionId){
    const host=document.getElementById('remoteRestorePreview'),repo=activeRepo();if(!host||!supportsRemoteRecovery())return;host.innerHTML='<div class="notice">Calculating restore impact…</div>';
    try{
      if(typeof dirtyCount==='function'&&dirtyCount())throw new Error('Save or discard current unsaved changes before preparing a restore.');const plan=await repo.previewRestore(transactionId),target=plan.target||{};
      host.innerHTML=`<div class="card"><h2 style="margin-top:0">Restore preview · ${esc(new Date(target.timestamp).toLocaleString('en-GB'))}</h2><p><strong>${plan.changed||0}</strong> document${plan.changed===1?'':'s'} will change · ${plan.updates||0} update${plan.updates===1?'':'s'} · ${plan.creates||0} create${plan.creates===1?'':'s'} · ${plan.deletes||0} delete${plan.deletes===1?'':'s'}.</p>${plan.documents?.length?`<details><summary>Documents affected</summary><ul>${plan.documents.map(d=>`<li><code>${esc(d.documentId)}</code> · ${esc(d.operation)}</li>`).join('')}</ul></details><div class="toolbar" style="margin-top:14px"><button class="btn danger" id="applyRemoteRestore">Restore to this point</button></div>`:'<div class="notice">The workspace already matches this recovery point.</div>'}</div>`;
      host.scrollIntoView?.({behavior:'smooth',block:'nearest'});
      const apply=document.getElementById('applyRemoteRestore');if(apply)apply.onclick=async()=>{if(!confirm(`Restore the Remote workspace to ${new Date(target.timestamp).toLocaleString('en-GB')}?\n\nThe restore is committed as a new forward audit transaction.`))return;try{apply.disabled=true;await repo.restorePoint(transactionId);alert('Remote restore committed successfully. AMO will reload the workspace now.');location.reload()}catch(e){alert(`Restore failed: ${e.message||e}`);apply.disabled=false}}
    }catch(e){host.innerHTML=`<div class="notice bad">${esc(e.message||e)}</div>`}
  }

  const style=document.createElement('style');style.id='amo-remote-recovery-mobile';style.textContent=`
    .remote-recovery-action{margin-top:7px;white-space:nowrap}
    @media(max-width:760px){
      .remote-recovery-table table{min-width:680px}
      .remote-recovery-table th:first-child,.remote-recovery-table td:first-child{position:sticky;left:0;z-index:1;background:var(--panel);min-width:170px}
      .remote-recovery-table th:first-child{z-index:2}
      .remote-recovery-action{display:block;width:max-content}
    }
  `;document.head.appendChild(style);

  ensureNav();const previousSwitch=window.switchView;if(typeof previousSwitch==='function')window.switchView=function(id){const result=previousSwitch.apply(this,arguments);if(id==='restore'&&activeRepo()?.mode==='remote')renderRemoteRestore();return result};
  window.AmoRemoteRecovery={render:renderRemoteRestore};
})();
