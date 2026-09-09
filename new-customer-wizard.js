// ==================== NEW CUSTOMER WIZARD ====================
let wizCustomerId=null;
let wizSelectedSkinType=null;
let wizPurchaseSelection={treatments:[],glowStudio:[]};
let wizBoughtBlockMinutes=false;
let wizCurrentPurchaseCategory=null;
let wizSessionBackTarget='purchaseAsk';

let wizMode='new';
function wizGetStepOrder(){
  return wizMode==='existing'
    ? ['selectCustomer','purchaseAsk','purchase','payment','sessionType','sessionMinutes']
    : ['personal','id','skin','purchaseAsk','purchase','payment','sessionType','sessionMinutes'];
}
function wizGetChevronGroups(){
  return wizMode==='existing'
    ? [{label:'Select Customer',keys:['selectCustomer']},{label:'Any Purchases',keys:['purchaseAsk','purchase','payment']},{label:'Session',keys:['sessionType','sessionMinutes']}]
    : [{label:'Setup Customer',keys:['personal','id','skin']},{label:'Any Purchases',keys:['purchaseAsk','purchase','payment']},{label:'Session',keys:['sessionType','sessionMinutes']}];
}
const WIZ_STEP_LABELS={personal:'Personal Info',id:'ID Checks',skin:'Skin Assessment',selectCustomer:'Select Customer',purchaseAsk:'Purchase?',purchase:'Purchase',payment:'Payment',sessionType:'Session Type',sessionMinutes:'Session Minutes'};
const WIZ_STEP_PHASE_CLASS={personal:'phase-account',id:'phase-account',skin:'phase-account',selectCustomer:'phase-account',purchaseAsk:'phase-purchase',purchase:'phase-purchase',payment:'phase-purchase',sessionType:'phase-session',sessionMinutes:'phase-session'};
function wizRenderChevrons(currentKey){
  let stepOrder=wizGetStepOrder(),currentIndex=stepOrder.indexOf(currentKey),groups=wizGetChevronGroups();
  let labelsHtml=groups.map(g=>`<div class='wizardChevronGroupLabel' style='flex-grow:${g.keys.length}'>${g.label}</div>`).join('');
  let chevronsHtml=stepOrder.map((key,i)=>
    `<div class='wizardChevron ${WIZ_STEP_PHASE_CLASS[key]} ${i===currentIndex?'active':i<currentIndex?'done':''}'>${i+1}. ${WIZ_STEP_LABELS[key]}</div>`
  ).join('');
  document.getElementById('wizardChevrons').innerHTML=`<div class='wizardChevronLabels'>${labelsHtml}</div><div class='wizardChevronRow'>${chevronsHtml}</div>`;
}

