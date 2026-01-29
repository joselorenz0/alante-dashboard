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
  // keep integers as is, else 1 decimal
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

function renderPerformanceTable(pmRows, org){
  const tbody = document.getElementById('performanceTbody');
  tbody.innerHTML = '';

  // Map to match screenshot sections
  const utilization = ['Readmission Rate (%)','INP Admits/1,000','ER Admits/1,000'];
  const quality = pmRows.map(r=>r.KPI).filter(k=>!utilization.includes(k));

  function addSection(title){
    const tr = document.createElement('tr');
    tr.className = 'section-row';
    tr.innerHTML = `<td colspan="5">${title}</td>`;
    tbody.appendChild(tr);
  }

  // fake "Last 3-Mth Avg", "MoM", "YTD" derived from current vs benchmark for demo
  function derived(row){
    const current = Number(row.Current);
    const bench = Number(row.Benchmark);
    const mom = (current - bench) * (row.KPI.includes('Admits') ? 1 : 0.2);
    const last3 = current + (mom * 0.4);
    const ytd = current - (mom * 0.2);
    return {last3, mom, ytd};
  }

  function addRow(row){
    const {last3, mom, ytd} = derived(row);
    const momGood = (
      row.KPI.includes('Admits') || row.KPI.includes('Readmission')
    ) ? mom < 0 : mom > 0;

    const momText = row.KPI.includes('%') && !row.KPI.includes('Admits') ? `${mom>0?'+':''}${mom.toFixed(1)}%` : `${mom>0?'+':''}${mom.toFixed(1)} pts`;
    const arrow = momGood ? '↓' : '↑';
    const momClass = momGood ? 'good' : 'bad';

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="col-metric">${row.KPI}</td>
      <td class="num">${row.KPI.includes('%') && !row.KPI.includes('Admits') ? fmtPct(last3) : fmtNum(last3)}</td>
      <td class="num"><b>${row.KPI.includes('%') && !row.KPI.includes('Admits') ? fmtPct(row.Current) : fmtNum(row.Current)}</b></td>
      <td class="num"><span class="${momClass}">${momText} ${arrow}</span></td>
      <td class="num">${row.KPI.includes('%') && !row.KPI.includes('Admits') ? fmtPct(ytd) : fmtNum(ytd)}</td>
    `;
    tbody.appendChild(tr);
  }

  // Add small coloring via inline style classes
  const style = document.createElement('style');
  style.innerHTML = `.good{color:var(--green);font-weight:800}.bad{color:var(--red);font-weight:800}`;
  document.head.appendChild(style);

  const byOrg = pmRows.filter(r=>r.Org===org);

  addSection('UTILIZATION');
  utilization.forEach(k=>{
    const r = byOrg.find(x=>x.KPI===k);
    if(r) addRow(r);
  });

  addSection('CLINICAL QUALITY');
  quality.forEach(k=>{
    const r = byOrg.find(x=>x.KPI===k);
    if(r) addRow(r);
  });
}

function renderProgramOutcomes(pmRows, org){
  // demo-only: derive a simple program table from KPI scorecard
  const tbody = document.getElementById('programTbody');
  tbody.innerHTML = '';

  const programs = [
    {Program:'AWV', eligible:12840, engaged:5912, completed:5104},
    {Program:'CCM', eligible:6420, engaged:2188, completed:1964},
    {Program:'TCM', eligible:1084, engaged:642, completed:598},
    {Program:'ACP', eligible:1084, engaged:712, completed:648},
    {Program:'SDOH', eligible:9100, engaged:3420, completed:3112},
  ];

  programs.forEach(p=>{
    const completion = (p.completed / p.eligible) * 100;
    const mom = ['↑','↑','↓','—','↑'][['AWV','CCM','TCM','ACP','SDOH'].indexOf(p.Program)];
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><b>${p.Program}</b></td>
      <td class="num">${p.eligible.toLocaleString()}</td>
      <td class="num">${p.engaged.toLocaleString()}</td>
      <td class="num">${p.completed.toLocaleString()}</td>
      <td class="num"><b style="color:${completion>=55?'var(--green)':'var(--amber)'}">${completion.toFixed(1)}%</b></td>
      <td class="num"><b style="color:${mom==='↓'?'var(--red)':'var(--green)'}">${mom}</b></td>
    `;
    tbody.appendChild(tr);
  });
}

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

(async function main(){
  const [pmRows, logRows] = await Promise.all([
    loadJSON('data/performance_metrics.json'),
    loadJSON('data/utilization_log.json')
  ]);

  const orgs = uniq(pmRows.map(r=>r.Org).filter(Boolean));
  const events = uniq(logRows.map(r=>r.Event).filter(Boolean));

  const orgSelect = document.getElementById('orgFilter');
  const eventSelect = document.getElementById('eventFilter');

  populateSelect(orgSelect, orgs, 'All Orgs');
  populateSelect(eventSelect, events, 'All Events');

  // default org if exists
  orgSelect.value = orgs.includes('PCCA') ? 'PCCA' : '';

  function apply(){
    const org = orgSelect.value;
    const ev = eventSelect.value;

    const orgForLeft = org || (orgs[0] || '');
    if(orgForLeft) {
      renderPerformanceTable(pmRows, orgForLeft);
      renderProgramOutcomes(pmRows, orgForLeft);
    }

    let filtered = logRows.slice();
    if(org) filtered = filtered.filter(r=>r.Org===org);
    if(ev) filtered = filtered.filter(r=>r.Event===ev);

    // Sort by date desc if parseable
    filtered.sort((a,b)=> (String(b.Date)).localeCompare(String(a.Date)));
    renderFeed(filtered);
  }

  orgSelect.addEventListener('change', apply);
  eventSelect.addEventListener('change', apply);

  apply();
})();
