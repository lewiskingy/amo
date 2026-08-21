/* Guard bulk Demand editing so estimate baselines/audit stay controlled by the Demand modal. */
(function initEstimateFundingGuard(){
  if(typeof integratedDemandCell==='function'){
    const baseCell=integratedDemandCell;
    integratedDemandCell=function(row,col){
      if(gridState.demand.editing&&col.key==='triage.romDays')return `<span class="nowrap" title="Edit estimates from the Demand record to preserve estimate history">${escHtml(getPath(row,col.key)??'')}</span>`;
      return baseCell(row,col)
    };
  }
  if(typeof saveGrid==='function'){
    const baseSaveGrid=saveGrid;
    saveGrid=function(name){
      if(name==='demand'&&gridState.demand.editing){
        for(const d of gridState.demand.draft||[]){
          if(gridState.demand.deleted?.has(d.id))continue;
          const phase=d.phase||(window.amoPhaseForStatus?amoPhaseForStatus(d.service,d.status):'');
          const triage=d.triage?.romDays===''||d.triage?.romDays==null?null:Number(d.triage.romDays);
          const committed=d.workPackage?.estimateDays===''||d.workPackage?.estimateDays==null?null:Number(d.workPackage.estimateDays);
          if(phase!=='Triage'&&phase!=='Exit'&&triage==null){alert(`${d.id} needs a Triage Estimate before it can leave Triage. Open the Demand record to enter the estimate.`);return}
          if((phase==='Engaged'||phase==='Governance')&&committed==null){alert(`${d.id} needs a Work Package Committed Estimate before it can leave Mobilisation. Open the Demand record to enter the estimate.`);return}
        }
      }
      return baseSaveGrid(name)
    };
  }
})();
