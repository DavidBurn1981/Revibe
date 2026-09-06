let cleaningWeekStart=startMonday(new Date());
let editingCleaningTaskId=null;

function navigateCleaningWeek(delta){
  cleaningWeekStart.setDate(cleaningWeekStart.getDate()+delta*7);
  renderApartmentCleans();
}
function resetCleaningWeekToCurrent(){
  cleaningWeekStart=startMonday(new Date());
  renderApartmentCleans();
}

function renderApartmentCleans(){
  let wrap=document.getElementById('acTimeline');if(!wrap)return;
  let end=new Date(cleaningWeekStart);end.setDate(end.getDate()+6);
  document.getElementById('acWeekLabel').textContent=`${nice(cleaningWeekStart)} – ${nice(end)}`;

  let canEdit=hasRolePermission('apartment_cleans','edit'),
      canDelete=hasRolePermission('apartment_cleans','delete');
  let addBtn=document.getElementById('acAddTaskBtn');if(addBtn)addBtn.style.display=canEdit?'inline-block':'none';
  let syncBtn=document.getElementById('acSyncBtn');if(syncBtn)syncBtn.style.display=canEdit?'inline-block':'none';

  let apartments=data.apartments||[];
  let statusEl=document.getElementById('acSyncStatus');
  if(statusEl){
    let withErrors=apartments.filter(a=>a.lastSyncError);
    let lastSync=apartments.map(a=>a.lastSyncedAt).filter(Boolean).sort().pop();
    statusEl.textContent=withErrors.length
      ? `${withErrors.map(a=>a.name).join(', ')} failed to sync — check the Airbnb link for that apartment.`
      : lastSync?`Airbnb calendars last synced ${new Date(lastSync).toLocaleString('en-GB')}.`:'Airbnb calendars have not synced yet.';
  }

  let dayKeys=[];
  for(let i=0;i<7;i++){let d=new Date(cleaningWeekStart);d.setDate(d.getDate()+i);dayKeys.push(iso(d));}

  let weekTaskCount=(data.apartmentCleaningTasks||[]).filter(t=>dayKeys.includes(t.date)).length;
  let countEl=document.getElementById('acWeekCleanCount');if(countEl)countEl.textContent=weekTaskCount;

  let html=`<div class='acTimelineHeadLabel'></div>`;
  for(let i=0;i<7;i++){
    let d=new Date(cleaningWeekStart);d.setDate(d.getDate()+i);
    html+=`<div class='acTimelineHeadCell'>${nice(d)}</div>`;
  }

  for(let apt of apartments){
    html+=`<div class='acApartmentLabel'>${escapeHtml(apt.name)}</div>`;
    for(let key of dayKeys){
      let bookings=(data.apartmentBookings||[]).filter(b=>b.apartmentId===apt.id);
      let isCheckout=bookings.some(b=>b.checkOut===key);
      let isBooked=!isCheckout&&bookings.some(b=>b.checkIn<=key&&key<b.checkOut);
      let task=(data.apartmentCleaningTasks||[]).find(t=>t.apartmentId===apt.id&&t.date===key);
      let cls=['acDayCell'];
      if(isCheckout)cls.push('acCheckout');else if(isBooked)cls.push('acBooked');
      if(task)cls.push('acHasTask');
      if(task&&task.isComplete)cls.push('acTaskDone');
      let clickAttr=canEdit?`onclick="openOrCreateTaskForCell('${apt.id}','${key}')" style='cursor:pointer'`:`style='cursor:default'`;
      html+=`<div class='${cls.join(' ')}' ${clickAttr}>
          ${isCheckout?'<div>Checkout</div>':isBooked?'<div>Booked</div>':''}
          ${task?`<div>${task.isComplete?'✓ Cleaned':'Clean logged'}</div>`:''}
        </div>`;
    }
  }
  wrap.innerHTML=html;
}

