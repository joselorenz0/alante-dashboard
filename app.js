
async function loadJSON(path){
  const res = await fetch(path, {cache:'no-store'});
  if(!res.ok) throw new Error(`Failed to load ${path}`);
  return await res.json();
}

function uniq(arr){ return [...new Set(arr.filter(Boolean))].sort(); }

function fmtPct(v){
  if(v === null || v === undefined || v === '') return '';
  const n = Number(v);
  if(Number.isNaN(n)) return String(v);
  return `${n.toFixed(1)}%`;
}
function fmtNum(v){
  if(v === null || v === undefined || v === '') return '';
  const n = Number(v);
  if(Number.isNaN(n)) return String(v);
  // show 0 decimals for large counts, 1 for smaller
  return (Math.abs(n) >= 100 ? n.toFixed(0) : n.toFixed(1));
}

const lowerIsBetter = new Set(['Readmission Rate (%)','INP Admits/1,000','ER Admits/1,000']);

let pmRows = [];
let programRows = [];
let logRows = [];

function pillTagClass(p){
  const key = String(p||'').toUpperCase();
  if(key==='TCM') return 'tcm';
  if(key==='CCM') return 'ccm';
  if(key==='RPM') return 'rpm';
  if(key==='AWV') return 'awv';
  if(key==='ACP') return 'acp';
  if(key==='SDOH') return 'sdoh';
  return 'neutral';
}

function renderPerformanceTable(rows){
  const tbody = document.getElementById('performanceTbody');
  tbody.innerHTML = '';

  const utilization = ['Readmission Rate (%)','INP Admits/1,000','ER Admits/1,000'];

  function addSection(title){
    const tr = document.createElement('tr');
    tr.className = 'section-row';
    tr.innerHTML = `<td colspan="6">${title}</td>`;
    tbody.appendChild(tr);
  }

  function varianceHtml(kpi, cur, bmk){
    const c = Number(cur), b = Number(bmk);
    if(Number.isNaN(c) || Number.isNaN(b)) return '';
    const isPct = kpi.includes('%') && !kpi.includes('Admits');

    // normalized: positive = good
    const v = lowerIsBetter.has(kpi) ? (b - c) : (c - b);
    const cls = v >= 0 ? 'good' : 'bad';
    const arrow = v >= 0 ? '↓' : '↑';
    const txt = `${v >= 0 ? '+' : ''}${isPct ? v.toFixed(1)+' pts' : v.toFixed(1)+' pts'}`;
    return `<span class="${cls}">${txt} ${arrow}</span>`;
  }

  function addRow(r){
    const kpi = r.KPI;
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="col-metric">${kpi}</td>
      <td class="num">${(kpi.includes('%') && !kpi.includes('Admits')) ? fmtPct(r.Last_3_Mo_Avg) : fmtNum(r.Last_3_Mo_Avg)}</td>
      <td class="num"><b>${(kpi.includes('%') && !kpi.includes('Admits')) ? fmtPct(r.Current) : fmtNum(r.Current)}</b></td>
      <td class="num">${(kpi.includes('%') && !kpi.includes('Admits')) ? fmtPct(r.Benchmark) : fmtNum(r.Benchmark)}</td>
      <td class="num">${varianceHtml(kpi, r.Current, r.Benchmark)}</td>
      <td class="num">${(kpi.includes('%') && !kpi.includes('Admits')) ? fmtPct(r.YTD_Avg) : fmtNum(r.YTD_Avg)}</td>
    `;
    tbody.appendChild(tr);
  }

  // order: utilization then rest
  const byKpi = new Map();
  rows.forEach(r => byKpi.set(r.KPI, r));

  addSection('UTILIZATION');
  utilization.forEach(k => { if(byKpi.has(k)) addRow(byKpi.get(k)); });

  addSection('CLINICAL QUALITY');
  [...byKpi.keys()].filter(k => !utilization.includes(k)).forEach(k => addRow(byKpi.get(k)));
}

function renderProgramOutcomes(rows){
  const tbody = document.getElementById('programTbody');
  tbody.innerHTML = '';

  function varianceHtml(curPct, bmkPct){
    const c = Number(curPct), b = Number(bmkPct);
    if(Number.isNaN(c) || Number.isNaN(b)) return '';
    const v = c - b;
    const cls = v >= 0 ? 'good' : 'bad';
    const txt = `${v >= 0 ? '+' : ''}${v.toFixed(1)} pts`;
    return `<span class="${cls}">${txt}</span>`;
  }

  rows.forEach(r=>{
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><b>${r.Program}</b></td>
      <td class="num">${Number(r.Eligible).toLocaleString()}</td>
      <td class="num">${Number(r.Engaged).toLocaleString()}</td>
      <td class="num">${Number(r.Completed).toLocaleString()}</td>
      <td class="num"><b>${fmtPct(r.Completion_Pct)}</b></td>
      <td class="num">${fmtPct(r.Benchmark)}</td>
      <td class="num">${varianceHtml(r.Completion_Pct, r.Benchmark)}</td>
    `;
    tbody.appendChild(tr);
  });
}

