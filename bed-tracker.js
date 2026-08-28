function exclusiveSessionType(which){let r=document.getElementById('sessionRlt'),h=document.getElementById('sessionHybrid');if(which==='rlt'&&r.checked)h.checked=false;if(which==='hybrid'&&h.checked)r.checked=false}
function normalizeSessionType(x){if(x.sessionType)return x.sessionType;if(x.redLight)return 'Red Light Therapy';if(x.hybrid)return 'Hybrid';return 'Standard UV'}
function isPerformanceSession(x){let p=String(x?.payment||'').trim().toLowerCase();return p!=='free session'&&p!=='free'}
function performanceSessions(rows){return (rows||[]).filter(isPerformanceSession)}
function isLastDayOfCurrentMonth(){
  let d=new Date();
  return d.getDate()===new Date(d.getFullYear(),d.getMonth()+1,0).getDate();
}
function renderMonthlyReviewsRecorder(){
  let tile=document.getElementById('monthlyReviewsRecorder');if(!tile)return;
  if(!isLastDayOfCurrentMonth()){tile.style.display='none';return;}

  tile.style.display='block';
  let now=currentMonthIdentity(),existing=getReviewCountRecord(now.month,now.year);
  document.getElementById('monthEndFacebookReviews').value=existing?existing.facebook:'';
  document.getElementById('monthEndGoogleReviews').value=existing?existing.google:'';

  let canEdit=hasRolePermission('performance_reporting','edit');
  document.getElementById('monthEndFacebookReviews').readOnly=!canEdit;
  document.getElementById('monthEndGoogleReviews').readOnly=!canEdit;
  document.getElementById('monthEndReviewSaveBtn').style.display=canEdit?'inline-block':'none';
}
async function saveMonthEndReviews(){
  if(!requireRolePermission('performance_reporting','edit'))return;
  let facebook=+document.getElementById('monthEndFacebookReviews').value,
      google=+document.getElementById('monthEndGoogleReviews').value,
      err=document.getElementById('monthEndReviewError'),
      btn=document.getElementById('monthEndReviewSaveBtn'),
      now=currentMonthIdentity();

  err.style.display='none';
  if(!Number.isInteger(facebook)||facebook<0||!Number.isInteger(google)||google<0){
    err.textContent='Please enter valid Facebook and Google review totals.';
    err.style.display='block';
    return;
  }

  btn.disabled=true;btn.textContent='Saving...';
  try{
    let {error}=await sb.from('monthly_review_counts').upsert({
      review_month:now.month,
      review_year:now.year,
      facebook_reviews:facebook,
      google_reviews:google,
      updated_at:new Date().toISOString()
    },{onConflict:'review_year,review_month'});
    if(error)throw error;
    await loadLiveData();
    renderMonthlyReviewsRecorder();
    renderPerformanceReporting();
  }catch(e){
    err.textContent=e.message||'Could not save review totals.';
    err.style.display='block';
  }finally{
    btn.disabled=false;btn.textContent='Record Review Totals';
  }
}
function getDailyTakings(dateKey){return (data.dailyTakings||[]).find(x=>x.date===dateKey)||null}
function takingsTotal(x){return x?(+x.cash||0)+(+x.treatmentsCard||0)+(+x.bedCard||0):0}
function updateDailyTakingsTotal(){
  let total=(+document.getElementById('dailyCashTaken').value||0)+(+document.getElementById('dailyTreatmentsCardTaken').value||0)+(+document.getElementById('dailyBedCardTaken').value||0);
  document.getElementById('dailyTakingsTotal').textContent=`£${total.toFixed(2)}`;
}
function setDailyTakingsDate(key){document.getElementById('dailyTakingsDate').value=key;document.getElementById('dailyTakingsDateDisplay').value=formatSunbedDisplayDate(key);renderDailyTakings()}
function renderDailyTakings(){
  let hidden=document.getElementById('dailyTakingsDate');if(!hidden)return;
  if(!hidden.value)hidden.value=localDateKey();let key=hidden.value,row=getDailyTakings(key);
  document.getElementById('dailyTakingsDateDisplay').value=formatSunbedDisplayDate(key);
  document.getElementById('dailyCashTaken').value=(+row?.cash||0).toFixed(2);document.getElementById('dailyTreatmentsCardTaken').value=(+row?.treatmentsCard||0).toFixed(2);document.getElementById('dailyBedCardTaken').value=(+row?.bedCard||0).toFixed(2);updateDailyTakingsTotal();
  let canEdit=hasRolePermission('daily_session_tracker','edit');['dailyCashTaken','dailyTreatmentsCardTaken','dailyBedCardTaken'].forEach(id=>document.getElementById(id).readOnly=!canEdit);document.getElementById('saveDailyTakingsBtn').style.display=canEdit?'inline-block':'none';
}
async function saveDailyTakings(){if(!requireRolePermission('daily_session_tracker','edit'))return;let key=document.getElementById('dailyTakingsDate').value||localDateKey(),cash=+document.getElementById('dailyCashTaken').value,treatments=+document.getElementById('dailyTreatmentsCardTaken').value,beds=+document.getElementById('dailyBedCardTaken').value,err=document.getElementById('dailyTakingsError'),btn=document.getElementById('saveDailyTakingsBtn');err.style.display='none';if([cash,treatments,beds].some(x=>!Number.isFinite(x)||x<0)){err.textContent='Please enter valid takings amounts.';err.style.display='block';return}btn.disabled=true;btn.textContent='Saving...';try{let {error}=await sb.from('daily_takings').upsert({takings_date:key,cash_taken:cash,treatments_card_taken:treatments,bed_card_taken:beds,updated_at:new Date().toISOString()},{onConflict:'takings_date'});if(error)throw error;await loadLiveData();renderDailyTakings();renderPerformanceReporting()}catch(e){err.textContent=e.message||'Could not save Daily Takings.';err.style.display='block'}finally{btn.disabled=false;btn.textContent='Save Daily Takings'}}
function periodRevenue(keys){
  let rows=(data.dailyTakings||[]).filter(x=>keys.includes(x.date)),
      cash=rows.reduce((s,x)=>s+(+x.cash||0),0),
      treatments=rows.reduce((s,x)=>s+(+x.treatmentsCard||0),0),
      beds=rows.reduce((s,x)=>s+(+x.bedCard||0),0);
  return {cash,treatments,beds,total:cash+treatments+beds};
}
function renderDailyAverageComparison(){
 let out=document.getElementById('metricDailyAverage'),detail=document.getElementById('metricDailyAverageDetail');if(!out)return;
 let now=new Date(),today=localDateKey(),weekday=now.getDay(),actual=performanceSessions(data.bedSessions.filter(x=>x.date===today)).reduce((s,x)=>s+x.length,0),elapsed=getElapsedOpeningHours(now),day=now.toLocaleDateString('en-GB',{weekday:'long'});
 let historical=[...new Set(data.bedSessions.map(x=>x.date))].filter(k=>k!==today&&parseLocalDateKey(k).getDay()===weekday).sort().slice(-8);
 let vals=historical.map(k=>{let oh=effectiveHoursForDate(k),open=oh?.open||'09:00',limit=timeToMinutes(open)+elapsed*60;return performanceSessions(data.bedSessions.filter(x=>x.date===k&&timeToMinutes(x.time)<=limit)).reduce((s,x)=>s+x.length,0)});
 if(!vals.length){out.textContent='—';detail.textContent=`No previous ${day} data yet.`;return}
 let avg=vals.reduce((a,b)=>a+b,0)/vals.length,diff=Math.round(actual-avg);out.textContent=`${diff>=0?'+':''}${diff} mins`;detail.textContent=`${diff>=0?'+':''}${diff} mins v Average ${day}`;out.style.color=diff>=0?'var(--green)':'#ff7777';
}
function renderBedTracker(){
  if(!data.bedSessions)data.bedSessions=[];
  if(!data.sunbedBookings)data.sunbedBookings=[];
  let sd=document.getElementById('sessionDate');if(sd){if(!sd.value)sd.value=localDateKey();let sdDisplay=document.getElementById('sessionDateDisplay');if(sdDisplay)sdDisplay.value=formatSunbedDisplayDate(sd.value)}
  let td=document.getElementById('dailyTakingsDate');if(td&&!td.value){td.value=localDateKey();document.getElementById('dailyTakingsDateDisplay').value=formatSunbedDisplayDate(td.value)}

  let today=localDateKey(),
      rows=performanceSessions(data.bedSessions.filter(x=>x.date===today)),
      el=document.getElementById('trackerDate');
  if(!el)return;

  let now=new Date();
  el.textContent=now.toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'long',year:'numeric'});

  let total=rows.reduce((a,b)=>a+(+b.length||0),0),
      signups=rows.filter(x=>x.newSignup==='Yes'||x.newSignup===true).length,
      rlt=rows.filter(x=>normalizeSessionType(x)==='Red Light Therapy').reduce((a,b)=>a+(+b.length||0),0),
      hybrid=rows.filter(x=>normalizeSessionType(x)==='Hybrid').reduce((a,b)=>a+(+b.length||0),0),
      elapsed=getElapsedOpeningHours(now),
      kpi=elapsed>0?total/BED_COUNT/elapsed:0;

  document.getElementById('metricSessions').textContent=rows.length;
  document.getElementById('metricMinutes').textContent=total;
  document.getElementById('metricSignups').textContent=signups;
  document.getElementById('metricRltMinutes').textContent=rlt;
  document.getElementById('metricHybridMinutes').textContent=hybrid;
  document.getElementById('metricKpi').textContent=kpi.toFixed(1);
  let currentTarget=getCurrentMonthlyTarget(),kpiTile=document.getElementById('metricKpi')?.closest('.metric');
  document.getElementById('metricKpiTarget').textContent=currentTarget==null?'Target: not set':`Target: ${Number(currentTarget).toFixed(1)}`;
  if(kpiTile){
    kpiTile.classList.remove('kpiAboveTarget','kpiBelowTarget');
    if(currentTarget!=null)kpiTile.classList.add(kpi>=currentTarget?'kpiAboveTarget':'kpiBelowTarget');
  }
  document.getElementById('metricKpiDetail').textContent=elapsed>0
    ?`${total} total minutes ÷ ${BED_COUNT} beds ÷ ${elapsed.toFixed(1)} open hours`
    :(()=>{let h=effectiveHoursForDate(today);return `KPI starts calculating once the shop opens at ${h.open}.`})();

  // Month-to-date performance: all recorded minutes this month divided by
  // 4 beds and all elapsed opening hours in the month so far.
  let monthStart=new Date(now.getFullYear(),now.getMonth(),1),
      monthKeys=dateRangeKeys(monthStart,now),
      monthRows=performanceSessions(data.bedSessions.filter(x=>monthKeys.includes(x.date))),
      monthMinutes=monthRows.reduce((sum,x)=>sum+(+x.length||0),0),
      monthHours=periodOpenHours(monthKeys),
      monthKpi=monthHours>0?monthMinutes/BED_COUNT/monthHours:0;

  document.getElementById('metricMonthKpi').textContent=monthKpi.toFixed(1);
  document.getElementById('metricMonthKpiDetail').textContent=monthHours>0
    ?`${monthMinutes} month-to-date minutes ÷ ${BED_COUNT} beds ÷ ${monthHours.toFixed(1)} opening hours`
    :'No elapsed opening hours yet this month.';
  renderMonthlyReviewsRecorder();
  renderDailyTakings();
