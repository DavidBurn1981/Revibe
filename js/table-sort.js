/* Click-to-sort for every table header across the system. */
(function(){
  var state = {};            // table key -> {col, dir}
  var busy = false;
  // Replace the old basic sorter (js/app.js) with this one
  window.makeTablesSortable = function(){};
  function stripOld(th){
    if (!th.dataset || !th.dataset.sortReady) return;
    th.onclick = null; th.removeAttribute('onclick');
    th.classList.remove('sortable'); delete th.dataset.sortReady;
    var o = th.querySelector('.sortIcon'); if (o) o.remove();
  }
  var css = document.createElement('style');
  css.textContent = "table.table th.ts-sortable{cursor:pointer;user-select:none;white-space:nowrap}" +
    "table.table th.ts-sortable:hover{text-decoration:underline}" +
    "table.table th.ts-sortable .ts-arrow{font-size:10px;margin-left:4px;opacity:.35}" +
    "table.table th.ts-sortable.ts-asc .ts-arrow,table.table th.ts-sortable.ts-desc .ts-arrow{opacity:1}";
  document.head.appendChild(css);

  function txt(el){ return (el.getAttribute('data-sort') != null ? el.getAttribute('data-sort') : el.textContent).replace(/\s+/g,' ').trim(); }
  function isEmptyVal(s){ return s === '' || s === '-' || s === '—' || s === '–' || s === 'N/A' || s === 'n/a'; }
  var MONTHS = {jan:0,feb:1,mar:2,apr:3,may:4,jun:5,jul:6,aug:7,sep:8,oct:9,nov:10,dec:11};
  function parse(s){
    if (isEmptyVal(s)) return null;
    var m;
    // dd/mm/yyyy [hh:mm]
    if ((m = s.match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})(?:[ ,]+(\d{1,2}):(\d{2}))?/))) {
      var y = +m[3]; if (y < 100) y += 2000;
      return {t:'n', v:new Date(y, +m[2]-1, +m[1], +(m[4]||0), +(m[5]||0)).getTime()};
    }
    // ISO
    if ((m = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?/))) {
      return {t:'n', v:new Date(+m[1], +m[2]-1, +m[3], +(m[4]||0), +(m[5]||0)).getTime()};
    }
    // 12 Oct 2026 [14:30]
    if ((m = s.match(/(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]{3})[a-z]*\.?,?\s+(\d{4})(?:[ ,]+(\d{1,2}):(\d{2}))?/)) && MONTHS[m[2].toLowerCase()] != null) {
      return {t:'n', v:new Date(+m[3], MONTHS[m[2].toLowerCase()], +m[1], +(m[4]||0), +(m[5]||0)).getTime()};
    }
    // pure time hh:mm
    if ((m = s.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/))) return {t:'n', v:+m[1]*60 + +m[2]};
    // number / currency / percent / minutes
    var c = s.replace(/[£$€,\s]/g,'').replace(/%$/,'');
    if (/^[-+]?\d*\.?\d+$/.test(c)) return {t:'n', v:parseFloat(c)};
    if ((m = c.match(/^\(?-?[£]?(\d*\.?\d+)\)?/)) && /^[-+(£]?\d/.test(c) && c.length - m[0].length <= 12 && /^[-+]?\d*\.?\d+[a-zA-Z]{0,8}$/.test(c)) return {t:'n', v:parseFloat(c)};
    return {t:'s', v:s.toLowerCase()};
  }
  function colStart(row, cell){
    var n = 0;
    for (var i = 0; i < row.cells.length; i++) { if (row.cells[i] === cell) return n; n += row.cells[i].colSpan || 1; }
    return -1;
  }
  function cellAt(row, col){
    var n = 0;
    for (var i = 0; i < row.cells.length; i++) {
      var w = row.cells[i].colSpan || 1;
      if (col >= n && col < n + w) return row.cells[i];
      n += w;
    }
    return null;
  }
  function isTotalsRow(tr){
    if (tr.parentNode && tr.parentNode.tagName === 'TFOOT') return true;
    if (/total/i.test(tr.className || '')) return true;
    var f = tr.cells[0]; if (!f) return false;
    var t = txt(f);
    if (/^(grand\s+)?totals?\b/i.test(t)) return true;
    // bold-styled summary rows with a Total label in the first two cells
    if (tr.cells[1] && /^totals?:?$/i.test(txt(tr.cells[1])) && !txt(f)) return true;
    return false;
  }
  function tableKey(table){
    if (table.id) return table.id;
    if (!table._tsKey) table._tsKey = 'anon' + Math.random().toString(36).slice(2);
    return table._tsKey;
  }
  function headerRowOf(th){ return th.parentNode; }

  function sortTable(table, th, dir, quiet){
    var hrow = headerRowOf(th);
    var col = colStart(hrow, th);
    if (col < 0) return;
    var section = hrow.parentNode;               // thead or tbody (or table)
    var body;
    var rows;
    if (section.tagName === 'THEAD') {
      body = table.tBodies[0]; if (!body) return;
      rows = Array.prototype.slice.call(body.rows);
    } else {
      body = section;
      var all = Array.prototype.slice.call(body.rows);
      rows = all.slice(all.indexOf(hrow) + 1);
    }
    // group rows: detail rows (single wide cell) travel with the previous row; totals stay at bottom
    var groups = [], totals = [];
    rows.forEach(function(tr){
      if (tr.querySelector('th') && !tr.querySelector('td')) return;     // sub-header rows stay put (not moved)
      if (isTotalsRow(tr)) { totals.push(tr); return; }
      var wide = tr.cells.length === 1 && tr.cells[0].colSpan > 1;
      if (wide && groups.length) { groups[groups.length-1].rows.push(tr); return; }
      groups.push({rows:[tr], main:tr});
    });
    if (groups.length < 2) return;
    groups.forEach(function(g, i){
      var c = cellAt(g.main, col);
      g.p = c ? parse(txt(c)) : null; g.i = i;
    });
    var mult = dir === 'asc' ? 1 : -1;
    groups.sort(function(a, b){
      var an = a.p === null, bn = b.p === null;
      if (an || bn) return an && bn ? a.i - b.i : (an ? 1 : -1);   // blanks always last
      var r;
      if (a.p.t === 'n' && b.p.t === 'n') r = a.p.v - b.p.v;
      else r = String(a.p.v).localeCompare(String(b.p.v), undefined, {numeric:true});
      return r ? r * mult : a.i - b.i;
    });
    // anchor point: insert before first totals row or at end
    var frag = document.createDocumentFragment();
    groups.forEach(function(g){ g.rows.forEach(function(tr){ frag.appendChild(tr); }); });
    var ref = null;
    if (totals.length) ref = totals[0];
    // totals that sat before data rows are unusual; keep simple
    busy = true;
    body.insertBefore(frag, ref);
    busy = false; if (window.__tsObs) window.__tsObs.takeRecords();
  }

  function decorate(table){
    if (table.classList.contains('permissionsTable')) return;
    var ths = table.querySelectorAll('th');
    var key = tableKey(table), st = state[key];
    busy = true;
    for (var i = 0; i < ths.length; i++) {
      var th = ths[i];
      stripOld(th);
      if (th.hasAttribute('data-nosort')) continue;
      if (th.onclick || th.hasAttribute('onclick')) continue;
      var label = th.textContent.replace(/[▲▼↕\s]/g,'');
      if (!label) continue;
      if (th.querySelector('input,select,button,textarea')) continue;
      if (!th.classList.contains('ts-sortable')) {
        th.classList.add('ts-sortable');
        var a = document.createElement('span'); a.className = 'ts-arrow'; a.textContent = '↕';
        th.appendChild(a);
      }
      var col = colStart(th.parentNode, th);
      var on = st && st.col === col && st.row === th.parentNode.rowIndex;
      th.classList.toggle('ts-asc', !!on && st.dir === 'asc');
      th.classList.toggle('ts-desc', !!on && st.dir === 'desc');
      var arrow = th.querySelector('.ts-arrow');
      if (arrow) arrow.textContent = on ? (st.dir === 'asc' ? '▲' : '▼') : '↕';
    }
    busy = false; if (window.__tsObs) window.__tsObs.takeRecords();
  }

  document.addEventListener('click', function(e){
    var th = e.target.closest && e.target.closest('th.ts-sortable');
    if (!th) return;
    var table = th.closest('table'); if (!table) return;
    var key = tableKey(table);
    var col = colStart(th.parentNode, th);
    var row = th.parentNode.rowIndex;
    var st = state[key];
    var dir = (st && st.col === col && st.row === row && st.dir === 'asc') ? 'desc' : 'asc';
    state[key] = {col:col, row:row, dir:dir, th:null};
    sortTable(table, th, dir);
    decorate(table);
  });

  // Re-decorate / re-apply sort after tables are re-rendered
  var pending = new Set(), timer = null;
  function schedule(table){
    pending.add(table);
    if (timer) return;
    timer = setTimeout(function(){
      timer = null;
      var list = Array.from(pending); pending.clear();
      list.forEach(function(t){
        if (!document.contains(t)) return;
        var needs = t.querySelector('th:not(.ts-sortable)');
        var key = tableKey(t), st = state[key];
        if (st) {
          var hr = t.rows[st.row];
          var th = hr && Array.prototype.find.call(hr.cells, function(c){ return colStart(hr, c) === st.col && c.tagName === 'TH'; });
          if (th) {
            var body = hr.parentNode.tagName === 'THEAD' ? t.tBodies[0] : hr.parentNode;
            // only re-sort if rows were re-rendered (new header cells or unsorted marker)
            if (needs || t._tsDirty) { sortTable(t, th, st.dir); }
            t._tsDirty = false;
          }
        }
        decorate(t);
      });
    }, 30);
  }
  var obs = new MutationObserver(function(muts){
    if (busy) return;
    var seen = new Set();
    muts.forEach(function(m){
      var n = m.target.nodeType === 1 ? m.target : m.target.parentNode;
      var t = n && n.closest ? n.closest('table.table') : null;
      if (!t && m.addedNodes) {
        for (var i = 0; i < m.addedNodes.length; i++) {
          var a = m.addedNodes[i];
          if (a.nodeType === 1) {
            if (a.matches && a.matches('table.table')) seen.add(a);
            else if (a.querySelectorAll) a.querySelectorAll('table.table').forEach(function(x){ seen.add(x); });
          }
        }
      }
      if (t) seen.add(t);
    });
    seen.forEach(function(t){
      // a re-render replaced the rows: mark so the saved sort is re-applied
      t._tsDirty = true; schedule(t);
    });
  });
  window.__tsObs = obs;
  obs.observe(document.body, {childList:true, subtree:true});

  function init(){ document.querySelectorAll('table.table').forEach(decorate); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
