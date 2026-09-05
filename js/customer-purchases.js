let customerPurchasesMonthDate=new Date();

function navigateCustomerPurchasesMonth(delta){
  customerPurchasesMonthDate.setMonth(customerPurchasesMonthDate.getMonth()+delta);
  renderCustomerPurchases();
}
function resetCustomerPurchasesMonthToCurrent(){
  customerPurchasesMonthDate=new Date();
  renderCustomerPurchases();
}

function renderCustomerPurchases(){
  let table=document.getElementById('customerPurchasesTable');if(!table)return;
  let y=customerPurchasesMonthDate.getFullYear(),m=customerPurchasesMonthDate.getMonth();
  document.getElementById('customerPurchasesMonthLabel').textContent=customerPurchasesMonthDate.toLocaleDateString('en-GB',{month:'long',year:'numeric'});

  let rows=(data.customerPurchases||[])
    .filter(p=>{let d=parseLocalDateKey(p.date);return d.getFullYear()===y&&d.getMonth()===m;})
    .sort((a,b)=>b.date.localeCompare(a.date)||b.createdAt.localeCompare(a.createdAt));

  let monthTreatments=rows.reduce((s,p)=>s+p.treatmentsTotal,0),
      monthGlowStudio=rows.reduce((s,p)=>s+p.glowStudioTotal,0),
      monthGrand=rows.reduce((s,p)=>s+p.grandTotal,0);
  document.getElementById('customerPurchasesMonthTreatments').textContent=`£${monthTreatments.toFixed(2)}`;
  document.getElementById('customerPurchasesMonthGlowStudio').textContent=`£${monthGlowStudio.toFixed(2)}`;
  document.getElementById('customerPurchasesMonthGrandTotal').textContent=`£${monthGrand.toFixed(2)}`;

  table.innerHTML='<tr><th>Date</th><th>Items</th><th>Revibe Treatments</th><th>Revibe Glow Studio</th><th>Grand Total</th></tr>'+
    (rows.length?rows.map(p=>{
      let items=(data.customerPurchaseItems||[]).filter(i=>i.purchaseId===p.id);
      let itemSummary=items.map(i=>escapeHtml(i.title)).join(', ')||'—';
      let dateLabel=parseLocalDateKey(p.date).toLocaleDateString('en-GB',{weekday:'short',day:'numeric',month:'short'});
      return `<tr><td><b>${dateLabel}</b></td><td>${itemSummary}</td><td>£${p.treatmentsTotal.toFixed(2)}</td><td>£${p.glowStudioTotal.toFixed(2)}</td><td><b>£${p.grandTotal.toFixed(2)}</b></td></tr>`;
    }).join(''):`<tr><td colspan='5' class='muted' style='text-align:center;padding:24px'>No purchases recorded for this month.</td></tr>`);
}
