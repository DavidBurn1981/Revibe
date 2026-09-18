let currentCustomer=null;
let portalData={sessions:[],purchases:[],bookings:[],tanningProducts:[],beds:[]};
let babSelectedDate=null,babSelectedTime=null,babSelectedLength=null,babSelectedBedType='Any',babSelectedSessionType=null;
let pendingCancelBookingId=null;

function showScreen(id){
  document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}
function closeModal(id){document.getElementById(id).classList.remove('show')}
function formatDate(k){
  if(!k)return '—';
  let d=new Date(k+(k.length<=10?'T00:00:00':''));
  return d.toLocaleDateString('en-GB',{weekday:'short',day:'numeric',month:'short',year:'numeric'});
}

// ---------- Boot ----------
async function boot(){
  let hash=window.location.hash;
  let isInviteOrRecovery=hash.includes('type=invite')||hash.includes('type=recovery');

  let {data:{session}}=await sb.auth.getSession();
  document.getElementById('loadingScreen').style.display='none';

  if(session&&isInviteOrRecovery){
    showScreen('setPasswordScreen');
  }else if(session){
    await loadPortalData();
  }else{
    showScreen('loginScreen');
  }
}
window.addEventListener('DOMContentLoaded',boot);

// ---------- Auth ----------
async function handleLogin(){
  let err=document.getElementById('loginError');err.style.display='none';
  let email=document.getElementById('loginEmail').value.trim();
  let password=document.getElementById('loginPassword').value;
  if(!email||!password){err.textContent='Please enter your email and password.';err.style.display='block';return}
  let btn=document.getElementById('loginBtn');btn.disabled=true;btn.textContent='Logging in...';
  try{
    let {error}=await sb.auth.signInWithPassword({email,password});
    if(error)throw error;
    await loadPortalData();
  }catch(e){
    err.textContent=e.message==='Invalid login credentials'?'Incorrect email or password.':(e.message||'Could not log in.');
    err.style.display='block';
  }finally{
    btn.disabled=false;btn.textContent='Log In';
  }
}

async function handleSetPassword(){
  let err=document.getElementById('setPasswordError');err.style.display='none';
  let pw=document.getElementById('newPassword').value;
  let confirmPw=document.getElementById('confirmPassword').value;
  if(!pw||pw.length<8){err.textContent='Password must be at least 8 characters.';err.style.display='block';return}
  if(pw!==confirmPw){err.textContent='Passwords do not match.';err.style.display='block';return}
  let btn=document.getElementById('setPasswordBtn');btn.disabled=true;btn.textContent='Saving...';
  try{
    let {error}=await sb.auth.updateUser({password:pw});
    if(error)throw error;
    history.replaceState(null,'',window.location.pathname);
    await loadPortalData();
  }catch(e){
    err.textContent=e.message||'Could not set your password.';err.style.display='block';
  }finally{
    btn.disabled=false;btn.textContent='Set Password & Continue';
  }
}

async function handleSignOut(){
  await sb.auth.signOut();
  window.location.href=window.location.pathname;
}

// ---------- Data loading ----------
async function loadPortalData(){
  let {data:{user}}=await sb.auth.getUser();
  if(!user){showScreen('loginScreen');return}

  let {data:customer,error}=await sb.from('customers').select('*').eq('auth_user_id',user.id).single();
  if(error||!customer){
    document.getElementById('loginError').textContent='Could not load your account. Please contact the studio.';
    document.getElementById('loginError').style.display='block';
    showScreen('loginScreen');
    return;
  }
  currentCustomer={
    id:customer.id,firstName:customer.first_name,lastName:customer.last_name,
    address:customer.address||'',phone:customer.phone_number||'',email:customer.email||'',
    skinType:customer.skin_type||null,minutesLeft:+customer.minutes_left||0
  };

  let [sessionsRes,purchasesRes,bookingsRes,productsRes,bedsRes]=await Promise.all([
    sb.from('bed_sessions').select('*').eq('customer_id',currentCustomer.id).order('session_date',{ascending:false}).order('session_time',{ascending:false}),
    sb.from('customer_purchases').select('*').eq('customer_id',currentCustomer.id).order('created_at',{ascending:false}),
    sb.from('sunbed_bookings').select('*').eq('customer_id',currentCustomer.id).order('booking_date',{ascending:false}),
    sb.from('tanning_rlt_products').select('*').eq('product_type','Block Minutes').eq('active',true).order('minute_amount'),
    sb.from('beds').select('*').eq('active',true)
  ]);

  let beds=(bedsRes.data||[]).map(b=>({id:b.id,name:b.name,type:b.bed_type}));
  portalData={
    sessions:(sessionsRes.data||[]).map(x=>({date:x.session_date,time:(x.session_time||'').slice(0,5),length:x.session_length_minutes,sessionType:x.session_type})),
    purchases:(purchasesRes.data||[]).map(x=>({date:x.purchase_date,total:+x.grand_total||0})),
    bookings:(bookingsRes.data||[]).map(x=>{
      let bed=beds.find(b=>b.id===x.bed_id);
      return {id:x.id,date:x.booking_date,time:(x.start_time||'').slice(0,5),length:x.session_length_minutes,
        bufferBeforeMinutes:+x.buffer_before_minutes||0,turnaroundMinutes:+x.turnaround_minutes||0,
        bedName:bed?bed.name:'—',status:x.status};
    }),
    tanningProducts:(productsRes.data||[]).map(x=>({id:x.id,title:x.title,minutes:+x.minute_amount||0,price:+x.price||0})),
    beds
  };

  renderPortal();
  showScreen('portalScreen');
}

