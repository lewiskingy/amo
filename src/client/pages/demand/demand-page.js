import {DemandFilterState} from '../../domain/demand/demand-filter-state.js';
import {DemandQueryService} from '../../domain/demand/demand-query-service.js';
import {newDemandRecord,prepareDemandForSave} from '../../domain/demand/demand-record.js';
import {prepareWorkPackageForSave} from '../../domain/work-packages/work-package-record.js';
import {renderDemandFilterBar} from './demand-filter-bar.js';
import {renderDemandTable} from './demand-table.js';
import {editDemand} from './demand-editor.js';
import {editWorkPackage} from './work-package-editor.js';
import {ScopeSelector} from '../../shell/scope-selector.js';

export class DemandPage{
  constructor({gateway,elements,settings,workspace,data,onStatus,onEditModeChange}){
    this.gateway=gateway;this.elements=elements;this.settings=settings;this.workspace=workspace;this.data=data;this.onStatus=onStatus;this.onEditModeChange=onEditModeChange;
    this.filters=new DemandFilterState();this.scope={mode:'all'};this.expanded=new Set();this.queryService=this.buildQueryService();this.editMode=false;this.demandDrafts=new Map();this.workPackageDrafts=new Map();this.changedDemandIds=new Set();this.changedWorkPackageIds=new Set();
    this.scopeSelector=new ScopeSelector(elements.scope,{settings,onChange:scope=>{this.scope=scope;this.render()}});
  }
  buildQueryService(){return new DemandQueryService({demands:this.data.demands,workPackages:this.data.workPackages,allocations:this.data.allocations,people:this.data.people,actuals:this.data.actuals||null})}
  demandDraftFor(demand){if(!this.demandDrafts.has(demand.id))this.demandDrafts.set(demand.id,structuredClone(demand));return this.demandDrafts.get(demand.id)}
  workPackageDraftFor(workPackage){if(!this.workPackageDrafts.has(workPackage.id))this.workPackageDrafts.set(workPackage.id,structuredClone(workPackage));return this.workPackageDrafts.get(workPackage.id)}
  render(){
    const filters=this.filters.value,rows=this.queryService.query(filters,this.scope);
    renderDemandFilterBar(this.elements.filters,{filters,settings:this.settings,people:this.data.people,onChange:(key,value)=>{this.filters.set(key,value);this.render()},onClear:()=>{this.filters.reset();this.render()}});
    renderDemandTable(this.elements.table,{demands:rows,queryService:this.queryService,settings:this.settings,people:this.data.people,expanded:this.expanded,editMode:this.editMode,demandDraftFor:d=>this.demandDraftFor(d),workPackageDraftFor:w=>this.workPackageDraftFor(w),onInlineChange:(type,id,field,value)=>this.inlineChange(type,id,field,value),onToggle:id=>{this.expanded.has(id)?this.expanded.delete(id):this.expanded.add(id);this.render()},onEdit:d=>this.openEditor(d),onEditWorkPackage:(wp,d)=>this.openWorkPackageEditor(wp,d)});
    const totalInScope=this.queryService.query({...filters,show:'all',businessArea:'',initiative:'',ownerId:'',projectNumber:'any',control:'',search:''},this.scope).length;
    const changed=this.changedDemandIds.size+this.changedWorkPackageIds.size;this.elements.count.textContent=`Showing ${rows.length} of ${totalInScope} Demand${this.editMode?` · Edit List active${changed?` · ${changed} changed`:''}`:''}`;
    this.elements.chips.innerHTML=this.filters.activeEntries().map(([key,value])=>`<span class="filter-chip">${key}: ${value}</span>`).join('');
  }
  inlineChange(type,id,field,value){
    const draft=type==='demand'?this.demandDrafts.get(id):this.workPackageDrafts.get(id);if(!draft)return;draft[field]=value;
    if(type==='demand')this.changedDemandIds.add(id);else this.changedWorkPackageIds.add(id);
    if(type==='demand'&&field==='businessArea'){const initiatives=(this.settings.initiatives||[]).map(i=>typeof i==='string'?{name:i,businessArea:''}:i);if(draft.initiative&&!initiatives.some(i=>i.name===draft.initiative&&(!i.businessArea||i.businessArea===value)))draft.initiative='';this.render()}
  }
  expandAll(){for(const d of this.queryService.query(this.filters.value,this.scope))this.expanded.add(d.id);this.render()}
  collapseAll(){this.expanded.clear();this.render()}
  resetListDrafts(){this.demandDrafts.clear();this.workPackageDrafts.clear();this.changedDemandIds.clear();this.changedWorkPackageIds.clear()}
  beginListEdit(){if(this.editMode)return;this.editMode=true;this.resetListDrafts();this.onEditModeChange?.(true);this.render()}
  cancelListEdit(){if(!this.editMode)return;this.editMode=false;this.resetListDrafts();this.onEditModeChange?.(false);this.render()}
  async saveListEdit(){
    if(!this.editMode)return;
    try{
      const demands=[...this.changedDemandIds].map(id=>prepareDemandForSave(this.demandDrafts.get(id)));
      const workPackages=[...this.changedWorkPackageIds].map(id=>prepareWorkPackageForSave(this.workPackageDrafts.get(id),{settings:this.settings}));
      const count=demands.length+workPackages.length;if(!count){this.cancelListEdit();return}
      this.onStatus?.({state:'loading',message:`Saving ${count} list change${count===1?'':'s'}…`});
      for(const next of demands)await this.gateway.saveDemand(next);
      for(const next of workPackages)await this.gateway.saveWorkPackage(next);
      for(const next of demands){const index=this.data.demands.findIndex(d=>d.id===next.id);if(index>=0)this.data.demands.splice(index,1,next)}
      for(const next of workPackages){const index=this.data.workPackages.findIndex(w=>w.id===next.id);if(index>=0)this.data.workPackages.splice(index,1,next)}
      this.editMode=false;this.resetListDrafts();this.queryService=this.buildQueryService();this.onEditModeChange?.(false);this.render();this.onStatus?.({state:'ready',message:'Workspace connected',detail:'List changes saved'})
    }catch(error){this.onStatus?.({state:'error',message:'List changes were not saved',detail:error.message||String(error)});throw error}
  }
  async create(){const demand=newDemandRecord({demands:this.data.demands});await editDemand(this.elements.dialog,{demand,settings:this.settings,people:this.data.people,isNew:true,onSave:next=>this.save(next,{isNew:true})})}
  async openEditor(demand){
    const target=this.editMode?this.demandDraftFor(demand):demand;
    await editDemand(this.elements.dialog,{demand:target,settings:this.settings,people:this.data.people,onSave:next=>{
      if(!this.editMode)return this.save(next);
      const original=this.data.demands.find(d=>d.id===next.id)||demand;next.version=original.version;next.modifiedAt=original.modifiedAt;this.demandDrafts.set(next.id,next);this.changedDemandIds.add(next.id);this.render()
    }})
  }
  async openWorkPackageEditor(workPackage,demand){
    const target=this.editMode?this.workPackageDraftFor(workPackage):workPackage;
    await editWorkPackage(this.elements.dialog,{workPackage:target,demand,settings:this.settings,onSave:next=>{
      if(!this.editMode)return this.saveWorkPackage(next);
      const original=this.data.workPackages.find(w=>w.id===next.id)||workPackage;next.version=original.version;next.modifiedAt=original.modifiedAt;this.workPackageDrafts.set(next.id,next);this.changedWorkPackageIds.add(next.id);this.render()
    }})
  }
  async save(next,{isNew=false}={}){
    this.onStatus?.({state:'loading',message:`Saving ${next.id}…`});await this.gateway.saveDemand(next);
    const index=this.data.demands.findIndex(d=>d.id===next.id);if(index>=0)this.data.demands.splice(index,1,next);else this.data.demands.push(next);
    this.queryService=this.buildQueryService();this.render();this.onStatus?.({state:'ready',message:'Workspace connected',detail:`${isNew?'Created':'Saved'} ${next.id}`});
  }
  async saveWorkPackage(next){
    this.onStatus?.({state:'loading',message:`Saving ${next.id}…`});await this.gateway.saveWorkPackage(next);const index=this.data.workPackages.findIndex(w=>w.id===next.id);if(index>=0)this.data.workPackages.splice(index,1,next);else this.data.workPackages.push(next);this.queryService=this.buildQueryService();this.render();this.onStatus?.({state:'ready',message:'Workspace connected',detail:`Saved ${next.id}`})
  }
  start(){this.scopeSelector.render();this.render()}
}
