async function loadJSON(path){
  const res = await fetch(path, {cache:'no-store'});
  if(!res.ok) throw new Error(`Failed to load ${path}`);
  return await res.json();
}

function uniq(arr){ return [...new Set(arr)].sort(); }

function fmtPct(v){
  if(v === null || v === undefined || v === '') return '';
  const n = Number(v);
  if(Number.isNaN(n)) return String(v);
  return `${n.toFixed(1)}%`;
}
function fmtNum(v){
  const n = Number(v);
  if(Number.isNaN(n)) return String(v);
  return Number.isInteger(n) ? n.toLocaleString() : n.toFixed(1);
}

function pillTagClass(t){
  const k = String(t||'').toLowerCase();
  if(k==='tcm') return 'tcm';
  if(k==='ccm') return 'ccm';
  if(k==='rpm') return 'rpm';
  if(k==='awv') return 'awv';
  if(k==='acp') return 'acp';
  if(k==='sdoh') return 'sdoh';
  return '';
}

/** ===== Left: Performance Metrics =====
Expected fields (from performance_metrics.json):
Org, KPI, Current, Benchmark, Last_3_Mo_Avg, YTD_Avg
*/
function renderPerformanceTable(pmRows){
  const tbody = document.getElementById('performanceTbody');
  tbody.innerHTML = '';

  const utilization = ['Readmission Rate (%)','INP Admits/1,000','ER Admits/1,000'];
  const lowerIsBetter = new Set(utilization);

  function addSection(title){
    const tr = document.createElement('tr');
    tr.className = 'section-row';
    tr.innerHTML = `<td colspan="6">${title}</td>`;
    tbody.appendChild(tr);
  }

  function isPctKpi(kpi){
    return kpi.includes('%') && !kpi.toLowerCase().includes('admits');
  }

  function formatValue(kpi, v){
    return isPctKpi(kpi) ? fmtPct(v) : fmtNum(v);
  }

  function varianceCell(kpi, cur, bmk){
    const c = Number(cur), b = Number(bmk);
    if(Number.isNaN(c) || Number.isNaN(b)) return '';
    // normalize so positive = good
    const v = lowerIsBetter.has(kpi) ? (b - c) : (c - b);
    const cls = v >= 0 ? 'good' : 'bad';
    const arrow = v >= 0 ? '↓' : '↑';
    const txt = isPctKpi(kpi)
      ? `${v >= 0 ? '+' : ''}${v.toFixed(1)} pts`
      : `${v >= 0 ? '+' : ''}${v.toFixed(1)}`;
    return `<span class="${cls}">${txt} ${arrow}</span>`;
  }

  function addRow(row){
    const kpi = row.KPI;
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="col-metric">${kpi}</td>
      <td class="num">${formatValue(kpi, row.Last_3_Mo_Avg)}</td>
      <td class="num"><b>${formatValue(kpi, row.Current)}</b></td>
      <td class="num">${formatValue(kpi, row.Benchmark)}</td>
      <td class="num">${varianceCell(kpi, row.Current, row.Benchmark)}</td>
      <td class="num">${formatValue(kpi, row.YTD_Avg)}</td>
    `;
    tbody.appendChild(tr);
  }

  // index for ordering
  const byKpi = new Map();
  pmRows.forEach(r => byKpi.set(r.KPI, r));

  addSection('UTILIZATION');
  utilization.forEach(k => { if(byKpi.has(k)) addRow(byKpi.get(k)); });

  addSection('CLINICAL QUALITY');
  [...byKpi.keys()].filter(k => !utilization.includes(k)).forEach(k => addRow(byKpi.get(k)));

  ensureGoodBadStyles();
}

/** ===== Left: Program Outcomes =====
Expected fields (from program_outcomes.json):
Org, Program, Eligible, Engaged, Completed, Completion_Pct, Benchmark
*/
function renderProgramOutcomes(poRows){
  const tbody = document.getElementById('programTbody');
  tbody.innerHTML = '';

  function addRow(r){
    const comp = Number(r.Completion_Pct);
    const bmk = Number(r.Benchmark);
    const v = comp - bmk;
    const cls = v >= 0 ? 'good' : 'bad';
    const arrow = v >= 0 ? '↑' : '↓';

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><b>${r.Program}</b></td>
      <td class="num">${Number(r.Eligible).toLocaleString()}</td>
      <td class="num">${Number(r.Engaged).toLocaleString()}</td>
      <td class="num">${Number(r.Completed).toLocaleString()}</td>
      <td class="num"><b style="color:${comp>=bmk ? 'var(--green)' : 'var(--amber)'}">${comp.toFixed(1)}%</b></td>
      <td class="num">${bmk.toFixed(0)}%</td>
      <td class="num"><span class="${cls}">${v >= 0 ? '+' : ''}${v.toFixed(1)} pts ${arrow}</span></td>
    `;
    tbody.appendChild(tr);
  }

  // keep program order
  const order = ['AWV','CCM','TCM','ACP','SDOH'];
  const byProg = new Map(poRows.map(r => [r.Program, r]));
  order.forEach(p => { if(byProg.has(p)) addRow(byProg.get(p)); });

  ensureGoodBadStyles();
}

