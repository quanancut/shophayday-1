/**
 * app.js – Controller chính của ứng dụng Single Page Application (SPA).
 * Quản lý routing giao diện, giỏ hàng, tương tác modal, xử lý sự kiện toàn cục.
 */

import { store, RULES } from './store.js';
import { esc, formatMoney, toast, $, $$ } from './utils.js';
import { showModal, confirmModal } from './modal.js';
import { renderShop } from './views/shop.js';
import { renderInventory } from './views/inventory.js';
import { renderWallet } from './views/wallet.js';
import { renderSpin } from './views/spin.js';
import { renderChat } from './views/chat.js';
import { renderAdmin } from './views/admin.js';

/* ===== Trạng thái giao diện (UI State) ===== */
const ui = {
  view: 'shop',
  cat: 'Tất cả',
  searchQuery: '',
  sort: 'default',
  cart: {}, // { [productId]: quantity }
  adminTab: 'products',
  adminChatUserId: null
};

/* ===== Điều hướng & Render ===== */

function renderHeader() {
  const header = $('#header');
  if (!header) return;

  const user = store.currentUser;
  const cartCount = Object.values(ui.cart).reduce((sum, q) => sum + q, 0);

  const navItems = [
    { key: 'shop', label: 'Cửa hàng', icon: '🏪' }
  ];

  if (user) {
    navItems.push(
      { key: 'inv', label: 'Kho của tôi', icon: '📦' },
      { key: 'spin', label: `Vòng quay${user.spins > 0 ? ` (${user.spins})` : ''}`, icon: '🎰' },
      { key: 'wallet', label: 'Ví & đơn hàng', icon: '💰' }
    );
    if (user.role !== 'admin') {
      const unread = store.getUnreadCount('user', user.id);
      navItems.push({ key: 'chat', label: `Chat với shop${unread > 0 ? ` (${unread})` : ''}`, icon: '💬' });
    }
    if (user.role === 'admin') {
      const adminUnread = store.getUnreadCount('admin');
      const pendingTopups = store.topups.filter(t => t.status === 'pending').length;
      const badge = (adminUnread + pendingTopups) > 0 ? ` (${adminUnread + pendingTopups})` : '';
      navItems.push({ key: 'admin', label: `Quản trị${badge}`, icon: '⚙️' });
    }
  }

  header.innerHTML = `
    <div class="nav-container">
      <div class="brand" data-action="nav" data-view="shop">
        <span class="brand-icon">🌾</span>
        <span class="brand-name">Kho Làng Hay Day</span>
      </div>

      <nav class="nav-links">
        ${navItems.map(item => `
          <button class="nav-link ${ui.view === item.key ? 'nav-active' : ''}" data-action="nav" data-view="${item.key}">
            <span>${item.icon}</span> ${item.label}
          </button>
        `).join('')}
      </nav>

      <div class="user-actions">
        <button class="btn btn-ghost btn-sm cart-btn" data-action="open-cart">
          🛒 Giỏ hàng (${cartCount})
        </button>

        ${user ? `
          <span class="user-badge" title="Số dư ví">
            🪙 <b>${formatMoney(user.balance)}</b>
          </span>
          <span class="user-name">👤 ${esc(user.username)}</span>
          <button class="btn btn-ghost btn-sm" data-action="logout">Đăng xuất</button>
        ` : `
          <button class="btn btn-ghost btn-sm" data-action="show-login">Đăng nhập</button>
          <button class="btn btn-primary btn-sm" data-action="show-register">Tạo tài khoản</button>
        `}
      </div>
    </div>
  `;
}

function render() {
  const user = store.currentUser;

  // Bảo vệ route cần quyền
  if (['inv', 'wallet', 'chat', 'spin'].includes(ui.view) && !user) {
    ui.view = 'shop';
  }
  if (ui.view === 'chat' && user?.role === 'admin') {
    ui.view = 'admin';
    ui.adminTab = 'chat';
  }
  if (ui.view === 'admin' && !store.isAdmin) {
    ui.view = 'shop';
  }

  renderHeader();

  const app = $('#app');
  if (!app) return;

  const views = {
    shop: () => renderShop(ui),
    inv: () => renderInventory(),
    wallet: () => renderWallet(),
    spin: () => renderSpin(),
    chat: () => renderChat(),
    admin: () => renderAdmin(ui)
  };

  const renderFn = views[ui.view] || views.shop;
  app.innerHTML = renderFn();

  // Scroll chat xuống cuối nếu đang mở chat
  const chatLog = $('#chat-log') || $('#admin-chat-log');
  if (chatLog) chatLog.scrollTop = chatLog.scrollHeight;
}

