const CURRENT_YEAR=new Date().getFullYear();
const CURRENT_SCHEMA_VERSION=2;
const DEFAULT_SETTINGS={schemaVersion:CURRENT_SCHEMA_VERSION,planningWindow:{fromMonth:'',toMonth:''},statuses:[],services:[],businessAreas:[],initiatives:[],priorities:[],healthStates:[],ideaStatuses:['New','Under Review','Planned','Implemented','Closed']};
function emptyDb(){return{schemaVersion:CURRENT_SCHEMA_VERSION,workspace:null,settings:structuredClone(DEFAULT_SETTINGS),team:[],demand:[],allocations:[],ideas:[],configFiles:{}}}
let db=emptyDb(),workspaceHandle=null,selectedDemandId=null,activity=[],configDirty=false;
const dirtyRecords={demand:new Set(),team:new Set(),allocations:new Set(),ideas:new Set()},deletedDemand=new Set(),deletedTeam=new Set(),deletedAllocations=new Set(),deletedIdeas=new Set();
const gridState={demand:{editing:false,draft:null,deleted:new Set(),filters:{},sort:null,direction:null},team:{editing:false,draft:null,deleted:new Set(),filters:{},sort:null,direction:null}};
const allocationState={editing:false,draft:null,deleted:new Set(),filters:{demand:'',person:''},direction:'asc'};
const configState={editing:false,draft:null};
const $=id=>document.getElementById(id),clone=x=>structuredClone(x),person=id=>db.team.find(x=>x.id===id),demandById=id=>db.demand.find(x=>x.id===id),ownerName=d=>d.workPackage?.architectureOwner?(person(d.workPackage.architectureOwner)?.name||d.workPackage.architectureOwner):'Unallocated';
function normalizeMonthStart(value){const v=String(value||'').trim();if(/^\d{4}-\d{2}$/.test(v))return `${v}-01`;if(/^\d{4}-\d{2}-01$/.test(v))return v;return''}
function monthInputValue(value){const v=normalizeMonthStart(value);return v?v.slice(0,7):''}
function addMonths(monthStart,count=1){const v=normalizeMonthStart(monthStart);if(!v)return'';const [y,m]=v.slice(0,7).split('-').map(Number),d=new Date(y,m-1+count,1);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-01`}
function monthsBetween(fromMonth,toMonth){const from=normalizeMonthStart(fromMonth),to=normalizeMonthStart(toMonth);if(!from||!to||from>to)return[];const out=[];for(let m=from;m&&m<=to;m=addMonths(m,1))out.push(m);return out}
function planningWindow(){const w=db.settings?.planningWindow||{};return{fromMonth:normalizeMonthStart(w.fromMonth),toMonth:normalizeMonthStart(w.toMonth)}}
function planningPeriods(){const w=planningWindow();return monthsBetween(w.fromMonth,w.toMonth)}
/* Compatibility name retained while older view modules are migrated. It now returns canonical month-start dates. */
const planningMonths=()=>planningPeriods();
const monthLabel=m=>{const v=normalizeMonthStart(m);return v?new Date(`${v}T00:00:00`).toLocaleDateString('en-GB',{month:'short',year:'2-digit'}):(m||'—')};
const isOpenDemand=d=>!/^(complete|completed|closed|cancelled)$/i.test((d.status||'').trim());

/* Browser/device preference for the last workspace connection. The local File System Access
   handle itself remains in IndexedDB; localStorage only records which mode should win at startup. */
const AMO_CONNECTION_PREF_KEY='amo.lastWorkspaceConnection';
let workspaceConnectionGeneration=0;
let workspaceConnectionIntent={token:0,mode:null,detail:''};
function getLastConnectionPreference(){try{const value=JSON.parse(localStorage.getItem(AMO_CONNECTION_PREF_KEY)||'null');return value&&['local','remote'].includes(value.mode)?value:null}catch(_){return null}}
function setLastConnectionPreference(value){try{if(value?.mode)localStorage.setItem(AMO_CONNECTION_PREF_KEY,JSON.stringify({...value,updatedAt:new Date().toISOString()}))}catch(_){}return value}
function beginWorkspaceConnection(mode,detail=''){workspaceConnectionGeneration+=1;workspaceConnectionIntent={token:workspaceConnectionGeneration,mode,detail};return workspaceConnectionGeneration}
function workspaceConnectionIsCurrent(token,mode=null){return token===workspaceConnectionIntent.token&&(!mode||workspaceConnectionIntent.mode===mode)}
/* Canonical lifecycle notification: fire only after the repository and loaded workspace data have
   both been installed. Consumers such as Access, Users, reporting and scope can then read db.settings
   without racing the default emptyDb() state. */
function notifyWorkspaceConnected(mode=window.workspaceRepository?.mode||null){
  const detail={mode,workspaceId:db.workspace?.id||null,workspaceName:db.workspace?.name||workspaceHandle?.name||''};
  try{window.dispatchEvent(new CustomEvent('amo-workspace-connected',{detail}))}catch(_e){}
  window.amoAccess?.refresh?.();
  return detail
}
function renderWorkspaceConnectionBadge(){const el=$('workspaceConnectionBadge');if(!el)return;const repo=window.workspaceRepository;if(repo?.mode==='remote'){el.textContent=`Remote: ${repo.baseUrl||repo.name||'API workspace'}`;el.title=repo.baseUrl||'Remote API workspace';el.dataset.mode='remote';return}if(repo?.mode==='local'&&workspaceHandle){el.textContent=`Local: ${workspaceHandle.name||'Workspace'}`;el.title='Local browser folder. Browsers do not expose the full filesystem path to web applications.';el.dataset.mode='local';return}el.textContent='No workspace open';el.title='No workspace is currently connected.';el.dataset.mode='none'}

function log(m){activity.unshift(`${new Date().toLocaleTimeString()}  ${m}`);activity=activity.slice(0,100);$('activityLog').textContent=activity.join('\n')}
function dirtyCount(){return Object.values(dirtyRecords).reduce((n,s)=>n+s.size,0)+deletedDemand.size+deletedTeam.size+deletedAllocations.size+deletedIdeas.size+(configDirty?1:0)}
function updateBanner(){const dirty=dirtyCount()>0,loaded=!!workspaceHandle;$('stateDot').className='state-dot'+(loaded?' connected':'')+(dirty?' dirty':'');$('workspaceState').textContent=loaded?`${db.workspace?.name||workspaceHandle.name}${dirty?' — saving changes…':''}`:'No workspace loaded — open a data source folder to begin';$('recordSummary').textContent=loaded?`${db.demand.length} demand · ${db.team.length} team · ${db.allocations.length} allocations · ${db.ideas.length} ideas`:'No data loaded';$('saveWorkspaceBtn').disabled=!loaded;$('exportBtn').disabled=!loaded;$('newDemandBtn').disabled=!loaded;$('datasetPill').textContent=loaded?(window.workspaceRepository?.mode==='remote'?'Remote workspace':'Folder workspace'):'No workspace loaded';$('dirtySummary').textContent=dirty?`${dirtyRecords.demand.size} demand changes, ${dirtyRecords.team.size} team changes, ${dirtyRecords.allocations.size} allocation changes, ${dirtyRecords.ideas.size} idea changes${configDirty?', configuration changed':''}; deletions: ${deletedDemand.size} demand, ${deletedTeam.size} team, ${deletedAllocations.size} allocations, ${deletedIdeas.size} ideas. Autosave pending.`:'No unsaved changes.';renderWorkspaceConnectionBadge()}
function markDirty(type,id,msg){dirtyRecords[type].add(id);updateBanner();if(msg)log(msg);if(typeof requestAutosave==='function')requestAutosave()}
function clearDirty(){Object.values(dirtyRecords).forEach(s=>s.clear());deletedDemand.clear();deletedTeam.clear();deletedAllocations.clear();deletedIdeas.clear();configDirty=false;updateBanner()}

/* Legacy low-level helpers remain temporarily for compatibility with UI extensions that have not yet
   been moved to named repository capabilities. Core workspace open/save no longer uses them. */
async function readJsonFile(h){const f=await h.getFile();return JSON.parse(await f.text())}
async function readNamedJson(dir,name,required=false){try{return await readJsonFile(await dir.getFileHandle(name))}catch(e){if(required)throw new Error(`Required file ${name} not found or invalid.`);return null}}
async function readEntityFolder(root,name){const repo=window.workspaceRepositoryForHandle?workspaceRepositoryForHandle(root):null;if(repo)return repo.listJsonRecords(name);const dir=await root.getDirectoryHandle(name),out=[];for await(const [fn,h] of dir.entries())if(h.kind==='file'&&fn.endsWith('.json'))out.push(await readJsonFile(h));return out}
async function readOptionalEntityFolder(root,name){try{return await readEntityFolder(root,name)}catch(e){if(e.name==='NotFoundError')return[];throw e}}
async function readConfigFolder(root){const repo=window.workspaceRepositoryForHandle?workspaceRepositoryForHandle(root):null;if(repo)return repo.readConfigFiles();const out={};try{const dir=await root.getDirectoryHandle('config');for await(const [fn,h] of dir.entries())if(h.kind==='file'&&fn.endsWith('.json'))out[fn]=await readJsonFile(h)}catch(e){}return out}
async function writeJson(dir,name,data){const h=await dir.getFileHandle(name,{create:true}),w=await h.createWritable();await w.write(JSON.stringify(data,null,2)+'\n');await w.close()}
async function ensureRW(h){const repo=window.workspaceRepositoryForHandle?workspaceRepositoryForHandle(h):null;if(repo)return repo.ensureWritePermission();const o={mode:'readwrite'};if(h.queryPermission&&await h.queryPermission(o)==='granted')return true;return h.requestPermission&&await h.requestPermission(o)==='granted'}
function migrateInitiatives(settings,demand){const items=normalizeInitiatives(settings.initiatives||[]);for(const i of items){if(i.businessArea)continue;const areas=[...new Set(demand.filter(d=>d.initiative===i.name).map(d=>d.businessArea).filter(Boolean))];if(areas.length===1)i.businessArea=areas[0]}return items}
function allocationForecastTotal(allocations){return(allocations||[]).reduce((sum,a)=>sum+Object.values(a.forecast||{}).reduce((n,v)=>n+(Number(v)||0),0),0)}
function migrateWorkspaceBundle(rawBundle){
  const bundle=clone(rawBundle),settings=bundle.configFiles?.['settings.json'];if(!settings)throw new Error('Required config/settings.json not found or invalid.');
  const sourceVersion=Number(bundle.workspace?.schemaVersion||settings.schemaVersion||1);if(sourceVersion>CURRENT_SCHEMA_VERSION)throw new Error(`Workspace schema v${sourceVersion} is newer than this application supports (v${CURRENT_SCHEMA_VERSION}).`);
  const migratedAllocationIds=[];let migrated=false,migrationNote='';
  if(sourceVersion<2){
    const legacy=[...new Set((settings.planningMonths||[]).map(String))].sort();if(!legacy.length||legacy.some(m=>!/^\d{4}-\d{2}$/.test(m)))throw new Error('Schema v1 workspace must define valid planningMonths using YYYY-MM.');
    settings.planningWindow={fromMonth:normalizeMonthStart(legacy[0]),toMonth:normalizeMonthStart(legacy[legacy.length-1])};delete settings.planningMonths;
    const before=allocationForecastTotal(bundle.allocations);
    for(const a of bundle.allocations||[]){const next={};for(const [rawKey,value] of Object.entries(a.forecast||{})){const key=normalizeMonthStart(rawKey);if(!key)throw new Error(`Allocation ${a.id} contains invalid forecast month ${rawKey}.`);if(Object.prototype.hasOwnProperty.call(next,key)&&Number(next[key])!==Number(value))throw new Error(`Allocation ${a.id} contains conflicting values for ${key}.`);next[key]=value}if(JSON.stringify(next)!==JSON.stringify(a.forecast||{})){a.forecast=next;migratedAllocationIds.push(a.id)}}
    const after=allocationForecastTotal(bundle.allocations);if(Math.abs(before-after)>.0000001)throw new Error('Planning-period migration failed integrity check: allocation totals changed.');
    const contiguous=monthsBetween(normalizeMonthStart(legacy[0]),normalizeMonthStart(legacy[legacy.length-1]));const gaps=contiguous.filter(m=>!legacy.includes(m.slice(0,7)));
    migrationNote=`Schema v1 → v2: ${legacy.length} configured planning months became ${settings.planningWindow.fromMonth} → ${settings.planningWindow.toMonth}; ${migratedAllocationIds.length} allocation record(s) migrated.${gaps.length?` The new continuous window also includes ${gaps.map(monthLabel).join(', ')}.`:''}`;migrated=true
  }else{
    settings.planningWindow=settings.planningWindow||{};settings.planningWindow.fromMonth=normalizeMonthStart(settings.planningWindow.fromMonth);settings.planningWindow.toMonth=normalizeMonthStart(settings.planningWindow.toMonth)
  }
  settings.schemaVersion=CURRENT_SCHEMA_VERSION;bundle.workspace={...bundle.workspace,schemaVersion:CURRENT_SCHEMA_VERSION};bundle.configFiles['settings.json']=settings;
  return{bundle,migrated,migratedAllocationIds,migrationNote}
}
function validateWorkspaceSettings(settings){
  if(!settings)throw new Error('Required config/settings.json not found or invalid.');
  for(const key of ['statuses','services','businessAreas','priorities','healthStates'])if(!Array.isArray(settings[key])||!settings[key].length)throw new Error(`config/settings.json must define at least one ${key} value.`);
  const from=normalizeMonthStart(settings.planningWindow?.fromMonth),to=normalizeMonthStart(settings.planningWindow?.toMonth);if(!from||!to||from>to)throw new Error('config/settings.json planningWindow must define valid fromMonth and toMonth month-start dates, with fromMonth <= toMonth.');
  if(!settings.services.includes('Strategy'))throw new Error('config/settings.json services must include Strategy.')
}
function prepareLoadedWorkspace(rawBundle){const migration=migrateWorkspaceBundle(rawBundle),bundle=migration.bundle,{workspace,demand,team,allocations,ideas,configFiles}=bundle,settings=configFiles['settings.json'];validateWorkspaceSettings(settings);const loadedSettings={...clone(DEFAULT_SETTINGS),...settings};loadedSettings.planningWindow={...settings.planningWindow};loadedSettings.businessAreas=loadedSettings.businessAreas||[];loadedSettings.initiatives=migrateInitiatives(loadedSettings,demand);loadedSettings.ideaStatuses=Array.isArray(loadedSettings.ideaStatuses)&&loadedSettings.ideaStatuses.length?loadedSettings.ideaStatuses:clone(DEFAULT_SETTINGS.ideaStatuses);demand.forEach(d=>{d.businessArea=d.businessArea||'';d.initiative=d.initiative||'';d.costCentreOrProjectCode=d.costCentreOrProjectCode||'';d.source=d.source||{type:'SharePoint',id:'',url:'',title:''};d.source.url=d.source.url||'';d.source.title=d.source.title||'';d.azureDevOps=d.azureDevOps||{id:null,type:null,url:'',title:''};d.azureDevOps.url=d.azureDevOps.url||'';d.azureDevOps.title=d.azureDevOps.title||''});return{...migration,workspace,demand,team,allocations,ideas,configFiles,loadedSettings}}
function applyMigrationDirtyState(prepared){if(!prepared.migrated)return;configDirty=true;for(const id of prepared.migratedAllocationIds)dirtyRecords.allocations.add(id);updateBanner();log(prepared.migrationNote)}
async function openWorkspace(){
  if(!('showDirectoryPicker'in window)){alert('Folder access is not supported in this browser.');return}
  const connectionToken=workspaceConnectionIntent.mode==='local'?workspaceConnectionIntent.token:beginWorkspaceConnection('local');
  try{
    const h=await showDirectoryPicker({mode:'readwrite'});
    if(!workspaceConnectionIsCurrent(connectionToken,'local'))return;
    if(!window.LocalWorkspaceRepository)throw new Error('Workspace repository layer has not loaded.');
    const repo=new LocalWorkspaceRepository(h),rawBundle=await repo.loadWorkspace();
    if(!workspaceConnectionIsCurrent(connectionToken,'local'))return;
    await backupWorkspaceOnOpen(h);
    const prepared=prepareLoadedWorkspace(rawBundle),{workspace,demand,team,allocations,ideas,configFiles,loadedSettings}=prepared;
    if(!workspaceConnectionIsCurrent(connectionToken,'local'))return;
    workspaceHandle=h;setWorkspaceRepository(repo);setLastConnectionPreference({mode:'local',name:h.name||'Workspace'});
    db={schemaVersion:CURRENT_SCHEMA_VERSION,workspace,settings:loadedSettings,demand,team,allocations,ideas,configFiles};clearDirty();applyMigrationDirtyState(prepared);selectedDemandId=null;resetEdits();notifyWorkspaceConnected('local');refreshAll();log(`Loaded ${demand.length} demand, ${team.length} team, ${allocations.length} allocations and ${ideas.length} ideas through LocalWorkspaceRepository. Safety backup created.`);if(prepared.migrated&&typeof requestAutosave==='function')requestAutosave()
  }catch(e){if(e.name!=='AbortError'){alert(e.message);log(`ERROR: ${e.message}`)}}
}
async function saveWorkspace(options={}){
  if(!workspaceHandle)return;const opts=options instanceof Event?{}:options,{silent=false,reason='Manual save'}=opts,saveSerial=typeof workspaceChangeSerial==='number'?workspaceChangeSerial:0;
  try{
    const repo=window.workspaceRepository||new LocalWorkspaceRepository(workspaceHandle);if(!window.workspaceRepository)setWorkspaceRepository(repo);
    await repo.saveChanges({workspace:db.workspace,settings:db.settings,collections:{demand:db.demand,team:db.team,allocations:db.allocations,ideas:db.ideas},dirty:dirtyRecords,deleted:{demand:deletedDemand,team:deletedTeam,allocations:deletedAllocations,ideas:deletedIdeas},configDirty});
    if(configDirty)db.configFiles['settings.json']=clone(db.settings);
    const changedDuringSave=typeof workspaceChangeSerial==='number'&&workspaceChangeSerial!==saveSerial;if(!changedDuringSave)clearDirty();else{updateBanner();if(typeof requestAutosave==='function')requestAutosave(250)}
    log(reason==='Autosave'?(changedDuringSave?'Autosave completed; newer changes remain queued.':'Autosaved workspace changes.'):'Workspace saved successfully.');return true
  }catch(e){if(!silent)alert(`Could not save workspace: ${e.message}`);log(`ERROR saving: ${e.message}`);return false}
}
function getPath(o,path){return path.split('.').reduce((v,k)=>v?.[k],o)}
function setPath(o,path,value){const p=path.split('.');let x=o;while(p.length>1){const k=p.shift();x[k]=x[k]||{};x=x[k]}x[p[0]]=value}
