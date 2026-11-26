function register(app, rack) {
  app.post('/api/parcels', (req, res) => {
    const body = req.body || {};
    const result = rack.createParcel({
      empId: body.empId,
      courierCompany: body.courierCompany,
      reference: body.reference,
    });
    const status = result.status;
    delete result.status;
    res.status(status).json(result);
  });

  app.get('/api/parcels/:id', (req, res) => {
    const result = rack.getParcel(req.params.id);
    const status = result.status;
    delete result.status;
    res.status(status).json(result.parcel || result);
  });
}

module.exports = register;
