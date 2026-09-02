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

async function modalReport(page){
  const report=page.locator('#recordModalBackdrop.open #statusModalReportContent .shared-report-renderer');
  await waitFor(async()=>await report.count()===1);
  return report
}

When('I present the acceptance fixture as the latest published report', async function(){
  await this.page.evaluate(()=>{
    statusReports.splice(0,statusReports.length,structuredClone(window.__amoStatusAcceptanceFixture));
    renderLatestReportCard();
  });
});

Then('the Latest Report card should show its published date and direct report actions', async function(){
  const card=this.page.locator('#latestStatusReport .latest-status-report-card');
  await waitFor(async()=>await card.count()===1);
  const expectedDate=await this.page.evaluate(()=>new Date(window.__amoStatusAcceptanceFixture.publishedAt).toLocaleString());
  const text=String(await card.textContent()||'');
  assert.ok(text.includes('Latest published report'),'Latest Report does not identify the latest published report.');
  assert.ok(text.includes(expectedDate),'Latest Report does not show the published date/time.');
  assert.ok(text.includes('Revision 3'),'Latest Report does not show the report revision.');
  assert.equal(await card.locator('#viewLatestStatus').count(),1,'Latest Report is missing View.');
  assert.equal(await card.locator('#openLatestStatus').count(),1,'Latest Report is missing Open Report.');
});

Then('Draft Preview should expose one Open Report action', async function(){
  const button=this.page.locator('#recordModalBackdrop.open #statusOpenReport');
  assert.equal(await button.count(),1,'Draft Preview should expose exactly one Open Report action.');
  assert.equal(String(await button.textContent()||'').trim(),'Open Report ↗');
});

Then('Draft Open Report should target a temporary standalone preview', async function(){
  const opened=await this.page.evaluate(async()=>{
    let target='';const original=window.open;
    window.open=url=>{target=String(url||'');return null};
    try{document.getElementById('statusOpenReport')?.click();await Promise.resolve();return target}finally{window.open=original}
  });
  const url=new URL(opened);
  assert.equal(url.pathname,'/reports/preview','Draft Open Report should use the standalone preview route.');
  const token=url.searchParams.get('preview');
  assert.ok(token,'Draft Open Report did not include a temporary preview token.');
  const stored=await this.page.evaluate(token=>localStorage.getItem(`amo.statusReportPreview.${token}`),token);
  assert.ok(stored,'Draft Open Report did not stage the composed preview snapshot for the standalone viewer.');
  await this.page.evaluate(token=>localStorage.removeItem(`amo.statusReportPreview.${token}`),token);
});

When('the application page scope is Department Beta', async function(){
  await this.page.evaluate(()=>{
    const api=window.amoOrganizationHierarchy;
    window.__amoAcceptancePageScope={departmentId:'DEPT-B',teamId:'TEAM-B1'};
    api.selectedDepartment=()=>window.__amoAcceptancePageScope.departmentId;
    api.selectedTeam=()=>window.__amoAcceptancePageScope.teamId;
  });
});

Then('the modal report scope should start organisation-wide', async function(){
  const department=this.page.locator('#recordModalBackdrop.open #statusModalDepartment');
  const team=this.page.locator('#recordModalBackdrop.open #statusModalTeam');
  await waitFor(async()=>await department.count()===1&&await team.count()===1);
  assert.equal(await department.inputValue(),'organization','Modal Department scope inherited the page scope instead of starting organisation-wide.');
  assert.equal(await team.inputValue(),'department','Modal Team scope did not start at All teams.');
  assert.equal(await team.isDisabled(),true,'Team should be disabled only while the modal is organisation-wide.');
});

When('I scope the modal report to Department Alpha and Team Alpha One', async function(){
  const department=this.page.locator('#recordModalBackdrop.open #statusModalDepartment');
  const team=this.page.locator('#recordModalBackdrop.open #statusModalTeam');
  await waitFor(async()=>await department.count()===1&&await team.count()===1&&await department.isVisible()&&await team.isVisible());
  const departmentValues=await department.locator('option').evaluateAll(options=>options.map(option=>option.value));
  assert.ok(departmentValues.includes('DEPT-A'),'Modal Department scope does not offer Department Alpha.');
  await department.evaluate(element=>{element.value='DEPT-A';element.dispatchEvent(new Event('change',{bubbles:true}))});
  await waitFor(async()=>await department.inputValue()==='DEPT-A'&&!await team.isDisabled());
  const teamValues=await team.locator('option').evaluateAll(options=>options.map(option=>option.value));
  assert.ok(teamValues.includes('TEAM-A1'),'Modal Team scope does not offer Team Alpha One after selecting Department Alpha.');
  await team.evaluate(element=>{element.value='TEAM-A1';element.dispatchEvent(new Event('change',{bubbles:true}))});
  await waitFor(async()=>await team.inputValue()==='TEAM-A1');
  const report=await modalReport(this.page);
  await waitFor(async()=>{const text=String(await report.textContent()||'');return text.includes('Demand Alpha')&&!text.includes('Demand Beta')});
});

Then('the modal report should contain only Demand Alpha', async function(){
  const report=await modalReport(this.page),entries=report.locator('.report-entry');
  await waitFor(async()=>await entries.count()===1);
  const text=String(await report.textContent()||'');
  assert.ok(text.includes('Demand Alpha'),'Modal Team scope does not contain Demand Alpha.');
  assert.ok(!text.includes('Demand Beta'),'Modal Team scope contains Demand Beta from another Team.');
});

Then('the application page scope should remain Department Beta', async function(){
  const scope=await this.page.evaluate(()=>({departmentId:window.amoOrganizationHierarchy.selectedDepartment(),teamId:window.amoOrganizationHierarchy.selectedTeam()}));
  assert.deepEqual(scope,{departmentId:'DEPT-B',teamId:'TEAM-B1'},'Changing modal scope changed the application page scope.');
});
