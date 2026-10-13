/**
 * store.js – Lớp quản lý dữ liệu (localStorage).
 * Thiết kế theo mô hình tập trung: toàn bộ state đều đi qua Store.
 * Bảo mật: Dữ liệu được validate khi đọc, mật khẩu được băm trước khi lưu.
 */

import { generateId, hashPassword, verifyPassword } from './utils.js';

/* ===== Cấu hình ===== */

const STORAGE_KEY = 'shophayday_data_v2';
const SESSION_KEY = 'shophayday_session_v2';

/** Quy tắc bán hàng */
export const RULES = Object.freeze({
  DISCOUNT_QTY: 1000,   // Mua trên 1000 cái → giảm giá
  DISCOUNT_PCT: 10,      // Giảm 10%
  MIN_ITEM: 10,          // Tối thiểu mỗi món
  MIN_ORDER: 100,        // Tối thiểu mỗi đơn
  STEP_QTY: 10,          // Bội số số lượng
  CATS: ['Tiền tệ', 'Công cụ', 'Nguyên liệu', 'Sản phẩm']
});

/* ===== Dữ liệu mẫu ban đầu ===== */

function createSeedData() {
  return {
    version: 2,
    settings: {
      momo: '0835203303',
      momoName: '',
      notes: 'Vui lòng kiểm tra tin nhắn Zalo/Facebook và mục Chat với shop khi cửa hàng liên hệ với bạn.\nNhập đúng số Zalo hoặc link Facebook, ghi rõ tên nông trại hoặc ID Hay Day ở ô ghi chú để shop giao đúng người.\nTheo dõi tình trạng đơn tại Ví & đơn hàng: Đang xử lý, sau đó chuyển sang Thành công khi shop giao xong.',
      milestones: [20000, 50000, 100000],
      milestoneBy: 'topup',
      wheel: [
        { id: 'w1', productId: 'p3', name: 'Rìu', emoji: '🪓', pct: 34, qty: 50 },
        { id: 'w2', productId: 'p4', name: 'Cưa', emoji: '🪚', pct: 33, qty: 50 },
        { id: 'w3', productId: 'p_shovel', name: 'Xẻng', emoji: '⛏️', pct: 33, qty: 50 }
      ]
    },
    users: [],
    products: [
      { id: 'p1', emoji: '🪙', img: '', name: 'Gói 10.000 xu', cat: 'Tiền tệ', price: 25000, stock: 50, desc: 'Xu trong game, giao ngay sau khi xác nhận.', sort: 1 },
      { id: 'p2', emoji: '💎', img: '', name: 'Gói 50 kim cương', cat: 'Tiền tệ', price: 60000, stock: 30, desc: 'Dùng mở rộng đất, mua máy móc, tăng tốc.', sort: 2 },
      { id: 'p3', emoji: '🪓', img: '', name: 'Rìu', cat: 'Công cụ', price: 3000, stock: 200, desc: 'Chặt cây, mở khu đất mới.', sort: 3 },
      { id: 'p4', emoji: '🪚', img: '', name: 'Cưa', cat: 'Công cụ', price: 3000, stock: 200, desc: 'Cưa gỗ ở các khu đất cần dọn.', sort: 4 },
      { id: 'p5', emoji: '🧨', img: '', name: 'Thuốc nổ', cat: 'Công cụ', price: 4000, stock: 150, desc: 'Phá đá trong hầm mỏ.', sort: 5 },
      { id: 'p6', emoji: '💣', img: '', name: 'TNT', cat: 'Công cụ', price: 5000, stock: 120, desc: 'Phá đá lớn, khai thác nhanh hơn.', sort: 6 },
      { id: 'p7', emoji: '🔨', img: '', name: 'Búa', cat: 'Công cụ', price: 3500, stock: 100, desc: 'Dùng để mở rộng khu mỏ.', sort: 7 },
      { id: 'p8', emoji: '📜', img: '', name: 'Giấy chứng nhận đất', cat: 'Công cụ', price: 6000, stock: 80, desc: 'Mở rộng thêm đất canh tác.', sort: 8 },
      { id: 'p9', emoji: '🪵', img: '', name: 'Ván gỗ', cat: 'Nguyên liệu', price: 2000, stock: 300, desc: 'Nâng cấp kho, nhà máy.', sort: 9 },
      { id: 'p10', emoji: '🌾', img: '', name: 'Lúa mì (100)', cat: 'Nguyên liệu', price: 8000, stock: 60, desc: 'Gói 100 lúa mì cho máy làm bánh.', sort: 10 },
      { id: 'p11', emoji: '🌽', img: '', name: 'Ngô (100)', cat: 'Nguyên liệu', price: 8000, stock: 60, desc: 'Gói 100 ngô cho thức ăn gia súc.', sort: 11 },
      { id: 'p12', emoji: '🍞', img: '', name: 'Bánh mì (20)', cat: 'Sản phẩm', price: 12000, stock: 40, desc: 'Gói 20 ổ bánh mì cho đơn hàng xe tải.', sort: 12 },
      { id: 'p13', emoji: '🥛', img: '', name: 'Sữa (20)', cat: 'Sản phẩm', price: 12000, stock: 40, desc: 'Gói 20 chai sữa từ bò.', sort: 13 },
      { id: 'p14', emoji: '🥚', img: '', name: 'Trứng (30)', cat: 'Sản phẩm', price: 10000, stock: 0, desc: 'Gói 30 trứng gà. Đang hết hàng.', sort: 14 },
      { id: 'p_shovel', emoji: '⛏️', img: '', name: 'Xẻng', cat: 'Công cụ', price: 3000, stock: 200, desc: 'Dọn đất, mở rộng khu canh tác.', sort: 15 }
    ],
    orders: [],
    topups: [],
    messages: [],
    spinHistory: []
  };
}

