const http = require('http');
const https = require('https');
const { spawn } = require('child_process');
const PORT = process.env.PORT || 8080;

const SCOPES = 'read_all_orders,read_analytics,read_products,write_products,read_orders,write_orders,read_customers,write_customers,read_inventory,write_inventory,read_content,write_content,read_themes,read_metaobjects,write_metaobjects,read_online_store_pages,write_online_store_pages';

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
  http.createServer((req, res) => {
    const url = new URL(req.url, `http://localhost`);
    const code = url.searchParams.get('code');
    const shop = url.searchParams.get('shop') || url.searchParams.get('host');
    const hmac = url.searchParams.get('hmac');

    if (req.url === '/health') {
      res.writeHead(200); res.end('OK'); return;
    }

    if (code) {
      // Étape 2 : échange du code contre le token
      const shopDomain = url.searchParams.get('shop');
      const data = JSON.stringify({
        client_id: process.env.SHOPIFY_CLIENT_ID,
        client_secret: process.env.SHOPIFY_CLIENT_SECRET,
        code
      });
      const opts = {
        hostname: shopDomain,
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

    } else if (hmac) {
      // Étape 1 : redirection vers la page d'autorisation Shopify
      const shopDomain = url.searchParams.get('shop');
      const redirectUri = encodeURIComponent(`https://shopify-mcp-dust-production.up.railway.app/`);
      const authUrl = `https://${shopDomain}/admin/oauth/authorize?client_id=${process.env.SHOPIFY_CLIENT_ID}&scope=${SCOPES}&redirect_uri=${redirectUri}&state=random123`;
      res.writeHead(302, { Location: authUrl });
      res.end();

    } else {
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end('Pret. En attente de l installation Shopify...');
    }
  }).listen(PORT, () => console.log('OAuth handler sur port ' + PORT));
}
