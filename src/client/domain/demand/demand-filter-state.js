export const DEFAULT_DEMAND_FILTERS=Object.freeze({show:'active',businessArea:'',initiative:'',ownerId:'',projectNumber:'any',control:'',search:''});

export class DemandFilterState{
  #value;
  constructor(initial={}){this.#value={...DEFAULT_DEMAND_FILTERS,...initial}}
  get value(){return {...this.#value}}
  set(key,value){if(!(key in DEFAULT_DEMAND_FILTERS))throw new Error(`Unknown Demand filter: ${key}`);this.#value={...this.#value,[key]:String(value??'')};return this.value}
  replace(next={}){this.#value={...DEFAULT_DEMAND_FILTERS,...next};return this.value}
  reset(){this.#value={...DEFAULT_DEMAND_FILTERS};return this.value}
  activeEntries(){return Object.entries(this.#value).filter(([key,value])=>key==='show'?value!=='active':value&&value!=='any')}
}
