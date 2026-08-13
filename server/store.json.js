const fs = require('fs');
const path = require('path');
const { CHECKOUT_MINUTES } = require('./constants');

const DATA_FILE = path.join(__dirname, '..', 'data.json');
const EMPTY_STATE = { buildings: [], sls: [], carts: [], checkouts: [] };

function fail(message, status = 400) {
  const err = new Error(message);
  err.status = status;
  throw err;
}

function readFile() {
  if (!fs.existsSync(DATA_FILE)) {
    writeFile(EMPTY_STATE);
    return structuredClone(EMPTY_STATE);
  }
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
  } catch {
    return structuredClone(EMPTY_STATE);
  }
}

function writeFile(state) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(state, null, 2));
}

function nextId(list) {
  return list.reduce((max, item) => Math.max(max, item.id), 0) + 1;
}

async function loadState() {
  return readFile();
}

async function addBuilding(name) {
  const state = readFile();
  state.buildings.push({ id: nextId(state.buildings), name });
  writeFile(state);
  return state;
}

async function deleteBuilding(id) {
  const state = readFile();
  state.buildings = state.buildings.filter(b => b.id !== id);
  writeFile(state);
  return state;
}

async function addSl(name) {
  const state = readFile();
  state.sls.push({ id: nextId(state.sls), name });
  writeFile(state);
  return state;
}

async function deleteSl(id) {
  const state = readFile();
  state.sls = state.sls.filter(s => s.id !== id);
  writeFile(state);
  return state;
}

async function addCart(label) {
  const state = readFile();
  state.carts.push({ id: nextId(state.carts), label, status: 'available' });
  writeFile(state);
  return state;
}

async function deleteCart(id) {
  const state = readFile();
  const hasActiveCheckout = state.checkouts.some(c => c.cartId === id && !c.returnedAt);
  if (hasActiveCheckout) fail('Cannot delete a cart that is currently checked out');
  state.carts = state.carts.filter(c => c.id !== id);
  writeFile(state);
  return state;
}

async function checkout({ cartId, buildingId, slId, borrowerName, borrowerPhone }) {
  const state = readFile();
  const cart = state.carts.find(c => c.id === Number(cartId));
  const building = state.buildings.find(b => b.id === Number(buildingId));
  const sl = state.sls.find(s => s.id === Number(slId));

  if (!cart) fail('Select a valid cart');
  if (cart.status !== 'available') fail('Cart is already checked out');
  if (!building) fail('Select a valid building');
  if (!sl) fail('Select a valid Student Leader');
  if (!borrowerName || !borrowerName.trim()) fail('Borrower name is required');
  if (!borrowerPhone || !borrowerPhone.trim()) fail('Borrower phone number is required');

  const now = Date.now();
  state.checkouts.push({
    id: nextId(state.checkouts),
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
  writeFile(state);
  return state;
}

async function returnCheckout(id) {
  const state = readFile();
  const checkout = state.checkouts.find(c => c.id === id);
  if (!checkout) fail('Checkout not found', 404);
  checkout.returnedAt = Date.now();
  const cart = state.carts.find(c => c.id === checkout.cartId);
  if (cart) cart.status = 'available';
  writeFile(state);
  return state;
}

async function acknowledgeCheckout(id) {
  const state = readFile();
  const checkout = state.checkouts.find(c => c.id === id);
  if (!checkout) fail('Checkout not found', 404);
  checkout.acknowledgedAt = Date.now();
  writeFile(state);
  return state;
}

module.exports = {
  loadState, addBuilding, deleteBuilding, addSl, deleteSl,
  addCart, deleteCart, checkout, returnCheckout, acknowledgeCheckout
};
