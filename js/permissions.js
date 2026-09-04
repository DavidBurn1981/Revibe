const REVIBE_PERMISSION_AREAS=[
  {group:'Sunbed Performance',key:'daily_session_tracker',label:'Daily Session Tracker',approve:false},
  {group:'Sunbed Performance',key:'sunbed_bookings',label:'Sunbed Bookings',approve:false},
  {group:'Sunbed Performance',key:'performance_reporting',label:'Performance Reporting',approve:false},
  {group:'Sunbed Performance',key:'sunbed_settings',label:'Sunbed Settings',approve:false},

  {group:'Treatment Bookings',key:'treatment_room_diary',label:'Treatment Room Diary',approve:false},
  {group:'Treatment Bookings',key:'clinic_days',label:'Clinic Days',approve:false},
  {group:'Treatment Bookings',key:'treatment_booking_settings',label:'Treatment Booking Settings',approve:false},
  {group:'Treatment Bookings',key:'my_bookings',label:'My Bookings',approve:false},

  {group:'Staff',key:'staff_members',label:'Staff Members',approve:false},
  {group:'Staff',key:'staff_rota',label:'Staff Rota',approve:false},
  {group:'Staff',key:'holiday_requests',label:'Holiday Requests',approve:true},

  {group:'Admin',key:'users',label:'Users',approve:false},
  {group:'Admin',key:'roles_permissions',label:'Roles & Permissions',approve:false},
  {group:'Admin',key:'finance',label:'Finance',approve:false},
  {group:'Admin',key:'business_planner',label:'Social Media Planning',approve:false},
  {group:'Apartments',key:'apartment_cleans',label:'Apartment Cleans',approve:false},
];
const REVIBE_PAGE_PERMISSION_MAP={
  bedtracker:'daily_session_tracker',
  dailysessions:'daily_session_tracker',
  sunbedbookings:'sunbed_bookings',
  performancereporting:'performance_reporting',
  sunbedsettings:'sunbed_settings',
  openinghours:'sunbed_settings',
  monthlytargets:'sunbed_settings',
  tanningproducts:'sunbed_settings',

  diary:'treatment_room_diary',
  clinic:'clinic_days',
  treatmentsettings:'treatment_booking_settings',
  products:'treatment_booking_settings',
  customers:'treatment_booking_settings',
  renters:'treatment_booking_settings',
  mybookings:'my_bookings',
  mytreatmenttype:'my_treatment_type',

  staffmembers:'staff_members',
  staffrota:'staff_rota',
  holidayrequests:'holiday_requests',

  users:'users',
  rolespermissions:'roles_permissions',
  finance:'finance',
  orders:'finance',
  businessplanner:'business_planner',
  apartmentcleans:'apartment_cleans',
};
async function loadRolePermissions(){
  let {data,error}=await sb.from('role_permissions').select('*');
  if(error)throw error;

  revibeRolePermissions=(data||[]).map(x=>({
    role:x.role,
    key:x.permission_key,
    view:!!x.can_view,
    edit:!!x.can_edit,
    approve:!!x.can_approve,
    delete:!!x.can_delete
  }));
}
function hasRolePermission(key,action='view'){
  if(currentProfile?.role==='admin')return true;
  let p=revibeRolePermissions.find(x=>x.role===currentProfile?.role&&x.key===key);
  if(!p)return false;
  return action==='edit'?p.edit:action==='approve'?p.approve:action==='delete'?p.delete:p.view;
}
function requireRolePermission(key,action='edit',message){
  if(hasRolePermission(key,action))return true;
  alert(message||`Your role does not have permission to ${action==='approve'?'approve':'change'} this area.`);
  return false;
}
const REVIBE_ACTION_PERMISSION_RULES={
  recordBedSession:['daily_session_tracker','edit'],
  saveDailyTakings:['daily_session_tracker','edit'],
  openSunbedBooking:['sunbed_bookings','edit'], saveSunbedBooking:['sunbed_bookings','edit'], completeSunbedBooking:['sunbed_bookings','edit'],
  openTanningProduct:['sunbed_settings','edit'], saveTanningProduct:['sunbed_settings','edit'], deleteTanningProduct:['sunbed_settings','edit'],
  openMonthlyTargetCreate:['sunbed_settings','edit'], openMonthlyTargetEdit:['sunbed_settings','edit'], saveMonthlyTarget:['sunbed_settings','edit'], deleteMonthlyTargetStack:['sunbed_settings','delete'], saveOpeningHours:['sunbed_settings','edit'],
  openBooking:['treatment_room_diary','edit'], saveBooking:['treatment_room_diary','edit'],
  addClinic:['clinic_days','edit'], saveNewClinicDay:['clinic_days','edit'], saveClinicDayEdits:['clinic_days','edit'], deleteClinicDay:['clinic_days','delete'], copyClinicDay:['clinic_days','edit'],
  addProduct:['treatment_booking_settings','edit'], saveNewProduct:['treatment_booking_settings','edit'], deleteCurrentProduct:['treatment_booking_settings','delete'], editCurrentProduct:['treatment_booking_settings','edit'],
  deleteTreatment:['treatment_booking_settings','delete'],
  deleteTreatmentGrouping:['treatment_booking_settings','delete'],
  addRenter:['treatment_booking_settings','edit'], openRenterEdit:['treatment_booking_settings','edit'], saveNewRenter:['treatment_booking_settings','edit'], deleteRenter:['treatment_booking_settings','delete'],
  openCustomerCreate:['treatment_booking_settings','edit'], saveCustomer:['treatment_booking_settings','edit'], deleteCustomer:['treatment_booking_settings','delete'], completeBlockPurchase:['treatment_booking_settings','edit'],
  openStaffMemberCreate:['staff_members','edit'], openStaffMemberEdit:['staff_members','edit'], saveStaffMember:['staff_members','edit'], deleteStaffMember:['staff_members','delete'],
  openStaffShiftCreate:['staff_rota','edit'], saveStaffShift:['staff_rota','edit'],
  addStaffRota:['staff_rota','edit'], saveNewStaffRota:['staff_rota','edit'], deleteStaffRota:['staff_rota','delete'],
  openHolidayRequestCreate:['holiday_requests','edit'], saveHolidayRequest:['holiday_requests','edit'], deleteHolidayRequest:['holiday_requests','edit'], approveHolidayRequest:['holiday_requests','approve'],
  openOrderCreate:['finance','edit'], openOrderEdit:['finance','edit'], saveOrder:['finance','edit'], deleteOrder:['finance','edit'], saveFinanceOutgoings:['finance','edit'],
  addBusinessPlannerAction:['business_planner','edit'], openBusinessPlannerActionEdit:['business_planner','edit'], saveBusinessPlannerAction:['business_planner','edit'], deleteBusinessPlannerAction:['business_planner','delete'],
  addCleaningTask:['apartment_cleans','edit'], saveNewCleaningTask:['apartment_cleans','edit'], deleteCleaningTask:['apartment_cleans','delete'], toggleCleaningTaskComplete:['apartment_cleans','view'],
  saveClinicianNotes:['my_bookings','edit'], deleteMyBooking:['my_bookings','delete'], createBookingFromMyBookings:['my_bookings','edit'], openBookingForClinician:['my_bookings','edit'],
  saveMonthEndReviews:['performance_reporting','edit']
};
function applyPermissionBasedActions(){
  document.querySelectorAll('[onclick]').forEach(el=>{
    let code=el.getAttribute('onclick')||'',m=code.match(/^\s*([A-Za-z_$][\w$]*)\s*\(/);if(!m)return;
    let rule=REVIBE_ACTION_PERMISSION_RULES[m[1]];if(!rule)return;
    let allowed=hasRolePermission(rule[0],rule[1]);
    if(['BUTTON'].includes(el.tagName))el.style.display=allowed?'':'none';
  });
}
function installPermissionGuards(){
  Object.entries(REVIBE_ACTION_PERMISSION_RULES).forEach(([name,[key,action]])=>{
    let original=window[name];if(typeof original!=='function'||original.__revibePermissionWrapped)return;
    let wrapped=function(...args){if(!requireRolePermission(key,action))return;return original.apply(this,args)};
    wrapped.__revibePermissionWrapped=true;window[name]=wrapped;
  });
}
function applyPermissionBasedNavigation(){
  let publicBookingBtn=document.getElementById('customerBookingPageNavButton');
  if(publicBookingBtn)publicBookingBtn.style.display=currentProfile?.role==='admin'?'block':'none';

  document.querySelectorAll('#nav button[data-page]').forEach(btn=>{
    let page=btn.dataset.page,
        key=REVIBE_PAGE_PERMISSION_MAP[page];

    // General Settings is kept Admin-only for now.
    if(page==='settings'){
      btn.style.display=currentProfile?.role==='admin'?'block':'none';
      return;
    }

    if(page==='users'&&['admin','shop_manager'].includes(currentProfile?.role)){
      btn.style.display='block';
      return;
    }
    if(!key)return;
    btn.style.display=hasRolePermission(key,'view')?'block':'none';
  });

  // Hide empty section headings automatically.
  document.querySelectorAll('#nav .navtitle').forEach(title=>{
    if(title.id==='adminNavTitle'){
      let visible=[...document.querySelectorAll('#usersNavButton,#rolesPermissionsNavButton,#financeNavButton,#businessPlannerNavButton')]
        .some(x=>x.style.display!=='none');
      title.style.display=visible?'block':'none';
      return;
    }

    let next=title.nextElementSibling,hasVisible=false;
    while(next && !next.classList.contains('navtitle')){
      if(next.tagName==='BUTTON' && next.style.display!=='none'){hasVisible=true;break;}
      next=next.nextElementSibling;
    }
    title.style.display=hasVisible?'block':'none';
  });

  // If the current visible page is not allowed, move to the first permitted menu page.
  let activePage=document.querySelector('.page.active');
  if(activePage){
    let key=REVIBE_PAGE_PERMISSION_MAP[activePage.id];
    if(key && !hasRolePermission(key,'view')){
      let first=[...document.querySelectorAll('#nav button[data-page]')]
        .find(x=>x.style.display!=='none');
      if(first)goToPage(first.dataset.page);
    }
  }
}
function renderRolePermissionTiles(){
  let host=document.getElementById('rolePermissionTiles');if(!host)return;

  let roles=['admin','shop_manager','staff','renter','customer','cleaner'];

  host.innerHTML=roles.map(role=>{
    let label=REVIBE_ROLE_LABELS[role]||role,
        count=REVIBE_PERMISSION_AREAS.filter(a=>{
          let p=revibeRolePermissions.find(x=>x.role===role&&x.key===a.key);
          return role==='admin'||p?.view;
        }).length;

    return `<div class='producttile roleTile ${role==='admin'?'locked':''}' onclick="openRolePermissionDetail('${role}')">
      <h3>${label}</h3>
      <div class='count'>${role==='admin'?'Full Access — Locked':`${count} areas visible`}</div>
      <div class='openhint'>Configure →</div>
    </div>`;
  }).join('');
}
function renderRolesPermissions(){
  renderRolePermissionTiles();
}
function openRolePermissionDetail(role){
  editingPermissionRole=role;
  workingRolePermissions={};

  REVIBE_PERMISSION_AREAS.forEach(area=>{
    let saved=revibeRolePermissions.find(x=>x.role===role&&x.key===area.key);
    workingRolePermissions[area.key]={
      view:role==='admin'?true:!!saved?.view,
      edit:role==='admin'?true:!!saved?.edit,
      approve:role==='admin'?true:!!saved?.approve,
      delete:role==='admin'?true:!!saved?.delete
    };
  });

  document.getElementById('rolePermissionTiles').style.display='none';
  document.getElementById('rolePermissionDetail').style.display='block';

  document.getElementById('rolePermissionTitle').textContent=
    `${REVIBE_ROLE_LABELS[role]||role} Permissions`;

  document.getElementById('rolePermissionSubtitle').textContent=
    role==='admin'
      ?'Admin always has full access. These permissions are locked.'
      :'Tick what this role can view, create/edit and approve.';

  document.getElementById('savePermissionsBtn').style.display=
    role==='admin'?'none':'inline-block';

  document.getElementById('copyPermissionsBtn').style.display=
    role==='admin'?'none':'inline-block';

  renderPermissionsMatrix();
}
function closeRolePermissionDetail(){
  editingPermissionRole=null;
  workingRolePermissions={};
  document.getElementById('rolePermissionDetail').style.display='none';
  document.getElementById('rolePermissionTiles').style.display='grid';
  renderRolePermissionTiles();
}
function renderPermissionsMatrix(){
  let t=document.getElementById('permissionsMatrixTable');if(!t)return;

  let html=`<tr><th>Area / Function</th><th>View</th><th>Create / Edit</th><th>Approve</th><th>Delete</th></tr>`,
      currentGroup=null,
      locked=editingPermissionRole==='admin';

  REVIBE_PERMISSION_AREAS.forEach(area=>{
    if(area.group!==currentGroup){
      currentGroup=area.group;
      html+=`<tr class='permissionGroupRow'><td colspan='5'>${area.group}</td></tr>`;
    }

    let p=workingRolePermissions[area.key]||{view:false,edit:false,approve:false,delete:false};

    html+=`<tr class='${locked?'permissionDisabled':''}'>
      <td>
        <b>${area.label}</b>
        ${area.key==='roles_permissions'?`<div class='permissionNote'>Admin access control configuration</div>`:''}
      </td>
      <td><input class='permissionCheck' type='checkbox' ${p.view?'checked':''} ${locked?'disabled':''} onchange="changeWorkingPermission('${area.key}','view',this.checked)"></td>
      <td><input class='permissionCheck' type='checkbox' ${p.edit?'checked':''} ${locked?'disabled':''} onchange="changeWorkingPermission('${area.key}','edit',this.checked)"></td>
      <td>${area.approve
        ?`<input class='permissionCheck' type='checkbox' ${p.approve?'checked':''} ${locked?'disabled':''} onchange="changeWorkingPermission('${area.key}','approve',this.checked)">`
        :'—'
      }</td>
      <td><input class='permissionCheck' type='checkbox' ${p.delete?'checked':''} ${locked?'disabled':''} onchange="changeWorkingPermission('${area.key}','delete',this.checked)"></td>
    </tr>`;
  });

  t.innerHTML=html;
}
function changeWorkingPermission(key,action,value){
  let p=workingRolePermissions[key]||(workingRolePermissions[key]={view:false,edit:false,approve:false,delete:false});

  p[action]=value;

  // Edit/Approve/Delete imply View.
  if((action==='edit'||action==='approve'||action==='delete')&&value)p.view=true;

  // Removing View removes Edit + Approve + Delete.
  if(action==='view'&&!value){
    p.edit=false;
    p.approve=false;
    p.delete=false;
  }

  renderPermissionsMatrix();
}
async function saveRolePermissions(){
  if(currentProfile?.role!=='admin'||!editingPermissionRole||editingPermissionRole==='admin')return;

  let btn=document.getElementById('savePermissionsBtn');
  btn.disabled=true;btn.textContent='Saving...';

  try{
    for(let area of REVIBE_PERMISSION_AREAS){
      let p=workingRolePermissions[area.key]||{view:false,edit:false,approve:false,delete:false};

      let {error}=await sb.rpc('revibe_save_role_permission',{
        p_role:editingPermissionRole,
        p_permission_key:area.key,
        p_can_view:!!p.view,
        p_can_edit:!!p.edit,
        p_can_approve:!!p.approve,
        p_can_delete:!!p.delete
      });

      if(error)throw error;
    }

    await loadRolePermissions();
    renderRolePermissionTiles();
    alert('Permissions saved.');
  }catch(e){
    alert('Could not save permissions: '+(e.message||e));
  }finally{
    btn.disabled=false;
    btn.textContent='Save Permissions';
  }
}
function openCopyPermissions(){
  if(!editingPermissionRole||editingPermissionRole==='admin')return;

  let roles=['admin','shop_manager','staff','renter','customer','cleaner']
    .filter(r=>r!==editingPermissionRole);

  document.getElementById('copyPermissionsSource').innerHTML=
    roles.map(r=>`<option value='${r}'>${REVIBE_ROLE_LABELS[r]||r}</option>`).join('');

  document.getElementById('copyPermissionsModal').classList.add('show');
}
function closeCopyPermissions(){
  document.getElementById('copyPermissionsModal').classList.remove('show');
}
function applyCopiedPermissions(){
  let source=document.getElementById('copyPermissionsSource').value;

  REVIBE_PERMISSION_AREAS.forEach(area=>{
    let saved=revibeRolePermissions.find(x=>x.role===source&&x.key===area.key);

    workingRolePermissions[area.key]={
      view:source==='admin'?true:!!saved?.view,
      edit:source==='admin'?true:!!saved?.edit,
      approve:source==='admin'?true:!!saved?.approve,
      delete:source==='admin'?true:!!saved?.delete
    };
  });

  closeCopyPermissions();
  renderPermissionsMatrix();
}
const REVIBE_ROLE_LABELS={
  admin:'Admin',
  shop_manager:'Shop Manager',
  staff:'Staff',
  renter:'Clinician',
  customer:'Customer',
  cleaner:'Cleaner'
};
const REVIBE_ROLE_DESCRIPTIONS={
  admin:'Full system owner. User/security administration plus all operational areas.',
  shop_manager:'Operational management role. Access is controlled from Admin → Roles & Permissions.',
  staff:'Internal shop user. Access is controlled from Admin → Roles & Permissions.',
  renter:'Clinician login. Access is controlled from Admin → Roles & Permissions; record-level clinic restrictions still apply.',
  customer:'Customer portal login. Access is controlled from Admin → Roles & Permissions.',
  cleaner:'Apartment Cleans login only. Can view the cleaning calendar and mark tasks Complete; cannot create, edit or delete tasks.'
};
