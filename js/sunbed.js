const SUNBEDS=[
  {name:'Bed 1',type:'Stand Up'},
  {name:'Bed 2',type:'Stand Up'},
  {name:'Bed 3',type:'Lie Down'},
  {name:'Bed 4',type:'Lie Down'}
];
let sunbedViewDate=localDateKey();
function normalizeBookedBed(x){return SUNBEDS.some(b=>b.name===x.bed)?x.bed:'Unassigned'}
let sunbedDetailBookingId=null;
function openSunbedBookingDetail(id){
  let b=(data.sunbedBookings||[]).find(x=>x.id===id);if(!b)return;
  sunbedDetailBookingId=id;
  let phone=b.phone;
  if(b.customerId){
    let c=(data.customers||[]).find(x=>x.id===b.customerId);
    if(c&&c.phone)phone=c.phone;
  }
  let madeAt=b.createdAt?new Date(b.createdAt).toLocaleString('en-GB',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}):'—';
  document.getElementById('sunbedBookingDetailContent').innerHTML=`
    <div class='formgrid' style='grid-template-columns:repeat(2,1fr)'>
      <div><label>Customer</label><div>${escapeHtml(b.name||'')}</div></div>
      <div><label>Phone</label><div>${escapeHtml(phone||'—')}</div></div>
      <div><label>Date</label><div>${formatSunbedDisplayDate(b.date)}</div></div>
      <div><label>Time</label><div>${escapeHtml(b.time)}</div></div>
      <div><label>Bed</label><div>${escapeHtml(b.bed)}</div></div>
      <div><label>Length</label><div>${b.length} minutes</div></div>
      <div><label>Session Type</label><div>${escapeHtml(b.sessionType||'')}</div></div>
      <div><label>Status</label><div>${escapeHtml(b.status)}</div></div>
      <div><label>Booking Made</label><div>${madeAt}</div></div>
      <div><label>Source</label><div>${b.customerId?'Online Booking':'Booked In Shop'}</div></div>
    </div>`;
  document.getElementById('sunbedBookingDetailError').style.display='none';
  let actions=document.getElementById('sunbedBookingDetailActions');
  actions.innerHTML=(b.status!=='Cancelled'&&b.customerId)
    ?`<button class='danger' id='sunbedCancelBtn' onclick='sunbedCancelBookingFromDetail()'>Cancel Booking</button>`
    :'';
  document.getElementById('sunbedBookingDetailModal').classList.add('show');
}
async function sunbedCancelBookingFromDetail(){
  if(!sunbedDetailBookingId)return;
  if(!confirm('Cancel this booking? If the session is more than 1 hour away, minutes will be refunded automatically.'))return;
  let err=document.getElementById('sunbedBookingDetailError');err.style.display='none';
  let btn=document.getElementById('sunbedCancelBtn');btn.disabled=true;btn.textContent='Cancelling...';
  try{
    let {data:result,error}=await sb.rpc('cancel_bed_booking',{p_booking_id:sunbedDetailBookingId});
    if(error)throw error;
    let row=Array.isArray(result)?result[0]:result;
    document.getElementById('sunbedBookingDetailModal').classList.remove('show');
    await loadLiveData();renderSunbedCalendar();renderCustomers();
    alert(row.refunded?`Booking cancelled. Minutes refunded — customer now has ${row.minutes_left} minutes.`:'Booking cancelled. This was within 1 hour of the session, so minutes were not refunded.');
  }catch(e){
    err.textContent=e.message||'Could not cancel this booking.';err.style.display='block';
    btn.disabled=false;btn.textContent='Cancel Booking';
  }
}
function renderSunbedCalendar(){
  let cal=document.getElementById('sunbedCalendar');if(!cal)return;
  cal.innerHTML='';
  let viewDate=sunbedViewDate||localDateKey();
  document.getElementById('sunbedWeekLabel').textContent=formatSunbedDisplayDate(viewDate);
  let dateInput=document.getElementById('sunbedViewDateInput');if(dateInput)dateInput.value=viewDate;

  let hours=effectiveHoursForDate(viewDate);
  let openMin=minutesFromTime(hours.open),closeMin=minutesFromTime(hours.close);
  let dayBookings=(data.sunbedBookings||[]).filter(x=>x.date===viewDate&&x.status!=='Cancelled');
  let turnaround=4; // matches the existing "4 min turnaround" shown on each booking card

  let html=`<div class='sunbedDayGrid' style='grid-template-columns:90px repeat(${SUNBEDS.length},minmax(200px,1fr))'>
    <div class='sunbedMatrixHead'>Time</div>
    ${SUNBEDS.map(b=>`<div class='sunbedMatrixHead bed'><span>${b.name}</span><span class='bedTypeTag'>${b.type}</span></div>`).join('')}`;

  let covered={};
  for(let m=openMin;m<closeMin;m+=15){
    let hh=String(Math.floor(m/60)).padStart(2,'0'),mm=String(m%60).padStart(2,'0'),t=`${hh}:${mm}`;
    html+=`<div class='sunbedTimeLabel'>${t}</div>`;
    for(let b of SUNBEDS){
      let key=b.name+'|'+m;
      if(covered[key])continue;
      let booking=dayBookings.find(x=>normalizeBookedBed(x)===b.name&&Math.floor(minutesFromTime(x.time)/15)*15===m);
      if(booking){
        let span=Math.max(1,Math.ceil((booking.length+turnaround)/15));
        for(let s=1;s<span;s++)covered[b.name+'|'+(m+s*15)]=true;
        html+=`<div class='sunbedDayCell' style='grid-row:span ${span}'><div class='sunbedBooking' style='margin-top:0;height:100%' onclick="openSunbedBookingDetail('${booking.id}')"><b>${booking.time} · ${escapeHtml(booking.name||'')}</b>${booking.phone?`<div class='muted'>${escapeHtml(booking.phone)}</div>`:''}<div>${booking.length} min + ${turnaround} min turnaround</div><span class='sessionPill'>${escapeHtml(booking.sessionType||'Red Light Therapy')}</span></div></div>`;
      }else{
        html+=`<div class='sunbedDayCell'><div class='sunbedEmpty'>Available</div></div>`;
      }
    }
  }
  html+=`</div>`;
  cal.innerHTML=html;
}
function chooseSunbedSessionType(type){
  sunbedSessionType=type;
  [['Red Light Therapy','sunTypeRlt'],['Hybrid','sunTypeHybrid']].forEach(([t,id])=>document.getElementById(id)?.classList.toggle('active',t===type));
  sunbedCheckSkinTypeWarning();
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
let sunbedSelectedCustomerId=null;
function openSunbedBooking(date,time){
  document.getElementById('sunbedBookingModal').classList.add('show');
  sunbedSelectedCustomerId=null;
  document.getElementById('sunbedCustomerSearch').value='';
  document.getElementById('sunbedCustomerSearch').style.display='block';
  document.getElementById('sunbedCustomerResults').style.display='none';
  document.getElementById('sunbedCustomerSelected').style.display='none';
  document.getElementById('sunbedCustomerBalance').textContent='';
  document.getElementById('sunbedSkinTypeWarning').style.display='none';
  document.getElementById('sunbedBookingError').style.display='none';
  document.getElementById('sunbedDate').value=date||localDateKey();
  document.getElementById('sunbedDateDisplay').value=formatSunbedDisplayDate(document.getElementById('sunbedDate').value);
  populateSunbedTimeOptions(time);
  document.getElementById('sunbedLength').value='';
  document.getElementById('sunbedBedType').value='Any';
  document.getElementById('sunbedTotalTime').value='';
  chooseSunbedSessionType('Red Light Therapy');
}
function sunbedSearchCustomer(){
  let q=document.getElementById('sunbedCustomerSearch').value.trim().toLowerCase();
  let results=document.getElementById('sunbedCustomerResults');
  if(!q){results.style.display='none';results.innerHTML='';return}
  let matches=(data.customers||[]).filter(c=>c.active!==false&&`${c.firstName} ${c.lastName}`.toLowerCase().includes(q)).slice(0,8);
  results.innerHTML=matches.length
    ? matches.map(c=>`<div class='customerSearchResultRow' onmousedown="event.preventDefault();sunbedPickCustomer('${c.id}')"><b>${escapeHtml(c.firstName)} ${escapeHtml(c.lastName)}</b><div class='sub muted'>${escapeHtml(c.accountNumber)}</div></div>`).join('')
    : `<div class='customerSearchResultRow muted'>No matching customers.</div>`;
  results.style.display='block';
}
function sunbedHideCustomerResultsDelayed(){
  setTimeout(()=>{document.getElementById('sunbedCustomerResults').style.display='none'},150);
}
function sunbedPickCustomer(id){
  let c=(data.customers||[]).find(x=>x.id===id);if(!c)return;
  sunbedSelectedCustomerId=id;
  document.getElementById('sunbedCustomerSearch').style.display='none';
  document.getElementById('sunbedCustomerResults').style.display='none';
  document.getElementById('sunbedCustomerResults').innerHTML='';
  let chip=document.getElementById('sunbedCustomerSelected');
  chip.innerHTML=`<span>${escapeHtml(c.firstName)} ${escapeHtml(c.lastName)} (${escapeHtml(c.accountNumber)})</span><button type='button' onclick='sunbedClearCustomer()'>✕</button>`;
  chip.style.display='flex';
  document.getElementById('sunbedCustomerBalance').textContent=`${c.minutesLeft} minutes on account. Skin type: ${c.skinType||'Not on file'}.`;
  document.getElementById('sunbedBookingError').style.display='none';
  sunbedCheckSkinTypeWarning();
}
function sunbedClearCustomer(){
  sunbedSelectedCustomerId=null;
  document.getElementById('sunbedCustomerSearch').value='';
  document.getElementById('sunbedCustomerSearch').style.display='block';
  document.getElementById('sunbedCustomerSelected').style.display='none';
  document.getElementById('sunbedCustomerBalance').textContent='';
  document.getElementById('sunbedSkinTypeWarning').style.display='none';
}
function sunbedCheckSkinTypeWarning(){
  let c=(data.customers||[]).find(x=>x.id===sunbedSelectedCustomerId);
  let length=+document.getElementById('sunbedLength').value||0,
      isHybrid=document.getElementById('sunTypeHybrid').classList.contains('active'),
      threshold=c&&c.skinType===1?6:c&&c.skinType===2?8:c&&c.skinType===3?10:null,
      warningEl=document.getElementById('sunbedSkinTypeWarning');
  warningEl.style.display=(isHybrid&&threshold!==null&&length>threshold)?'block':'none';
}
function closeSunbedBooking(){document.getElementById('sunbedBookingModal').classList.remove('show')}
function updateSunbedTotal(){let n=+document.getElementById('sunbedLength').value||0;document.getElementById('sunbedTotalTime').value=n?`${n+2} minutes`:''}
function sunbedUpdateTotal(){updateSunbedTotal()}
function minutesFromTime(t){let [h,m]=t.split(':').map(Number);return h*60+m}
async function saveSunbedBooking(){
  let err=document.getElementById('sunbedBookingError');err.style.display='none';
  if(!sunbedSelectedCustomerId)return alert('Please search for and select a customer.');
  let date=document.getElementById('sunbedDate').value,
      time=document.getElementById('sunbedTime').value,
      length=+document.getElementById('sunbedLength').value,
      bedType=document.getElementById('sunbedBedType').value;
  if(!date||!time)return alert('Please select a date and start time.');
  if(!length||length<1)return alert('Please enter the session length.');

  let btn=document.getElementById('sunbedSaveBtn');btn.disabled=true;btn.textContent='Booking...';
  try{
    let {data:result,error}=await sb.rpc('create_bed_booking',{
      p_customer:sunbedSelectedCustomerId,p_booking_date:date,p_start_time:time,
      p_session_length_minutes:length,p_session_type:sunbedSessionType,p_preferred_bed_type:bedType
    });
    if(error)throw error;
    let row=Array.isArray(result)?result[0]:result;
    closeSunbedBooking();
    await loadLiveData();renderSunbedCalendar();renderCustomers();
    alert(`Booked on ${row.bed_name} for ${date} at ${time}. Customer now has ${row.minutes_left} minutes left.`);
  }catch(e){
    let msg=e.message||'Could not create this booking.';
    if(msg.includes('INSUFFICIENT_MINUTES'))msg='This customer does not have enough minutes for this session.';
    else if(msg.includes('UNLIMITED_DAILY_LIMIT'))msg='This customer is an Unlimited Member and can only have one session per 24 hours.';
    else if(msg.includes('NO_BED_AVAILABLE'))msg='No suitable bed is available for that time - please try a different time or bed type.';
    err.textContent=msg;err.style.display='block';
  }finally{
    btn.disabled=false;btn.textContent='Book Sunbed';
  }
}
