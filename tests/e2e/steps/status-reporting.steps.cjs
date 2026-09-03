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

async function waitForStatusAuthoringUi(page){
  await waitFor(async()=>await page.evaluate(()=>window.__amoStatusReportUiLoaded===true),{timeout:5000});
  await waitFor(async()=>{
    const headings=(await page.locator('#status-report .section-title h2').allTextContents()).map(x=>x.trim());
    return headings.includes('Architecture Status Report');
  },{timeout:5000});
}

async function sharedRenderer(page,host='#statusAcceptanceReport'){
  const report=page.locator(`${host} .shared-report-renderer`);
  await waitFor(async()=>await report.count()===1);
  return report;
}

async function renderAcceptanceReport(page,{status='Published',departmentId='organization',teamId='department'}={}){
  await page.evaluate(({status,departmentId,teamId})=>{
    const fixture=structuredClone(window.__amoStatusAcceptanceFixture);
    fixture.status=status;
    if(status==='Draft Preview')delete fixture.id;
    const host=document.getElementById('statusAcceptanceReport')||document.body.appendChild(Object.assign(document.createElement('div'),{id:'statusAcceptanceReport'}));
    const departments={
      'DEPT-A':{id:'DEPT-A',name:'Department Alpha'},
      'DEPT-B':{id:'DEPT-B',name:'Department Beta'}
    };
    const teamsById={
      'TEAM-A1':{id:'TEAM-A1',name:'Team Alpha One',departmentId:'DEPT-A'},
      'TEAM-B1':{id:'TEAM-B1',name:'Team Beta One',departmentId:'DEPT-B'}
    };
    const scope={
      departmentId,
      teamId,
      departmentName:departments[departmentId]?.name||'',
      teamName:teamsById[teamId]?.name||''
    };
    host.innerHTML=window.AmoReportRenderer.renderReport(fixture,{scope,catalog:{teamsById}});
  },{status,departmentId,teamId});
  return sharedRenderer(page);
}

When('I open Status Report', async function(){
  await waitForStatusAuthoringUi(this.page);
  if((process.env.E2E_PROFILE||'desktop')==='mobile')await ensureMobileNavOpen(this.page);
  const button=this.page.locator('.sidebar .nav-btn[data-view="status-report"]');
  await waitFor(async()=>await button.count()===1);
  const group=button.locator('xpath=ancestor::details[1]');
  if(await group.count()===1&&!await group.evaluate(node=>node.open))await group.evaluate(node=>{node.open=true});
  await button.evaluate(element=>element.click());
  await waitFor(async()=>await this.page.locator('#status-report.view.active').count()===1);
  await waitForStatusAuthoringUi(this.page);
});

When('I prepare the Status Report acceptance fixture', async function(){
  /* app-status-report.js defines the legacy modal before app-status-report-ui.js replaces it with
     the canonical shared-renderer implementation. On slower/mobile startup, waiting for merely
     "some" openStatusReportModal can therefore race the canonical module. */
  await waitFor(async()=>await this.page.evaluate(()=>window.__amoStatusReportUiLoaded===true&&!!window.AmoReportRenderer&&typeof window.openStatusReportModal==='function'),{timeout:5000});
  await this.page.evaluate(()=>{
    window.__amoStatusAcceptanceFixture={
      id:'SR-ACCEPTANCE-001',
      status:'Published',
      reportingDate:'2026-09-02',
      publishedAt:'2026-09-02T12:00:00Z',
      revision:3,
      dashboardSnapshot:{
        activeDemand:2,
        unallocated:1,
        capacityOutlook:[{label:'Sep 2026',allocatedFte:4,capacityFte:5,utilisationPct:80}],
        portfolioForecast:{currentForecast:200000,fundedForecast:150000,unfundedForecast:50000,futureAllocated:125000,maturity:{allocations:1,estimate:1,rom:0,none:0}},
        financialOutlook:{rows:[{label:'Sep 2026',capacity:100000,funded:60000,unfunded:20000,remaining:20000}],totals:{capacity:100000,funded:60000,unfunded:20000,remaining:20000}}
      },
      dashboardSnapshots:{
        organization:null,
        departments:{
          'DEPT-A':{activeDemand:1,capacityOutlook:[{label:'Sep 2026',allocatedFte:2,capacityFte:3,utilisationPct:67}]},
          'DEPT-B':{activeDemand:1,capacityOutlook:[{label:'Sep 2026',allocatedFte:2,capacityFte:2,utilisationPct:100}]}
        },
        teams:{
          'TEAM-A1':{activeDemand:17,capacityOutlook:[{label:'Sep 2026',allocatedFte:1,capacityFte:2,utilisationPct:50}]},
          'TEAM-B1':{activeDemand:23,capacityOutlook:[{label:'Sep 2026',allocatedFte:2,capacityFte:2,utilisationPct:100}]}
        }
      },
      entries:[
        {demandId:'DEM-A',title:'Demand Alpha',departmentId:'DEPT-A',departmentName:'Department Alpha',teamId:'TEAM-A1',teamName:'Team Alpha One',owner:'Alice Architect',health:'Amber',statusUpdate:'Alpha status',achievements:'Alpha achievement',issues:'Alpha issue'},
        {demandId:'DEM-B',title:'Demand Beta',departmentId:'DEPT-B',departmentName:'Department Beta',teamId:'TEAM-B1',teamName:'Team Beta One',owner:'Bob Architect',health:'Red',statusUpdate:'Beta status',achievements:'Beta achievement',issues:'Beta issue'}
      ]
    };
    window.__amoStatusAcceptanceFixture.dashboardSnapshots.organization=structuredClone(window.__amoStatusAcceptanceFixture.dashboardSnapshot);
    window.amoOrganizationHierarchy={
      configuredDepartments:()=>[
        {id:'DEPT-A',name:'Department Alpha'},
        {id:'DEPT-B',name:'Department Beta'}
      ],
      selectedDepartment:()=>'organization',
      selectedTeam:()=>'department'
    };
    window.configuredTeams=()=>[
      {id:'TEAM-A1',name:'Team Alpha One',departmentId:'DEPT-A'},
      {id:'TEAM-B1',name:'Team Beta One',departmentId:'DEPT-B'}
    ];
  });
});

