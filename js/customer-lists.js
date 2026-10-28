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
    .map(c=>({c,type:c.subscriptionType==='7_Day_Pass'?'1 Week Pass':c.subscriptionType==='Monthly'?'Monthly':'Unknown',issue:c.subscriptionStatus==='Subscriber - Failed Payment',cancelling:!!c.subscriptionCancelling&&c.subscriptionType!=='7_Day_Pass'}))
    .sort((a,b)=>a.type.localeCompare(b.type)||`${a.c.firstName} ${a.c.lastName}`.localeCompare(`${b.c.firstName} ${b.c.lastName}`));
  lastActiveSubsExport=rows;
  let monthly=rows.filter(r=>r.type==='Monthly').length,passes=rows.filter(r=>r.type==='1 Week Pass').length,issues=rows.filter(r=>r.issue).length;
  document.getElementById('activeSubsSubtitle').textContent=`${rows.length} active subscription${rows.length===1?'':'s'} - ${monthly} Monthly, ${passes} 1 Week Pass${issues?`, ${issues} with a payment issue`:''}`;
  document.getElementById('activeSubsTable').innerHTML='<tr><th>Account</th><th>Customer</th><th>Type</th><th>Status</th><th>Expires / Renews</th><th>Mobile</th></tr>'+
    (rows.length?rows.map(r=>`<tr class='clinicRow' onclick="openCustomerFromList('activeSubsModal','${r.c.id}')"><td>${escapeHtml(r.c.accountNumber||'')}</td>${customerLinkCell('activeSubsModal',r.c)}<td>${r.type}</td><td>${r.issue?`<span style='color:var(--amber);font-weight:700'>Payment issue</span>`:r.cancelling?`<span style='color:var(--amber);font-weight:700'>Cancelling</span>`:`<span style='color:var(--green);font-weight:700'>Active</span>`}</td><td>${r.cancelling&&r.c.subscriptionPeriodEnd?'Ends '+listDate(r.c.subscriptionPeriodEnd):r.c.subscriptionExpiresAt?listDate(r.c.subscriptionExpiresAt):'<span class="muted">—</span>'}</td><td>${escapeHtml(r.c.phone||'')}</td></tr>`).join(''):`<tr><td colspan='6' class='muted' style='text-align:center;padding:24px'>There are no active subscriptions.</td></tr>`);
  document.getElementById('activeSubsModal').classList.add('show');
}
function exportActiveSubsToExcel(){
  if(!lastActiveSubsExport||!lastActiveSubsExport.length){alert('No active subscriptions to export.');return}
  let ws=XLSX.utils.json_to_sheet(lastActiveSubsExport.map(r=>({'Account':r.c.accountNumber||'','Customer':`${r.c.firstName} ${r.c.lastName}`,'Type':r.type,'Status':r.issue?'Payment issue':r.cancelling?'Cancelling':'Active','Expires / Renews':r.cancelling&&r.c.subscriptionPeriodEnd?'Ends '+listDate(r.c.subscriptionPeriodEnd):r.c.subscriptionExpiresAt?listDate(r.c.subscriptionExpiresAt):'','Mobile':r.c.phone||''}))),wb=XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb,ws,'Active Subscriptions');XLSX.writeFile(wb,`REVIBE Active Subscriptions ${localDateKey()}.xlsx`);
}

