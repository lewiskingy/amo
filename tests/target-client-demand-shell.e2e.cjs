const assert=require('node:assert/strict');const {spawn}=require('node:child_process');const {chromium}=require('playwright');
(async()=>{const server=spawn(process.execPath,['tests/e2e/bin/serve-target-client.cjs'],{stdio:['ignore','pipe','inherit']});try{
  await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('Local target-client server did not start.')),5000);server.stdout.on('data',chunk=>{if(String(chunk).includes('listening')){clearTimeout(timer);resolve()}});server.on('exit',code=>reject(new Error(`Server exited ${code}`))) });
  const browser=await chromium.launch({headless:true});const context=await browser.newContext({viewport:{width:1280,height:900}});const page=await context.newPage();
  await page.goto('http://127.0.0.1:4173/demand?e2e=1');await page.waitForSelector('.demand-row');
  const ids=()=>page.locator('.demand-row').evaluateAll(rows=>rows.map(r=>r.dataset.demandId));

  assert.equal(await page.locator('#demandAppState').isVisible(),false,'Loading Demand state must disappear once populated data is rendered.');
  const first=page.locator('.demand-row[data-demand-id="DEM-2026-0001"]');
  assert.equal(String(await first.locator('.demand-title').textContent()).trim(),'Seeded customer change','Demand title must be the primary row label.');
  assert.equal(String(await first.locator('.row-id').textContent()).trim(),'DEM-2026-0001','Demand ID remains available as secondary metadata.');

  await first.locator('.tree-toggle').click();const wp=page.locator('.work-package-row[data-work-package-id="WP-1"]'),link=wp.locator('.wp-title-link');
  assert.match(String(await link.innerText()),/^Tracked package \(#9001\)$/,'Visible Work Package title should append only the Work Item number.');
  assert.equal(await link.evaluate(el=>getComputedStyle(el).fontWeight==='700'||Number(getComputedStyle(el).fontWeight)>=600),true,'Work Package title should be visually emphasised.');

  const search=page.locator('[data-filter="search"]');
  await search.fill('Tracked package');await page.waitForTimeout(150);assert.deepEqual(await ids(),['DEM-2026-0001'],'Search must match Work Package title.');
  await search.fill('9001');await page.waitForTimeout(150);assert.deepEqual(await ids(),['DEM-2026-0001'],'Search must match Azure DevOps Work Item number.');
  await search.fill('8999');await page.waitForTimeout(150);assert.deepEqual(await ids(),[],'Active search must not surface a parent only because a completed Work Package matches.');
  await page.selectOption('[data-filter="show"]','all');assert.deepEqual(await ids(),['DEM-2026-0001'],'Show All should allow search to match a completed Work Package.');
  await page.click('[data-clear]');

  assert.match(String(await page.locator('#amoShellVersion').textContent()),/Client 1\.2\.2.*Schema 3/,'Target sidebar must expose client/schema identity.');
  assert.equal(await page.locator('[data-amo-assistant-target]').isVisible(),true,'Configured AMO Assistant must be available from target navigation.');
  assert.equal(new URL(await page.locator('[data-amo-assistant-target]').getAttribute('href')).origin,'https://assistant.example.test');
  assert.equal(await page.locator('#workspaceSwitcher').evaluate(el=>el.parentElement?.id),'amoShellWorkspace','Workspace selection belongs in the shared navigation panel.');
  assert.match(String(await page.locator('#amoShellAccount').textContent()),/E2E test workspace/,'Target navigation must reserve the signed-in/account area.');
  assert.ok(await page.locator('.amo-shell-nav-group').count()>=3,'Target navigation should expose Reporting, Management and Admin groups.');
  const primaryDemand=page.locator('.amo-shell-nav-group a[href="/demand"]');assert.equal(String(await primaryDemand.textContent()).trim(),'Demand','The canonical /demand route should now be presented as Demand, not Preview.');assert.equal(await primaryDemand.getAttribute('class'),'active');
  const legacyDemand=page.locator('.amo-shell-nav-group a[href="/?view=demand"]');assert.match(String(await legacyDemand.textContent()).replace(/\s+/g,' ').trim(),/^Demand legacy$/,'The legacy Demand implementation must remain available as an explicit fallback link.');

  await page.setViewportSize({width:390,height:844});const menu=page.locator('[data-shell-menu]');assert.equal(await menu.isVisible(),true,'Mobile target layout needs a navigation fly-out trigger.');await menu.click();assert.equal(await page.evaluate(()=>document.body.classList.contains('amo-shell-nav-open')),true,'Mobile navigation should open as a fly-out rather than becoming a top strip.');await page.locator('[data-shell-close]').click();assert.equal(await page.evaluate(()=>document.body.classList.contains('amo-shell-nav-open')),false);
  await browser.close();console.log('Target client Demand shell browser E2E passed.');
}finally{server.kill('SIGTERM')}})().catch(error=>{console.error(error);process.exit(1)});
