let portalPreviewCustomerId=null;
let babSelectedDate=null,babSelectedTime=null,babSelectedLength=null,babSelectedBedType='Any';

function searchPortalPreviewCustomer(){
  let q=document.getElementById('portalPreviewCustomerSearch').value.trim().toLowerCase();
  let results=document.getElementById('portalPreviewCustomerResults');
  if(!q){results.style.display='none';results.innerHTML='';return}
  let matches=(data.customers||[]).filter(c=>c.active!==false&&`${c.firstName} ${c.lastName}`.toLowerCase().includes(q)).slice(0,8);
  results.innerHTML=matches.length
    ? matches.map(c=>`<div class='customerSearchResultRow' onmousedown="event.preventDefault();selectPortalPreviewCustomer('${c.id}')"><b>${escapeHtml(c.firstName)} ${escapeHtml(c.lastName)}</b><div class='sub'>${escapeHtml(c.accountNumber)}</div></div>`).join('')
    : `<div class='customerSearchResultRow muted'>No matches</div>`;
  results.style.display='block';
}
function hidePortalPreviewResultsDelayed(){
  setTimeout(()=>{let r=document.getElementById('portalPreviewCustomerResults');if(r)r.style.display='none'},150);
}
function selectPortalPreviewCustomer(id){
  portalPreviewCustomerId=id;
  let c=(data.customers||[]).find(x=>x.id===id);if(!c)return;
  document.getElementById('portalPreviewCustomerSearch').value=`${c.firstName} ${c.lastName}`;
  document.getElementById('portalPreviewCustomerResults').style.display='none';
  renderPortalPreview();
}
function renderPortalPreview(){
  let c=(data.customers||[]).find(x=>x.id===portalPreviewCustomerId);if(!c)return;
  document.getElementById('portalPreviewEmpty').style.display='none';
  document.getElementById('portalPreviewContent').style.display='block';
  document.getElementById('portalMinutesLeft').textContent=c.minutesLeft;
  document.getElementById('portalName').textContent=`${c.firstName} ${c.lastName}`;
  document.getElementById('portalAddress').textContent=c.address||'—';

  let sessions=(data.bedSessions||[]).filter(s=>s.customerId===c.id).sort((a,b)=>(b.date+(b.time||'')).localeCompare(a.date+(a.time||'')));
  document.getElementById('portalSessionsTable').innerHTML='<tr><th>Date</th><th>Time</th><th>Length</th><th>Session Type</th></tr>'+
    (sessions.length?sessions.map(s=>`<tr><td>${formatSunbedDisplayDate(s.date)}</td><td>${escapeHtml(s.time||'')}</td><td>${perfMinutes(s)} min</td><td>${escapeHtml(s.sessionType||'')}</td></tr>`).join(''):`<tr><td colspan='4' class='muted' style='text-align:center;padding:16px'>No sessions yet.</td></tr>`);

  let purchases=(data.customerPurchases||[]).filter(p=>p.customerId===c.id).sort((a,b)=>(b.createdAt||'').localeCompare(a.createdAt||''));
  document.getElementById('portalPurchasesTable').innerHTML='<tr><th>Date</th><th>Total</th></tr>'+
    (purchases.length?purchases.map(p=>`<tr><td>${formatSunbedDisplayDate(p.date)}</td><td>£${p.grandTotal.toFixed(2)}</td></tr>`).join(''):`<tr><td colspan='2' class='muted' style='text-align:center;padding:16px'>No purchases yet.</td></tr>`);

  let bookings=(data.sunbedBookings||[]).filter(b=>b.customerId===c.id).sort((a,b)=>(b.date+b.time).localeCompare(a.date+a.time));
  document.getElementById('portalBedBookingsTable').innerHTML='<tr><th>Date</th><th>Time</th><th>Length</th><th>Bed</th><th>Status</th><th></th></tr>'+
    (bookings.length?bookings.map(b=>`<tr><td>${formatSunbedDisplayDate(b.date)}</td><td>${escapeHtml(b.time)}</td><td>${b.length} min</td><td>${escapeHtml(b.bed)}</td><td>${escapeHtml(b.status)}</td><td>${b.status==='Booked'?`<button onclick="cancelPortalBedBooking('${b.id}')">Cancel</button>`:''}</td></tr>`).join(''):`<tr><td colspan='6' class='muted' style='text-align:center;padding:16px'>No bed bookings yet.</td></tr>`);
}

function openBookABedFlow(){
  if(!portalPreviewCustomerId){alert('Please select a customer to preview first.');return}
  babSelectedDate=null;babSelectedTime=null;babSelectedLength=null;
  document.getElementById('babDate').value='';
  document.getElementById('babLength').value='';
  document.getElementById('babBedType').value='Any';
  document.getElementById('babError').style.display='none';
  document.getElementById('bookABedStep1').style.display='block';
  document.getElementById('bookABedStep2').style.display='none';
  document.getElementById('bookABedStep3').style.display='none';
  document.getElementById('bookABedStep4').style.display='none';
  document.getElementById('bookABedModal').classList.add('show');
}

