/* Polish horizontal allocation fill: directional in-cell arrows and a reversible live range preview. */
(function initAllocationFillPolish(){
  function currentAllocation(aid){return allocationState?.draft?.find(a=>a.id===aid)}
  function pct(a,month){return Math.max(0,Math.min(100,Math.round((Number(a?.forecast?.[month])||0)*100)))}
  function setPct(a,month,value){a.forecast=a.forecast||{};a.forecast[month]=Math.max(0,Math.min(100,Number(value)||0))/100}
  function resourceFraction(resourceId,month){
    if(!resourceId)return 0;
    return (allocationState?.draft||[]).filter(a=>a.teamMemberId===resourceId&&!allocationState.deleted?.has(a.id)).reduce((n,a)=>n+(Number(a.forecast?.[month])||0),0)
  }
  function stateFor(resourceId,month){
    const p=typeof person==='function'?person(resourceId):null,cap=Math.max(0,Number(p?.fte)||0),used=resourceFraction(resourceId,month);
    if(cap>0&&used>cap+.0001)return'over';
    if(cap>0&&used>=cap*.9)return'near';
    return'ok'
  }
  function refreshRow(resourceId,aid){
    document.querySelectorAll(`#allocationTable .alloc-month-cell[data-aid="${CSS.escape(aid)}"]`).forEach(cell=>{
      const a=currentAllocation(aid);if(!a)return;
      const value=pct(a,cell.dataset.month),state=stateFor(resourceId,cell.dataset.month);
      cell.style.setProperty('--alloc-pct',`${value}%`);
      cell.classList.remove('state-ok','state-near','state-over');cell.classList.add(`state-${state}`);
      const input=cell.querySelector('.alloc-pct-text');if(input&&document.activeElement!==input)input.value=`${value}%`
    })
  }
  function clearPreview(aid){document.querySelectorAll(`#allocationTable .alloc-month-cell[data-aid="${CSS.escape(aid)}"]`).forEach(c=>c.classList.remove('fill-preview','fill-preview-edge','fill-preview-source'))}

  document.addEventListener('pointerdown',event=>{
    const handle=event.target.closest?.('#allocationTable .alloc-fill-handle');if(!handle)return;
    /* Intercept the older element-level drag handler and provide the polished behaviour instead. */
    event.preventDefault();event.stopImmediatePropagation();
    const sourceCell=handle.closest('.alloc-month-cell'),row=handle.closest('.allocation-row'),aid=sourceCell?.dataset.aid,a=currentAllocation(aid);if(!sourceCell||!row||!a)return;
    const months=planningMonths(),sourceIndex=Number(sourceCell.dataset.monthIndex),direction=handle.dataset.fill,sourcePct=pct(a,sourceCell.dataset.month),resourceId=a.teamMemberId;
    const original=Object.fromEntries(months.map(m=>[m,Number(a.forecast?.[m])||0]));
    row.classList.add('fill-dragging');clearPreview(aid);sourceCell.classList.add('fill-preview-source');
    handle.setPointerCapture?.(event.pointerId);

    const applyTo=index=>{
      if(!Number.isFinite(index))return;
      index=Math.max(0,Math.min(months.length-1,index));
      if(direction==='left')index=Math.min(index,sourceIndex);else index=Math.max(index,sourceIndex);
      for(const m of months)a.forecast[m]=original[m];
      const lo=Math.min(index,sourceIndex),hi=Math.max(index,sourceIndex);
      for(let i=lo;i<=hi;i++)setPct(a,months[i],sourcePct);
      clearPreview(aid);
      for(let i=lo;i<=hi;i++){
        const cell=row.querySelector(`.alloc-month-cell[data-month-index="${i}"]`);if(cell)cell.classList.add('fill-preview')
      }
      sourceCell.classList.add('fill-preview-source');
      row.querySelector(`.alloc-month-cell[data-month-index="${index}"]`)?.classList.add('fill-preview-edge');
      refreshRow(resourceId,aid)
    };
    applyTo(sourceIndex);

    const move=ev=>{
      const el=document.elementFromPoint(ev.clientX,ev.clientY),target=el?.closest?.(`.alloc-month-cell[data-aid="${CSS.escape(aid)}"]`);
      if(target)applyTo(Number(target.dataset.monthIndex))
    };
    const finish=()=>{
      window.removeEventListener('pointermove',move,true);window.removeEventListener('pointerup',finish,true);window.removeEventListener('pointercancel',finish,true);
      row.classList.remove('fill-dragging');clearPreview(aid);refreshRow(resourceId,aid)
    };
    window.addEventListener('pointermove',move,true);window.addEventListener('pointerup',finish,true);window.addEventListener('pointercancel',finish,true)
  },true);

  const style=document.createElement('style');style.id='allocation-fill-polish-styles';style.textContent=`
    #allocationTable .alloc-fill-handle{width:15px!important;height:18px!important;border:1px solid color-mix(in srgb,var(--accent) 55%,var(--line))!important;border-radius:5px!important;background:color-mix(in srgb,var(--panel) 92%,var(--accent))!important;top:50%!important;transform:translateY(-50%)!important;cursor:ew-resize!important;box-shadow:0 1px 2px rgba(0,0,0,.08);overflow:hidden}
    #allocationTable .alloc-fill-handle.left{left:3px!important;right:auto!important}
    #allocationTable .alloc-fill-handle.right{right:3px!important;left:auto!important}
    #allocationTable .alloc-fill-handle::before{content:'';position:absolute;top:50%;transform:translateY(-50%);width:0;height:0;border-top:4px solid transparent;border-bottom:4px solid transparent}
    #allocationTable .alloc-fill-handle.left::before{left:3px;border-right:6px solid var(--accent)}
    #allocationTable .alloc-fill-handle.right::before{right:3px;border-left:6px solid var(--accent)}
    #allocationTable .alloc-fill-handle:hover{background:color-mix(in srgb,var(--accent) 14%,var(--panel))!important;border-color:var(--accent)!important}
    #allocationTable .fill-dragging .alloc-month-cell{transition:none!important}
    #allocationTable .fill-dragging .alloc-bar{transition:none!important}
    #allocationTable .alloc-month-cell.fill-preview{background:color-mix(in srgb,var(--accent) 7%,var(--panel))!important;box-shadow:inset 0 2px 0 color-mix(in srgb,var(--accent) 42%,transparent),inset 0 -2px 0 color-mix(in srgb,var(--accent) 42%,transparent)!important}
    #allocationTable .alloc-month-cell.fill-preview .alloc-bar{left:0!important;right:0!important;bottom:0!important;max-height:100%!important;border-radius:0!important;opacity:.9}
    #allocationTable .alloc-month-cell.fill-preview-source{box-shadow:inset 0 0 0 2px color-mix(in srgb,var(--accent) 70%,transparent)!important}
    #allocationTable .alloc-month-cell.fill-preview-edge{box-shadow:inset 0 0 0 2px var(--accent)!important}
    html[data-theme="dark"] #allocationTable .alloc-fill-handle{background:color-mix(in srgb,var(--panel) 90%,var(--accent))!important}
  `;document.head.appendChild(style)
})();
