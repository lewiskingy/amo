/* Attention Required includes active Demand that is unallocated or Off Track. */
(function initAttentionHealth(){
  function isOffTrack(d){return String(d?.health||'').trim()==='Off Track'}
  function attentionItems(){
    const demand=typeof scopedDemand==='function'?scopedDemand():db.demand;
    const active=demand.filter(isOpenDemand),allocations=typeof scopedAllocations==='function'?scopedAllocations():db.allocations;
    return active.map(d=>{
      const reasons=[];
      if(!allocations.some(a=>a.demandId===d.id&&a.teamMemberId))reasons.push('No resource allocation');
      if(isOffTrack(d))reasons.push('Health is Off Track');
      return reasons.length?{demandId:d.id,title:d.title,reason:reasons.join('; ')}:null
    }).filter(Boolean)
  }

  const baseDashboardHeadlineSnapshotAttention=dashboardHeadlineSnapshot;
  dashboardHeadlineSnapshot=function(){
    const snapshot=baseDashboardHeadlineSnapshotAttention();
    snapshot.attentionRequired=attentionItems();
    return snapshot
  };

  const baseRenderDashboardAttention=renderDashboard;
  renderDashboard=function(){
    const r=baseRenderDashboardAttention();
    const host=$('attentionList');if(!host)return r;
    if(!workspaceHandle){host.innerHTML='<li>Open a workspace folder to load data.</li>';return r}
    const rows=attentionItems();
    host.innerHTML=rows.length?rows.map(x=>`<li><strong>${escHtml(x.demandId)}</strong> — ${escHtml(x.title)}: ${escHtml(x.reason)}.</li>`).join(''):'<li>No items currently require attention.</li>';
    return r
  };
})();