// ---------- Rendering ----------
function renderPortal(){
  document.getElementById('heroGreeting').textContent=`Hi ${currentCustomer.firstName}`;
  document.getElementById('heroMinutes').textContent=currentCustomer.minutesLeft;
  document.getElementById('detName').textContent=`${currentCustomer.firstName} ${currentCustomer.lastName}`;
  document.getElementById('detSkinType').textContent=currentCustomer.skinType?`Type ${currentCustomer.skinType}`:'Not on file';
  document.getElementById('detAddress').textContent=currentCustomer.address||'Not on file';

  let now=Date.now();
  let withMeta=portalData.bookings.map(b=>({...b,startMs:new Date(`${b.date}T${b.time}:00`).getTime()}));
  let future=withMeta.filter(b=>b.startMs>=now).sort((a,b)=>a.startMs-b.startMs);
  let past=withMeta.filter(b=>b.startMs<now).sort((a,b)=>b.startMs-a.startMs);
  let orderedBookings=[...future,...past];

  let bookingsEl=document.getElementById('bookingsList');
  bookingsEl.innerHTML=orderedBookings.length?orderedBookings.map(b=>{
    let pillClass='booked',pillText=b.status;
    if(b.status==='Cancelled'){pillClass='cancelled';pillText='Cancelled'}
    else if(b.startMs<now){pillClass='previous';pillText='Previous Booking'}
    return `
    <div class="listRow clickable" onclick="openBookingDetail('${b.id}')"><div>
      <div class="main">${formatDate(b.date)} at ${b.time}</div>
      <div class="sub">${b.bedName} · ${b.length} min</div>
    </div><div class="right">
      <span class="statusPill ${pillClass}">${pillText}</span>
    </div></div>`;
  }).join(''):'<div class="emptyState">No bed bookings yet. Tap "Book a Bed" above to get started.</div>';
}

// ---------- History (sessions / purchases) ----------
function openHistoryModal(type){
  document.getElementById('historyModalTitle').textContent=type==='sessions'?'Session History':'Purchase History';
  let listEl=document.getElementById('historyModalList');
  if(type==='sessions'){
    listEl.innerHTML=portalData.sessions.length?portalData.sessions.map(s=>`
      <div class="listRow"><div>
        <div class="main">${s.sessionType||'Session'}</div>
        <div class="sub">${formatDate(s.date)}</div>
      </div><div class="right">${s.length} min</div></div>
    `).join(''):'<div class="emptyState">No sessions yet.</div>';
  }else{
    listEl.innerHTML=portalData.purchases.length?portalData.purchases.map(p=>`
      <div class="listRow"><div class="main">${formatDate(p.date)}</div><div class="right">£${p.total.toFixed(2)}</div></div>
    `).join(''):'<div class="emptyState">No purchases yet.</div>';
  }
  document.getElementById('historyModal').classList.add('show');
}

