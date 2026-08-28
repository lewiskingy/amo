export default {
  async fetch(request,env){
    const url=new URL(request.url);

    // Static Assets html_handling is deliberately disabled so deep report routes are not
    // canonicalised to /reports/. Resolve the two application shells explicitly instead.
    if(url.pathname==='/'||url.pathname==='/index.html'){
      const assetUrl=new URL('/index.html',url);
      return env.ASSETS.fetch(new Request(assetUrl,request));
    }
    if(/^\/reports\/[^/]+\/?$/.test(url.pathname)){
      const assetUrl=new URL('/reports/index.html',url);
      return env.ASSETS.fetch(new Request(assetUrl,request));
    }
    return env.ASSETS.fetch(request)
  }
};
