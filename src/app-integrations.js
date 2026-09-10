/* External process links, Demand source editing, backup inventory and README UX. */
function integrationLink(url,title,kind){if(!url)return '<span class="muted">—</span>';return `<a href="${escHtml(url)}" target="_blank" rel="noopener noreferrer">${escHtml(title||linkFallback(url,kind))}</a>`}
async function fetchRemotePageTitle(url){
  if(!validHttpUrl(url)||!url)return'';
  try{
    const response=await fetch(url,{method:'GET',mode:'cors',credentials:'include',redirect:'follow',headers:{Accept:'text/html,application/xhtml+xml'}});
    if(!response.ok)throw new Error(`HTTP ${response.status}`);
    const html=await response.text(),doc=new DOMParser().parseFromString(html,'text/html');
    const value=doc.querySelector('meta[property="og:title"]')?.content||doc.querySelector('meta[name="twitter:title"]')?.content||doc.querySelector('h1')?.textContent||doc.title||'';
    return value.trim();
  }catch(e){log(`Could not read page metadata for ${url}. Browser CORS/authentication may block cross-origin metadata lookup.`);return''}
}
async function populateSourceTitleIfBlank(record,onDone){
  const url=record?.source?.url||'';
  if(!url||String(record?.source?.title||'').trim())return;
  const title=await fetchRemotePageTitle(url);if(!title)return;
  record.source=record.source||{};record.source.title=title;onDone?.(title);
}

/* ----- Demand register: source provenance only -----
   app-2.js remains the one Demand renderer. This module contributes columns/decorators through
   AmoDemandGrid and never replaces renderGrid. */
const INTEGRATION_DEMAND_TAIL_KEYS=new Set(['health']);
const INTEGRATION_SOURCE_KEYS=new Set(['_source','source.url','source.title']);
function sourceDemandColumns(editing,columns=demandCols){
  const canonical=[...columns].filter(c=>!INTEGRATION_SOURCE_KEYS.has(c.key));
  const base=canonical.filter(c=>!INTEGRATION_DEMAND_TAIL_KEYS.has(c.key));
  const tail=canonical.filter(c=>INTEGRATION_DEMAND_TAIL_KEYS.has(c.key));
  return editing
    ?[...base,{key:'source.url',label:'Source URL',type:'url',editable:true},{key:'source.title',label:'Source Title',type:'text',editable:true},...tail]
    :[...base,{key:'_source',label:'Source Demand',type:'text',editable:false,derived:true},...tail]
}
function installDemandColumns(){
  const previous=[...demandCols];
  demandCols.splice(0,demandCols.length,...sourceDemandColumns(!!gridState.demand.editing,previous));
  return()=>demandCols.splice(0,demandCols.length,...previous)
}

const baseDisplayValIntegration=displayVal;
displayVal=function(row,col){if(col?.key==='_source')return row.source?.title||linkFallback(row.source?.url||'','source')||'';return baseDisplayValIntegration(row,col)};
const baseEditControlIntegration=editControl;
editControl=function(row,col){if(col?.key==='source.url'){const v=getPath(row,col.key)??'';return `<input class="cell-input" type="url" value="${escHtml(v)}" data-edit-key="${col.key}" data-row-id="${row.id}">`}return baseEditControlIntegration(row,col)};

function decorateDemandSourceCells(table,rows){
  if(!table||gridState.demand.editing)return;
  const sourceIndex=demandCols.findIndex(c=>c.key==='_source');if(sourceIndex<0)return;
  for(const tr of table.tBodies?.[0]?.querySelectorAll('tr[data-row]')||[]){
    const row=rows.find(r=>String(r.id)===String(tr.dataset.row));if(!row||!tr.cells?.[sourceIndex])continue;
    tr.cells[sourceIndex].innerHTML=integrationLink(row.source?.url,row.source?.title,'source')
  }
}
function bindDemandSourceTitleLookup(table){
  if(!table||!gridState.demand.editing)return;
  table.querySelectorAll('[data-edit-key="source.url"]').forEach(el=>el.addEventListener('blur',async e=>{
    const row=gridState.demand.draft?.find(x=>String(x.id)===String(e.target.dataset.rowId));if(!row)return;
    setPath(row,'source.url',e.target.value);
    await populateSourceTitleIfBlank(row,()=>renderGrid('demand'))
  }))
}
const demandSourceContribution={
  id:'demand-source-provenance',priority:10,
  beforeRender:()=>installDemandColumns(),
  afterRender:({table,rows})=>{decorateDemandSourceCells(table,rows);bindDemandSourceTitleLookup(table)}
};
if(window.AmoDemandGrid?.register)window.AmoDemandGrid.register(demandSourceContribution);else(window.AmoDemandGridPending=window.AmoDemandGridPending||[]).push(demandSourceContribution);

