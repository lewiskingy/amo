import { promises as fs } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

const ENTITY_FOLDERS={demand:'demand',team:'team',allocations:'allocations',ideas:'ideas'};
const REQUIRED_FOLDERS=['config','demand','team','allocations','ideas','status-reports','archive'];
const jsonText=value=>JSON.stringify(value,null,2)+'\n';

const defaultWorkspace=()=>{
  const now=new Date().toISOString();
  return {
    type:'architecture-operations-hub',
    name:'Architecture Management Office Workspace',
    workspaceId:`AMO-${randomUUID()}`,
    schemaVersion:1,
    department:{id:'DEPT-ARCH',name:'Architecture'},
    created:now,
    modifiedAt:now,
    description:'Remote Architecture Management Office workspace.',
    entities:{
      demand:{path:'demand',filePattern:'DEM-*.json'},
      team:{path:'team',filePattern:'USR-*.json'},
      allocations:{path:'allocations',filePattern:'ALLOC-*.json'},
      ideas:{path:'ideas',filePattern:'IDEA-*.json'},
      statusReports:{path:'status-reports',filePattern:'SR-*.json',draft:'draft.json'}
    }
  };
};

const defaultPlanningMonths=(count=6)=>{
  const now=new Date();
  return Array.from({length:count},(_,offset)=>{
    const month=new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth()+offset,1));
    return `${month.getUTCFullYear()}-${String(month.getUTCMonth()+1).padStart(2,'0')}`;
  });
};

const defaultSettings=()=>({
  schemaVersion:1,
  appearance:'light',
  planningMonths:defaultPlanningMonths(),
  teams:[],
  services:['Triage','Consultancy','Assurance','Design','Strategy'],
  serviceWorkflows:{
    Triage:['Triage','Prioritisation','Accepted','Rejected','Closed'],
    Consultancy:['Assessment','Prioritisation','Mobilisation','In Progress','Review','Complete','On Hold','Cancelled'],
    Assurance:['Assessment','Prioritisation','Mobilisation','Assurance Review','Findings / Remediation','Governance / Approval','Complete','On Hold','Cancelled'],
    Design:['Assessment','Prioritisation','Mobilisation','Discovery','Analysis / Design','Socialisation / Review','Approval','Governance','Complete','On Hold','Cancelled'],
    Strategy:['Assessment','Prioritisation','Mobilisation','Discovery','Analysis','Strategy Development','Socialisation / Review','Approval','Governance','Complete','On Hold','Cancelled']
  },
  statuses:['Triage','Prioritisation','Accepted','Rejected','Closed','Assessment','Mobilisation','In Progress','Review','Complete','On Hold','Cancelled','Assurance Review','Findings / Remediation','Governance / Approval','Discovery','Analysis / Design','Socialisation / Review','Approval','Governance','Analysis','Strategy Development'],
  businessAreas:[],
  initiatives:[],
  priorities:['Critical','High','Medium','Low'],
  healthStates:['On Track','At Risk','Off Track'],
  ideaStatuses:['New','Under Review','Planned','Implemented','Closed'],
  defaultFteWarningThreshold:0.85,
  defaultFteOverallocationThreshold:1.0
});

