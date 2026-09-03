let editingMyBookingId=null;

function renderMyBookings(){
  let sel=document.getElementById('myBookingsClinicianSelect');if(!sel)return;
  let row=document.getElementById('myBookingsClinicianRow');
  let isRenter=currentProfile?.role==='renter';

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
  let bookings=(data.appointments||[])
    .filter(b=>myClinicDayIds.has(b.clinicDayId)&&String(b.status||'').toLowerCase()!=='cancelled')
    .sort((a,b)=>(b.date+b.time).localeCompare(a.date+a.time));

  document.getElementById('myBookingsSub').textContent=`${bookings.length} booking${bookings.length===1?'':'s'}`;

  document.getElementById('myBookingsTable').innerHTML='<tr><th>Date</th><th>Time</th><th>Session Type</th><th>Price Payable</th><th>Name</th><th>Phone Number</th></tr>'+
    (bookings.length?bookings.map(b=>{
      let treatment=data.treatments.find(t=>t.id===b.treatmentId);
      let dateLabel=parseLocalDateKey(b.date).toLocaleDateString('en-GB',{weekday:'short',day:'numeric',month:'short'});
      return `<tr class='clinicRow' onclick="openBookingDetail('${b.id}')">
        <td><b>${dateLabel}</b></td>
        <td>${escapeHtml(b.time)}</td>
        <td>${escapeHtml(treatment?.name||'—')}</td>
        <td>£${(+b.amountPayable||0).toFixed(2)}</td>
        <td>${escapeHtml(b.customerName||'')}</td>
        <td>${escapeHtml(b.customerPhone||'')}</td>
      </tr>`;
    }).join(''):`<tr><td colspan='6' class='muted'>No bookings found for this clinician.</td></tr>`);
}

function openBookingDetail(id){
  let b=(data.appointments||[]).find(x=>x.id===id);if(!b)return;
  editingMyBookingId=id;
  let treatment=data.treatments.find(t=>t.id===b.treatmentId);
  let dateLabel=parseLocalDateKey(b.date).toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'long',year:'numeric'});
  document.getElementById('bookingDetailInfo').innerHTML=
    `<b>${escapeHtml(treatment?.name||'Treatment')}</b><br>${dateLabel} at ${escapeHtml(b.time)}<br>${escapeHtml(b.customerName||'')} · ${escapeHtml(b.customerPhone||'')}<br>Price Payable: £${(+b.amountPayable||0).toFixed(2)}`;
  document.getElementById('bookingClinicianNotes').value=b.clinicianNotes||'';
  document.getElementById('bookingDetailError').style.display='none';
  document.getElementById('bookingDetailModal').classList.add('show');
}
function closeBookingDetail(){document.getElementById('bookingDetailModal').classList.remove('show');editingMyBookingId=null}

async function saveClinicianNotes(){
  if(!editingMyBookingId)return;
  let notes=document.getElementById('bookingClinicianNotes').value.trim(),err=document.getElementById('bookingDetailError');
  err.style.display='none';
  try{
    let {error}=await sb.from('treatment_bookings').update({clinician_notes:notes||null}).eq('id',editingMyBookingId);
    if(error)throw error;
    closeBookingDetail();
    await loadLiveData();renderMyBookings();
  }catch(e){err.textContent=e.message||'Could not save notes.';err.style.display='block'}
}
async function deleteMyBooking(){
  if(!editingMyBookingId)return;
  if(!confirm('Delete this booking? This cannot be undone.'))return;
  let {error}=await sb.from('treatment_bookings').delete().eq('id',editingMyBookingId);
  if(error)return alert(error.message);
  closeBookingDetail();
  await loadLiveData();renderMyBookings();
}
