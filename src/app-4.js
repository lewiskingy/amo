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

/* Demand Register composition must be installed before any cross-cutting Demand contributor.
   It is the only layer permitted to replace renderGrid; feature modules register contributions. */
(function loadDemandGridComposition(){
  if(document.querySelector('script[data-amo-demand-grid]')||window.AmoDemandGrid)return;
  const s=document.createElement('script'),version=String(window.AMO_ASSET_VERSION||window.AMO_CONFIG?.buildId||'').trim();
  s.src=version?`app-demand-grid-composition.js?v=${encodeURIComponent(version)}`:'app-demand-grid-composition.js';
  s.dataset.amoDemandGrid='true';s.async=false;
  s.onerror=()=>console.error(`Could not load ${s.src}`);
  document.head.appendChild(s)
})();

/* Commitment Health is a cross-cutting reporting capability over Demand, Work Packages,
   Allocations and Actuals. It contributes Demand behaviour through AmoDemandGrid. */
(function loadCommitmentHealth(){
  if(document.querySelector('script[data-amo-commitment-health]')||window.CommitmentHealth)return;
  const s=document.createElement('script'),version=String(window.AMO_ASSET_VERSION||window.AMO_CONFIG?.buildId||'').trim();
  s.src=version?`app-commitment-health.js?v=${encodeURIComponent(version)}`:'app-commitment-health.js';
  s.dataset.amoCommitmentHealth='true';s.async=false;
  s.onerror=()=>console.error(`Could not load ${s.src}`);
  document.head.appendChild(s)
})();

/* Hierarchy controls coordinate presentation-only Expand all / Collapse all behaviour across the
   canonical Demand Work Package tree and Work Package Resource Plan. */
(function loadHierarchyControls(){
  if(document.querySelector('script[data-amo-hierarchy-controls]')||window.HierarchyControls)return;
  const s=document.createElement('script'),version=String(window.AMO_ASSET_VERSION||window.AMO_CONFIG?.buildId||'').trim();
  s.src=version?`app-hierarchy-controls.js?v=${encodeURIComponent(version)}`:'app-hierarchy-controls.js';
  s.dataset.amoHierarchyControls='true';s.async=false;
  s.onerror=()=>console.error(`Could not load ${s.src}`);
  document.head.appendChild(s)
})();