// ---------- Booking detail ----------
let pendingDetailBookingId=null;
function openBookingDetail(bookingId){
  let b=portalData.bookings.find(x=>x.id===bookingId);if(!b)return;
  pendingDetailBookingId=bookingId;
  let startMs=new Date(`${b.date}T${b.time}:00`).getTime();
  let isPast=startMs<Date.now();
  let statusText=b.status==='Cancelled'?'Cancelled':isPast?'Previous Booking':'Booked';
  document.getElementById('bdDate').textContent=formatDate(b.date);
  document.getElementById('bdTime').textContent=b.time;
  document.getElementById('bdBed').textContent=b.bedName;
  document.getElementById('bdLength').textContent=`${b.length} min`;
  document.getElementById('bdStatus').textContent=statusText;
  document.getElementById('bdCancelWrap').style.display=(b.status==='Booked'&&!isPast)?'block':'none';
  document.getElementById('bookingDetailModal').classList.add('show');
}

// ---------- Date picker ----------
function openDatePicker(inputId){
  let input=document.getElementById(inputId);
  try{
    if(input.showPicker){input.showPicker();return}
  }catch(e){}
  input.focus();
  input.click();
}

// ---------- Edit details ----------
function openEditDetails(){
  document.getElementById('editAddress').value=currentCustomer.address||'';
  document.getElementById('editPhone').value=currentCustomer.phone||'';
  document.getElementById('editEmail').value=currentCustomer.email||'';
  document.getElementById('editDetailsError').style.display='none';
  document.getElementById('editDetailsModal').classList.add('show');
}
async function saveEditDetails(){
  let err=document.getElementById('editDetailsError');err.style.display='none';
  let address=document.getElementById('editAddress').value.trim();
  let phone=document.getElementById('editPhone').value.trim();
  let email=document.getElementById('editEmail').value.trim();
  try{
    let {error}=await sb.from('customers').update({address:address||null,phone_number:phone||null,email:email||null,updated_at:new Date().toISOString()}).eq('id',currentCustomer.id);
    if(error)throw error;
    currentCustomer.address=address;currentCustomer.phone=phone;currentCustomer.email=email;
    closeModal('editDetailsModal');
    renderPortal();
  }catch(e){err.textContent=e.message||'Could not save your details.';err.style.display='block'}
}

// ---------- Purchase Minutes ----------
function openPurchaseMinutesModal(){
  closeModal('bookABedModal');
  let err=document.getElementById('purchaseMinutesError');err.style.display='none';
  document.getElementById('purchaseMinutesLoading').style.display='none';
  document.getElementById('purchaseMinutesList').style.display='block';
  document.getElementById('purchaseMinutesList').innerHTML=portalData.tanningProducts.length
    ? portalData.tanningProducts.map(p=>`<div class="pkgRow" onclick="startMinutesCheckout('${p.id}')"><div><div class="pkgTitle">${p.title}</div><div class="sub" style="color:var(--muted);font-size:12.5px">${p.minutes} minutes</div></div><div class="pkgPrice">£${p.price.toFixed(2)}</div></div>`).join('')
    : '<div class="emptyState">No minutes packages are available right now.</div>';
  document.getElementById('purchaseMinutesModal').classList.add('show');
}
async function startMinutesCheckout(tanningProductId){
  let err=document.getElementById('purchaseMinutesError');err.style.display='none';
  document.getElementById('purchaseMinutesList').style.display='none';
  document.getElementById('purchaseMinutesLoading').style.display='block';
  try{
    let {data:result,error}=await sb.functions.invoke('create-minutes-checkout',{
      body:{customer_id:currentCustomer.id,tanning_product_id:tanningProductId}
    });
    if(error)throw error;
    if(!result?.url)throw new Error('No checkout URL was returned.');
    window.location.href=result.url;
  }catch(e){
    document.getElementById('purchaseMinutesLoading').style.display='none';
    document.getElementById('purchaseMinutesList').style.display='block';
    err.textContent=e.message||'Could not start checkout. Please try again.';
    err.style.display='block';
  }
}

