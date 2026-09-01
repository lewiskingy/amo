const assert = require('node:assert/strict');
const { Given, When, Then } = require('@cucumber/cucumber');

const requiredEnv=name=>{
  const value=String(process.env[name]||'').trim();
  assert.ok(value,`${name} must be configured for the acceptance run.`);
  return value.replace(/\/+$/,'');
};

async function waitFor(fn,{timeout=5000,interval=100}={}){
  const started=Date.now();let last;
  while(Date.now()-started<timeout){
    try{const value=await fn();if(value)return value}catch(error){last=error}
    await new Promise(resolve=>setTimeout(resolve,interval));
  }
  if(last)throw last;
  throw new Error(`Condition was not met within ${timeout}ms.`);
}

Given('the deployed AMO Test application', function(){
  this.baseUrl=requiredEnv('E2E_BASE_URL');
  this.apiBaseUrl=requiredEnv('E2E_API_BASE_URL');
});

When('I open the application', async function(){
  const response=await this.page.goto(this.baseUrl,{waitUntil:'domcontentloaded'});
  assert.ok(response,`No response received from ${this.baseUrl}`);
  assert.ok(response.ok(),`AMO returned HTTP ${response.status()} from ${this.baseUrl}`);
  await this.page.waitForLoadState('networkidle',{timeout:10000}).catch(()=>{});
});

Then('the public hostname should identify itself as the Test application', async function(){
  const config=await this.page.evaluate(()=>window.AMO_CONFIG||{});
  assert.equal(config.targetStage,'test','The public Test hostname is not serving a Test-stage client.');
  assert.ok(config.buildId&&config.buildId!=='local','The deployed client did not expose a Cloudflare build identity.');
  const banner=this.page.locator('#amoTargetStageBanner');
  await waitFor(async()=>((await banner.textContent())||'').includes('TEST APP'));
});

Then('the client version should match the deployed candidate', async function(){
  const expected=requiredEnv('E2E_EXPECTED_CLIENT_VERSION');
  const version=await this.page.evaluate(()=>window.AMO_APP_VERSION||'');
  assert.equal(version,expected,`Expected client ${expected}, received ${version||'no client version'}.`);
  const brand=await this.page.locator('.brand-sub').textContent();
  assert.ok(String(brand||'').includes(`Client ${expected}`),`Sidebar does not show Client ${expected}: ${brand}`);
});

Then('the backend version and API contract should match the deployed candidate', async function(){
  const expectedBackend=requiredEnv('E2E_EXPECTED_BACKEND_VERSION');
  const expectedApi=requiredEnv('E2E_EXPECTED_API_VERSION');
  const response=await fetch(`${this.apiBaseUrl}/api/info`,{headers:{Accept:'application/json'}});
  assert.ok(response.ok(),`AMO API info returned HTTP ${response.status()}.`);
  const info=await response.json();
  assert.equal(info.product,'AMO');
  assert.equal(String(info.backendVersion||''),expectedBackend,`Expected backend ${expectedBackend}, received ${info.backendVersion||'not reported'}.`);
  assert.equal(String(info.apiVersion||''),expectedApi,`Expected API contract ${expectedApi}, received ${info.apiVersion||'not reported'}.`);
});

Then('the navigation shell should be usable at the selected viewport', async function(){
  const profile=process.env.E2E_PROFILE||'desktop';
  const sidebar=this.page.locator('.sidebar');
  if(profile==='mobile'){
    const toggle=this.page.locator('#amoMobileNavToggle');
    await waitFor(async()=>await toggle.isVisible());
    await toggle.click();
    await waitFor(async()=>await sidebar.isVisible());
  }else{
    assert.equal(await sidebar.isVisible(),true,'Desktop sidebar is not visible.');
  }
  const navText=String(await sidebar.locator('nav').textContent()||'');
  for(const expected of ['Dashboard','Demand','Allocations','Resource Plan','Roadmap','Settings','Improvement Ideas','Process Guide']){
    assert.ok(navText.includes(expected),`Navigation is missing ${expected}.`);
  }
});

Then('there should be one account identity surface', async function(){
  const count=await waitFor(async()=>{
    const n=await this.page.locator('#amoSidebarIdentity [data-amo-auth-profile]').count();
    return n===1?n:false;
  },{timeout:10000});
  assert.equal(count,1,'Expected exactly one account/sign-in surface.');
  assert.equal(await this.page.locator('[data-amo-auth-profile]').count(),1,'Duplicate account/sign-in surfaces were rendered.');
});

Then('the legacy command menu should not be present', async function(){
  assert.equal(await this.page.locator('#commandMenuShell').count(),0,'The removed global command menu has reappeared.');
});