/** ===== Right feed ===== */
function renderFeed(items){
  const feed = document.getElementById('feed');
  feed.innerHTML = '';
  document.getElementById('totalCount').textContent = `${items.length} Total`;

  items.forEach(it=>{
    const programs = Array.isArray(it.Programs) ? it.Programs : [];
    const tagsHtml = programs.map(p=>`<span class="tag ${pillTagClass(p)}">${p}</span>`).join('');

    const ev = String(it.Event||'');
    const evClass = ev.toLowerCase().includes('inp') ? 'inp' : '';

    const tile = document.createElement('div');
    tile.className='tile';
    tile.innerHTML = `
      <div class="tile-top">
        <div class="row gap8">
          <div class="avatar">👤</div>
          <div>
            <div class="name">${it.Patient || ''} ${tagsHtml}</div>
            <div class="meta">
              <span>📅 ${it.Date || ''}</span>
              <span class="badge org">${it.Org || ''}</span>
              <span class="badge event ${evClass}">${ev}</span>
            </div>
          </div>
        </div>
      </div>
      <div class="kv">
        <div class="kv-row">
          <div>
            <div class="k">FACILITY</div>
            <div class="v">${it.Facility || ''}</div>
          </div>
        </div>
        <div class="kv-row" style="margin-top:10px">
          <div style="flex:1">
            <div class="k">DIAGNOSIS</div>
            <div class="v"><i>${it.Diagnosis || ''}</i></div>
          </div>
          <div class="kv-right">
            <span class="icd">${it.ICD10 || ''}</span>
          </div>
        </div>
      </div>
    `;
    feed.appendChild(tile);
  });
}

function populateSelect(selectEl, values, placeholder){
  selectEl.innerHTML = '';
  const optAll = document.createElement('option');
  optAll.value = '';
  optAll.textContent = placeholder;
  selectEl.appendChild(optAll);
  values.forEach(v=>{
    const o = document.createElement('option');
    o.value = v; o.textContent = v;
    selectEl.appendChild(o);
  });
}

function ensureGoodBadStyles(){
  if(document.getElementById('goodbad-style')) return;
  const style = document.createElement('style');
  style.id = 'goodbad-style';
  style.innerHTML = `.good{color:var(--green);font-weight:800}.bad{color:var(--red);font-weight:800}`;
  document.head.appendChild(style);
}

/** Aggregate helpers for "All Orgs" */
function aggPerformanceAll(pmRows){
  const byKpi = {};
  pmRows.forEach(r=>{
    const k = r.KPI;
    if(!byKpi[k]) byKpi[k] = {KPI:k, Current:0, Benchmark:0, Last_3_Mo_Avg:0, YTD_Avg:0, n:0};
    byKpi[k].Current += Number(r.Current) || 0;
    byKpi[k].Benchmark += Number(r.Benchmark) || 0;
    byKpi[k].Last_3_Mo_Avg += Number(r.Last_3_Mo_Avg) || 0;
    byKpi[k].YTD_Avg += Number(r.YTD_Avg) || 0;
    byKpi[k].n += 1;
  });
  return Object.values(byKpi).map(o=>({
    KPI:o.KPI,
    Current: o.Current/o.n,
    Benchmark: o.Benchmark/o.n,
    Last_3_Mo_Avg: o.Last_3_Mo_Avg/o.n,
    YTD_Avg: o.YTD_Avg/o.n
  }));
}

function aggProgramAll(poRows){
  const byProg = {};
  poRows.forEach(r=>{
    const p = r.Program;
    if(!byProg[p]) byProg[p] = {Program:p, Eligible:0, Engaged:0, Completed:0, Benchmark:Number(r.Benchmark)||0};
    byProg[p].Eligible += Number(r.Eligible)||0;
    byProg[p].Engaged += Number(r.Engaged)||0;
    byProg[p].Completed += Number(r.Completed)||0;
    if(!byProg[p].Benchmark) byProg[p].Benchmark = Number(r.Benchmark)||0;
  });
  return Object.values(byProg).map(o=>({
    Program:o.Program,
    Eligible:o.Eligible,
    Engaged:o.Engaged,
    Completed:o.Completed,
    Completion_Pct: o.Eligible ? (o.Completed/o.Eligible)*100 : 0,
    Benchmark:o.Benchmark
  }));
}

(async function main(){
  const [pmRows, poRows, logRows] = await Promise.all([
    loadJSON('data/performance_metrics.json'),
    loadJSON('data/program_outcomes.json'),
    loadJSON('data/utilization_log.json')
  ]);

  const orgs = uniq(pmRows.map(r=>r.Org).filter(Boolean));
  const events = uniq(logRows.map(r=>r.Event).filter(Boolean));

  const orgSelect = document.getElementById('orgFilter');
  const eventSelect = document.getElementById('eventFilter');

  populateSelect(orgSelect, orgs, 'All Orgs');
  populateSelect(eventSelect, events, 'All Events');

  // Default to PCCA if present, else All Orgs
  orgSelect.value = orgs.includes('PCCA') ? 'PCCA' : '';

  function apply(){
    const org = orgSelect.value;
    const ev = eventSelect.value;

    // LEFT tables
    const pmForLeft = org ? pmRows.filter(r=>r.Org===org) : aggPerformanceAll(pmRows);
    const poForLeft = org ? poRows.filter(r=>r.Org===org) : aggProgramAll(poRows);

    renderPerformanceTable(pmForLeft);
    renderProgramOutcomes(poForLeft);

    // RIGHT feed
    let filtered = logRows.slice();
    if(org) filtered = filtered.filter(r=>r.Org===org);
    if(ev) filtered = filtered.filter(r=>r.Event===ev);

    filtered.sort((a,b)=> (String(b.Date)).localeCompare(String(a.Date)));
    renderFeed(filtered);
  }

  orgSelect.addEventListener('change', apply);
  eventSelect.addEventListener('change', apply);

  apply();
})();
