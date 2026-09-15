const assert=require('node:assert/strict');
const {When,Then}=require('@cucumber/cucumber');

const uiTimeout=()=>Number(process.env.E2E_UI_TIMEOUT||10000);
async function waitFor(fn,timeout=uiTimeout()){
  const started=Date.now();let last;
  while(Date.now()-started<timeout){
    try{const value=await fn();if(value)return value}catch(error){last=error}
    await new Promise(resolve=>setTimeout(resolve,100));
  }
  if(last)throw last;
  throw new Error(`Condition was not met within ${timeout}ms.`);
}

When('I open the Demand route',async function(){
  const response=await this.page.goto(`${this.baseUrl}/demand`,{waitUntil:'domcontentloaded'});
  assert.ok(response,'No response received from the /demand route.');
  assert.ok(response.ok(),`/demand returned HTTP ${response.status()}.`);
});

When('I open the Demand route for control {string}',async function(control){
  const response=await this.page.goto(`${this.baseUrl}/demand?control=${encodeURIComponent(control)}`,{waitUntil:'domcontentloaded'});
  assert.ok(response,'No response received from the /demand deep link.');
  assert.ok(response.ok(),`/demand deep link returned HTTP ${response.status()}.`);
});

Then('the target Demand shell should be displayed',async function(){
  await waitFor(async()=>await this.page.locator('.target-client-app').count()===1);
  assert.equal(String(await this.page.locator('#pageHeader h1').textContent()||'').trim(),'Demand Register');
  assert.equal(await this.page.locator('.amo-shell-sidebar a[href="/demand"].active').count(),1,'The strategic Demand route is not active in the shared target shell.');
});

Then('the deployed Demand route should connect to Remote Workspace',async function(){
  const status=this.page.locator('#workspaceStatus');
  await waitFor(async()=>/Remote Workspace connected/i.test(String(await status.textContent()||'')),Number(process.env.E2E_APP_TIMEOUT||12000));
  assert.ok(await this.page.locator('#demandFilters [data-filter]').count()>0,'Canonical Demand filters were not initialised from the deployed workspace.');
});

Then('the Demand loading state should be cleared',async function(){
  await waitFor(async()=>await this.page.locator('#demandAppState').isHidden());
  assert.doesNotMatch(String(await this.page.locator('#demandAppState').textContent()||''),/Loading Demand/i,'Loading Demand remained after the route was ready.');
});

Then('the target navigation should show version, account and workspace context',async function(){
  assert.match(String(await this.page.locator('#amoShellVersion').textContent()||''),/Client\s+\S+.*Schema\s+\S+/,'Client/schema identity is missing from target navigation.');
  assert.equal(await this.page.locator('#amoShellAccount').count(),1,'Target navigation has no account/sign-in area.');
  assert.equal(await this.page.locator('#workspaceSwitcher').evaluate(el=>el.parentElement?.id),'amoShellWorkspace','Workspace selection is not hosted in the target navigation panel.');
  assert.ok(await this.page.locator('.amo-shell-nav-group').count()>=3,'Target navigation has not converged to Reporting, Management and Admin groups.');
});

Then('the Demand control filter should be {string}',async function(control){
  await waitFor(async()=>await this.page.inputValue('[data-filter="control"]')===control);
  assert.match(this.page.url(),new RegExp(`control=${control}`));
});

When('I type {string} into the Demand search filter',async function(value){
  const search=this.page.locator('[data-filter="search"]');await search.focus();await search.type(value,{delay:20});this.expectedDemandSearch=value;
});

Then('the Demand search should apply after a short pause and retain keyboard focus',async function(){
  const value=this.expectedDemandSearch||'';
  await waitFor(async()=>new URL(this.page.url()).searchParams.get('search')===value,3000);
  assert.equal(await this.page.evaluate(()=>document.activeElement?.dataset?.filter),'search','Demand search lost keyboard focus after its debounced render.');
  assert.equal(await this.page.locator('[data-filter="search"]').evaluate(el=>el.selectionStart),value.length,'Demand search cursor did not return to the typed position.');
});

Then('the legacy Demand view should not be the rendered page',async function(){
  assert.equal(await this.page.locator('#demand.view').count(),0,'The /demand route rendered the legacy in-page Demand implementation.');
  assert.equal(await this.page.locator('#demandFilters').count(),1,'The canonical Demand filter component host is missing.');
});
