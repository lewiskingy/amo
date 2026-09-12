const fs=require('node:fs');const path=require('node:path');const assert=require('node:assert/strict');
function moduleDataUrl(file){const absolute=path.resolve(file);let source=fs.readFileSync(absolute,'utf8');source=source.replace(/from\s+(['"])(\.\.?\/[^'"]+)\1/g,(_match,_quote,specifier)=>`from '${moduleDataUrl(path.resolve(path.dirname(absolute),specifier))}'`);return`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`}
async function importSource(file){return import(moduleDataUrl(file))}
function gateway(kind,calls){return{repository:{name:`${kind} repo`},async connect(){calls.push(`${kind}:connect`)},async loadDemandSlice(){return{}}}}
(async()=>{
  const {WorkspaceSession}=await importSource('src/client/workspace/workspace-session.js');
  const {WorkspaceStateKeys}=await importSource('src/client/workspace/workspace-state-store.js');
  assert.equal(WorkspaceStateKeys.DB_NAME,'amo-browser-state');assert.equal(WorkspaceStateKeys.DEFAULT_HANDLE_KEY,'defaultWorkspace');assert.equal(WorkspaceStateKeys.CONNECTION_PREF_KEY,'amo.lastWorkspaceConnection');

  const grantedHandle={name:'Architecture Local',async queryPermission(){return'granted'}};let calls=[];
  const localStore={async getLocalHandle(){return grantedHandle},getConnectionPreference(){return{mode:'local'}},setConnectionPreference(value){calls.push(`pref:${value.mode}`)},async rememberLocalHandle(){calls.push('remember-local')}};
  const localSession=new WorkspaceSession({store:localStore,createLocalGateway:()=>gateway('local',calls),createRemoteGateway:()=>gateway('remote',calls),defaultRemoteUrl:()=> 'https://remote.invalid'});
  const restoredLocal=await localSession.restore();assert.equal(restoredLocal.mode,'local');assert.equal(restoredLocal.name,'Architecture Local');assert.deepEqual(calls,['local:connect','pref:local']);assert.equal(localSession.current.mode,'local');

  calls=[];const promptHandle={name:'Remembered Local',async queryPermission(){return'prompt'},async requestPermission(){calls.push('request-permission');return'granted'}};
  const promptStore={async getLocalHandle(){return promptHandle},getConnectionPreference(){return{mode:'local'}},setConnectionPreference(value){calls.push(`pref:${value.mode}`)},async rememberLocalHandle(){calls.push('remember-local')}};
  const promptSession=new WorkspaceSession({store:promptStore,createLocalGateway:()=>gateway('local',calls),createRemoteGateway:()=>gateway('remote',calls),directoryPicker:async()=>{throw new Error('picker should not run')}});
  const waiting=await promptSession.restore();assert.equal(waiting.state,'reconnect-required');assert.equal(waiting.preferredMode,'local');assert.equal(calls.length,0,'A remembered Local preference must not silently fall back to Remote.');
  const reconnected=await promptSession.chooseLocal();assert.equal(reconnected.mode,'local');assert.deepEqual(calls,['request-permission','local:connect','remember-local','pref:local']);

  calls=[];const chosenHandle={name:'Different Local',async queryPermission(){return'granted'}};
  const changeSession=new WorkspaceSession({store:{async getLocalHandle(){return grantedHandle},getConnectionPreference(){return{mode:'local'}},setConnectionPreference(value){calls.push(`pref:${value.mode}`)},async rememberLocalHandle(handle){calls.push(`remember:${handle.name}`)}},createLocalGateway:handle=>gateway(`local-${handle.name}`,calls),directoryPicker:async()=>chosenHandle});
  await changeSession.restore();calls=[];const changed=await changeSession.chooseLocal({preferRemembered:false});assert.equal(changed.name,'Different Local');assert.deepEqual(calls,['local-Different Local:connect','remember:Different Local','pref:local']);

  calls=[];const remoteStore={async getLocalHandle(){return grantedHandle},getConnectionPreference(){return{mode:'remote',url:'https://amo.example/api/'}},getRemoteUrl(){return'https://fallback.invalid'},setRemoteUrl(url){calls.push(`url:${url}`)},setConnectionPreference(value){calls.push(`pref:${value.mode}`)}};
  const remoteSession=new WorkspaceSession({store:remoteStore,createLocalGateway:()=>gateway('local',calls),createRemoteGateway:url=>{calls.push(`remote-url:${url}`);return gateway('remote',calls)}});const restoredRemote=await remoteSession.restore();assert.equal(restoredRemote.mode,'remote');assert.deepEqual(calls,['remote-url:https://amo.example/api','remote:connect','url:https://amo.example/api','pref:remote']);

  const sessionSource=fs.readFileSync('src/client/workspace/workspace-session.js','utf8');assert.doesNotMatch(sessionSource,/legacy-workspace-adapter/,'Canonical WorkspaceSession must not depend on the legacy repository adapter.');
  const source=fs.readFileSync('src/demand/main.js','utf8');assert.match(source,/configuredLegacyWorkspaceSession/);assert.match(source,/new WorkspaceSwitcher/);assert.doesNotMatch(source,/configuredLegacyRemoteGateway\(\)/);assert.match(fs.readFileSync('src/client/legacy/legacy-workspace-session.js','utf8'),/Transitional composition root/);assert.match(fs.readFileSync('src/client/README.md','utf8'),/WorkspaceSession/);
  console.log('Target client workspace session tests passed.');
})().catch(error=>{console.error(error);process.exit(1)});
