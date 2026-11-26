function register(app, rack) {
  app.get('/api/employees', (req, res) => {
    res.json({ employees: rack.searchEmployees(req.query.q || '') });
  });
}

module.exports = register;
