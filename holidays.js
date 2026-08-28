function holidayDateKeys(startKey,endKey){
  if(!startKey||!endKey)return [];
  return dateRangeKeys(parseLocalDateKey(startKey),parseLocalDateKey(endKey));
}
function holidayChargeDays(calendarDays){return calendarDays>0?Math.ceil((calendarDays*5/7)*2)/2:0}
function holidayDaysInclusive(startKey,endKey){
  if(!startKey||!endKey)return 0;
  let s=parseLocalDateKey(startKey),e=parseLocalDateKey(endKey);
  if(e<s)return 0;
  return Math.round((e-s)/86400000)+1;
}
function getApprovedHolidayForStaffDate(staffId,dateKey){
  return (data.holidayRequests||[]).find(h=>h.staffId===staffId&&h.status==='Approved'&&dateKey>=h.startDate&&dateKey<=h.endDate)||null;
}
function staffHolidayRotaConflicts(staffId,startKey,endKey){
  let keys=holidayDateKeys(startKey,endKey);
  return (data.staffShifts||[]).filter(s=>s.staffId===staffId&&keys.includes(s.date));
}
function renderHolidayRequests(){
  let t=document.getElementById('holidayRequestsTable');if(!t)return;
  let rows=[...(data.holidayRequests||[])].sort((a,b)=>b.startDate.localeCompare(a.startDate));
  t.innerHTML=`<tr><th>Staff Member</th><th>Dates</th><th>Days</th><th>Status</th><th>Approved By</th><th>Approved Date</th></tr>`+
    (rows.length?rows.map(h=>{
      let staff=data.staffMembers.find(s=>s.id===h.staffId),approver=data.staffMembers.find(s=>s.id===h.approvedById),
          cls=h.status==='Approved'?'holidayApproved':h.status==='Pending'?'holidayPending':h.status==='Rejected'?'holidayRejected':'holidayCancelled';
      return `<tr class='clinicRow' onclick="openHolidayRequest('${h.id}')">
        <td><b>${escapeHtml(staff?.name||'')}</b></td>
        <td>${formatSunbedDisplayDate(h.startDate)} – ${formatSunbedDisplayDate(h.endDate)}</td>
        <td>${h.daysTotal}</td>
        <td><span class='holidayStatus ${cls}'>${escapeHtml(h.status)}</span></td>
        <td>${escapeHtml(approver?.name||'')}</td>
        <td>${h.approvedDate?formatSunbedDisplayDate(h.approvedDate):''}</td>
      </tr>`;
    }).join(''):`<tr><td colspan='6' class='muted'>No holiday requests yet.</td></tr>`);
}
function openHolidayRequestCreate(){
  if(!data.staffMembers.length)return alert('Create a Staff Member first.');
  editingHolidayRequestId=null;
  document.getElementById('holidayRequestModalTitle').textContent='New Holiday Request';
  document.getElementById('holidayStaff').disabled=false;
  document.getElementById('holidayStaff').innerHTML=data.staffMembers.map(s=>`<option value='${s.id}'>${escapeHtml(s.name)}</option>`).join('');
  let today=localDateKey();
  document.getElementById('holidayStart').value=today;
  document.getElementById('holidayEnd').value=today;
  document.getElementById('holidayStartDisplay').value=formatSunbedDisplayDate(today);
  document.getElementById('holidayEndDisplay').value=formatSunbedDisplayDate(today);
  document.getElementById('holidaySaveBtn').style.display=hasRolePermission('holiday_requests','edit')?'inline-block':'none';
  document.getElementById('holidayApprovalPanel').style.display='none';
  document.getElementById('holidayRequestError').style.display='none';
  document.getElementById('holidayRotaConflict').style.display='none';
  updateHolidayRequestSummary();
  document.getElementById('holidayDeleteBtn').style.display='none';document.getElementById('holidayRequestModal').classList.add('show');
}
function openHolidayRequest(id){
  let h=data.holidayRequests.find(x=>x.id===id);if(!h)return;
  editingHolidayRequestId=id;
  document.getElementById('holidayRequestModalTitle').textContent='Holiday Request';
  document.getElementById('holidayStaff').innerHTML=data.staffMembers.map(s=>`<option value='${s.id}'>${escapeHtml(s.name)}</option>`).join('');
  document.getElementById('holidayStaff').value=h.staffId;
  document.getElementById('holidayStaff').disabled=true;
  document.getElementById('holidayStart').value=h.startDate;
  document.getElementById('holidayEnd').value=h.endDate;
  document.getElementById('holidayStartDisplay').value=formatSunbedDisplayDate(h.startDate);
  document.getElementById('holidayEndDisplay').value=formatSunbedDisplayDate(h.endDate);
  document.getElementById('holidaySaveBtn').style.display=h.status==='Pending'&&hasRolePermission('holiday_requests','edit')?'inline-block':'none';
  document.getElementById('holidayRequestError').style.display='none';

  document.getElementById('holidayApprovalPanel').style.display='block';
  document.getElementById('holidayApprovedBy').innerHTML=data.staffMembers.map(s=>`<option value='${s.id}'>${escapeHtml(s.name)}</option>`).join('');
  if(h.approvedById)document.getElementById('holidayApprovedBy').value=h.approvedById;
  document.getElementById('holidayApprovedBy').disabled=h.status==='Approved';
  document.getElementById('holidayApprovedDate').value=h.approvedDate?formatSunbedDisplayDate(h.approvedDate):'Will populate on approval';
  document.getElementById('holidayApproveBtn').style.display=h.status==='Pending'&&hasRolePermission('holiday_requests','approve')?'inline-block':'none';

  updateHolidayRequestSummary();
  document.getElementById('holidayRequestModal').classList.add('show');
}
async function deleteHolidayRequest(){if(!editingHolidayRequestId)return alert('Save the request first.');if(!confirm('Delete this holiday request?'))return;let h=data.holidayRequests.find(x=>x.id===editingHolidayRequestId),{error}=await sb.from('holiday_requests').delete().eq('id',editingHolidayRequestId);if(error)return alert(error.message);if(h?.status==='Approved'){let rpc=await sb.rpc('recalculate_staff_holiday_remaining',{p_staff_member_id:h.staffId});if(rpc.error)return alert(rpc.error.message)}closeHolidayRequestModal();await loadLiveData();renderAll()}
function closeHolidayRequestModal(){document.getElementById('holidayRequestModal').classList.remove('show');editingHolidayRequestId=null}
function updateHolidayRequestSummary(){
  let staffId=document.getElementById('holidayStaff').value,
      staff=data.staffMembers.find(s=>s.id===staffId),
      start=document.getElementById('holidayStart').value,
      end=document.getElementById('holidayEnd').value,
      calendarDays=holidayDaysInclusive(start,end),
      days=holidayChargeDays(calendarDays);

  document.getElementById('holidayRemainingDisplay').textContent=staff?`${Number(staff.holidaysRemaining).toFixed(1)} days remaining this year`:'';
  document.getElementById('holidayDaysTotal').value=days?`${days} day${days===1?'':'s'} holiday (${calendarDays} calendar day${calendarDays===1?'':'s'})`:'';

  let conflicts=staffHolidayRotaConflicts(staffId,start,end),
      box=document.getElementById('holidayRotaConflict');
  if(conflicts.length){
    let dates=[...new Set(conflicts.map(x=>x.date))].map(formatSunbedDisplayDate);
    box.textContent=`Warning: ${staff?.name||'This staff member'} is currently scheduled on ${dates.join(', ')}. The holiday request can still be saved, but the rota will need updating before/when it is approved.`;
    box.style.display='block';
  }else box.style.display='none';
}
async function saveHolidayRequest(){
  if(!requireRolePermission('holiday_requests','edit'))return;
  let staffId=document.getElementById('holidayStaff').value,start=document.getElementById('holidayStart').value,end=document.getElementById('holidayEnd').value,
      calendarDays=holidayDaysInclusive(start,end),days=holidayChargeDays(calendarDays),err=document.getElementById('holidayRequestError'),btn=document.getElementById('holidaySaveBtn');
  err.style.display='none';
  if(!staffId||!start||!end||days<=0){err.textContent='Please enter valid holiday dates.';err.style.display='block';return;}

  let staff=data.staffMembers.find(s=>s.id===staffId);
  if(staff && days>(+staff.holidaysRemaining||0)){
    alert(`${staff.name} only has ${Number(staff.holidaysRemaining).toFixed(1)} holiday days remaining. This request is for ${days} days and cannot be saved.`);
    return;
  }

  btn.disabled=true;btn.textContent='Saving...';
  try{
    let error;
    if(editingHolidayRequestId){
      ({error}=await sb.from('holiday_requests').update({start_date:start,end_date:end,days_total:days,updated_at:new Date().toISOString()}).eq('id',editingHolidayRequestId));
    }else{
      ({error}=await sb.from('holiday_requests').insert({staff_member_id:staffId,start_date:start,end_date:end,days_total:days,status:'Pending'}));
    }
    if(error)throw error;
    await loadLiveData();renderHolidayRequests();renderStaffRota();closeHolidayRequestModal();
  }catch(e){err.textContent=e.message||'Could not save holiday request.';err.style.display='block';}
  finally{btn.disabled=false;btn.textContent='Save Request';}
}
async function approveHolidayRequest(){
  if(!editingHolidayRequestId||!requireRolePermission('holiday_requests','approve'))return;
  let h=data.holidayRequests.find(x=>x.id===editingHolidayRequestId),approvedBy=document.getElementById('holidayApprovedBy').value,
      err=document.getElementById('holidayApprovalError'),btn=document.getElementById('holidayApproveBtn');
  err.style.display='none';
  if(!approvedBy){err.textContent='Please select who approved the request.';err.style.display='block';return;}

  let conflicts=staffHolidayRotaConflicts(h.staffId,h.startDate,h.endDate);
  if(conflicts.length){
    let staff=data.staffMembers.find(s=>s.id===h.staffId),
        dates=[...new Set(conflicts.map(x=>x.date))].map(formatSunbedDisplayDate).join(', ');
    if(!confirm(`${staff?.name||'This staff member'} is scheduled on ${dates}. Approve the holiday anyway? You will need to amend those rota shifts.`))return;
  }

  btn.disabled=true;btn.textContent='Approving...';
  try{
    let today=localDateKey(),
        {error}=await sb.from('holiday_requests').update({status:'Approved',approved_by_staff_member_id:approvedBy,approved_date:today,updated_at:new Date().toISOString()}).eq('id',editingHolidayRequestId);
    if(error)throw error;
    let rpc=await sb.rpc('recalculate_staff_holiday_remaining',{p_staff_member_id:h.staffId});
    if(rpc.error)throw rpc.error;
    await loadLiveData();renderHolidayRequests();renderStaffMembers();renderStaffRota();closeHolidayRequestModal();
  }catch(e){err.textContent=e.message||'Could not approve holiday.';err.style.display='block';}
  finally{btn.disabled=false;btn.textContent='Approve';}
}
function openHolidayDatePicker(mode){
  holidayPickerMode=mode;
  let key=document.getElementById(mode==='start'?'holidayStart':'holidayEnd').value;
  holidayPickerMonth=key?parseLocalDateKey(key):new Date();
  document.getElementById('holidayDatePickerModeLabel').textContent=mode==='start'?'Start Date':'End Date';
  renderHolidayDatePicker();
  document.getElementById('holidayDatePickerModal').classList.add('show');
}
function closeHolidayDatePicker(){document.getElementById('holidayDatePickerModal').classList.remove('show')}
function changeHolidayPickerMonth(delta){holidayPickerMonth=new Date(holidayPickerMonth.getFullYear(),holidayPickerMonth.getMonth()+delta,1);renderHolidayDatePicker()}
function selectHolidayDate(key){
  let hidden=document.getElementById(holidayPickerMode==='start'?'holidayStart':'holidayEnd'),
      display=document.getElementById(holidayPickerMode==='start'?'holidayStartDisplay':'holidayEndDisplay');
  hidden.value=key;display.value=formatSunbedDisplayDate(key);
  if(holidayPickerMode==='start'&&document.getElementById('holidayEnd').value<key){
    document.getElementById('holidayEnd').value=key;document.getElementById('holidayEndDisplay').value=formatSunbedDisplayDate(key);
  }
  closeHolidayDatePicker();updateHolidayRequestSummary();
}
function renderHolidayDatePicker(){
  let grid=document.getElementById('holidayPickerGrid'),y=holidayPickerMonth.getFullYear(),m=holidayPickerMonth.getMonth();
  document.getElementById('holidayPickerMonthLabel').textContent=new Date(y,m,1).toLocaleDateString('en-GB',{month:'long',year:'numeric'});
  let heads=['Mo','Tu','We','Th','Fr','Sa','Su'].map(x=>`<div style='color:#8f98a4;font-size:11px;padding:6px 0'>${x}</div>`).join(''),
      first=new Date(y,m,1),offset=(first.getDay()+6)%7,days=new Date(y,m+1,0).getDate(),cells='';
  for(let i=0;i<offset;i++)cells+='<div></div>';
  for(let d=1;d<=days;d++){
    let key=`${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    cells+=`<button type='button' onclick="selectHolidayDate('${key}')" style='padding:10px 4px'>${d}</button>`;
  }
  grid.innerHTML=heads+cells;
}
