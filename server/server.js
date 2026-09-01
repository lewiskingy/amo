import http from 'node:http';
import { readFileSync } from 'node:fs';
import { URL } from 'node:url';
import { ServerJsonWorkspaceRepository } from './repository.js';
import { MongoWorkspaceRepository } from './mongo-repository.js';
import { openApiDocument, swaggerHtml } from './openapi.js';

const PORT=Number(process.env.PORT||8080);
const WORKSPACE_ROOT=process.env.AMO_WORKSPACE_ROOT||'/data/workspace';
const REPOSITORY_MODE=String(process.env.AMO_REPOSITORY||'json').toLowerCase();
const API_VERSION='2';
const packageInfo=JSON.parse(readFileSync(new URL('./package.json',import.meta.url),'utf8'));
const BACKEND_VERSION=String(packageInfo.version||'unknown');
const BACKEND_BUILD=String(process.env.AMO_BUILD_ID||'').trim()||null;
const allowedOrigins=(process.env.AMO_ALLOWED_ORIGINS||'').split(',').map(x=>x.trim()).filter(Boolean);
const repo=REPOSITORY_MODE==='mongo'
  ?new MongoWorkspaceRepository({connectionString:process.env.AMO_MONGO_CONNECTION_STRING,databaseName:process.env.AMO_MONGO_DATABASE||'amo'})
  :new ServerJsonWorkspaceRepository(WORKSPACE_ROOT);
repo.storage=repo.storage||(REPOSITORY_MODE==='mongo'?'mongodb':'json-filesystem');