/* Modal: best-effort source title lookup after URL blur. */
const baseRenderRecordModalIntegration=renderRecordModal;renderRecordModal=function(){baseRenderRecordModalIntegration();if(recordModalState.type==='demand'&&recordModalState.mode==='edit'){const urlEl=$('recordModalBody').querySelector('[data-modal-field="source.url"]'),titleEl=$('recordModalBody').querySelector('[data-modal-field="source.title"]');if(urlEl)urlEl.addEventListener('blur',async()=>{if(titleEl?.value.trim()||!urlEl.value.trim())return;const title=await fetchRemotePageTitle(urlEl.value.trim());if(title&&titleEl){titleEl.value=title;recordModalState.draft=readModalDraft()}})}};

/* ----- Workspace backup inventory ----- */
let retainedBackupInventory=[];
async function refreshBackupInventory(root=workspaceHandle){retainedBackupInventory=[];if(root){try{const dir=await root.getDirectoryHandle(BACKUP_ROOT);for await(const [name,h] of dir.entries()){if(h.kind==='directory'&&parseBackupTimestamp(name))retainedBackupInventory.push({name,date:parseBackupTimestamp(name)})}}catch(e){if(e.name!=='NotFoundError')log(`Could not list backups: ${e.message}`)}}retainedBackupInventory.sort((a,b)=>b.date-a.date);renderBackupInventory()}
function ensureBackupInventoryCard(){const section=$('data');if(!section||$('backupInventory'))return;const card=document.createElement('div');card.className='card';card.style.marginTop='16px';card.innerHTML='<div class="section-title" style="margin-top:0"><h2>Retained Backups</h2><button class="btn" id="refreshBackups">Refresh</button></div><div id="backupInventory"></div>';section.insertBefore(card,section.querySelector('.card:nth-last-child(1)'));$('refreshBackups').onclick=()=>refreshBackupInventory()}
function renderBackupInventory(){ensureBackupInventoryCard();const el=$('backupInventory');if(!el)return;if(!workspaceHandle){el.innerHTML='<span class="muted">Open a workspace to list backups.</span>';return}el.innerHTML=retainedBackupInventory.length?`<div class="table-wrap"><table><thead><tr><th>Backup Folder</th><th>Created</th></tr></thead><tbody>${retainedBackupInventory.map(b=>`<tr><td><code>${escHtml(BACKUP_ROOT+'/'+b.name)}</code></td><td>${escHtml(b.date.toLocaleString())}</td></tr>`).join('')}</tbody></table></div>`:'<span class="muted">No retained backups found.</span>'}
const baseBackupOpenIntegration=backupWorkspaceOnOpen;backupWorkspaceOnOpen=async function(root){await baseBackupOpenIntegration(root);await refreshBackupInventory(root)};

/* ----- README tab ----- */
function ensureReadmeTab(){if($('readme'))return;const nav=document.querySelector('.sidebar nav'),workspaceBtn=nav?.querySelector('[data-view="data"]');const btn=document.createElement('button');btn.className='nav-btn';btn.dataset.view='readme';btn.innerHTML='<span class="nav-dot"></span>README';nav.insertBefore(btn,workspaceBtn);const section=document.createElement('section');section.id='readme';section.className='view';section.innerHTML='<div class="hero"><div><h1>README</h1><p>Application usage and operating notes from <code>src/docs/README.md</code>.</p></div></div><div class="card"><pre id="readmeContent" style="white-space:pre-wrap;word-break:break-word;margin:0"></pre></div>';document.querySelector('.content').appendChild(section);btn.onclick=()=>switchView('readme')}
let readmeLoaded=false;async function loadReadme(){ensureReadmeTab();if(readmeLoaded)return;const el=$('readmeContent');try{const r=await fetch('docs/README.md',{cache:'no-store'});if(!r.ok)throw new Error(`HTTP ${r.status}`);el.textContent=await r.text();readmeLoaded=true}catch(e){el.textContent='README.md could not be loaded. If the application is opened directly with file://, the browser may block local fetch requests. Serve src/ over HTTP to enable this tab.\n\n'+e.message}}
const baseSwitchViewIntegration=switchView;switchView=function(id){baseSwitchViewIntegration(id);if(id==='data')refreshBackupInventory();if(id==='readme'){document.getElementById('pageTitle').textContent='README';loadReadme()}};

ensureBackupInventoryCard();ensureReadmeTab();
/* Rebind in case earlier modules wrapped these functions after the original handlers were attached. */
$('openWorkspaceBtn').onclick=openWorkspace;
refreshAll();