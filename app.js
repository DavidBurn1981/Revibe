function toggleMobileNav(){
  document.body.classList.toggle('mobileNavOpen');
}
function openCustomerBookingPage(){
  window.open('book.html','_blank','noopener');
}
function closeMobileNav(){
  document.body.classList.remove('mobileNavOpen');
}
window.addEventListener('resize',()=>{
  if(window.innerWidth>650)closeMobileNav();
});
document.addEventListener('click',(e)=>{
  if(e.target.closest && e.target.closest('#nav button'))closeMobileNav();
});
function resetPageScroll(){window.scrollTo({top:0,left:0,behavior:'instant'});document.querySelector('.main')?.scrollTo?.({top:0,left:0,behavior:'instant'})}
function renderPageForNavigation(pageId){
  switch(pageId){
    case 'performancereporting':
      renderBedTracker();
      renderPerformanceReporting();
      break;
    case 'monthlytargets':
      renderMonthlyTargets();
      break;
    case 'openinghours':
      renderOpeningHours();
      break;
    case 'sunbedbookings':
      renderSunbedCalendar();
      break;
    case 'diary':
      renderCalendar();
      break;
    case 'clinic':
      renderClinicDays();
      break;
    case 'mybookings':
      renderMyBookings();
      break;
    case 'mytreatmenttype':
      renderMyTreatmentType();
      break;
    case 'products':
      renderProducts();
      renderProductDetail();
      break;
    case 'customers':
      renderCustomers();
      break;
    case 'tanningproducts':
      renderTanningProducts();
      break;
    case 'renters':
      renderTables();
      break;
    case 'staffmembers':
      renderStaffMembers();
      break;
    case 'staffrota':
      backToStaffRotaList();
      break;
    case 'holidayrequests':
      renderHolidayRequests();
      break;
    case 'dailysessions': {
      let today=localDateKey(),
          dailyPicker=document.getElementById('dailySessionsDatePicker');
      if(dailyPicker)dailyPicker.value=today;
      renderDailySessionsPage(today);
      break;
    }
    case 'bedtracker': {
      let today=localDateKey(),
          sessionDate=document.getElementById('sessionDate'),
          sessionDateDisplay=document.getElementById('sessionDateDisplay');
      if(sessionDate)sessionDate.value=today;
      if(sessionDateDisplay)sessionDateDisplay.value=formatSunbedDisplayDate(today);
      renderBedTracker();
      break;
    }
    case 'users':
      renderUsers();
      break;
    case 'rolespermissions':
      renderRolesPermissions();
      break;
    case 'finance':
      renderFinance();
      break;
    case 'orders':
      renderOrders();
      break;
    case 'businessplanner':
      renderBusinessPlanner();
      break;
    case 'apartmentcleans':
      renderApartmentCleans();
      break;
    case 'customerpurchases':
      renderCustomerPurchases();
      break;
  }
}
function goToPage(pageId){
  resetPageScroll();

  document.querySelectorAll('nav button,.page').forEach(x=>x.classList.remove('active'));

  let page=document.getElementById(pageId);
  if(!page)return;

  page.classList.add('active');

  let navBtn=document.querySelector(`[data-page="${pageId}"]`);
  if(navBtn)navBtn.classList.add('active');

  renderPageForNavigation(pageId);
  applyPermissionBasedActions();

  setTimeout(()=>{
    makeTablesSortable();
    applyPermissionBasedActions();
  },0);
}
function makeTablesSortable(){
 document.querySelectorAll('table.table').forEach(table=>table.querySelectorAll('th').forEach((th,i)=>{
  if(th.dataset.sortReady)return;th.dataset.sortReady='1';th.classList.add('sortable');th.innerHTML+=`<span class='sortIcon'>↕</span>`;
  th.onclick=()=>{let rows=[...table.querySelectorAll('tr')].slice(1),asc=th.dataset.asc!=='true';rows.sort((a,b)=>{let av=a.children[i]?.innerText.trim()||'',bv=b.children[i]?.innerText.trim()||'',an=parseFloat(av.replace(/[£,%]/g,'')),bn=parseFloat(bv.replace(/[£,%]/g,''));return ((!isNaN(an)&&!isNaN(bn))?an-bn:av.localeCompare(bv,undefined,{numeric:true}))*(asc?1:-1)});rows.forEach(r=>table.appendChild(r));th.dataset.asc=String(asc)}
 }))
}
function renderAll(){
  renderCalendar();
  renderSunbedCalendar();
  renderStaffMembers();
  renderStaffRota();
  renderStaffRotaList();
  renderHolidayRequests();
  renderUsers();
  renderRolesPermissions();
  renderFinance();
  renderOrders();
  renderCustomers();
  renderTanningProducts();
  renderTables();
  renderBedTracker();
  renderOpeningHours();
  renderMonthlyTargets();
  renderPerformanceReporting();
  renderBusinessPlanner();
  renderApartmentCleans();
  renderMyBookings();
  renderMyTreatmentType();
  renderPurchaseLists();
  renderCustomerPurchases();
  applyPermissionBasedActions();

  setTimeout(()=>{
    makeTablesSortable();
    applyPermissionBasedActions();
  },0);

  if(document.getElementById('dailysessions')?.classList.contains('active')){
    let dailyPicker=document.getElementById('dailySessionsDatePicker');
    if(dailyPicker&&!dailyPicker.value)dailyPicker.value=localDateKey();
    renderDailySessionsPage(dailyPicker?.value||localDateKey());
  }
}
document.getElementById('nav').onclick=e=>{
  let btn=e.target.closest('button[data-page]');
  if(!btn)return;
  goToPage(btn.dataset.page);
};
document.getElementById('prev').onclick=()=>{weekStart.setDate(weekStart.getDate()-displayDays);renderCalendar()};document.getElementById('next').onclick=()=>{weekStart.setDate(weekStart.getDate()+displayDays);renderCalendar()};document.getElementById('today').onclick=()=>{weekStart=startMonday(new Date());renderCalendar()};document.getElementById('sunbedPrev').onclick=()=>{sunbedWeekStart.setDate(sunbedWeekStart.getDate()-7);renderSunbedCalendar()};document.getElementById('sunbedNext').onclick=()=>{sunbedWeekStart.setDate(sunbedWeekStart.getDate()+7);renderSunbedCalendar()};document.getElementById('sunbedToday').onclick=()=>{sunbedWeekStart=startMonday(new Date());renderSunbedCalendar()};function changeDiaryRange(){displayDays=+document.getElementById('diaryRange').value||7;weekStart=startMonday(new Date());renderCalendar()};
function resetDemo(){alert('Prototype reset is disabled in the live system.')}
