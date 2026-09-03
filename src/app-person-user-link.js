/* Optional Person -> AMO User relationship.
   Person remains the workforce/resource record. User remains the authoritative application identity.
   Staff Number is the stable workforce identifier used to reconcile Oracle Actuals Person # values. */
(function initPersonUserLink(){
  if(window.__amoPersonUserLinkLoaded)return;window.__amoPersonUserLinkLoaded=true;

  const clean=value=>String(value??'').trim();
  const users=()=>Array.isArray(db?.settings?.users)?db.settings.users:[];
  const userById=id=>users().find(user=>String(user?.id||'')===String(id||''))||null;
  const userLabel=user=>user?`${clean(user.displayName)||clean(user.companyAccount)||user.id}${clean(user.companyAccount)?` · ${clean(user.companyAccount)}`:''}${user.enabled===false?' · Disabled':''}`:'Not linked';
  const userOptions=()=>[{value:'',label:'Not linked'},...users().map(user=>({value:user.id,label:userLabel(user)}))];
  const pendingSyncIds=new Set();

  function applyUserIdentity(person){
    if(!person?.userId)return false;
    const user=userById(person.userId);if(!user)return false;
    const name=clean(user.displayName),email=clean(user.companyAccount);let changed=false;
    if(name&&clean(person.name)!==name){person.name=name;changed=true}
    if(email&&clean(person.email)!==email){person.email=email;changed=true}
    return changed
  }

  /* Validate one Person being created/changed against its peers. Untouched legacy People may still
     have no Staff Number while the workspace is migrated progressively. They do not block saving
     another Person, but any Staff Number or linked User that is supplied must remain unique. */
  function validatePersonLink(person,peers=[]){
    person.userId=clean(person.userId);person.email=clean(person.email);person.staffNumber=clean(person.staffNumber);
    if(!person.staffNumber)throw new Error(`Staff Number is required for ${person.name||person.id}.`);
    const staffKey=person.staffNumber.toLowerCase();
    const duplicateStaff=(peers||[]).find(other=>other&&other.id!==person.id&&clean(other.staffNumber)&&clean(other.staffNumber).toLowerCase()===staffKey);
    if(duplicateStaff)throw new Error(`Staff Number ${person.staffNumber} is already used by ${duplicateStaff.name||duplicateStaff.id}.`);
    if(!person.userId)return true;
    const user=userById(person.userId);if(!user)throw new Error(`Person ${person.name||person.id} is linked to a User that no longer exists.`);
    const duplicateUser=(peers||[]).find(other=>other&&other.id!==person.id&&clean(other.userId)===person.userId);
    if(duplicateUser)throw new Error(`${user.displayName||user.companyAccount||user.id} is already linked to ${duplicateUser.name||duplicateUser.id}. A User can only be linked to one Person.`);
    applyUserIdentity(person);return true
  }

  function validatePeopleLinks(rows){
    const people=rows||[];
    for(const person of people)validatePersonLink(person,people);
    return true
  }

  function syncLinkedPeople({persist=false}={}){
    if(!Array.isArray(db?.team))return false;let changed=false;
    for(const person of db.team){if(applyUserIdentity(person)){pendingSyncIds.add(person.id);changed=true}}
    if(persist&&pendingSyncIds.size&&window.amoAccess?.can?.('people.write')){
      for(const id of pendingSyncIds)dirtyRecords.team.add(id);
      const count=pendingSyncIds.size;pendingSyncIds.clear();
      updateBanner?.();log?.(`Synchronized ${count} linked Person identit${count===1?'y':'ies'} from AMO Users.`);requestAutosave?.()
    }
    return changed
  }

  if(typeof defaultTeamRecord==='function'){
    const baseDefault=defaultTeamRecord;defaultTeamRecord=function(){const record=baseDefault();delete record.personNumber;return{...record,staffNumber:'',userId:'',email:''}}
  }

  if(typeof teamCols!=='undefined'){
    const oldPeopleNumber=teamCols.findIndex(col=>col.key==='personNumber');if(oldPeopleNumber>=0)teamCols.splice(oldPeopleNumber,1);
    if(!teamCols.some(col=>col.key==='staffNumber'))teamCols.splice(1,0,{key:'staffNumber',label:'Staff Number *',type:'text',editable:true});
    if(!teamCols.some(col=>col.key==='userId'))teamCols.splice(2,0,{key:'userId',label:'Linked User',type:'text',editable:false});
    else{const accessCol=teamCols.find(col=>col.key==='userId');if(accessCol)accessCol.label='Linked User'}
    const nameIndex=teamCols.findIndex(col=>col.key==='name');
    if(!teamCols.some(col=>col.key==='email'))teamCols.splice(nameIndex>=0?nameIndex+1:3,0,{key:'email',label:'Company / Entra Email',type:'text',editable:true})
  }

  if(typeof displayVal==='function'){
    const baseDisplay=displayVal;displayVal=function(row,col){
      if(col?.key==='userId')return row?.userId?userLabel(userById(row.userId)):'Not linked';
      if(row?.userId&&col?.key==='name')return clean(userById(row.userId)?.displayName)||baseDisplay(row,col);
      if(row?.userId&&col?.key==='email')return clean(userById(row.userId)?.companyAccount)||baseDisplay(row,col);
      return baseDisplay(row,col)
    }
  }

  if(typeof editControl==='function'){
    const baseEdit=editControl;editControl=function(row,col){
      if(row?.userId&&(col?.key==='name'||col?.key==='email')){
        const value=col.key==='name'?clean(userById(row.userId)?.displayName)||clean(row.name):clean(userById(row.userId)?.companyAccount)||clean(row.email);
        return`<input class="cell-input" type="text" value="${typeof escHtml==='function'?escHtml(value):value}" disabled title="Managed from the linked AMO User">`
      }
      return baseEdit(row,col)
    }
  }

  if(typeof renderTeamModal==='function'){
    renderTeamModal=function(r){
      const linked=userById(r.userId),roles=[{value:'',label:'Unassigned'},...(typeof configuredRoles==='function'?configuredRoles():[]).map(role=>({value:role.id,label:role.name}))];
      if(linked)applyUserIdentity(r);
      const managed=!!linked,identityNote=managed?'<div class="field full"><div class="notice">Name and Company / Entra Email are populated from the linked User. Staff Number remains workforce data on the Person and is used to match Oracle Actuals.</div></div>':'<div class="field full"><div class="muted">Optionally pick an existing User to populate Name and Company / Entra Email. A Person does not need application access to exist in resource planning.</div></div>';
      return`<div class="record-form">${modalField('Team ID','id',r.id,'text',null,false,false,true)}${modalField('Staff Number','staffNumber',r.staffNumber||'','text',null,true)}${modalField('Linked User','userId',r.userId||'','select',userOptions())}${modalField('Name','name',r.name,'text',null,true,false,managed)}${modalField('Company / Entra Email','email',r.email||'','email',null,false,false,managed)}${identityNote}${modalField('Role','roleId',r.roleId||'','select',roles)}${modalField('FTE','fte',r.fte,'number')}${modalField('Active','active',String(r.active),'select',[{value:'true',label:'Yes'},{value:'false',label:'No'}])}</div>`
    }
  }

  if(typeof renderRecordModal==='function'&&!renderRecordModal.__amoPersonUserLink){
    const baseRender=renderRecordModal,wrapped=function(){
      const result=baseRender.apply(this,arguments);
      if(recordModalState.type==='team'&&recordModalState.mode==='edit'){
        document.querySelector('#recordModalBody [data-modal-field="userId"]')?.addEventListener('change',()=>{
          const next=readModalDraft();if(next.userId)applyUserIdentity(next);recordModalState.draft=next;wrapped()
        })
      }
      return result
    };wrapped.__amoPersonUserLink=true;renderRecordModal=wrapped
  }

  if(typeof saveTeamModal==='function'){
    const baseSaveTeam=saveTeamModal;saveTeamModal=function(next){
      try{
        if(next.userId)applyUserIdentity(next);
        const peers=(gridState.team.editing?gridState.team.draft:db.team).filter(person=>person.id!==recordModalState.id);
        validatePersonLink(next,peers)
      }catch(error){alert(error.message);return}
      return baseSaveTeam(next)
    }
  }

  if(typeof saveGrid==='function'){
    const baseSaveGrid=saveGrid;saveGrid=function(name){
      if(name==='team'&&gridState.team?.draft){try{validatePeopleLinks(gridState.team.draft.filter(person=>!gridState.team.deleted?.has(person.id)))}catch(error){alert(error.message);return}}
      return baseSaveGrid(name)
    }
  }

  function refreshIdentitySurfaces(){
    const changed=syncLinkedPeople({persist:true});
    if(changed){try{renderGrid?.('team')}catch(_e){};try{renderResource?.()}catch(_e){};try{renderDashboard?.()}catch(_e){};try{updateBanner?.()}catch(_e){}}
  }
  window.addEventListener('amo-workspace-connected',refreshIdentitySurfaces);
  window.addEventListener('amo-access-changed',refreshIdentitySurfaces);
  setTimeout(refreshIdentitySurfaces,150);

  window.amoPersonUserLink={userById,userOptions,applyUserIdentity,validatePersonLink,validatePeopleLinks,syncLinkedPeople};
})();
