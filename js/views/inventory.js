/**
 * views/inventory.js – Trang Kho của tôi: hiển thị vật phẩm đã mua.
 */

import { store } from '../store.js';
import { esc, formatMoney } from '../utils.js';

/**
 * Render trang kho vật phẩm của người dùng.
 * @returns {string} HTML
 */
export function renderInventory() {
  const user = store.currentUser;
  if (!user) return '<div class="container"><p>Bạn cần đăng nhập để xem kho.</p></div>';

  const items = Object.entries(user.inventory).filter(([, v]) => v.qty > 0);
  const totalQty = items.reduce((s, [, v]) => s + v.qty, 0);

  return `
    <section class="hero">
      <div class="hero-content">
        <h1>📦 Kho của tôi</h1>
        <p>Vật phẩm bạn đã mua. Shop sẽ gửi vào game theo thông tin bạn cung cấp.</p>
      </div>
    </section>

    <div class="container">
      <div class="stats-row">
        <div class="stat-card">
          <div class="stat-value">${items.length}</div>
          <div class="stat-label">Loại vật phẩm</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${formatMoney(user.balance)}</div>
          <div class="stat-label">Số dư ví</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${totalQty.toLocaleString('vi-VN')}</div>
          <div class="stat-label">Tổng số lượng</div>
        </div>
      </div>

      <section class="panel">
        ${items.length > 0 ? `
          <div class="inv-grid">
            ${items.map(([id, v]) => {
              const product = store.getProductById(id);
              const img = product?.img || '';
              return `
                <div class="inv-slot">
                  <span class="inv-qty">×${v.qty}</span>
                  <div class="inv-emoji">${img ? `<img src="${esc(img)}" alt="${esc(v.name)}" loading="lazy">` : esc(v.emoji)}</div>
                  <div class="inv-name">${esc(v.name)}</div>
                </div>
              `;
            }).join('')}
          </div>
        ` : `
          <div class="empty-state">
            <span class="empty-icon">📦</span>
            <p>Kho đang trống. Ghé cửa hàng để mua vật phẩm đầu tiên.</p>
            <button class="btn btn-primary" data-action="navigate" data-view="shop">Đến cửa hàng</button>
          </div>
        `}
      </section>
    </div>
  `;
}
