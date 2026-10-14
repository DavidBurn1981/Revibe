// Two lists opened from Performance Reporting:
//  - Active Subscriptions: every customer with a live Monthly membership or 1 Week Pass.
//  - Opportunity to SMS: customers who can be texted right now (no text in the last 14 days, opted in, valid UK mobile),
//    have more than 10 minutes on their account and have not visited in the last 14 days.
const LIST_WINDOW_DAYS=14;
let lastActiveSubsExport=null,lastSmsOpportunityExport=null;

function listDate(v){return v?new Date(v).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'}):''}
function isValidUkMobile(raw){
  let d=(raw||'').replace(/[^0-9+]/g,'');
  if(d.startsWith('+'))d=d.slice(1);else if(d.startsWith('00'))d=d.slice(2);else if(d.startsWith('0'))d='44'+d.slice(1);
  return /^447[0-9]{9}$/.test(d);
}
function openCustomerFromList(modalId,customerId){
  document.getElementById(modalId).classList.remove('show');
  openCustomer(customerId);
}
function customerLinkCell(modalId,c){
  return `<td><a href='javascript:void(0)' style='color:var(--pink);text-decoration:underline'>${escapeHtml(c.firstName)} ${escapeHtml(c.lastName)}</a></td>`;
}

// ---------- Active Subscriptions ----------
function openActiveSubscriptions(){
  let rows=(data.customers||[]).filter(c=>c.subscriptionStatus==='Subscriber'||c.subscriptionStatus==='Subscriber - Failed Payment')
    .map(c=>({c,type:c.subscriptionType==='7_Day_Pass'?'1 Week Pass':c.subscriptionType==='Monthly'?'Monthly':'Unknown',issue:c.subscriptionStatus==='Subscriber - Failed Payment'}))
    .sort((a,b)=>a.type.localeCompare(b.type)||`${a.c.firstName} ${a.c.lastName}`.localeCompare(`${b.c.firstName} ${b.c.lastName}`));
  lastActiveSubsExport=rows;
  let monthly=rows.filter(r=>r.type==='Monthly').length,passes=rows.filter(r=>r.type==='1 Week Pass').length,issues=rows.filter(r=>r.issue).length;
  document.getElementById('activeSubsSubtitle').textContent=`${rows.length} active subscription${rows.length===1?'':'s'} - ${monthly} Monthly, ${passes} 1 Week Pass${issues?`, ${issues} with a payment issue`:''}`;
  document.getElementById('activeSubsTable').innerHTML='<tr><th>Account</th><th>Customer</th><th>Type</th><th>Status</th><th>Expires / Renews</th><th>Mobile</th></tr>'+
    (rows.length?rows.map(r=>`<tr class='clinicRow' onclick="openCustomerFromList('activeSubsModal','${r.c.id}')"><td>${escapeHtml(r.c.accountNumber||'')}</td>${customerLinkCell('activeSubsModal',r.c)}<td>${r.type}</td><td>${r.issue?`<span style='color:var(--amber);font-weight:700'>Payment issue</span>`:`<span style='color:var(--green);font-weight:700'>Active</span>`}</td><td>${r.c.subscriptionExpiresAt?listDate(r.c.subscriptionExpiresAt):'<span class="muted">—</span>'}</td><td>${escapeHtml(r.c.phone||'')}</td></tr>`).join(''):`<tr><td colspan='6' class='muted' style='text-align:center;padding:24px'>There are no active subscriptions.</td></tr>`);
  document.getElementById('activeSubsModal').classList.add('show');
}
function exportActiveSubsToExcel(){
  if(!lastActiveSubsExport||!lastActiveSubsExport.length){alert('No active subscriptions to export.');return}
  let ws=XLSX.utils.json_to_sheet(lastActiveSubsExport.map(r=>({'Account':r.c.accountNumber||'','Customer':`${r.c.firstName} ${r.c.lastName}`,'Type':r.type,'Status':r.issue?'Payment issue':'Active','Expires / Renews':r.c.subscriptionExpiresAt?listDate(r.c.subscriptionExpiresAt):'','Mobile':r.c.phone||''}))),wb=XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb,ws,'Active Subscriptions');XLSX.writeFile(wb,`REVIBE Active Subscriptions ${localDateKey()}.xlsx`);
}

