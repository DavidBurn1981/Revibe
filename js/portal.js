let currentCustomer=null;
let portalData={sessions:[],purchases:[],bookings:[],tanningProducts:[],beds:[]};
let babSelectedDate=null,babSelectedTime=null,babSelectedLength=null,babSelectedBedType='Any',babSelectedSessionType=null;
let pendingCancelBookingId=null;

function openCreatePortalAccountScreen(){
  document.getElementById('createPortalAccountScreenEmail').value='';
  document.getElementById('createPortalAccountScreenError').style.display='none';
  document.getElementById('createPortalAccountScreenResult').style.display='none';
  document.getElementById('createPortalAccountScreenForm').style.display='block';
  showScreen('createPortalAccountScreen');
}
function backToLoginFromCreateAccount(){
  showScreen('loginScreen');
}
async function submitCreatePortalAccountRequest(){
  let email=document.getElementById('createPortalAccountScreenEmail').value.trim(),
      err=document.getElementById('createPortalAccountScreenError'),
      resultBox=document.getElementById('createPortalAccountScreenResult'),
      btn=document.getElementById('createPortalAccountScreenBtn');
  err.style.display='none';
  if(!email||!email.includes('@')){err.textContent='Please enter a valid email address.';err.style.display='block';return}
  btn.disabled=true;btn.textContent='Sending...';
  try{
    let {data:result,error}=await sb.functions.invoke('request-portal-account',{body:{email}});
    if(error)throw error;
    if(result?.success===false&&result?.message){
      err.textContent=result.message;err.style.display='block';
      btn.disabled=false;btn.textContent='Send Me Access';
      return;
    }
    resultBox.textContent=result.message||"If this email matches an account in our system, we'll have sent next steps to it.";
    resultBox.style.display='block';
    document.getElementById('createPortalAccountScreenForm').style.display='none';
  }catch(e){
    err.textContent='Something went wrong. Please try again, or call the shop for help.';err.style.display='block';
  }finally{
    btn.disabled=false;btn.textContent='Send Me Access';
  }
}
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
    checkForStripeReturn();
  }else{
    showScreen('loginScreen');
  }
}
window.addEventListener('DOMContentLoaded',boot);

// If this page is being shown from the browser's back/forward cache (e.g. someone
// pressing back from Stripe's checkout instead of completing the redirect), none of
// its JS re-runs - meaning a spinner or other in-progress state from before they left
// is still frozen on screen, and the customer's minutes/booking data could be stale.
// Forcing a fresh reload is the simplest reliable fix for both at once.
window.addEventListener('pageshow',(event)=>{
  if(event.persisted)location.reload();
});

// Detects returning from a successful (or cancelled) Stripe checkout via the
// success_url/cancel_url query params, shows a clear confirmation, and cleans the
// URL up afterwards so refreshing the page doesn't show the message again.
function checkForStripeReturn(){
  let params=new URLSearchParams(window.location.search);
  if(params.get('minutes_purchase')==='success'){
    alert(`Payment successful! You now have ${currentCustomer.minutesLeft} minutes on your account.`);
  }else if(params.get('subscription')==='success'){
    alert('Your Unlimited Membership is now active!');
  }else if(params.get('weekly_pass')==='success'){
    let expiryLabel=currentCustomer.subscriptionExpiresAt
      ?new Date(currentCustomer.subscriptionExpiresAt).toLocaleString('en-GB',{weekday:'long',day:'numeric',month:'long',hour:'2-digit',minute:'2-digit'})
      :null;
    alert(expiryLabel?`Your 1 Week Pass is now active! It expires on ${expiryLabel}.`:'Your 1 Week Pass is now active!');
  }
  if(params.has('minutes_purchase')||params.has('subscription')||params.has('weekly_pass')||params.has('session_id')){
    history.replaceState(null,'',window.location.pathname);
  }
}

