// Servidor local só para ver o site no computador (os dados ficam no Supabase).
// Na internet, o site é publicado pelo GitHub Pages (pasta public/).
// Uso: node server.js   →   http://localhost:3005
const http = require('http');
const fs = require('fs');
const path = require('path');

const PUBLICO = path.join(__dirname, 'public');
const PORTA = Number(process.env.PORTA) || 3005;
const TIPOS = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp',
  '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.ico': 'image/x-icon' };

http.createServer((req, res) => {
  let rel = decodeURIComponent(new URL(req.url, 'http://local').pathname);
  // Igual ao GitHub Pages: /pasta → /pasta/ e /pasta/ → /pasta/index.html
  const bruto = path.join(PUBLICO, rel);
  if (!rel.endsWith('/') && fs.existsSync(bruto) && fs.statSync(bruto).isDirectory()) {
    res.writeHead(301, { Location: rel + '/' });
    return res.end();
  }
  if (rel === '/') rel = '/index.html';
  else if (rel.endsWith('/')) rel += 'index.html';
  const alvo = path.normalize(path.join(PUBLICO, rel));
  if (!alvo.startsWith(PUBLICO + path.sep)) { res.writeHead(403); return res.end(); }
  fs.readFile(alvo, (err, dados) => {
    if (err) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); return res.end('Não encontrado'); }
    res.writeHead(200, { 'Content-Type': TIPOS[path.extname(alvo).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(dados);
  });
}).listen(PORTA, '0.0.0.0', () => console.log(`Igreja Palavra Viva — http://localhost:${PORTA}`));
