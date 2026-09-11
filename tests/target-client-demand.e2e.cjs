const assert=require('node:assert/strict');const {spawn}=require('node:child_process');const {chromium}=require('playwright');
(async()=>{const server=spawn(process.execPath,['tests/e2e/bin/serve-target-client.cjs'],{stdio:['ignore','pipe','inherit']});try{
  await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('Local target-client server did not start.')),5000);server.stdout.on('data',chunk=>{if(String(chunk).includes('listening')){clearTimeout(timer);resolve()}});server.on('exit',code=>reject(new Error(`Server exited ${code}`))) });
  const browser=await chromium.launch({headless:true});const context=await browser.newContext();const page=await context.newPage();await page.goto('http://127.0.0.1:4173/demand?e2e=1');await page.waitForSelector('.demand-row');
  const ids=()=>page.locator('.demand-row').evaluateAll(rows=>rows.map(r=>r.dataset.demandId));
  assert.deepEqual(await ids(),['DEM-2026-0001','DEM-2026-0002']);
  await page.selectOption('[data-filter="projectNumber"]','present');assert.deepEqual(await ids(),['DEM-2026-0001']);assert.match(await page.locator('#demandCount').textContent(),/Showing 1/);
  await page.selectOption('[data-filter="control"]','funding-missing');assert.deepEqual(await ids(),[],'Combined filters must be a true intersection.');
  await page.click('[data-clear]');await page.selectOption('[data-filter="control"]','actuals-missing');assert.deepEqual(await ids(),['DEM-2026-0002'],'Actuals missing must derive from the latest available period and due allocations.');assert.match(await page.locator('.demand-row[data-demand-id="DEM-2026-0002"]').innerHTML(),/Actuals missing/);
  await page.click('[data-clear]');await page.selectOption('[data-filter="show"]','all');assert.deepEqual(await ids(),['DEM-2026-0001','DEM-2026-0002','DEM-2026-0003']);

  await page.selectOption('[data-scope-mode]','team');await page.selectOption('[data-team]','TEAM-B');assert.deepEqual(await ids(),['DEM-2026-0003'],'Team scope must honour canonical teamId records.');
  await page.selectOption('[data-scope-mode]','department');await page.selectOption('[data-department]','DEP-B');assert.deepEqual(await ids(),['DEM-2026-0003'],'Department scope must resolve configured team membership.');
  await page.selectOption('[data-scope-mode]','all');await page.selectOption('[data-filter="show"]','active');

  await page.click('.demand-row[data-demand-id="DEM-2026-0001"] .tree-toggle');assert.equal(await page.locator('.work-package-row[data-work-package-id="WP-1"]').count(),1);const workItemLink=page.locator('.work-package-row[data-work-package-id="WP-1"] a');assert.equal(await workItemLink.textContent(),'#9001');assert.equal(await workItemLink.getAttribute('href'),'https://dev.azure.com/amo-test/Architecture/_workitems/edit/9001');
  await page.click('.demand-row[data-demand-id="DEM-2026-0001"] [data-edit]');await page.fill('dialog input[name="title"]','Persisted edited title');await page.click('dialog [data-save]');await page.locator('dialog').waitFor({state:'hidden'});await page.reload();await page.waitForSelector('.demand-row');assert.match(await page.locator('.demand-row[data-demand-id="DEM-2026-0001"] .row-title').textContent(),/Persisted edited title/,'Edit must survive browser reload.');
  await page.click('[data-action="new"]');await page.fill('dialog input[name="title"]','Created by deterministic E2E');await page.selectOption('dialog select[name="businessArea"]','Customer');await page.click('dialog [data-save]');await page.locator('dialog').waitFor({state:'hidden'});assert.equal(await page.locator('.demand-row[data-demand-id="DEM-2026-0004"]').count(),1);await page.reload();await page.waitForSelector('.demand-row[data-demand-id="DEM-2026-0004"]');assert.match(await page.locator('.demand-row[data-demand-id="DEM-2026-0004"] .row-title').textContent(),/Created by deterministic E2E/,'Created Demand must survive reload.');

  await page.setViewportSize({width:390,height:844});await page.reload();await page.waitForSelector('.demand-row');assert.equal(await page.locator('.target-client-app').count(),1,'Demand must remain available at mobile viewport.');
  await browser.close();console.log('Target client Demand browser E2E passed.');
}finally{server.kill('SIGTERM')}})().catch(error=>{console.error(error);process.exit(1)});
