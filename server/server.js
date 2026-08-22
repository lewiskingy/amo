import http from 'node:http';
import { URL } from 'node:url';
import { ServerJsonWorkspaceRepository } from './repository.js';

const PORT=Number(process.env.PORT||8080);
const WORKSPACE_ROOT=process.env.AMO_WORKSPACE_ROOT||'/data/workspace';
const allowedOrigins=(process.env.AMO_ALLOWED_ORIGINS||'').split(',').map(x=>x.trim()).filter(Boolean);
const repo=new ServerJsonWorkspaceRepository(WORKSPACE_ROOT);

function cors(req,res){const origin=req.headers.origin;if(origin&&(!allowedOrigins.length||allowedOrigins.includes(origin))){res.setHeader('Access-Control-Allow-Origin',origin);res.setHeader('Vary','Origin')}res.setHeader('Access-Control-Allow-Headers','Content-Type,Authorization,If-Match');res.setHeader('Access-Control-Allow-Methods','GET,POST,PUT,DELETE,OPTIONS')}
function send(res,status,data){const body=data==null?'':JSON.stringify(data);res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(body)}
async function body(req){let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>10_000_000)throw new Error('Request body too large.')}return raw?JSON.parse(raw):{}}
function parts(pathname){return pathname.split('/').filter(Boolean).map(decodeURIComponent)}

const server=http.createServer(async(req,res)=>{
  cors(req,res);if(req.method==='OPTIONS'){res.writeHead(204);res.end();return}
  const url=new URL(req.url,'http://localhost');const p=parts(url.pathname);
  try{
    if(req.method==='GET'&&url.pathname==='/api/info'){let workspace=null;try{workspace=await repo.connect()}catch{}return send(res,200,{product:'AMO',apiVersion:'1',storage:'json-filesystem',workspaceName:workspace?.name||null,capabilities:{records:true,statusReports:true,locking:true,archive:true,bulkSave:true}})}
    if(req.method==='GET'&&url.pathname==='/api/workspace')return send(res,200,await repo.loadWorkspace());
    if(req.method==='POST'&&url.pathname==='/api/workspace/save'){await repo.saveChanges(await body(req));return send(res,200,{ok:true})}
    if(p[0]==='api'&&p[1]==='records'&&p[2]){
      const type=p[2],id=p[3];if(req.method==='GET'&&!id)return send(res,200,await repo.listRecords(type));if(req.method==='GET'&&id)return send(res,200,await repo.getRecord(type,id));if(req.method==='PUT'&&id){const record=await body(req);record.id=record.id||id;await repo.saveRecord(type,record);return send(res,200,{ok:true})}if(req.method==='DELETE'&&id){await repo.deleteRecord(type,id);return send(res,200,{ok:true})}
    }
    if(url.pathname==='/api/settings'){if(req.method==='GET')return send(res,200,await repo.getSettings());if(req.method==='PUT'){await repo.saveSettings(await body(req));return send(res,200,{ok:true})}}
    if(url.pathname==='/api/status-reports'&&req.method==='GET')return send(res,200,await repo.listStatusReports());
    if(p[0]==='api'&&p[1]==='status-reports'&&p[2]){const id=p[2];if(req.method==='GET')return send(res,200,await repo.getStatusReport(id));if(req.method==='PUT'){await repo.saveStatusReport(id,await body(req));return send(res,200,{ok:true})}}
    if(url.pathname==='/api/lock'){if(req.method==='GET')return send(res,200,await repo.readLock());if(req.method==='PUT'){await repo.writeLock(await body(req));return send(res,200,{ok:true})}if(req.method==='DELETE'){await repo.deleteLock();return send(res,200,{ok:true})}}
    if(url.pathname==='/api/archive'&&req.method==='POST'){await repo.archiveRecords(await body(req));return send(res,200,{ok:true})}
    send(res,404,{error:'Not found'})
  }catch(e){console.error(e);send(res,e.code==='ENOENT'?404:500,{error:e.message||'Server error'})}
});
server.listen(PORT,'0.0.0.0',()=>console.log(`AMO API listening on :${PORT}; workspace=${WORKSPACE_ROOT}`));