// ---------- Auth ----------
function toggleLoginPasswordVisibility(){
  let input=document.getElementById('loginPassword'),btn=document.getElementById('loginPwToggleBtn');
  let showing=input.type==='text';
  input.type=showing?'password':'text';btn.textContent=showing?'Show':'Hide';
}
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
    skinType:customer.skin_type||null,minutesLeft:+customer.minutes_left||0,
    subscriptionStatus:customer.subscription_status||'No',subscriptionType:customer.subscription_type||null,subscriptionExpiresAt:customer.subscription_expires_at||null
  };

  let [sessionsRes,purchasesRes,bookingsRes,productsRes,bedsRes,subConfigRes]=await Promise.all([
    sb.from('bed_sessions').select('*').eq('customer_id',currentCustomer.id).order('session_date',{ascending:false}).order('session_time',{ascending:false}),
    sb.from('customer_purchases').select('*').eq('customer_id',currentCustomer.id).order('created_at',{ascending:false}),
    sb.from('sunbed_bookings').select('*').eq('customer_id',currentCustomer.id).order('booking_date',{ascending:false}),
    sb.from('tanning_rlt_products').select('*').eq('product_type','Block Minutes').eq('active',true).order('minute_amount'),
    sb.from('beds').select('*').eq('active',true),
    sb.from('subscription_product_config').select('*').eq('active',true).single()
  ]);

  let beds=(bedsRes.data||[]).map(b=>({id:b.id,name:b.name,type:b.bed_type}));
  portalData={
    sessions:(sessionsRes.data||[]).map(x=>({date:x.session_date,time:(x.session_time||'').slice(0,5),length:x.session_length_minutes,sessionType:x.session_type})),
    purchases:(purchasesRes.data||[]).map(x=>({date:x.purchase_date,total:+x.grand_total||0})),
    bookings:(bookingsRes.data||[]).map(x=>{
      let bed=beds.find(b=>b.id===x.bed_id);
      return {id:x.id,date:x.booking_date,time:(x.start_time||'').slice(0,5),length:x.session_length_minutes,
        bufferBeforeMinutes:+x.buffer_before_minutes||0,turnaroundMinutes:+x.turnaround_minutes||0,
        bedName:bed?bed.name:'—',status:x.status,minutesRefunded:!!x.minutes_refunded};
    }),
    tanningProducts:(productsRes.data||[]).map(x=>({id:x.id,title:x.title,minutes:+x.minute_amount||0,price:+x.price||0})),
    beds,
    subscriptionConfig:subConfigRes.data?{title:subConfigRes.data.title,pricePence:+subConfigRes.data.price_pence||0}:null
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
  document.getElementById('detPhone').textContent=currentCustomer.phone||'Not on file';
  document.getElementById('detEmail').textContent=currentCustomer.email||'Not on file';
  document.getElementById('detAddress').textContent=currentCustomer.address||'Not on file';

  renderMembershipSection();

  let now=Date.now();
  let withMeta=portalData.bookings.map(b=>({...b,startMs:new Date(`${b.date}T${b.time}:00`).getTime()}));
  let future=withMeta.filter(b=>b.startMs>=now).sort((a,b)=>a.startMs-b.startMs);
  let past=withMeta.filter(b=>b.startMs<now).sort((a,b)=>b.startMs-a.startMs);
  let orderedBookings=[...future,...past];

  let bookingsEl=document.getElementById('bookingsList');
  bookingsEl.innerHTML=orderedBookings.length?orderedBookings.map(b=>{
    let pillClass='booked',pillText=b.status;
    if(b.status==='Cancelled'||b.status==='Cancelled Good'||b.status==='Cancelled Within Hour'){pillClass='cancelled';pillText='Cancelled'}
    else if(b.status==='No Show'){pillClass='cancelled';pillText='No Show'}
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
  let cancelledVariant=b.status==='Cancelled'||b.status==='Cancelled Good'||b.status==='Cancelled Within Hour';
  let statusText=cancelledVariant?'Cancelled':b.status==='No Show'?'No Show':isPast?'Previous Booking':'Booked';
  document.getElementById('bdDate').textContent=formatDate(b.date);
  document.getElementById('bdTime').textContent=b.time;
  document.getElementById('bdBed').textContent=b.bedName;
  document.getElementById('bdLength').textContent=`${b.length} min`;
  document.getElementById('bdStatus').textContent=statusText;
  document.getElementById('bdCancelWrap').style.display=(b.status==='Booked'&&!isPast)?'block':'none';
  document.getElementById('bdEditTimeWrap').style.display=(b.status==='Booked'&&!isPast)?'block':'none';
  document.getElementById('bookingDetailModal').classList.add('show');
}

// ---------- Change Time (reschedule an existing "Booked" booking) ----------
// No 1-hour cut-off applies here (unlike cancelling) - customers can move their
// own booking to any other available slot right up to the start time.
let editTimeBookingId=null,editTimeSelectedDate=null,editTimeSelectedTime=null,editTimeLength=null,editTimeBedType='Any';
function openEditPortalBookingTime(){
  let b=portalData.bookings.find(x=>x.id===pendingDetailBookingId);if(!b)return;
  editTimeBookingId=b.id;
  editTimeLength=b.length;
  let bed=portalData.beds.find(x=>x.name===b.bedName);
  editTimeBedType=bed?bed.type:'Any';
  editTimeSelectedDate=null;editTimeSelectedTime=null;
  closeModal('bookingDetailModal');
  document.getElementById('editTimeError').style.display='none';
  document.getElementById('editTimeSummaryLine').textContent=`Currently ${formatDate(b.date)} at ${b.time} · ${b.length} min · ${b.bedName}`;
  let dateInput=document.getElementById('editTimeDate');
  dateInput.value=b.date;
  dateInput.min=new Date().toISOString().slice(0,10);
  document.getElementById('editTimeStep1').style.display='block';
  document.getElementById('editTimeStep2').style.display='none';
  document.getElementById('editTimeStep3').style.display='none';
  document.getElementById('editTimeModal').classList.add('show');
}
async function searchEditTimeSlots(){
  let err=document.getElementById('editTimeError');err.style.display='none';
  let date=document.getElementById('editTimeDate').value;
  if(!date){err.textContent='Please choose a date.';err.style.display='block';return}
  let bufferBefore=3,turnaround=2;
  try{
    let {data:hoursRows,error:hoursError}=await sb.rpc('get_opening_hours_for_date',{p_date:date});
    if(hoursError)throw hoursError;
    let hours=Array.isArray(hoursRows)?hoursRows[0]:hoursRows;
    if(!hours||!hours.opening_time||!hours.closing_time){
      editTimeSelectedDate=null;
      document.getElementById('editTimeChosenDateLabel').textContent=formatDate(date);
      document.getElementById('editTimeSlotGrid').innerHTML='<div class="emptyState" style="grid-column:1/-1">The studio is closed on this date. Please try another day.</div>';
      document.getElementById('editTimeStep1').style.display='none';
      document.getElementById('editTimeStep2').style.display='block';
      return;
    }
    let openMin=minutesFromTime(hours.opening_time.slice(0,5)),closeMin=minutesFromTime(hours.closing_time.slice(0,5));
    let bedsOfType=portalData.beds.filter(b=>editTimeBedType==='Any'||b.type===editTimeBedType);
    let isToday=date===new Date().toISOString().slice(0,10);
    let now=new Date(),nowMin=now.getHours()*60+now.getMinutes();
    let earliestStart=isToday?Math.max(openMin,nowMin+1):openMin;
    let slots=await fetchEditTimeAvailability(date,bedsOfType,earliestStart,closeMin,editTimeLength,bufferBefore,turnaround);
    editTimeSelectedDate=date;
    document.getElementById('editTimeChosenDateLabel').textContent=formatDate(date);
    document.getElementById('editTimeSlotGrid').innerHTML=slots.length
      ? slots.map(t=>`<button type="button" onclick="pickEditTimeSlot('${t}')">${t}</button>`).join('')
      : '<div class="emptyState" style="grid-column:1/-1">No available times of the same bed type on this date. Try a different date.</div>';
    document.getElementById('editTimeStep1').style.display='none';
    document.getElementById('editTimeStep2').style.display='block';
  }catch(e){
    err.textContent=e.message||'Could not check availability. Please try again.';
    err.style.display='block';
  }
}
async function fetchEditTimeAvailability(date,bedsOfType,openMin,closeMin,length,bufferBefore,turnaround){
  // Same shape as fetchAvailability() used for new bookings, but excludes this
  // booking's own row from the conflict check via a dedicated RPC, so its own
  // current slot doesn't show as unavailable to itself.
  let {data,error}=await sb.rpc('get_bed_availability_for_date_excluding_booking',{p_date:date,p_exclude_booking_id:editTimeBookingId});
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
function pickEditTimeSlot(time){
  editTimeSelectedTime=time;
  document.getElementById('editTimeConfirmBox').innerHTML=`Change this booking to <b>${formatDate(editTimeSelectedDate)} at ${time}</b>?<br><br>Your session length (${editTimeLength} minutes) and bed type stay the same - no minutes will be added or deducted.`;
  document.getElementById('editTimeStep2').style.display='none';
  document.getElementById('editTimeStep3').style.display='block';
}
async function confirmEditBookingTime(){
  let err=document.getElementById('editTimeError');err.style.display='none';
  try{
    let {error}=await sb.rpc('reschedule_bed_booking',{
      p_booking_id:editTimeBookingId,p_new_date:editTimeSelectedDate,p_new_start_time:editTimeSelectedTime
    });
    if(error)throw error;
    closeModal('editTimeModal');
    alert('Your booking time has been updated.');
    await loadPortalData();
  }catch(e){
    let msg=e.message||"Could not change this booking's time.";
    if(msg.includes('UNLIMITED_DAILY_LIMIT'))msg='As an Unlimited Member, you can only have one session per day - you already have another session on that day. Please choose a different day.';
    else if(msg.includes('NO_BED_AVAILABLE'))msg='Sorry, that time just became unavailable. Please choose another slot.';
    err.textContent=msg;err.style.display='block';
    document.getElementById('editTimeStep3').style.display='none';
    document.getElementById('editTimeStep2').style.display='block';
  }
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

// ---------- Membership ----------
async function openBillingPortal(){
  try{
    let {data:result,error}=await sb.functions.invoke('create-billing-portal-session',{body:{customer_id:currentCustomer.id}});
    if(error)throw error;
    if(!result?.url)throw new Error(result?.error||'Could not open the membership management page.');
    window.location.href=result.url;
  }catch(e){
    alert(e.message||'Could not open the membership management page. Please try again or call the shop for help.');
  }
}
function renderMembershipSection(){
  let el=document.getElementById('membershipSection');
  let status=currentCustomer.subscriptionStatus;
  let priceLabel=portalData.subscriptionConfig?`£${(portalData.subscriptionConfig.pricePence/100).toFixed(2)}`:'£99.99';

  if(status==='Subscriber'){
    let isPass=currentCustomer.subscriptionType==='7_Day_Pass';
    let passExpiryLine=isPass&&currentCustomer.subscriptionExpiresAt
      ?`<div class="mDesc">Your 1 Week Pass expires on ${new Date(currentCustomer.subscriptionExpiresAt).toLocaleString('en-GB',{weekday:'long',day:'numeric',month:'long',hour:'2-digit',minute:'2-digit'})}.</div>`
      :`<div class="mDesc">Your membership is active and renews automatically.</div>`;
    el.innerHTML=`<div class="membershipCard active"><div class="mTitle">${isPass?"You're on a 1 Week Pass":"You're a Member"}</div><div class="mPrice">Unlimited sessions${isPass?'':`, ${priceLabel}/month`}</div>${passExpiryLine}${isPass?'':'<button onclick="openBillingPortal()">Manage Membership</button>'}</div>`;
  }else if(status==='Subscriber - Failed Payment'){
    el.innerHTML=`<div class="membershipCard failedPayment"><div class="mTitle">Payment Issue</div><div class="mDesc">Your last membership payment didn't go through. Please update your payment details below to avoid losing access.</div><button onclick="openBillingPortal()">Update Payment Details</button></div>`;
  }else{
    el.innerHTML=`<div class="membershipCard">
      <div class="mTitle">1 Week Pass</div>
      <div class="mPrice">£34.99 / one-off</div>
      <div class="mIntro">Unlimited-style sunbed access for 7 days from the moment you buy it - no ongoing commitment.</div>
      <ul class="mFeatureList">
        <li>One single payment, no recurring charges</li>
        <li>Unlimited access for 7 days from purchase</li>
        <li>Only one session per day</li>
        <li>Maximum 15 minutes per session</li>
        <li>Not transferable and to be used by yourself only</li>
        <li>All usual legal safe use limitations are still applicable</li>
      </ul>
      <button onclick="purchaseWeeklyPass()">Purchase 1 Week Pass</button>
    </div>
    <div class="membershipCard" style="margin-top:14px">
      <div class="mTitle">The Unlimited Membership</div>
      <div class="mPrice">${priceLabel} / month</div>
      <div class="mIntro">Become an unlimited member at Revibe to enjoy all of the following benefits....</div>
      <ul class="mFeatureList">
        <li>One monthly payment on 1st of every month</li>
        <li>Cancel anytime, as long as its at least 5 days before the next payment</li>
        <li>Maximum 15 minutes and 1 session per day</li>
        <li>Memberships are not transferable and are to be used by yourself only</li>
        <li>All usual legal safe use limitations are still applicable</li>
        <li>Sessions to be booked via our super simple new customer portal process</li>
        <li>If you join partway through the month, you'll be charged for the remaining days only, then £99.99 on the 1st of every month after that</li>
      </ul>
      <button onclick="openSubscriptionModal()">Purchase Subscription Membership</button>
      <button class="tcLink" onclick="openMembershipTerms()">Terms &amp; Conditions</button>
    </div>`;
  }
}
async function purchaseWeeklyPass(){
  try{
    let {data:result,error}=await sb.functions.invoke('create-weekly-pass-checkout',{body:{customer_id:currentCustomer.id}});
    if(error)throw error;
    if(!result?.url)throw new Error(result?.error||'Could not start checkout.');
    window.location.href=result.url;
  }catch(e){
    alert(e.message||'Could not start checkout. Please try again or call the shop for help.');
  }
}
function openSubscriptionModal(){
  document.getElementById('subscriptionError').style.display='none';
  document.getElementById('subscriptionLoading').style.display='none';
  document.getElementById('subscriptionModalContent').style.display='block';
  let priceLabel=portalData.subscriptionConfig?`£${(portalData.subscriptionConfig.pricePence/100).toFixed(2)} / month`:'£99.99 / month';
  document.getElementById('subModalPrice').textContent=priceLabel;
  document.getElementById('subscriptionModal').classList.add('show');
}
async function startSubscriptionCheckout(){
  let err=document.getElementById('subscriptionError');err.style.display='none';
  document.getElementById('subscriptionModalContent').querySelector('.modalTop').style.display='none';
  document.getElementById('subModalPrice').style.display='none';
  document.querySelectorAll('#subscriptionModalContent .detailCard, #subscriptionModalContent .confirmBox').forEach(e=>e.style.display='none');
  document.getElementById('subscribeBtn').style.display='none';
  document.getElementById('subscriptionLoading').style.display='block';
  try{
    let {data:result,error}=await sb.functions.invoke('create-subscription-checkout',{body:{customer_id:currentCustomer.id}});
    if(error)throw error;
    if(!result?.url)throw new Error('No checkout URL was returned.');
    window.location.href=result.url;
  }catch(e){
    document.getElementById('subscriptionLoading').style.display='none';
    document.getElementById('subscriptionModalContent').querySelector('.modalTop').style.display='flex';
    document.getElementById('subModalPrice').style.display='block';
    document.querySelectorAll('#subscriptionModalContent .detailCard, #subscriptionModalContent .confirmBox').forEach(e=>e.style.display='block');
    document.getElementById('subscribeBtn').style.display='block';
    err.textContent=e.message||'Could not start checkout. Please try again.';
    err.style.display='block';
  }
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
  // Email is intentionally left out here - it's your login email, so it can
  // only be changed via "Change Email" below (openChangeEmail/saveChangeEmail),
  // which goes through Supabase's own confirmation flow rather than just
  // overwriting the contact record. That keeps this field and your actual
  // login always the same thing, instead of two things that can drift apart.
  try{
    let {error}=await sb.rpc('update_my_customer_details',{p_address:address||null,p_phone:phone||null,p_email:currentCustomer.email||null});
    if(error)throw error;
    currentCustomer.address=address;currentCustomer.phone=phone;
    closeModal('editDetailsModal');
    renderPortal();
  }catch(e){err.textContent=e.message||'Could not save your details.';err.style.display='block'}
}

// ---------- Change login email ----------
// Uses Supabase's own secure email-change flow: this does NOT change anything
// immediately. It sends a confirmation link to the NEW address, and the login
// email (and, via a database trigger, the contact record) only updates once
// that link is clicked - so a typo here can't lock anyone out, and the two
// copies of "email" can never end up disagreeing the way they did before.
function openChangeEmail(){
  document.getElementById('changeEmailNew').value='';
  document.getElementById('changeEmailError').style.display='none';
  document.getElementById('changeEmailSuccess').style.display='none';
  document.getElementById('changeEmailModal').classList.add('show');
}
async function saveChangeEmail(){
  let err=document.getElementById('changeEmailError');err.style.display='none';
  let success=document.getElementById('changeEmailSuccess');success.style.display='none';
  let email=document.getElementById('changeEmailNew').value.trim();
  if(!email||!email.includes('@')){err.textContent='Please enter a valid email address.';err.style.display='block';return}
  let btn=document.getElementById('changeEmailSaveBtn');btn.disabled=true;btn.textContent='Sending...';
  try{
    let {error}=await sb.auth.updateUser({email});
    if(error)throw error;
    success.textContent=`Confirmation link sent to ${email}. Click it to finish changing your login email - until then, keep using your current email and password to log in.`;
    success.style.display='block';
  }catch(e){
    err.textContent=e.message||'Could not start changing your email.';err.style.display='block';
  }finally{
    btn.disabled=false;btn.textContent='Send Confirmation Link';
  }
}
function openChangePassword(){
  document.getElementById('changePasswordNew').value='';
  document.getElementById('changePasswordConfirm').value='';
  document.getElementById('changePasswordError').style.display='none';
  document.getElementById('changePasswordModal').classList.add('show');
}
async function saveChangePassword(){
  let err=document.getElementById('changePasswordError');err.style.display='none';
  let pw=document.getElementById('changePasswordNew').value;
  let confirmPw=document.getElementById('changePasswordConfirm').value;
  if(!pw||pw.length<8){err.textContent='Password must be at least 8 characters.';err.style.display='block';return}
  if(pw!==confirmPw){err.textContent='Passwords do not match.';err.style.display='block';return}
  let btn=document.getElementById('changePasswordSaveBtn');btn.disabled=true;btn.textContent='Saving...';
  try{
    let {error}=await sb.auth.updateUser({password:pw});
    if(error)throw error;
    closeModal('changePasswordModal');
  }catch(e){
    err.textContent=e.message||'Could not change your password.';err.style.display='block';
  }finally{
    btn.disabled=false;btn.textContent='Save';
  }
}
function openMembershipTerms(){document.getElementById('membershipTermsModal').classList.add('show')}
function openSkinTypesInfo(){document.getElementById('skinTypesModal').classList.add('show')}
function openHealthSafety(){document.getElementById('healthSafetyModal').classList.add('show')}
function openGdprPolicy(){document.getElementById('gdprPolicyModal').classList.add('show')}

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
  wizPortalCheckSkinTypeWarning();
}
function wizPortalCheckSkinTypeWarning(){
  let length=+document.getElementById('babLength').value||0,
      isHybrid=document.getElementById('babHybrid').checked,
      threshold=currentCustomer.skinType===1?6:currentCustomer.skinType===2?8:currentCustomer.skinType===3?10:null,
      warningEl=document.getElementById('babSkinTypeWarning');
  warningEl.style.display=(isHybrid&&threshold!==null&&length>threshold)?'block':'none';
}
function openBookABedFlow(){
  babSelectedDate=null;babSelectedTime=null;babSelectedLength=null;babSelectedSessionType=null;
  document.getElementById('babDate').value=new Date().toISOString().slice(0,10);
  document.getElementById('babLength').value='';
  document.getElementById('babSkinTypeWarning').style.display='none';
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
  if(!length||length<5){err.textContent='Session length must be at least 5 minutes.';err.style.display='block';return}
  if(currentCustomer.subscriptionStatus!=='Subscriber'&&length>currentCustomer.minutesLeft){
    err.textContent=`You need ${length} minutes for this session but only have ${currentCustomer.minutesLeft} on your account.`;
    err.style.display='block';
    document.getElementById('babPurchaseMinutesBtn').style.display='block';
    return;
  }
  if(currentCustomer.subscriptionStatus==='Subscriber'&&length>15){
    err.textContent='Unlimited Members and 1 Week Pass holders can book a maximum of 15 minutes per session.';
    err.style.display='block';
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
  let isSubscriber=currentCustomer.subscriptionStatus==='Subscriber';
  let text=isSubscriber
    ?`Confirming this booking will create the bed session.<br><br>Times are approximate as we can not predict running ahead or behind slightly. Please turn up 5 minutes before booking time.<br><br>Your bed will be held for a maximum of 2 minutes after your booking time if there is another customer wanting to use it.<br><br>If you wish to cancel PLEASE do so as soon as you can so we can allow others to use it if required. Thank you!`
    :`Confirming this booking will create the bed session and deduct <b>${babSelectedLength}</b> minutes from your account immediately.<br><br>Times are approximate as we can not predict running ahead or behind slightly. Please turn up 5 minutes before booking time.<br><br>Your bed will be held for a maximum of 2 minutes after your booking time if there is another customer wanting to use it.`;
  document.getElementById('babConfirmBox').innerHTML=text;
  let lateCancelCount=isSubscriber?(portalData.bookings||[]).filter(b=>b.status==='No Show'||b.status==='Cancelled Within Hour'||(b.status==='Cancelled'&&!b.minutesRefunded)).length:0;
  document.getElementById('babLateCancelWarning').style.display=lateCancelCount>=2?'block':'none';
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
    document.getElementById('heroMinutes').textContent=currentCustomer.minutesLeft;
    document.getElementById('babConfirmationText').innerHTML=`Your ${babSelectedLength}-minute session is booked for ${formatDate(babSelectedDate)} at ${babSelectedTime} on ${row.bed_name}.<br>You now have ${row.minutes_left} minutes left.`;
    document.getElementById('bookABedStep3').style.display='none';
    document.getElementById('bookABedStep4').style.display='block';
    await loadPortalData();
  }catch(e){
    let err=document.getElementById('babError');
    if(e.message&&e.message.includes('INSUFFICIENT_MINUTES')){
      err.textContent='You do not have enough minutes for this session.';
    }else if(e.message&&e.message.includes('UNLIMITED_DAILY_LIMIT')){
      err.textContent='As an Unlimited Member, you can only book one session per day. You already have a session on that day, so please choose a different day.';
    }else if(e.message&&e.message.includes('SUBSCRIBER_MAX_15_MINUTES')){
      err.textContent='Unlimited Members and 1 Week Pass holders can book a maximum of 15 minutes per session.';
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
    document.getElementById('heroMinutes').textContent=currentCustomer.minutesLeft;
    alert(row.refunded?`Booking cancelled. ${row.minutes_left} minutes refunded to your account.`:'Booking cancelled. Minutes were not refunded.');
    await loadPortalData();
  }catch(e){alert(e.message||'Could not cancel this booking.')}
}

// ---------- Book a Treatment ----------
function openCustomerBookingPage(){
  window.open('book.html','_blank','noopener');
}
