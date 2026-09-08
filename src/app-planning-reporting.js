/* Canonical planning progression and management signals.
   ReportingModel remains authoritative for Actual/Forecast arithmetic. This module composes the
   planning measures owned by Demand, Work Packages and Resource Plan into one reusable context:
   ROM -> Budget Forecast -> WP Estimate -> Resource Plan -> Actual/Projected.
   Budget Forecast is a planning forecast, never an approved financial budget. */
(function initPlanningReporting(){
  const n=v=>Number(v)||0;
  const nullable=v=>v===null||v===undefined||v===''?null:Number(v);
  const round=(v,d=1)=>Number(n(v).toFixed(d));
  const rm=()=>window.ReportingModel;
  const materialPct=()=>rm()?.SIGNAL_THRESHOLDS?.materialVariancePct??.20;
  const periods=()=>typeof planningPeriods==='function'?planningPeriods():[];
  const allocationRows=()=>typeof db!=='undefined'?(db.allocations||[]):[];
  const demandRows=()=>typeof db!=='undefined'?(db.demand||[]):[];
  const demandById=id=>demandRows().find(d=>d.id===id)||null;
  const workPackageById=id=>window.WorkPackages?.state?.rows?.find(w=>w.id===id)||null;
  const workPackageSummary=id=>window.WorkPackages?.summaryForDemand?.(id)||{count:0,estimatedCount:0,estimatedEffortDays:0};

  function allocationPlanDays(predicate){
    const model=rm();if(!model?.allocationDays)return 0;
    return round(periods().reduce((total,month)=>total+allocationRows().filter(predicate).reduce((sum,a)=>sum+n(model.allocationDays(a,month)),0),0),2)
  }
  const demandResourceDays=demandId=>allocationPlanDays(a=>a.demandId===demandId);
  const workPackageResourceDays=workPackageId=>allocationPlanDays(a=>a.workPackageId===workPackageId);
  const legacyAllocationCount=demandId=>allocationRows().filter(a=>a.demandId===demandId&&!a.workPackageId).length;

  function comparison(delta,base,positive,negative){
    if(delta===null||delta===undefined||base===null||base===undefined)return null;
    const ratio=base?delta/base:null,material=ratio!==null&&Math.abs(ratio)>=materialPct();
    return{delta:round(delta,1),ratio,material,state:delta>0?positive:delta<0?negative:'aligned',label:delta===0?'Aligned':`${delta>0?'+':''}${round(delta,1)}d${ratio===null?'':` (${delta>0?'+':''}${Math.round(ratio*100)}%)`}`}
  }

  function demandContext(demandId){
    const demand=demandById(demandId);if(!demand)return null;
    const wp=workPackageSummary(demandId),summary=rm()?.demandSummary?.(demandId)||{};
    const romDays=nullable(demand.initialEstimate?.estimatedDays),budgetForecastDays=nullable(demand.budgetForecast?.estimatedDays),wpEstimateDays=wp.estimatedCount?nullable(wp.estimatedEffortDays):null,resourcePlanDays=demandResourceDays(demandId),actualDaysToDate=nullable(summary.actualDaysToDate)??0,remainingResourcePlanDays=nullable(summary.forecastRemainingDays)??0,projectedDays=nullable(summary.projectedDays)??round(actualDaysToDate+remainingResourcePlanDays,1);
    return{
      demandId,demand,romDays,budgetForecastDays,wpEstimateDays,resourcePlanDays,actualDaysToDate,remainingResourcePlanDays,projectedDays,
      wpCount:n(wp.count),wpEstimatedCount:n(wp.estimatedCount),legacyAllocationCount:legacyAllocationCount(demandId),
      romToBudget:romDays===null||budgetForecastDays===null?null:comparison(budgetForecastDays-romDays,romDays,'forecast-increased','forecast-decreased'),
      wpVsBudget:budgetForecastDays===null||wpEstimateDays===null?null:comparison(wpEstimateDays-budgetForecastDays,budgetForecastDays,'above-budget-forecast','below-budget-forecast'),
      resourceVsBudget:budgetForecastDays===null?null:comparison(resourcePlanDays-budgetForecastDays,budgetForecastDays,'above-budget-forecast','below-budget-forecast'),
      resourceVsWp:wpEstimateDays===null?null:comparison(resourcePlanDays-wpEstimateDays,wpEstimateDays,'above-wp-estimate','below-wp-estimate'),
      projectedVsBudget:budgetForecastDays===null?null:comparison(projectedDays-budgetForecastDays,budgetForecastDays,'above-budget-forecast','below-budget-forecast'),
      projectedVsWp:wpEstimateDays===null?null:comparison(projectedDays-wpEstimateDays,wpEstimateDays,'above-wp-estimate','below-wp-estimate')
    }
  }

  function workPackageContext(workPackageId){
    const workPackage=workPackageById(workPackageId);if(!workPackage)return null;
    const estimateDays=nullable(workPackage.estimatedEffortDays),resourcePlanDays=workPackageResourceDays(workPackageId);
    return{workPackageId,workPackage,estimateDays,resourcePlanDays,resourceVsEstimate:estimateDays===null?null:comparison(resourcePlanDays-estimateDays,estimateDays,'above-estimate','below-estimate')}
  }

  function demandSignals(demandId){
    const c=demandContext(demandId);if(!c)return[];const out=[];
    if(c.budgetForecastDays===null)out.push({code:'budget-forecast-missing',severity:'info',text:'Budget Forecast not set'});
    if(c.budgetForecastDays!==null&&c.wpCount===0)out.push({code:'no-work-packages',severity:'info',text:'Budget Forecast exists but no Work Packages are defined'});
    else if(c.wpCount>c.wpEstimatedCount)out.push({code:'wp-estimate-coverage',severity:'info',text:`${c.wpEstimatedCount}/${c.wpCount} Work Packages estimated`});
    if(c.wpVsBudget?.material)out.push({code:'wp-vs-budget',severity:c.wpVsBudget.delta>0?'warning':'info',text:`WP Estimate ${c.wpVsBudget.label} vs Budget Forecast`});
    if(c.resourceVsBudget?.material)out.push({code:'resource-vs-budget',severity:c.resourceVsBudget.delta>0?'warning':'info',text:`Resource Plan ${c.resourceVsBudget.label} vs Budget Forecast`});
    if(c.projectedVsBudget?.material)out.push({code:'projected-vs-budget',severity:c.projectedVsBudget.delta>0?'warning':'info',text:`Projected effort ${c.projectedVsBudget.label} vs Budget Forecast`});
    if(c.resourceVsWp?.material)out.push({code:'resource-vs-wp',severity:c.resourceVsWp.delta>0?'warning':'info',text:`Resource Plan ${c.resourceVsWp.label} vs WP Estimate`});
    if(c.projectedVsWp?.material)out.push({code:'projected-vs-wp',severity:c.projectedVsWp.delta>0?'warning':'info',text:`Projected effort ${c.projectedVsWp.label} vs WP Estimate`});
    if(c.legacyAllocationCount)out.push({code:'legacy-allocation',severity:'warning',text:`${c.legacyAllocationCount} resource allocation${c.legacyAllocationCount===1?'':'s'} not assigned to a Work Package`});
    return out
  }

  function portfolioSignals(rows=null){
    const source=rows||demandRows().filter(d=>typeof isOpenDemand!=='function'||isOpenDemand(d)),contexts=source.map(d=>demandContext(d.id)).filter(Boolean),signals=contexts.flatMap(c=>demandSignals(c.demandId).map(s=>({...s,demandId:c.demandId,title:c.demand.title})));
    return{contexts,signals,aboveBudgetForecast:signals.filter(s=>['wp-vs-budget','resource-vs-budget','projected-vs-budget'].includes(s.code)&&s.severity==='warning'),aboveDeliveryEstimate:signals.filter(s=>['resource-vs-wp','projected-vs-wp'].includes(s.code)&&s.severity==='warning'),legacyAllocations:signals.filter(s=>s.code==='legacy-allocation'),missingBudgetForecast:signals.filter(s=>s.code==='budget-forecast-missing')}
  }

  const fmtDays=v=>v===null||v===undefined?'—':`${round(v,1)}d`;
  window.PlanningReporting={demandContext,workPackageContext,demandSignals,portfolioSignals,demandResourceDays,workPackageResourceDays,legacyAllocationCount,fmtDays,comparison};
})();
