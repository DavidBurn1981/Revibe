function renderOrders(){
  let current=document.getElementById('ordersThisMonthTable'),all=document.getElementById('allOrdersTable');if(!current||!all)return;
  let now=new Date(),month=now.getMonth()+1,year=now.getFullYear(),
      rows=[...(data.orders||[])].sort((a,b)=>b.date.localeCompare(a.date)),
      monthRows=rows.filter(x=>{let d=parseLocalDateKey(x.date);return d.getMonth()+1===month&&d.getFullYear()===year}),
      sunbed=monthRows.filter(x=>x.card==='Sunbed').reduce((s,x)=>s+x.amount,0),
      treatments=monthRows.filter(x=>x.card==='Treatments').reduce((s,x)=>s+x.amount,0);

  document.getElementById('ordersMonthTotals').innerHTML=`
    <div class='financeStatTile'><div class='label'>Total Orders Sunbed</div><div class='value'>£${sunbed.toFixed(2)}</div></div>
    <div class='financeStatTile'><div class='label'>Total Orders Treatments</div><div class='value'>£${treatments.toFixed(2)}</div></div>`;

  let header="<tr><th>Date</th><th>Description</th><th>Supplier</th><th>Amount</th><th>Card Used</th><th>Ordered By</th></tr>";
  let rowHtml=r=>{let staff=data.staffMembers.find(s=>s.id===r.staffId);return `<tr class='clinicRow' onclick="openOrderEdit('${r.id}')"><td>${formatSunbedDisplayDate(r.date)}</td><td><b>${escapeHtml(r.description)}</b></td><td>${escapeHtml(r.supplier||'')}</td><td>£${r.amount.toFixed(2)}</td><td>${escapeHtml(r.card)}</td><td>${escapeHtml(staff?.name||'')}</td></tr>`};

  current.innerHTML=header+(monthRows.length?monthRows.map(rowHtml).join(''):"<tr><td colspan='6' class='muted'>No orders placed this month.</td></tr>");
  all.innerHTML=header+(rows.length?rows.map(rowHtml).join(''):"<tr><td colspan='6' class='muted'>No orders logged yet.</td></tr>");
}
function openOrderCreate(){
  editingOrderId=null;
  document.getElementById('orderModalTitle').textContent='Log New Order';
  document.getElementById('orderDescription').value='';
  document.getElementById('orderSupplier').value='';
  document.getElementById('orderAmount').value='';
  document.getElementById('orderCardUsed').value='Treatments';
  let today=localDateKey();document.getElementById('orderDate').value=today;document.getElementById('orderDateDisplay').value=formatSunbedDisplayDate(today);
  document.getElementById('orderStaffMember').innerHTML=data.staffMembers.map(s=>`<option value='${s.id}'>${escapeHtml(s.name)}</option>`).join('');
  document.getElementById('orderError').style.display='none';
  document.getElementById('orderSaveBtn').textContent='Save Order';
  document.getElementById('orderDeleteBtn').style.display='none';document.getElementById('orderModal').classList.add('show');
}
function openOrderEdit(id){
  let o=data.orders.find(x=>x.id===id);if(!o)return;editingOrderId=id;
  document.getElementById('orderModalTitle').textContent='Edit Order';
  document.getElementById('orderDescription').value=o.description;
  document.getElementById('orderSupplier').value=o.supplier||'';
  document.getElementById('orderAmount').value=o.amount.toFixed(2);
  document.getElementById('orderCardUsed').value=o.card;
  document.getElementById('orderDate').value=o.date;document.getElementById('orderDateDisplay').value=formatSunbedDisplayDate(o.date);
  document.getElementById('orderStaffMember').innerHTML=data.staffMembers.map(s=>`<option value='${s.id}'>${escapeHtml(s.name)}</option>`).join('');
  document.getElementById('orderStaffMember').value=o.staffId;
  document.getElementById('orderError').style.display='none';
  document.getElementById('orderSaveBtn').textContent='Save Changes';
  document.getElementById('orderModal').classList.add('show');
}
async function deleteOrder(){if(!editingOrderId)return alert('Save the order first.');if(!confirm('Delete this order?'))return;let {error}=await sb.from('orders').delete().eq('id',editingOrderId);if(error)return alert(error.message);closeOrderModal();await loadLiveData();renderFinance();renderOrders()}
function closeOrderModal(){document.getElementById('orderModal').classList.remove('show');editingOrderId=null}
async function saveOrder(){
  let description=document.getElementById('orderDescription').value.trim(),
      date=document.getElementById('orderDate').value,
      supplier=document.getElementById('orderSupplier').value.trim(),
      amount=+document.getElementById('orderAmount').value,
      card=document.getElementById('orderCardUsed').value,
      staffId=document.getElementById('orderStaffMember').value,
      err=document.getElementById('orderError'),btn=document.getElementById('orderSaveBtn');

  err.style.display='none';
  if(!description||!date||!staffId||!Number.isFinite(amount)||amount<0){err.textContent='Please complete all required order details.';err.style.display='block';return;}

  btn.disabled=true;btn.textContent=editingOrderId?'Saving...':'Saving Order...';
  try{
    let error;
    if(editingOrderId)({error}=await sb.from('orders').update({description,order_date:date,supplier:supplier||null,amount,card_used:card,ordered_by_staff_member_id:staffId,updated_at:new Date().toISOString()}).eq('id',editingOrderId));
    else ({error}=await sb.from('orders').insert({description,order_date:date,supplier:supplier||null,amount,card_used:card,ordered_by_staff_member_id:staffId}));
    if(error)throw error;
    closeOrderModal();await loadLiveData();renderFinance();renderOrders();
  }catch(e){err.textContent=e.message||'Could not save order.';err.style.display='block'}
  finally{btn.disabled=false;btn.textContent='Save Order'}
}