/* ===== Store Class ===== */

class Store {
  constructor() {
    /** @type {Object} Dữ liệu ứng dụng */
    this._data = null;
    /** @type {string|null} ID người dùng đang đăng nhập */
    this._sessionUserId = null;
    /** @type {Set<Function>} Danh sách callback khi state thay đổi */
    this._listeners = new Set();
  }

  /* ----- Khởi tạo ----- */

  /**
   * Khởi tạo store: đọc dữ liệu từ localStorage hoặc tạo mới.
   * Tự động tạo tài khoản admin mặc định nếu chưa có.
   */
  async init() {
    this._load();
    this._sessionUserId = this._storageGet(SESSION_KEY);

    // Kiểm tra session hợp lệ
    if (this._sessionUserId && !this.getUserById(this._sessionUserId)) {
      this._sessionUserId = null;
      this._storageDel(SESSION_KEY);
    }

    // Tạo admin mặc định nếu chưa có
    if (!this._data.users.some(u => u.role === 'admin')) {
      const hash = await hashPassword('admin123');
      this._data.users.push({
        id: generateId('u'),
        username: 'admin',
        passHash: hash,
        role: 'admin',
        balance: 0,
        locked: false,
        inventory: {},
        spins: 0,
        spinsUsed: 0,
        milestoneClaims: [],
        contactChannel: null,
        contactValue: null,
        createdAt: Date.now()
      });
      this._save();
    }
  }

  /* ----- Lưu trữ an toàn ----- */

  _storageGet(key) {
    try { return localStorage.getItem(key); }
    catch { return null; }
  }

  _storageSet(key, value) {
    try { localStorage.setItem(key, value); }
    catch { /* Quota exceeded hoặc bị block */ }
  }

  _storageDel(key) {
    try { localStorage.removeItem(key); }
    catch { /* Ignored */ }
  }

