/**
 * views/admin.js – Trang Quản trị (Admin Panel).
 * Bao gồm: quản lý vật phẩm, tài khoản, nạp tiền, đơn hàng, chat, vòng quay, cài đặt.
 */

import { store, RULES } from '../store.js';
import { esc, formatMoney, formatDate } from '../utils.js';

/**
 * Render toàn bộ trang admin.
 * @param {Object} ui - Trạng thái giao diện
 * @returns {string} HTML
 */
export function renderAdmin(ui) {
  if (!store.isAdmin) return '<div class="container"><p>Bạn không có quyền quản trị.</p></div>';

  const tab = ui.adminTab || 'products';
  const pendingTopups = store.topups.filter(t => t.status === 'pending').length;
  const unreadChats = store.getUnreadCount('admin');
  const revenue = store.orders
    .filter(o => o.status !== 'cancelled')
    .reduce((s, o) => s + o.total, 0);

  const tabs = [
    ['products', 'Vật phẩm'],
    ['users', 'Tài khoản'],
    ['topups', `Nạp tiền${pendingTopups > 0 ? ` (${pendingTopups})` : ''}`],
    ['orders', 'Đơn hàng'],
    ['chat', `Tin nhắn${unreadChats > 0 ? ` (${unreadChats})` : ''}`],
    ['wheel', 'Vòng quay'],
    ['settings', 'Cài đặt']
  ];

  const renderers = {
    products: renderAdminProducts,
    users: renderAdminUsers,
    topups: renderAdminTopups,
    orders: renderAdminOrders,
    chat: () => renderAdminChat(ui),
    wheel: renderAdminWheel,
    settings: renderAdminSettings
  };

  return `
    <section class="hero">
      <div class="hero-content">
        <h1>⚙️ Quản trị</h1>
        <p>Doanh thu: <strong>${formatMoney(revenue)}</strong> · ${store.data.users.length} tài khoản · ${store.orders.length} đơn hàng</p>
      </div>
    </section>

    <div class="container">
      <div class="tabs">
        ${tabs.map(([key, label]) => `
          <button class="tab ${tab === key ? 'tab-active' : ''}" data-action="admin-tab" data-tab="${key}">${label}</button>
        `).join('')}
      </div>

      <div class="tab-content">
        ${(renderers[tab] || renderers.products)()}
      </div>
    </div>
  `;
}

