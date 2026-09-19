// ============================================================
// Customer Segments - Advanced Find style query builder + Excel export
// ============================================================

const SEGMENT_FIELDS=[
  {id:'firstName',label:'First Name',type:'text'},
  {id:'lastName',label:'Last Name',type:'text'},
  {id:'accountNumber',label:'Account Number',type:'text'},
  {id:'email',label:'Email',type:'text'},
  {id:'phone',label:'Phone',type:'text'},
  {id:'address',label:'Address',type:'text'},
  {id:'minutesLeft',label:'Minutes Left',type:'number'},
  {id:'active',label:'Active',type:'bool'},
  {id:'uvAllowed',label:'UV Allowed',type:'bool'},
  {id:'skinType',label:'Skin Type',type:'select',options:['1','2','3','4','5','6']},
  {id:'bedUse',label:'Bed Use',type:'select',options:['Hybrid','Red Light Therapy Only']},
  {id:'subscriptionStatus',label:'Subscription Status',type:'select',options:['No','Subscriber','Subscriber - Failed Payment','No - Failed Payment Grace Period Expired']},
  {id:'createdAt',label:'Account Created',type:'date'},
  {id:'dob',label:'Date of Birth',type:'date'},
  {id:'age',label:'Age',type:'number'},
  {id:'lastPurchaseDate',label:'Last Purchase Date',type:'date'},
  {id:'totalSpend',label:'Total Lifetime Spend (£)',type:'number'},
  {id:'purchaseCount',label:'Number of Purchases',type:'number'},
  {id:'lastSessionDate',label:'Last Session Date',type:'date'},
  {id:'sessionCount',label:'Number of Sessions',type:'number'},
  {id:'lastBookingDate',label:'Last Booking Date',type:'date'},
];

const SEGMENT_OPERATORS={
  text:[
    {id:'contains',label:'Contains'},
    {id:'notContains',label:'Does Not Contain'},
    {id:'equals',label:'Is'},
    {id:'isEmpty',label:'Is Empty'},
    {id:'isNotEmpty',label:'Is Not Empty'},
  ],
  number:[
    {id:'eq',label:'Equals'},
    {id:'gt',label:'Greater Than'},
    {id:'lt',label:'Less Than'},
    {id:'gte',label:'Greater Than or Equal'},
    {id:'lte',label:'Less Than or Equal'},
  ],
  bool:[
    {id:'isTrue',label:'Yes'},
    {id:'isFalse',label:'No'},
  ],
  select:[
    {id:'eq',label:'Is'},
    {id:'neq',label:'Is Not'},
  ],
  date:[
    {id:'before',label:'Before'},
    {id:'after',label:'After'},
    {id:'onDate',label:'On'},
    {id:'isEmpty',label:'Never / Not Set'},
    {id:'isNotEmpty',label:'Has Happened'},
    {id:'olderThan',label:'More Than ... Ago'},
    {id:'withinLast',label:'Within The Last ...'},
  ],
};

let segmentIdCounter=0;
function newSegmentId(){return 'seg'+(++segmentIdCounter)}
function newSegmentGroup(combinator){return {type:'group',id:newSegmentId(),combinator:combinator||'AND',children:[]}}
function newSegmentRule(){
  let field=SEGMENT_FIELDS[0];
  return {type:'rule',id:newSegmentId(),field:field.id,operator:SEGMENT_OPERATORS[field.type][0].id,value:'',valueUnit:'days'};
}

let segmentTree=newSegmentGroup('AND');
let lastSegmentResults=[];

function findSegmentNode(node,id){
  if(node.id===id)return node;
  if(node.type==='group'){
    for(let child of node.children){
      let found=findSegmentNode(child,id);
      if(found)return found;
    }
  }
  return null;
}
function findSegmentParent(node,id,parent){
  if(node.id===id)return parent;
  if(node.type==='group'){
    for(let child of node.children){
      let found=findSegmentParent(child,id,node);
      if(found)return found;
    }
  }
  return null;
}

function resetCustomerSegmentBuilder(){
  segmentTree=newSegmentGroup('AND');
  lastSegmentResults=[];
  renderSegmentBuilder();
  document.getElementById('segmentResultsTable').innerHTML='';
  document.getElementById('segmentResultsHeading').textContent='Results';
  document.getElementById('segmentExportBtn').style.display='none';
  document.getElementById('segmentResultCountBadge').style.display='none';
}

