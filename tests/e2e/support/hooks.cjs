const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
const { BeforeAll, AfterAll, Before, After, Status, setDefaultTimeout } = require('@cucumber/cucumber');

/* Deployed acceptance exercises real browser navigation and remote startup. Keep individual
   assertions bounded, but do not let Cucumber's 5s default terminate a step before those
   explicit waits can report the actual failure. */
setDefaultTimeout(15000);

let browser;

function viewportOptions(){
  return process.env.E2E_PROFILE === 'mobile'
    ? { viewport:{width:390,height:844}, isMobile:true, hasTouch:true }
    : { viewport:{width:1440,height:1000} };
}

function artifactName(name){
  return String(name||'scenario').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
}

BeforeAll(async()=>{
  browser=await chromium.launch({headless:true});
  fs.mkdirSync(path.resolve('artifacts'),{recursive:true});
});

Before(async function(){
  this.browser=browser;
  this.browserErrors=[];
  this.context=await browser.newContext(viewportOptions());
  this.page=await this.context.newPage();
  /* Uncaught application failures are release blockers. Third-party console errors are deliberately
     not treated as failures because identity providers and browser extensions can emit noisy logs. */
  this.page.on('pageerror',error=>this.browserErrors.push(`pageerror: ${error.message}`));
});

After(async function(scenario){
  try{
    if(scenario.result?.status===Status.FAILED||this.browserErrors.length){
      const filename=path.resolve('artifacts',`${process.env.E2E_PROFILE||'desktop'}-${artifactName(scenario.pickle.name)}.png`);
      await this.page?.screenshot({path:filename,fullPage:true}).catch(()=>{});
    }
    if(this.browserErrors.length){
      throw new Error(`Uncaught browser errors detected:\n${this.browserErrors.join('\n')}`);
    }
  }finally{
    await this.context?.close();
  }
});

AfterAll(async()=>{
  await browser?.close();
});
