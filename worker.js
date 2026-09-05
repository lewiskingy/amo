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

function versionStaticAssets(html,buildId){
  const version=encodeURIComponent(String(buildId||'local'));
  const versioned=(attribute,extension)=>new RegExp(`${attribute}="((?!https?:\\/\\/)[^"?#]+\\.${extension})(?:\\?[^"#]*)?"`,'g');
  return html
    .replace(versioned('src','js'),(_match,path)=>`src="${path}?v=${version}"`)
    .replace(versioned('href','css'),(_match,path)=>`href="${path}?v=${version}"`)
}

async function applicationShell(request,env,url,path){
  const assetUrl=new URL(path,url);
  const response=await env.ASSETS.fetch(new Request(assetUrl,request));
  if(!response.ok)return response;
  const config=environmentConfig(env,url);
  const html=versionStaticAssets(await response.text(),config.buildId);
  const script=`<script>window.AMO_CONFIG=Object.assign({},window.AMO_CONFIG||{},${JSON.stringify(config)});window.AMO_ASSET_VERSION=${JSON.stringify(config.buildId)};</script>`;
  const headers=new Headers(response.headers);headers.set('Cache-Control','no-store');
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

export default {
  async fetch(request,env){
    const url=new URL(request.url);

    // Static Assets html_handling is deliberately disabled so deep report routes are not
    // canonicalised to /reports/. Resolve application shells explicitly and inject the
    // deployment target stage, build identity and matching Remote Workspace API default.
    if(url.pathname==='/'||url.pathname==='/index.html'){
      return applicationShell(request,env,url,'/index.html')
    }
    if(isReportDeepLink(url.pathname)){
      return applicationShell(request,env,url,'/reports/index.html')
    }
    return env.ASSETS.fetch(request)
  }
};