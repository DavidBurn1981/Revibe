function renderProducts(){if(!data.products){let names=[...new Set(data.treatments.map(t=>t.product))];data.products=names.map((name,i)=>({id:i+1,name,active:true}))}let tiles=document.getElementById('productTiles');if(!tiles)return;tiles.innerHTML=data.products.map(p=>{let count=data.treatments.filter(t=>t.product===p.name).length;return `<div class='producttile' onclick="openProduct(\'${p.id}\')"><h3>${escapeHtml(p.name)}</h3><div class='count'>${count} Session Type${count===1?'':'s'} configured</div><div class='openhint'>Open →</div></div>`}).join('')+`<div class='producttile new' onclick='addProduct()'><div><strong>+</strong>Create new Treatment Type</div></div>`}
function renderProductDetail(){if(!currentProduct)return;let p=data.products.find(x=>x.id===currentProduct);if(!p)return;document.getElementById('productTitle').textContent=p.name;let rows=data.treatments.filter(x=>x.product===p.name);document.getElementById('productSub').textContent=`${rows.length} session type${rows.length===1?'':'s'} configured`;document.getElementById('productTreatmentTable').innerHTML='<tr><th>Session Type</th><th>Duration</th><th>Buffer</th><th>Price</th><th>Status</th></tr>'+rows.map(x=>`<tr class='clinicRow' onclick="openTreatmentEdit('${x.id}')"><td><b>${escapeHtml(x.name)}</b></td><td>${x.duration} min</td><td>${x.buffer} min</td><td>£${(+x.price||0).toFixed(2)}</td><td><span class=pill>${x.active===false?'Inactive':'Active'}</span></td></tr>`).join('')}
function renderClinicDays(){
  let table=document.getElementById('clinicTable');if(!table)return;
  let rows=[...(data.clinicDays||[])].sort((a,b)=>String(a.date||'').localeCompare(String(b.date||'')));
  table.innerHTML='<tr><th>Date</th><th>Treatment Type</th><th>Clinician</th><th>Hours</th><th>Provided Discount</th><th>Rental Charge</th></tr>'+
    (rows.length?rows.map(x=>{
      let r=data.renters.find(z=>z.id===x.renterId),
          d=parseLocalDateKey(x.date),
          label=d.toLocaleDateString('en-GB',{weekday:'long',day:'2-digit',month:'2-digit',year:'numeric'});
      return `<tr class='clinicRow' onclick="openClinicEdit('${x.id}')"><td><b>${label}</b></td><td>${escapeHtml(x.product||'')}</td><td>${escapeHtml(r?.name||'')}</td><td>${escapeHtml(x.start||'')}–${escapeHtml(x.end||'')}</td><td>${(+x.discountPercent||0)>0?`${+x.discountPercent}%`:'None'}</td><td>£${(+x.rentalCharge||0).toFixed(2)}</td></tr>`;
    }).join(''):`<tr><td colspan='6' class='muted'>No Clinic Days have been created yet.</td></tr>`);
}
function renderTables(){
  renderProducts();renderProductDetail();
  renderCustomers();renderTanningProducts();
  document.getElementById('renterTable').innerHTML='<tr><th>Name</th><th>Treatment Types</th><th>Phone</th><th>Email</th></tr>'+
    data.renters.map(x=>`<tr class='clinicRow' onclick="openRenterEdit('${x.id}')"><td><b>${escapeHtml(x.name)}</b></td><td>${escapeHtml((x.productNames||[]).join(', ')||x.product||'')}</td><td>${escapeHtml(x.phone||'')}</td><td>${escapeHtml(x.email||'')}</td></tr>`).join('');
  renderClinicDays();
}
function openProduct(id){currentProduct=id;document.getElementById('productListView').style.display='none';document.getElementById('productDetailView').style.display='block';renderProductDetail()}
function backToProducts(){currentProduct=null;document.getElementById('productDetailView').style.display='none';document.getElementById('productListView').style.display='block';renderProducts()}
function addProduct(){
  editingProductId=null;
  document.getElementById('productModalTitle').textContent='Create Treatment Type';
  document.getElementById('newProductName').value='';
  document.getElementById('productCreateError').style.display='none';
  document.getElementById('createProductSaveBtn').textContent='Create Treatment Type';
  document.getElementById('productCreateModal').classList.add('show');
}
async function deleteCurrentProduct(){let p=data.products.find(x=>x.id===currentProduct);if(!p)return;if(!confirm(`Delete Treatment Type ${p.name}?`))return;let {error}=await sb.from('products').delete().eq('id',p.id);if(error)return alert('This Treatment Type may still have Session Types, Clinicians or bookings linked to it. Delete those linked records first.\n\n'+error.message);await loadLiveData();backToProducts();renderProducts()}
function editCurrentProduct(){
  let p=data.products.find(x=>x.id===currentProduct);if(!p)return;
  editingProductId=p.id;
  document.getElementById('productModalTitle').textContent='Edit Treatment Type';
  document.getElementById('newProductName').value=p.name;
  document.getElementById('productCreateError').style.display='none';
  document.getElementById('createProductSaveBtn').textContent='Save Changes';
  document.getElementById('productCreateModal').classList.add('show');
}
function closeProductCreate(){document.getElementById('productCreateModal').classList.remove('show');editingProductId=null}
async function saveNewProduct(){
  let name=document.getElementById('newProductName').value.trim(),errBox=document.getElementById('productCreateError'),btn=document.getElementById('createProductSaveBtn');
  errBox.style.display='none';
  if(!name){errBox.textContent='Please enter a Treatment Type name.';errBox.style.display='block';return;}
  let id=editingProductId;
  btn.disabled=true;btn.textContent=id?'Saving...':'Creating...';
  try{
    let error;
    if(id)({error}=await sb.from('products').update({name}).eq('id',id));
    else ({error}=await sb.from('products').insert({name,active:true}));
    if(error)throw error;
    document.getElementById('productCreateModal').classList.remove('show');editingProductId=null;
    await loadLiveData();renderAll();
    if(id)openProduct(id);else{let p=data.products.find(x=>x.name.toLowerCase()===name.toLowerCase());if(p)openProduct(p.id);}
  }catch(e){errBox.textContent=e.message||'Could not save Treatment Type.';errBox.style.display='block';}
  finally{btn.disabled=false;btn.textContent='Create Treatment Type';}
}
function addTreatmentToCurrentProduct(){
  let p=data.products.find(x=>x.id===currentProduct);if(!p)return;
  editingTreatmentId=null;
  document.getElementById('treatmentModalTitle').textContent='Add Session Type';
  document.getElementById('treatmentCreateProductLabel').textContent=`Treatment Type: ${p.name}`;
  document.getElementById('treatmentCreateName').value='';
  document.getElementById('treatmentCreateDuration').value='30';
  document.getElementById('treatmentCreateBuffer').value='0';
  document.getElementById('treatmentCreatePrice').value='0.00';
  document.getElementById('treatmentCreateSaveBtn').textContent='Create Session Type';
  document.getElementById('treatmentCreateError').style.display='none';
  document.getElementById('deleteTreatmentBtn').style.display='none';document.getElementById('treatmentCreateModal').classList.add('show');
}
function openTreatmentEdit(id){
  let t=data.treatments.find(x=>x.id===id);if(!t)return;
  let p=data.products.find(x=>x.id===t.productId)||data.products.find(x=>x.name===t.product);if(!p)return;
  currentProduct=p.id;editingTreatmentId=t.id;
  document.getElementById('treatmentModalTitle').textContent='Edit Session Type';
  document.getElementById('treatmentCreateProductLabel').textContent=`Treatment Type: ${p.name}`;
  document.getElementById('treatmentCreateName').value=t.name;
  document.getElementById('treatmentCreateDuration').value=t.duration;
  document.getElementById('treatmentCreateBuffer').value=t.buffer;
  document.getElementById('treatmentCreatePrice').value=(+t.price||0).toFixed(2);
  document.getElementById('treatmentCreateSaveBtn').textContent='Save Changes';
  document.getElementById('treatmentCreateError').style.display='none';
  document.getElementById('deleteTreatmentBtn').style.display='inline-block';
  document.getElementById('treatmentCreateModal').classList.add('show');
}
async function deleteTreatment(){if(!editingTreatmentId)return alert('Save the Session Type first.');if(!confirm('Delete this Session Type?'))return;let {error}=await sb.from('treatments').delete().eq('id',editingTreatmentId);if(error)return alert(error.message);document.getElementById('treatmentCreateModal').classList.remove('show');editingTreatmentId=null;await loadLiveData();renderAll();if(currentProduct)openProduct(currentProduct)}
function closeTreatmentCreate(){document.getElementById('treatmentCreateModal').classList.remove('show');editingTreatmentId=null}
async function saveNewTreatment(){
  let p=data.products.find(x=>x.id===currentProduct),name=document.getElementById('treatmentCreateName').value.trim(),
      duration=+document.getElementById('treatmentCreateDuration').value,buffer=+document.getElementById('treatmentCreateBuffer').value,
      price=+document.getElementById('treatmentCreatePrice').value,err=document.getElementById('treatmentCreateError'),btn=document.getElementById('treatmentCreateSaveBtn'),
      id=editingTreatmentId;
  err.style.display='none';
  if(!p)return showTreatmentCreateError('Treatment Type could not be found.');
  if(!name)return showTreatmentCreateError('Please enter a Session Type name.');
  if(!duration||duration<1)return showTreatmentCreateError('Duration must be at least 1 minute.');
  if(buffer<0||price<0)return showTreatmentCreateError('Buffer and Price cannot be negative.');
  btn.disabled=true;btn.textContent=id?'Saving...':'Creating...';
  try{
    let error;
    if(id)({error}=await sb.from('treatments').update({name,price,duration_minutes:duration,buffer_minutes:buffer}).eq('id',id));
    else ({error}=await sb.from('treatments').insert({product_id:p.id,name,price,duration_minutes:duration,buffer_minutes:buffer,active:true}));
    if(error)throw error;
    document.getElementById('treatmentCreateModal').classList.remove('show');editingTreatmentId=null;
    await loadLiveData();renderAll();openProduct(p.id);
  }catch(e){showTreatmentCreateError(e.message||'Could not save Session Type.')}
  finally{btn.disabled=false;btn.textContent='Create Session Type';}
}
function showTreatmentCreateError(msg){let el=document.getElementById('treatmentCreateError');el.textContent=msg;el.style.display='block'}