When('I preview the acceptance Status Report draft', async function(){
  await this.page.evaluate(async()=>{
    const report=structuredClone(window.__amoStatusAcceptanceFixture);
    delete report.id;delete report.publishedAt;delete report.revision;report.status='Draft Preview';
    await window.openStatusReportModal(report);
  });
  await sharedRenderer(this.page,'#statusModalReportContent');
});

When('I view the acceptance Status Report as Published', async function(){
  await this.page.evaluate(async()=>window.openStatusReportModal(structuredClone(window.__amoStatusAcceptanceFixture)));
  await sharedRenderer(this.page,'#statusModalReportContent');
});

When('I render the acceptance report for the whole organisation', async function(){
  await renderAcceptanceReport(this.page,{departmentId:'organization',teamId:'department'});
});

When('I render the acceptance report for Department Alpha', async function(){
  await renderAcceptanceReport(this.page,{departmentId:'DEPT-A',teamId:'department'});
});

When('I render the acceptance report for Team Alpha One', async function(){
  await renderAcceptanceReport(this.page,{departmentId:'DEPT-A',teamId:'TEAM-A1'});
});

When('I render the acceptance report as Draft Preview', async function(){
  await renderAcceptanceReport(this.page,{status:'Draft Preview'});
});

When('I render the acceptance report as Published', async function(){
  await renderAcceptanceReport(this.page,{status:'Published'});
});

When('I open the standalone acceptance report route', async function(){
  const url=`${this.baseUrl}/reports/SR-ACCEPTANCE-NOT-PERSISTED`;
  const response=await this.page.goto(url,{waitUntil:'domcontentloaded'});
  assert.ok(response,`No response received from ${url}`);
  assert.ok(response.ok(),`Standalone report route returned HTTP ${response.status()}.`);
  await this.page.waitForLoadState('networkidle',{timeout:10000}).catch(()=>{});
});

