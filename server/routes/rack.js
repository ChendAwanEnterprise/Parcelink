function register(app, rack) {
  app.get('/api/rack/state', (req, res) => {
    res.json(rack.rackState());
  });

  app.post('/api/rack/button', (req, res) => {
    const slot = Number(req.body && req.body.slot);
    if (!Number.isInteger(slot)) {
      return res.status(400).json({ ok: false, error: 'Slot required' });
    }
    const result = rack.pressButton(slot);
    const status = result.status || 200;
    delete result.status;
    res.status(status).json(result);
  });

  app.get('/api/rack/status', (req, res) => {
    res.json(rack.status());
  });
}

module.exports = register;