// ---------- High Session Users ----------
// Customers with more than 6 sessions in the last 7 days (today + previous 6), or 10 or more in the last 12 days.
let lastHighUsersExport=null;
function openHighSessionUsers(){
  try{openHighSessionUsersInner()}catch(e){console.error(e);alert('High Session Users could not open: '+(e&&e.message||e))}
}
function openHighSessionUsersInner(){
  let back=n=>localDateKey(new Date(Date.now()-n*86400000));
  let from7=back(6),from12=back(11),from14=back(13);
  let agg={};
  (data.bedSessions||[]).forEach(x=>{
    if(!x.customerId||!x.date||x.date<from14)return;
    let a=agg[x.customerId]||(agg[x.customerId]={s7:0,s12:0,s14:0,min14:0});
    a.s14++;a.min14+=(+x.length||0);
    if(x.date>=from12)a.s12++;
    if(x.date>=from7)a.s7++;
  });
  let rows=(data.customers||[]).filter(c=>agg[c.id]&&(agg[c.id].s7>6||agg[c.id].s12>=10)).map(c=>({c,...agg[c.id]}))
    .sort((a,b)=>b.s7-a.s7||b.s14-a.s14||`${a.c.firstName} ${a.c.lastName}`.localeCompare(`${b.c.firstName} ${b.c.lastName}`));
  lastHighUsersExport=rows;
  document.getElementById('highUsersSubtitle').textContent=`${rows.length} customer${rows.length===1?'':'s'} with more than 6 sessions in the last 7 days, or 10 or more in the last 12 days`;
  document.getElementById('highUsersTable').innerHTML='<tr><th>Account</th><th>Customer</th><th>Skin Type</th><th>Sessions (last 7 days)</th><th>Sessions (last 14 days)</th><th>Total Minutes (last 14 days)</th></tr>'+
    (rows.length?rows.map(r=>`<tr class='clinicRow' onclick="openCustomerFromList('highUsersModal','${r.c.id}')"><td>${escapeHtml(r.c.accountNumber||'')}</td>${customerLinkCell('highUsersModal',r.c)}<td>${r.c.skinType?'Type '+escapeHtml(String(r.c.skinType)):'<span class="muted">Not set</span>'}</td><td>${r.s7}</td><td>${r.s14}</td><td>${r.min14}</td></tr>`).join(''):`<tr><td colspan='6' class='muted'>No customers meet this at the moment.</td></tr>`);
  document.getElementById('highUsersModal').classList.add('show');
}
function exportHighUsersToExcel(){
  if(!lastHighUsersExport||!lastHighUsersExport.length){alert('No customers to export.');return}
  let ws=XLSX.utils.json_to_sheet(lastHighUsersExport.map(r=>({'Account':r.c.accountNumber||'','Customer':`${r.c.firstName} ${r.c.lastName}`,'Skin Type':r.c.skinType?'Type '+r.c.skinType:'Not set','Sessions (last 7 days)':r.s7,'Sessions (last 14 days)':r.s14,'Total Minutes (last 14 days)':r.min14}))),wb=XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb,ws,'High Session Users');XLSX.writeFile(wb,`REVIBE High Session Users ${localDateKey()}.xlsx`);
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
    let {data:logs,error}=await sb.from('sms_log').select('customer_id,created_at').in('kind',['minutes_balance','marketing','custom']).eq('status','sent').gte('created_at',since).limit(5000);
    if(error)throw error;
    let texted=new Set((logs||[]).map(l=>l.customer_id));
    let lastText={};
    {let {data:allLogs}=await sb.from('sms_log').select('customer_id,created_at').in('kind',['minutes_balance','marketing','custom']).eq('status','sent').order('created_at',{ascending:false}).limit(5000);
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


// ---------- Week Pass Report ----------
// Every 1 Week Pass sold (shop and online), with the sessions and minutes the customer used inside the pass window,
// and revenue per minute = price paid / minutes used. Built by the get_week_pass_report database function.
let lastWeekPassExport=null;
function weekPassDateTime(v){if(!v)return '';let d=new Date(String(v).replace(' ','T'));return d.toLocaleDateString('en-GB',{day:'numeric',month:'short'})+' '+d.toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'})}
function gbp(n){return '£'+(+n).toFixed(2)}
async function openWeekPassReport(){
  let table=document.getElementById('weekPassTable'),err=document.getElementById('weekPassError');
  err.style.display='none';
  table.innerHTML=`<tr><td class='muted' style='text-align:center;padding:24px'>Loading...</td></tr>`;
  document.getElementById('weekPassSubtitle').textContent='';
  document.getElementById('weekPassModal').classList.add('show');
  let {data:rows,error}=await sb.rpc('get_week_pass_report');
  if(error){table.innerHTML='';err.textContent='Could not load the report: '+(error.message||'unknown error');err.style.display='block';return}
  rows=rows||[];
  lastWeekPassExport=rows;
  let fin=rows.filter(r=>!r.is_active),sum=(a,k)=>a.reduce((s,r)=>s+(+r[k]||0),0);
  let finPaid=sum(fin,'price_paid'),finMins=sum(fin,'minutes_used');
  document.getElementById('weekPassSubtitle').textContent=`${rows.length} passes sold (${rows.length-fin.length} still running). Finished passes: ${fin.length?`${gbp(finPaid)} taken for ${finMins} minutes = ${finMins?gbp(finPaid/finMins):'—'} per minute on average.`:'none yet.'} Passes still running are still using minutes, so their £ per minute will fall.`;
  let tot={paid:sum(rows,'price_paid'),sess:sum(rows,'sessions'),mins:sum(rows,'minutes_used')};
  table.innerHTML=`<tr><th>Customer</th><th>Account</th><th>Sold</th><th>Pass Start</th><th>Pass End</th><th>Status</th><th>Price Paid</th><th>Sessions</th><th>Minutes Used</th><th>£ per Minute</th></tr>`+
    (rows.length?rows.map(r=>`<tr class='clinicRow' onclick="openCustomerFromList('weekPassModal','${r.customer_id}')"><td><a href='javascript:void(0)' style='color:var(--pink);text-decoration:underline'>${escapeHtml(r.customer_name||'')}</a></td><td>${escapeHtml(r.account_number||'')}</td><td>${escapeHtml(r.source)}</td><td>${weekPassDateTime(r.pass_start)}</td><td>${weekPassDateTime(r.pass_end)}</td><td>${r.is_active?`<span style='color:var(--green);font-weight:700'>Running</span>`:`<span class="muted">Finished</span>`}</td><td>${gbp(r.price_paid)}</td><td>${r.sessions}</td><td>${r.minutes_used}</td><td><b>${r.revenue_per_minute===null?'—':gbp(r.revenue_per_minute)}</b></td></tr>`).join('')
      +`<tr style='font-weight:800'><td colspan='6'>Total (all passes)</td><td>${gbp(tot.paid)}</td><td>${tot.sess}</td><td>${tot.mins}</td><td>${tot.mins?gbp(tot.paid/tot.mins):'—'}</td></tr>`
     :`<tr><td colspan='10' class='muted' style='text-align:center;padding:24px'>No week passes have been sold yet.</td></tr>`);
}
function exportWeekPassToExcel(){
  if(!lastWeekPassExport||!lastWeekPassExport.length){alert('No week passes to export.');return}
  let ws=XLSX.utils.json_to_sheet(lastWeekPassExport.map(r=>({'Customer':r.customer_name,'Account':r.account_number||'','Sold':r.source,'Pass Start':weekPassDateTime(r.pass_start),'Pass End':weekPassDateTime(r.pass_end),'Status':r.is_active?'Running':'Finished','Price Paid':+r.price_paid,'Sessions':r.sessions,'Minutes Used':r.minutes_used,'£ per Minute':r.revenue_per_minute===null?'':+r.revenue_per_minute}))),wb=XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb,ws,'Week Passes');XLSX.writeFile(wb,`REVIBE Week Pass Report ${localDateKey()}.xlsx`);
}


// ---------- SMS Success ----------
// Every text sent from the account screen (Minutes Reminder or Marketing), and the first session the customer had after it.
let lastSmsSuccessExport=null;
function smsUkStamp(iso){
  // 'YYYY-MM-DD HH:MM' in UK time, comparable with session date + time
  let p=Object.fromEntries(new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/London',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date(iso)).map(x=>[x.type,x.value]));
  return `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}`;
}
function smsKindLabel(k){return k==='marketing'?'Marketing':k==='custom'?'Own Message':'Mins Reminder'}
async function openSmsSuccess(){
  let table=document.getElementById('smsSuccessTable'),err=document.getElementById('smsSuccessError');
  err.style.display='none';
  table.innerHTML=`<tr><td class='muted' style='text-align:center;padding:24px'>Loading...</td></tr>`;
  document.getElementById('smsSuccessSubtitle').textContent='';
  document.getElementById('smsSuccessModal').classList.add('show');
  let {data:logs,error}=await loadAllRows('sms_log','customer_id,kind,status,created_at',[['created_at',false]]);
  if(error){table.innerHTML='';err.textContent='Could not load the text history: '+(error.message||'unknown error');err.style.display='block';return}
  logs=(logs||[]).filter(l=>l.status==='sent'&&['minutes_balance','marketing','custom'].includes(l.kind));
  let sessionsBy={};
  (data.bedSessions||[]).forEach(s=>{if(s.customerId&&s.date)(sessionsBy[s.customerId]=sessionsBy[s.customerId]||[]).push({stamp:`${s.date} ${s.time||'00:00'}`,date:s.date})});
  Object.values(sessionsBy).forEach(a=>a.sort((x,y)=>x.stamp.localeCompare(y.stamp)));
  let dn=k=>{let [y,m,d]=k.split('-').map(Number);return Math.round(Date.UTC(y,m-1,d)/86400000)};
  let rows=logs.map(l=>{
    let c=(data.customers||[]).find(x=>x.id===l.customer_id),st=smsUkStamp(l.created_at);
    let next=(sessionsBy[l.customer_id]||[]).find(s=>s.stamp>st);
    return {c,kind:l.kind,sent:l.created_at,sentDate:st.slice(0,10),session:next?next.date:null,days:next?dn(next.date)-dn(st.slice(0,10)):null};
  }).filter(r=>r.c);
  lastSmsSuccessExport=rows;
  let stat=k=>{let a=rows.filter(r=>r.kind===k),b=a.filter(r=>r.session);return `${a.length} ${smsKindLabel(k)} (${b.length} came in${a.length?`, ${Math.round(100*b.length/a.length)}%`:''})`};
  document.getElementById('smsSuccessSubtitle').textContent=`${rows.length} texts sent: ${stat('minutes_balance')}; ${stat('marketing')}; ${stat('custom')}. "Session After Text" is the customer's first session after the text was sent; blank means they haven't been in since.`;
  table.innerHTML=`<tr><th>Customer</th><th>Account</th><th>SMS Sent</th><th>Date Sent</th><th>Session After Text</th><th>Days Later</th></tr>`+
    (rows.length?rows.map(r=>`<tr class='clinicRow' onclick="openCustomerFromList('smsSuccessModal','${r.c.id}')"><td><a href='javascript:void(0)' style='color:var(--pink);text-decoration:underline'>${escapeHtml(r.c.firstName)} ${escapeHtml(r.c.lastName)}</a></td><td>${escapeHtml(r.c.accountNumber||'')}</td><td>${smsKindLabel(r.kind)}</td><td>${listDate(r.sent)}</td><td>${r.session?`<b style='color:var(--green)'>${listDate(r.session+'T12:00:00')}</b>`:''}</td><td>${r.days===null?'':(r.days===0?'Same day':r.days+' day'+(r.days===1?'':'s'))}</td></tr>`).join('')
     :`<tr><td colspan='6' class='muted' style='text-align:center;padding:24px'>No texts have been sent yet.</td></tr>`);
}
function exportSmsSuccessToExcel(){
  if(!lastSmsSuccessExport||!lastSmsSuccessExport.length){alert('No texts to export.');return}
  let ws=XLSX.utils.json_to_sheet(lastSmsSuccessExport.map(r=>({'Customer':`${r.c.firstName} ${r.c.lastName}`,'Account':r.c.accountNumber||'','SMS Sent':smsKindLabel(r.kind),'Date Sent':listDate(r.sent),'Session After Text':r.session?listDate(r.session+'T12:00:00'):'','Days Later':r.days===null?'':r.days}))),wb=XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb,ws,'SMS Success');XLSX.writeFile(wb,`REVIBE SMS Success ${localDateKey()}.xlsx`);
}


// ---------- Purchase thank-you text ----------
// Sent when minutes, a week pass or a monthly pass is bought. The server skips opted-out customers and customers
// without a valid UK mobile, and these texts ignore the 14-day limit. Runs quietly in the background: staff see
// nothing, and a problem here can never get in the way of the purchase itself.
function sendPurchaseText(customerId,productNames){
  try{
    let names=(productNames||[]).filter(Boolean);
    if(!customerId||!names.length)return;
    Promise.resolve(sb.functions.invoke('send-minutes-sms',{body:{customer_id:customerId,kind:'purchase',product_name:names.join(' & ')}})).catch(e=>console.error('Purchase text failed:',e));
  }catch(e){console.error('Purchase text failed:',e)}
}