function openNewCustomerWizard(){
  wizMode='new';
  document.getElementById('wizModalTitle').textContent='Process New Customer';
  wizCustomerId=null;
  wizSelectedSkinType=null;
  wizPurchaseSelection={treatments:[],glowStudio:[]};
  wizBoughtBlockMinutes=false;
  wizSessionBackTarget='purchaseAsk';
  ['wizFirst','wizLast','wizPhone','wizEmail','wizAddress','wizDob','wizIdDate','wizHealthNotes'].forEach(id=>document.getElementById(id).value='');
  document.getElementById('wizBedUse').value='Hybrid';
  document.getElementById('wizBedUse2').value='Hybrid';
  document.getElementById('wizPreferredBed').value='Any Bed';
  document.getElementById('wizWaiverSigned').value='false';
  document.getElementById('wizIdChecked').value='false';
  document.getElementById('wizUvAllowed').value='false';
  wizUpdateUvAllowedColour();
  document.querySelectorAll('.wizVerifiedByCheck').forEach(el=>el.checked=false);
  document.getElementById('wizVerifiedByRow').style.display='none';
  document.querySelectorAll('#wizSkin .skinTypeBtn').forEach(b=>b.classList.remove('selected'));
  document.getElementById('wizPersonalError').style.display='none';
  document.getElementById('wizSkinError').style.display='none';
  document.getElementById('wizPurchaseError').style.display='none';
  document.getElementById('wizPaymentError').style.display='none';
  document.getElementById('wizSessionError').style.display='none';
  document.getElementById('wizSessionTypeError').style.display='none';
  document.getElementById('wizSessionRlt').checked=false;
  document.getElementById('wizSessionHybrid').checked=false;
  ['wizSessionCashMinutes','wizSessionCardMinutes','wizSessionAccountMinutes','wizSessionFreeMinutes','wizSessionStaffMinutes','wizSessionRerunMinutes','wizSessionStaffMemberName'].forEach(id=>document.getElementById(id).value='');
  wizRenderPurchaseLists();
  wizGoTo('personal');
  document.getElementById('newCustomerWizardModal').classList.add('show');
}
function openExistingCustomerWizard(){
  wizMode='existing';
  document.getElementById('wizModalTitle').textContent='Process Existing Customer';
  wizCustomerId=null;
  wizPurchaseSelection={treatments:[],glowStudio:[]};
  wizBoughtBlockMinutes=false;
  wizSessionBackTarget='purchaseAsk';
  document.getElementById('wizSelectCustomerSearch').value='';
  document.getElementById('wizSelectCustomerSearch').style.display='block';
  document.getElementById('wizSelectedCustomerId').value='';
  document.getElementById('wizSelectCustomerSelected').style.display='none';
  document.getElementById('wizSelectCustomerBalance').innerHTML='Select a customer to see their account details.';
  document.getElementById('wizSelectCustomerError').style.display='none';
  document.getElementById('wizPurchaseError').style.display='none';
  document.getElementById('wizPaymentError').style.display='none';
  document.getElementById('wizSessionError').style.display='none';
  document.getElementById('wizSessionTypeError').style.display='none';
  document.getElementById('wizSessionRlt').checked=false;
  document.getElementById('wizSessionHybrid').checked=false;
  ['wizSessionCashMinutes','wizSessionCardMinutes','wizSessionAccountMinutes','wizSessionFreeMinutes','wizSessionStaffMinutes','wizSessionRerunMinutes','wizSessionStaffMemberName'].forEach(id=>document.getElementById(id).value='');
  wizRenderPurchaseLists();
  wizGoTo('selectCustomer');
  document.getElementById('newCustomerWizardModal').classList.add('show');
}
function exitNewCustomerWizard(){
  let onCompleteScreen=document.getElementById('wizComplete').style.display!=='none';
  if(!onCompleteScreen){
    if(!confirm(wizCustomerId
      ? 'Exit this journey? The customer account already created will be kept, but anything not yet confirmed on the current step will be lost.'
      : 'Exit this journey? Nothing has been saved yet.'))return;
  }
  document.getElementById('newCustomerWizardModal').classList.remove('show');
}
const WIZ_STEP_IDS={personal:'wizPersonal',id:'wizId',skin:'wizSkin',selectCustomer:'wizSelectCustomer',purchaseAsk:'wizPurchaseAsk',purchase:'wizPurchase',payment:'wizPayment',sessionType:'wizSessionType',sessionMinutes:'wizSessionMinutes',complete:'wizComplete'};
function wizGoTo(stepKey){
  Object.values(WIZ_STEP_IDS).forEach(id=>{document.getElementById(id).style.display='none'});
  document.getElementById(WIZ_STEP_IDS[stepKey]).style.display='block';
  wizRenderChevrons(stepKey);
  if(stepKey==='sessionType')wizSessionBackTarget=wizCustomerId&&wizPurchaseSelection.treatments.length+wizPurchaseSelection.glowStudio.length>0?'payment':'purchaseAsk';
  if(stepKey==='sessionMinutes')wizRenderSessionCustomerBalance();
}
function wizRenderSessionCustomerBalance(){
  wizRenderCustomerBalanceInto('wizSessionCustomerBalance');
}
function wizRenderCustomerBalanceInto(elId){
  let c=data.customers.find(x=>x.id===wizCustomerId),el=document.getElementById(elId);
  if(!c){el.innerHTML='';return}
  let uvAllowed=!!c.uvAllowed;
  let uvHtml=uvAllowed?`<span style='color:var(--green);font-weight:800'>UV Allowed: Yes</span>`:`<span style='color:#ff3131;font-weight:800'>UV Allowed: No</span>`;
  let warningHtml=uvAllowed?'':`<div style='color:#ff3131;font-weight:900;margin-top:4px'>UV IS SET TO NOT ALLOWED FOR THIS CUSTOMER</div>`;
  el.innerHTML=`<div>${c.minutesLeft} minutes left on account.</div><div>Bed Use: ${escapeHtml(c.bedUse||'Hybrid')}</div><div>Preferred Bed: ${escapeHtml(c.preferredBed||'Any Bed')}</div><div>${uvHtml}</div>${warningHtml}`;
}
function wizHideSelectCustomerResultsDelayed(){
  setTimeout(()=>{document.getElementById('wizSelectCustomerResults').style.display='none'},150);
}
function wizSearchSelectCustomer(){
  let q=document.getElementById('wizSelectCustomerSearch').value.trim().toLowerCase();
  let results=document.getElementById('wizSelectCustomerResults');
  if(!q){results.style.display='none';results.innerHTML='';return}
  let matches=(data.customers||[]).filter(c=>c.active!==false&&`${c.firstName} ${c.lastName}`.toLowerCase().includes(q)).slice(0,8);
  results.innerHTML=matches.length
    ? matches.map(c=>`<div class='customerSearchResultRow' onclick="wizPickSelectCustomer('${c.id}')"><b>${escapeHtml(c.firstName)} ${escapeHtml(c.lastName)}</b><div class='sub'>${escapeHtml(c.accountNumber)}</div></div>`).join('')
    : `<div class='customerSearchResultRow muted'>No matching customers.</div>`;
  results.style.display='block';
}
function wizPickSelectCustomer(id){
  let c=(data.customers||[]).find(x=>x.id===id);if(!c)return;
  wizCustomerId=id;
  document.getElementById('wizSelectedCustomerId').value=id;
  document.getElementById('wizSelectCustomerSearch').style.display='none';
  document.getElementById('wizSelectCustomerResults').style.display='none';
  document.getElementById('wizSelectCustomerResults').innerHTML='';
  let selectedDiv=document.getElementById('wizSelectCustomerSelected');
  selectedDiv.innerHTML=`<span>${escapeHtml(c.firstName)} ${escapeHtml(c.lastName)} (${escapeHtml(c.accountNumber)})</span><button type='button' onclick='wizClearSelectCustomer()'>✕</button>`;
  selectedDiv.style.display='flex';
  wizRenderCustomerBalanceInto('wizSelectCustomerBalance');
  document.getElementById('wizSelectCustomerError').style.display='none';
}
function wizClearSelectCustomer(){
  wizCustomerId=null;
  document.getElementById('wizSelectedCustomerId').value='';
  document.getElementById('wizSelectCustomerSearch').value='';
  document.getElementById('wizSelectCustomerSearch').style.display='block';
  document.getElementById('wizSelectCustomerSelected').style.display='none';
  document.getElementById('wizSelectCustomerBalance').innerHTML='Select a customer to see their account details.';
}
function wizSelectCustomerNext(){
  let err=document.getElementById('wizSelectCustomerError');err.style.display='none';
  if(!wizCustomerId){err.textContent='Please select a customer before continuing.';err.style.display='block';return}
  wizGoTo('purchaseAsk');
}
function wizGoToBeforeSession(){wizGoTo(wizSessionBackTarget)}

