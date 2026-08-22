const CURRENT_YEAR=new Date().getFullYear();
const DEFAULT_SETTINGS={planningMonths:[],statuses:[],services:[],businessAreas:[],initiatives:[],priorities:[],healthStates:[],ideaStatuses:['New','Under Review','Planned','Implemented','Closed']};
function emptyDb(){return{schemaVersion:1,workspace:null,settings:structuredClone(DEFAULT_SETTINGS),team:[],demand:[],allocations:[],ideas:[],configFiles:{}}}
let db=emptyDb(),workspaceHandle=null,selectedDemandId=null,activity=[],configDirty=false;
const dirtyRecords={demand:new Set(),team:new Set(),allocations:new Set(),ideas:new Set()},deletedDemand=new Set(),deletedTeam=new Set(),deletedAllocations=new Set(),deletedIdeas=new Set();
const gridState={demand:{editing:false,draft:null,deleted:new Set(),filters:{},sort:null,direction:null},team:{editing:false,draft:null,deleted:new Set(),filters:{},sort:null,direction:null}};
const allocationState={editing:false,draft:null,deleted:new Set(),filters:{demand:'',person:''},direction:'asc'};
const configState={editing:false,draft:null};
const $=id=>document.getElementById(id),clone=x=>structuredClone(x),person=id=>db.team.find(x=>x.id===id),demandById=id=>db.demand.find(x=>x.id===id),ownerName=d=>d.workPackage?.architectureOwner?(person(d.workPackage.architectureOwner)?.name||d.workPackage.architectureOwner):'Unallocated';
const planningMonths=()=>Array.isArray(db.settings?.planningMonths)?db.settings.planningMonths:[];
const monthLabel=m=>/^\d{4}-\d{2}$/.test(m||'')?new Date(`${m}-01T00:00:00`).toLocaleDateString('en-GB',{month:'short',year:'2-digit'}):(m||'—');
const isOpenDemand=d=>!/^(complete|completed|closed|cancelled)$/i.test((d.status||'').trim());
function log(m){activity.unshift(`${new Date().toLocaleTimeString()}  ${m}`);activity=activity.slice(0,100);$('activityLog').textContent=activity.join('\n')}
function dirtyCount(){return Object.values(dirtyRecords).reduce((n,s)=>n+s.size,0)+deletedDemand.size+deletedTeam.size+deletedAllocations.size+deletedIdeas.size+(configDirty?1:0)}
function updateBanner(){const dirty=dirtyCount()>0,loaded=!!workspaceHandle;$('stateDot').className='state-dot'+(loaded?' connected':'')+(dirty?' dirty':'');$('workspaceState').textContent=loaded?`${db.workspace?.name||workspaceHandle.name}${dirty?' — saving changes…':''}`:'No workspace loaded — open a data source folder to begin';$('recordSummary').textContent=loaded?`${db.demand.length} demand · ${db.team.length} team · ${db.allocations.length} allocations · ${db.ideas.length} ideas`:'No data loaded';$('saveWorkspaceBtn').disabled=!loaded;$('exportBtn').disabled=!loaded;$('newDemandBtn').disabled=!loaded;$('datasetPill').textContent=loaded?(window.workspaceRepository?.mode==='remote'?'Remote workspace':'Folder workspace'):'No workspace loaded';$('dirtySummary').textContent=dirty?`${dirtyRecords.demand.size} demand changes, ${dirtyRecords.team.size} team changes, ${dirtyRecords.allocations.size} allocation changes, ${dirtyRecords.ideas.size} idea changes${configDirty?', configuration changed':''}; deletions: ${deletedDemand.size} demand, ${deletedTeam.size} team, ${deletedAllocations.size} allocations, ${deletedIdeas.size} ideas. Autosave pending.`:'No unsaved changes.'}
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
function validateWorkspaceSettings(settings){
  if(!settings)throw new Error('Required config/settings.json not found or invalid.');
  for(const key of ['planningMonths','statuses','services','businessAreas','priorities','healthStates'])if(!Array.isArray(settings[key])||!settings[key].length)throw new Error(`config/settings.json must define at least one ${key} value.`);
  if(settings.planningMonths.some(m=>!/^\d{4}-\d{2}$/.test(m)))throw new Error('config/settings.json planningMonths values must use YYYY-MM format.');
  if(!settings.services.includes('Strategy'))throw new Error('config/settings.json services must include Strategy.')
}
async function openWorkspace(){
  if(!('showDirectoryPicker'in window)){alert('Folder access is not supported in this browser.');return}
  try{
    const h=await showDirectoryPicker({mode:'readwrite'});
    if(!window.LocalWorkspaceRepository)throw new Error('Workspace repository layer has not loaded.');
    const repo=new LocalWorkspaceRepository(h),bundle=await repo.loadWorkspace(),{workspace,demand,team,allocations,ideas,configFiles}=bundle,settings=configFiles['settings.json'];
    validateWorkspaceSettings(settings);
    await backupWorkspaceOnOpen(repo);
    workspaceHandle=h;setWorkspaceRepository(repo);
    const loadedSettings={...clone(DEFAULT_SETTINGS),...settings};loadedSettings.businessAreas=loadedSettings.businessAreas||[];loadedSettings.initiatives=migrateInitiatives(loadedSettings,demand);loadedSettings.ideaStatuses=Array.isArray(loadedSettings.ideaStatuses)&&loadedSettings.ideaStatuses.length?loadedSettings.ideaStatuses:clone(DEFAULT_SETTINGS.ideaStatuses);
    demand.forEach(d=>{d.businessArea=d.businessArea||'';d.initiative=d.initiative||'';d.costCentreOrProjectCode=d.costCentreOrProjectCode||'';d.source=d.source||{type:'SharePoint',id:'',url:'',title:''};d.source.url=d.source.url||'';d.source.title=d.source.title||'';d.azureDevOps=d.azureDevOps||{id:null,type:null,url:'',title:''};d.azureDevOps.url=d.azureDevOps.url||'';d.azureDevOps.title=d.azureDevOps.title||''});
    db={schemaVersion:workspace.schemaVersion||1,workspace,settings:loadedSettings,demand,team,allocations,ideas,configFiles};clearDirty();selectedDemandId=null;resetEdits();refreshAll();log(`Loaded ${demand.length} demand, ${team.length} team, ${allocations.length} allocations and ${ideas.length} ideas through LocalWorkspaceRepository. Safety backup created.`)
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