  _load() {
    try {
      const raw = this._storageGet(STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : null;
      if (parsed && parsed.version === 2 && Array.isArray(parsed.users)) {
        this._data = parsed;
        return;
      }
    } catch { /* Dữ liệu hỏng, tạo mới */ }
    this._data = createSeedData();
    this._save();
  }

  _save() {
    this._storageSet(STORAGE_KEY, JSON.stringify(this._data));
  }

  /** Lưu và thông báo cho tất cả listeners */
  _commit() {
    this._save();
    this._notify();
  }

  /* ----- Observer Pattern ----- */

  /**
   * Đăng ký callback khi state thay đổi.
   * @param {Function} fn
   * @returns {Function} Hàm hủy đăng ký
   */
  subscribe(fn) {
    this._listeners.add(fn);
    return () => this._listeners.delete(fn);
  }

  _notify() {
    for (const fn of this._listeners) {
      try { fn(); } catch (e) { console.error('Store listener error:', e); }
    }
  }

  /* ----- Getters ----- */

  get data() { return this._data; }
  get settings() { return this._data.settings; }
  get products() { return this._data.products; }
  get orders() { return this._data.orders; }
  get topups() { return this._data.topups; }
  get messages() { return this._data.messages; }
  get rules() { return RULES; }

  /** Người dùng hiện tại (null nếu chưa đăng nhập) */
  get currentUser() {
    if (!this._sessionUserId) return null;
    const u = this.getUserById(this._sessionUserId);
    if (!u || u.locked) {
      this._sessionUserId = null;
      this._storageDel(SESSION_KEY);
      return null;
    }
    return u;
  }

  get isLoggedIn() { return !!this.currentUser; }
  get isAdmin() { return this.currentUser?.role === 'admin'; }

  getUserById(id) {
    return this._data.users.find(u => u.id === id) || null;
  }

  getUserByUsername(username) {
    return this._data.users.find(
      u => u.username.toLowerCase() === username.toLowerCase()
    ) || null;
  }

  getProductById(id) {
    return this._data.products.find(p => p.id === id) || null;
  }

  getOrderById(id) {
    return this._data.orders.find(o => o.id === id) || null;
  }

  /**
   * Lấy tin nhắn của cuộc chat (user ID).
   * @param {string} userId
   * @returns {Array}
   */
  getMessages(userId) {
    return this._data.messages.filter(m => m.chatId === userId);
  }

  /**
   * Đếm tin nhắn chưa đọc.
   * @param {'user'|'admin'} viewAs - Xem với tư cách
   * @param {string} [chatId] - ID cuộc chat (cho admin)
   * @returns {number}
   */
  getUnreadCount(viewAs, chatId) {
    return this._data.messages.filter(m => {
      if (chatId && m.chatId !== chatId) return false;
      return m.sender !== viewAs && !m.isRead;
    }).length;
  }

  /**
   * Tính tổng giá trị milestone cho user.
   * @param {string} userId
   * @returns {number}
   */
  getMilestoneValue(userId) {
    const by = this._data.settings.milestoneBy;
    if (by === 'spent') {
      return this._data.orders
        .filter(o => o.userId === userId && o.status !== 'cancelled')
        .reduce((sum, o) => sum + o.total, 0);
    }
    return this._data.topups
      .filter(t => t.userId === userId && t.status === 'approved')
      .reduce((sum, t) => sum + t.amount, 0);
  }

  /* ----- Auth Actions ----- */

  /**
   * Đăng ký tài khoản mới.
   * @param {string} username
   * @param {string} password
   * @returns {Promise<{ok: boolean, error?: string}>}
   */
  async register(username, password) {
    if (!/^[A-Za-z0-9_]{3,20}$/.test(username)) {
      return { ok: false, error: 'Tên đăng nhập phải 3–20 ký tự, chỉ gồm chữ không dấu, số và dấu gạch dưới.' };
    }
    if (password.length < 6) {
      return { ok: false, error: 'Mật khẩu cần ít nhất 6 ký tự.' };
    }
    if (this.getUserByUsername(username)) {
      return { ok: false, error: 'Tên đăng nhập này đã có người dùng. Hãy chọn tên khác.' };
    }

    const hash = await hashPassword(password);
    const user = {
      id: generateId('u'),
      username,
      passHash: hash,
      role: 'user',
      balance: 0,
      locked: false,
      inventory: {},
      spins: 0,
      spinsUsed: 0,
      milestoneClaims: [],
      contactChannel: null,
      contactValue: null,
      createdAt: Date.now()
    };
    this._data.users.push(user);
    this._setSession(user.id);
    this._commit();
    return { ok: true };
  }

  /**
   * Đăng nhập.
   * @param {string} username
   * @param {string} password
   * @returns {Promise<{ok: boolean, error?: string}>}
   */
  async login(username, password) {
    const user = this.getUserByUsername(username);
    if (!user) {
      return { ok: false, error: 'Sai tên đăng nhập hoặc mật khẩu.' };
    }
    const valid = await verifyPassword(password, user.passHash);
    if (!valid) {
      return { ok: false, error: 'Sai tên đăng nhập hoặc mật khẩu.' };
    }
    if (user.locked) {
      return { ok: false, error: 'Tài khoản này đã bị khóa. Liên hệ quản trị viên.' };
    }
    this._setSession(user.id);
    this._commit();
    return { ok: true };
  }

  /** Đăng xuất */
  logout() {
    this._sessionUserId = null;
    this._storageDel(SESSION_KEY);
    this._notify();
  }

  _setSession(userId) {
    this._sessionUserId = userId;
    this._storageSet(SESSION_KEY, userId);
  }

  /* ----- Shop Actions ----- */

  /**
   * Đặt hàng.
   * @param {Object} params
   * @param {Object<string, number>} params.items - {productId: quantity}
   * @param {string} params.channel - 'Zalo' hoặc 'Facebook'
   * @param {string} params.contact - Số điện thoại hoặc link Facebook
   * @param {string} params.note - Ghi chú
   * @returns {{ok: boolean, error?: string, spins?: number}}
   */
  placeOrder({ items, channel, contact, note }) {
    const user = this.currentUser;
    if (!user) return { ok: false, error: 'Bạn cần đăng nhập.' };

    // Validate liên hệ
    const cleanContact = channel === 'Zalo' ? contact.replace(/[\s.\-]/g, '') : contact.trim();
    if (channel === 'Zalo' && !/^(0|\+84)\d{9,10}$/.test(cleanContact)) {
      return { ok: false, error: 'Số Zalo chưa đúng. Nhập số điện thoại, ví dụ 0912345678.' };
    }
    if (channel === 'Facebook' && (cleanContact.length > 200 || !/^https?:\/\/((www|m|web|mbasic)\.)?(facebook\.com|fb\.com|fb\.me|m\.me)\/\S+$/i.test(cleanContact))) {
      return { ok: false, error: 'Link Facebook chưa đúng. Dán link trang cá nhân, ví dụ https://facebook.com/ten-ban.' };
    }

    // Validate items và tính tiền
    const lines = [];
    let totalQty = 0, subtotal = 0;
    const R = RULES;

    for (const [pid, qty] of Object.entries(items)) {
      const product = this.getProductById(pid);
      if (!product) return { ok: false, error: 'Có vật phẩm không còn bán. Hãy xóa nó khỏi giỏ hàng.' };
      if (!Number.isInteger(qty) || qty < R.MIN_ITEM) {
        return { ok: false, error: `${product.name}: mua tối thiểu ${R.MIN_ITEM} cái.` };
      }
      if (qty % R.STEP_QTY !== 0) {
        return { ok: false, error: `${product.name}: số lượng phải là bội số của ${R.STEP_QTY} (10, 20, 30…).` };
      }
      if (qty > product.stock) {
        return { ok: false, error: `${product.name}: kho chỉ còn ${product.stock} món.` };
      }
      lines.push({ product, qty });
      totalQty += qty;
      subtotal += qty * product.price;
    }

    if (totalQty < R.MIN_ORDER) {
      return { ok: false, error: `Mỗi đơn cần tối thiểu ${R.MIN_ORDER} cái. Bạn mới chọn ${totalQty}, cần thêm ${R.MIN_ORDER - totalQty} cái.` };
    }

    const discount = totalQty > R.DISCOUNT_QTY ? Math.round(subtotal * R.DISCOUNT_PCT / 100) : 0;
    const total = subtotal - discount;

    if (total > user.balance) {
      return { ok: false, error: `Số dư chưa đủ. Bạn cần thêm ${new Intl.NumberFormat('vi-VN').format(total - user.balance)}đ. Hãy nạp tiền vào ví.` };
    }

    // Thực hiện đặt hàng
    const orderId = generateId('o');
    user.balance -= total;
    user.contactChannel = channel;
    user.contactValue = cleanContact;

    // Trừ tồn kho, thêm vào kho khách
    const orderItems = [];
    for (const { product, qty } of lines) {
      product.stock -= qty;
      // Thêm vào inventory
      if (user.inventory[product.id]) {
        user.inventory[product.id].qty += qty;
        user.inventory[product.id].name = product.name;
        user.inventory[product.id].emoji = product.emoji;
      } else {
        user.inventory[product.id] = { name: product.name, emoji: product.emoji, qty };
      }
      orderItems.push({ productId: product.id, name: product.name, qty, price: product.price });
    }

    this._data.orders.push({
      id: orderId,
      userId: user.id,
      username: user.username,
      items: orderItems,
      subtotal,
      discount,
      total,
      contact: { channel, value: cleanContact, note: note.trim().slice(0, 200) },
      status: 'processing',
      cancelBy: null,
      cancelReason: null,
      cancelAt: null,
      createdAt: Date.now()
    });

    // Tin nhắn tự động
    const itemsText = lines.map(l => `${l.product.name} ×${l.qty}`).join(', ');
    this._addMessage(user.id, 'user',
      `🛒 Đơn mới: ${itemsText}\nTổng ${totalQty} cái, ${new Intl.NumberFormat('vi-VN').format(total)}đ` +
      (discount > 0 ? ` (đã giảm ${R.DISCOUNT_PCT}%: -${new Intl.NumberFormat('vi-VN').format(discount)}đ)` : '') +
      `\nNhận hàng qua ${channel}: ${cleanContact}` +
      (note ? `\nGhi chú: ${note}` : '')
    );

    // Kiểm tra milestone
    const spins = this._grantMilestones(user.id);

    this._commit();
    return { ok: true, spins };
  }

  /**
   * Hủy đơn hàng.
   * @param {string} orderId
   * @param {string} reason
   * @param {boolean} asAdmin
   * @returns {{ok: boolean, error?: string}}
   */
  cancelOrder(orderId, reason = '', asAdmin = false) {
    const order = this.getOrderById(orderId);
    if (!order) return { ok: false, error: 'Không tìm thấy đơn hàng.' };

    const user = this.currentUser;
    const by = asAdmin && user?.role === 'admin' ? 'admin' : 'user';

    if (by === 'user' && order.userId !== user?.id) {
      return { ok: false, error: 'Bạn không thể hủy đơn của người khác.' };
    }
    if (order.status === 'done' || order.status === 'cancelled') {
      return { ok: false, error: 'Đơn này đã hoàn tất hoặc đã hủy, không thể hủy nữa.' };
    }

    // Hoàn tiền
    const buyer = this.getUserById(order.userId);
    if (buyer) {
      buyer.balance += order.total;
      // Thu hồi vật phẩm
      for (const item of order.items) {
        if (buyer.inventory[item.productId]) {
          buyer.inventory[item.productId].qty -= item.qty;
          if (buyer.inventory[item.productId].qty <= 0) {
            delete buyer.inventory[item.productId];
          }
        }
      }
    }

    // Trả lại tồn kho
    for (const item of order.items) {
      const p = this.getProductById(item.productId);
      if (p) p.stock += item.qty;
    }

    order.status = 'cancelled';
    order.cancelBy = by;
    order.cancelReason = reason.slice(0, 160);
    order.cancelAt = Date.now();

    // Tin nhắn
    const itemsText = order.items.map(i => `${i.name} ×${i.qty}`).join(', ');
    if (buyer) {
      if (by === 'admin') {
        this._addMessage(order.userId, 'admin',
          `❌ Shop đã hủy đơn của bạn (${itemsText})` +
          (reason ? `. Lý do: ${reason}` : '') +
          `. Số tiền ${new Intl.NumberFormat('vi-VN').format(order.total)}đ đã hoàn vào ví.`
        );
      } else {
        this._addMessage(order.userId, 'user',
          `❌ Mình đã hủy đơn (${itemsText}, ${new Intl.NumberFormat('vi-VN').format(order.total)}đ)` +
          (reason ? `. Lý do: ${reason}` : '') + '.'
        );
      }
    }

    this._commit();
    return { ok: true };
  }

  /**
   * Chuyển trạng thái đơn hàng (admin).
   * @param {string} orderId
   * @returns {{ok: boolean, error?: string, newStatus?: string}}
   */
  toggleOrderStatus(orderId) {
    const order = this.getOrderById(orderId);
    if (!order || order.status === 'cancelled') {
      return { ok: false, error: 'Đơn này đã hủy hoặc không tồn tại.' };
    }

    const newStatus = order.status === 'done' ? 'processing' : 'done';
    order.status = newStatus;

    const buyer = this.getUserById(order.userId);
    if (buyer) {
      const itemsText = order.items.map(i => `${i.name} ×${i.qty}`).join(', ');
      this._addMessage(order.userId, 'admin',
        newStatus === 'done'
          ? `✅ Đơn của bạn (${itemsText}) đã giao thành công. Cảm ơn bạn đã mua hàng!`
          : `⏳ Đơn của bạn (${itemsText}) đang được xử lý lại.`
      );
    }

    this._commit();
    return { ok: true, newStatus };
  }

  /* ----- Topup Actions ----- */

  /**
   * Tạo mã nạp tiền ngẫu nhiên.
   * @returns {string}
   */
  generateTopupCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code;
    do {
      code = Array.from(crypto.getRandomValues(new Uint8Array(6)))
        .map(b => chars[b % chars.length])
        .join('');
    } while (this._data.topups.some(t => t.code === code));
    return code;
  }

