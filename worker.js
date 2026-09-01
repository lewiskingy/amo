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

async function applicationShell(request,env,url,path){
  const assetUrl=new URL(path,url);
  const response=await env.ASSETS.fetch(new Request(assetUrl,request));
  if(!response.ok)return response;
  const config=environmentConfig(env,url);
  const html=await response.text();
  const script=`<script>window.AMO_CONFIG=Object.assign({},window.AMO_CONFIG||{},${JSON.stringify(config)});</script>`;
  return new Response(html.replace('</head>',`${script}</head>`),{
    status:response.status,
    statusText:response.statusText,
    headers:response.headers
  })
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
    if(/^\/reports\/[^/]+\/?$/.test(url.pathname)){
      return applicationShell(request,env,url,'/reports/index.html')
    }
    return env.ASSETS.fetch(request)
  }
};
