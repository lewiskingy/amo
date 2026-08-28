export default {
  async fetch(request,env){
    const url=new URL(request.url);
    if(/^\/reports\/[^/]+\/?$/.test(url.pathname)){
      const assetUrl=new URL('/reports/index.html',url);
      return env.ASSETS.fetch(new Request(assetUrl,request));
    }
    return env.ASSETS.fetch(request)
  }
};
