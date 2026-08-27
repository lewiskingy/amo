/* Semantic filter presentation fixes.
   Keep option filtering and checkbox alignment independent of table-header alignment/styles. */
(function initSemanticFilterPolish(){
  if(window.__amoSemanticFilterPolishLoaded)return;
  window.__amoSemanticFilterPolishLoaded=true;

  const style=document.createElement('style');
  style.id='semantic-filter-polish-styles';
  style.textContent=`
    /* app-semantic-filters toggles the native hidden attribute while searching.
       Make that state authoritative even though option rows otherwise use display:flex. */
    .semantic-filter-options [hidden]{display:none!important}

    /* Filter popovers live inside table headers, which may be right aligned. Option content
       should always read naturally: checkbox first, then left-aligned text. */
    .semantic-filter-popover,
    .semantic-filter-options{ text-align:left!important; }
    .semantic-filter-popover{ overflow-x:hidden!important; }
    .semantic-filter-options label{
      display:flex!important;
      flex-direction:row!important;
      align-items:flex-start!important;
      justify-content:flex-start!important;
      gap:7px!important;
      width:100%;
      box-sizing:border-box;
      text-align:left!important;
      white-space:normal!important;
    }
    /* app.css gives every filter-row input width:100%. Reset that for checkboxes so the
       checkbox occupies only its natural control width rather than consuming the whole row. */
    .filter-row .semantic-filter-options label > input[type="checkbox"]{
      width:auto!important;
      min-width:0!important;
      max-width:none!important;
      flex:0 0 auto!important;
      margin:2px 0 0!important;
      padding:0!important;
      order:0;
    }
    .semantic-filter-options label > span{
      flex:1 1 auto;
      min-width:0;
      order:1;
      text-align:left!important;
      white-space:normal!important;
      overflow-wrap:anywhere;
    }
  `;
  document.head.appendChild(style);
})();
