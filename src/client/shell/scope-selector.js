const esc=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const option=(value,label,current)=>`<option value="${esc(value)}" ${String(current)===String(value)?'selected':''}>${esc(label)}</option>`;

export class ScopeSelector{
  constructor(host,{settings,onChange}){this.host=host;this.settings=settings;this.onChange=onChange;this.scope={mode:'all'}}
  value(){return{...this.scope}}
  render(){
    const departments=this.settings.departments||[],teams=this.settings.teams||[];
    this.host.className='amo-scope-selector';
    this.host.innerHTML=`<label>Scope<select data-scope-mode>${option('all','All Demand',this.scope.mode)}${option('department','Department',this.scope.mode)}${option('team','Team',this.scope.mode)}</select></label><label data-department-wrap>Department<select data-department>${option('','Choose…',this.scope.departmentId)}${departments.map(d=>option(d.id,d.name||d.id,this.scope.departmentId)).join('')}</select></label><label data-team-wrap>Team<select data-team>${option('','Choose…',this.scope.teamId)}${teams.map(t=>option(t.id,t.name||t.id,this.scope.teamId)).join('')}</select></label>`;
    const sync=()=>{
      const mode=this.host.querySelector('[data-scope-mode]').value;
      const departmentId=this.host.querySelector('[data-department]').value;
      const teamId=this.host.querySelector('[data-team]').value;
      const teamIds=teams.filter(t=>!departmentId||t.departmentId===departmentId).map(t=>t.id);
      this.scope={mode,departmentId,teamId,teamIds};
      this.host.querySelector('[data-department-wrap]').hidden=mode!=='department';
      this.host.querySelector('[data-team-wrap]').hidden=mode!=='team';
      this.onChange?.(this.value());
    };
    this.host.querySelectorAll('select').forEach(el=>el.addEventListener('change',sync));
    this.host.querySelector('[data-department-wrap]').hidden=this.scope.mode!=='department';
    this.host.querySelector('[data-team-wrap]').hidden=this.scope.mode!=='team';
  }
}
