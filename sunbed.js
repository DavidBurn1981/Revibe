const SUNBEDS=[
  {name:'Bed 1',type:'Stand Up'},
  {name:'Bed 2',type:'Stand Up'},
  {name:'Bed 3',type:'Lie Down'},
  {name:'Bed 4',type:'Lie Down'}
];
function normalizeBookedBed(x){return SUNBEDS.some(b=>b.name===x.bed)?x.bed:'Unassigned'}
function renderSunbedCalendar(){
  let cal=document.getElementById('sunbedCalendar');if(!cal)return;
  cal.innerHTML='';
  let end=new Date(sunbedWeekStart);end.setDate(end.getDate()+6);
  document.getElementById('sunbedWeekLabel').textContent=`${nice(sunbedWeekStart)} – ${nice(end)} · Beds across columns, dates down rows`;

  let html=`<div class='sunbedMatrix'>
    <div class='sunbedMatrixHead'>Date</div>
    ${SUNBEDS.map(b=>`<div class='sunbedMatrixHead bed'><span>${b.name}</span><span class='bedTypeTag'>${b.type}</span></div>`).join('')}`;

  for(let i=0;i<7;i++){
    let d=new Date(sunbedWeekStart);d.setDate(d.getDate()+i);let key=iso(d);
    let dayRows=(data.sunbedBookings||[]).filter(x=>x.date===key).sort((a,b)=>a.time.localeCompare(b.time));
    html+=`<div class='sunbedMatrixDate'>${nice(d)}</div>`;
    for(let b of SUNBEDS){
      let rows=dayRows.filter(x=>normalizeBookedBed(x)===b.name);
      html+=`<div class='sunbedMatrixCell'>${rows.length?rows.map(x=>`<div class='sunbedBooking'><b>${x.time} · ${x.name}</b>${x.phone?`<div class='muted'>${x.phone}</div>`:''}<div>${x.length} min + 4 min turnaround</div><span class='sessionPill'>${x.sessionType||'Red Light Therapy'}</span></div>`).join(''):`<div class='sunbedEmpty'>Available</div>`}</div>`;
    }
  }
  html+=`</div>`;
  cal.innerHTML=html;
}
function chooseSunbedSessionType(type){
  sunbedSessionType=type;
  [['Red Light Therapy','sunTypeRlt'],['Hybrid','sunTypeHybrid']].forEach(([t,id])=>document.getElementById(id)?.classList.toggle('active',t===type));
}
function updatePreferredBedOptions(){
  let type=document.getElementById('sunbedBedType').value,select=document.getElementById('sunbedBed');
  let beds=type==='Any'?SUNBEDS:SUNBEDS.filter(b=>b.type===type);
  select.innerHTML=`<option value='Any'>No Preference / Auto Assign</option>`+beds.map(b=>`<option value='${b.name}'>${b.name} — ${b.type}</option>`).join('');
}
function formatSunbedDisplayDate(key){
  if(!key)return '';
  let [y,m,d]=key.split('-').map(Number);
  return new Date(y,m-1,d).toLocaleDateString('en-GB',{weekday:'short',day:'numeric',month:'short',year:'numeric'});
}
function openSunbedCalendarPicker(){
  let current=document.getElementById('sunbedDate').value;
  sunbedPickerMonth=current?parseLocalDateKey(current):new Date();
  renderSunbedCalendarPicker();
  document.getElementById('sunbedCalendarPickerModal').classList.add('show');
}
function closeSunbedCalendarPicker(){document.getElementById('sunbedCalendarPickerModal').classList.remove('show')}
function changeSunbedPickerMonth(delta){sunbedPickerMonth=new Date(sunbedPickerMonth.getFullYear(),sunbedPickerMonth.getMonth()+delta,1);renderSunbedCalendarPicker()}
function selectSunbedPickerDate(key){
  document.getElementById('sunbedDate').value=key;
  document.getElementById('sunbedDateDisplay').value=formatSunbedDisplayDate(key);
  populateSunbedTimeOptions();
  closeSunbedCalendarPicker();
}
function renderSunbedCalendarPicker(){
  let grid=document.getElementById('sunbedPickerGrid'),y=sunbedPickerMonth.getFullYear(),m=sunbedPickerMonth.getMonth();
  document.getElementById('sunbedPickerMonthLabel').textContent=new Date(y,m,1).toLocaleDateString('en-GB',{month:'long',year:'numeric'});
  let heads=['Mo','Tu','We','Th','Fr','Sa','Su'].map(x=>`<div style='color:#8f98a4;font-size:11px;padding:6px 0'>${x}</div>`).join('');
  let first=new Date(y,m,1),offset=(first.getDay()+6)%7,days=new Date(y,m+1,0).getDate(),cells='';
  for(let i=0;i<offset;i++)cells+=`<div></div>`;
  for(let d=1;d<=days;d++){
    let key=`${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    let selected=document.getElementById('sunbedDate').value===key;
    cells+=`<button type='button' onclick="selectSunbedPickerDate('${key}')" style='padding:10px 4px;${selected?'border-color:#18d7e8;background:#12343a;color:white;':''}'>${d}</button>`;
  }
  grid.innerHTML=heads+cells;
}
function populateSunbedTimeOptions(selectedTime){
  let select=document.getElementById('sunbedTime'),date=document.getElementById('sunbedDate').value||localDateKey();
  let h=effectiveHoursForDate(date),start=timeToMinutes(h.open),end=timeToMinutes(h.close);
  select.innerHTML='';
  for(let mins=start;mins<end;mins+=5){
    let hh=String(Math.floor(mins/60)).padStart(2,'0'),mm=String(mins%60).padStart(2,'0'),v=`${hh}:${mm}`;
    let o=document.createElement('option');o.value=v;o.textContent=v;select.appendChild(o);
  }
  if(selectedTime&&[...select.options].some(o=>o.value===selectedTime))select.value=selectedTime;
}
function openSunbedBooking(date,time){
  document.getElementById('sunbedBookingModal').classList.add('show');
  document.getElementById('sunbedName').value='';
  document.getElementById('sunbedPhone').value='';
  document.getElementById('sunbedDate').value=date||localDateKey();
  document.getElementById('sunbedDateDisplay').value=formatSunbedDisplayDate(document.getElementById('sunbedDate').value);
  populateSunbedTimeOptions(time);
  document.getElementById('sunbedLength').value='';
  document.getElementById('sunbedBedType').value='Any';
  updatePreferredBedOptions();
  document.getElementById('sunbedBed').value='Any';
  document.getElementById('sunbedTotalTime').value='';
  chooseSunbedSessionType('Red Light Therapy');
}
function closeSunbedBooking(){document.getElementById('sunbedBookingModal').classList.remove('show')}
function updateSunbedTotal(){let n=+document.getElementById('sunbedLength').value||0;document.getElementById('sunbedTotalTime').value=n?`${n+4} minutes`:''}
function minutesFromTime(t){let [h,m]=t.split(':').map(Number);return h*60+m}
function sunbedIsFree(bed,date,start,end){
  return !(data.sunbedBookings||[]).some(x=>{
    if(x.date!==date||normalizeBookedBed(x)!==bed)return false;
    let xs=minutesFromTime(x.time),xe=xs+(+x.totalMinutes||(+x.length+4));
    return start<xe&&end>xs;
  });
}
function chooseAutomaticBed(date,start,end,bedType){
  let candidates=bedType==='Any'?SUNBEDS:SUNBEDS.filter(b=>b.type===bedType);
  return candidates.find(b=>sunbedIsFree(b.name,date,start,end))?.name||null;
}
function closeSunbedConflict(){
  document.getElementById('sunbedConflictModal').classList.remove('show');
  pendingSunbedBooking=null;
}
function showSunbedConflictAlternative(message,alternativeBed){
  document.getElementById('sunbedConflictTitle').textContent='Preferred Bed Unavailable';
  document.getElementById('sunbedConflictMessage').textContent=message;
  document.getElementById('sunbedConflictActions').innerHTML=`<button onclick='closeSunbedConflict()'>No</button><button class='primary' onclick="confirmAlternativeSunbed('${alternativeBed}')">Yes — use ${alternativeBed}</button>`;
  document.getElementById('sunbedConflictModal').classList.add('show');
}
function showSunbedUnavailable(message){
  document.getElementById('sunbedConflictTitle').textContent='No Suitable Bed Available';
  document.getElementById('sunbedConflictMessage').textContent=message;
  document.getElementById('sunbedConflictActions').innerHTML=`<button class='primary' onclick='closeSunbedConflict()'>OK</button>`;
  document.getElementById('sunbedConflictModal').classList.add('show');
}
async function completeSunbedBooking(payload){
  let bedMeta=data.beds?.find(b=>b.name===payload.bed);
  if(!bedMeta)return alert('Bed configuration could not be found.');
  let {error}=await sb.from('sunbed_bookings').insert({
    customer_name:payload.name,customer_phone:payload.phone||null,booking_date:payload.date,start_time:payload.time,
    session_length_minutes:+payload.length,turnaround_minutes:4,bed_id:bedMeta.id,session_type:payload.sessionType,status:'Booked'
  });
  if(error)return showSunbedUnavailable(error.message);
  pendingSunbedBooking=null;document.getElementById('sunbedConflictModal').classList.remove('show');closeSunbedBooking();
  await loadLiveData();renderSunbedCalendar();
}
async function confirmAlternativeSunbed(alternativeBed){
  if(!pendingSunbedBooking)return closeSunbedConflict();
  let meta=SUNBEDS.find(b=>b.name===alternativeBed);
  pendingSunbedBooking.bed=alternativeBed;
  pendingSunbedBooking.bedType=meta?.type||pendingSunbedBooking.bedType;
  await completeSunbedBooking(pendingSunbedBooking);
}
async function saveSunbedBooking(){
  let name=document.getElementById('sunbedName').value.trim(),
      phone=document.getElementById('sunbedPhone').value.trim(),
      date=document.getElementById('sunbedDate').value,
      time=document.getElementById('sunbedTime').value,
      length=+document.getElementById('sunbedLength').value,
      bedType=document.getElementById('sunbedBedType').value,
      requestedBed=document.getElementById('sunbedBed').value;
  if(!name)return alert('Please enter a name.');
  if(!date||!time)return alert('Please select a date and start time.');
  if(!length||length<1)return alert('Please enter the session length.');

  let totalMinutes=length+4,start=minutesFromTime(time),end=start+totalMinutes,bed=requestedBed;

  if(requestedBed==='Any'){
    bed=chooseAutomaticBed(date,start,end,bedType);
    if(!bed){
      let msg=bedType==='Any'
        ? `All four beds are unavailable for ${time} on ${date}.`
        : `Both ${bedType.toLowerCase()} beds are unavailable for ${time} on ${date}.`;
      return showSunbedUnavailable(msg);
    }
  } else if(!sunbedIsFree(requestedBed,date,start,end)){
    let requestedMeta=SUNBEDS.find(b=>b.name===requestedBed);
    let sameTypeBeds=SUNBEDS.filter(b=>b.type===requestedMeta?.type&&b.name!==requestedBed);
    let alternative=sameTypeBeds.find(b=>sunbedIsFree(b.name,date,start,end));

    if(alternative){
      pendingSunbedBooking={
        id:Date.now(),name,phone,date,time,length,totalMinutes,bed:requestedBed,
        bedType:requestedMeta?.type||bedType,sessionType:sunbedSessionType
      };
      return showSunbedConflictAlternative(
        `${requestedBed} is already booked for ${time} on ${date}. ${alternative.name} (${alternative.type}) is available for the full ${totalMinutes}-minute booking window. Would you like to proceed with ${alternative.name}?`,
        alternative.name
      );
    } else {
      return showSunbedUnavailable(
        `Both ${requestedMeta?.type||'requested type'} beds are unavailable for ${time} on ${date}.`
      );
    }
  }

  let actualType=SUNBEDS.find(b=>b.name===bed)?.type||bedType;
  await completeSunbedBooking({name,phone,date,time,length,totalMinutes,bed,bedType:actualType,sessionType:sunbedSessionType});
}
