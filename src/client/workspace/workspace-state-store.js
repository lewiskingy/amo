const DB_NAME='amo-browser-state';
const DB_VERSION=1;
const HANDLE_STORE='handles';
const DEFAULT_HANDLE_KEY='defaultWorkspace';
const CONNECTION_PREF_KEY='amo.lastWorkspaceConnection';
const REMOTE_URL_KEY='amo.remoteWorkspaceUrl';

function openHandleDb(indexedDBRef){
  return new Promise((resolve,reject)=>{
    if(!indexedDBRef){reject(new Error('IndexedDB is not available in this browser.'));return}
    const request=indexedDBRef.open(DB_NAME,DB_VERSION);
    request.onupgradeneeded=()=>{const db=request.result;if(!db.objectStoreNames.contains(HANDLE_STORE))db.createObjectStore(HANDLE_STORE)};
    request.onsuccess=()=>resolve(request.result);
    request.onerror=()=>reject(request.error||new Error('Could not open browser workspace storage.'));
  });
}

export class WorkspaceStateStore{
  constructor({indexedDBRef=globalThis.indexedDB,localStorageRef=globalThis.localStorage}={}){this.indexedDB=indexedDBRef;this.localStorage=localStorageRef}
  async getLocalHandle(){
    const db=await openHandleDb(this.indexedDB);
    try{return await new Promise((resolve,reject)=>{const tx=db.transaction(HANDLE_STORE,'readonly'),request=tx.objectStore(HANDLE_STORE).get(DEFAULT_HANDLE_KEY);request.onsuccess=()=>resolve(request.result||null);request.onerror=()=>reject(request.error)})}finally{db.close()}
  }
  async rememberLocalHandle(handle){
    if(!handle)return;
    const db=await openHandleDb(this.indexedDB);
    try{await new Promise((resolve,reject)=>{const tx=db.transaction(HANDLE_STORE,'readwrite');tx.objectStore(HANDLE_STORE).put(handle,DEFAULT_HANDLE_KEY);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||new Error('Workspace handle storage was aborted.'))})}finally{db.close()}
  }
  async forgetLocalHandle(){
    const db=await openHandleDb(this.indexedDB);
    try{await new Promise((resolve,reject)=>{const tx=db.transaction(HANDLE_STORE,'readwrite');tx.objectStore(HANDLE_STORE).delete(DEFAULT_HANDLE_KEY);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error)})}finally{db.close()}
  }
  getConnectionPreference(){
    try{const value=JSON.parse(this.localStorage?.getItem(CONNECTION_PREF_KEY)||'null');return value&&['local','remote'].includes(value.mode)?value:null}catch{return null}
  }
  setConnectionPreference(value){
    if(!value?.mode)return value;
    try{this.localStorage?.setItem(CONNECTION_PREF_KEY,JSON.stringify({...value,updatedAt:new Date().toISOString()}))}catch{}
    return value;
  }
  getRemoteUrl(defaultUrl=''){
    try{return this.localStorage?.getItem(REMOTE_URL_KEY)||this.getConnectionPreference()?.url||defaultUrl||''}catch{return defaultUrl||''}
  }
  setRemoteUrl(url){try{if(url)this.localStorage?.setItem(REMOTE_URL_KEY,String(url))}catch{}return url}
}

export async function handlePermission(handle,mode='readwrite'){
  if(!handle)return'denied';
  try{return handle.queryPermission?await handle.queryPermission({mode}):'prompt'}catch{return'prompt'}
}

export async function requestHandlePermission(handle,mode='readwrite'){
  const current=await handlePermission(handle,mode);if(current==='granted')return true;
  try{return !!handle.requestPermission&&await handle.requestPermission({mode})==='granted'}catch{return false}
}

export const WorkspaceStateKeys={DB_NAME,DB_VERSION,HANDLE_STORE,DEFAULT_HANDLE_KEY,CONNECTION_PREF_KEY,REMOTE_URL_KEY};
