// Partner Discounts: an account-level discount agreed with a partner (e.g. a gym).
// Created in Settings > Sunbed Settings > Partner Discounts, switched on per customer account,
// and applied automatically on the portal and in every shop purchase screen.
let editingPartnerDiscountId=null;

// Price after a % discount. Matches the database function exactly: round(price*(100-pct)/100, 2).
function partnerDiscountedPrice(listPrice,percent){let p=+listPrice||0,d=+percent||0;if(!(d>0))return Math.round(p*100)/100;return Math.round(+(p*(100-d)).toFixed(6))/100}
function partnerPercentText(p){return (+p).toString().replace(/\.0+$/,'')+'%'}

// The partner discount a customer account currently qualifies for, or null.
function customerPartnerDiscount(customerId){
  if(!customerId)return null;
  let c=(data.customers||[]).find(x=>x.id===customerId);
  if(!c||!c.applyPartnerDiscount||!c.partnerDiscountId)return null;
  let p=(data.partnerDiscounts||[]).find(x=>x.id===c.partnerDiscountId);
  if(!p||!p.active||!(p.percent>0))return null;
  return {id:p.id,name:p.name,percent:p.percent};
}

function partnerCustomerCount(id){return (data.customers||[]).filter(c=>c.applyPartnerDiscount&&c.partnerDiscountId===id).length}

function renderPartnerDiscounts(){
  let table=document.getElementById('partnerDiscountsTable');if(!table)return;
  let canEdit=hasRolePermission('sunbed_settings','edit'),btn=document.getElementById('createPartnerDiscountBtn');
  if(btn)btn.style.display=canEdit?'inline-block':'none';
  let rows=[...(data.partnerDiscounts||[])];
  table.innerHTML=`<tr><th>Partner</th><th>Discount</th><th>Customers</th><th>Status</th><th></th></tr>`+
    (rows.length?rows.map(p=>`<tr><td><b>${escapeHtml(p.name)}</b></td><td>${partnerPercentText(p.percent)}</td><td>${partnerCustomerCount(p.id)}</td><td>${p.active?'Active':'Inactive'}</td><td>${canEdit?`<button onclick="openPartnerDiscountEdit('${p.id}')">Edit</button>`:''}</td></tr>`).join(''):`<tr><td colspan='5' class='muted'>No partner discounts yet. Click "+ Create Partner Discount".</td></tr>`);
}
function openPartnerDiscountCreate(){
  if(!requireRolePermission('sunbed_settings','edit'))return;
  editingPartnerDiscountId=null;
  document.getElementById('partnerDiscountModalTitle').textContent='Create Partner Discount';
  document.getElementById('partnerDiscountName').value='';document.getElementById('partnerDiscountPercent').value='';document.getElementById('partnerDiscountActive').value='true';
  document.getElementById('partnerDiscountDeleteBtn').style.display='none';document.getElementById('partnerDiscountError').style.display='none';
  document.getElementById('partnerDiscountModal').classList.add('show');
}
function openPartnerDiscountEdit(id){
  let p=(data.partnerDiscounts||[]).find(x=>x.id===id);if(!p)return;
  editingPartnerDiscountId=id;
  document.getElementById('partnerDiscountModalTitle').textContent=p.name;
  document.getElementById('partnerDiscountName').value=p.name;document.getElementById('partnerDiscountPercent').value=p.percent;document.getElementById('partnerDiscountActive').value=String(!!p.active);
  document.getElementById('partnerDiscountDeleteBtn').style.display='inline-block';document.getElementById('partnerDiscountError').style.display='none';
  document.getElementById('partnerDiscountModal').classList.add('show');
}
function closePartnerDiscountModal(){document.getElementById('partnerDiscountModal').classList.remove('show');editingPartnerDiscountId=null}
function showPartnerDiscountError(m){let e=document.getElementById('partnerDiscountError');e.textContent=m;e.style.display='block'}
async function savePartnerDiscount(){
  if(!requireRolePermission('sunbed_settings','edit'))return;
  let name=document.getElementById('partnerDiscountName').value.trim(),pct=+document.getElementById('partnerDiscountPercent').value,active=document.getElementById('partnerDiscountActive').value==='true';
  if(!name)return showPartnerDiscountError('Please enter the partner name.');
  if(!Number.isFinite(pct)||pct<=0||pct>100)return showPartnerDiscountError('Discount must be more than 0% and no more than 100%.');
  pct=Math.round(pct*100)/100;
  if((data.partnerDiscounts||[]).some(x=>x.id!==editingPartnerDiscountId&&x.name.toLowerCase()===name.toLowerCase()))return showPartnerDiscountError('A partner discount with that name already exists.');
  if(editingPartnerDiscountId){
    let prev=data.partnerDiscounts.find(x=>x.id===editingPartnerDiscountId),n=partnerCustomerCount(editingPartnerDiscountId);
    if(prev&&prev.percent!==pct&&n>0&&!confirm(`${n} customer account(s) use this discount. The new ${partnerPercentText(pct)} applies to all their NEW purchases from now on. Existing monthly memberships already running keep the old percentage. Continue?`))return;
  }
  let btn=document.getElementById('partnerDiscountSaveBtn');btn.disabled=true;btn.textContent='Saving...';
  try{
    let error;
    if(editingPartnerDiscountId)({error}=await sb.from('partner_discounts').update({name,discount_percent:pct,active}).eq('id',editingPartnerDiscountId));
    else({error}=await sb.from('partner_discounts').insert({name,discount_percent:pct,active}));
    if(error)throw error;
    closePartnerDiscountModal();await loadLiveData();renderPartnerDiscounts();
  }catch(e){showPartnerDiscountError(e.message||'Could not save.')}
  finally{btn.disabled=false;btn.textContent='Save'}
}
async function deletePartnerDiscount(){
  if(!requireRolePermission('sunbed_settings','edit'))return;
  if(!editingPartnerDiscountId)return;
  let n=partnerCustomerCount(editingPartnerDiscountId);
  if(n>0&&!confirm(`${n} customer account(s) currently use this partner discount and will lose it. (Tip: set it to Inactive instead to keep the record.) Delete anyway?`))return;
  if(n===0&&!confirm('Delete this partner discount?'))return;
  let {error}=await sb.from('partner_discounts').delete().eq('id',editingPartnerDiscountId);
  if(error)return showPartnerDiscountError(error.message);
  closePartnerDiscountModal();await loadLiveData();renderPartnerDiscounts();
}

