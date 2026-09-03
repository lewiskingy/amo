import { MongoClient } from 'mongodb';
import { randomUUID } from 'node:crypto';

const ENTITY_TYPES=new Set(['demand','team','allocations','ideas','workPackages']);
const WORKSPACE_ID='default';
const DOCUMENTS_COLLECTION='amoDocuments';
const RUNTIME_COLLECTION='amoRuntime';
const AUDIT_RETENTION_DAYS=28;
const AUDIT_RETENTION_MS=AUDIT_RETENTION_DAYS*24*60*60*1000;

const clone=value=>value==null?value:structuredClone(value);
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const nowIso=()=>new Date().toISOString();
const documentId=(type,id)=>`${type}:${id}`;
const cleanDoc=doc=>doc?{documentType:doc.documentType,entityId:doc.entityId,data:clone(doc.data)}:null;

const monthStart=(date=new Date())=>`${date.getUTCFullYear()}-${String(date.getUTCMonth()+1).padStart(2,'0')}-01`;
const addUtcMonths=(date,count)=>new Date(Date.UTC(date.getUTCFullYear(),date.getUTCMonth()+count,1));
const defaultPlanningWindow=(count=6)=>{const now=new Date(Date.UTC(new Date().getUTCFullYear(),new Date().getUTCMonth(),1));return{fromMonth:monthStart(now),toMonth:monthStart(addUtcMonths(now,count-1))}};

const defaultWorkspace=()=>{const now=nowIso();return{
  type:'architecture-operations-hub',name:'Architecture Management Office Workspace',workspaceId:`AMO-${randomUUID()}`,schemaVersion:2,
  department:{id:'DEPT-ARCH',name:'Architecture'},created:now,modifiedAt:now,description:'Remote Architecture Management Office workspace.',
  entities:{demand:{path:'demand'},team:{path:'team'},allocations:{path:'allocations'},ideas:{path:'ideas'},statusReports:{path:'status-reports'}}
}};

const defaultSettings=()=>({
  schemaVersion:2,appearance:'light',planningWindow:defaultPlanningWindow(),teams:[],
  services:['Triage','Consultancy','Assurance','Design','Strategy'],
  serviceWorkflows:{
    Triage:['Triage','Prioritisation','Accepted','Rejected','Closed'],
    Consultancy:['Assessment','Prioritisation','Mobilisation','In Progress','Review','Complete','On Hold','Cancelled'],
    Assurance:['Assessment','Prioritisation','Mobilisation','Assurance Review','Findings / Remediation','Governance / Approval','Complete','On Hold','Cancelled'],
    Design:['Assessment','Prioritisation','Mobilisation','Discovery','Analysis / Design','Socialisation / Review','Approval','Governance','Complete','On Hold','Cancelled'],
    Strategy:['Assessment','Prioritisation','Mobilisation','Discovery','Analysis','Strategy Development','Socialisation / Review','Approval','Governance','Complete','On Hold','Cancelled']
  },
  statuses:['Triage','Prioritisation','Accepted','Rejected','Closed','Assessment','Mobilisation','In Progress','Review','Complete','On Hold','Cancelled','Assurance Review','Findings / Remediation','Governance / Approval','Discovery','Analysis / Design','Socialisation / Review','Approval','Governance','Analysis','Strategy Development'],
  businessAreas:['Group'],initiatives:[],priorities:['Critical','High','Medium','Low'],healthStates:['On Track','At Risk','Off Track'],
  ideaStatuses:['New','Under Review','Planned','Implemented','Closed'],defaultFteWarningThreshold:0.85,defaultFteOverallocationThreshold:1.0
});

function conflict(message,details={}){const e=new Error(message);e.code='AMO_CONFLICT';e.details=details;return e}

