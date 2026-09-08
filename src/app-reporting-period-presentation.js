/* Shared Actual / Forecast period presentation.
   ReportingModel owns period basis semantics; this module only maps that semantic basis to reusable
   presentation classes and grouped headers so reporting tables remain visually consistent. */
(function initReportingPeriodPresentation(){
  function basis(month){return window.ReportingModel?.periodBasis?.(month)||'forecast'}
  function classes(month,index,periods=[]){
    const current=basis(month),previous=index>0?basis(periods[index-1]):null;
    return['period-band',`period-${current}`,index%2?'period-alt':'',previous&&previous!==current?'period-basis-boundary':''].filter(Boolean)
  }
  function groups(periods=[]){
    const out=[];
    periods.forEach((month,index)=>{const current=basis(month),last=out.at(-1);if(last?.basis===current)last.count++;else out.push({basis:current,count:1,start:index})});
    return out
  }
  function addGroupedHeader(table,periods,fixedColumns){
    const thead=table?.tHead;if(!thead||!periods.length)return;
    thead.querySelector('tr[data-period-group-row]')?.remove();
    const row=document.createElement('tr');row.dataset.periodGroupRow='true';row.className='period-group-row';
    if(fixedColumns){const spacer=document.createElement('th');spacer.colSpan=fixedColumns;spacer.className='period-group-spacer';row.appendChild(spacer)}
    groups(periods).forEach(group=>{const th=document.createElement('th');th.colSpan=group.count;th.className=`period-group period-${group.basis}${group.start?' period-basis-boundary':''}`;th.dataset.periodBasis=group.basis;th.innerHTML=`<span>${group.basis==='actual'?'ACTUALS':'FORECAST'}</span>`;row.appendChild(th)});
    thead.insertBefore(row,thead.firstChild)
  }
  function decorateTable(table,periods,fixedColumns){
    if(!table||!Array.isArray(periods))return;
    [...table.rows].filter(row=>!row.dataset.periodGroupRow).forEach(row=>periods.forEach((month,index)=>{
      const cell=row.cells?.[fixedColumns+index];if(!cell)return;
      cell.classList.remove('period-band','period-actual','period-forecast','period-alt','period-basis-boundary');
      classes(month,index,periods).forEach(c=>cell.classList.add(c));
      cell.dataset.periodBasis=basis(month)
    }));
    addGroupedHeader(table,periods,fixedColumns)
  }
  window.ReportingPeriodPresentation={basis,classes,groups,addGroupedHeader,decorateTable};

  if(document.getElementById('reporting-period-presentation-styles'))return;
  const style=document.createElement('style');style.id='reporting-period-presentation-styles';style.textContent=`
    .period-band{background-clip:padding-box}
    .period-group-row th{padding:6px 10px;border-bottom:0;text-align:center;font-size:.68rem;letter-spacing:.08em;font-weight:800}.period-group-row .period-group span{display:flex;align-items:center;gap:10px;white-space:nowrap}.period-group-row .period-group span::before,.period-group-row .period-group span::after{content:"";height:1px;flex:1;background:currentColor;opacity:.42}.period-group-spacer{background:transparent!important;border-left:0!important}
    th.period-actual{background:color-mix(in srgb,var(--panel) 88%,#6b7280)}
    td.period-actual{background:color-mix(in srgb,var(--panel) 96%,#6b7280)}
    th.period-actual.period-alt{background:color-mix(in srgb,var(--panel) 84%,#6b7280)}
    td.period-actual.period-alt{background:color-mix(in srgb,var(--panel) 93%,#6b7280)}
    th.period-forecast{background:color-mix(in srgb,var(--panel) 82%,#4f6fae)}
    td.period-forecast{background:color-mix(in srgb,var(--panel) 94%,#4f6fae)}
    th.period-forecast.period-alt{background:color-mix(in srgb,var(--panel) 77%,#4f6fae)}
    td.period-forecast.period-alt{background:color-mix(in srgb,var(--panel) 90%,#4f6fae)}
    .period-basis-boundary{border-left:3px solid color-mix(in srgb,var(--accent) 68%,var(--line))!important}
    html[data-theme="dark"] th.period-actual{background:color-mix(in srgb,var(--panel) 72%,#64748b)}
    html[data-theme="dark"] td.period-actual{background:color-mix(in srgb,var(--panel) 89%,#64748b)}
    html[data-theme="dark"] th.period-forecast{background:color-mix(in srgb,var(--panel) 67%,#5273b8)}
    html[data-theme="dark"] td.period-forecast{background:color-mix(in srgb,var(--panel) 86%,#5273b8)}
  `;document.head.appendChild(style)
})();
