// Business Growth > Leads: possible partnerships being worked on (gyms, PTs, wellbeing companies...).
let editingLeadId=null,leadsCache=[];
const LEAD_STATUSES=['Contacted','In Discussion','Met face to face','Partner Created','Not Possible'];
const LEAD_TYPES=['Gym','Wellbeing company','PT','Skin company','Other'];
const LEAD_CONTACT_FIELDS=[['leadMainName','main_contact_name'],['leadMainPhone','main_contact_phone'],['leadMainEmail','main_contact_email'],['leadSecondName','second_contact_name'],['leadSecondPhone','second_contact_phone'],['leadSecondEmail','second_contact_email']];

async function renderLeads(){
  let table=document.getElementById('leadsTable');if(!table)return;
  let canEdit=hasRolePermission('leads','edit'),canDelete=hasRolePermission('leads','delete');
  let btn=document.getElementById('createLeadBtn');if(btn)btn.style.display=canEdit?'inline-block':'none';
  table.innerHTML="<tr><td class='muted'>Loading leads...</td></tr>";
  let {data:rows,error}=await loadAllRows('partner_leads','*',[['created_at',false]]);
  if(error){table.innerHTML=`<tr><td class='muted'>Could not load the leads: ${escapeHtml(error.message||'')}</td></tr>`;return}
  leadsCache=rows||[];
  drawLeads();
}
function filterLeads(){drawLeads()}
function drawLeads(){
  let table=document.getElementById('leadsTable');if(!table)return;
  let canDelete=hasRolePermission('leads','delete');
  let q=((document.getElementById('leadsSearch')||{}).value||'').trim().toLowerCase();
  let list=q?leadsCache.filter(l=>(l.lead_name||'').toLowerCase().includes(q)):leadsCache;
  let when=d=>new Date(d).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'});
  let preview=t=>{t=(t||'').replace(/\s+/g,' ').trim();return t.length>110?t.slice(0,110)+'...':t};
  table.innerHTML="<tr><th>Lead</th><th>Status</th><th>Type of Partner</th><th>Main Contact</th><th>Notes</th><th>Added</th><th></th></tr>"+
    (list.length?list.map(l=>`<tr class='clinicRow' onclick="openLeadEdit('${l.id}')"><td><b>${escapeHtml(l.lead_name)}</b></td><td>${escapeHtml(l.lead_status)}</td><td>${escapeHtml(l.partner_type)}${l.partner_type==='Other'&&l.other_details?` <span class='muted'>(${escapeHtml(l.other_details)})</span>`:''}</td><td>${escapeHtml(l.main_contact_name||'')}${l.main_contact_phone?` <span class='muted'>${escapeHtml(l.main_contact_phone)}</span>`:''}</td><td class='muted'>${escapeHtml(preview(l.notes))}</td><td>${when(l.created_at)}</td><td>${canDelete?`<button onclick="event.stopPropagation();deleteLead('${l.id}')">Delete</button>`:''}</td></tr>`).join(''):`<tr><td colspan='7' class='muted'>${q?'No leads match your search.':'No leads yet. Click "+ New Lead" to add one.'}</td></tr>`);
}
function leadFillSelects(){
  document.getElementById('leadStatus').innerHTML=LEAD_STATUSES.map(s=>`<option value='${s}'>${s}</option>`).join('');
  document.getElementById('leadType').innerHTML=`<option value=''>Select type...</option>`+LEAD_TYPES.map(s=>`<option value='${s}'>${s}</option>`).join('');
}
function leadToggleOther(){document.getElementById('leadOtherWrap').style.display=document.getElementById('leadType').value==='Other'?'block':'none'}
function showLeadError(m){let e=document.getElementById('leadError');e.textContent=m;e.style.display='block'}
function openLeadCreate(){
  editingLeadId=null;leadFillSelects();
  document.getElementById('leadModalTitle').textContent='New Lead';
  document.getElementById('leadName').value='';document.getElementById('leadStatus').value='Contacted';document.getElementById('leadType').value='';
  document.getElementById('leadOther').value='';document.getElementById('leadNotes').value='';
  LEAD_CONTACT_FIELDS.forEach(([id])=>document.getElementById(id).value='');
  leadToggleOther();document.getElementById('leadDeleteBtn').style.display='none';document.getElementById('leadError').style.display='none';
  document.getElementById('leadModal').classList.add('show');
}
function openLeadEdit(id){
  let l=leadsCache.find(x=>x.id===id);if(!l)return;
  editingLeadId=id;leadFillSelects();
  document.getElementById('leadModalTitle').textContent=l.lead_name;
  document.getElementById('leadName').value=l.lead_name;document.getElementById('leadStatus').value=l.lead_status;document.getElementById('leadType').value=l.partner_type;
  document.getElementById('leadOther').value=l.other_details||'';document.getElementById('leadNotes').value=l.notes||'';
  LEAD_CONTACT_FIELDS.forEach(([id,col])=>document.getElementById(id).value=l[col]||'');
  leadToggleOther();
  document.getElementById('leadDeleteBtn').style.display=hasRolePermission('leads','delete')?'inline-block':'none';
  document.getElementById('leadSaveBtn').style.display=hasRolePermission('leads','edit')?'inline-block':'none';
  document.getElementById('leadError').style.display='none';document.getElementById('leadModal').classList.add('show');
}
function closeLeadModal(){document.getElementById('leadModal').classList.remove('show');editingLeadId=null;document.getElementById('leadSaveBtn').style.display='inline-block'}
async function saveLead(){
  let name=document.getElementById('leadName').value.trim(),status=document.getElementById('leadStatus').value,type=document.getElementById('leadType').value,
      other=document.getElementById('leadOther').value.trim(),notes=document.getElementById('leadNotes').value;
  if(!name)return showLeadError('Please enter the name of the lead (business or contact).');
  if(!type)return showLeadError('Please choose the type of partner.');
  if(type==='Other'&&!other)return showLeadError('You chose Other - please type in the details of the type of partner.');
  let row={lead_name:name,lead_status:status,partner_type:type,other_details:type==='Other'?other:null,notes:notes.trim()?notes:null,updated_at:new Date().toISOString()};
  LEAD_CONTACT_FIELDS.forEach(([id,col])=>{row[col]=document.getElementById(id).value.trim()||null});
  let btn=document.getElementById('leadSaveBtn');btn.disabled=true;btn.textContent='Saving...';
  try{
    let res=editingLeadId?await sb.from('partner_leads').update(row).eq('id',editingLeadId):await sb.from('partner_leads').insert(row);
    if(res.error)throw res.error;
    closeLeadModal();await renderLeads();
  }catch(e){showLeadError(e.message||'Could not save the lead.')}
  finally{btn.disabled=false;btn.textContent='Save'}
}
async function deleteLead(id){
  id=id||editingLeadId;if(!id)return;
  let l=leadsCache.find(x=>x.id===id);
  if(!confirm(`Delete the lead "${l?l.lead_name:''}"? This cannot be undone.`))return;
  let {error}=await sb.from('partner_leads').delete().eq('id',id);
  if(error)return alert(error.message);
  closeLeadModal();await renderLeads();
}
