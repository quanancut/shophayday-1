/* ===== Tiện ích ===== */
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt = n => new Intl.NumberFormat('vi-VN').format(Math.round(n)) + 'đ';
const fdate = t => new Date(t).toLocaleString('vi-VN',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'});

/* Hiển thị ảnh nếu có, không thì dùng emoji */
const pic=(o,alt)=>o&&typeof o.img==='string'&&o.img.startsWith('data:image/')?`<img src="${esc(o.img)}" alt="${esc(alt||o.name||'')}">`:esc((o&&o.emoji)||'📦');

/* ===== Lưu trữ (try/catch + dự phòng bộ nhớ) ===== */
const KEY='hayday_shop_v1', SKEY='hayday_shop_session_v1';
const mem={};
const lsGet=k=>{try{return localStorage.getItem(k)}catch(e){return mem[k]??null}};
const lsSet=k=>v=>{try{localStorage.setItem(k,v)}catch(e){mem[k]=v}};
const lsDel=k=>{try{localStorage.removeItem(k)}catch(e){delete mem[k]}};
const save=()=>lsSet(KEY)(JSON.stringify(db));

async function hash(p){
  try{
    const d=await crypto.subtle.digest('SHA-256',new TextEncoder().encode('hdshop$'+p));
    return [...new Uint8Array(d)].map(x=>x.toString(16).padStart(2,'0')).join('');
  }catch(e){return 'p:'+btoa(unescape(encodeURIComponent(p)))}
}

/* ===== Dữ liệu ===== */
const CATS=['Tiền tệ','Công cụ','Nguyên liệu','Sản phẩm'];
const DEFAULT_NOTES='Vui lòng kiểm tra tin nhắn Zalo/Facebook và mục Chat với shop khi cửa hàng liên hệ với bạn.\nNhập đúng số Zalo hoặc link Facebook, ghi rõ tên nông trại hoặc ID Hay Day ở ô ghi chú để shop giao đúng người.\nTheo dõi tình trạng đơn tại Ví & đơn hàng: Đang xử lý, sau đó chuyển sang Thành công khi shop giao xong.';
const DISCOUNT_QTY=1000, DISCOUNT_PCT=10; // mua trên 1000 cái trong một đơn: giảm 10% tổng tiền
const MIN_ITEM=10, MIN_ORDER=100, STEP_QTY=10; // tối thiểu mỗi món / mỗi đơn / bước nhảy số lượng (10, 20, 30…)
function seed(){
  return {
    seq:100,
    settings:{bank:'Ngân hàng: ........\nSố tài khoản: ........\nChủ tài khoản: ........\nNội dung chuyển khoản: tên đăng nhập của bạn'},
    users:[],
    products:[
      {id:'p1',emoji:'🪙',name:'Gói 10.000 xu',cat:'Tiền tệ',price:25000,stock:50,desc:'Xu trong game, giao ngay sau khi xác nhận.'},
      {id:'p2',emoji:'💎',name:'Gói 50 kim cương',cat:'Tiền tệ',price:60000,stock:30,desc:'Dùng mở rộng đất, mua máy móc, tăng tốc.'},
      {id:'p3',emoji:'🪓',name:'Rìu',cat:'Công cụ',price:3000,stock:200,desc:'Chặt cây, mở khu đất mới.'},
      {id:'p4',emoji:'🪚',name:'Cưa',cat:'Công cụ',price:3000,stock:200,desc:'Cưa gỗ ở các khu đất cần dọn.'},
      {id:'p5',emoji:'🧨',name:'Thuốc nổ',cat:'Công cụ',price:4000,stock:150,desc:'Phá đá trong hầm mỏ.'},
      {id:'p6',emoji:'💣',name:'TNT',cat:'Công cụ',price:5000,stock:120,desc:'Phá đá lớn, khai thác nhanh hơn.'},
      {id:'p7',emoji:'🔨',name:'Búa',cat:'Công cụ',price:3500,stock:100,desc:'Dùng để mở rộng khu mỏ.'},
      {id:'p8',emoji:'📜',name:'Giấy chứng nhận đất',cat:'Công cụ',price:6000,stock:80,desc:'Mở rộng thêm đất canh tác.'},
      {id:'p9',emoji:'🪵',name:'Ván gỗ',cat:'Nguyên liệu',price:2000,stock:300,desc:'Nâng cấp kho, nhà máy.'},
      {id:'p10',emoji:'🌾',name:'Lúa mì (100)',cat:'Nguyên liệu',price:8000,stock:60,desc:'Gói 100 lúa mì cho máy làm bánh.'},
      {id:'p11',emoji:'🌽',name:'Ngô (100)',cat:'Nguyên liệu',price:8000,stock:60,desc:'Gói 100 ngô cho thức ăn gia súc.'},
      {id:'p12',emoji:'🍞',name:'Bánh mì (20)',cat:'Sản phẩm',price:12000,stock:40,desc:'Gói 20 ổ bánh mì cho đơn hàng xe tải.'},
      {id:'p13',emoji:'🥛',name:'Sữa (20)',cat:'Sản phẩm',price:12000,stock:40,desc:'Gói 20 chai sữa từ bò.'},
      {id:'p14',emoji:'🥚',name:'Trứng (30)',cat:'Sản phẩm',price:10000,stock:0,desc:'Gói 30 trứng gà. Đang hết hàng.'}
    ],
    orders:[], topups:[]
  };
}
let db, sess=null;
const uid=p=>p+(db.seq++);
const me=()=>db.users.find(u=>u.id===sess)||null;
const isAdmin=()=>{const u=me();return !!u&&u.role==='admin'};

async function init(){
  try{db=JSON.parse(lsGet(KEY)||'null')}catch(e){db=null}
  if(!db||!db.users){db=seed()}
  db.settings=db.settings||{};
  if(!db.settings.momo)db.settings.momo='0835203303';
  if(!Array.isArray(db.messages))db.messages=[];
  if(!db.settings.notes)db.settings.notes=DEFAULT_NOTES;
  if(!Array.isArray(db.settings.wheel)||db.settings.wheel.length<2)db.settings.wheel=defaultWheel();
  db.settings.wheel.forEach(x=>{
    if(!(x.qty>=1))x.qty=Math.max(1,Math.round(((x.min||DEF_QTY)+(x.max||DEF_QTY))/2));
    delete x.min;delete x.max;
  });
  if(!Array.isArray(db.settings.milestones)||!db.settings.milestones.length)db.settings.milestones=[20000,50000,100000];
  if(!db.settings.milestoneBy)db.settings.milestoneBy='topup';
  if(!db.settings.shovelSeeded){
    db.settings.shovelSeeded=true;
    if(!db.products.some(p=>p.id==='p_shovel'))db.products.push({id:'p_shovel',emoji:'⛏️',name:'Xẻng',cat:'Công cụ',price:3000,stock:200,desc:'Dọn đất, mở rộng khu canh tác.'});
  }
  db.users.forEach(u=>grantMilestones(u));
  if(!db.users.some(u=>u.role==='admin')){
    db.users.push({id:uid('u'),username:'admin',pass:await hash('admin123'),role:'admin',balance:0,locked:false,inv:{},created:Date.now()});
  }
  save();
  sess=lsGet(SKEY);
  if(!me()){sess=null;lsDel(SKEY)}
  render();
}

/* ===== Trạng thái giao diện ===== */
const ui={view:'shop',tab:'products',cat:'Tất cả',q:'',sort:'default',cart:{}};

/* ===== Hiển thị ===== */
function renderHeader(){
  const u=me();
  const nav=[['shop','Cửa hàng']];
  if(u){nav.push(['inv','Kho của tôi'],['spin','Vòng quay'],['wallet','Ví & đơn hàng']);if(u.role!=='admin')nav.push(['chat','Chat với shop']);}
  if(u&&u.role==='admin')nav.push(['admin','Quản trị']);
  $('#hdr').innerHTML=`
    <div class="logo"><span class="badge">🌾</span>Kho Làng Hay Day</div>
    <nav class="nav">${nav.map(([k,l])=>`<button class="${ui.view===k?'on':''}" data-act="nav" data-id="${k}">${l}${navDot(k,u)}</button>`).join('')}</nav>
    <div class="who">
      ${u?`<button class="btn sun sm" data-act="cart">🛒 Giỏ hàng (${cartCount()})</button><span class="coin">💰 ${fmt(u.balance)}</span><span>Chào, <b>${esc(u.username)}</b></span><button class="btn sun sm" data-act="logout">Đăng xuất</button>`
         :`<button class="btn ghost sm" data-act="login">Đăng nhập</button><button class="btn sun sm" data-act="register">Tạo tài khoản</button>`}
    </div>`;
}

function render(){
  const u0=me();
  if(u0&&u0.role!=='admin'&&ui.view==='chat')markRead('user',u0.id);
  if(u0&&u0.role==='admin'&&ui.view==='admin'&&ui.tab==='chat'){ensureChatUid();if(ui.chatUid)markRead('admin',ui.chatUid)}
  renderHeader();
  const u=me();
  if((ui.view==='inv'||ui.view==='wallet'||ui.view==='chat'||ui.view==='spin')&&!u)ui.view='shop';
  if(ui.view==='chat'&&u&&u.role==='admin')ui.view='admin';
  if(ui.view==='admin'&&!isAdmin())ui.view='shop';
  const fn={shop:vShop,inv:vInv,wallet:vWallet,admin:vAdmin,chat:vChat,spin:vSpin}[ui.view];
  $('#app').innerHTML=fn()+`<div class="foot">Bản demo lưu dữ liệu ngay trong trình duyệt này. Không liên kết với Supercell.</div>`;
  const cl=$('#chatlog');if(cl)cl.scrollTop=cl.scrollHeight;
}

function vShop(){
  let list=db.products.filter(p=>(ui.cat==='Tất cả'||p.cat===ui.cat)&&p.name.toLowerCase().includes(ui.q.toLowerCase()));
  if(ui.sort==='asc')list=[...list].sort((a,b)=>a.price-b.price);
  if(ui.sort==='desc')list=[...list].sort((a,b)=>b.price-a.price);
  const u=me();
  return `
  <div class="hero"><div><h1>Vật phẩm Hay Day, giá rõ ràng</h1>
  <p>Mua theo bội số của ${STEP_QTY} (10, 20, 30…), tối thiểu ${MIN_ITEM} cái mỗi món, mỗi đơn từ ${MIN_ORDER} cái. Thêm món vào giỏ, đặt hàng, vật phẩm vào kho ngay.</p></div>
  ${u?'':`<button class="btn sun" data-act="register">Tạo tài khoản để mua</button>`}</div>
  <div class="notebox"><b>Lưu ý khi mua</b>${notesHtml()}</div>
  <div class="promo">🎉 Mua trên ${DISCOUNT_QTY} cái trong một đơn: giảm ${DISCOUNT_PCT}% tổng tiền.</div>
  <div class="promo">🎁 Tổng tiền ${metricLabel()} đạt ${mileText()}: nhận thêm 1 lượt quay vòng quay may mắn.</div>
  <div class="tools">
    <input id="q" type="search" placeholder="Tìm vật phẩm…" value="${esc(ui.q)}" aria-label="Tìm vật phẩm">
    <select id="sort" aria-label="Sắp xếp">
      <option value="default" ${ui.sort==='default'?'selected':''}>Mặc định</option>
      <option value="asc" ${ui.sort==='asc'?'selected':''}>Giá thấp đến cao</option>
      <option value="desc" ${ui.sort==='desc'?'selected':''}>Giá cao đến thấp</option>
    </select>
  </div>
  <div class="chips">${['Tất cả',...CATS].map(c=>`<button class="chip ${ui.cat===c?'on':''}" data-act="cat" data-id="${c}">${c}</button>`).join('')}</div>
  ${list.length?`<div class="grid">${list.map(p=>`
    <article class="item">
      <div class="crate"><span class="tag">${esc(p.cat)}</span>${pic(p)}</div>
      <div class="body">
        <h3>${esc(p.name)}</h3>
        <div class="desc">${esc(p.desc)}</div>
        <div class="row"><span class="price">${fmt(p.price)}</span><span class="stock ${p.stock<=5?'low':''}">${p.stock>0?'Còn '+p.stock:'Hết hàng'}</span></div>
        <button class="btn" data-act="buy" data-id="${p.id}" ${p.stock<MIN_ITEM?'disabled':''}>${p.stock<1?'Hết hàng':p.stock<MIN_ITEM?'Còn dưới mức tối thiểu':'Thêm vào giỏ'}</button>
      </div></article>`).join('')}</div>`
  :`<div class="empty"><b>🔍</b>Không có vật phẩm nào khớp. Thử bỏ bộ lọc hoặc đổi từ khóa.</div>`}`;
}

function vInv(){
  const u=me();
  const items=Object.entries(u.inv).filter(([,v])=>v.qty>0);
  const total=items.reduce((s,[,v])=>s+v.qty,0);
  return `
  <div class="hero"><div><h1>Kho của tôi</h1><p>Vật phẩm bạn đã mua. Shop sẽ gửi vào game theo thông tin bạn cung cấp.</p></div></div>
  <div class="stats">
    <div class="stat"><b>${items.length}</b><small>Loại vật phẩm</small></div>
    <div class="stat"><b>${fmt(u.balance)}</b><small>Số dư ví</small></div>
    <div class="stat"><b>${total}</b><small>Tổng số lượng</small></div>
  </div>
  <section class="panel">${items.length?`<div class="inv-grid">${items.map(([id,v])=>`
    <div class="slot"><span class="q">×${v.qty}</span><div class="e">${pic({...v,img:(db.products.find(x=>x.id===id)||{}).img})}</div><div class="n">${esc(v.name)}</div></div>`).join('')}</div>`
  :`<div class="empty"><b>📦</b>Kho đang trống. Ghé cửa hàng để mua vật phẩm đầu tiên.<br><br><button class="btn" data-act="nav" data-id="shop">Đến cửa hàng</button></div>`}</section>`;
}

function vWallet(){
  const u=me();
  const mine=db.topups.filter(t=>t.userId===u.id).sort((a,b)=>b.time-a.time);
  const ords=db.orders.filter(o=>o.userId===u.id).sort((a,b)=>b.time-a.time);
  const st={pending:['Chờ duyệt','warn'],approved:['Đã cộng','' ],rejected:['Từ chối','bad']};
  return `
  <div class="hero"><div><h1>Ví & đơn hàng</h1><p>Nạp tiền vào ví để mua vật phẩm.</p></div>
  <button class="btn sun" data-act="topup">Nạp tiền vào ví</button></div>
  <div class="stats"><div class="stat"><b>${fmt(u.balance)}</b><small>Số dư hiện tại</small></div>
  <div class="stat"><b>${ords.filter(o=>o.status!=='cancelled').length}</b><small>Đơn đã mua</small></div></div>
  <section class="panel"><h2>Yêu cầu nạp tiền</h2>
  ${mine.length?`<div class="scroll"><table class="tbl"><tr><th>Thời gian</th><th>Số tiền</th><th>Nội dung chuyển khoản</th><th>Trạng thái</th></tr>
  ${mine.map(t=>`<tr><td>${fdate(t.time)}</td><td>${fmt(t.amount)}</td><td>${esc(t.note||'—')}</td><td><span class="pill ${st[t.status][1]}">${st[t.status][0]}</span></td></tr>`).join('')}</table></div>`
  :`<div class="empty">Chưa có yêu cầu nạp tiền nào.</div>`}</section>
  <section class="panel"><h2>Lịch sử mua hàng</h2>
  ${ords.length?`<div class="scroll"><table class="tbl"><tr><th>Thời gian</th><th>Vật phẩm</th><th>Tổng</th><th>Nhận hàng qua</th><th>Trạng thái</th><th></th></tr>
  ${ords.map(o=>`<tr><td>${fdate(o.time)}</td><td>${o.items.map(i=>`${esc(i.name)} ×${i.qty}`).join(', ')}</td><td>${totalHtml(o)}</td><td>${contactHtml(o.contact)}</td><td>${statusHtml(o)}</td><td>${isOpen(o)?`<button class="btn sm danger" data-act="ocancel" data-id="${o.id}">Hủy đơn</button>`:''}</td></tr>`).join('')}</table></div>`
  :`<div class="empty">Chưa có đơn hàng nào.</div>`}</section>`;
}

function vAdmin(){
  const pend=db.topups.filter(t=>t.status==='pending').length;
  const rev=db.orders.filter(o=>o.status!=='cancelled').reduce((s,o)=>s+o.total,0);
  const tabs=[['products','Vật phẩm'],['users','Tài khoản'],['topups','Nạp tiền'],['orders','Đơn hàng'],['chat','Tin nhắn'],['wheel','Vòng quay'],['settings','Cài đặt']];
  let body='';
  if(ui.tab==='products')body=`
    <section class="panel"><div class="row wrap-r"><h2>Quản lý vật phẩm</h2><button class="btn" data-act="padd">+ Thêm vật phẩm</button></div>
    <div class="scroll"><table class="tbl"><tr><th></th><th>Tên</th><th>Loại</th><th>Giá</th><th>Tồn kho</th><th></th></tr>
    ${db.products.map(p=>`<tr><td style="font-size:26px">${p.img?`<img class="thumb" src="${esc(p.img)}" alt="">`:esc(p.emoji)}</td><td>${esc(p.name)}</td><td>${esc(p.cat)}</td><td>${fmt(p.price)}</td>
    <td>${p.stock<1?'<span class="pill bad">Hết</span>':p.stock}</td>
    <td><div class="acts"><button class="btn sm sun" data-act="pedit" data-id="${p.id}">Sửa</button><button class="btn sm danger" data-act="pdel" data-id="${p.id}">Xóa</button></div></td></tr>`).join('')}</table></div></section>`;
  if(ui.tab==='users')body=`
    <section class="panel"><div class="row wrap-r"><h2>Quản lý tài khoản</h2><button class="btn" data-act="uadd">+ Tạo tài khoản</button></div>
    <div class="scroll"><table class="tbl"><tr><th>Tên đăng nhập</th><th>Vai trò</th><th>Số dư</th><th>Vật phẩm</th><th>Trạng thái</th><th></th></tr>
    ${db.users.map(u=>`<tr><td><b>${esc(u.username)}</b></td><td>${u.role==='admin'?'Quản trị':'Khách'}</td><td>${fmt(u.balance)}</td>
    <td>${Object.values(u.inv).reduce((s,v)=>s+v.qty,0)}</td>
    <td>${u.locked?'<span class="pill bad">Đã khóa</span>':'<span class="pill">Hoạt động</span>'}</td>
    <td><div class="acts">${u.role!=='admin'?`<button class="btn sm ghost" data-act="chatwith" data-id="${u.id}">Chat</button>`:''}<button class="btn sm sun" data-act="uedit" data-id="${u.id}">Sửa</button>${u.id!==sess?`<button class="btn sm danger" data-act="udel" data-id="${u.id}">Xóa</button>`:''}</div></td></tr>`).join('')}</table></div></section>`;
  if(ui.tab==='topups'){
    const l=[...db.topups].sort((a,b)=>b.time-a.time);
    body=`<section class="panel"><h2>Yêu cầu nạp tiền</h2>
    ${l.length?`<div class="scroll"><table class="tbl"><tr><th>Thời gian</th><th>Tài khoản</th><th>Số tiền</th><th>Nội dung chuyển khoản</th><th></th></tr>
    ${l.map(t=>`<tr><td>${fdate(t.time)}</td><td>${esc(t.username)}</td><td>${fmt(t.amount)}</td><td>${esc(t.note||'—')}</td>
    <td>${t.status==='pending'?`<div class="acts"><button class="btn sm" data-act="tok" data-id="${t.id}">Duyệt</button><button class="btn sm danger" data-act="tno" data-id="${t.id}">Từ chối</button></div>`
      :`<span class="pill ${t.status==='approved'?'':'bad'}">${t.status==='approved'?'Đã cộng':'Từ chối'}</span>`}</td></tr>`).join('')}</table></div>`
    :`<div class="empty">Chưa có yêu cầu nạp tiền.</div>`}</section>`;
  }
  if(ui.tab==='orders'){
    const l=[...db.orders].sort((a,b)=>b.time-a.time);
    body=`<section class="panel"><h2>Đơn hàng</h2>
    ${l.length?`<div class="scroll"><table class="tbl"><tr><th>Thời gian</th><th>Tài khoản</th><th>Vật phẩm</th><th>Tổng</th><th>Nhận hàng qua</th><th>Trạng thái</th><th></th></tr>
    ${l.map(o=>`<tr><td>${fdate(o.time)}</td><td>${esc(o.username)}</td><td>${o.items.map(i=>`${esc(i.name)} ×${i.qty}`).join(', ')}</td><td>${totalHtml(o)}</td><td>${contactHtml(o.contact)}${o.contact&&o.contact.note?`<br><small>Ghi chú: ${esc(o.contact.note)}</small>`:''}</td><td>${statusHtml(o)}</td><td><div class="acts">${o.status==='cancelled'?'':`<button class="btn sm" data-act="ostat" data-id="${o.id}">${o.status==='done'?'Về đang xử lý':'Đánh dấu thành công'}</button>`}${isOpen(o)?`<button class="btn sm danger" data-act="ocancel" data-id="${o.id}">Hủy đơn</button>`:''}<button class="btn sm sun" data-act="chatwith" data-id="${o.userId}">Chat</button></div></td></tr>`).join('')}</table></div>`
    :`<div class="empty">Chưa có đơn hàng.</div>`}</section>`;
  }
  if(ui.tab==='chat')body=adminChat();
  if(ui.tab==='wheel')body=adminWheel();
  if(ui.tab==='settings')body=`
    <section class="panel"><h2>Nạp tiền qua MoMo</h2>
    <p class="stock">Số MoMo này hiện cho khách khi họ bấm “Nạp tiền vào ví”.</p>
    <div class="two"><div class="f"><label for="mno">Số điện thoại MoMo</label><input id="mno" inputmode="numeric" value="${esc(db.settings.momo)}"></div>
    <div class="f"><label for="mnm">Tên chủ tài khoản (tùy chọn)</label><input id="mnm" value="${esc(db.settings.momoName||'')}"></div></div>
    <button class="btn" data-act="bank">Lưu thông tin</button>
    <hr style="border:0;border-top:1px solid var(--line);margin:18px 0">
    <h2>Lưu ý khi mua</h2>
    <p class="stock">Mỗi dòng là một lưu ý. Hiện cho khách ở trang Cửa hàng và trong giỏ hàng khi đặt đơn.</p>
    <div class="f"><textarea id="notes" rows="6" maxlength="1500">${esc(db.settings.notes||DEFAULT_NOTES)}</textarea></div>
    <button class="btn" data-act="notes">Lưu lưu ý</button>
    <hr style="border:0;border-top:1px solid var(--line);margin:18px 0">
    <h2>Dữ liệu</h2>
    <button class="btn danger" data-act="reset">Xóa toàn bộ và khôi phục dữ liệu mẫu</button></section>`;
  return `
  <div class="hero"><div><h1>Quản trị</h1></div></div>
  <div class="stats">
    <div class="stat"><b>${fmt(rev)}</b><small>Doanh thu</small></div>
    <div class="stat"><b>${db.users.length}</b><small>Tài khoản</small></div>
    <div class="stat"><b>${db.products.length}</b><small>Vật phẩm</small></div>
    <div class="stat"><b>${pend}</b><small>Nạp tiền chờ duyệt</small></div>
    <div class="stat"><b>${db.orders.filter(o=>isOpen(o)).length}</b><small>Đơn đang xử lý</small></div>
  </div>
  <div class="tabs">${tabs.map(([k,l])=>`<button class="${ui.tab===k?'on':''}" data-act="tab" data-id="${k}">${l}${k==='topups'&&pend?`<span class="dot">${pend}</span>`:''}${k==='chat'&&unreadFor('admin')?`<span class="dot">${unreadFor('admin')}</span>`:''}${k==='orders'&&db.orders.some(o=>isOpen(o))?`<span class="dot">${db.orders.filter(o=>isOpen(o)).length}</span>`:''}</button>`).join('')}</div>
  ${body}`;
}

/* ===== Modal & toast ===== */
function toast(t){
  const el=document.createElement('div');el.className='toast';el.textContent=t;el.setAttribute('role','status');
  document.body.appendChild(el);setTimeout(()=>el.remove(),2600);
}
function closeModal(){$('#layer').innerHTML=''}
function modal(title,html,onSubmit,okText='Lưu'){
  /* Không dùng nút submit thật: trang chạy trong khung sandbox của claude.ai nên trình duyệt chặn gửi form. */
  $('#layer').innerHTML=`<div class="ov" data-act="ovclose"><form class="box" id="mf" role="dialog" aria-modal="true" aria-label="${esc(title)}">
    <h2>${esc(title)}</h2><div id="merr"></div>${html}
    <div class="mf"><button type="button" class="btn ghost" data-act="close">Hủy</button>${okText?`<button type="button" class="btn" id="msub">${okText}</button>`:''}</div></form></div>`;
  const f=$('#mf');
  let busy=false;
  const run=async()=>{
    if(busy||!okText)return;
    if(!f.reportValidity())return;
    busy=true;
    try{
      const r=await onSubmit(new FormData(f),f);
      if(typeof r==='string'){const m=$('#merr');if(m){m.innerHTML=`<div class="err">${esc(r)}</div>`;m.scrollIntoView({block:'nearest'})}}
    }catch(err){
      const m=$('#merr');if(m)m.innerHTML=`<div class="err">Có lỗi xảy ra, thử lại.</div>`;
    }
    busy=false;
  };
  f.addEventListener('submit',e=>e.preventDefault());
  f.addEventListener('keydown',e=>{
    if(e.key==='Enter'&&e.target.tagName!=='TEXTAREA'&&e.target.tagName!=='BUTTON'&&e.target.type!=='file'){e.preventDefault();run()}
  });
  const sb=$('#msub');if(sb)sb.addEventListener('click',run);
  const first=f.querySelector('input,select,textarea');if(first)first.focus();
}
document.addEventListener('keydown',e=>{if(e.key==='Escape')closeModal()});

/* ===== Đăng ký / đăng nhập ===== */
function openRegister(){
  modal('Tạo tài khoản',`
    <div class="f"><label for="un">Tên đăng nhập</label><input id="un" name="un" autocomplete="username" required><small>3–20 ký tự: chữ không dấu, số, dấu gạch dưới.</small></div>
    <div class="f"><label for="pw">Mật khẩu</label><input id="pw" name="pw" type="password" autocomplete="new-password" required><small>Tối thiểu 6 ký tự.</small></div>
    <div class="f"><label for="pw2">Nhập lại mật khẩu</label><input id="pw2" name="pw2" type="password" autocomplete="new-password" required></div>`,
  async fd=>{
    const un=fd.get('un').trim(),pw=fd.get('pw');
    if(!/^[A-Za-z0-9_]{3,20}$/.test(un))return 'Tên đăng nhập phải 3–20 ký tự, chỉ gồm chữ không dấu, số và dấu gạch dưới.';
    if(pw.length<6)return 'Mật khẩu cần ít nhất 6 ký tự.';
    if(pw!==fd.get('pw2'))return 'Hai mật khẩu chưa khớp.';
    if(db.users.some(u=>u.username.toLowerCase()===un.toLowerCase()))return 'Tên đăng nhập này đã có người dùng. Hãy chọn tên khác.';
    const u={id:uid('u'),username:un,pass:await hash(pw),role:'user',balance:0,locked:false,inv:{},created:Date.now()};
    db.users.push(u);save();sess=u.id;lsSet(SKEY)(sess);
    closeModal();render();toast('Đã tạo tài khoản. Chào '+un+'!');
  },'Tạo tài khoản');
}
function openLogin(){
  modal('Đăng nhập',`
    <div class="f"><label for="un">Tên đăng nhập</label><input id="un" name="un" autocomplete="username" required></div>
    <div class="f"><label for="pw">Mật khẩu</label><input id="pw" name="pw" type="password" autocomplete="current-password" required></div>
    <small class="stock">Tài khoản quản trị mẫu: admin / admin123. Hãy đổi mật khẩu sau khi vào.</small>`,
  async fd=>{
    const un=fd.get('un').trim().toLowerCase();
    const u=db.users.find(x=>x.username.toLowerCase()===un);
    if(!u||u.pass!==await hash(fd.get('pw')))return 'Sai tên đăng nhập hoặc mật khẩu.';
    if(u.locked)return 'Tài khoản này đã bị khóa. Liên hệ quản trị viên.';
    sess=u.id;lsSet(SKEY)(sess);closeModal();ui.view='shop';render();toast('Đăng nhập thành công.');
  },'Đăng nhập');
}

/* ===== Hủy đơn hàng ===== */
function cancelOrder(o,by,reason){
  if(!o||!isOpen(o))return false;
  const u=db.users.find(x=>x.id===o.userId);
  if(u){
    u.balance+=o.total;                                   // hoàn tiền vào ví
    o.items.forEach(i=>{const e=u.inv[i.pid];if(e){e.qty-=i.qty;if(e.qty<=0)delete u.inv[i.pid]}}); // thu hồi vật phẩm khỏi kho
  }
  o.items.forEach(i=>{const p=db.products.find(x=>x.id===i.pid);if(p)p.stock+=i.qty});               // trả lại tồn kho
  o.status='cancelled';o.cancelBy=by;o.cancelReason=reason||'';o.cancelTime=Date.now();
  const sum=o.items.map(i=>i.name+' ×'+i.qty).join(', ');
  sendMsg(o.userId,by,by==='admin'
    ?'❌ Shop đã hủy đơn của bạn ('+sum+')'+(reason?'. Lý do: '+reason:'')+'. Số tiền '+fmt(o.total)+' đã hoàn vào ví.'
    :'❌ Mình đã hủy đơn ('+sum+', '+fmt(o.total)+')'+(reason?'. Lý do: '+reason:'')+'.');
  return true;
}
function openCancel(id){
  const o=db.orders.find(x=>x.id===id);if(!o)return;
  const u=me();if(!u)return;
  const by=(isAdmin()&&ui.view==='admin')?'admin':'user';
  if(by==='user'&&o.userId!==u.id)return;
  if(!isOpen(o)){toast('Đơn này đã hoàn tất hoặc đã hủy, không thể hủy nữa.');return}
  const sum=o.items.map(i=>esc(i.name)+' ×'+i.qty).join(', ');
  modal('Hủy đơn hàng',`
    <p>${by==='admin'?'Hủy đơn của <b>'+esc(o.username)+'</b>':'Bạn muốn hủy đơn này?'}</p>
    <div class="note">${sum}<br>Tổng tiền: <b>${fmt(o.total)}</b></div>
    <div class="f"><label for="rs">Lý do (tùy chọn)</label><input id="rs" name="reason" maxlength="160"></div>
    <small class="stock">Khi hủy: ${fmt(o.total)} được hoàn vào ví ${by==='admin'?'của khách':'của bạn'}, vật phẩm của đơn bị thu hồi khỏi kho và tồn kho shop được cộng lại. Việc hủy không hoàn tác được.</small>`,
  fd=>{
    if(!isOpen(o))return 'Đơn này đã hoàn tất hoặc đã hủy, không thể hủy nữa.';
    cancelOrder(o,by,fd.get('reason').trim());
    save();closeModal();render();toast('Đã hủy đơn, hoàn '+fmt(o.total)+' vào ví.');
  },'Hủy đơn');
}

/* ===== Điểm danh & vòng quay ===== */
const DEF_QTY=50, MAX_PRIZES=12;
const dayKey=d=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
const todayKey=()=>dayKey(new Date());
const yesterdayKey=()=>{const d=new Date();d.setDate(d.getDate()-1);return dayKey(d)};
const fmtPct=n=>String(Math.round(n*10)/10).replace('.',',');
function randInt(a,b){
  try{const r=new Uint32Array(1);crypto.getRandomValues(r);return a+r[0]%(b-a+1)}
  catch(e){return a+Math.floor(Math.random()*(b-a+1))}
}
function defaultWheel(){
  return [
    {id:'w1',pid:'p3',name:'Rìu',emoji:'🪓',pct:34,qty:DEF_QTY},
    {id:'w2',pid:'p4',name:'Cưa',emoji:'🪚',pct:33,qty:DEF_QTY},
    {id:'w3',pid:'p_shovel',name:'Xẻng',emoji:'⛏️',pct:33,qty:DEF_QTY}
  ];
}
const wheelCfg=()=>db.settings.wheel;
function rewardItem(x){
  const p=db.products.find(y=>y.id===x.pid);
  return {id:x.pid,name:p?p.name:x.name,emoji:p?p.emoji:x.emoji};
}
function wheelBg(n){
  const pal=['var(--sun)','var(--grass-t)','var(--tile)','var(--barn-t)'];
  const cols=Array.from({length:n},(_,i)=>pal[i%pal.length]);
  if(n>1&&cols[n-1]===cols[0])cols[n-1]=pal.find(c=>c!==cols[0]&&c!==cols[n-2]);
  const S=360/n;
  return 'conic-gradient('+cols.map((c,i)=>c+' '+(i*S)+'deg '+((i+1)*S)+'deg').join(',')+')';
}
/* Lượt quay nhận theo mốc tiền, không có lượt quay miễn phí mỗi ngày */
const metricLabel=()=>db.settings.milestoneBy==='spent'?'mua hàng':'nạp';
const mileText=()=>db.settings.milestones.map(fmt).join(', ');
function wheelState(u){
  if(!u.wheel){
    const hs=(u.checkin&&u.checkin.history)||[];
    u.wheel={spins:0,claimed:[],used:hs.length,history:hs};
  }
  const w=u.wheel;
  if(!Array.isArray(w.claimed))w.claimed=[];
  if(!Array.isArray(w.history))w.history=[];
  w.spins=w.spins||0;w.used=w.used||0;
  return w;
}
function milestoneValue(u){
  return db.settings.milestoneBy==='spent'
    ? db.orders.filter(o=>o.userId===u.id&&o.status!=='cancelled').reduce((a,o)=>a+o.total,0)
    : db.topups.filter(t=>t.userId===u.id&&t.status==='approved').reduce((a,t)=>a+t.amount,0);
}
function grantMilestones(u){
  const w=wheelState(u),v=milestoneValue(u);let n=0;
  db.settings.milestones.forEach(m=>{if(v>=m&&!w.claimed.includes(m)){w.claimed.push(m);w.spins++;n++}});
  return n;
}
function vSpin(){
  const u=me(),w=wheelState(u);
  const cfg=wheelCfg(),N=cfg.length,S=360/N,tot=cfg.reduce((t,x)=>t+x.pct,0);
  const val=milestoneValue(u),ms=[...db.settings.milestones].sort((x,y)=>x-y),next=ms.find(m=>val<m);
  const h=w.history,last=h[0];
  const fs=N>8?24:32;
  const prev=ms.filter(m=>m<=val).pop()||0;
  const pctBar=next?Math.max(0,Math.min(100,(val-prev)/(next-prev)*100)):100;
  return `
  <div class="hero"><div><h1>Vòng quay may mắn</h1>
  <p>Mỗi khi tổng tiền ${metricLabel()} của bạn đạt một mốc, bạn nhận thêm 1 lượt quay. Quà vào thẳng kho của bạn.</p></div></div>
  <div class="stats">
    <div class="stat"><b>${w.spins}</b><small>Lượt quay còn lại</small></div>
    <div class="stat"><b>${fmt(val)}</b><small>Tổng tiền đã ${metricLabel()}</small></div>
    <div class="stat"><b>${w.used}</b><small>Lượt đã quay</small></div>
  </div>
  <section class="panel"><h2>Mốc nhận lượt quay</h2>
    <div class="acts" style="margin-bottom:8px">${ms.map(m=>val>=m?`<span class="pill">✔ ${fmt(m)}</span>`:`<span class="pill warn">${fmt(m)}</span>`).join('')}</div>
    ${next?`<div class="bar" role="progressbar" aria-valuenow="${Math.round(pctBar)}" aria-valuemin="0" aria-valuemax="100"><span style="width:${pctBar}%"></span></div>
    <p class="stock" style="margin:0">Còn <b>${fmt(next-val)}</b> nữa để đạt mốc ${fmt(next)} và nhận thêm 1 lượt quay.</p>`
    :`<p class="stock" style="margin:0">Bạn đã đạt tất cả các mốc hiện có.</p>`}
  </section>
  <section class="panel spinbox">
    <div class="wheelwrap"><div class="pointer" aria-hidden="true">▼</div>
      <div class="wheel" id="wheel" style="background:${wheelBg(N)};transform:rotate(${ui.wheelAngle||0}deg)" role="img" aria-label="Vòng quay gồm ${cfg.map(x=>esc(rewardItem(x).name)).join(', ')}">
        ${cfg.map((x,i)=>`<span class="wl" style="font-size:${fs}px;transform:rotate(${i*S+S/2}deg) translateY(-90px)">${esc(rewardItem(x).emoji)}</span>`).join('')}
      </div></div>
    <button class="btn sun big" data-act="spin" ${w.spins<1||ui.spinning?'disabled':''}>${ui.spinning?'Đang quay…':w.spins>0?'Quay ngay (còn '+w.spins+' lượt)':'Chưa có lượt quay'}</button>
    ${last&&!ui.spinning?`<div class="gotit">Lần quay gần nhất: ${last.qty} × ${esc(last.name)} ${esc(last.emoji)}</div>`:''}
  </section>
  <section class="panel"><h2>Tỉ lệ trúng thưởng</h2>
  <div class="scroll"><table class="tbl"><tr><th>Phần thưởng</th><th>Tỉ lệ</th><th>Số lượng</th></tr>
  ${cfg.map(x=>{const it=rewardItem(x);return `<tr><td>${esc(it.emoji)} ${esc(it.name)}</td><td>${fmtPct(x.pct/tot*100)}%</td><td>${x.qty}</td></tr>`}).join('')}</table></div></section>
  <section class="panel"><h2>Quà đã nhận</h2>
  ${h.length?`<div class="scroll"><table class="tbl"><tr><th>Thời gian</th><th>Vật phẩm</th><th>Số lượng</th></tr>
  ${h.slice(0,10).map(x=>`<tr><td>${fdate(x.time)}</td><td>${esc(x.emoji)} ${esc(x.name)}</td><td>${x.qty}</td></tr>`).join('')}</table></div>`
  :`<div class="empty"><b>🎁</b>Bạn chưa nhận quà nào. Đạt mốc ${fmt(ms[0]||0)} để có lượt quay đầu tiên.</div>`}</section>`;
}
function doSpin(){
  const u=me();if(!u||ui.spinning)return;
  const w=wheelState(u);
  if(w.spins<1){toast('Bạn chưa có lượt quay. Đạt mốc '+metricLabel()+' '+mileText()+' để nhận thêm.');return}
  const cfg=wheelCfg(),N=cfg.length,S=360/N,tot=cfg.reduce((a,x)=>a+x.pct,0);
  /* chọn phần thưởng theo tỉ lệ */
  let r=randInt(0,999999)/1000000*tot,k=N-1;
  for(let i=0;i<N;i++){if(r<cfg[i].pct){k=i;break}r-=cfg[i].pct}
  const prize=cfg[k],qty=prize.qty,it=rewardItem(prize);
  w.spins--;w.used++;
  const cur=u.inv[it.id]||{name:it.name,emoji:it.emoji,qty:0};
  cur.name=it.name;cur.emoji=it.emoji;cur.qty+=qty;u.inv[it.id]=cur;
  w.history=[{time:Date.now(),id:it.id,name:it.name,emoji:it.emoji,qty},...w.history].slice(0,30);
  save();
  /* xoay vòng quay để ô trúng dừng đúng kim chỉ */
  const jit=randInt(-100,100)/100*(S/2-3);
  const cur0=((ui.wheelAngle||0)%360+360)%360;
  const want=(((360-(k*S+S/2+jit))%360)+360)%360;
  const newA=(ui.wheelAngle||0)+360*5+((want-cur0+360)%360);
  ui.wheelAngle=newA;ui.spinning=true;
  const reduce=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const el=$('#wheel');
  if(el){el.style.transition=reduce?'none':'transform 4.2s cubic-bezier(.12,.6,.1,1)';el.style.transform='rotate('+newA+'deg)'}
  const btn=document.querySelector('[data-act="spin"]');if(btn){btn.disabled=true;btn.textContent='Đang quay…'}
  setTimeout(()=>{ui.spinning=false;render();toast('🎉 Bạn nhận được '+qty+' × '+it.name)},reduce?50:4400);
}

/* ----- Admin: quản lý vòng quay ----- */
function adminWheel(){return adminPrizes()+adminMilestones()}
function adminMilestones(){
  const by=db.settings.milestoneBy;
  return `<section class="panel"><h2>Mốc nhận lượt quay</h2>
  <p class="stock">Khi tổng tiền của khách đạt mỗi mốc, khách nhận thêm 1 lượt quay (mỗi mốc một lần). Không có lượt quay miễn phí hằng ngày. Lượt đã tặng không bị thu hồi nếu đơn hàng bị hủy sau đó.</p>
  <div class="two"><div class="f"><label for="mby">Tính mốc theo</label><select id="mby"><option value="topup" ${by==='topup'?'selected':''}>Tổng tiền đã nạp</option><option value="spent" ${by==='spent'?'selected':''}>Tổng tiền đã mua</option></select></div>
  <div class="f"><label for="mls">Các mốc (đ), cách nhau bằng dấu phẩy</label><input id="mls" value="${esc(db.settings.milestones.join(', '))}"></div></div>
  <button class="btn" data-act="msave">Lưu mốc</button></section>`;
}
function saveMilestones(){
  const by=$('#mby').value==='spent'?'spent':'topup';
  const nums=$('#mls').value.split(/[,;]+/).map(x=>x.replace(/[.\s]/g,'')).filter(Boolean).map(Number);
  if(!nums.length||nums.some(n=>!Number.isInteger(n)||n<1||n>1000000000)){toast('Các mốc phải là số nguyên dương, cách nhau bằng dấu phẩy.');return}
  const uniq=[...new Set(nums)].sort((x,y)=>x-y);
  if(uniq.length>20){toast('Tối đa 20 mốc.');return}
  db.settings.milestones=uniq;db.settings.milestoneBy=by;
  let g=0;db.users.forEach(u=>{g+=grantMilestones(u)});
  save();render();toast('Đã lưu mốc.'+(g?' Đã tặng '+g+' lượt quay cho khách đã đạt mốc.':''));
}
function adminPrizes(){
  const w=wheelCfg(),tot=w.reduce((a,x)=>a+x.pct,0),ok=Math.abs(tot-100)<0.05;
  return `<section class="panel"><div class="row wrap-r"><h2>Vòng quay điểm danh</h2>
    <div class="acts"><button class="btn sm ghost" data-act="weven">Chia đều tỉ lệ</button><button class="btn" data-act="wadd">+ Thêm phần thưởng</button></div></div>
  <p class="stock">Mỗi phần thưởng là một ô trên vòng quay (tối đa ${MAX_PRIZES} ô). Mỗi lượt quay trúng ngẫu nhiên một phần thưởng theo tỉ lệ bạn đặt.</p>
  <div class="scroll"><table class="tbl"><tr><th></th><th>Phần thưởng</th><th>Tỉ lệ</th><th>Số lượng</th><th></th></tr>
  ${w.map(x=>{const it=rewardItem(x);return `<tr><td style="font-size:26px">${esc(it.emoji)}</td><td>${esc(it.name)}${db.products.some(p=>p.id===x.pid)?'':' <span class="pill bad">Đã xóa khỏi shop</span>'}</td>
    <td>${fmtPct(x.pct)}%</td><td>${x.qty}</td>
    <td><div class="acts"><button class="btn sm sun" data-act="wedit" data-id="${x.id}">Sửa</button><button class="btn sm danger" data-act="wdel" data-id="${x.id}">Xóa</button></div></td></tr>`}).join('')}</table></div>
  <div class="${ok?'note':'err'}" style="margin:12px 0 0">Tổng tỉ lệ: <b>${fmtPct(tot)}%</b> ${ok?'(đủ 100%)':'. Chưa bằng 100%, hệ thống sẽ tự quy đổi theo tỉ lệ giữa các phần thưởng. Khách xem được tỉ lệ đã quy đổi.'}</div></section>`;
}
function wheelForm(x){
  x=x||{pid:db.products[0]?db.products[0].id:'',pct:10,qty:DEF_QTY};
  return `<div class="f"><label for="wp">Vật phẩm thưởng</label><select id="wp" name="pid">${db.products.map(p=>`<option value="${p.id}" ${p.id===x.pid?'selected':''}>${esc(p.emoji)} ${esc(p.name)}</option>`).join('')}</select><small>Chọn từ danh sách vật phẩm của shop. Quà vào kho của khách.</small></div>
  <div class="f"><label for="wr">Tỉ lệ trúng (%)</label><input id="wr" name="pct" type="number" min="0.1" max="100" step="0.1" value="${x.pct}" required></div>
  <div class="f"><label for="wq">Số lượng thưởng</label><input id="wq" name="qty" type="number" min="1" max="100000" step="1" value="${x.qty}" required><small>Mỗi lần trúng, khách nhận đúng số lượng này.</small></div>`;
}
function readWheel(fd){
  const pid=fd.get('pid'),pct=parseFloat(fd.get('pct')),qty=parseInt(fd.get('qty'),10);
  const p=db.products.find(x=>x.id===pid);
  if(!p)return 'Hãy chọn vật phẩm thưởng.';
  if(!(pct>0&&pct<=100))return 'Tỉ lệ phải lớn hơn 0 và không quá 100%.';
  if(!(qty>=1&&qty<=100000))return 'Số lượng thưởng phải từ 1 đến 100.000.';
  return {pid,name:p.name,emoji:p.emoji,pct:Math.round(pct*10)/10,qty};
}
function wadd(){
  if(wheelCfg().length>=MAX_PRIZES){toast('Vòng quay tối đa '+MAX_PRIZES+' phần thưởng.');return}
  if(!db.products.length){toast('Hãy thêm vật phẩm vào shop trước.');return}
  modal('Thêm phần thưởng',wheelForm(),fd=>{
    const r=readWheel(fd);if(typeof r==='string')return r;
    wheelCfg().push({id:uid('w'),...r});save();closeModal();render();toast('Đã thêm phần thưởng.');
  },'Thêm phần thưởng');
}
function wedit(id){
  const x=wheelCfg().find(y=>y.id===id);if(!x)return;
  modal('Sửa phần thưởng',wheelForm(x),fd=>{
    const r=readWheel(fd);if(typeof r==='string')return r;
    Object.assign(x,r);save();closeModal();render();toast('Đã lưu phần thưởng.');
  });
}
function wdel(id){
  const x=wheelCfg().find(y=>y.id===id);if(!x)return;
  if(wheelCfg().length<=2){toast('Vòng quay cần ít nhất 2 phần thưởng.');return}
  modal('Xóa phần thưởng',`<p>Xóa <b>${esc(rewardItem(x).name)}</b> khỏi vòng quay? Quà khách đã nhận vẫn giữ nguyên trong kho.</p>`,()=>{
    db.settings.wheel=wheelCfg().filter(y=>y.id!==id);save();closeModal();render();toast('Đã xóa phần thưởng.');
  },'Xóa');
}
function weven(){
  const w=wheelCfg(),n=w.length,each=Math.round(1000/n)/10;
  w.forEach((x,i)=>{x.pct=each});
  w[0].pct=Math.round((100-each*(n-1))*10)/10;
  save();render();toast('Đã chia đều tỉ lệ giữa '+n+' phần thưởng.');
}

/* ===== Thông tin nhận hàng ===== */
const FB_RE=/^https?:\/\/((www|m|web|mbasic)\.)?(facebook\.com|fb\.com|fb\.me|m\.me)\/\S+$/i;
function normContact(ch,v){return ch==='Zalo'?v.replace(/[\s.\-]/g,''):v.trim()}
function checkContact(ch,v){
  if(ch==='Zalo')return /^(0|\+84)\d{9,10}$/.test(v)?'':'Số Zalo chưa đúng. Nhập số điện thoại, ví dụ 0912345678.';
  if(v.length>200)return 'Link Facebook quá dài.';
  return FB_RE.test(v)?'':'Link Facebook chưa đúng. Dán link trang cá nhân, ví dụ https://facebook.com/ten-ban.';
}
const notesHtml=()=>'<ul>'+String(db.settings.notes||DEFAULT_NOTES).split('\n').map(x=>x.trim()).filter(Boolean).map(x=>'<li>'+esc(x)+'</li>').join('')+'</ul>';
const isOpen=o=>o.status!=='done'&&o.status!=='cancelled';
function statusHtml(o){
  if(o&&o.status==='done')return '<span class="pill">Thành công</span>';
  if(o&&o.status==='cancelled')return '<span class="pill bad">Đã hủy</span><br><small>Hủy bởi '+(o.cancelBy==='admin'?'shop':'khách')+(o.cancelReason?': '+esc(o.cancelReason):'')+'</small>';
  return '<span class="pill warn">Đang xử lý</span>';
}
function contactHtml(c){
  if(!c||!c.value)return '—';
  if(c.channel==='Facebook'&&FB_RE.test(c.value))return `Facebook: <a href="${esc(c.value)}" target="_blank" rel="noopener noreferrer">${esc(c.value.replace(/^https?:\/\/(www\.)?/i,'').slice(0,34))}</a>`;
  return esc(c.channel)+': '+esc(c.value);
}

/* ===== Chat với admin ===== */
const msgsOf=cid=>db.messages.filter(m=>m.cid===cid).sort((a,b)=>a.time-b.time);
function unreadFor(role,cid){
  return db.messages.filter(m=>!m.read&&(role==='user'?(m.cid===cid&&m.from==='admin'):(m.from==='user'&&(cid==null||m.cid===cid)))).length;
}
function markRead(role,cid){
  let ch=false;
  db.messages.forEach(m=>{if(!m.read&&m.cid===cid&&m.from===(role==='user'?'admin':'user')){m.read=true;ch=true}});
  if(ch)save();
}
function sendMsg(cid,from,text){db.messages.push({id:uid('m'),cid,from,text,time:Date.now(),read:false})}
function navDot(k,u){
  if(!u)return '';
  let n=0;
  if(k==='spin'){const sp=wheelState(u).spins;return sp>0?'<span class="dot">'+sp+'</span>':''}
  if(k==='chat')n=unreadFor('user',u.id);
  if(k==='admin'&&u.role==='admin')n=unreadFor('admin');
  return n?`<span class="dot">${n}</span>`:'';
}
function chatBox(cid,role){
  const list=msgsOf(cid);
  return `<div class="chat" id="chatlog" tabindex="0" aria-label="Nội dung chat">${list.length?list.map(m=>`<div class="msg ${m.from===role?'me':'other'}"><div class="bub">${esc(m.text).replace(/\n/g,'<br>')}</div><small>${fdate(m.time)}</small></div>`).join(''):'<div class="empty">Chưa có tin nhắn. Gửi tin đầu tiên để bắt đầu trò chuyện.</div>'}</div>
  <div class="chatin"><input id="chatin" maxlength="500" placeholder="Nhập tin nhắn…" aria-label="Tin nhắn" autocomplete="off"><button class="btn" data-act="send" data-id="${cid}">Gửi</button></div>`;
}
function vChat(){
  const u=me();
  return `<div class="hero"><div><h1>Chat với shop</h1><p>Nhắn trực tiếp cho quản trị viên về đơn hàng, nạp tiền hoặc giao vật phẩm.</p></div></div>
  <section class="panel">${chatBox(u.id,'user')}</section>`;
}
function chatCusts(){
  const last=u=>{const l=msgsOf(u.id);return l.length?l[l.length-1].time:0};
  return db.users.filter(u=>u.role!=='admin').sort((a,b)=>last(b)-last(a));
}
function ensureChatUid(){
  const c=chatCusts();
  if(!c.find(u=>u.id===ui.chatUid))ui.chatUid=c[0]?c[0].id:null;
}
function adminChat(){
  ensureChatUid();
  const c=chatCusts();
  if(!c.length)return `<section class="panel"><div class="empty"><b>💬</b>Chưa có khách hàng nào. Khi khách đăng ký và nhắn tin, cuộc trò chuyện sẽ hiện ở đây.</div></section>`;
  const cur=c.find(u=>u.id===ui.chatUid);
  return `<section class="panel"><h2>Tin nhắn khách hàng</h2><div class="chatwrap">
    <div class="clist">${c.map(u=>{const n=unreadFor('admin',u.id),l=msgsOf(u.id),lm=l[l.length-1];
      return `<button class="${u.id===ui.chatUid?'on':''}" data-act="chatsel" data-id="${u.id}"><span><b>${esc(u.username)}</b><br><small>${lm?esc(lm.text.replace(/\n/g,' ').slice(0,28)):'Chưa có tin nhắn'}</small></span>${n?`<span class="dot">${n}</span>`:''}</button>`}).join('')}</div>
    <div><div class="stock" style="margin-bottom:6px">Đang chat với <b>${esc(cur.username)}</b></div>${chatBox(cur.id,'admin')}</div></div></section>`;
}

/* ===== Giỏ hàng & mua hàng ===== */
const totalHtml=o=>fmt(o.total)+(o.disc?`<br><small>Đã giảm ${DISCOUNT_PCT}% (-${fmt(o.disc)})</small>`:'');
function cartCount(){return Object.values(ui.cart).reduce((t,q)=>t+q,0)}
function cleanCart(){Object.keys(ui.cart).forEach(id=>{if(!db.products.find(p=>p.id===id)||!(ui.cart[id]>0))delete ui.cart[id]})}
function syncCartFromForm(){document.querySelectorAll('#mf input[name^="c_"]').forEach(i=>{const q=parseInt(i.value,10);if(q>0)ui.cart[i.name.slice(2)]=q})}

function openBuy(id){ // thêm món vào giỏ
  const u=me();if(!u){openLogin();return}
  const p=db.products.find(x=>x.id===id);if(!p)return;
  const maxQ=Math.floor(p.stock/STEP_QTY)*STEP_QTY;
  const start=Math.min(Math.max(Math.round((ui.cart[p.id]||MIN_ITEM)/STEP_QTY)*STEP_QTY,MIN_ITEM),maxQ);
  modal('Thêm vào giỏ: '+p.name,`
    <div class="row" style="margin-bottom:12px"><span class="pv2">${pic(p)}</span><div style="flex:1"><b>${esc(p.name)}</b><br><span class="price">${fmt(p.price)}</span> <span class="stock">Còn ${p.stock}</span></div></div>
    <div class="f"><label for="qty">Số lượng</label><input id="qty" name="qty" type="number" min="${MIN_ITEM}" max="${maxQ}" step="${STEP_QTY}" value="${start}" required><small>Mua theo bội số của ${STEP_QTY}: 10, 20, 30, 40… Tối thiểu ${MIN_ITEM} cái mỗi món.</small></div>
    <div class="row"><span>Thành tiền</span><b id="tot" class="price">${fmt(start*p.price)}</b></div>`,
  fd=>{
    const q=parseInt(fd.get('qty'),10);
    if(!(q>=MIN_ITEM))return 'Mỗi món mua tối thiểu '+MIN_ITEM+' cái.';
    if(q%STEP_QTY!==0)return 'Số lượng phải là bội số của '+STEP_QTY+' (10, 20, 30, 40…), không mua số lẻ.';
    if(q>p.stock)return 'Kho chỉ còn '+p.stock+' món.';
    ui.cart[p.id]=q;closeModal();render();toast('Đã thêm '+q+' × '+p.name+' vào giỏ.');
  },'Thêm vào giỏ');
  const qi=$('#qty');qi.addEventListener('input',()=>{const q=Math.max(0,parseInt(qi.value,10)||0);$('#tot').textContent=fmt(q*p.price)});
}

function openCart(){
  const u=me();if(!u){openLogin();return}
  cleanCart();
  const ids=Object.keys(ui.cart);
  if(!ids.length){
    modal('Giỏ hàng',`<div class="empty"><b>🛒</b>Giỏ hàng đang trống. Mỗi món mua tối thiểu ${MIN_ITEM} cái, mỗi đơn tối thiểu ${MIN_ORDER} cái.</div>`,()=>{},'');
    return;
  }
  const rows=ids.map(id=>{const p=db.products.find(x=>x.id===id);return `
    <div class="invrow"><span class="pv2" style="width:44px;height:44px;font-size:28px">${pic(p)}</span>
    <span class="nm"><b>${esc(p.name)}</b><br><small>${fmt(p.price)} · còn ${p.stock}</small></span>
    <input type="number" min="${MIN_ITEM}" max="${Math.floor(p.stock/STEP_QTY)*STEP_QTY}" step="${STEP_QTY}" name="c_${p.id}" value="${ui.cart[id]}" data-price="${p.price}" aria-label="Số lượng ${esc(p.name)}">
    <button type="button" class="btn sm danger" data-act="cdel" data-id="${p.id}" aria-label="Xóa ${esc(p.name)} khỏi giỏ">Xóa</button></div>`}).join('');
  modal('Giỏ hàng',`${rows}<div class="note" id="csum" style="margin-top:12px"></div>
    <div class="row"><span>Số dư của bạn</span><b>${fmt(u.balance)}</b></div>
    <h3 class="ctitle">Thông tin nhận hàng</h3>
    <div class="two"><div class="f"><label for="ch">Kênh liên hệ</label><select id="ch" name="channel"><option value="Zalo">Zalo</option><option value="Facebook" ${(u.contact||{}).channel==='Facebook'?'selected':''}>Facebook</option></select></div>
    <div class="f"><label for="ct">Số Zalo hoặc link Facebook</label><input id="ct" name="contact" required maxlength="200" value="${esc((u.contact||{}).value||'')}"></div></div>
    <div class="f"><label for="nt">Ghi chú giao hàng (tùy chọn)</label><input id="nt" name="note" maxlength="200" placeholder="VD: tên nông trại Hay Day, ID người chơi"><small>Shop sẽ liên hệ bạn qua kênh này để giao vật phẩm.</small></div>
    <div class="notebox"><b>Lưu ý khi mua</b>${notesHtml()}</div>
    <div class="f"><label><input type="checkbox" name="agree" required style="width:auto"> Tôi đã đọc và đồng ý với các lưu ý trên</label></div>`,
  fd=>{
    const lines=[];let qty=0,total=0;
    for(const id of ids){
      const p=db.products.find(x=>x.id===id);if(!p)continue;
      const q=parseInt(fd.get('c_'+id),10);
      if(!(q>=MIN_ITEM))return p.name+': mua tối thiểu '+MIN_ITEM+' cái.';
      if(q%STEP_QTY!==0)return p.name+': số lượng phải là bội số của '+STEP_QTY+' (10, 20, 30…).';
      if(q>p.stock)return p.name+': kho chỉ còn '+p.stock+' món.';
      lines.push({p,q});qty+=q;total+=q*p.price;
    }
    if(qty<MIN_ORDER)return 'Mỗi đơn cần tối thiểu '+MIN_ORDER+' cái. Bạn mới chọn '+qty+', cần thêm '+(MIN_ORDER-qty)+' cái.';
    const ctc={channel:fd.get('channel')==='Facebook'?'Facebook':'Zalo',note:fd.get('note').trim()};
    ctc.value=normContact(ctc.channel,fd.get('contact'));
    const cerr=checkContact(ctc.channel,ctc.value);if(cerr)return cerr;
    if(fd.get('agree')!=='on')return 'Hãy tích vào ô xác nhận đã đọc các lưu ý khi mua.';
    const sub=total,disc=qty>DISCOUNT_QTY?Math.round(sub*DISCOUNT_PCT/100):0;
    total=sub-disc;
    if(total>u.balance)return 'Số dư chưa đủ. Bạn cần thêm '+fmt(total-u.balance)+'. Hãy nạp tiền vào ví.';
    u.balance-=total;
    lines.forEach(({p,q})=>{
      p.stock-=q;
      const cur=u.inv[p.id]||{name:p.name,emoji:p.emoji,qty:0};
      cur.name=p.name;cur.emoji=p.emoji;cur.qty+=q;u.inv[p.id]=cur;
    });
    db.orders.push({id:uid('o'),userId:u.id,username:u.username,items:lines.map(({p,q})=>({pid:p.id,name:p.name,qty:q,price:p.price})),total,sub,disc,contact:ctc,status:'processing',time:Date.now()});
    u.contact={channel:ctc.channel,value:ctc.value};
    const gm=grantMilestones(u);
    sendMsg(u.id,'user','🛒 Đơn mới: '+lines.map(({p,q})=>p.name+' ×'+q).join(', ')+'\nTổng '+qty+' cái, '+fmt(total)+(disc?' (đã giảm '+DISCOUNT_PCT+'%: -'+fmt(disc)+')':'')+'\nNhận hàng qua '+ctc.channel+': '+ctc.value+(ctc.note?'\nGhi chú: '+ctc.note:''));
    ui.cart={};save();closeModal();render();toast('Đặt hàng thành công. Shop sẽ liên hệ bạn qua '+ctc.channel+'.'+(gm?' Bạn nhận thêm '+gm+' lượt quay!':''));
  },'Đặt hàng');
  const upd=()=>{
    syncCartFromForm();
    let qty=0,sum=0;
    document.querySelectorAll('#mf input[name^="c_"]').forEach(i=>{const q=parseInt(i.value,10)||0;qty+=q;sum+=q*Number(i.dataset.price)});
    const ok=qty>=MIN_ORDER;
    $('#csum').innerHTML='Tổng <b>'+qty+'</b> cái. '+(ok?'Đủ mức tối thiểu '+MIN_ORDER+' cái mỗi đơn.':'Mỗi đơn cần tối thiểu '+MIN_ORDER+' cái, còn thiếu <b>'+(MIN_ORDER-qty)+'</b>.')+(qty>DISCOUNT_QTY
      ?'<br>Tạm tính: '+fmt(sum)+'<br>Giảm '+DISCOUNT_PCT+'% (mua trên '+DISCOUNT_QTY+' cái): <b>-'+fmt(Math.round(sum*DISCOUNT_PCT/100))+'</b><br>Thành tiền: <b>'+fmt(sum-Math.round(sum*DISCOUNT_PCT/100))+'</b>'
      :(qty>0?'<br>Mua thêm <b>'+(DISCOUNT_QTY+STEP_QTY-qty)+'</b> cái để vượt '+DISCOUNT_QTY+' và được giảm '+DISCOUNT_PCT+'%.<br>Thành tiền: <b>'+fmt(sum)+'</b>':''));
    renderHeader();
  };
  $('#mf').addEventListener('input',upd);upd();
  const chs=$('#ch'),setPh=()=>{$('#ct').placeholder=chs.value==='Zalo'?'0912345678':'https://facebook.com/ten-ban'};
  chs.addEventListener('change',setPh);setPh();
}

/* ===== Nạp tiền qua MoMo ===== */
function genCode(){
  const A='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let c;
  do{
    let r;
    try{r=[...crypto.getRandomValues(new Uint8Array(6))]}catch(e){r=Array.from({length:6},()=>Math.floor(Math.random()*256))}
    c=r.map(x=>A[x%A.length]).join('');
  }while(db.topups.some(t=>t.code===c));
  return c;
}
async function copyText(t){
  try{await navigator.clipboard.writeText(t);toast('Đã sao chép: '+t)}
  catch(e){toast('Không tự sao chép được. Hãy bôi đen và chép thủ công.')}
}
function openTopup(){
  const u=me();
  const code=genCode();
  const content=u.username+' '+code;
  const momo=db.settings.momo||'0835203303';
  modal('Nạp tiền qua MoMo',`
    <div class="note"><b>Bước 1.</b> Mở MoMo và chuyển tiền đến số:
      <div class="row" style="margin:8px 0"><span class="price" style="font-size:26px">${esc(momo)}</span><button type="button" class="btn sm sun" data-act="copy" data-text="${esc(momo)}">Sao chép</button></div>
      ${db.settings.momoName?`<small>Chủ tài khoản: ${esc(db.settings.momoName)}</small>`:''}</div>
    <div class="note"><b>Bước 2.</b> Ghi đúng nội dung chuyển tiền:
      <div class="row" style="margin:8px 0"><span class="price" style="font-size:24px;word-break:break-all">${esc(content)}</span><button type="button" class="btn sm sun" data-act="copy" data-text="${esc(content)}">Sao chép</button></div>
      <small>Gồm tên tài khoản và mã ngẫu nhiên của lần nạp này. Ghi sai nội dung thì quản trị viên không đối chiếu được.</small></div>
    <div class="f"><label for="amt">Bước 3. Số tiền đã chuyển (đ)</label><input id="amt" name="amt" type="number" min="1000" step="1000" required placeholder="50000"><small>Bấm “Tôi đã chuyển tiền”, quản trị viên sẽ đối chiếu và cộng vào ví của bạn.</small></div>`,
  fd=>{
    const a=parseInt(fd.get('amt'),10);
    if(!(a>=1000))return 'Số tiền tối thiểu là 1.000đ.';
    db.topups.push({id:uid('t'),userId:u.id,username:u.username,amount:a,note:content,code,method:'MoMo',status:'pending',time:Date.now()});
    save();closeModal();render();toast('Đã gửi yêu cầu nạp tiền. Chờ quản trị viên duyệt.');
  },'Tôi đã chuyển tiền');
}

/* ===== Admin: vật phẩm ===== */
function productForm(p){
  p=p||{emoji:'📦',name:'',cat:CATS[0],price:'',stock:'',desc:''};
  curImg=p.img||'';
  return `
  <div class="f"><label>Hình ảnh</label><div class="imgpick"><div class="pv" id="pv">${p.img?`<img src="${esc(p.img)}" alt="">`:esc(p.emoji)}</div><div><input type="file" id="imgf" accept="image/*" style="display:none"><div class="acts"><button type="button" class="btn sm sun" data-act="pickimg">Tải ảnh lên</button><button type="button" class="btn sm ghost" data-act="rmimg">Bỏ ảnh</button></div><small>JPG, PNG, WebP. Ảnh tự thu nhỏ còn tối đa 480px. Không có ảnh thì dùng emoji.</small></div></div></div>
  <div class="two"><div class="f"><label for="em">Biểu tượng (emoji)</label><input id="em" name="emoji" value="${esc(p.emoji)}" maxlength="4" required></div>
  <div class="f"><label for="ct">Loại</label><select id="ct" name="cat">${CATS.map(c=>`<option ${c===p.cat?'selected':''}>${c}</option>`).join('')}</select></div></div>
  <div class="f"><label for="nm">Tên vật phẩm</label><input id="nm" name="name" value="${esc(p.name)}" required maxlength="60"></div>
  <div class="two"><div class="f"><label for="pr">Giá (đ)</label><input id="pr" name="price" type="number" min="1" step="1" value="${esc(p.price)}" required></div>
  <div class="f"><label for="sk">Tồn kho</label><input id="sk" name="stock" type="number" min="0" value="${esc(p.stock)}" required></div></div>
  <div class="f"><label for="ds">Mô tả</label><textarea id="ds" name="desc" rows="2" maxlength="160">${esc(p.desc)}</textarea></div>`;
}
function readProduct(fd){
  const price=parseInt(fd.get('price'),10),stock=parseInt(fd.get('stock'),10),name=fd.get('name').trim();
  if(!name)return 'Hãy nhập tên vật phẩm.';
  if(!(price>=1))return 'Giá tối thiểu là 1đ.';
  if(!(stock>=0))return 'Tồn kho không hợp lệ.';
  return {emoji:fd.get('emoji').trim()||'📦',img:curImg,name,cat:fd.get('cat'),price,stock,desc:fd.get('desc').trim()};
}
function padd(){
  modal('Thêm vật phẩm',productForm(),fd=>{
    const r=readProduct(fd);if(typeof r==='string')return r;
    db.products.push({id:uid('p'),...r});save();closeModal();render();toast('Đã thêm vật phẩm.');
  },'Thêm vật phẩm');
}
function pedit(id){
  const p=db.products.find(x=>x.id===id);if(!p)return;
  modal('Sửa vật phẩm',productForm(p),fd=>{
    const r=readProduct(fd);if(typeof r==='string')return r;
    Object.assign(p,r);save();closeModal();render();toast('Đã lưu thay đổi.');
  });
}
function pdel(id){
  const p=db.products.find(x=>x.id===id);if(!p)return;
  modal('Xóa vật phẩm',`<p>Xóa <b>${esc(p.name)}</b> khỏi cửa hàng? Vật phẩm đã nằm trong kho khách vẫn được giữ lại.</p>`,()=>{
    db.products=db.products.filter(x=>x.id!==id);save();closeModal();render();toast('Đã xóa vật phẩm.');
  },'Xóa');
}

/* ===== Admin: tài khoản & kho ===== */
function uedit(id){
  const u=db.users.find(x=>x.id===id);if(!u)return;
  const owned=Object.entries(u.inv);
  const addable=db.products.filter(p=>!u.inv[p.id]);
  modal('Sửa tài khoản: '+u.username,`
    <div class="two"><div class="f"><label for="bal">Số dư (đ)</label><input id="bal" name="balance" type="number" min="0" value="${u.balance}" required></div>
    <div class="f"><label for="rl">Vai trò</label><select id="rl" name="role" ${u.id===sess?'disabled':''}><option value="user" ${u.role==='user'?'selected':''}>Khách</option><option value="admin" ${u.role==='admin'?'selected':''}>Quản trị</option></select></div></div>
    <div class="f"><label for="npw">Mật khẩu mới</label><input id="npw" name="npw" type="password" autocomplete="new-password" placeholder="Để trống nếu không đổi"></div>
    ${u.id!==sess?`<div class="f"><label><input type="checkbox" name="locked" style="width:auto" ${u.locked?'checked':''}> Khóa tài khoản này</label></div>`:''}
    <div class="f"><label for="asp">Cộng thêm lượt quay (hiện có ${wheelState(u).spins})</label><input id="asp" name="addspins" type="number" min="0" max="1000" value="0"></div>
    <h3 style="margin:8px 0">Số dư vật phẩm</h3>
    ${owned.length?owned.map(([pid,v])=>`<div class="invrow"><span class="nm">${esc(v.emoji)} ${esc(v.name)}</span><input type="number" min="0" name="inv_${esc(pid)}" value="${v.qty}" aria-label="Số lượng ${esc(v.name)}"></div>`).join(''):'<p class="stock">Chưa có vật phẩm nào.</p>'}
    ${addable.length?`<div class="invrow"><select name="addp" class="nm" style="flex:1;background:var(--bg);border:2px solid var(--line);border-radius:10px;padding:8px"><option value="">+ Thêm vật phẩm…</option>${addable.map(p=>`<option value="${p.id}">${esc(p.emoji)} ${esc(p.name)}</option>`).join('')}</select><input type="number" min="1" name="addq" value="1" aria-label="Số lượng thêm"></div>`:''}`,
  async fd=>{
    const bal=parseInt(fd.get('balance'),10);
    if(!(bal>=0))return 'Số dư không hợp lệ.';
    u.balance=bal;
    const asp=parseInt(fd.get('addspins'),10);if(asp>0&&asp<=1000)wheelState(u).spins+=asp;
    if(u.id!==sess){u.role=fd.get('role');u.locked=fd.get('locked')==='on'}
    const npw=fd.get('npw');
    if(npw){if(npw.length<6)return 'Mật khẩu mới cần ít nhất 6 ký tự.';u.pass=await hash(npw)}
    for(const [pid,v] of Object.entries(u.inv)){
      const q=parseInt(fd.get('inv_'+pid),10);
      if(q>=0)v.qty=q;
    }
    Object.keys(u.inv).forEach(k=>{if(u.inv[k].qty<=0)delete u.inv[k]});
    const ap=fd.get('addp');
    if(ap){const p=db.products.find(x=>x.id===ap);const q=parseInt(fd.get('addq'),10);if(p&&q>=1)u.inv[ap]={name:p.name,emoji:p.emoji,qty:q}}
    save();closeModal();render();toast('Đã cập nhật tài khoản.');
  });
}
function uadd(){
  modal('Tạo tài khoản mới',`
    <div class="f"><label for="un">Tên đăng nhập</label><input id="un" name="un" autocomplete="off" required><small>3–20 ký tự: chữ không dấu, số, dấu gạch dưới.</small></div>
    <div class="f"><label for="pw">Mật khẩu</label><input id="pw" name="pw" type="text" autocomplete="off" required><small>Tối thiểu 6 ký tự. Gửi mật khẩu này cho khách, khách nên tự đổi sau.</small></div>
    <div class="two"><div class="f"><label for="bal">Số dư ban đầu (đ)</label><input id="bal" name="balance" type="number" min="0" step="1" value="0" required></div>
    <div class="f"><label for="rl">Vai trò</label><select id="rl" name="role"><option value="user">Khách</option><option value="admin">Quản trị</option></select></div></div>`,
  async fd=>{
    const un=fd.get('un').trim(),pw=fd.get('pw'),bal=parseInt(fd.get('balance'),10);
    if(!/^[A-Za-z0-9_]{3,20}$/.test(un))return 'Tên đăng nhập phải 3–20 ký tự, chỉ gồm chữ không dấu, số và dấu gạch dưới.';
    if(db.users.some(u=>u.username.toLowerCase()===un.toLowerCase()))return 'Tên đăng nhập này đã tồn tại. Hãy chọn tên khác.';
    if(pw.length<6)return 'Mật khẩu cần ít nhất 6 ký tự.';
    if(!(bal>=0))return 'Số dư ban đầu không hợp lệ.';
    db.users.push({id:uid('u'),username:un,pass:await hash(pw),role:fd.get('role')==='admin'?'admin':'user',balance:bal,locked:false,inv:{},created:Date.now()});
    save();closeModal();render();toast('Đã tạo tài khoản '+un+'.');
  },'Tạo tài khoản');
}
function udel(id){
  const u=db.users.find(x=>x.id===id);if(!u)return;
  modal('Xóa tài khoản',`<p>Xóa vĩnh viễn tài khoản <b>${esc(u.username)}</b>, kèm số dư và kho vật phẩm của họ?</p>`,()=>{
    db.users=db.users.filter(x=>x.id!==id);save();closeModal();render();toast('Đã xóa tài khoản.');
  },'Xóa tài khoản');
}

/* ===== Ảnh vật phẩm ===== */
let curImg='';
function setPv(){const pv=$('#pv');if(!pv)return;pv.innerHTML=curImg?`<img src="${esc(curImg)}" alt="">`:esc(($('#em')&&$('#em').value)||'📦')}
function fileToImg(file){
  return new Promise((res,rej)=>{
    if(!file||!file.type.startsWith('image/'))return rej(new Error('type'));
    if(file.size>10*1024*1024)return rej(new Error('size'));
    const fr=new FileReader();
    fr.onerror=()=>rej(new Error('read'));
    fr.onload=()=>{
      const im=new Image();
      im.onerror=()=>rej(new Error('load'));
      im.onload=()=>{
        const M=480,s=Math.min(1,M/Math.max(im.width,im.height));
        const c=document.createElement('canvas');c.width=Math.max(1,Math.round(im.width*s));c.height=Math.max(1,Math.round(im.height*s));
        c.getContext('2d').drawImage(im,0,0,c.width,c.height);
        let d=c.toDataURL('image/webp',0.82);
        if(!d.startsWith('data:image/webp'))d=c.toDataURL('image/jpeg',0.85);
        res(d);
      };
      im.src=fr.result;
    };
    fr.readAsDataURL(file);
  });
}
document.addEventListener('change',async e=>{
  if(e.target.id!=='imgf')return;
  const f=e.target.files&&e.target.files[0];if(!f)return;
  try{curImg=await fileToImg(f);setPv();const m=$('#merr');if(m)m.innerHTML=''}
  catch(err){const m=$('#merr');if(m)m.innerHTML='<div class="err">'+(err.message==='size'?'Ảnh quá lớn. Chọn ảnh dưới 10 MB.':'Không đọc được tệp này. Hãy chọn ảnh JPG, PNG hoặc WebP.')+'</div>'}
  e.target.value='';
});
document.addEventListener('input',e=>{if(e.target.id==='em'&&!curImg)setPv()});

/* ===== Điều khiển sự kiện ===== */
document.addEventListener('click',e=>{
  const b=e.target.closest('[data-act]');if(!b)return;
  const a=b.dataset.act,id=b.dataset.id;
  if(a==='ovclose'){if(e.target===b)closeModal();return}
  switch(a){
    case 'close':closeModal();break;
    case 'pickimg':{const f=$('#imgf');if(f)f.click();break}
    case 'rmimg':curImg='';setPv();break;
    case 'nav':ui.view=id;render();window.scrollTo(0,0);break;
    case 'cat':ui.cat=id;render();break;
    case 'tab':ui.tab=id;render();break;
    case 'login':openLogin();break;
    case 'register':openRegister();break;
    case 'logout':ui.cart={};sess=null;lsDel(SKEY);ui.view='shop';render();toast('Đã đăng xuất.');break;
    case 'buy':openBuy(id);break;
    case 'cart':openCart();break;
    case 'ocancel':openCancel(id);break;
    case 'spin':doSpin();break;
    case 'wadd':wadd();break;
    case 'wedit':wedit(id);break;
    case 'wdel':wdel(id);break;
    case 'weven':weven();break;
    case 'msave':saveMilestones();break;
    case 'chatsel':ui.chatUid=id;render();break;
    case 'ostat':{
      const o=db.orders.find(x=>x.id===id);if(!o||o.status==='cancelled')break;
      o.status=o.status==='done'?'processing':'done';
      const sum=o.items.map(i=>i.name+' ×'+i.qty).join(', ');
      sendMsg(o.userId,'admin',o.status==='done'?'✅ Đơn của bạn ('+sum+') đã giao thành công. Cảm ơn bạn đã mua hàng!':'⏳ Đơn của bạn ('+sum+') đang được xử lý lại.');
      save();render();toast(o.status==='done'?'Đã đánh dấu đơn thành công.':'Đã chuyển đơn về đang xử lý.');break}
    case 'chatwith':ui.view='admin';ui.tab='chat';ui.chatUid=id;render();window.scrollTo(0,0);break;
    case 'send':{
      const inp=$('#chatin');const text=inp?inp.value.trim():'';if(!text)break;
      const adminMode=isAdmin()&&ui.view==='admin';
      const cid=adminMode?id:(me()||{}).id;if(!cid)break;
      sendMsg(cid,adminMode?'admin':'user',text.slice(0,500));save();render();
      const n=$('#chatin');if(n)n.focus();break}
    case 'cdel':syncCartFromForm();delete ui.cart[id];render();openCart();break;
    case 'topup':openTopup();break;
    case 'padd':padd();break;
    case 'pedit':pedit(id);break;
    case 'pdel':pdel(id);break;
    case 'uedit':uedit(id);break;
    case 'udel':udel(id);break;
    case 'uadd':uadd();break;
    case 'tok':{
      const t=db.topups.find(x=>x.id===id),u=t&&db.users.find(x=>x.id===t.userId);
      if(t&&t.status==='pending'){
        t.status='approved';let gn=0;
        if(u){u.balance+=t.amount;gn=grantMilestones(u);if(gn)sendMsg(u.id,'admin','🎁 Chúc mừng! Bạn đạt mốc thưởng và nhận thêm '+gn+' lượt quay. Vào mục Vòng quay để quay nhé.')}
        save();render();toast('Đã cộng '+fmt(t.amount)+' cho '+t.username+(gn?'. Khách nhận thêm '+gn+' lượt quay.':''));
      }
      break}
    case 'tno':{const t=db.topups.find(x=>x.id===id);if(t&&t.status==='pending'){t.status='rejected';save();render();toast('Đã từ chối yêu cầu.')}break}
    case 'bank':{const n=$('#mno').value.trim();if(!/^0\d{9}$/.test(n)){toast('Số MoMo cần 10 chữ số, bắt đầu bằng 0.');break}db.settings.momo=n;db.settings.momoName=$('#mnm').value.trim();save();toast('Đã lưu thông tin MoMo.');break}
    case 'copy':copyText(b.dataset.text);break;
    case 'notes':{const v=$('#notes').value.trim();if(!v){toast('Cần có ít nhất một lưu ý.');break}db.settings.notes=v.slice(0,1500);save();toast('Đã lưu lưu ý khi mua.');break}
    case 'reset':
      modal('Khôi phục dữ liệu mẫu',`<p>Toàn bộ tài khoản, đơn hàng và vật phẩm sẽ bị xóa. Việc này không hoàn tác được.</p>`,async()=>{
        lsDel(KEY);lsDel(SKEY);closeModal();await init();toast('Đã khôi phục dữ liệu mẫu.');
      },'Xóa và khôi phục');break;
  }
});
document.addEventListener('input',e=>{
  if(e.target.id==='q'){ui.q=e.target.value;const pos=e.target.selectionStart;render();const q=$('#q');if(q){q.focus();q.setSelectionRange(pos,pos)}}
});
document.addEventListener('change',e=>{if(e.target.id==='sort'){ui.sort=e.target.value;render()}});

document.addEventListener('keydown',e=>{
  if(e.key==='Enter'&&e.target.id==='chatin'){e.preventDefault();const b=document.querySelector('[data-act="send"]');if(b)b.click()}
});
/* Nhiều tab cùng trình duyệt: cập nhật khi tab khác thay đổi dữ liệu */
window.addEventListener('storage',e=>{
  if(e.key!==KEY||!e.newValue)return;
  try{
    db=JSON.parse(e.newValue);
    if(document.querySelector('#mf'))return;
    const ci=$('#chatin'),v=ci?ci.value:'';
    render();
    const n=$('#chatin');if(n&&v){n.value=v;n.focus()}
  }catch(err){}
});

init();
const SUPABASE_URL = 'YOUR_SUPABASE_URL';
const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY';
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const { data: products } = await supabase.from('products').select('*');