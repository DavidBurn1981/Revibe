function populateFinanceSelectors(){
  let monthSel=document.getElementById('financeMonthSelect'),yearSel=document.getElementById('financeYearSelect');
  if(!monthSel||!yearSel)return;
  monthSel.innerHTML=MONTH_NAMES.map((m,i)=>`<option value='${i+1}'>${m}</option>`).join('');
  let nowYear=new Date().getFullYear(),years=[];
  for(let y=nowYear-5;y<=nowYear+1;y++)years.push(y);
  yearSel.innerHTML=years.map(y=>`<option value='${y}'>${y}</option>`).join('');
  monthSel.value=String(financeMonth);
  yearSel.value=String(financeYear);
}
function changeFinancePeriod(){
  financeMonth=+document.getElementById('financeMonthSelect').value;
  financeYear=+document.getElementById('financeYearSelect').value;
  renderFinance();
}
function financeMonthKeys(month,year){
  let start=new Date(year,month-1,1),end=new Date(year,month,0);
  return dateRangeKeys(start,end);
}
function financePhysicalBedMinutes(month,year){
  return (data.bedSessions||[]).filter(x=>{
    let d=parseLocalDateKey(x.date);
    return d.getMonth()+1===month&&d.getFullYear()===year;
  }).reduce((s,x)=>s+(+x.length||0),0);
}
function financeElectricCost(month,year){
  let minutes=financePhysicalBedMinutes(month,year);
  return {minutes,cost:minutes*0.07*1.15};
}
function currentFinanceOutgoings(){
  return (data.financeOutgoings||[]).find(x=>x.month===financeMonth&&x.year===financeYear)||null;
}
function renderFinance(){
  let host=document.getElementById('financeRevenueSummary');if(!host)return;
  populateFinanceSelectors();

  let keys=financeMonthKeys(financeMonth,financeYear),
      rev=periodRevenue(keys),
      monthName=MONTH_NAMES[financeMonth-1];

  document.getElementById('financeMonthLabel').textContent=`${monthName} ${financeYear}`;

  host.innerHTML=`
    <div class='financeRevenueTile'><div class='label'>Cash Taken</div><div class='value'>£${rev.cash.toFixed(2)}</div></div>
    <div class='financeRevenueTile'><div class='label'>Treatments Card</div><div class='value'>£${rev.treatments.toFixed(2)}</div></div>
    <div class='financeRevenueTile'><div class='label'>Bed Card</div><div class='value'>£${rev.beds.toFixed(2)}</div></div>
    <div class='financeRevenueTile'><div class='label'>Grand Total</div><div class='value'>£${rev.total.toFixed(2)}</div></div>`;

  let clinicRows=(data.clinicDays||[])
    .filter(x=>{
      let d=parseLocalDateKey(x.date);
      return d.getMonth()+1===financeMonth&&d.getFullYear()===financeYear;
    })
    .sort((a,b)=>a.date.localeCompare(b.date));

  let treatmentTotal=clinicRows.reduce((s,x)=>s+(+x.rentalCharge||0),0);
  let treatmentHost=document.getElementById('financeTreatmentIncome');
  treatmentHost.innerHTML=clinicRows.length
    ?`<div style='overflow-x:auto'><table class='table'>
      <tr><th>Date</th><th>Clinician</th><th>Treatment Type</th><th>Rent Amount</th></tr>
      ${clinicRows.map(x=>{
        let clinician=data.renters.find(r=>r.id===x.renterId);
        return `<tr><td>${formatSunbedDisplayDate(x.date)}</td><td>${clinician?.name||''}</td><td>${x.product||''}</td><td>£${(+x.rentalCharge||0).toFixed(2)}</td></tr>`;
      }).join('')}
    </table></div><div class='financeTreatmentTotal'>Total Treatment Income: £${treatmentTotal.toFixed(2)}</div>`
    :`<div class='muted'>No Clinic Days in ${monthName} ${financeYear}.</div><div class='financeTreatmentTotal'>Total Treatment Income: £0.00</div>`;

  let monthOrders=(data.orders||[]).filter(x=>{
    let d=parseLocalDateKey(x.date);
    return d.getMonth()+1===financeMonth&&d.getFullYear()===financeYear;
  }).sort((a,b)=>b.date.localeCompare(a.date));
  let orderTotal=monthOrders.reduce((s,x)=>s+(+x.amount||0),0);
  document.getElementById('financeOrdersSubtitle').textContent=`${monthName} ${financeYear}`;
  document.getElementById('financeOrdersSummary').innerHTML=
    `<div class='financeOrdersTotal'>Total Orders: £${orderTotal.toFixed(2)}</div>`+
    (monthOrders.length
      ?`<div style='overflow-x:auto'><table class='table'><tr><th>Date</th><th>Description</th><th>Supplier</th><th>Amount</th><th>Card Used</th></tr>${monthOrders.map(x=>`<tr class='clinicRow' onclick="openOrderEdit('${x.id}')"><td>${formatSunbedDisplayDate(x.date)}</td><td>${x.description}</td><td>${x.supplier||''}</td><td>£${(+x.amount||0).toFixed(2)}</td><td>${x.card}</td></tr>`).join('')}</table></div>`
      :`<div class='muted'>No orders recorded for this month.</div>`);

  let saved=currentFinanceOutgoings(),
      electric=financeElectricCost(financeMonth,financeYear),
      wages=saved?.wages,
      rent=saved?.rent??900,
      bedHire=saved?.bedHire??1000,
      insurance=saved?.insurance??100;

  document.getElementById('financeWages').value=wages==null?'':Number(wages).toFixed(2);
  document.getElementById('financeRent').value=Number(rent).toFixed(2);
  document.getElementById('financeBedHire').value=Number(bedHire).toFixed(2);
  document.getElementById('financeInsurance').value=Number(insurance).toFixed(2);
  document.getElementById('financeElectric').value=electric.cost.toFixed(2);
  document.getElementById('financeElectricDetail').textContent=`${electric.minutes} physical bed minutes × £0.07 × 1.15 = £${electric.cost.toFixed(2)}`;
  let canEditFinance=hasRolePermission('finance','edit');
  ['financeWages','financeRent','financeBedHire','financeInsurance'].forEach(id=>{let el=document.getElementById(id);if(el)el.readOnly=!canEditFinance;});
  let saveFinanceBtn=document.querySelector("button[onclick='saveFinanceOutgoings()']");if(saveFinanceBtn)saveFinanceBtn.style.display=canEditFinance?'':'none';

  updateFinanceOutgoingsTotal();
}
function updateFinanceOutgoingsTotal(){
  let wages=+document.getElementById('financeWages')?.value||0,
      rent=+document.getElementById('financeRent')?.value||0,
      bedHire=+document.getElementById('financeBedHire')?.value||0,
      electric=+document.getElementById('financeElectric')?.value||0,
      insurance=+document.getElementById('financeInsurance')?.value||0;
  document.getElementById('financeOutgoingsTotal').value=(wages+rent+bedHire+electric+insurance).toFixed(2);
}
async function saveFinanceOutgoings(){
  if(!requireRolePermission('finance','edit'))return;
  let wagesRaw=document.getElementById('financeWages').value.trim(),
      rent=+document.getElementById('financeRent').value,
      bedHire=+document.getElementById('financeBedHire').value,
      insurance=+document.getElementById('financeInsurance').value,
      err=document.getElementById('financeOutgoingsError');
  err.style.display='none';

  let wages=wagesRaw===''?null:+wagesRaw;
  if((wages!==null&&(!Number.isFinite(wages)||wages<0))||[rent,bedHire,insurance].some(x=>!Number.isFinite(x)||x<0)){
    err.textContent='Please enter valid outgoing amounts.';
    err.style.display='block';
    return;
  }

  let {error}=await sb.from('finance_outgoings').upsert({
    finance_month:financeMonth,
    finance_year:financeYear,
    wages,
    rent,
    bed_hire:bedHire,
    insurance,
    updated_at:new Date().toISOString()
  },{onConflict:'finance_year,finance_month'});

  if(error){
    err.textContent=error.message;
    err.style.display='block';
    return;
  }

  await loadLiveData();
  renderFinance();
  alert('Outgoings saved.');
}
