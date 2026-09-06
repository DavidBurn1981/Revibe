let cleaningWeekStart=startMonday(new Date());
let airbnbWeekStart=startMonday(new Date());
let editingCleaningTaskId=null;

function navigateCleaningWeek(delta){
  cleaningWeekStart.setDate(cleaningWeekStart.getDate()+delta*7);
  renderApartmentCleans();
}
function resetCleaningWeekToCurrent(){
  cleaningWeekStart=startMonday(new Date());
  renderApartmentCleans();
}
function navigateAirbnbWeek(delta){
  airbnbWeekStart.setDate(airbnbWeekStart.getDate()+delta*7);
  renderApartmentAirbnbCalendar();
}
function resetAirbnbWeekToCurrent(){
  airbnbWeekStart=startMonday(new Date());
  renderApartmentAirbnbCalendar();
}

// --- Apartment Cleans: simple day-by-day list, unchanged from before the Airbnb integration ---
function renderApartmentCleans(){
  let wrap=document.getElementById('acGrid');if(!wrap)return;
  let end=new Date(cleaningWeekStart);end.setDate(end.getDate()+6);
  document.getElementById('acWeekLabel').textContent=`${nice(cleaningWeekStart)} – ${nice(end)}`;

  let canEdit=hasRolePermission('apartment_cleans','edit'),
      canDelete=hasRolePermission('apartment_cleans','delete');
  let addBtn=document.getElementById('acAddTaskBtn');if(addBtn)addBtn.style.display=canEdit?'inline-block':'none';

  let html='',weekTaskCount=0;
  for(let i=0;i<14;i++){
    let d=new Date(cleaningWeekStart);d.setDate(d.getDate()+i);
    let key=iso(d);
    let tasks=(data.apartmentCleaningTasks||[]).filter(t=>t.date===key);
    if(i<7)weekTaskCount+=tasks.length;
    html+=`<div class='bpDay${i===7?' weekBoundary':''}'><div class='bpDayHead${key===localDateKey()?' acToday':''}'>${nice(d)}</div><div class='bpDayBody'>`;
    html+=tasks.map(t=>{
      let apt=(data.apartments||[]).find(a=>a.id===t.apartmentId);
      let label=apt?apt.name:(t.apartment?`Apartment ${t.apartment}`:'');
      return `<div class='bpAction ${t.isComplete?'cleaningTaskDone':''}' ${canEdit?`onclick="openCleaningTaskEdit('${t.id}')" style='cursor:pointer'`:`style='cursor:default'`}>
        <label class='cleaningTaskCheck' onclick='event.stopPropagation()'><input type='checkbox' ${t.isComplete?'checked':''} onchange="toggleCleaningTaskComplete('${t.id}',this.checked)"><span>Complete</span></label>
        ${label?`<div class='bpActionDesc'><b>${escapeHtml(label)}</b></div>`:''}
        ${t.note?`<div class='bpActionDesc'>${escapeHtml(t.note)}</div>`:''}
        ${canDelete?`<button class='cleaningTaskDeleteBtn' onclick="event.stopPropagation();deleteCleaningTask('${t.id}')">Delete</button>`:''}
      </div>`;
    }).join('');
    if(canEdit)html+=`<button class='bpAddBtn' onclick="addCleaningTask('${key}')">+ Create Cleaning Task</button>`;
    html+=`</div></div>`;
  }
  wrap.innerHTML=html;
  let countEl=document.getElementById('acWeekCleanCount');if(countEl)countEl.textContent=weekTaskCount;
}

