// Cash Account (Admin): live balances for the till and the safe, and every cash movement.
// Cash taken (purchases, pay-as-you-go sessions) and cash orders are recorded by the database automatically.
// Staff add the rest here: moves between till and safe, safe withdrawals, cash refunds and adjustments.
const CASH_FLOAT=100;
const CASH_KIND_LABELS={opening_balance:'Opening balance',purchase:'Cash taken - purchase',session:'Cash taken - session',order:'Order paid in cash',refund:'Cash refund',move_to_safe:'Till to safe',move_to_till:'Safe to till',safe_withdrawal:'Safe withdrawal',adjustment:'Adjustment',correction:'Correction'};
const CASH_WITHDRAW_REASONS=['Banked','Paid for an order / supplier','Wages','Other (explain in the note)'];
let cashLedger=[],cashBalances={till:{set:false,balance:null},safe:{set:false,balance:null}},cashMode=null,cashSaving=false,cashShowAll=false;

function cashMoney(n){let v=Math.abs(+n||0);return '£'+v.toFixed(2)}
function cashSigned(n){let v=+n||0;return (v<0?'-':'+')+'£'+Math.abs(v).toFixed(2)}
function cashWhen(v){return v?new Date(v).toLocaleString('en-GB',{day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}):''}
function cashCanEdit(){return typeof hasRolePermission==='function'?hasRolePermission('cash_account','edit'):true}

async function renderCashAccount(){
  let err=document.getElementById('cashAccountError');err.style.display='none';
  try{
    let [bal,led]=await Promise.all([sb.rpc('cash_balances'),sb.rpc('cash_ledger',{p_limit:cashShowAll?5000:400})]);
    if(bal.error)throw bal.error;if(led.error)throw led.error;
    cashBalances={till:{set:false,balance:null},safe:{set:false,balance:null}};
    (bal.data||[]).forEach(b=>{cashBalances[b.location]={set:!!b.opening_set,balance:b.balance===null?null:+b.balance,since:b.since}});
    cashLedger=led.data||[];
    drawCashAccount();
  }catch(e){err.textContent=e.message||'Could not load the Cash Account.';err.style.display='block'}
}
function drawCashAccount(){
  let t=cashBalances.till,s=cashBalances.safe,set=t.set&&s.set,edit=cashCanEdit();
  let tillTxt=set?cashMoney(t.balance):'Not set',safeTxt=set?cashMoney(s.balance):'Not set',totalTxt=set?cashMoney(t.balance+s.balance):'Not set';
  let floatHtml='';
  if(set){
    let diff=Math.round((t.balance-CASH_FLOAT)*100)/100;
    floatHtml=diff===0?`<div class='kpiSub' style='color:var(--green)'>On the ${cashMoney(CASH_FLOAT)} float</div>`
      :diff>0?`<div class='kpiSub' style='color:var(--amber)'>${cashMoney(diff)} over the ${cashMoney(CASH_FLOAT)} float - move ${cashMoney(diff)} to the safe</div>`
      :`<div class='kpiSub' style='color:#ff7777'>${cashMoney(-diff)} short of the ${cashMoney(CASH_FLOAT)} float - move ${cashMoney(-diff)} from the safe</div>`;
  }
  document.getElementById('cashBalances').innerHTML=
    `<div class='metric'><div class='label'>Till</div><div class='value' id='cashTillValue'>${tillTxt}</div>${floatHtml}</div>
     <div class='metric'><div class='label'>Safe</div><div class='value' id='cashSafeValue'>${safeTxt}</div></div>
     <div class='metric'><div class='label'>Total cash</div><div class='value'>${totalTxt}</div></div>`;
  let btn=(label,mode,cls='')=>`<button class='${cls}' onclick="openCashAction('${mode}')">${label}</button>`;
  document.getElementById('cashActions').innerHTML=!edit?'':
    (set?btn('Move Till → Safe','to_safe','primary')+btn('Move Safe → Till','to_till')+btn('Withdraw from Safe','withdraw')+btn('Cash Refund','refund')+btn('Adjustment','adjust'):'')
    +((!set||currentProfile?.role==='admin')?btn(set?'Reset Opening Balances':'Set Opening Balances','opening',set?'':'primary'):'');
  document.getElementById('cashNotSetNote').style.display=set?'none':'block';
  drawCashLedger();
}
function drawCashLedger(){
  let kind=document.getElementById('cashFilterKind').value,loc=document.getElementById('cashFilterLoc').value;
  let rows=cashLedger.filter(r=>(!kind||r.kind===kind)&&(!loc||r.location===loc));
  let head="<tr><th>Date &amp; time</th><th>Account</th><th>Type</th><th>Description</th><th>Staff</th><th style='text-align:right'>Amount</th><th style='text-align:right'>Balance after</th></tr>";
  document.getElementById('cashLedgerTable').innerHTML=head+(rows.length?rows.map(r=>{
    let amt=+r.amount,isOpen=r.kind==='opening_balance',dim=r.counted?'':'opacity:.5';
    let note=r.reason?`<div class='muted' style='font-size:12px'>${escapeHtml(r.reason)}</div>`:'';
    let before=(!r.counted&&!isOpen)?`<div class='muted' style='font-size:11px'>before opening balance - not counted</div>`:(!r.counted&&isOpen?`<div class='muted' style='font-size:11px'>replaced by a later count</div>`:'');
    return `<tr style='${dim}'><td>${cashWhen(r.effective_at)}</td><td>${r.location==='till'?'Till':'Safe'}</td><td>${escapeHtml(CASH_KIND_LABELS[r.kind]||r.kind)}</td><td>${escapeHtml(r.description||'')}${note}${before}</td><td>${escapeHtml(r.staff_name||'')}</td><td style='text-align:right;font-weight:800;color:${isOpen?'#d5d7dc':amt<0?'#ff7777':'var(--green)'}'>${isOpen?cashMoney(amt):cashSigned(amt)}</td><td style='text-align:right'>${r.counted?cashMoney(r.balance_after):''}</td></tr>`}).join(''):`<tr><td colspan='7' class='muted'>No cash movements yet.</td></tr>`);
  let more=document.getElementById('cashShowMore');
  more.style.display=(!cashShowAll&&cashLedger.length>=400)?'block':'none';
}
function cashShowAllRows(){cashShowAll=true;renderCashAccount()}

