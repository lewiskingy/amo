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

When('I open the dark-launched Demand route',async function(){
  const response=await this.page.goto(`${this.baseUrl}/demand`,{waitUntil:'domcontentloaded'});
  assert.ok(response,'No response received from the /demand route.');
  assert.ok(response.ok(),`/demand returned HTTP ${response.status()}.`);
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

Then('the Demand route should identify itself as a dark launch',async function(){
  const note=this.page.locator('.migration-note');
  await waitFor(async()=>await note.count()===1);
  assert.match(String(await note.textContent()||''),/Dark launch/i);
});

Then('the legacy Demand view should not be the rendered page',async function(){
  assert.equal(await this.page.locator('#demand.view').count(),0,'The /demand route rendered the legacy in-page Demand implementation.');
  assert.equal(await this.page.locator('#demandFilters').count(),1,'The canonical Demand filter component host is missing.');
});
