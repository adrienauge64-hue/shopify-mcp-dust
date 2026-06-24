const http = require('http');
const https = require('https');
const { spawn } = require('child_process');
const PORT = process.env.PORT || 8080;

if (process.env.SHOPIFY_ACCESS_TOKEN) {
  console.log('Token trouvé, démarrage de shopify-mcp...');
  const mcp = spawn('npx', [
    '-y', 'supergateway',
    '--port', String(PORT),
    '--outputTransport', 'streamableHttp',
    '--cors',
    '--healthEndpoint', '/health',
    '--stdio',
    `npx -y shopify-mcp --accessToken ${process.env.SHOPIFY_ACCESS_TOKEN} --domain ${process.env.SHOPIFY_DOMAIN}`
  ], { stdio: 'inherit' });
  mcp.on('exit', code => process.exit(code));

} else {
  console.log('En attente du token Shopify via OAuth...');
  http.createServer((req, res) => {
    const url = new URL(req.url, `http://localhost`);
    const code = url.searchParams.get('code');
    const shop = url.searchParams.get('shop');

    if (req.url === '/health') {
      res.writeHead(200); res.end('OK'); return;
    }

    if (code && shop) {
      const data = JSON.stringify({
        client_id: process.env.SHOPIFY_CLIENT_ID,
        client_secret: process.env.SHOPIFY_CLIENT_SECRET,
        code
      });
      const opts = {
        hostname: shop,
        path: '/admin/oauth/access_token',
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) }
      };
      const r = https.request(opts, res2 => {
        let body = '';
        res2.on('data', c => body += c);
        res2.on('end', () => {
          const result = JSON.parse(body);
          const token = result.access_token || ('ERREUR: ' + body);
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(`
            <h1>✅ Token obtenu !</h1>
            <p>Copie ce token dans Railway comme variable <b>SHOPIFY_ACCESS_TOKEN</b> :</p>
            <textarea rows="3" cols="80" onclick="this.select()">${token}</textarea>
            <p>Puis redémarre Railway. C'est tout !</p>
          `);
        });
      });
      r.write(data); r.end();
    } else {
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end('Pret. En attente de l installation Shopify...');
    }
  }).listen(PORT, () => console.log('OAuth handler sur port ' + PORT));
}
