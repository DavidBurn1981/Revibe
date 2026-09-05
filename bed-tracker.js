function exclusiveSessionType(which){
  let r=document.getElementById('sessionRlt'),h=document.getElementById('sessionHybrid');
  if(which==='rlt'&&r.checked){
    h.checked=false;
    alert('Ensure bed is set to RLT Only for Customer');
  }
  if(which==='hybrid'&&h.checked){
    r.checked=false;
    let customerId=document.getElementById('sessionCustomerId').value;
    let c=customerId?data.customers.find(x=>x.id===customerId):null;
    if(c&&!c.uvAllowed)alert('This Customer can not use UV. Please check their Customer record to see why.');
  }
}
function editExclusiveSessionType(which){
  let r=document.getElementById('editSessionRlt'),h=document.getElementById('editSessionHybrid');
  if(which==='rlt'&&r.checked){
    h.checked=false;
    alert('Ensure bed is set to RLT Only for Customer');
  }
  if(which==='hybrid'&&h.checked)r.checked=false;
}
function normalizeSessionType(x){if(x.sessionType)return x.sessionType;if(x.redLight)return 'Red Light Therapy';if(x.hybrid)return 'Hybrid';return 'Standard UV'}
function perfMinutes(x){return (+x.length||0)-(+x.rerunMinutes||0)}
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
  document.getElementById('dailyCashTaken').value=(+row?.cash||0).toFixed(2);document.getElementById('dailyTreatmentsCardTaken').value=(+row?.treatmentsCard||0).toFixed(2);document.getElementById('dailyBedCardTaken').value=(+row?.bedCard||0).toFixed(2);document.getElementById('dailyFridgeReading').value=row?.fridgeReading===''||row?.fridgeReading===undefined||row?.fridgeReading===null?'':row.fridgeReading;updateDailyTakingsTotal();
  let canEdit=hasRolePermission('daily_session_tracker','edit');['dailyCashTaken','dailyTreatmentsCardTaken','dailyBedCardTaken','dailyFridgeReading'].forEach(id=>document.getElementById(id).readOnly=!canEdit);document.getElementById('saveDailyTakingsBtn').style.display=canEdit?'inline-block':'none';
}
async function saveDailyTakings(){if(!requireRolePermission('daily_session_tracker','edit'))return;let key=document.getElementById('dailyTakingsDate').value||localDateKey(),cash=+document.getElementById('dailyCashTaken').value,treatments=+document.getElementById('dailyTreatmentsCardTaken').value,beds=+document.getElementById('dailyBedCardTaken').value,fridgeRaw=document.getElementById('dailyFridgeReading').value,fridge=fridgeRaw===''?null:+fridgeRaw,err=document.getElementById('dailyTakingsError'),btn=document.getElementById('saveDailyTakingsBtn');err.style.display='none';if([cash,treatments,beds].some(x=>!Number.isFinite(x)||x<0)){err.textContent='Please enter valid takings amounts.';err.style.display='block';return}if(fridge!==null&&!Number.isFinite(fridge)){err.textContent='Please enter a valid Fridge Reading.';err.style.display='block';return}btn.disabled=true;btn.textContent='Saving...';try{let {error}=await sb.from('daily_takings').upsert({takings_date:key,cash_taken:cash,treatments_card_taken:treatments,bed_card_taken:beds,fridge_reading:fridge,updated_at:new Date().toISOString()},{onConflict:'takings_date'});if(error)throw error;await loadLiveData();renderDailyTakings();renderPerformanceReporting()}catch(e){err.textContent=e.message||'Could not save Daily Takings.';err.style.display='block'}finally{btn.disabled=false;btn.textContent='Save Daily Takings'}}
function periodRevenue(keys){
  let rows=(data.dailyTakings||[]).filter(x=>keys.includes(x.date)),
      cash=rows.reduce((s,x)=>s+(+x.cash||0),0),
      treatments=rows.reduce((s,x)=>s+(+x.treatmentsCard||0),0),
      beds=rows.reduce((s,x)=>s+(+x.bedCard||0),0);
  return {cash,treatments,beds,total:cash+treatments+beds};
}
const DAILY_AVERAGE_COMPARISON_ENABLED=false; // temporarily disabled while historic session data is added - see renderDailyAverageComparison()
function renderDailyAverageComparison(){
 let out=document.getElementById('metricDailyAverage'),detail=document.getElementById('metricDailyAverageDetail');if(!out)return;
 if(!DAILY_AVERAGE_COMPARISON_ENABLED){out.textContent='—';detail.textContent='Temporarily disabled while historic session data is added.';out.style.color='';return}
 let now=new Date(),today=localDateKey(),weekday=now.getDay(),
     nowMin=now.getHours()*60+now.getMinutes(),
     actual=performanceSessions(data.bedSessions.filter(x=>x.date===today)).reduce((s,x)=>s+x.length,0),
     day=now.toLocaleDateString('en-GB',{weekday:'long'});
 let historical=[...new Set(data.bedSessions.map(x=>x.date))].filter(k=>k!==today&&parseLocalDateKey(k).getDay()===weekday).sort().slice(-8);
 let vals=historical.map(k=>performanceSessions(data.bedSessions.filter(x=>x.date===k&&timeToMinutes(x.time)<=nowMin)).reduce((s,x)=>s+x.length,0));
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

  let total=rows.reduce((a,b)=>a+perfMinutes(b),0),
      paidTotal=rows.reduce((a,b)=>a+(+b.cashMinutes||0)+(+b.cardMinutes||0)+(+b.accountMinutes||0),0),
      signups=rows.filter(x=>x.newSignup==='Yes'||x.newSignup===true).length,
      rlt=rows.filter(x=>normalizeSessionType(x)==='Red Light Therapy').reduce((a,b)=>a+perfMinutes(b),0),
      hybrid=rows.filter(x=>normalizeSessionType(x)==='Hybrid').reduce((a,b)=>a+perfMinutes(b),0),
      elapsed=getElapsedOpeningHours(now),
      kpi=elapsed>0?total/BED_COUNT/elapsed:0,
      paidKpi=elapsed>0?paidTotal/BED_COUNT/elapsed:0;

  document.getElementById('metricSessions').textContent=rows.length;
  document.getElementById('metricMinutes').textContent=total;
  document.getElementById('metricSignups').textContent=signups;
  document.getElementById('metricRltMinutes').textContent=rlt;
  document.getElementById('metricHybridMinutes').textContent=hybrid;
  document.getElementById('metricKpi').textContent=kpi.toFixed(1);
  document.getElementById('metricPaidKpi').textContent=paidKpi.toFixed(1);
  document.getElementById('metricPaidKpiDetail').textContent=elapsed>0
    ?`${paidTotal} paid-for minutes ÷ ${BED_COUNT} beds ÷ ${elapsed.toFixed(1)} open hours`
    :'Cash, Card and Account minutes only — Free and Staff minutes excluded.';
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
      monthMinutes=monthRows.reduce((sum,x)=>sum+perfMinutes(x),0),
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
function aggregateSessions(rows){rows=performanceSessions(rows);let total=rows.reduce((a,b)=>a+perfMinutes(b),0);return {sessions:rows.length,minutes:total,signups:rows.filter(x=>x.newSignup==='Yes'||x.newSignup===true).length,rlt:rows.filter(x=>normalizeSessionType(x)==='Red Light Therapy').reduce((a,b)=>a+perfMinutes(b),0),hybrid:rows.filter(x=>normalizeSessionType(x)==='Hybrid').reduce((a,b)=>a+perfMinutes(b),0)}}
function dateRangeKeys(start,end){let keys=[],d=new Date(start);d.setHours(12,0,0,0);let e=new Date(end);e.setHours(12,0,0,0);while(d<=e){keys.push(localDateKey(d));d.setDate(d.getDate()+1)}return keys}
function summaryMetricsHtml(a,kpi,label){return `<div class='perfMetrics'><div class='metric'><div class='label'>Sessions</div><div class='value'>${a.sessions}</div></div><div class='metric'><div class='label'>Total Minutes</div><div class='value'>${a.minutes}</div></div><div class='metric'><div class='label'>New Sign Ups</div><div class='value'>${a.signups}</div></div><div class='metric'><div class='label'>Red Light Minutes</div><div class='value'>${a.rlt}</div></div><div class='metric'><div class='label'>Hybrid Minutes</div><div class='value'>${a.hybrid}</div></div><div class='metric'><div class='label'>${label||'KPI'}</div><div class='value'>${kpi.toFixed(1)}</div></div></div>`}
function periodOpenHours(keys){let today=localDateKey();return keys.reduce((sum,k)=>sum+(k===today?getElapsedOpeningHours(new Date()):hoursDuration(effectiveHoursForDate(k))),0)}
let currentPeriodMode=null,currentPeriodRefDate=null;
function renderPeriodPerformance(mode,refDate){
  let now=new Date(),ref=refDate?new Date(refDate):new Date(now),start,end,title,isCurrent;
  currentPeriodMode=mode;currentPeriodRefDate=ref;

  if(mode==='week'){
    let refDay=(ref.getDay()+6)%7;
    start=new Date(ref);start.setDate(ref.getDate()-refDay);
    let weekEnd=new Date(start);weekEnd.setDate(start.getDate()+6);
    let todayDay=(now.getDay()+6)%7,thisWeekStart=new Date(now);thisWeekStart.setDate(now.getDate()-todayDay);
    isCurrent=start.toDateString()===thisWeekStart.toDateString();
    end=isCurrent?new Date(now):weekEnd;
    title='Week Detailed View';
  }else{
    start=new Date(ref.getFullYear(),ref.getMonth(),1);
    let monthEnd=new Date(ref.getFullYear(),ref.getMonth()+1,0);
    isCurrent=ref.getFullYear()===now.getFullYear()&&ref.getMonth()===now.getMonth();
    end=isCurrent?new Date(now):monthEnd;
    title='Month Detail View';
  }

  let nav=document.getElementById('perfPeriodNav');
  if(nav){nav.style.display='flex';let nextBtn=document.getElementById('perfPeriodNext');if(nextBtn)nextBtn.disabled=isCurrent;let curBtn=document.getElementById('perfPeriodCurrent');if(curBtn)curBtn.style.display=isCurrent?'none':'inline-block'}

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
function renderPerformanceCharts(){let nav=document.getElementById('perfPeriodNav');if(nav)nav.style.display='none';let sessions=data.bedSessions||[],today=new Date(),first=new Date(today.getFullYear(),today.getMonth(),1),keys=dateRangeKeys(first,today);let days=keys.map(k=>{let a=aggregateSessions(sessions.filter(x=>x.date===k));return {key:k,minutes:a.minutes,kpi:dayKpi(k,a.minutes)}});document.getElementById('perfTitle').textContent='Performance Charts';document.getElementById('perfSubtitle').textContent='Calendar month to date';document.getElementById('perfContent').innerHTML=`<div class='chartCard'><h3>Total Minutes by Day</h3><div class='chartWrap'><canvas id='minutesChart' class='chartCanvas'></canvas></div></div><div class='chartCard'><h3>Minutes Per Bed Per Hour KPI by Day</h3><div class='chartWrap'><canvas id='kpiChart' class='chartCanvas'></canvas></div></div><div class='chartCard'><h3>Sessions Logged by Time of Day</h3><div class='muted' style='margin-bottom:10px'>Shows how many sessions started in each hour, so you can spot busy and quiet times of day. Defaults to the last 8 weeks, never earlier than 29 Aug — data before that was entered in bulk rather than logged as sessions happened, so it doesn't reflect real intraday timing.</div><div class='hourChartRange'><label>From <input type='date' id='hourChartFrom' onchange='renderHourOfDayChart()'></label><label>To <input type='date' id='hourChartTo' onchange='renderHourOfDayChart()'></label></div><div class='chartWrap'><canvas id='hourChart' class='chartCanvas'></canvas></div></div>`;let labels=days.map(d=>parseLocalDateKey(d.key).toLocaleDateString('en-GB',{day:'numeric',month:'short'}));let hourFloor=new Date(2026,7,29),eightWeeksAgo=new Date(today);eightWeeksAgo.setDate(eightWeeksAgo.getDate()-56);let hourDefaultFrom=eightWeeksAgo>hourFloor?eightWeeksAgo:hourFloor;document.getElementById('hourChartFrom').value=iso(hourDefaultFrom);document.getElementById('hourChartTo').value=localDateKey();requestAnimationFrame(()=>{drawBarChart(document.getElementById('minutesChart'),labels,days.map(d=>d.minutes));drawBarChart(document.getElementById('kpiChart'),labels,days.map(d=>d.kpi),'');renderHourOfDayChart()})}
function renderHourOfDayChart(){
  let canvas=document.getElementById('hourChart');if(!canvas)return;
  let from=document.getElementById('hourChartFrom').value,to=document.getElementById('hourChartTo').value;
  if(!from||!to)return;
  let sessions=(data.bedSessions||[]).filter(x=>x.date>=from&&x.date<=to&&x.time);
  let hours=Array.from({length:24},(_,h)=>0);
  sessions.forEach(x=>{let h=+x.time.slice(0,2);if(h>=0&&h<24)hours[h]++});
  let firstHour=hours.findIndex(v=>v>0),lastHour=hours.length-1-[...hours].reverse().findIndex(v=>v>0);
  if(firstHour===-1){firstHour=8;lastHour=20}
  let rangeHours=[],rangeCounts=[];
  for(let h=firstHour;h<=lastHour;h++){rangeHours.push(`${h%12||12}${h<12?'am':'pm'}–${(h+1)%12||12}${h+1<12||h+1===24?'am':'pm'}`);rangeCounts.push(hours[h])}
  drawBarChart(canvas,rangeHours,rangeCounts);
}
function openBonusPerformance(){
 let n=currentMonthIdentity(),s=getTargetStackFor(n.month,n.year);if(!s)return alert('No target stack exists for the current month.');
 let nav=document.getElementById('perfPeriodNav');if(nav)nav.style.display='none';
 let a=monthPerformanceActuals(n.month,n.year);document.getElementById('perfTitle').textContent='Bonus Performance';document.getElementById('perfSubtitle').textContent=`${MONTH_NAMES[n.month-1]} ${n.year} · Current actual ${a.kpi.toFixed(2)} mins / bed / hour`;
 document.getElementById('perfContent').innerHTML=[1,2,3].map(i=>{let t=s[`bonus${i}Kpi`],amt=s[`bonus${i}Amount`],pct=t?a.kpi/t*100:0;return `<div class='card'><h3>Bonus Level ${i} · £${amt.toFixed(2)}</h3><div style='font-size:28px;font-weight:900'>${pct.toFixed(0)}%</div><div>${a.kpi.toFixed(2)} actual vs ${t.toFixed(2)} target</div><div class='progressTrack'><div class='progressFill' style='width:${Math.min(100,pct)}%'></div></div></div>`}).join('');
 document.getElementById('performanceOverlay').classList.add('show');
}
function navigatePeriod(delta){
  if(!currentPeriodMode)return;
  let d=new Date(currentPeriodRefDate),now=new Date();
  if(currentPeriodMode==='week'){
    d.setDate(d.getDate()+delta*7);
    let targetDay=(d.getDay()+6)%7,targetWeekStart=new Date(d);targetWeekStart.setDate(d.getDate()-targetDay);
    let nowDay=(now.getDay()+6)%7,thisWeekStart=new Date(now);thisWeekStart.setDate(now.getDate()-nowDay);
    if(targetWeekStart>thisWeekStart)return;
  }else{
    d.setMonth(d.getMonth()+delta);
    let targetMonthStart=new Date(d.getFullYear(),d.getMonth(),1),thisMonthStart=new Date(now.getFullYear(),now.getMonth(),1);
    if(targetMonthStart>thisMonthStart)return;
  }
  renderPeriodPerformance(currentPeriodMode,d);
}
function resetPeriodToCurrent(){if(currentPeriodMode)renderPeriodPerformance(currentPeriodMode,new Date())}
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
    block:(x.purchasedBlockBooking==='Yes'||x.purchasedBlockBooking===true)?'Yes':'No',
    cashMinutes:+x.cashMinutes||0,
    cardMinutes:+x.cardMinutes||0,
    accountMinutes:+x.accountMinutes||0,
    freeMinutes:+x.freeMinutes||0,
    staffMinutes:+x.staffMinutes||0,
    staffMemberName:x.staffMemberName||'',
    rerunMinutes:+x.rerunMinutes||0,
    customerId:x.customerId||null
  }));
}
function bedSessionHistoryKpi(dateKey){
  let rows=(data.bedSessions||[]).filter(x=>x.date===dateKey);
  let performanceMinutes=performanceSessions(rows).reduce((sum,x)=>sum+perfMinutes(x),0);
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

  let canDelete=hasRolePermission('daily_session_tracker','delete');
  let totalMinutes=rows.reduce((sum,x)=>sum+(+x.length||0),0);
  let totalCash=rows.reduce((sum,x)=>sum+(+x.cashMinutes||0),0);
  let totalCard=rows.reduce((sum,x)=>sum+(+x.cardMinutes||0),0);
  let totalAccount=rows.reduce((sum,x)=>sum+(+x.accountMinutes||0),0);
  let totalFree=rows.reduce((sum,x)=>sum+(+x.freeMinutes||0),0);
  let totalStaff=rows.reduce((sum,x)=>sum+(+x.staffMinutes||0),0);
  let totalRerun=rows.reduce((sum,x)=>sum+(+x.rerunMinutes||0),0);
  let totalSignUps=rows.filter(x=>x.newSignup==='Yes').length;
  let totalBlockBookings=rows.filter(x=>x.block==='Yes').length;

  let label=document.getElementById('dailySessionsDateLabel');
  if(label)label.textContent=formatBedSessionsDate(key);

  let kpi=Number(bedSessionHistoryKpi(key));
  let kpiEl=document.getElementById('dailySessionsKpiValue');
  if(kpiEl)kpiEl.textContent=Number.isFinite(kpi)?kpi.toFixed(1):'0.0';

  let picker=document.getElementById('dailySessionsDatePicker');
  if(picker&&picker.value!==key)picker.value=key;

  let head=document.getElementById('dailySessionsHead');
  if(head)head.innerHTML=
    `<tr><th>Time</th><th>Customer</th><th>Session Length</th><th>Cash</th><th>Card</th><th>Account</th><th>Free</th><th>Staff</th><th>Rerun Minutes</th><th class='totalMinsCol'>Total Mins</th><th>Session Type</th><th>New Sign Up</th><th>Block Booking</th>${canDelete?"<th class='dailySessionsDeleteCol'></th>":''}</tr>`;

  let cols=canDelete?14:13;
  let body=document.getElementById('dailySessionsRows');
  if(body)body.innerHTML=rows.length
    ? rows.map(x=>{
        let customer=x.customerId?data.customers.find(c=>c.id===x.customerId):null;
        return `<tr class='clinicRow' onclick="openDailySessionEdit('${escapeHtml(x.id)}')">
        <td>${escapeHtml(x.time||'')}</td>
        <td>${customer?escapeHtml(customer.firstName+' '+customer.lastName):'—'}</td>
        <td>${escapeHtml(x.length)} min</td>
        <td>${x.cashMinutes} min</td>
        <td>${x.cardMinutes} min</td>
        <td>${x.accountMinutes} min</td>
        <td>${x.freeMinutes} min</td>
        <td>${x.staffMinutes} min</td>
        <td>${x.rerunMinutes} min</td>
        <td class='totalMinsCol'>${x.length} min</td>
        <td>${escapeHtml(x.type||'')}</td>
        <td>${escapeHtml(x.newSignup||'')}</td>
        <td>${escapeHtml(x.block||'')}</td>
        ${canDelete?`<td class='dailySessionsDeleteCol' onclick='event.stopPropagation()'><button type='button' class='dailySessionsDelete' onclick="deleteDailySession('${escapeHtml(x.id)}')">Delete</button></td>`:''}
      </tr>`;
      }).join('')
    : `<tr><td colspan='${cols}' class='muted' style='text-align:center;padding:28px'>No sessions recorded for this date.</td></tr>`;

  let foot=document.getElementById('dailySessionsTotals');
  if(foot)foot.innerHTML=rows.length
    ? `<tr>
        <td style='text-align:right'>Total</td>
        <td></td>
        <td>${totalMinutes} min</td>
        <td>${totalCash} min</td>
        <td>${totalCard} min</td>
        <td>${totalAccount} min</td>
        <td>${totalFree} min</td>
        <td>${totalStaff} min</td>
        <td>${totalRerun} min</td>
        <td class='totalMinsCol'>${totalMinutes} min</td>
        <td></td>
        <td>${totalSignUps}</td>
        <td>${totalBlockBookings}</td>
        ${canDelete?'<td></td>':''}
      </tr>`
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
  let canDelete=hasRolePermission('daily_session_tracker','delete');
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
function toggleEditBlockBookingQuestion(){let signup=document.getElementById('editSessionSignup').checked,row=document.getElementById('editBlockBookingRow'),block=document.getElementById('editSessionBlockBooking');row.style.display=signup?'flex':'none';if(!signup)block.checked=false}
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
let purchaseSelection={treatments:[],glowStudio:[]};
function openBlockMinutesPurchase(){openPurchaseCategory('Block Minutes')}
function openTangiblesPurchase(){openPurchaseCategory('Tangible')}
function openRltProgrammePurchase(){openPurchaseCategory('RLT Programme')}
function openPaygMinutesPurchase(){openPurchaseCategory('PAYG Minutes')}
function openPurchaseCategory(type){
  let products=(data.tanningProducts||[]).filter(p=>p.type===type&&p.active!==false).sort((a,b)=>(a.minutes||0)-(b.minutes||0)||a.title.localeCompare(b.title));
  document.getElementById('purchaseProductModalTitle').textContent=type;
  document.getElementById('purchaseProductList').innerHTML=products.length
    ? products.map(p=>`<div class='purchaseProductRow' onclick="addProductToPurchase('${p.id}')"><div><div class='title'>${escapeHtml(p.title)}</div>${p.minutes?`<div class='sub'>${p.minutes} minutes</div>`:''}</div><div class='price'>£${(+p.price||0).toFixed(2)}</div></div>`).join('')
    : `<div class='muted' style='text-align:center;padding:20px'>No ${escapeHtml(type)} products are set up yet.</div>`;
  document.getElementById('purchaseProductModal').classList.add('show');
}
function closePurchaseProductModal(){document.getElementById('purchaseProductModal').classList.remove('show')}
function addProductToPurchase(id){
  let p=(data.tanningProducts||[]).find(x=>x.id===id);if(!p)return;
  let entry={productId:p.id,title:p.title,price:+p.price||0,productType:p.type,cardMachine:p.cardMachine||'Sunbed Card',minutes:+p.minutes||0};
  if(entry.cardMachine==='Treatment Card')purchaseSelection.treatments.push(entry);
  else purchaseSelection.glowStudio.push(entry);
  renderPurchaseLists();
  closePurchaseProductModal();
}
function removePurchaseItem(list,index){
  purchaseSelection[list].splice(index,1);
  renderPurchaseLists();
}
function hidePurchaseCustomerResultsDelayed(){
  setTimeout(()=>{document.getElementById('purchaseCustomerResults').style.display='none'},150);
}
function searchPurchaseCustomer(){
  let q=document.getElementById('purchaseCustomerSearch').value.trim().toLowerCase();
  let results=document.getElementById('purchaseCustomerResults');
  if(!q){results.style.display='none';results.innerHTML='';return}
  let matches=(data.customers||[]).filter(c=>c.active!==false&&`${c.firstName} ${c.lastName}`.toLowerCase().includes(q)).slice(0,8);
  results.innerHTML=matches.length
    ? matches.map(c=>`<div class='customerSearchResultRow' onclick="selectPurchaseCustomer('${c.id}')"><b>${escapeHtml(c.firstName)} ${escapeHtml(c.lastName)}</b><div class='sub'>${escapeHtml(c.accountNumber)}</div></div>`).join('')
    : `<div class='customerSearchResultRow muted'>No matching customers.</div>`;
  results.style.display='block';
}
function selectPurchaseCustomer(id){
  let c=(data.customers||[]).find(x=>x.id===id);if(!c)return;
  document.getElementById('purchaseCustomerId').value=id;
  document.getElementById('purchaseCustomerSearch').style.display='none';
  document.getElementById('purchaseCustomerResults').style.display='none';
  document.getElementById('purchaseCustomerResults').innerHTML='';
  let selectedDiv=document.getElementById('purchaseCustomerSelected');
  selectedDiv.innerHTML=`<span>${escapeHtml(c.firstName)} ${escapeHtml(c.lastName)} (${escapeHtml(c.accountNumber)})</span><button type='button' onclick='clearPurchaseCustomer()'>✕</button>`;
  selectedDiv.style.display='flex';
}
function clearPurchaseCustomer(){
  document.getElementById('purchaseCustomerId').value='';
  document.getElementById('purchaseCustomerSearch').value='';
  document.getElementById('purchaseCustomerSearch').style.display='block';
  document.getElementById('purchaseCustomerSelected').style.display='none';
}
function renderPurchaseLists(){
  let treatmentsList=document.getElementById('purchaseListTreatments'),glowStudioList=document.getElementById('purchaseListGlowStudio');
  if(!treatmentsList||!glowStudioList)return;
  let renderRow=(item,list,index)=>`<div class='purchaseItemRow'><div class='title'>${escapeHtml(item.title)}</div><div class='right'><div class='price'>£${item.price.toFixed(2)}</div><button type='button' class='purchaseItemRemove' onclick="removePurchaseItem('${list}',${index})">✕</button></div></div>`;
  treatmentsList.innerHTML=purchaseSelection.treatments.length
    ? purchaseSelection.treatments.map((item,i)=>renderRow(item,'treatments',i)).join('')
    : `<div class='purchaseListEmpty'>No items added yet.</div>`;
  glowStudioList.innerHTML=purchaseSelection.glowStudio.length
    ? purchaseSelection.glowStudio.map((item,i)=>renderRow(item,'glowStudio',i)).join('')
    : `<div class='purchaseListEmpty'>No items added yet.</div>`;
  let treatmentsTotal=purchaseSelection.treatments.reduce((s,i)=>s+i.price,0),
      glowStudioTotal=purchaseSelection.glowStudio.reduce((s,i)=>s+i.price,0);
  document.getElementById('purchaseTotalTreatments').value=`£${treatmentsTotal.toFixed(2)}`;
  document.getElementById('purchaseTotalGlowStudio').value=`£${glowStudioTotal.toFixed(2)}`;
  let grandTotalEl=document.getElementById('purchaseGrandTotalPayable');
  if(grandTotalEl)grandTotalEl.textContent=`£${(treatmentsTotal+glowStudioTotal).toFixed(2)}`;
}
function openProcessPurchasesModal(){
  let err=document.getElementById('confirmPurchaseError');err.style.display='none';
  let allItems=[...purchaseSelection.treatments,...purchaseSelection.glowStudio];
  if(!allItems.length){err.textContent='Please add at least one item before processing.';err.style.display='block';return}
  let treatmentsTotal=purchaseSelection.treatments.reduce((s,i)=>s+i.price,0),
      glowStudioTotal=purchaseSelection.glowStudio.reduce((s,i)=>s+i.price,0);
  document.getElementById('ppGlowStudioDue').textContent=`£${glowStudioTotal.toFixed(2)}`;
  document.getElementById('ppTreatmentsDue').textContent=`£${treatmentsTotal.toFixed(2)}`;
  document.getElementById('ppGlowStudioCard').value='';
  document.getElementById('ppGlowStudioCash').value='';
  document.getElementById('ppTreatmentsCard').value='';
  document.getElementById('ppTreatmentsCash').value='';
  document.getElementById('ppGlowStudioCheck').textContent='';
  document.getElementById('ppTreatmentsCheck').textContent='';
  document.getElementById('ppAmountBeingPaid').textContent='£0.00';
  document.getElementById('processPurchasesError').style.display='none';
  document.getElementById('processPurchasesModal').classList.add('show');
}
function closeProcessPurchasesModal(){document.getElementById('processPurchasesModal').classList.remove('show')}
function pence(n){return Math.round((+n||0)*100)}
function halfMatchesDue(cardId,cashId,dueEl){
  let card=pence(document.getElementById(cardId).value),cash=pence(document.getElementById(cashId).value),
      due=pence(dueEl.textContent.replace('£',''));
  return card+cash===due;
}
function updateProcessPurchasesCheck(){
  let glowCard=+document.getElementById('ppGlowStudioCard').value||0,glowCash=+document.getElementById('ppGlowStudioCash').value||0,
      treatCard=+document.getElementById('ppTreatmentsCard').value||0,treatCash=+document.getElementById('ppTreatmentsCash').value||0;
  let glowDue=pence(document.getElementById('ppGlowStudioDue').textContent.replace('£','')),
      treatDue=pence(document.getElementById('ppTreatmentsDue').textContent.replace('£',''));
  let glowEntered=pence(glowCard)+pence(glowCash),treatEntered=pence(treatCard)+pence(treatCash);
  let glowCheck=document.getElementById('ppGlowStudioCheck'),treatCheck=document.getElementById('ppTreatmentsCheck');
  glowCheck.className='processPurchasesCheck '+(glowEntered===glowDue?'ok':'bad');
  glowCheck.textContent=glowEntered===glowDue?'✓ Matches amount due':`Card + Cash must equal the amount due — ${glowEntered<glowDue?`Another £${((glowDue-glowEntered)/100).toFixed(2)} needed`:`£${((glowEntered-glowDue)/100).toFixed(2)} too much`}`;
  treatCheck.className='processPurchasesCheck '+(treatEntered===treatDue?'ok':'bad');
  treatCheck.textContent=treatEntered===treatDue?'✓ Matches amount due':`Card + Cash must equal the amount due — ${treatEntered<treatDue?`Another £${((treatDue-treatEntered)/100).toFixed(2)} needed`:`£${((treatEntered-treatDue)/100).toFixed(2)} too much`}`;
  document.getElementById('ppAmountBeingPaid').textContent=`£${((glowCard+glowCash+treatCard+treatCash)).toFixed(2)}`;
}
async function confirmPurchases(){
  let err=document.getElementById('processPurchasesError');err.style.display='none';
  let glowOk=halfMatchesDue('ppGlowStudioCard','ppGlowStudioCash',document.getElementById('ppGlowStudioDue')),
      treatOk=halfMatchesDue('ppTreatmentsCard','ppTreatmentsCash',document.getElementById('ppTreatmentsDue'));
  if(!glowOk||!treatOk){err.textContent='Card + Cash must equal the amount due in both halves before confirming.';err.style.display='block';return}
  let glowStudioCard=+document.getElementById('ppGlowStudioCard').value||0,
      glowStudioCash=+document.getElementById('ppGlowStudioCash').value||0,
      treatmentsCard=+document.getElementById('ppTreatmentsCard').value||0,
      treatmentsCash=+document.getElementById('ppTreatmentsCash').value||0,
      customerId=document.getElementById('purchaseCustomerId').value||null;
  let allItems=[...purchaseSelection.treatments,...purchaseSelection.glowStudio];
  let treatmentsTotal=purchaseSelection.treatments.reduce((s,i)=>s+i.price,0),
      glowStudioTotal=purchaseSelection.glowStudio.reduce((s,i)=>s+i.price,0),
      grandTotal=treatmentsTotal+glowStudioTotal;
  try{
    let {data:purchase,error}=await sb.from('customer_purchases').insert({
      purchase_date:localDateKey(),treatments_total:treatmentsTotal,glow_studio_total:glowStudioTotal,grand_total:grandTotal,
      glow_studio_card_amount:glowStudioCard,glow_studio_cash_amount:glowStudioCash,
      treatments_card_amount:treatmentsCard,treatments_cash_amount:treatmentsCash,customer_id:customerId
    }).select().single();
    if(error)throw error;
    let itemRows=allItems.map(item=>({
      purchase_id:purchase.id,tanning_product_id:item.productId,product_title:item.title,
      product_type:item.productType,card_machine:item.cardMachine,price:item.price
    }));
    let {error:itemsError}=await sb.from('customer_purchase_items').insert(itemRows);
    if(itemsError)throw itemsError;
    if(customerId){
      let blockMinuteItems=allItems.filter(item=>item.productType==='Block Minutes'&&item.minutes>0);
      for(let item of blockMinuteItems){
        let {error:minutesError}=await sb.rpc('add_minutes_to_customer_account',{
          p_customer:customerId,p_minutes:item.minutes,p_transaction_type:'Block Minutes Purchase',
          p_title:item.title,p_notes:null,p_total_value:item.price
        });
        if(minutesError)throw minutesError;
      }
    }
    purchaseSelection={treatments:[],glowStudio:[]};
    clearPurchaseCustomer();
    closeProcessPurchasesModal();
    renderPurchaseLists();
    await loadLiveData();renderAll();
    alert('Purchase confirmed.');
  }catch(e){err.textContent=e.message||'Could not confirm this purchase.';err.style.display='block'}
}
function hideSessionCustomerResultsDelayed(){
  setTimeout(()=>{document.getElementById('sessionCustomerResults').style.display='none'},150);
}
function searchSessionCustomer(){
  let q=document.getElementById('sessionCustomerSearch').value.trim().toLowerCase();
  let results=document.getElementById('sessionCustomerResults');
  if(!q){results.style.display='none';results.innerHTML='';return}
  let matches=(data.customers||[]).filter(c=>c.active!==false&&`${c.firstName} ${c.lastName}`.toLowerCase().includes(q)).slice(0,8);
  results.innerHTML=matches.length
    ? matches.map(c=>`<div class='customerSearchResultRow' onclick="selectSessionCustomer('${c.id}')"><b>${escapeHtml(c.firstName)} ${escapeHtml(c.lastName)}</b><div class='sub'>${escapeHtml(c.accountNumber)}</div></div>`).join('')
    : `<div class='customerSearchResultRow muted'>No matching customers.</div>`;
  results.style.display='block';
}
function selectSessionCustomer(id){
  let c=(data.customers||[]).find(x=>x.id===id);if(!c)return;
  document.getElementById('sessionCustomerId').value=id;
  document.getElementById('sessionCustomerSearch').style.display='none';
  document.getElementById('sessionCustomerResults').style.display='none';
  document.getElementById('sessionCustomerResults').innerHTML='';
  let selectedDiv=document.getElementById('sessionCustomerSelected');
  selectedDiv.innerHTML=`<span>${escapeHtml(c.firstName)} ${escapeHtml(c.lastName)} (${escapeHtml(c.accountNumber)})</span><button type='button' onclick='clearSessionCustomer()'>✕</button>`;
  selectedDiv.style.display='flex';
  let uvAllowed=!!c.uvAllowed;
  let uvHtml=uvAllowed?`<span style='color:var(--green);font-weight:800'>UV Allowed: Yes</span>`:`<span style='color:#ff3131;font-weight:800'>UV Allowed: No</span>`;
  let warningHtml=uvAllowed?'':`<div style='color:#ff3131;font-weight:900;margin-top:4px'>UV IS SET TO NOT ALLOWED FOR THIS CUSTOMER</div>`;
  document.getElementById('sessionCustomerBalance').innerHTML=`<div>${c.minutesLeft} minutes left on account.</div><div>Bed Use: ${escapeHtml(c.bedUse||'Hybrid')}</div><div>${uvHtml}</div>${warningHtml}`;
}
function clearSessionCustomer(){
  document.getElementById('sessionCustomerId').value='';
  document.getElementById('sessionCustomerSearch').value='';
  document.getElementById('sessionCustomerSearch').style.display='block';
  document.getElementById('sessionCustomerSelected').style.display='none';
  document.getElementById('sessionCustomerBalance').textContent='Select a customer to see account minutes, or leave blank.';
}
function updateSessionLengthTotal(){
  let cash=+document.getElementById('sessionCashMinutes').value||0,
      card=+document.getElementById('sessionCardMinutes').value||0,
      account=+document.getElementById('sessionAccountMinutes').value||0,
      free=+document.getElementById('sessionFreeMinutes').value||0,
      staff=+document.getElementById('sessionStaffMinutes').value||0,
      rerun=+document.getElementById('sessionRerunMinutes').value||0;
  document.getElementById('sessionLength').value=cash+card+account+free+staff+rerun;
  document.getElementById('staffMemberNameRow').style.display=staff>0?'block':'none';
  document.getElementById('rerunReasonRow').style.display=rerun>0?'block':'none';
}
function updateEditSessionLengthTotal(){
  let cash=+document.getElementById('editSessionCashMinutes').value||0,
      card=+document.getElementById('editSessionCardMinutes').value||0,
      account=+document.getElementById('editSessionAccountMinutes').value||0,
      free=+document.getElementById('editSessionFreeMinutes').value||0,
      staff=+document.getElementById('editSessionStaffMinutes').value||0,
      rerun=+document.getElementById('editSessionRerunMinutes').value||0;
  document.getElementById('editSessionLength').value=cash+card+account+free+staff+rerun;
  document.getElementById('editStaffMemberNameRow').style.display=staff>0?'block':'none';
  document.getElementById('editRerunReasonRow').style.display=rerun>0?'block':'none';
}
let editingDailySessionId=null;
function openDailySessionEdit(id){
  let x=(data.bedSessions||[]).find(s=>String(s.id)===String(id));if(!x)return;
  editingDailySessionId=id;
  document.getElementById('editSessionDate').value=x.date;
  document.getElementById('editSessionDateDisplay').value=formatSunbedDisplayDate(x.date);
  document.getElementById('editSessionCashMinutes').value=x.cashMinutes||0;
  document.getElementById('editSessionCardMinutes').value=x.cardMinutes||0;
  document.getElementById('editSessionAccountMinutes').value=x.accountMinutes||0;
  document.getElementById('editSessionFreeMinutes').value=x.freeMinutes||0;
  document.getElementById('editSessionStaffMinutes').value=x.staffMinutes||0;
  document.getElementById('editSessionStaffMemberName').value=x.staffMemberName||'';
  document.getElementById('editSessionRerunMinutes').value=x.rerunMinutes||0;
  document.getElementById('editSessionRerunReason').value=x.rerunReason||'';
  updateEditSessionLengthTotal();
  let newSignup=x.newSignup===true||x.newSignup==='Yes';
  document.getElementById('editSessionSignup').checked=newSignup;
  document.getElementById('editBlockBookingRow').style.display=newSignup?'flex':'none';
  document.getElementById('editSessionBlockBooking').checked=x.purchasedBlockBooking===true||x.purchasedBlockBooking==='Yes';
  let type=normalizeSessionType(x);
  document.getElementById('editSessionRlt').checked=type==='Red Light Therapy';
  document.getElementById('editSessionHybrid').checked=type==='Hybrid';
  document.getElementById('editSessionError').style.display='none';
  document.getElementById('editSessionModal').classList.add('show');
}
function closeDailySessionEdit(){document.getElementById('editSessionModal').classList.remove('show');editingDailySessionId=null}
async function saveDailySessionEdit(){
  if(!editingDailySessionId)return;
  let date=document.getElementById('editSessionDate').value,
      cashMin=+document.getElementById('editSessionCashMinutes').value||0,
      cardMin=+document.getElementById('editSessionCardMinutes').value||0,
      accountMin=+document.getElementById('editSessionAccountMinutes').value||0,
      freeMin=+document.getElementById('editSessionFreeMinutes').value||0,
      staffMin=+document.getElementById('editSessionStaffMinutes').value||0,
      staffMemberName=document.getElementById('editSessionStaffMemberName').value.trim(),
      rerunMin=+document.getElementById('editSessionRerunMinutes').value||0,
      rerunReason=document.getElementById('editSessionRerunReason').value,
      length=cashMin+cardMin+accountMin+freeMin+staffMin+rerunMin,
      newSignup=document.getElementById('editSessionSignup').checked,
      purchasedBlock=document.getElementById('editSessionBlockBooking').checked,
      rlt=document.getElementById('editSessionRlt').checked,
      hybrid=document.getElementById('editSessionHybrid').checked,
      err=document.getElementById('editSessionError');
  err.style.display='none';
  if(!Number.isInteger(length)||length<1){err.textContent='Please enter minutes for at least one payment type.';err.style.display='block';return}
  if(!rlt&&!hybrid){err.textContent='Please select Red Light Therapy or Hybrid.';err.style.display='block';return}
  if(staffMin>0&&!staffMemberName){err.textContent='Please enter the Staff Member Name.';err.style.display='block';return}
  if(rerunMin>0&&!rerunReason){err.textContent='Please select a Rerun Reason.';err.style.display='block';return}
  try{
    let {error}=await sb.from('bed_sessions').update({
      session_date:date,session_length_minutes:length,cash_minutes:cashMin,card_minutes:cardMin,on_account_minutes:accountMin,
      free_minutes:freeMin,staff_minutes:staffMin,staff_member_name:staffMin>0?staffMemberName:null,
      rerun_minutes:rerunMin,rerun_reason:rerunMin>0?rerunReason:null,
      new_sign_up:newSignup,purchased_block_booking:purchasedBlock,session_type:rlt?'Red Light Therapy':'Hybrid',
      payg_minutes:cashMin+cardMin
    }).eq('id',editingDailySessionId);
    if(error)throw error;
    let key=document.getElementById('dailySessionsDatePicker')?.value||date;
    closeDailySessionEdit();
    await loadLiveData();renderAll();renderDailySessionsPage(key);
  }catch(e){err.textContent=e.message||'Could not save changes.';err.style.display='block'}
}
async function deleteDailySessionFromEdit(){
  if(!editingDailySessionId)return;
  let row=(data.bedSessions||[]).find(x=>String(x.id)===String(editingDailySessionId));
  if(!row)return alert('The session could not be found.');
  if(!confirm(`Delete the ${row.length}-minute session logged at ${row.time||'this time'} on ${formatBedSessionsDate(row.date)}?\n\nThis cannot be undone.`))return;
  let result=await deleteBedSessionFromHistory(editingDailySessionId);
  if(!result?.ok)return alert('Could not delete the session: '+(result?.error||'Unknown error.'));
  let key=document.getElementById('dailySessionsDatePicker')?.value||row.date||localDateKey();
  closeDailySessionEdit();
  renderDailySessionsPage(key);
}
function resetBedSessionForm(){
  let today=localDateKey();
  document.getElementById('sessionDate').value=today;
  document.getElementById('sessionDateDisplay').value=formatSunbedDisplayDate(today);
  document.getElementById('sessionCashMinutes').value='';
  document.getElementById('sessionCardMinutes').value='';
  document.getElementById('sessionAccountMinutes').value='';
  document.getElementById('sessionFreeMinutes').value='';
  document.getElementById('sessionStaffMinutes').value='';
  document.getElementById('sessionStaffMemberName').value='';
  document.getElementById('staffMemberNameRow').style.display='none';
  document.getElementById('sessionRerunMinutes').value='';
  document.getElementById('sessionRerunReason').value='';
  document.getElementById('rerunReasonRow').style.display='none';
  document.getElementById('sessionLength').value='';
  document.getElementById('sessionPayment').value='Account Minutes';
  document.getElementById('sessionSignup').checked=false;
  document.getElementById('sessionBlockBooking').checked=false;
  document.getElementById('blockBookingRow').style.display='none';
  document.getElementById('sessionRlt').checked=false;
  document.getElementById('sessionHybrid').checked=false;
  clearSessionCustomer();
  pendingPaygSplit=null;
}
function findRecentDuplicateSession(date,cash,card,account,free,staff,rerun,sessionType,newSignup,purchasedBlock){
  let cutoff=Date.now()-2*60*1000;
  return (data.bedSessions||[]).find(x=>
    x.date===date&&
    (+x.cashMinutes||0)===cash&&(+x.cardMinutes||0)===card&&(+x.accountMinutes||0)===account&&
    (+x.freeMinutes||0)===free&&(+x.staffMinutes||0)===staff&&(+x.rerunMinutes||0)===rerun&&
    x.sessionType===sessionType&&
    (x.newSignup===true||x.newSignup==='Yes')===newSignup&&
    (x.purchasedBlockBooking===true||x.purchasedBlockBooking==='Yes')===purchasedBlock&&
    x.createdAt&&new Date(x.createdAt).getTime()>=cutoff
  );
}
async function recordBedSession(){
 let date=document.getElementById('sessionDate').value||localDateKey(),customerId=document.getElementById('sessionCustomerId').value||null,c=data.customers.find(x=>x.id===customerId),
     cashMin=+document.getElementById('sessionCashMinutes').value||0,
     cardMin=+document.getElementById('sessionCardMinutes').value||0,
     accountMin=+document.getElementById('sessionAccountMinutes').value||0,
     freeMin=+document.getElementById('sessionFreeMinutes').value||0,
     staffMin=+document.getElementById('sessionStaffMinutes').value||0,
     staffMemberName=document.getElementById('sessionStaffMemberName').value.trim(),
     rerunMin=+document.getElementById('sessionRerunMinutes').value||0,
     rerunReason=document.getElementById('sessionRerunReason').value,
     length=cashMin+cardMin+accountMin+freeMin+staffMin+rerunMin,
     payment=document.getElementById('sessionPayment').value,newSignup=document.getElementById('sessionSignup').checked,purchasedBlock=document.getElementById('sessionBlockBooking').checked,rlt=document.getElementById('sessionRlt').checked,hybrid=document.getElementById('sessionHybrid').checked;
 if(!Number.isInteger(length)||length<1)return alert('Please enter minutes for at least one payment type.');if(!rlt&&!hybrid)return alert('Please select Red Light Therapy or Hybrid.');
 if(staffMin>0&&!staffMemberName)return alert('Please enter the Staff Member Name.');
 if(rerunMin>0&&!rerunReason)return alert('Please select a Rerun Reason.');
 let sessionTypeValue=rlt?'Red Light Therapy':'Hybrid';
 if(findRecentDuplicateSession(date,cashMin,cardMin,accountMin,freeMin,staffMin,rerunMin,sessionTypeValue,newSignup,purchasedBlock)){
   if(!confirm('A Session with the exact same details has just been entered. If there was only one actual session, close this and do not record. If there were two actual sessions, please confirm to record this session.'))return;
 }
 if(!c){
   let payload={session_date:date,session_time:new Date().toTimeString().slice(0,8),session_length_minutes:length,cash_minutes:cashMin,card_minutes:cardMin,on_account_minutes:accountMin,free_minutes:freeMin,staff_minutes:staffMin,staff_member_name:staffMin>0?staffMemberName:null,rerun_minutes:rerunMin,rerun_reason:rerunMin>0?rerunReason:null,payment_type:payment,new_sign_up:newSignup,purchased_block_booking:purchasedBlock,session_type:rlt?'Red Light Therapy':'Hybrid',account_minutes_used:0,payg_minutes:cashMin+cardMin};
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
 let age=ageFromDob(c.dob);if(hybrid&&age<18)return alert('CUSTOMER IS BELOW 18 AND IS NOT ALLOWED TO USE UV.');if(hybrid&&age<25&&!c.idChecked)return alert('NO ID HAS BEEN CHECKED FOR THIS CUSTOMER. CHECK CUSTOMER ID BEFORE UV USE.');if(hybrid&&!c.uvAllowed)return alert('This Customer can not use UV. Please check their Customer record to see why.');
 if(accountMin>c.minutesLeft){document.getElementById('insufficientMessage').textContent=`Customer has ${c.minutesLeft} minutes left but this session requires ${accountMin} minutes from account.`;document.getElementById('insufficientMinutesModal').classList.add('show');return}
 let {data:bal,error}=await sb.rpc('record_customer_bed_session_v2',{p_customer:customerId,p_session_date:date,p_cash_minutes:cashMin,p_card_minutes:cardMin,p_account_minutes:accountMin,p_free_minutes:freeMin,p_staff_minutes:staffMin,p_staff_member_name:staffMin>0?staffMemberName:null,p_rerun_minutes:rerunMin,p_rerun_reason:rerunMin>0?rerunReason:null,p_new_sign_up:newSignup,p_purchased_block_booking:purchasedBlock,p_session_type:sessionTypeValue});
 if(error)return alert(error.message);

 resetBedSessionForm();
 showSessionLoggedConfirmation(date);

 try{
   await loadLiveData();
   renderBedTracker();
   renderCustomers();
   showSessionLoggedConfirmation(date);
 }catch(refreshError){
   console.error('Session saved but REVIBE refresh failed:',refreshError);
 }
}
