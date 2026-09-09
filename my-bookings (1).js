let editingMyBookingId=null;

function createBookingFromMyBookings(){
  let isRenter=currentProfile?.role==='renter';
  let renterId=isRenter?currentProfile.renter_id:document.getElementById('myBookingsClinicianSelect').value;
  if(!renterId)return alert('Please select a clinician first.');
  openBookingForClinician(renterId);
}

function renderMyBookings(){
  let sel=document.getElementById('myBookingsClinicianSelect');if(!sel)return;
  let row=document.getElementById('myBookingsClinicianRow');
  let isRenter=currentProfile?.role==='renter';

  let createBtn=document.getElementById('myBookingsCreateBtn');
  if(createBtn)createBtn.style.display=hasRolePermission('my_bookings','edit')?'inline-block':'none';

  if(isRenter){
    row.style.display='none';
  }else{
    row.style.display='block';
    if(!sel.dataset.populated){
      sel.innerHTML=(data.renters||[]).map(r=>`<option value='${r.id}'>${escapeHtml(r.name)}</option>`).join('');
      sel.dataset.populated='1';
    }
    if(!sel.value&&data.renters?.length)sel.value=data.renters[0].id;
  }

  let renterId=isRenter?currentProfile.renter_id:sel.value;
  if(!renterId){
    document.getElementById('myBookingsSub').textContent='';
    document.getElementById('myBookingsTable').innerHTML=`<tr><td class='muted'>No clinician selected.</td></tr>`;
    return;
  }

  let myClinicDayIds=new Set((data.clinicDays||[]).filter(c=>c.renterId===renterId).map(c=>c.id));
  let range=document.getElementById('myBookingsRangeSelect')?.value||'upcoming';
  let today=localDateKey();
  let bookings=(data.appointments||[])
    .filter(b=>myClinicDayIds.has(b.clinicDayId))
    .filter(b=>{
      if(range==='upcoming')return b.date>=today;
      if(range==='past')return b.date<today;
      return true;
    })
    .sort((a,b)=>(parseLocalDateKey(b.date).getTime()+minutesFromTime(b.time)*60000)-(parseLocalDateKey(a.date).getTime()+minutesFromTime(a.time)*60000));

  document.getElementById('myBookingsSub').textContent=`${bookings.length} booking${bookings.length===1?'':'s'}`;

  document.getElementById('myBookingsTable').innerHTML='<tr><th>Date</th><th>Time</th><th>Session Type</th><th>Length</th><th>Price Payable</th><th>Name</th><th>Phone Number</th><th>Status</th><th>Booked On</th></tr>'+
    (bookings.length?bookings.map(b=>{
      let treatment=data.treatments.find(t=>t.id===b.treatmentId);
      let dateLabel=parseLocalDateKey(b.date).toLocaleDateString('en-GB',{weekday:'short',day:'numeric',month:'short'});
      let bookedOn=b.createdAt?new Date(b.createdAt).toLocaleString('en-GB',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}):'—';
      let status=b.status||'BOOKED';
      let statusClass=status==='CANCELLED BY CUSTOMER'?'bookingStatusCancelled':status==='BOOKING CONFIRMED'?'bookingStatusConfirmed':'bookingStatusBooked';
      return `<tr class='clinicRow' onclick="openBookingDetail('${b.id}')">
        <td><b>${dateLabel}</b></td>
        <td>${escapeHtml(b.time)}</td>
        <td>${escapeHtml(treatment?.name||'—')}</td>
        <td>${+b.durationMinutes||0} min</td>
        <td>£${(+b.amountPayable||0).toFixed(2)}</td>
        <td>${escapeHtml(b.customerName||'')}</td>
        <td>${escapeHtml(b.customerPhone||'')}</td>
        <td><span class='bookingStatusBadge ${statusClass}'>${escapeHtml(status)}</span></td>
        <td>${escapeHtml(bookedOn)}</td>
      </tr>`;
    }).join(''):`<tr><td colspan='9' class='muted'>No bookings found for this clinician.</td></tr>`);
}

function openBookingDetail(id){
  let b=(data.appointments||[]).find(x=>x.id===id);if(!b)return;
  editingMyBookingId=id;
  let treatment=data.treatments.find(t=>t.id===b.treatmentId);
  let dateLabel=parseLocalDateKey(b.date).toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'long',year:'numeric'});
  document.getElementById('bookingDetailInfo').innerHTML=
    `<b>${escapeHtml(treatment?.name||'Treatment')}</b><br>${dateLabel} at ${escapeHtml(b.time)}<br>${escapeHtml(b.customerName||'')} · ${escapeHtml(b.customerPhone||'')}<br>Price Payable: £${(+b.amountPayable||0).toFixed(2)}`;
  document.getElementById('bookingDetailStatus').value=b.status||'BOOKED';
  document.getElementById('bookingClinicianNotes').value=b.clinicianNotes||'';
  document.getElementById('bookingDetailError').style.display='none';
  document.getElementById('bookingDetailModal').classList.add('show');
}
function closeBookingDetail(){document.getElementById('bookingDetailModal').classList.remove('show');editingMyBookingId=null}

async function saveBookingDetail(){
  if(!editingMyBookingId)return;
  let notes=document.getElementById('bookingClinicianNotes').value.trim(),
      status=document.getElementById('bookingDetailStatus').value,
      err=document.getElementById('bookingDetailError');
  err.style.display='none';
  try{
    let {error}=await sb.from('treatment_bookings').update({clinician_notes:notes||null,status}).eq('id',editingMyBookingId);
    if(error)throw error;
    closeBookingDetail();
    await loadLiveData();
    if(document.getElementById('myBookingsTable'))renderMyBookings();
    if(document.getElementById('calendar'))renderCalendar();
  }catch(e){err.textContent=e.message||'Could not save changes.';err.style.display='block'}
}
async function deleteMyBooking(){
  if(!editingMyBookingId)return;
  if(!confirm('Delete this booking? This cannot be undone.'))return;
  let {error}=await sb.from('treatment_bookings').delete().eq('id',editingMyBookingId);
  if(error)return alert(error.message);
  closeBookingDetail();
  await loadLiveData();
  if(document.getElementById('myBookingsTable'))renderMyBookings();
  if(document.getElementById('calendar'))renderCalendar();
}