// ---------- Book a Bed ----------
function babExclusiveSessionType(which){
  if(which==='rlt'){document.getElementById('babRlt').checked=true;document.getElementById('babHybrid').checked=false}
  else{document.getElementById('babHybrid').checked=true;document.getElementById('babRlt').checked=false}
}
function openBookABedFlow(){
  babSelectedDate=null;babSelectedTime=null;babSelectedLength=null;babSelectedSessionType=null;
  document.getElementById('babDate').value=new Date().toISOString().slice(0,10);
  document.getElementById('babLength').value='';
  document.getElementById('babBedType').value='Any';
  document.getElementById('babRlt').checked=false;
  document.getElementById('babHybrid').checked=false;
  document.getElementById('babError').style.display='none';
  document.getElementById('babPurchaseMinutesBtn').style.display='none';
  document.getElementById('bookABedStep1').style.display='block';
  document.getElementById('bookABedStep2').style.display='none';
  document.getElementById('bookABedStep3').style.display='none';
  document.getElementById('bookABedStep4').style.display='none';
  document.getElementById('bookABedModal').classList.add('show');
}
function minutesFromTime(t){let [h,m]=t.split(':').map(Number);return h*60+m}
function searchBedSlots(){
  let err=document.getElementById('babError');err.style.display='none';
  document.getElementById('babPurchaseMinutesBtn').style.display='none';
  let date=document.getElementById('babDate').value;
  let length=+document.getElementById('babLength').value;
  let bedType=document.getElementById('babBedType').value;
  let sessionType=document.getElementById('babRlt').checked?'Red Light Therapy':document.getElementById('babHybrid').checked?'Hybrid':null;
  if(!date){err.textContent='Please choose a date.';err.style.display='block';return}
  if(!sessionType){err.textContent='Please choose whether this is Red Light Therapy or Hybrid Tanning.';err.style.display='block';return}
  if(!length||length<1){err.textContent='Please enter the session length.';err.style.display='block';return}
  if(length>currentCustomer.minutesLeft){
    err.textContent=`You need ${length} minutes for this session but only have ${currentCustomer.minutesLeft} on your account.`;
    err.style.display='block';
    document.getElementById('babPurchaseMinutesBtn').style.display='block';
    return;
  }

  let bufferBefore=3,turnaround=2,totalWindow=bufferBefore+length+turnaround;
  document.getElementById('babTotalLine').textContent=`Your full booking window (including 3 minutes before and 2 minutes after) will be ${totalWindow} minutes.`;

  sb.rpc('get_opening_hours_for_date',{p_date:date}).then(({data:hoursRows,error:hoursError})=>{
    if(hoursError)throw hoursError;
    let hours=Array.isArray(hoursRows)?hoursRows[0]:hoursRows;
    if(!hours||!hours.opening_time||!hours.closing_time){
      document.getElementById('babSlotGrid').innerHTML='<div class="emptyState" style="grid-column:1/-1">The studio is closed on this date. Please try another day.</div>';
      document.getElementById('babChosenDateLabel').textContent=formatDate(date);
      document.getElementById('babChosenLengthLabel').textContent=length;
      babSelectedDate=null;
      document.getElementById('bookABedStep1').style.display='none';
      document.getElementById('bookABedStep2').style.display='block';
      return;
    }
    let openMin=minutesFromTime(hours.opening_time.slice(0,5)),closeMin=minutesFromTime(hours.closing_time.slice(0,5));
    let bedsOfType=portalData.beds.filter(b=>bedType==='Any'||b.type===bedType);

    let isToday=date===new Date().toISOString().slice(0,10);
    let now=new Date(),nowMin=now.getHours()*60+now.getMinutes();
    let earliestStart=isToday?Math.max(openMin,nowMin+1):openMin;

    return fetchAvailability(date,bedsOfType,earliestStart,closeMin,length,bufferBefore,turnaround).then(slots=>{
      babSelectedDate=date;babSelectedLength=length;babSelectedBedType=bedType;babSelectedSessionType=sessionType;
      document.getElementById('babChosenDateLabel').textContent=formatDate(date);
      document.getElementById('babChosenLengthLabel').textContent=length;
      document.getElementById('babSlotGrid').innerHTML=slots.length
        ? slots.map(t=>`<button type="button" onclick="pickBedSlot('${t}')">${t}</button>`).join('')
        : '<div class="emptyState" style="grid-column:1/-1">No slots are available for this length on this date. Try a different date.</div>';
      document.getElementById('bookABedStep1').style.display='none';
      document.getElementById('bookABedStep2').style.display='block';
    });
  }).catch(e=>{
    err.textContent=e.message||'Could not check availability. Please try again.';
    err.style.display='block';
  });
}
async function fetchAvailability(date,bedsOfType,openMin,closeMin,length,bufferBefore,turnaround){
  // Availability needs to see every bed's bookings for the day, not just this customer's
  // own - that read is handled by a dedicated RPC (security definer) rather than a
  // direct table query, since RLS deliberately only exposes a customer's own bookings.
  let {data,error}=await sb.rpc('get_bed_availability_for_date',{p_date:date});
  if(error)throw error;
  let dayBookings=data||[];
  let slots=[];
  for(let startMin=openMin;startMin+length+turnaround<=closeMin;startMin+=5){
    let windowStart=startMin-bufferBefore,windowEnd=startMin+length+turnaround;
    let anyBedFree=bedsOfType.some(bed=>{
      return !dayBookings.some(b=>{
        if(b.bed_id!==bed.id)return false;
        let bStart=minutesFromTime(b.start_time.slice(0,5))-(b.buffer_before_minutes||0);
        let bEnd=minutesFromTime(b.start_time.slice(0,5))+b.session_length_minutes+(b.turnaround_minutes||0);
        return windowStart<bEnd&&windowEnd>bStart;
      });
    });
    if(anyBedFree){
      let hh=String(Math.floor(startMin/60)).padStart(2,'0'),mm=String(startMin%60).padStart(2,'0');
      slots.push(`${hh}:${mm}`);
    }
  }
  return slots;
}
function pickBedSlot(time){
  babSelectedTime=time;
  document.getElementById('babConfirmMinutes').textContent=babSelectedLength;
  document.getElementById('babConfirmTime').textContent=time;
  document.getElementById('babConfirmDate').textContent=formatDate(babSelectedDate);
  document.getElementById('bookABedStep2').style.display='none';
  document.getElementById('bookABedStep3').style.display='block';
}
async function confirmBedBooking(){
  try{
    let {data:result,error}=await sb.rpc('create_bed_booking',{
      p_customer:currentCustomer.id,p_booking_date:babSelectedDate,p_start_time:babSelectedTime,
      p_session_length_minutes:babSelectedLength,p_session_type:babSelectedSessionType,p_preferred_bed_type:babSelectedBedType
    });
    if(error)throw error;
    let row=Array.isArray(result)?result[0]:result;
    currentCustomer.minutesLeft=row.minutes_left;
    document.getElementById('babConfirmationText').innerHTML=`Your ${babSelectedLength}-minute session is booked for ${formatDate(babSelectedDate)} at ${babSelectedTime}.<br>You now have ${row.minutes_left} minutes left.`;
    document.getElementById('bookABedStep3').style.display='none';
    document.getElementById('bookABedStep4').style.display='block';
    await loadPortalData();
  }catch(e){
    let err=document.getElementById('babError');
    if(e.message&&e.message.includes('INSUFFICIENT_MINUTES')){
      err.textContent='You do not have enough minutes for this session.';
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

// ---------- Cancel booking ----------
function cancelPortalBedBooking(bookingId){
  let booking=portalData.bookings.find(b=>b.id===bookingId);if(!booking)return;
  closeModal('bookingDetailModal');
  pendingCancelBookingId=bookingId;
  let startsAt=new Date(`${booking.date}T${booking.time}:00`);
  let withinOneHour=(startsAt.getTime()-Date.now())<60*60*1000;
  document.getElementById('cancelBookingConfirmText').textContent=withinOneHour
    ? 'As you are within 1 hour of your booking, minutes will not be returned to your account. Proceed?'
    : 'Cancelling this booking will refund your minutes to your account. Proceed?';
  document.getElementById('cancelBookingConfirmModal').classList.add('show');
}
async function proceedWithCancelBooking(){
  let bookingId=pendingCancelBookingId;
  closeModal('cancelBookingConfirmModal');
  if(!bookingId)return;
  try{
    let {data:result,error}=await sb.rpc('cancel_bed_booking',{p_booking_id:bookingId});
    if(error)throw error;
    let row=Array.isArray(result)?result[0]:result;
    currentCustomer.minutesLeft=row.minutes_left;
    alert(row.refunded?`Booking cancelled. ${row.minutes_left} minutes refunded to your account.`:'Booking cancelled. Minutes were not refunded.');
    await loadPortalData();
  }catch(e){alert(e.message||'Could not cancel this booking.')}
}

// ---------- Book a Treatment ----------
function openCustomerBookingPage(){
  window.open('book.html','_blank','noopener');
}
