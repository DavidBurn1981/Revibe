function getCurrentMonthlyTarget(){
  let now=currentMonthIdentity();
  return data.monthlyTargets.find(x=>x.monthNumber===now.month&&x.year===now.year)?.target ?? null;
}
function renderMonthlyTargets(){
  let table=document.getElementById('monthlyTargetsTable');if(!table)return;
  let canEdit=hasRolePermission('sunbed_settings','edit'),
      createBtn=document.getElementById('createMonthlyTargetBtn');
  if(createBtn)createBtn.style.display=canEdit?'inline-block':'none';

  let rows=[...(data.monthlyTargets||[])].sort((a,b)=>b.year-a.year||b.monthNumber-a.monthNumber);
  table.innerHTML=`<tr><th>Month</th><th>Year</th><th>Mins / Bed / Hour</th><th>New Sign Ups</th><th>RLT Only Sessions</th><th>Total Minutes</th><th>New Reviews</th><th>Status</th></tr>`+
    (rows.length?rows.map(x=>{
      let current=currentMonthIdentity(),isCurrent=x.monthNumber===current.month&&x.year===current.year;
      return `<tr ${canEdit?`class='clinicRow' onclick="openMonthlyTargetEdit('${x.id}')"`:''}><td><b>${MONTH_NAMES[x.monthNumber-1]}</b></td><td>${x.year}</td><td>${Number(x.target).toFixed(1)}</td><td>${x.signupTarget}</td><td>${x.rltSessionsTarget}</td><td>${x.totalMinutesTarget}</td><td>${x.newReviewsTarget}</td><td>${isCurrent?`<span class='pill'>Current Month</span>`:''}</td></tr>`;
    }).join(''):`<tr><td colspan='8' class='muted'>No monthly target stacks created yet.</td></tr>`);
}
function openingHoursForWholeMonth(monthNumber,year){
  if(!monthNumber||!year)return 0;
  let days=new Date(year,monthNumber,0).getDate(),total=0;
  for(let day=1;day<=days;day++){
    let key=`${year}-${String(monthNumber).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
    total+=hoursDuration(effectiveHoursForDate(key));
  }
  return total;
}
function calculatedMonthlyMinutesTarget(monthNumber,year,kpiTarget){
  let hours=openingHoursForWholeMonth(monthNumber,year);
  return Math.round((+kpiTarget||0)*BED_COUNT*hours);
}
function updateAutoTotalMinutesTarget(){
  let field=document.getElementById('monthlyTotalMinutesTarget');if(!field)return;
  let month=+document.getElementById('targetMonthNumber')?.value,
      year=+document.getElementById('targetYear')?.value,
      kpi=+document.getElementById('monthlyKpiTarget')?.value;
  field.value=calculatedMonthlyMinutesTarget(month,year,kpi);
  field.title=`Calculated from ${kpi||0} mins × ${BED_COUNT} beds × ${openingHoursForWholeMonth(month,year).toFixed(1)} opening hours`;
}
function populateTargetMonthOptions(){
  document.getElementById('targetMonthNumber').innerHTML=MONTH_NAMES.map((m,i)=>`<option value='${i+1}'>${m}</option>`).join('');
}
function openMonthlyTargetCreate(){
  if(!requireRolePermission('sunbed_settings','edit'))return;
  editingMonthlyTargetId=null;
  populateTargetMonthOptions();
  let now=currentMonthIdentity();
  document.getElementById('targetMonthNumber').value=String(now.month);
  document.getElementById('targetYear').value=String(now.year);
  document.getElementById('targetMonthNumber').disabled=false;
  document.getElementById('targetYear').readOnly=false;
  document.getElementById('monthlyKpiTarget').value='';
  document.getElementById('monthlySignupTarget').value='';
  document.getElementById('monthlyRltSessionsTarget').value='';
  document.getElementById('monthlyTotalMinutesTarget').value='0';
  document.getElementById('monthlyNewReviewsTarget').value='';document.getElementById('monthlyRltCaseStudiesTarget').value='';['bonus1Kpi','bonus1Amount','bonus2Kpi','bonus2Amount','bonus3Kpi','bonus3Amount'].forEach(id=>document.getElementById(id).value='');
  ['bonus1Perf','bonus2Perf','bonus3Perf'].forEach(id=>document.getElementById(id).textContent='Performance: —');
  document.getElementById('monthlyTargetModalTitle').textContent='Create Monthly Target Stack';
  updateAutoTotalMinutesTarget();
  document.getElementById('monthlyTargetError').style.display='none';
  document.getElementById('monthlyTargetDeleteButton').style.display='none';document.getElementById('monthlyTargetModal').classList.add('show');
}
function openMonthlyTargetEdit(id){
  if(!requireRolePermission('sunbed_settings','edit'))return;
  let row=data.monthlyTargets.find(x=>x.id===id);if(!row)return;
  editingMonthlyTargetId=id;
  populateTargetMonthOptions();
  document.getElementById('targetMonthNumber').value=String(row.monthNumber);
  document.getElementById('targetYear').value=String(row.year);
  document.getElementById('monthlyKpiTarget').value=String(row.target);
  document.getElementById('monthlySignupTarget').value=String(row.signupTarget);
  document.getElementById('monthlyRltSessionsTarget').value=String(row.rltSessionsTarget);
  document.getElementById('monthlyTotalMinutesTarget').value=String(calculatedMonthlyMinutesTarget(row.monthNumber,row.year,row.target));
  document.getElementById('monthlyNewReviewsTarget').value=String(row.newReviewsTarget);document.getElementById('monthlyRltCaseStudiesTarget').value=String(row.rltCaseStudiesTarget||0);for(let i=1;i<=3;i++){document.getElementById(`bonus${i}Kpi`).value=row[`bonus${i}Kpi`]||0;document.getElementById(`bonus${i}Amount`).value=row[`bonus${i}Amount`]||0;let a=monthPerformanceActuals(row.monthNumber,row.year),t=row[`bonus${i}Kpi`]||0,pct=t?a.kpi/t*100:0;document.getElementById(`bonus${i}Perf`).innerHTML=`Actual ${a.kpi.toFixed(2)} · ${pct.toFixed(0)}%<div class='progressTrack'><div class='progressFill' style='width:${Math.min(100,pct)}%'></div></div>`}
  // Month + Year are the immutable unique identity of a target stack.
  document.getElementById('targetMonthNumber').disabled=true;
  document.getElementById('targetYear').readOnly=true;
  document.getElementById('monthlyTargetModalTitle').textContent=`${MONTH_NAMES[row.monthNumber-1]} ${row.year} Target Stack`;
  document.getElementById('monthlyTargetError').style.display='none';
  document.getElementById('monthlyTargetDeleteButton').style.display='inline-block';
  document.getElementById('monthlyTargetModal').classList.add('show');
}
async function deleteMonthlyTargetStack(){if(!editingMonthlyTargetId)return alert('Save the Target Stack first.');if(!confirm('Delete this monthly Target Stack?'))return;let {error}=await sb.from('monthly_targets').delete().eq('id',editingMonthlyTargetId);if(error)return alert(error.message);closeMonthlyTargetModal();await loadLiveData();renderMonthlyTargets();renderPerformanceReporting()}
function closeMonthlyTargetModal(){
  document.getElementById('monthlyTargetModal').classList.remove('show');
  editingMonthlyTargetId=null;
}
async function saveMonthlyTarget(){
  if(!requireRolePermission('sunbed_settings','edit'))return;
  let monthNumber=+document.getElementById('targetMonthNumber').value,
      year=+document.getElementById('targetYear').value,
      target=+document.getElementById('monthlyKpiTarget').value,
      signupTarget=+document.getElementById('monthlySignupTarget').value,
      rltSessionsTarget=+document.getElementById('monthlyRltSessionsTarget').value,
      totalMinutesTarget=calculatedMonthlyMinutesTarget(monthNumber,year,target),
      newReviewsTarget=+document.getElementById('monthlyNewReviewsTarget').value,rltCaseStudiesTarget=+document.getElementById('monthlyRltCaseStudiesTarget').value,bonus1Kpi=+document.getElementById('bonus1Kpi').value||0,bonus1Amount=+document.getElementById('bonus1Amount').value||0,bonus2Kpi=+document.getElementById('bonus2Kpi').value||0,bonus2Amount=+document.getElementById('bonus2Amount').value||0,bonus3Kpi=+document.getElementById('bonus3Kpi').value||0,bonus3Amount=+document.getElementById('bonus3Amount').value||0,
      err=document.getElementById('monthlyTargetError'),
      btn=document.getElementById('monthlyTargetSaveBtn');
  err.style.display='none';
  if(monthNumber<1||monthNumber>12)return showMonthlyTargetError('Please select a valid month.');
  if(!Number.isInteger(year)||year<2020||year>2100)return showMonthlyTargetError('Please enter a valid year.');
  if(!Number.isFinite(target)||target<0)return showMonthlyTargetError('Please enter a valid Mins Per Bed Per Hour target.');
  if(!Number.isInteger(signupTarget)||signupTarget<0)return showMonthlyTargetError('Please enter a valid New Sign Ups target.');
  if(!Number.isInteger(rltSessionsTarget)||rltSessionsTarget<0)return showMonthlyTargetError('Please enter a valid Red Light Therapy Only Sessions target.');
  if(!Number.isInteger(totalMinutesTarget)||totalMinutesTarget<0)return showMonthlyTargetError('Please enter a valid Total Minutes target.');
  if(!Number.isInteger(newReviewsTarget)||newReviewsTarget<0)return showMonthlyTargetError('Please enter a valid New Reviews target.');

  btn.disabled=true;btn.textContent='Saving...';
  try{
    let error;
    if(editingMonthlyTargetId){
      ({error}=await sb.from('monthly_targets')
        .update({mins_per_bed_per_hour_target:target,new_sign_ups_target:signupTarget,rlt_only_sessions_target:rltSessionsTarget,total_minutes_target:totalMinutesTarget,new_reviews_target:newReviewsTarget,rlt_case_studies_target:rltCaseStudiesTarget,bonus_1_kpi:bonus1Kpi,bonus_1_amount:bonus1Amount,bonus_2_kpi:bonus2Kpi,bonus_2_amount:bonus2Amount,bonus_3_kpi:bonus3Kpi,bonus_3_amount:bonus3Amount,updated_at:new Date().toISOString()})
        .eq('id',editingMonthlyTargetId));
    }else{
      // target_month retained for compatibility; Month + Year are the explicit unique identity.
      let targetMonth=`${year}-${String(monthNumber).padStart(2,'0')}-01`;
      ({error}=await sb.from('monthly_targets').insert({
        target_month:targetMonth,
        target_month_number:monthNumber,
        target_year:year,
        mins_per_bed_per_hour_target:target,
        new_sign_ups_target:signupTarget,
        rlt_only_sessions_target:rltSessionsTarget,
        total_minutes_target:totalMinutesTarget,
        new_reviews_target:newReviewsTarget,rlt_case_studies_target:rltCaseStudiesTarget,bonus_1_kpi:bonus1Kpi,bonus_1_amount:bonus1Amount,bonus_2_kpi:bonus2Kpi,bonus_2_amount:bonus2Amount,bonus_3_kpi:bonus3Kpi,bonus_3_amount:bonus3Amount
      }));
    }
    if(error){
      if(error.code==='23505')throw new Error(`A target stack already exists for ${MONTH_NAMES[monthNumber-1]} ${year}.`);
      throw error;
    }
    closeMonthlyTargetModal();
    await loadLiveData();
    renderMonthlyTargets();
    renderBedTracker();
  }catch(e){showMonthlyTargetError(e.message||'Could not save target stack.');}
  finally{btn.disabled=false;btn.textContent='Save Target Stack';}
}
function showMonthlyTargetError(message){
  let err=document.getElementById('monthlyTargetError');
  err.textContent=message;err.style.display='block';
}
function getTargetStackFor(monthNumber,year){
  return (data.monthlyTargets||[]).find(x=>x.monthNumber===monthNumber&&x.year===year)||null;
}
function reportingMonthStatus(monthNumber,year){
  let now=new Date(),monthStart=new Date(year,monthNumber-1,1),
      monthEnd=new Date(year,monthNumber,0),
      currentMonth=now.getFullYear()===year&&now.getMonth()+1===monthNumber,
      historical=monthEnd<new Date(now.getFullYear(),now.getMonth(),now.getDate()),
      future=monthStart>now;

  let effectiveEnd=future?monthStart:(currentMonth?now:monthEnd),
      daysInMonth=monthEnd.getDate(),
      daysElapsed=future?0:(currentMonth?Math.min(now.getDate(),daysInMonth):daysInMonth);

  return {now,monthStart,monthEnd,effectiveEnd,daysInMonth,daysElapsed,currentMonth,historical,future};
}
function monthPerformanceActuals(monthNumber,year){
  let status=reportingMonthStatus(monthNumber,year);
  if(status.future)return {minutes:0,hours:0,kpi:0,signups:0,rltSessions:0,daysElapsed:0,daysInMonth:status.daysInMonth};

  let keys=dateRangeKeys(status.monthStart,status.effectiveEnd),
      rows=performanceSessions((data.bedSessions||[]).filter(x=>keys.includes(x.date))),
      minutes=rows.reduce((sum,x)=>sum+(+x.length||0),0),
      signups=rows.filter(x=>x.newSignup===true||x.newSignup==='Yes').length,
      rltSessions=rows.filter(x=>normalizeSessionType(x)==='Red Light Therapy').length,
      hours=periodOpenHours(keys),
      kpi=hours>0?minutes/BED_COUNT/hours:0;

  return {minutes,hours,kpi,signups,rltSessions,daysElapsed:status.daysElapsed,daysInMonth:status.daysInMonth};
}
function onTrackTarget(fullTarget,daysElapsed,daysInMonth){
  if(!daysInMonth)return 0;
  return (+fullTarget||0)/daysInMonth*daysElapsed;
}
function performanceNumber(label,value,className=''){
  return `<div class='performanceNumber ${className}'><div class='label'>${label}</div><div class='value'>${value}</div></div>`;
}
function getReviewCountRecord(monthNumber,year){
  return (data.monthlyReviewCounts||[]).find(x=>x.month===monthNumber&&x.year===year)||null;
}
function previousMonthIdentity(monthNumber,year){
  return monthNumber===1?{month:12,year:year-1}:{month:monthNumber-1,year};
}
function calculateNewReviews(monthNumber,year){
  let current=getReviewCountRecord(monthNumber,year),
      prevId=previousMonthIdentity(monthNumber,year),
      previous=getReviewCountRecord(prevId.month,prevId.year);

  if(!current||!previous)return {actual:null,current,previous};

  let currentTotal=(+current.facebook||0)+(+current.google||0),
      previousTotal=(+previous.facebook||0)+(+previous.google||0);

  return {actual:Math.max(0,currentTotal-previousTotal),current,previous,currentTotal,previousTotal};
}
function reviewPerformanceCard(stack,monthNumber,year){
  let reviews=calculateNewReviews(monthNumber,year),
      target=+stack.newReviewsTarget||0;

  if(reviews.actual==null){
    return `<div class='performanceReportCard'>
      <h3>New Reviews</h3>
      <div class='performanceReportNumbers'>
        ${performanceNumber('Month Target',target)}
        ${performanceNumber('Actual','—')}
      </div>
      <div class='performanceReportFormula'>Review totals have not yet been recorded for both this month and the previous month.</div>
    </div>`;
  }

  let cls=reviews.actual>=target?'actualGood':'actualBad';
  return `<div class='performanceReportCard'>
    <h3>New Reviews</h3>
    <div class='performanceReportNumbers'>
      ${performanceNumber('Month Target',target)}
      ${performanceNumber('Actual',reviews.actual,cls)}
    </div>
    <div class='performanceReportFormula'>(${reviews.current.facebook} Facebook + ${reviews.current.google} Google) − (${reviews.previous.facebook} Facebook + ${reviews.previous.google} Google) = ${reviews.actual} new reviews.</div>
  </div>`;
}
function buildPerformanceCards(stack,monthNumber,year){
  let actual=monthPerformanceActuals(monthNumber,year),
      signupTrack=onTrackTarget(stack.signupTarget,actual.daysElapsed,actual.daysInMonth),
      rltTrack=onTrackTarget(stack.rltSessionsTarget,actual.daysElapsed,actual.daysInMonth),
      minsTrack=onTrackTarget(stack.totalMinutesTarget,actual.daysElapsed,actual.daysInMonth),
      kpiClass=actual.kpi>=stack.target?'actualGood':'actualBad',
      signupClass=actual.signups>=signupTrack?'actualGood':'actualBad',
      rltClass=actual.rltSessions>=rltTrack?'actualGood':'actualBad',
      minsClass=actual.minutes>=minsTrack?'actualGood':'actualBad';

  return `<div class='performanceReportGrid'>
    <div class='performanceReportCard'>
      <h3>Mins Per Bed Per Hour</h3>
      <div class='performanceReportNumbers'>
        ${performanceNumber('Target',Number(stack.target).toFixed(1))}
        ${performanceNumber('Actual',actual.kpi.toFixed(1),kpiClass)}
      </div>
      <div class='performanceReportFormula'>${actual.minutes} total minutes ÷ ${BED_COUNT} beds ÷ ${actual.hours.toFixed(1)} opening hours.</div>
    </div>

    <div class='performanceReportCard'>
      <h3>New Sign Ups</h3>
      <div class='performanceReportNumbers'>
        ${performanceNumber('Month Target',stack.signupTarget)}
        ${performanceNumber('On Track Target',signupTrack.toFixed(1))}
        ${performanceNumber('Actual',actual.signups,signupClass)}
      </div>
      <div class='performanceReportFormula'>On Track Target = ${stack.signupTarget} ÷ ${actual.daysInMonth} days × ${actual.daysElapsed} days elapsed.</div>
    </div>

    <div class='performanceReportCard'>
      <h3>Red Light Therapy Only Sessions</h3>
      <div class='performanceReportNumbers'>
        ${performanceNumber('Month Target',stack.rltSessionsTarget)}
        ${performanceNumber('On Track Target',rltTrack.toFixed(1))}
        ${performanceNumber('Actual',actual.rltSessions,rltClass)}
      </div>
      <div class='performanceReportFormula'>On Track Target = ${stack.rltSessionsTarget} ÷ ${actual.daysInMonth} days × ${actual.daysElapsed} days elapsed.</div>
    </div>

    <div class='performanceReportCard'>
      <h3>Total Minutes Used</h3>
      <div class='performanceReportNumbers'>
        ${performanceNumber('Month Target',stack.totalMinutesTarget)}
        ${performanceNumber('On Track Target',minsTrack.toFixed(0))}
        ${performanceNumber('Actual',actual.minutes,minsClass)}
      </div>
      <div class='performanceReportFormula'>On Track Target = ${stack.totalMinutesTarget} ÷ ${actual.daysInMonth} days × ${actual.daysElapsed} days elapsed.</div>
    </div>
    ${reviewPerformanceCard(stack,monthNumber,year)}
  </div>`;
}
function renderPerformanceReporting(){
  let host=document.getElementById('performanceReportingContent');if(!host)return;
  let now=currentMonthIdentity(),stack=getTargetStackFor(now.month,now.year);
  document.getElementById('performanceReportingPeriod').textContent=`${MONTH_NAMES[now.month-1]} ${now.year} · performance to date`;

  let currentHtml=`<div class='currentMonthPerformanceStrip'><div class='performanceSectionTitle'>Current Month</div>`;
  if(!stack){
    currentHtml+=`<div class='performanceReportEmpty'>No target stack has been created for ${MONTH_NAMES[now.month-1]} ${now.year}. Create one under Sunbed Performance → Settings → Monthly Targets.</div>`;
  }else{
    currentHtml+=buildPerformanceCards(stack,now.month,now.year);
  }

  let monthStatus=reportingMonthStatus(now.month,now.year),
      revenueKeys=dateRangeKeys(monthStatus.monthStart,monthStatus.effectiveEnd),
      revenue=periodRevenue(revenueKeys);
  currentHtml+=`<div class='revenueToDateStrip'><div class='performanceSectionTitle'>Revenue to Date</div><div class='revenueGrid'>
    <div class='revenueMetric'><div class='label'>Cash Taken</div><div class='value'>£${revenue.cash.toFixed(2)}</div></div>
    <div class='revenueMetric'><div class='label'>Treatments Card</div><div class='value'>£${revenue.treatments.toFixed(2)}</div></div>
    <div class='revenueMetric'><div class='label'>Bed Card</div><div class='value'>£${revenue.beds.toFixed(2)}</div></div>
    <div class='revenueMetric'><div class='label'>Total</div><div class='value'>£${revenue.total.toFixed(2)}</div></div>
  </div></div>`;

  let monthSessionRows=performanceSessions(data.bedSessions.filter(x=>{let d=parseLocalDateKey(x.date);return d.getMonth()+1===now.month&&d.getFullYear()===now.year;}));
  currentHtml+=`<div class='revenueToDateStrip'><div class='performanceSectionTitle'>Session Insight</div><div class='revenueGrid'><div class='revenueMetric'><div class='label'>Average Session Length</div><div class='value'>${monthSessionRows.length?(monthSessionRows.reduce((s,x)=>s+x.length,0)/monthSessionRows.length).toFixed(1):'0.0'} min</div></div></div></div>`;
  let previous=(data.monthlyTargets||[])
    .filter(x=>x.year<now.year || (x.year===now.year&&x.monthNumber<now.month))
    .sort((a,b)=>b.year-a.year||b.monthNumber-a.monthNumber);

  currentHtml+=`</div>`;

  let historyHtml=`<div class='performanceHistory'>
    <div class='performanceSectionTitle'>Previous Months</div>`;

  if(!previous.length){
    historyHtml+=`<div class='performanceReportEmpty'>No previous monthly target records yet.</div>`;
  }else{
    historyHtml+=`<div class='card'><table class='table'>
      <tr><th>Month</th><th>Mins / Bed / Hour</th><th>New Sign Ups</th><th>RLT Only Sessions</th><th>Total Minutes</th><th>New Reviews</th><th></th></tr>
      ${previous.map(x=>{
        let a=monthPerformanceActuals(x.monthNumber,x.year),
            kpiGood=a.kpi>=x.target,
            signupGood=a.signups>=x.signupTarget,
            rltGood=a.rltSessions>=x.rltSessionsTarget,
            minsGood=a.minutes>=x.totalMinutesTarget,
            reviewData=calculateNewReviews(x.monthNumber,x.year),
            reviewsGood=reviewData.actual!=null&&reviewData.actual>=x.newReviewsTarget;
        return `<tr class='performanceHistoryRow' onclick="openHistoricalPerformance('${x.id}')">
          <td><b>${MONTH_NAMES[x.monthNumber-1]} ${x.year}</b></td>
          <td><span class='${kpiGood?'historyStatusGood':'historyStatusBad'}'>${a.kpi.toFixed(1)}</span> / ${Number(x.target).toFixed(1)}</td>
          <td><span class='${signupGood?'historyStatusGood':'historyStatusBad'}'>${a.signups}</span> / ${x.signupTarget}</td>
          <td><span class='${rltGood?'historyStatusGood':'historyStatusBad'}'>${a.rltSessions}</span> / ${x.rltSessionsTarget}</td>
          <td><span class='${minsGood?'historyStatusGood':'historyStatusBad'}'>${a.minutes}</span> / ${x.totalMinutesTarget}</td>
          <td>${reviewData.actual==null?'—':`<span class='${reviewsGood?'historyStatusGood':'historyStatusBad'}'>${reviewData.actual}</span> / ${x.newReviewsTarget}`}</td>
          <td>Open →</td>
        </tr>`;
      }).join('')}
    </table></div>`;
  }
  historyHtml+=`</div>`;

  host.innerHTML=currentHtml+historyHtml;
}
function openHistoricalPerformance(id){
  let stack=data.monthlyTargets.find(x=>x.id===id);if(!stack)return;
  document.getElementById('historicalPerformanceTitle').textContent=`${MONTH_NAMES[stack.monthNumber-1]} ${stack.year} Performance`;
  document.getElementById('historicalPerformanceSubtitle').textContent='Historic month performance against the targets set for that month.';
  document.getElementById('historicalPerformanceContent').innerHTML=buildPerformanceCards(stack,stack.monthNumber,stack.year);
  document.getElementById('historicalPerformanceModal').classList.add('show');
}
function closeHistoricalPerformance(){document.getElementById('historicalPerformanceModal').classList.remove('show')}
function renderOpeningHours(){
  let t=document.getElementById('openingHoursTable');if(!t)return;
  let canEdit=hasRolePermission('sunbed_settings','edit');
  t.innerHTML="<tr><th>Day</th><th>Opening Time</th><th>Closing Time</th></tr>"+[1,2,3,4,5,6,0].map(day=>{
    let h=(data.openingHours||DEFAULT_OPENING_HOURS)[day]||DEFAULT_OPENING_HOURS[day];
    return `<tr><td><b>${DAY_NAMES[day]}</b></td><td><input type='time' id='open_${day}' value='${h.open}' ${canEdit?'':'disabled'}></td><td><input type='time' id='close_${day}' value='${h.close}' ${canEdit?'':'disabled'}></td></tr>`
  }).join('');
  let saveBtn=document.querySelector("button[onclick='saveOpeningHours()']");if(saveBtn)saveBtn.style.display=canEdit?'':'none';
}
async function saveOpeningHours(){
  if(!requireRolePermission('sunbed_settings','edit'))return;
  for(let day of [0,1,2,3,4,5,6]){
    let open=document.getElementById('open_'+day).value,close=document.getElementById('close_'+day).value;
    if(!open||!close||timeToMinutes(close)<=timeToMinutes(open))return alert(`Please enter valid opening and closing times for ${DAY_NAMES[day]}.`);
    let dbDay=day===0?7:day,{error}=await sb.from('opening_hours').update({opening_time:open,closing_time:close}).eq('day_of_week',dbDay);
    if(error)return alert(error.message);
  }
  await loadLiveData();renderOpeningHours();renderBedTracker();alert('Opening hours saved.');
}
