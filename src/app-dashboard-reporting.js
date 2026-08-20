/* Shared dashboard headline metrics and immutable status-report snapshots. */
function dashboardHeadlineSnapshot(){
  const months=planningMonths(),active=db.demand.filter(isOpenDemand);
  const unallocated=active.filter(d=>!db.allocations.some(a=>a.demandId===d.id&&a.teamMemberId)).length;
  const socialisation=active.filter(d=>/(socialisation|socialization)/i.test(d.status||'')).length;
  const governance=active.filter(d=>/(approval|governance)/i.test(d.status||'')).length;
  const conflicts=db.team.reduce((n,t)=>n+months.filter(m=>allocationFor(t.id,m)>(Number(t.fte)||0)).length,0);
  const capacity=teamCapacity();
  const capacityOutlook=months.map(m=>{const allocated=allocatedTotal(m),utilisation=capacity?Math.round(allocated/capacity*100):0;return{month:m,label:monthLabel(m),capacityFte:capacity,allocatedFte:allocated,utilisationPct:utilisation}});
  const attention=unresolvedWithoutAllocation().map(d=>({demandId:d.id,title:d.title,reason:'No resource allocation'}));
  return{capturedAt:new Date().toISOString(),activeDemand:active.length,unallocated,inSocialisation:socialisation,inGovernance:governance,capacityConflicts:conflicts,capacityOutlook,attentionRequired:attention};
}
function dashboardCardsHtml(snapshot){const cards=[['Active demand',snapshot.activeDemand,'Unresolved Architecture demand'],['Unallocated',snapshot.unallocated,'Needs resource allocation'],['In socialisation',snapshot.inSocialisation,'In Socialisation / Review'],['In governance',snapshot.inGovernance,'In Approval / Governance'],['Capacity conflicts',snapshot.capacityConflicts,'Person-period over-allocation']];return `<div class="grid kpis report-headline-kpis">${cards.map(k=>`<div class="card"><div class="kpi-label">${k[0]}</div><div class="kpi-value">${k[1]}</div><div class="kpi-sub">${k[2]}</div></div>`).join('')}</div>`}
function capacitySnapshotHtml(snapshot){const rows=snapshot.capacityOutlook||[];return `<div class="card report-snapshot-panel"><div class="section-title" style="margin-top:0"><h3>Capacity outlook</h3></div>${rows.length?rows.map(r=>`<div style="margin:10px 0"><div class="flex" style="justify-content:space-between"><strong>${escHtml(r.label||r.month)}</strong><span>${Number(r.allocatedFte||0).toFixed(1)} / ${Number(r.capacityFte||0).toFixed(1)} FTE (${Number(r.utilisationPct||0)}%)</span></div><div class="bar ${r.utilisationPct>100?'bad':r.utilisationPct>85?'warn':'good'}"><span style="width:${Math.min(Number(r.utilisationPct||0),100)}%"></span></div></div>`).join(''):'<span class="muted">No planning months configured.</span>'}</div>`}
function attentionSnapshotHtml(snapshot){const rows=snapshot.attentionRequired||[];return `<div class="card report-snapshot-panel"><div class="section-title" style="margin-top:0"><h3>Attention required</h3></div>${rows.length?`<ul>${rows.map(x=>`<li><strong>${escHtml(x.demandId)}</strong> — ${escHtml(x.title)}: ${escHtml(x.reason)}</li>`).join('')}</ul>`:'<span class="muted">No immediate allocation issues.</span>'}</div>`}
function dashboardSnapshotHtml(snapshot){return `<div class="report-dashboard-snapshot">${dashboardCardsHtml(snapshot)}<div class="split" style="margin-top:16px">${capacitySnapshotHtml(snapshot)}${attentionSnapshotHtml(snapshot)}</div></div>`}
function ensureDashboardReportingStyles(){if(document.getElementById('dashboard-reporting-styles'))return;const s=document.createElement('style');s.id='dashboard-reporting-styles';s.textContent='.report-headline-kpis{grid-template-columns:repeat(5,minmax(0,1fr))}.report-snapshot-panel{box-shadow:none}.report-dashboard-snapshot{margin:14px 0 22px}@media(max-width:1100px){.report-headline-kpis{grid-template-columns:repeat(3,1fr)}}@media(max-width:760px){.report-headline-kpis{grid-template-columns:1fr}}';document.head.appendChild(s)}

/* Dashboard uses the same shared metric definition as Status Reporting. */
const baseRenderDashboardHeadline=renderDashboard;
renderDashboard=function(){
  baseRenderDashboardHeadline();
  const snapshot=dashboardHeadlineSnapshot(),grid=$('kpiGrid');
  if(grid)grid.innerHTML=dashboardCardsHtml(snapshot).replace(/^<div class="grid kpis report-headline-kpis">|<\/div>$/g,'');
};

/* Add a live management snapshot above the working Status Report draft. */
function ensureStatusDashboardSnapshot(){ensureDashboardReportingStyles();const section=$('status-report'),table=$('statusReportTable');if(!section||!table)return;let host=$('statusDashboardSnapshot');if(!host){host=document.createElement('div');host.id='statusDashboardSnapshot';const currentHeading=[...section.querySelectorAll('.section-title h2')].find(h=>h.textContent.trim()==='Current Draft')?.closest('.section-title');if(currentHeading)section.insertBefore(host,currentHeading);else table.closest('.table-wrap')?.before(host)}host.innerHTML=`<div class="section-title"><h2>Portfolio Snapshot</h2><span class="muted">Current live position; captured when the report is published.</span></div>${dashboardSnapshotHtml(dashboardHeadlineSnapshot())}`}
const baseRenderStatusReportingHeadline=renderStatusReporting;
renderStatusReporting=function(){baseRenderStatusReportingHeadline();ensureStatusDashboardSnapshot()};

/* Preview captures the current headline state. Published reports retain it immutably. */
const baseBuildPreviewReportHeadline=buildPreviewReport;
buildPreviewReport=function(){const report=baseBuildPreviewReportHeadline();report.dashboardSnapshot=dashboardHeadlineSnapshot();return report};

/* Narrative Preview/View includes the captured headline information above Demand updates. */
const baseReportNarrativeHtmlHeadline=reportNarrativeHtml;
reportNarrativeHtml=function(report){
  ensureDashboardReportingStyles();
  const base=baseReportNarrativeHtmlHeadline(report),snapshot=report.dashboardSnapshot;
  if(!snapshot)return base;
  const opening='<div class="report-card">';
  return base.startsWith(opening)?opening+dashboardSnapshotHtml(snapshot)+base.slice(opening.length):dashboardSnapshotHtml(snapshot)+base;
};

/* Backward-compatible historical reports without a snapshot remain viewable. */
ensureDashboardReportingStyles();