// --- Personal Info ---
function wizStep1Next(){
  let first=document.getElementById('wizFirst').value.trim(),last=document.getElementById('wizLast').value.trim(),
      phone=document.getElementById('wizPhone').value.trim(),address=document.getElementById('wizAddress').value.trim(),
      email=document.getElementById('wizEmail').value.trim(),waiverSigned=document.getElementById('wizWaiverSigned').value==='true',
      err=document.getElementById('wizPersonalError');
  err.style.display='none';
  if(!first||!last){err.textContent='First name and last name are required.';err.style.display='block';return}
  if(!phone){err.textContent='Phone number is required.';err.style.display='block';return}
  if(!address){err.textContent='Address is required.';err.style.display='block';return}
  if(!waiverSigned){err.textContent='Waiver Signed and Present must be set to Yes before continuing.';err.style.display='block';return}
  if(!email){
    if(!confirm('Are you sure the customer will not provide an email address? You can continue without one.'))return;
  }
  wizGoTo('id');
}

// --- ID Checks ---
function wizUpdateUvAllowedColour(){
  let el=document.getElementById('wizUvAllowed');
  el.classList.toggle('uvYes',el.value==='true');
  el.classList.toggle('uvNo',el.value==='false');
}
function wizHandleDobChange(){
  let idChecked=document.getElementById('wizIdChecked').value==='true';
  document.getElementById('wizVerifiedByRow').style.display=idChecked?'block':'none';
  if(idChecked){
    if(!document.getElementById('wizIdDate').value)document.getElementById('wizIdDate').value=localDateKey();
  }else{
    document.getElementById('wizIdDate').value='';
  }
  let dob=document.getElementById('wizDob').value,age=ageFromDob(dob);
  if(idChecked&&age!==null&&age>=18)document.getElementById('wizUvAllowed').value='true';
  wizUpdateUvAllowedColour();
}
function wizCheckAgeWarnings(){
  let dob=document.getElementById('wizDob').value,age=ageFromDob(dob);
  if(!dob||age===null)return;
  if(age<18){
    document.getElementById('wizUvAllowed').value='false';
    wizUpdateUvAllowedColour();
    alert('This customer is under 18 and cannot have their account set to UV Allowed: Yes.');
  }else if(age<25){
    alert('Challenge 25, ask for ID');
  }
}

