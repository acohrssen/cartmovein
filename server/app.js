const express = require('express');
const path = require('path');
const store = require('./store');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

function handleError(res, err) {
  const status = err.status || 500;
  res.status(status).json({ error: err.message || 'Something went wrong' });
}

app.get('/api/state', async (req, res) => {
  try {
    res.json(await store.loadState());
  } catch (err) { handleError(res, err); }
});

app.post('/api/buildings', async (req, res) => {
  try {
    const name = (req.body.name || '').trim();
    if (!name) return res.status(400).json({ error: 'Building name is required' });
    res.json(await store.addBuilding(name));
  } catch (err) { handleError(res, err); }
});

app.delete('/api/buildings/:id', async (req, res) => {
  try {
    res.json(await store.deleteBuilding(Number(req.params.id)));
  } catch (err) { handleError(res, err); }
});

app.post('/api/sls', async (req, res) => {
  try {
    const name = (req.body.name || '').trim();
    if (!name) return res.status(400).json({ error: 'Name is required' });
    res.json(await store.addSl(name));
  } catch (err) { handleError(res, err); }
});

app.delete('/api/sls/:id', async (req, res) => {
  try {
    res.json(await store.deleteSl(Number(req.params.id)));
  } catch (err) { handleError(res, err); }
});

app.post('/api/carts', async (req, res) => {
  try {
    const label = (req.body.label || '').trim();
    if (!label) return res.status(400).json({ error: 'Cart label is required' });
    res.json(await store.addCart(label));
  } catch (err) { handleError(res, err); }
});

app.delete('/api/carts/:id', async (req, res) => {
  try {
    res.json(await store.deleteCart(Number(req.params.id)));
  } catch (err) { handleError(res, err); }
});

app.post('/api/checkouts', async (req, res) => {
  try {
    res.json(await store.checkout(req.body));
  } catch (err) { handleError(res, err); }
});

app.post('/api/checkouts/:id/return', async (req, res) => {
  try {
    res.json(await store.returnCheckout(Number(req.params.id)));
  } catch (err) { handleError(res, err); }
});

app.post('/api/checkouts/:id/acknowledge', async (req, res) => {
  try {
    res.json(await store.acknowledgeCheckout(Number(req.params.id)));
  } catch (err) { handleError(res, err); }
});

module.exports = app;
