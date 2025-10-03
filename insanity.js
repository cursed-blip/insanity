/**
 * insanity.js
 * Single-file Electron app — "Insanity" (ethical, educational network utilities)
 *
 * Features:
 *  - Background video, yellow glass UI, draggable header
 *  - Reverse DNS, NSLookup, Ping, Local Info, WHOIS (RDAP)
 *  - Port scanner (1-1024 default), Traceroute, HTTP headers, GeoIP, Proxy check, Subnet calc
 *
 * WARNING: Use only on systems you own or have explicit permission to test.
 */

const { app, BrowserWindow, ipcMain } = require('electron');
const dns = require('dns');
const os = require('os');
const net = require('net');
const https = require('https');
const http = require('http');
const { exec } = require('child_process');

function platformIsWindows() {
  return process.platform === 'win32';
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1250,
    height: 760,
    frame: false,
    resizable: true,
    webPreferences: {
      contextIsolation: false,
      nodeIntegration: true
    }
  });

  const html = `
  <!doctype html>
  <html>
  <head>
    <meta charset="utf-8" />
    <title>Insanity — Ethical Pentest</title>
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700&family=Inter:wght@300;400;600&display=swap" rel="stylesheet">
    <style>
      :root{
        --yellow1: #ffd700;
        --yellow2: #ffb300;
        --glass: rgba(255,255,255,0.06);
        --panel: rgba(0,0,0,0.36);
      }
      *{box-sizing:border-box;margin:0;padding:0}
      html,body,#app{height:100%;width:100%;font-family:Inter,Segoe UI,Arial,Helvetica,sans-serif;overflow:hidden}
      body{background:#000;color:#fff;position:relative;user-select:none}

      video#bg { position:fixed; inset:0; width:100%; height:100%; object-fit:cover; z-index:-2; filter:brightness(0.55) saturate(0.9); }
      .v-overlay { position:fixed; inset:0; background:linear-gradient(180deg, rgba(0,0,0,0.08), rgba(0,0,0,0.18)); z-index:-1; }

      header.top {
        height:60px;
        display:flex;
        align-items:center;
        justify-content:center;
        -webkit-app-region: drag;
        backdrop-filter: blur(10px);
        background: linear-gradient(90deg, rgba(0,0,0,0.22), rgba(0,0,0,0.12));
      }

      .title {
        font-family: 'Orbitron', sans-serif;
        font-weight:700;
        font-size:20px;
        letter-spacing:2px;
        background: linear-gradient(90deg, var(--yellow1), var(--yellow2));
        -webkit-background-clip: text;
        background-clip: text;
        color: transparent;
        text-shadow: 0 4px 18px rgba(255,180,20,0.12);
        padding:6px 14px;
        border-radius:10px;
        -webkit-app-region: no-drag;
      }

      #app { display:flex; height:calc(100% - 60px); }

      nav.sidebar {
        width:260px;
        padding:22px;
        background: linear-gradient(180deg, rgba(255,255,255,0.02), rgba(255,255,255,0.01));
        border-right: 1px solid rgba(255,200,0,0.06);
        backdrop-filter: blur(10px);
        display:flex;
        flex-direction:column;
        gap:12px;
      }

      .logo {
        display:flex; align-items:center; gap:12px; padding-bottom:6px; margin-bottom:6px;
      }
      .logo .badge {
        width:46px;height:46px;border-radius:10px; background:linear-gradient(135deg,var(--yellow1),var(--yellow2)); display:flex;align-items:center;justify-content:center;color:#111;font-weight:700;font-family:Orbitron;font-size:18px; box-shadow:0 8px 30px rgba(255,180,0,0.12);
      }
      .logo .name { font-weight:600; color:#fff; letter-spacing:1px; -webkit-app-region:no-drag; }

      .tabs { display:flex; flex-direction:column; gap:8px; margin-top:6px; }

      .tab {
        display:flex; align-items:center; gap:12px; padding:12px 14px;
        border-radius:12px; border:1px solid rgba(255,255,255,0.03);
        background: linear-gradient(180deg, rgba(255,255,255,0.02), rgba(255,255,255,0.01));
        cursor:pointer; transition: all 280ms cubic-bezier(.16,.84,.3,1);
        -webkit-app-region: no-drag;
      }
      .tab:hover { transform: translateX(6px); box-shadow: 0 8px 28px rgba(255,180,0,0.08); border-color: rgba(255,200,0,0.12); }
      .tab.active { background: linear-gradient(90deg, rgba(255,200,0,0.12), rgba(255,150,0,0.06)); border-color: rgba(255,200,0,0.18); transform: translateX(6px) scale(1.01); }

      .tab .ico { width:34px;height:34;border-radius:8px;background:rgba(0,0,0,0.25);display:flex;align-items:center;justify-content:center;font-weight:700;color:var(--yellow1); font-family:Orbitron; }
      .tab .label { flex:1; color:#fff; font-weight:600; letter-spacing:0.2px; }

      .sidebar-footer { margin-top:auto; font-size:12px; color:rgba(255,255,255,0.6); -webkit-app-region:no-drag; }

      main.work {
        flex:1; padding:26px; overflow:auto;
        display:flex; flex-direction:column; gap:18px;
      }

      .panel {
        background: var(--panel);
        border-radius:16px; padding:18px; box-shadow: 0 12px 30px rgba(0,0,0,0.6);
        transition: transform 260ms ease, box-shadow 260ms ease;
      }
      .panel:hover { transform: translateY(-6px); box-shadow: 0 18px 44px rgba(0,0,0,0.7); }

      .row { display:flex; gap:12px; align-items:center; margin-top:12px; flex-wrap:wrap; }
      input.text {
        padding:12px 14px; border-radius:10px; border: none; outline:none; width:380px; background: rgba(255,255,255,0.02); color:#fff; font-size:14px;
      }
      button.action {
        background: linear-gradient(90deg,var(--yellow1),var(--yellow2)); border:none; padding:10px 14px; border-radius:10px; cursor:pointer; font-weight:700; color:#111;
        box-shadow: 0 10px 28px rgba(255,180,0,0.12); transition:transform 160ms ease;
      }
      button.action:hover { transform: translateY(-3px) scale(1.03); }

      pre.log { background: rgba(255,255,255,0.02); border-radius:12px; padding:12px; font-family: Menlo, Monaco, monospace; color: #ffd780; max-height:320px; overflow:auto; white-space:pre-wrap; word-break:break-word; border:1px solid rgba(255,200,0,0.03); }

      .small { font-size:13px; color:rgba(255,255,255,0.75); }
      .muted { color: rgba(255,255,255,0.5); font-size:13px; }

      .two-cols { display:grid; grid-template-columns: 1fr 1fr; gap:12px; align-items:start; }

      .mini { font-size:13px; color:#fff; background: rgba(255,255,255,0.02); padding:8px 10px; border-radius:8px; display:inline-block; }

      /* responsive */
      @media (max-width: 980px) {
        nav.sidebar { width:96px; padding:12px }
        .tab .label { display:none }
        input.text { width:220px }
        .two-cols { grid-template-columns: 1fr; }
      }

    </style>
  </head>
  <body>
    <video id="bg" autoplay muted loop playsinline>
      <source src="https://media.tenor.com/RALIEj77DRsAAAPo/sudhi-vijay-sudhi-offl.mp4" type="video/mp4">
    </video>
    <div class="v-overlay"></div>

    <header class="top">
      <div class="title">INSANITY</div>
    </header>

    <div id="app">
      <nav class="sidebar">
        <div class="logo">
          <div class="badge">IN</div>
          <div>
            <div class="name">Insanity</div>
            <div class="muted" style="font-size:12px">Ethical toolkit</div>
          </div>
        </div>

        <div class="tabs" id="tabs">
          <div class="tab active" data-id="reverse" onclick="selectTab(event)">
            <div class="ico">R</div><div class="label">Reverse DNS</div>
          </div>
          <div class="tab" data-id="nslookup" onclick="selectTab(event)">
            <div class="ico">N</div><div class="label">NSLookup</div>
          </div>
          <div class="tab" data-id="ping" onclick="selectTab(event)">
            <div class="ico">P</div><div class="label">Ping</div>
          </div>
          <div class="tab" data-id="port" onclick="selectTab(event)">
            <div class="ico">S</div><div class="label">Port Scan</div>
          </div>
          <div class="tab" data-id="trace" onclick="selectTab(event)">
            <div class="ico">T</div><div class="label">Traceroute</div>
          </div>
          <div class="tab" data-id="http" onclick="selectTab(event)">
            <div class="ico">H</div><div class="label">HTTP Headers</div>
          </div>
          <div class="tab" data-id="geo" onclick="selectTab(event)">
            <div class="ico">G</div><div class="label">GeoIP</div>
          </div>
          <div class="tab" data-id="proxy" onclick="selectTab(event)">
            <div class="ico">X</div><div class="label">Proxy Check</div>
          </div>
          <div class="tab" data-id="subnet" onclick="selectTab(event)">
            <div class="ico">C</div><div class="label">Subnet Calc</div>
          </div>
          <div class="tab" data-id="local" onclick="selectTab(event)">
            <div class="ico">L</div><div class="label">Local Info</div>
          </div>
          <div class="tab" data-id="whois" onclick="selectTab(event)">
            <div class="ico">W</div><div class="label">WHOIS (RDAP)</div>
          </div>
          <div class="tab" data-id="about" onclick="selectTab(event)">
            <div class="ico">?</div><div class="label">About</div>
          </div>
        </div>

        <div class="sidebar-footer">
          <div class="small">Status: <span id="status">ready</span></div>
        </div>
      </nav>

      <main class="work">
        <!-- Reverse -->
        <div id="reverse" class="panel">
          <h3>Reverse DNS Lookup</h3>
          <div class="row">
            <input class="text" id="revTarget" placeholder="e.g. 8.8.8.8" />
            <button class="action" onclick="reverseDNS()">Run</button>
            <div class="mini">Safe</div>
          </div>
          <pre id="revLog" class="log"></pre>
        </div>

        <!-- NSLookup -->
        <div id="nslookup" class="panel" style="display:none;">
          <h3>NSLookup (A records)</h3>
          <div class="row">
            <input class="text" id="nsTarget" placeholder="example.com" />
            <button class="action" onclick="nsLookup()">Run</button>
            <div class="mini">Uses Node DNS</div>
          </div>
          <pre id="nsLog" class="log"></pre>
        </div>

        <!-- Ping -->
        <div id="ping" class="panel" style="display:none;">
          <h3>Ping</h3>
          <div class="row">
            <input class="text" id="pingTarget" placeholder="example.com or IP" />
            <button class="action" onclick="pingTarget()">Ping</button>
            <div class="mini">Platform-aware</div>
          </div>
          <pre id="pingLog" class="log"></pre>
        </div>

        <!-- Port Scan -->
        <div id="port" class="panel" style="display:none;">
          <h3>Port Scanner</h3>
          <div class="row">
            <input class="text" id="portTarget" placeholder="target (IP or hostname)"/>
            <input class="text" id="portRange" placeholder="ports e.g. 1-1024 (default 1-1024)"/>
            <button class="action" onclick="portScan()">Scan</button>
            <div class="mini">Concurrent, timeout-safe</div>
          </div>
          <pre id="portLog" class="log"></pre>
        </div>

        <!-- Traceroute -->
        <div id="trace" class="panel" style="display:none;">
          <h3>Traceroute</h3>
          <div class="row">
            <input class="text" id="traceTarget" placeholder="example.com or IP"/>
            <button class="action" onclick="traceroute()">Run</button>
            <div class="mini">Uses system traceroute/tracert</div>
          </div>
          <pre id="traceLog" class="log"></pre>
        </div>

        <!-- HTTP Headers -->
        <div id="http" class="panel" style="display:none;">
          <h3>HTTP Header Fetch</h3>
          <div class="row">
            <input class="text" id="httpTarget" placeholder="https://example.com"/>
            <button class="action" onclick="fetchHeaders()">Fetch</button>
            <div class="mini">Shows response headers</div>
          </div>
          <pre id="httpLog" class="log"></pre>
        </div>

        <!-- GeoIP -->
        <div id="geo" class="panel" style="display:none;">
          <h3>GeoIP Lookup</h3>
          <div class="row">
            <input class="text" id="geoTarget" placeholder="IP address"/>
            <button class="action" onclick="geoip()">Lookup</button>
            <div class="mini">Uses ip-api.com (no key)</div>
          </div>
          <pre id="geoLog" class="log"></pre>
        </div>

        <!-- Proxy Check -->
        <div id="proxy" class="panel" style="display:none;">
          <h3>Open Proxy Check</h3>
          <div class="row">
            <input class="text" id="proxyTarget" placeholder="ip:port (e.g. 1.2.3.4:8080)"/>
            <button class="action" onclick="proxyCheck()">Check</button>
            <div class="mini">Connects & probes HTTP response</div>
          </div>
          <pre id="proxyLog" class="log"></pre>
        </div>

        <!-- Subnet Calculator -->
        <div id="subnet" class="panel" style="display:none;">
          <h3>Subnet Calculator</h3>
          <div class="row">
            <input class="text" id="cidrInput" placeholder="CIDR (e.g. 192.168.1.0/24)"/>
            <button class="action" onclick="subnetCalc()">Calc</button>
            <div class="mini">IPv4 only</div>
          </div>
          <pre id="subLog" class="log"></pre>
        </div>

        <!-- Local Info -->
        <div id="local" class="panel" style="display:none;">
          <h3>Local Network Info</h3>
          <div class="row">
            <button class="action" onclick="localInfo()">Show</button>
            <div class="mini">Safe system info</div>
          </div>
          <pre id="localLog" class="log"></pre>
        </div>

        <!-- WHOIS/RDAP -->
        <div id="whois" class="panel" style="display:none;">
          <h3>WHOIS (RDAP)</h3>
          <div class="row">
            <input class="text" id="whoisTarget" placeholder="domain or IP"/>
            <button class="action" onclick="whois()">Lookup</button>
            <div class="mini">Uses rdap.org JSON</div>
          </div>
          <pre id="whoisLog" class="log"></pre>
        </div>

        <!-- About -->
        <div id="about" class="panel" style="display:none;">
          <h3>About Insanity</h3>
          <div class="two-cols">
            <div>
              <p class="small">Insanity — ethical pentest toolbox (educational). Use only with permission. This tool performs benign network queries: DNS, ping, traceroute, HTTP headers, WHOIS/RDAP, port checks (TCP connect), GeoIP lookups, and a subnet calculator.</p>
              <p class="small">Made to be smooth, yellow-themed, glassy UI. Background video is for style only.</p>
              <p class="small">If you need features (e.g., export, CSV reporting, scheduling), say the word.</p>
            </div>
            <div>
              <p class="muted">Version: 0.2</p>
              <p class="muted">Platform: ${process.platform}</p>
              <p class="muted">Node: ${process.version}</p>
            </div>
          </div>
        </div>
      </main>
    </div>

    <script>
      // UI helpers
      function selectTab(e) {
        const el = e.currentTarget || e;
        Array.from(document.querySelectorAll('.tab')).forEach(t => t.classList.remove('active'));
        el.classList.add('active');
        const id = el.dataset.id;
        // hide all panels
        ['reverse','nslookup','ping','port','trace','http','geo','proxy','subnet','local','whois','about'].forEach(k=>{
          const elp = document.getElementById(k);
          if (!elp) return;
          elp.style.display = (k===id)?'block':'none';
        });
        document.getElementById('status').innerText = 'ready';
      }

      // platform-aware ping/traceroute params are handled in main process
      const { ipcRenderer } = require('electron');

      function appendLog(id, txt) {
        const el = document.getElementById(id);
        el.innerText += txt + "\\n";
        el.scrollTop = el.scrollHeight;
      }
      function clearLog(id){ document.getElementById(id).innerText = ''; }

      // Reverse DNS
      async function reverseDNS(){
        const t = document.getElementById('revTarget').value.trim();
        if(!t){ return appendLog('revLog','Please enter an IP'); }
        clearLog('revLog'); appendLog('revLog','Looking up reverse DNS for '+t+' ...');
        try {
          const res = await ipcRenderer.invoke('reverse-dns', t);
          appendLog('revLog', JSON.stringify(res, null, 2));
        } catch(err) { appendLog('revLog','Error: '+String(err)); }
      }

      // NSLookup
      async function nsLookup(){
        const t = document.getElementById('nsTarget').value.trim();
        if(!t){ return appendLog('nsLog','Please enter a domain'); }
        clearLog('nsLog'); appendLog('nsLog','Resolving A records for '+t+' ...');
        try {
          const res = await ipcRenderer.invoke('nslookup', t);
          appendLog('nsLog', JSON.stringify(res, null, 2));
        } catch(err) { appendLog('nsLog','Error: '+String(err)); }
      }

      // Ping
      async function pingTarget(){
        const t = document.getElementById('pingTarget').value.trim();
        if(!t){ return appendLog('pingLog','Enter host or IP'); }
        clearLog('pingLog'); appendLog('pingLog','Pinging '+t+' ...');
        try {
          const out = await ipcRenderer.invoke('ping', t);
          appendLog('pingLog', out);
        } catch(err){ appendLog('pingLog','Error: '+String(err)); }
      }

      // Port scan (concurrent)
      async function portScan(){
        const t = document.getElementById('portTarget').value.trim();
        const range = document.getElementById('portRange').value.trim() || '1-1024';
        if(!t){ return appendLog('portLog','Enter target host/IP'); }
        clearLog('portLog'); appendLog('portLog','Starting port scan '+range+' on '+t+' ...');
        try {
          const res = await ipcRenderer.invoke('port-scan', t, range);
          appendLog('portLog', 'Open ports: ' + (res.open.length ? res.open.join(', ') : 'None found'));
          appendLog('portLog', 'Elapsed: '+res.elapsedMs+'ms');
        } catch(err){ appendLog('portLog','Error: '+String(err)); }
      }

      // Traceroute
      async function traceroute(){
        const t = document.getElementById('traceTarget').value.trim();
        if(!t){ return appendLog('traceLog','Enter host or IP'); }
        clearLog('traceLog'); appendLog('traceLog','Running traceroute to '+t+' ...');
        try {
          const out = await ipcRenderer.invoke('traceroute', t);
          appendLog('traceLog', out);
        } catch(err){ appendLog('traceLog','Error: '+String(err)); }
      }

      // HTTP headers
      async function fetchHeaders(){
        const t = document.getElementById('httpTarget').value.trim();
        if(!t){ return appendLog('httpLog','Enter URL (include http(s)://)'); }
        clearLog('httpLog'); appendLog('httpLog','Fetching headers for '+t+' ...');
        try {
          const hdrs = await ipcRenderer.invoke('http-headers', t);
          appendLog('httpLog', JSON.stringify(hdrs, null, 2));
        } catch(err){ appendLog('httpLog','Error: '+String(err)); }
      }

      // GeoIP
      async function geoip(){
        const t = document.getElementById('geoTarget').value.trim();
        if(!t){ return appendLog('geoLog','Enter IP'); }
        clearLog('geoLog'); appendLog('geoLog','Looking up '+t+' ...');
        try {
          const res = await ipcRenderer.invoke('geoip', t);
          appendLog('geoLog', JSON.stringify(res, null, 2));
        } catch(err){ appendLog('geoLog','Error: '+String(err)); }
      }

      // Proxy check
      async function proxyCheck(){
        const t = document.getElementById('proxyTarget').value.trim();
        if(!t || !t.includes(':')) return appendLog('proxyLog','Use ip:port');
        clearLog('proxyLog'); appendLog('proxyLog','Checking proxy '+t+' ...');
        try {
          const res = await ipcRenderer.invoke('proxy-check', t);
          appendLog('proxyLog', JSON.stringify(res, null, 2));
        } catch(err){ appendLog('proxyLog','Error: '+String(err)); }
      }

      // Subnet calc
      async function subnetCalc(){
        const t = document.getElementById('cidrInput').value.trim();
        if(!t) return appendLog('subLog','Enter CIDR');
        clearLog('subLog'); appendLog('subLog','Calculating '+t+' ...');
        try {
          const res = await ipcRenderer.invoke('subnet-calc', t);
          appendLog('subLog', JSON.stringify(res, null, 2));
        } catch(err){ appendLog('subLog','Error: '+String(err)); }
      }

      // Local Info
      async function localInfo(){
        clearLog('localLog'); appendLog('localLog','Gathering local info ...');
        try {
          const res = await ipcRenderer.invoke('local-info');
          appendLog('localLog', JSON.stringify(res, null, 2));
        } catch(err){ appendLog('localLog','Error: '+String(err)); }
      }

      // WHOIS / RDAP
      async function whois(){
        const t = document.getElementById('whoisTarget').value.trim();
        if(!t) return appendLog('whoisLog','Enter domain or IP');
        clearLog('whoisLog'); appendLog('whoisLog','Querying RDAP for '+t+' ...');
        try {
          const res = await ipcRenderer.invoke('whois', t);
          appendLog('whoisLog', JSON.stringify(res, null, 2));
        } catch(err){ appendLog('whoisLog','Error: '+String(err)); }
      }

      // default select initial
      (function init(){ document.querySelector('.tab[data-id="reverse"]').classList.add('active'); })();

    </script>
  </body>
  </html>
  `;

  win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));
}

