// Business Planner > Social Media/Content Ideas
let editingIdeaId=null,ideasCache=[];
const IDEA_STATUSES=['New Idea','Started to Use','Fully used'];
const IDEA_TYPES=['Informative content','Marketing content','Just a bit of fun'];

async function renderIdeas(){
  let table=document.getElementById('ideasTable');if(!table)return;
  let btn=document.getElementById('createIdeaBtn');if(btn)btn.style.display=hasRolePermission('business_planner','edit')?'inline-block':'none';
  table.innerHTML="<tr><td class='muted'>Loading ideas...</td></tr>";
  let {data:rows,error}=await loadAllRows('content_ideas','*',[['created_at',false]]);
  if(error){table.innerHTML=`<tr><td class='muted'>Could not load the ideas: ${escapeHtml(error.message||'')}</td></tr>`;return}
  ideasCache=rows||[];
  let canDelete=hasRolePermission('business_planner','delete');
  let when=d=>new Date(d).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'});
  let preview=t=>{t=(t||'').replace(/\s+/g,' ').trim();return t.length>140?t.slice(0,140)+'...':t};
  table.innerHTML="<tr><th>Status</th><th>Content Type</th><th>Idea</th><th>Notes</th><th>Added</th><th></th></tr>"+
    (ideasCache.length?ideasCache.map(i=>`<tr class='clinicRow' onclick="openIdeaEdit('${i.id}')"><td>${escapeHtml(i.status)}</td><td>${escapeHtml(i.content_type||'')}</td><td><b>${escapeHtml(i.title)}</b></td><td class='muted'>${escapeHtml(preview(i.notes))}</td><td>${when(i.created_at)}</td><td>${canDelete?`<button onclick="event.stopPropagation();deleteIdea('${i.id}')">Delete</button>`:''}</td></tr>`).join(''):"<tr><td colspan='6' class='muted'>No ideas yet. Click \"Create Idea\" to add one.</td></tr>");
}
function ideaFillStatus(){
  document.getElementById('ideaStatus').innerHTML=IDEA_STATUSES.map(s=>`<option value='${s}'>${s}</option>`).join('');
  document.getElementById('ideaContentType').innerHTML=`<option value=''>Select content type...</option>`+IDEA_TYPES.map(s=>`<option value='${s}'>${s}</option>`).join('');
}
function showIdeaError(m){let e=document.getElementById('ideaError');e.textContent=m;e.style.display='block'}
function openIdeaCreate(){
  editingIdeaId=null;ideaFillStatus();
  document.getElementById('ideaModalTitle').textContent='New Idea';
  document.getElementById('ideaStatus').value='New Idea';document.getElementById('ideaContentType').value='';document.getElementById('ideaTitle').value='';document.getElementById('ideaNotes').value='';
  document.getElementById('ideaDeleteBtn').style.display='none';document.getElementById('ideaSaveBtn').style.display='inline-block';
  document.getElementById('ideaError').style.display='none';document.getElementById('ideaModal').classList.add('show');
}
function openIdeaEdit(id){
  let i=ideasCache.find(x=>x.id===id);if(!i)return;
  editingIdeaId=id;ideaFillStatus();
  document.getElementById('ideaModalTitle').textContent=i.title;
  document.getElementById('ideaStatus').value=i.status;document.getElementById('ideaContentType').value=i.content_type||'';document.getElementById('ideaTitle').value=i.title;document.getElementById('ideaNotes').value=i.notes||'';
  document.getElementById('ideaDeleteBtn').style.display=hasRolePermission('business_planner','delete')?'inline-block':'none';
  document.getElementById('ideaSaveBtn').style.display=hasRolePermission('business_planner','edit')?'inline-block':'none';
  document.getElementById('ideaError').style.display='none';document.getElementById('ideaModal').classList.add('show');
}
function closeIdeaModal(){document.getElementById('ideaModal').classList.remove('show');editingIdeaId=null;document.getElementById('ideaSaveBtn').style.display='inline-block'}
async function saveIdea(){
  let title=document.getElementById('ideaTitle').value.trim(),status=document.getElementById('ideaStatus').value,notes=document.getElementById('ideaNotes').value;
  let ctype=document.getElementById('ideaContentType').value;
  if(!ctype)return showIdeaError('Please choose the content type.');
  if(!title)return showIdeaError('Please give the idea a short title.');
  let row={title,status,content_type:ctype,notes:notes.trim()?notes:null,updated_at:new Date().toISOString()};
  let btn=document.getElementById('ideaSaveBtn');btn.disabled=true;btn.textContent='Saving...';
  try{
    let res=editingIdeaId?await sb.from('content_ideas').update(row).eq('id',editingIdeaId):await sb.from('content_ideas').insert(row);
    if(res.error)throw res.error;
    closeIdeaModal();await renderIdeas();
  }catch(e){showIdeaError(e.message||'Could not save the idea.')}
  finally{btn.disabled=false;btn.textContent='Save'}
}
async function deleteIdea(id){
  id=id||editingIdeaId;if(!id)return;
  let i=ideasCache.find(x=>x.id===id);
  if(!confirm(`Delete the idea "${i?i.title:''}"? This cannot be undone.`))return;
  let {error}=await sb.from('content_ideas').delete().eq('id',id);
  if(error)return alert(error.message);
  closeIdeaModal();await renderIdeas();
}
