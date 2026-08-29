/* HTTP implementation of the WorkspaceRepository contract. */
(function initRemoteWorkspaceRepository(){
  let authLoadPromise=null;
  function ensureAmoAuth(){
    if(window.amoAuth)return Promise.resolve(window.amoAuth);
    if(authLoadPromise)return authLoadPromise;
    authLoadPromise=new Promise(resolve=>{
      let script=document.querySelector('script[data-amo-auth]');
      if(script){script.addEventListener('load',()=>resolve(window.amoAuth||null),{once:true});script.addEventListener('error',()=>resolve(null),{once:true});return}
      script=document.createElement('script');script.src=typeof amoAsset==='function'?amoAsset('app-auth.js'):'app-auth.js';script.dataset.amoAuth='true';script.async=false;
      script.onload=()=>resolve(window.amoAuth||null);script.onerror=()=>resolve(null);document.head.appendChild(script)
    });
    return authLoadPromise
  }

  class RemoteWorkspaceRepository extends WorkspaceRepository{
    constructor(baseUrl){super('remote');this.baseUrl=String(baseUrl||'').replace(/\/+$/,'');this.name='Remote Workspace';this.info=null;this.versions={}}
    actor(){try{const authUser=window.amoAuth?.currentIdentity?.();if(authUser)return authUser.name||authUser.email||'Authenticated user';const u=typeof localWorkspaceUser==='function'?localWorkspaceUser():null;return u?.name||u?.email||'Remote user'}catch{return'Remote user'}}
    headers(extra={}){return{'Content-Type':'application/json','X-AMO-Actor':this.actor(),...extra}}
    rememberVersions(result){if(result?.versions)Object.assign(this.versions,result.versions);return result}
    async request(path,options={}){
      let requestPath=path,requestOptions={...options};
      const lockPrefix='/api/commit-locks/';
      if(String(path||'').startsWith(lockPrefix)){
        const resource=decodeURIComponent(String(path).slice(lockPrefix.length));
        let payload={};try{payload=options.body?JSON.parse(options.body):{}}catch{payload={}};
        requestPath='/api/commit-locks';requestOptions={...options,body:JSON.stringify({...payload,resource})}
      }
      const auth=await ensureAmoAuth();
      let token=null;
      try{token=await auth?.getApiToken?.({interactive:false})||null}catch(e){console.warn('AMO could not obtain the current authentication token.',e)}
      const authHeaders=token?{Authorization:`Bearer ${token}`}:{},headers=this.headers({...requestOptions.headers,...authHeaders});
      const response=await fetch(`${this.baseUrl}${requestPath}`,{...requestOptions,headers});
      const text=await response.text();let data=null;try{data=text?JSON.parse(text):null}catch{data=text}
      if(!response.ok){
        const message=response.status===401&&!auth?.isSignedIn?.()
          ?'AMO API requires authentication. Sign in with Google from the menu and try again.'
          :(data?.error||`Remote workspace request failed (${response.status}).`);
        const e=new Error(message);e.status=response.status;e.details=data?.details;throw e
      }return data
    }
    async connect(){this.info=await this.request('/api/info');if(this.info?.product!=='AMO')throw new Error('The remote URL is not an AMO API.');this.name=this.info.workspaceName||'Remote Workspace';return this.info}
    async loadWorkspace(){const bundle=await this.request('/api/workspace');this.versions={...(bundle?.versions||{})};if(bundle&&Object.prototype.hasOwnProperty.call(bundle,'versions'))delete bundle.versions;return bundle}
    async ensureWritePermission(){return true}
    async saveChanges(payload){const result=await this.request('/api/workspace/save',{method:'POST',body:JSON.stringify({workspace:payload.workspace,settings:payload.settings,collections:payload.collections,dirty:Object.fromEntries(Object.entries(payload.dirty||{}).map(([k,v])=>[k,[...v]])),deleted:Object.fromEntries(Object.entries(payload.deleted||{}).map(([k,v])=>[k,[...v]])),configDirty:!!payload.configDirty,expectedVersions:this.versions})});return this.rememberVersions(result)}
    async listRecords(type){return this.request(`/api/records/${encodeURIComponent(type)}`)}
    async getRecord(type,id){const key=`${type}:${id}`;if(this.info?.capabilities?.optimisticConcurrency){const value=await this.request(`/api/records/${encodeURIComponent(type)}/${encodeURIComponent(id)}?meta=1`);if(value?.version!=null)this.versions[key]=value.version;return value?.record}return this.request(`/api/records/${encodeURIComponent(type)}/${encodeURIComponent(id)}`)}
    async saveRecord(type,record){const key=`${type}:${record.id}`,version=this.versions[key],result=await this.request(`/api/records/${encodeURIComponent(type)}/${encodeURIComponent(record.id)}`,{method:'PUT',headers:version!=null?{'If-Match':String(version)}:{},body:JSON.stringify(record)});return this.rememberVersions(result)}
    async deleteRecord(type,id){const key=`${type}:${id}`,version=this.versions[key],result=await this.request(`/api/records/${encodeURIComponent(type)}/${encodeURIComponent(id)}`,{method:'DELETE',headers:version!=null?{'If-Match':String(version)}:{}});this.rememberVersions(result);delete this.versions[key];return result}
    async getSettings(){const key='configuration:settings';if(this.info?.capabilities?.optimisticConcurrency){const value=await this.request('/api/settings?meta=1');if(value?.version!=null)this.versions[key]=value.version;return value?.record}return this.request('/api/settings')}
    async saveSettings(settings){const key='configuration:settings',version=this.versions[key],result=await this.request('/api/settings',{method:'PUT',headers:version!=null?{'If-Match':String(version)}:{},body:JSON.stringify(settings)});return this.rememberVersions(result)}
    async listStatusReports(){return this.request('/api/status-reports')}
    async getStatusReport(id){const name=String(id).endsWith('.json')?String(id):`${id}.json`,key=`statusReport:${name}`;if(this.info?.capabilities?.optimisticConcurrency){const value=await this.request(`/api/status-reports/${encodeURIComponent(id)}?meta=1`);if(value?.version!=null)this.versions[key]=value.version;return value?.record}return this.request(`/api/status-reports/${encodeURIComponent(id)}`)}
    async saveStatusReport(id,record){const name=String(id).endsWith('.json')?String(id):`${id}.json`,key=`statusReport:${name}`,version=this.versions[key],result=await this.request(`/api/status-reports/${encodeURIComponent(id)}`,{method:'PUT',headers:version!=null?{'If-Match':String(version)}:{},body:JSON.stringify(record)});return this.rememberVersions(result)}
    async readLock(){if(this.info?.capabilities?.locking===false)return null;return this.request('/api/lock')}
    async writeLock(record){if(this.info?.capabilities?.locking===false)return record;return this.request('/api/lock',{method:'PUT',body:JSON.stringify(record)})}
    async deleteLock(){if(this.info?.capabilities?.locking===false)return;return this.request('/api/lock',{method:'DELETE'})}
    async archiveRecords(recordsByEntity){return this.rememberVersions(await this.request('/api/archive',{method:'POST',body:JSON.stringify(recordsByEntity||{})}))}
    async listRecoveryPoints(limit=250){return this.request(`/api/recovery/points?limit=${encodeURIComponent(limit)}`)}
    async previewRestore(transactionId){return this.request('/api/recovery/preview',{method:'POST',body:JSON.stringify({transactionId})})}
    async restorePoint(transactionId){const result=await this.request('/api/recovery/restore',{method:'POST',body:JSON.stringify({transactionId})});this.versions={};return result}
    async createSafetyBackup(){return null}
    async pruneBackups(){return null}
    async listBackups(){return[]}
  }
  window.RemoteWorkspaceRepository=RemoteWorkspaceRepository;
})();