// --- Skin Assessment ---
function wizSyncBedUse(value){
  document.getElementById('wizBedUse').value=value;
  document.getElementById('wizBedUse2').value=value;
}
function wizGuardUvAllowedChange(){
  let dob=document.getElementById('wizDob').value,age=ageFromDob(dob);
  if(document.getElementById('wizUvAllowed').value==='true'&&age!==null&&age<18){
    document.getElementById('wizUvAllowed').value='false';
    alert('This customer is under 18 and their account can never be set to UV Allowed: Yes.');
  }
  wizUpdateUvAllowedColour();
}
function wizStep2Next(){
  let dob=document.getElementById('wizDob').value,err=document.getElementById('wizIdError');
  err.style.display='none';
  if(!dob){err.textContent='Date of Birth is required.';err.style.display='block';return}
  wizGoTo('skin');
}
function wizSelectSkinType(type){
  wizSelectedSkinType=type;
  document.querySelectorAll('#wizSkin .skinTypeBtn').forEach(b=>b.classList.toggle('selected',+b.dataset.type===type));
}

// --- Create Account ---
async function wizCreateAccount(){
  let first=document.getElementById('wizFirst').value.trim(),last=document.getElementById('wizLast').value.trim(),
      dob=document.getElementById('wizDob').value,phone=document.getElementById('wizPhone').value.trim(),
      email=document.getElementById('wizEmail').value.trim(),address=document.getElementById('wizAddress').value.trim(),
      bedUse=document.getElementById('wizBedUse').value,preferredBed=document.getElementById('wizPreferredBed').value,
      waiverSigned=document.getElementById('wizWaiverSigned').value==='true',
      idChecked=document.getElementById('wizIdChecked').value==='true',idCheckedDate=document.getElementById('wizIdDate').value||null,
      uvAllowed=document.getElementById('wizUvAllowed').value==='true',
      verifiedBy=idChecked?[...document.querySelectorAll('.wizVerifiedByCheck:checked')].map(el=>el.value):[],
      healthNotes=document.getElementById('wizHealthNotes').value.trim(),
      age=ageFromDob(dob),err=document.getElementById('wizSkinError');
  err.style.display='none';
  if(!first||!last||!dob){err.textContent='First name, last name and date of birth are required before creating the account.';err.style.display='block';wizGoTo('personal');return}
  if(!wizSelectedSkinType){err.textContent='Please select a skin type before creating the account.';err.style.display='block';return}
  if(age<18){alert('CUSTOMER IS BELOW 18 AND CAN NOT BE A CUSTOMER.');return}
  let duplicate=(data.customers||[]).find(c=>c.dob===dob&&c.firstName.trim().toLowerCase()===first.toLowerCase()&&c.lastName.trim().toLowerCase()===last.toLowerCase());
  if(duplicate){showDuplicateCustomerModal(duplicate);return}
  let btn=document.getElementById('wizCreateAccountBtn');btn.disabled=true;btn.textContent='Creating...';
  try{
    let payload={first_name:first,last_name:last,date_of_birth:dob,phone_number:phone||null,email:email||null,address:address||null,
      intends_uv_or_injectables:true,id_checked:idChecked,id_checked_date:idCheckedDate,uv_allowed:uvAllowed,waiver_signed_present:waiverSigned,
      bed_use:bedUse,preferred_bed:preferredBed,bed_demo_provided:false,verified_by:verifiedBy,skin_type:wizSelectedSkinType,general_health_notes:healthNotes||null};
    let {data:row,error}=await sb.from('customers').insert(payload).select().single();
    if(error){
      if(error.code==='23505'){
        await loadLiveData();
        let existing=(data.customers||[]).find(c=>c.dob===dob&&c.firstName.trim().toLowerCase()===first.toLowerCase()&&c.lastName.trim().toLowerCase()===last.toLowerCase());
        if(existing){showDuplicateCustomerModal(existing);return}
      }
      throw error;
    }
    wizCustomerId=row.id;
    await loadLiveData();renderCustomers();
    document.getElementById('wizAccountCreatedSub').textContent=`${first} ${last}'s account has been created successfully (Account ${row.account_number||''}).`;
    wizGoTo('purchaseAsk');
  }catch(e){err.textContent=e.message||'Could not create this account.';err.style.display='block'}
  finally{btn.disabled=false;btn.textContent='Create Account →'}
}

