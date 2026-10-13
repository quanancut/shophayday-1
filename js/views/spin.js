/**
 * views/spin.js – Trang Vòng quay may mắn.
 */

import { store } from '../store.js';
import { esc, formatDate } from '../utils.js';

/**
 * Render trang vòng quay.
 * @returns {string} HTML
 */
export function renderSpin() {
  const user = store.currentUser;
  if (!user) return '<div class="container"><p>Bạn cần đăng nhập.</p></div>';

  const prizes = store.settings.wheel || [];
  const totalPct = prizes.reduce((s, p) => s + p.pct, 0);

  // Lấy lịch sử quay của user
  const history = (store.data.spinHistory || [])
    .filter(s => s.userId === user.id)
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, 20);

  return `
    <section class="hero">
      <div class="hero-content">
        <h1>🎰 Vòng quay may mắn</h1>
        <p>Quay để nhận vật phẩm miễn phí! Mỗi lượt quay nhận một phần thưởng ngẫu nhiên.</p>
      </div>
    </section>

    <div class="container">
      <div class="stats-row">
        <div class="stat-card">
          <div class="stat-value">${user.spins}</div>
          <div class="stat-label">Lượt quay còn lại</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${user.spinsUsed}</div>
          <div class="stat-label">Đã quay</div>
        </div>
      </div>

      <!-- Vòng quay -->
      <section class="panel spin-panel">
        <div class="wheel-container">
          <div class="wheel" id="spin-wheel">
            ${prizes.map((p, i) => {
              const angle = (360 / prizes.length) * i;
              const hue = (360 / prizes.length) * i;
              return `<div class="wheel-slice" style="--angle: ${angle}deg; --hue: ${hue}">
                <span class="wheel-slice-label">${esc(p.emoji)} ${esc(p.name)}</span>
              </div>`;
            }).join('')}
          </div>
          <div class="wheel-pointer">▼</div>
        </div>

        <div class="spin-actions">
          <button class="btn btn-primary btn-lg" data-action="spin" ${user.spins < 1 ? 'disabled' : ''}>
            ${user.spins > 0 ? `🎰 Quay (${user.spins} lượt)` : '🚫 Hết lượt quay'}
          </button>
        </div>

        <!-- Bảng phần thưởng -->
        <div class="prize-list">
          <h3>Phần thưởng</h3>
          <div class="table-wrapper">
            <table class="table">
              <thead>
                <tr><th>Vật phẩm</th><th>Số lượng</th><th>Tỉ lệ</th></tr>
              </thead>
              <tbody>
                ${prizes.map(p => `
                  <tr>
                    <td>${esc(p.emoji)} ${esc(p.name)}</td>
                    <td>×${p.qty}</td>
                    <td>${totalPct > 0 ? (p.pct / totalPct * 100).toFixed(1) : 0}%</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <!-- Lịch sử quay -->
      ${history.length > 0 ? `
        <section class="panel">
          <h2>Lịch sử quay</h2>
          <div class="table-wrapper">
            <table class="table">
              <thead>
                <tr><th>Thời gian</th><th>Phần thưởng</th><th>Số lượng</th></tr>
              </thead>
              <tbody>
                ${history.map(h => `
                  <tr>
                    <td>${formatDate(h.createdAt)}</td>
                    <td>${esc(h.emoji)} ${esc(h.name)}</td>
                    <td>×${h.qty}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </section>
      ` : ''}
    </div>
  `;
}
