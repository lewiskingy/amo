/* Compatibility loader for older application shells.
   The canonical Resource Plan presentation now lives in app-resource-plan.js. */
(function loadCanonicalResourcePlan(){
  if(document.querySelector('script[data-amo-resource-plan]'))return;
  /* Keep parser-era refreshAll calls safe while the canonical module is being fetched. */
  if(typeof renderResource!=='function')window.renderResource=function(){};
  const s=document.createElement('script'),version=String(window.AMO_ASSET_VERSION||window.AMO_CONFIG?.buildId||'').trim();
  s.src=version?`app-resource-plan.js?v=${encodeURIComponent(version)}`:'app-resource-plan.js';
  s.dataset.amoResourcePlan='true';s.async=false;
  s.onload=()=>{if(typeof renderResource==='function'&&typeof workspaceHandle!=='undefined'&&workspaceHandle)renderResource()};
  s.onerror=()=>console.error(`Could not load ${s.src}`);
  document.head.appendChild(s)
})();