// ---------- Opportunity to SMS ----------
async function openSmsOpportunities(){
  let table=document.getElementById('smsOppTable'),err=document.getElementById('smsOppError');
  err.style.display='none';
  table.innerHTML=`<tr><td class='muted' style='text-align:center;padding:24px'>Loading...</td></tr>`;
  document.getElementById('smsOppSubtitle').textContent='';
  document.getElementById('smsOppModal').classList.add('show');
  try{
    // Fresh look at who has been texted recently (either kind of text counts).
    let since=new Date(Date.now()-LIST_WINDOW_DAYS*86400000).toISOString();
    let {data:logs,error}=await sb.from('sms_log').select('customer_id,created_at').in('kind',['minutes_balance','marketing']).eq('status','sent').gte('created_at',since).limit(5000);
    if(error)throw error;
    let texted=new Set((logs||[]).map(l=>l.customer_id));
    let lastText={};
    {let {data:allLogs}=await sb.from('sms_log').select('customer_id,created_at').in('kind',['minutes_balance','marketing']).eq('status','sent').order('created_at',{ascending:false}).limit(5000);
     (allLogs||[]).forEach(l=>{if(!lastText[l.customer_id])lastText[l.customer_id]=l.created_at})}
    let cutoff=localDateKey(new Date(Date.now()-LIST_WINDOW_DAYS*86400000));
    let lastVisit={};
    (data.bedSessions||[]).forEach(s=>{if(s.customerId&&(!lastVisit[s.customerId]||s.date>lastVisit[s.customerId]))lastVisit[s.customerId]=s.date});
    let excludedOptOut=0,excludedNoMobile=0;
    let rows=(data.customers||[]).filter(c=>c.active!==false&&(+c.minutesLeft||0)>10&&!texted.has(c.id)&&!(lastVisit[c.id]&&lastVisit[c.id]>=cutoff))
      .filter(c=>{if(c.agreedSms===false){excludedOptOut++;return false}if(!isValidUkMobile(c.phone)){excludedNoMobile++;return false}return true})
      .map(c=>({c,visit:lastVisit[c.id]||null,text:lastText[c.id]||null}))
      .sort((a,b)=>(+b.c.minutesLeft)-(+a.c.minutesLeft));
    lastSmsOpportunityExport=rows;
    let extra=[excludedOptOut?`${excludedOptOut} left out (opted out of SMS)`:'',excludedNoMobile?`${excludedNoMobile} left out (no valid mobile number)`:''].filter(Boolean).join(', ');
    document.getElementById('smsOppSubtitle').textContent=`${rows.length} customer${rows.length===1?'':'s'} can be texted now: more than 10 mins on account, no visit and no text in the last ${LIST_WINDOW_DAYS} days.${extra?` (${extra})`:''} Click a name to open the account and send the text.`;
    table.innerHTML='<tr><th>Account</th><th>Customer</th><th>Mobile</th><th>Mins on Account</th><th>Last Visit</th><th>Last Text</th></tr>'+
      (rows.length?rows.map(r=>`<tr class='clinicRow' onclick="openCustomerFromList('smsOppModal','${r.c.id}')"><td>${escapeHtml(r.c.accountNumber||'')}</td>${customerLinkCell('smsOppModal',r.c)}<td>${escapeHtml(r.c.phone||'')}</td><td><b>${r.c.minutesLeft}</b></td><td>${r.visit?listDate(r.visit+'T12:00:00'):'<span class="muted">Never</span>'}</td><td>${r.text?listDate(r.text):'<span class="muted">Never</span>'}</td></tr>`).join(''):`<tr><td colspan='6' class='muted' style='text-align:center;padding:24px'>Nobody matches right now.</td></tr>`);
  }catch(e){
    table.innerHTML='';err.textContent=e.message||'Could not load this list.';err.style.display='block';
  }
}
function exportSmsOpportunityToExcel(){
  if(!lastSmsOpportunityExport||!lastSmsOpportunityExport.length){alert('Nobody to export.');return}
  let ws=XLSX.utils.json_to_sheet(lastSmsOpportunityExport.map(r=>({'Account':r.c.accountNumber||'','Customer':`${r.c.firstName} ${r.c.lastName}`,'Mobile':r.c.phone||'','Mins on Account':r.c.minutesLeft,'Last Visit':r.visit?listDate(r.visit+'T12:00:00'):'Never','Last Text':r.text?listDate(r.text):'Never'}))),wb=XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb,ws,'Opportunity to SMS');XLSX.writeFile(wb,`REVIBE SMS Opportunities ${localDateKey()}.xlsx`);
}