Then('the Status Report authoring page should be displayed', async function(){
  await waitForStatusAuthoringUi(this.page);
  const view=this.page.locator('#status-report.view.active');
  await waitFor(async()=>await view.count()===1);
  const title=String(await view.locator(':scope > .hero h1').textContent()||'').trim();
  assert.ok(/^Status report$/i.test(title),`Unexpected Status Report page title: ${title}`);
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

Then('the Status Report modal should use the shared report renderer', async function(){
  assert.equal(await this.page.locator('#recordModalBackdrop.open #statusModalReportContent .shared-report-renderer').count(),1,'Status Report modal is not using the shared report renderer.');
});

Then('the report should show portfolio sections and strong Health semantics', async function(){
  const report=await sharedRenderer(this.page,'#statusModalReportContent');
  const headings=(await report.locator('h2').allTextContents()).map(x=>x.trim());
  for(const expected of ['Demand highlights','Capacity outlook','Portfolio forecast','Allocation outlook','Architecture Status Report']){
    assert.ok(headings.includes(expected),`Rendered report is missing ${expected}.`);
  }
  assert.equal(await report.locator('.report-health-summary').count(),1,'Health overview is missing.');
  assert.equal(await report.locator('.report-entry.report-health-amber[data-health="At Risk"]').count(),1,'At Risk report entry does not have strong Health semantics.');
  assert.equal(await report.locator('.report-entry.report-health-red[data-health="Off Track"]').count(),1,'Off Track report entry does not have strong Health semantics.');
});

Then('the report viewer should not expose removed report actions', async function(){
  const modal=this.page.locator('#recordModalBackdrop.open');
  const text=String(await modal.textContent()||'');
  for(const removed of ['Print / Save PDF','Print','Copy Link','Copy Local Link','Maximize']){
    assert.ok(!text.includes(removed),`Removed report action ${removed} is still exposed.`);
  }
});

Then('Draft Preview should not expose Open Report', async function(){
  assert.equal(await this.page.locator('#statusOpenReport').count(),0,'Draft Preview exposes Open Report even though it has no persisted report ID.');
});

Then('Published View should expose one Open Report action', async function(){
  const button=this.page.locator('#statusOpenReport');
  assert.equal(await button.count(),1,'Published View should expose exactly one Open Report action.');
  assert.equal(String(await button.textContent()||'').trim(),'Open Report ↗');
});

Then('Open Report should target the canonical report route', async function(){
  const opened=await this.page.evaluate(async()=>{
    let target='';const original=window.open;
    window.open=url=>{target=String(url||'');return null};
    try{document.getElementById('statusOpenReport')?.click();await Promise.resolve();return target}finally{window.open=original}
  });
  assert.ok(/\/reports\/SR-ACCEPTANCE-001(?:\?|$)/.test(opened),`Open Report did not target the canonical /reports/{id} route: ${opened||'no URL'}`);
});

Then('the scoped report should contain Demand Alpha and Demand Beta', async function(){
  const report=await sharedRenderer(this.page);
  const text=String(await report.textContent()||'');
  assert.ok(text.includes('Demand Alpha'),'Organisation-wide report is missing Demand Alpha.');
  assert.ok(text.includes('Demand Beta'),'Organisation-wide report is missing Demand Beta.');
});

Then('the scoped report should contain Demand Alpha but not Demand Beta', async function(){
  const report=await sharedRenderer(this.page);
  const text=String(await report.textContent()||'');
  assert.ok(text.includes('Demand Alpha'),'Department report is missing Demand Alpha.');
  assert.ok(!text.includes('Demand Beta'),'Department report includes Demand Beta from another Department.');
});

Then('the scoped report should contain only Demand Alpha', async function(){
  const report=await sharedRenderer(this.page);
  const entries=report.locator('.report-entry');
  assert.equal(await entries.count(),1,'Team scope should contain exactly one report entry.');
  const text=String(await entries.first().textContent()||'');
  assert.ok(text.includes('Demand Alpha'),'Team scope does not contain Demand Alpha.');
  assert.ok(!String(await report.textContent()||'').includes('Demand Beta'),'Team scope includes Demand Beta from another Team.');
});

Then('the scoped report should use the persisted Team Alpha One dashboard snapshot', async function(){
  const report=await sharedRenderer(this.page);
  const text=String(await report.textContent()||'').replace(/\s+/g,' ');
  assert.ok(/Active demand\s*17/.test(text),'Team scope did not use the persisted Team Alpha One dashboard snapshot.');
});

Then('I remember the acceptance report content', async function(){
  const report=await sharedRenderer(this.page);
  this.statusAcceptanceContent=await report.evaluate(node=>{
    const clone=node.cloneNode(true);
    clone.querySelector('.report-hero')?.remove();
    return clone.textContent.replace(/\s+/g,' ').trim();
  });
});

Then('the acceptance report content should match the Draft Preview', async function(){
  const report=await sharedRenderer(this.page);
  const published=await report.evaluate(node=>{
    const clone=node.cloneNode(true);
    clone.querySelector('.report-hero')?.remove();
    return clone.textContent.replace(/\s+/g,' ').trim();
  });
  assert.equal(published,this.statusAcceptanceContent,'Published presentation changed the report body compared with Draft Preview.');
});

Then('the standalone report viewer shell should be displayed', async function(){
  await waitFor(async()=>await this.page.locator('.report-viewer-shell').count()===1);
  const body=String(await this.page.locator('body').textContent()||'');
  assert.ok(body.includes('Status Report'),'Standalone /reports route did not render the report viewer shell.');
  assert.equal(await this.page.locator('.sidebar').count(),0,'Standalone /reports route loaded the full workspace navigation shell.');
});

Then('the standalone report viewer should not expose removed report actions', async function(){
  const text=String(await this.page.locator('body').textContent()||'');
  for(const removed of ['Print / Save PDF','Copy Link','Copy Local Link','Maximize']){
    assert.ok(!text.includes(removed),`Standalone report viewer still exposes removed action ${removed}.`);
  }
});