// ----- actions -----
function openCashAction(mode){
  if(!cashCanEdit())return alert('Your role does not have permission to change the Cash Account.');
  cashMode=mode;
  let titles={to_safe:'Move cash from Till to Safe',to_till:'Move cash from Safe to Till',withdraw:'Withdraw from Safe',refund:'Cash Refund (from the till)',adjust:'Cash Adjustment',opening:'Set Opening Balances'};
  document.getElementById('cashActionTitle').textContent=titles[mode];
  let show=(id,on)=>document.getElementById(id).style.display=on?'block':'none';
  show('cashRowAmount',mode!=='opening');show('cashRowOpening',mode==='opening');show('cashRowReason',mode==='withdraw');show('cashRowCustomer',mode==='refund');show('cashRowLocation',mode==='adjust');
  document.getElementById('cashAmountLabel').textContent=mode==='adjust'?'Amount (use a minus for cash taken out)':'Amount (£)';
  document.getElementById('cashNoteLabel').textContent=mode==='adjust'?'Reason (required)':mode==='withdraw'?'Note (required if the reason is Other)':'Note (optional)';
  ['cashAmount','cashNote','cashCustomerText','cashOpenTill','cashOpenSafe'].forEach(id=>document.getElementById(id).value='');
  document.getElementById('cashReason').innerHTML=CASH_WITHDRAW_REASONS.map(r=>`<option>${r}</option>`).join('');
  document.getElementById('cashCustomerList').innerHTML=(data.customers||[]).filter(c=>c.active!==false).map(c=>`<option value="${escapeHtml(c.firstName+' '+c.lastName)} (${escapeHtml(c.accountNumber||'')})"></option>`).join('');
  let d=new Date();d.setMinutes(d.getMinutes()-d.getTimezoneOffset());document.getElementById('cashOpenAt').value=d.toISOString().slice(0,16);
  document.getElementById('cashActionHint').textContent=mode==='opening'?'Count the cash in the till and in the safe and enter them here. Everything before this count is ignored; from now on the balances keep themselves up to date.':mode==='refund'?'Money for a customer refund comes out of the till. If the till is short, move cash from the safe first.':'';
  document.getElementById('cashActionError').style.display='none';
  let b=document.getElementById('cashActionSave');b.disabled=false;b.textContent=mode==='opening'?'Save Opening Balances':'Confirm';
  document.getElementById('cashActionModal').classList.add('show');
}
function closeCashAction(){document.getElementById('cashActionModal').classList.remove('show');cashMode=null}
async function saveCashAction(){
  if(cashSaving)return;
  let err=document.getElementById('cashActionError'),btn=document.getElementById('cashActionSave');
  err.style.display='none';
  let amount=document.getElementById('cashAmount').value,note=document.getElementById('cashNote').value.trim(),res;
  let num=v=>v===''||v===null?NaN:+v;
  let fail=m=>{err.textContent=m;err.style.display='block'};
  let call;
  if(cashMode==='opening'){
    let t=num(document.getElementById('cashOpenTill').value),s=num(document.getElementById('cashOpenSafe').value),at=document.getElementById('cashOpenAt').value;
    if(!Number.isFinite(t)||!Number.isFinite(s)||t<0||s<0)return fail('Please enter the amount counted in the till and in the safe (0 or more).');
    if(!at)return fail('Please enter when the count was done.');
    if(!confirm(`Save opening balances: Till ${cashMoney(t)}, Safe ${cashMoney(s)}?`))return;
    call=()=>sb.rpc('cash_set_opening',{p_till:t,p_safe:s,p_counted_at:new Date(at).toISOString()});
  }else{
    let a=num(amount);
    if(!Number.isFinite(a)||(cashMode==='adjust'?a===0:a<=0))return fail('Please enter an amount'+(cashMode==='adjust'?' (not zero).':' greater than 0.'));
    if(cashMode==='to_safe'||cashMode==='to_till'){
      let from=cashMode==='to_safe'?'till':'safe';
      call=()=>sb.rpc('cash_move',{p_from:from,p_amount:a,p_note:note||null});
    }else if(cashMode==='withdraw'){
      let reason=document.getElementById('cashReason').value;
      if(reason.startsWith('Other')&&!note)return fail('Please explain the withdrawal in the note.');
      call=()=>sb.rpc('cash_safe_withdraw',{p_amount:a,p_reason:reason,p_note:note||null});
    }else if(cashMode==='refund'){
      let txt=document.getElementById('cashCustomerText').value.trim(),c=txt?(data.customers||[]).find(x=>`${x.firstName} ${x.lastName} (${x.accountNumber||''})`===txt):null;
      if(txt&&!c)return fail('Please pick the customer from the list, or clear that box.');
      call=()=>sb.rpc('cash_refund',{p_amount:a,p_customer:c?c.id:null,p_note:note||null});
    }else if(cashMode==='adjust'){
      if(!note)return fail('Please give a reason for the adjustment.');
      call=()=>sb.rpc('cash_adjust',{p_location:document.getElementById('cashLocation').value,p_amount:a,p_reason:note});
    }else return;
  }
  cashSaving=true;btn.disabled=true;btn.textContent='Saving...';
  try{
    res=await call();
    if(res.error)throw res.error;
    closeCashAction();
    await renderCashAccount();
  }catch(e){fail(e.message||'Could not save.');btn.disabled=false;btn.textContent=cashMode==='opening'?'Save Opening Balances':'Confirm'}
  finally{cashSaving=false}
}
