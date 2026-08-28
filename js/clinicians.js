function populateRenterProductSelect(selectedIds=[]){
  let sel=document.getElementById('renterCreateProduct');if(!sel)return;
  sel.innerHTML=data.products.filter(p=>p.active!==false).map(p=>`<option value='${p.id}' ${selectedIds.includes(p.id)?'selected':''}>${escapeHtml(p.name)}</option>`).join('');
}
function selectedRenterProductIds(){
  return [...document.getElementById('renterCreateProduct').selectedOptions].map(x=>x.value);
}
function addRenter(){
  if(!data.products.length)return alert('Create at least one Treatment Type before creating a Clinician.');
  editingRenterId=null;
  document.getElementById('renterModalTitle').textContent='Add Clinician';
  document.getElementById('renterModalSubtitle').textContent='Create a treatment-room clinician and link their Treatment Types.';
  document.getElementById('renterCreateName').value='';document.getElementById('renterCreatePhone').value='';document.getElementById('renterCreateEmail').value='';
  populateRenterProductSelect([]);
  document.getElementById('renterCreateSaveBtn').textContent='Create Clinician';
  document.getElementById('renterCreateError').style.display='none';
  document.getElementById('deleteRenterBtn').style.display='none';document.getElementById('renterCreateModal').classList.add('show');
}
function openRenterEdit(id){
  let r=data.renters.find(x=>x.id===id);if(!r)return;
  editingRenterId=id;
  document.getElementById('renterModalTitle').textContent='Edit Clinician';
  document.getElementById('renterModalSubtitle').textContent='Update clinician details and Treatment Types.';
  document.getElementById('renterCreateName').value=r.name||'';document.getElementById('renterCreatePhone').value=r.phone||'';document.getElementById('renterCreateEmail').value=r.email||'';
  populateRenterProductSelect(r.productIds||[]);
  document.getElementById('renterCreateSaveBtn').textContent='Save Changes';
  document.getElementById('renterCreateError').style.display='none';
  document.getElementById('deleteRenterBtn').style.display='inline-block';
  document.getElementById('renterCreateModal').classList.add('show');
}
async function deleteRenter(){if(!editingRenterId)return alert('Save the clinician first.');if(!confirm('Delete this clinician?'))return;let link=await sb.from('renter_products').delete().eq('renter_id',editingRenterId);if(link.error)return alert(link.error.message);let {error}=await sb.from('renters').delete().eq('id',editingRenterId);if(error)return alert('This clinician may still have Clinic Days or bookings linked. Delete those first.\n\n'+error.message);document.getElementById('renterCreateModal').classList.remove('show');editingRenterId=null;await loadLiveData();renderAll()}
function closeRenterCreate(){document.getElementById('renterCreateModal').classList.remove('show');editingRenterId=null}
async function saveNewRenter(){
  let name=document.getElementById('renterCreateName').value.trim(),phone=document.getElementById('renterCreatePhone').value.trim(),
      email=document.getElementById('renterCreateEmail').value.trim(),productIds=selectedRenterProductIds(),
      err=document.getElementById('renterCreateError'),btn=document.getElementById('renterCreateSaveBtn'),id=editingRenterId;
  err.style.display='none';
  if(!name)return showRenterCreateError('Please enter a clinician name.');
  if(!productIds.length)return showRenterCreateError('Please select at least one Treatment Type.');
  btn.disabled=true;btn.textContent=id?'Saving...':'Creating...';
  try{
    let renterId=id;
    if(id){
      let {error}=await sb.from('renters').update({name,phone:phone||null,email:email||null}).eq('id',id);if(error)throw error;
    }else{
      let {data:row,error}=await sb.from('renters').insert({name,phone:phone||null,email:email||null,active:true}).select().single();if(error)throw error;
      renterId=row.id;
    }
    await saveClinicianTreatmentAssignments(renterId,productIds);
    document.getElementById('renterCreateModal').classList.remove('show');editingRenterId=null;
    await loadLiveData();renderAll();
  }catch(e){showRenterCreateError(e.message||'Could not save Clinician.')}
  finally{btn.disabled=false;btn.textContent=id?'Save Changes':'Create Clinician';}
}
function showRenterCreateError(msg){let el=document.getElementById('renterCreateError');el.textContent=msg;el.style.display='block'}