  /**
   * Gửi yêu cầu nạp tiền.
   * @param {number} amount
   * @param {string} code
   * @returns {{ok: boolean, error?: string}}
   */
  requestTopup(amount, code) {
    const user = this.currentUser;
    if (!user) return { ok: false, error: 'Bạn cần đăng nhập.' };
    if (!Number.isInteger(amount) || amount < 1000) {
      return { ok: false, error: 'Số tiền tối thiểu là 1.000đ.' };
    }
    if (this._data.topups.some(t => t.code === code)) {
      return { ok: false, error: 'Mã nạp này đã dùng, hãy mở lại cửa sổ nạp tiền.' };
    }

    this._data.topups.push({
      id: generateId('t'),
      userId: user.id,
      username: user.username,
      amount,
      code,
      note: `${user.username} ${code}`,
      method: 'MoMo',
      status: 'pending',
      createdAt: Date.now()
    });

    this._commit();
    return { ok: true };
  }

  /**
   * Duyệt nạp tiền (admin).
   * @param {string} topupId
   * @returns {{ok: boolean, error?: string, spins?: number}}
   */
  approveTopup(topupId) {
    const topup = this._data.topups.find(t => t.id === topupId);
    if (!topup || topup.status !== 'pending') {
      return { ok: false, error: 'Yêu cầu này đã được xử lý.' };
    }

    topup.status = 'approved';
    const user = this.getUserById(topup.userId);
    if (user) {
      user.balance += topup.amount;
      const spins = this._grantMilestones(user.id);
      if (spins > 0) {
        this._addMessage(user.id, 'admin',
          `🎁 Chúc mừng! Bạn đạt mốc thưởng và nhận thêm ${spins} lượt quay. Vào mục Vòng quay để quay nhé.`
        );
      }
      this._commit();
      return { ok: true, spins };
    }

    this._commit();
    return { ok: true, spins: 0 };
  }

