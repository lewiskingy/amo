/* Status Report publication capability.
   Local Workspace publishes a self-contained HTML artefact to a user-authorised directory.
   Remote Workspace persists report JSON only until server-side PDF publication is enabled. */
(function initStatusReportPublication(){
  if(window.AmoStatusReportPublication)return;

  const DB_NAME='amo-publication-targets',STORE='handles',HANDLE_KEY='status-report-publication',TARGET_EVENT='amo:status-report-publication-target';
  let cachedHandle=null,handleLoaded=false;

  function notifyTargetChanged(){
    if(typeof window.dispatchEvent!=='function'||typeof CustomEvent==='undefined')return;
    window.dispatchEvent(new CustomEvent(TARGET_EVENT,{detail:localTargetInfo()}))
  }
  function localTargetInfo(){return{loaded:handleLoaded,selected:!!cachedHandle,name:cachedHandle?.name||''}}
  function openDb(){
    return new Promise((resolve,reject)=>{
      if(!window.indexedDB){reject(new Error('This browser cannot remember the publication folder.'));return}
      const req=indexedDB.open(DB_NAME,1);
      req.onupgradeneeded=()=>{if(!req.result.objectStoreNames.contains(STORE))req.result.createObjectStore(STORE)};
      req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error||new Error('Could not open publication target storage.'))
    })
  }
  async function readRememberedHandle(){
    const db=await openDb();try{return await new Promise((resolve,reject)=>{const req=db.transaction(STORE,'readonly').objectStore(STORE).get(HANDLE_KEY);req.onsuccess=()=>resolve(req.result||null);req.onerror=()=>reject(req.error)})}finally{db.close()}
  }
  async function rememberHandle(handle){
    try{const db=await openDb();try{await new Promise((resolve,reject)=>{const req=db.transaction(STORE,'readwrite').objectStore(STORE).put(handle,HANDLE_KEY);req.onsuccess=()=>resolve();req.onerror=()=>reject(req.error)})}finally{db.close()}}catch(e){console.warn('Could not persist Status Report publication directory handle.',e)}
  }
  async function forgetHandle(){
    cachedHandle=null;try{const db=await openDb();try{await new Promise((resolve,reject)=>{const req=db.transaction(STORE,'readwrite').objectStore(STORE).delete(HANDLE_KEY);req.onsuccess=()=>resolve();req.onerror=()=>reject(req.error)})}finally{db.close()}}catch(_e){}finally{notifyTargetChanged()}
  }
  readRememberedHandle().then(handle=>{cachedHandle=handle;handleLoaded=true;notifyTargetChanged()}).catch(()=>{handleLoaded=true;notifyTargetChanged()});

  async function pickLocalTarget({cancelIsError=false}={}){
    if(window.workspaceRepository?.mode!=='local')throw new Error('A Local Workspace is required for client-side HTML publication.');
    if(typeof window.showDirectoryPicker!=='function')throw new Error('Local HTML publication requires a browser that supports selecting a writable folder.');
    let handle;
    try{handle=await window.showDirectoryPicker({id:'amo-status-report-publication',mode:'readwrite'})}
    catch(e){if(e?.name==='AbortError'){if(cancelIsError)throw new Error('Publication folder selection was cancelled.');return null}throw e}
    cachedHandle=handle;handleLoaded=true;await rememberHandle(handle);notifyTargetChanged();return handle
  }
  async function changeLocalTarget(){return pickLocalTarget({cancelIsError:false})}
  async function prepareLocalTarget(){
    if(window.workspaceRepository?.mode!=='local')throw new Error('A Local Workspace is required for client-side HTML publication.');
    if(cachedHandle){
      let permission='prompt';
      try{
        if(typeof cachedHandle.queryPermission==='function')permission=await cachedHandle.queryPermission({mode:'readwrite'});
        if(permission==='prompt'&&typeof cachedHandle.requestPermission==='function')permission=await cachedHandle.requestPermission({mode:'readwrite'});
        if(typeof cachedHandle.queryPermission!=='function'&&typeof cachedHandle.requestPermission!=='function')permission='granted'
      }catch(_e){permission='denied'}
      if(permission==='granted')return cachedHandle;
      await forgetHandle()
    }
    return pickLocalTarget({cancelIsError:true})
  }

  function fileNameFor(report){return `${report.id}-r${String(Number(report.revision)||1).padStart(2,'0')}.html`}
  function metadataFor(report,target){return{revision:Number(report.revision)||1,format:'html',mimeType:'text/html',provider:'local-directory',fileName:fileNameFor(report),targetName:target?.name||'Selected folder',publishedAt:report.publishedAt||new Date().toISOString(),status:'published'}}
  async function stylesheetText(path){const response=await fetch(typeof amoAsset==='function'?amoAsset(path):path,{cache:'no-cache'});if(!response.ok)throw new Error(`Could not load ${path} for self-contained report publication.`);return response.text()}
  async function selfContainedHtml(report){
    if(!window.AmoReportRenderer?.renderReport)throw new Error('The canonical Status Report renderer is unavailable.');
    const [appCss,reportCss]=await Promise.all([stylesheetText('app.css'),stylesheetText('reports/report-viewer.css')]);
    const body=window.AmoReportRenderer.renderReport(report);
    const generated=new Date().toLocaleString('en-GB');
    return `<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width,initial-scale=1">\n<title>${String(report.id||'Architecture Status Report').replace(/[<>&"]/g,'')}</title>\n<style>${appCss}\n${reportCss}\nhtml,body{background:#f4f7fb}.published-report-shell{max-width:1440px;margin:0 auto;padding:24px}.published-report-note{margin:0 0 12px;color:#667085;font-size:.78rem;text-align:right}@media print{.published-report-shell{max-width:none;padding:0}.published-report-note{display:none}*{-webkit-print-color-adjust:exact;print-color-adjust:exact}}\n</style>\n</head>\n<body>\n<main class="published-report-shell">\n<div class="published-report-note">Published by Architecture Management Office · ${generated} · ${report.id} · revision ${Number(report.revision)||1}</div>\n${body}\n</main>\n</body>\n</html>\n`
  }
  async function publishLocal(report,target){
    const metadata=metadataFor(report,target),html=await selfContainedHtml(report),file=await target.getFileHandle(metadata.fileName,{create:true}),writable=await file.createWritable();
    try{await writable.write(html)}finally{await writable.close()}
    return metadata
  }
  async function removeLocal(metadata,target){if(!metadata?.fileName||!target?.removeEntry)return;try{await target.removeEntry(metadata.fileName)}catch(_e){}}
  function remotePublicationNotice(){return 'Status Report published and its JSON snapshot has been saved to the Remote Workspace. Remote PDF publication is not enabled yet.'}

  window.AmoStatusReportPublication={prepareLocalTarget,changeLocalTarget,localTargetInfo,publishLocal,removeLocal,metadataFor,selfContainedHtml,fileNameFor,remotePublicationNotice,TARGET_EVENT};
})();
