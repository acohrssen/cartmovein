const express = require('express');
const path = require('path');
const os = require('os');
const { load, save, nextId } = require('./store');

const CHECKOUT_MINUTES = 60;
const PORT = process.env.PORT || 4173;

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

function sendState(res) {
  res.json(load());
}

app.get('/api/state', (req, res) => {
  sendState(res);
});

// --- Buildings ---
app.post('/api/buildings', (req, res) => {
  const name = (req.body.name || '').trim();
  if (!name) return res.status(400).json({ error: 'Building name is required' });
  const state = load();
  const id = nextId(state.buildings);
  state.buildings.push({ id, name });
  save(state);
  sendState(res);
});

app.delete('/api/buildings/:id', (req, res) => {
  const id = Number(req.params.id);
  const state = load();
  state.buildings = state.buildings.filter(b => b.id !== id);
  save(state);
  sendState(res);
});

// --- Student Leaders ---
app.post('/api/sls', (req, res) => {
  const name = (req.body.name || '').trim();
  if (!name) return res.status(400).json({ error: 'Name is required' });
  const state = load();
  const id = nextId(state.sls);
  state.sls.push({ id, name });
  save(state);
  sendState(res);
});

app.delete('/api/sls/:id', (req, res) => {
  const id = Number(req.params.id);
  const state = load();
  state.sls = state.sls.filter(s => s.id !== id);
  save(state);
  sendState(res);
});

// --- Carts ---
app.post('/api/carts', (req, res) => {
  const label = (req.body.label || '').trim();
  if (!label) return res.status(400).json({ error: 'Cart label is required' });
  const state = load();
  const id = nextId(state.carts);
  state.carts.push({ id, label, status: 'available' });
  save(state);
  sendState(res);
});

app.delete('/api/carts/:id', (req, res) => {
  const id = Number(req.params.id);
  const state = load();
  const hasActiveCheckout = state.checkouts.some(c => c.cartId === id && !c.returnedAt);
  if (hasActiveCheckout) {
    return res.status(400).json({ error: 'Cannot delete a cart that is currently checked out' });
  }
  state.carts = state.carts.filter(c => c.id !== id);
  save(state);
  sendState(res);
});

// --- Checkouts ---
app.post('/api/checkouts', (req, res) => {
  const { cartId, buildingId, slId, borrowerName, borrowerPhone } = req.body;
  const state = load();

  const cart = state.carts.find(c => c.id === Number(cartId));
  const building = state.buildings.find(b => b.id === Number(buildingId));
  const sl = state.sls.find(s => s.id === Number(slId));

  if (!cart) return res.status(400).json({ error: 'Select a valid cart' });
  if (cart.status !== 'available') return res.status(400).json({ error: 'Cart is already checked out' });
  if (!building) return res.status(400).json({ error: 'Select a valid building' });
  if (!sl) return res.status(400).json({ error: 'Select a valid Student Leader' });
  if (!borrowerName || !borrowerName.trim()) return res.status(400).json({ error: 'Borrower name is required' });
  if (!borrowerPhone || !borrowerPhone.trim()) return res.status(400).json({ error: 'Borrower phone number is required' });

  const now = Date.now();
  const id = nextId(state.checkouts);
  state.checkouts.push({
    id,
    cartId: cart.id,
    buildingId: building.id,
    slId: sl.id,
    borrowerName: borrowerName.trim(),
    borrowerPhone: borrowerPhone.trim(),
    checkedOutAt: now,
    dueAt: now + CHECKOUT_MINUTES * 60 * 1000,
    returnedAt: null,
    acknowledgedAt: null
  });
  cart.status = 'checked_out';
  save(state);
  sendState(res);
});

app.post('/api/checkouts/:id/return', (req, res) => {
  const id = Number(req.params.id);
  const state = load();
  const checkout = state.checkouts.find(c => c.id === id);
  if (!checkout) return res.status(404).json({ error: 'Checkout not found' });
  checkout.returnedAt = Date.now();
  const cart = state.carts.find(c => c.id === checkout.cartId);
  if (cart) cart.status = 'available';
  save(state);
  sendState(res);
});

app.post('/api/checkouts/:id/acknowledge', (req, res) => {
  const id = Number(req.params.id);
  const state = load();
  const checkout = state.checkouts.find(c => c.id === id);
  if (!checkout) return res.status(404).json({ error: 'Checkout not found' });
  checkout.acknowledgedAt = Date.now();
  save(state);
  sendState(res);
});

app.listen(PORT, () => {
  console.log(`Cart checkout server running at http://localhost:${PORT}`);
  const lanAddresses = Object.values(os.networkInterfaces())
    .flat()
    .filter(iface => iface && iface.family === 'IPv4' && !iface.internal)
    .map(iface => iface.address);
  if (lanAddresses.length) {
    console.log('Other devices on the same wifi/network can use:');
    lanAddresses.forEach(addr => console.log(`  http://${addr}:${PORT}`));
  }
});
