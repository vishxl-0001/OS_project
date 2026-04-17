// ── Color palette ─────────────────────────────────────────────────────────────
const COLORS = [
  '#3b82f6','#10b981','#f59e0b','#ec4899','#8b5cf6','#06b6d4','#84cc16','#ef4444'
];

// ── State ─────────────────────────────────────────────────────────────────────
let processes = [
  {pid:1,arrival:0,burst:8,priority:2},
  {pid:2,arrival:1,burst:4,priority:1},
  {pid:3,arrival:2,burst:9,priority:3},
  {pid:4,arrival:3,burst:5,priority:2},
];
let nextPid = 5;

// ── Render process cards ───────────────────────────────────────────────────────
function renderCards() {
  const grid = document.getElementById('proc-grid');
  grid.innerHTML = processes.map((p,i) => {
    const c = COLORS[i % COLORS.length];
    return `
    <div class="proc-card" style="--c:${c}">
      <div style="position:absolute;top:0;left:0;right:0;height:2px;background:${c};border-radius:12px 12px 0 0;opacity:.8;"></div>
      <div class="proc-top">
        <div class="pid-badge" style="background:${c}22;color:${c};">P${p.pid}</div>
        <span class="proc-name">Process ${p.pid}</span>
        <button class="del-btn" onclick="removeProcess(${p.pid})" title="Remove">✕</button>
      </div>
      <div class="proc-fields">
        <div class="field"><label>Arrival</label><input type="number" id="p${p.pid}-arrival" value="${p.arrival}" min="0"></div>
        <div class="field"><label>Burst</label><input type="number" id="p${p.pid}-burst" value="${p.burst}" min="1"></div>
        <div class="field"><label>Priority</label><input type="number" id="p${p.pid}-priority" value="${p.priority}" min="1"></div>
      </div>
    </div>`;
  }).join('');

  // Legend
  const lw = document.getElementById('legend-wrap');
  if(processes.length > 0) {
    lw.innerHTML = `<div class="legend">${processes.map((p,i)=>`
      <div class="legend-item">
        <span class="legend-dot" style="background:${COLORS[i%COLORS.length]}"></span>
        P${p.pid}
      </div>`).join('')}</div>`;
  } else {
    lw.innerHTML = '';
  }

  document.getElementById('add-btn').style.opacity = processes.length >= 8 ? '.4' : '1';
}

function addProcess() {
  if(processes.length >= 8) return;
  processes.push({pid:nextPid++,arrival:0,burst:5,priority:2});
  renderCards();
}

function removeProcess(pid) {
  processes = processes.filter(p=>p.pid!==pid);
  renderCards();
}

function syncProcesses() {
  processes.forEach(p => {
    p.arrival  = parseInt(document.getElementById(`p${p.pid}-arrival`)?.value) || 0;
    p.burst    = parseInt(document.getElementById(`p${p.pid}-burst`)?.value) || 1;
    p.priority = parseInt(document.getElementById(`p${p.pid}-priority`)?.value) || 1;
  });
}

function resetAll() {
  processes = [
    {pid:1,arrival:0,burst:8,priority:2},
    {pid:2,arrival:1,burst:4,priority:1},
    {pid:3,arrival:2,burst:9,priority:3},
    {pid:4,arrival:3,burst:5,priority:2},
  ];
  nextPid = 5;
  renderCards();
  document.getElementById('results-wrap').style.display = 'none';
}

// ── Algorithms ────────────────────────────────────────────────────────────────
function deepCopy(arr) { return arr.map(p=>({...p})); }

function runFCFS(procs) {
  const p = deepCopy(procs).sort((a,b)=>a.arrival-b.arrival);
  let time=0, gantt=[];
  p.forEach(proc=>{
    if(time < proc.arrival) { gantt.push({pid:-1,start:time,end:proc.arrival}); time=proc.arrival; }
    gantt.push({pid:proc.pid,start:time,end:time+proc.burst});
    proc.waiting=time-proc.arrival; time+=proc.burst;
    proc.turnaround=time-proc.arrival;
  });
  return {gantt,procs:p};
}

function runSJF(procs) {
  const p = deepCopy(procs);
  let time=0, done=new Set(), gantt=[], completed=0;
  while(completed < p.length){
    const avail = p.filter(x=>!done.has(x.pid)&&x.arrival<=time).sort((a,b)=>a.burst-b.burst);
    if(!avail.length){
      const next = p.filter(x=>!done.has(x.pid)).sort((a,b)=>a.arrival-b.arrival)[0];
      if(next){ gantt.push({pid:-1,start:time,end:next.arrival}); time=next.arrival; }
      continue;
    }
    const proc=avail[0];
    gantt.push({pid:proc.pid,start:time,end:time+proc.burst});
    proc.waiting=time-proc.arrival; time+=proc.burst;
    proc.turnaround=time-proc.arrival;
    done.add(proc.pid); completed++;
  }
  return {gantt,procs:p};
}

