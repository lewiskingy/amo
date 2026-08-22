/* Workspace persistence contract.
   Application/domain code should depend on workspaceRepository capabilities rather than
   the browser File System Access API. LocalWorkspaceRepository is the first implementation;
   RemoteWorkspaceRepository can implement the same contract later over HTTP. */
(function initWorkspaceRepository(){
  const ENTITY_FOLDERS={demand:'demand',team:'team',allocations:'allocations',ideas:'ideas'};
  const jsonText=data=>JSON.stringify(data,null,2)+'\n';
  const parts=path=>String(path||'').split('/').filter(Boolean);

  class WorkspaceRepository{
    constructor(mode){this.mode=mode}
    async connect(){throw new Error('connect() not implemented')}
    async loadWorkspace(){throw new Error('loadWorkspace() not implemented')}
    async saveChanges(){throw new Error('saveChanges() not implemented')}
    async listRecords(){throw new Error('listRecords() not implemented')}
    async getRecord(){throw new Error('getRecord() not implemented')}
    async saveRecord(){throw new Error('saveRecord() not implemented')}
    async deleteRecord(){throw new Error('deleteRecord() not implemented')}
    async getSettings(){throw new Error('getSettings() not implemented')}
    async saveSettings(){throw new Error('saveSettings() not implemented')}
    async listStatusReports(){throw new Error('listStatusReports() not implemented')}
    async getStatusReport(){throw new Error('getStatusReport() not implemented')}
    async saveStatusReport(){throw new Error('saveStatusReport() not implemented')}
    async readLock(){throw new Error('readLock() not implemented')}
    async writeLock(){throw new Error('writeLock() not implemented')}
    async deleteLock(){throw new Error('deleteLock() not implemented')}
    async archiveRecords(){throw new Error('archiveRecords() not implemented')}
    async createSafetyBackup(){throw new Error('createSafetyBackup() not implemented')}
    async pruneBackups(){throw new Error('pruneBackups() not implemented')}
    async listBackups(){throw new Error('listBackups() not implemented')}
  }

  class LocalWorkspaceRepository extends WorkspaceRepository{
    constructor(rootHandle){super('local');this.rootHandle=rootHandle;this.name=rootHandle?.name||'Workspace'}
    get nativeHandle(){return this.rootHandle}
    entityFolder(type){const folder=ENTITY_FOLDERS[type];if(!folder)throw new Error(`Unsupported entity type: ${type}`);return folder}

    async ensureWritePermission(){
      const h=this.rootHandle,o={mode:'readwrite'};
      if(!h)return false;
      if(h.queryPermission&&await h.queryPermission(o)==='granted')return true;
      return !!h.requestPermission&&await h.requestPermission(o)==='granted'
    }
    async directory(path,{create=false}={}){
      let d=this.rootHandle;for(const p of parts(path))d=await d.getDirectoryHandle(p,{create});return d
    }
    async file(path,{create=false}={}){
      const p=parts(path),name=p.pop();if(!name)throw new Error('File path is required.');const d=await this.directory(p.join('/'),{create});return d.getFileHandle(name,{create})
    }
    async readJson(path,{required=false}={}){
      try{const h=await this.file(path),f=await h.getFile();return JSON.parse(await f.text())}
      catch(e){if(required)throw new Error(`Required file ${path} not found or invalid.`);if(e.name==='NotFoundError')return null;throw e}
    }
    async writeJson(path,data){const h=await this.file(path,{create:true}),w=await h.createWritable();await w.write(jsonText(data));await w.close()}
    async deletePath(path,{recursive=false,ignoreMissing=true}={}){
      const p=parts(path),name=p.pop();try{const d=await this.directory(p.join('/'));await d.removeEntry(name,{recursive})}catch(e){if(!(ignoreMissing&&e.name==='NotFoundError'))throw e}
    }
    async listEntries(path,{optional=false}={}){
      try{const d=await this.directory(path),out=[];for await(const [name,handle] of d.entries())out.push({name,kind:handle.kind,handle});return out}
      catch(e){if(optional&&e.name==='NotFoundError')return[];throw e}
    }
    async listJsonRecords(folder,{optional=false}={}){
      const out=[];for(const e of await this.listEntries(folder,{optional}))if(e.kind==='file'&&e.name.toLowerCase().endsWith('.json')){const f=await e.handle.getFile();out.push(JSON.parse(await f.text()))}return out
    }
    async readConfigFiles(){
      const out={};for(const e of await this.listEntries('config',{optional:true}))if(e.kind==='file'&&e.name.toLowerCase().endsWith('.json')){const f=await e.handle.getFile();out[e.name]=JSON.parse(await f.text())}return out
    }

    async listRecords(type,{optional=false}={}){return this.listJsonRecords(this.entityFolder(type),{optional})}
    async getRecord(type,id){return this.readJson(`${this.entityFolder(type)}/${id}.json`,{required:true})}
    async saveRecord(type,record){if(!record?.id)throw new Error('Record ID is required.');return this.writeJson(`${this.entityFolder(type)}/${record.id}.json`,record)}
    async deleteRecord(type,id){return this.deletePath(`${this.entityFolder(type)}/${id}.json`)}
    async getSettings(){return this.readJson('config/settings.json',{required:true})}
    async saveSettings(settings){return this.writeJson('config/settings.json',settings)}

    async connect(){
      const workspace=await this.readJson('workspace.json',{required:true});if(workspace.type!=='architecture-operations-hub')throw new Error('Not an Architecture Operations Hub workspace.');return workspace
    }
    async loadWorkspace(){
      const workspace=await this.connect();
      const [demand,team,allocations,ideas,configFiles]=await Promise.all([this.listRecords('demand'),this.listRecords('team'),this.listRecords('allocations'),this.listRecords('ideas',{optional:true}),this.readConfigFiles()]);
      return{workspace,demand,team,allocations,ideas,configFiles}
    }
    async saveChanges({workspace,settings,collections,dirty,deleted,configDirty=false}){
      if(!await this.ensureWritePermission())throw new Error('Read/write permission was not granted.');await this.writeJson('workspace.json',{...workspace,modifiedAt:new Date().toISOString()});
      for(const type of Object.keys(ENTITY_FOLDERS)){const rows=collections[type]||[];for(const id of dirty[type]||[]){const rec=rows.find(x=>x.id===id);if(rec)await this.saveRecord(type,rec)}for(const id of deleted[type]||[])await this.deleteRecord(type,id)}
      if(configDirty)await this.saveSettings(settings)
    }

    async listStatusReports(){const entries=await this.listEntries('status-reports',{optional:true});return entries.filter(e=>e.kind==='file'&&e.name.toLowerCase().endsWith('.json')).map(e=>e.name)}
    async getStatusReport(idOrFile){const name=String(idOrFile).endsWith('.json')?String(idOrFile):`${idOrFile}.json`;return this.readJson(`status-reports/${name}`,{required:true})}
    async saveStatusReport(idOrFile,record){const name=String(idOrFile).endsWith('.json')?String(idOrFile):`${idOrFile}.json`;return this.writeJson(`status-reports/${name}`,record)}

    async readLock(fileName='.lock.json'){return this.readJson(fileName)}
    async writeLock(record,fileName='.lock.json'){return this.writeJson(fileName,record)}
    async deleteLock(fileName='.lock.json'){return this.deletePath(fileName)}

    async archiveRecords(recordsByEntity){
      if(!await this.ensureWritePermission())throw new Error('Read/write permission is required for archive maintenance.');
      for(const [entity,records] of Object.entries(recordsByEntity||{}))for(const record of records||[]){await this.writeJson(`archive/${entity}/${record.id}.json`,record);await this.deleteRecord(entity,record.id)}
    }

    async copyFile(sourceHandle,destDir,name){const file=await sourceHandle.getFile(),dest=await destDir.getFileHandle(name,{create:true}),w=await dest.createWritable();await w.write(await file.arrayBuffer());await w.close()}
    async copyJsonDirectory(destRoot,folderName){
      let src;try{src=await this.rootHandle.getDirectoryHandle(folderName)}catch(e){if(e.name==='NotFoundError')return;throw e}const dest=await destRoot.getDirectoryHandle(folderName,{create:true});for await(const [name,handle] of src.entries())if(handle.kind==='file'&&name.toLowerCase().endsWith('.json'))await this.copyFile(handle,dest,name)
    }
    async createSafetyBackup({name,manifest}){
      if(!await this.ensureWritePermission())throw new Error('Read/write permission is required to create the workspace safety backup.');const backups=await this.rootHandle.getDirectoryHandle('backups',{create:true}),snapshot=await backups.getDirectoryHandle(name,{create:true});
      await this.copyFile(await this.rootHandle.getFileHandle('workspace.json'),snapshot,'workspace.json');for(const folder of ['demand','team','allocations','ideas','config'])await this.copyJsonDirectory(snapshot,folder);
      try{const reports=await this.rootHandle.getDirectoryHandle('status-reports'),draft=await reports.getFileHandle('draft.json'),dest=await snapshot.getDirectoryHandle('status-reports',{create:true});await this.copyFile(draft,dest,'draft.json')}catch(e){if(e.name!=='NotFoundError')throw e}
      const manifestHandle=await snapshot.getFileHandle('backup-manifest.json',{create:true}),w=await manifestHandle.createWritable();await w.write(jsonText(manifest));await w.close();return name
    }
    async listBackups(){const out=[];for(const e of await this.listEntries('backups',{optional:true}))if(e.kind==='directory')out.push(e.name);return out}
    async pruneBackups({keep,candidates=null}){const allowed=candidates instanceof Set?candidates:null;for(const name of await this.listBackups())if((!allowed||allowed.has(name))&&!keep.has(name))await this.deletePath(`backups/${name}`,{recursive:true})}
  }

  window.WorkspaceRepository=WorkspaceRepository;
  window.LocalWorkspaceRepository=LocalWorkspaceRepository;
  window.workspaceRepository=null;
  window.setWorkspaceRepository=repo=>{window.workspaceRepository=repo;return repo};
  window.workspaceRepositoryForHandle=handle=>{if(window.workspaceRepository?.mode==='local'&&window.workspaceRepository.nativeHandle===handle)return window.workspaceRepository;return new LocalWorkspaceRepository(handle)};
})();
