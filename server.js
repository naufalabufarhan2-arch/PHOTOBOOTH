const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 8080;
const HOST = '0.0.0.0'; // Binds to all network adapters so other devices can access it

const MIME_TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.json': 'application/json'
};

const server = http.createServer((req, res) => {
  // Decode URL in case of special characters
  const decodedUrl = decodeURIComponent(req.url);
  let filePath = decodedUrl === '/' ? '/index.html' : decodedUrl;
  filePath = path.join(__dirname, filePath);

  // Security check: ensure requests stay within the photobooth directory
  if (!filePath.startsWith(__dirname)) {
    res.statusCode = 403;
    res.end('Access Denied');
    return;
  }

  const ext = path.extname(filePath);
  const contentType = MIME_TYPES[ext] || 'text/plain';

  fs.readFile(filePath, (err, data) => {
    if (err) {
      if (err.code === 'ENOENT') {
        res.statusCode = 404;
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end('<h1>404 File Not Found</h1><p>The requested file does not exist in photobooth folder.</p>');
      } else {
        res.statusCode = 500;
        res.end('500 Server Error: ' + err.code);
      }
    } else {
      res.writeHead(200, { 'Content-Type': contentType, 'Access-Control-Allow-Origin': '*' });
      res.end(data);
    }
  });
});

server.listen(PORT, HOST, () => {
  console.log('\n======================================================');
  console.log('🚀 SUCCESS: PHOTOBOOTH SERVER IS NOW ONLINE!');
  console.log('======================================================');
  console.log(`\n👉 ON THIS PC / LAPTOP (HOST):`);
  console.log(`   http://localhost:${PORT}`);
  console.log(`\n👉 ON OTHER DEVICES (TABLET, PHONE, OR OTHER LAPTOPS):`);
  console.log(`   http://10.172.193.86:${PORT}`);
  console.log('\n   * Make sure both devices are on the same Wi-Fi connection!');
  console.log('======================================================');
  console.log('Press Ctrl + C in this terminal window to stop the server.\n');
});
