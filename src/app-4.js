/* Compatibility loader for older application shells.
   The canonical Resource Plan presentation now lives in app-resource-plan.js. */
(function loadCanonicalResourcePlan(){
  if(typeof renderResource==='function')return;
  if(document.querySelector('script[data-amo-resource-plan]'))return;
  const s=document.createElement('script'),version=String(window.AMO_ASSET_VERSION||window.AMO_CONFIG?.buildId||'').trim();
  s.src=version?`app-resource-plan.js?v=${encodeURIComponent(version)}`:'app-resource-plan.js';
  s.dataset.amoResourcePlan='true';s.async=false;
  s.onerror=()=>console.error(`Could not load ${s.src}`);
  document.head.appendChild(s)
})();
