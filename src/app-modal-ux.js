/* Standard modal behaviour: edit-on-open, top positioning, fixed actions, and Escape/Cancel consistency. */
(function initModalUx(){
  const backdrop=()=>document.getElementById('recordModalBackdrop');
  const body=()=>document.getElementById('recordModalBody');

  function resetModalScroll(){
    requestAnimationFrame(()=>{
      const b=backdrop(),content=body();
      if(b)b.scrollTop=0;
      if(content)content.scrollTop=0;
      document.querySelector('#recordModalBackdrop .record-modal')?.scrollTo?.({top:0,left:0,behavior:'instant'})
    })
  }

  async function ensureEditLockForExisting(id){
    if(!id||!workspaceHandle)return true;
    if(typeof lockOwnedByUs==='function'&&lockOwnedByUs())return true;
    if(typeof acquireWorkspaceLock!=='function')return true;
    return await acquireWorkspaceLock()
  }

  /* Existing records always open directly in edit mode. If another session owns the
     workspace lock, the normal lock warning is shown and the modal is not opened. */
  if(typeof openRecordModal==='function'){
    const baseOpenRecordModal=openRecordModal;
    openRecordModal=async function(type,id=null,mode=null,extra={}){
      if(id&&!await ensureEditLockForExisting(id))return;
      const result=baseOpenRecordModal.call(this,type,id,'edit',extra);
      resetModalScroll();
      return result
    }
  }

  if(typeof openIdeaModal==='function'){
    const baseOpenIdeaModal=openIdeaModal;
    openIdeaModal=async function(id=null,mode=null){
      if(id&&!await ensureEditLockForExisting(id))return;
      const result=baseOpenIdeaModal.call(this,id,'edit');
      resetModalScroll();
      return result
    }
  }

  /* Ideas use the shared modal shell but historically used private button IDs. Add the
     common modal action attributes so Escape handling and workspace lock release behave
     exactly like Demand/People/Allocation dialogs. */
  if(typeof renderIdeaModal==='function'){
    const baseRenderIdeaModal=renderIdeaModal;
    renderIdeaModal=function(){
      const result=baseRenderIdeaModal.apply(this,arguments);
      document.getElementById('cancelIdeaModal')?.setAttribute('data-modal-cancel','');
      document.getElementById('saveIdeaModal')?.setAttribute('data-modal-save','');
      document.getElementById('closeIdeaModal')?.setAttribute('data-modal-close','');
      resetModalScroll();
      return result
    }
  }

  /* Cancel means abandon the dialog, not fall back into a redundant view mode. This also
     makes Escape predictable because app-ux-fixes clicks the same Cancel action. */
  document.addEventListener('click',event=>{
    const cancel=event.target.closest?.('#recordModalBackdrop [data-modal-cancel]');
    if(!cancel)return;
    const isIdea=!!document.getElementById('cancelIdeaModal');
    event.preventDefault();
    event.stopPropagation();
    if(isIdea&&typeof closeIdeaModal==='function')closeIdeaModal();
    else if(typeof closeRecordModal==='function')closeRecordModal()
  },true);

  const style=document.createElement('style');
  style.id='amo-modal-ux-styles';
  style.textContent=`
    #recordModalBackdrop.modal-backdrop{align-items:start;justify-items:center;overflow-y:auto;padding:22px 20px}
    #recordModalBackdrop .record-modal{display:flex;flex-direction:column;overflow:hidden;max-height:calc(100vh - 44px);margin:0 auto}
    #recordModalBackdrop .record-modal .modal-header{flex:0 0 auto}
    #recordModalBackdrop #recordModalBody{flex:1 1 auto;min-height:0;overflow-y:auto;overflow-x:hidden;padding-right:4px}
    #recordModalBackdrop #recordModalActions{flex:0 0 auto;position:relative;margin-top:12px;padding-top:12px;border-top:1px solid var(--line);background:var(--panel);z-index:2}
    @media(max-width:760px){#recordModalBackdrop.modal-backdrop{padding:8px}#recordModalBackdrop .record-modal{max-height:calc(100vh - 16px)}}
  `;
  document.head.appendChild(style);
})();