/* ===== Giỏ hàng & Mua hàng ===== */

function addToCart(productId) {
  const product = store.getProductById(productId);
  if (!product) return;

  if (product.stock < RULES.MIN_ITEM) {
    toast(`Vật phẩm "${product.name}" hiện không đủ số lượng tối thiểu (${RULES.MIN_ITEM}).`, 'warning');
    return;
  }

  const current = ui.cart[productId] || 0;
  const nextQty = current + RULES.STEP_QTY;

  if (nextQty > product.stock) {
    toast(`Kho chỉ còn ${product.stock} món.`, 'warning');
    return;
  }

  ui.cart[productId] = nextQty;
  toast(`Đã thêm ${product.name} (×${ui.cart[productId]}) vào giỏ.`, 'success');
  render();
}

function openCartModal() {
  const entries = Object.entries(ui.cart).filter(([, qty]) => qty > 0);
  const R = RULES;

  let subtotal = 0;
  let totalQty = 0;
  const items = [];

  for (const [pid, qty] of entries) {
    const p = store.getProductById(pid);
    if (p) {
      items.push({ p, qty, lineTotal: p.price * qty });
      subtotal += p.price * qty;
      totalQty += qty;
    }
  }

  const discount = totalQty > R.DISCOUNT_QTY ? Math.round(subtotal * R.DISCOUNT_PCT / 100) : 0;
  const total = subtotal - discount;

  const content = items.length === 0 ? `
    <div class="empty-state empty-sm">
      <p>Giỏ hàng đang trống.</p>
    </div>
  ` : `
    <div class="cart-items-table">
      ${items.map(({ p, qty, lineTotal }) => `
        <div class="cart-row">
          <div class="cart-row-info">
            <b>${esc(p.name)}</b>
            <small class="text-muted">${formatMoney(p.price)} / món</small>
          </div>
          <div class="cart-row-qty">
            <button class="btn btn-sm btn-ghost" data-cart-dec="${esc(p.id)}">-</button>
            <span>${qty}</span>
            <button class="btn btn-sm btn-ghost" data-cart-inc="${esc(p.id)}">+</button>
          </div>
          <div class="cart-row-price">${formatMoney(lineTotal)}</div>
          <button class="btn btn-sm btn-danger" data-cart-del="${esc(p.id)}">✕</button>
        </div>
      `).join('')}
    </div>

    <div class="cart-summary">
      <div class="summary-line"><span>Tổng số lượng:</span> <b>${totalQty} cái</b></div>
      <div class="summary-line"><span>Tạm tính:</span> <b>${formatMoney(subtotal)}</b></div>
      ${discount > 0 ? `<div class="summary-line text-success"><span>Giảm giá (${R.DISCOUNT_PCT}%):</span> <b>-${formatMoney(discount)}</b></div>` : ''}
      <div class="summary-line summary-total"><span>Thực trả:</span> <b>${formatMoney(total)}</b></div>
    </div>

    ${totalQty < R.MIN_ORDER ? `
      <div class="alert alert-warning" style="margin-top:1rem">
        ⚠️ Mỗi đơn cần tối thiểu ${R.MIN_ORDER} cái. Bạn cần chọn thêm ${R.MIN_ORDER - totalQty} cái.
      </div>
    ` : ''}
  `;

  showModal({
    title: '🛒 Giỏ hàng của bạn',
    content,
    size: 'lg',
    buttons: items.length > 0 ? [
      {
        text: 'Xóa hết',
        className: 'btn-ghost',
        action: () => {
          ui.cart = {};
          render();
        }
      },
      {
        text: 'Tiến hành đặt hàng',
        className: 'btn-primary',
        action: (modal) => {
          if (!store.isLoggedIn) {
            toast('Vui lòng đăng nhập để thanh toán.', 'info');
            showLoginModal();
            return false;
          }
          if (totalQty < R.MIN_ORDER) {
            toast(`Đơn hàng cần tối thiểu ${R.MIN_ORDER} cái.`, 'warning');
            return false;
          }
          showCheckoutModal(items, totalQty, subtotal, discount, total);
        }
      }
    ] : [{ text: 'Đóng', className: 'btn-ghost' }]
  });

  // Gắn sự kiện tăng giảm giỏ hàng bên trong modal
  const root = $('#modal-root');
  if (root) {
    root.onclick = (e) => {
      const inc = e.target.closest('[data-cart-inc]');
      const dec = e.target.closest('[data-cart-dec]');
      const del = e.target.closest('[data-cart-del]');

      if (inc) {
        const pid = inc.dataset.cartInc;
        const p = store.getProductById(pid);
        if (p && ui.cart[pid] + R.STEP_QTY <= p.stock) {
          ui.cart[pid] += R.STEP_QTY;
          openCartModal(); // re-render modal
          render();
        } else {
          toast('Kho không đủ số lượng.', 'warning');
        }
      } else if (dec) {
        const pid = dec.dataset.cartDec;
        if (ui.cart[pid] - R.STEP_QTY >= R.MIN_ITEM) {
          ui.cart[pid] -= R.STEP_QTY;
        } else {
          delete ui.cart[pid];
        }
        openCartModal();
        render();
      } else if (del) {
        const pid = del.dataset.cartDel;
        delete ui.cart[pid];
        openCartModal();
        render();
      }
    };
  }
}

