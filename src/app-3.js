const activeTeam=db.team.filter(t=>t.active!==false),capacity=teamCapacity(),unmet=unresolvedWithoutAllocation();
const peak=YEAR_MONTHS.map(m=>({m,used:allocatedTotal(m)})).sort((a,b)=>b.used-a.used)[0]||{m:YEAR_MONTHS[0],used:0};
const overMonths=YEAR_MONTHS.filter(m=>allocatedTotal(m)>capacity).length;
const currentMonth=`${CURRENT_YEAR}-${String(new Date().getMonth()+1).padStart(2,'0')}`,currentUsed=allocatedTotal(currentMonth);
$('resourceKpis').innerHTML=[
  ['Available capacity',`${capacity.toFixed(1)} FTE`,'Active team baseline'],
  ['Current allocated',`${currentUsed.toFixed(1)} FTE`,`${monthLabel(currentMonth)} allocation`],
  ['Unmet demand',unmet.length,'Unresolved items with no resource'],
  ['Over-capacity months',overMonths,`Peak ${monthLabel(peak.m)}: ${peak.used.toFixed(1)} FTE`]
].map(k=>`<div class="card"><div class="kpi-label">${k[0]}</div><div class="kpi-value">${k[1]}</div><div class="kpi-sub">${k[2]}</div></div>`).join('');
const metric=(label,cls,fn)=>`<tr class="metric-row ${cls}"><td>${label}</td>${YEAR_MONTHS.map(m=>`<td>${fn(m)}</td>`).join('')}</tr>`;
$('resourceSummaryTable').innerHTML=`<thead><tr><th>Metric</th>${YEAR_MONTHS.map(m=>`<th>${monthLabel(m)}</th>`).join('')}</tr></thead><tbody>`+
  metric('Available capacity','metric-capacity',()=>`${capacity.toFixed(1)} FTE`)+
  metric('Allocated resource','metric-allocated',m=>`${allocatedTotal(m).toFixed(1)} FTE`)+
  metric('Remaining / over capacity',YEAR_MONTHS.some(m=>allocatedTotal(m)>capacity)?'metric-gap over':'metric-gap',m=>{const gap=capacity-allocatedTotal(m);return `<span class="${gap<0?'over':''}">${gap>=0?'+':''}${gap.toFixed(1)} FTE</span>`})+
  metric('Utilisation','',m=>{const pct=capacity?Math.round(allocatedTotal(m)/capacity*100):0;return `<span class="pill ${pct>100?'red':pct>=85?'amber':'green'}">${pct}%</span>`})+
  `</tbody>`;
$('unmetDemandPanel').innerHTML=unmet.length?`<ul class="unmet-list">${unmet.map(d=>`<li><strong>${d.id}</strong> — ${d.title}<br><span class="muted">${d.priority||'—'} · ${d.service||'—'} · ${d.status||'—'}</span></li>`).join('')}</ul>`:'<span class="pill green">No unresolved demand without resource allocation</span>';
const overPeople=activeTeam.filter(t=>YEAR_MONTHS.some(m=>allocationFor(t.id,m)>(Number(t.fte)||0)));
const underNow=activeTeam.filter(t=>allocationFor(t.id,currentMonth)<(Number(t.fte)||0)*.5);
$('resourceSignals').innerHTML=[
  ['Team members',activeTeam.length],
  ['People over-allocated',overPeople.length],
