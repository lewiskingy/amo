/* Canonical client edit-transaction registry and navigation guard.
   Surfaces own their draft/save/cancel behaviour; this module only coordinates navigation. */
(function initEditTransactions(){
  if(window.AmoEditTransactions)return;
  const transactions=new Map();
  let resolving=false,bypass=false;
  const clean=v=>String(v??'').trim();

  function register(id,contract){
    if(!clean(id)||!contract||typeof contract.isEditing!=='function')throw new Error('Edit transaction registration requires an id and isEditing().');
    transactions.set(id,{label:id,...contract});
    return()=>transactions.delete(id)
  }
  function active(){
    for(const [id,contract] of transactions){
      try{if(contract.isEditing()&&(contract.hasUnsavedChanges?.()??true))return{id,contract}}catch(_e){}
    }
    return null
  }
  function hasActive(){return !!active()}

  function ensureDialog(){
    let backdrop=document.getElementById('amoEditNavigationBackdrop');if(backdrop)return backdrop;
    const style=document.createElement('style');style.id='amo-edit-transaction-styles';style.textContent=`
      #amoEditNavigationBackdrop{position:fixed;inset:0;z-index:20000;background:rgba(15,23,42,.56);display:none;align-items:center;justify-content:center;padding:20px}
      #amoEditNavigationBackdrop.open{display:flex}#amoEditNavigationDialog{width:min(520px,100%);background:var(--surface,#fff);color:var(--text,#172033);border:1px solid var(--line,#d8dee9);border-radius:12px;box-shadow:0 20px 60px rgba(0,0,0,.28);padding:20px}
      #amoEditNavigationDialog h2{margin:0 0 8px}#amoEditNavigationDialog p{margin:0;color:var(--muted,#667085)}#amoEditNavigationActions{display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap;margin-top:20px}
    `;document.head.appendChild(style);
    backdrop=document.createElement('div');backdrop.id='amoEditNavigationBackdrop';backdrop.innerHTML='<div id="amoEditNavigationDialog" role="dialog" aria-modal="true" aria-labelledby="amoEditNavigationTitle"><h2 id="amoEditNavigationTitle">Unsaved changes</h2><p id="amoEditNavigationMessage"></p><div id="amoEditNavigationActions"><button class="btn" data-edit-nav-stay>Stay here</button><button class="btn danger" data-edit-nav-discard>Discard changes</button><button class="btn success" data-edit-nav-save>Save and leave</button></div></div>';document.body.appendChild(backdrop);return backdrop
  }
  function chooseResolution(label){
    const backdrop=ensureDialog(),message=backdrop.querySelector('#amoEditNavigationMessage');message.textContent=`${label} is currently being edited. Save or discard those changes before leaving this page.`;backdrop.classList.add('open');
    return new Promise(resolve=>{
      const finish=value=>{backdrop.classList.remove('open');save.onclick=discard.onclick=stay.onclick=null;resolve(value)},save=backdrop.querySelector('[data-edit-nav-save]'),discard=backdrop.querySelector('[data-edit-nav-discard]'),stay=backdrop.querySelector('[data-edit-nav-stay]');
      save.onclick=()=>finish('save');discard.onclick=()=>finish('discard');stay.onclick=()=>finish('stay');setTimeout(()=>save.focus(),0)
    })
  }
  async function resolveActive(){
    if(resolving)return false;const entry=active();if(!entry)return true;resolving=true;
    try{
      const choice=await chooseResolution(entry.contract.label||entry.id);if(choice==='stay')return false;
      if(choice==='discard'){
        await entry.contract.cancel?.();
        return !entry.contract.isEditing()
      }
      if(typeof entry.contract.save!=='function')return false;
      const result=await entry.contract.save();
      if(result===false||entry.contract.isEditing())return false;
      return true
    }catch(error){console.error('Could not resolve edit transaction before navigation.',error);return false}finally{resolving=false}
  }

  const baseSwitch=window.switchView;
  async function guardedSwitchView(id){
    if(typeof baseSwitch!=='function')return;
    const current=document.querySelector('section.view.active')?.id;if(current===id)return baseSwitch(id);
    if(!bypass&&hasActive()&&!await resolveActive())return false;
    bypass=true;try{const result=baseSwitch(id);window.dispatchEvent(new CustomEvent('amo-view-changed',{detail:{view:id}}));window.refreshAmoInformationArchitecture?.();return result}finally{bypass=false}
  }
  window.switchView=guardedSwitchView;

  /* Core legacy surfaces already expose canonical draft state and save/cancel functions. Register
     those owners directly rather than maintaining a separate dirty-state model. */
  register('people-list',{label:'People changes',isEditing:()=>typeof gridState!=='undefined'&&gridState.team?.editing===true,save:()=>{saveGrid?.('team');return gridState.team?.editing!==true},cancel:()=>{if(typeof gridState==='undefined')return;gridState.team.editing=false;gridState.team.draft=null;gridState.team.deleted=new Set();renderGrid?.('team')}});
  register('demand-list',{label:'Demand changes',isEditing:()=>typeof gridState!=='undefined'&&gridState.demand?.editing===true,save:()=>{saveGrid?.('demand');return gridState.demand?.editing!==true},cancel:()=>{if(typeof gridState==='undefined')return;gridState.demand.editing=false;gridState.demand.draft=null;gridState.demand.deleted=new Set();renderGrid?.('demand')}});
  register('allocations',{label:'Allocation changes',isEditing:()=>typeof allocationState!=='undefined'&&allocationState.editing===true,save:()=>{saveAllocations?.();return allocationState.editing!==true},cancel:()=>{if(typeof allocationState==='undefined')return;allocationState.editing=false;allocationState.draft=null;allocationState.deleted=new Set();renderAllocations?.()}});
  register('ideas',{label:'Idea changes',isEditing:()=>typeof ideaState!=='undefined'&&ideaState?.editing===true,save:()=>{if(typeof saveIdeas==='function')saveIdeas();else document.querySelector('#ideaToolbar .success')?.click();return typeof ideaState==='undefined'||ideaState?.editing!==true},cancel:()=>{if(typeof ideaState==='undefined')return;ideaState.editing=false;ideaState.draft=null;ideaState.deleted=new Set();renderIdeas?.()}});
  register('record-modal',{label:'Record changes',isEditing:()=>typeof recordModalState!=='undefined'&&document.getElementById('recordModalBackdrop')?.classList.contains('open')&&recordModalState.mode==='edit',save:()=>{saveRecordModal?.();return recordModalState.mode!=='edit'||!document.getElementById('recordModalBackdrop')?.classList.contains('open')},cancel:()=>{if(typeof recordModalState==='undefined')return;if(recordModalState.isNew)closeRecordModal?.();else{recordModalState.mode='view';recordModalState.draft=null;renderRecordModal?.()}}});

  window.addEventListener('beforeunload',event=>{if(hasActive()){event.preventDefault();event.returnValue=''}});
  window.AmoEditTransactions={register,active,hasActive,resolveActive,navigate:guardedSwitchView}
})();
