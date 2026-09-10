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

/* Commitment Health is a cross-cutting reporting capability over Demand, Work Packages,
   Allocations and Actuals. Load the single canonical calculation/presentation module once. */
(function loadCommitmentHealth(){
  if(document.querySelector('script[data-amo-commitment-health]')||window.CommitmentHealth)return;
  const s=document.createElement('script'),version=String(window.AMO_ASSET_VERSION||window.AMO_CONFIG?.buildId||'').trim();
  s.src=version?`app-commitment-health.js?v=${encodeURIComponent(version)}`:'app-commitment-health.js';
  s.dataset.amoCommitmentHealth='true';s.async=false;
  s.onerror=()=>console.error(`Could not load ${s.src}`);
  document.head.appendChild(s)
})();

/* Demand management filtering is composed as a final row-query concern after the management
   filter state exists. This avoids relying on parser/load timing between app-2.js and the
   dynamically loaded Commitment Health module while still filtering before DOM rendering. */
(function loadDemandManagementQuery(){
  if(document.querySelector('script[data-amo-demand-management-query]')||window.AmoDemandManagementQuery)return;
  const s=document.createElement('script'),version=String(window.AMO_ASSET_VERSION||window.AMO_CONFIG?.buildId||'').trim();
  s.src=version?`app-demand-management-query.js?v=${encodeURIComponent(version)}`:'app-demand-management-query.js';
  s.dataset.amoDemandManagementQuery='true';s.async=false;
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
