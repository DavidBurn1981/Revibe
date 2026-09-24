// The real customer portal now lives on its own separate domain/deployment.
// This must be a real, hardcoded URL here - window.location.origin would be
// wrong, since this code runs on the STAFF app's domain when staff click
// "Send Login Details", not on the customer portal's own domain.
const CUSTOMER_PORTAL_BASE_URL='https://revibeportal.com';
let pendingLinkExistingUserId=null;

function customerStandardColumnMaps(){
 let lastSessionByCustomer={},lastPurchaseByCustomer={},recentSessionCountByCustomer={},recentSpendByCustomer={};
 let sessionsCutoff=iso(new Date(new Date().getTime()-21*24*60*60*1000)),spendCutoff=iso(new Date(new Date().getTime()-28*24*60*60*1000));
 (data.bedSessions||[]).forEach(s=>{
   if(!s.customerId)return;
   if(!lastSessionByCustomer[s.customerId]||s.date>lastSessionByCustomer[s.customerId])lastSessionByCustomer[s.customerId]=s.date;
   if(s.date>=sessionsCutoff)recentSessionCountByCustomer[s.customerId]=(recentSessionCountByCustomer[s.customerId]||0)+1;
 });
 (data.customerPurchases||[]).forEach(p=>{
   if(!p.customerId)return;
   if(!lastPurchaseByCustomer[p.customerId]||p.date>lastPurchaseByCustomer[p.customerId])lastPurchaseByCustomer[p.customerId]=p.date;
   if(p.date>=spendCutoff)recentSpendByCustomer[p.customerId]=(recentSpendByCustomer[p.customerId]||0)+p.grandTotal;
 });
 return {lastSessionByCustomer,lastPurchaseByCustomer,recentSessionCountByCustomer,recentSpendByCustomer};
}
function customerStandardColumnsHeader(){
 return "<th>Account</th><th>Name</th><th>Last Sunbed Session</th><th>Last Purchase</th><th>Sessions (Last 3 Wks)</th><th>Purchases Spend (Last 4 Wks)</th><th>Phone</th><th>Minutes Left</th><th>UV Allowed</th><th>ID Checked</th>";
}
function customerStandardColumnsRow(c,maps){
 let lastSession=maps.lastSessionByCustomer[c.id]?formatSunbedDisplayDate(maps.lastSessionByCustomer[c.id]):'—';
 let lastPurchase=maps.lastPurchaseByCustomer[c.id]?formatSunbedDisplayDate(maps.lastPurchaseByCustomer[c.id]):'—';
 let recentSessions=maps.recentSessionCountByCustomer[c.id]||0;
 let recentSpend=maps.recentSpendByCustomer[c.id]||0;
 return `<td>${escapeHtml(c.accountNumber)}</td><td><b>${escapeHtml(c.firstName)} ${escapeHtml(c.lastName)}</b></td><td>${lastSession}</td><td>${lastPurchase}</td><td>${recentSessions}</td><td>£${recentSpend.toFixed(2)}</td><td>${escapeHtml(c.phone||'')}</td><td><b>${c.minutesLeft}</b></td><td>${c.uvAllowed?'Yes':'No'}</td><td>${c.idChecked?'Yes':'No'}</td>`;
}
function renderCustomers(){
 let t=document.getElementById('customerTable');if(!t)return;
 let all=data.customers||[];
 let totalEl=document.getElementById('customerSummaryTotal');
 if(totalEl){
   totalEl.textContent=all.length;
   document.getElementById('customerSummaryOverThree').textContent=all.filter(c=>(c.minutesLeft||0)>3).length;
   document.getElementById('customerSummaryTotalMinutes').textContent=all.reduce((sum,c)=>sum+(+c.minutesLeft||0),0);
 }
 let maps=customerStandardColumnMaps();
 let rows=[...all].sort((a,b)=>a.lastName.localeCompare(b.lastName)||a.firstName.localeCompare(b.firstName));
 let q=(document.getElementById('customerSearchInput')?.value||'').trim().toLowerCase();
 if(q)rows=rows.filter(c=>`${c.firstName} ${c.lastName}`.toLowerCase().includes(q)||(c.accountNumber||'').toLowerCase().includes(q)||(c.phone||'').toLowerCase().includes(q));
 let canEdit=hasRolePermission('treatment_booking_settings','edit');
 t.innerHTML=`<tr>${customerStandardColumnsHeader()}<th></th></tr>`+(rows.length?rows.map(c=>{
   return `<tr class='clinicRow' onclick="openCustomer('${c.id}')">${customerStandardColumnsRow(c,maps)}<td>${canEdit?`<button onclick="event.stopPropagation();deleteCustomer('${c.id}')">Delete</button>`:''}</td></tr>`;
 }).join(''):`<tr><td colspan='11' class='muted'>${q?'No customers match your search.':'No customers yet.'}</td></tr>`);
}
async function deleteCustomer(id){
 let c=data.customers.find(x=>x.id===id);if(!c)return;
 if(!confirm(`Delete customer ${c.firstName} ${c.lastName}?`))return;
 let {error}=await sb.from('customers').delete().eq('id',id);
 if(error){alert('This customer cannot be deleted because they have linked session or payment history. Remove test history first, or keep the customer for the audit trail.\n\n'+error.message);return}
 await loadLiveData();renderCustomers();
}
let selectedSkinType=null;
let uvAllowedManuallySet=false;
function updateUvAllowedColour(){
  let el=document.getElementById('custUvAllowed');
  el.classList.toggle('uvYes',el.value==='true');
  el.classList.toggle('uvNo',el.value==='false');
}
function switchCustomerTab(tab){
  document.querySelectorAll('.customerTabBtn').forEach(b=>b.classList.toggle('active',b.dataset.tab===tab));
  document.querySelectorAll('.customerTabContent').forEach(c=>c.classList.toggle('active',c.dataset.tab===tab));
}
function selectSkinType(type){
  selectedSkinType=type;
  document.querySelectorAll('.skinTypeBtn').forEach(b=>b.classList.toggle('selected',+b.dataset.type===type));
}
function getVerifiedBySelections(){
  return [...document.querySelectorAll('.verifiedByCheck:checked')].map(el=>el.value);
}
function setVerifiedBySelections(list){
  document.querySelectorAll('.verifiedByCheck').forEach(el=>el.checked=(list||[]).includes(el.value));
}
function handleDobOrIdCheckedChange(){
  let idChecked=document.getElementById('custIdChecked').value==='true';
  document.getElementById('verifiedByRow').style.display=idChecked?'block':'none';
  if(idChecked){
    if(!document.getElementById('custIdDate').value)document.getElementById('custIdDate').value=localDateKey();
  }else{
    document.getElementById('custIdDate').value='';
  }
  if(!editingCustomerId){
    let dob=document.getElementById('custDob').value,age=ageFromDob(dob);
    if(idChecked&&age!==null&&age>=18&&!uvAllowedManuallySet)document.getElementById('custUvAllowed').value='true';
  }
  updateUvAllowedColour();
}
function checkNewCustomerAgeWarnings(){
  if(editingCustomerId)return;
  let dob=document.getElementById('custDob').value,age=ageFromDob(dob);
  if(!dob||age===null)return;
  if(age<18){
    document.getElementById('custUvAllowed').value='false';
    updateUvAllowedColour();
    alert('This customer is under 18 and cannot have their account set to UV Allowed: Yes.');
  }else if(age<25){
    alert('Challenge 25, ask for ID');
  }
}
function openCustomerCreate(){editingCustomerId=null;uvAllowedManuallySet=false;document.getElementById('customerModalTitle').textContent='New Customer';document.getElementById('customerAccountLabel').textContent='Account number will be generated automatically.';document.getElementById('portalAccessStatus').innerHTML=`<div class='muted'>Save this customer first before setting up portal access.</div>`;document.getElementById('portalAccessNoAccount').style.display='none';document.getElementById('portalAccessHasAccount').style.display='none';['custFirst','custLast','custDob','custPhone','custEmail','custAddress','custHealthNotes'].forEach(id=>document.getElementById(id).value='');document.getElementById('custUv').value='true';document.getElementById('custIdChecked').value='false';document.getElementById('custIdDate').value='';document.getElementById('custMinutes').value='0';document.getElementById('custUvAllowed').value='false';document.getElementById('custWaiverSigned').value='false';document.getElementById('custBedUse').value='Hybrid';document.getElementById('custPreferredBed').value='Any Bed';document.getElementById('custBedDemo').value='false';document.getElementById('custUnlimitedMember').value='No';document.getElementById('custNoShowsRow').style.display='none';updateUvAllowedColour();setVerifiedBySelections([]);document.getElementById('verifiedByRow').style.display='none';selectedSkinType=null;document.querySelectorAll('.skinTypeBtn').forEach(b=>b.classList.remove('selected'));document.getElementById('customerPurchaseArea').style.display='none';document.getElementById('customerError').style.display='none';switchCustomerTab('personal');document.getElementById('customerModal').classList.add('show')}
function openCustomer(id){let c=data.customers.find(x=>x.id===id);if(!c)return;editingCustomerId=id;document.getElementById('customerModalTitle').textContent=`${c.firstName} ${c.lastName}`;document.getElementById('customerAccountLabel').textContent=`Account ${c.accountNumber}`;renderPortalAccessTab(c);document.getElementById('custFirst').value=c.firstName;document.getElementById('custLast').value=c.lastName;document.getElementById('custDob').value=c.dob;document.getElementById('custPhone').value=c.phone||'';document.getElementById('custEmail').value=c.email||'';document.getElementById('custAddress').value=c.address||'';document.getElementById('custUv').value=String(c.uv);document.getElementById('custIdChecked').value=String(c.idChecked);document.getElementById('custIdDate').value=c.idCheckedDate||'';document.getElementById('custMinutes').value=c.minutesLeft;document.getElementById('custUvAllowed').value=String(!!c.uvAllowed);document.getElementById('custWaiverSigned').value=String(!!c.waiverSignedPresent);document.getElementById('custBedUse').value=c.bedUse||'Hybrid';document.getElementById('custPreferredBed').value=c.preferredBed||'Any Bed';document.getElementById('custBedDemo').value=String(!!c.bedDemoProvided);document.getElementById('custUnlimitedMember').value=c.subscriptionStatus==='Subscriber'?'Yes':c.subscriptionStatus==='Subscriber - Failed Payment'?'Yes (Payment Issue)':'No';
let noShowsRow=document.getElementById('custNoShowsRow');
if(c.subscriptionStatus==='Subscriber'){
  let noShowCount=(data.sunbedBookings||[]).filter(b=>b.customerId===c.id&&b.status==='Cancelled'&&!b.minutesRefunded).length;
  document.getElementById('custNoShows').value=noShowCount;
  noShowsRow.style.display='block';
}else{
  noShowsRow.style.display='none';
}updateUvAllowedColour();document.getElementById('custHealthNotes').value=c.generalHealthNotes||'';setVerifiedBySelections(c.verifiedBy||[]);document.getElementById('verifiedByRow').style.display=c.idChecked?'block':'none';selectedSkinType=c.skinType||null;document.querySelectorAll('.skinTypeBtn').forEach(b=>b.classList.toggle('selected',+b.dataset.type===selectedSkinType));document.getElementById('customerPurchaseArea').style.display='block';renderCustomerPurchases(c);switchCustomerTab('personal');document.getElementById('customerModal').classList.add('show')}
function renderPortalAccessTab(c){
  let statusEl=document.getElementById('portalAccessStatus'),noAccount=document.getElementById('portalAccessNoAccount'),hasAccount=document.getElementById('portalAccessHasAccount');
  if(c.authUserId){
    statusEl.innerHTML=`<div style='font-weight:700;color:var(--green)'>Portal account active</div><div class='muted' style='margin-top:4px'>${escapeHtml(c.email||'No email on file')}</div>`;
    noAccount.style.display='none';hasAccount.style.display='flex';
  }else{
    statusEl.innerHTML=`<div class='muted'>This customer does not have portal access yet.</div>`;
    noAccount.style.display='block';hasAccount.style.display='none';
  }
}
function onPortalAccountBtnClick(){
  let c=data.customers.find(x=>x.id===editingCustomerId);if(!c)return;
  if(c.authUserId){
    document.getElementById('customerModal').classList.remove('show');
    goToPage('customerportalpreview');
    setTimeout(()=>selectPortalPreviewCustomer(c.id),50);
  }else{
    document.getElementById('createPortalAccountName').textContent=`${c.firstName} ${c.lastName}`;
    document.getElementById('createPortalAccountEmail').value=c.email||'';
    document.getElementById('createPortalAccountError').style.display='none';
    document.getElementById('linkExistingAccountArea').style.display='none';
    pendingLinkExistingUserId=null;
    document.getElementById('createPortalAccountModal').classList.add('show');
    if(c.email)checkForExistingLogin(c.email);
  }
}
async function checkForExistingLogin(email){
  try{
    let {data:result}=await sb.functions.invoke('invite-customer-portal-access',{body:{action:'check_email',email}});
    if(result?.exists&&!result?.already_linked_to_a_customer&&result?.existing_user_id){
      pendingLinkExistingUserId=result.existing_user_id;
      let label=result.existing_user_name?`(${result.existing_user_name}${result.existing_user_role?`, ${result.existing_user_role}`:''})`:'';
      document.getElementById('linkExistingAccountLabel').textContent=label;
      document.getElementById('linkExistingAccountArea').style.display='block';
    }
  }catch(e){/* silent - this is just a convenience check, the normal Send flow still catches this either way */}
}
function closeCreatePortalAccountModal(){
  document.getElementById('createPortalAccountModal').classList.remove('show');
  document.getElementById('linkExistingAccountArea').style.display='none';
  pendingLinkExistingUserId=null;
}
async function unwrapEdgeFunctionError(e,fallback){
  // supabase-js's FunctionsHttpError only ever carries a generic message
  // ("Edge Function returned a non-2xx status code") on e.message - the actual
  // error body we returned from the function itself is on e.context, and needs
  // to be read and parsed separately to get the real, useful message.
  let message=e.message||fallback;
  if(e.context&&typeof e.context.json==='function'){
    try{
      let body=await e.context.json();
      if(body?.error)message=body.error;
    }catch(parseErr){/* fall back to the generic message above */}
  }
  return message;
}
async function sendPortalInvite(){
  let c=data.customers.find(x=>x.id===editingCustomerId);if(!c)return;
  let err=document.getElementById('createPortalAccountError');err.style.display='none';
  document.getElementById('linkExistingAccountArea').style.display='none';
  pendingLinkExistingUserId=null;
  let email=document.getElementById('createPortalAccountEmail').value.trim();
  if(!email||!email.includes('@')){err.textContent='Please enter a valid email address.';err.style.display='block';return}
  let btn=document.getElementById('sendPortalInviteBtn');btn.disabled=true;btn.textContent='Sending...';
  try{
    let {data:result,error}=await sb.functions.invoke('invite-customer-portal-access',{
      body:{customer_id:c.id,email,portal_redirect_url:CUSTOMER_PORTAL_BASE_URL}
    });
    if(error)throw error;
    if(result?.code==='email_exists'&&result?.existing_user_id){
      pendingLinkExistingUserId=result.existing_user_id;
      let label=result.existing_user_name?`(${result.existing_user_name}${result.existing_user_role?`, ${result.existing_user_role}`:''})`:'';
      document.getElementById('linkExistingAccountLabel').textContent=label;
      document.getElementById('linkExistingAccountArea').style.display='block';
      err.textContent=result.error;err.style.display='block';
      return;
    }
    if(result?.error)throw new Error(result.error);
    document.getElementById('createPortalAccountModal').classList.remove('show');
    await loadLiveData();
    let refreshed=data.customers.find(x=>x.id===c.id);
    if(refreshed)renderPortalAccessTab(refreshed);
    alert(`Login details sent to ${email}.`);
  }catch(e){
    err.textContent=await unwrapEdgeFunctionError(e,'Could not send login details.');err.style.display='block';
  }finally{
    btn.disabled=false;btn.textContent='Send Login Details';
  }
}
async function linkExistingPortalAccount(){
  let c=data.customers.find(x=>x.id===editingCustomerId);if(!c||!pendingLinkExistingUserId)return;
  let err=document.getElementById('createPortalAccountError');err.style.display='none';
  let linkBtn=document.querySelector('#linkExistingAccountArea button');linkBtn.disabled=true;linkBtn.textContent='Linking...';
  try{
    let {data:result,error}=await sb.functions.invoke('invite-customer-portal-access',{
      body:{action:'link_existing',customer_id:c.id,existing_user_id:pendingLinkExistingUserId}
    });
    if(error)throw error;
    if(result?.error)throw new Error(result.error);
    closeCreatePortalAccountModal();
    await loadLiveData();
    let refreshed=data.customers.find(x=>x.id===c.id);
    if(refreshed)renderPortalAccessTab(refreshed);
    alert('This customer is now linked to their existing login. They can use the same email and password to access both the portal and their staff account.');
  }catch(e){
    err.textContent=await unwrapEdgeFunctionError(e,'Could not link this account.');err.style.display='block';
  }finally{
    linkBtn.disabled=false;linkBtn.textContent='Yes, link this customer to that login';
  }
}
let pendingLinkExistingUserIdManual=null;
async function checkForExistingLoginManual(email){
  try{
    let {data:result}=await sb.functions.invoke('invite-customer-portal-access',{body:{action:'check_email',email}});
    if(result?.exists&&!result?.already_linked_to_a_customer&&result?.existing_user_id){
      pendingLinkExistingUserIdManual=result.existing_user_id;
      let label=result.existing_user_name?`(${result.existing_user_name}${result.existing_user_role?`, ${result.existing_user_role}`:''})`:'';
      document.getElementById('linkExistingManualAccountLabel').textContent=label;
      document.getElementById('linkExistingManualAccountArea').style.display='block';
    }
  }catch(e){/* silent - convenience check only */}
}
function openManualCreatePortalAccountModal(){
  let c=data.customers.find(x=>x.id===editingCustomerId);if(!c)return;
  document.getElementById('manualCreatePortalAccountLabel').textContent=`${c.firstName} ${c.lastName}`;
  document.getElementById('manualCreatePortalAccountEmail').value=c.email||'';
  document.getElementById('manualCreatePortalAccountPassword').value='';
  document.getElementById('manualCreatePortalAccountPassword').type='password';
  document.getElementById('manualCreatePortalAccountShowBtn').textContent='Show';
  document.getElementById('manualCreatePortalAccountError').style.display='none';
  document.getElementById('linkExistingManualAccountArea').style.display='none';
  pendingLinkExistingUserIdManual=null;
  document.getElementById('manualCreatePortalAccountModal').classList.add('show');
}
function closeManualCreatePortalAccountModal(){
  document.getElementById('manualCreatePortalAccountModal').classList.remove('show');
  document.getElementById('linkExistingManualAccountArea').style.display='none';
  pendingLinkExistingUserIdManual=null;
}
function toggleManualCreatePortalAccountVisibility(){
  let input=document.getElementById('manualCreatePortalAccountPassword'),btn=document.getElementById('manualCreatePortalAccountShowBtn');
  let showing=input.type==='text';
  input.type=showing?'password':'text';btn.textContent=showing?'Show':'Hide';
}
function generateManualCreatePortalAccountPassword(){
  const chars='ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  let pw='';for(let i=0;i<12;i++)pw+=chars[Math.floor(Math.random()*chars.length)];
  document.getElementById('manualCreatePortalAccountPassword').value=pw;
  document.getElementById('manualCreatePortalAccountPassword').type='text';
  document.getElementById('manualCreatePortalAccountShowBtn').textContent='Hide';
}
async function saveManualCreatePortalAccount(){
  let c=data.customers.find(x=>x.id===editingCustomerId);if(!c)return;
  let err=document.getElementById('manualCreatePortalAccountError');err.style.display='none';
  document.getElementById('linkExistingManualAccountArea').style.display='none';
  pendingLinkExistingUserIdManual=null;
  let email=document.getElementById('manualCreatePortalAccountEmail').value.trim();
  let password=document.getElementById('manualCreatePortalAccountPassword').value;
  if(!email||!email.includes('@')){err.textContent='Please enter a valid email address.';err.style.display='block';return}
  if(!password||password.length<8){err.textContent='Password must be at least 8 characters.';err.style.display='block';return}
  let btn=document.getElementById('manualCreatePortalAccountSaveBtn');btn.disabled=true;btn.textContent='Creating...';
  try{
    let {data:result,error}=await sb.functions.invoke('invite-customer-portal-access',{
      body:{action:'create_without_email',customer_id:c.id,email,password}
    });
    if(error)throw error;
    if(result?.code==='email_exists'&&result?.existing_user_id){
      pendingLinkExistingUserIdManual=result.existing_user_id;
      let label=result.existing_user_name?`(${result.existing_user_name}${result.existing_user_role?`, ${result.existing_user_role}`:''})`:'';
      document.getElementById('linkExistingManualAccountLabel').textContent=label;
      document.getElementById('linkExistingManualAccountArea').style.display='block';
      err.textContent=result.error;err.style.display='block';
      return;
    }
    if(result?.error)throw new Error(result.error);
    closeManualCreatePortalAccountModal();
    await loadLiveData();
    let refreshed=data.customers.find(x=>x.id===c.id);
    if(refreshed)renderPortalAccessTab(refreshed);
    alert(`Account created and active immediately. Give the customer their email (${email}) and the password you set - REVIBE does not store it.`);
  }catch(e){
    err.textContent=await unwrapEdgeFunctionError(e,'Could not create this account.');err.style.display='block';
  }finally{
    btn.disabled=false;btn.textContent='Create Account';
  }
}
async function linkExistingManualPortalAccount(){
  let c=data.customers.find(x=>x.id===editingCustomerId);if(!c||!pendingLinkExistingUserIdManual)return;
  let err=document.getElementById('manualCreatePortalAccountError');err.style.display='none';
  let linkBtn=document.querySelector('#linkExistingManualAccountArea button');linkBtn.disabled=true;linkBtn.textContent='Linking...';
  try{
    let {data:result,error}=await sb.functions.invoke('invite-customer-portal-access',{
      body:{action:'link_existing',customer_id:c.id,existing_user_id:pendingLinkExistingUserIdManual}
    });
    if(error)throw error;
    if(result?.error)throw new Error(result.error);
    closeManualCreatePortalAccountModal();
    await loadLiveData();
    let refreshed=data.customers.find(x=>x.id===c.id);
    if(refreshed)renderPortalAccessTab(refreshed);
    alert('This customer is now linked to their existing login. They can use the same email and password to access both the portal and their staff account.');
  }catch(e){
    err.textContent=await unwrapEdgeFunctionError(e,'Could not link this account.');err.style.display='block';
  }finally{
    linkBtn.disabled=false;linkBtn.textContent='Yes, link this customer to that login';
  }
}
async function resendPortalInvite(){
  let c=data.customers.find(x=>x.id===editingCustomerId);if(!c)return;
  let btn=document.getElementById('resendPortalInviteBtn');btn.disabled=true;btn.textContent='Sending...';
  try{
    let {data:result,error}=await sb.functions.invoke('invite-customer-portal-access',{
      body:{action:'resend_invite',customer_id:c.id,portal_redirect_url:CUSTOMER_PORTAL_BASE_URL}
    });
    if(error)throw error;
    if(result?.error)throw new Error(result.error);
    alert(`Portal invite resent to ${c.email}.`);
  }catch(e){
    alert(await unwrapEdgeFunctionError(e,'Could not resend this invite.'));
  }finally{
    btn.disabled=false;btn.textContent='Resend Portal Invite';
  }
}
async function sendPortalPasswordReset(){
  let c=data.customers.find(x=>x.id===editingCustomerId);if(!c)return;
  let btn=document.getElementById('sendPortalPasswordResetBtn');btn.disabled=true;btn.textContent='Sending...';
  try{
    let {data:result,error}=await sb.functions.invoke('invite-customer-portal-access',{
      body:{action:'password_reset',customer_id:c.id,portal_redirect_url:CUSTOMER_PORTAL_BASE_URL}
    });
    if(error)throw error;
    if(result?.error)throw new Error(result.error);
    alert(`Password reset email sent to ${c.email}.`);
  }catch(e){
    alert(await unwrapEdgeFunctionError(e,'Could not send this email.'));
  }finally{
    btn.disabled=false;btn.textContent='Send Password Reset Email';
  }
}
function openCustomerSetPasswordModal(){
  let c=data.customers.find(x=>x.id===editingCustomerId);if(!c)return;
  document.getElementById('customerSetPasswordLabel').textContent=`${c.firstName} ${c.lastName}`;
  document.getElementById('customerSetPasswordValue').value='';
  document.getElementById('customerSetPasswordValue').type='password';
  document.getElementById('customerSetPasswordShowBtn').textContent='Show';
  document.getElementById('customerSetPasswordError').style.display='none';
  document.getElementById('customerSetPasswordModal').classList.add('show');
}
function closeCustomerSetPasswordModal(){document.getElementById('customerSetPasswordModal').classList.remove('show')}
function toggleCustomerSetPasswordVisibility(){
  let input=document.getElementById('customerSetPasswordValue'),btn=document.getElementById('customerSetPasswordShowBtn');
  let showing=input.type==='text';
  input.type=showing?'password':'text';btn.textContent=showing?'Show':'Hide';
}
function generateCustomerPassword(){
  const chars='ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  let pw='';for(let i=0;i<12;i++)pw+=chars[Math.floor(Math.random()*chars.length)];
  document.getElementById('customerSetPasswordValue').value=pw;
  document.getElementById('customerSetPasswordValue').type='text';
  document.getElementById('customerSetPasswordShowBtn').textContent='Hide';
}
async function saveCustomerSetPassword(){
  let c=data.customers.find(x=>x.id===editingCustomerId);if(!c)return;
  let err=document.getElementById('customerSetPasswordError');err.style.display='none';
  let password=document.getElementById('customerSetPasswordValue').value;
  if(!password||password.length<8){err.textContent='Password must be at least 8 characters.';err.style.display='block';return}
  let btn=document.getElementById('customerSetPasswordSaveBtn');btn.disabled=true;btn.textContent='Saving...';
  try{
    let {data:result,error}=await sb.functions.invoke('invite-customer-portal-access',{
      body:{action:'set_password',customer_id:c.id,password}
    });
    if(error)throw error;
    if(result?.error)throw new Error(result.error);
    closeCustomerSetPasswordModal();
    alert('Password set. Share it with the customer directly - REVIBE does not store it.');
  }catch(e){
    err.textContent=await unwrapEdgeFunctionError(e,'Could not set this password.');err.style.display='block';
  }finally{
    btn.disabled=false;btn.textContent='Set Password';
  }
}
function closeCustomerModal(){document.getElementById('customerModal').classList.remove('show')}
function openAddMinutesModal(){
  if(!editingCustomerId)return;
  document.getElementById('addMinutesAmount').value='';
  document.getElementById('addMinutesReasonCategory').value='';
  document.getElementById('addMinutesReason').value='';
  document.getElementById('addMinutesError').style.display='none';
  document.getElementById('addMinutesModal').classList.add('show');
}
async function confirmAddMinutesManually(){
  let err=document.getElementById('addMinutesError');err.style.display='none';
  let minutes=+document.getElementById('addMinutesAmount').value||0,
      reasonCategory=document.getElementById('addMinutesReasonCategory').value,
      reason=document.getElementById('addMinutesReason').value.trim();
  if(!minutes){err.textContent='Please enter a number of minutes to add or remove.';err.style.display='block';return}
  if(!reasonCategory){err.textContent='Please select a Reason Category.';err.style.display='block';return}
  if(!reason){err.textContent='Please enter a reason for this change.';err.style.display='block';return}
  try{
    let {error}=await sb.rpc('add_minutes_to_customer_account',{
      p_customer:editingCustomerId,p_minutes:minutes,p_transaction_type:'Adjustment',
      p_title:'Manual Adjustment',p_notes:reason,p_total_value:0,p_reason_category:reasonCategory
    });
    if(error)throw error;
    document.getElementById('addMinutesModal').classList.remove('show');
    await loadLiveData();
    openCustomer(editingCustomerId);
    alert(minutes>0?`${minutes} minutes added successfully.`:`${Math.abs(minutes)} minutes removed successfully.`);
  }catch(e){err.textContent=e.message||'Could not update minutes.';err.style.display='block'}
}
let duplicateCustomerId=null;
function showDuplicateCustomerModal(existingCustomer){
  duplicateCustomerId=existingCustomer.id;
  document.getElementById('duplicateCustomerMessage').textContent=`${existingCustomer.firstName} ${existingCustomer.lastName} (Account ${existingCustomer.accountNumber}) already has a record with this name and date of birth.`;
  document.getElementById('duplicateCustomerModal').classList.add('show');
}
function viewDuplicateCustomer(){
  let id=duplicateCustomerId;
  document.getElementById('duplicateCustomerModal').classList.remove('show');
  if(id)openCustomer(id);
}
async function saveCustomer(){
 let first=document.getElementById('custFirst').value.trim(),last=document.getElementById('custLast').value.trim(),dob=document.getElementById('custDob').value,phone=document.getElementById('custPhone').value.trim(),email=document.getElementById('custEmail').value.trim(),address=document.getElementById('custAddress').value.trim(),uv=document.getElementById('custUv').value==='true',idChecked=document.getElementById('custIdChecked').value==='true',idCheckedDate=document.getElementById('custIdDate').value||null,uvAllowed=document.getElementById('custUvAllowed').value==='true',waiverSigned=document.getElementById('custWaiverSigned').value==='true',bedUse=document.getElementById('custBedUse').value,preferredBed=document.getElementById('custPreferredBed').value,bedDemo=document.getElementById('custBedDemo').value==='true',verifiedBy=idChecked?getVerifiedBySelections():[],healthNotes=document.getElementById('custHealthNotes').value.trim(),age=ageFromDob(dob),err=document.getElementById('customerError');err.style.display='none';
 if(!first||!last||!dob){err.textContent='First name, last name and DOB are required.';err.style.display='block';return}
 if(age<18){alert('CUSTOMER IS BELOW 18 AND CAN NOT BE A CUSTOMER.');return}
 let isNewCustomer=!editingCustomerId;
 if(isNewCustomer&&!selectedSkinType){err.textContent='Please select a skin type before creating the account.';err.style.display='block';return}
 if(isNewCustomer&&!waiverSigned){err.textContent='Waiver Signed and Present must be set to Yes before creating the account.';err.style.display='block';return}
 let duplicate=(data.customers||[]).find(c=>c.id!==editingCustomerId&&c.dob===dob&&c.firstName.trim().toLowerCase()===first.toLowerCase()&&c.lastName.trim().toLowerCase()===last.toLowerCase());
 if(duplicate){showDuplicateCustomerModal(duplicate);return}
 if(uv&&age<25&&!idChecked)alert('CHECK CUSTOMER ID');
 let payload={first_name:first,last_name:last,date_of_birth:dob,phone_number:phone||null,email:email||null,address:address||null,intends_uv_or_injectables:uv,id_checked:idChecked,id_checked_date:idCheckedDate,uv_allowed:uvAllowed,waiver_signed_present:waiverSigned,bed_use:bedUse,preferred_bed:preferredBed,bed_demo_provided:bedDemo,verified_by:verifiedBy,skin_type:selectedSkinType,general_health_notes:healthNotes||null,updated_at:new Date().toISOString()},error,row;
 if(editingCustomerId)({data:row,error}=await sb.from('customers').update(payload).eq('id',editingCustomerId).select().single());else({data:row,error}=await sb.from('customers').insert(payload).select().single());
 if(error){
   if(error.code==='23505'){
     await loadLiveData();
     let existing=(data.customers||[]).find(c=>c.id!==editingCustomerId&&c.dob===dob&&c.firstName.trim().toLowerCase()===first.toLowerCase()&&c.lastName.trim().toLowerCase()===last.toLowerCase());
     if(existing){showDuplicateCustomerModal(existing);return}
     err.textContent='A customer with this name and date of birth already exists.';err.style.display='block';return
   }
   err.textContent=error.message;err.style.display='block';return
 }
 await loadLiveData();renderCustomers();openCustomer(row.id)
 alert(isNewCustomer?'New Account successfully created.':'Customer details saved successfully.')
}
function renderCustomerPurchases(c){
 let tx=(data.customerTransactions||[]).filter(x=>x.customerId===c.id).sort((a,b)=>b.createdAt.localeCompare(a.createdAt));
 document.getElementById('customerTransactionTable').innerHTML="<tr><th>Date</th><th>Type</th><th>Details</th><th>Value</th><th>Minutes</th><th>Balance</th><th>Reason Category</th></tr>"+(tx.length?tx.map(x=>`<tr><td>${new Date(x.createdAt).toLocaleString('en-GB')}</td><td>${x.type}</td><td>${escapeHtml(x.product||'')}${x.notes?` — ${escapeHtml(x.notes)}`:''}</td><td>£${x.value.toFixed(2)}</td><td>${x.minutes>0?'+':''}${x.minutes}</td><td>${x.balance}</td><td>${escapeHtml(x.reasonCategory||'—')}</td></tr>`).join(''):"<tr><td colspan='7' class='muted'>No transactions yet.</td></tr>")
 let sessions=(data.bedSessions||[]).filter(s=>s.customerId===c.id).sort((a,b)=>b.date.localeCompare(a.date)||b.time.localeCompare(a.time));
 document.getElementById('customerSessionHistoryTable').innerHTML="<tr><th>Date</th><th>Time</th><th>Length</th><th>Minutes From Account</th><th>Session Type</th></tr>"+(sessions.length?sessions.map(s=>{
   let dateLabel=parseLocalDateKey(s.date).toLocaleDateString('en-GB',{weekday:'short',day:'numeric',month:'short'});
   return `<tr><td><b>${dateLabel}</b></td><td>${escapeHtml(s.time||'')}</td><td>${s.length} min</td><td>${s.accountMinutes} min</td><td>${escapeHtml(normalizeSessionType(s))}</td></tr>`;
 }).join(''):"<tr><td colspan='5' class='muted'>No sessions yet.</td></tr>")
 let purchases=(data.customerPurchases||[]).filter(p=>p.customerId===c.id).sort((a,b)=>b.date.localeCompare(a.date)||(b.createdAt||'').localeCompare(a.createdAt||''));
 document.getElementById('customerRecordPurchasesTable').innerHTML="<tr><th>Date</th><th>Items</th><th>Grand Total</th></tr>"+(purchases.length?purchases.map(p=>{
   let items=(data.customerPurchaseItems||[]).filter(i=>i.purchaseId===p.id);
   let itemSummary=items.map(i=>escapeHtml(i.title)).join(', ')||'—';
   let dateLabel=parseLocalDateKey(p.date).toLocaleDateString('en-GB',{weekday:'short',day:'numeric',month:'short'});
   return `<tr class='clinicRow' onclick="openCustomerPurchaseDetail('${p.id}')"><td><b>${dateLabel}</b></td><td>${itemSummary}</td><td><b>£${p.grandTotal.toFixed(2)}</b></td></tr>`;
 }).join(''):"<tr><td colspan='3' class='muted'>No purchases yet.</td></tr>")
}
function openBlockPurchase(id){purchaseProductId=id;document.getElementById('purchaseQty').value='1';document.getElementById('purchaseCardAmount').value='';document.getElementById('purchaseCashAmount').value='';document.getElementById('purchaseModalError').textContent='';document.getElementById('purchaseModalError').style.display='none';updatePurchaseSummary();document.getElementById('purchaseModal').classList.add('show')}
function updatePurchaseSummary(){
  let p=data.tanningProducts.find(x=>x.id===purchaseProductId),q=Math.max(1,+document.getElementById('purchaseQty').value||1);
  if(!p)return;
  let total=p.price*q;
  document.getElementById('purchaseSummary').textContent=`Purchasing ${q} × ${p.title} (${p.minutes*q} minutes) for £${total.toFixed(2)}.`;
  let card=+document.getElementById('purchaseCardAmount').value||0,cash=+document.getElementById('purchaseCashAmount').value||0;
  let entered=pence(card)+pence(cash),due=pence(total);
  let statusEl=document.getElementById('purchaseSplitStatus');
  statusEl.className='processPurchasesCheck '+(entered===due?'ok':'bad');
  statusEl.textContent=entered===due?'✓ Matches amount due':`Card + Cash must equal the amount due — ${entered<due?`Another £${((due-entered)/100).toFixed(2)} needed`:`£${((entered-due)/100).toFixed(2)} too much`}`;
}
async function completeBlockPurchase(){
  let p=data.tanningProducts.find(x=>x.id===purchaseProductId);if(!p)return;
  let q=Math.max(1,+document.getElementById('purchaseQty').value||1),
      card=+document.getElementById('purchaseCardAmount').value||0,
      cash=+document.getElementById('purchaseCashAmount').value||0,
      total=p.price*q,err=document.getElementById('purchaseModalError');
  err.textContent='';err.style.display='none';
  if(pence(card)+pence(cash)!==pence(total)){err.textContent='Card + Cash must equal the amount due before confirming.';err.style.display='block';return}
  try{
    let {data:bal,error}=await sb.rpc('purchase_block_minutes',{p_customer:editingCustomerId,p_product:purchaseProductId,p_quantity:q});
    if(error)throw error;
    let isTreatmentsCard=p.cardMachine==='Treatment Card';
    let {data:purchase,error:purchaseError}=await sb.from('customer_purchases').insert({
      purchase_date:localDateKey(),
      treatments_total:isTreatmentsCard?total:0,glow_studio_total:isTreatmentsCard?0:total,grand_total:total,
      glow_studio_card_amount:isTreatmentsCard?0:card,glow_studio_cash_amount:isTreatmentsCard?0:cash,
      treatments_card_amount:isTreatmentsCard?card:0,treatments_cash_amount:isTreatmentsCard?cash:0,
      customer_id:editingCustomerId
    }).select().single();
    if(purchaseError)throw purchaseError;
    let {error:itemsError}=await sb.from('customer_purchase_items').insert({
      purchase_id:purchase.id,tanning_product_id:p.id,product_title:q>1?`${p.title} × ${q}`:p.title,
      product_type:p.type,card_machine:p.cardMachine,price:total
    });
    if(itemsError)throw itemsError;
    let {error:takingsError}=await sb.rpc('add_to_daily_takings',{
      p_date:localDateKey(),
      p_cash:cash,p_treatments_card:isTreatmentsCard?card:0,p_bed_card:isTreatmentsCard?0:card
    });
    if(takingsError)throw takingsError;
    document.getElementById('purchaseModal').classList.remove('show');
    await loadLiveData();openCustomer(editingCustomerId);renderAll();
    alert(`Purchase complete. ${bal} minutes left on account.`);
  }catch(e){err.textContent=e.message||'Could not complete this purchase.';err.style.display='block'}
}
function renderTanningProducts(){let t=document.getElementById('tanningProductsTable');if(!t)return;let rows=data.tanningProducts||[];let q=(document.getElementById('tanningProductSearchInput')?.value||'').trim().toLowerCase();if(q)rows=rows.filter(p=>(p.title||'').toLowerCase().includes(q)||(p.type||'').toLowerCase().includes(q));t.innerHTML="<tr><th>Type</th><th>Product</th><th>Minutes</th><th>Price</th><th>Stock</th></tr>"+(rows.length?rows.map(p=>`<tr class='clinicRow' onclick="openTanningProduct('${p.id}')"><td>${escapeHtml(p.type)}</td><td><b>${escapeHtml(p.title)}</b></td><td>${p.minutes??'—'}</td><td>£${p.price.toFixed(2)}</td><td>${p.stock??'—'}</td></tr>`).join(''):`<tr><td colspan='5' class='muted'>${q?'No products match your search.':'No products yet.'}</td></tr>`)}
function openTanningProduct(id=null){editingTanningProductId=id;let p=id?data.tanningProducts.find(x=>x.id===id):null;document.getElementById('tanningProductTitle').textContent=p?'Edit Product':'New Product';let types=['PAYG Minutes','Block Minutes','RLT Programme','Tangible'],selected=p?.type||'PAYG Minutes';document.getElementById('productTypeButtons').innerHTML=types.map(x=>`<button type='button' class='${x===selected?'primary':''}' onclick="selectTanningProductType('${x}')">${x}</button>`).join('');document.getElementById('tanningProductModal').dataset.type=selected;document.getElementById('tpTitle').value=p?.title||'';document.getElementById('tpPrice').value=p?.price??'';document.getElementById('tpMinutes').value=p?.minutes??'';document.getElementById('tpStock').value=p?.stock??'';document.getElementById('tpCardMachine').value=p?.cardMachine||'Sunbed Card';document.getElementById('tpDescription').value=p?.description||'';updateTanningProductFields();document.getElementById('deleteTanningProductBtn').style.display=p?'inline-block':'none';document.getElementById('tanningProductModal').classList.add('show')}
async function deleteTanningProduct(){if(!editingTanningProductId)return alert('Save the product before it can be deleted.');if(!confirm('Delete this product?'))return;let {error}=await sb.from('tanning_rlt_products').delete().eq('id',editingTanningProductId);if(error)return alert(error.message);document.getElementById('tanningProductModal').classList.remove('show');await loadLiveData();renderTanningProducts()}
function selectTanningProductType(t){let modal=document.getElementById('tanningProductModal');modal.dataset.type=t;document.getElementById('productTypeButtons').querySelectorAll('button').forEach(b=>b.classList.toggle('primary',b.textContent===t));updateTanningProductFields()}
function updateTanningProductFields(){let t=document.getElementById('tanningProductModal').dataset.type;document.getElementById('tpMinutesWrap').style.display=['PAYG Minutes','Block Minutes'].includes(t)?'block':'none';document.getElementById('tpStockWrap').style.display=t==='Tangible'?'block':'none'}
async function saveTanningProduct(){let type=document.getElementById('tanningProductModal').dataset.type,title=document.getElementById('tpTitle').value.trim(),price=+document.getElementById('tpPrice').value,minutes=+document.getElementById('tpMinutes').value||null,stock=+document.getElementById('tpStock').value||null,cardMachine=document.getElementById('tpCardMachine').value,description=document.getElementById('tpDescription').value.trim();if(!title||!Number.isFinite(price))return alert('Enter a title and valid price.');let payload={product_type:type,title,description:description||null,minute_amount:['PAYG Minutes','Block Minutes'].includes(type)?minutes:null,price,current_stock_level:type==='Tangible'?stock:null,card_machine:cardMachine,updated_at:new Date().toISOString()},error;if(editingTanningProductId)({error}=await sb.from('tanning_rlt_products').update(payload).eq('id',editingTanningProductId));else({error}=await sb.from('tanning_rlt_products').insert(payload));if(error)return alert(error.message);document.getElementById('tanningProductModal').classList.remove('show');await loadLiveData();renderTanningProducts()}
function sessionCustomerChanged(){let id=document.getElementById('sessionCustomerId').value;if(id&&data.customers.find(x=>x.id===id))selectSessionCustomer(id);else document.getElementById('sessionCustomerBalance').textContent='Select a customer to see account minutes, or leave blank.'}
function purchaseMoreFromSession(){let id=document.getElementById('sessionCustomerId').value;document.getElementById('insufficientMinutesModal').classList.remove('show');if(id)openCustomer(id)}
