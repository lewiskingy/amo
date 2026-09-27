const fs=require('node:fs');const path=require('node:path');const assert=require('node:assert/strict');
function moduleDataUrl(file){const absolute=path.resolve(file);let source=fs.readFileSync(absolute,'utf8');source=source.replace(/from\s+(['"])(\.\.?\/[^'"]+)\1/g,(_m,_q,s)=>`from '${moduleDataUrl(path.resolve(path.dirname(absolute),s))}'`);return`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`}
async function importSource(file){return import(moduleDataUrl(file))}

function repositoryDouble(mode){
  const calls=[],records={demand:[{id:'DEM-1',title:'Demand'}],workPackages:[{id:'WP-1',demandId:'DEM-1'}],team:[{id:'P-1',name:'Person'}],allocations:[{id:'A-1',demandId:'DEM-1',teamMemberId:'P-1'}]},settings={services:['Architecture']},periods={'2026-08':{month:'2026-08',facts:[{id:'old'}]},'2026-09':{month:'2026-09',facts:[{id:'latest'}]}};
  const repo={mode,calls,
    async connect(){calls.push(['connect']);return{name:`${mode} workspace`,schemaVersion:'1'}},
    async listRecords(type){calls.push(['listRecords',type]);return structuredClone(records[type]||[])},
    async getRecord(type,id){calls.push(['getRecord',type,id]);return structuredClone((records[type]||[]).find(r=>r.id===id)||null)},
    async saveRecord(type,record){calls.push(['saveRecord',type,record.id]);const rows=records[type]||(records[type]=[]),i=rows.findIndex(r=>r.id===record.id);if(i>=0)rows.splice(i,1,structuredClone(record));else rows.push(structuredClone(record));return record},
    async deleteRecord(type,id){calls.push(['deleteRecord',type,id]);records[type]=(records[type]||[]).filter(r=>r.id!==id)},
    async getSettings(){calls.push(['getSettings']);return structuredClone(settings)},
    async saveSettings(next){calls.push(['saveSettings']);Object.assign(settings,structuredClone(next));return next},
    async listActualsPeriods(){calls.push(['listActualsPeriods']);return Object.keys(periods)},
    async readActualsPeriod(month){calls.push(['readActualsPeriod',month]);return structuredClone(periods[month]||null)},
    async readActualsManifest(){calls.push(['readActualsManifest']);return{latestPeriod:'2026-09'}},
    async replaceActualsPeriods(next){calls.push(['replaceActualsPeriods']);for(const p of next||[])periods[p.month]=structuredClone(p)},
    async clearActuals(){calls.push(['clearActuals']);for(const key of Object.keys(periods))delete periods[key]}
  };return repo;
}

async function certify(mode,apiModule){
  const repository=repositoryDouble(mode),api=apiModule.capabilityApiForRepository(repository);
  assert.equal(api.mode,mode);assert.equal(api.constructor.name,mode==='local'?'LocalWorkspaceCapabilityApi':'RemoteWorkspaceCapabilityApi');
  assert.equal((await api.workspace.connect()).name,`${mode} workspace`);
  assert.deepEqual((await api.demand.list()).map(x=>x.id),['DEM-1']);
  assert.deepEqual((await api.workPackages.list()).map(x=>x.id),['WP-1']);
  assert.deepEqual((await api.people.list()).map(x=>x.id),['P-1']);
  assert.deepEqual((await api.allocations.list()).map(x=>x.id),['A-1']);
  assert.equal((await api.demand.get('DEM-1')).title,'Demand');
  await api.demand.save({id:'DEM-2',title:'New'});assert.equal((await api.demand.get('DEM-2')).title,'New');await api.demand.delete('DEM-2');assert.equal(await api.demand.get('DEM-2'),null);
  assert.deepEqual(await api.settings.get(),{services:['Architecture']});await api.settings.save({services:['Data']});assert.deepEqual(await api.settings.get(),{services:['Data']});
  assert.deepEqual(await api.actuals.listPeriods(),['2026-08','2026-09']);assert.equal((await api.actuals.latestPeriod()).month,'2026-09');assert.equal((await api.actuals.latestPeriod()).facts[0].id,'latest');assert.equal((await api.actuals.readManifest()).latestPeriod,'2026-09');
  await api.actuals.replacePeriods([{month:'2026-10',facts:[]}],{});assert.ok((await api.actuals.listPeriods()).includes('2026-10'));
  assert.ok(repository.calls.some(c=>c[0]==='listRecords'&&c[1]==='team'),'People capability must map to the persisted team entity without leaking that storage name to consumers.');
  assert.ok(repository.calls.some(c=>c[0]==='listRecords'&&c[1]==='workPackages'),'Work Packages capability must use the existing repository entity contract.');
}

(async()=>{
  const apiModule=await importSource('src/client/data/capability-api.js');
  await certify('local',apiModule);await certify('remote',apiModule);
  assert.throws(()=>apiModule.capabilityApiForRepository({mode:'other'}),/Unsupported workspace repository mode/);
  assert.throws(()=>new apiModule.LocalWorkspaceCapabilityApi({mode:'remote'}),/requires a Local Workspace repository/);
  assert.throws(()=>new apiModule.RemoteWorkspaceCapabilityApi({mode:'local'}),/requires a Remote Workspace repository/);
  const source=fs.readFileSync('src/client/data/capability-api.js','utf8');
  assert.doesNotMatch(source,/\bfetch\s*\(/,'Canonical capability contracts must not know Remote HTTP transport.');
  assert.doesNotMatch(source,/FileSystemDirectoryHandle|window\./,'Canonical capability contracts must not know Local browser storage or legacy globals.');
  assert.doesNotMatch(source,/loadDemandSlice/,'Canonical capability APIs must not become page-specific slice loaders.');
  console.log('Target client capability API Local/Remote contract tests passed.');
})().catch(error=>{console.error(error);process.exit(1)});
