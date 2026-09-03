const fs=require('fs'),vm=require('vm'),assert=require('assert');
const encodeCell=({r,c})=>`${String.fromCharCode(65+c)}${r+1}`;
const decodeRange=ref=>{const [a,b]=String(ref).split(':'),parse=s=>({c:s.charCodeAt(0)-65,r:Number(s.slice(1))-1});return{s:parse(a),e:parse(b)}};
const context={window:{XLSX:{utils:{encode_cell:encodeCell,decode_range:decodeRange}}},console,CustomEvent:function(){}};vm.createContext(context);vm.runInContext(fs.readFileSync('src/app-actuals.js','utf8'),context);const Actuals=context.window.Actuals;

assert.equal(Actuals.normalizeMonth('2026/7'),'2026-07');
assert.equal(Actuals.normalizeMonth('2026/07'),'2026-07');
assert.equal(Actuals.normalizeMonth('bad'),'');

const header=['Portfolio','Programme','Project Name','Project Number','Month','Person #','Person Name','UOM','QUANTITY','Cost in GBP'];
const rows=[header,
 ['P','Prog','Project A','001','2026/07','S1','Person One','Hours',7.5,100],
 ['P','Prog','Project A','001','2026/07','S1','Person One','Currency',999,50],
 ['P','Prog','Unknown Project','999','2026/07','S1','Person One','Hours',-1.5,-20],
 ['P',null,'Project A','001','2026/07',null,null,'Ea',10,25],
 ['P','Prog','Project A','001','2026/08','S2','Person Two','Hours',8,120],
 ['P','Prog','Project A','001','2026/08','OTHER','Other Person','Hours',10,200]
];
const ws={'!ref':`A1:J${rows.length}`};rows.forEach((row,r)=>row.forEach((v,c)=>ws[encodeCell({r,c})]={v}));
const result=Actuals.aggregateWorksheet(ws,{team:[{id:'USR-1',name:'Person One',staffNumber:'S1'},{id:'USR-2',name:'Person Two',staffNumber:'S2'}],demand:[{id:'DEM-1',title:'Project A',projectNumber:'001'}]});
assert.equal(result.stats.sourceRows,6);assert.equal(result.stats.includedRows,5);assert.equal(result.stats.ignoredPeopleRows,1);assert.equal(result.periods.length,2);assert.equal(result.firstMonth,'2026-07');assert.equal(result.latestMonth,'2026-08');assert.equal(result.totalHours,14);assert.equal(result.totalCostGbp,275);
const july=result.periods.find(p=>p.month==='2026-07');assert.equal(july.facts.length,3);
const matched=july.facts.find(f=>f.personNumber==='S1'&&f.projectNumber==='001');assert.equal(matched.teamMemberId,'USR-1');assert.equal(matched.demandId,'DEM-1');assert.equal(matched.actualHours,7.5);assert.equal(matched.actualCostGbp,150);
const unmatched=july.facts.find(f=>f.projectNumber==='999');assert.equal(unmatched.demandId,null);assert.equal(unmatched.actualHours,-1.5);assert.equal(unmatched.actualCostGbp,-20);
const unattributed=july.facts.find(f=>f.personNumber===null);assert.equal(unattributed.demandId,'DEM-1');assert.equal(unattributed.actualHours,0);assert.equal(unattributed.actualCostGbp,25);
const preview=Actuals.replacementPreview(result,['2026-01','2026-07']);assert.deepEqual(Array.from(preview.replace),['2026-07']);assert.deepEqual(Array.from(preview.add),['2026-08']);
const bad={'!ref':'A1:I1'};header.filter(h=>h!=='UOM').forEach((v,c)=>bad[encodeCell({r:0,c})]={v});assert.throws(()=>Actuals.aggregateWorksheet(bad,{team:[],demand:[]}),/missing required columns/);
console.log('Actuals import tests passed');
