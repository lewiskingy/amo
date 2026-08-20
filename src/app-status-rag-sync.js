/* Keep Status Report RAG and Demand health consistent. */
(function initStatusRagSync(){
  function demandRag(d){return String(d?.health||'').trim()}
  function explicitReportEntry(demandId,source){return source?.entries?.find(e=>e.demandId===demandId)||null}
  function effectiveRag(d,e){return String(e?.rag||'').trim()||demandRag(d)}
  function ragIsOverride(d,e){const explicit=String(e?.rag||'').trim();return !!explicit&&explicit!==demandRag(d)}

  /* Rendering and previewing use Demand health unless the report draft explicitly overrides it. */
  const baseStatusDraftEntryRag=statusDraftEntry;
  statusDraftEntry=function(d,source=statusReportDraft){
    const e=baseStatusDraftEntryRag(d,source);
    return {...e,rag:effectiveRag(d,e)}
  };

  function applyRagIndicators(){
    const source=statusReportState.editing?statusReportState.draftBuffer:statusReportDraft;
    document.querySelectorAll('#statusReportTable tr[data-status-demand]').forEach(tr=>{
      const d=db.demand.find(x=>x.id===tr.dataset.statusDemand);if(!d)return;
      const explicit=explicitReportEntry(d.id,source);
      const rag=effectiveRag(d,explicit);
      const cell=tr.children?.[4];if(!cell)return;
      if(statusReportState.editing){
        const select=cell.querySelector('[data-status-field="rag"]');
        if(select&&select.value!==rag)select.value=rag;
        if(select&&!select.dataset.ragSyncBound){select.dataset.ragSyncBound='true';select.addEventListener('change',()=>setTimeout(applyRagIndicators,0))}
        cell.querySelector('.rag-sync-note')?.remove();
        if(ragIsOverride(d,explicit)){
          const note=document.createElement('span');note.className='rag-sync-note';note.textContent=' *';note.title='Will update Demand status';note.setAttribute('aria-label','Will update Demand status');cell.appendChild(note)
        }
      }else{
        cell.innerHTML=`<span class="rag-dot rag-${escHtml(rag||'Unset')}"></span>${escHtml(rag||'Unset')}`
      }
    })
  }

  const baseRenderStatusReportingRag=renderStatusReporting;
  renderStatusReporting=function(){const r=baseRenderStatusReportingRag();applyRagIndicators();return r};

  /* Persist any explicit report override back to the Demand record when the draft is saved. */
  const baseSaveStatusDraftRag=saveStatusDraft;
  saveStatusDraft=function(){
    const source=statusReportState.draftBuffer;
    if(source?.entries){
      for(const e of source.entries){
        const d=db.demand.find(x=>x.id===e.demandId);if(!d)continue;
        const explicit=String(e.rag||'').trim();
        if(explicit&&explicit!==demandRag(d)){
          d.health=explicit;
          d.version=(Number(d.version)||0)+1;
          d.modifiedAt=new Date().toISOString();
          markDirty('demand',d.id,`Updated ${d.id} RAG from Status Report.`)
        }
      }
    }
    return baseSaveStatusDraftRag()
  };

  /* Published snapshots always contain the effective RAG. */
  const baseSnapshotStatusEntryRag=snapshotStatusEntry;
  snapshotStatusEntry=function(d,e){return{...baseSnapshotStatusEntryRag(d,e),rag:effectiveRag(d,e)}};

  const style=document.createElement('style');style.id='status-rag-sync-styles';style.textContent=`.rag-sync-note{font-weight:800;color:var(--warn);cursor:help;margin-left:2px}html[data-theme="dark"] .rag-sync-note{color:var(--warn)}`;document.head.appendChild(style);
})();
