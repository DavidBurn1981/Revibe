function renderCalendar(){let cal=document.getElementById('calendar');cal.innerHTML='';let end=new Date(weekStart);end.setDate(end.getDate()+displayDays-1);let rangeName=displayDays===7?'Week':displayDays===14?'Next 2 Weeks':'Next 30 Days';document.getElementById('weekLabel').textContent=`${rangeName} · ${nice(weekStart)} – ${nice(end)}`;for(let i=0;i<displayDays;i++){let d=new Date(weekStart);d.setDate(d.getDate()+i);let ds=iso(d),clinic=data.clinicDays.find(x=>x.date===ds),r=clinic&&data.renters.find(x=>x.id===clinic.renterId);let el=document.createElement('div');el.className='day';el.innerHTML=`<div class='dayhead'><div class='date'>${nice(d)}</div><button class='openClinicDayBtn' onclick="openClinicDayForDate('${ds}')">${clinic?'Open Clinic Day':'Create Clinic Day'}</button>${clinic?`<div class='clinic'><strong>${clinic.product}</strong><br>${r?.name||''}<br>${clinic.start}–${clinic.end}</div>`:`<div class='clinic muted'>No clinic planned</div>`}</div>`;if(clinic){let startHour=parseInt(clinic.start.split(':')[0],10)||9,endHour=parseInt(clinic.end.split(':')[0],10)||18;let dayAppointments=(data.appointments||[]).filter(a=>a.date===ds);for(let h=startHour;h<endHour;h++){['00','15','30','45'].forEach(m=>{let t=String(h).padStart(2,'0')+':'+m;let slotStart=h*60+parseInt(m,10);let ap=dayAppointments.find(a=>a.time===t);let ongoing=!ap&&dayAppointments.find(a=>{let as=minutesFromTime(a.time),ae=as+appointmentReservedMinutes(a);return slotStart>=as&&slotStart<ae});let slot=document.createElement('div');if(ap){slot.className='slot';slot.onclick=()=>openBooking(ds,t);slot.innerHTML=`<div class='time'>${t}</div>`+apptHtml(ap)}else if(ongoing){slot.className='slot slotContinuation';slot.innerHTML=`<div class='time'>${t}</div><div class='continuation'>↳ continued</div>`}else{slot.className='slot';slot.onclick=()=>openBooking(ds,t);slot.innerHTML=`<div class='time'>${t}</div><div class='available'>Available</div>`}el.appendChild(slot)})}}cal.appendChild(el)}}function apptHtml(a){let tr=data.treatments.find(x=>x.id===a.treatmentId),c=data.customers.find(x=>x.id===a.customerId),name=a.customerName||c?.name||'Customer';return `<div class='appt'><strong>${escapeHtml(tr?.name||'Treatment')}</strong><br>${escapeHtml(name)} · ${escapeHtml(tr?.duration||'')}m</div>`}
function treatmentReservedMinutes(t){
  return (+t?.duration||0)+(+t?.buffer||0);
}
function appointmentReservedMinutes(a){
  let t=data.treatments.find(x=>x.id===a.treatmentId);
  return treatmentReservedMinutes(t);
}
function treatmentRoomIsFree(date,startMin,endMin){
  return !(data.appointments||[]).some(a=>{
    if(a.date!==date)return false;
    let as=minutesFromTime(a.time),ae=as+appointmentReservedMinutes(a);
    return startMin<ae&&endMin>as;
  });
}
function clinicHasAnyCapacity(clinic){
  let start=minutesFromTime(clinic.start),end=minutesFromTime(clinic.end);
  for(let m=start;m<end;m+=5){
    if(treatmentRoomIsFree(clinic.date,m,m+5))return true;
  }
  return false;
}
function clinicAvailableTimes(clinic,treatment){
  let times=[],
      duration=treatmentReservedMinutes(treatment),
      start=minutesFromTime(clinic.start),
      end=minutesFromTime(clinic.end);

  // Offer customer-facing appointment start times on 15-minute boundaries.
  // If a clinic starts off-boundary (e.g. 09:10), move to the next 15-minute slot.
  let firstStart=Math.ceil(start/15)*15;

  for(let m=firstStart;m+duration<=end;m+=15){
    if(treatmentRoomIsFree(clinic.date,m,m+duration)){
      let hh=String(Math.floor(m/60)).padStart(2,'0'),
          mm=String(m%60).padStart(2,'0');
      times.push(`${hh}:${mm}`);
    }
  }
  return times;
}
function resetTreatmentBookingSteps(){
  ['bookingClinicStep','bookingTreatmentStep','bookingDetailsStep'].forEach(id=>document.getElementById(id).style.display='none');
  document.getElementById('bookingClinicNotice').style.display='none';
  document.getElementById('bookingTimeNotice').style.display='none';
  document.getElementById('saveTreatmentBookingBtn').disabled=true;
  document.getElementById('bookName').value='';
  document.getElementById('bookPhone').value='';
  document.getElementById('bookNotes').value='';
  document.getElementById('bookDuration').value='';
  document.getElementById('bookPrice').value='';document.getElementById('bookClinicDiscount').value='';document.getElementById('bookAmountPayable').value='';
}
function openBooking(date,time){
  booking={date:null,treatment:null,product:null,clinicId:null,preferredTime:time||null};
  document.getElementById('bookingModal').classList.add('show');
  document.getElementById('bookingWhen').textContent='Choose a Treatment Type to begin';
  resetTreatmentBookingSteps();
  document.getElementById('bookingProductStep').style.display='block';

  let products=(data.products||[]).filter(p=>p.active!==false&&data.treatments.some(t=>t.product===p.name));
  document.getElementById('bookingProductChoices').innerHTML=products.map(p=>`<button class='choiceBtn' onclick="chooseBookingProduct(\'${p.id}\')"><b>${escapeHtml(p.name)}</b><span class='small'>${data.treatments.filter(t=>t.product===p.name).length} treatments</span></button>`).join('');

  if(date){
    let clinic=data.clinicDays.find(c=>c.date===date);
    if(clinic){
      let p=(data.products||[]).find(x=>x.name===clinic.product);
      if(p){chooseBookingProduct(p.id);chooseBookingClinic(clinic.id);}
    }
  }
}
function closeBooking(){document.getElementById('bookingModal').classList.remove('show')}
function openBookingForClinician(renterId){
  let renter=data.renters.find(r=>r.id===renterId);if(!renter)return;
  booking={date:null,treatment:null,product:null,clinicId:null,preferredTime:null};
  document.getElementById('bookingModal').classList.add('show');
  resetTreatmentBookingSteps();
  document.getElementById('bookingProductStep').style.display='none';
  document.getElementById('bookingWhen').textContent=`Choose a Clinic Day for ${renter.name}`;

  let today=localDateKey();
  let clinics=(data.clinicDays||[]).filter(c=>c.renterId===renterId&&c.date>=today).sort((a,b)=>a.date.localeCompare(b.date));
  document.getElementById('bookingClinicStep').style.display='block';
  document.getElementById('bookingTreatmentStep').style.display='none';
  document.getElementById('bookingDetailsStep').style.display='none';
  document.getElementById('saveTreatmentBookingBtn').disabled=true;

  if(!clinics.length){
    document.getElementById('bookingClinicChoices').innerHTML='';
    let n=document.getElementById('bookingClinicNotice');n.style.display='block';n.textContent='There are no upcoming Clinic Days for this clinician.';
    return;
  }
  document.getElementById('bookingClinicNotice').style.display='none';
  document.getElementById('bookingClinicChoices').innerHTML=clinics.map(c=>{
    let full=!clinicHasAnyCapacity(c);
    let label=parseLocalDateKey(c.date).toLocaleDateString('en-GB',{weekday:'short',day:'numeric',month:'short'});
    return `<button class='choiceBtn ${full?'full':''}' ${full?'disabled':''} onclick="chooseBookingClinic('${c.id}')"><b>${label}</b><span class='small'>${escapeHtml(c.product)} · ${c.start}–${c.end}${(+c.discountPercent||0)>0?` · ${+c.discountPercent}% DISCOUNT`:''}${full?' · FULL':''}</span></button>`;
  }).join('');
}
function chooseBookingProduct(productId){
  let p=data.products.find(x=>x.id===productId);if(!p)return;
  booking.product=p.name;booking.date=null;booking.treatment=null;booking.clinicId=null;
  document.querySelectorAll('#bookingProductChoices .choiceBtn').forEach(b=>b.classList.remove('active'));
  [...document.querySelectorAll('#bookingProductChoices .choiceBtn')].find(b=>b.textContent.trim().startsWith(p.name))?.classList.add('active');

  let today=localDateKey();
  let clinics=(data.clinicDays||[]).filter(c=>c.product===p.name&&c.date>=today).sort((a,b)=>a.date.localeCompare(b.date));
  document.getElementById('bookingClinicStep').style.display='block';
  document.getElementById('bookingTreatmentStep').style.display='none';
  document.getElementById('bookingDetailsStep').style.display='none';
  document.getElementById('saveTreatmentBookingBtn').disabled=true;

  if(!clinics.length){
    document.getElementById('bookingClinicChoices').innerHTML='';
    let n=document.getElementById('bookingClinicNotice');n.style.display='block';n.textContent=`There are no upcoming ${p.name} clinic days configured.`;
    return;
  }
  document.getElementById('bookingClinicNotice').style.display='none';
  document.getElementById('bookingClinicChoices').innerHTML=clinics.map(c=>{
    let full=!clinicHasAnyCapacity(c),r=data.renters.find(x=>x.id===c.renterId);
    let label=parseLocalDateKey(c.date).toLocaleDateString('en-GB',{weekday:'short',day:'numeric',month:'short'});
    return `<button class='choiceBtn ${full?'full':''}' ${full?'disabled':''} onclick="chooseBookingClinic(\'${c.id}\')"><b>${label}</b><span class='small'>${r?.name||''} · ${c.start}–${c.end}${(+c.discountPercent||0)>0?` · ${+c.discountPercent}% DISCOUNT`:''}${full?' · FULL':''}</span></button>`;
  }).join('');
}
function chooseBookingClinic(clinicId){
  let clinic=data.clinicDays.find(x=>x.id===clinicId);if(!clinic)return;
  if(!clinicHasAnyCapacity(clinic))return;
  booking.clinicId=clinicId;booking.date=clinic.date;booking.treatment=null;booking.product=clinic.product;
  document.querySelectorAll('#bookingClinicChoices .choiceBtn').forEach(b=>b.classList.remove('active'));
  [...document.querySelectorAll('#bookingClinicChoices .choiceBtn')].filter(b=>!b.disabled).forEach(b=>{
    if(b.textContent.includes(parseLocalDateKey(clinic.date).toLocaleDateString('en-GB',{day:'numeric',month:'short'})))b.classList.add('active');
  });

  let treatments=data.treatments.filter(t=>t.product===clinic.product);
  document.getElementById('bookingTreatmentStep').style.display='block';
  document.getElementById('bookingDetailsStep').style.display='none';
  document.getElementById('saveTreatmentBookingBtn').disabled=true;
  document.getElementById('treatmentButtons').innerHTML=treatments.map(t=>{
    let available=clinicAvailableTimes(clinic,t).length>0;
    return `<button class='choiceBtn ${available?'':'full'}' ${available?'':'disabled'} onclick="chooseTreatment(\'${t.id}\')"><b>${t.name}</b><span class='small'>${t.duration} min${t.buffer?` + ${t.buffer} min buffer`:''} · £${t.price}${available?'':' · NO SLOT AVAILABLE'}</span></button>`;
  }).join('');
  let r=data.renters.find(x=>x.id===clinic.renterId);
  document.getElementById('bookingWhen').textContent=`${clinic.product} · ${formatSunbedDisplayDate(clinic.date)} · ${r?.name||''}`;
}
function chooseTreatment(id){
  let t=data.treatments.find(x=>x.id===id),clinic=data.clinicDays.find(x=>x.id===booking.clinicId);
  if(!t||!clinic)return;
  let times=clinicAvailableTimes(clinic,t);
  if(!times.length)return;
  booking.treatment=id;
  document.querySelectorAll('#treatmentButtons .choiceBtn').forEach(b=>b.classList.remove('active'));
  [...document.querySelectorAll('#treatmentButtons .choiceBtn')].filter(b=>!b.disabled).forEach(b=>{if(b.textContent.trim().startsWith(t.name))b.classList.add('active')});

  document.getElementById('bookingDetailsStep').style.display='block';
  document.getElementById('bookDuration').value=`${t.duration} minutes${t.buffer?` + ${t.buffer} min buffer`:''}`;
  let discount=Math.max(0,Math.min(100,+clinic.discountPercent||0)),
      price=+t.price||0,
      payable=price*(1-discount/100);
  document.getElementById('bookPrice').value='£'+price.toFixed(2);
  document.getElementById('bookClinicDiscount').value=discount?discount+'%':'0%';
  document.getElementById('bookAmountPayable').value='£'+payable.toFixed(2);
  let select=document.getElementById('bookTime');
  select.innerHTML=times.map(v=>`<option value='${v}'>${v}</option>`).join('');
  if(booking.preferredTime&&times.includes(booking.preferredTime))select.value=booking.preferredTime;
  document.getElementById('bookingTimeNotice').style.display='none';
  document.getElementById('saveTreatmentBookingBtn').disabled=false;
}
async function saveBooking(){
  if(!booking.product||!booking.clinicId||!booking.treatment)return alert('Please complete the booking selections.');
  let name=document.getElementById('bookName').value.trim(),phone=document.getElementById('bookPhone').value.trim(),time=document.getElementById('bookTime').value;
  if(!name)return alert('Please enter the customer name.');
  if(!phone)return alert('Please enter the customer phone number.');
  let clinic=data.clinicDays.find(x=>x.id===booking.clinicId),t=data.treatments.find(x=>x.id===booking.treatment);
  if(!clinic||!t)return alert('The selected clinic or treatment could not be found.');
  let start=minutesFromTime(time),end=start+treatmentReservedMinutes(t);
  if(!treatmentRoomIsFree(booking.date,start,end)){
    let times=clinicAvailableTimes(clinic,t);
    document.getElementById('bookTime').innerHTML=times.map(v=>`<option value='${v}'>${v}</option>`).join('');
    let n=document.getElementById('bookingTimeNotice');n.style.display='block';n.textContent='That time has just become unavailable. Please choose another available start time.';
    return;
  }
  let {error}=await sb.from('treatment_bookings').insert({
    clinic_day_id:booking.clinicId,treatment_id:booking.treatment,customer_name:name,customer_phone:phone,
    booking_date:booking.date,start_time:time,duration_minutes:+t.duration,buffer_minutes:+t.buffer||0,
    price:+t.price||0,clinic_discount_percent:+clinic.discountPercent||0,amount_payable:(+t.price||0)*(1-(+clinic.discountPercent||0)/100),
    notes:document.getElementById('bookNotes').value,status:'Booked'
  });
  if(error){let n=document.getElementById('bookingTimeNotice');n.style.display='block';n.textContent=error.message;return;}
  closeBooking();await loadLiveData();renderAll();
}
function openUniversalDatePicker(target){
  universalDatePickerTarget=target;
  let key='',subtitle='';

  if(target==='clinicCreate'){
    key=document.getElementById('clinicCreateDate').value;
    subtitle='Clinic Day';
  }else if(target==='clinicCopy'){
    key=document.getElementById('clinicCopyDate').value;
    subtitle='Copied Clinic Day';
  }else if(target==='order'){
    key=document.getElementById('orderDate').value;subtitle='Order Date';
  }else if(target==='session'){key=document.getElementById('sessionDate').value||localDateKey();subtitle='Session Date';
  }else if(target==='editSession'){key=document.getElementById('editSessionDate').value||localDateKey();subtitle='Session Date';
  }else if(target==='takings'){key=document.getElementById('dailyTakingsDate').value||localDateKey();subtitle='Takings Date';
  }else{
    return;
  }

  universalDatePickerMonth=key?parseLocalDateKey(key):new Date();
  document.getElementById('universalDatePickerSubtitle').textContent=subtitle;
  renderUniversalDatePicker();
  document.getElementById('universalDatePickerModal').classList.add('show');
}
function closeUniversalDatePicker(){
  document.getElementById('universalDatePickerModal').classList.remove('show');
}
function changeUniversalDatePickerMonth(delta){
  universalDatePickerMonth=new Date(universalDatePickerMonth.getFullYear(),universalDatePickerMonth.getMonth()+delta,1);
  renderUniversalDatePicker();
}
function selectUniversalDate(key){
  if(universalDatePickerTarget==='clinicCreate'){
    document.getElementById('clinicCreateDate').value=key;
    document.getElementById('clinicCreateDateDisplay').value=formatSunbedDisplayDate(key);
    setClinicTimeInputBounds('clinicCreateStart','clinicCreateEnd',key,'clinicCreateHoursHint',true);
  }else if(universalDatePickerTarget==='clinicCopy'){
    document.getElementById('clinicCopyDate').value=key;
    document.getElementById('clinicCopyDateDisplay').value=formatSunbedDisplayDate(key);
  }else if(universalDatePickerTarget==='order'){document.getElementById('orderDate').value=key;document.getElementById('orderDateDisplay').value=formatSunbedDisplayDate(key);
  }else if(universalDatePickerTarget==='session'){document.getElementById('sessionDate').value=key;document.getElementById('sessionDateDisplay').value=formatSunbedDisplayDate(key);
  }else if(universalDatePickerTarget==='editSession'){document.getElementById('editSessionDate').value=key;document.getElementById('editSessionDateDisplay').value=formatSunbedDisplayDate(key);
  }else if(universalDatePickerTarget==='takings'){setDailyTakingsDate(key);
  }
  closeUniversalDatePicker();
}
function renderUniversalDatePicker(){
  let grid=document.getElementById('universalDatePickerGrid'),
      y=universalDatePickerMonth.getFullYear(),
      m=universalDatePickerMonth.getMonth();

  document.getElementById('universalDatePickerMonthLabel').textContent=
    new Date(y,m,1).toLocaleDateString('en-GB',{month:'long',year:'numeric'});

  let heads=['Mo','Tu','We','Th','Fr','Sa','Su']
      .map(x=>`<div style='color:#8f98a4;font-size:11px;padding:6px 0'>${x}</div>`).join(''),
      first=new Date(y,m,1),
      offset=(first.getDay()+6)%7,
      days=new Date(y,m+1,0).getDate(),
      cells='';

  for(let i=0;i<offset;i++)cells+='<div></div>';

  let selectedKey=universalDatePickerTarget==='clinicCreate'
      ?document.getElementById('clinicCreateDate').value
      :universalDatePickerTarget==='clinicCopy'
        ?document.getElementById('clinicCopyDate').value
        :universalDatePickerTarget==='order'?document.getElementById('orderDate').value:universalDatePickerTarget==='session'?document.getElementById('sessionDate').value:document.getElementById('dailyTakingsDate').value;

  for(let d=1;d<=days;d++){
    let key=`${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`,
        selected=selectedKey===key;
    cells+=`<button type='button' onclick="selectUniversalDate('${key}')" style='padding:10px 4px;${selected?'border-color:#18d7e8;background:#12343a;color:white;':''}'>${d}</button>`;
  }

  grid.innerHTML=heads+cells;
}
function openCopyClinicDay(){
  let c=data.clinicDays.find(x=>x.id===editingClinicId);if(!c)return;
  document.getElementById('clinicEditModal').classList.remove('show');
  document.getElementById('clinicCopyDate').value='';
  document.getElementById('clinicCopyDateDisplay').value='';
  document.getElementById('clinicCopyError').style.display='none';
  let clinician=data.renters.find(r=>r.id===c.renterId);
  document.getElementById('clinicCopySubtitle').textContent=
    `Copies ${clinician?.name||'clinician'}, ${c.start}–${c.end}, discount and rental charge.`;
  document.getElementById('clinicCopyModal').classList.add('show');
}
function closeClinicCopy(){
  document.getElementById('clinicCopyModal').classList.remove('show');
  if(editingClinicId)document.getElementById('clinicEditModal').classList.add('show');
}
async function copyClinicDay(){
  let source=data.clinicDays.find(x=>x.id===editingClinicId),
      date=document.getElementById('clinicCopyDate').value,
      err=document.getElementById('clinicCopyError'),
      btn=document.getElementById('clinicCopySaveBtn');

  err.style.display='none';
  if(!source)return;
  if(currentProfile?.role==='renter'&&source.renterId!==currentProfile?.renter_id){
    err.textContent='Clinicians can only copy their own Clinic Days.';
    err.style.display='block';
    return;
  }
  let sourceRenter=data.renters.find(r=>r.id===source.renterId);
  if(!sourceRenter||(sourceRenter.productIds||[]).includes(source.productId)===false){
    err.textContent='The Treatment Type on this Clinic Day is no longer assigned to the clinician.';
    err.style.display='block';
    return;
  }
  if(!date){
    err.textContent='Please select the date for the copied Clinic Day.';
    err.style.display='block';
    return;
  }

  let copyHoursError=clinicHoursValidationMessage(date,source.start,source.end);
  if(copyHoursError){
    let h=clinicShopHoursForDate(date);
    err.textContent=`The copied clinic hours (${source.start}–${source.end}) do not fit the shop hours${h?` (${h.open}–${h.close})`:''} on ${formatSunbedDisplayDate(date)}. Create the Clinic Day manually so you can choose valid hours.`;
    err.style.display='block';
    return;
  }

  let existing=data.clinicDays.find(x=>x.date===date);
  if(existing){
    let existingClinician=data.renters.find(r=>r.id===existing.renterId);
    alert(`A Clinic Day already exists on ${formatSunbedDisplayDate(date)}${existingClinician?.name?` for ${existingClinician.name}`:''}. The copy has not been created.`);
    return;
  }

  btn.disabled=true;btn.textContent='Creating Copy...';
  try{
    let {error}=await sb.from('clinic_days').insert({
      clinic_date:date,
      renter_id:source.renterId,
      product_id:source.productId,
      start_time:source.start,
      end_time:source.end,
      provided_discount_percent:+source.discountPercent||0,
      rental_charge:+source.rentalCharge||0,
      active:true
    });
    if(error)throw error;

    document.getElementById('clinicCopyModal').classList.remove('show');
    editingClinicId=null;
    await loadLiveData();
    renderAll();
  }catch(e){
    err.textContent=e.message||'Could not copy Clinic Day.';
    err.style.display='block';
  }finally{
    btn.disabled=false;btn.textContent='Create Copy';
  }
}
function clinicianAllowedProducts(renter){
  if(!renter)return [];
  let ids=renter.productIds||[];
  return (data.products||[]).filter(p=>ids.includes(p.id)&&p.active!==false);
}
function refreshClinicCreateProductOptions(selectedProductId=null){
  let renterId=document.getElementById('clinicCreateRenter')?.value||'',
      renter=data.renters.find(r=>r.id===renterId),
      sel=document.getElementById('clinicCreateProduct'),
      saveBtn=document.getElementById('clinicCreateSaveBtn'),
      errBox=document.getElementById('clinicCreateError');
  if(!sel)return;
  let products=clinicianAllowedProducts(renter);
  sel.innerHTML=products.length?products.map(p=>`<option value='${p.id}'>${escapeHtml(p.name)}</option>`).join(''):`<option value=''>No Treatment Types assigned</option>`;
  if(selectedProductId&&products.some(p=>p.id===selectedProductId))sel.value=selectedProductId;
  if(saveBtn)saveBtn.disabled=!products.length;
  if(errBox){
    if(products.length){
      if(errBox.textContent.includes('Treatment Type'))errBox.style.display='none';
    }else if(renter){
      errBox.textContent='This clinician does not have any Treatment Types assigned. Update the Clinician user first.';
      errBox.style.display='block';
    }
  }
}
function refreshClinicEditProductOptions(selectedProductId=null){
  let renterId=document.getElementById('clinicEditRenter')?.value||'',
      renter=data.renters.find(r=>r.id===renterId),
      sel=document.getElementById('clinicEditProduct');if(!sel)return;
  let products=clinicianAllowedProducts(renter);
  sel.innerHTML=products.length?products.map(p=>`<option value='${p.id}'>${escapeHtml(p.name)}</option>`).join(''):`<option value=''>No Treatment Types assigned</option>`;
  if(selectedProductId&&products.some(p=>p.id===selectedProductId))sel.value=selectedProductId;
}
function currentClinicianRenter(){
  if(currentProfile?.role!=='renter')return null;
  return data.renters.find(r=>r.id===currentProfile?.renter_id)||null;
}
function openClinicEdit(id){
  let c=data.clinicDays.find(x=>x.id===id);if(!c)return;
  if(currentProfile?.role==='renter'&&c.renterId!==currentProfile?.renter_id)return alert('Clinicians can only edit their own Clinic Days.');
  editingClinicId=id;
  document.getElementById('clinicEditModal').classList.add('show');
  let d=parseLocalDateKey(c.date);
  document.getElementById('clinicEditSubtitle').textContent=d.toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'long',year:'numeric'});
  document.getElementById('clinicEditDate').value=d.toLocaleDateString('en-GB',{weekday:'long',day:'2-digit',month:'2-digit',year:'numeric'});
  let renterSelect=document.getElementById('clinicEditRenter'),
      allowedRenters=currentProfile?.role==='renter'?[currentClinicianRenter()].filter(Boolean):data.renters;
  renterSelect.innerHTML=allowedRenters.map(r=>`<option value='${r.id}'>${escapeHtml(r.name)} — ${escapeHtml((r.productNames||[]).join(', ')||'No Treatment Types')}</option>`).join('');
  renterSelect.disabled=currentProfile?.role==='renter';
  renterSelect.value=String(c.renterId);
  refreshClinicEditProductOptions(c.productId);
  document.getElementById('clinicEditStart').value=c.start;
  document.getElementById('clinicEditEnd').value=c.end;
  setClinicTimeInputBounds('clinicEditStart','clinicEditEnd',c.date,'clinicEditHoursHint',false);
  document.getElementById('clinicEditDiscount').value=+c.discountPercent||0;
  document.getElementById('clinicEditRentalCharge').value=(+c.rentalCharge||0).toFixed(2);
}
function closeClinicEdit(){document.getElementById('clinicEditModal').classList.remove('show');editingClinicId=null}
async function saveClinicDayEdits(){
  let c=data.clinicDays.find(x=>x.id===editingClinicId);if(!c)return;
  let renterId=document.getElementById('clinicEditRenter').value,
      productId=document.getElementById('clinicEditProduct').value,
      r=data.renters.find(x=>x.id===renterId),
      start=document.getElementById('clinicEditStart').value,
      end=document.getElementById('clinicEditEnd').value,
      discount=+document.getElementById('clinicEditDiscount').value,
      rentalCharge=+document.getElementById('clinicEditRentalCharge').value;
  if(!r)return alert('Please select a clinician.');
  if(currentProfile?.role==='renter'&&r.id!==currentProfile?.renter_id)return alert('Clinicians can only manage their own Clinic Days.');
  if(!productId||!(r.productIds||[]).includes(productId))return alert('Please select a Treatment Type assigned to this clinician.');
  let hoursError=clinicHoursValidationMessage(c.date,start,end);if(hoursError)return alert(hoursError);
  let {error}=await sb.from('clinic_days').update({renter_id:renterId,product_id:productId,start_time:start,end_time:end,provided_discount_percent:discount,rental_charge:rentalCharge}).eq('id',c.id);
  if(error)return alert(error.message);closeClinicEdit();await loadLiveData();renderAll();renderClinicDays();
}
async function deleteClinicDay(){
  if(editingClinicId==null)return;if(!confirm('Delete this clinic day?'))return;
  let {error}=await sb.from('clinic_days').delete().eq('id',editingClinicId);if(error)return alert(error.message);
  closeClinicEdit();await loadLiveData();renderAll();renderClinicDays();
}
function addClinicForDate(dateKey){
  addClinic();
  document.getElementById('clinicCreateDate').value=dateKey;
  document.getElementById('clinicCreateDateDisplay').value=formatSunbedDisplayDate(dateKey);
  setClinicTimeInputBounds('clinicCreateStart','clinicCreateEnd',dateKey,'clinicCreateHoursHint',true);
}
function openClinicDayForDate(dateKey){
  let clinic=data.clinicDays.find(x=>x.date===dateKey);
  if(clinic){openClinicEdit(clinic.id)}else{addClinicForDate(dateKey)}
}
function addClinic(){
  let renterSelect=document.getElementById('clinicCreateRenter'),
      errBox=document.getElementById('clinicCreateError'),
      saveBtn=document.getElementById('clinicCreateSaveBtn');

  document.getElementById('clinicCreateDate').value=localDateKey();
  document.getElementById('clinicCreateDateDisplay').value=formatSunbedDisplayDate(localDateKey());
  setClinicTimeInputBounds('clinicCreateStart','clinicCreateEnd',localDateKey(),'clinicCreateHoursHint',true);
  document.getElementById('clinicCreateDiscount').value='0';
  document.getElementById('clinicCreateRental').value='0.00';

  let allowedRenters=currentProfile?.role==='renter'?[currentClinicianRenter()].filter(Boolean):data.renters.filter(r=>r.active!==false);
  if(allowedRenters.length){
    renterSelect.innerHTML=allowedRenters.map(r=>`<option value='${r.id}'>${escapeHtml(r.name)} — ${escapeHtml((r.productNames||[]).join(', ')||'No Treatment Types linked')}</option>`).join('');
    renterSelect.disabled=currentProfile?.role==='renter';
    refreshClinicCreateProductOptions();
    document.getElementById('clinicCreateRenterShortcut').style.display='none';
  }else{
    renterSelect.innerHTML=`<option value=''>No clinicians configured</option>`;
    renterSelect.disabled=false;
    document.getElementById('clinicCreateProduct').innerHTML=`<option value=''>No Treatment Types available</option>`;
    saveBtn.disabled=true;
    errBox.textContent=currentProfile?.role==='renter'?'Your login is not linked to a Clinician record.':'You need to create a Clinician before you can create a Clinic Day.';
    errBox.style.display='block';
  }

  document.getElementById('clinicCreateModal').classList.add('show');
}
function closeClinicCreate(){document.getElementById('clinicCreateModal').classList.remove('show')}
async function saveNewClinicDay(){
  let renterId=document.getElementById('clinicCreateRenter').value,
      productId=document.getElementById('clinicCreateProduct').value,
      renter=data.renters.find(r=>r.id===renterId),
      date=document.getElementById('clinicCreateDate').value,
      start=document.getElementById('clinicCreateStart').value,
      end=document.getElementById('clinicCreateEnd').value,
      discount=+document.getElementById('clinicCreateDiscount').value||0,
      rental=+document.getElementById('clinicCreateRental').value||0,
      errBox=document.getElementById('clinicCreateError'),
      btn=document.getElementById('clinicCreateSaveBtn');

  errBox.style.display='none';
  if(!renter)return showClinicCreateError('Please select a clinician.');
  if(currentProfile?.role==='renter'&&renter.id!==currentProfile?.renter_id)return showClinicCreateError('Clinicians can only create Clinic Days for their own Clinician record.');
  if(!productId||!(renter.productIds||[]).includes(productId))return showClinicCreateError('Please select a Treatment Type assigned to this clinician.');
  if(!date)return showClinicCreateError('Please select a date.');
  if(data.clinicDays.some(x=>x.date===date))return showClinicCreateError(`A Clinic Day already exists on ${formatSunbedDisplayDate(date)}.`);
  let hoursError=clinicHoursValidationMessage(date,start,end);
  if(hoursError)return showClinicCreateError(hoursError);
  if(discount<0||discount>100)return showClinicCreateError('Discount must be between 0 and 100.');
  if(rental<0)return showClinicCreateError('Rental Charge cannot be negative.');

  btn.disabled=true;btn.textContent='Creating...';
  try{
    let {error}=await sb.from('clinic_days').insert({
      clinic_date:date,
      renter_id:renter.id,
      product_id:productId,
      start_time:start,
      end_time:end,
      provided_discount_percent:discount,
      rental_charge:rental,
      active:true
    });
    if(error)throw error;
    closeClinicCreate();
    await loadLiveData();
    renderAll();
    renderClinicDays();
  }catch(e){
    showClinicCreateError(e.message||'Could not create Clinic Day.');
  }finally{
    btn.disabled=false;btn.textContent='Create Clinic Day';
  }
}
function showClinicCreateError(msg){
  let el=document.getElementById('clinicCreateError');
  el.textContent=msg;el.style.display='block';
}