// ------------------------ IPC handlers & utilities ------------------------

ipcMain.handle('reverse-dns', (ev, ip) => {
  return new Promise((res, rej) => {
    dns.reverse(ip, (err, hostnames) => {
      if (err) return rej(err.message || String(err));
      res(hostnames);
    });
  });
});

ipcMain.handle('nslookup', (ev, domain) => {
  return new Promise((res, rej) => {
    dns.resolve(domain, 'A', (err, addresses) => {
      if (err) return rej(err.message || String(err));
      res(addresses);
    });
  });
});

ipcMain.handle('ping', (ev, target) => {
  return new Promise((res, rej) => {
    if (!target) return rej('no target');
    const isWin = platformIsWindows();
    const cmd = isWin ? `ping ${target} -n 4` : `ping -c 4 ${target}`;
    exec(cmd, { timeout: 20_000 }, (err, stdout, stderr) => {
      if (err && !stdout) return rej(stderr || err.message);
      res(stdout || stderr);
    });
  });
});

// PORT SCANNER: parse range like "1-1024" or "22,80,443" - concurrency limited
ipcMain.handle('port-scan', async (ev, host, rangeSpec='1-1024') => {
  const startTs = Date.now();

  function parseRange(spec) {
    spec = spec.trim();
    if (!spec) spec = '1-1024';
    const parts = spec.split(',');
    const ports = new Set();
    for (let p of parts) {
      p = p.trim();
      if (p.includes('-')) {
        const [a,b] = p.split('-').map(x=>parseInt(x,10)).filter(n=>!isNaN(n));
        if (!isNaN(a) && !isNaN(b)) {
          for (let i=Math.max(1,a); i<=Math.min(65535,b); i++) ports.add(i);
        }
      } else {
        const n = parseInt(p,10);
        if (!isNaN(n)) ports.add(n);
      }
    }
    return Array.from(ports).sort((a,b)=>a-b);
  }

  const ports = parseRange(rangeSpec);
  if (ports.length === 0) return { open: [], elapsedMs: 0 };

  // concurrency
  const concurrency = 200;
  const timeout = 600; // ms per port
  const open = [];

  function checkPort(port){
    return new Promise(resolve=>{
      const s = new net.Socket();
      let done = false;
      s.setTimeout(timeout);
      s.once('connect', () => {
        done = true;
        open.push(port);
        s.destroy();
        resolve();
      });
      s.once('timeout', () => {
        if (done) return;
        done = true;
        s.destroy();
        resolve();
      });
      s.once('error', () => {
        if (done) return;
        done = true;
        s.destroy();
        resolve();
      });
      s.connect(port, host);
    });
  }

  // run in batches
  const batches = [];
  for (let i=0; i<ports.length; i+=concurrency) batches.push(ports.slice(i, i+concurrency));
  for (const batch of batches) {
    await Promise.all(batch.map(p => checkPort(p)));
  }

  return { open, elapsedMs: Date.now() - startTs };
});

