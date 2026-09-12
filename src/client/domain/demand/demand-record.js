const clean=value=>String(value??'').trim();

export function nextDemandId(demands=[],year=new Date().getFullYear()){
  const prefix=`DEM-${year}-`;
  const max=demands.reduce((current,demand)=>{
    const id=clean(demand.id);if(!id.startsWith(prefix))return current;
    const sequence=Number.parseInt(id.slice(prefix.length),10);return Number.isFinite(sequence)?Math.max(current,sequence):current;
  },0);
  return `${prefix}${String(max+1).padStart(4,'0')}`;
}

export function newDemandRecord({demands=[],year=new Date().getFullYear(),now=()=>new Date().toISOString()}={}){
  return {
    id:nextDemandId(demands,year),title:'',businessArea:'',initiative:'',teamId:'',priority:'',status:'Assessing',ownerId:'',projectNumber:'',health:'',context:'',demandModelVersion:2,version:0,modifiedAt:now()
  };
}

export function prepareDemandForSave(record,{now=()=>new Date().toISOString()}={}){
  const next={...record};
  next.title=clean(next.title);next.businessArea=clean(next.businessArea);next.initiative=clean(next.initiative);next.projectNumber=clean(next.projectNumber);next.ownerId=clean(next.ownerId);next.teamId=clean(next.teamId)||clean(next.owningTeamId);
  if(Object.prototype.hasOwnProperty.call(next,'owningTeamId'))delete next.owningTeamId;
  if(!next.id)throw new Error('Demand ID is required.');
  if(!next.title||!next.businessArea)throw new Error('Title and Business Area are required.');
  if(next.projectNumber&&!/^\d+$/.test(next.projectNumber))throw new Error('Project Number must contain digits only.');
  next.version=(Number(record.version)||0)+1;next.modifiedAt=now();
  return next;
}
