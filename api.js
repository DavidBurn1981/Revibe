async function loadAllBedSessions(){
  const pageSize=1000;
  let allRows=[];
  let from=0;

  while(true){
    let {data:rows,error}=await sb
      .from('bed_sessions')
      .select('*')
      .order('session_date',{ascending:true})
      .order('session_time',{ascending:true})
      .order('id',{ascending:true})
      .range(from,from+pageSize-1);

    if(error)return {data:null,error};

    rows=rows||[];
    allRows.push(...rows);

    if(rows.length<pageSize)break;
    from+=pageSize;
  }

  return {data:allRows,error:null};
}
async function loadLiveData(){
  let [products,treatments,treatmentGroupings,renters,renterProducts,clinics,bookings,beds,sunbeds,sessions,staffMembers,staffShifts,monthlyTargets,monthlyReviewCounts,holidayRequests,dailyTakings,orders,financeOutgoings,customers,tanningProducts,customerTransactions,hours,hist,businessPlannerActions,staffRotas]=await Promise.all([
    sb.from('products').select('*').order('name'),
    sb.from('treatments').select('*').order('name'),
    sb.from('treatment_groupings').select('*').order('display_order'),
    sb.from('renters').select('*').order('name'),
    sb.from('renter_products').select('*'),
    sb.from('clinic_days').select('*').order('clinic_date'),
    sb.from('treatment_bookings').select('*').order('booking_date'),
    sb.from('beds').select('*').order('bed_number'),
    sb.from('sunbed_bookings').select('*').order('booking_date'),
    loadAllBedSessions(),
    sb.from('staff_members').select('*').order('name'),
    sb.from('staff_shifts').select('*').order('shift_date'),
    sb.from('monthly_targets').select('*').order('target_month'),
    sb.from('monthly_review_counts').select('*').order('review_year').order('review_month'),
    sb.from('holiday_requests').select('*').order('start_date'),
    sb.from('daily_takings').select('*').order('takings_date'),
    sb.from('orders').select('*').order('order_date'),
    sb.from('finance_outgoings').select('*').order('finance_year').order('finance_month'),
    sb.from('customers').select('*').order('last_name'),
    sb.from('tanning_rlt_products').select('*').order('title'),
    sb.from('customer_transactions').select('*').order('created_at'),
    sb.from('opening_hours').select('*').order('day_of_week'),
    sb.from('opening_hours_history').select('*').order('effective_from'),
    sb.from('business_planner_actions').select('*').order('action_date'),
    sb.from('staff_rotas').select('*').order('week_start_date',{ascending:false})
  ]);
  let err=[products,treatments,treatmentGroupings,renters,renterProducts,clinics,bookings,beds,sunbeds,sessions,staffMembers,staffShifts,monthlyTargets,monthlyReviewCounts,holidayRequests,dailyTakings,orders,financeOutgoings,customers,tanningProducts,customerTransactions,hours,hist,businessPlannerActions,staffRotas].find(x=>x.error)?.error;
  if(err)throw err;
  data.products=products.data.map(x=>({id:x.id,name:x.name,active:x.active}));
  data.treatmentGroupings=treatmentGroupings.data.map(x=>({id:x.id,productId:x.product_id,name:x.name,displayOrder:+x.display_order||0}));
  data.businessPlannerActions=businessPlannerActions.data.map(x=>({id:x.id,date:x.action_date,description:x.description,ownerStaffId:x.owner_staff_id}));
  data.staffRotas=staffRotas.data.map(x=>({id:x.id,weekStart:x.week_start_date}));
  data.treatments=treatments.data.map(x=>({id:x.id,productId:x.product_id,product:data.products.find(p=>p.id===x.product_id)?.name||'',name:x.name,duration:x.duration_minutes,buffer:x.buffer_minutes,price:+x.price,active:x.active,groupingId:x.grouping_id}));
  data.renters=renters.data.map(x=>{
    let links=renterProducts.data.filter(y=>y.renter_id===x.id),
        productIds=links.map(y=>y.product_id).filter(Boolean),
        productNames=productIds.map(id=>data.products.find(p=>p.id===id)?.name).filter(Boolean),
        firstId=productIds[0]||null,
        firstName=productNames[0]||'';
    return {id:x.id,name:x.name,phone:x.phone,email:x.email,active:x.active,productIds,productNames,productId:firstId,product:firstName,instagramUrl:x.instagram_url,facebookUrl:x.facebook_url,tiktokUrl:x.tiktok_url,websiteUrl:x.website_url,introParagraph:x.intro_paragraph};
  });
  data.clinicDays=clinics.data.map(x=>({id:x.id,date:x.clinic_date,renterId:x.renter_id,productId:x.product_id,product:data.products.find(p=>p.id===x.product_id)?.name||'',start:(x.start_time||'').slice(0,5),end:(x.end_time||'').slice(0,5),discountPercent:+x.provided_discount_percent||0,rentalCharge:+x.rental_charge||0}));
  data.appointments=bookings.data.map(x=>({id:x.id,clinicDayId:x.clinic_day_id,durationMinutes:+x.duration_minutes||0,date:x.booking_date,time:(x.start_time||'').slice(0,5),treatmentId:x.treatment_id,customerName:x.customer_name,customerPhone:x.customer_phone,price:+x.price,clinicDiscountPercent:+x.clinic_discount_percent,amountPayable:+x.amount_payable,notes:x.notes,status:x.status}));
  data.beds=beds.data.map(x=>({id:x.id,name:x.name,number:x.bed_number,type:x.bed_type,active:x.active}));
  data.sunbedBookings=sunbeds.data.map(x=>{let b=data.beds.find(y=>y.id===x.bed_id);return {id:x.id,name:x.customer_name,phone:x.customer_phone,date:x.booking_date,time:(x.start_time||'').slice(0,5),length:x.session_length_minutes,totalMinutes:x.session_length_minutes+x.turnaround_minutes,bed:b?.name||'',bedType:b?.type||'',sessionType:x.session_type,status:x.status}});
  data.bedSessions=sessions.data.map(x=>({id:x.id,date:x.session_date,time:(x.session_time||'').slice(0,5),length:x.session_length_minutes,payment:x.payment_type,newSignup:x.new_sign_up,purchasedBlockBooking:x.purchased_block_booking,sessionType:x.session_type,createdAt:x.created_at}));data.staffMembers=staffMembers.data.map(x=>({id:x.id,name:x.name,address:x.address||'',phone:x.phone_number||'',dateOfJoining:x.date_of_joining,holidayEntitlement:+x.holiday_entitlement_this_year||0,holidaysRemaining:+x.holidays_remaining||0,colour:x.rota_colour||'#18d7e8',active:x.active}));data.staffShifts=staffShifts.data.map(x=>({id:x.id,staffId:x.staff_member_id,date:x.shift_date,start:(x.start_time||'').slice(0,5),end:(x.end_time||'').slice(0,5),hours:+x.shift_hours||0}));data.monthlyTargets=monthlyTargets.data.map(x=>({
    id:x.id,
    month:x.target_month,
    monthNumber:+x.target_month_number || new Date(x.target_month+'T00:00:00').getMonth()+1,
    year:+x.target_year || new Date(x.target_month+'T00:00:00').getFullYear(),
    target:+x.mins_per_bed_per_hour_target||0,
    signupTarget:+x.new_sign_ups_target||0,
    rltSessionsTarget:+x.rlt_only_sessions_target||0,
    totalMinutesTarget:+x.total_minutes_target||0,
    newReviewsTarget:+x.new_reviews_target||0,rltCaseStudiesTarget:+x.rlt_case_studies_target||0,bonus1Kpi:+x.bonus_1_kpi||0,bonus1Amount:+x.bonus_1_amount||0,bonus2Kpi:+x.bonus_2_kpi||0,bonus2Amount:+x.bonus_2_amount||0,bonus3Kpi:+x.bonus_3_kpi||0,bonus3Amount:+x.bonus_3_amount||0
  }));
  data.monthlyReviewCounts=monthlyReviewCounts.data.map(x=>({id:x.id,month:+x.review_month,year:+x.review_year,facebook:+x.facebook_reviews||0,google:+x.google_reviews||0}));
  data.holidayRequests=holidayRequests.data.map(x=>({
    id:x.id,staffId:x.staff_member_id,startDate:x.start_date,endDate:x.end_date,daysTotal:+x.days_total||0,status:x.status,
    approvedById:x.approved_by_staff_member_id,approvedDate:x.approved_date
  }));
  data.dailyTakings=dailyTakings.data.map(x=>({id:x.id,date:x.takings_date,cash:+x.cash_taken||0,treatmentsCard:+x.treatments_card_taken||0,bedCard:+x.bed_card_taken||0,fridgeReading:x.fridge_reading===null||x.fridge_reading===undefined?'':+x.fridge_reading}));
  data.orders=orders.data.map(x=>({id:x.id,description:x.description,date:x.order_date,supplier:x.supplier||'',amount:+x.amount||0,card:x.card_used,staffId:x.ordered_by_staff_member_id}));
  data.financeOutgoings=financeOutgoings.data.map(x=>({id:x.id,month:+x.finance_month,year:+x.finance_year,wages:x.wages==null?null:+x.wages,rent:+x.rent,bedHire:+x.bed_hire,insurance:+x.insurance}));
  data.customers=customers.data.map(x=>({id:x.id,accountNumber:x.account_number,firstName:x.first_name,lastName:x.last_name,name:`${x.first_name} ${x.last_name}`,dob:x.date_of_birth,phone:x.phone_number||'',address:x.address||'',uv:x.intends_uv_or_injectables,idChecked:x.id_checked,idCheckedDate:x.id_checked_date,minutesLeft:+x.minutes_left||0,active:x.active}));
  data.tanningProducts=tanningProducts.data.map(x=>({id:x.id,type:x.product_type,title:x.title,description:x.description||'',minutes:x.minute_amount==null?null:+x.minute_amount,price:+x.price||0,stock:x.current_stock_level==null?null:+x.current_stock_level,active:x.active}));
  data.customerTransactions=customerTransactions.data.map(x=>({id:x.id,customerId:x.customer_id,type:x.transaction_type,product:x.product_title_snapshot||'',value:+x.total_value||0,minutes:+x.minutes_change||0,balance:+x.balance_after||0,createdAt:x.created_at}));

  let mapped={};hours.data.forEach(x=>{let js=x.day_of_week===7?0:x.day_of_week;mapped[js]={open:(x.opening_time||'').slice(0,5),close:(x.closing_time||'').slice(0,5)}});data.openingHours=mapped;
  data.openingHoursHistory=(hist.data||[]).map(x=>({
    day:x.day_of_week===7?0:x.day_of_week,
    open:(x.opening_time||'').slice(0,5),
    close:(x.closing_time||'').slice(0,5),
    effectiveFrom:x.effective_from,
    effectiveTo:x.effective_to
  }));
}
async function loginRevibe(){
  let email=document.getElementById('loginEmail').value.trim(),password=document.getElementById('loginPassword').value,box=document.getElementById('loginError');
  box.style.display='none';let {error}=await sb.auth.signInWithPassword({email,password});
  if(error){box.textContent=error.message;box.style.display='block';return;}await bootRevibe();
}
async function logoutRevibe(){await sb.auth.signOut();location.reload()}
async function runRevibeAuthDebug(showPanel=true){
  let out=document.getElementById('debugOutput');
  try{
    let {data:{session}}=await sb.auth.getSession();
    let sessionSummary=session?{
      access_token_present:!!session.access_token,
      user_id:session.user?.id||null,
      user_email:session.user?.email||null,
      expires_at:session.expires_at||null
    }:{session:null};

    let rpc=await sb.rpc('revibe_auth_debug');
    let result={
      browser_session:sessionSummary,
      rpc_data:rpc.data,
      rpc_error:rpc.error?{
        message:rpc.error.message,
        details:rpc.error.details,
        hint:rpc.error.hint,
        code:rpc.error.code
      }:null
    };
    out.textContent=JSON.stringify(result,null,2);
    if(showPanel)document.getElementById('debugPanel').style.display='block';
    return result;
  }catch(e){
    out.textContent=JSON.stringify({exception:e.message||String(e)},null,2);
    if(showPanel)document.getElementById('debugPanel').style.display='block';
    return null;
  }
}
async function bootRevibe(){
  let {data:{session}}=await sb.auth.getSession();
  if(!session){document.body.classList.remove('loading');document.querySelector('.app').style.display='none';document.getElementById('loginGate').style.display='flex';return;}
  currentUser=session.user;
  let {data:profile,error}=await sb.from('profiles').select('*').eq('id',currentUser.id).single();
  if(error||!profile||!profile.active){await sb.auth.signOut();return alert('Your Revibe account is not active.');}
  currentProfile=profile;
  if(profile.must_change_password){
    document.getElementById('loginGate').style.display='none';
    document.querySelector('.app').style.display='none';
    document.getElementById('forcedPasswordGate').style.display='flex';
    document.body.classList.remove('loading');
    return;
  }
  try{await loadLiveData();await loadRolePermissions();if(['admin','shop_manager'].includes(profile.role))await loadRevibeUsers()}catch(e){return alert('Could not load Revibe data: '+e.message)}
  document.getElementById('loginGate').style.display='none';document.querySelector('.app').style.display='grid';document.body.classList.remove('loading');
  let ub=document.getElementById('userBar');ub.style.display='block';ub.innerHTML=`${escapeHtml(profile.full_name||currentUser.email)} · ${escapeHtml(profile.role)} &nbsp; <button onclick='logoutRevibe()'>Sign out</button>`;
  updatePreferredBedOptions();installPermissionGuards();renderAll();
  let dailyPicker=document.getElementById('dailySessionsDatePicker');
  if(dailyPicker&&!dailyPicker.value)dailyPicker.value=localDateKey();
  applyPermissionBasedNavigation();applyPermissionBasedActions();
}
