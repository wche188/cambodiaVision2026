import { createServer } from 'https';
import { readFileSync, existsSync, mkdirSync } from 'fs';
import { execSync } from 'child_process';
import { networkInterfaces } from 'os';
import { parse } from 'url';
import next from 'next';

const dev = process.env.NODE_ENV !== 'production';
const hostname = '0.0.0.0';
const port = 3000;

// Detect LAN IP dynamically
const nets = networkInterfaces();
let lanIp = 'unknown';
for (const ifaces of Object.values(nets)) {
  for (const iface of ifaces) {
    if (iface.family === 'IPv4' && !iface.internal) {
      lanIp = iface.address;
      break;
    }
  }
  if (lanIp !== 'unknown') break;
}

// Auto-generate self-signed certs if missing (includes current LAN IP in SAN)
if (!existsSync('./certs/key.pem') || !existsSync('./certs/cert.pem')) {
  mkdirSync('./certs', { recursive: true });
  console.log(`> Generating self-signed certificates (SAN includes ${lanIp})...`);
  execSync(
    `openssl req -x509 -nodes -days 365 -newkey rsa:2048 ` +
    `-keyout ./certs/key.pem -out ./certs/cert.pem ` +
    `-subj "/CN=Cambodia Vision" ` +
    `-addext "subjectAltName=DNS:localhost,IP:${lanIp},IP:127.0.0.1"`,
    { stdio: 'inherit' }
  );
}

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

const httpsOptions = {
  key: readFileSync('./certs/key.pem'),
  cert: readFileSync('./certs/cert.pem'),
};

app.prepare().then(() => {
  createServer(httpsOptions, async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error('Error occurred handling', req.url, err);
      res.statusCode = 500;
      res.end('internal server error');
    }
  }).listen(port, hostname, () => {
    console.log(`> Ready on https://localhost:${port}`);
    console.log(`> LAN: https://${lanIp}:${port}`);
  });
});