function renderFeed(items){
  const feed = document.getElementById('feed');
  feed.innerHTML = '';
  document.getElementById('totalCount').textContent = `${items.length} Total`;

  items.forEach(it=>{
    const programsRaw = it.Programs ?? '';
    const programs = Array.isArray(programsRaw)
      ? programsRaw
      : String(programsRaw).split(',').map(s=>s.trim()).filter(Boolean);

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
              <span class="mini">📅 ${it.Date || ''}</span>
              <span class="pill">${it.Org || ''}</span>
              <span class="pill ${evClass}">${ev || ''}</span>
            </div>
          </div>
        </div>
        <div class="icd">${it.ICD10 || ''}</div>
      </div>
      <div class="tile-body">
        <div class="label">FACILITY</div>
        <div class="value">${it.Facility || ''}</div>
        <div class="label">DIAGNOSIS</div>
        <div class="value ital">${it.Diagnosis || ''}</div>
      </div>
    `;
    feed.appendChild(tile);
  });
}

function setOptions(selectEl, values, allLabel){
  selectEl.innerHTML = '';
  const opt0 = document.createElement('option');
  opt0.value = '';
  opt0.textContent = allLabel;
  selectEl.appendChild(opt0);

  values.forEach(v=>{
    const opt = document.createElement('option');
    opt.value = v;
    opt.textContent = v;
    selectEl.appendChild(opt);
  });
}

function applyFilters(){
  const org = document.getElementById('orgFilter').value || '';
  const ev = document.getElementById('eventFilter').value || '';

  // filter all tables by org
  const pmF = org ? pmRows.filter(r=>r.Org===org) : pmRows.slice();
  const progF = org ? programRows.filter(r=>r.Org===org) : programRows.slice();

  // right feed by org+event
  let feed = org ? logRows.filter(r=>r.Org===org) : logRows.slice();
  if(ev) feed = feed.filter(r=>r.Event===ev);
  feed.sort((a,b)=>String(b.Date).localeCompare(String(a.Date)));

  renderPerformanceTable(pmF);
  renderProgramOutcomes(progF);
  renderFeed(feed);
}

async function init(){
  pmRows = await loadJSON('./data/performance_metrics.json');
  programRows = await loadJSON('./data/program_outcomes.json');
  logRows = await loadJSON('./data/utilization_log.json');

  const orgs = uniq([...pmRows.map(r=>r.Org), ...programRows.map(r=>r.Org), ...logRows.map(r=>r.Org)]);
  const events = uniq(logRows.map(r=>r.Event));

  const orgSel = document.getElementById('orgFilter');
  const evSel = document.getElementById('eventFilter');

  setOptions(orgSel, orgs, 'All Orgs');
  setOptions(evSel, events, 'All Events');

  orgSel.addEventListener('change', applyFilters);
  evSel.addEventListener('change', applyFilters);

  applyFilters();
}

init().catch(err=>{
  console.error(err);
  alert('Failed to load dashboard data. Check console for details.');
});
