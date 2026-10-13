/**
 * views/chat.js – Trang Chat với shop (cho khách hàng).
 */

import { store } from '../store.js';
import { esc, formatDate } from '../utils.js';

/**
 * Render trang chat (phía khách hàng).
 * @returns {string} HTML
 */
export function renderChat() {
  const user = store.currentUser;
  if (!user) return '<div class="container"><p>Bạn cần đăng nhập.</p></div>';

  const messages = store.getMessages(user.id).sort((a, b) => a.createdAt - b.createdAt);

  // Đánh dấu đã đọc khi vào trang
  store.markRead('user', user.id);

  return `
    <section class="hero">
      <div class="hero-content">
        <h1>💬 Chat với shop</h1>
        <p>Gửi tin nhắn để liên hệ với quản trị viên.</p>
      </div>
    </section>

    <div class="container">
      <section class="panel chat-panel">
        <div class="chat-log" id="chat-log">
          ${messages.length > 0 ? messages.map(m => `
            <div class="chat-bubble chat-${m.sender === 'user' ? 'right' : 'left'}">
              <div class="chat-sender">${m.sender === 'user' ? 'Bạn' : '🛒 Shop'}</div>
              <div class="chat-text">${esc(m.text).replace(/\n/g, '<br>')}</div>
              <div class="chat-time">${formatDate(m.createdAt)}</div>
            </div>
          `).join('') : `
            <div class="empty-state empty-sm">
              <p>Chưa có tin nhắn nào. Gửi tin nhắn để bắt đầu trò chuyện.</p>
            </div>
          `}
        </div>
        <div class="chat-input-area">
          <textarea id="chat-input" class="form-input" placeholder="Nhập tin nhắn…" maxlength="500" rows="2"></textarea>
          <button class="btn btn-primary" data-action="send-message">Gửi</button>
        </div>
      </section>
    </div>
  `;
}
