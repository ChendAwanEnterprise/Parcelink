const os = require('os');
const QRCode = require('qrcode');

function courierTargets(port) {
  const addresses = [];
  for (const list of Object.values(os.networkInterfaces())) {
    for (const net of list || []) {
      const v4 = net.family === 'IPv4' || net.family === 4;
      if (!v4 || net.internal) continue;
      if (String(net.address).startsWith('169.254.')) continue;
      addresses.push({
        ip: net.address,
        courierUrl: `http://${net.address}:${port}/courier`,
      });
    }
  }
  return addresses;
}

function register(app, rack, config) {
  app.get('/api/admin/overview', (req, res) => {
    res.json(rack.overview());
  });

  app.get('/api/admin/access', (req, res) => {
    res.json({ port: config.port, addresses: courierTargets(config.port) });
  });

  app.get('/api/admin/courier-qr.svg', async (req, res, next) => {
    try {
      const addresses = courierTargets(config.port);
      if (!addresses.length) {
        res.status(404).type('text/plain').send('No LAN address');
        return;
      }
      const svg = await QRCode.toString(addresses[0].courierUrl, { type: 'svg', margin: 1 });
      res.type('image/svg+xml').send(svg);
    } catch (err) {
      next(err);
    }
  });

  app.post('/api/admin/slot/:no/led', (req, res) => {
    const slot = Number(req.params.no);
    const led = req.body && req.body.led;
    const result = rack.setLed(slot, led);
    const status = result.status;
    delete result.status;
    res.status(status).json(result);
  });

  app.post('/api/admin/test-mode', (req, res) => {
    res.json(rack.setTestMode(req.body && req.body.enabled));
  });

  app.post('/api/admin/demo', (req, res) => {
    res.json(rack.loadDemo());
  });

  app.post('/api/admin/reset', (req, res) => {
    res.json(rack.resetRack());
  });

  app.get('/api/events', (req, res) => {
    res.json({ events: rack.listEvents(req.query.since) });
  });
}

module.exports = register;
