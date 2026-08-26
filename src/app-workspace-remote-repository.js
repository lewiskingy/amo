/* HTTP implementation of the WorkspaceRepository contract. */
(function initRemoteWorkspaceRepository(){
  class RemoteWorkspaceRepository extends WorkspaceRepository{
    constructor(baseUrl){super('remote');this.baseUrl=String(baseUrl||'').replace(/\/+$/,'');this.name='Remote Workspace';this.info=null}
    async request(path,options={}){
      let requestPath=path,requestOptions={...options};
      const lockPrefix='/api/commit-locks/';
      if(String(path||'').startsWith(lockPrefix)){
        const resource=decodeURIComponent(String(path).slice(lockPrefix.length));
        let payload={};try{payload=options.body?JSON.parse(options.body):{}}catch{payload={}};
        requestPath='/api/commit-locks';requestOptions={...options,body:JSON.stringify({...payload,resource})}
      }
      const response=await fetch(`${this.baseUrl}${requestPath}`,{...requestOptions,headers:{'Content-Type':'application/json',...(requestOptions.headers||{})}});
      const text=await response.text();let data=null;try{data=text?JSON.parse(text):null}catch{data=text}
      if(!response.ok)throw new Error(data?.error||`Remote workspace request failed (${response.status}).`);return data
    }
    async connect(){this.info=await this.request('/api/info');if(this.info?.product!=='AMO')throw new Error('The remote URL is not an AMO API.');this.name=this.info.workspaceName||'Remote Workspace';return this.info}
    async loadWorkspace(){return this.request('/api/workspace')}
    async ensureWritePermission(){return true}
    async saveChanges(payload){return this.request('/api/workspace/save',{method:'POST',body:JSON.stringify({workspace:payload.workspace,settings:payload.settings,collections:payload.collections,dirty:Object.fromEntries(Object.entries(payload.dirty||{}).map(([k,v])=>[k,[...v]])),deleted:Object.fromEntries(Object.entries(payload.deleted||{}).map(([k,v])=>[k,[...v]])),configDirty:!!payload.configDirty})})}
    async listRecords(type){return this.request(`/api/records/${encodeURIComponent(type)}`)}
    async getRecord(type,id){return this.request(`/api/records/${encodeURIComponent(type)}/${encodeURIComponent(id)}`)}
    async saveRecord(type,record){return this.request(`/api/records/${encodeURIComponent(type)}/${encodeURIComponent(record.id)}`,{method:'PUT',body:JSON.stringify(record)})}
    async deleteRecord(type,id){return this.request(`/api/records/${encodeURIComponent(type)}/${encodeURIComponent(id)}`,{method:'DELETE'})}
    async getSettings(){return this.request('/api/settings')}
    async saveSettings(settings){return this.request('/api/settings',{method:'PUT',body:JSON.stringify(settings)})}
    async listStatusReports(){return this.request('/api/status-reports')}
    async getStatusReport(id){return this.request(`/api/status-reports/${encodeURIComponent(id)}`)}
    async saveStatusReport(id,record){return this.request(`/api/status-reports/${encodeURIComponent(id)}`,{method:'PUT',body:JSON.stringify(record)})}
    async readLock(){return this.request('/api/lock')}
    async writeLock(record){return this.request('/api/lock',{method:'PUT',body:JSON.stringify(record)})}
    async deleteLock(){return this.request('/api/lock',{method:'DELETE'})}
    async archiveRecords(recordsByEntity){return this.request('/api/archive',{method:'POST',body:JSON.stringify(recordsByEntity||{})})}
    async createSafetyBackup(){return null}
    async pruneBackups(){return null}
    async listBackups(){return[]}
  }
  window.RemoteWorkspaceRepository=RemoteWorkspaceRepository;
})();
