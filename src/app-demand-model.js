/* Canonical Defined Demand model for Step 4.
   Demand is the early/portfolio boundary; Work Packages own delivery service, scope, dates and refined estimates. */
(function initDefinedDemandModel(){
  const MODEL_VERSION=2;
  const DEMAND_STATES=['Assessing','Defined','Planned','In Progress','On Hold','Complete','Cancelled'];
  const WORK_PACKAGE_STATUSES=['Planned','Ready','In Progress','Blocked','Complete','Cancelled'];
  const DEFAULT_SIZE_DAYS={XS:2,S:5,M:10,L:20,XL:40};
  const TERMINAL_STATES=new Set(['Complete','Cancelled']);
  const trim=v=>String(v??'').trim();
  const numberOrNull=v=>v===null||v===undefined||v===''?null:(Number.isFinite(Number(v))?Number(v):null);

  function normalizeSizeDays(value){
    const src=value&&typeof value==='object'&&!Array.isArray(value)?value:{};
    const out={};for(const key of Object.keys(DEFAULT_SIZE_DAYS)){const n=numberOrNull(src[key]);out[key]=n!=null&&n>=0?n:DEFAULT_SIZE_DAYS[key]}return out
  }
  function inferSize(days,sizeDays=DEFAULT_SIZE_DAYS){
    const n=numberOrNull(days);if(n==null)return'';let best='',distance=Infinity;
    for(const [size,value] of Object.entries(normalizeSizeDays(sizeDays))){const d=Math.abs(value-n);if(d<distance){best=size;distance=d}}
    return best
  }
  function canonicalState(status){
    const raw=trim(status);if(DEMAND_STATES.includes(raw))return raw;const s=raw.toLowerCase();
    if(/cancel|reject|declin|withdraw|abandon|supersed|refer/.test(s))return'Cancelled';
    if(/complete|completed|closed/.test(s))return'Complete';
    if(/on hold|paused|blocked/.test(s))return'On Hold';
    if(/triage|assessment|priorit/.test(s))return'Assessing';
    if(/accepted|defined/.test(s))return'Defined';
    if(/mobilis|mobiliz|ready|committed|planned/.test(s))return'Planned';
    return raw?'In Progress':'Assessing'
  }
  function contextFromLegacy(d){
    if(trim(d?.context))return trim(d.context);const parts=[];
    const add=(label,value)=>{const v=trim(value);if(v&&!parts.some(x=>x.value===v))parts.push({label,value:v})};
    add('',d?.triage?.summary);add('Objective',d?.workPackage?.objective);add('Scope',d?.workPackage?.scope);add('Out of scope',d?.workPackage?.outOfScope);
    return parts.map(p=>p.label?`${p.label}: ${p.value}`:p.value).join('\n\n')
  }
  function initialEstimateFromLegacy(d,settings){
    const existing=d?.initialEstimate||{};let estimatedDays=numberOrNull(existing.estimatedDays),size=trim(existing.size).toUpperCase();
    const legacyDays=numberOrNull(d?.triage?.romDays);if(estimatedDays==null&&legacyDays!=null)estimatedDays=legacyDays;
    if(!size){const complexity=trim(d?.triage?.complexity).toLowerCase();const mapped={tiny:'XS',small:'S',medium:'M',large:'L','very large':'XL',xlarge:'XL'}[complexity];size=mapped||inferSize(estimatedDays,settings?.demandSizeDays)}
    if(size&&!Object.prototype.hasOwnProperty.call(DEFAULT_SIZE_DAYS,size))size=inferSize(estimatedDays,settings?.demandSizeDays);
    if(estimatedDays==null&&size)estimatedDays=normalizeSizeDays(settings?.demandSizeDays)[size];
    return{size:size||'',estimatedDays}
  }
  function legacySnapshot(d){
    const legacy={...(d?.legacy||{})};
    if(d?.service&&!legacy.service)legacy.service=d.service;
    if(d?.triage&&!legacy.triage)legacy.triage=structuredClone(d.triage);
    if(d?.workPackage&&!legacy.demandWorkPackage)legacy.demandWorkPackage=structuredClone(d.workPackage);
    if(Array.isArray(d?.deliverables)&&d.deliverables.length&&!legacy.deliverables)legacy.deliverables=structuredClone(d.deliverables);
    return legacy
  }
  function normalizeSettings(settings){
    const next=settings||{};next.demandModelVersion=MODEL_VERSION;
    next.statuses=[...DEMAND_STATES];
    next.services=[...new Set((Array.isArray(next.services)?next.services:[]).map(trim).filter(x=>x&&x.toLowerCase()!=='triage'))];
    if(!next.services.length)next.services=['Consultancy','Assurance','Design','Strategy'];
    next.workPackageStatuses=[...new Set((Array.isArray(next.workPackageStatuses)?next.workPackageStatuses:WORK_PACKAGE_STATUSES).map(trim).filter(Boolean))];
    if(!next.workPackageStatuses.length)next.workPackageStatuses=[...WORK_PACKAGE_STATUSES];
    next.demandSizeDays=normalizeSizeDays(next.demandSizeDays);
    delete next.serviceWorkflows;delete next.serviceWorkflowPhases;delete next.serviceWorkflowDefaults;delete next.lifecyclePhaseModelVersion;
    return next
  }
  function normalizeDemand(d,settings){
    const next=d;next.context=contextFromLegacy(next);next.ownerId=trim(next.ownerId||next?.workPackage?.architectureOwner)||null;next.initialEstimate=initialEstimateFromLegacy(next,settings);next.status=canonicalState(next.status);next.source=next.source||{type:'SharePoint',id:'',url:'',title:''};next.source.type=next.source.type||'SharePoint';next.source.id=trim(next.source.id);next.source.url=trim(next.source.url);next.source.title=trim(next.source.title);next.businessArea=trim(next.businessArea);next.initiative=trim(next.initiative);next.projectNumber=trim(next.projectNumber);next.priority=trim(next.priority);next.health=trim(next.health);next.legacy=legacySnapshot(next);delete next.service;delete next.phase;delete next.triage;delete next.workPackage;delete next.deliverables;next.demandModelVersion=MODEL_VERSION;return next
  }
  function migrateWorkspace(settings,demand){
    const beforeSettings=JSON.stringify(settings||{});normalizeSettings(settings);let changed=beforeSettings!==JSON.stringify(settings||{}),demandIds=[];
    for(const d of demand||[]){const before=JSON.stringify(d);normalizeDemand(d,settings);if(before!==JSON.stringify(d)){changed=true;demandIds.push(d.id)}}
    return{changed,demandIds,note:changed?'Defined Demand model v2: Demand lifecycle, initial sizing and delivery-boundary fields normalised; legacy delivery metadata retained under legacy.':''}
  }
  function initialEstimateDays(d){return numberOrNull(d?.initialEstimate?.estimatedDays)}
  function isOpen(d){return !TERMINAL_STATES.has(canonicalState(d?.status))}
  function legacyDeliveryWindow(d){const legacy=d?.legacy?.demandWorkPackage||{};return{start:trim(legacy.targetStart),end:trim(legacy.targetEnd),legacy:!!(legacy.targetStart||legacy.targetEnd)}}
  function cleanForSave(d,settings){const next=structuredClone(d);normalizeDemand(next,settings);return next}

  window.DefinedDemandModel={MODEL_VERSION,DEMAND_STATES,WORK_PACKAGE_STATUSES,DEFAULT_SIZE_DAYS,normalizeSizeDays,inferSize,canonicalState,normalizeSettings,normalizeDemand,migrateWorkspace,initialEstimateDays,isOpen,legacyDeliveryWindow,cleanForSave};
})();