// --- Purchase ---
function wizOpenBlockMinutesPurchase(){wizOpenPurchaseCategory('Block Minutes')}
function wizOpenTangiblesPurchase(){wizOpenPurchaseCategory('Tangible')}
function wizOpenRltProgrammePurchase(){wizOpenPurchaseCategory('RLT Programme')}
function wizOpenPurchaseCategory(type){
  wizCurrentPurchaseCategory=type;
  let products=(data.tanningProducts||[]).filter(p=>p.type===type&&p.active!==false).sort((a,b)=>(a.minutes||0)-(b.minutes||0)||a.title.localeCompare(b.title));
  document.getElementById('purchaseProductModalTitle').textContent=type;
  document.getElementById('purchaseProductList').innerHTML=products.length
    ? products.map(p=>`<div class='purchaseProductRow' onclick="wizAddProductToPurchase('${p.id}')"><div><div class='title'>${escapeHtml(p.title)}</div>${p.minutes?`<div class='sub'>${p.minutes} minutes</div>`:''}</div><div class='price'>£${(+p.price||0).toFixed(2)}</div></div>`).join('')
    : `<div class='muted' style='text-align:center;padding:20px'>No ${escapeHtml(type)} products are set up yet.</div>`;
  document.getElementById('purchaseProductModal').classList.add('show');
}
function wizAddProductToPurchase(id){
  let p=(data.tanningProducts||[]).find(x=>x.id===id);if(!p)return;
  let entry={productId:p.id,title:p.title,price:+p.price||0,productType:p.type,cardMachine:p.cardMachine||'Sunbed Card',minutes:+p.minutes||0};
  if(entry.cardMachine==='Treatment Card')wizPurchaseSelection.treatments.push(entry);
  else wizPurchaseSelection.glowStudio.push(entry);
  wizRenderPurchaseLists();
  closePurchaseProductModal();
}
function wizRemovePurchaseItem(list,index){
  wizPurchaseSelection[list].splice(index,1);
  wizRenderPurchaseLists();
}
function wizRenderPurchaseLists(){
  let treatmentsList=document.getElementById('wizPurchaseListTreatments'),glowStudioList=document.getElementById('wizPurchaseListGlowStudio');
  if(!treatmentsList||!glowStudioList)return;
  let renderRow=(item,list,index)=>`<div class='purchaseItemRow'><div class='title'>${escapeHtml(item.title)}</div><div class='right'><div class='price'>£${item.price.toFixed(2)}</div><button type='button' class='purchaseItemRemove' onclick="wizRemovePurchaseItem('${list}',${index})">✕</button></div></div>`;
  treatmentsList.innerHTML=wizPurchaseSelection.treatments.length
    ? wizPurchaseSelection.treatments.map((item,i)=>renderRow(item,'treatments',i)).join('')
    : `<div class='purchaseListEmpty'>No items added yet.</div>`;
  glowStudioList.innerHTML=wizPurchaseSelection.glowStudio.length
    ? wizPurchaseSelection.glowStudio.map((item,i)=>renderRow(item,'glowStudio',i)).join('')
    : `<div class='purchaseListEmpty'>No items added yet.</div>`;
  let treatmentsTotal=wizPurchaseSelection.treatments.reduce((s,i)=>s+i.price,0),
      glowStudioTotal=wizPurchaseSelection.glowStudio.reduce((s,i)=>s+i.price,0);
  document.getElementById('wizPurchaseTotalTreatments').value=`£${treatmentsTotal.toFixed(2)}`;
  document.getElementById('wizPurchaseTotalGlowStudio').value=`£${glowStudioTotal.toFixed(2)}`;
}

