const path = require('path');
const express = require('express');
const { createRack } = require('./rack');
const rackRoutes = require('./routes/rack');
const parcelRoutes = require('./routes/parcels');
const receiverRoutes = require('./routes/receiver');
const collectRoutes = require('./routes/collect');
const adminRoutes = require('./routes/admin');
const employeeRoutes = require('./routes/employees');

function createApp({ root, config, db }) {
  const rack = createRack(db, config);
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json());

  rackRoutes(app, rack);
  parcelRoutes(app, rack);
  receiverRoutes(app, rack);
  collectRoutes(app, rack);
  adminRoutes(app, rack, config);
  employeeRoutes(app, rack);

  const pub = path.join(root, 'public');
  const send = (res, file) => {
    res.set('Cache-Control', 'no-store');
    res.sendFile(path.join(pub, file));
  };

  app.get('/', (req, res) => res.redirect('/admin'));
  app.get('/courier', (req, res) => send(res, 'courier.html'));
  app.get('/courier/done/:id', (req, res) => send(res, 'done.html'));
  app.get('/receiver', (req, res) => send(res, 'receiver.html'));
  app.get('/collect', (req, res) => send(res, 'collect.html'));
  app.get('/admin', (req, res) => send(res, 'admin.html'));
  app.get('/simulator', (req, res) => send(res, 'simulator.html'));
  app.get('/hwtest', (req, res) => send(res, 'hwtest.html'));

  app.use(express.static(pub, {
  setHeaders(res) { res.set('Cache-Control', 'no-store'); },
}));

  app.use((err, req, res, next) => {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  });

  const timer = setInterval(() => {
    try { rack.status(); } catch (err) { console.error(err); }
  }, 400);
  if (typeof timer.unref === 'function') timer.unref();

  return { app, rack, db };
}

module.exports = { createApp };