// Traceroute — use tracert on Windows, traceroute elsewhere
ipcMain.handle('traceroute', (ev, host) => {
  return new Promise((res, rej) => {
    if (!host) return rej('no host');
    const isWin = platformIsWindows();
    const cmd = isWin ? `tracert -d ${host}` : `traceroute -n ${host}`;
    exec(cmd, { timeout: 60_000 }, (err, stdout, stderr) => {
      if (err && !stdout) return rej(stderr || err.message);
      res(stdout || stderr);
    });
  });
});

// HTTP headers fetch (supports http & https)
ipcMain.handle('http-headers', (ev, url) => {
  return new Promise((res, rej) => {
    try {
      const lib = url.startsWith('https') ? https : http;
      const req = lib.request(url, { method: 'HEAD', timeout: 10_000 }, (r) => {
        res({ statusCode: r.statusCode, headers: r.headers });
      });
      req.on('error', e => rej(e.message));
      req.on('timeout', () => { req.destroy(); rej('timeout'); });
      req.end();
    } catch(e) { rej(String(e)); }
  });
});

// GeoIP via ip-api.com (no key)
ipcMain.handle('geoip', (ev, ip) => {
  return new Promise((res, rej) => {
    if (!ip) return rej('no ip');
    https.get(`http://ip-api.com/json/${ip}`, (r) => {
      let d = '';
      r.on('data',c=>d+=c);
      r.on('end', ()=> {
        try { res(JSON.parse(d)); } catch(e){ res(d); }
      });
    }).on('error', e => rej(e.message));
  });
});

