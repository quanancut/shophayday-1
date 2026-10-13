/**
 * utils.js – Tiện ích dùng chung cho toàn bộ ứng dụng.
 * Bao gồm: escape XSS, định dạng tiền/ngày, validation, DOM helpers, toast.
 */

/* ===== XSS Prevention ===== */

/**
 * Escape HTML entities để ngăn XSS injection.
 * @param {*} str - Chuỗi cần escape
 * @returns {string} Chuỗi đã được escape an toàn
 */
export function esc(str) {
  const s = String(str ?? '');
  const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  return s.replace(/[&<>"']/g, c => map[c]);
}

/* ===== Định dạng ===== */

/**
 * Định dạng số tiền theo chuẩn Việt Nam (VNĐ).
 * @param {number} n - Số tiền
 * @returns {string} Chuỗi đã định dạng, ví dụ "25.000đ"
 */
export function formatMoney(n) {
  return new Intl.NumberFormat('vi-VN').format(Math.round(n)) + 'đ';
}

/**
 * Định dạng thời gian theo chuẩn Việt Nam.
 * @param {number} timestamp - Unix timestamp (ms)
 * @returns {string} Chuỗi ngày giờ, ví dụ "13/10/2026 22:16"
 */
export function formatDate(timestamp) {
  return new Date(timestamp).toLocaleString('vi-VN', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}

/* ===== Validation ===== */

/** Regex kiểm tra tên đăng nhập hợp lệ: 3-20 ký tự, chữ không dấu, số, gạch dưới */
export const USERNAME_RE = /^[A-Za-z0-9_]{3,20}$/;

/** Regex kiểm tra số điện thoại Việt Nam */
export const PHONE_RE = /^(0|\+84)\d{9,10}$/;

/** Regex kiểm tra link Facebook */
export const FACEBOOK_RE = /^https?:\/\/((www|m|web|mbasic)\.)?(facebook\.com|fb\.com|fb\.me|m\.me)\/\S+$/i;

/**
 * Chuyển giá trị thành số nguyên, trả về null nếu không hợp lệ.
 * @param {*} value
 * @returns {number|null}
 */
export function toInt(value) {
  if (typeof value === 'boolean') return null;
  if (typeof value === 'number') return Number.isInteger(value) ? value : null;
  const n = parseInt(String(value).trim(), 10);
  return Number.isNaN(n) ? null : n;
}

/**
 * Yêu cầu giá trị phải là số nguyên trong khoảng [lo, hi]. Ném lỗi nếu sai.
 * @param {*} value
 * @param {number} lo - Giới hạn dưới
 * @param {number} hi - Giới hạn trên
 * @param {string} msg - Thông báo lỗi
 * @returns {number}
 */
export function requireInt(value, lo, hi, msg) {
  const n = toInt(value);
  if (n === null || n < lo || n > hi) throw new Error(msg);
  return n;
}

/**
 * Lấy text từ object, trim và giới hạn độ dài.
 * @param {Object} obj
 * @param {string} key
 * @param {number} maxLen
 * @returns {string}
 */
export function getText(obj, key, maxLen) {
  return String(obj?.[key] ?? '').trim().slice(0, maxLen);
}

/* ===== DOM Helpers ===== */

/**
 * Query selector ngắn gọn.
 * @param {string} selector
 * @param {Element} [parent=document]
 * @returns {Element|null}
 */
export function $(selector, parent = document) {
  return parent.querySelector(selector);
}

/**
 * Query selector all ngắn gọn.
 * @param {string} selector
 * @param {Element} [parent=document]
 * @returns {NodeList}
 */
export function $$(selector, parent = document) {
  return parent.querySelectorAll(selector);
}

/* ===== Toast Notifications ===== */

/**
 * Hiển thị thông báo toast.
 * @param {string} message - Nội dung thông báo (plain text, sẽ được escape)
 * @param {'success'|'error'|'warning'|'info'} [type='info'] - Loại thông báo
 * @param {number} [duration=3000] - Thời gian hiển thị (ms)
 */
export function toast(message, type = 'info', duration = 3000) {
  const container = document.getElementById('toast-root');
  if (!container) return;

  const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.setAttribute('role', 'alert');
  el.innerHTML = `<span class="toast-icon">${icons[type] || icons.info}</span><span class="toast-msg">${esc(message)}</span>`;

  container.appendChild(el);

  // Tự động biến mất sau duration ms
  setTimeout(() => {
    el.classList.add('toast-exit');
    el.addEventListener('animationend', () => el.remove());
  }, duration);
}

/* ===== Băm mật khẩu (client-side) ===== */

/**
 * Băm mật khẩu bằng SHA-256 với salt cố định.
 * Dùng cho localStorage – KHÔNG phải bảo mật thực sự mà chỉ để
 * tránh lưu mật khẩu plain text trong trình duyệt.
 * @param {string} password
 * @returns {Promise<string>} Hash hex string
 */
export async function hashPassword(password) {
  try {
    const data = new TextEncoder().encode('hdshop$' + password);
    const buffer = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(buffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  } catch {
    // Fallback cho môi trường không hỗ trợ crypto.subtle (HTTP không có SSL)
    return 'b64:' + btoa(unescape(encodeURIComponent(password)));
  }
}

/**
 * So sánh mật khẩu với hash đã lưu.
 * @param {string} password - Mật khẩu nhập vào
 * @param {string} storedHash - Hash đã lưu
 * @returns {Promise<boolean>}
 */
export async function verifyPassword(password, storedHash) {
  const hashed = await hashPassword(password);
  // So sánh an toàn chống timing attack (cho client-side thì đủ rồi)
  if (hashed.length !== storedHash.length) return false;
  let result = 0;
  for (let i = 0; i < hashed.length; i++) {
    result |= hashed.charCodeAt(i) ^ storedHash.charCodeAt(i);
  }
  return result === 0;
}

/* ===== Tạo ID duy nhất ===== */

/**
 * Tạo ID duy nhất với prefix.
 * @param {string} prefix - Tiền tố (ví dụ: 'u', 'p', 'o')
 * @returns {string} ID dạng "u_abc123def"
 */
export function generateId(prefix = '') {
  const random = crypto.getRandomValues(new Uint8Array(6));
  const hex = Array.from(random).map(b => b.toString(16).padStart(2, '0')).join('');
  return `${prefix}_${hex}`;
}
