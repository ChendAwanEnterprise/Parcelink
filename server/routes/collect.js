function register(app, rack) {
  app.post('/api/collect', (req, res) => {
    const body = req.body || {};
    const result = rack.collect({ empId: body.empId, code: body.code });
    const status = result.status;
    delete result.status;
    res.status(status).json(result);
  });
}

module.exports = register;
