/* Converge Demand and Status Reporting on one Health model. Legacy RAG values remain readable. */
(function initStatusHealthSync(){
  const HEALTH_STATES=['On Track','At Risk','Off Track'];
  const LEGACY_HEALTH={Green:'On Track',Amber:'At Risk',Red:'Off Track','On Track':'On Track','At Risk':'At Risk','Off Track':'Off Track'};
  const HEALTH_HELP={
    'On Track':'Target is expected to be met with the current plan.',
    'At Risk':'Target is at risk without action; recovery is expected to remain possible.',
    'Off Track':'Without action the target will not be met and recovery may be difficult or no longer possible.'
  };
  const normalizeHealth=v=>LEGACY_HEALTH[String(v||'').trim()]||String(v||'').trim();
  const demandHealth=d=>normalizeHealth(d?.health);
  const explicitReportEntry=(demandId,source)=>source?.entries?.find(e=>e.demandId===demandId)||null;
  /* During edit the legacy `rag` control contains the live selection; persisted drafts use `health`. */
  const explicitEntryHealth=e=>normalizeHealth(e?.rag||e?.health);
  const effectiveHealth=(d,e)=>explicitEntryHealth(e)||demandHealth(d);
  const healthIsOverride=(d,e)=>{const explicit=explicitEntryHealth(e);return !!explicit&&explicit!==demandHealth(d)};
  const healthTone=v=>v==='On Track'?'green':v==='At Risk'?'amber':v==='Off Track'?'red':'unset';

  function normalizeHealthModel(){
    if(!db?.settings)return;
    let changed=false;
    if(JSON.stringify(db.settings.healthStates)!==JSON.stringify(HEALTH_STATES)){
      db.settings.healthStates=[...HEALTH_STATES];
      if(db.configFiles)db.configFiles['settings.json']={...(db.configFiles['settings.json']||{}),...clone(db.settings)};
      configDirty=true;changed=true
    }
    for(const d of db.demand||[]){
      const next=normalizeHealth(d.health);
      if(next&&next!==d.health){d.health=next;markDirty('demand',d.id,`Migrated ${d.id} Health to ${next}.`);changed=true}
    }
    const normalizeEntry=e=>{
      const next=normalizeHealth(e?.health||e?.rag);
      if(next)e.health=next;
      if(Object.prototype.hasOwnProperty.call(e,'rag'))delete e.rag
    };
    for(const e of statusReportDraft?.entries||[])normalizeEntry(e);
    /* Historical reports are normalized in memory only; they remain immutable on disk. */
    for(const r of statusReports||[])for(const e of r.entries||[])normalizeEntry(e);
    if(changed&&typeof requestAutosave==='function')requestAutosave()
  }

  /* Existing reports/drafts fall back to Demand Health until explicitly overridden. */
  const baseStatusDraftEntryHealth=statusDraftEntry;
  statusDraftEntry=function(d,source=statusReportDraft){
    const e=baseStatusDraftEntryHealth(d,source),explicit=explicitReportEntry(d.id,source),health=effectiveHealth(d,e);
    return {...e,health,rag:health,healthChanged:healthIsOverride(d,explicit)}
  };
  const baseReportHasContentHealth=reportHasContent;
  reportHasContent=function(e){return baseReportHasContentHealth(e)||!!e?.healthChanged};

  function healthOptions(selected,includeAll=false){
    return `${includeAll?'<option value="">All</option>':'<option value="">Unset</option>'}${HEALTH_STATES.map(v=>`<option value="${escHtml(v)}" ${v===selected?'selected':''}>${escHtml(v)}</option>`).join('')}`
  }

  function applyHealthUi(){
    const source=statusReportState.editing?statusReportState.draftBuffer:statusReportDraft;
    const sortHead=document.querySelector('#statusReportTable th[data-sr-sort="rag"]');
    if(sortHead)sortHead.textContent=`Health${statusReportState.sort==='rag'?(statusReportState.direction==='asc'?' ↑':' ↓'):' ↕'}`;
    const filter=document.querySelector('#statusReportTable [data-sr-filter="rag"]');
    if(filter){const selected=normalizeHealth(filter.value);filter.innerHTML=healthOptions(selected,true);filter.value=selected}
    document.querySelectorAll('#statusReportTable tr[data-status-demand]').forEach(tr=>{
      const d=db.demand.find(x=>x.id===tr.dataset.statusDemand);if(!d)return;
      const explicit=explicitReportEntry(d.id,source),health=effectiveHealth(d,explicit),cell=tr.children?.[4];if(!cell)return;
      cell.title=health?HEALTH_HELP[health]||'Demand Health':'Health has not been set.';
      if(statusReportState.editing){
        const select=cell.querySelector('[data-status-field="rag"]');
        if(select){
          select.innerHTML=healthOptions(health,false);select.value=health;
          if(!select.dataset.healthSyncBound){select.dataset.healthSyncBound='true';select.addEventListener('change',()=>setTimeout(applyHealthUi,0))}
        }
        cell.querySelector('.health-sync-note')?.remove();
        if(healthIsOverride(d,explicit)){
          const note=document.createElement('span');note.className='health-sync-note';note.textContent=' *';
          note.title='Will update Demand Health when this Status Report is published.';note.setAttribute('aria-label',note.title);cell.appendChild(note)
        }
      }else cell.innerHTML=`<span class="rag-dot health-${healthTone(health)}"></span>${escHtml(health||'Unset')}`
    })
  }

  const baseRenderStatusReportingHealth=renderStatusReporting;
  renderStatusReporting=function(){const r=baseRenderStatusReportingHealth();applyHealthUi();applyHealthConfigSemantics();return r};

  /* Saving Draft stores only genuine overrides. Matching Demand Health remains inherited. */
  const baseSaveStatusDraftHealth=saveStatusDraft;
  saveStatusDraft=function(){
    if(statusReportState.draftBuffer?.entries){
      for(const e of statusReportState.draftBuffer.entries){
        const d=db.demand.find(x=>x.id===e.demandId),next=explicitEntryHealth(e);
        if(next&&d&&next!==demandHealth(d))e.health=next;else delete e.health;
        delete e.rag;delete e.healthChanged
      }
    }
    return baseSaveStatusDraftHealth()
  };

  /* New snapshots persist Health, while old report RAG remains readable. */
  const baseSnapshotStatusEntryHealth=snapshotStatusEntry;
  snapshotStatusEntry=function(d,e){const snap=baseSnapshotStatusEntryHealth(d,e);delete snap.rag;delete snap.healthChanged;snap.health=effectiveHealth(d,e);return snap};

  /* Core narrative rendering still expects `rag`; adapt only for presentation. */
  const baseReportNarrativeHealth=reportNarrativeHtml;
  reportNarrativeHtml=function(report){
    const copy=clone(report);copy.entries=(copy.entries||[]).map(e=>({...e,rag:normalizeHealth(e.health||e.rag)}));
    let html=baseReportNarrativeHealth(copy).replaceAll('RAG not set','Health not set');
    html=html.replace(/rag-(On Track|At Risk|Off Track)/g,(_,v)=>`health-${healthTone(v)}`);
    return html
  };

  /* Publish is the commit point: confirmed report Health updates Demand, then the immutable report snapshots exactly that Health. */
  publishStatusReport=function(){
    const preview=buildPreviewReport();
    if(!preview.entries.length){alert('Add at least one Status Update, Achievement, Issue or Health change before publishing.');return}
    if(!confirm(`Publish this status report with ${preview.entries.length} reported demand item${preview.entries.length===1?'':'s'}? Published reports are immutable and any Health overrides will update the corresponding Demand items.`))return;
    const source=statusReportState.editing?statusReportState.draftBuffer:statusReportDraft;
    for(const e of source?.entries||[]){
      const d=db.demand.find(x=>x.id===e.demandId);if(!d)continue;
      const next=explicitEntryHealth(e);if(!next||next===demandHealth(d))continue;
      d.health=next;d.version=(Number(d.version)||0)+1;d.modifiedAt=new Date().toISOString();
      markDirty('demand',d.id,`Updated ${d.id} Health to ${next} from published Status Report.`)
    }
    const finalPreview=buildPreviewReport();
    finalPreview.entries=(finalPreview.entries||[]).map(e=>{const d=db.demand.find(x=>x.id===e.demandId);const out={...e};delete out.rag;out.health=d?demandHealth(d):normalizeHealth(e.health);return out});
    const report={...finalPreview,id:statusReportId(),status:'Published',publishedAt:new Date().toISOString(),publishedBy:'Workspace User'};
    statusReports.unshift(report);markPublishedDirty(report.id,`Published status report ${report.id}.`);
    statusReportDraft={id:'DRAFT',status:'Draft',reportingDate:todayIso(),entries:[]};statusReportState.draftDirty=true;statusReportState.editing=false;statusReportState.draftBuffer=null;
    requestAutosave();renderStatusReporting();renderStatusHistory();openStatusReportModal(report)
  };

  function applyHealthConfigSemantics(){
    const cards=[...document.querySelectorAll('#configContent .config-card')];
    const card=cards.find(c=>c.querySelector('h2')?.textContent.trim()==='Health States');if(!card)return;
    const desc=card.querySelector('.config-description');if(desc)desc.textContent='Controlled portfolio Health: On Track = target expected to be met; At Risk = target is at risk without action but recoverable; Off Track = target will not be met without action and may be unrecoverable.';
    card.querySelector('[data-config-add]')?.remove();
    card.querySelectorAll('[data-config-input]').forEach(i=>i.disabled=true);
    card.querySelectorAll('[data-config-delete]').forEach(b=>b.remove())
  }
  const baseRenderConfigHealth=renderConfig;
  renderConfig=function(){const r=baseRenderConfigHealth();applyHealthConfigSemantics();return r};

  /* Normalize once now and after any future workspace open/reconnect. */
  const baseOpenWorkspaceHealth=openWorkspace;
  openWorkspace=async function(){const r=await baseOpenWorkspaceHealth();normalizeHealthModel();renderStatusReporting();renderConfig();return r};
  normalizeHealthModel();

  const style=document.createElement('style');style.id='status-health-sync-styles';style.textContent=`
    .health-sync-note{font-weight:800;color:var(--warn);cursor:help;margin-left:2px}.health-green{background:#1b7f5a}.health-amber{background:#d88a00}.health-red{background:#b42318}.health-unset{background:#98a2b3}
    html[data-theme="dark"] .health-sync-note{color:var(--warn)}
  `;document.head.appendChild(style);
})();