export class MongoWorkspaceRepository{
  constructor({connectionString,databaseName='amo'}={}){
    if(!connectionString)throw new Error('AMO_MONGO_CONNECTION_STRING is required for the Mongo repository.');
    this.connectionString=connectionString;this.databaseName=databaseName;this.client=null;this.db=null;this.documents=null;this.runtime=null;this.storage='mongodb';
  }
  async init(){
    if(this.documents)return;
    this.client=new MongoClient(this.connectionString,{retryWrites:false});await this.client.connect();this.db=this.client.db(this.databaseName);
    this.documents=this.db.collection(DOCUMENTS_COLLECTION);this.runtime=this.db.collection(RUNTIME_COLLECTION);
    try{await this.documents.createIndex({expiresAt:1},{expireAfterSeconds:0,name:'amo-audit-expiry'})}catch(e){if(!/already exists|equivalent index/i.test(String(e.message||e)))throw e}
  }
  async close(){await this.client?.close();this.client=null;this.db=null;this.documents=null;this.runtime=null}
  baseDocument(type,id,data,version=1){return{_id:documentId(type,id),workspaceId:WORKSPACE_ID,documentType:type,entityId:id,version,data:clone(data),updatedAt:new Date()}}
  async ensureWorkspace(){
    await this.init();const existing=await this.documents.findOne({_id:documentId('workspace','default')});if(existing)return{created:false};
    const workspace=this.baseDocument('workspace','default',defaultWorkspace()),settings=this.baseDocument('configuration','settings',defaultSettings());
    try{await this.documents.insertMany([workspace,settings],{ordered:true});return{created:true}}catch(e){if(e.code===11000)return{created:false};throw e}
  }
  async connect(){await this.ensureWorkspace();const doc=await this.documents.findOne({_id:documentId('workspace','default')});if(doc?.data?.type!=='architecture-operations-hub')throw new Error('Not an Architecture Operations Hub workspace.');return clone(doc.data)}
  async getDocument(type,id,{required=true,session=null}={}){await this.ensureWorkspace();const doc=await this.documents.findOne({_id:documentId(type,id)},{session});if(!doc&&required){const e=new Error(`${type} ${id} was not found.`);e.code='ENOENT';throw e}return doc}
  async listDocuments(type){await this.ensureWorkspace();return this.documents.find({workspaceId:WORKSPACE_ID,documentType:type}).sort({entityId:1}).toArray()}
  async listRecords(type){if(!ENTITY_TYPES.has(type))throw new Error(`Unsupported entity type: ${type}`);return (await this.listDocuments(type)).map(d=>clone(d.data))}
  async getRecord(type,id){if(!ENTITY_TYPES.has(type))throw new Error(`Unsupported entity type: ${type}`);return clone((await this.getDocument(type,id)).data)}
  async getRecordWithVersion(type,id){const doc=await this.getDocument(type,id);return{record:clone(doc.data),version:doc.version||1}}
  async getSettings(){return clone((await this.getDocument('configuration','settings')).data)}
  async getSettingsWithVersion(){const doc=await this.getDocument('configuration','settings');return{record:clone(doc.data),version:doc.version||1}}
  statusName(idOrFile){return String(idOrFile).endsWith('.json')?String(idOrFile):`${idOrFile}.json`}
  async listStatusReports(){return (await this.listDocuments('statusReport')).map(d=>d.entityId).sort()}
  async getStatusReport(idOrFile){return clone((await this.getDocument('statusReport',this.statusName(idOrFile))).data)}
  async getStatusReportWithVersion(idOrFile){const doc=await this.getDocument('statusReport',this.statusName(idOrFile));return{record:clone(doc.data),version:doc.version||1}}

  async commitDocumentChanges({type='change',reason='Remote workspace change',actor='Remote user',operations=[],expectedVersions={}}={}){
    await this.ensureWorkspace();const session=this.client.startSession();const result={transactionId:null,versions:{},changed:0};
    try{
      session.startTransaction();const auditOps=[];
      for(const input of operations){
        const id=String(input.documentId||'');if(!id)continue;const current=await this.documents.findOne({_id:id},{session});const currentVersion=current?.version||0;
        const expected=input.expectedVersion??expectedVersions[id];if(expected!=null&&Number(expected)!==Number(currentVersion))throw conflict(`Document ${id} changed since it was read.`,{documentId:id,expectedVersion:Number(expected),actualVersion:currentVersion});
        const after=input.after==null?null:{documentType:input.documentType||current?.documentType,entityId:input.entityId||current?.entityId,data:clone(input.after)};
        const before=cleanDoc(current);if(same(before,after))continue;
        if(after==null){if(current)await this.documents.deleteOne({_id:id,version:currentVersion},{session});result.versions[id]=0}
        else if(current){const nextVersion=currentVersion+1;const update=await this.documents.updateOne({_id:id,version:currentVersion},{$set:{documentType:after.documentType,entityId:after.entityId,data:after.data,version:nextVersion,updatedAt:new Date()}},{session});if(update.modifiedCount!==1)throw conflict(`Concurrent update detected for ${id}.`,{documentId:id});result.versions[id]=nextVersion}
        else{const next=this.baseDocument(after.documentType,after.entityId,after.data,1);next._id=id;await this.documents.insertOne(next,{session});result.versions[id]=1}
        auditOps.push({documentId:id,operation:before==null?'create':after==null?'delete':'update',before,after});
      }
      if(auditOps.length){
        const txId=`TX-${randomUUID()}`,timestamp=new Date();await this.documents.insertOne({_id:documentId('transaction',txId),workspaceId:WORKSPACE_ID,documentType:'transaction',entityId:txId,version:1,type,reason,actor,timestamp,expiresAt:new Date(timestamp.getTime()+AUDIT_RETENTION_MS),operations:auditOps},{session});result.transactionId=txId;result.changed=auditOps.length
      }
      await session.commitTransaction();return result
    }catch(e){try{await session.abortTransaction()}catch{}throw e}finally{await session.endSession()}
  }

