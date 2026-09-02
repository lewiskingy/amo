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

async function fetchJsonWithRetry(url,{attempts=3,timeout=7000,delay=750}={}){
  let lastError;
  for(let attempt=1;attempt<=attempts;attempt++){
    try{
      const response=await fetch(url,{headers:{Accept:'application/json'},signal:AbortSignal.timeout(timeout)});
      if(!response.ok)throw new Error(`HTTP ${response.status}`);
      return await response.json();
    }catch(error){
      lastError=error;
      if(attempt<attempts)await new Promise(resolve=>setTimeout(resolve,delay));
    }
  }
  throw new Error(`Could not read ${url} after ${attempts} attempts: ${lastError?.message||lastError}`);
}

async function ensureMobileNavOpen(page){
  const toggle=page.locator('#amoMobileNavToggle');
  await waitFor(async()=>await toggle.isVisible());
  const expanded=await toggle.getAttribute('aria-expanded');
  if(expanded!=='true')await toggle.click();
  await waitFor(async()=>await toggle.getAttribute('aria-expanded')==='true');
  await waitFor(async()=>await page.locator('body').evaluate(node=>node.classList.contains('amo-mobile-nav-open')));
}

async function clickControl(locator){
  await waitFor(async()=>await locator.count()===1);
  await locator.evaluate(element=>element.click());
}

async function openNavView(world,view){
  const page=world.page;
  const profile=process.env.E2E_PROFILE||'desktop';
  if(profile==='mobile')await ensureMobileNavOpen(page);
  const button=page.locator(`.sidebar .nav-btn[data-view="${view}"]`);
  await waitFor(async()=>await button.count()===1);
  const group=button.locator('xpath=ancestor::details[1]');
  if(await group.count()===1&&!await group.evaluate(node=>node.open)){
    await group.evaluate(node=>{node.open=true});
  }
  await clickControl(button);
  await waitFor(async()=>await page.locator(`#${view}.view.active`).count()===1);
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

Then('the backend version and API contract should match the deployed candidate',{timeout:30000},async function(){
  const expectedBackend=requiredEnv('E2E_EXPECTED_BACKEND_VERSION');
  const expectedApi=requiredEnv('E2E_EXPECTED_API_VERSION');
  const info=await fetchJsonWithRetry(`${this.apiBaseUrl}/api/info`);
  assert.equal(info.product,'AMO');
  assert.equal(String(info.backendVersion||''),expectedBackend,`Expected backend ${expectedBackend}, received ${info.backendVersion||'not reported'}.`);
  assert.equal(String(info.apiVersion||''),expectedApi,`Expected API contract ${expectedApi}, received ${info.apiVersion||'not reported'}.`);
});

Then('the navigation shell should be usable at the selected viewport', async function(){
  const profile=process.env.E2E_PROFILE||'desktop';
  const sidebar=this.page.locator('.sidebar');
  if(profile==='mobile'){
    await ensureMobileNavOpen(this.page);
  }else{
    assert.equal(await sidebar.isVisible(),true,'Desktop sidebar is not visible.');
  }
  const navText=String(await sidebar.locator('nav').textContent()||'');
  for(const expected of ['Dashboard','Demand','Allocations','Resource Plan','Roadmap','Users & Access','Settings','Improvement Ideas','Process Guide']){
    assert.ok(navText.includes(expected),`Navigation is missing ${expected}.`);
  }
});

Then('there should be one account identity surface', async function(){
  const hostCount=await waitFor(async()=>{const n=await this.page.locator('#amoSidebarIdentity').count();return n===1?n:false},{timeout:4000});
  assert.equal(hostCount,1,'Expected exactly one sidebar account identity surface.');
  await waitFor(async()=>{
    const states=await this.page.locator('#amoSidebarIdentity .amo-sidebar-profile, #amoSidebarIdentity .amo-sidebar-signin').count();
    return states===1?states:false
  },{timeout:4000});
  assert.equal(await this.page.locator('#amoSidebarIdentity .amo-sidebar-profile, #amoSidebarIdentity .amo-sidebar-signin').count(),1,'The account identity surface should contain exactly one signed-in or signed-out state.');
  assert.equal(await this.page.locator('.amo-sidebar-profile, .amo-sidebar-signin').count(),1,'Duplicate account/sign-in states were rendered.');
});

Then('the legacy command menu should not be present', async function(){
  assert.equal(await this.page.locator('#commandMenuShell').count(),0,'The removed global command menu has reappeared.');
});

Then('Users & Access should be available under Administration', async function(){
  const group=this.page.locator('.sidebar nav [data-amo-nav-section="administration"]');
  await waitFor(async()=>await group.count()===1);
  const button=group.locator('.nav-btn[data-view="users"]');
  assert.equal(await button.count(),1,'Administration does not contain a Users & Access navigation item.');
  assert.equal(String(await button.textContent()||'').trim(),'Users & Access','The Users navigation item is not labelled Users & Access.');
});

When('I open Users & Access', async function(){
  await openNavView(this,'users');
});

Then('the Users & Access page should be displayed', async function(){
  const view=this.page.locator('#users.view.active');
  await waitFor(async()=>await view.count()===1);
  assert.equal(String(await view.locator(':scope > .hero h1').textContent()||'').trim(),'Users & Access','The Users & Access page heading is incorrect.');
});

Then('the user administration surface should expose identity, access and status information', async function(){
  const content=this.page.locator('#usersContent');
  await waitFor(async()=>await content.count()===1);
  const table=content.locator('table.users-table');
  if(await table.count()===1){
    const headings=(await table.locator('thead th').allTextContents()).map(x=>x.trim());
    for(const expected of ['User','Company / Entra account','Google email','Access','Status']){
      assert.ok(headings.includes(expected),`Users & Access is missing the ${expected} column.`);
    }
    assert.ok(headings.includes('Person'),'Users & Access does not expose the linked Person relationship.');
  }else{
    const text=String(await content.textContent()||'');
    assert.ok(/Workspace not claimed|Current sign-in|not signed in/i.test(text),'Users & Access rendered neither its administration table nor an expected access/bootstrap state.');
  }
});

When('I open People', async function(){
  await openNavView(this,'team');
});

Then('People should expose AMO access separately from the Person record', async function(){
  const view=this.page.locator('#team.view.active');
  await waitFor(async()=>await view.count()===1);
  await waitFor(async()=>String(await view.textContent()||'').includes('AMO access'),{timeout:5000});
  const text=String(await view.textContent()||'');
  assert.ok(text.includes('AMO access'),'People does not expose the Person-to-User relationship as AMO access.');
});

Then('People should provide a Manage Users & Access action', async function(){
  const action=this.page.locator('#teamToolbar [data-manage-amo-access]');
  await waitFor(async()=>await action.count()===1);
  assert.equal(String(await action.textContent()||'').trim(),'Manage Users & Access','People does not provide the expected Users & Access management action.');
});

When('I choose Manage Users & Access', async function(){
  const action=this.page.locator('#teamToolbar [data-manage-amo-access]');
  await clickControl(action);
  await waitFor(async()=>await this.page.locator('#users.view.active').count()===1);
});