function showCheckoutModal(items, totalQty, subtotal, discount, total) {
  const user = store.currentUser;
  const content = `
    <div class="checkout-form">
      <p>Số dư ví của bạn: <b>${formatMoney(user.balance)}</b></p>
      ${user.balance < total ? `
        <div class="alert alert-danger" style="margin-bottom:1rem">
          ⚠️ Số dư không đủ (thiếu ${formatMoney(total - user.balance)}). Vui lòng nạp thêm tiền vào ví.
        </div>
      ` : ''}

      <div class="form-group">
        <label class="form-label">Kênh liên hệ nhận hàng:</label>
        <select id="checkout-channel" class="form-input">
          <option value="Zalo" ${user.contactChannel === 'Zalo' ? 'selected' : ''}>Zalo (Số điện thoại)</option>
          <option value="Facebook" ${user.contactChannel === 'Facebook' ? 'selected' : ''}>Facebook (Link trang cá nhân)</option>
        </select>
      </div>

      <div class="form-group">
        <label class="form-label">Số Zalo hoặc link Facebook:</label>
        <input type="text" id="checkout-contact" class="form-input" value="${esc(user.contactValue || '')}" placeholder="0912345678 hoặc https://facebook.com/ten-ban">
      </div>

      <div class="form-group">
        <label class="form-label">Ghi chú (Tên nông trại / ID Hay Day):</label>
        <input type="text" id="checkout-note" class="form-input" placeholder="Ví dụ: Nông trại Vui Vẻ, ID #ABC123XYZ">
      </div>

      <div class="form-group">
        <label class="checkbox-label">
          <input type="checkbox" id="checkout-agree">
          <span>Tôi đã đọc và đồng ý với các lưu ý khi mua hàng.</span>
        </label>
      </div>
    </div>
  `;

  showModal({
    title: '📦 Xác nhận đặt hàng',
    content,
    buttons: [
      { text: 'Quay lại', className: 'btn-ghost', action: () => openCartModal() },
      {
        text: `Thanh toán (${formatMoney(total)})`,
        className: 'btn-success',
        action: (modal) => {
          const channel = modal.querySelector('#checkout-channel').value;
          const contact = modal.querySelector('#checkout-contact').value.trim();
          const note = modal.querySelector('#checkout-note').value.trim();
          const agree = modal.querySelector('#checkout-agree').checked;

          if (!agree) {
            toast('Vui lòng tích xác nhận đã đọc lưu ý.', 'warning');
            return false;
          }

          const res = store.placeOrder({
            items: ui.cart,
            channel,
            contact,
            note
          });

          if (!res.ok) {
            toast(res.error, 'error');
            return false;
          }

          ui.cart = {};
          toast('Đặt hàng thành công! Đơn hàng đang được xử lý.', 'success');
          if (res.spins > 0) {
            toast(`🎁 Bạn nhận được thêm ${res.spins} lượt quay may mắn!`, 'success');
          }
          ui.view = 'wallet';
          render();
        }
      }
    ]
  });
}

