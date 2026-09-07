/* Canonical allocation planning domain.
   Steady-state allocations are Person × Work Package × Month, with demandId retained as parent
   context for validation, querying and reporting. Pre-existing Demand-only allocations remain
   readable as legacy undecomposed resource plan until PR B provides the migration UX.

   Quantitative FTE/days/cost valuation remains owned by ReportingModel. This module owns allocation
   identity, target validity and structural Work Package/Demand roll-ups so views do not reinvent them. */
(function initAllocationModel(){
  const MODEL_VERSION=1;
  const trim=v=>String(v??'').trim();
  const number=v=>Number.isFinite(Number(v))?Number(v):0;
  const monthKey=value=>{const m=String(value||'').match(/^(\d{4})-(\d{2})/);return m?`${m[1]}-${m[2]}`:''};
  const monthStart=value=>{const m=monthKey(value);return m?`${m}-01`:''};

  function normalize(record){
    const next=record;
    next.demandId=trim(next?.demandId);
    next.workPackageId=trim(next?.workPackageId)||null;
    next.teamMemberId=trim(next?.teamMemberId);
    next.forecast=next?.forecast&&typeof next.forecast==='object'&&!Array.isArray(next.forecast)?next.forecast:{};
    return next
  }
  const isLegacyUndecomposed=record=>!trim(record?.workPackageId);

  function workPackageById(id,workPackages=[]){return(workPackages||[]).find(w=>w?.id===id)||null}
  function demandById(id,demand=[]){return(demand||[]).find(d=>d?.id===id)||null}
  function personById(id,team=[]){return(team||[]).find(p=>p?.id===id)||null}

  function validate(record,{demand=globalThis.db?.demand||[],workPackages=[],team=globalThis.db?.team||[],allowLegacy=true}={}){
    const a=normalize(structuredClone(record||{})),errors=[],warnings=[];
    if(!a.demandId||!demandById(a.demandId,demand))errors.push('Allocation must reference an existing Demand.');
    if(!a.teamMemberId||!personById(a.teamMemberId,team))errors.push('Allocation must reference an existing Person.');
    if(a.workPackageId){
      const wp=workPackageById(a.workPackageId,workPackages);
      if(!wp)errors.push('Allocation must reference an existing Work Package.');
      else if(wp.demandId!==a.demandId)errors.push('Allocation Work Package must belong to the referenced Demand.');
    }else if(allowLegacy)warnings.push('Legacy allocation is not yet assigned to a Work Package.');
    else errors.push('New allocations must reference a Work Package.');
    return{valid:errors.length===0,legacyUndecomposed:isLegacyUndecomposed(a),errors,warnings,allocation:a}
  }

  function allocationsForDemand(demandId,allocations=globalThis.db?.allocations||[]){return(allocations||[]).filter(a=>a?.demandId===demandId)}
  function allocationsForWorkPackage(workPackageId,allocations=globalThis.db?.allocations||[]){return(allocations||[]).filter(a=>a?.workPackageId===workPackageId)}
  function legacyAllocationsForDemand(demandId,allocations=globalThis.db?.allocations||[]){return allocationsForDemand(demandId,allocations).filter(isLegacyUndecomposed)}
  function plannedAllocationsForDemand(demandId,allocations=globalThis.db?.allocations||[]){return allocationsForDemand(demandId,allocations).filter(a=>!isLegacyUndecomposed(a))}

  function allocationFraction(record,month){
    const start=monthStart(month),key=monthKey(month);return number(record?.forecast?.[start]??record?.forecast?.[key])
  }
  function sumFraction(records,month){return Number((records||[]).reduce((sum,a)=>sum+allocationFraction(a,month),0).toFixed(6))}
  function demandFraction(demandId,month,allocations=globalThis.db?.allocations||[]){return sumFraction(allocationsForDemand(demandId,allocations),month)}
  function workPackageFraction(workPackageId,month,allocations=globalThis.db?.allocations||[]){return sumFraction(allocationsForWorkPackage(workPackageId,allocations),month)}

  function demandBreakdown(demandId,month,{allocations=globalThis.db?.allocations||[],workPackages=[]}={}){
    const all=allocationsForDemand(demandId,allocations),legacy=all.filter(isLegacyUndecomposed),planned=all.filter(a=>!isLegacyUndecomposed(a));
    const packageIds=[...new Set(planned.map(a=>a.workPackageId).filter(Boolean))];
    return{
      demandId,
      month:monthStart(month)||monthKey(month),
      totalFraction:sumFraction(all,month),
      workPackageFraction:sumFraction(planned,month),
      legacyUndecomposedFraction:sumFraction(legacy,month),
      allocationCount:all.length,
      legacyUndecomposedCount:legacy.length,
      workPackages:packageIds.map(id=>{const wp=workPackageById(id,workPackages);return{workPackageId:id,title:wp?.title||'',fraction:sumFraction(planned.filter(a=>a.workPackageId===id),month),allocationCount:planned.filter(a=>a.workPackageId===id).length}})
    }
  }

  function legacySummary(allocations=globalThis.db?.allocations||[]){
    const records=(allocations||[]).filter(isLegacyUndecomposed),demandIds=[...new Set(records.map(a=>a.demandId).filter(Boolean))];
    return{count:records.length,demandCount:demandIds.length,demandIds}
  }

  window.AllocationModel={MODEL_VERSION,normalize,validate,isLegacyUndecomposed,allocationsForDemand,allocationsForWorkPackage,legacyAllocationsForDemand,plannedAllocationsForDemand,allocationFraction,sumFraction,demandFraction,workPackageFraction,demandBreakdown,legacySummary};
})();
