function normalizeTargetStage(value,url){
  const configured=String(value||'').trim().toLowerCase();
  if(configured==='production'||configured==='test')return configured;
  /* Safe backwards-compatible fallback for local/dev deployments that have not set the binding yet. */
  return url.hostname==='amo-test.theflat.me.uk'||url.hostname.startsWith('amo-test.')?'test':'production'
}

function environmentConfig(env,url){
  const targetStage=normalizeTargetStage(env.AMO_TARGET_STAGE,url);
  return {
    targetStage,
    buildId:env.CF_VERSION_METADATA?.id||'local',
    defaultRemoteUrl:targetStage==='test'?'https://api.amo-test.theflat.me.uk':'https://api.amo.theflat.me.uk'
  }
}

function versionApplicationScripts(html,buildId){
  const version=encodeURIComponent(String(buildId||'local'));
  return html.replace(/(<script\b[^>]*\bsrc=")(?!https?:\/\/|\/\/)([^"?]+\.js)(?:\?[^" ]*)?("[^>]*>)/g,`$1$2?v=${version}$3`)
}

async function applicationShell(request,env,url,path){
  const assetUrl=new URL(path,url);
  const response=await env.ASSETS.fetch(new Request(assetUrl,request));
  if(!response.ok)return response;
  const config=environmentConfig(env,url);
  const html=versionApplicationScripts(await response.text(),config.buildId);
  const script=`<script>window.AMO_CONFIG=Object.assign({},window.AMO_CONFIG||{},${JSON.stringify(config)});window.AMO_ASSET_VERSION=${JSON.stringify(config.buildId)};</script>`;
  const headers=new Headers(response.headers);
  /* The HTML shell owns the deployment build identity. It must never be reused from browser/cache
     across deployments, otherwise fixed legacy script query strings can preserve an older core
     module while dynamically loaded modules come from the newer release. */
  headers.set('Cache-Control','no-store, max-age=0');
  headers.set('Pragma','no-cache');
  headers.set('Expires','0');
  headers.set('X-AMO-Build',config.buildId);
  return new Response(html.replace('</head>',`${script}</head>`),{
    status:response.status,
    statusText:response.statusText,
    headers
  })
}

function isReportDeepLink(pathname){
  const match=pathname.match(/^\/reports\/([^/]+)\/?$/);
  if(!match)return false;
  // Files such as /reports/report-viewer.js and .css are static assets, not report IDs.
  return !match[1].includes('.')
}

function isDemandRoute(pathname){
  return pathname==='/demand'||pathname==='/demand/'||pathname==='/demand/index.html'
}

export default {
  async fetch(request,env){
    const url=new URL(request.url);

    // Static Assets html_handling is deliberately disabled so routed application shells are not
    // canonicalised away. Resolve shells explicitly and inject deployment target/build identity.
    if(url.pathname==='/'||url.pathname==='/index.html'){
      return applicationShell(request,env,url,'/index.html')
    }
    if(isDemandRoute(url.pathname)){
      return applicationShell(request,env,url,'/demand/index.html')
    }
    if(isReportDeepLink(url.pathname)){
      return applicationShell(request,env,url,'/reports/index.html')
    }
    return env.ASSETS.fetch(request)
  }
};