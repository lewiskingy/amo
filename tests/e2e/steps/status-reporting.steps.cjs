const assert = require('node:assert/strict');
const { When, Then } = require('@cucumber/cucumber');

async function waitFor(fn,{timeout=5000,interval=100}={}){
  const started=Date.now();let last;
  while(Date.now()-started<timeout){
    try{const value=await fn();if(value)return value}catch(error){last=error}
    await new Promise(resolve=>setTimeout(resolve,interval));
  }
  if(last)throw last;
  throw new Error(`Condition was not met within ${timeout}ms.`);
}

async function ensureMobileNavOpen(page){
  const toggle=page.locator('#amoMobileNavToggle');
  if(await toggle.count()!==1)return;
  if(await toggle.getAttribute('aria-expanded')!=='true')await toggle.click();
  await waitFor(async()=>await toggle.getAttribute('aria-expanded')==='true');
}

When('I open Status Report', async function(){
  if((process.env.E2E_PROFILE||'desktop')==='mobile')await ensureMobileNavOpen(this.page);
  const button=this.page.locator('.sidebar .nav-btn[data-view="status-report"]');
  await waitFor(async()=>await button.count()===1);
  const group=button.locator('xpath=ancestor::details[1]');
  if(await group.count()===1&&!await group.evaluate(node=>node.open))await group.evaluate(node=>{node.open=true});
  await button.evaluate(element=>element.click());
  await waitFor(async()=>await this.page.locator('#status-report.view.active').count()===1);
});

Then('the Status Report authoring page should be displayed', async function(){
  const view=this.page.locator('#status-report.view.active');
  await waitFor(async()=>await view.count()===1);
  assert.equal(String(await view.locator(':scope > .hero h1').textContent()||'').trim(),'Status Report');
  const headingTexts=(await view.locator(':scope > .section-title h2').allTextContents()).map(x=>x.trim());
  assert.ok(headingTexts.includes('Architecture Status Report'),'The authoring table is not presented as the Architecture Status Report.');
  assert.equal(await view.locator('#statusReportTable').count(),1,'The Status Report authoring table is missing.');
});

Then('the Status Report authoring page should not contain dashboard portfolio metrics', async function(){
  const view=this.page.locator('#status-report.view.active');
  assert.equal(await view.locator('#statusDashboardSnapshot').count(),0,'Dashboard portfolio snapshot is still rendered on Status Report.');
  const headings=(await view.locator('h2,h3').allTextContents()).map(x=>x.trim());
  for(const dashboardHeading of ['Portfolio Snapshot','Demand highlights','Capacity outlook','Portfolio forecast','Allocation outlook']){
    assert.ok(!headings.includes(dashboardHeading),`Status Report still contains dashboard section ${dashboardHeading}.`);
  }
});
