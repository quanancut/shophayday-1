/**
 * views/wallet.js – Trang Ví & đơn hàng: nạp tiền, xem lịch sử mua hàng.
 */

import { store } from '../store.js';
import { esc, formatMoney, formatDate } from '../utils.js';

/**
 * Render trang ví và đơn hàng.
 * @returns {string} HTML
 */
export function renderWallet() {
  const user = store.currentUser;
  if (!user) return '<div class="container"><p>Bạn cần đăng nhập.</p></div>';

  const myTopups = store.topups
    .filter(t => t.userId === user.id)
    .sort((a, b) => b.createdAt - a.createdAt);

  const myOrders = store.orders
    .filter(o => o.userId === user.id)
    .sort((a, b) => b.createdAt - a.createdAt);

  const statusMap = {
    pending: ['Chờ duyệt', 'badge-warning'],
    approved: ['Đã cộng', 'badge-success'],
    rejected: ['Từ chối', 'badge-danger']
  };

  const orderStatusMap = {
    processing: ['Đang xử lý', 'badge-info'],
    done: ['Thành công', 'badge-success'],
    cancelled: ['Đã hủy', 'badge-danger']
  };

  return `
    <section class="hero">
      <div class="hero-content">
        <h1>💰 Ví & đơn hàng</h1>
        <p>Nạp tiền vào ví để mua vật phẩm.</p>
      </div>
      <button class="btn btn-primary" data-action="show-topup">Nạp tiền vào ví</button>
    </section>

    <div class="container">
      <div class="stats-row">
        <div class="stat-card">
          <div class="stat-value">${formatMoney(user.balance)}</div>
          <div class="stat-label">Số dư hiện tại</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${myOrders.filter(o => o.status !== 'cancelled').length}</div>
          <div class="stat-label">Đơn đã mua</div>
        </div>
      </div>

      <!-- Yêu cầu nạp tiền -->
      <section class="panel">
        <h2>Yêu cầu nạp tiền</h2>
        ${myTopups.length > 0 ? `
          <div class="table-wrapper">
            <table class="table">
              <thead>
                <tr>
                  <th>Thời gian</th>
                  <th>Số tiền</th>
                  <th>Nội dung CK</th>
                  <th>Trạng thái</th>
                </tr>
              </thead>
              <tbody>
                ${myTopups.map(t => {
                  const [label, cls] = statusMap[t.status] || ['—', ''];
                  return `<tr>
                    <td>${formatDate(t.createdAt)}</td>
                    <td>${formatMoney(t.amount)}</td>
                    <td>${esc(t.note || '—')}</td>
                    <td><span class="badge ${cls}">${label}</span></td>
                  </tr>`;
                }).join('')}
              </tbody>
            </table>
          </div>
        ` : `
          <div class="empty-state empty-sm">
            <p>Chưa có yêu cầu nạp tiền nào.</p>
          </div>
        `}
      </section>

      <!-- Lịch sử mua hàng -->
      <section class="panel">
        <h2>Lịch sử mua hàng</h2>
        ${myOrders.length > 0 ? `
          <div class="table-wrapper">
            <table class="table">
              <thead>
                <tr>
                  <th>Thời gian</th>
                  <th>Vật phẩm</th>
                  <th>Tổng</th>
                  <th>Nhận qua</th>
                  <th>Trạng thái</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                ${myOrders.map(o => {
                  const [statusLabel, statusCls] = orderStatusMap[o.status] || ['—', ''];
                  const itemsText = o.items.map(i => `${esc(i.name)} ×${i.qty}`).join(', ');
                  const totalHtml = o.discount > 0
                    ? `<s class="text-muted">${formatMoney(o.subtotal)}</s> ${formatMoney(o.total)}`
                    : formatMoney(o.total);
                  const contactText = o.contact
                    ? `${esc(o.contact.channel)}: ${esc(o.contact.value)}`
                    : '—';
                  const canCancel = o.status === 'processing';
                  return `<tr>
                    <td>${formatDate(o.createdAt)}</td>
                    <td class="text-wrap">${itemsText}</td>
                    <td>${totalHtml}</td>
                    <td>${contactText}</td>
                    <td>
                      <span class="badge ${statusCls}">${statusLabel}</span>
                      ${o.status === 'cancelled' && o.cancelReason ? `<br><small class="text-muted">Lý do: ${esc(o.cancelReason)}</small>` : ''}
                    </td>
                    <td>
                      ${canCancel ? `<button class="btn btn-danger btn-sm" data-action="cancel-order" data-order-id="${esc(o.id)}">Hủy đơn</button>` : ''}
                    </td>
                  </tr>`;
                }).join('')}
              </tbody>
            </table>
          </div>
        ` : `
          <div class="empty-state empty-sm">
            <p>Chưa có đơn hàng nào.</p>
          </div>
        `}
      </section>
    </div>
  `;
}