/* ===== Modal Đăng nhập / Đăng ký ===== */

function showLoginModal() {
  showModal({
    title: '🔑 Đăng nhập',
    content: `
      <div class="form-group">
        <label class="form-label">Tên đăng nhập:</label>
        <input type="text" id="login-un" class="form-input" placeholder="Tên đăng nhập" autofocus>
      </div>
      <div class="form-group">
        <label class="form-label">Mật khẩu:</label>
        <input type="password" id="login-pw" class="form-input" placeholder="Mật khẩu">
      </div>
    `,
    buttons: [
      { text: 'Hủy', className: 'btn-ghost' },
      {
        text: 'Đăng nhập',
        className: 'btn-primary',
        action: async (modal) => {
          const un = modal.querySelector('#login-un').value.trim();
          const pw = modal.querySelector('#login-pw').value;
          const res = await store.login(un, pw);
          if (!res.ok) {
            toast(res.error, 'error');
            return false;
          }
          toast(`Chào mừng trở lại, ${un}!`, 'success');
          render();
        }
      }
    ]
  });
}

function showRegisterModal() {
  showModal({
    title: '✨ Tạo tài khoản mới',
    content: `
      <div class="form-group">
        <label class="form-label">Tên đăng nhập (3–20 ký tự, không dấu):</label>
        <input type="text" id="reg-un" class="form-input" placeholder="Ví dụ: nongdan123" autofocus>
      </div>
      <div class="form-group">
        <label class="form-label">Mật khẩu (ít nhất 6 ký tự):</label>
        <input type="password" id="reg-pw" class="form-input" placeholder="Mật khẩu">
      </div>
      <div class="form-group">
        <label class="form-label">Nhập lại mật khẩu:</label>
        <input type="password" id="reg-pw2" class="form-input" placeholder="Nhập lại mật khẩu">
      </div>
    `,
    buttons: [
      { text: 'Hủy', className: 'btn-ghost' },
      {
        text: 'Tạo tài khoản',
        className: 'btn-primary',
        action: async (modal) => {
          const un = modal.querySelector('#reg-un').value.trim();
          const pw = modal.querySelector('#reg-pw').value;
          const pw2 = modal.querySelector('#reg-pw2').value;

          if (pw !== pw2) {
            toast('Hai mật khẩu chưa khớp.', 'warning');
            return false;
          }

          const res = await store.register(un, pw);
          if (!res.ok) {
            toast(res.error, 'error');
            return false;
          }
          toast('Tạo tài khoản thành công!', 'success');
          render();
        }
      }
    ]
  });
}

/* ===== Modal Nạp tiền ===== */

function showTopupModal() {
  const user = store.currentUser;
  if (!user) return;

  const code = store.generateTopupCode();
  const momo = store.settings.momo || '0835203303';
  const momoName = store.settings.momoName || 'Chủ tài khoản';

  showModal({
    title: '💳 Nạp tiền vào ví',
    content: `
      <div class="topup-instructions">
        <p>Vui lòng chuyển khoản MoMo với thông tin bên dưới:</p>
        <div class="topup-card">
          <div><b>Số MoMo:</b> <code class="highlight">${esc(momo)}</code></div>
          <div><b>Chủ tài khoản:</b> <b>${esc(momoName)}</b></div>
          <div><b>Nội dung chuyển khoản (bắt buộc):</b> <code class="highlight">${esc(user.username)} ${code}</code></div>
        </div>

        <div class="form-group" style="margin-top:1rem">
          <label class="form-label">Số tiền bạn đã/sẽ chuyển (tối thiểu 1.000đ):</label>
          <input type="number" id="topup-amount" class="form-input" min="1000" step="1000" placeholder="Ví dụ: 50000">
        </div>
      </div>
    `,
    buttons: [
      { text: 'Hủy', className: 'btn-ghost' },
      {
        text: 'Tôi đã chuyển tiền',
        className: 'btn-success',
        action: (modal) => {
          const amount = parseInt(modal.querySelector('#topup-amount').value, 10);
          const res = store.requestTopup(amount, code);
          if (!res.ok) {
            toast(res.error, 'error');
            return false;
          }
          toast('Yêu cầu nạp tiền đã được gửi. Shop sẽ duyệt trong vài phút!', 'success');
          render();
        }
      }
    ]
  });
}

