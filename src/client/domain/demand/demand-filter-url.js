import {DEFAULT_DEMAND_FILTERS} from './demand-filter-state.js';

const CONTROL_VALUES=new Set(['','funding-missing','resource-missing','work-item-missing','actuals-missing']);
const SHOW_VALUES=new Set(['active','all']);
const PROJECT_VALUES=new Set(['any','present','missing']);
const clean=value=>String(value??'').trim();

export function demandFiltersFromSearch(search=''){
  const params=new URLSearchParams(String(search||'').replace(/^\?/,''));
  const show=clean(params.get('show'));
  const project=clean(params.get('projectNumber')||params.get('project'));
  const control=clean(params.get('control'));
  return {
    ...DEFAULT_DEMAND_FILTERS,
    show:SHOW_VALUES.has(show)?show:DEFAULT_DEMAND_FILTERS.show,
    businessArea:clean(params.get('businessArea')),
    initiative:clean(params.get('initiative')),
    ownerId:clean(params.get('ownerId')||params.get('owner')),
    projectNumber:PROJECT_VALUES.has(project)?project:DEFAULT_DEMAND_FILTERS.projectNumber,
    control:CONTROL_VALUES.has(control)?control:'',
    search:clean(params.get('search'))
  };
}

export function demandFiltersToSearch(filters={}){
  const value={...DEFAULT_DEMAND_FILTERS,...filters},params=new URLSearchParams();
  if(value.show!=='active')params.set('show',value.show);
  if(value.businessArea)params.set('businessArea',value.businessArea);
  if(value.initiative)params.set('initiative',value.initiative);
  if(value.ownerId)params.set('owner',value.ownerId);
  if(value.projectNumber&&value.projectNumber!=='any')params.set('project',value.projectNumber);
  if(value.control)params.set('control',value.control);
  if(value.search)params.set('search',value.search);
  const query=params.toString();return query?`?${query}`:'';
}

export function demandDeepLink(filters={}){return `/demand${demandFiltersToSearch(filters)}`}
