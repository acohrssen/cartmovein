const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, '..', 'data.json');

const EMPTY_STATE = {
  buildings: [],
  sls: [],
  carts: [],
  checkouts: []
};

function load() {
  if (!fs.existsSync(DATA_FILE)) {
    save(EMPTY_STATE);
    return structuredClone(EMPTY_STATE);
  }
  const raw = fs.readFileSync(DATA_FILE, 'utf-8');
  try {
    return JSON.parse(raw);
  } catch {
    return structuredClone(EMPTY_STATE);
  }
}

function save(state) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(state, null, 2));
}

function nextId(list) {
  return list.reduce((max, item) => Math.max(max, item.id), 0) + 1;
}

module.exports = { load, save, nextId };
