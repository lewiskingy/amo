/* External process links, Demand link editing, backup inventory and README UX. */
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

/* ----- Demand register: compact links in View, split URL/title fields in Edit ----- */
const baseDemandColumns=[
  {key:'id',label:'Demand ID',type:'text',editable:false},{key:'businessArea',label:'Business Area *',type:'select',values:()=>db.settings.businessAreas||[],editable:true},{key:'initiative',label:'Initiative',type:'select',editable:true},{key:'title',label:'Title *',type:'text',editable:true},{key:'costCentreOrProjectCode',label:'Cost Centre / Project Code',type:'text',editable:true},{key:'priority',label:'Priority',type:'select',values:()=>db.settings.priorities||[],editable:true},{key:'service',label:'Service',type:'select',values:()=>db.settings.services||[],editable:true},{key:'status',label:'Status',type:'select',values:()=>db.settings.statuses||[],editable:true},{key:'workPackage.architectureOwner',label:'Owner',type:'select',values:()=>[{value:'',label:'Unallocated'},...db.team.map(t=>({value:t.id,label:t.name}))],editable:true}
];
const demandTailColumns=[{key:'triage.romDays',label:'ROM Days',type:'number',editable:true},{key:'workPackage.targetStart',label:'Start',type:'date',editable:true},{key:'workPackage.targetEnd',label:'End',type:'date',editable:true},{key:'health',label:'Health',type:'select',values:()=>db.settings.healthStates||[],editable:true}];
function integratedDemandCols(){return gridState.demand.editing?[...baseDemandColumns,{key:'source.url',label:'Source URL',type:'url',editable:true},{key:'source.title',label:'Source Title',type:'text',editable:true},{key:'azureDevOps.url',label:'Work URL',type:'url',editable:true},{key:'azureDevOps.title',label:'Work Title',type:'text',editable:true},...demandTailColumns]:[...baseDemandColumns,{key:'_source',label:'Source Demand',type:'text',editable:false},{key:'_work',label:'Work Item',type:'text',editable:false},...demandTailColumns]}
function integratedDemandValue(row,col){if(col.key==='_source')return row.source?.title||linkFallback(row.source?.url||'','source')||'';if(col.key==='_work')return row.azureDevOps?.title||linkFallback(row.azureDevOps?.url||'','ado')||'';if(col.key==='workPackage.architectureOwner')return ownerName(row);return getPath(row,col.key)??''}
function integratedDemandCell(row,col){
  if(gridState.demand.editing){
    if(col.key==='initiative'){const opts=[{value:'',label:'—'},...initiativesForBusinessArea(row.businessArea).map(i=>({value:i.name,label:i.name}))];return `<select class="cell-input" data-edit-key="${col.key}" data-row-id="${row.id}">${opts.map(o=>`<option value="${escHtml(o.value)}" ${String(o.value)===String(row.initiative||'')?'selected':''}>${escHtml(o.label)}</option>`).join('')}</select>`}
    if(col.type==='select'){const opts=normalizeOptions(col),v=String(getPath(row,col.key)??'');return `<select class="cell-input" data-edit-key="${col.key}" data-row-id="${row.id}">${opts.map(o=>`<option value="${escHtml(o.value)}" ${String(o.value)===v?'selected':''}>${escHtml(o.label)}</option>`).join('')}</select>`}
    if(!col.editable)return `<span class="nowrap">${escHtml(integratedDemandValue(row,col))}</span>`;
    const v=getPath(row,col.key)??'',type=col.type==='number'?'number':col.type==='date'?'date':col.type==='url'?'url':'text';return `<input class="cell-input" type="${type}" value="${escHtml(v)}" data-edit-key="${col.key}" data-row-id="${row.id}">`;
  }
  if(col.key==='title')return row.source?.url?`<a href="${escHtml(row.source.url)}" target="_blank" rel="noopener noreferrer"><strong>${escHtml(row.title)}</strong></a>`:`<strong>${escHtml(row.title)}</strong>`;
  if(col.key==='_source')return integrationLink(row.source?.url,row.source?.title,'source');
  if(col.key==='_work')return integrationLink(row.azureDevOps?.url,row.azureDevOps?.title,'ado');
  return escHtml(integratedDemandValue(row,col));
}
function integratedDemandFilter(col){const value=gridState.demand.filters[col.key]||'',fk=`demand:${col.key}`;if(col.type==='select'){let options;if(col.key==='initiative')options=[...new Set(normalizeInitiatives(db.settings.initiatives||[]).map(i=>i.name))];else options=normalizeOptions(col).map(x=>x.label);return `<select data-filter-key="${fk}" data-grid="demand" data-key="${col.key}"><option value="">All</option>${options.map(v=>`<option value="${escHtml(v)}" ${String(value)===String(v)?'selected':''}>${escHtml(v)}</option>`).join('')}</select>`}return `<input data-filter-key="${fk}" data-grid="demand" data-key="${col.key}" value="${escHtml(value)}" placeholder="contains…">`}
function renderIntegratedDemandGrid(){
  const focus=rememberFocus(),s=gridState.demand,cols=integratedDemandCols(),source=s.editing?s.draft:db.demand;
  let rows=source.filter(r=>(!s.editing||!s.deleted.has(r.id))&&cols.every(c=>{const f=String(s.filters[c.key]||'').toLowerCase();return!f||String(integratedDemandValue(r,c)).toLowerCase().includes(f)}));
  if(s.sort){const c=cols.find(x=>x.key===s.sort);if(c){rows=[...rows].sort((a,b)=>String(integratedDemandValue(a,c)).localeCompare(String(integratedDemandValue(b,c)),undefined,{numeric:true,sensitivity:'base'}));if(s.direction==='desc')rows.reverse()}}
  const table=$('demandTable'),count=$('demandCount'),toolbar=$('demandToolbar');toolbar.innerHTML=s.editing?'<button class="btn primary" data-grid-new>New Demand</button><button class="btn success" data-grid-save>Save Changes</button><button class="btn" data-grid-cancel>Cancel</button><button class="btn" data-grid-clear>Clear Filters</button>':`<button class="btn primary" data-grid-new ${workspaceHandle?'':'disabled'}>New Demand</button><button class="btn" data-grid-edit ${workspaceHandle?'':'disabled'}>Edit List</button><button class="btn" data-grid-clear>Clear Filters</button>`;
  count.textContent=workspaceHandle?`Showing ${rows.length} of ${source.length-(s.editing?s.deleted.size:0)} records`:'No workspace loaded';
  table.innerHTML=`<thead><tr>${cols.map(c=>`<th><button class="sort-btn" data-sort="${c.key}">${c.label}${sortMark('demand',c.key)}</button></th>`).join('')}${s.editing?'<th>Delete</th>':''}</tr><tr class="filter-row">${cols.map(c=>`<th>${integratedDemandFilter(c)}</th>`).join('')}${s.editing?'<th></th>':''}</tr></thead><tbody>${rows.map(r=>`<tr data-row="${r.id}" class="${dirtyRecords.demand.has(r.id)?'row-dirty':''}">${cols.map(c=>`<td>${integratedDemandCell(r,c)}</td>`).join('')}${s.editing?`<td><button class="btn danger" data-grid-delete="${r.id}">Delete</button></td>`:''}</tr>`).join('')}</tbody>`;
  table.querySelectorAll('[data-sort]').forEach(b=>b.onclick=()=>toggleSort('demand',b.dataset.sort));table.querySelectorAll('[data-filter-key]').forEach(el=>{el.oninput=e=>scheduleFilter('demand',e.target.dataset.key,e.target.value);el.onchange=e=>{s.filters[e.target.dataset.key]=e.target.value;renderGrid('demand')}});table.querySelectorAll('tbody tr[data-row]').forEach(tr=>tr.ondblclick=e=>{if(!e.target.closest('button,input,select,textarea,a'))openRecordModal('demand',tr.dataset.row,'view')});
  toolbar.querySelector('[data-grid-new]')?.addEventListener('click',()=>openRecordModal('demand',null,'edit'));toolbar.querySelector('[data-grid-edit]')?.addEventListener('click',()=>{s.editing=true;s.draft=clone(db.demand);s.deleted=new Set();renderGrid('demand')});toolbar.querySelector('[data-grid-cancel]')?.addEventListener('click',()=>{s.editing=false;s.draft=null;s.deleted=new Set();renderGrid('demand')});toolbar.querySelector('[data-grid-clear]')?.addEventListener('click',()=>{s.filters={};renderGrid('demand')});toolbar.querySelector('[data-grid-save]')?.addEventListener('click',()=>saveGrid('demand'));
  if(s.editing){table.querySelectorAll('[data-edit-key]').forEach(el=>{el.onchange=e=>{const r=s.draft.find(x=>x.id===e.target.dataset.rowId),key=e.target.dataset.editKey,col=cols.find(c=>c.key===key);let v=e.target.value;if(col?.type==='number')v=v===''?null:Number(v);setPath(r,key,v);if(key==='businessArea'&&r.initiative&&!initiativesForBusinessArea(v).some(i=>i.name===r.initiative)){r.initiative='';renderGrid('demand')}};if(el.dataset.editKey==='source.url')el.onblur=async e=>{const r=s.draft.find(x=>x.id===e.target.dataset.rowId);setPath(r,'source.url',e.target.value);await populateSourceTitleIfBlank(r,()=>renderGrid('demand'))}});table.querySelectorAll('[data-grid-delete]').forEach(b=>b.onclick=()=>{s.deleted.add(b.dataset.gridDelete);renderGrid('demand')})}
  restoreFocus(focus);
}
const baseRenderGridIntegration=renderGrid;renderGrid=function(name){return name==='demand'?renderIntegratedDemandGrid():baseRenderGridIntegration(name)};

