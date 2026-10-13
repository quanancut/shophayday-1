/**
 * modal.js – Hệ thống modal dialog.
 * Hỗ trợ: confirm, form input, custom HTML content.
 * Đảm bảo accessibility: focus trap, ESC to close, aria attributes.
 */

import { $, esc } from './utils.js';

let _modalStack = [];

/**
 * Hiển thị modal dialog.
 * @param {Object} options
 * @param {string} options.title - Tiêu đề modal
 * @param {string} options.content - Nội dung HTML (đã escape nếu cần)
 * @param {Array<{text: string, className?: string, action?: Function}>} [options.buttons] - Các nút bấm
 * @param {Function} [options.onClose] - Callback khi đóng
 * @param {string} [options.size='md'] - Kích thước: 'sm', 'md', 'lg'
 * @returns {HTMLElement} Modal element
 */
export function showModal({ title, content, buttons = [], onClose = null, size = 'md' }) {
  const root = document.getElementById('modal-root');
  if (!root) return null;

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-label', title);

  const modalId = 'modal-' + Date.now();
  overlay.innerHTML = `
    <div class="modal modal-${size}" id="${modalId}">
      <div class="modal-header">
        <h3 class="modal-title">${esc(title)}</h3>
        <button class="modal-close" aria-label="Đóng" data-modal-close>&times;</button>
      </div>
      <div class="modal-body">${content}</div>
      ${buttons.length ? `<div class="modal-footer">
        ${buttons.map((btn, i) => `<button class="btn ${btn.className || ''}" data-modal-btn="${i}">${esc(btn.text)}</button>`).join('')}
      </div>` : ''}
    </div>
  `;

  // Event handlers
  const close = () => {
    overlay.classList.add('modal-exit');
    overlay.addEventListener('animationend', () => {
      overlay.remove();
      _modalStack = _modalStack.filter(m => m !== overlay);
      if (onClose) onClose();
    }, { once: true });
  };

  // Click overlay để đóng
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });

  // Click nút đóng
  overlay.addEventListener('click', (e) => {
    if (e.target.closest('[data-modal-close]')) close();
  });

  // Click buttons
  overlay.addEventListener('click', (e) => {
    const btnEl = e.target.closest('[data-modal-btn]');
    if (btnEl) {
      const idx = parseInt(btnEl.dataset.modalBtn, 10);
      if (buttons[idx]?.action) {
        const result = buttons[idx].action(overlay);
        // Nếu action trả về false, không đóng modal
        if (result !== false) close();
      } else {
        close();
      }
    }
  });

  // ESC to close
  const escHandler = (e) => {
    if (e.key === 'Escape' && _modalStack[_modalStack.length - 1] === overlay) {
      close();
      document.removeEventListener('keydown', escHandler);
    }
  };
  document.addEventListener('keydown', escHandler);

  root.appendChild(overlay);
  _modalStack.push(overlay);

  // Focus trap: focus vào phần tử đầu tiên có thể focus
  const focusable = overlay.querySelectorAll('input, select, textarea, button:not([data-modal-close])');
  if (focusable.length > 0) {
    setTimeout(() => focusable[0].focus(), 50);
  }

  return overlay;
}

/**
 * Modal xác nhận (Yes/No).
 * @param {string} title
 * @param {string} message - Thông báo (plain text)
 * @returns {Promise<boolean>}
 */
export function confirmModal(title, message) {
  return new Promise(resolve => {
    showModal({
      title,
      content: `<p>${esc(message)}</p>`,
      buttons: [
        { text: 'Hủy', className: 'btn-ghost', action: () => { resolve(false); } },
        { text: 'Xác nhận', className: 'btn-danger', action: () => { resolve(true); } }
      ],
      onClose: () => resolve(false)
    });
  });
}

/**
 * Modal nhập text đơn giản.
 * @param {string} title
 * @param {string} label
 * @param {string} [defaultValue='']
 * @returns {Promise<string|null>} Giá trị nhập hoặc null nếu hủy
 */
export function promptModal(title, label, defaultValue = '') {
  return new Promise(resolve => {
    showModal({
      title,
      content: `
        <div class="form-group">
          <label class="form-label">${esc(label)}</label>
          <input type="text" class="form-input" id="modal-prompt-input" value="${esc(defaultValue)}" maxlength="200">
        </div>
      `,
      buttons: [
        { text: 'Hủy', className: 'btn-ghost', action: () => { resolve(null); } },
        {
          text: 'OK', className: 'btn-primary',
          action: (modal) => {
            const input = modal.querySelector('#modal-prompt-input');
            resolve(input?.value?.trim() || '');
          }
        }
      ],
      onClose: () => resolve(null)
    });
  });
}

/**
 * Đóng tất cả modal.
 */
export function closeAllModals() {
  for (const modal of [..._modalStack]) {
    modal.remove();
  }
  _modalStack = [];
}