  /**
   * Từ chối nạp tiền (admin).
   * @param {string} topupId
   * @returns {{ok: boolean, error?: string}}
   */
  rejectTopup(topupId) {
    const topup = this._data.topups.find(t => t.id === topupId);
    if (!topup || topup.status !== 'pending') {
      return { ok: false, error: 'Yêu cầu này đã được xử lý.' };
    }
    topup.status = 'rejected';
    this._commit();
    return { ok: true };
  }

  /* ----- Spin Wheel Actions ----- */

  /**
   * Quay vòng quay may mắn.
   * @returns {{ok: boolean, error?: string, prizeIndex?: number, prize?: Object}}
   */
  spin() {
    const user = this.currentUser;
    if (!user) return { ok: false, error: 'Bạn cần đăng nhập.' };
    if (user.spins < 1) return { ok: false, error: 'Bạn chưa có lượt quay.' };

    const prizes = this._data.settings.wheel;
    if (!prizes || prizes.length < 2) {
      return { ok: false, error: 'Vòng quay chưa có phần thưởng.' };
    }

    // Chọn ngẫu nhiên theo tỉ lệ
    const totalPct = prizes.reduce((s, p) => s + p.pct, 0);
    let rand = (crypto.getRandomValues(new Uint32Array(1))[0] / 0xFFFFFFFF) * totalPct;
    let winIndex = prizes.length - 1;
    for (let i = 0; i < prizes.length; i++) {
      if (rand < prizes[i].pct) { winIndex = i; break; }
      rand -= prizes[i].pct;
    }

    const prize = prizes[winIndex];
    const product = this.getProductById(prize.productId);
    const name = product?.name || prize.name;
    const emoji = product?.emoji || prize.emoji;

    user.spins--;
    user.spinsUsed++;

    // Thêm vào kho
    if (user.inventory[prize.productId]) {
      user.inventory[prize.productId].qty += prize.qty;
      user.inventory[prize.productId].name = name;
      user.inventory[prize.productId].emoji = emoji;
    } else {
      user.inventory[prize.productId] = { name, emoji, qty: prize.qty };
    }

    // Lưu lịch sử quay (giữ tối đa 30 lần)
    this._data.spinHistory.push({
      userId: user.id,
      productId: prize.productId,
      name, emoji,
      qty: prize.qty,
      createdAt: Date.now()
    });
    // Giới hạn 30 bản ghi / user
    const userSpins = this._data.spinHistory.filter(s => s.userId === user.id);
    if (userSpins.length > 30) {
      const oldest = userSpins[0];
      this._data.spinHistory.splice(this._data.spinHistory.indexOf(oldest), 1);
    }

    this._commit();
    return { ok: true, prizeIndex: winIndex, prize: { name, emoji, qty: prize.qty } };
  }

