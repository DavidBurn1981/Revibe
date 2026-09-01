let businessPlannerWeekStart=startMonday(new Date());
let editingBusinessPlannerActionId=null;

function navigateBusinessPlannerWeek(delta){
  businessPlannerWeekStart.setDate(businessPlannerWeekStart.getDate()+delta*7);
  renderBusinessPlanner();
}
function resetBusinessPlannerWeekToCurrent(){
  businessPlannerWeekStart=startMonday(new Date());
  renderBusinessPlanner();
}

function renderBusinessPlanner(){
  let wrap=document.getElementById('businessPlannerGrid');if(!wrap)return;
  let end=new Date(businessPlannerWeekStart);end.setDate(end.getDate()+6);
  document.getElementById('businessPlannerWeekLabel').textContent=`${nice(businessPlannerWeekStart)} – ${nice(end)}`;

  let html='';
  for(let i=0;i<7;i++){
    let d=new Date(businessPlannerWeekStart);d.setDate(d.getDate()+i);
    let key=iso(d);
    let actions=(data.businessPlannerActions||[]).filter(a=>a.date===key);
    html+=`<div class='bpDay'><div class='bpDayHead'>${nice(d)}</div><div class='bpDayBody'>`;
    html+=actions.map(a=>{
      let owner=data.staffMembers.find(s=>s.id===a.ownerStaffId);
      return `<div class='bpAction' onclick="openBusinessPlannerActionEdit('${a.id}')"><div class='bpActionDesc'>${escapeHtml(a.description)}</div>${owner?`<div class='bpActionOwner'>${escapeHtml(owner.name)}</div>`:''}</div>`;
    }).join('');
    html+=`<button class='bpAddBtn' onclick="addBusinessPlannerAction('${key}')">+ Add Action</button></div></div>`;
  }
  wrap.innerHTML=html;
}

function addBusinessPlannerAction(prefillDate){
  editingBusinessPlannerActionId=null;
  document.getElementById('bpActionModalTitle').textContent='Add Action';
  document.getElementById('bpActionDate').value=prefillDate||localDateKey();
  document.getElementById('bpActionDescription').value='';
  document.getElementById('bpActionOwner').innerHTML=`<option value=''>No owner assigned</option>`+
    (data.staffMembers||[]).filter(s=>s.active!==false).map(s=>`<option value='${s.id}'>${escapeHtml(s.name)}</option>`).join('');
  document.getElementById('bpActionError').style.display='none';
  document.getElementById('deleteBpActionBtn').style.display='none';
  document.getElementById('bpActionModal').classList.add('show');
}
function openBusinessPlannerActionEdit(id){
  let a=(data.businessPlannerActions||[]).find(x=>x.id===id);if(!a)return;
  editingBusinessPlannerActionId=id;
  document.getElementById('bpActionModalTitle').textContent='Edit Action';
  document.getElementById('bpActionDate').value=a.date;
  document.getElementById('bpActionDescription').value=a.description;
  document.getElementById('bpActionOwner').innerHTML=`<option value=''>No owner assigned</option>`+
    (data.staffMembers||[]).filter(s=>s.active!==false).map(s=>`<option value='${s.id}'${s.id===a.ownerStaffId?' selected':''}>${escapeHtml(s.name)}</option>`).join('');
  document.getElementById('bpActionError').style.display='none';
  document.getElementById('deleteBpActionBtn').style.display='inline-block';
  document.getElementById('bpActionModal').classList.add('show');
}
function closeBusinessPlannerAction(){document.getElementById('bpActionModal').classList.remove('show');editingBusinessPlannerActionId=null}
async function saveBusinessPlannerAction(){
  let date=document.getElementById('bpActionDate').value,
      description=document.getElementById('bpActionDescription').value.trim(),
      ownerId=document.getElementById('bpActionOwner').value||null,
      err=document.getElementById('bpActionError'),id=editingBusinessPlannerActionId;
  err.style.display='none';
  if(!date){err.textContent='Please choose a date.';err.style.display='block';return}
  if(!description){err.textContent='Please enter a description.';err.style.display='block';return}
  try{
    let error;
    if(id)({error}=await sb.from('business_planner_actions').update({action_date:date,description,owner_staff_id:ownerId,updated_at:new Date().toISOString()}).eq('id',id));
    else ({error}=await sb.from('business_planner_actions').insert({action_date:date,description,owner_staff_id:ownerId}));
    if(error)throw error;
    closeBusinessPlannerAction();
    await loadLiveData();renderBusinessPlanner();
  }catch(e){err.textContent=e.message||'Could not save this Action.';err.style.display='block'}
}
async function deleteBusinessPlannerAction(){
  if(!editingBusinessPlannerActionId)return;
  if(!confirm('Delete this Action?'))return;
  let {error}=await sb.from('business_planner_actions').delete().eq('id',editingBusinessPlannerActionId);
  if(error)return alert(error.message);
  closeBusinessPlannerAction();
  await loadLiveData();renderBusinessPlanner();
}