  async saveRecord(type,record,{expectedVersion,actor}={}){if(!ENTITY_TYPES.has(type))throw new Error(`Unsupported entity type: ${type}`);if(!record?.id)throw new Error('Record ID is required.');return this.commitDocumentChanges({type:`save-${type}`,reason:`Save ${type} ${record.id}`,actor,operations:[{documentId:documentId(type,record.id),documentType:type,entityId:record.id,after:record,expectedVersion}]})}
  async deleteRecord(type,id,{expectedVersion,actor}={}){if(!ENTITY_TYPES.has(type))throw new Error(`Unsupported entity type: ${type}`);return this.commitDocumentChanges({type:`delete-${type}`,reason:`Delete ${type} ${id}`,actor,operations:[{documentId:documentId(type,id),documentType:type,entityId:id,after:null,expectedVersion}]})}
  async saveSettings(settings,{expectedVersion,actor}={}){return this.commitDocumentChanges({type:'configuration',reason:'Save Configuration',actor,operations:[{documentId:documentId('configuration','settings'),documentType:'configuration',entityId:'settings',after:settings,expectedVersion}]})}
  async saveStatusReport(idOrFile,record,{expectedVersion,actor}={}){const name=this.statusName(idOrFile);return this.commitDocumentChanges({type:'status-report',reason:`Save Status Report ${name}`,actor,operations:[{documentId:documentId('statusReport',name),documentType:'statusReport',entityId:name,after:record,expectedVersion}]})}
  async loadWorkspace(){
    await this.ensureWorkspace();const docs=await this.documents.find({workspaceId:WORKSPACE_ID,documentType:{$in:['workspace','configuration','demand','team','allocations','ideas']}}).toArray(),versions={};
    let workspace=null,settings=null;const out={demand:[],team:[],allocations:[],ideas:[]};for(const d of docs){versions[d._id]=d.version||1;if(d.documentType==='workspace')workspace=clone(d.data);else if(d.documentType==='configuration')settings=clone(d.data);else out[d.documentType]?.push(clone(d.data))}
    if(!workspace||!settings)throw new Error('Mongo workspace bootstrap is incomplete.');return{workspace,...out,configFiles:{'settings.json':settings},versions}
  }
  async saveChanges(payload,{actor='Remote user'}={}){
    const {workspace,settings,collections={},dirty={},deleted={},configDirty=false,expectedVersions={}}=payload||{},operations=[];
    operations.push({documentId:documentId('workspace','default'),documentType:'workspace',entityId:'default',after:{...workspace,modifiedAt:nowIso()},expectedVersion:expectedVersions[documentId('workspace','default')]});
    for(const type of ENTITY_TYPES){const rows=collections[type]||[];for(const id of dirty[type]||[]){const record=rows.find(r=>r.id===id);if(record)operations.push({documentId:documentId(type,id),documentType:type,entityId:id,after:record,expectedVersion:expectedVersions[documentId(type,id)]})}for(const id of deleted[type]||[])operations.push({documentId:documentId(type,id),documentType:type,entityId:id,after:null,expectedVersion:expectedVersions[documentId(type,id)]})}
    if(configDirty)operations.push({documentId:documentId('configuration','settings'),documentType:'configuration',entityId:'settings',after:settings,expectedVersion:expectedVersions[documentId('configuration','settings')]});
    return this.commitDocumentChanges({type:'workspace-save',reason:'Workspace save',actor,operations})
  }
  async archiveRecords(recordsByEntity,{actor='Remote user'}={}){const operations=[];for(const [type,records] of Object.entries(recordsByEntity||{}))for(const record of records||[]){if(!ENTITY_TYPES.has(type))continue;operations.push({documentId:documentId(type,record.id),documentType:type,entityId:record.id,after:null});operations.push({documentId:documentId('archive',`${type}:${record.id}`),documentType:'archive',entityId:`${type}:${record.id}`,after:{sourceType:type,record}})}return this.commitDocumentChanges({type:'archive',reason:'Archive stale terminal records',actor,operations})}

