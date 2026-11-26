function register(app, rack) {
  app.get('/api/receiver/:empId', (req, res) => {
    const result = rack.receiverParcels(req.params.empId);
    const status = result.status;
    delete result.status;
    res.status(status).json(result);
  });
}

module.exports = register;
