async function save(){await loadLiveData();renderAll()}
function startMonday(d){d=new Date(d);let day=d.getDay()||7;d.setDate(d.getDate()-day+1);d.setHours(0,0,0,0);return d}
function iso(d){return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`}
function nice(d){return d.toLocaleDateString('en-GB',{weekday:'short',day:'numeric',month:'short'})}
function hexToRgba(hex,alpha){let h=(hex||'#18d7e8').replace('#','');if(h.length!==6)return `rgba(24,215,232,${alpha})`;let r=parseInt(h.slice(0,2),16),g=parseInt(h.slice(2,4),16),b=parseInt(h.slice(4,6),16);return `rgba(${r},${g},${b},${alpha})`}
function escapeHtml(value){
  return String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
}
function localDateKey(d=new Date()){let y=d.getFullYear(),m=String(d.getMonth()+1).padStart(2,'0'),day=String(d.getDate()).padStart(2,'0');return `${y}-${m}-${day}`}
const DAY_NAMES=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
function timeToMinutes(t){if(!t)return 0;let [h,m]=t.split(':').map(Number);return h*60+m}
function hoursDuration(h){return Math.max(0,(timeToMinutes(h.close)-timeToMinutes(h.open))/60)}
function effectiveHoursForDate(dateKey){
  let d=parseLocalDateKey(dateKey),day=d.getDay(),history=data.openingHoursHistory||[];
  let historic=history
    .filter(x=>x.day===day&&x.effectiveFrom<=dateKey&&(!x.effectiveTo||x.effectiveTo>=dateKey))
    .sort((a,b)=>b.effectiveFrom.localeCompare(a.effectiveFrom))[0];
  if(historic)return {open:historic.open,close:historic.close};
  return (data.openingHours||DEFAULT_OPENING_HOURS)[day]||DEFAULT_OPENING_HOURS[day];
}
function clinicShopHoursForDate(dateKey){
  if(!dateKey)return null;
  let h=effectiveHoursForDate(dateKey);
  return h&&h.open&&h.close?{open:String(h.open).slice(0,5),close:String(h.close).slice(0,5)}:null;
}
function setClinicTimeInputBounds(startId,endId,dateKey,hintId,resetValues=false){
  let h=clinicShopHoursForDate(dateKey),startEl=document.getElementById(startId),endEl=document.getElementById(endId),hint=document.getElementById(hintId);
  if(!h||!startEl||!endEl)return;
  startEl.min=h.open;startEl.max=h.close;
  endEl.min=h.open;endEl.max=h.close;
  if(resetValues){
    startEl.value=h.open;
    endEl.value=h.close;
  }else{
    if(!startEl.value||timeToMinutes(startEl.value)<timeToMinutes(h.open)||timeToMinutes(startEl.value)>=timeToMinutes(h.close))startEl.value=h.open;
    if(!endEl.value||timeToMinutes(endEl.value)>timeToMinutes(h.close)||timeToMinutes(endEl.value)<=timeToMinutes(h.open))endEl.value=h.close;
  }
  if(hint)hint.textContent=`Shop hours for this date: ${h.open}–${h.close}. Clinic hours must stay within this range.`;
}
function clinicHoursValidationMessage(dateKey,start,end){
  if(!start||!end||timeToMinutes(end)<=timeToMinutes(start))return 'Please enter valid clinic start and end times.';
  let h=clinicShopHoursForDate(dateKey);
  if(!h)return null;
  if(timeToMinutes(start)<timeToMinutes(h.open))return `Clinic start time cannot be earlier than the shop opening time of ${h.open}.`;
  if(timeToMinutes(end)>timeToMinutes(h.close))return `Clinic end time cannot be later than the shop closing time of ${h.close}.`;
  return null;
}
function getElapsedOpeningHours(now=new Date()){
  let key=localDateKey(now),h=effectiveHoursForDate(key),openMin=timeToMinutes(h.open),closeMin=timeToMinutes(h.close);
  let nowMin=now.getHours()*60+now.getMinutes()+now.getSeconds()/60;
  if(nowMin<=openMin)return 0;
  return Math.max(0,(Math.min(nowMin,closeMin)-openMin)/60);
}
const MONTH_NAMES=['January','February','March','April','May','June','July','August','September','October','November','December'];
function currentMonthIdentity(){
  let d=new Date();
  return {month:d.getMonth()+1,year:d.getFullYear()};
}