  async readLock(){return null}
  async writeLock(lock){return lock}
  async deleteLock(){}
  async acquireCommitLock(resource,owner={}){return{type:'amo-database-transaction',resource,token:`db-${randomUUID()}`,createdAt:nowIso(),...owner}}
  async releaseCommitLock(){}

  async listRecoveryPoints({limit=250}={}){await this.ensureWorkspace();const rows=await this.documents.find({workspaceId:WORKSPACE_ID,documentType:'transaction'}).sort({timestamp:-1}).limit(Math.max(1,Math.min(1000,Number(limit)||250))).toArray();return rows.map(t=>({id:t.entityId,type:t.type,reason:t.reason,actor:t.actor,timestamp:t.timestamp instanceof Date?t.timestamp.toISOString():String(t.timestamp),changed:(t.operations||[]).length,expiresAt:t.expiresAt instanceof Date?t.expiresAt.toISOString():String(t.expiresAt||'')}))}
  async currentRecoverySnapshot({session=null}={}){const rows=await this.documents.find({workspaceId:WORKSPACE_ID,documentType:{$nin:['transaction']}},{session}).toArray(),map=new Map();for(const d of rows)map.set(d._id,{documentType:d.documentType,entityId:d.entityId,data:clone(d.data),version:d.version||1});return map}
  async desiredStateAtTransaction(transactionId){
    await this.ensureWorkspace();const target=await this.documents.findOne({_id:documentId('transaction',transactionId)});if(!target){const e=new Error(`Recovery transaction ${transactionId} was not found or has expired.`);e.code='ENOENT';throw e}
    const state=await this.currentRecoverySnapshot(),later=await this.documents.find({workspaceId:WORKSPACE_ID,documentType:'transaction',timestamp:{$gt:target.timestamp}}).sort({timestamp:-1}).toArray();
    for(const tx of later)for(const op of [...(tx.operations||[])].reverse()){if(op.before==null)state.delete(op.documentId);else state.set(op.documentId,{...clone(op.before),version:null})}return{target,state}
  }
  async buildRestorePlan(transactionId){const {target,state}=await this.desiredStateAtTransaction(transactionId),current=await this.currentRecoverySnapshot(),ids=new Set([...state.keys(),...current.keys()]),operations=[];for(const id of ids){const before=current.get(id)||null,after=state.get(id)||null;if(!same(cleanDoc(before),cleanDoc(after)))operations.push({documentId:id,documentType:after?.documentType||before?.documentType,entityId:after?.entityId||before?.entityId,before:cleanDoc(before),after:after?.data??null,expectedVersion:before?.version||0})}return{target,operations}}
  async previewRestore(transactionId){const {target,operations}=await this.buildRestorePlan(transactionId);return{target:{id:target.entityId,timestamp:target.timestamp instanceof Date?target.timestamp.toISOString():String(target.timestamp),type:target.type,reason:target.reason},changed:operations.length,creates:operations.filter(o=>o.before==null&&o.after!=null).length,updates:operations.filter(o=>o.before!=null&&o.after!=null).length,deletes:operations.filter(o=>o.before!=null&&o.after==null).length,documents:operations.map(o=>({documentId:o.documentId,operation:o.before==null?'create':o.after==null?'delete':'update'}))}}
  async restoreToTransaction(transactionId,{actor='Remote user'}={}){const {target,operations}=await this.buildRestorePlan(transactionId);return this.commitDocumentChanges({type:'restore',reason:`Point-in-time restore to ${target.entityId}`,actor,operations})}

  async createSafetyBackup(){return null}
  async pruneBackups(){return null}
  async listBackups(){return[]}
}