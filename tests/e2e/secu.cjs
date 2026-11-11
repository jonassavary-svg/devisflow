const { spawn } = require('child_process'); const fs = require('fs'); const http = require('http');
const sleep = ms => new Promise(r => setTimeout(r, ms)); const ok = (c, t) => console.log((c ? 'PASS ' : 'FAIL ') + t);
const call = (method, path, headers, body) => new Promise(res => { const r = http.request({ host: '127.0.0.1', port: 3157, method, path, headers }, x => { let b = ''; x.on('data', c => b += c); x.on('end', () => res({ status: x.statusCode, body: b })); }); if (body) r.write(body); r.end(); });
(async () => {
  fs.rmSync('datas', { recursive: true, force: true });
  const s = spawn('node', ['server.js'], { cwd: require('path').join(__dirname, '..', '..'), env: { ...process.env, ANTHROPIC_API_KEY: '', OPENAI_API_KEY: '', PORT: '3157', DEVISFLOW_DATA: __dirname + '/datas' } });
  await sleep(1000);
  const good = JSON.stringify({ settings: {}, dossiers: [], notes: [] });
  ok((await call('PUT', '/api/data', { host: 'localhost:3157', origin: 'http://localhost:3157', 'content-type': 'application/json' }, good)).status === 200, 'la page DevisFlow peut enregistrer');
  ok((await call('GET', '/api/status', { host: 'localhost:3157' })).status === 200, 'lecture du statut');
  ok((await call('POST', '/api/data', { host: 'localhost:3157', origin: 'https://site-malveillant.example', 'content-type': 'application/json' }, good)).status === 403, 'un autre site est refusé (origine)');
  ok((await call('POST', '/api/data', { host: 'localhost:3157', 'content-type': 'text/plain' }, good)).status === 403, 'envoi sans JSON déclaré refusé');
  ok((await call('GET', '/api/data', { host: 'attaque.example:3157' })).status === 403, 'adresse détournée refusée');
  ok((await call('POST', '/api/ai', { host: 'localhost:3157', origin: 'https://site-malveillant.example', 'content-type': 'application/json' }, '{"messages":[]}')).status === 403, 'un autre site ne peut pas utiliser la clé IA');
  ok((await call('GET', '/', { host: 'localhost:3157' })).status === 200, 'la page s\'ouvre');
  s.kill(); process.exit(0);
})();
