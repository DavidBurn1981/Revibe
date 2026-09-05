let customerPurchasesMonthDate=new Date();

function navigateCustomerPurchasesMonth(delta){
  customerPurchasesMonthDate.setMonth(customerPurchasesMonthDate.getMonth()+delta);
  renderCustomerPurchasesReport();
}
function resetCustomerPurchasesMonthToCurrent(){
  customerPurchasesMonthDate=new Date();
  renderCustomerPurchasesReport();
}

function renderCustomerPurchasesReport(){
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

  table.innerHTML='<tr><th>Date</th><th>Time</th><th>Customer</th><th>Items</th><th>Revibe Treatments</th><th>Revibe Glow Studio</th><th>Grand Total</th></tr>'+
    (rows.length?rows.map(p=>{
      let items=(data.customerPurchaseItems||[]).filter(i=>i.purchaseId===p.id);
      let itemSummary=items.map(i=>escapeHtml(i.title)).join(', ')||'—';
      let dateLabel=parseLocalDateKey(p.date).toLocaleDateString('en-GB',{weekday:'short',day:'numeric',month:'short'});
      let timeLabel=p.createdAt?new Date(p.createdAt).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'}):'—';
      let customer=p.customerId?data.customers.find(c=>c.id===p.customerId):null;
      let customerLabel=customer?`${escapeHtml(customer.firstName)} ${escapeHtml(customer.lastName)}`:'—';
      return `<tr class='clinicRow' onclick="openCustomerPurchaseDetail('${p.id}')"><td><b>${dateLabel}</b></td><td>${timeLabel}</td><td>${customerLabel}</td><td>${itemSummary}</td><td>£${p.treatmentsTotal.toFixed(2)}</td><td>£${p.glowStudioTotal.toFixed(2)}</td><td><b>£${p.grandTotal.toFixed(2)}</b></td></tr>`;
    }).join(''):`<tr><td colspan='7' class='muted' style='text-align:center;padding:24px'>No purchases recorded for this month.</td></tr>`);
}

let editingCustomerPurchaseId=null;
function openCustomerPurchaseDetail(id){
  let p=(data.customerPurchases||[]).find(x=>x.id===id);if(!p)return;
  editingCustomerPurchaseId=id;
  let items=(data.customerPurchaseItems||[]).filter(i=>i.purchaseId===id);
  let glowItems=items.filter(i=>i.cardMachine==='Sunbed Card'),treatItems=items.filter(i=>i.cardMachine==='Treatment Card');
  let renderItems=list=>list.length?list.map(i=>`<div class='purchaseItemRow'><div class='title'>${escapeHtml(i.title)}</div><div class='price'>£${i.price.toFixed(2)}</div></div>`).join(''):`<div class='purchaseListEmpty'>No items.</div>`;
  let customer=p.customerId?data.customers.find(c=>c.id===p.customerId):null;
  document.getElementById('cpDetailDate').textContent=parseLocalDateKey(p.date).toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'long',year:'numeric'})+(p.createdAt?` at ${new Date(p.createdAt).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'})}`:'')+(customer?` · ${customer.firstName} ${customer.lastName}`:'');
  document.getElementById('cpDetailGlowStudioItems').innerHTML=renderItems(glowItems);
  document.getElementById('cpDetailTreatmentsItems').innerHTML=renderItems(treatItems);
  document.getElementById('cpDetailGlowStudioTotal').textContent=`£${p.glowStudioTotal.toFixed(2)}`;
  document.getElementById('cpDetailTreatmentsTotal').textContent=`£${p.treatmentsTotal.toFixed(2)}`;
  document.getElementById('cpDetailGlowStudioCard').textContent=`£${p.glowStudioCardAmount.toFixed(2)}`;
  document.getElementById('cpDetailGlowStudioCash').textContent=`£${p.glowStudioCashAmount.toFixed(2)}`;
  document.getElementById('cpDetailTreatmentsCard').textContent=`£${p.treatmentsCardAmount.toFixed(2)}`;
  document.getElementById('cpDetailTreatmentsCash').textContent=`£${p.treatmentsCashAmount.toFixed(2)}`;
  document.getElementById('cpDetailGrandTotal').textContent=`£${p.grandTotal.toFixed(2)}`;
  let canDelete=hasRolePermission('customer_purchases','delete');
  document.getElementById('deleteCustomerPurchaseBtn').style.display=canDelete?'inline-block':'none';
  document.getElementById('customerPurchaseDetailModal').classList.add('show');
}
function closeCustomerPurchaseDetail(){document.getElementById('customerPurchaseDetailModal').classList.remove('show');editingCustomerPurchaseId=null}
async function deleteCustomerPurchase(){
  if(!editingCustomerPurchaseId)return;
  if(!confirm('Delete this Customer Purchase? This cannot be undone.'))return;
  let {error}=await sb.from('customer_purchases').delete().eq('id',editingCustomerPurchaseId);
  if(error)return alert(error.message);
  closeCustomerPurchaseDetail();
  await loadLiveData();renderCustomerPurchasesReport();
}
