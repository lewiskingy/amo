const fs=require('fs'),vm=require('vm'),assert=require('assert');
const encodeCell=({r,c})=>`${String.fromCharCode(65+c)}${r+1}`;
const decodeRange=ref=>{const [a,b]=String(ref).split(':'),parse=s=>({c:s.charCodeAt(0)-65,r:Number(s.slice(1))-1});return{s:parse(a),e:parse(b)}};
let assignedRepository=null;
const context={window:{XLSX:{utils:{encode_cell:encodeCell,decode_range:decodeRange}},workspaceRepository:null,setWorkspaceRepository:repo=>{assignedRepository=repo;context.window.workspaceRepository=repo;return repo}},console,CustomEvent:function(){}};vm.createContext(context);vm.runInContext(fs.readFileSync('src/app-actuals.js','utf8'),context);const Actuals=context.window.Actuals;

assert.equal(Actuals.normalizeMonth('2026/7'),'2026-07');
assert.equal(Actuals.normalizeMonth('2026/07'),'2026-07');
assert.equal(Actuals.normalizeMonth('bad'),'');
assert.deepEqual(Array.from(Actuals.COLUMN_ALIASES['Staff Number']),['People #','Person #']);

const header=['Portfolio','Programme','Project Name','Project Number','Month','People #','Person Name','UOM','QUANTITY','Cost in GBP'];
const rows=[header,
 ['P','Prog','Project A','001','2026/07','S1','Person One','Hours',7.5,100],
 ['P','Prog','Project A','001','2026/07','S1','Person One','Currency',999,50],
 ['P','Prog','Unknown Project','999','2026/07','S1','Person One','Hours',-1.5,-20],
 ['P',null,'Project A','001','2026/07',null,null,'Ea',10,25],
 ['P',null,'Outside Project','998','2026/07',null,null,'Ea',10,30],
 ['P','Prog','Project A','001','2026/08','S2','Person Two','Hours',8,120],
 ['P','Prog','Project A','001','2026/08','OTHER','Person One','Hours',10,200]
];
const ws={'!ref':`A1:J${rows.length}`};rows.forEach((row,r)=>row.forEach((v,c)=>ws[encodeCell({r,c})]={v}));
const scope={team:[{id:'USR-1',name:'Person One',staffNumber:'S1'},{id:'USR-2',name:'Person Two',staffNumber:'S2'}],demand:[{id:'DEM-1',title:'Project A',projectNumber:'001'},{id:'DEM-LEGACY',title:'Legacy code must not match',costCentreOrProjectCode:'999',projectNumbers:['998'],projectCodes:['997']}]};
const result=Actuals.aggregateWorksheet(ws,scope);
assert.equal(result.sourceHeaders['Staff Number'],'People #');
assert.equal(result.stats.sourceRows,7);assert.equal(result.stats.includedRows,5);assert.equal(result.stats.unmatchedStaffRows,1);assert.equal(result.stats.outOfScopePersonlessRows,1);assert.equal(result.stats.ignoredPeopleRows,2);assert.equal(result.stats.unmatchedProjectRows,1);assert.equal(result.stats.ambiguousProjectRows,0);assert.equal(result.periods.length,2);assert.equal(result.firstMonth,'2026-07');assert.equal(result.latestMonth,'2026-08');assert.equal(result.totalHours,14);assert.equal(result.totalCostGbp,275);
const july=result.periods.find(p=>p.month==='2026-07');assert.equal(july.facts.length,3);
const matched=july.facts.find(f=>f.staffNumber==='S1'&&f.projectNumber==='001');assert.equal(matched.teamMemberId,'USR-1');assert.equal(matched.demandId,'DEM-1');assert.equal(matched.actualHours,7.5);assert.equal(matched.actualCostGbp,150);assert.equal(Object.prototype.hasOwnProperty.call(matched,'personNumber'),false);
const unmatched=july.facts.find(f=>f.projectNumber==='999');assert.equal(unmatched.teamMemberId,'USR-1');assert.equal(unmatched.demandId,null);assert.equal(unmatched.actualHours,-1.5);assert.equal(unmatched.actualCostGbp,-20);
const unattributed=july.facts.find(f=>f.staffNumber===null);assert.equal(unattributed.demandId,'DEM-1');assert.equal(unattributed.actualHours,0);assert.equal(unattributed.actualCostGbp,25);
const august=result.periods.find(p=>p.month==='2026-08');assert.equal(august.facts.length,1);assert.equal(august.facts[0].staffNumber,'S2');