function searchBedSlots(){
  let err=document.getElementById('babError');err.style.display='none';
  let date=document.getElementById('babDate').value;
  let length=+document.getElementById('babLength').value;
  let bedType=document.getElementById('babBedType').value;
  if(!date){err.textContent='Please choose a date.';err.style.display='block';return}
  if(!length||length<1){err.textContent='Please enter the session length.';err.style.display='block';return}

  let c=(data.customers||[]).find(x=>x.id===portalPreviewCustomerId);
  if(length>c.minutesLeft){
    err.textContent=`You need ${length} minutes for this session but only have ${c.minutesLeft} on your account. Please purchase more minutes in the shop.`;
    err.style.display='block';
    return;
  }

  let bufferBefore=3,turnaround=2,totalWindow=bufferBefore+length+turnaround;
  document.getElementById('babTotalLine').textContent=`Your full booking window (including 3 minutes before and 2 minutes after) will be ${totalWindow} minutes.`;

  let hours=effectiveHoursForDate(date),openMin=minutesFromTime(hours.open),closeMin=minutesFromTime(hours.close);
  let bedsOfType=(data.beds||[]).filter(b=>b.active!==false&&(bedType==='Any'||b.type===bedType));
  let existingBookings=(data.sunbedBookings||[]).filter(b=>b.date===date&&(b.status==='Booked'||b.status==='Completed'));

  let slots=[];
  for(let startMin=openMin;startMin+length+turnaround<=closeMin;startMin+=5){
    let windowStart=startMin-bufferBefore,windowEnd=startMin+length+turnaround;
    let anyBedFree=bedsOfType.some(bed=>{
      return !existingBookings.some(b=>{
        if(b.bed!==bed.name)return false;
        let bStart=minutesFromTime(b.time)-(b.bufferBeforeMinutes||0),bEnd=minutesFromTime(b.time)+b.totalMinutes;
        return windowStart<bEnd&&windowEnd>bStart;
      });
    });
    if(anyBedFree){
      let hh=String(Math.floor(startMin/60)).padStart(2,'0'),mm=String(startMin%60).padStart(2,'0');
      slots.push(`${hh}:${mm}`);
    }
  }

  babSelectedDate=date;babSelectedLength=length;babSelectedBedType=bedType;

  document.getElementById('babChosenDateLabel').textContent=formatSunbedDisplayDate(date);
  document.getElementById('babChosenLengthLabel').textContent=length;
  document.getElementById('babSlotGrid').innerHTML=slots.length
    ? slots.map(t=>`<button type='button' onclick="pickBedSlot('${t}')">${t}</button>`).join('')
    : `<div class='muted'>No slots are available for this length on this date. Try a different date.</div>`;

  document.getElementById('bookABedStep1').style.display='none';
  document.getElementById('bookABedStep2').style.display='block';
}

function pickBedSlot(time){
  babSelectedTime=time;
  document.getElementById('babConfirmMinutes').textContent=babSelectedLength;
  document.getElementById('babConfirmTime').textContent=time;
  document.getElementById('babConfirmDate').textContent=formatSunbedDisplayDate(babSelectedDate);
  document.getElementById('bookABedStep2').style.display='none';
  document.getElementById('bookABedStep3').style.display='block';
}

async function confirmBedBooking(){
  try{
    let {data:result,error}=await sb.rpc('create_bed_booking',{
      p_customer:portalPreviewCustomerId,p_booking_date:babSelectedDate,p_start_time:babSelectedTime,
      p_session_length_minutes:babSelectedLength,p_session_type:'Hybrid',p_preferred_bed_type:babSelectedBedType
    });
    if(error)throw error;
    let row=Array.isArray(result)?result[0]:result;
    document.getElementById('babConfirmationText').innerHTML=`Your ${babSelectedLength}-minute session is booked for ${formatSunbedDisplayDate(babSelectedDate)} at ${babSelectedTime}, on ${escapeHtml(row.bed_name)}.<br>You now have ${row.minutes_left} minutes left on your account.`;
    document.getElementById('bookABedStep3').style.display='none';
    document.getElementById('bookABedStep4').style.display='block';
    await loadLiveData();
    renderPortalPreview();
  }catch(e){
    let err=document.getElementById('babError');
    if(e.message&&e.message.includes('INSUFFICIENT_MINUTES')){
      err.textContent='You do not have enough minutes for this session. Please purchase more minutes in the shop.';
    }else if(e.message&&e.message.includes('NO_BED_AVAILABLE')){
      err.textContent='Sorry, that time just became unavailable. Please choose another slot.';
    }else{
      err.textContent=e.message||'Could not complete this booking.';
    }
    err.style.display='block';
    document.getElementById('bookABedStep3').style.display='none';
    document.getElementById('bookABedStep2').style.display='block';
  }
}

async function cancelPortalBedBooking(bookingId){
  if(!confirm('Cancel this bed booking?'))return;
  try{
    let {data:result,error}=await sb.rpc('cancel_bed_booking',{p_booking_id:bookingId});
    if(error)throw error;
    let row=Array.isArray(result)?result[0]:result;
    alert(row.refunded?`Booking cancelled. ${row.minutes_left} minutes refunded to your account.`:`Booking cancelled. Since this was within 1 hour of the start time, minutes were not refunded.`);
    await loadLiveData();
    renderPortalPreview();
  }catch(e){alert(e.message||'Could not cancel this booking.')}
}