function runRR(procs, quantum) {
  const p = deepCopy(procs).map(x=>({...x,rem:x.burst})).sort((a,b)=>a.arrival-b.arrival);
  let time=0, queue=[], idx=0, gantt=[], completed=0;
  const n=p.length;
  while(idx<n&&p[idx].arrival<=time) queue.push(idx++);
  if(!queue.length&&idx<n){ gantt.push({pid:-1,start:time,end:p[idx].arrival}); time=p[idx].arrival; while(idx<n&&p[idx].arrival<=time)queue.push(idx++); }
  while(completed<n){
    if(!queue.length){
      if(idx<n){ gantt.push({pid:-1,start:time,end:p[idx].arrival}); time=p[idx].arrival; while(idx<n&&p[idx].arrival<=time)queue.push(idx++); }
      continue;
    }
    const qi=queue.shift(); const proc=p[qi];
    const exec=Math.min(proc.rem,quantum);
    gantt.push({pid:proc.pid,start:time,end:time+exec});
    time+=exec; proc.rem-=exec;
    while(idx<n&&p[idx].arrival<=time)queue.push(idx++);
    if(proc.rem===0){
      proc.turnaround=time-proc.arrival;
      proc.waiting=proc.turnaround-proc.burst;
      completed++;
    } else { queue.push(qi); }
  }
  return {gantt,procs:p};
}

function runPriority(procs) {
  const p = deepCopy(procs);
  let time=0, done=new Set(), gantt=[], completed=0;
  while(completed<p.length){
    const avail=p.filter(x=>!done.has(x.pid)&&x.arrival<=time).sort((a,b)=>a.priority-b.priority);
    if(!avail.length){
      const next=p.filter(x=>!done.has(x.pid)).sort((a,b)=>a.arrival-b.arrival)[0];
      if(next){gantt.push({pid:-1,start:time,end:next.arrival});time=next.arrival;}
      continue;
    }
    const proc=avail[0];
    gantt.push({pid:proc.pid,start:time,end:time+proc.burst});
    proc.waiting=time-proc.arrival; time+=proc.burst;
    proc.turnaround=time-proc.arrival;
    done.add(proc.pid); completed++;
  }
  return {gantt,procs:p};
}

function avg(arr, field) {
  return (arr.reduce((s,p)=>s+(p[field]||0),0)/arr.length);
}

// ── Render Gantt ──────────────────────────────────────────────────────────────
function buildGantt(gantt, totalTime) {
  const pidMap = {};
  processes.forEach((p,i)=>pidMap[p.pid]=COLORS[i%COLORS.length]);
  const tw = Math.max(totalTime,1);
  const segs = gantt.map(s=>{
    const pct = ((s.end-s.start)/tw*100).toFixed(3);
    if(s.pid===-1) return `<div class="gseg idle" style="width:${pct}%;min-width:2px;" title="Idle: ${s.start}→${s.end}"></div>`;
    const c=pidMap[s.pid]||'#888';
    const label = pct>4?`<span class="gseg-label">P${s.pid}</span>`:'';
    return `<div class="gseg" style="width:${pct}%;background:${c};min-width:2px;" title="P${s.pid}: ${s.start}ms → ${s.end}ms (${s.end-s.start}ms)">${label}</div>`;
  }).join('');

  const tickStep = tw<=20?2:tw<=50?5:tw<=100?10:20;
  let ticks='';
  for(let t=0;t<=tw;t+=tickStep){
    ticks+=`<span class="tick" style="left:${(t/tw*100).toFixed(2)}%">${t}</span>`;
  }
  return `
    <div class="gantt-container">
      <div class="gantt">${segs}</div>
      <div class="gantt-ticks" style="position:relative;height:22px;margin-top:2px;">${ticks}</div>
    </div>`;
}

