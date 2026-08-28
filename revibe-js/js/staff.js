function renderStaffMembers(){let t=document.getElementById('staffMembersTable');if(!t)return;t.innerHTML='<tr><th>Name</th><th>Phone</th><th>Address</th><th>Date Joined</th><th>Holiday Entitlement</th><th>Holidays Remaining</th><th>Colour</th></tr>'+(data.staffMembers.length?data.staffMembers.map(s=>`<tr class='clinicRow' onclick="openStaffMemberEdit('${s.id}')"><td><b>${escapeHtml(s.name)}</b></td><td>${escapeHtml(s.phone||'')}</td><td>${escapeHtml(s.address||'')}</td><td>${s.dateOfJoining?formatSunbedDisplayDate(s.dateOfJoining):''}</td><td>${s.holidayEntitlement}</td><td>${s.holidaysRemaining}</td><td><span style='display:inline-block;width:28px;height:18px;border-radius:5px;background:${s.colour};border:1px solid #555'></span></td></tr>`).join(''):`<tr><td colspan='7' class='muted'>No staff members configured yet.</td></tr>`)}
let staffRotaDays=7;function changeStaffRotaRange(){staffRotaDays=+document.getElementById('staffRotaRange').value||7;renderStaffRota()}
function renderStaffRota(){
  let wrap=document.getElementById('staffRotaCalendar');if(!wrap)return;
  let end=new Date(staffRotaWeekStart);end.setDate(end.getDate()+staffRotaDays-1);
  document.getElementById('staffRotaWeekLabel').textContent=`${nice(staffRotaWeekStart)} – ${nice(end)}`;

  const startMin=8*60+45,endMin=20*60+15,rowStep=15,totalRows=(endMin-startMin)/rowStep;
  let html=`<div class='staffRotaMatrix' style='grid-template-columns:72px repeat(${staffRotaDays},minmax(150px,1fr));min-width:${72+staffRotaDays*150}px'><div class='staffRotaHead'>Time</div>`;
  let dayKeys=[];
  for(let i=0;i<staffRotaDays;i++){
    let d=new Date(staffRotaWeekStart);d.setDate(d.getDate()+i);dayKeys.push(iso(d));
    html+=`<div class='staffRotaHead'>${nice(d)}</div>`;
  }

  for(let r=0;r<totalRows;r++){
    let mins=startMin+r*rowStep,hh=String(Math.floor(mins/60)).padStart(2,'0'),mm=String(mins%60).padStart(2,'0'),
        label=(mins===startMin||mins===endMin-rowStep||mm==='00'||mm==='30')?`${hh}:${mm}`:'';
    html+=`<div class='staffRotaTime'>${label}</div>`;
    for(let d=0;d<staffRotaDays;d++){
      let edge=mins<9*60||mins>=20*60?' edge':'';
      let holidayNames=(data.holidayRequests||[]).filter(h=>h.status==='Approved'&&dayKeys[d]>=h.startDate&&dayKeys[d]<=h.endDate).map(h=>data.staffMembers.find(s=>s.id===h.staffId)?.name).filter(Boolean);
      let holidayClass=holidayNames.length?' holidayRotaShade':'';
      html+=`<div class='staffRotaCell${edge}${holidayClass}' data-day='${dayKeys[d]}' data-row='${r}'>${r===0&&holidayNames.length?`<div class='holidayRotaLabel'>${holidayNames.join(', ')} on holiday</div>`:''}</div>`;
    }
  }
  html+=`</div><div class='staffRotaLegend'>08:45–09:00 = pre-open preparation · 20:00–20:15 = post-close clean down</div>`;
  wrap.innerHTML=html;

  // Overlay shifts relative to each day's 15-minute grid.
  let matrix=wrap.querySelector('.staffRotaMatrix');
  let heads=1; // header row
  dayKeys.forEach((key,dayIndex)=>{
    let shifts=data.staffShifts.filter(s=>s.date===key);
    shifts.forEach(s=>{
      let staff=data.staffMembers.find(m=>m.id===s.staffId),sMin=minutesFromTime(s.start),eMin=minutesFromTime(s.end);
      let clippedStart=Math.max(sMin,startMin),clippedEnd=Math.min(eMin,endMin);
      if(clippedEnd<=clippedStart)return;
      let firstCell=matrix.querySelector(`.staffRotaCell[data-day='${key}'][data-row='0']`);
      let lastCell=matrix.querySelector(`.staffRotaCell[data-day='${key}'][data-row='${totalRows-1}']`);
      if(!firstCell||!lastCell)return;
      let layer=document.createElement('div');
      let rect1=firstCell.getBoundingClientRect(),rectM=matrix.getBoundingClientRect(),cellH=firstCell.getBoundingClientRect().height;
      layer.className='staffRotaShiftBlock';
      layer.style.left=(rect1.left-rectM.left+5)+'px';
      layer.style.width=(rect1.width-10)+'px';
      layer.style.top=(rect1.top-rectM.top+((clippedStart-startMin)/rowStep)*cellH+2)+'px';
      layer.style.height=Math.max(22,((clippedEnd-clippedStart)/rowStep)*cellH-4)+'px';
      let col=staff?.colour||'#18d7e8';
      layer.style.borderLeftColor=col;
      layer.style.background=hexToRgba(col,0.22);
      layer.innerHTML=`<b>${escapeHtml(staff?.name||'Staff Member')}</b>${s.start}–${s.end}<br>${Number(s.hours).toFixed(2)} hrs`;
      matrix.appendChild(layer);
    });
  });

  let weekKeys=dayKeys,scheduled=data.staffShifts.filter(s=>weekKeys.includes(s.date));
  let totals={};
  scheduled.forEach(s=>{totals[s.staffId]=(totals[s.staffId]||0)+(+s.hours||0)});
  let rows=Object.entries(totals).map(([staffId,hours])=>({staff:data.staffMembers.find(m=>m.id===staffId),hours})).filter(x=>x.staff);
  document.getElementById('staffRotaSummary').innerHTML=rows.length
    ?`<h3 style='margin-top:0'>${staffRotaDays===14?'Fortnight':'Weekly'} Scheduled Hours</h3><table class='table'><tr><th>Staff Member</th><th>Total Scheduled Hours</th></tr>${rows.sort((a,b)=>a.staff.name.localeCompare(b.staff.name)).map(x=>`<tr><td><span class='staffColourDot' style='background:${x.staff.colour}'></span><b>${x.staff.name}</b></td><td>${x.hours.toFixed(2)} hours</td></tr>`).join('')}</table>`
    :`<h3 style='margin-top:0'>${staffRotaDays===14?'Fortnight':'Weekly'} Scheduled Hours</h3><div class='muted'>No staff scheduled this week.</div>`;
}function openStaffMemberCreate(){
  editingStaffId=null;let today=localDateKey();
  document.getElementById('staffMemberModalTitle').textContent='Add Staff Member';document.getElementById('staffMemberModalSubtitle').textContent='Create a staff record';
  document.getElementById('staffName').value='';document.getElementById('staffPhone').value='';document.getElementById('staffAddress').value='';
  document.getElementById('staffJoinDate').value=today;document.getElementById('staffJoinDateDisplay').value=formatSunbedDisplayDate(today);
  document.getElementById('staffHolidayEntitlement').value='0';document.getElementById('staffHolidayRemaining').value='0';document.getElementById('staffColour').value='#18d7e8';
  document.getElementById('staffCreateSaveBtn').textContent='Create Staff Member';document.getElementById('staffCreateError').style.display='none';
  let canEdit=hasRolePermission('staff_members','edit');document.getElementById('staffHolidayEntitlement').readOnly=!canEdit;document.getElementById('staffHolidayRemaining').readOnly=true;
  document.getElementById('deleteStaffBtn').style.display='none';document.getElementById('staffMemberCreateModal').classList.add('show');
}
function openStaffMemberEdit(id){
  let s=data.staffMembers.find(x=>x.id===id);if(!s)return;editingStaffId=id;
  document.getElementById('staffMemberModalTitle').textContent='Edit Staff Member';document.getElementById('staffMemberModalSubtitle').textContent='Update staff details';
  document.getElementById('staffName').value=s.name||'';document.getElementById('staffPhone').value=s.phone||'';document.getElementById('staffAddress').value=s.address||'';
  document.getElementById('staffJoinDate').value=s.dateOfJoining||'';document.getElementById('staffJoinDateDisplay').value=s.dateOfJoining?formatSunbedDisplayDate(s.dateOfJoining):'';
  document.getElementById('staffHolidayEntitlement').value=s.holidayEntitlement;document.getElementById('staffHolidayRemaining').value=s.holidaysRemaining;document.getElementById('staffColour').value=s.colour||'#18d7e8';
  document.getElementById('staffCreateSaveBtn').textContent='Save Changes';document.getElementById('staffCreateError').style.display='none';
  let canEdit=hasRolePermission('staff_members','edit');document.getElementById('staffHolidayEntitlement').readOnly=!canEdit;document.getElementById('staffHolidayRemaining').readOnly=true;
  document.getElementById('staffMemberCreateModal').classList.add('show');
}
async function deleteStaffMember(){if(!editingStaffId)return alert('Save the staff member first.');if(!confirm('Delete this staff member?'))return;let {error}=await sb.from('staff_members').delete().eq('id',editingStaffId);if(error)return alert('This staff member may still have shifts, holidays or orders linked. Delete those first.\n\n'+error.message);document.getElementById('staffMemberCreateModal').classList.remove('show');editingStaffId=null;await loadLiveData();renderAll()}
function updateHolidayRemainingPreview(){
  let entitlement=+document.getElementById('staffHolidayEntitlement').value||0;
  document.getElementById('staffHolidayRemaining').value=entitlement.toFixed(1).replace('.0','');
}
function closeStaffMemberCreate(){document.getElementById('staffMemberCreateModal').classList.remove('show');editingStaffId=null}
async function saveStaffMember(){
  let name=document.getElementById('staffName').value.trim(),address=document.getElementById('staffAddress').value.trim(),phone=document.getElementById('staffPhone').value.trim(),
      date=document.getElementById('staffJoinDate').value||null,entitlement=+document.getElementById('staffHolidayEntitlement').value||0,colour=document.getElementById('staffColour').value||'#18d7e8',
      err=document.getElementById('staffCreateError'),btn=document.getElementById('staffCreateSaveBtn'),id=editingStaffId;
  err.style.display='none';if(!name){err.textContent='Please enter the staff member name.';err.style.display='block';return;}
  btn.disabled=true;btn.textContent=id?'Saving...':'Creating...';
  try{
    let error;
    if(id){
      ({error}=await sb.from('staff_members').update({name,address:address||null,phone_number:phone||null,date_of_joining:date,holiday_entitlement_this_year:entitlement,rota_colour:colour,updated_at:new Date().toISOString()}).eq('id',id));
      if(error)throw error;
      let rpc=await sb.rpc('recalculate_staff_holiday_remaining',{p_staff_member_id:id});if(rpc.error)throw rpc.error;
    }else{
      ({error}=await sb.from('staff_members').insert({name,address:address||null,phone_number:phone||null,date_of_joining:date,holiday_entitlement_this_year:entitlement,holidays_remaining:entitlement,rota_colour:colour,active:true}));
      if(error)throw error;
    }
    document.getElementById('staffMemberCreateModal').classList.remove('show');editingStaffId=null;
    await loadLiveData();renderAll();
  }catch(e){err.textContent=e.message||'Could not save Staff Member.';err.style.display='block';}
  finally{btn.disabled=false;btn.textContent='Create Staff Member';}
}
function openStaffJoinCalendarPicker(){
  let current=document.getElementById('staffJoinDate').value;
  staffJoinPickerMonth=current?parseLocalDateKey(current):new Date();
  renderStaffJoinCalendarPicker();
  document.getElementById('staffJoinCalendarPickerModal').classList.add('show');
}
function closeStaffJoinCalendarPicker(){document.getElementById('staffJoinCalendarPickerModal').classList.remove('show')}
function changeStaffJoinPickerMonth(delta){staffJoinPickerMonth=new Date(staffJoinPickerMonth.getFullYear(),staffJoinPickerMonth.getMonth()+delta,1);renderStaffJoinCalendarPicker()}
function selectStaffJoinDate(key){
  document.getElementById('staffJoinDate').value=key;
  document.getElementById('staffJoinDateDisplay').value=formatSunbedDisplayDate(key);
  closeStaffJoinCalendarPicker();
}
function renderStaffJoinCalendarPicker(){
  let grid=document.getElementById('staffJoinPickerGrid'),y=staffJoinPickerMonth.getFullYear(),m=staffJoinPickerMonth.getMonth();
  document.getElementById('staffJoinPickerMonthLabel').textContent=new Date(y,m,1).toLocaleDateString('en-GB',{month:'long',year:'numeric'});
  let heads=['Mo','Tu','We','Th','Fr','Sa','Su'].map(x=>`<div style='color:#8f98a4;font-size:11px;padding:6px 0'>${x}</div>`).join('');
  let first=new Date(y,m,1),offset=(first.getDay()+6)%7,days=new Date(y,m+1,0).getDate(),cells='';
  for(let i=0;i<offset;i++)cells+=`<div></div>`;
  for(let d=1;d<=days;d++){
    let key=`${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`,selected=document.getElementById('staffJoinDate').value===key;
    cells+=`<button type='button' onclick="selectStaffJoinDate('${key}')" style='padding:10px 4px;${selected?'border-color:#18d7e8;background:#12343a;color:white;':''}'>${d}</button>`;
  }
  grid.innerHTML=heads+cells;
}
function populateShiftTimes(){
  let start=document.getElementById('shiftStart'),end=document.getElementById('shiftEnd'),opts=[];
  for(let mins=8*60+45;mins<=20*60+15;mins+=15){
    let h=String(Math.floor(mins/60)).padStart(2,'0'),m=String(mins%60).padStart(2,'0'),v=`${h}:${m}`;
    opts.push(`<option value='${v}'>${v}</option>`);
  }
  start.innerHTML=opts.join('');end.innerHTML=opts.join('');
  start.value='08:45';end.value='20:15';
}function openStaffShiftCreate(){if(!data.staffMembers.length)return alert('Create a Staff Member first.');document.getElementById('shiftStaff').innerHTML=data.staffMembers.map(s=>`<option value='${s.id}'>${escapeHtml(s.name)}</option>`).join('');document.getElementById('shiftDate').value=localDateKey();document.getElementById('shiftDateDisplay').value=formatSunbedDisplayDate(localDateKey());populateShiftTimes();document.getElementById('shiftCreateError').style.display='none';updateShiftSummary();document.getElementById('staffShiftCreateModal').classList.add('show')}
function closeStaffShiftCreate(){document.getElementById('staffShiftCreateModal').classList.remove('show')}
function shiftHours(start,end){let s=minutesFromTime(start),e=minutesFromTime(end);return e>s?(e-s)/60:0}
function updateShiftSummary(){let staffId=document.getElementById('shiftStaff').value,date=document.getElementById('shiftDate').value,start=document.getElementById('shiftStart').value,end=document.getElementById('shiftEnd').value,hours=shiftHours(start,end);document.getElementById('shiftHoursPreview').textContent=`${hours.toFixed(2)} hours`;if(!date){document.getElementById('shiftWeekTotalPreview').textContent=`${hours.toFixed(2)} hours`;return;}let d=parseLocalDateKey(date),week=startMonday(d),weekEnd=new Date(week);weekEnd.setDate(weekEnd.getDate()+6);let keys=dateRangeKeys(week,weekEnd),existing=data.staffShifts.filter(s=>s.staffId===staffId&&keys.includes(s.date)).reduce((sum,s)=>sum+(+s.hours||0),0);document.getElementById('shiftWeekTotalPreview').textContent=`${(existing+hours).toFixed(2)} hours`;document.getElementById('shiftWeekRange').textContent=`${nice(week)} – ${nice(weekEnd)}`}
function openShiftCalendarPicker(){let current=document.getElementById('shiftDate').value;shiftPickerMonth=current?parseLocalDateKey(current):new Date();renderShiftCalendarPicker();document.getElementById('shiftCalendarPickerModal').classList.add('show')}
function closeShiftCalendarPicker(){document.getElementById('shiftCalendarPickerModal').classList.remove('show')}
function changeShiftPickerMonth(delta){shiftPickerMonth=new Date(shiftPickerMonth.getFullYear(),shiftPickerMonth.getMonth()+delta,1);renderShiftCalendarPicker()}
function selectShiftDate(key){document.getElementById('shiftDate').value=key;document.getElementById('shiftDateDisplay').value=formatSunbedDisplayDate(key);closeShiftCalendarPicker();updateShiftSummary()}
function renderShiftCalendarPicker(){let grid=document.getElementById('shiftPickerGrid'),y=shiftPickerMonth.getFullYear(),m=shiftPickerMonth.getMonth();document.getElementById('shiftPickerMonthLabel').textContent=new Date(y,m,1).toLocaleDateString('en-GB',{month:'long',year:'numeric'});let heads=['Mo','Tu','We','Th','Fr','Sa','Su'].map(x=>`<div style='color:#8f98a4;font-size:11px;padding:6px 0'>${x}</div>`).join(''),first=new Date(y,m,1),offset=(first.getDay()+6)%7,days=new Date(y,m+1,0).getDate(),cells='';for(let i=0;i<offset;i++)cells+=`<div></div>`;for(let d=1;d<=days;d++){let key=`${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`,selected=document.getElementById('shiftDate').value===key;cells+=`<button type='button' onclick="selectShiftDate('${key}')" style='padding:10px 4px;${selected?'border-color:#18d7e8;background:#12343a;color:white;':''}'>${d}</button>`}grid.innerHTML=heads+cells}
async function saveStaffShift(){let staffId=document.getElementById('shiftStaff').value,date=document.getElementById('shiftDate').value,start=document.getElementById('shiftStart').value,end=document.getElementById('shiftEnd').value,err=document.getElementById('shiftCreateError'),btn=document.getElementById('shiftCreateSaveBtn');err.style.display='none';if(!staffId||!date){err.textContent='Please select staff member and date.';err.style.display='block';return;}
  let holiday=getApprovedHolidayForStaffDate(staffId,date);
  if(holiday){
    let staff=data.staffMembers.find(s=>s.id===staffId);
    alert(`${staff?.name||'This staff member'} is on approved holiday on ${formatSunbedDisplayDate(date)} and cannot be scheduled.`);
    return;
  }
  if(shiftHours(start,end)<=0){err.textContent='End time must be after start time.';err.style.display='block';return;}btn.disabled=true;btn.textContent='Creating...';try{let {error}=await sb.from('staff_shifts').insert({staff_member_id:staffId,shift_date:date,start_time:start,end_time:end});if(error)throw error;closeStaffShiftCreate();await loadLiveData();renderAll()}catch(e){err.textContent=e.message||'Could not create shift.';err.style.display='block'}finally{btn.disabled=false;btn.textContent='Create Shift'}}
function ageFromDob(dob){if(!dob)return null;let d=parseLocalDateKey(dob),n=new Date(),a=n.getFullYear()-d.getFullYear(),m=n.getMonth()-d.getMonth();if(m<0||(m===0&&n.getDate()<d.getDate()))a--;return a}