// --- Apartment Air BnB Calendar: one row per apartment, synced against real Airbnb bookings ---
function renderApartmentAirbnbCalendar(){
  let wrap=document.getElementById('acbTimeline');if(!wrap)return;
  let end=new Date(airbnbWeekStart);end.setDate(end.getDate()+6);
  document.getElementById('acbWeekLabel').textContent=`${nice(airbnbWeekStart)} – ${nice(end)}`;

  let canEdit=hasRolePermission('apartment_cleans','edit');
  let addBtn=document.getElementById('acbAddTaskBtn');if(addBtn)addBtn.style.display=canEdit?'inline-block':'none';
  let syncBtn=document.getElementById('acbSyncBtn');if(syncBtn)syncBtn.style.display=canEdit?'inline-block':'none';

  let apartments=data.apartments||[];
  let statusEl=document.getElementById('acbSyncStatus');
  if(statusEl){
    let withErrors=apartments.filter(a=>a.lastSyncError);
    let lastSync=apartments.map(a=>a.lastSyncedAt).filter(Boolean).sort().pop();
    statusEl.textContent=withErrors.length
      ? `${withErrors.map(a=>a.name).join(', ')} failed to sync — check the Airbnb link for that apartment.`
      : lastSync?`Airbnb calendars last synced ${new Date(lastSync).toLocaleString('en-GB')}.`:'Airbnb calendars have not synced yet.';
  }

  let dayKeys=[];
  for(let i=0;i<14;i++){let d=new Date(airbnbWeekStart);d.setDate(d.getDate()+i);dayKeys.push(iso(d));}

  let weekTaskCount=(data.apartmentCleaningTasks||[]).filter(t=>dayKeys.slice(0,7).includes(t.date)).length;
  let countEl=document.getElementById('acbWeekCleanCount');if(countEl)countEl.textContent=weekTaskCount;

  let html=`<div class='acTimelineHeadLabel'></div>`;
  for(let i=0;i<14;i++){
    let d=new Date(airbnbWeekStart);d.setDate(d.getDate()+i);
    let dKey=iso(d);
    html+=`<div class='acTimelineHeadCell${i===7?' weekBoundary':''}${dKey===localDateKey()?' acToday':''}'>${nice(d)}</div>`;
  }

  for(let apt of apartments){
    html+=`<div class='acApartmentLabel'>${escapeHtml(apt.name)}</div>`;
    dayKeys.forEach((key,i)=>{
      let bookings=(data.apartmentBookings||[]).filter(b=>b.apartmentId===apt.id);
      let isCheckout=bookings.some(b=>b.checkOut===key);
      let isBooked=!isCheckout&&bookings.some(b=>b.checkIn<=key&&key<b.checkOut);
      let task=(data.apartmentCleaningTasks||[]).find(t=>t.apartmentId===apt.id&&t.date===key);
      let cls=['acDayCell'];
      if(i===7)cls.push('weekBoundary');
      if(isCheckout)cls.push('acCheckout');else if(isBooked)cls.push('acBooked');
      if(task)cls.push('acHasTask');
      if(task&&task.isComplete)cls.push('acTaskDone');
      let clickAttr=canEdit?`onclick="openOrCreateTaskForCell('${apt.id}','${key}')" style='cursor:pointer'`:`style='cursor:default'`;
      html+=`<div class='${cls.join(' ')}' ${clickAttr}>
          ${isCheckout?'<div>Checkout</div>':isBooked?'<div>Booked</div>':''}
          ${task?`<div>${task.isComplete?'✓ Cleaned':'Clean logged'}</div>`:''}
        </div>`;
    });
  }
  wrap.innerHTML=html;
}

function refreshApartmentPages(){
  renderApartmentCleans();
  renderApartmentAirbnbCalendar();
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
    await loadLiveData();refreshApartmentPages();
  }catch(e){err.textContent=e.message||'Could not save this task.';err.style.display='block'}
}
async function syncAirbnbCalendars(){
  let btn=document.getElementById('acbSyncBtn'),statusEl=document.getElementById('acbSyncStatus');
  btn.disabled=true;btn.textContent='Syncing...';
  try{
    let {data:result,error}=await sb.functions.invoke('sync-airbnb-calendars');
    if(error)throw error;
    await loadLiveData();refreshApartmentPages();
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
  await loadLiveData();refreshApartmentPages();
}
async function toggleCleaningTaskComplete(id,checked){
  // Optimistic local update so the checkbox feels instant, corrected below if the save fails.
  let t=(data.apartmentCleaningTasks||[]).find(x=>x.id===id);
  let previous=t?t.isComplete:null;
  if(t)t.isComplete=checked;
  let {error}=await sb.rpc('toggle_apartment_cleaning_task',{p_task_id:id,p_is_complete:checked});
  if(error){
    if(t)t.isComplete=previous;
    refreshApartmentPages();
    return alert(error.message);
  }
  await loadLiveData();refreshApartmentPages();
}
