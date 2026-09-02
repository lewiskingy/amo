(function initActuals(){
  const DEFAULTS={enabled:false,periodFolderPrefix:'Period ',filePrefix:'Oracle YTD Actuals ',fileExtension:'.xlsx',worksheet:'YTD Oracle Download'};
  const REQUIRED_COLUMNS=['Portfolio','Programme','Project Name','Project Number','Month','Person #','Person Name','UOM','QUANTITY','Cost in GBP'];
  const FACT_SCHEMA_VERSION=1;
  let actualsFolderHandle=null;

  function settings(){return{...DEFAULTS,...(window.db?.settings?.actualsImport||{})}}
  function normalizeMonth(value){
    const text=String(value??'').trim();const m=text.match(/^(\d{4})[\/-](\d{1,2})$/);if(!m)return'';return`${m[1]}-${String(Number(m[2])).padStart(2,'0')}`
  }
  function number(value){if(value===null||value===undefined||value==='')return 0;const n=Number(String(value).replace(/,/g,''));return Number.isFinite(n)?n:0}
  function escRegex(value){return String(value).replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}
  function parseDateFromName(name,prefix,extension){
    const rx=new RegExp(`^${escRegex(prefix)}(\\d{2})-(\\d{2})-(\\d{4})${escRegex(extension)}$`,'i'),m=String(name).match(rx);if(!m)return null;
    const [_,dd,mm,yyyy]=m,date=new Date(Date.UTC(Number(yyyy),Number(mm)-1,Number(dd)));if(date.getUTCFullYear()!==Number(yyyy)||date.getUTCMonth()!==Number(mm)-1||date.getUTCDate()!==Number(dd))return null;return{date,name,iso:`${yyyy}-${mm}-${dd}`}
  }
  async function discoverLatestSource(folderHandle,config=settings()){
    if(!folderHandle)throw new Error('Choose an Actuals folder first.');
    const periodRx=new RegExp(`^${escRegex(config.periodFolderPrefix)}(\\d+)$`,'i'),periodFolders=[];
    for await(const [name,handle] of folderHandle.entries()){if(handle.kind!=='directory')continue;const m=name.match(periodRx);if(m)periodFolders.push({name,handle,period:Number(m[1])})}
    if(!periodFolders.length)throw new Error(`No folders matching ${config.periodFolderPrefix}# were found.`);
    periodFolders.sort((a,b)=>b.period-a.period);const latest=periodFolders[0],files=[];
    for await(const [name,handle] of latest.handle.entries()){if(handle.kind!=='file')continue;const parsed=parseDateFromName(name,config.filePrefix,config.fileExtension);if(parsed)files.push({...parsed,handle})}
    if(!files.length)throw new Error(`No ${config.filePrefix}dd-mm-yyyy${config.fileExtension} file was found in ${latest.name}.`);
    files.sort((a,b)=>b.date-a.date);const selected=files[0],file=await selected.handle.getFile();
    return{period:latest.period,periodFolder:latest.name,fileName:selected.name,fileDate:selected.iso,lastModified:file.lastModified,size:file.size,file,warning:files.length>1?`${latest.name} contains ${files.length} matching Actuals files; the latest dated file was selected.`:''}
  }
  function workbookRows(arrayBuffer,worksheetName){
    if(!window.XLSX)throw new Error('Excel parser is not available.');const wb=window.XLSX.read(arrayBuffer,{type:'array',cellDates:false,dense:true});
    const ws=wb.Sheets[worksheetName];if(!ws)throw new Error(`Worksheet "${worksheetName}" was not found.`);
    const rows=window.XLSX.utils.sheet_to_json(ws,{header:1,raw:true,defval:null,blankrows:false});if(!rows.length)throw new Error('Actuals worksheet is empty.');return rows
  }
  function aggregateRows(rows){
    const header=rows[0].map(v=>String(v??'').trim()),index=Object.fromEntries(header.map((v,i)=>[v,i]));const missing=REQUIRED_COLUMNS.filter(c=>index[c]===undefined);if(missing.length)throw new Error(`Actuals worksheet is missing required columns: ${missing.join(', ')}`);
    const facts=new Map(),months=new Set();let sourceRows=0,totalHours=0,totalCostGbp=0;
    for(let r=1;r<rows.length;r++){
      const row=rows[r];if(!row||row.every(v=>v===null||v===''))continue;sourceRows++;
      const month=normalizeMonth(row[index.Month]);if(!month)continue;const projectNumber=String(row[index['Project Number']]??'').trim();if(!projectNumber)continue;
      const rawPerson=row[index['Person #']],personNumber=rawPerson===null||rawPerson===undefined||String(rawPerson).trim()===''?null:String(rawPerson).trim();
      const key=`${month}\u001f${projectNumber}\u001f${personNumber??''}`;let fact=facts.get(key);
      if(!fact){fact={month,portfolio:String(row[index.Portfolio]??'').trim(),programme:String(row[index.Programme]??'').trim()||null,projectNumber,projectName:String(row[index['Project Name']]??'').trim(),personNumber,personName:String(row[index['Person Name']]??'').trim()||null,actualHours:0,actualCostGbp:0};facts.set(key,fact)}
      const cost=number(row[index['Cost in GBP']]);fact.actualCostGbp+=cost;totalCostGbp+=cost;
      if(String(row[index.UOM]??'').trim().toLowerCase()==='hours'){const hours=number(row[index.QUANTITY]);fact.actualHours+=hours;totalHours+=hours}
      months.add(month)
    }
    const list=[...facts.values()].map(f=>({...f,actualHours:Number(f.actualHours.toFixed(6)),actualCostGbp:Number(f.actualCostGbp.toFixed(2))})).sort((a,b)=>a.month.localeCompare(b.month)||a.projectNumber.localeCompare(b.projectNumber)||String(a.personNumber??'').localeCompare(String(b.personNumber??'')));
    const sortedMonths=[...months].sort();return{facts:list,sourceRows,totalHours:Number(totalHours.toFixed(6)),totalCostGbp:Number(totalCostGbp.toFixed(2)),firstMonth:sortedMonths[0]||null,latestMonth:sortedMonths.at(-1)||null}
  }
  async function readStored(){const repo=window.workspaceRepository;if(!repo?.readActuals)return{factsDocument:null,manifest:null};return{factsDocument:await repo.readActuals(),manifest:await repo.readActualsManifest()}}
  async function refresh({force=false}={}){
    const repo=window.workspaceRepository;if(repo?.mode!=='local')throw new Error('Actuals import is currently available for Local Workspaces only.');
    const config=settings();if(!config.enabled&&!force)throw new Error('Actuals import is disabled in Settings.');const source=await discoverLatestSource(actualsFolderHandle,config),existing=await repo.readActualsManifest();
    if(!force&&existing?.source&&existing.source.period===source.period&&existing.source.fileName===source.fileName&&existing.source.lastModified===source.lastModified&&existing.source.size===source.size)return{changed:false,manifest:existing};
    const rows=workbookRows(await source.file.arrayBuffer(),config.worksheet),agg=aggregateRows(rows),completedAt=new Date().toISOString();
    const factsDocument={schemaVersion:FACT_SCHEMA_VERSION,facts:agg.facts};const warnings=[source.warning].filter(Boolean);const manifest={schemaVersion:FACT_SCHEMA_VERSION,source:{period:source.period,periodFolder:source.periodFolder,fileName:source.fileName,fileDate:source.fileDate,worksheet:config.worksheet,lastModified:source.lastModified,size:source.size},import:{completedAt,sourceRows:agg.sourceRows,factRows:agg.facts.length,firstMonth:agg.firstMonth,latestMonth:agg.latestMonth},totals:{hours:agg.totalHours,costGbp:agg.totalCostGbp},warnings};
    await repo.saveActualsSnapshot(factsDocument,manifest);window.dispatchEvent(new CustomEvent('amo:actuals-updated',{detail:{manifest}}));return{changed:true,manifest,factsDocument}
  }
  async function clear(){const repo=window.workspaceRepository;if(!repo?.clearActuals)throw new Error('No workspace is open.');await repo.clearActuals();window.dispatchEvent(new CustomEvent('amo:actuals-updated',{detail:{manifest:null}}))}
  async function chooseFolder(){if(!window.showDirectoryPicker)throw new Error('This browser does not support local folder access.');actualsFolderHandle=await window.showDirectoryPicker({mode:'read'});window.dispatchEvent(new CustomEvent('amo:actuals-source-changed',{detail:{name:actualsFolderHandle.name}}));return actualsFolderHandle}
  function sourceName(){return actualsFolderHandle?.name||''}
  window.Actuals={DEFAULTS,REQUIRED_COLUMNS,settings,normalizeMonth,parseDateFromName,aggregateRows,discoverLatestSource,readStored,refresh,clear,chooseFolder,sourceName,setFolderHandle:handle=>{actualsFolderHandle=handle}};
})();