function addSegmentRule(groupId){
  let group=findSegmentNode(segmentTree,groupId);if(!group)return;
  group.children.push(newSegmentRule());
  renderSegmentBuilder();
}
function addSegmentGroup(groupId){
  let group=findSegmentNode(segmentTree,groupId);if(!group)return;
  group.children.push(newSegmentGroup('AND'));
  renderSegmentBuilder();
}
function removeSegmentNode(id){
  if(segmentTree.id===id)return; // never remove the root
  let parent=findSegmentParent(segmentTree,id,null);
  if(!parent)return;
  parent.children=parent.children.filter(c=>c.id!==id);
  renderSegmentBuilder();
}
function setSegmentCombinator(groupId,combinator){
  let group=findSegmentNode(segmentTree,groupId);if(!group)return;
  group.combinator=combinator;
  renderSegmentBuilder();
}
function updateSegmentRuleField(ruleId,fieldId){
  let rule=findSegmentNode(segmentTree,ruleId);if(!rule)return;
  let field=SEGMENT_FIELDS.find(f=>f.id===fieldId);if(!field)return;
  rule.field=fieldId;
  rule.operator=SEGMENT_OPERATORS[field.type][0].id;
  rule.value=field.type==='select'?(field.options[0]||''):'';
  rule.valueUnit='days';
  renderSegmentBuilder();
}
function updateSegmentRuleOperator(ruleId,operatorId){
  let rule=findSegmentNode(segmentTree,ruleId);if(!rule)return;
  rule.operator=operatorId;
  renderSegmentBuilder();
}
function updateSegmentRuleValue(ruleId,value){
  let rule=findSegmentNode(segmentTree,ruleId);if(!rule)return;
  rule.value=value;
}
function updateSegmentRuleValueUnit(ruleId,unit){
  let rule=findSegmentNode(segmentTree,ruleId);if(!rule)return;
  rule.valueUnit=unit;
}

function renderSegmentBuilder(){
  let root=document.getElementById('segmentBuilderRoot');if(!root)return;
  root.innerHTML=renderSegmentGroupHtml(segmentTree,true);
}
function renderSegmentGroupHtml(group,isRoot){
  let combinatorHtml=`
    <div style='display:flex;align-items:center;gap:8px;margin-bottom:10px'>
      <span class='muted'>Match</span>
      <select onchange="setSegmentCombinator('${group.id}',this.value)" style='width:auto'>
        <option value='AND' ${group.combinator==='AND'?'selected':''}>ALL of the following (AND)</option>
        <option value='OR' ${group.combinator==='OR'?'selected':''}>ANY of the following (OR)</option>
      </select>
      ${isRoot?'':`<button type='button' onclick="removeSegmentNode('${group.id}')" style='margin-left:auto'>Remove Group ✕</button>`}
    </div>`;
  let childrenHtml=group.children.length
    ? group.children.map(child=>child.type==='group'?renderSegmentGroupHtml(child,false):renderSegmentRuleHtml(child)).join('')
    : `<div class='muted' style='padding:8px 0'>No conditions yet. Add a rule below.</div>`;
  let actionsHtml=`
    <div style='display:flex;gap:8px;margin-top:8px'>
      <button type='button' onclick="addSegmentRule('${group.id}')">+ Add Rule</button>
      <button type='button' onclick="addSegmentGroup('${group.id}')">+ Add Group</button>
    </div>`;
  return `<div class='segmentGroup' style='border:1px solid var(--line);border-radius:8px;padding:12px;margin:${isRoot?'0':'10px 0'};background:${isRoot?'transparent':'#1a1d23'}'>
    ${combinatorHtml}
    <div class='segmentGroupChildren'>${childrenHtml}</div>
    ${actionsHtml}
  </div>`;
}
function renderSegmentRuleHtml(rule){
  let field=SEGMENT_FIELDS.find(f=>f.id===rule.field)||SEGMENT_FIELDS[0];
  let operators=SEGMENT_OPERATORS[field.type];
  let fieldOptionsHtml=SEGMENT_FIELDS.map(f=>`<option value='${f.id}' ${f.id===rule.field?'selected':''}>${escapeHtml(f.label)}</option>`).join('');
  let operatorOptionsHtml=operators.map(o=>`<option value='${o.id}' ${o.id===rule.operator?'selected':''}>${escapeHtml(o.label)}</option>`).join('');
  let valueHtml=renderSegmentValueInput(rule,field);
  return `<div class='segmentRule' style='display:flex;flex-wrap:wrap;align-items:center;gap:8px;padding:6px 0'>
    <select style='width:auto' onchange="updateSegmentRuleField('${rule.id}',this.value)">${fieldOptionsHtml}</select>
    <select style='width:auto' onchange="updateSegmentRuleOperator('${rule.id}',this.value)">${operatorOptionsHtml}</select>
    ${valueHtml}
    <button type='button' onclick="removeSegmentNode('${rule.id}')">✕</button>
  </div>`;
}
function renderSegmentValueInput(rule,field){
  let noValueOperators=['isEmpty','isNotEmpty'];
  if(field.type==='bool')return '';
  if(noValueOperators.includes(rule.operator))return '';
  if(rule.operator==='olderThan'||rule.operator==='withinLast'){
    return `<input type='number' min='0' step='1' style='width:80px' value="${escapeHtml(rule.value)}" oninput="updateSegmentRuleValue('${rule.id}',this.value)">
      <select style='width:auto' onchange="updateSegmentRuleValueUnit('${rule.id}',this.value)">
        <option value='days' ${rule.valueUnit==='days'?'selected':''}>Days</option>
        <option value='weeks' ${rule.valueUnit==='weeks'?'selected':''}>Weeks</option>
        <option value='months' ${rule.valueUnit==='months'?'selected':''}>Months</option>
      </select>`;
  }
  if(field.type==='select'){
    return `<select style='width:auto' onchange="updateSegmentRuleValue('${rule.id}',this.value)">
      ${(field.options||[]).map(o=>`<option value='${escapeHtml(o)}' ${o===rule.value?'selected':''}>${escapeHtml(o)}</option>`).join('')}
    </select>`;
  }
  if(field.type==='number')return `<input type='number' step='1' style='width:110px' value="${escapeHtml(rule.value)}" oninput="updateSegmentRuleValue('${rule.id}',this.value)">`;
  if(field.type==='date')return `<input type='date' style='width:auto' value="${escapeHtml(rule.value)}" oninput="updateSegmentRuleValue('${rule.id}',this.value)">`;
  return `<input type='text' placeholder='Value' value="${escapeHtml(rule.value)}" oninput="updateSegmentRuleValue('${rule.id}',this.value)">`;
}