// ---- Customer account fields ----
function fillPartnerDiscountSelect(selectedId){
  let sel=document.getElementById('custPartnerDiscountId');if(!sel)return;
  let list=(data.partnerDiscounts||[]).filter(p=>p.active||p.id===selectedId);
  sel.innerHTML=`<option value=''>Select partner...</option>`+list.map(p=>`<option value='${p.id}'>${escapeHtml(p.name)} (${partnerPercentText(p.percent)})${p.active?'':' - inactive'}</option>`).join('');
  sel.value=selectedId||'';
}
function togglePartnerDiscountField(){
  let on=document.getElementById('custApplyPartnerDiscount').value==='true';
  document.getElementById('custPartnerDiscountWrap').style.display=on?'block':'none';
}
function loadCustomerPartnerFields(c){
  let on=!!(c&&c.applyPartnerDiscount);
  document.getElementById('custApplyPartnerDiscount').value=String(on);
  fillPartnerDiscountSelect(c&&c.partnerDiscountId||'');
  togglePartnerDiscountField();
}
// Returns {error} or the payload fields to add to the customer save.
function customerPartnerPayload(){
  let on=document.getElementById('custApplyPartnerDiscount').value==='true',id=document.getElementById('custPartnerDiscountId').value;
  if(on&&!id)return {error:'Please choose which Partner Discount applies, or set "Apply Partner Discount" to No.'};
  return {fields:{apply_partner_discount:on,partner_discount_id:on?id:null}};
}

// ---- Shared basket helpers (Process Purchase, New/Existing Customer wizard, account block purchase) ----
// Every basket item keeps its original listPrice; price is what is actually charged.
function partnerApplyToItems(items,disc){
  items.forEach(i=>{if(i.listPrice==null)i.listPrice=i.price;i.price=disc?partnerDiscountedPrice(i.listPrice,disc.percent):i.listPrice});
}
function partnerRowPriceHtml(item){
  return item.listPrice!=null&&item.price<item.listPrice?`<s style='opacity:.55;margin-right:6px'>£${item.listPrice.toFixed(2)}</s>£${item.price.toFixed(2)}`:`£${item.price.toFixed(2)}`;
}
function partnerBoxHtml(disc,checked,handlerName,saving){
  if(!disc)return '';
  return `<div style='margin:10px 0;padding:10px 12px;border:1px solid #18d7e8;border-radius:10px'><label style='display:flex;gap:8px;align-items:center;margin:0;cursor:pointer'><input type='checkbox' style='width:auto;margin:0' ${checked?'checked':''} onchange="${handlerName}(this.checked)"><span><b>Apply partner discount: ${escapeHtml(disc.name)} (${partnerPercentText(disc.percent)})</b></span></label>${checked&&saving>0?`<div class='muted' style='margin-top:4px'>Saving £${saving.toFixed(2)} on this basket</div>`:''}</div>`;
}
function partnerBasketSaving(items){return Math.round(items.reduce((s,i)=>s+((i.listPrice!=null?i.listPrice:i.price)-i.price),0)*100)/100}
// Fields stored on customer_purchases (all empty/zero when no discount was given).
function partnerPurchaseFields(items,disc){
  let saving=disc?partnerBasketSaving(items):0;
  return disc&&saving>0?{partner_discount_name:disc.name,partner_discount_percent:disc.percent,partner_discount_amount:saving}:{partner_discount_name:null,partner_discount_percent:null,partner_discount_amount:0};
}

// ---- PAYG sessions ----
// % to take off a pay-as-you-go session for this customer (0 = none). Only when PAYG minutes are entered
// and staff have not ticked the discount off for this session.
function paygPartnerPercent(customerId,apply,cashMin,cardMin){
  if(!((+cashMin||0)+(+cardMin||0)>0))return 0;
  let d=customerPartnerDiscount(customerId);
  return d&&apply?d.percent:0;
}
// Tick box shown under the PAYG price when the selected customer has a partner discount.
function paygPartnerBoxHtml(customerId,apply,cashMin,cardMin,handlerName){
  let d=customerPartnerDiscount(customerId);
  if(!d||!((+cashMin||0)+(+cardMin||0)>0))return '';
  return partnerBoxHtml(d,apply,handlerName,0);
}
