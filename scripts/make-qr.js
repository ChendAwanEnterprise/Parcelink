const os = require('os');
const path = require('path');
const QRCode = require('qrcode');

function lanIp() {
  for (const list of Object.values(os.networkInterfaces())) {
    for (const net of list || []) {
      if ((net.family === 'IPv4' || net.family === 4) && !net.internal) return net.address;
    }
  }
  return '127.0.0.1';
}

async function main() {
  const url = `http://${lanIp()}:3000/courier`;
  const file = path.join(__dirname, '..', 'docs', 'qr-courier.png');
  await QRCode.toFile(file, url, { width: 512, margin: 1 });
  console.log(url);
  console.log(file);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