// ---------- Derived fields + evaluation ----------
function computeSegmentDerivedFields(customerId){
  let purchases=(data.customerPurchases||[]).filter(p=>p.customerId===customerId);
  let sessions=(data.bedSessions||[]).filter(s=>s.customerId===customerId);
  let bookings=(data.sunbedBookings||[]).filter(b=>b.customerId===customerId);
  let maxDate=(arr)=>arr.length?arr.reduce((max,x)=>x.date>max?x.date:max,arr[0].date):null;
  return {
    lastPurchaseDate:maxDate(purchases),
    totalSpend:purchases.reduce((s,p)=>s+(+p.grandTotal||0),0),
    purchaseCount:purchases.length,
    lastSessionDate:maxDate(sessions),
    sessionCount:sessions.length,
    lastBookingDate:maxDate(bookings),
  };
}
function buildEnrichedSegmentCustomers(){
  return (data.customers||[]).map(c=>({
    ...c,
    age:c.dob?ageFromDob(c.dob):null,
    ...computeSegmentDerivedFields(c.id),
  }));
}
function evaluateSegmentRule(field,rule,customer){
  let actual=customer[field.id];
  if(field.type==='text'){
    let a=(actual||'').toString().toLowerCase(),v=(rule.value||'').toString().toLowerCase();
    if(rule.operator==='contains')return a.includes(v);
    if(rule.operator==='notContains')return !a.includes(v);
    if(rule.operator==='equals')return a===v;
    if(rule.operator==='isEmpty')return !a;
    if(rule.operator==='isNotEmpty')return !!a;
    return false;
  }
  if(field.type==='number'){
    let a=+actual||0,v=+rule.value||0;
    if(rule.operator==='eq')return a===v;
    if(rule.operator==='gt')return a>v;
    if(rule.operator==='lt')return a<v;
    if(rule.operator==='gte')return a>=v;
    if(rule.operator==='lte')return a<=v;
    return false;
  }
  if(field.type==='bool'){
    if(rule.operator==='isTrue')return !!actual;
    if(rule.operator==='isFalse')return !actual;
    return false;
  }
  if(field.type==='select'){
    if(rule.operator==='eq')return String(actual)===String(rule.value);
    if(rule.operator==='neq')return String(actual)!==String(rule.value);
    return false;
  }
  if(field.type==='date'){
    if(rule.operator==='isEmpty')return !actual;
    if(rule.operator==='isNotEmpty')return !!actual;
    if(!actual)return false;
    let d=new Date(actual.length>10?actual:actual+'T00:00:00');
    if(rule.operator==='before')return d.getTime()<new Date(rule.value+'T00:00:00').getTime();
    if(rule.operator==='after')return d.getTime()>new Date(rule.value+'T00:00:00').getTime();
    if(rule.operator==='onDate')return (actual||'').slice(0,10)===rule.value;
    if(rule.operator==='olderThan'||rule.operator==='withinLast'){
      let unitMs=rule.valueUnit==='days'?86400000:rule.valueUnit==='weeks'?7*86400000:30*86400000;
      let cutoff=Date.now()-((+rule.value||0)*unitMs);
      return rule.operator==='olderThan'?d.getTime()<cutoff:d.getTime()>=cutoff;
    }
    return false;
  }
  return false;
}
function evaluateSegmentNode(node,customer){
  if(node.type==='group'){
    if(!node.children.length)return node.combinator==='AND';
    let results=node.children.map(child=>evaluateSegmentNode(child,customer));
    return node.combinator==='AND'?results.every(Boolean):results.some(Boolean);
  }
  let field=SEGMENT_FIELDS.find(f=>f.id===node.field);
  if(!field)return true;
  return evaluateSegmentRule(field,node,customer);
}

