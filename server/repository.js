import { promises as fs } from 'node:fs';
import path from 'node:path';

const ENTITY_FOLDERS={demand:'demand',team:'team',allocations:'allocations',ideas:'ideas'};
const jsonText=value=>JSON.stringify(value,null,2)+'\n';

export class ServerJsonWorkspaceRepository{
  constructor(root){this.root=path.resolve(root)}
  resolve(...parts){const p=path.resolve(this.root,...parts);if(!p.startsWith(this.root))throw new Error('Invalid workspace path.');return p}
  async ensureDir(dir){await fs.mkdir(dir,{recursive:true})}
  async readJson(rel,{required=false}={}){try{return JSON.parse(await fs.readFile(this.resolve(rel),'utf8'))}catch(e){if(e.code==='ENOENT'&&!required)return null;throw e}}
  async writeJson(rel,value){const file=this.resolve(rel);await this.ensureDir(path.dirname(file));const temp=`${file}.${process.pid}.${Date.now()}.tmp`;await fs.writeFile(temp,jsonText(value),'utf8');await fs.rename(temp,file)}
  async deletePath(rel,{recursive=false}={}){try{await fs.rm(this.resolve(rel),{recursive,force:true})}catch(e){if(e.code!=='ENOENT')throw e}}
  async listDir(rel){try{return await fs.readdir(this.resolve(rel),{withFileTypes:true})}catch(e){if(e.code==='ENOENT')return[];throw e}}
  entityFolder(type){const folder=ENTITY_FOLDERS[type];if(!folder)throw new Error(`Unsupported entity type: ${type}`);return folder}
  async connect(){const workspace=await this.readJson('workspace.json',{required:true});if(workspace?.type!=='architecture-operations-hub')throw new Error('Not an Architecture Operations Hub workspace.');return workspace}
  async listRecords(type){const folder=this.entityFolder(type),out=[];for(const entry of await this.listDir(folder))if(entry.isFile()&&entry.name.endsWith('.json'))out.push(await this.readJson(path.join(folder,entry.name),{required:true}));return out}
  async getRecord(type,id){return this.readJson(path.join(this.entityFolder(type),`${id}.json`),{required:true})}
  async saveRecord(type,record){if(!record?.id)throw new Error('Record ID is required.');await this.writeJson(path.join(this.entityFolder(type),`${record.id}.json`),record)}
  async deleteRecord(type,id){await this.deletePath(path.join(this.entityFolder(type),`${id}.json`))}
  async getSettings(){return this.readJson('config/settings.json',{required:true})}
  async saveSettings(settings){await this.writeJson('config/settings.json',settings)}
  async loadWorkspace(){const workspace=await this.connect();const [demand,team,allocations,ideas,settings]=await Promise.all([this.listRecords('demand'),this.listRecords('team'),this.listRecords('allocations'),this.listRecords('ideas'),this.getSettings()]);return{workspace,demand,team,allocations,ideas,configFiles:{'settings.json':settings}}}
  async saveChanges(payload){const {workspace,settings,collections={},dirty={},deleted={},configDirty=false}=payload||{};await this.writeJson('workspace.json',{...workspace,modifiedAt:new Date().toISOString()});for(const type of Object.keys(ENTITY_FOLDERS)){const rows=collections[type]||[];for(const id of dirty[type]||[]){const rec=rows.find(x=>x.id===id);if(rec)await this.saveRecord(type,rec)}for(const id of deleted[type]||[])await this.deleteRecord(type,id)}if(configDirty)await this.saveSettings(settings)}
  async listStatusReports(){return (await this.listDir('status-reports')).filter(e=>e.isFile()&&e.name.endsWith('.json')).map(e=>e.name)}
  async getStatusReport(idOrFile){const name=String(idOrFile).endsWith('.json')?String(idOrFile):`${idOrFile}.json`;return this.readJson(path.join('status-reports',name),{required:true})}
  async saveStatusReport(idOrFile,record){const name=String(idOrFile).endsWith('.json')?String(idOrFile):`${idOrFile}.json`;await this.writeJson(path.join('status-reports',name),record)}
  async readLock(){return this.readJson('.lock.json')}
  async writeLock(lock){await this.writeJson('.lock.json',lock)}
  async deleteLock(){await this.deletePath('.lock.json')}
  async archiveRecords(recordsByEntity){for(const [type,records] of Object.entries(recordsByEntity||{}))for(const record of records||[]){await this.writeJson(path.join('archive',type,`${record.id}.json`),record);await this.deleteRecord(type,record.id)}}
}