  /* ----- Chat Actions ----- */

  /**
   * Gửi tin nhắn.
   * @param {string} text
   * @param {string} [targetChatId] - ID cuộc chat (admin gửi cho khách)
   * @returns {{ok: boolean, error?: string}}
   */
  sendMessage(text, targetChatId = null) {
    const user = this.currentUser;
    if (!user) return { ok: false, error: 'Bạn cần đăng nhập.' };

    const msg = text.trim().slice(0, 500);
    if (!msg) return { ok: false, error: 'Tin nhắn trống.' };

    if (user.role === 'admin' && targetChatId) {
      const target = this.getUserById(targetChatId);
      if (!target || target.role === 'admin') {
        return { ok: false, error: 'Không tìm thấy khách hàng này.' };
      }
      this._addMessage(targetChatId, 'admin', msg);
    } else {
      this._addMessage(user.id, 'user', msg);
    }

    this._commit();
    return { ok: true };
  }

  /**
   * Đánh dấu tin nhắn đã đọc.
   * @param {'user'|'admin'} viewAs
   * @param {string} chatId
   */
  markRead(viewAs, chatId) {
    let changed = false;
    for (const m of this._data.messages) {
      if (m.chatId === chatId && m.sender !== viewAs && !m.isRead) {
        m.isRead = true;
        changed = true;
      }
    }
    if (changed) this._commit();
  }

