/* Shared Actual / Forecast period presentation.
   ReportingModel owns period basis semantics; this module only maps that semantic basis to reusable
   presentation classes so reporting tables remain visually consistent without duplicating logic. */
(function initReportingPeriodPresentation(){
  function basis(month){return window.ReportingModel?.periodBasis?.(month)||'forecast'}
  function classes(month,index,periods=[]){
    const current=basis(month),previous=index>0?basis(periods[index-1]):null;
    return['period-band',`period-${current}`,index%2?'period-alt':'',previous&&previous!==current?'period-basis-boundary':''].filter(Boolean)
  }
  function decorateTable(table,periods,fixedColumns){
    if(!table||!Array.isArray(periods))return;
    const rows=[...table.rows];
    rows.forEach(row=>periods.forEach((month,index)=>{
      const cell=row.cells?.[fixedColumns+index];if(!cell)return;
      cell.classList.remove('period-band','period-actual','period-forecast','period-alt','period-basis-boundary');
      classes(month,index,periods).forEach(c=>cell.classList.add(c));
      cell.dataset.periodBasis=basis(month)
    }))
  }
  window.ReportingPeriodPresentation={basis,classes,decorateTable};

  if(document.getElementById('reporting-period-presentation-styles'))return;
  const style=document.createElement('style');style.id='reporting-period-presentation-styles';style.textContent=`
    .period-band{background-clip:padding-box}
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
