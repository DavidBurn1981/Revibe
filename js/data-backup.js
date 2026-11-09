// Data Backup (Admin): one click downloads every business table as a single Excel file (one sheet per table).
// Only roles with the 'data_backup' permission (admins always) can see this page.
const BACKUP_TABLES=['customers','customer_purchases','customer_purchase_items','customer_transactions','bed_sessions','daily_takings','cash_transactions','orders','sunbed_bookings','treatment_bookings','treatments','treatment_groupings','tanning_rlt_products','products','partner_discounts','partner_leads','subscription_events','subscription_product_config','first_purchase_discount_config','stripe_minutes_purchases','portal_signup_requests','sms_log','staff_members','staff_shifts','staff_rotas','holiday_requests','monthly_targets','monthly_review_counts','opening_hours','opening_hours_history','clinic_days','renters','renter_products','beds','apartments','apartment_bookings','apartment_cleaning_tasks','finance_outgoings','business_planner_actions','content_ideas','profiles','role_permissions'];
let backupRunning=false;
function backupLastTime(){try{return localStorage.getItem('revibeLastBackup')}catch(e){return null}}
function renderDataBackup(){
  let last=backupLastTime(),el=document.getElementById('backupLastInfo'),warn=document.getElementById('backupOverdue');
  if(!el)return;
  if(last){
    let days=Math.floor((Date.now()-new Date(last).getTime())/86400000);
    el.textContent=`Last backup downloaded from this computer: ${new Date(last).toLocaleString('en-GB',{day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'})} (${days===0?'today':days+(days===1?' day ago':' days ago')}).`;
    warn.style.display=days>=7?'block':'none';
  }else{el.textContent='No backup has been downloaded from this computer yet.';warn.style.display='block'}
}
async function backupFetchAll(table){
  let rows=[],from=0,size=1000;
  for(;;){
    let {data:d,error}=await sb.from(table).select('*').range(from,from+size-1);
    if(error)throw error;
    rows=rows.concat(d||[]);
    if(!d||d.length<size)break;
    from+=size;
  }
  return rows;
}
function backupCell(v){
  if(v===null||v===undefined)return '';
  if(typeof v==='object')v=JSON.stringify(v);
  if(typeof v==='string'&&v.length>32000)v=v.slice(0,32000)+' ...[cut]';
  return v;
}
async function downloadBackup(){
  if(backupRunning)return;
  if(!hasRolePermission('data_backup','view')){alert('You do not have permission to download backups.');return}
  backupRunning=true;
  let btn=document.getElementById('backupBtn'),status=document.getElementById('backupStatus'),log=document.getElementById('backupLog');
  btn.disabled=true;log.innerHTML='';
  let wb=XLSX.utils.book_new(),summary=[],failed=0;
  try{
    for(let i=0;i<BACKUP_TABLES.length;i++){
      let t=BACKUP_TABLES[i];
      status.textContent=`Collecting ${t} (${i+1} of ${BACKUP_TABLES.length})...`;
      try{
        let rows=await backupFetchAll(t);
        let clean=rows.map(r=>{let o={};Object.keys(r).forEach(k=>o[k]=backupCell(r[k]));return o});
        let ws=clean.length?XLSX.utils.json_to_sheet(clean):XLSX.utils.aoa_to_sheet([['(no rows)']]);
        XLSX.utils.book_append_sheet(wb,ws,t.slice(0,31));
        summary.push({'Table':t,'Rows':rows.length,'Result':'OK'});
      }catch(e){
        failed++;
        summary.push({'Table':t,'Rows':'','Result':'FAILED: '+(e.message||e)});
      }
    }
    XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet([{'Backup taken':new Date().toLocaleString('en-GB'),'Taken by':currentProfile?.email||''},...[]]),'About');
    XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(summary),'Check');
    status.textContent='Preparing your file...';
    XLSX.writeFile(wb,`REVIBE Backup ${localDateKey()}.xlsx`);
    try{localStorage.setItem('revibeLastBackup',new Date().toISOString())}catch(e){}
    status.textContent=failed?`Done, but ${failed} table(s) could not be read - see the list below.`:'Done - your backup has downloaded. Keep it somewhere private.';
    log.innerHTML=summary.map(s=>`<div class='muted' style='padding:2px 0'>${escapeHtml(s.Table)}: ${s.Result==='OK'?s.Rows+' rows':'<b style=\"color:#ff8a8a\">'+escapeHtml(s.Result)+'</b>'}</div>`).join('');
  }catch(e){status.textContent='Backup failed: '+(e.message||e)}
  btn.disabled=false;backupRunning=false;renderDataBackup();
}
