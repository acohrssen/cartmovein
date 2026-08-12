let state = { buildings: [], sls: [], carts: [], checkouts: [] };
const notifiedIds = new Set();

async function api(path, options) {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...options
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

async function refresh() {
  state = await api('/api/state');
  render();
}

function byId(list, id) {
  return list.find(x => x.id === id);
}

function render() {
  renderCheckoutForm();
  renderActiveList();
  renderAdminLists();
}

function renderCheckoutForm() {
  const cartSelect = document.getElementById('cartSelect');
  const buildingSelect = document.getElementById('buildingSelect');
  const slSelect = document.getElementById('slSelect');

  const availableCarts = state.carts.filter(c => c.status === 'available');
  cartSelect.innerHTML = availableCarts.length
    ? availableCarts.map(c => `<option value="${c.id}">${escapeHtml(c.label)}</option>`).join('')
    : '<option value="">No carts available</option>';

  buildingSelect.innerHTML = state.buildings.length
    ? state.buildings.map(b => `<option value="${b.id}">${escapeHtml(b.name)}</option>`).join('')
    : '<option value="">Add a building first</option>';

  slSelect.innerHTML = state.sls.length
    ? state.sls.map(s => `<option value="${s.id}">${escapeHtml(s.name)}</option>`).join('')
    : '<option value="">Add a Student Leader first</option>';
}

function renderActiveList() {
  const container = document.getElementById('activeList');
  const active = state.checkouts.filter(c => !c.returnedAt);

  if (!active.length) {
    container.innerHTML = '<p class="empty-note">No carts currently checked out.</p>';
    return;
  }

  const groups = new Map();
  for (const checkout of active) {
    const building = byId(state.buildings, checkout.buildingId);
    const key = building ? building.name : 'Unknown building';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(checkout);
  }

  const sortedBuildingNames = [...groups.keys()].sort((a, b) => a.localeCompare(b));

  container.innerHTML = sortedBuildingNames.map(name => {
    const rows = groups.get(name)
      .sort((a, b) => a.dueAt - b.dueAt)
      .map(checkout => cartCardHtml(checkout))
      .join('');
    return `<div class="building-group"><h3>${escapeHtml(name)}</h3>${rows}</div>`;
  }).join('');

  container.querySelectorAll('[data-return]').forEach(btn => {
    btn.addEventListener('click', () => returnCheckout(Number(btn.dataset.return)));
  });
  container.querySelectorAll('[data-ack]').forEach(btn => {
    btn.addEventListener('click', () => acknowledgeCheckout(Number(btn.dataset.ack)));
  });
}

function cartCardHtml(checkout) {
  const cart = byId(state.carts, checkout.cartId);
  const sl = byId(state.sls, checkout.slId);
  const remainingMs = checkout.dueAt - Date.now();
  const expired = remainingMs <= 0;

  return `
    <div class="cart-card ${expired ? 'expired' : ''}" data-checkout-id="${checkout.id}" data-due="${checkout.dueAt}">
      <div class="info">
        <strong>${escapeHtml(cart ? cart.label : 'Cart')}</strong>
        <span>Borrower: ${escapeHtml(checkout.borrowerName)} &middot; ${escapeHtml(checkout.borrowerPhone)}</span>
        <span>SL in charge: ${escapeHtml(sl ? sl.name : 'Unknown')}</span>
        ${expired ? `<span class="alert-banner">⏰ Time's up — ${escapeHtml(sl ? sl.name : 'SL')}, call ${escapeHtml(checkout.borrowerPhone)} now</span>` : ''}
      </div>
      <div class="timer ${expired ? 'expired' : ''}" data-timer>${formatRemaining(remainingMs)}</div>
      <div class="actions">
        ${expired && !checkout.acknowledgedAt ? `<button class="secondary-btn" data-ack="${checkout.id}">Acknowledge</button>` : ''}
        <button data-return="${checkout.id}">Mark returned</button>
      </div>
    </div>
  `;
}

function formatRemaining(ms) {
  if (ms <= 0) {
    const overMs = Math.abs(ms);
    const m = Math.floor(overMs / 60000);
    const s = Math.floor((overMs % 60000) / 1000);
    return `-${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  const m = Math.floor(ms / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function tickTimers() {
  document.querySelectorAll('[data-checkout-id]').forEach(card => {
    const dueAt = Number(card.dataset.due);
    const remainingMs = dueAt - Date.now();
    const expired = remainingMs <= 0;
    const timerEl = card.querySelector('[data-timer]');
    timerEl.textContent = formatRemaining(remainingMs);
    timerEl.classList.toggle('expired', expired);
    card.classList.toggle('expired', expired);

    if (expired) {
      const checkoutId = Number(card.dataset.checkoutId);
      if (!notifiedIds.has(checkoutId)) {
        notifiedIds.add(checkoutId);
        fireExpiryNotification(checkoutId);
        render(); // reflow to show banner + acknowledge button
      }
    }
  });
}

function fireExpiryNotification(checkoutId) {
  const checkout = state.checkouts.find(c => c.id === checkoutId);
  if (!checkout) return;
  const cart = byId(state.carts, checkout.cartId);
  const sl = byId(state.sls, checkout.slId);
  const body = `${sl ? sl.name : 'SL'}: call ${checkout.borrowerPhone} about ${cart ? cart.label : 'the cart'}`;
  if (window.Notification && Notification.permission === 'granted') {
    new Notification('Cart timer expired', { body });
  }
}

function renderAdminLists() {
  const buildingList = document.getElementById('buildingList');
  buildingList.innerHTML = state.buildings.map(b =>
    `<li>${escapeHtml(b.name)}<button data-del-building="${b.id}">✕</button></li>`
  ).join('') || '<li class="empty-note">No buildings yet</li>';

  const cartList = document.getElementById('cartList');
  cartList.innerHTML = state.carts.map(c =>
    `<li>${escapeHtml(c.label)} <span class="status-chip ${c.status}">${c.status.replace('_', ' ')}</span><button data-del-cart="${c.id}">✕</button></li>`
  ).join('') || '<li class="empty-note">No carts yet</li>';

  const slList = document.getElementById('slList');
  slList.innerHTML = state.sls.map(s =>
    `<li>${escapeHtml(s.name)}<button data-del-sl="${s.id}">✕</button></li>`
  ).join('') || '<li class="empty-note">No Student Leaders yet</li>';

  buildingList.querySelectorAll('[data-del-building]').forEach(btn =>
    btn.addEventListener('click', () => api(`/api/buildings/${btn.dataset.delBuilding}`, { method: 'DELETE' }).then(s => { state = s; render(); }))
  );
  cartList.querySelectorAll('[data-del-cart]').forEach(btn =>
    btn.addEventListener('click', () => api(`/api/carts/${btn.dataset.delCart}`, { method: 'DELETE' }).then(s => { state = s; render(); }).catch(showAdminError))
  );
  slList.querySelectorAll('[data-del-sl]').forEach(btn =>
    btn.addEventListener('click', () => api(`/api/sls/${btn.dataset.delSl}`, { method: 'DELETE' }).then(s => { state = s; render(); }))
  );
}

function showAdminError(err) {
  alert(err.message);
}

async function returnCheckout(id) {
  notifiedIds.delete(id);
  state = await api(`/api/checkouts/${id}/return`, { method: 'POST' });
  render();
}

async function acknowledgeCheckout(id) {
  state = await api(`/api/checkouts/${id}/acknowledge`, { method: 'POST' });
  render();
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[ch]));
}

document.getElementById('checkoutForm').addEventListener('submit', async e => {
  e.preventDefault();
  const errorEl = document.getElementById('checkoutError');
  errorEl.textContent = '';
  try {
    state = await api('/api/checkouts', {
      method: 'POST',
      body: JSON.stringify({
        cartId: document.getElementById('cartSelect').value,
        buildingId: document.getElementById('buildingSelect').value,
        slId: document.getElementById('slSelect').value,
        borrowerName: document.getElementById('borrowerName').value,
        borrowerPhone: document.getElementById('borrowerPhone').value
      })
    });
    e.target.reset();
    render();
  } catch (err) {
    errorEl.textContent = err.message;
  }
});

document.getElementById('buildingForm').addEventListener('submit', async e => {
  e.preventDefault();
  const input = document.getElementById('buildingName');
  state = await api('/api/buildings', { method: 'POST', body: JSON.stringify({ name: input.value }) });
  input.value = '';
  render();
});

document.getElementById('cartForm').addEventListener('submit', async e => {
  e.preventDefault();
  const input = document.getElementById('cartLabel');
  state = await api('/api/carts', { method: 'POST', body: JSON.stringify({ label: input.value }) });
  input.value = '';
  render();
});

document.getElementById('slForm').addEventListener('submit', async e => {
  e.preventDefault();
  const nameInput = document.getElementById('slName');
  state = await api('/api/sls', { method: 'POST', body: JSON.stringify({ name: nameInput.value }) });
  nameInput.value = '';
  render();
});

document.getElementById('notifyBtn').addEventListener('click', () => {
  if (window.Notification) {
    Notification.requestPermission().then(perm => {
      document.getElementById('notifyBtn').textContent = perm === 'granted' ? 'Alerts enabled' : 'Enable alerts';
    });
  }
});

refresh();
setInterval(refresh, 5000);
setInterval(tickTimers, 1000);