// --- Payment ---
function wizGoToPayment(){
  let err=document.getElementById('wizPurchaseError');err.style.display='none';
  let allItems=[...wizPurchaseSelection.treatments,...wizPurchaseSelection.glowStudio];
  if(!allItems.length){err.textContent='Please add at least one item before processing.';err.style.display='block';return}
  let treatmentsTotal=wizPurchaseSelection.treatments.reduce((s,i)=>s+i.price,0),
      glowStudioTotal=wizPurchaseSelection.glowStudio.reduce((s,i)=>s+i.price,0);
  document.getElementById('wizPpGlowStudioDue').textContent=`£${glowStudioTotal.toFixed(2)}`;
  document.getElementById('wizPpTreatmentsDue').textContent=`£${treatmentsTotal.toFixed(2)}`;
  ['wizPpGlowStudioCard','wizPpGlowStudioCash','wizPpTreatmentsCard','wizPpTreatmentsCash'].forEach(id=>document.getElementById(id).value='');
  document.getElementById('wizPpGlowStudioCheck').textContent='';
  document.getElementById('wizPpTreatmentsCheck').textContent='';
  document.getElementById('wizAmountBeingPaid').textContent='£0.00';
  document.getElementById('wizPaymentError').style.display='none';
  wizGoTo('payment');
}
function wizHalfMatchesDue(cardId,cashId,dueEl){
  let card=pence(document.getElementById(cardId).value),cash=pence(document.getElementById(cashId).value),
      due=pence(dueEl.textContent.replace('£',''));
  return card+cash===due;
}
function wizUpdatePaymentSplitStatus(){
  let glowCard=+document.getElementById('wizPpGlowStudioCard').value||0,glowCash=+document.getElementById('wizPpGlowStudioCash').value||0,
      treatCard=+document.getElementById('wizPpTreatmentsCard').value||0,treatCash=+document.getElementById('wizPpTreatmentsCash').value||0;
  let glowDue=pence(document.getElementById('wizPpGlowStudioDue').textContent.replace('£','')),
      treatDue=pence(document.getElementById('wizPpTreatmentsDue').textContent.replace('£',''));
  let glowEntered=pence(glowCard)+pence(glowCash),treatEntered=pence(treatCard)+pence(treatCash);
  let glowCheck=document.getElementById('wizPpGlowStudioCheck'),treatCheck=document.getElementById('wizPpTreatmentsCheck');
  glowCheck.className='processPurchasesCheck '+(glowEntered===glowDue?'ok':'bad');
  glowCheck.textContent=glowEntered===glowDue?'✓ Matches amount due':`Card + Cash must equal the amount due — ${glowEntered<glowDue?`Another £${((glowDue-glowEntered)/100).toFixed(2)} needed`:`£${((glowEntered-glowDue)/100).toFixed(2)} too much`}`;
  treatCheck.className='processPurchasesCheck '+(treatEntered===treatDue?'ok':'bad');
  treatCheck.textContent=treatEntered===treatDue?'✓ Matches amount due':`Card + Cash must equal the amount due — ${treatEntered<treatDue?`Another £${((treatDue-treatEntered)/100).toFixed(2)} needed`:`£${((treatEntered-treatDue)/100).toFixed(2)} too much`}`;
  document.getElementById('wizAmountBeingPaid').textContent=`£${(glowCard+glowCash+treatCard+treatCash).toFixed(2)}`;
}
async function wizConfirmPurchases(){
  let err=document.getElementById('wizPaymentError');err.style.display='none';
  let glowOk=wizHalfMatchesDue('wizPpGlowStudioCard','wizPpGlowStudioCash',document.getElementById('wizPpGlowStudioDue')),
      treatOk=wizHalfMatchesDue('wizPpTreatmentsCard','wizPpTreatmentsCash',document.getElementById('wizPpTreatmentsDue'));
  if(!glowOk||!treatOk){err.textContent='Card + Cash must equal the amount due in both halves before confirming.';err.style.display='block';return}
  let glowStudioCard=+document.getElementById('wizPpGlowStudioCard').value||0,
      glowStudioCash=+document.getElementById('wizPpGlowStudioCash').value||0,
      treatmentsCard=+document.getElementById('wizPpTreatmentsCard').value||0,
      treatmentsCash=+document.getElementById('wizPpTreatmentsCash').value||0;
  let allItems=[...wizPurchaseSelection.treatments,...wizPurchaseSelection.glowStudio];
  let treatmentsTotal=wizPurchaseSelection.treatments.reduce((s,i)=>s+i.price,0),
      glowStudioTotal=wizPurchaseSelection.glowStudio.reduce((s,i)=>s+i.price,0),
      grandTotal=treatmentsTotal+glowStudioTotal;
  try{
    let {data:purchase,error}=await sb.from('customer_purchases').insert({
      purchase_date:localDateKey(),treatments_total:treatmentsTotal,glow_studio_total:glowStudioTotal,grand_total:grandTotal,
      glow_studio_card_amount:glowStudioCard,glow_studio_cash_amount:glowStudioCash,
      treatments_card_amount:treatmentsCard,treatments_cash_amount:treatmentsCash,customer_id:wizCustomerId
    }).select().single();
    if(error)throw error;
    let itemRows=allItems.map(item=>({
      purchase_id:purchase.id,tanning_product_id:item.productId,product_title:item.title,
      product_type:item.productType,card_machine:item.cardMachine,price:item.price
    }));
    let {error:itemsError}=await sb.from('customer_purchase_items').insert(itemRows);
    if(itemsError)throw itemsError;
    let blockMinuteItems=allItems.filter(item=>item.productType==='Block Minutes'&&item.minutes>0);
    if(blockMinuteItems.length)wizBoughtBlockMinutes=true;
    for(let item of blockMinuteItems){
      let {error:minutesError}=await sb.rpc('add_minutes_to_customer_account',{
        p_customer:wizCustomerId,p_minutes:item.minutes,p_transaction_type:'Block Purchase',
        p_title:item.title,p_notes:null,p_total_value:item.price
      });
      if(minutesError)throw minutesError;
    }
    await loadLiveData();renderAll();
    wizGoTo('sessionType');
  }catch(e){err.textContent=e.message||'Could not confirm this purchase.';err.style.display='block'}
}

