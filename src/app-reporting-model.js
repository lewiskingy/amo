/* Canonical Actuals + forecast reporting semantics.
   Allocations remain forecast facts. Actuals remain observed facts. Views consume this model rather
   than redefining which source wins for a reporting period or how management signals are classified. */
(function initReportingModel(){
  const DEFAULT_HOURS_PER_DAY=7.5;
  const SIGNAL_THRESHOLDS={
    materialVariancePct:.20,
    lowOverallRatio:.50,
    redirectedOverallRatio:.80,
    overCapacityRatio:1.10,
    minimumFte:.10,
    zeroFte:.01
  };
  let cache={repo:null,loading:null,loaded:false,months:new Set(),periods:new Map(),facts:[],manifest:null};

  const monthKey=value=>{const m=String(value||'').match(/^(\d{4})-(\d{2})/);return m?`${m[1]}-${m[2]}`:''};
  const monthStart=value=>{const m=monthKey(value);return m?`${m}-01`:''};
  const n=value=>Number(value)||0;
  const round=(value,digits=6)=>Number(n(value).toFixed(digits));
  const hoursPerDay=()=>{const value=Number(db?.settings?.reporting?.standardHoursPerDay);return Number.isFinite(value)&&value>0?value:DEFAULT_HOURS_PER_DAY};

  function workingDays(value){
    const key=monthKey(value);if(!key)return 0;
    const [year,month]=key.split('-').map(Number),end=new Date(year,month,0).getDate();let days=0;
    for(let day=1;day<=end;day++){const dow=new Date(year,month-1,day).getDay();if(dow!==0&&dow!==6)days++}
    return days
  }
  const fullTimeHours=value=>workingDays(value)*hoursPerDay();
  const actualFteFromHours=(hours,month)=>{const available=fullTimeHours(month);return available?round(n(hours)/available):0};

  function reset(repo=window.workspaceRepository){cache={repo,loading:null,loaded:false,months:new Set(),periods:new Map(),facts:[],manifest:null}}
  async function load({force=false}={}){
    const repo=window.workspaceRepository;
    if(!repo?.listActualsPeriods){reset(repo);cache.loaded=true;return cache}
    if(cache.repo!==repo)reset(repo);if(cache.loaded&&!force)return cache;if(cache.loading)return cache.loading;
    cache.loading=(async()=>{
      const months=(await repo.listActualsPeriods()).map(monthKey).filter(Boolean).sort(),periods=new Map(),facts=[];
      for(const month of months){const period=await repo.readActualsPeriod(month);if(!period)continue;periods.set(month,period);for(const fact of period.facts||[])facts.push({...fact,month})}
      const manifest=await repo.readActualsManifest();
      cache={repo,loading:null,loaded:true,months:new Set(months),periods,facts,manifest};
      window.dispatchEvent(new CustomEvent('amo:reporting-model-updated',{detail:{months}}));renderIntegratedViews();return cache
    })().catch(error=>{cache.loading=null;console.warn('Could not load Actuals reporting cache.',error);return cache});
    return cache.loading
  }
  function ensureLoaded(){if(window.workspaceRepository&&(!cache.loaded||cache.repo!==window.workspaceRepository)&&!cache.loading)load();return cache.loaded&&cache.repo===window.workspaceRepository}
  const actualsAvailable=month=>{ensureLoaded();return cache.months.has(monthKey(month))};
  const periodBasis=month=>actualsAvailable(month)?'actual':'forecast';
  const actualFacts=predicate=>{ensureLoaded();return cache.facts.filter(predicate)};
  const actualMonths=()=>{ensureLoaded();return[...cache.months].sort()};
  const latestActualMonth=()=>actualMonths().at(-1)||null;

  const actualHours=(personId=null,demandId=null,month=null)=>round(actualFacts(f=>(!personId||f.teamMemberId===personId)&&(!demandId||f.demandId===demandId)&&(!month||f.month===monthKey(month))).reduce((sum,f)=>sum+n(f.actualHours),0));
  const actualCost=(personId=null,demandId=null,month=null)=>round(actualFacts(f=>(!personId||f.teamMemberId===personId)&&(!demandId||f.demandId===demandId)&&(!month||f.month===monthKey(month))).reduce((sum,f)=>sum+n(f.actualCostGbp),0),2);
  const actualFte=(personId=null,demandId=null,month)=>actualFteFromHours(actualHours(personId,demandId,month),month);
  const forecastFte=(personId=null,demandId=null,month)=>round((db?.allocations||[]).filter(a=>(!personId||a.teamMemberId===personId)&&(!demandId||a.demandId===demandId)).reduce((sum,a)=>sum+n(a.forecast?.[monthStart(month)]??a.forecast?.[monthKey(month)]),0));
  const reportedFte=(personId=null,demandId=null,month)=>actualsAvailable(month)?actualFte(personId,demandId,month):forecastFte(personId,demandId,month);
  const varianceFte=(personId=null,demandId=null,month)=>actualsAvailable(month)?round(actualFte(personId,demandId,month)-forecastFte(personId,demandId,month)):null;
  const capacityFte=()=>round((db?.team||[]).filter(t=>t.active!==false).reduce((sum,t)=>sum+n(t.fte),0));
  const reportedTotalFte=month=>reportedFte(null,null,month);
  const utilisationPct=(personId=null,month)=>{const cap=personId?n((db?.team||[]).find(t=>t.id===personId)?.fte):capacityFte();return cap?Math.round(reportedFte(personId,null,month)/cap*100):0};
  const forecastUtilisationPct=(personId=null,month)=>{const cap=personId?n((db?.team||[]).find(t=>t.id===personId)?.fte):capacityFte();return cap?Math.round(forecastFte(personId,null,month)/cap*100):0};

  function knownMonths(){
    ensureLoaded();const months=new Set(cache.months);
    for(const allocation of db?.allocations||[])for(const key of Object.keys(allocation.forecast||{})){const m=monthKey(key);if(m)months.add(m)}
    return[...months].sort()
  }

  function personDemandRows(personId,month){
    if(!actualsAvailable(month))return[];
    const ids=new Set();
    for(const allocation of db?.allocations||[])if(allocation.teamMemberId===personId&&n(allocation.forecast?.[monthStart(month)]??allocation.forecast?.[monthKey(month)])!==0)ids.add(allocation.demandId||'');
    for(const fact of actualFacts(f=>f.teamMemberId===personId&&f.month===monthKey(month)))ids.add(fact.demandId||'');
    return[...ids].map(key=>{
      const demandId=key||null,plannedFte=demandId?forecastFte(personId,demandId,month):0,observedFte=demandId?actualFte(personId,demandId,month):actualFteFromHours(actualFacts(f=>f.teamMemberId===personId&&!f.demandId&&f.month===monthKey(month)).reduce((sum,f)=>sum+n(f.actualHours),0),month);
      return{demandId,plannedFte,actualFte:observedFte,varianceFte:round(observedFte-plannedFte),unplanned:plannedFte<SIGNAL_THRESHOLDS.zeroFte&&observedFte>=SIGNAL_THRESHOLDS.minimumFte}
    }).sort((a,b)=>Math.abs(b.varianceFte)-Math.abs(a.varianceFte))
  }

  function personMonthSummary(personId,month){
    const person=(db?.team||[]).find(t=>t.id===personId)||null,key=monthKey(month),available=actualsAvailable(key),plannedFte=forecastFte(personId,null,key),observedFte=available?actualFte(personId,null,key):0,variance=available?round(observedFte-plannedFte):null,capacity=n(person?.fte),rows=available?personDemandRows(personId,key):[];
    const shortfallRows=rows.filter(r=>r.demandId&&r.plannedFte-r.actualFte>=SIGNAL_THRESHOLDS.minimumFte),increaseRows=rows.filter(r=>r.demandId&&r.actualFte-r.plannedFte>=SIGNAL_THRESHOLDS.minimumFte),shortfallFte=round(shortfallRows.reduce((sum,r)=>sum+Math.max(0,r.plannedFte-r.actualFte),0)),increaseFte=round(increaseRows.reduce((sum,r)=>sum+Math.max(0,r.actualFte-r.plannedFte),0)),redirectedFte=round(Math.min(shortfallFte,increaseFte));
    const noActual=available&&plannedFte>=SIGNAL_THRESHOLDS.minimumFte&&observedFte<SIGNAL_THRESHOLDS.zeroFte;
    const lowOverall=available&&!noActual&&plannedFte>=SIGNAL_THRESHOLDS.minimumFte&&observedFte/plannedFte<SIGNAL_THRESHOLDS.lowOverallRatio;
    const redirected=available&&!noActual&&plannedFte>=SIGNAL_THRESHOLDS.minimumFte&&observedFte/plannedFte>=SIGNAL_THRESHOLDS.redirectedOverallRatio&&redirectedFte>=SIGNAL_THRESHOLDS.minimumFte;
    const overCapacity=available&&capacity>0&&observedFte>capacity*SIGNAL_THRESHOLDS.overCapacityRatio;
    const unplannedFte=round(rows.filter(r=>r.demandId&&r.unplanned).reduce((sum,r)=>sum+r.actualFte,0));
    const unmappedProjectFte=round(rows.filter(r=>!r.demandId).reduce((sum,r)=>sum+r.actualFte,0));
    let primarySignal=null;
    if(noActual)primarySignal='no-actual';else if(lowOverall)primarySignal='low-overall';else if(redirected)primarySignal='redirected';else if(overCapacity)primarySignal='over-capacity';else if(unplannedFte>=SIGNAL_THRESHOLDS.minimumFte)primarySignal='unplanned';
    return{personId,person,month:key,available,plannedFte,actualFte:observedFte,varianceFte:variance,capacityFte:capacity,utilisationPct:capacity?Math.round(observedFte/capacity*100):0,noActual,lowOverall,redirected,redirectedFte,overCapacity,unplannedFte,unmappedProjectFte,primarySignal,demandRows:rows,shortfallRows,increaseRows}
  }

  function managementSignals(month=latestActualMonth()){
    const key=monthKey(month);if(!key||!actualsAvailable(key))return{month:key,noActualPeople:[],lowOverallPeople:[],redirectedPeople:[],overCapacityPeople:[],unplannedPeople:[],unmappedProjectFacts:[],demandOverPlan:[],demandUnderPlan:[]};
    const summaries=(db?.team||[]).filter(t=>t.active!==false).map(t=>personMonthSummary(t.id,key));
    const demandRows=(db?.demand||[]).filter(d=>typeof isOpenDemand!=='function'||isOpenDemand(d)).map(d=>({demand:d,context:demandEffortContext(d.id)}));
    return{
      month:key,
      noActualPeople:summaries.filter(x=>x.noActual),
      lowOverallPeople:summaries.filter(x=>x.lowOverall),
      redirectedPeople:summaries.filter(x=>x.redirected),
      overCapacityPeople:summaries.filter(x=>x.overCapacity),
      unplannedPeople:summaries.filter(x=>x.unplannedFte>=SIGNAL_THRESHOLDS.minimumFte),
      unmappedProjectFacts:actualFacts(f=>f.month===key&&f.teamMemberId&&!f.demandId),
      demandOverPlan:demandRows.filter(x=>x.context.signal==='over-plan'),
      demandUnderPlan:demandRows.filter(x=>x.context.signal==='under-plan')
    }
  }

  function demandSummary(demandId){
    const months=knownMonths(),actualPeriodMonths=months.filter(actualsAvailable),forecastMonths=months.filter(m=>!actualsAvailable(m)),actualToDateFte=round(actualPeriodMonths.reduce((sum,m)=>sum+actualFte(null,demandId,m),0)),forecastRemainingFte=round(forecastMonths.reduce((sum,m)=>sum+forecastFte(null,demandId,m),0)),historicalForecastFte=round(actualPeriodMonths.reduce((sum,m)=>sum+forecastFte(null,demandId,m),0)),varianceToDateFte=round(actualToDateFte-historicalForecastFte),actualHoursToDate=round(actualPeriodMonths.reduce((sum,m)=>sum+actualHours(null,demandId,m),0)),actualCostToDate=round(actualPeriodMonths.reduce((sum,m)=>sum+actualCost(null,demandId,m),0),2);
    return{actualToDateFte,forecastRemainingFte,projectedFte:round(actualToDateFte+forecastRemainingFte),historicalForecastFte,varianceToDateFte,actualHoursToDate,actualCostToDate}
  }

  function demandEffortContext(demandId){
    const summary=demandSummary(demandId),actualPeriodMonths=actualMonths(),variancePct=summary.historicalForecastFte?summary.varianceToDateFte/summary.historicalForecastFte:null;
    let redirectedAwayFte=0,unplannedFte=0,plannedPeopleWithoutActual=new Set();
    for(const month of actualPeriodMonths){
      for(const person of db?.team||[]){
        const pm=personMonthSummary(person.id,month),row=pm.demandRows.find(r=>r.demandId===demandId);if(!row)continue;
        const rowShortfall=Math.max(0,row.plannedFte-row.actualFte),totalShortfall=pm.shortfallRows.reduce((sum,r)=>sum+Math.max(0,r.plannedFte-r.actualFte),0);
        if(pm.redirected&&rowShortfall>=SIGNAL_THRESHOLDS.minimumFte&&totalShortfall>0)redirectedAwayFte+=pm.redirectedFte*(rowShortfall/totalShortfall);
        if(row.unplanned)unplannedFte+=row.actualFte;
        if(row.plannedFte>=SIGNAL_THRESHOLDS.minimumFte&&row.actualFte<SIGNAL_THRESHOLDS.zeroFte)plannedPeopleWithoutActual.add(person.id)
      }
    }
    redirectedAwayFte=round(redirectedAwayFte);unplannedFte=round(unplannedFte);
    let signal='on-plan';
    if(summary.historicalForecastFte>=SIGNAL_THRESHOLDS.minimumFte&&summary.actualToDateFte<SIGNAL_THRESHOLDS.zeroFte)signal='no-actual';
    else if(variancePct!=null&&variancePct>SIGNAL_THRESHOLDS.materialVariancePct)signal='over-plan';
    else if(variancePct!=null&&variancePct<-SIGNAL_THRESHOLDS.materialVariancePct)signal='under-plan';
    else if(unplannedFte>=SIGNAL_THRESHOLDS.minimumFte)signal='unplanned';
    return{demandId,...summary,variancePct,signal,redirectedAwayFte,unplannedFte,plannedPeopleWithoutActual:[...plannedPeopleWithoutActual]}
  }

  function demandEffortMessage(demandId){
    const c=demandEffortContext(demandId),pct=c.variancePct==null?null:Math.round(Math.abs(c.variancePct)*100),parts=[];
    if(c.signal==='no-actual')parts.push('No Actual effort recorded against planned effort to date.');
    else if(c.signal==='over-plan')parts.push(`Actual effort is ${pct}% above plan to date.`);
    else if(c.signal==='under-plan')parts.push(`Actual effort is ${pct}% below plan to date.`);
    if(c.redirectedAwayFte>=SIGNAL_THRESHOLDS.minimumFte)parts.push(`${c.redirectedAwayFte.toFixed(1)} FTE-mo of planned shortfall coincides with those People recording effort on other Demand.`);
    if(c.unplannedFte>=SIGNAL_THRESHOLDS.minimumFte)parts.push(`${c.unplannedFte.toFixed(1)} FTE-mo was recorded without a corresponding Demand allocation.`);
    return parts.join(' ')
  }

  function unplannedFacts(month=null){return actualFacts(f=>(!month||f.month===monthKey(month))&&f.teamMemberId&&!f.demandId)}
  function coverageLabel(){ensureLoaded();const months=actualMonths();if(!months.length)return'No Actuals loaded';const first=months[0],last=months.at(-1),fmt=m=>new Date(`${m}-01T00:00:00`).toLocaleDateString('en-GB',{month:'short',year:'numeric'});return first===last?`Actuals for ${fmt(first)}`:`Actuals ${fmt(first)}–${fmt(last)}`}

  function signalLabel(summary){
    if(summary.noActual)return'No Actuals';if(summary.lowOverall)return'Low overall';if(summary.redirected)return'Redirected';if(summary.overCapacity)return'Over capacity';if(summary.unplannedFte>=SIGNAL_THRESHOLDS.minimumFte)return'Unplanned';return''
  }

  function dashboardAttentionSignals(){
    const signals=managementSignals(),month=signals.month;if(!month)return[];
    const label=typeof monthLabel==='function'?monthLabel(`${month}-01`):month,items=[];
    if(signals.noActualPeople.length)items.push({kind:'planning',code:'no-actual',count:signals.noActualPeople.length,text:`${signals.noActualPeople.length} ${signals.noActualPeople.length===1?'person had':'people had'} planned allocation in ${label} but no Actual effort recorded.`});
    if(signals.lowOverallPeople.length)items.push({kind:'planning',code:'low-overall',count:signals.lowOverallPeople.length,text:`${signals.lowOverallPeople.length} ${signals.lowOverallPeople.length===1?'person recorded':'people recorded'} materially less total effort than planned in ${label}.`});
    if(signals.redirectedPeople.length)items.push({kind:'planning',code:'redirected',count:signals.redirectedPeople.length,text:`${signals.redirectedPeople.length} ${signals.redirectedPeople.length===1?'person had':'people had'} material effort redirected between Demand in ${label}.`});
    if(signals.unplannedPeople.length)items.push({kind:'planning',code:'unplanned',count:signals.unplannedPeople.length,text:`${signals.unplannedPeople.length} ${signals.unplannedPeople.length===1?'person recorded':'people recorded'} material effort against Demand without a corresponding allocation in ${label}.`});
    if(signals.overCapacityPeople.length)items.push({kind:'capacity',code:'over-capacity',count:signals.overCapacityPeople.length,text:`${signals.overCapacityPeople.length} ${signals.overCapacityPeople.length===1?'person exceeded':'people exceeded'} 110% of available capacity in ${label}.`});
    if(signals.demandOverPlan.length)items.push({kind:'delivery',code:'demand-over-plan',count:signals.demandOverPlan.length,text:`${signals.demandOverPlan.length} Demand item${signals.demandOverPlan.length===1?'':'s'} have consumed more than 20% above planned effort to date.`});
    if(signals.unmappedProjectFacts.length)items.push({kind:'data',code:'unmapped-project',count:signals.unmappedProjectFacts.length,text:`${signals.unmappedProjectFacts.length} Actual fact${signals.unmappedProjectFacts.length===1?'':'s'} for known People in ${label} are not mapped to Demand.`});
    return items
  }

  function renderDashboardIntegration(){
    if(!workspaceHandle||!ensureLoaded())return;
    const snapshot=typeof dashboardHeadlineSnapshot==='function'?dashboardHeadlineSnapshot():null,capacityList=document.getElementById('capacityList');if(!snapshot)return;
    if(capacityList)capacityList.innerHTML=(snapshot.capacityOutlook||[]).map(r=>{const pct=Number(r.utilisationPct||0),used=Number(r.reportedFte??r.allocatedFte??0),capacity=Number(r.capacityFte||0),basis=String(r.basis||'forecast').toUpperCase();return`<div style="margin:10px 0"><div class="flex" style="justify-content:space-between"><strong>${escHtml(r.label||r.month)} <span class="muted" style="font-size:.68rem">${basis}</span></strong><span>${used.toFixed(1)} / ${capacity.toFixed(1)} FTE (${pct}%)</span></div><div class="bar ${pct>100?'bad':pct>85?'warn':'good'}"><span style="width:${Math.min(pct,100)}%"></span></div></div>`}).join('')||'<span class="muted">No planning periods configured.</span>';
    const card=[...document.querySelectorAll('#kpiGrid .card')].find(x=>/capacity conflicts/i.test(x.querySelector('.kpi-label')?.textContent||''));if(card){const value=card.querySelector('.kpi-value'),sub=card.querySelector('.kpi-sub');if(value)value.textContent=String(snapshot.capacityConflicts||0);if(sub)sub.textContent='Actual/forecast person-period over-capacity'}
    const attention=document.getElementById('attentionList');if(attention){const rows=snapshot.attentionRequired||[];attention.innerHTML=rows.length?rows.map(item=>`<li>${item.kind==='data'?'<strong>Data:</strong> ':''}${item.demandId?`<strong>${escHtml(item.demandId)}</strong>${item.title?` — ${escHtml(item.title)}`:''}: `:''}${escHtml(item.reason||'')}</li>`).join(''):'<li>No immediate allocation or Actuals issues.</li>'}
  }

  function renderDemandInsights(){
    const section=document.getElementById('demand');if(!section||!workspaceHandle||!ensureLoaded())return;
    let host=document.getElementById('demandEffortInsights');if(!host){host=document.createElement('div');host.id='demandEffortInsights';host.className='card';host.style.marginTop='16px';const detail=document.getElementById('demandDetail');detail?.parentElement?.insertBefore(host,detail)}
    const rows=db.demand.filter(isOpenDemand).map(d=>({d,c:demandEffortContext(d.id)})).filter(x=>x.c.actualToDateFte||x.c.forecastRemainingFte).sort((a,b)=>Math.abs(b.c.varianceToDateFte)-Math.abs(a.c.varianceToDateFte));const fmt=v=>`${n(v).toFixed(1)} FTE-mo`,money=v=>n(v).toLocaleString(undefined,{style:'currency',currency:'GBP',maximumFractionDigits:0});
    host.innerHTML=`<div class="section-title" style="margin-top:0"><div><h2>Demand effort outlook</h2><p class="muted">${coverageLabel()}. Actual-to-date plus allocation forecast for periods without Actuals.</p></div></div>${rows.length?`<div class="table-wrap"><table><thead><tr><th>Demand</th><th>Actual to date</th><th>Forecast remaining</th><th>Projected effort</th><th>Variance to date</th><th>Actual cost</th></tr></thead><tbody>${rows.map(({d,c})=>`<tr><td><strong>${escHtml(d.id)}</strong><br><span class="muted">${escHtml(d.title)}</span>${demandEffortMessage(d.id)?`<br><span class="muted">${escHtml(demandEffortMessage(d.id))}</span>`:''}</td><td>${fmt(c.actualToDateFte)}<br><span class="muted">${Math.round(c.actualHoursToDate)} h</span></td><td>${fmt(c.forecastRemainingFte)}</td><td><strong>${fmt(c.projectedFte)}</strong></td><td><span class="${c.varianceToDateFte>0?'over':''}">${c.varianceToDateFte>=0?'+':''}${fmt(c.varianceToDateFte)}</span><br><span class="muted">vs ${fmt(c.historicalForecastFte)} plan</span></td><td>${money(c.actualCostToDate)}</td></tr>`).join('')}</tbody></table></div>`:'<span class="muted">No mapped Actuals or allocation forecast is available for active Demand.</span>'}`
  }
  function renderIntegratedViews(){renderDashboardIntegration();queueMicrotask(renderDemandInsights)}

  async function saveHoursPerDay(value){const hours=Number(value);if(!Number.isFinite(hours)||hours<=0||hours>24)throw new Error('Standard working hours per day must be greater than 0 and no more than 24.');const repo=window.workspaceRepository;if(!repo)throw new Error('Open a workspace first.');const latest=await repo.getSettings();latest.reporting={...(latest.reporting||{}),standardHoursPerDay:hours};await repo.saveSettings(latest);db.settings={...db.settings,...structuredClone(latest)};db.configFiles=db.configFiles||{};db.configFiles['settings.json']=structuredClone(latest);window.dispatchEvent(new CustomEvent('amo:reporting-model-updated',{detail:{settings:true}}));return hours}
  function decorateConfig(){const content=document.getElementById('configContent');if(!content||!content.querySelector('[data-settings-tab="system"].active'))return;const grid=content.querySelector('.settings-grid');if(!grid||document.getElementById('amoReportingAssumptionsCard'))return;const canEdit=window.amoAccess?.can?.('system.configure')!==false,card=document.createElement('div');card.className='card';card.id='amoReportingAssumptionsCard';card.innerHTML=`<div class="section-title" style="margin-top:0"><div><h2>Reporting assumptions</h2><p class="muted config-description">Converts imported Actual hours into comparable FTE for resource reporting.</p></div></div><div class="settings-field"><label>Standard working hours per day</label>${canEdit?`<div class="flex" style="gap:8px;align-items:center"><input class="cell-input" id="amoStandardHoursPerDay" type="number" min="0.1" max="24" step="0.1" value="${hoursPerDay()}"><button class="btn success" id="amoSaveStandardHours">Save</button></div>`:`<strong>${hoursPerDay()}</strong>`}<div class="settings-note" style="margin-top:6px">Monthly full-time capacity = Monday–Friday working days × this value. Individual available FTE is still taken from People.</div></div>`;card.querySelector('#amoSaveStandardHours')?.addEventListener('click',async()=>{const button=card.querySelector('#amoSaveStandardHours');try{button.disabled=true;await saveHoursPerDay(card.querySelector('#amoStandardHoursPerDay')?.value);if(typeof log==='function')log('Reporting standard working hours updated.');if(typeof refreshAll==='function')refreshAll()}catch(e){alert(e.message||e)}finally{button.disabled=false}});grid.appendChild(card)}
  const configContent=document.getElementById('configContent');if(configContent)new MutationObserver(decorateConfig).observe(configContent,{childList:true,subtree:true});
  window.addEventListener('amo:actuals-updated',()=>{reset(window.workspaceRepository);load({force:true}).then(()=>typeof refreshAll==='function'&&refreshAll())});window.addEventListener('amo:reporting-model-updated',renderIntegratedViews);
  window.ReportingModel={DEFAULT_HOURS_PER_DAY,SIGNAL_THRESHOLDS,monthKey,monthStart,hoursPerDay,workingDays,fullTimeHours,actualFteFromHours,load,ensureLoaded,reset,actualsAvailable,periodBasis,actualMonths,latestActualMonth,actualHours,actualCost,actualFte,forecastFte,reportedFte,varianceFte,capacityFte,reportedTotalFte,utilisationPct,forecastUtilisationPct,knownMonths,personDemandRows,personMonthSummary,managementSignals,demandSummary,demandEffortContext,demandEffortMessage,unplannedFacts,coverageLabel,signalLabel,dashboardAttentionSignals,renderDashboardIntegration,renderDemandInsights,renderIntegratedViews};
})();