renderDailyAverageComparison();
}
function parseLocalDateKey(key){let [y,m,d]=key.split('-').map(Number);return new Date(y,m-1,d)}
function dayKpi(dateKey,totalMinutes){let today=localDateKey(),h=effectiveHoursForDate(dateKey);let hours=dateKey===today?getElapsedOpeningHours(new Date()):hoursDuration(h);return hours>0?totalMinutes/BED_COUNT/hours:0}
function aggregateSessions(rows){rows=performanceSessions(rows);let total=rows.reduce((a,b)=>a+(+b.length||0),0);return {sessions:rows.length,minutes:total,signups:rows.filter(x=>x.newSignup==='Yes'||x.newSignup===true).length,rlt:rows.filter(x=>normalizeSessionType(x)==='Red Light Therapy').reduce((a,b)=>a+(+b.length||0),0),hybrid:rows.filter(x=>normalizeSessionType(x)==='Hybrid').reduce((a,b)=>a+(+b.length||0),0)}}
function dateRangeKeys(start,end){let keys=[],d=new Date(start);d.setHours(12,0,0,0);let e=new Date(end);e.setHours(12,0,0,0);while(d<=e){keys.push(localDateKey(d));d.setDate(d.getDate()+1)}return keys}
function summaryMetricsHtml(a,kpi,label){return `<div class='perfMetrics'><div class='metric'><div class='label'>Sessions</div><div class='value'>${a.sessions}</div></div><div class='metric'><div class='label'>Total Minutes</div><div class='value'>${a.minutes}</div></div><div class='metric'><div class='label'>New Sign Ups</div><div class='value'>${a.signups}</div></div><div class='metric'><div class='label'>Red Light Minutes</div><div class='value'>${a.rlt}</div></div><div class='metric'><div class='label'>Hybrid Minutes</div><div class='value'>${a.hybrid}</div></div><div class='metric'><div class='label'>${label||'KPI'}</div><div class='value'>${kpi.toFixed(1)}</div></div></div>`}
function periodOpenHours(keys){let today=localDateKey();return keys.reduce((sum,k)=>sum+(k===today?getElapsedOpeningHours(new Date()):hoursDuration(effectiveHoursForDate(k))),0)}
function renderPeriodPerformance(mode){
  let now=new Date(),start,end,title;

  if(mode==='week'){
    let day=(now.getDay()+6)%7;
    start=new Date(now);
    start.setDate(now.getDate()-day);
    end=new Date(now);
    title='This Week In Detail';
  }else{
    start=new Date(now.getFullYear(),now.getMonth(),1);
    end=new Date(now);
    title='This Month In Detail';
  }

  let keys=dateRangeKeys(start,end),
      rows=(data.bedSessions||[]).filter(x=>keys.includes(x.date)),
      a=aggregateSessions(rows),
      hours=periodOpenHours(keys),
      kpi=hours>0?a.minutes/BED_COUNT/hours:0,
      revenue=periodRevenue(keys);

  document.getElementById('perfTitle').textContent=title;
  document.getElementById('perfSubtitle').textContent=
    `${start.toLocaleDateString('en-GB',{day:'numeric',month:'short'})} – ${end.toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'})}`;

  let daily=keys.map(k=>{
    let r=rows.filter(x=>x.date===k),m=aggregateSessions(r),t=getDailyTakings(k);
    return {key:k,...m,kpi:dayKpi(k,m.minutes),takings:t};
  });

  let revenueSummary=`<div class='periodRevenueSummary'>
    <div class='periodRevenueCard'><div class='label'>Total Cash</div><div class='value'>£${revenue.cash.toFixed(2)}</div></div>
    <div class='periodRevenueCard'><div class='label'>Total Bed Card</div><div class='value'>£${revenue.beds.toFixed(2)}</div></div>
    <div class='periodRevenueCard'><div class='label'>Total Treatment Card</div><div class='value'>£${revenue.treatments.toFixed(2)}</div></div>
  </div>`;

  document.getElementById('perfContent').innerHTML=
    revenueSummary+
    summaryMetricsHtml(a,kpi,'Minutes / Bed / Hour')+
    `<div class='card perfTableWrap'><table class='table'>
      <tr><th>Day</th><th>Sessions</th><th>Minutes</th><th>RLT</th><th>Hybrid</th><th>Sign Ups</th><th>KPI</th><th>Cash</th><th>Treatments Card</th><th>Bed Card</th><th>Total Revenue</th></tr>
      ${daily.map(d=>`<tr>
        <td><b>${parseLocalDateKey(d.key).toLocaleDateString('en-GB',{weekday:'short',day:'numeric',month:'short'})}</b></td>
        <td>${d.sessions}</td><td>${d.minutes}</td><td>${d.rlt}</td><td>${d.hybrid}</td><td>${d.signups}</td><td>${d.kpi.toFixed(1)}</td>
        <td>£${(+d.takings?.cash||0).toFixed(2)}</td><td>£${(+d.takings?.treatmentsCard||0).toFixed(2)}</td><td>£${(+d.takings?.bedCard||0).toFixed(2)}</td><td>£${takingsTotal(d.takings).toFixed(2)}</td>
      </tr>`).join('')}
    </table></div>`;
}
function drawBarChart(canvas,labels,values,valueSuffix=''){let ctx=canvas.getContext('2d'),ratio=window.devicePixelRatio||1,w=Math.max(canvas.parentElement.clientWidth,700),h=280;canvas.width=w*ratio;canvas.height=h*ratio;canvas.style.width=w+'px';canvas.style.height=h+'px';ctx.scale(ratio,ratio);ctx.clearRect(0,0,w,h);let pad={l:48,r:18,t:22,b:52},cw=w-pad.l-pad.r,ch=h-pad.t-pad.b,max=Math.max(...values,1),step=cw/Math.max(labels.length,1),bar=Math.max(10,step*.62);ctx.font='11px Segoe UI';ctx.fillStyle='#9da3ad';ctx.strokeStyle='#30353d';ctx.lineWidth=1;for(let i=0;i<=4;i++){let y=pad.t+ch-(ch*i/4),v=Math.round(max*i/4);ctx.beginPath();ctx.moveTo(pad.l,y);ctx.lineTo(w-pad.r,y);ctx.stroke();ctx.fillText(v,pad.l-38,y+4)}values.forEach((v,i)=>{let x=pad.l+i*step+(step-bar)/2,bh=max?ch*(v/max):0,y=pad.t+ch-bh;ctx.fillStyle='#ff2d78';ctx.fillRect(x,y,bar,bh);ctx.fillStyle='#f5f5f7';ctx.textAlign='center';ctx.fillText(`${Number(v).toFixed(valueSuffix?1:0)}${valueSuffix}`,x+bar/2,Math.max(12,y-6));ctx.save();ctx.translate(x+bar/2,pad.t+ch+15);ctx.rotate(-.55);ctx.fillStyle='#9da3ad';ctx.fillText(labels[i],0,0);ctx.restore()});ctx.textAlign='left'}
function renderPerformanceCharts(){let sessions=data.bedSessions||[],today=new Date(),first=new Date(today.getFullYear(),today.getMonth(),1),keys=dateRangeKeys(first,today);let days=keys.map(k=>{let a=aggregateSessions(sessions.filter(x=>x.date===k));return {key:k,minutes:a.minutes,kpi:dayKpi(k,a.minutes)}});document.getElementById('perfTitle').textContent='Performance Charts';document.getElementById('perfSubtitle').textContent='Calendar month to date';document.getElementById('perfContent').innerHTML=`<div class='chartCard'><h3>Total Minutes by Day</h3><div class='chartWrap'><canvas id='minutesChart' class='chartCanvas'></canvas></div></div><div class='chartCard'><h3>Minutes Per Bed Per Hour KPI by Day</h3><div class='chartWrap'><canvas id='kpiChart' class='chartCanvas'></canvas></div></div>`;let labels=days.map(d=>parseLocalDateKey(d.key).toLocaleDateString('en-GB',{day:'numeric',month:'short'}));requestAnimationFrame(()=>{drawBarChart(document.getElementById('minutesChart'),labels,days.map(d=>d.minutes));drawBarChart(document.getElementById('kpiChart'),labels,days.map(d=>d.kpi),'')})}
function openBonusPerformance(){
 let n=currentMonthIdentity(),s=getTargetStackFor(n.month,n.year);if(!s)return alert('No target stack exists for the current month.');
 let a=monthPerformanceActuals(n.month,n.year);document.getElementById('perfTitle').textContent='Bonus Performance';document.getElementById('perfSubtitle').textContent=`${MONTH_NAMES[n.month-1]} ${n.year} · Current actual ${a.kpi.toFixed(2)} mins / bed / hour`;
 document.getElementById('perfContent').innerHTML=[1,2,3].map(i=>{let t=s[`bonus${i}Kpi`],amt=s[`bonus${i}Amount`],pct=t?a.kpi/t*100:0;return `<div class='card'><h3>Bonus Level ${i} · £${amt.toFixed(2)}</h3><div style='font-size:28px;font-weight:900'>${pct.toFixed(0)}%</div><div>${a.kpi.toFixed(2)} actual vs ${t.toFixed(2)} target</div><div class='progressTrack'><div class='progressFill' style='width:${Math.min(100,pct)}%'></div></div></div>`}).join('');
 document.getElementById('performanceOverlay').classList.add('show');
}
function openPerformance(mode){document.getElementById('performanceOverlay').classList.add('show');if(mode==='charts')renderPerformanceCharts();else renderPeriodPerformance(mode)}
function closePerformance(){document.getElementById('performanceOverlay').classList.remove('show')}
function bedSessionHistoryRows(){
  return (data.bedSessions||[]).map(x=>({
    id:x.id,
    date:x.date||'',
    time:x.time||'',
    length:+x.length||0,
    payment:x.payment||'',
    type:normalizeSessionType(x),
    newSignup:(x.newSignup==='Yes'||x.newSignup===true)?'Yes':'No',
    block:(x.purchasedBlockBooking==='Yes'||x.purchasedBlockBooking===true)?'Yes':'No'
  }));
}
function bedSessionHistoryKpi(dateKey){
  let rows=(data.bedSessions||[]).filter(x=>x.date===dateKey);
  let performanceMinutes=performanceSessions(rows).reduce((sum,x)=>sum+(+x.length||0),0);
  return dayKpi(dateKey,performanceMinutes);
}
function getBedSessionHistoryData(){
  return {sessions:bedSessionHistoryRows()};
}
async function deleteBedSessionFromHistory(id){
  if(!requireRolePermission('daily_session_tracker','edit','Your role does not have permission to delete sessions.'))return {ok:false,error:'Permission denied.'};
  let row=(data.bedSessions||[]).find(x=>String(x.id)===String(id));
  if(!row)return {ok:false,error:'The session could not be found.'};

  let {error}=await sb.rpc('revibe_delete_bed_session',{p_session_id:id});
  if(error)return {ok:false,error:error.message};

  try{
    await loadLiveData();
    renderBedTracker();
  }catch(refreshError){
    console.error('Session deleted but REVIBE refresh failed:',refreshError);
  }
  return {ok:true,sessions:bedSessionHistoryRows()};
}
function formatBedSessionsDate(key){
  if(!key)return '';
  let [y,m,d]=key.split('-').map(Number);
  return new Date(y,m-1,d).toLocaleDateString('en-GB',{
    weekday:'long',day:'numeric',month:'long',year:'numeric'
  });
}
function showTodaysSessions(){
  goToPage('dailysessions');
  let today=localDateKey();
  let picker=document.getElementById('dailySessionsDatePicker');
  if(picker)picker.value=today;
  renderDailySessionsPage(today);
}
function openDailySessionsCalendar(){
  let picker=document.getElementById('dailySessionsDatePicker');
  if(!picker)return;
  try{
    if(typeof picker.showPicker==='function')picker.showPicker();
    else picker.focus();
  }catch(_){
    picker.focus();
  }
}
function renderDailySessionsPage(key){
  if(!key)key=localDateKey();

  let rows=bedSessionHistoryRows()
    .filter(x=>x.date===key)
    .sort((a,b)=>String(b.time||'').localeCompare(String(a.time||'')));

  let canDelete=hasRolePermission('daily_session_tracker','edit');
  let totalMinutes=rows.reduce((sum,x)=>sum+(+x.length||0),0);

  let label=document.getElementById('dailySessionsDateLabel');
  if(label)label.textContent=formatBedSessionsDate(key);

  let kpi=Number(bedSessionHistoryKpi(key));
  let kpiEl=document.getElementById('dailySessionsKpiValue');
  if(kpiEl)kpiEl.textContent=Number.isFinite(kpi)?kpi.toFixed(1):'0.0';

  let picker=document.getElementById('dailySessionsDatePicker');
  if(picker&&picker.value!==key)picker.value=key;

  let head=document.getElementById('dailySessionsHead');
  if(head)head.innerHTML=
    `<tr><th>Time</th><th>Session Length</th><th>Payment Type</th><th>Session Type</th><th>New Sign Up</th><th>Block Booking</th>${canDelete?"<th class='dailySessionsDeleteCol'></th>":''}</tr>`;

  let cols=canDelete?7:6;
  let body=document.getElementById('dailySessionsRows');
  if(body)body.innerHTML=rows.length
    ? rows.map(x=>`<tr>
        <td>${escapeHtml(x.time||'')}</td>
        <td>${escapeHtml(x.length)} min</td>
        <td>${escapeHtml(x.payment||'')}</td>
        <td>${escapeHtml(x.type||'')}</td>
        <td>${escapeHtml(x.newSignup||'')}</td>
        <td>${escapeHtml(x.block||'')}</td>
        ${canDelete?`<td class='dailySessionsDeleteCol'><button type='button' class='dailySessionsDelete' onclick="deleteDailySession('${escapeHtml(x.id)}')">Delete</button></td>`:''}
      </tr>`).join('')
    : `<tr><td colspan='${cols}' class='muted' style='text-align:center;padding:28px'>No sessions recorded for this date.</td></tr>`;

  let foot=document.getElementById('dailySessionsTotals');
  if(foot)foot.innerHTML=rows.length
    ? `<tr><td style='text-align:right'>Total</td><td>${totalMinutes} min</td><td colspan='${canDelete?5:4}'></td></tr>`
    : '';
}
async function deleteDailySession(id){
  let row=(data.bedSessions||[]).find(x=>String(x.id)===String(id));
  if(!row)return alert('The session could not be found.');

  let key=document.getElementById('dailySessionsDatePicker')?.value||row.date||localDateKey();

  if(!confirm(`Delete the ${row.length}-minute session logged at ${row.time||'this time'} on ${formatBedSessionsDate(row.date||key)}?\n\nThis cannot be undone.`))return;

  let result=await deleteBedSessionFromHistory(id);
  if(!result?.ok)return alert('Could not delete the session: '+(result?.error||'Unknown error.'));

  renderDailySessionsPage(key);
}
function printDailySessions(){
  document.body.classList.add('dailySessionsPrinting');
  window.print();
  setTimeout(()=>document.body.classList.remove('dailySessionsPrinting'),300);
}
function closeBedSessionsModal(){
  document.getElementById('bedSessionsModal').classList.remove('show');
}
function renderBedSessionsModal(key){
  if(!key)key=localDateKey();
  let rows=bedSessionHistoryRows()
    .filter(x=>x.date===key)
    .sort((a,b)=>String(b.time||'').localeCompare(String(a.time||'')));
  let canDelete=hasRolePermission('daily_session_tracker','edit');
  let totalMinutes=rows.reduce((sum,x)=>sum+(+x.length||0),0);

  document.getElementById('bedSessionsDateLabel').textContent=formatBedSessionsDate(key);
  {
    let kpi=Number(bedSessionHistoryKpi(key));
    document.getElementById('bedSessionsKpiValue').textContent=Number.isFinite(kpi)?kpi.toFixed(1):'0.0';
  }

  let picker=document.getElementById('bedSessionsDatePicker');
  if(picker&&picker.value!==key)picker.value=key;

  document.getElementById('bedSessionsHead').innerHTML=
    `<tr><th>Time</th><th>Session Length</th><th>Payment Type</th><th>Session Type</th><th>New Sign Up</th><th>Block Booking</th>${canDelete?"<th class='bedSessionsDeleteCol'></th>":''}</tr>`;

  let cols=canDelete?7:6;
  document.getElementById('bedSessionsRows').innerHTML=rows.length
    ? rows.map(x=>`<tr>
        <td>${escapeHtml(x.time||'')}</td>
        <td>${escapeHtml(x.length)} min</td>
        <td>${escapeHtml(x.payment||'')}</td>
        <td>${escapeHtml(x.type||'')}</td>
        <td>${escapeHtml(x.newSignup||'')}</td>
        <td>${escapeHtml(x.block||'')}</td>
        ${canDelete?`<td class='bedSessionsDeleteCol'><button type='button' class='bedSessionsDelete' onclick="deleteBedSessionFromModal('${escapeHtml(x.id)}')">Delete</button></td>`:''}
      </tr>`).join('')
    : `<tr><td colspan='${cols}' class='muted' style='text-align:center;padding:24px'>No sessions recorded for this date.</td></tr>`;

  document.getElementById('bedSessionsTotals').innerHTML=rows.length
    ? `<tr><td style='text-align:right'>Total</td><td>${totalMinutes} min</td><td colspan='${canDelete?5:4}'></td></tr>`
    : '';
}
async function deleteBedSessionFromModal(id){
  let row=(data.bedSessions||[]).find(x=>String(x.id)===String(id));
  if(!row)return alert('The session could not be found.');

  let date=row.date||document.getElementById('bedSessionsDatePicker').value;
  if(!confirm(`Delete the ${row.length}-minute session logged at ${row.time||'this time'} on ${formatBedSessionsDate(date)}?\n\nThis cannot be undone.`))return;

  let result=await deleteBedSessionFromHistory(id);
  if(!result?.ok)return alert('Could not delete the session: '+(result?.error||'Unknown error.'));

  renderBedSessionsModal(document.getElementById('bedSessionsDatePicker').value||date);
}
function printBedSessions(){
  document.body.classList.add('bedSessionsPrinting');
  window.print();
  setTimeout(()=>document.body.classList.remove('bedSessionsPrinting'),300);
}
function toggleBlockBookingQuestion(){let signup=document.getElementById('sessionSignup').checked,row=document.getElementById('blockBookingRow'),block=document.getElementById('sessionBlockBooking');row.style.display=signup?'flex':'none';if(!signup)block.checked=false}
function closeSessionLoggedConfirmation(){
  let modal=document.getElementById('sessionLoggedModal');if(modal)modal.classList.remove('show');
  let success=document.getElementById('sessionSuccess');if(success)success.classList.remove('show');
}
function showSessionLoggedConfirmation(date){
  const btn=document.querySelector('#bedtracker .recordbtn');
  if(!btn)return;

  // Create a fresh confirmation every time so no modal/class/CSS state can suppress it.
  let success=document.getElementById('sessionSuccess');
  if(!success){
    success=document.createElement('div');
    success.id='sessionSuccess';
    btn.parentNode.insertBefore(success,btn);
  }else if(success.nextElementSibling!==btn){
    btn.parentNode.insertBefore(success,btn);
  }

  success.textContent='✓ Session logged successfully for '+formatSunbedDisplayDate(date)+'.';
  success.style.cssText='display:block!important;width:100%;margin:2px 0 8px;padding:12px 14px;background:#173323;border:1px solid #2bd576;color:#9af0ba;border-radius:8px;font-weight:800;text-align:center;box-sizing:border-box;';

  const original=btn.dataset.defaultText||'Record Session';
  btn.dataset.defaultText=original;
  btn.textContent='✓ Session Logged';
  btn.disabled=true;

  clearTimeout(window.revibeSessionSuccessTimer);
  window.revibeSessionSuccessTimer=setTimeout(()=>{
    success.style.display='none';
    btn.textContent=btn.dataset.defaultText||'Record Session';
    btn.disabled=false;
  },2000);
}
function resetBedSessionForm(){
  let today=localDateKey();
  document.getElementById('sessionDate').value=today;
  document.getElementById('sessionDateDisplay').value=formatSunbedDisplayDate(today);
  document.getElementById('sessionLength').value='';
  document.getElementById('sessionPayment').value='Account Minutes';
  document.getElementById('sessionSignup').checked=false;
  document.getElementById('sessionBlockBooking').checked=false;
  document.getElementById('blockBookingRow').style.display='none';
  document.getElementById('sessionRlt').checked=false;
  document.getElementById('sessionHybrid').checked=false;
  pendingPaygSplit=null;
}
async function recordBedSession(){
 let date=document.getElementById('sessionDate').value||localDateKey(),customerId=document.getElementById('sessionCustomer').value,c=data.customers.find(x=>x.id===customerId),length=+document.getElementById('sessionLength').value,payment=document.getElementById('sessionPayment').value,newSignup=document.getElementById('sessionSignup').checked,purchasedBlock=document.getElementById('sessionBlockBooking').checked,rlt=document.getElementById('sessionRlt').checked,hybrid=document.getElementById('sessionHybrid').checked;
 if(!Number.isInteger(length)||length<1)return alert('Please enter a valid Session Length.');if(!rlt&&!hybrid)return alert('Please select Red Light Therapy or Hybrid.');
 if(!c){
   let payload={session_date:date,session_time:new Date().toTimeString().slice(0,8),session_length_minutes:length,payment_type:payment,new_sign_up:newSignup,purchased_block_booking:purchasedBlock,session_type:rlt?'Red Light Therapy':'Hybrid',account_minutes_used:0,payg_minutes:(payment==='Account Minutes'||payment==='Free'||payment==='Free Session')?0:length};
   let {error}=await sb.from('bed_sessions').insert(payload);
   if(error)return alert(error.message);

   // Confirm immediately after Supabase has created the record.
   // Do not make the user wait for the full REVIBE refresh.
   resetBedSessionForm();
   showSessionLoggedConfirmation(date);

   try{
     await loadLiveData();
     renderBedTracker();
     // renderBedTracker may rebuild the panel, so surface confirmation again
     // on the refreshed DOM for the remainder of the 2-second confirmation.
     showSessionLoggedConfirmation(date);
   }catch(refreshError){
     console.error('Session saved but REVIBE refresh failed:',refreshError);
   }
   return
 }
 let age=ageFromDob(c.dob);if(hybrid&&age<18)return alert('CUSTOMER IS BELOW 18 AND IS NOT ALLOWED TO USE UV.');if(hybrid&&age<25&&!c.idChecked)return alert('NO ID HAS BEEN CHECKED FOR THIS CUSTOMER. CHECK CUSTOMER ID BEFORE UV USE.');let accountUsed=0,payg=0;if(payment==='Free'||payment==='Free Session'){accountUsed=0;payg=0}else if(payment==='Account Minutes'){if(length>c.minutesLeft){document.getElementById('insufficientMessage').textContent=`Customer has ${c.minutesLeft} minutes left but this session requires ${length} minutes.`;document.getElementById('insufficientMinutesModal').classList.add('show');return}accountUsed=length}else if(pendingPaygSplit){accountUsed=pendingPaygSplit.account;payg=pendingPaygSplit.payg}else payg=length;
 let {data:bal,error}=await sb.rpc('record_customer_bed_session',{p_customer:customerId,p_length:length,p_payment:payment,p_signup:newSignup,p_block:purchasedBlock,p_session_type:rlt?'Red Light Therapy':'Hybrid',p_account_used:accountUsed,p_payg:payg,p_session_date:date});
 if(error)return alert(error.message);
 pendingPaygSplit=null;

 resetBedSessionForm();
 showSessionLoggedConfirmation(date);

 try{
   await loadLiveData();
   renderBedTracker();
   renderCustomers();
   sessionCustomerChanged();
   showSessionLoggedConfirmation(date);
 }catch(refreshError){
   console.error('Session saved but REVIBE refresh failed:',refreshError);
 }
}