function cors(req,res){const origin=req.headers.origin;if(origin&&(!allowedOrigins.length||allowedOrigins.includes(origin))){res.setHeader('Access-Control-Allow-Origin',origin);res.setHeader('Vary','Origin')}res.setHeader('Access-Control-Allow-Headers','Content-Type,Authorization,If-Match,X-AMO-Actor');res.setHeader('Access-Control-Allow-Methods','GET,POST,PUT,DELETE,OPTIONS')}
function send(res,status,data,headers={}){const payload=data==null?'':JSON.stringify(data);res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store',...headers});res.end(payload)}
function sendHtml(res,status,html){res.writeHead(status,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'});res.end(html)}
async function body(req){let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>10_000_000)throw new Error('Request body too large.')}return raw?JSON.parse(raw):{}}
function parts(pathname){return pathname.split('/').filter(Boolean).map(decodeURIComponent)}
function actor(req){return String(req.headers['x-amo-actor']||'Remote user').slice(0,200)}
function expectedVersion(req){const raw=String(req.headers['if-match']||'').replace(/^W\//,'').replace(/^"|"$/g,'');return /^\d+$/.test(raw)?Number(raw):undefined}
function meta(url){return url.searchParams.get('meta')==='1'||url.searchParams.get('includeVersion')==='true'}

const bootstrap=await repo.ensureWorkspace();
console.log(bootstrap.created?`Bootstrapped new AMO ${repo.storage} workspace.`:`Using existing AMO ${repo.storage} workspace.`);

const server=http.createServer(async(req,res)=>{
  cors(req,res);if(req.method==='OPTIONS'){res.writeHead(204);res.end();return}
  const url=new URL(req.url,'http://localhost');const p=parts(url.pathname);
  try{
    if(req.method==='GET'&&url.pathname==='/openapi.json')return send(res,200,openApiDocument(req));
    if(req.method==='GET'&&(url.pathname==='/swagger'||url.pathname==='/swagger/'))return sendHtml(res,200,swaggerHtml());
    if(req.method==='GET'&&url.pathname==='/api/info'){
      let workspace=null;try{workspace=await repo.connect()}catch{}
      const mongo=repo.storage==='mongodb';return send(res,200,{product:'AMO',backendVersion:BACKEND_VERSION,backendBuild:BACKEND_BUILD,apiVersion:API_VERSION,storage:repo.storage,workspaceName:workspace?.name||null,initialized:Boolean(workspace),capabilities:{records:true,statusReports:true,locking:!mongo,commitLocking:true,archive:true,bulkSave:true,optimisticConcurrency:mongo,databaseTransactions:mongo,recovery:mongo,auditRetentionDays:mongo?28:null,managedBackup:mongo?'cosmos-continuous':null}})
    }
    if(req.method==='GET'&&url.pathname==='/api/workspace')return send(res,200,await repo.loadWorkspace());
    if(req.method==='POST'&&url.pathname==='/api/workspace/save'){const result=await repo.saveChanges(await body(req),{actor:actor(req)});return send(res,200,{ok:true,...(result||{})})}
    if(p[0]==='api'&&p[1]==='records'&&p[2]){
      const type=p[2],id=p[3];
      if(req.method==='GET'&&!id)return send(res,200,await repo.listRecords(type));
      if(req.method==='GET'&&id){if(meta(url)&&repo.getRecordWithVersion)return send(res,200,await repo.getRecordWithVersion(type,id));return send(res,200,await repo.getRecord(type,id))}
      if(req.method==='PUT'&&id){const record=await body(req);record.id=record.id||id;const result=await repo.saveRecord(type,record,{expectedVersion:expectedVersion(req),actor:actor(req)});return send(res,200,{ok:true,...(result||{})})}
      if(req.method==='DELETE'&&id){const result=await repo.deleteRecord(type,id,{expectedVersion:expectedVersion(req),actor:actor(req)});return send(res,200,{ok:true,...(result||{})})}
    }
    if(url.pathname==='/api/settings'){
      if(req.method==='GET'){if(meta(url)&&repo.getSettingsWithVersion)return send(res,200,await repo.getSettingsWithVersion());return send(res,200,await repo.getSettings())}
      if(req.method==='PUT'){const result=await repo.saveSettings(await body(req),{expectedVersion:expectedVersion(req),actor:actor(req)});return send(res,200,{ok:true,...(result||{})})}
    }
    if(url.pathname==='/api/commit-locks'){
      const payload=await body(req),resource=String(payload?.resource||'').trim();if(!resource)return send(res,400,{error:'Commit lock resource is required.'});
      if(req.method==='POST'){const {resource:_resource,...owner}=payload,lock=await repo.acquireCommitLock(resource,owner);return lock?send(res,201,lock):send(res,423,{error:'Resource is currently being committed by another user. Try again.'})}
      if(req.method==='DELETE'){await repo.releaseCommitLock(resource,payload?.token);return send(res,200,{ok:true})}
    }
    if(p[0]==='api'&&p[1]==='commit-locks'&&p[2]){
      const resource=p.slice(2).join('/');if(req.method==='POST'){const lock=await repo.acquireCommitLock(resource,await body(req));return lock?send(res,201,lock):send(res,423,{error:'Resource is currently being committed by another user. Try again.'})}if(req.method==='DELETE'){const payload=await body(req);await repo.releaseCommitLock(resource,payload?.token);return send(res,200,{ok:true})}
    }
    if(url.pathname==='/api/status-reports'&&req.method==='GET')return send(res,200,await repo.listStatusReports());
    if(p[0]==='api'&&p[1]==='status-reports'&&p[2]){
      const id=p[2];if(req.method==='GET'){if(meta(url)&&repo.getStatusReportWithVersion)return send(res,200,await repo.getStatusReportWithVersion(id));return send(res,200,await repo.getStatusReport(id))}
      if(req.method==='PUT'){const result=await repo.saveStatusReport(id,await body(req),{expectedVersion:expectedVersion(req),actor:actor(req)});return send(res,200,{ok:true,...(result||{})})}
    }
    if(url.pathname==='/api/lock'){if(req.method==='GET')return send(res,200,await repo.readLock());if(req.method==='PUT'){await repo.writeLock(await body(req));return send(res,200,{ok:true})}if(req.method==='DELETE'){await repo.deleteLock();return send(res,200,{ok:true})}}
    if(url.pathname==='/api/archive'&&req.method==='POST'){const result=await repo.archiveRecords(await body(req),{actor:actor(req)});return send(res,200,{ok:true,...(result||{})})}
    if(url.pathname==='/api/recovery'&&req.method==='GET')return send(res,200,{available:typeof repo.listRecoveryPoints==='function',storage:repo.storage,auditRetentionDays:repo.storage==='mongodb'?28:null});
    if(url.pathname==='/api/recovery/points'&&req.method==='GET'){if(!repo.listRecoveryPoints)return send(res,501,{error:'Recovery is not available for this repository.'});return send(res,200,await repo.listRecoveryPoints({limit:url.searchParams.get('limit')}))}
    if(url.pathname==='/api/recovery/preview'&&req.method==='POST'){if(!repo.previewRestore)return send(res,501,{error:'Recovery is not available for this repository.'});const payload=await body(req);return send(res,200,await repo.previewRestore(payload.transactionId))}
    if(url.pathname==='/api/recovery/restore'&&req.method==='POST'){if(!repo.restoreToTransaction)return send(res,501,{error:'Recovery is not available for this repository.'});const payload=await body(req),result=await repo.restoreToTransaction(payload.transactionId,{actor:actor(req)});return send(res,200,{ok:true,...result})}
    send(res,404,{error:'Not found'})
  }catch(e){console.error(e);const status=e.code==='ENOENT'?404:e.code==='AMO_CONFLICT'?409:500;send(res,status,{error:e.message||'Server error',details:e.details||undefined})}
});
server.listen(PORT,'0.0.0.0',()=>console.log(`AMO API ${BACKEND_VERSION} listening on :${PORT}; API contract=${API_VERSION}; repository=${repo.storage}`));

for(const signal of ['SIGTERM','SIGINT'])process.on(signal,async()=>{try{await repo.close?.()}finally{process.exit(0)}});
