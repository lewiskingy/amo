function environmentConfig(url){
  const isTest=url.hostname==='amo-test.theflat.me.uk'||url.hostname.startsWith('amo-test.');
  return {
    environment:isTest?'test':'production',
    defaultRemoteUrl:isTest?'https://api.amo-test.theflat.me.uk':'https://api.amo.theflat.me.uk'
  }
}

async function applicationShell(request,env,url,path){
  const assetUrl=new URL(path,url);
  const response=await env.ASSETS.fetch(new Request(assetUrl,request));
  if(!response.ok)return response;
  const config=environmentConfig(url);
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
    // environment-specific Remote Workspace API default before browser scripts initialise.
    if(url.pathname==='/'||url.pathname==='/index.html'){
      return applicationShell(request,env,url,'/index.html')
    }
    if(/^\/reports\/[^/]+\/?$/.test(url.pathname)){
      return applicationShell(request,env,url,'/reports/index.html')
    }
    return env.ASSETS.fetch(request)
  }
};