  /* ----- Admin: Product Management ----- */

  /**
   * Lưu vật phẩm (thêm mới hoặc cập nhật).
   * @param {Object} productData
   * @returns {{ok: boolean, error?: string}}
   */
  saveProduct(productData) {
    const { id, name, emoji, img, cat, price, stock, desc } = productData;
    if (!name?.trim()) return { ok: false, error: 'Hãy nhập tên vật phẩm.' };
    if (!Number.isInteger(price) || price < 1) return { ok: false, error: 'Giá tối thiểu là 1đ.' };
    if (!Number.isInteger(stock) || stock < 0) return { ok: false, error: 'Tồn kho không hợp lệ.' };
    if (!RULES.CATS.includes(cat)) return { ok: false, error: 'Loại vật phẩm không hợp lệ.' };

    if (id) {
      // Cập nhật
      const product = this.getProductById(id);
      if (!product) return { ok: false, error: 'Không tìm thấy vật phẩm.' };
      Object.assign(product, { name: name.trim(), emoji: emoji || '📦', img: img || '', cat, price, stock, desc: (desc || '').slice(0, 160) });
    } else {
      // Thêm mới
      const maxSort = Math.max(0, ...this._data.products.map(p => p.sort || 0));
      this._data.products.push({
        id: generateId('p'),
        name: name.trim(),
        emoji: emoji || '📦',
        img: img || '',
        cat,
        price,
        stock,
        desc: (desc || '').slice(0, 160),
        sort: maxSort + 1
      });
    }

    this._commit();
    return { ok: true };
  }

  /**
   * Xóa vật phẩm.
   * @param {string} productId
   * @returns {{ok: boolean, error?: string}}
   */
  deleteProduct(productId) {
    const idx = this._data.products.findIndex(p => p.id === productId);
    if (idx < 0) return { ok: false, error: 'Không tìm thấy vật phẩm.' };
    this._data.products.splice(idx, 1);
    this._commit();
    return { ok: true };
  }

  /* ----- Admin: User Management ----- */

  /**
   * Thêm tài khoản mới (admin).
   * @param {Object} userData
   * @returns {Promise<{ok: boolean, error?: string}>}
   */
  async addUser(userData) {
    const { username, password, balance = 0, role = 'user' } = userData;
    if (!/^[A-Za-z0-9_]{3,20}$/.test(username)) {
      return { ok: false, error: 'Tên đăng nhập phải 3–20 ký tự, chỉ gồm chữ không dấu, số và dấu gạch dưới.' };
    }
    if (password.length < 6) return { ok: false, error: 'Mật khẩu cần ít nhất 6 ký tự.' };
    if (this.getUserByUsername(username)) {
      return { ok: false, error: 'Tên đăng nhập này đã tồn tại.' };
    }

    const hash = await hashPassword(password);
    this._data.users.push({
      id: generateId('u'),
      username,
      passHash: hash,
      role: role === 'admin' ? 'admin' : 'user',
      balance: Math.max(0, balance),
      locked: false,
      inventory: {},
      spins: 0,
      spinsUsed: 0,
      milestoneClaims: [],
      contactChannel: null,
      contactValue: null,
      createdAt: Date.now()
    });

    this._commit();
    return { ok: true };
  }

  /**
   * Sửa thông tin tài khoản (admin).
   * @param {Object} userData
   * @returns {Promise<{ok: boolean, error?: string}>}
   */
  async editUser(userData) {
    const { id, balance, role, locked, newPassword, addSpins = 0, inventory } = userData;
    const user = this.getUserById(id);
    if (!user) return { ok: false, error: 'Không tìm thấy tài khoản.' };

    if (balance !== undefined) user.balance = Math.max(0, balance);
    if (role !== undefined && id !== this.currentUser?.id) {
      user.role = role === 'admin' ? 'admin' : 'user';
    }
    if (locked !== undefined && id !== this.currentUser?.id) {
      user.locked = !!locked;
    }
    if (addSpins > 0 && addSpins <= 1000) {
      user.spins += addSpins;
    }
    if (newPassword && newPassword.length >= 6) {
      user.passHash = await hashPassword(newPassword);
    }
    if (inventory && typeof inventory === 'object') {
      for (const [pid, qty] of Object.entries(inventory)) {
        if (qty <= 0) {
          delete user.inventory[pid];
        } else {
          if (user.inventory[pid]) user.inventory[pid].qty = qty;
        }
      }
    }

    this._commit();
    return { ok: true };
  }