// Proxy check: try connect to ip:port and do a simple HTTP GET for http proxy
ipcMain.handle('proxy-check', (ev, ipPort) => {
  return new Promise(async (res, rej) => {
    try {
      const [host, portStr] = ipPort.split(':');
      const port = Number(portStr);
      if (!host || !port) return rej('invalid ip:port');

      const socket = new net.Socket();
      let responded = false;
      socket.setTimeout(5000);

      socket.connect(port, host, () => {
        // send a simple HTTP GET to / (may not be expected but many proxies accept plain GET)
        socket.write('GET http://example.com/ HTTP/1.1\\r\\nHost: example.com\\r\\nConnection: close\\r\\n\\r\\n');
      });

      let buffer = '';
      socket.on('data', chunk => {
        buffer += chunk.toString();
        if (!responded) {
          responded = true;
          socket.destroy();
          // simple heuristic: if HTTP response is present, it's likely a proxy or http server
          const isHttp = buffer.includes('HTTP/');
          res({ ok: true, hint: isHttp ? 'HTTP-like response received (possible proxy/http service)' : 'Connected but no HTTP response', sample: buffer.slice(0, 1000) });
        }
      });

      socket.on('timeout', () => {
        if (!responded) { responded = true; socket.destroy(); res({ ok: false, hint: 'timeout' }); }
      });

      socket.on('error', (e) => {
        if (!responded) { responded = true; res({ ok: false, hint: e.message }); }
      });
    } catch(e){ rej(String(e)); }
  });
});

