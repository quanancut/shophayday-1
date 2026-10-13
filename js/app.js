/* ============================================================================
   Kho Làng Hay Day – Complete SPA Application (All-in-One)
   ============================================================================ */
(function() {
'use strict';

/* ===== Tiện ích ===== */
var $ = function(s, p) { return (p || document).querySelector(s); };
var $$ = function(s, p) { return (p || document).querySelectorAll(s); };
var esc = function(s) {
  var str = String(s == null ? '' : s);
  var map = {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'};
  return str.replace(/[&<>"']/g, function(c) { return map[c]; });
};
var fmt = function(n) { return new Intl.NumberFormat('vi-VN').format(Math.round(n)) + 'đ'; };
var fdate = function(t) {
  return new Date(t).toLocaleString('vi-VN', {day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'});
};
var uid = function(prefix) {
  var r = new Uint8Array(6); crypto.getRandomValues(r);
  return prefix + '_' + Array.from(r).map(function(b){return b.toString(16).padStart(2,'0')}).join('');
};

/* ===== Toast ===== */
function toast(msg, type, dur) {
  type = type || 'info'; dur = dur || 3000;
  var c = document.getElementById('toast-root');
  if (!c) return;
  var icons = {success:'✅',error:'❌',warning:'⚠️',info:'ℹ️'};
  var el = document.createElement('div');
  el.className = 'toast toast-' + type;
  el.innerHTML = '<span class="toast-icon">' + (icons[type]||icons.info) + '</span><span class="toast-message">' + esc(msg) + '</span>';
  c.appendChild(el);
  setTimeout(function() { el.style.opacity = '0'; setTimeout(function() { el.remove(); }, 300); }, dur);
}

/* ===== Hash mật khẩu (client-side) ===== */
function hashPw(pw) {
  try {
    var data = new TextEncoder().encode('hdshop$' + pw);
    return crypto.subtle.digest('SHA-256', data).then(function(buf) {
      return Array.from(new Uint8Array(buf)).map(function(b){return b.toString(16).padStart(2,'0')}).join('');
    });
  } catch(e) { return Promise.resolve('b64:' + btoa(pw)); }
}

/* ===== Cấu hình ===== */
var STORAGE_KEY = 'shophayday_v3';
var SESSION_KEY = 'shophayday_sess_v3';
var RULES = {DISCOUNT_QTY:1000, DISCOUNT_PCT:10, MIN_ITEM:10, MIN_ORDER:100, STEP_QTY:10,
             CATS:['Tiền tệ','Công cụ','Nguyên liệu','Sản phẩm']};

/* ===== Seed data ===== */
function makeSeed() {
  return {
    v:3, settings: {momo:'0835203303', momoName:'', notes:'Vui lòng kiểm tra tin nhắn Zalo/Facebook và mục Chat với shop khi cửa hàng liên hệ với bạn.\nNhập đúng số Zalo hoặc link Facebook, ghi rõ tên nông trại hoặc ID Hay Day ở ô ghi chú để shop giao đúng người.\nTheo dõi tình trạng đơn tại Ví & đơn hàng.', milestones:[20000,50000,100000], milestoneBy:'topup',
    wheel:[{id:'w1',pid:'p3',name:'Rìu',emoji:'🪓',pct:34,qty:50},{id:'w2',pid:'p4',name:'Cưa',emoji:'🪚',pct:33,qty:50},{id:'w3',pid:'ps',name:'Xẻng',emoji:'⛏️',pct:33,qty:50}]},
    users:[], products:[
      {id:'p1',emoji:'🪙',name:'Gói 10.000 xu',cat:'Tiền tệ',price:25000,stock:50,desc:'Xu trong game, giao ngay.'},
      {id:'p2',emoji:'💎',name:'Gói 50 kim cương',cat:'Tiền tệ',price:60000,stock:30,desc:'Mở rộng đất, mua máy móc.'},
      {id:'p3',emoji:'🪓',name:'Rìu',cat:'Công cụ',price:3000,stock:200,desc:'Chặt cây, mở khu đất mới.'},
      {id:'p4',emoji:'🪚',name:'Cưa',cat:'Công cụ',price:3000,stock:200,desc:'Cưa gỗ ở khu đất cần dọn.'},
      {id:'p5',emoji:'🧨',name:'Thuốc nổ',cat:'Công cụ',price:4000,stock:150,desc:'Phá đá trong hầm mỏ.'},
      {id:'p6',emoji:'💣',name:'TNT',cat:'Công cụ',price:5000,stock:120,desc:'Phá đá lớn, khai thác nhanh.'},
      {id:'p7',emoji:'🔨',name:'Búa',cat:'Công cụ',price:3500,stock:100,desc:'Mở rộng khu mỏ.'},
      {id:'p8',emoji:'📜',name:'Giấy chứng nhận đất',cat:'Công cụ',price:6000,stock:80,desc:'Mở rộng đất canh tác.'},
      {id:'p9',emoji:'🪵',name:'Ván gỗ',cat:'Nguyên liệu',price:2000,stock:300,desc:'Nâng cấp kho, nhà máy.'},
      {id:'p10',emoji:'🌾',name:'Lúa mì (100)',cat:'Nguyên liệu',price:8000,stock:60,desc:'Gói 100 lúa mì.'},
      {id:'p11',emoji:'🌽',name:'Ngô (100)',cat:'Nguyên liệu',price:8000,stock:60,desc:'Gói 100 ngô.'},
      {id:'p12',emoji:'🍞',name:'Bánh mì (20)',cat:'Sản phẩm',price:12000,stock:40,desc:'Gói 20 ổ bánh mì.'},
      {id:'p13',emoji:'🥛',name:'Sữa (20)',cat:'Sản phẩm',price:12000,stock:40,desc:'Gói 20 chai sữa.'},
      {id:'p14',emoji:'🥚',name:'Trứng (30)',cat:'Sản phẩm',price:10000,stock:0,desc:'Đang hết hàng.'},
      {id:'ps',emoji:'⛏️',name:'Xẻng',cat:'Công cụ',price:3000,stock:200,desc:'Dọn đất, mở rộng canh tác.'}
    ], orders:[], topups:[], messages:[], spinHistory:[]
  };
}

/* ===== Store ===== */
var db, sess;
var cart = {};
var ui = {view:'shop', cat:'Tất cả', q:'', sort:'default', adminTab:'products', chatUid:null};

function sGet(k) { try { return localStorage.getItem(k); } catch(e) { return null; } }
function sSet(k,v) { try { localStorage.setItem(k,v); } catch(e) {} }
function sDel(k) { try { localStorage.removeItem(k); } catch(e) {} }
function load() {
  try { var d = JSON.parse(sGet(STORAGE_KEY)); if (d && d.v===3) { db=d; return; } } catch(e) {}
  db = makeSeed(); save();
}
function save() { sSet(STORAGE_KEY, JSON.stringify(db)); }

function me() {
  if (!sess) return null;
  var u = db.users.find(function(x){return x.id===sess});
  if (!u || u.locked) { sess=null; sDel(SESSION_KEY); return null; }
  return u;
}
function isAdmin() { var u=me(); return u && u.role==='admin'; }
function findProduct(id) { return db.products.find(function(p){return p.id===id}); }
function findOrder(id) { return db.orders.find(function(o){return o.id===id}); }

function login(uid2) { sess = uid2; sSet(SESSION_KEY, uid2); }
function logout() { sess = null; sDel(SESSION_KEY); }

/* ===== Init ===== */
function init() {
  load();
  sess = sGet(SESSION_KEY);
  if (sess && !me()) { sess=null; sDel(SESSION_KEY); }
  // Tạo admin mặc định
  if (!db.users.some(function(u){return u.role==='admin'})) {
    hashPw('admin123').then(function(h) {
      db.users.push({id:uid('u'),username:'admin',passHash:h,role:'admin',balance:0,locked:false,inv:{},spins:0,spinsUsed:0,milestones:[],contact:null,contactVal:null,createdAt:Date.now()});
      save(); render();
    });
  }
  render();
}

/* ===== RENDER ===== */
function render() {
  var u = me();
  if (['inv','wallet','chat','spin'].indexOf(ui.view)>=0 && !u) ui.view='shop';
  if (ui.view==='chat' && u && u.role==='admin') { ui.view='admin'; ui.adminTab='chat'; }
  if (ui.view==='admin' && !isAdmin()) ui.view='shop';
  renderHeader();
  var app = $('#app');
  if (!app) return;
  var views = {shop:vShop,inv:vInv,wallet:vWallet,spin:vSpin,chat:vChat,admin:vAdmin};
  app.innerHTML = (views[ui.view]||vShop)();
  var cl = $('#chat-log'); if (cl) cl.scrollTop = cl.scrollHeight;
}

function renderHeader() {
  var h = $('#header'); if (!h) return;
  var u = me();
  var cc = Object.values(cart).reduce(function(s,q){return s+q},0);
  var navs = [{k:'shop',l:'🏪 Cửa hàng'}];
  if (u) {
    navs.push({k:'inv',l:'📦 Kho của tôi'},{k:'spin',l:'🎰 Vòng quay'+(u.spins>0?' ('+u.spins+')':'')},{k:'wallet',l:'💰 Ví & đơn hàng'});
    if (u.role!=='admin') { var ur=unread('user',u.id); navs.push({k:'chat',l:'💬 Chat'+(ur>0?' ('+ur+')':'')}); }
    if (u.role==='admin') { var ar=unread('admin'); var pt=db.topups.filter(function(t){return t.status==='pending'}).length; var b=ar+pt; navs.push({k:'admin',l:'⚙️ Quản trị'+(b>0?' ('+b+')':'')}); }
  }
  h.innerHTML = '<div class="container" style="display:flex;align-items:center;justify-content:space-between;height:100%;gap:1rem;flex-wrap:wrap">'
    + '<div class="brand" style="cursor:pointer" data-act="nav" data-id="shop"><span class="brand-icon">🌾</span><span class="brand-text">Kho Làng <span class="brand-highlight">Hay Day</span></span></div>'
    + '<nav class="nav-links">' + navs.map(function(n){return '<a class="nav-link'+(ui.view===n.k?' active':'')+'" href="#" data-act="nav" data-id="'+n.k+'">'+n.l+'</a>'}).join('') + '</nav>'
    + '<div class="header-actions">'
    + '<button class="cart-trigger" data-act="cart" title="Giỏ hàng">🛒'+(cc>0?'<span class="cart-badge">'+cc+'</span>':'')+'</button>'
    + (u ? '<span class="user-info"><span class="user-coins">🪙 '+fmt(u.balance)+'</span><span class="user-name">'+esc(u.username)+'</span></span><button class="btn btn-ghost btn-sm" data-act="logout">Đăng xuất</button>'
         : '<button class="btn btn-ghost btn-sm" data-act="loginModal">Đăng nhập</button><button class="btn btn-primary btn-sm" data-act="regModal">Tạo tài khoản</button>')
    + '</div></div>';
}

/* ===== Views ===== */
function vShop() {
  var list = db.products.filter(function(p){return (ui.cat==='Tất cả'||p.cat===ui.cat)&&p.name.toLowerCase().indexOf(ui.q.toLowerCase())>=0});
  if (ui.sort==='asc') list.sort(function(a,b){return a.price-b.price});
  else if (ui.sort==='desc') list.sort(function(a,b){return b.price-a.price});
  var u = me(), R = RULES;
  var mlTxt = (db.settings.milestones||[]).map(fmt).join(', ');
  return '<section class="hero"><div class="hero-content"><h1 class="hero-title">🌾 Vật phẩm Hay Day, giá rõ ràng</h1>'
    + '<p class="hero-subtitle">Mua theo bội số '+R.STEP_QTY+', tối thiểu '+R.MIN_ITEM+' mỗi món, mỗi đơn từ '+R.MIN_ORDER+' cái.</p>'
    + (u?'':'<button class="btn btn-primary" data-act="regModal">Tạo tài khoản để mua</button>')
    + '</div></section><div class="container">'
    + '<div class="notes-box"><div class="notes-box-title">📋 Lưu ý khi mua</div>' + (db.settings.notes||'').split('\n').map(function(l){return '<p>'+esc(l)+'</p>'}).join('') + '</div>'
    + '<div class="promo"><span class="promo-icon">🎉</span><div class="promo-content"><div class="promo-title">Giảm giá</div><div class="promo-text">Mua trên '+R.DISCOUNT_QTY.toLocaleString('vi-VN')+' cái/đơn: giảm '+R.DISCOUNT_PCT+'%</div></div></div>'
    + '<div class="promo"><span class="promo-icon">🎁</span><div class="promo-content"><div class="promo-title">Mốc thưởng</div><div class="promo-text">Đạt mốc '+mlTxt+': nhận lượt quay may mắn</div></div></div>'
    + '<div style="display:flex;gap:.75rem;margin:1.5rem 0;flex-wrap:wrap;align-items:center">'
    + '<div class="search-bar" style="flex:1;min-width:200px"><input class="search-input" type="search" id="q" placeholder="🔍 Tìm vật phẩm…" value="'+esc(ui.q)+'"></div>'
    + '<select class="form-control" id="sort" style="padding:.55rem .75rem;border-radius:var(--radius-xs);background:var(--color-surface-2);color:var(--color-text);border:1px solid var(--color-border)">'
    + '<option value="default"'+(ui.sort==='default'?' selected':'')+'>Mặc định</option>'
    + '<option value="asc"'+(ui.sort==='asc'?' selected':'')+'>Giá thấp → cao</option>'
    + '<option value="desc"'+(ui.sort==='desc'?' selected':'')+'>Giá cao → thấp</option></select></div>'
    + '<div class="filter-bar">' + ['Tất cả'].concat(R.CATS).map(function(c){return '<button class="chip'+(ui.cat===c?' active':'')+'" data-act="cat" data-id="'+esc(c)+'">'+esc(c)+'</button>'}).join('') + '</div>'
    + (list.length ? '<div class="grid grid-4">' + list.map(cardHtml).join('') + '</div>' : '<div class="empty"><div class="empty-icon">🔍</div><div class="empty-title">Không tìm thấy</div><div class="empty-desc">Thử bỏ bộ lọc hoặc đổi từ khóa.</div></div>')
    + '</div>';
}

function cardHtml(p) {
  var R = RULES, inCart = cart[p.id]||0;
  var dis = p.stock < R.MIN_ITEM;
  return '<div class="card"><div class="card-media"><span class="card-top-tag">'+esc(p.cat)+'</span><div class="card-emoji">'+esc(p.emoji)+'</div></div>'
    + '<div class="card-body"><h3 class="card-title">'+esc(p.name)+'</h3><p class="card-desc">'+esc(p.desc)+'</p>'
    + '<div class="card-meta"><span class="card-price">'+fmt(p.price)+'</span>'
    + '<span class="card-stock"><span class="stock-dot'+(p.stock<=0?' out':p.stock<=5?' low':'')+'"></span>'+(p.stock>0?'Còn '+p.stock:'Hết hàng')+'</span></div></div>'
    + '<div class="card-footer"><button class="btn btn-primary btn-full'+(dis?' btn-disabled':'')+'" data-act="buy" data-id="'+esc(p.id)+'"'+(dis?' disabled':'')+'>'
    + (p.stock<1?'Hết hàng':p.stock<R.MIN_ITEM?'Không đủ số lượng':inCart>0?'Trong giỏ: '+inCart:'Thêm vào giỏ')+'</button></div></div>';
}

function vInv() {
  var u = me(); if (!u) return '';
  var items = Object.entries(u.inv).filter(function(e){return e[1].qty>0});
  var total = items.reduce(function(s,e){return s+e[1].qty},0);
  return '<section class="hero"><div class="hero-content"><h1 class="hero-title">📦 Kho của tôi</h1><p class="hero-subtitle">Vật phẩm bạn đã mua.</p></div></section>'
    + '<div class="container"><div class="stats">'
    + statCard(items.length,'Loại vật phẩm') + statCard(fmt(u.balance),'Số dư ví') + statCard(total,'Tổng số lượng')
    + '</div>'
    + (items.length ? '<div class="inv-grid">' + items.map(function(e){var id=e[0],v=e[1]; return '<div class="inv-card"><span class="inv-card-badge">×'+v.qty+'</span><div class="inv-card-icon">'+esc(v.emoji)+'</div><div class="inv-card-title">'+esc(v.name)+'</div></div>'}).join('') + '</div>'
    : '<div class="empty"><div class="empty-icon">📦</div><div class="empty-title">Kho đang trống</div><div class="empty-desc">Ghé cửa hàng để mua vật phẩm.</div><br><button class="btn btn-primary" data-act="nav" data-id="shop">Đến cửa hàng</button></div>')
    + '</div>';
}

function vWallet() {
  var u = me(); if (!u) return '';
  var tops = db.topups.filter(function(t){return t.userId===u.id}).sort(function(a,b){return b.createdAt-a.createdAt});
  var ords = db.orders.filter(function(o){return o.userId===u.id}).sort(function(a,b){return b.createdAt-a.createdAt});
  var tst = {pending:['Chờ duyệt','badge-warning'],approved:['Đã cộng','badge-success'],rejected:['Từ chối','badge-danger']};
  var ost = {processing:['Đang xử lý','badge-processing'],done:['Thành công','badge-success'],cancelled:['Đã hủy','badge-danger']};
  return '<section class="hero"><div class="hero-content"><h1 class="hero-title">💰 Ví & đơn hàng</h1><p class="hero-subtitle">Nạp tiền vào ví để mua vật phẩm.</p></div>'
    + '<button class="btn btn-primary" data-act="topupModal">Nạp tiền vào ví</button></section>'
    + '<div class="container"><div class="stats">' + statCard(fmt(u.balance),'Số dư') + statCard(ords.filter(function(o){return o.status!=='cancelled'}).length,'Đơn đã mua') + '</div>'
    + '<h2 style="margin:2rem 0 1rem">Yêu cầu nạp tiền</h2>'
    + (tops.length ? '<div class="table-responsive"><table class="table table-striped"><thead><tr><th>Thời gian</th><th>Số tiền</th><th>Nội dung CK</th><th>Trạng thái</th></tr></thead><tbody>'
      + tops.map(function(t){var s=tst[t.status]||['—','']; return '<tr><td>'+fdate(t.createdAt)+'</td><td>'+fmt(t.amount)+'</td><td>'+esc(t.note||'—')+'</td><td><span class="badge '+s[1]+'">'+s[0]+'</span></td></tr>'}).join('')
      + '</tbody></table></div>' : '<div class="empty"><div class="empty-desc">Chưa có yêu cầu nạp tiền.</div></div>')
    + '<h2 style="margin:2rem 0 1rem">Lịch sử mua hàng</h2>'
    + (ords.length ? '<div class="table-responsive"><table class="table table-striped"><thead><tr><th>Thời gian</th><th>Vật phẩm</th><th>Tổng</th><th>Liên hệ</th><th>Trạng thái</th><th></th></tr></thead><tbody>'
      + ords.map(function(o){var s=ost[o.status]||['—',''];var its=o.items.map(function(i){return esc(i.name)+' ×'+i.qty}).join(', ');
        var ct=o.contact?esc(o.contact.channel)+': '+esc(o.contact.value):'—';
        return '<tr><td>'+fdate(o.createdAt)+'</td><td>'+its+'</td><td>'+fmt(o.total)+'</td><td>'+ct+'</td><td><span class="badge '+s[1]+'">'+s[0]+'</span>'
          +(o.status==='cancelled'&&o.cancelReason?'<br><small style="color:var(--color-text-muted)">'+esc(o.cancelReason)+'</small>':'')+'</td>'
          +'<td>'+(o.status==='processing'?'<button class="btn btn-danger btn-sm" data-act="cancelOrder" data-id="'+esc(o.id)+'">Hủy</button>':'')+'</td></tr>'}).join('')
      + '</tbody></table></div>' : '<div class="empty"><div class="empty-desc">Chưa có đơn hàng.</div></div>')
    + '</div>';
}

function vSpin() {
  var u = me(); if (!u) return '';
  var prizes = db.settings.wheel||[];
  var tot = prizes.reduce(function(s,p){return s+p.pct},0);
  var hist = (db.spinHistory||[]).filter(function(s){return s.userId===u.id}).sort(function(a,b){return b.createdAt-a.createdAt}).slice(0,20);
  return '<section class="hero"><div class="hero-content"><h1 class="hero-title">🎰 Vòng quay may mắn</h1><p class="hero-subtitle">Quay để nhận vật phẩm miễn phí!</p></div></section>'
    + '<div class="container"><div class="stats">' + statCard(u.spins,'Lượt quay còn lại') + statCard(u.spinsUsed,'Đã quay') + '</div>'
    + '<div style="text-align:center;margin:2rem 0"><button class="btn btn-primary btn-lg" data-act="spin"'+(u.spins<1?' disabled':'')+'>'+(u.spins>0?'🎰 Quay ngay ('+u.spins+' lượt)':'🚫 Hết lượt quay')+'</button></div>'
    + '<h3 style="margin:1.5rem 0 1rem">Phần thưởng</h3>'
    + '<div class="table-responsive"><table class="table"><thead><tr><th>Vật phẩm</th><th>Số lượng</th><th>Tỉ lệ</th></tr></thead><tbody>'
    + prizes.map(function(p){return '<tr><td>'+esc(p.emoji)+' '+esc(p.name)+'</td><td>×'+p.qty+'</td><td>'+(tot>0?(p.pct/tot*100).toFixed(1):0)+'%</td></tr>'}).join('')
    + '</tbody></table></div>'
    + (hist.length ? '<h3 style="margin:2rem 0 1rem">Lịch sử quay</h3><div class="table-responsive"><table class="table"><thead><tr><th>Thời gian</th><th>Phần thưởng</th><th>Số lượng</th></tr></thead><tbody>'
      + hist.map(function(h){return '<tr><td>'+fdate(h.createdAt)+'</td><td>'+esc(h.emoji)+' '+esc(h.name)+'</td><td>×'+h.qty+'</td></tr>'}).join('')
      + '</tbody></table></div>':'')
    + '</div>';
}

function vChat() {
  var u = me(); if (!u) return '';
  var msgs = db.messages.filter(function(m){return m.chatId===u.id}).sort(function(a,b){return a.createdAt-b.createdAt});
  markRead('user', u.id);
  return '<section class="hero"><div class="hero-content"><h1 class="hero-title">💬 Chat với shop</h1></div></section>'
    + '<div class="container"><div class="chat-widget"><div class="chat-messages" id="chat-log">'
    + (msgs.length ? msgs.map(function(m){return '<div class="chat-msg '+(m.sender==='user'?'user':'admin')+'"><div class="bubble">'+esc(m.text).replace(/\n/g,'<br>')+'</div><div class="chat-time">'+(m.sender==='user'?'Bạn':'🛒 Shop')+' · '+fdate(m.createdAt)+'</div></div>'}).join('')
      : '<div class="empty"><div class="empty-desc">Chưa có tin nhắn. Gửi để bắt đầu.</div></div>')
    + '</div><div class="chat-input-area"><input class="chat-input" id="chatInput" placeholder="Nhập tin nhắn…" maxlength="500"><button class="btn btn-primary" data-act="sendChat">Gửi</button></div></div></div>';
}

function vAdmin() {
  if (!isAdmin()) return '';
  var tab = ui.adminTab||'products';
  var pt = db.topups.filter(function(t){return t.status==='pending'}).length;
  var ur = unread('admin');
  var rev = db.orders.filter(function(o){return o.status!=='cancelled'}).reduce(function(s,o){return s+o.total},0);
  var tabs = [['products','Vật phẩm'],['users','Tài khoản'],['topups','Nạp tiền'+(pt>0?' ('+pt+')':'')],['orders','Đơn hàng'],['chat','Chat'+(ur>0?' ('+ur+')':'')],['settings','Cài đặt']];
  var body = {products:adminProducts,users:adminUsers,topups:adminTopups,orders:adminOrders,chat:adminChat,settings:adminSettings};
  return '<section class="hero"><div class="hero-content"><h1 class="hero-title">⚙️ Quản trị</h1><p class="hero-subtitle">Doanh thu: '+fmt(rev)+' · '+db.users.length+' tài khoản · '+db.orders.length+' đơn</p></div></section>'
    + '<div class="container"><div class="tabs">' + tabs.map(function(t){return '<button class="tab-btn'+(tab===t[0]?' active':'')+'" data-act="adminTab" data-id="'+t[0]+'">'+t[1]+'</button>'}).join('') + '</div>'
    + '<div style="margin-top:1.5rem">' + (body[tab]||adminProducts)() + '</div></div>';
}

function adminProducts() {
  return '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem"><h2>Vật phẩm</h2><button class="btn btn-primary btn-sm" data-act="prodForm">+ Thêm</button></div>'
    + '<div class="table-responsive"><table class="table table-striped"><thead><tr><th></th><th>Tên</th><th>Loại</th><th>Giá</th><th>Kho</th><th>Thao tác</th></tr></thead><tbody>'
    + db.products.map(function(p){return '<tr><td style="font-size:1.5rem">'+esc(p.emoji)+'</td><td>'+esc(p.name)+'</td><td>'+esc(p.cat)+'</td><td>'+fmt(p.price)+'</td><td>'+(p.stock<1?'<span class="badge badge-danger">Hết</span>':p.stock)+'</td>'
      +'<td><button class="btn btn-ghost btn-sm" data-act="editProd" data-id="'+esc(p.id)+'">Sửa</button> <button class="btn btn-danger btn-sm" data-act="delProd" data-id="'+esc(p.id)+'">Xóa</button></td></tr>'}).join('')
    + '</tbody></table></div>';
}

function adminUsers() {
  return '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem"><h2>Tài khoản</h2><button class="btn btn-primary btn-sm" data-act="userForm">+ Tạo</button></div>'
    + '<div class="table-responsive"><table class="table table-striped"><thead><tr><th>Tên ĐN</th><th>Vai trò</th><th>Số dư</th><th>Kho</th><th>Quay</th><th>Ngày tạo</th><th></th></tr></thead><tbody>'
    + db.users.map(function(u){var ic=Object.values(u.inv||{}).reduce(function(s,v){return s+v.qty},0);
      return '<tr'+(u.locked?' style="opacity:.5"':'')+'><td>'+esc(u.username)+(u.locked?' <span class="badge badge-danger">Khóa</span>':'')+'</td><td><span class="badge '+(u.role==='admin'?'badge-info':'')+'">'+u.role+'</span></td><td>'+fmt(u.balance)+'</td><td>'+ic+'</td><td>'+u.spins+'/'+u.spinsUsed+'</td><td>'+fdate(u.createdAt)+'</td>'
        +'<td><button class="btn btn-ghost btn-sm" data-act="editUser" data-id="'+esc(u.id)+'">Sửa</button>'+(u.id!==sess?' <button class="btn btn-danger btn-sm" data-act="delUser" data-id="'+esc(u.id)+'">Xóa</button>':'')+'</td></tr>'}).join('')
    + '</tbody></table></div>';
}

function adminTopups() {
  var tops = db.topups.sort(function(a,b){return b.createdAt-a.createdAt});
  var st = {pending:['Chờ','badge-warning'],approved:['Duyệt','badge-success'],rejected:['Từ chối','badge-danger']};
  return '<h2>Nạp tiền</h2>' + (tops.length?'<div class="table-responsive"><table class="table table-striped"><thead><tr><th>Thời gian</th><th>Khách</th><th>Số tiền</th><th>Mã</th><th>Trạng thái</th><th></th></tr></thead><tbody>'
    + tops.map(function(t){var s=st[t.status]||['—','']; return '<tr><td>'+fdate(t.createdAt)+'</td><td>'+esc(t.username)+'</td><td>'+fmt(t.amount)+'</td><td><code>'+esc(t.code)+'</code></td><td><span class="badge '+s[1]+'">'+s[0]+'</span></td>'
      +'<td>'+(t.status==='pending'?'<button class="btn btn-success btn-sm" data-act="appTopup" data-id="'+esc(t.id)+'">Duyệt</button> <button class="btn btn-danger btn-sm" data-act="rejTopup" data-id="'+esc(t.id)+'">Từ chối</button>':'')+'</td></tr>'}).join('')
    + '</tbody></table></div>':'<div class="empty"><div class="empty-desc">Chưa có.</div></div>');
}

function adminOrders() {
  var ords = db.orders.sort(function(a,b){return b.createdAt-a.createdAt});
  var st = {processing:['Đang xử lý','badge-processing'],done:['Xong','badge-success'],cancelled:['Hủy','badge-danger']};
  return '<h2>Đơn hàng</h2>' + (ords.length?'<div class="table-responsive"><table class="table table-striped"><thead><tr><th>Thời gian</th><th>Khách</th><th>Vật phẩm</th><th>Tổng</th><th>Liên hệ</th><th>TT</th><th></th></tr></thead><tbody>'
    + ords.map(function(o){var s=st[o.status]||['—','']; var its=o.items.map(function(i){return esc(i.name)+' ×'+i.qty}).join(', ');
      var ct=o.contact?esc(o.contact.channel)+': '+esc(o.contact.value):'—';
      return '<tr><td>'+fdate(o.createdAt)+'</td><td>'+esc(o.username)+'</td><td style="max-width:200px">'+its+'</td><td>'+fmt(o.total)+'</td><td style="max-width:150px">'+ct+'</td><td><span class="badge '+s[1]+'">'+s[0]+'</span></td>'
        +'<td>'+(o.status!=='cancelled'?'<button class="btn btn-sm '+(o.status==='done'?'btn-ghost':'btn-success')+'" data-act="toggleOrder" data-id="'+esc(o.id)+'">'+(o.status==='done'?'Mở lại':'✅ Xong')+'</button>'
          +(o.status==='processing'?' <button class="btn btn-danger btn-sm" data-act="admCancel" data-id="'+esc(o.id)+'">Hủy</button>':''):'')+'</td></tr>'}).join('')
    + '</tbody></table></div>':'<div class="empty"><div class="empty-desc">Chưa có đơn.</div></div>');
}

function adminChat() {
  var users = db.users.filter(function(u){return u.role!=='admin'});
  var cid = ui.chatUid || (users.length?users[0].id:null);
  if (cid) markRead('admin', cid);
  var msgs = cid ? db.messages.filter(function(m){return m.chatId===cid}).sort(function(a,b){return a.createdAt-b.createdAt}) : [];
  return '<h2>Chat khách hàng</h2><div style="display:flex;gap:1rem;min-height:400px">'
    + '<div style="width:200px;flex-shrink:0;border-right:1px solid var(--color-border);padding-right:1rem">'
    + users.map(function(u){var ur2=unread('admin',u.id); return '<button class="chip'+(cid===u.id?' active':'')+'" data-act="selectChat" data-id="'+esc(u.id)+'" style="width:100%;margin-bottom:.5rem">'+esc(u.username)+(ur2>0?' <span class="badge badge-danger" style="font-size:.7rem">'+ur2+'</span>':'')+'</button>'}).join('')
    + (users.length?'':'<p style="color:var(--color-text-muted);font-size:.875rem">Chưa có khách.</p>')
    + '</div><div style="flex:1">'
    + (cid ? '<div class="chat-widget" style="height:400px"><div class="chat-messages" id="chat-log">'
      + (msgs.length?msgs.map(function(m){return '<div class="chat-msg '+(m.sender==='admin'?'user':'admin')+'"><div class="bubble">'+esc(m.text).replace(/\n/g,'<br>')+'</div><div class="chat-time">'+(m.sender==='admin'?'Bạn (Admin)':'👤 Khách')+' · '+fdate(m.createdAt)+'</div></div>'}).join('')
        :'<div class="empty"><div class="empty-desc">Chưa có tin nhắn.</div></div>')
      + '</div><div class="chat-input-area"><input class="chat-input" id="admChatInput" placeholder="Nhập tin nhắn…" maxlength="500"><button class="btn btn-primary" data-act="admSendChat" data-id="'+esc(cid)+'">Gửi</button></div></div>'
      :'<div class="empty"><div class="empty-desc">Chọn một khách hàng.</div></div>')
    + '</div></div>';
}

function adminSettings() {
  return '<h2>Cài đặt</h2>'
    + '<div style="margin:1.5rem 0"><h3>Số MoMo nhận tiền</h3><div style="display:flex;gap:.75rem;margin-top:.75rem;flex-wrap:wrap">'
    + '<div class="form-group" style="flex:1;min-width:150px"><label class="form-label">Số điện thoại</label><input class="form-control" id="momoIn" value="'+esc(db.settings.momo||'')+'" maxlength="10"></div>'
    + '<div class="form-group" style="flex:1;min-width:150px"><label class="form-label">Tên chủ TK</label><input class="form-control" id="momoNameIn" value="'+esc(db.settings.momoName||'')+'" maxlength="80"></div>'
    + '<button class="btn btn-primary" data-act="saveMomo" style="align-self:flex-end">Lưu</button></div></div>'
    + '<div style="margin:1.5rem 0"><h3>Lưu ý khi mua</h3><textarea class="form-control" id="notesIn" rows="4" maxlength="1500" style="margin-top:.5rem">'+esc(db.settings.notes||'')+'</textarea>'
    + '<button class="btn btn-primary" data-act="saveNotes" style="margin-top:.5rem">Lưu lưu ý</button></div>'
    + '<div style="margin:2rem 0;padding:1.5rem;border:1px solid var(--color-danger-border);border-radius:var(--radius);background:var(--color-danger-bg)"><h3 style="color:var(--color-danger)">⚠️ Vùng nguy hiểm</h3>'
    + '<p style="color:var(--color-text-muted);margin:.5rem 0">Khôi phục dữ liệu mẫu sẽ xóa toàn bộ.</p>'
    + '<button class="btn btn-danger" data-act="resetData">Khôi phục dữ liệu mẫu</button></div>';
}

function statCard(val,label) {
  return '<div class="stat-card"><div class="stat-value">'+val+'</div><div class="stat-label">'+label+'</div></div>';
}

/* ===== Messages / Unread ===== */
function unread(viewAs, chatId) {
  return db.messages.filter(function(m) {
    if (chatId && m.chatId !== chatId) return false;
    return m.sender !== viewAs && !m.isRead;
  }).length;
}
function markRead(viewAs, chatId) {
  var changed = false;
  db.messages.forEach(function(m) {
    if (m.chatId===chatId && m.sender!==viewAs && !m.isRead) { m.isRead=true; changed=true; }
  });
  if (changed) save();
}
function addMsg(chatId, sender, text) {
  db.messages.push({id:uid('m'),chatId:chatId,sender:sender,text:text,isRead:false,createdAt:Date.now()});
}

/* ===== Business Logic ===== */
function grantMilestones(userId) {
  var u = db.users.find(function(x){return x.id===userId}); if (!u) return 0;
  var by = db.settings.milestoneBy;
  var val;
  if (by==='spent') val = db.orders.filter(function(o){return o.userId===userId&&o.status!=='cancelled'}).reduce(function(s,o){return s+o.total},0);
  else val = db.topups.filter(function(t){return t.userId===userId&&t.status==='approved'}).reduce(function(s,t){return s+t.amount},0);
  if (!u.milestones) u.milestones=[];
  var n = 0;
  (db.settings.milestones||[]).forEach(function(m) {
    if (val>=m && u.milestones.indexOf(m)<0) { u.milestones.push(m); n++; }
  });
  if (n>0) u.spins += n;
  return n;
}

/* ===== Modals ===== */
function modal(title, content, buttons) {
  var root = document.getElementById('modal-root'); if (!root) return;
  var ov = document.createElement('div');
  ov.className = 'modal-overlay active';
  ov.innerHTML = '<div class="modal-card"><div class="modal-header"><h3 class="modal-title">'+esc(title)+'</h3><button class="modal-close" data-mclose>&times;</button></div>'
    + '<div class="modal-body">'+content+'</div>'
    + (buttons?'<div class="modal-footer">'+buttons+'</div>':'')
    + '</div>';
  ov.addEventListener('click', function(e) {
    if (e.target===ov || e.target.closest('[data-mclose]')) ov.remove();
  });
  document.addEventListener('keydown', function handler(e) {
    if (e.key==='Escape') { ov.remove(); document.removeEventListener('keydown', handler); }
  });
  root.appendChild(ov);
  var fi = ov.querySelector('input,select,textarea');
  if (fi) setTimeout(function(){fi.focus()},50);
  return ov;
}

function loginModal() {
  modal('🔑 Đăng nhập',
    '<div class="form-group"><label class="form-label">Tên đăng nhập</label><input class="form-control" id="mLoginUn" placeholder="Tên đăng nhập"></div>'
    + '<div class="form-group"><label class="form-label">Mật khẩu</label><input class="form-control" id="mLoginPw" type="password" placeholder="Mật khẩu"></div>',
    '<button class="btn btn-ghost" data-mclose>Hủy</button><button class="btn btn-primary" data-act="doLogin">Đăng nhập</button>');
}

function regModal() {
  modal('✨ Tạo tài khoản',
    '<div class="form-group"><label class="form-label">Tên đăng nhập (3–20 ký tự, không dấu)</label><input class="form-control" id="mRegUn" placeholder="nongdan123"></div>'
    + '<div class="form-group"><label class="form-label">Mật khẩu (≥6 ký tự)</label><input class="form-control" id="mRegPw" type="password" placeholder="Mật khẩu"></div>'
    + '<div class="form-group"><label class="form-label">Nhập lại mật khẩu</label><input class="form-control" id="mRegPw2" type="password" placeholder="Nhập lại"></div>',
    '<button class="btn btn-ghost" data-mclose>Hủy</button><button class="btn btn-primary" data-act="doReg">Tạo tài khoản</button>');
}

function topupModal() {
  var u = me(); if (!u) return;
  var chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  var code = ''; for (var i=0;i<6;i++) code += chars[Math.floor(Math.random()*chars.length)];
  modal('💳 Nạp tiền vào ví',
    '<p>Chuyển khoản MoMo theo thông tin:</p>'
    + '<div style="background:var(--color-surface-2);padding:1rem;border-radius:var(--radius-sm);margin:1rem 0">'
    + '<div><b>Số MoMo:</b> <code style="color:var(--color-primary)">'+esc(db.settings.momo||'0835203303')+'</code></div>'
    + '<div><b>Tên:</b> '+esc(db.settings.momoName||'Chủ tài khoản')+'</div>'
    + '<div><b>Nội dung CK:</b> <code style="color:var(--color-primary)">'+esc(u.username)+' '+code+'</code></div></div>'
    + '<div class="form-group"><label class="form-label">Số tiền đã chuyển (tối thiểu 1.000đ)</label><input class="form-control" id="mTopAmt" type="number" min="1000" step="1000" placeholder="50000"></div>'
    + '<input type="hidden" id="mTopCode" value="'+code+'">',
    '<button class="btn btn-ghost" data-mclose>Hủy</button><button class="btn btn-success" data-act="doTopup">Tôi đã chuyển tiền</button>');
}

function cartModal() {
  var entries = Object.entries(cart).filter(function(e){return e[1]>0});
  var R = RULES, sub=0, qty=0, items=[];
  entries.forEach(function(e){var p=findProduct(e[0]); if(p){items.push({p:p,q:e[1]}); sub+=p.price*e[1]; qty+=e[1];}});
  var disc = qty>R.DISCOUNT_QTY ? Math.round(sub*R.DISCOUNT_PCT/100) : 0;
  var total = sub - disc;
  var c = items.length ? items.map(function(it){
    return '<div style="display:flex;align-items:center;justify-content:space-between;padding:.75rem 0;border-bottom:1px solid var(--color-border)">'
      + '<div><b>'+esc(it.p.emoji)+' '+esc(it.p.name)+'</b><br><small style="color:var(--color-text-muted)">'+fmt(it.p.price)+'/cái</small></div>'
      + '<div style="display:flex;align-items:center;gap:.5rem"><button class="btn btn-ghost btn-sm" data-act="cartDec" data-id="'+esc(it.p.id)+'">−</button><span>'+it.q+'</span><button class="btn btn-ghost btn-sm" data-act="cartInc" data-id="'+esc(it.p.id)+'">+</button>'
      + '<button class="btn btn-danger btn-sm" data-act="cartDel" data-id="'+esc(it.p.id)+'">✕</button></div>'
      + '<div style="min-width:80px;text-align:right"><b>'+fmt(it.p.price*it.q)+'</b></div></div>'
  }).join('')
    + '<div style="margin-top:1rem;padding-top:1rem;border-top:1px solid var(--color-border)">'
    + '<div style="display:flex;justify-content:space-between"><span>Số lượng:</span><b>'+qty+' cái</b></div>'
    + '<div style="display:flex;justify-content:space-between"><span>Tạm tính:</span><b>'+fmt(sub)+'</b></div>'
    + (disc>0?'<div style="display:flex;justify-content:space-between;color:var(--color-success)"><span>Giảm '+R.DISCOUNT_PCT+'%:</span><b>−'+fmt(disc)+'</b></div>':'')
    + '<div style="display:flex;justify-content:space-between;font-size:1.2rem;margin-top:.5rem"><span><b>Thực trả:</b></span><b style="color:var(--color-primary)">'+fmt(total)+'</b></div></div>'
    + (qty<R.MIN_ORDER?'<div style="margin-top:1rem;padding:.75rem;border-radius:var(--radius-xs);background:var(--color-warning-bg);border:1px solid var(--color-warning-border);color:var(--color-warning)">⚠️ Cần tối thiểu '+R.MIN_ORDER+' cái. Cần thêm '+(R.MIN_ORDER-qty)+' cái.</div>':'')
    : '<div class="empty"><div class="empty-desc">Giỏ hàng đang trống.</div></div>';

  var btns = items.length ? '<button class="btn btn-ghost" data-act="cartClear">Xóa hết</button><button class="btn btn-primary" data-act="checkout">Đặt hàng</button>' : '<button class="btn btn-ghost" data-mclose>Đóng</button>';
  modal('🛒 Giỏ hàng', c, btns);
}

function checkoutModal() {
  var u = me(); if (!u) return;
  var entries = Object.entries(cart).filter(function(e){return e[1]>0});
  var R = RULES, sub=0, qty=0;
  entries.forEach(function(e){var p=findProduct(e[0]); if(p){sub+=p.price*e[1]; qty+=e[1];}});
  var disc = qty>R.DISCOUNT_QTY ? Math.round(sub*R.DISCOUNT_PCT/100) : 0;
  var total = sub - disc;

  modal('📦 Xác nhận đặt hàng',
    '<p>Số dư ví: <b>'+fmt(u.balance)+'</b> · Thực trả: <b style="color:var(--color-primary)">'+fmt(total)+'</b></p>'
    + (u.balance<total?'<div style="padding:.75rem;margin:.75rem 0;border-radius:var(--radius-xs);background:var(--color-danger-bg);border:1px solid var(--color-danger-border);color:var(--color-danger)">⚠️ Thiếu '+fmt(total-u.balance)+'</div>':'')
    + '<div class="form-group"><label class="form-label">Kênh liên hệ</label><select class="form-control" id="mCh"><option value="Zalo">Zalo</option><option value="Facebook">Facebook</option></select></div>'
    + '<div class="form-group"><label class="form-label">Số Zalo hoặc link Facebook</label><input class="form-control" id="mCt" value="'+esc(u.contactVal||'')+'" placeholder="0912345678"></div>'
    + '<div class="form-group"><label class="form-label">Ghi chú (Tên nông trại / ID)</label><input class="form-control" id="mNote" placeholder="Nông trại Vui Vẻ"></div>'
    + '<label style="display:flex;gap:.5rem;align-items:center;margin-top:1rem;cursor:pointer"><input type="checkbox" id="mAgree"><span>Tôi đã đọc lưu ý khi mua.</span></label>',
    '<button class="btn btn-ghost" data-mclose>Hủy</button><button class="btn btn-success" data-act="doOrder">Thanh toán '+fmt(total)+'</button>');
}

function prodFormModal(pid) {
  var p = pid ? findProduct(pid) : null;
  modal((p?'✏️ Sửa':'➕ Thêm')+' vật phẩm',
    '<div class="form-group"><label class="form-label">Tên</label><input class="form-control" id="mPName" value="'+esc(p?p.name:'')+'" placeholder="Tên vật phẩm"></div>'
    + '<div class="form-group"><label class="form-label">Emoji</label><input class="form-control" id="mPEmoji" value="'+esc(p?p.emoji:'📦')+'" placeholder="📦"></div>'
    + '<div class="form-group"><label class="form-label">Loại</label><select class="form-control" id="mPCat">'+RULES.CATS.map(function(c){return '<option'+(p&&p.cat===c?' selected':'')+'>'+c+'</option>'}).join('')+'</select></div>'
    + '<div style="display:flex;gap:.75rem"><div class="form-group" style="flex:1"><label class="form-label">Giá</label><input class="form-control" id="mPPrice" type="number" min="1" value="'+(p?p.price:1000)+'"></div>'
    + '<div class="form-group" style="flex:1"><label class="form-label">Tồn kho</label><input class="form-control" id="mPStock" type="number" min="0" value="'+(p?p.stock:100)+'"></div></div>'
    + '<div class="form-group"><label class="form-label">Mô tả</label><input class="form-control" id="mPDesc" value="'+esc(p?p.desc:'')+'" placeholder="Mô tả"></div>'
    + (pid?'<input type="hidden" id="mPId" value="'+esc(pid)+'">':''),
    '<button class="btn btn-ghost" data-mclose>Hủy</button><button class="btn btn-primary" data-act="saveProd">Lưu</button>');
}

function userFormModal(userId) {
  var u2 = userId ? db.users.find(function(x){return x.id===userId}) : null;
  modal((u2?'✏️ Sửa':'➕ Tạo')+' tài khoản',
    (u2 ? '<p>Tên ĐN: <b>'+esc(u2.username)+'</b></p>' : '<div class="form-group"><label class="form-label">Tên đăng nhập</label><input class="form-control" id="mUName" placeholder="tendn"></div>')
    + (!u2?'<div class="form-group"><label class="form-label">Mật khẩu</label><input class="form-control" id="mUPw" type="password" placeholder="≥6 ký tự"></div>':'')
    + '<div class="form-group"><label class="form-label">Số dư</label><input class="form-control" id="mUBal" type="number" min="0" value="'+(u2?u2.balance:0)+'"></div>'
    + (u2?'<div class="form-group"><label class="form-label">Mật khẩu mới (để trống = giữ nguyên)</label><input class="form-control" id="mUNewPw" type="password"></div>':'')
    + '<div class="form-group"><label class="form-label">Cộng thêm lượt quay</label><input class="form-control" id="mUSpins" type="number" min="0" max="1000" value="0"></div>'
    + (userId?'<input type="hidden" id="mUId" value="'+esc(userId)+'">':''),
    '<button class="btn btn-ghost" data-mclose>Hủy</button><button class="btn btn-primary" data-act="saveUser">Lưu</button>');
}

/* ===== Event Delegation ===== */
document.addEventListener('click', function(e) {
  var el = e.target.closest('[data-act]');
  if (!el) return;
  e.preventDefault();
  var act = el.dataset.act;
  var id = el.dataset.id;

  switch (act) {
    case 'nav': ui.view = id; render(); break;
    case 'cat': ui.cat = id; render(); break;
    case 'buy':
      if (!me()) { toast('Hãy đăng nhập hoặc tạo tài khoản trước.','info'); loginModal(); return; }
      var bp = findProduct(id); if (!bp) return;
      if (bp.stock < RULES.MIN_ITEM) { toast('Không đủ số lượng tối thiểu.','warning'); return; }
      var cur = cart[id]||0;
      if (cur + RULES.STEP_QTY > bp.stock) { toast('Kho chỉ còn '+bp.stock+'.','warning'); return; }
      cart[id] = cur + RULES.STEP_QTY;
      toast('Đã thêm '+bp.name+' (×'+cart[id]+').','success');
      render(); break;
    case 'cart': cartModal(); break;
    case 'cartInc': var ci=findProduct(id); if(ci&&(cart[id]||0)+RULES.STEP_QTY<=ci.stock){cart[id]=(cart[id]||0)+RULES.STEP_QTY; document.querySelector('.modal-overlay').remove(); cartModal(); render();} break;
    case 'cartDec': if(cart[id]-RULES.STEP_QTY>=RULES.MIN_ITEM) cart[id]-=RULES.STEP_QTY; else delete cart[id]; document.querySelector('.modal-overlay').remove(); cartModal(); render(); break;
    case 'cartDel': delete cart[id]; document.querySelector('.modal-overlay').remove(); cartModal(); render(); break;
    case 'cartClear': cart={}; document.querySelector('.modal-overlay').remove(); render(); break;
    case 'checkout':
      if (!me()) { toast('Đăng nhập trước.','info'); return; }
      var cq2=Object.values(cart).reduce(function(s,q){return s+q},0);
      if (cq2<RULES.MIN_ORDER) { toast('Cần tối thiểu '+RULES.MIN_ORDER+' cái.','warning'); return; }
      document.querySelector('.modal-overlay').remove();
      checkoutModal(); break;
    case 'loginModal': loginModal(); break;
    case 'regModal': regModal(); break;
    case 'logout': logout(); cart={}; toast('Đã đăng xuất.','info'); render(); break;
    case 'topupModal': topupModal(); break;
    case 'doLogin':
      var lun = ($('#mLoginUn')||{}).value||'';
      var lpw = ($('#mLoginPw')||{}).value||'';
      var lu = db.users.find(function(x){return x.username.toLowerCase()===lun.toLowerCase()});
      if (!lu) { toast('Sai tên đăng nhập hoặc mật khẩu.','error'); return; }
      hashPw(lpw).then(function(h) {
        if (h!==lu.passHash) { toast('Sai tên đăng nhập hoặc mật khẩu.','error'); return; }
        if (lu.locked) { toast('Tài khoản đã bị khóa.','error'); return; }
        login(lu.id);
        var ov = document.querySelector('.modal-overlay'); if (ov) ov.remove();
        toast('Chào mừng '+lu.username+'!','success'); render();
      }); break;
    case 'doReg':
      var run = ($('#mRegUn')||{}).value||'';
      var rpw = ($('#mRegPw')||{}).value||'';
      var rpw2 = ($('#mRegPw2')||{}).value||'';
      if (!/^[A-Za-z0-9_]{3,20}$/.test(run)) { toast('Tên 3–20 ký tự, không dấu.','error'); return; }
      if (rpw.length<6) { toast('Mật khẩu cần ≥6 ký tự.','error'); return; }
      if (rpw!==rpw2) { toast('Mật khẩu chưa khớp.','warning'); return; }
      if (db.users.some(function(x){return x.username.toLowerCase()===run.toLowerCase()})) { toast('Tên đã tồn tại.','error'); return; }
      hashPw(rpw).then(function(h) {
        var nid = uid('u');
        db.users.push({id:nid,username:run,passHash:h,role:'user',balance:0,locked:false,inv:{},spins:0,spinsUsed:0,milestones:[],contact:null,contactVal:null,createdAt:Date.now()});
        save(); login(nid);
        var ov = document.querySelector('.modal-overlay'); if (ov) ov.remove();
        toast('Tạo tài khoản thành công!','success'); render();
      }); break;
    case 'doTopup':
      var tamt = parseInt(($('#mTopAmt')||{}).value,10);
      var tcode = ($('#mTopCode')||{}).value;
      if (!tamt||tamt<1000) { toast('Số tiền tối thiểu 1.000đ.','error'); return; }
      var tu = me(); if (!tu) return;
      db.topups.push({id:uid('t'),userId:tu.id,username:tu.username,amount:tamt,code:tcode,note:tu.username+' '+tcode,method:'MoMo',status:'pending',createdAt:Date.now()});
      save();
      var ov2 = document.querySelector('.modal-overlay'); if (ov2) ov2.remove();
      toast('Yêu cầu nạp tiền đã gửi!','success'); render(); break;
    case 'doOrder':
      var ou = me(); if (!ou) return;
      var ch = ($('#mCh')||{}).value;
      var ct = ($('#mCt')||{}).value.trim();
      var nt = ($('#mNote')||{}).value.trim();
      var ag = ($('#mAgree')||{}).checked;
      if (!ag) { toast('Hãy tích xác nhận.','warning'); return; }
      if (ch==='Zalo'&&!/^(0|\+84)\d{9,10}$/.test(ct.replace(/[\s.\-]/g,''))) { toast('Số Zalo chưa đúng.','error'); return; }
      if (ch==='Facebook'&&(ct.length>200||!/^https?:\/\//i.test(ct))) { toast('Link Facebook chưa đúng.','error'); return; }
      var R2 = RULES, lines=[],qty2=0,sub2=0;
      for (var pid2 in cart) {
        var p2 = findProduct(pid2); if (!p2) { toast('Vật phẩm không tồn tại.','error'); return; }
        var q2 = cart[pid2];
        if (q2<R2.MIN_ITEM) { toast(p2.name+': tối thiểu '+R2.MIN_ITEM+'.','error'); return; }
        if (q2%R2.STEP_QTY) { toast(p2.name+': bội số '+R2.STEP_QTY+'.','error'); return; }
        if (q2>p2.stock) { toast(p2.name+': kho chỉ còn '+p2.stock+'.','error'); return; }
        lines.push({p:p2,q:q2}); qty2+=q2; sub2+=q2*p2.price;
      }
      if (qty2<R2.MIN_ORDER) { toast('Cần tối thiểu '+R2.MIN_ORDER+' cái.','error'); return; }
      var disc2 = qty2>R2.DISCOUNT_QTY?Math.round(sub2*R2.DISCOUNT_PCT/100):0;
      var total2 = sub2-disc2;
      if (total2>ou.balance) { toast('Số dư không đủ. Thiếu '+fmt(total2-ou.balance)+'.','error'); return; }
      // Execute
      ou.balance -= total2; ou.contact = ch; ou.contactVal = ct;
      var oItems = [];
      lines.forEach(function(l){l.p.stock-=l.q; if(!ou.inv[l.p.id]) ou.inv[l.p.id]={name:l.p.name,emoji:l.p.emoji,qty:0}; ou.inv[l.p.id].qty+=l.q; ou.inv[l.p.id].name=l.p.name; ou.inv[l.p.id].emoji=l.p.emoji;
        oItems.push({productId:l.p.id,name:l.p.name,qty:l.q,price:l.p.price});});
      db.orders.push({id:uid('o'),userId:ou.id,username:ou.username,items:oItems,subtotal:sub2,discount:disc2,total:total2,contact:{channel:ch,value:ct,note:nt},status:'processing',cancelBy:null,cancelReason:null,cancelAt:null,createdAt:Date.now()});
      addMsg(ou.id,'user','🛒 Đơn mới: '+lines.map(function(l){return l.p.name+' ×'+l.q}).join(', ')+'\nTổng '+qty2+' cái, '+fmt(total2)+(disc2>0?' (giảm '+R2.DISCOUNT_PCT+'%: -'+fmt(disc2)+')':'')+'\n'+ch+': '+ct+(nt?'\nGhi chú: '+nt:''));
      var sp = grantMilestones(ou.id);
      save(); cart={};
      var ov3 = document.querySelector('.modal-overlay'); if (ov3) ov3.remove();
      toast('Đặt hàng thành công!','success');
      if (sp>0) toast('🎁 Nhận thêm '+sp+' lượt quay!','success');
      ui.view='wallet'; render(); break;
    case 'cancelOrder':
      if (!confirm('Hủy đơn hàng này? Tiền sẽ hoàn về ví.')) return;
      doCancelOrder(id, 'Khách tự hủy', false); break;
    case 'admCancel':
      if (!confirm('Hủy đơn này và hoàn tiền cho khách?')) return;
      doCancelOrder(id, 'Shop hủy', true); break;
    case 'sendChat':
      var ci2 = $('#chatInput'); if (!ci2||!ci2.value.trim()) return;
      addMsg(me().id, 'user', ci2.value.trim()); save(); render(); break;
    case 'admSendChat':
      var ai = $('#admChatInput'); if (!ai||!ai.value.trim()) return;
      addMsg(id, 'admin', ai.value.trim()); save(); render(); break;
    case 'selectChat': ui.chatUid = id; render(); break;
    case 'adminTab': ui.adminTab = id; render(); break;
    case 'spin': doSpin(); break;
    case 'appTopup':
      var tp = db.topups.find(function(t){return t.id===id}); if (!tp||tp.status!=='pending') return;
      tp.status='approved'; var tpu=db.users.find(function(x){return x.id===tp.userId}); if(tpu){tpu.balance+=tp.amount; var sp2=grantMilestones(tpu.id); if(sp2>0) addMsg(tpu.id,'admin','🎁 Đạt mốc! +'+sp2+' lượt quay.');}
      save(); toast('Đã duyệt.','success'); render(); break;
    case 'rejTopup':
      var tp2 = db.topups.find(function(t){return t.id===id}); if (!tp2||tp2.status!=='pending') return;
      tp2.status='rejected'; save(); toast('Đã từ chối.','info'); render(); break;
    case 'toggleOrder':
      var to = findOrder(id); if (!to||to.status==='cancelled') return;
      to.status = to.status==='done'?'processing':'done';
      var tbu = db.users.find(function(x){return x.id===to.userId}); if(tbu) addMsg(to.userId,'admin',to.status==='done'?'✅ Đơn hàng đã giao xong!':'⏳ Đơn đang xử lý lại.');
      save(); toast('Đã cập nhật.','success'); render(); break;
    case 'prodForm': prodFormModal(); break;
    case 'editProd': prodFormModal(id); break;
    case 'delProd':
      if (!confirm('Xóa vật phẩm này?')) return;
      var pi = db.products.findIndex(function(p){return p.id===id}); if(pi>=0) db.products.splice(pi,1);
      save(); toast('Đã xóa.','success'); render(); break;
    case 'saveProd':
      var spid = ($('#mPId')||{}).value;
      var sn = ($('#mPName')||{}).value.trim();
      if (!sn) { toast('Hãy nhập tên.','error'); return; }
      var sp3 = {name:sn, emoji:($('#mPEmoji')||{}).value||'📦', cat:($('#mPCat')||{}).value, price:parseInt(($('#mPPrice')||{}).value,10)||1000, stock:parseInt(($('#mPStock')||{}).value,10)||0, desc:($('#mPDesc')||{}).value||''};
      if (spid) { var ep=findProduct(spid); if(ep) Object.assign(ep,sp3); }
      else { sp3.id=uid('p'); db.products.push(sp3); }
      save(); var ov4 = document.querySelector('.modal-overlay'); if(ov4)ov4.remove(); toast('Đã lưu.','success'); render(); break;
    case 'userForm': userFormModal(); break;
    case 'editUser': userFormModal(id); break;
    case 'delUser':
      if (!confirm('Xóa tài khoản này?')) return;
      var dui = db.users.findIndex(function(u3){return u3.id===id}); if(dui>=0) db.users.splice(dui,1);
      db.messages = db.messages.filter(function(m){return m.chatId!==id});
      save(); toast('Đã xóa.','success'); render(); break;
    case 'saveUser':
      var suid = ($('#mUId')||{}).value;
      if (suid) {
        var eu = db.users.find(function(x){return x.id===suid}); if (!eu) return;
        eu.balance = parseInt(($('#mUBal')||{}).value,10)||0;
        var as = parseInt(($('#mUSpins')||{}).value,10)||0; if(as>0&&as<=1000) eu.spins+=as;
        var np = ($('#mUNewPw')||{}).value;
        if (np && np.length>=6) { hashPw(np).then(function(h){eu.passHash=h; save();}); }
        save(); var ov5=document.querySelector('.modal-overlay'); if(ov5)ov5.remove(); toast('Đã lưu.','success'); render();
      } else {
        var nun = ($('#mUName')||{}).value.trim();
        var nupw = ($('#mUPw')||{}).value;
        if(!/^[A-Za-z0-9_]{3,20}$/.test(nun)){toast('Tên không hợp lệ.','error');return;}
        if(nupw.length<6){toast('Mật khẩu ≥6 ký tự.','error');return;}
        if(db.users.some(function(x){return x.username.toLowerCase()===nun.toLowerCase()})){toast('Tên đã tồn tại.','error');return;}
        hashPw(nupw).then(function(h){
          db.users.push({id:uid('u'),username:nun,passHash:h,role:'user',balance:parseInt(($('#mUBal')||{}).value,10)||0,locked:false,inv:{},spins:0,spinsUsed:0,milestones:[],contact:null,contactVal:null,createdAt:Date.now()});
          save(); var ov6=document.querySelector('.modal-overlay'); if(ov6)ov6.remove(); toast('Đã tạo.','success'); render();
        });
      } break;
    case 'saveMomo':
      var mm = ($('#momoIn')||{}).value; if(!/^0\d{9}$/.test(mm)){toast('Số MoMo 10 chữ số.','error');return;}
      db.settings.momo=mm; db.settings.momoName=($('#momoNameIn')||{}).value||''; save(); toast('Đã lưu.','success'); break;
    case 'saveNotes':
      var nn = ($('#notesIn')||{}).value; if(!nn.trim()){toast('Cần có lưu ý.','error');return;}
      db.settings.notes=nn; save(); toast('Đã lưu.','success'); break;
    case 'resetData':
      if(!confirm('XÓA TOÀN BỘ dữ liệu và khôi phục mẫu?')) return;
      db=makeSeed(); logout(); save(); toast('Đã khôi phục.','info'); render(); break;
  }
});

document.addEventListener('input', function(e) {
  if (e.target.id==='q') { ui.q=e.target.value; render(); }
});
document.addEventListener('change', function(e) {
  if (e.target.id==='sort') { ui.sort=e.target.value; render(); }
});

function doCancelOrder(orderId, reason, asAdmin) {
  var o = findOrder(orderId); if(!o||o.status==='done'||o.status==='cancelled') { toast('Không thể hủy.','error'); return; }
  var buyer = db.users.find(function(x){return x.id===o.userId});
  if (buyer) {
    buyer.balance += o.total;
    o.items.forEach(function(it) {
      if(buyer.inv[it.productId]){buyer.inv[it.productId].qty-=it.qty; if(buyer.inv[it.productId].qty<=0)delete buyer.inv[it.productId];}
      var pp=findProduct(it.productId); if(pp) pp.stock+=it.qty;
    });
  }
  o.status='cancelled'; o.cancelBy=asAdmin?'admin':'user'; o.cancelReason=reason; o.cancelAt=Date.now();
  if(buyer) addMsg(o.userId,asAdmin?'admin':'user', asAdmin?'❌ Shop đã hủy đơn. '+fmt(o.total)+' đã hoàn ví.':'❌ Đã hủy đơn.');
  save(); toast('Đã hủy đơn.','info'); render();
}

function doSpin() {
  var u = me(); if(!u||u.spins<1){toast('Hết lượt quay.','error');return;}
  var prizes = db.settings.wheel; if(!prizes||prizes.length<2){toast('Chưa có phần thưởng.','error');return;}
  var tot=prizes.reduce(function(s,p){return s+p.pct},0);
  var r = Math.random()*tot, k=prizes.length-1;
  for(var i=0;i<prizes.length;i++){if(r<prizes[i].pct){k=i;break;}r-=prizes[i].pct;}
  var x=prizes[k]; var prod=findProduct(x.pid); var nm=prod?prod.name:x.name; var em=prod?prod.emoji:x.emoji;
  u.spins--; u.spinsUsed++;
  if(!u.inv[x.pid]) u.inv[x.pid]={name:nm,emoji:em,qty:0}; u.inv[x.pid].qty+=x.qty; u.inv[x.pid].name=nm; u.inv[x.pid].emoji=em;
  db.spinHistory.push({userId:u.id,productId:x.pid,name:nm,emoji:em,qty:x.qty,createdAt:Date.now()});
  var uh=db.spinHistory.filter(function(s){return s.userId===u.id}); if(uh.length>30) db.spinHistory.splice(db.spinHistory.indexOf(uh[0]),1);
  save(); toast('🎉 Trúng: '+em+' '+nm+' (×'+x.qty+')!','success',4000); render();
}

/* ===== Khởi động ===== */
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
else init();

})();
