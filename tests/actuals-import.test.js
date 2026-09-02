const fs=require('fs'),vm=require('vm'),assert=require('assert');
const code=fs.readFileSync('src/app-actuals.js','utf8');
const context={window:{},console,CustomEvent:function(){}};vm.createContext(context);vm.runInContext(code,context);const Actuals=context.window.Actuals;

assert.equal(Actuals.normalizeMonth('2026/7'),'2026-07');
assert.equal(Actuals.normalizeMonth('2026/07'),'2026-07');
assert.equal(Actuals.normalizeMonth('bad'),'');
assert.equal(Actuals.parseDateFromName('Oracle YTD Actuals 31-08-2026.xlsx','Oracle YTD Actuals ','.xlsx').iso,'2026-08-31');
assert.equal(Actuals.parseDateFromName('wrong.xlsx','Oracle YTD Actuals ','.xlsx'),null);

const header=['Portfolio','Programme','Project Name','Project Number','Month','Person #','Person Name','UOM','QUANTITY','Cost in GBP'];
const rows=[header,
 ['P','Prog','Project A','001','2026/07','S1','Person One','Hours',7.5,100],
 ['P','Prog','Project A','001','2026/07','S1','Person One','Currency',999,50],
 ['P','Prog','Project A','001','2026/07','S1','Person One','Hours',-1.5,-20],
 ['P',null,'Project A','001','2026/07',null,null,'Ea',10,25],
 ['P','Prog','Project A','001','2026/08','S1','Person One','Hours',8,120]
];
const result=Actuals.aggregateRows(rows);
assert.equal(result.sourceRows,5);assert.equal(result.facts.length,3);assert.equal(result.firstMonth,'2026-07');assert.equal(result.latestMonth,'2026-08');assert.equal(result.totalHours,14);assert.equal(result.totalCostGbp,275);
const julyPerson=result.facts.find(f=>f.month==='2026-07'&&f.personNumber==='S1');assert.equal(julyPerson.actualHours,6);assert.equal(julyPerson.actualCostGbp,130);
const unattributed=result.facts.find(f=>f.personNumber===null);assert.equal(unattributed.actualHours,0);assert.equal(unattributed.actualCostGbp,25);
assert.throws(()=>Actuals.aggregateRows([header.filter(h=>h!=='UOM')]),/missing required columns/);
console.log('Actuals import tests passed');
