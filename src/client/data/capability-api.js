const RECORD_CAPABILITIES=Object.freeze({
  demand:'demand',
  workPackages:'workPackages',
  people:'team',
  allocations:'allocations'
});

function requireMethod(target,name){
  if(typeof target?.[name]!=='function')throw new Error(`Workspace repository must implement ${name}().`);
}

class RecordCapability{
  constructor(repository,entityType){this.repository=repository;this.entityType=entityType}
  list(options){return this.repository.listRecords(this.entityType,options)}
  get(id){return this.repository.getRecord(this.entityType,id)}
  save(record){return this.repository.saveRecord(this.entityType,record)}
  delete(id){return this.repository.deleteRecord(this.entityType,id)}
}

class ActualsCapability{
  constructor(repository){this.repository=repository}
  listPeriods(){return this.repository.listActualsPeriods()}
  readPeriod(month){return this.repository.readActualsPeriod(month)}
  readManifest(){return this.repository.readActualsManifest()}
  replacePeriods(periods,manifest){return this.repository.replaceActualsPeriods(periods,manifest)}
  clear(){return this.repository.clearActuals()}
  async latestPeriod(){
    const periods=await this.listPeriods(),month=[...(periods||[])].sort().at(-1);
    if(!month)return null;
    const period=await this.readPeriod(month);
    return period?{...period,month:period.month||month}:null;
  }
}

class SettingsCapability{
  constructor(repository){this.repository=repository}
  get(){return this.repository.getSettings()}
  save(settings){return this.repository.saveSettings(settings)}
}

class WorkspaceCapability{
  constructor(repository){this.repository=repository}
  connect(){return this.repository.connect()}
}

export class WorkspaceCapabilityApi{
  constructor(repository){
    if(!repository)throw new Error('A workspace repository is required.');
    for(const name of ['connect','listRecords','getRecord','saveRecord','deleteRecord','getSettings','saveSettings','listActualsPeriods','readActualsPeriod','readActualsManifest','replaceActualsPeriods','clearActuals'])requireMethod(repository,name);
    this.repository=repository;
    this.mode=repository.mode;
    this.workspace=new WorkspaceCapability(repository);
    for(const [name,entityType] of Object.entries(RECORD_CAPABILITIES))this[name]=new RecordCapability(repository,entityType);
    this.actuals=new ActualsCapability(repository);
    this.settings=new SettingsCapability(repository);
  }
}

export class LocalWorkspaceCapabilityApi extends WorkspaceCapabilityApi{
  constructor(repository){
    if(repository?.mode!=='local')throw new Error('LocalWorkspaceCapabilityApi requires a Local Workspace repository.');
    super(repository);
  }
}

export class RemoteWorkspaceCapabilityApi extends WorkspaceCapabilityApi{
  constructor(repository){
    if(repository?.mode!=='remote')throw new Error('RemoteWorkspaceCapabilityApi requires a Remote Workspace repository.');
    super(repository);
  }
}

export function capabilityApiForRepository(repository){
  if(repository?.mode==='local')return new LocalWorkspaceCapabilityApi(repository);
  if(repository?.mode==='remote')return new RemoteWorkspaceCapabilityApi(repository);
  throw new Error(`Unsupported workspace repository mode: ${repository?.mode||'unknown'}.`);
}

export const capabilityEntityTypes=RECORD_CAPABILITIES;
