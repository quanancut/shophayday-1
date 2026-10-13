/**
 * views/shop.js – Trang Cửa hàng: hiển thị sản phẩm, lọc/tìm/sắp xếp, thêm vào giỏ.
 */

import { store, RULES } from '../store.js';
import { esc, formatMoney, $ } from '../utils.js';
import { toast } from '../utils.js';

/**
 * Render trang cửa hàng.
 * @param {Object} ui - Trạng thái giao diện
 * @returns {string} HTML
 */
export function renderShop(ui) {
  const user = store.currentUser;
  let list = store.products.filter(p =>
    (ui.cat === 'Tất cả' || p.cat === ui.cat) &&
    p.name.toLowerCase().includes((ui.searchQuery || '').toLowerCase())
  );

  if (ui.sort === 'asc') list = [...list].sort((a, b) => a.price - b.price);
  else if (ui.sort === 'desc') list = [...list].sort((a, b) => b.price - a.price);
  else list = [...list].sort((a, b) => (a.sort || 0) - (b.sort || 0));

  const R = RULES;
  const milestoneText = (store.settings.milestones || []).map(m => formatMoney(m)).join(', ');
  const metricLabel = store.settings.milestoneBy === 'spent' ? 'mua hàng' : 'nạp tiền';

  return `
    <section class="hero">
      <div class="hero-content">
        <h1>🌾 Vật phẩm Hay Day, giá rõ ràng</h1>
        <p>Mua theo bội số của ${R.STEP_QTY} (10, 20, 30…), tối thiểu ${R.MIN_ITEM} cái mỗi món, mỗi đơn từ ${R.MIN_ORDER} cái.</p>
        ${user ? '' : '<button class="btn btn-primary" data-action="show-register">Tạo tài khoản để mua</button>'}
      </div>
    </section>

    <div class="container">
      <div class="notes-box">
        <strong>📋 Lưu ý khi mua</strong>
        ${(store.settings.notes || '').split('\n').map(line => `<p>${esc(line)}</p>`).join('')}
      </div>

      <div class="promo">🎉 Mua trên ${R.DISCOUNT_QTY.toLocaleString('vi-VN')} cái trong một đơn: giảm ${R.DISCOUNT_PCT}% tổng tiền.</div>
      <div class="promo">🎁 Tổng tiền ${metricLabel} đạt ${milestoneText}: nhận thêm 1 lượt quay vòng quay may mắn.</div>

      <div class="toolbar">
        <div class="search-box">
          <span class="search-icon">🔍</span>
          <input type="search" id="search-input" placeholder="Tìm vật phẩm…" value="${esc(ui.searchQuery || '')}" aria-label="Tìm vật phẩm">
        </div>
        <select id="sort-select" aria-label="Sắp xếp">
          <option value="default" ${ui.sort === 'default' ? 'selected' : ''}>Mặc định</option>
          <option value="asc" ${ui.sort === 'asc' ? 'selected' : ''}>Giá thấp → cao</option>
          <option value="desc" ${ui.sort === 'desc' ? 'selected' : ''}>Giá cao → thấp</option>
        </select>
      </div>

      <div class="chip-bar">
        ${['Tất cả', ...R.CATS].map(c => `
          <button class="chip ${ui.cat === c ? 'chip-active' : ''}" data-action="filter-cat" data-cat="${esc(c)}">${esc(c)}</button>
        `).join('')}
      </div>

      ${list.length ? `
        <div class="product-grid">
          ${list.map(p => renderProductCard(p, ui)).join('')}
        </div>
      ` : `
        <div class="empty-state">
          <span class="empty-icon">🔍</span>
          <p>Không có vật phẩm nào khớp. Thử bỏ bộ lọc hoặc đổi từ khóa.</p>
        </div>
      `}
    </div>
  `;
}

/**
 * Render một card sản phẩm.
 * @param {Object} product
 * @param {Object} ui
 * @returns {string} HTML
 */
function renderProductCard(product, ui) {
  const R = RULES;
  const inCart = ui.cart?.[product.id] || 0;
  const stockClass = product.stock <= 5 ? 'stock-low' : '';
  const disabled = product.stock < R.MIN_ITEM;

  return `
    <article class="card" data-product-id="${esc(product.id)}">
      <div class="card-visual">
        <span class="card-category">${esc(product.cat)}</span>
        <div class="card-emoji">${product.img ? `<img src="${esc(product.img)}" alt="${esc(product.name)}" loading="lazy">` : esc(product.emoji)}</div>
      </div>
      <div class="card-body">
        <h3 class="card-title">${esc(product.name)}</h3>
        <p class="card-desc">${esc(product.desc)}</p>
        <div class="card-meta">
          <span class="card-price">${formatMoney(product.price)}</span>
          <span class="card-stock ${stockClass}">${product.stock > 0 ? 'Còn ' + product.stock : 'Hết hàng'}</span>
        </div>
        <button class="btn btn-primary btn-block ${disabled ? 'btn-disabled' : ''}"
          data-action="add-to-cart" data-product-id="${esc(product.id)}"
          ${disabled ? 'disabled' : ''}>
          ${product.stock < 1 ? 'Hết hàng' : product.stock < R.MIN_ITEM ? 'Còn dưới mức tối thiểu' : inCart > 0 ? `Trong giỏ: ${inCart}` : 'Thêm vào giỏ'}
        </button>
      </div>
    </article>
  `;
}
