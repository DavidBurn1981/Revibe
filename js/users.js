function selectedUserTreatmentProductIds(){
  return [...document.querySelectorAll('#userTreatmentTypeChoices input[type="checkbox"]:checked')].map(x=>x.value);
}
function populateUserTreatmentTypeChoices(selectedIds=null){
  let host=document.getElementById('userTreatmentTypeChoices');if(!host)return;
  let clinicianId=document.getElementById('userClinicianLink')?.value||'',
      clinician=data.renters.find(r=>r.id===clinicianId);
  if(selectedIds==null)selectedIds=clinician?.productIds||[];
  let products=(data.products||[]).filter(p=>p.active!==false);
  host.innerHTML=products.length?products.map(p=>`<label class='checkchoice'><input type='checkbox' value='${p.id}' ${selectedIds.includes(p.id)?'checked':''}><span>${escapeHtml(p.name)}</span></label>`).join(''):`<div class='muted'>No Treatment Types have been configured.</div>`;
}
async function saveClinicianTreatmentAssignments(renterId,productIds){
  if(!renterId)return;
  let del=await sb.from('renter_products').delete().eq('renter_id',renterId);
  if(del.error)throw del.error;
  if(productIds.length){
    let ins=await sb.from('renter_products').insert(productIds.map(productId=>({renter_id:renterId,product_id:productId})));
    if(ins.error)throw ins.error;
  }
}
function updateUserRoleFields(){
  let role=document.getElementById('userRole').value,
      wrap=document.getElementById('userClinicianLinkWrap'),
      typesWrap=document.getElementById('userTreatmentTypesWrap');
  wrap.style.display=role==='renter'?'block':'none';
  typesWrap.style.display=role==='renter'?'block':'none';
  if(role==='renter')populateUserTreatmentTypeChoices();
  document.getElementById('userRoleDescription').innerHTML=
    `<b>${REVIBE_ROLE_LABELS[role]}</b><div class='muted' style='margin-top:6px'>${REVIBE_ROLE_DESCRIPTIONS[role]}</div>`;
}
async function loadRevibeUsers(){
  if(!['admin','shop_manager'].includes(currentProfile?.role)){revibeUsers=[];return;}
  let {data,error}=await sb.rpc('revibe_list_manageable_users');
  if(error)throw error;
  revibeUsers=(data||[]).map(x=>({
    id:x.id,
    email:x.email||'',
    fullName:x.full_name||'',
    role:x.role,
    active:x.active,
    clinicianId:x.renter_id||null,
    createdAt:x.created_at,
    mustChangePassword:!!x.must_change_password
  }));
}
function openTemporaryPasswordModal(id,email){
  if(!['admin','shop_manager'].includes(currentProfile?.role))return;
  temporaryPasswordUserId=id;
  temporaryPasswordUserEmail=email||'';
  document.getElementById('temporaryPasswordUserLabel').textContent=email||'User';
  document.getElementById('temporaryPasswordValue').value='';
  document.getElementById('temporaryPasswordValue').type='password';
  document.getElementById('temporaryPasswordShowBtn').textContent='Show';
  document.getElementById('temporaryPasswordError').style.display='none';
  generateTemporaryPassword();
  document.getElementById('temporaryPasswordModal').classList.add('show');
}
function closeTemporaryPasswordModal(){
  document.getElementById('temporaryPasswordModal').classList.remove('show');
  document.getElementById('temporaryPasswordValue').value='';
  temporaryPasswordUserId=null;
  temporaryPasswordUserEmail='';
}
function generateTemporaryPassword(){
  const words=['Glow','Nova','Luxe','Pulse','Aura','Vivid','Solar','Bloom','Neon','Velvet'];
  const word=words[Math.floor(Math.random()*words.length)];
  const number=String(Math.floor(1000+Math.random()*9000));
  const symbols=['!','@','#','£'];
  const symbol=symbols[Math.floor(Math.random()*symbols.length)];
  document.getElementById('temporaryPasswordValue').value=`Revibe-${word}-${number}${symbol}`;
}
function toggleTemporaryPassword(){
  let input=document.getElementById('temporaryPasswordValue'),btn=document.getElementById('temporaryPasswordShowBtn');
  input.type=input.type==='password'?'text':'password';
  btn.textContent=input.type==='password'?'Show':'Hide';
}
async function setTemporaryPassword(){
  let password=document.getElementById('temporaryPasswordValue').value,
      err=document.getElementById('temporaryPasswordError'),
      btn=document.getElementById('temporaryPasswordSaveBtn');
  err.style.display='none';
  if(!temporaryPasswordUserId)return;
  if(password.length<10){err.textContent='Temporary password must be at least 10 characters.';err.style.display='block';return;}
  btn.disabled=true;btn.textContent='Setting...';
  try{
    const {data:{session},error:sessionError}=await sb.auth.getSession();
    if(sessionError||!session?.access_token)throw new Error('Your login session could not be read.');
    const response=await fetch(`${SUPABASE_URL}/functions/v1/manage-revibe-user`,{
      method:'POST',
      headers:{'Content-Type':'application/json','apikey':SUPABASE_KEY,'Authorization':`Bearer ${session.access_token}`},
      body:JSON.stringify({action:'set_temp_password',user_id:temporaryPasswordUserId,temporary_password:password})
    });
    let payload={};try{payload=await response.json()}catch(_){}
    if(!response.ok)throw new Error(payload?.error||`Could not set temporary password (HTTP ${response.status}).`);
    alert(`Temporary password set for ${temporaryPasswordUserEmail}. Give the password to the user securely. They will be forced to change it when they next sign in.`);
    closeTemporaryPasswordModal();
    await loadRevibeUsers();renderUsers();
  }catch(e){
    err.textContent=e?.message||String(e);err.style.display='block';
  }finally{
    btn.disabled=false;btn.textContent='Set Password';
  }
}
async function completeForcedPasswordChange(){
  let p1=document.getElementById('forcedNewPassword').value,
      p2=document.getElementById('forcedConfirmPassword').value,
      err=document.getElementById('forcedPasswordError'),
      btn=document.getElementById('forcedPasswordSaveBtn');
  err.style.display='none';
  if(p1.length<10){err.textContent='Please choose a password of at least 10 characters.';err.style.display='block';return;}
  if(p1!==p2){err.textContent='The passwords do not match.';err.style.display='block';return;}
  btn.disabled=true;btn.textContent='Saving...';
  try{
    let {error:updateError}=await sb.auth.updateUser({password:p1});
    if(updateError)throw updateError;
    let {error:flagError}=await sb.rpc('revibe_complete_password_change');
    if(flagError)throw flagError;
    document.getElementById('forcedPasswordGate').style.display='none';
    document.getElementById('forcedNewPassword').value='';
    document.getElementById('forcedConfirmPassword').value='';
    currentProfile.must_change_password=false;
    await bootRevibe();
  }catch(e){
    err.textContent=e?.message||String(e);err.style.display='block';
  }finally{
    btn.disabled=false;btn.textContent='Set New Password';
  }
}
async function manageUser(action,id,email){
 if(currentProfile?.role!=='admin')return alert('Admin access required.');
 if(action==='delete'&&!confirm(`Delete ${email}? This removes their login.`))return;
 try{
   const {data:{session},error:sessionError}=await sb.auth.getSession();
   if(sessionError||!session?.access_token)throw new Error('Your login session could not be read. Please sign out and back in.');
   const response=await fetch(`${SUPABASE_URL}/functions/v1/manage-revibe-user`,{
     method:'POST',
     headers:{
       'Content-Type':'application/json',
       'apikey':SUPABASE_KEY,
       'Authorization':`Bearer ${session.access_token}`
     },
     body:JSON.stringify({action,user_id:id,email,redirect_to:location.origin})
   });
   let payload={};
   try{payload=await response.json()}catch(_){}
   if(!response.ok)throw new Error(payload?.error||`User management failed (HTTP ${response.status}).`);
   alert(action==='delete'?'User deleted.':(action==='resend_invite'?'Password setup email sent.':'Password reset email sent.'));
   if(typeof loadUsers==='function')await loadUsers();
   renderUsers();
 }catch(e){
   console.error('REVIBE user management failed:',e);
   alert(e?.message||String(e));
 }
}
function renderUsers(){
  let table=document.getElementById('usersTable');if(!table)return;
  if(!['admin','shop_manager'].includes(currentProfile?.role)){
    table.innerHTML=`<tr><td class='muted'>Admin or Shop Manager access required.</td></tr>`;
    return;
  }

  table.innerHTML=`<tr><th>Name</th><th>Email / Login</th><th>Access Level</th><th>Linked Record</th><th>Status</th><th>Account Actions</th></tr>`+
    (revibeUsers.length?revibeUsers.map(u=>{
      let clinician=data.renters.find(r=>r.id===u.clinicianId);
      return `<tr class='userEditRow ${u.active?'':'userInactive'}' ${currentProfile?.role==='admin'?`onclick="openEditUserModal('${u.id}')"`:''}>
        <td><b>${escapeHtml(u.fullName||'')}</b></td>
        <td>${escapeHtml(u.email)}</td>
        <td><span class='userRoleBadge'>${escapeHtml(REVIBE_ROLE_LABELS[u.role]||u.role)}</span></td>
        <td>${u.role==='renter'?escapeHtml(clinician?.name||'Not linked'):''}</td>
        <td>${u.active?'Active':'Inactive'}${u.mustChangePassword?`<div class='muted' style='margin-top:4px'>Temporary password set</div>`:''}</td><td>
          <button onclick="event.stopPropagation();openTemporaryPasswordModal('${u.id}','${u.email}')">Set Temporary Password</button>
          ${currentProfile?.role==='admin'?`<button onclick="event.stopPropagation();manageUser('resend_invite','${u.id}','${u.email}')">Resend Invite</button> <button onclick="event.stopPropagation();manageUser('password_reset','${u.id}','${u.email}')">Reset Password</button> <button onclick="event.stopPropagation();manageUser('delete','${u.id}','${u.email}')">Delete</button>`:''}
        </td>
      </tr>`;
    }).join(''):`<tr><td colspan='6' class='muted'>No users found.</td></tr>`);
}
function populateUserClinicians(){
  document.getElementById('userClinicianLink').innerHTML=
    `<option value=''>Select clinician</option>`+
    (data.renters||[]).map(r=>`<option value='${r.id}'>${r.name}</option>`).join('');
}
function openCreateUserModal(){
  if(currentProfile?.role!=='admin')return;
  editingUserId=null;
  populateUserClinicians();
  document.getElementById('userModalTitle').textContent='Create User';
  document.getElementById('userModalSubtitle').textContent='Send an login so the user can set their own password.';
  document.getElementById('userFullName').value='';
  document.getElementById('userEmail').value='';
  document.getElementById('userEmail').readOnly=false;
  document.getElementById('userRole').value='staff';
  document.getElementById('userClinicianLink').value='';
  document.getElementById('userActiveWrap').style.display='none';
  document.getElementById('userSaveButton').textContent='Create User';
  document.getElementById('userFormError').style.display='none';
  updateUserRoleFields();
  document.getElementById('userModal').classList.add('show');
}
function openEditUserModal(id){
  if(currentProfile?.role!=='admin')return;
  let u=revibeUsers.find(x=>x.id===id);if(!u)return;
  editingUserId=id;
  populateUserClinicians();
  document.getElementById('userModalTitle').textContent='Edit User';
  document.getElementById('userModalSubtitle').textContent='Change the user’s details, email, REVIBE role or active status.';
  document.getElementById('userFullName').value=u.fullName||'';
  document.getElementById('userEmail').value=u.email||'';
  document.getElementById('userEmail').readOnly=false;
  document.getElementById('userRole').value=u.role;
  document.getElementById('userClinicianLink').value=u.clinicianId||'';
  document.getElementById('userActive').checked=!!u.active;
  document.getElementById('userActiveWrap').style.display='block';
  document.getElementById('userSaveButton').textContent='Save Changes';
  document.getElementById('userFormError').style.display='none';
  updateUserRoleFields();
  document.getElementById('userModal').classList.add('show');
}
function closeUserModal(){
  document.getElementById('userModal').classList.remove('show');
  editingUserId=null;
}
async function saveUser(){
  if(currentProfile?.role!=='admin')return;

  let name=document.getElementById('userFullName').value.trim(),
      email=document.getElementById('userEmail').value.trim(),
      role=document.getElementById('userRole').value,
      clinicianId=role==='renter'?(document.getElementById('userClinicianLink').value||null):null,
      clinicianProductIds=role==='renter'?selectedUserTreatmentProductIds():[],
      err=document.getElementById('userFormError'),
      btn=document.getElementById('userSaveButton');

  err.style.display='none';

  if(!name){
    err.textContent='Please enter a name.';
    err.style.display='block';
    return;
  }

  if(!email){
    err.textContent='Please enter an email address.';
    err.style.display='block';
    return;
  }

  if(role==='renter'&&!clinicianId){
    err.textContent='Please link this Clinician login to a Clinician record.';
    err.style.display='block';
    return;
  }
  if(role==='renter'&&!clinicianProductIds.length){
    err.textContent='Please select at least one Treatment Type for this Clinician.';
    err.style.display='block';
    return;
  }

  btn.disabled=true;
  btn.textContent=editingUserId?'Saving...':'Creating User...';

  try{
    if(editingUserId){
      let existing=revibeUsers.find(x=>x.id===editingUserId);

      if(existing && existing.email!==email){
        const {data:{session},error:sessionError}=await sb.auth.getSession();
        if(sessionError||!session?.access_token)throw new Error('Your login session could not be read.');

        const response=await fetch(`${SUPABASE_URL}/functions/v1/manage-revibe-user`,{
          method:'POST',
          headers:{
            'Content-Type':'application/json',
            'apikey':SUPABASE_KEY,
            'Authorization':`Bearer ${session.access_token}`
          },
          body:JSON.stringify({
            action:'update_email',
            user_id:editingUserId,
            email
          })
        });

        let payload={};
        try{payload=await response.json()}catch(_){}

        if(!response.ok){
          throw new Error(payload?.error||`Could not update email (HTTP ${response.status}).`);
        }
      }

      let {error}=await sb.rpc('revibe_admin_update_user',{
        p_user_id:editingUserId,
        p_full_name:name,
        p_role:role,
        p_active:document.getElementById('userActive').checked,
        p_renter_id:clinicianId
      });

      if(error)throw error;

    }else{
      // Creates the Supabase login immediately.
      // No invitation email is required.
      let {data,error}=await sb.functions.invoke('create-revibe-user',{
        body:{
          email,
          full_name:name,
          role,
          renter_id:clinicianId
        }
      });

      if(error){
        let msg=error.message||'Could not create user.';
        try{
          if(error.context){
            let body=await error.context.json();
            if(body?.error)msg=body.error;
          }
        }catch(_){}
        throw new Error(msg);
      }

      if(data?.error)throw new Error(data.error);
    }

    if(role==='renter')await saveClinicianTreatmentAssignments(clinicianId,clinicianProductIds);
    await loadLiveData();
    await loadRevibeUsers();
    renderAll();

    let createdEmail=email;
    let wasNew=!editingUserId;

    closeUserModal();

    if(wasNew){
      let created=revibeUsers.find(x=>x.email.toLowerCase()===createdEmail.toLowerCase());
      if(created){
        if(confirm(`User created successfully for ${createdEmail}.\n\nSet a temporary password now?`)){
          openTemporaryPasswordModal(created.id,created.email);
        }
      }else{
        alert(`User created successfully for ${createdEmail}. You can now use Set Temporary Password from the Users list.`);
      }
    }

  }catch(e){
    err.textContent=e?.message||'Could not save user.';
    err.style.display='block';
  }finally{
    btn.disabled=false;
    btn.textContent=editingUserId?'Save Changes':'Create User';
  }
}
