import {WorkspaceStateStore,handlePermission,requestHandlePermission} from './workspace-state-store.js';

const clean=value=>String(value??'').trim();
const unconfigured=kind=>()=>{throw new Error(`${kind} Workspace gateway factory is not configured.`)};

export class WorkspaceSession{
  constructor({
    store=new WorkspaceStateStore(),
    createLocalGateway=unconfigured('Local'),
    createRemoteGateway=unconfigured('Remote'),
    directoryPicker=options=>globalThis.showDirectoryPicker?.(options),
    defaultRemoteUrl=()=>''
  }={}){
    this.store=store;this.createLocalGateway=createLocalGateway;this.createRemoteGateway=createRemoteGateway;this.directoryPicker=directoryPicker;this.defaultRemoteUrl=defaultRemoteUrl;
    this.current=null;this.rememberedLocalHandle=null;
  }
  snapshot(extra={}){return{state:this.current?'ready':'idle',mode:this.current?.mode||null,name:this.current?.name||'',gateway:this.current?.gateway||null,...extra}}
  async rememberedHandle(){if(this.rememberedLocalHandle)return this.rememberedLocalHandle;try{this.rememberedLocalHandle=await this.store.getLocalHandle()}catch{}return this.rememberedLocalHandle}
  async restore(){
    const preference=this.store.getConnectionPreference?.()||null;
    const handle=await this.rememberedHandle();
    if(preference?.mode==='local'){
      if(!handle)return this.snapshot({state:'selection-required',preferredMode:'local',message:'Choose a Local Workspace to continue.'});
      const permission=await handlePermission(handle);
      if(permission==='granted')return this.openLocalHandle(handle,{remember:false});
      return this.snapshot({state:'reconnect-required',preferredMode:'local',rememberedName:handle.name||'Workspace',message:`Reconnect Local Workspace ${handle.name||''}`.trim()});
    }
    if(preference?.mode==='remote')return this.openRemote(preference.url||this.store.getRemoteUrl?.(this.defaultRemoteUrl())||this.defaultRemoteUrl());
    if(handle){
      const permission=await handlePermission(handle);
      if(permission==='granted')return this.openLocalHandle(handle,{remember:false});
      if(permission==='prompt')return this.snapshot({state:'reconnect-required',preferredMode:'local',rememberedName:handle.name||'Workspace',message:`Reconnect Local Workspace ${handle.name||''}`.trim()});
    }
    const remoteUrl=this.store.getRemoteUrl?.(this.defaultRemoteUrl())||this.defaultRemoteUrl();
    if(remoteUrl)return this.openRemote(remoteUrl);
    return this.snapshot({state:'selection-required',message:'Choose a workspace to continue.'});
  }
  async openLocalHandle(handle,{remember=true}={}){
    if(!handle)throw new Error('A Local Workspace folder is required.');
    const gateway=this.createLocalGateway(handle);await gateway.connect();
    if(remember){await this.store.rememberLocalHandle(handle);this.rememberedLocalHandle=handle}
    this.store.setConnectionPreference?.({mode:'local',name:handle.name||'Workspace'});
    this.current={mode:'local',name:handle.name||'Workspace',gateway,handle};
    return this.snapshot();
  }
  async chooseLocal({preferRemembered=true}={}){
    let handle=preferRemembered?await this.rememberedHandle():null;
    if(handle){
      const permission=await handlePermission(handle);
      if(permission!=='granted'&&!await requestHandlePermission(handle))handle=null;
    }
    if(!handle){
      if(typeof this.directoryPicker!=='function')throw new Error('Local Workspace folder access is not available in this browser.');
      handle=await this.directoryPicker({id:'amo-local-workspace',mode:'readwrite'});
      if(!handle)throw new Error('No Local Workspace folder was selected.');
    }
    return this.openLocalHandle(handle,{remember:true});
  }
  async openRemote(url){
    const normalized=clean(url||this.store.getRemoteUrl?.(this.defaultRemoteUrl())||this.defaultRemoteUrl()).replace(/\/+$/,'');
    if(!normalized)throw new Error('No Remote Workspace API is configured for this AMO deployment.');
    const gateway=this.createRemoteGateway(normalized);await gateway.connect();
    this.store.setRemoteUrl?.(normalized);this.store.setConnectionPreference?.({mode:'remote',url:normalized});
    this.current={mode:'remote',name:gateway.repository?.name||'Remote Workspace',url:normalized,gateway};
    return this.snapshot();
  }
  async chooseRemote(url=''){return this.openRemote(url)}
  async refresh(){
    if(!this.current)return this.restore();
    await this.current.gateway.connect();return this.snapshot()
  }
}
