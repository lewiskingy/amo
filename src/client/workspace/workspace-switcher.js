const esc=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));

export class WorkspaceSwitcher{
  constructor(host,{session,onChange,onError}={}){this.host=host;this.session=session;this.onChange=onChange;this.onError=onError;this.result={state:'idle'}}
  setResult(result){this.result=result||{state:'idle'};this.render();return this.result}
  async invoke(action){
    this.render({busy:true});
    try{const result=await action();this.setResult(result);await this.onChange?.(result);return result}
    catch(error){this.render();this.onError?.(error);throw error}
  }
  render({busy=false}={}){
    if(!this.host)return;
    const result=this.result||{},localLabel=result.state==='reconnect-required'&&result.preferredMode==='local'?`Reconnect ${result.rememberedName||'Local Workspace'}`:'Local Workspace';
    const current=result.state==='ready'?`${result.mode==='local'?'Local':'Remote'} · ${result.name||'Workspace'}`:result.message||'No workspace connected';
    this.host.className='amo-workspace-switcher';
    this.host.innerHTML=`<span class="amo-workspace-current"><small>Workspace</small><strong>${esc(current)}</strong></span><div class="amo-workspace-actions"><button type="button" class="btn" data-workspace-local ${busy?'disabled':''}>${esc(localLabel)}</button><button type="button" class="btn" data-workspace-remote ${busy?'disabled':''}>Remote Workspace</button></div>`;
    this.host.querySelector('[data-workspace-local]')?.addEventListener('click',()=>this.invoke(()=>this.session.chooseLocal()).catch(()=>{}));
    this.host.querySelector('[data-workspace-remote]')?.addEventListener('click',()=>this.invoke(()=>this.session.chooseRemote()).catch(()=>{}));
  }
}