/* ===== Modal Quản lý Admin ===== */

function showProductForm(productId = null) {
  const p = productId ? store.getProductById(productId) : null;
  const isEdit = !!p;

  showModal({
    title: isEdit ? '✏️ Sửa vật phẩm' : '➕ Thêm vật phẩm mới',
    content: `
      <div class="form-group">
        <label class="form-label">Tên vật phẩm:</label>
        <input type="text" id="prod-name" class="form-input" value="${esc(p?.name || '')}" placeholder="Tên vật phẩm">
      </div>
      <div class="form-group">
        <label class="form-label">Biểu tượng (Emoji):</label>
        <input type="text" id="prod-emoji" class="form-input" value="${esc(p?.emoji || '📦')}" placeholder="Emoji">
      </div>
      <div class="form-group">
        <label class="form-label">Loại vật phẩm:</label>
        <select id="prod-cat" class="form-input">
          ${RULES.CATS.map(c => `<option value="${c}" ${p?.cat === c ? 'selected' : ''}>${c}</option>`).join('')}
        </select>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Giá (VNĐ):</label>
          <input type="number" id="prod-price" class="form-input" min="1" value="${p?.price || 1000}">
        </div>
        <div class="form-group">
          <label class="form-label">Tồn kho:</label>
          <input type="number" id="prod-stock" class="form-input" min="0" value="${p?.stock ?? 100}">
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Mô tả ngắn:</label>
        <input type="text" id="prod-desc" class="form-input" value="${esc(p?.desc || '')}" placeholder="Mô tả công dụng">
      </div>
    `,
    buttons: [
      { text: 'Hủy', className: 'btn-ghost' },
      {
        text: 'Lưu',
        className: 'btn-primary',
        action: (modal) => {
          const res = store.saveProduct({
            id: p?.id,
            name: modal.querySelector('#prod-name').value,
            emoji: modal.querySelector('#prod-emoji').value,
            cat: modal.querySelector('#prod-cat').value,
            price: parseInt(modal.querySelector('#prod-price').value, 10),
            stock: parseInt(modal.querySelector('#prod-stock').value, 10),
            desc: modal.querySelector('#prod-desc').value
          });
          if (!res.ok) {
            toast(res.error, 'error');
            return false;
          }
          toast('Đã lưu vật phẩm.', 'success');
          render();
        }
      }
    ]
  });
}

/* ===== Xử lý sự kiện toàn cục (Event Delegation) ===== */

