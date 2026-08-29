/* Consistent boolean relationship status for optional Person <-> AMO User linkage. */
(function initLinkedMembershipPills(){
  if(window.__amoLinkedMembershipPillsLoaded)return;window.__amoLinkedMembershipPillsLoaded=true;

  if(typeof displayVal==='function'){
    const base=displayVal;
    displayVal=function(row,col){
      if(col?.key==='userId')return row?.userId?'<span class="pill green">Yes</span>':'<span class="pill gray">No</span>';
      return base(row,col)
    }
  }

  function normalizeUsers(){
    document.querySelectorAll('#usersContent [data-amo-person-link-cell]').forEach(cell=>{
      const select=cell.querySelector('select');if(select)return;
      const linked=cell.querySelector('.pill.green');if(linked&&linked.textContent!=='Yes')linked.textContent='Yes';
      const unlinked=cell.querySelector('.pill.gray');if(unlinked&&unlinked.textContent!=='No')unlinked.textContent='No'
    })
  }

  const users=document.getElementById('usersContent');if(users){
    const observer=new MutationObserver(normalizeUsers);observer.observe(users,{childList:true,subtree:true});normalizeUsers()
  }
  window.addEventListener('amo-workspace-connected',()=>{try{renderGrid?.('team')}catch(_e){};normalizeUsers()});
})();
