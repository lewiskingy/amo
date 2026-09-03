(function initActuals(){
  const DEFAULTS={worksheet:'YTD Oracle Download'};
  /* Canonical import fields are deliberately independent of Oracle display labels. Oracle exports
     have used both "People #" and "Person #" for the workforce identifier. AMO always maps that
     source value to Person.staffNumber and stores it as fact.staffNumber. */
  const COLUMN_ALIASES={
    'Portfolio':['Portfolio'],
    'Programme':['Programme'],
    'Project Name':['Project Name'],
    'Project Number':['Project Number'],
    'Month':['Month'],
    'Staff Number':['People #','Person #'],
    'Person Name':['Person Name','People Name'],
    'UOM':['UOM'],
    'QUANTITY':['QUANTITY'],
    'Cost in GBP':['Cost in GBP']
  };
  const REQUIRED_COLUMNS=Object.keys(COLUMN_ALIASES);
  const FACT_SCHEMA_VERSION=1;

  function settings(){return{...DEFAULTS,...((typeof db!=='undefined'&&db.settings?.actualsImport)||{})}}
  function normalizeMonth(value){const text=String(value??'').trim(),m=text.match(/^(\d{4})[\/-](\d{1,2})(?:[\/-]\d{1,2})?$/);if(!m)return'';return`${m[1]}-${String(Number(m[2])).padStart(2,'0')}`}
  function number(value){if(value===null||value===undefined||value==='')return 0;const n=Number(String(value).replace(/,/g,''));return Number.isFinite(n)?n:0}
  function norm(value){return String(value??'').trim().toLowerCase()}
  function uniq(values){return[...new Set(values.filter(Boolean))]}

  function workbookFrom(arrayBuffer){if(!window.XLSX)throw new Error('Excel parser is not available. Check the application can load its XLSX dependency.');return window.XLSX.read(arrayBuffer,{type:'array',cellDates:false,dense:true})}
  function inspectWorkbook(arrayBuffer){const workbook=workbookFrom(arrayBuffer);return{workbook,sheets:[...workbook.SheetNames],preferredWorksheet:workbook.SheetNames.includes(settings().worksheet)?settings().worksheet:(workbook.SheetNames[0]||'')}}

  function staffIds(person){return uniq([person?.staffNumber].map(v=>String(v??'').trim()))}
  function projectNumber(demand){return String(demand?.projectNumber??'').trim()}
  function buildScope(team=[],demand=[]){
    const personByStaffNumber=new Map(),projectByNumber=new Map(),projectCandidates=new Map(),ambiguousProjectNumbers=new Set();
    for(const p of team)for(const id of staffIds(p))personByStaffNumber.set(norm(id),p);
    for(const d of demand){const id=projectNumber(d);if(!id)continue;const key=norm(id),rows=projectCandidates.get(key)||[];rows.push(d);projectCandidates.set(key,rows)}
    for(const [key,rows] of projectCandidates){if(rows.length===1)projectByNumber.set(key,rows[0]);else ambiguousProjectNumbers.add(key)}
    return{personByStaffNumber,projectByNumber,ambiguousProjectNumbers,teamCount:team.length,demandCount:demand.length}
  }
  function matchPerson(get,scope){const staffNumber=String(get('Staff Number')??'').trim();if(staffNumber&&scope.personByStaffNumber.has(norm(staffNumber)))return{person:scope.personByStaffNumber.get(norm(staffNumber)),match:'staff-number'};return{person:null,match:null}}

  function worksheetAccessor(ws){
    const range=window.XLSX.utils.decode_range(ws['!ref']||'A1:A1'),cell=(r,c)=>{const entry=Array.isArray(ws)?ws[r]?.[c]:ws[window.XLSX.utils.encode_cell({r,c})];return entry?.v??null},rawIndex={},index={},matchedHeaders={};
    for(let c=range.s.c;c<=range.e.c;c++){const name=String(cell(range.s.r,c)??'').trim();if(name)rawIndex[name]=c}
    for(const [logical,aliases] of Object.entries(COLUMN_ALIASES)){
      const matched=aliases.find(name=>rawIndex[name]!==undefined);
      if(matched){index[logical]=rawIndex[matched];matchedHeaders[logical]=matched}
    }
    const missing=REQUIRED_COLUMNS.filter(name=>index[name]===undefined);if(missing.length){const labels=missing.map(name=>COLUMN_ALIASES[name].join(' / '));throw new Error(`Actuals worksheet is missing required columns: ${labels.join(', ')}`)}
    return{range,index,matchedHeaders,get:(r,name)=>cell(r,index[name])}
  }

  function aggregateWorksheet(ws,{team=[],demand=[]}={}){
    const {range,get,matchedHeaders}=worksheetAccessor(ws),scope=buildScope(team,demand),facts=new Map(),months=new Set(),stats={sourceRows:0,includedRows:0,unmatchedStaffRows:0,outOfScopePersonlessRows:0,ignoredPeopleRows:0,invalidMonthRows:0,missingProjectRows:0,unmatchedProjectRows:0,ambiguousProjectRows:0,personlessProjectRows:0},people=new Set(),projects=new Set();let totalHours=0,totalCostGbp=0;
    for(let r=range.s.r+1;r<=range.e.r;r++){
      let populated=false;for(const name of REQUIRED_COLUMNS){const v=get(r,name);if(v!==null&&v!==''){populated=true;break}}if(!populated)continue;stats.sourceRows++;
      const month=normalizeMonth(get(r,'Month'));if(!month){stats.invalidMonthRows++;continue}const projectNumber=String(get(r,'Project Number')??'').trim();if(!projectNumber){stats.missingProjectRows++;continue}
      const rawStaffNumber=String(get(r,'Staff Number')??'').trim(),rawName=String(get(r,'Person Name')??'').trim(),projectKey=norm(projectNumber),project=scope.projectByNumber.get(projectKey)||null,projectAmbiguous=scope.ambiguousProjectNumbers.has(projectKey),knownProject=!!project||projectAmbiguous;
      let person=null;if(rawStaffNumber||rawName){person=matchPerson(name=>get(r,name),scope).person;if(!person){stats.unmatchedStaffRows++;continue}}else if(!knownProject){stats.outOfScopePersonlessRows++;continue}else stats.personlessProjectRows++;
      if(projectAmbiguous)stats.ambiguousProjectRows++;else if(person&&!project)stats.unmatchedProjectRows++;
      const staffNumber=rawStaffNumber||staffIds(person)[0]||null,personName=rawName||person?.name||null,key=`${month}\u001f${projectNumber}\u001f${person?.id||staffNumber||''}`;let fact=facts.get(key);
      if(!fact){fact={projectNumber,projectName:String(get(r,'Project Name')??'').trim(),portfolio:String(get(r,'Portfolio')??'').trim(),programme:String(get(r,'Programme')??'').trim()||null,staffNumber,personName,teamMemberId:person?.id||null,demandId:project?.id||null,actualHours:0,actualCostGbp:0};facts.set(key,fact)}
      const cost=number(get(r,'Cost in GBP'));fact.actualCostGbp+=cost;totalCostGbp+=cost;if(String(get(r,'UOM')??'').trim().toLowerCase()==='hours'){const hours=number(get(r,'QUANTITY'));fact.actualHours+=hours;totalHours+=hours}months.add(month);people.add(person?.id||staffNumber||'unattributed');projects.add(projectNumber);stats.includedRows++;
    }
    stats.ignoredPeopleRows=stats.unmatchedStaffRows+stats.outOfScopePersonlessRows;
    const byMonth=new Map();for(const [key,fact] of facts){const month=key.split('\u001f')[0],clean={...fact,actualHours:Number(fact.actualHours.toFixed(6)),actualCostGbp:Number(fact.actualCostGbp.toFixed(2))};if(!byMonth.has(month))byMonth.set(month,[]);byMonth.get(month).push(clean)}
    const periods=[...byMonth].sort(([a],[b])=>a.localeCompare(b)).map(([month,rows])=>({schemaVersion:FACT_SCHEMA_VERSION,month,facts:rows.sort((a,b)=>a.projectNumber.localeCompare(b.projectNumber)||String(a.personName||'').localeCompare(String(b.personName||'')))})),sortedMonths=[...months].sort();
    return{periods,months:sortedMonths,firstMonth:sortedMonths[0]||null,latestMonth:sortedMonths.at(-1)||null,factRows:[...byMonth.values()].reduce((n,x)=>n+x.length,0),people:people.size,projects:projects.size,totalHours:Number(totalHours.toFixed(6)),totalCostGbp:Number(totalCostGbp.toFixed(2)),stats,sourceHeaders:matchedHeaders}
  }
  function analyzeWorkbook(workbook,worksheetName,scope){if(!worksheetName)throw new Error('Choose a worksheet to analyse.');const ws=workbook?.Sheets?.[worksheetName];if(!ws)throw new Error(`Worksheet "${worksheetName}" was not found.`);return aggregateWorksheet(ws,scope)}

  async function storedSummary(){const repo=window.workspaceRepository;if(!repo?.listActualsPeriods)return{months:[],periods:[],manifest:null};const months=await repo.listActualsPeriods(),periods=await Promise.all(months.map(m=>repo.readActualsPeriod(m))),manifest=await repo.readActualsManifest();return{months,periods:periods.filter(Boolean),manifest}}
  function replacementPreview(analysis,existingMonths=[]){const incoming=analysis.months||[],replace=incoming.filter(m=>existingMonths.includes(m)),add=incoming.filter(m=>!existingMonths.includes(m));return{incoming,replace,add,firstMonth:incoming[0]||null,latestMonth:incoming.at(-1)||null,replaceFirst:replace[0]||null,replaceLatest:replace.at(-1)||null}}
  async function commitImport({analysis,fileName,worksheet}){const repo=window.workspaceRepository;if(!repo?.replaceActualsPeriods)throw new Error('The current workspace does not support Actuals imports.');const sourceColumn=analysis.sourceHeaders?.['Staff Number']||'People # / Person #',manifest={schemaVersion:FACT_SCHEMA_VERSION,source:{fileName,worksheet,staffNumberColumn:analysis.sourceHeaders?.['Staff Number']||null},import:{completedAt:new Date().toISOString(),sourceRows:analysis.stats.sourceRows,factRows:analysis.factRows,firstMonth:analysis.firstMonth,latestMonth:analysis.latestMonth,periods:analysis.months},totals:{hours:analysis.totalHours,costGbp:analysis.totalCostGbp},warnings:[analysis.stats.invalidMonthRows?`${analysis.stats.invalidMonthRows} source row(s) had an invalid Month and were ignored.`:'',analysis.stats.missingProjectRows?`${analysis.stats.missingProjectRows} source row(s) had no Project Number and were ignored.`:'',analysis.stats.unmatchedStaffRows?`${analysis.stats.unmatchedStaffRows} source row(s) had ${sourceColumn} values that did not match current AMO Staff Numbers and were ignored.`:'',analysis.stats.outOfScopePersonlessRows?`${analysis.stats.outOfScopePersonlessRows} personless source row(s) did not map to a current AMO Demand Project Number and were ignored as outside AMO scope.`:'',analysis.stats.unmatchedProjectRows?`${analysis.stats.unmatchedProjectRows} source row(s) matched current AMO People but their Project Number did not map to Demand; these rows were retained as unmapped Actuals.`:'',analysis.stats.ambiguousProjectRows?`${analysis.stats.ambiguousProjectRows} source row(s) used a Project Number assigned to more than one AMO Demand; these rows were retained without Demand attribution until the duplicate Project Number is resolved.`:''].filter(Boolean)};await repo.replaceActualsPeriods(analysis.periods,manifest);window.dispatchEvent(new CustomEvent('amo:actuals-updated',{detail:{manifest}}));return manifest}
  async function clear(){const repo=window.workspaceRepository;if(!repo?.clearActuals)throw new Error('No workspace is open.');await repo.clearActuals();window.dispatchEvent(new CustomEvent('amo:actuals-updated',{detail:{manifest:null}}))}
  window.Actuals={DEFAULTS,COLUMN_ALIASES,REQUIRED_COLUMNS,FACT_SCHEMA_VERSION,settings,normalizeMonth,inspectWorkbook,buildScope,aggregateWorksheet,analyzeWorkbook,storedSummary,replacementPreview,commitImport,clear};
})();