function setupEventListeners() {
  document.addEventListener('click', async (e) => {
    const actionEl = e.target.closest('[data-action]');
    if (!actionEl) return;

    const action = actionEl.dataset.action;

    switch (action) {
      case 'nav':
        ui.view = actionEl.dataset.view;
        render();
        break;

      case 'filter-cat':
        ui.cat = actionEl.dataset.cat;
        render();
        break;

      case 'add-to-cart':
        addToCart(actionEl.dataset.productId);
        break;

      case 'open-cart':
        openCartModal();
        break;

      case 'show-login':
        showLoginModal();
        break;

      case 'show-register':
        showRegisterModal();
        break;

      case 'logout':
        store.logout();
        toast('Đã đăng xuất.', 'info');
        render();
        break;

      case 'show-topup':
        showTopupModal();
        break;

      case 'spin': {
        const res = store.spin();
        if (!res.ok) {
          toast(res.error, 'error');
          return;
        }
        // Hiệu ứng quay
        const wheel = $('#spin-wheel');
        if (wheel) {
          wheel.style.transform = `rotate(${360 * 5 + res.prizeIndex * (360 / store.settings.wheel.length)}deg)`;
        }
        setTimeout(() => {
          toast(`🎉 Chúc mừng bạn đã trúng: ${res.prize.emoji} ${res.prize.name} (×${res.prize.qty})!`, 'success', 5000);
          render();
        }, 1000);
        break;
      }

      case 'cancel-order': {
        const orderId = actionEl.dataset.orderId;
        const confirmed = await confirmModal('Hủy đơn hàng', 'Bạn có chắc chắn muốn hủy đơn hàng này? Số tiền sẽ được hoàn về ví.');
        if (confirmed) {
          const res = store.cancelOrder(orderId, 'Khách tự hủy');
          if (res.ok) {
            toast('Đã hủy đơn hàng thành công.', 'success');
            render();
          } else {
            toast(res.error, 'error');
          }
        }
        break;
      }

      case 'send-message': {
        const input = $('#chat-input');
        if (input && input.value.trim()) {
          store.sendMessage(input.value.trim());
          input.value = '';
          render();
        }
        break;
      }

      /* Admin actions */
      case 'admin-tab':
        ui.adminTab = actionEl.dataset.tab;
        render();
        break;

      case 'show-product-form':
        showProductForm();
        break;

      case 'edit-product':
        showProductForm(actionEl.dataset.productId);
        break;

      case 'delete-product': {
        const pid = actionEl.dataset.productId;
        const confirmed = await confirmModal('Xóa vật phẩm', 'Bạn có chắc muốn xóa vật phẩm này?');
        if (confirmed) {
          store.deleteProduct(pid);
          toast('Đã xóa vật phẩm.', 'success');
          render();
        }
        break;
      }

      case 'approve-topup': {
        const tid = actionEl.dataset.topupId;
        const res = store.approveTopup(tid);
        if (res.ok) {
          toast('Đã duyệt nạp tiền.', 'success');
          render();
        }
        break;
      }

      case 'reject-topup': {
        const tid = actionEl.dataset.topupId;
        const res = store.rejectTopup(tid);
        if (res.ok) {
          toast('Đã từ chối nạp tiền.', 'info');
          render();
        }
        break;
      }

      case 'toggle-order': {
        const oid = actionEl.dataset.orderId;
        const res = store.toggleOrderStatus(oid);
        if (res.ok) {
          toast(`Đã cập nhật đơn hàng: ${res.newStatus}`, 'success');
          render();
        }
        break;
      }

      case 'admin-cancel-order': {
        const oid = actionEl.dataset.orderId;
        const confirmed = await confirmModal('Hủy đơn', 'Xác nhận hủy đơn của khách và hoàn tiền?');
        if (confirmed) {
          store.cancelOrder(oid, 'Shop hủy', true);
          toast('Đã hủy đơn hàng.', 'info');
          render();
        }
        break;
      }

      case 'select-chat':
        ui.adminChatUserId = actionEl.dataset.userId;
        render();
        break;

      case 'admin-send-message': {
        const input = $('#admin-chat-input');
        const targetId = actionEl.dataset.userId;
        if (input && input.value.trim() && targetId) {
          store.sendMessage(input.value.trim(), targetId);
          input.value = '';
          render();
        }
        break;
      }

      case 'save-momo': {
        const momo = $('#momo-input')?.value || '';
        const momoName = $('#momo-name-input')?.value || '';
        const res = store.updateMomo(momo, momoName);
        if (res.ok) toast('Đã lưu thông tin MoMo.', 'success');
        else toast(res.error, 'error');
        break;
      }

      case 'save-notes': {
        const notes = $('#notes-input')?.value || '';
        const res = store.updateNotes(notes);
        if (res.ok) toast('Đã lưu các lưu ý.', 'success');
        else toast(res.error, 'error');
        break;
      }

      case 'reset-data': {
        const confirmed = await confirmModal('Khôi phục dữ liệu mẫu', 'Toàn bộ dữ liệu hiện tại sẽ bị xóa sạch. Bạn có chắc không?');
        if (confirmed) {
          store.resetData();
          toast('Đã khôi phục dữ liệu mẫu.', 'info');
          ui.view = 'shop';
          render();
        }
        break;
      }
    }
  });

  // Tìm kiếm và sắp xếp
  document.addEventListener('input', (e) => {
    if (e.target.id === 'search-input') {
      ui.searchQuery = e.target.value;
      render();
    }
  });

  document.addEventListener('change', (e) => {
    if (e.target.id === 'sort-select') {
      ui.sort = e.target.value;
      render();
    }
  });
}

/* ===== Khởi động ứng dụng ===== */

async function main() {
  await store.init();
  setupEventListeners();
  render();
}

window.addEventListener('DOMContentLoaded', main);