/* ----- Tab: Vật phẩm ----- */
function renderAdminProducts() {
  return `
    <section class="panel">
      <div class="panel-header">
        <h2>Quản lý vật phẩm</h2>
        <button class="btn btn-primary btn-sm" data-action="show-product-form">+ Thêm vật phẩm</button>
      </div>
      <div class="table-wrapper">
        <table class="table">
          <thead>
            <tr><th></th><th>Tên</th><th>Loại</th><th>Giá</th><th>Tồn kho</th><th>Thao tác</th></tr>
          </thead>
          <tbody>
            ${store.products.map(p => `
              <tr>
                <td class="text-center text-lg">${p.img ? `<img class="table-thumb" src="${esc(p.img)}" alt="">` : esc(p.emoji)}</td>
                <td>${esc(p.name)}</td>
                <td>${esc(p.cat)}</td>
                <td>${formatMoney(p.price)}</td>
                <td>${p.stock < 1 ? '<span class="badge badge-danger">Hết</span>' : p.stock}</td>
                <td>
                  <div class="btn-group">
                    <button class="btn btn-sm btn-ghost" data-action="edit-product" data-product-id="${esc(p.id)}">Sửa</button>
                    <button class="btn btn-sm btn-danger" data-action="delete-product" data-product-id="${esc(p.id)}">Xóa</button>
                  </div>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </section>
  `;
}

/* ----- Tab: Tài khoản ----- */
function renderAdminUsers() {
  const users = store.data.users.sort((a, b) => a.createdAt - b.createdAt);
  return `
    <section class="panel">
      <div class="panel-header">
        <h2>Quản lý tài khoản</h2>
        <button class="btn btn-primary btn-sm" data-action="show-user-form">+ Tạo tài khoản</button>
      </div>
      <div class="table-wrapper">
        <table class="table">
          <thead>
            <tr><th>Tên ĐN</th><th>Vai trò</th><th>Số dư</th><th>Kho</th><th>Lượt quay</th><th>Ngày tạo</th><th>Thao tác</th></tr>
          </thead>
          <tbody>
            ${users.map(u => {
              const invCount = Object.values(u.inventory || {}).reduce((s, v) => s + v.qty, 0);
              return `
                <tr class="${u.locked ? 'row-locked' : ''}">
                  <td>
                    ${esc(u.username)}
                    ${u.locked ? '<span class="badge badge-danger">Khóa</span>' : ''}
                  </td>
                  <td><span class="badge ${u.role === 'admin' ? 'badge-info' : ''}">${u.role === 'admin' ? 'Admin' : 'User'}</span></td>
                  <td>${formatMoney(u.balance)}</td>
                  <td>${invCount} món</td>
                  <td>${u.spins} còn / ${u.spinsUsed} đã quay</td>
                  <td>${formatDate(u.createdAt)}</td>
                  <td>
                    <div class="btn-group">
                      <button class="btn btn-sm btn-ghost" data-action="edit-user" data-user-id="${esc(u.id)}">Sửa</button>
                      ${u.id !== store.currentUser?.id ? `<button class="btn btn-sm btn-danger" data-action="delete-user" data-user-id="${esc(u.id)}">Xóa</button>` : ''}
                    </div>
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    </section>
  `;
}

/* ----- Tab: Nạp tiền ----- */
function renderAdminTopups() {
  const topups = store.topups.sort((a, b) => b.createdAt - a.createdAt);
  const statusMap = {
    pending: ['Chờ duyệt', 'badge-warning'],
    approved: ['Đã duyệt', 'badge-success'],
    rejected: ['Từ chối', 'badge-danger']
  };

  return `
    <section class="panel">
      <h2>Quản lý nạp tiền</h2>
      ${topups.length > 0 ? `
        <div class="table-wrapper">
          <table class="table">
            <thead>
              <tr><th>Thời gian</th><th>Khách</th><th>Số tiền</th><th>Mã CK</th><th>Trạng thái</th><th>Thao tác</th></tr>
            </thead>
            <tbody>
              ${topups.map(t => {
                const [label, cls] = statusMap[t.status] || ['—', ''];
                return `
                  <tr>
                    <td>${formatDate(t.createdAt)}</td>
                    <td>${esc(t.username)}</td>
                    <td>${formatMoney(t.amount)}</td>
                    <td><code>${esc(t.code)}</code></td>
                    <td><span class="badge ${cls}">${label}</span></td>
                    <td>
                      ${t.status === 'pending' ? `
                        <div class="btn-group">
                          <button class="btn btn-sm btn-success" data-action="approve-topup" data-topup-id="${esc(t.id)}">Duyệt</button>
                          <button class="btn btn-sm btn-danger" data-action="reject-topup" data-topup-id="${esc(t.id)}">Từ chối</button>
                        </div>
                      ` : '—'}
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      ` : '<div class="empty-state empty-sm"><p>Chưa có yêu cầu nạp tiền nào.</p></div>'}
    </section>
  `;
}

/* ----- Tab: Đơn hàng ----- */
function renderAdminOrders() {
  const orders = store.orders.sort((a, b) => b.createdAt - a.createdAt);
  const statusMap = {
    processing: ['Đang xử lý', 'badge-info'],
    done: ['Thành công', 'badge-success'],
    cancelled: ['Đã hủy', 'badge-danger']
  };

  return `
    <section class="panel">
      <h2>Quản lý đơn hàng</h2>
      ${orders.length > 0 ? `
        <div class="table-wrapper">
          <table class="table">
            <thead>
              <tr><th>Thời gian</th><th>Khách</th><th>Vật phẩm</th><th>Tổng</th><th>Liên hệ</th><th>Trạng thái</th><th>Thao tác</th></tr>
            </thead>
            <tbody>
              ${orders.map(o => {
                const [label, cls] = statusMap[o.status] || ['—', ''];
                const itemsText = o.items.map(i => `${esc(i.name)} ×${i.qty}`).join(', ');
                const contactText = o.contact ? `${esc(o.contact.channel)}: ${esc(o.contact.value)}${o.contact.note ? `<br><small>${esc(o.contact.note)}</small>` : ''}` : '—';
                return `
                  <tr>
                    <td>${formatDate(o.createdAt)}</td>
                    <td>${esc(o.username)}</td>
                    <td class="text-wrap">${itemsText}</td>
                    <td>${formatMoney(o.total)}</td>
                    <td class="text-wrap">${contactText}</td>
                    <td><span class="badge ${cls}">${label}</span></td>
                    <td>
                      ${o.status !== 'cancelled' ? `
                        <div class="btn-group">
                          <button class="btn btn-sm ${o.status === 'done' ? 'btn-ghost' : 'btn-success'}" data-action="toggle-order" data-order-id="${esc(o.id)}">
                            ${o.status === 'done' ? 'Mở lại' : '✅ Xong'}
                          </button>
                          ${o.status === 'processing' ? `<button class="btn btn-sm btn-danger" data-action="admin-cancel-order" data-order-id="${esc(o.id)}">Hủy</button>` : ''}
                        </div>
                      ` : `
                        <small class="text-muted">${o.cancelBy === 'admin' ? 'Shop hủy' : 'Khách hủy'}${o.cancelReason ? `: ${esc(o.cancelReason)}` : ''}</small>
                      `}
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      ` : '<div class="empty-state empty-sm"><p>Chưa có đơn hàng nào.</p></div>'}
    </section>
  `;
}

/* ----- Tab: Chat ----- */
function renderAdminChat(ui) {
  const users = store.data.users.filter(u => u.role !== 'admin');
  const chatUserId = ui.adminChatUserId || (users[0]?.id ?? null);

  // Danh sách cuộc chat
  const chatList = users.map(u => {
    const msgs = store.getMessages(u.id);
    const lastMsg = msgs.sort((a, b) => b.createdAt - a.createdAt)[0];
    const unread = store.getUnreadCount('admin', u.id);
    return { user: u, lastMsg, unread };
  }).sort((a, b) => {
    // Ưu tiên tin chưa đọc, sau đó theo thời gian
    if (a.unread && !b.unread) return -1;
    if (!a.unread && b.unread) return 1;
    return (b.lastMsg?.createdAt || 0) - (a.lastMsg?.createdAt || 0);
  });

  // Tin nhắn của cuộc chat đang chọn
  const chatMessages = chatUserId
    ? store.getMessages(chatUserId).sort((a, b) => a.createdAt - b.createdAt)
    : [];

  if (chatUserId) {
    store.markRead('admin', chatUserId);
  }

  return `
    <section class="panel">
      <h2>Tin nhắn khách hàng</h2>
      <div class="chat-admin-layout">
        <div class="chat-sidebar">
          ${chatList.length > 0 ? chatList.map(({ user: u, lastMsg, unread }) => `
            <button class="chat-contact ${chatUserId === u.id ? 'chat-contact-active' : ''}" data-action="select-chat" data-user-id="${esc(u.id)}">
              <span class="chat-contact-name">${esc(u.username)}</span>
              ${unread > 0 ? `<span class="chat-contact-badge">${unread}</span>` : ''}
              ${lastMsg ? `<span class="chat-contact-preview">${esc(lastMsg.text).slice(0, 30)}…</span>` : ''}
            </button>
          `).join('') : '<p class="text-muted text-center">Chưa có khách hàng.</p>'}
        </div>
        <div class="chat-main">
          ${chatUserId ? `
            <div class="chat-log" id="admin-chat-log">
              ${chatMessages.length > 0 ? chatMessages.map(m => `
                <div class="chat-bubble chat-${m.sender === 'admin' ? 'right' : 'left'}">
                  <div class="chat-sender">${m.sender === 'admin' ? 'Bạn (Admin)' : '👤 Khách'}</div>
                  <div class="chat-text">${esc(m.text).replace(/\n/g, '<br>')}</div>
                  <div class="chat-time">${formatDate(m.createdAt)}</div>
                </div>
              `).join('') : '<div class="empty-state empty-sm"><p>Chưa có tin nhắn.</p></div>'}
            </div>
            <div class="chat-input-area">
              <textarea id="admin-chat-input" class="form-input" placeholder="Nhập tin nhắn…" maxlength="500" rows="2"></textarea>
              <button class="btn btn-primary" data-action="admin-send-message" data-user-id="${esc(chatUserId)}">Gửi</button>
            </div>
          ` : '<div class="empty-state"><p>Chọn một khách hàng để xem tin nhắn.</p></div>'}
        </div>
      </div>
    </section>
  `;
}

/* ----- Tab: Vòng quay ----- */
function renderAdminWheel() {
  const prizes = store.settings.wheel || [];

  return `
    <section class="panel">
      <div class="panel-header">
        <h2>Quản lý vòng quay</h2>
        <div class="btn-group">
          <button class="btn btn-sm btn-ghost" data-action="wheel-even">Chia đều tỉ lệ</button>
          <button class="btn btn-sm btn-primary" data-action="show-prize-form">+ Thêm phần thưởng</button>
        </div>
      </div>
      <div class="table-wrapper">
        <table class="table">
          <thead>
            <tr><th>Vật phẩm</th><th>Số lượng thưởng</th><th>Tỉ lệ (%)</th><th>Thao tác</th></tr>
          </thead>
          <tbody>
            ${prizes.map(p => `
              <tr>
                <td>${esc(p.emoji)} ${esc(p.name)}</td>
                <td>×${p.qty}</td>
                <td>${p.pct}%</td>
                <td>
                  <div class="btn-group">
                    <button class="btn btn-sm btn-ghost" data-action="edit-prize" data-prize-id="${esc(p.id)}">Sửa</button>
                    <button class="btn btn-sm btn-danger" data-action="delete-prize" data-prize-id="${esc(p.id)}">Xóa</button>
                  </div>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>

      <!-- Milestone -->
      <div class="panel-header" style="margin-top:1.5rem">
        <h3>Mốc thưởng lượt quay</h3>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Tính theo</label>
          <select id="milestone-by" class="form-input">
            <option value="topup" ${store.settings.milestoneBy !== 'spent' ? 'selected' : ''}>Tổng nạp tiền</option>
            <option value="spent" ${store.settings.milestoneBy === 'spent' ? 'selected' : ''}>Tổng mua hàng</option>
          </select>
        </div>
        <div class="form-group flex-grow">
          <label class="form-label">Các mốc (cách nhau bằng dấu phẩy)</label>
          <input type="text" id="milestones-input" class="form-input"
            value="${(store.settings.milestones || []).join(', ')}"
            placeholder="20000, 50000, 100000">
        </div>
        <button class="btn btn-primary" data-action="save-milestones" style="align-self:flex-end">Lưu mốc</button>
      </div>
    </section>
  `;
}

/* ----- Tab: Cài đặt ----- */
function renderAdminSettings() {
  return `
    <section class="panel">
      <h2>Cài đặt chung</h2>

      <!-- MoMo -->
      <div class="settings-group">
        <h3>Số MoMo nhận tiền</h3>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Số điện thoại MoMo</label>
            <input type="text" id="momo-input" class="form-input" value="${esc(store.settings.momo || '')}" maxlength="10" placeholder="0912345678">
          </div>
          <div class="form-group">
            <label class="form-label">Tên chủ tài khoản</label>
            <input type="text" id="momo-name-input" class="form-input" value="${esc(store.settings.momoName || '')}" maxlength="80" placeholder="Tên hiển thị">
          </div>
          <button class="btn btn-primary" data-action="save-momo" style="align-self:flex-end">Lưu MoMo</button>
        </div>
      </div>

      <!-- Lưu ý -->
      <div class="settings-group">
        <h3>Lưu ý khi mua</h3>
        <div class="form-group">
          <textarea id="notes-input" class="form-input" rows="5" maxlength="1500">${esc(store.settings.notes || '')}</textarea>
        </div>
        <button class="btn btn-primary" data-action="save-notes">Lưu lưu ý</button>
      </div>

      <!-- Khôi phục -->
      <div class="settings-group settings-danger">
        <h3>⚠️ Vùng nguy hiểm</h3>
        <p class="text-muted">Khôi phục dữ liệu mẫu sẽ xóa toàn bộ dữ liệu hiện tại (tài khoản, đơn hàng, vật phẩm). Hành động này không thể hoàn tác.</p>
        <button class="btn btn-danger" data-action="reset-data">Khôi phục dữ liệu mẫu</button>
      </div>
    </section>
  `;
}
