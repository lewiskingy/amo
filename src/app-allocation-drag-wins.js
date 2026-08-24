/* Ensure graphical allocation dragging wins over an in-progress numeric edit. */
(function initAllocationDragWins(){
  function cancelActivePercentageEdit(exceptHandle){
    const input=document.activeElement;
    if(!input?.classList?.contains('alloc-pct-text'))return;
    const cell=input.closest('.alloc-month-cell');
    const allocation=allocationState?.draft?.find?.(a=>a.id===input.dataset.aid);
    const pct=allocation?Math.max(0,Math.min(100,Math.round((Number(allocation.forecast?.[input.dataset.month])||0)*100))):0;
    /* Mark this blur as cancellation so the old typed value cannot commit after the drag starts. */
    input.dataset.cancelOnBlur='true';
    input.value=`${pct}%`;
    input.blur();
    delete input.dataset.cancelOnBlur;
    if(cell&&exceptHandle&&!cell.contains(exceptHandle))cell.classList.remove('editing');
  }

  /* Capture pointerdown before the allocation interaction layer sees it. */
  document.addEventListener('pointerdown',e=>{
    const handle=e.target.closest?.('#allocationTable .alloc-level-handle, #allocationTable .alloc-fill-handle');
    if(handle)cancelActivePercentageEdit(handle);
  },true);

  /* Suppress the normal blur/change commit when the edit was cancelled by a drag. */
  document.addEventListener('change',e=>{
    const input=e.target;
    if(input?.classList?.contains('alloc-pct-text')&&input.dataset.cancelOnBlur==='true'){
      e.stopImmediatePropagation();
    }
  },true);
  document.addEventListener('blur',e=>{
    const input=e.target;
    if(input?.classList?.contains('alloc-pct-text')&&input.dataset.cancelOnBlur==='true'){
      e.stopImmediatePropagation();
    }
  },true);
})();