/* Stored source keys are authoritative at read time. A previously-unmatched fact immediately follows current Demand/People configuration without reimport. */
const staleFact={projectNumber:'11702',staffNumber:'66324Z',teamMemberId:null,demandId:null,actualHours:62,actualCostGbp:6477.14};
const currentScope={team:[{id:'USR-002',staffNumber:'66324Z',name:'William Parker'}],demand:[{id:'DEM-2026-0001',projectNumber:'11702',title:'iPaaS'}]};
const resolved=Actuals.resolveFact(staleFact,currentScope);assert.equal(resolved.teamMemberId,'USR-002');assert.equal(resolved.demandId,'DEM-2026-0001');assert.equal(resolved.resolution.person,'matched');assert.equal(resolved.resolution.demand,'matched');
const moved=Actuals.resolveFact({...staleFact,teamMemberId:'OLD-USR',demandId:'OLD-DEM'},currentScope);assert.equal(moved.teamMemberId,'USR-002');assert.equal(moved.demandId,'DEM-2026-0001','source keys override stale persisted AMO ids');
const duplicateProject=Actuals.resolveFact(staleFact,{team:currentScope.team,demand:[...currentScope.demand,{id:'DEM-DUP',projectNumber:'11702'}]});assert.equal(duplicateProject.demandId,null);assert.equal(duplicateProject.resolution.demand,'ambiguous');
const duplicateStaff=Actuals.resolveFact(staleFact,{team:[...currentScope.team,{id:'USR-DUP',staffNumber:'66324Z'}],demand:currentScope.demand});assert.equal(duplicateStaff.teamMemberId,null);assert.equal(duplicateStaff.resolution.person,'ambiguous');

/* Repository reads are decorated, not stored facts rewritten. Reporting/Admin therefore see current resolution while the persisted period remains unchanged. */
const persisted={schemaVersion:1,month:'2026-07',facts:[staleFact]};
context.db={team:currentScope.team,demand:currentScope.demand};
const repo={readActualsPeriod:async()=>persisted};context.window.setWorkspaceRepository(repo);
(async()=>{const dynamic=await assignedRepository.readActualsPeriod('2026-07');assert.equal(dynamic.facts[0].demandId,'DEM-2026-0001');assert.equal(dynamic.facts[0].teamMemberId,'USR-002');assert.equal(persisted.facts[0].demandId,null,'read-time resolution must not mutate persisted source facts')})().catch(e=>{console.error(e);process.exit(1)});

/* Duplicate Demand Project Numbers are never resolved arbitrarily. Facts remain usable at Person/Project level but have no Demand attribution. */
const ambiguousScope={team:scope.team,demand:[{id:'DEM-1',projectNumber:'001'},{id:'DEM-2',projectNumber:'001'}]};
const ambiguous=Actuals.aggregateWorksheet(ws,ambiguousScope);assert.equal(ambiguous.stats.ambiguousProjectRows,4);assert.equal(ambiguous.stats.unmatchedProjectRows,1);for(const period of ambiguous.periods)for(const fact of period.facts.filter(f=>f.projectNumber==='001'))assert.equal(fact.demandId,null);

/* Older Oracle extracts used Person #. It remains a supported source alias, but facts still use staffNumber. */
const legacyRows=rows.map((row,i)=>i===0?row.map(v=>v==='People #'?'Person #':v):row);
const legacyWs={'!ref':`A1:J${legacyRows.length}`};legacyRows.forEach((row,r)=>row.forEach((v,c)=>legacyWs[encodeCell({r,c})]={v}));
const legacy=Actuals.aggregateWorksheet(legacyWs,scope);assert.equal(legacy.sourceHeaders['Staff Number'],'Person #');assert.equal(legacy.stats.includedRows,5);assert.equal(legacy.stats.unmatchedStaffRows,1);assert.equal(legacy.stats.outOfScopePersonlessRows,1);assert(legacy.periods[0].facts.some(f=>f.staffNumber==='S1'));

const preview=Actuals.replacementPreview(result,['2026-01','2026-07']);assert.deepEqual(Array.from(preview.replace),['2026-07']);assert.deepEqual(Array.from(preview.add),['2026-08']);
const bad={'!ref':'A1:I1'};header.filter(h=>h!=='UOM').forEach((v,c)=>bad[encodeCell({r:0,c})]={v});assert.throws(()=>Actuals.aggregateWorksheet(bad,{team:[],demand:[]}),/missing required columns/);
console.log('Actuals import tests passed');
require('./demand-project-number-contract.test.js');
require('./staff-number-contract.test.js');
require('./work-packages-contract.test.js');