  /**
   * Xóa tài khoản (admin).
   * @param {string} userId
   * @returns {{ok: boolean, error?: string}}
   */
  deleteUser(userId) {
    if (userId === this.currentUser?.id) {
      return { ok: false, error: 'Không thể xóa tài khoản đang đăng nhập.' };
    }
    const idx = this._data.users.findIndex(u => u.id === userId);
    if (idx < 0) return { ok: false, error: 'Không tìm thấy tài khoản.' };
    this._data.users.splice(idx, 1);
    // Xóa các dữ liệu liên quan
    this._data.messages = this._data.messages.filter(m => m.chatId !== userId);
    this._data.spinHistory = this._data.spinHistory.filter(s => s.userId !== userId);
    this._commit();
    return { ok: true };
  }

  /* ----- Admin: Settings ----- */

  /**
   * Cập nhật cài đặt MoMo.
   * @param {string} momo - Số MoMo
   * @param {string} momoName - Tên chủ tài khoản
   * @returns {{ok: boolean, error?: string}}
   */
  updateMomo(momo, momoName) {
    if (!/^0\d{9}$/.test(momo)) {
      return { ok: false, error: 'Số MoMo cần 10 chữ số, bắt đầu bằng 0.' };
    }
    this._data.settings.momo = momo;
    this._data.settings.momoName = momoName.slice(0, 80);
    this._commit();
    return { ok: true };
  }

  /**
   * Cập nhật lưu ý khi mua.
   * @param {string} notes
   * @returns {{ok: boolean, error?: string}}
   */
  updateNotes(notes) {
    if (!notes.trim()) return { ok: false, error: 'Cần có ít nhất một lưu ý.' };
    this._data.settings.notes = notes.slice(0, 1500);
    this._commit();
    return { ok: true };
  }

  /**
   * Cập nhật vòng quay (admin).
   * @param {Array} prizes
   * @returns {{ok: boolean, error?: string}}
   */
  updateWheel(prizes) {
    if (!Array.isArray(prizes) || prizes.length < 2) {
      return { ok: false, error: 'Vòng quay cần ít nhất 2 phần thưởng.' };
    }
    if (prizes.length > 12) {
      return { ok: false, error: 'Vòng quay tối đa 12 phần thưởng.' };
    }
    this._data.settings.wheel = prizes;
    this._commit();
    return { ok: true };
  }

  /**
   * Cập nhật mốc milestone.
   * @param {number[]} milestones
   * @param {'topup'|'spent'} milestoneBy
   * @returns {{ok: boolean, error?: string, granted?: number}}
   */
  updateMilestones(milestones, milestoneBy) {
    if (!Array.isArray(milestones) || milestones.length === 0) {
      return { ok: false, error: 'Cần ít nhất 1 mốc.' };
    }
    if (milestones.length > 20) return { ok: false, error: 'Tối đa 20 mốc.' };
    const sorted = [...new Set(milestones)].sort((a, b) => a - b);
    this._data.settings.milestones = sorted;
    this._data.settings.milestoneBy = milestoneBy === 'spent' ? 'spent' : 'topup';

    let granted = 0;
    for (const user of this._data.users) {
      granted += this._grantMilestones(user.id);
    }

    this._commit();
    return { ok: true, granted };
  }

  /**
   * Khôi phục dữ liệu mẫu (admin).
   */
  resetData() {
    const newData = createSeedData();
    this._data = newData;
    this._sessionUserId = null;
    this._storageDel(SESSION_KEY);
    this._commit();
  }

  /* ----- Private Helpers ----- */

  _addMessage(chatId, sender, text) {
    this._data.messages.push({
      id: generateId('m'),
      chatId,
      sender,
      text,
      isRead: false,
      createdAt: Date.now()
    });
  }

  /**
   * Tặng lượt quay cho mốc đạt được. Trả về số lượt đã tặng.
   * @param {string} userId
   * @returns {number}
   */
  _grantMilestones(userId) {
    const user = this.getUserById(userId);
    if (!user) return 0;

    const value = this.getMilestoneValue(userId);
    const milestones = this._data.settings.milestones || [];
    if (!user.milestoneClaims) user.milestoneClaims = [];

    let granted = 0;
    for (const m of milestones) {
      if (value >= m && !user.milestoneClaims.includes(m)) {
        user.milestoneClaims.push(m);
        granted++;
      }
    }
    if (granted > 0) {
      user.spins += granted;
    }
    return granted;
  }
}

/* ===== Export singleton ===== */
export const store = new Store();
