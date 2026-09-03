function renderMyTreatmentType(){
  let table=document.getElementById('myTreatmentTable');if(!table)return;

  let renter=currentClinicianRenter();
  let productId=renter?.productId||null;
  let product=productId?data.products.find(p=>p.id===productId):null;

  document.getElementById('myTreatmentTypeTitle').textContent=product?product.name:'My Treatment Type';

  let addBtn=document.getElementById('myAddSessionTypeBtn');

  if(!product){
    document.getElementById('myTreatmentTypeSub').textContent='No Treatment Type is linked to your account yet — ask an Admin to link one under Users.';
    if(addBtn)addBtn.style.display='none';
    table.innerHTML='';
    document.getElementById('myGroupingList').innerHTML='';
    return;
  }

  if(addBtn)addBtn.style.display='inline-block';
  currentProduct=productId;

  let rows=(data.treatments||[]).filter(t=>t.productId===productId);
  document.getElementById('myTreatmentTypeSub').textContent=`${rows.length} session type${rows.length===1?'':'s'} configured`;

  let groupName=id=>data.treatmentGroupings.find(g=>g.id===id)?.name||'—';
  table.innerHTML='<tr><th>Session Type</th><th>Grouping</th><th>Duration</th><th>Buffer</th><th>Price</th><th>Status</th></tr>'+
    (rows.length?rows.map(x=>`<tr class='clinicRow' onclick="openTreatmentEdit('${x.id}')"><td><b>${escapeHtml(x.name)}</b></td><td>${escapeHtml(groupName(x.groupingId))}</td><td>${x.duration} min</td><td>${x.buffer} min</td><td>£${(+x.price||0).toFixed(2)}</td><td><span class=pill>${x.active===false?'Inactive':'Active'}</span></td></tr>`).join(''):`<tr><td colspan='6' class='muted'>No Session Types yet — add your first one above.</td></tr>`);

  renderTreatmentGroupings('myGroupingList');
}