// ── Per-process table ─────────────────────────────────────────────────────────
function buildProcTable(procs) {
  const pidMap = {};
  processes.forEach((p,i)=>pidMap[p.pid]=COLORS[i%COLORS.length]);
  const rows = procs.filter(p=>p.waiting!==undefined).map(p=>`
    <tr>
      <td><span class="pid-dot-sm" style="background:${pidMap[p.pid]||'#888'}"></span>P${p.pid}</td>
      <td>${p.arrival}</td>
      <td>${p.burst}</td>
      <td>${p.waiting}</td>
      <td>${p.turnaround}</td>
    </tr>`).join('');
  return `
    <table class="proc-table">
      <thead><tr><th>PID</th><th>Arrival</th><th>Burst</th><th>Waiting</th><th>Turnaround</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
}

// ── Main run ──────────────────────────────────────────────────────────────────
function runAll() {
  syncProcesses();
  if(!processes.length){
    alert('Please add at least one process!'); return;
  }
  const quantum = parseInt(document.getElementById('quantum').value)||3;
  const fcfs = runFCFS(processes);
  const sjf  = runSJF(processes);
  const rr   = runRR(processes,quantum);
  const prio = runPriority(processes);

  const algos = [
    {name:'FCFS — First Come First Serve',    shortName:'FCFS',         color:'#3b82f6', res:fcfs},
    {name:'SJF — Shortest Job First',          shortName:'SJF',          color:'#10b981', res:sjf},
    {name:`Round Robin — Quantum ${quantum}ms`,shortName:`Round Robin`,  color:'#f59e0b', res:rr},
    {name:'Priority Scheduling',               shortName:'Priority',      color:'#ec4899', res:prio},
  ];

  // Render algo blocks
  const algoHtml = algos.map((a,i)=>{
    const totalTime = Math.max(...a.res.gantt.map(g=>g.end));
    const avgWT  = avg(a.res.procs,'waiting');
    const avgTAT = avg(a.res.procs,'turnaround');
    return `
    <div class="panel algo-block" style="animation-delay:${i*0.07}s;">
      <div class="algo-title" style="color:${a.color};">${a.name}</div>
      ${buildGantt(a.res.gantt, totalTime)}
      <div class="stats-row">
        <div class="stat-card"><div class="stat-label">Avg Waiting</div><div class="stat-val">${avgWT.toFixed(2)}<span class="stat-unit">ms</span></div></div>
        <div class="stat-card"><div class="stat-label">Avg Turnaround</div><div class="stat-val">${avgTAT.toFixed(2)}<span class="stat-unit">ms</span></div></div>
        <div class="stat-card"><div class="stat-label">Makespan</div><div class="stat-val">${totalTime}<span class="stat-unit">ms</span></div></div>
        <div class="stat-card"><div class="stat-label">Processes</div><div class="stat-val">${processes.length}</div></div>
      </div>
      ${buildProcTable(a.res.procs)}
    </div>`;
  }).join('');

  document.getElementById('algo-results').innerHTML = algoHtml;

  // Comparison table
  const summaries = algos.map(a=>({
    name:      a.shortName,
    fullName:  a.name,
    color:     a.color,
    avgWT:     avg(a.res.procs,'waiting'),
    avgTAT:    avg(a.res.procs,'turnaround'),
    makespan:  Math.max(...a.res.gantt.map(g=>g.end)),
  }));
  const bestWT  = summaries.reduce((b,a)=>a.avgWT<b.avgWT?a:b).name;
  const bestTAT = summaries.reduce((b,a)=>a.avgTAT<b.avgTAT?a:b).name;
  const bestMs  = summaries.reduce((b,a)=>a.makespan<b.makespan?a:b).name;

  document.getElementById('cmp-body').innerHTML = summaries.map(s=>`
    <tr>
      <td style="color:${s.color};font-weight:600;">${s.name}
        ${s.name===bestWT?'<span class="badge badge-green">best wait</span>':''}
        ${s.name===bestTAT&&s.name!==bestWT?'<span class="badge badge-blue">best TAT</span>':''}
      </td>
      <td>${s.avgWT.toFixed(2)} ms</td>
      <td>${s.avgTAT.toFixed(2)} ms</td>
      <td>${s.makespan} ms</td>
    </tr>`).join('');

  document.getElementById('winners').innerHTML = `
    <div class="winner-card">
      <div class="winner-card-title">Best Avg Waiting Time</div>
      <div class="winner-card-val">${bestWT}</div>
    </div>
    <div class="winner-card">
      <div class="winner-card-title">Best Avg Turnaround</div>
      <div class="winner-card-val">${bestTAT}</div>
    </div>
    <div class="winner-card">
      <div class="winner-card-title">Shortest Makespan</div>
      <div class="winner-card-val">${bestMs}</div>
    </div>`;

  document.getElementById('results-wrap').style.display = 'block';
  document.getElementById('results-wrap').scrollIntoView({behavior:'smooth', block:'start'});
}

// Init
renderCards();
