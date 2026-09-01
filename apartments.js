let cleaningWeekStart=startMonday(new Date());
let editingCleaningTaskDate=null;

function navigateCleaningWeek(delta){
  cleaningWeekStart.setDate(cleaningWeekStart.getDate()+delta*7);
  renderApartmentCleans();
}
function resetCleaningWeekToCurrent(){
  cleaningWeekStart=startMonday(new Date());
  renderApartmentCleans();
}

function renderApartmentCleans(){
  let wrap=document.getElementById('acGrid');if(!wrap)return;
  let end=new Date(cleaningWeekStart);end.setDate(end.getDate()+6);
  document.getElementById('acWeekLabel').textContent=`${nice(cleaningWeekStart)} – ${nice(end)}`;

  let canEdit=hasRolePermission('apartment_cleans','edit'),
      canDelete=hasRolePermission('apartment_cleans','delete');
  let addBtn=document.getElementById('acAddTaskBtn');if(addBtn)addBtn.style.display=canEdit?'inline-block':'none';

  let html='';
  for(let i=0;i<7;i++){
    let d=new Date(cleaningWeekStart);d.setDate(d.getDate()+i);
    let key=iso(d);
    let tasks=(data.apartmentCleaningTasks||[]).filter(t=>t.date===key);
    html+=`<div class='bpDay'><div class='bpDayHead'>${nice(d)}</div><div class='bpDayBody'>`;
    html+=tasks.map(t=>`<div class='bpAction ${t.isComplete?'cleaningTaskDone':''}'>
        <label class='cleaningTaskCheck'><input type='checkbox' ${t.isComplete?'checked':''} onchange="toggleCleaningTaskComplete('${t.id}',this.checked)"><span>Complete</span></label>
        <div class='bpActionDesc'>${escapeHtml(t.note)}</div>
        ${canDelete?`<button class='cleaningTaskDeleteBtn' onclick="deleteCleaningTask('${t.id}')">Delete</button>`:''}
      </div>`).join('');
    if(canEdit)html+=`<button class='bpAddBtn' onclick="addCleaningTask('${key}')">+ Create Cleaning Task</button>`;
    html+=`</div></div>`;
  }
  wrap.innerHTML=html;
}

function addCleaningTask(prefillDate){
  document.getElementById('cleaningTaskDate').value=prefillDate||localDateKey();
  document.getElementById('cleaningTaskNote').value='';
  document.getElementById('cleaningTaskError').style.display='none';
  document.getElementById('cleaningTaskModal').classList.add('show');
}
function closeCleaningTask(){document.getElementById('cleaningTaskModal').classList.remove('show')}
async function saveNewCleaningTask(){
  let date=document.getElementById('cleaningTaskDate').value,
      note=document.getElementById('cleaningTaskNote').value.trim(),
      err=document.getElementById('cleaningTaskError');
  err.style.display='none';
  if(!date){err.textContent='Please choose a date.';err.style.display='block';return}
  if(!note){err.textContent='Please enter a note.';err.style.display='block';return}
  try{
    let {error}=await sb.from('apartment_cleaning_tasks').insert({task_date:date,note});
    if(error)throw error;
    closeCleaningTask();
    await loadLiveData();renderApartmentCleans();
  }catch(e){err.textContent=e.message||'Could not create this task.';err.style.display='block'}
}
async function deleteCleaningTask(id){
  if(!confirm('Delete this cleaning task?'))return;
  let {error}=await sb.from('apartment_cleaning_tasks').delete().eq('id',id);
  if(error)return alert(error.message);
  await loadLiveData();renderApartmentCleans();
}
async function toggleCleaningTaskComplete(id,checked){
  // Optimistic local update so the checkbox feels instant, corrected below if the save fails.
  let t=(data.apartmentCleaningTasks||[]).find(x=>x.id===id);
  let previous=t?t.isComplete:null;
  if(t)t.isComplete=checked;
  let {error}=await sb.rpc('toggle_apartment_cleaning_task',{p_task_id:id,p_is_complete:checked});
  if(error){
    if(t)t.isComplete=previous;
    renderApartmentCleans();
    return alert(error.message);
  }
  await loadLiveData();renderApartmentCleans();
}
