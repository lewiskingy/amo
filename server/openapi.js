export function openApiDocument(req){
  const forwardedProto=String(req.headers['x-forwarded-proto']||'').split(',')[0].trim();
  const proto=forwardedProto||'http';
  const host=req.headers.host||'localhost:8080';
  const serverUrl=`${proto}://${host}`;
  const json={type:'object',additionalProperties:true};
  const ok={description:'Successful response'};
  const error={description:'Error response',content:{'application/json':{schema:{type:'object',properties:{error:{type:'string'}}}}}};
  return {
    openapi:'3.1.0',
    info:{title:'AMO Remote Workspace API',version:'2.0.0',description:'REST API for an Architecture Management Office remote workspace. Mongo-backed deployments provide optimistic concurrency, an auditable transaction journal and forward point-in-time restore.'},
    servers:[{url:serverUrl,description:'Current AMO API host'}],
    tags:[
      {name:'Info',description:'API and persistence capabilities'},
      {name:'Workspace',description:'Workspace loading and bulk persistence'},
      {name:'Records',description:'Typed workspace records'},
      {name:'Settings',description:'Workspace configuration'},
      {name:'Status Reports',description:'Demand status reports'},
      {name:'Locking',description:'Compatibility locking/coordination endpoints'},
      {name:'Archive',description:'Record archiving'},
      {name:'Recovery',description:'Mongo audit history and forward restore'}
    ],
    paths:{
      '/api/info':{get:{tags:['Info'],summary:'Get API and repository capabilities',responses:{'200':ok}}},
      '/api/workspace':{get:{tags:['Workspace'],summary:'Load the workspace',responses:{'200':ok,'404':error}}},
      '/api/workspace/save':{post:{tags:['Workspace'],summary:'Save dirty/deleted workspace changes with optimistic versions when supported',requestBody:{required:true,content:{'application/json':{schema:json}}},responses:{'200':ok,'409':error,'500':error}}},
      '/api/records/{type}':{get:{tags:['Records'],summary:'List records by type',parameters:[{name:'type',in:'path',required:true,schema:{type:'string'}}],responses:{'200':ok}}},
      '/api/records/{type}/{id}':{
        get:{tags:['Records'],summary:'Get a record; add ?meta=1 for record + version on Mongo',parameters:[{name:'type',in:'path',required:true,schema:{type:'string'}},{name:'id',in:'path',required:true,schema:{type:'string'}}],responses:{'200':ok,'404':error}},
        put:{tags:['Records'],summary:'Create or replace a record',parameters:[{name:'type',in:'path',required:true,schema:{type:'string'}},{name:'id',in:'path',required:true,schema:{type:'string'}},{name:'If-Match',in:'header',required:false,schema:{type:'integer'}}],requestBody:{required:true,content:{'application/json':{schema:json}}},responses:{'200':ok,'409':error}},
        delete:{tags:['Records'],summary:'Delete a record',parameters:[{name:'type',in:'path',required:true,schema:{type:'string'}},{name:'id',in:'path',required:true,schema:{type:'string'}},{name:'If-Match',in:'header',required:false,schema:{type:'integer'}}],responses:{'200':ok,'409':error}}
      },
      '/api/settings':{
        get:{tags:['Settings'],summary:'Get workspace settings; add ?meta=1 for version metadata',responses:{'200':ok}},
        put:{tags:['Settings'],summary:'Replace workspace settings',requestBody:{required:true,content:{'application/json':{schema:json}}},responses:{'200':ok,'409':error}}
      },
      '/api/status-reports':{get:{tags:['Status Reports'],summary:'List status reports',responses:{'200':ok}}},
      '/api/status-reports/{id}':{
        get:{tags:['Status Reports'],summary:'Get a status report; add ?meta=1 for version metadata',parameters:[{name:'id',in:'path',required:true,schema:{type:'string'}}],responses:{'200':ok,'404':error}},
        put:{tags:['Status Reports'],summary:'Create or replace a status report',parameters:[{name:'id',in:'path',required:true,schema:{type:'string'}}],requestBody:{required:true,content:{'application/json':{schema:json}}},responses:{'200':ok,'409':error}}
      },
      '/api/lock':{
        get:{tags:['Locking'],summary:'Get the current edit lock (JSON repository compatibility)',responses:{'200':ok}},
        put:{tags:['Locking'],summary:'Create or replace the edit lock',requestBody:{required:true,content:{'application/json':{schema:json}}},responses:{'200':ok}},
        delete:{tags:['Locking'],summary:'Remove the edit lock',responses:{'200':ok}}
      },
      '/api/archive':{post:{tags:['Archive'],summary:'Archive records',requestBody:{required:true,content:{'application/json':{schema:json}}},responses:{'200':ok}}},
      '/api/recovery':{get:{tags:['Recovery'],summary:'Get recovery availability and retention',responses:{'200':ok}}},
      '/api/recovery/points':{get:{tags:['Recovery'],summary:'List retained auditable transaction recovery points',responses:{'200':ok,'501':error}}},
      '/api/recovery/preview':{post:{tags:['Recovery'],summary:'Preview forward restore impact',requestBody:{required:true,content:{'application/json':{schema:json}}},responses:{'200':ok,'404':error,'501':error}}},
      '/api/recovery/restore':{post:{tags:['Recovery'],summary:'Restore to a transaction point as a new forward audit transaction',requestBody:{required:true,content:{'application/json':{schema:json}}},responses:{'200':ok,'404':error,'409':error,'501':error}}}
    }
  };
}

export function swaggerHtml(){
  return `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>AMO API - Swagger UI</title>
<link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css">
<style>html{box-sizing:border-box;overflow-y:scroll}*,*:before,*:after{box-sizing:inherit}body{margin:0;background:#fafafa}</style>
</head><body><div id="swagger-ui"></div>
<script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
<script>window.onload=()=>SwaggerUIBundle({url:'/openapi.json',dom_id:'#swagger-ui',deepLinking:true,displayRequestDuration:true,persistAuthorization:true});</script>
</body></html>`;
}