export class ServerJsonWorkspaceRepository{
  constructor(root){this.root=path.resolve(root);this.bootstrapped=false}
  resolve(...parts){const p=path.resolve(this.root,...parts);if(!p.startsWith(this.root))throw new Error('Invalid workspace path.');return p}
  async ensureDir(dir){await fs.mkdir(dir,{recursive:true})}
  async readJson(rel,{required=false}={}){try{return JSON.parse(await fs.readFile(this.resolve(rel),'utf8'))}catch(e){if(e.code==='ENOENT'&&!required)return null;throw e}}
  async writeJson(rel,value){const file=this.resolve(rel);await this.ensureDir(path.dirname(file));const temp=`${file}.${process.pid}.${Date.now()}.tmp`;await fs.writeFile(temp,jsonText(value),'utf8');await fs.rename(temp,file)}
  async writeJsonIfAbsent(rel,value){const file=this.resolve(rel);await this.ensureDir(path.dirname(file));try{await fs.writeFile(file,jsonText(value),{encoding:'utf8',flag:'wx'});return true}catch(e){if(e.code==='EEXIST')return false;throw e}}
  async deletePath(rel,{recursive=false}={}){try{await fs.rm(this.resolve(rel),{recursive,force:true})}catch(e){if(e.code!=='ENOENT')throw e}}
  async listDir(rel){try{return await fs.readdir(this.resolve(rel),{withFileTypes:true})}catch(e){if(e.code==='ENOENT')return[];throw e}}
  entityFolder(type){const folder=ENTITY_FOLDERS[type];if(!folder)throw new Error(`Unsupported entity type: ${type}`);return folder}
  async ensureWorkspace(){
    await this.ensureDir(this.root);
    for(const folder of REQUIRED_FOLDERS)await this.ensureDir(this.resolve(folder));
    const created=await this.writeJsonIfAbsent('workspace.json',defaultWorkspace());
    const settingsCreated=await this.writeJsonIfAbsent('config/settings.json',defaultSettings());
    if(!settingsCreated){
      const settings=await this.readJson('config/settings.json',{required:true});
      if(!Array.isArray(settings.planningMonths)||settings.planningMonths.length===0){
        await this.writeJson('config/settings.json',{...settings,planningMonths:defaultPlanningMonths()});
      }
    }
    this.bootstrapped=created;
    return {created};
  }
  async connect(){await this.ensureWorkspace();const workspace=await this.readJson('workspace.json',{required:true});if(workspace?.type!=='architecture-operations-hub')throw new Error('Not an Architecture Operations Hub workspace.');return workspace}
  async listRecords(type){const folder=this.entityFolder(type),out=[];for(const entry of await this.listDir(folder))if(entry.isFile()&&entry.name.endsWith('.json'))out.push(await this.readJson(path.join(folder,entry.name),{required:true}));return out}
  async getRecord(type,id){return this.readJson(path.join(this.entityFolder(type),`${id}.json`),{required:true})}
  async saveRecord(type,record){if(!record?.id)throw new Error('Record ID is required.');await this.writeJson(path.join(this.entityFolder(type),`${record.id}.json`),record)}
  async deleteRecord(type,id){await this.deletePath(path.join(this.entityFolder(type),`${id}.json`))}
  async getSettings(){await this.ensureWorkspace();return this.readJson('config/settings.json',{required:true})}
  async saveSettings(settings){await this.writeJson('config/settings.json',settings)}
  async loadWorkspace(){const workspace=await this.connect();const [demand,team,allocations,ideas,settings]=await Promise.all([this.listRecords('demand'),this.listRecords('team'),this.listRecords('allocations'),this.listRecords('ideas'),this.getSettings()]);return{workspace,demand,team,allocations,ideas,configFiles:{'settings.json':settings}}}
  async saveChanges(payload){const {workspace,settings,collections={},dirty={},deleted={},configDirty=false}=payload||{};await this.ensureWorkspace();await this.writeJson('workspace.json',{...workspace,modifiedAt:new Date().toISOString()});for(const type of Object.keys(ENTITY_FOLDERS)){const rows=collections[type]||[];for(const id of dirty[type]||[]){const rec=rows.find(x=>x.id===id);if(rec)await this.saveRecord(type,rec)}for(const id of deleted[type]||[])await this.deleteRecord(type,id)}if(configDirty)await this.saveSettings(settings)}
  async listStatusReports(){await this.ensureWorkspace();return (await this.listDir('status-reports')).filter(e=>e.isFile()&&e.name.endsWith('.json')).map(e=>e.name)}
  async getStatusReport(idOrFile){const name=String(idOrFile).endsWith('.json')?String(idOrFile):`${idOrFile}.json`;return this.readJson(path.join('status-reports',name),{required:true})}
  async saveStatusReport(idOrFile,record){const name=String(idOrFile).endsWith('.json')?String(idOrFile):`${idOrFile}.json`;await this.writeJson(path.join('status-reports',name),record)}
  async readLock(){return this.readJson('.lock.json')}
  async writeLock(lock){await this.writeJson('.lock.json',lock)}
  async deleteLock(){await this.deletePath('.lock.json')}
  async archiveRecords(recordsByEntity){await this.ensureWorkspace();for(const [type,records] of Object.entries(recordsByEntity||{}))for(const record of records||[]){await this.writeJson(path.join('archive',type,`${record.id}.json`),record);await this.deleteRecord(type,record.id)}}
}