// ---------- Run search + render results ----------
function runCustomerSegmentSearch(){
  let enriched=buildEnrichedSegmentCustomers();
  lastSegmentResults=enriched.filter(c=>evaluateSegmentNode(segmentTree,c));

  let countBadge=document.getElementById('segmentResultCountBadge');
  if(countBadge){
    countBadge.textContent=`${lastSegmentResults.length} customer${lastSegmentResults.length===1?'':'s'} found`;
    countBadge.style.display='block';
  }

  let heading=document.getElementById('segmentResultsHeading');
  if(heading)heading.textContent=`Results (${lastSegmentResults.length} customer${lastSegmentResults.length===1?'':'s'})`;

  let exportBtn=document.getElementById('segmentExportBtn');
  if(exportBtn)exportBtn.style.display=lastSegmentResults.length?'inline-block':'none';

  let table=document.getElementById('segmentResultsTable');
  if(!table)return;
  if(!lastSegmentResults.length){
    table.innerHTML=`<tr><td class='muted' style='text-align:center;padding:24px'>No customers match these conditions.</td></tr>`;
    return;
  }
  table.innerHTML='<tr><th>Name</th><th>Account</th><th>Email</th><th>Phone</th><th>Minutes Left</th><th>Last Purchase</th><th>Total Spend</th><th>Last Session</th></tr>'+
    lastSegmentResults.map(c=>`<tr class='clinicRow' onclick="openCustomer('${c.id}')">
      <td>${escapeHtml(c.firstName)} ${escapeHtml(c.lastName)}</td>
      <td>${escapeHtml(c.accountNumber||'')}</td>
      <td>${escapeHtml(c.email||'—')}</td>
      <td>${escapeHtml(c.phone||'—')}</td>
      <td>${c.minutesLeft}</td>
      <td>${c.lastPurchaseDate?formatBedSessionsDate(c.lastPurchaseDate):'Never'}</td>
      <td>£${(+c.totalSpend||0).toFixed(2)}</td>
      <td>${c.lastSessionDate?formatBedSessionsDate(c.lastSessionDate):'Never'}</td>
    </tr>`).join('');
}

// ---------- Export to Excel ----------
let segmentExportSelectedColumns=new Set(['firstName','lastName','email','phone']);
function openSegmentExportModal(){
  let err=document.getElementById('segmentExportError');if(err)err.style.display='none';
  let list=document.getElementById('segmentExportColumnList');
  if(list){
    list.innerHTML=SEGMENT_FIELDS.map(f=>`
      <label style='display:flex;align-items:center;gap:6px;font-size:13px'>
        <input type='checkbox' data-segment-col='${f.id}' ${segmentExportSelectedColumns.has(f.id)?'checked':''} onchange="toggleSegmentExportColumn('${f.id}',this.checked)">
        ${escapeHtml(f.label)}
      </label>`).join('');
  }
  document.getElementById('segmentExportModal').classList.add('show');
}
function toggleSegmentExportColumn(fieldId,checked){
  if(checked)segmentExportSelectedColumns.add(fieldId);else segmentExportSelectedColumns.delete(fieldId);
}
function setAllSegmentExportColumns(all){
  segmentExportSelectedColumns=new Set(all?SEGMENT_FIELDS.map(f=>f.id):[]);
  document.querySelectorAll('[data-segment-col]').forEach(el=>el.checked=all);
}
function exportCustomerSegmentToExcel(){
  let err=document.getElementById('segmentExportError');
  if(!segmentExportSelectedColumns.size){err.textContent='Please select at least one column.';err.style.display='block';return}
  if(!lastSegmentResults.length){err.textContent='No results to export - run a search first.';err.style.display='block';return}
  err.style.display='none';

  let columns=SEGMENT_FIELDS.filter(f=>segmentExportSelectedColumns.has(f.id));
  let rows=lastSegmentResults.map(c=>{
    let row={};
    columns.forEach(f=>{
      let v=c[f.id];
      if(f.type==='bool')v=v?'Yes':'No';
      if(f.type==='number')v=+v||0;
      row[f.label]=v==null?'':v;
    });
    return row;
  });

  let ws=XLSX.utils.json_to_sheet(rows);
  let wb=XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb,ws,'Customer Segment');
  let filename=`REVIBE Customer Segment ${localDateKey()}.xlsx`;
  XLSX.writeFile(wb,filename);
  document.getElementById('segmentExportModal').classList.remove('show');
}
