import {DemandFilterState} from '../../domain/demand/demand-filter-state.js';
import {DemandQueryService} from '../../domain/demand/demand-query-service.js';
import {renderDemandFilterBar} from './demand-filter-bar.js';
import {renderDemandTable} from './demand-table.js';
import {editDemand} from './demand-editor.js';
import {ScopeSelector} from '../../shell/scope-selector.js';

export class DemandPage{
  constructor({gateway,elements,settings,workspace,data,onStatus}){
    this.gateway=gateway;this.elements=elements;this.settings=settings;this.workspace=workspace;this.data=data;this.onStatus=onStatus;
    this.filters=new DemandFilterState();this.scope={mode:'all'};this.expanded=new Set();
    this.queryService=this.buildQueryService();
    this.scopeSelector=new ScopeSelector(elements.scope,{settings,onChange:scope=>{this.scope=scope;this.render()}});
  }
  buildQueryService(){return new DemandQueryService({demands:this.data.demands,workPackages:this.data.workPackages,allocations:this.data.allocations,people:this.data.people})}
  render(){
    const filters=this.filters.value;
    const rows=this.queryService.query(filters,this.scope);
    renderDemandFilterBar(this.elements.filters,{filters,settings:this.settings,people:this.data.people,onChange:(key,value)=>{this.filters.set(key,value);this.render()},onClear:()=>{this.filters.reset();this.render()}});
    renderDemandTable(this.elements.table,{demands:rows,queryService:this.queryService,settings:this.settings,expanded:this.expanded,onToggle:id=>{this.expanded.has(id)?this.expanded.delete(id):this.expanded.add(id);this.render()},onEdit:d=>this.openEditor(d)});
    const totalInScope=this.queryService.query({...filters,show:'all',businessArea:'',initiative:'',ownerId:'',projectNumber:'any',control:'',search:''},this.scope).length;
    this.elements.count.textContent=`Showing ${rows.length} of ${totalInScope} Demand`;
    this.elements.chips.innerHTML=this.filters.activeEntries().map(([key,value])=>`<span class="filter-chip">${key}: ${value}</span>`).join('');
  }
  expandAll(){for(const d of this.queryService.query(this.filters.value,this.scope))this.expanded.add(d.id);this.render()}
  collapseAll(){this.expanded.clear();this.render()}
  async openEditor(demand){await editDemand(this.elements.dialog,{demand,settings:this.settings,people:this.data.people,onSave:next=>this.save(next)})}
  async save(next){
    this.onStatus?.({state:'loading',message:`Saving ${next.id}…`});
    await this.gateway.saveDemand(next);
    const index=this.data.demands.findIndex(d=>d.id===next.id);if(index>=0)this.data.demands.splice(index,1,next);
    this.queryService=this.buildQueryService();this.render();this.onStatus?.({state:'ready',message:'Remote Workspace connected',detail:`Saved ${next.id}`});
  }
  start(){this.scopeSelector.render();this.render()}
}
