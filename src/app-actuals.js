(function initActuals(){
  const DEFAULTS={worksheet:'YTD Oracle Download'};
  const REQUIRED_COLUMNS=['Portfolio','Programme','Project Name','Project Number','Month','Person #','Person Name','UOM','QUANTITY','Cost in GBP'];
  const FACT_SCHEMA_VERSION=1;

  function settings(){return{...DEFAULTS,...((typeof db!=='undefined'&&db.settings?.actualsImport)||{})}}
  function normalizeMonth(value){const text=String(value??'').trim(),m=text.match(/^(\d{4})[\/-](\d{1,2})(?:[\/-]\d{1,2})?$/);if(!m)return'';return`${m[1]}-${String(Number(m[2])).padStart(2,'0')}`}
  function number(value){if(value===null||value===undefined||value==='')return 0;const n=Number(String(value).replace(/,/g,''));return Number.isFinite(n)?n:0}
  function norm(value){return String(value??'').trim().toLowerCase()}
  function uniq(values){return[...new Set(values.filter(Boolean))]}

  function workbookFrom(arrayBuffer){if(!window.XLSX)throw new Error('Excel parser is not available. Check the application can load its XLSX dependency.');return window.XLSX.read(arrayBuffer,{type:'array',cellDates:false,dense:true})}
  function inspectWorkbook(arrayBuffer){const workbook=workbookFrom(arrayBuffer);return{workbook,sheets:[...workbook.SheetNames],preferredWorksheet:workbook.SheetNames.includes(settings().worksheet)?settings().worksheet:(workbook.SheetNames[0]||'')}}

  function personIds(person){return uniq([person?.staffNumber,person?.personNumber,person?.oraclePersonNumber,person?.externalIds?.oraclePersonNumber].map(v=>String(v??'').trim()))}
  function projectIds(demand){const arrays=[demand?.projectNumbers,demand?.projectCodes].flatMap(x=>Array.isArray(x)?x:[]);return uniq([demand?.projectNumber,demand?.costCentreOrProjectCode,...arrays].map(v=>String(v??'').trim()))}
  function buildScope(team=[],demand=[]){
    const personByNumber=new Map(),personByName=new Map(),projectByNumber=new Map();
    for(const p of team){for(const id of personIds(p))personByNumber.set(norm(id),p);if(p?.name)personByName.set(norm(p.name),p)}
    for(const d of demand)for(const id of projectIds(d))projectByNumber.set(norm(id),d);
    return{personByNumber,personByName,projectByNumber,teamCount:team.length,demandCount:demand.length}
  }
  function matchPerson(get,scope){const personNumber=String(get('Person #')??'').trim(),personName=String(get('Person Name')??'').trim();if(personNumber&&scope.personByNumber.has(norm(personNumber)))return{person:scope.personByNumber.get(norm(personNumber)),match:'staff-number'};if(personName&&scope.personByName.has(norm(personName)))return{person:scope.personByName.get(norm(personName)),match:'name'};return{person:null,match:null}}

  function worksheetAccessor(ws){
    const range=window.XLSX.utils.decode_range(ws['!ref']||'A1:A1'),cell=(r,c)=>{const entry=Array.isArray(ws)?ws[r]?.[c]:ws[window.XLSX.utils.encode_cell({r,c})];return entry?.v??null},index={};
    for(let c=range.s.c;c<=range.e.c;c++){const name=String(cell(range.s.r,c)??'').trim();if(name)index[name]=c}
    const missing=REQUIRED_COLUMNS.filter(name=>index[name]===undefined);if(missing.length)throw new Error(`Actuals worksheet is missing required columns: ${missing.join(', ')}`);
    return{range,index,get:(r,name)=>cell(r,index[name])}
  }

  function aggregateWorksheet(ws,{team=[],demand=[]}={}){
    const {range,get}=worksheetAccessor(ws),scope=buildScope(team,demand),facts=new Map(),months=new Set(),stats={sourceRows:0,includedRows:0,ignoredPeopleRows:0,invalidMonthRows:0,missingProjectRows:0,nameMatchedRows:0,unmatchedProjectRows:0,personlessProjectRows:0},people=new Set(),projects=new Set();let totalHours=0,totalCostGbp=0;
    for(let r=range.s.r+1;r<=range.e.r;r++){
      let populated=false;for(const name of REQUIRED_COLUMNS){const v=get(r,name);if(v!==null&&v!==''){populated=true;break}}if(!populated)continue;stats.sourceRows++;
      const month=normalizeMonth(get(r,'Month'));if(!month){stats.invalidMonthRows++;continue}const projectNumber=String(get(r,'Project Number')??'').trim();if(!projectNumber){stats.missingProjectRows++;continue}
      const rawPerson=String(get(r,'Person #')??'').trim(),rawName=String(get(r,'Person Name')??'').trim(),project=scope.projectByNumber.get(norm(projectNumber))||null;
      let person=null,personMatch=null;if(rawPerson||rawName){const matched=matchPerson(name=>get(r,name),scope);person=matched.person;personMatch=matched.match;if(!person){stats.ignoredPeopleRows++;continue}if(personMatch==='name')stats.nameMatchedRows++}else if(!project){stats.ignoredPeopleRows++;continue}else stats.personlessProjectRows++;
      if(person&&!project)stats.unmatchedProjectRows++;
      const personNumber=rawPerson||personIds(person)[0]||null,personName=rawName||person?.name||null,key=`${month}\u001f${projectNumber}\u001f${person?.id||personNumber||''}`;let fact=facts.get(key);
      if(!fact){fact={projectNumber,projectName:String(get(r,'Project Name')??'').trim(),portfolio:String(get(r,'Portfolio')??'').trim(),programme:String(get(r,'Programme')??'').trim()||null,personNumber,personName,teamMemberId:person?.id||null,demandId:project?.id||null,actualHours:0,actualCostGbp:0};facts.set(key,fact)}
      const cost=number(get(r,'Cost in GBP'));fact.actualCostGbp+=cost;totalCostGbp+=cost;if(String(get(r,'UOM')??'').trim().toLowerCase()==='hours'){const hours=number(get(r,'QUANTITY'));fact.actualHours+=hours;totalHours+=hours}months.add(month);people.add(person?.id||personNumber||'unattributed');projects.add(projectNumber);stats.includedRows++;
    }
    const byMonth=new Map();for(const [key,fact] of facts){const month=key.split('\u001f')[0],clean={...fact,actualHours:Number(fact.actualHours.toFixed(6)),actualCostGbp:Number(fact.actualCostGbp.toFixed(2))};if(!byMonth.has(month))byMonth.set(month,[]);byMonth.get(month).push(clean)}
    const periods=[...byMonth].sort(([a],[b])=>a.localeCompare(b)).map(([month,rows])=>({schemaVersion:FACT_SCHEMA_VERSION,month,facts:rows.sort((a,b)=>a.projectNumber.localeCompare(b.projectNumber)||String(a.personName||'').localeCompare(String(b.personName||'')))})),sortedMonths=[...months].sort();
    return{periods,months:sortedMonths,firstMonth:sortedMonths[0]||null,latestMonth:sortedMonths.at(-1)||null,factRows:[...byMonth.values()].reduce((n,x)=>n+x.length,0),people:people.size,projects:projects.size,totalHours:Number(totalHours.toFixed(6)),totalCostGbp:Number(totalCostGbp.toFixed(2)),stats}
  }
  function analyzeWorkbook(workbook,worksheetName,scope){if(!worksheetName)throw new Error('Choose a worksheet to analyse.');const ws=workbook?.Sheets?.[worksheetName];if(!ws)throw new Error(`Worksheet "${worksheetName}" was not found.`);return aggregateWorksheet(ws,scope)}
  function aggregateRows(rows,scope={}){const header=(rows[0]||[]).map(v=>String(v??'').trim()),index=Object.fromEntries(header.map((v,i)=>[v,i])),missing=REQUIRED_COLUMNS.filter(c=>index[c]===undefined);if(missing.length)throw new Error(`Actuals worksheet is missing required columns: ${missing.join(', ')}`);const fake={'!ref':`A1:${String.fromCharCode(64+Math.min(26,header.length))}${rows.length}`};rows.forEach((row,r)=>row.forEach((v,c)=>{fake[window.XLSX?window.XLSX.utils.encode_cell({r,c}):`${String.fromCharCode(65+c)}${r+1}`}]={v}}));if(window.XLSX)return aggregateWorksheet(fake,scope);throw new Error('Excel parser is required for row aggregation.')}

  async function storedSummary(){const repo=window.workspaceRepository;if(!repo?.listActualsPeriods)return{months:[],periods:[],manifest:null};const months=await repo.listActualsPeriods(),periods=await Promise.all(months.map(m=>repo.readActualsPeriod(m))),manifest=await repo.readActualsManifest();return{months,periods:periods.filter(Boolean),manifest}}
  function replacementPreview(analysis,existingMonths=[]){const incoming=analysis.months||[],replace=incoming.filter(m=>existingMonths.includes(m)),add=incoming.filter(m=>!existingMonths.includes(m));return{incoming,replace,add,firstMonth:incoming[0]||null,latestMonth:incoming.at(-1)||null,replaceFirst:replace[0]||null,replaceLatest:replace.at(-1)||null}}
  async function commitImport({analysis,fileName,worksheet}){const repo=window.workspaceRepository;if(!repo?.replaceActualsPeriods)throw new Error('The current workspace does not support Actuals imports.');const manifest={schemaVersion:FACT_SCHEMA_VERSION,source:{fileName,worksheet},import:{completedAt:new Date().toISOString(),sourceRows:analysis.stats.sourceRows,factRows:analysis.factRows,firstMonth:analysis.firstMonth,latestMonth:analysis.latestMonth,periods:analysis.months},totals:{hours:analysis.totalHours,costGbp:analysis.totalCostGbp},warnings:[analysis.stats.invalidMonthRows?`${analysis.stats.invalidMonthRows} source row(s) had an invalid Month and were ignored.`:'',analysis.stats.missingProjectRows?`${analysis.stats.missingProjectRows} source row(s) had no Project Number and were ignored.`:'',analysis.stats.ignoredPeopleRows?`${analysis.stats.ignoredPeopleRows} source row(s) were outside the current AMO People/project scope and were ignored.`:'',analysis.stats.nameMatchedRows?`${analysis.stats.nameMatchedRows} row(s) matched People by exact name because no Staff Number match was available.`:''].filter(Boolean)};await repo.replaceActualsPeriods(analysis.periods,manifest);window.dispatchEvent(new CustomEvent('amo:actuals-updated',{detail:{manifest}}));return manifest}
  async function clear(){const repo=window.workspaceRepository;if(!repo?.clearActuals)throw new Error('No workspace is open.');await repo.clearActuals();window.dispatchEvent(new CustomEvent('amo:actuals-updated',{detail:{manifest:null}}))}
  window.Actuals={DEFAULTS,REQUIRED_COLUMNS,FACT_SCHEMA_VERSION,settings,normalizeMonth,inspectWorkbook,buildScope,aggregateWorksheet,analyzeWorkbook,aggregateRows,storedSummary,replacementPreview,commitImport,clear};
})();