// Subnet calculator (IPv4 CIDR)
ipcMain.handle('subnet-calc', (ev, cidr) => {
  return new Promise((res, rej) => {
    try {
      const parts = cidr.split('/');
      if (parts.length !== 2) return rej('Invalid CIDR');
      const ip = parts[0];
      const prefix = parseInt(parts[1], 10);
      if (isNaN(prefix) || prefix < 0 || prefix > 32) return rej('Invalid prefix');

      function ipToInt(a){ return a.split('.').reduce((acc, b) => acc*256 + Number(b), 0) >>> 0; }
      function intToIp(i){ return [(i>>>24)&255, (i>>>16)&255, (i>>>8)&255, i&255].join('.'); }

      const ipInt = ipToInt(ip);
      const mask = prefix === 0 ? 0 : (~((1 << (32 - prefix)) - 1)) >>> 0;
      const network = ipInt & mask;
      const broadcast = network | (~mask >>> 0);
      const first = network + (prefix === 32 ? 0 : 1);
      const last = broadcast - (prefix === 32 ? 0 : 1);
      const hosts = (prefix === 32) ? 1 : (broadcast - network - 1);

      res({
        network: intToIp(network),
        broadcast: intToIp(broadcast),
        first: intToIp(first),
        last: intToIp(last),
        mask: intToIp(mask >>> 0),
        prefix,
        hosts
      });
    } catch(e){ rej(String(e)); }
  });
});

// Local info
ipcMain.handle('local-info', (ev) => {
  return { hostname: os.hostname(), network: os.networkInterfaces(), user: os.userInfo().username };
});

// WHOIS via RDAP (rdap.org) — supports domain and IP
ipcMain.handle('whois', (ev, target) => {
  return new Promise((res, rej) => {
    if (!target) return rej('no target');
    // try domain first: rdap.org/domain/<domain>
    const tryUrl = (url) => {
      https.get(url, { timeout: 10_000 }, r => {
        let d = '';
        r.on('data', c => d += c);
        r.on('end', () => {
          try { res(JSON.parse(d)); }
          catch(e){ res(d); }
        });
      }).on('error', e => rej(e.message));
    };

    // choose endpoint: if looks like ip -> ip
    const ipRegex = /^\\d{1,3}(?:\\.\\d{1,3}){3}$/;
    if (ipRegex.test(target)) {
      tryUrl(`https://rdap.org/ip/${target}`);
    } else {
      tryUrl(`https://rdap.org/domain/${target}`);
    }
  });
});

app.whenReady().then(createWindow);
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