// --- Session Type ---
function wizExclusiveSessionType(which){
  let r=document.getElementById('wizSessionRlt'),h=document.getElementById('wizSessionHybrid');
  if(which==='rlt'&&r.checked){
    h.checked=false;
    alert('Ensure bed is set to RLT Only for Customer');
  }
  if(which==='hybrid'&&h.checked){
    r.checked=false;
    let c=data.customers.find(x=>x.id===wizCustomerId);
    if(c&&!c.uvAllowed)alert('This Customer can not use UV. Please check their Customer record to see why.');
  }
}
function wizSessionTypeNext(){
  let err=document.getElementById('wizSessionTypeError');err.style.display='none';
  if(!document.getElementById('wizSessionRlt').checked&&!document.getElementById('wizSessionHybrid').checked){
    err.textContent='Please select either Red Light Therapy or Hybrid before continuing.';err.style.display='block';return
  }
  wizGoTo('sessionMinutes');
}

// --- Session Minutes ---
function wizUpdateSessionLengthTotal(){
  let cash=+document.getElementById('wizSessionCashMinutes').value||0,
      card=+document.getElementById('wizSessionCardMinutes').value||0,
      account=+document.getElementById('wizSessionAccountMinutes').value||0,
      free=+document.getElementById('wizSessionFreeMinutes').value||0,
      staff=+document.getElementById('wizSessionStaffMinutes').value||0,
      rerun=+document.getElementById('wizSessionRerunMinutes').value||0;
  document.getElementById('wizSessionLength').value=cash+card+account+free+staff+rerun;
  document.getElementById('wizStaffMemberNameRow').style.display=staff>0?'block':'none';
  document.getElementById('wizRerunReasonRow').style.display=rerun>0?'block':'none';
  let paygRow=document.getElementById('wizPaygChargeRow'),paygDetails=paygChargeDetails(cash,card);
  paygRow.style.display=paygDetails?'block':'none';
  if(paygDetails)paygRow.textContent=paygDetails.totalMessage;
  let cashAmountEl=document.getElementById('wizSessionCashPaygAmount');
  cashAmountEl.style.display=paygDetails&&paygDetails.cashAmount!==null?'block':'none';
  if(paygDetails&&paygDetails.cashAmount!==null)cashAmountEl.textContent=`£${paygDetails.cashAmount.toFixed(2)}`;
  let cardAmountEl=document.getElementById('wizSessionCardPaygAmount');
  cardAmountEl.style.display=paygDetails&&paygDetails.cardAmount!==null?'block':'none';
  if(paygDetails&&paygDetails.cardAmount!==null)cardAmountEl.textContent=`£${paygDetails.cardAmount.toFixed(2)}`;
  let insufficientLine=document.getElementById('wizSessionAccountInsufficientLine'),
      c=wizCustomerId?data.customers.find(x=>x.id===wizCustomerId):null;
  let showInsufficient=c&&account>c.minutesLeft;
  insufficientLine.style.display=showInsufficient?'block':'none';
  if(showInsufficient)insufficientLine.textContent='Customer does not have enough mins on account, either purchase more or enter additional mins into Cash or Card pay as you go fields.';
  checkSkinTypeSessionWarning(wizCustomerId,cash+card+account+free+staff+rerun);
}
async function wizRecordSession(){
  let c=data.customers.find(x=>x.id===wizCustomerId);
  let date=localDateKey(),
      cashMin=+document.getElementById('wizSessionCashMinutes').value||0,
      cardMin=+document.getElementById('wizSessionCardMinutes').value||0,
      accountMin=+document.getElementById('wizSessionAccountMinutes').value||0,
      freeMin=+document.getElementById('wizSessionFreeMinutes').value||0,
      staffMin=+document.getElementById('wizSessionStaffMinutes').value||0,
      staffMemberName=document.getElementById('wizSessionStaffMemberName').value.trim(),
      rerunMin=+document.getElementById('wizSessionRerunMinutes').value||0,
      rerunReason=document.getElementById('wizSessionRerunReason').value,
      length=cashMin+cardMin+accountMin+freeMin+staffMin+rerunMin,
      rlt=document.getElementById('wizSessionRlt').checked,hybrid=document.getElementById('wizSessionHybrid').checked,
      err=document.getElementById('wizSessionError');
  err.style.display='none';
  if(!Number.isInteger(length)||length<1){err.textContent='Please enter minutes for at least one payment type.';err.style.display='block';return}
  if(!rlt&&!hybrid){err.textContent='Please select Red Light Therapy or Hybrid.';err.style.display='block';return}
  if(staffMin>0&&!staffMemberName){err.textContent='Please enter the Staff Member Name.';err.style.display='block';return}
  if(rerunMin>0&&!rerunReason){err.textContent='Please select a Rerun Reason.';err.style.display='block';return}
  let sessionTypeValue=rlt?'Red Light Therapy':'Hybrid';
  let age=ageFromDob(c.dob);
  if(hybrid&&age<18)return alert('CUSTOMER IS BELOW 18 AND IS NOT ALLOWED TO USE UV.');
  if(hybrid&&age<25&&!c.idChecked)return alert('NO ID HAS BEEN CHECKED FOR THIS CUSTOMER. CHECK CUSTOMER ID BEFORE UV USE.');
  if(hybrid&&!c.uvAllowed)return alert('This Customer can not use UV. Please check their Customer record to see why.');
  if(accountMin>c.minutesLeft){err.textContent=`Customer has ${c.minutesLeft} minutes left but this session requires ${accountMin} minutes from account.`;err.style.display='block';return}
  try{
    let {error}=await sb.rpc('record_customer_bed_session_v2',{p_customer:wizCustomerId,p_session_date:date,p_cash_minutes:cashMin,p_card_minutes:cardMin,p_account_minutes:accountMin,p_free_minutes:freeMin,p_staff_minutes:staffMin,p_staff_member_name:staffMin>0?staffMemberName:null,p_rerun_minutes:rerunMin,p_rerun_reason:rerunMin>0?rerunReason:null,p_new_sign_up:true,p_purchased_block_booking:wizBoughtBlockMinutes,p_session_type:sessionTypeValue});
    if(error)throw error;
    await loadLiveData();renderAll();
    wizGoTo('complete');
  }catch(e){err.textContent=e.message||'Could not record this session.';err.style.display='block'}
}
