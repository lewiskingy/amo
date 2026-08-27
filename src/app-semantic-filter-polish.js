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
    .semantic-filter-options label{
      display:flex!important;
      flex-direction:row!important;
      align-items:center!important;
      justify-content:flex-start!important;
      gap:7px!important;
      width:100%;
      box-sizing:border-box;
      text-align:left!important;
    }
    .semantic-filter-options label > input[type="checkbox"]{
      flex:0 0 auto;
      margin:0!important;
      order:0;
    }
    .semantic-filter-options label > span{
      flex:1 1 auto;
      min-width:0;
      order:1;
      text-align:left!important;
    }
  `;
  document.head.appendChild(style);
})();
