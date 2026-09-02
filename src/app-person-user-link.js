/* Optional People -> AMO User relationship.
   Person remains the workforce/resource record. User remains the authoritative application identity.
   When linked, User.displayName and User.companyAccount own the Person name/email snapshot. */
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
    if(clean(person.name)!==name){person.name=name;changed=true}
    if(clean(person.email)!==email){person.email=email;changed=true}
    return changed
  }

  function validatePeopleLinks(rows){
    const assigned=new Map();
    for(const person of rows||[]){
      person.userId=clean(person.userId);person.email=clean(person.email);
      if(!person.userId)continue;
      const user=userById(person.userId);if(!user)throw new Error(`Person ${person.name||person.id} is linked to a User that no longer exists.`);
      if(assigned.has(person.userId))throw new Error(`${user.displayName||user.companyAccount||user.id} is already linked to ${assigned.get(person.userId)}. A User can only be linked to one Person.`);
      assigned.set(person.userId,person.name||person.id);applyUserIdentity(person)
    }
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

  /* Extend existing People records without migrating or requiring either field. */
  if(typeof defaultTeamRecord==='function'){
    const baseDefault=defaultTeamRecord;defaultTeamRecord=function(){return{...baseDefault(),userId:'',email:''}}
  }

  if(typeof teamCols!=='undefined'){
    if(!teamCols.some(col=>col.key==='userId'))teamCols.splice(1,0,{key:'userId',label:'AMO access',type:'text',editable:false});
    else{const accessCol=teamCols.find(col=>col.key==='userId');if(accessCol)accessCol.label='AMO access'}
    const nameIndex=teamCols.findIndex(col=>col.key==='name');
    if(!teamCols.some(col=>col.key==='email'))teamCols.splice(nameIndex>=0?nameIndex+1:2,0,{key:'email',label:'Company / Entra Email',type:'text',editable:true})
  }

  if(typeof displayVal==='function'){
    const baseDisplay=displayVal;displayVal=function(row,col){
      if(col?.key==='userId')return row?.userId?userLabel(userById(row.userId)):'No application access';
      if(row?.userId&&col?.key==='name')return clean(userById(row.userId)?.displayName)||baseDisplay(row,col);
      if(row?.userId&&col?.key==='email')return clean(userById(row.userId)?.companyAccount)||baseDisplay(row,col);
      return baseDisplay(row,col)
    }
  }

  if(typeof editControl==='function'){
    const baseEdit=editControl;editControl=function(row,col){
      if(row?.userId&&(col?.key==='name'||col?.key==='email')){
        const value=col.key==='name'?clean(userById(row.userId)?.displayName)||clean(row.name):clean(userById(row.userId)?.companyAccount)||clean(row.email);
        return`<input class="cell-input" type="text" value="${typeof escHtml==='function'?escHtml(value):value}" disabled title="Managed from the linked AMO access identity">`
      }
      return baseEdit(row,col)
    }
  }

  if(typeof renderTeamModal==='function'){
    renderTeamModal=function(r){
      const linked=userById(r.userId),roles=[{value:'',label:'Unassigned'},...(typeof configuredRoles==='function'?configuredRoles():[]).map(role=>({value:role.id,label:role.name}))];
      if(linked)applyUserIdentity(r);
      const managed=!!linked,identityNote=managed?'<div class="field full"><div class="notice">Name and Company / Entra Email are managed from the linked AMO access identity. Roles and authentication mappings are managed under Users & Access.</div></div>':'<div class="field full"><div class="muted">This Person does not currently have application access. Link an existing User here, or use Users & Access to grant and manage access.</div></div>';
      return`<div class="record-form">${modalField('Team ID','id',r.id,'text',null,false,false,true)}${modalField('AMO access','userId',r.userId||'','select',userOptions())}${modalField('Name','name',r.name,'text',null,true,false,managed)}${modalField('Company / Entra Email','email',r.email||'','email',null,false,false,managed)}${identityNote}${modalField('Role','roleId',r.roleId||'','select',roles)}${modalField('FTE','fte',r.fte,'number')}${modalField('Active','active',String(r.active),'select',[{value:'true',label:'Yes'},{value:'false',label:'No'}])}</div>`
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
        const source=recordModalState.isNew?[...(gridState.team.editing?gridState.team.draft:db.team),next]:(gridState.team.editing?gridState.team.draft:db.team).map(person=>person.id===recordModalState.id?next:person);
        validatePeopleLinks(source)
      }catch(error){alert(error.message);return}
      if(next.userId)applyUserIdentity(next);return baseSaveTeam(next)
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

  window.amoPersonUserLink={userById,userOptions,applyUserIdentity,validatePeopleLinks,syncLinkedPeople};
})();