/* Modal: best-effort source title lookup after URL blur. */
const baseRenderRecordModalIntegration=renderRecordModal;renderRecordModal=function(){baseRenderRecordModalIntegration();if(recordModalState.type==='demand'&&recordModalState.mode==='edit'){const urlEl=$('recordModalBody').querySelector('[data-modal-field="source.url"]'),titleEl=$('recordModalBody').querySelector('[data-modal-field="source.title"]');if(urlEl)urlEl.addEventListener('blur',async()=>{if(titleEl?.value.trim()||!urlEl.value.trim())return;const title=await fetchRemotePageTitle(urlEl.value.trim());if(title&&titleEl){titleEl.value=title;recordModalState.draft=readModalDraft()}})}};

/* ----- Allocation / Resource Plan / Roadmap Work Item links ----- */
function demandWorkHtml(d){return d?integrationLink(d.azureDevOps?.url,d.azureDevOps?.title,'ado'):'<span class="muted">—</span>'}
function enhanceAllocationWorkColumn(){const table=$('allocationTable');if(!table?.tHead)return;const rows=[...table.tHead.rows];rows[0]?.insertCell(1).replaceChildren(document.createTextNode('Work'));rows[1]?.insertCell(1);[...table.tBodies[0]?.rows||[]].forEach(tr=>{const d=demandById(tr.dataset.demand),cell=tr.insertCell(1);cell.innerHTML=demandWorkHtml(d)})}
const baseRenderAllocationsIntegration=renderAllocations;renderAllocations=function(){baseRenderAllocationsIntegration();enhanceAllocationWorkColumn()};
function enhanceResourceWorkColumn(){const table=$('resourceAllocationDetail');if(!table?.tHead)return;table.tHead.rows[0]?.insertCell(1).replaceChildren(document.createTextNode('Work'));const allocRows=[...db.allocations].sort((a,b)=>`${a.demandId}|${person(a.teamMemberId)?.name||a.teamMemberId}`.localeCompare(`${b.demandId}|${person(b.teamMemberId)?.name||b.teamMemberId}`));[...table.tBodies[0]?.rows||[]].forEach((tr,i)=>{const cell=tr.insertCell(1);cell.innerHTML=demandWorkHtml(demandById(allocRows[i]?.demandId))})}
const baseRenderResourceIntegration=renderResource;renderResource=function(){baseRenderResourceIntegration();enhanceResourceWorkColumn()};
function enhanceRoadmapWorkLinks(){document.querySelectorAll('[data-roadmap-track]').forEach(track=>{const d=demandById(track.dataset.roadmapTrack),strong=track.closest('.road-row')?.querySelector('strong');if(!strong||!d?.azureDevOps?.url||strong.closest('a'))return;const a=document.createElement('a');a.href=d.azureDevOps.url;a.target='_blank';a.rel='noopener noreferrer';a.title=d.azureDevOps.title||linkFallback(d.azureDevOps.url,'ado');strong.parentNode.insertBefore(a,strong);a.appendChild(strong)})}
const baseRenderRoadmapIntegration=renderRoadmap;renderRoadmap=function(){baseRenderRoadmapIntegration();enhanceRoadmapWorkLinks()};

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
