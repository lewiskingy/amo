const fs=require('fs'),vm=require('vm'),assert=require('assert');

(async()=>{
  const rendered='<div class="report-card shared-report-renderer"><h1>Architecture Status Report</h1><p>Published narrative</p></div>';
  const context={
    console,
    window:{
      workspaceRepository:{mode:'local'},
      indexedDB:null,
      AmoReportRenderer:{renderReport:()=>rendered}
    },
    fetch:async path=>({ok:true,text:async()=>String(path).includes('report-viewer')?'.shared-report-renderer{display:block}':':root{--bg:#fff;--ink:#111}'}),
    Date,
    setTimeout,
    clearTimeout
  };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync('src/app-status-report-publication.js','utf8'),context);
  const publication=context.window.AmoStatusReportPublication;
  assert.ok(publication,'publication capability should be exported');

  // Remembered-target discovery is deliberately asynchronous. Give its promise chain one event-loop
  // turn to settle rather than asserting against the transient module-initialisation state.
  await new Promise(resolve=>setImmediate(resolve));
  assert.deepEqual(JSON.parse(JSON.stringify(publication.localTargetInfo())),{loaded:true,selected:false,name:''});
  const selectedHandle={name:'Board Status Reports'};
  context.window.showDirectoryPicker=async()=>selectedHandle;
  const changed=await publication.changeLocalTarget();
  assert.equal(changed,selectedHandle);
  assert.deepEqual(JSON.parse(JSON.stringify(publication.localTargetInfo())),{loaded:true,selected:true,name:'Board Status Reports'});

  const report={id:'SR-20260908-201530',revision:2,status:'Published',publishedAt:'2026-09-08T20:15:30Z'};
  assert.equal(publication.fileNameFor(report),'SR-20260908-201530-r02.html');
  const metadata=publication.metadataFor(report,{name:'Architecture Reports'});
  assert.equal(metadata.format,'html');
  assert.equal(metadata.provider,'local-directory');
  assert.equal(metadata.targetName,'Architecture Reports');
  assert.equal(metadata.fileName,'SR-20260908-201530-r02.html');

  const html=await publication.selfContainedHtml(report);
  assert.match(html,/<!doctype html>/i);
  assert.match(html,/Architecture Status Report/);
  assert.match(html,/Published narrative/);
  assert.match(html,/shared-report-renderer\{display:block\}/);
  assert.doesNotMatch(html,/<script/i,'published HTML should not depend on executable AMO scripts');
  assert.doesNotMatch(html,/<link/i,'published HTML should not depend on external stylesheets');

  assert.match(publication.remotePublicationNotice(),/JSON snapshot has been saved/i);
  assert.match(publication.remotePublicationNotice(),/PDF publication is not enabled yet/i);
  console.log('Status Report publication tests passed');
})().catch(error=>{console.error(error);process.exitCode=1});
