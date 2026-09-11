const assert=require('node:assert/strict');

const required=name=>{
  const value=String(process.env[name]||'').trim();
  assert.ok(value,`${name} must be configured.`);
  return value.replace(/\/+$/,'');
};
const numberEnv=(name,fallback)=>{
  const value=Number.parseInt(process.env[name]||String(fallback),10);
  return Number.isFinite(value)&&value>0?value:fallback;
};
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));

const baseUrl=required('E2E_BASE_URL');
const apiBaseUrl=required('E2E_API_BASE_URL');
const expectedClient=required('E2E_EXPECTED_CLIENT_VERSION');
const expectedBackend=required('E2E_EXPECTED_BACKEND_VERSION');
const expectedApi=required('E2E_EXPECTED_API_VERSION');
const attempts=numberEnv('E2E_READINESS_ATTEMPTS',12);
const requestTimeout=numberEnv('E2E_READINESS_REQUEST_TIMEOUT',5000);
const delay=numberEnv('E2E_READINESS_DELAY',3000);

async function get(url,accept){
  const response=await fetch(url,{
    headers:accept?{Accept:accept}:undefined,
    signal:AbortSignal.timeout(requestTimeout),
    cache:'no-store'
  });
  if(!response.ok)throw new Error(`${url} returned HTTP ${response.status}`);
  return response;
}

async function check(){
  const shell=await get(`${baseUrl}/`,'text/html');
  await shell.text();

  const targetStage=await get(`${baseUrl}/app-target-stage.js`,'text/javascript');
  const targetStageText=await targetStage.text();
  const clientMatch=targetStageText.match(/const APP_VERSION='([^']+)'/);
  if(!clientMatch)throw new Error('Could not resolve APP_VERSION from deployed app-target-stage.js.');
  if(clientMatch[1]!==expectedClient)throw new Error(`Client is ${clientMatch[1]}, waiting for ${expectedClient}.`);

  const infoResponse=await get(`${apiBaseUrl}/api/info`,'application/json');
  const info=await infoResponse.json();
  if(String(info.backendVersion||'')!==expectedBackend)throw new Error(`Backend is ${info.backendVersion||'not reported'}, waiting for ${expectedBackend}.`);
  if(String(info.apiVersion||'')!==expectedApi)throw new Error(`API is ${info.apiVersion||'not reported'}, waiting for ${expectedApi}.`);
  return info;
}

(async()=>{
  let lastError;
  for(let attempt=1;attempt<=attempts;attempt++){
    try{
      await check();
      console.log(`Deployed candidate is ready after attempt ${attempt}: Client ${expectedClient} · Backend ${expectedBackend} · API ${expectedApi}`);
      return;
    }catch(error){
      lastError=error;
      console.log(`Readiness attempt ${attempt}/${attempts} not ready: ${error.message}`);
      if(attempt<attempts)await sleep(delay);
    }
  }
  console.error(`Deployed candidate did not become ready: ${lastError?.message||lastError}`);
  process.exitCode=1;
})();