function populateCleaningTaskApartmentSelect(){
  let sel=document.getElementById('cleaningTaskApartment');
  sel.innerHTML=(data.apartments||[]).map(a=>`<option value='${a.id}'>${escapeHtml(a.name)}</option>`).join('');
}

function addCleaningTask(prefillDate,prefillApartmentId){
  editingCleaningTaskId=null;
  populateCleaningTaskApartmentSelect();
  document.getElementById('cleaningTaskModalTitle').textContent='Create Cleaning Task';
  document.getElementById('cleaningTaskSaveBtn').textContent='Create Task';
  document.getElementById('cleaningTaskDate').value=prefillDate||localDateKey();
  if(prefillApartmentId)document.getElementById('cleaningTaskApartment').value=prefillApartmentId;
  document.getElementById('cleaningTaskNote').value='';
  document.getElementById('cleaningTaskError').style.display='none';
  document.getElementById('cleaningTaskModal').classList.add('show');
}
function openCleaningTaskEdit(id){
  let t=(data.apartmentCleaningTasks||[]).find(x=>x.id===id);if(!t)return;
  editingCleaningTaskId=id;
  populateCleaningTaskApartmentSelect();
  document.getElementById('cleaningTaskModalTitle').textContent='Edit Cleaning Task';
  document.getElementById('cleaningTaskSaveBtn').textContent='Save Changes';
  document.getElementById('cleaningTaskDate').value=t.date;
  if(t.apartmentId)document.getElementById('cleaningTaskApartment').value=t.apartmentId;
  document.getElementById('cleaningTaskNote').value=t.note||'';
  document.getElementById('cleaningTaskError').style.display='none';
  document.getElementById('cleaningTaskModal').classList.add('show');
}
function openOrCreateTaskForCell(apartmentId,dateKey){
  let existing=(data.apartmentCleaningTasks||[]).find(t=>t.apartmentId===apartmentId&&t.date===dateKey);
  if(existing)openCleaningTaskEdit(existing.id);
  else addCleaningTask(dateKey,apartmentId);
}
function closeCleaningTask(){document.getElementById('cleaningTaskModal').classList.remove('show')}
async function saveNewCleaningTask(){
  let date=document.getElementById('cleaningTaskDate').value,
      apartmentId=document.getElementById('cleaningTaskApartment').value,
      apartmentName=(data.apartments||[]).find(a=>a.id===apartmentId)?.name||'',
      legacyApartment=apartmentName.replace('Apt ',''),
      note=document.getElementById('cleaningTaskNote').value.trim(),
      err=document.getElementById('cleaningTaskError');
  err.style.display='none';
  if(!date){err.textContent='Please choose a date.';err.style.display='block';return}
  try{
    let error;
    let payload={task_date:date,apartment_id:apartmentId||null,apartment:legacyApartment||null,note:note||null};
    if(editingCleaningTaskId)({error}=await sb.from('apartment_cleaning_tasks').update(payload).eq('id',editingCleaningTaskId));
    else({error}=await sb.from('apartment_cleaning_tasks').insert(payload));
    if(error)throw error;
    closeCleaningTask();
    await loadLiveData();renderApartmentCleans();
  }catch(e){err.textContent=e.message||'Could not save this task.';err.style.display='block'}
}
async function syncAirbnbCalendars(){
  let btn=document.getElementById('acSyncBtn'),statusEl=document.getElementById('acSyncStatus');
  btn.disabled=true;btn.textContent='Syncing...';
  try{
    let {data:result,error}=await sb.functions.invoke('sync-airbnb-calendars');
    if(error)throw error;
    await loadLiveData();renderApartmentCleans();
    if(statusEl)statusEl.textContent='Airbnb calendars synced just now.';
  }catch(e){
    if(statusEl)statusEl.textContent=`Sync failed: ${e.message||'unknown error'}`;
  }finally{
    btn.disabled=false;btn.textContent='Sync Airbnb Now';
  }
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
