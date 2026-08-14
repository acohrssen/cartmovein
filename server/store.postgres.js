const { neon } = require('@neondatabase/serverless');
const { CHECKOUT_MINUTES } = require('./constants');

const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;
const sql = neon(connectionString);

let schemaReady;

function ensureSchema() {
  if (!schemaReady) {
    schemaReady = (async () => {
      await sql`CREATE TABLE IF NOT EXISTS buildings (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL
      )`;
      await sql`CREATE TABLE IF NOT EXISTS sls (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL
      )`;
      await sql`CREATE TABLE IF NOT EXISTS carts (
        id SERIAL PRIMARY KEY,
        label TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'available'
      )`;
      await sql`CREATE TABLE IF NOT EXISTS checkouts (
        id SERIAL PRIMARY KEY,
        cart_id INTEGER NOT NULL,
        building_id INTEGER NOT NULL,
        sl_id INTEGER NOT NULL,
        borrower_name TEXT NOT NULL,
        borrower_phone TEXT NOT NULL,
        checked_out_at BIGINT NOT NULL,
        due_at BIGINT NOT NULL,
        returned_at BIGINT,
        acknowledged_at BIGINT
      )`;
    })();
  }
  return schemaReady;
}

function fail(message, status = 400) {
  const err = new Error(message);
  err.status = status;
  throw err;
}

async function loadState() {
  await ensureSchema();
  const [buildings, sls, carts, checkouts] = await Promise.all([
    sql`SELECT id, name FROM buildings ORDER BY id`,
    sql`SELECT id, name FROM sls ORDER BY id`,
    sql`SELECT id, label, status FROM carts ORDER BY id`,
    sql`SELECT id, cart_id AS "cartId", building_id AS "buildingId", sl_id AS "slId",
           borrower_name AS "borrowerName", borrower_phone AS "borrowerPhone",
           checked_out_at AS "checkedOutAt", due_at AS "dueAt",
           returned_at AS "returnedAt", acknowledged_at AS "acknowledgedAt"
         FROM checkouts ORDER BY id`
  ]);
  return {
    buildings,
    sls,
    carts,
    checkouts: checkouts.map(c => ({
      ...c,
      checkedOutAt: Number(c.checkedOutAt),
      dueAt: Number(c.dueAt),
      returnedAt: c.returnedAt === null ? null : Number(c.returnedAt),
      acknowledgedAt: c.acknowledgedAt === null ? null : Number(c.acknowledgedAt)
    }))
  };
}

async function addBuilding(name) {
  await ensureSchema();
  await sql`INSERT INTO buildings (name) VALUES (${name})`;
  return loadState();
}

async function deleteBuilding(id) {
  await ensureSchema();
  await sql`DELETE FROM buildings WHERE id = ${id}`;
  return loadState();
}

async function addSl(name) {
  await ensureSchema();
  await sql`INSERT INTO sls (name) VALUES (${name})`;
  return loadState();
}

async function deleteSl(id) {
  await ensureSchema();
  await sql`DELETE FROM sls WHERE id = ${id}`;
  return loadState();
}

async function addCart(label) {
  await ensureSchema();
  await sql`INSERT INTO carts (label, status) VALUES (${label}, 'available')`;
  return loadState();
}

async function deleteCart(id) {
  await ensureSchema();
  const active = await sql`SELECT 1 FROM checkouts WHERE cart_id = ${id} AND returned_at IS NULL LIMIT 1`;
  if (active.length) fail('Cannot delete a cart that is currently checked out');
  await sql`DELETE FROM carts WHERE id = ${id}`;
  return loadState();
}

async function checkout({ cartId, buildingId, slId, borrowerName, borrowerPhone }) {
  await ensureSchema();
  const [carts, buildings, sls] = await Promise.all([
    sql`SELECT * FROM carts WHERE id = ${Number(cartId)}`,
    sql`SELECT * FROM buildings WHERE id = ${Number(buildingId)}`,
    sql`SELECT * FROM sls WHERE id = ${Number(slId)}`
  ]);
  const cart = carts[0];
  const building = buildings[0];
  const sl = sls[0];

  if (!cart) fail('Select a valid cart');
  if (cart.status !== 'available') fail('Cart is already checked out');
  if (!building) fail('Select a valid building');
  if (!sl) fail('Select a valid Student Leader');
  if (!borrowerName || !borrowerName.trim()) fail('Borrower name is required');
  if (!borrowerPhone || !borrowerPhone.trim()) fail('Borrower phone number is required');

  const claimed = await sql`UPDATE carts SET status = 'checked_out'
    WHERE id = ${cart.id} AND status = 'available' RETURNING id`;
  if (!claimed.length) fail('Cart is already checked out');

  const now = Date.now();
  const dueAt = now + CHECKOUT_MINUTES * 60 * 1000;
  await sql`INSERT INTO checkouts
      (cart_id, building_id, sl_id, borrower_name, borrower_phone, checked_out_at, due_at)
    VALUES (${cart.id}, ${building.id}, ${sl.id}, ${borrowerName.trim()}, ${borrowerPhone.trim()}, ${now}, ${dueAt})`;
  return loadState();
}

async function returnCheckout(id) {
  await ensureSchema();
  const rows = await sql`SELECT * FROM checkouts WHERE id = ${id}`;
  const checkout = rows[0];
  if (!checkout) fail('Checkout not found', 404);
  await sql`UPDATE checkouts SET returned_at = ${Date.now()} WHERE id = ${id}`;
  await sql`UPDATE carts SET status = 'available' WHERE id = ${checkout.cart_id}`;
  return loadState();
}

async function acknowledgeCheckout(id) {
  await ensureSchema();
  const rows = await sql`UPDATE checkouts SET acknowledged_at = ${Date.now()} WHERE id = ${id} RETURNING id`;
  if (!rows.length) fail('Checkout not found', 404);
  return loadState();
}

module.exports = {
  loadState, addBuilding, deleteBuilding, addSl, deleteSl,
  addCart, deleteCart, checkout, returnCheckout, acknowledgeCheckout
};
