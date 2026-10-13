"""Kho Làng Hay Day – máy chủ web (Flask + SQLite).

Chạy bằng run.bat, hoặc: python app.py
Mọi tính toán tiền, tồn kho, giảm giá, vòng quay đều làm ở đây, trình duyệt chỉ hiển thị.
"""
import base64
import configparser
import hashlib
import json
import logging
import os
import re
import secrets
import signal
import socket
import sqlite3
import sys
import threading
import time
import urllib.request
import webbrowser
from contextlib import contextmanager

from flask import Flask, g, jsonify, request, send_from_directory, session
from werkzeug.security import check_password_hash, generate_password_hash

BASE = os.path.dirname(os.path.abspath(__file__))
STATIC = os.path.join(BASE, 'static')
DATA = os.path.join(BASE, 'data')
UPLOADS = os.path.join(BASE, 'uploads')
DB_PATH = os.path.join(DATA, 'hayday.db')

# Quy tắc bán hàng – gửi kèm cho trình duyệt để hiển thị khớp với server
RULES = dict(DISCOUNT_QTY=1000, DISCOUNT_PCT=10, MIN_ITEM=10, MIN_ORDER=100, STEP_QTY=10,
             CATS=['Tiền tệ', 'Công cụ', 'Nguyên liệu', 'Sản phẩm'])
MAX_PRIZES = 12
FB_RE = re.compile(r'^https?://((www|m|web|mbasic)\.)?(facebook\.com|fb\.com|fb\.me|m\.me)/\S+$', re.I)
USER_RE = re.compile(r'^[A-Za-z0-9_]{3,20}$')
CODE_ABC = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

app = Flask(__name__, static_folder=STATIC, static_url_path='')
app.json.sort_keys = False
app.json.ensure_ascii = False
app.config.update(MAX_CONTENT_LENGTH=8 * 1024 * 1024, SESSION_COOKIE_HTTPONLY=True,
                  SESSION_COOKIE_SAMESITE='Lax', PERMANENT_SESSION_LIFETIME=30 * 24 * 3600)


class Err(Exception):
    """Lỗi nghiệp vụ: nội dung được hiện thẳng cho người dùng."""


def now():
    return int(time.time() * 1000)


def fmt(n):
    return f'{int(n):,}'.replace(',', '.') + 'đ'


def to_int(v):
    if isinstance(v, bool):
        return None
    if isinstance(v, int):
        return v
    if isinstance(v, float):
        return int(v) if v.is_integer() else None
    try:
        return int(str(v).strip())
    except (TypeError, ValueError):
        return None


def need_int(v, lo, hi, msg):
    n = to_int(v)
    if n is None or n < lo or n > hi:
        raise Err(msg)
    return n


def text(b, key, maxlen):
    return str(b.get(key) or '').strip()[:maxlen]


# ===== CSDL =====
def connect():
    c = sqlite3.connect(DB_PATH, timeout=15, isolation_level=None)
    c.row_factory = sqlite3.Row
    c.execute('PRAGMA foreign_keys=ON')
    return c


def db():
    if 'db' not in g:
        g.db = connect()
    return g.db


@app.teardown_appcontext
def _close_db(_):
    c = g.pop('db', None)
    if c:
        c.close()


@contextmanager
def tx(c=None):
    """Giao dịch ghi: lỗi giữa chừng thì hoàn tác toàn bộ."""
    c = c or db()
    c.execute('BEGIN IMMEDIATE')
    try:
        yield c
    except BaseException:
        c.execute('ROLLBACK')
        raise
    c.execute('COMMIT')


def get_set(c, key, default=None):
    r = c.execute('SELECT value FROM settings WHERE key=?', (key,)).fetchone()
    return json.loads(r[0]) if r else default


def set_set(c, key, value):
    c.execute('INSERT INTO settings(key, value) VALUES(?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value',
              (key, json.dumps(value, ensure_ascii=False)))


def new_id(c, prefix):
    n = get_set(c, 'seq', 100) + 1
    set_set(c, 'seq', n)
    return f'{prefix}{n}'


def read_file(name):
    with open(os.path.join(BASE, name), encoding='utf-8') as f:
        return f.read()


def ensure_admin(c):
    if c.execute("SELECT 1 FROM users WHERE role='admin'").fetchone():
        return
    with tx(c):
        c.execute('INSERT INTO users(id, username, pass_hash, role, created_at) VALUES(?, ?, ?, ?, ?)',
                  (new_id(c, 'u'), 'admin', generate_password_hash('admin123'), 'admin', now()))
    print('  Da tao tai khoan quan tri: admin / admin123 (hay doi mat khau ngay)')


TABLES = ['order_items', 'orders', 'inventory', 'milestone_claims', 'spin_history', 'messages',
          'topups', 'wheel_prizes', 'products', 'users', 'settings']


def wipe_and_seed(c):
    with tx(c):
        for t in TABLES:
            c.execute(f'DELETE FROM {t}')
    c.executescript(read_file('seed.sql'))
    ensure_admin(c)


def init_db():
    os.makedirs(DATA, exist_ok=True)
    os.makedirs(UPLOADS, exist_ok=True)
    c = connect()
    try:
        c.execute('PRAGMA journal_mode=WAL')
        c.executescript(read_file('schema.sql'))
        if get_set(c, 'seq') is None:
            c.executescript(read_file('seed.sql'))
            print('  Da tao CSDL moi voi du lieu mau.')
        ensure_admin(c)
    finally:
        c.close()


def load_secret_key():
    p = os.path.join(DATA, 'secret.key')
    if not os.path.exists(p):
        with open(p, 'w') as f:
            f.write(secrets.token_hex(32))
    with open(p) as f:
        return f.read().strip()


# ===== Ảnh vật phẩm =====
IMG_PATH_RE = re.compile(r'^/uploads/[a-f0-9]{32}\.(webp|jpg|png)$')
IMG_DATA_RE = re.compile(r'^data:image/(webp|jpeg|png);base64,([A-Za-z0-9+/=]+)$')


def save_img(data):
    """Nhận data URL từ trình duyệt, lưu thành file trong uploads/ và trả về đường dẫn."""
    data = str(data or '')
    if not data:
        return ''
    if IMG_PATH_RE.match(data) and os.path.exists(os.path.join(UPLOADS, data.rsplit('/', 1)[1])):
        return data
    m = IMG_DATA_RE.match(data)
    if not m:
        raise Err('Ảnh không hợp lệ. Hãy chọn ảnh JPG, PNG hoặc WebP.')
    raw = base64.b64decode(m.group(2))
    if len(raw) > 3 * 1024 * 1024:
        raise Err('Ảnh quá lớn.')
    name = secrets.token_hex(16) + '.' + {'webp': 'webp', 'jpeg': 'jpg', 'png': 'png'}[m.group(1)]
    with open(os.path.join(UPLOADS, name), 'wb') as f:
        f.write(raw)
    return '/uploads/' + name


def drop_img_if_unused(c, path):
    if path and IMG_PATH_RE.match(path) and not c.execute('SELECT 1 FROM products WHERE img=?', (path,)).fetchone():
        try:
            os.remove(os.path.join(UPLOADS, path.rsplit('/', 1)[1]))
        except OSError:
            pass


# ===== Tài khoản & phiên đăng nhập =====
def cur_user(c):
    uid = session.get('uid')
    if not uid:
        return None
    u = c.execute('SELECT * FROM users WHERE id=?', (uid,)).fetchone()
    if not u or u['locked']:
        session.pop('uid', None)
        return None
    return u


def check_pw(c, u, pw):
    h = u['pass_hash'] or ''
    if h.startswith('legacy:'):
        # Mật khẩu nhập từ bản cũ (localStorage): kiểm tra theo cách băm cũ rồi nâng cấp
        old = h[7:]
        ok = (secrets.compare_digest(old, hashlib.sha256(('hdshop$' + pw).encode()).hexdigest())
              or secrets.compare_digest(old, 'p:' + base64.b64encode(pw.encode()).decode()))
        if ok:
            c.execute('UPDATE users SET pass_hash=? WHERE id=?', (generate_password_hash(pw), u['id']))
        return ok
    return check_password_hash(h, pw)


def login_as(uid):
    session.clear()
    session.permanent = True
    session['uid'] = uid


# ===== Dữ liệu gửi về trình duyệt =====
def user_dicts(c, rows, everyone):
    ids = [r['id'] for r in rows]
    where, args = ('', ()) if everyone else (' WHERE user_id=?', (ids[0],))
    inv = {i: {} for i in ids}
    claims = {i: [] for i in ids}
    hist = {i: [] for i in ids}
    for r in c.execute('SELECT * FROM inventory' + where + ' ORDER BY rowid', args):
        if r['user_id'] in inv:
            inv[r['user_id']][r['product_id']] = dict(name=r['name'], emoji=r['emoji'], qty=r['qty'])
    for r in c.execute('SELECT * FROM milestone_claims' + where, args):
        if r['user_id'] in claims:
            claims[r['user_id']].append(r['milestone'])
    for r in c.execute('SELECT * FROM spin_history' + where + ' ORDER BY id DESC', args):
        h = hist.get(r['user_id'])
        if h is not None and len(h) < 30:
            h.append(dict(time=r['created_at'], id=r['product_id'], name=r['name'], emoji=r['emoji'], qty=r['qty']))
    return [dict(id=r['id'], username=r['username'], role=r['role'], balance=r['balance'], locked=bool(r['locked']),
                 inv=inv[r['id']], created=r['created_at'],
                 contact=dict(channel=r['contact_channel'], value=r['contact_value']) if r['contact_value'] else None,
                 wheel=dict(spins=r['spins'], used=r['spins_used'], claimed=claims[r['id']], history=hist[r['id']]))
            for r in rows]


def order_dicts(c, where, args):
    items = {}
    for r in c.execute('SELECT oi.* FROM order_items oi JOIN orders o ON o.id=oi.order_id'
                       + where.replace('user_id', 'o.user_id') + ' ORDER BY oi.rowid', args):
        items.setdefault(r['order_id'], []).append(dict(pid=r['product_id'], name=r['name'], qty=r['qty'], price=r['price']))
    return [dict(id=r['id'], userId=r['user_id'], username=r['username'], items=items.get(r['id'], []),
                 total=r['total'], sub=r['sub'], disc=r['disc'],
                 contact=dict(channel=r['contact_channel'], value=r['contact_value'], note=r['contact_note'] or ''),
                 status=r['status'], time=r['created_at'], cancelBy=r['cancel_by'], cancelReason=r['cancel_reason'] or '',
                 cancelTime=r['cancel_at'])
            for r in c.execute('SELECT * FROM orders' + where + ' ORDER BY created_at', args)]


def build_state(c):
    u = cur_user(c)
    settings = {k: get_set(c, k) for k in ('momo', 'momoName', 'notes', 'milestones', 'milestoneBy')}
    settings['wheel'] = [dict(id=r['id'], pid=r['product_id'], name=r['name'], emoji=r['emoji'], pct=r['pct'], qty=r['qty'])
                         for r in c.execute('SELECT * FROM wheel_prizes ORDER BY sort, rowid')]
    products = [dict(id=r['id'], emoji=r['emoji'], img=r['img'], name=r['name'], cat=r['cat'], price=r['price'],
                     stock=r['stock'], desc=r['descr'])
                for r in c.execute('SELECT * FROM products ORDER BY sort, rowid')]
    st = dict(sess=None, rules=RULES, settings=settings, products=products, users=[], orders=[], topups=[], messages=[])
    if not u:
        return st
    admin = u['role'] == 'admin'
    where, args = ('', ()) if admin else (' WHERE user_id=?', (u['id'],))
    rows = c.execute('SELECT * FROM users ORDER BY created_at').fetchall() if admin else [u]
    st.update(
        sess=u['id'],
        users=user_dicts(c, rows, admin),
        orders=order_dicts(c, where, args),
        topups=[dict(id=r['id'], userId=r['user_id'], username=r['username'], amount=r['amount'], note=r['note'],
                     code=r['code'], method=r['method'], status=r['status'], time=r['created_at'])
                for r in c.execute('SELECT * FROM topups' + where + ' ORDER BY created_at', args)],
        messages=[dict(id=r['id'], cid=r['user_id'], **{'from': r['sender']}, text=r['text'], time=r['created_at'],
                       read=bool(r['is_read']))
                  for r in c.execute('SELECT * FROM messages' + where + ' ORDER BY created_at', args)],
    )
    return st


# ===== Nghiệp vụ dùng chung =====
def add_inv(c, uid, pid, name, emoji, qty):
    c.execute('''INSERT INTO inventory(user_id, product_id, name, emoji, qty) VALUES(?, ?, ?, ?, ?)
                 ON CONFLICT(user_id, product_id) DO UPDATE SET qty=qty+excluded.qty, name=excluded.name, emoji=excluded.emoji''',
              (uid, pid, name, emoji, qty))


def take_inv(c, uid, pid, qty):
    r = c.execute('SELECT qty FROM inventory WHERE user_id=? AND product_id=?', (uid, pid)).fetchone()
    if not r:
        return
    if r['qty'] - qty <= 0:
        c.execute('DELETE FROM inventory WHERE user_id=? AND product_id=?', (uid, pid))
    else:
        c.execute('UPDATE inventory SET qty=? WHERE user_id=? AND product_id=?', (r['qty'] - qty, uid, pid))


def send_msg(c, cid, sender, msg):
    c.execute('INSERT INTO messages(id, user_id, sender, text, is_read, created_at) VALUES(?, ?, ?, ?, 0, ?)',
              (new_id(c, 'm'), cid, sender, msg, now()))


def milestone_value(c, uid):
    if get_set(c, 'milestoneBy') == 'spent':
        r = c.execute("SELECT COALESCE(SUM(total), 0) FROM orders WHERE user_id=? AND status!='cancelled'", (uid,))
    else:
        r = c.execute("SELECT COALESCE(SUM(amount), 0) FROM topups WHERE user_id=? AND status='approved'", (uid,))
    return r.fetchone()[0]


def grant_milestones(c, uid):
    """Tặng 1 lượt quay cho mỗi mốc khách vừa đạt (mỗi mốc một lần). Trả về số lượt đã tặng."""
    v = milestone_value(c, uid)
    have = {r[0] for r in c.execute('SELECT milestone FROM milestone_claims WHERE user_id=?', (uid,))}
    n = 0
    for m in get_set(c, 'milestones', []):
        if v >= m and m not in have:
            c.execute('INSERT INTO milestone_claims(user_id, milestone) VALUES(?, ?)', (uid, m))
            n += 1
    if n:
        c.execute('UPDATE users SET spins=spins+? WHERE id=?', (n, uid))
    return n


def is_open(o):
    return o['status'] not in ('done', 'cancelled')


def items_text(c, oid):
    return ', '.join(f"{r['name']} ×{r['qty']}" for r in
                     c.execute('SELECT name, qty FROM order_items WHERE order_id=? ORDER BY rowid', (oid,)))


# ===== API =====
ACTIONS = {}


def action(name, auth=None):
    """auth: None = ai cũng gọi được, 'user' = cần đăng nhập, 'admin' = chỉ quản trị."""
    def deco(f):
        ACTIONS[name] = (f, auth)
        return f
    return deco


@app.post('/api/<name>')
def api(name):
    if name not in ACTIONS:
        return jsonify(error='Không tìm thấy chức năng.'), 404
    if not request.is_json:
        return jsonify(error='Yêu cầu không hợp lệ.'), 400
    f, auth = ACTIONS[name]
    body = request.get_json(silent=True)
    if not isinstance(body, dict):
        body = {}
    c = db()
    try:
        u = cur_user(c)
        if auth and not u:
            raise Err('Bạn cần đăng nhập lại.')
        if auth == 'admin' and u['role'] != 'admin':
            raise Err('Bạn không có quyền quản trị.')
        res = f(c, u, body) or {}
    except Err as e:
        return jsonify(error=str(e)), 400
    res['state'] = build_state(c)
    return jsonify(res)


@app.get('/api/state')
def api_state():
    return jsonify(state=build_state(db()))


@app.get('/')
def index():
    return send_from_directory(STATIC, 'index.html')


@app.get('/uploads/<path:name>')
def uploads(name):
    return send_from_directory(UPLOADS, name, max_age=30 * 24 * 3600)


# ----- Đăng ký / đăng nhập -----
@action('register')
def a_register(c, u, b):
    un, pw = text(b, 'un', 40), str(b.get('pw') or '')
    if not USER_RE.match(un):
        raise Err('Tên đăng nhập phải 3–20 ký tự, chỉ gồm chữ không dấu, số và dấu gạch dưới.')
    if len(pw) < 6:
        raise Err('Mật khẩu cần ít nhất 6 ký tự.')
    if pw != str(b.get('pw2') or ''):
        raise Err('Hai mật khẩu chưa khớp.')
    with tx(c):
        if c.execute('SELECT 1 FROM users WHERE username=?', (un,)).fetchone():
            raise Err('Tên đăng nhập này đã có người dùng. Hãy chọn tên khác.')
        uid = new_id(c, 'u')
        c.execute('INSERT INTO users(id, username, pass_hash, role, created_at) VALUES(?, ?, ?, ?, ?)',
                  (uid, un, generate_password_hash(pw), 'user', now()))
    login_as(uid)


@action('login')
def a_login(c, u, b):
    x = c.execute('SELECT * FROM users WHERE username=?', (text(b, 'un', 40),)).fetchone()
    if not x or not check_pw(c, x, str(b.get('pw') or '')):
        time.sleep(0.4)
        raise Err('Sai tên đăng nhập hoặc mật khẩu.')
    if x['locked']:
        raise Err('Tài khoản này đã bị khóa. Liên hệ quản trị viên.')
    login_as(x['id'])


@action('logout')
def a_logout(c, u, b):
    session.clear()


# ----- Mua hàng -----
@action('order', 'user')
def a_order(c, u, b):
    items = b.get('items')
    if not isinstance(items, dict) or not items:
        raise Err('Giỏ hàng đang trống.')
    channel = 'Facebook' if b.get('channel') == 'Facebook' else 'Zalo'
    contact = str(b.get('contact') or '')
    contact = re.sub(r'[\s.\-]', '', contact) if channel == 'Zalo' else contact.strip()
    if channel == 'Zalo' and not re.match(r'^(0|\+84)\d{9,10}$', contact):
        raise Err('Số Zalo chưa đúng. Nhập số điện thoại, ví dụ 0912345678.')
    if channel == 'Facebook' and (len(contact) > 200 or not FB_RE.match(contact)):
        raise Err('Link Facebook chưa đúng. Dán link trang cá nhân, ví dụ https://facebook.com/ten-ban.')
    note = text(b, 'note', 200)
    if b.get('agree') is not True:
        raise Err('Hãy tích vào ô xác nhận đã đọc các lưu ý khi mua.')
    R = RULES
    with tx(c):
        lines, qty, sub = [], 0, 0
        for pid, q in items.items():
            p = c.execute('SELECT * FROM products WHERE id=?', (pid,)).fetchone()
            if not p:
                raise Err('Có vật phẩm không còn bán. Hãy xóa nó khỏi giỏ hàng.')
            q = to_int(q)
            if q is None or q < R['MIN_ITEM']:
                raise Err(f"{p['name']}: mua tối thiểu {R['MIN_ITEM']} cái.")
            if q % R['STEP_QTY']:
                raise Err(f"{p['name']}: số lượng phải là bội số của {R['STEP_QTY']} (10, 20, 30…).")
            if q > p['stock']:
                raise Err(f"{p['name']}: kho chỉ còn {p['stock']} món.")
            lines.append((p, q))
            qty += q
            sub += q * p['price']
        if qty < R['MIN_ORDER']:
            raise Err(f"Mỗi đơn cần tối thiểu {R['MIN_ORDER']} cái. Bạn mới chọn {qty}, cần thêm {R['MIN_ORDER'] - qty} cái.")
        disc = (sub * R['DISCOUNT_PCT'] + 50) // 100 if qty > R['DISCOUNT_QTY'] else 0
        total = sub - disc
        bal = c.execute('SELECT balance FROM users WHERE id=?', (u['id'],)).fetchone()[0]
        if total > bal:
            raise Err(f'Số dư chưa đủ. Bạn cần thêm {fmt(total - bal)}. Hãy nạp tiền vào ví.')
        oid = new_id(c, 'o')
        c.execute('UPDATE users SET balance=balance-?, contact_channel=?, contact_value=? WHERE id=?',
                  (total, channel, contact, u['id']))
        c.execute('''INSERT INTO orders(id, user_id, username, sub, disc, total, contact_channel, contact_value, contact_note,
                     status, created_at) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, 'processing', ?)''',
                  (oid, u['id'], u['username'], sub, disc, total, channel, contact, note, now()))
        for p, q in lines:
            c.execute('UPDATE products SET stock=stock-? WHERE id=?', (q, p['id']))
            c.execute('INSERT INTO order_items(order_id, product_id, name, qty, price) VALUES(?, ?, ?, ?, ?)',
                      (oid, p['id'], p['name'], q, p['price']))
            add_inv(c, u['id'], p['id'], p['name'], p['emoji'], q)
        spins = grant_milestones(c, u['id'])
        send_msg(c, u['id'], 'user',
                 '🛒 Đơn mới: ' + ', '.join(f"{p['name']} ×{q}" for p, q in lines)
                 + f'\nTổng {qty} cái, {fmt(total)}'
                 + (f" (đã giảm {R['DISCOUNT_PCT']}%: -{fmt(disc)})" if disc else '')
                 + f'\nNhận hàng qua {channel}: {contact}' + (f'\nGhi chú: {note}' if note else ''))
    return dict(spins=spins)


@action('order_cancel', 'user')
def a_order_cancel(c, u, b):
    reason = text(b, 'reason', 160)
    with tx(c):
        o = c.execute('SELECT * FROM orders WHERE id=?', (str(b.get('id')),)).fetchone()
        if not o:
            raise Err('Không tìm thấy đơn hàng.')
        by = 'admin' if (b.get('asAdmin') and u['role'] == 'admin') else 'user'
        if by == 'user' and o['user_id'] != u['id']:
            raise Err('Bạn không thể hủy đơn của người khác.')
        if not is_open(o):
            raise Err('Đơn này đã hoàn tất hoặc đã hủy, không thể hủy nữa.')
        exists = c.execute('SELECT 1 FROM users WHERE id=?', (o['user_id'],)).fetchone()
        items = c.execute('SELECT * FROM order_items WHERE order_id=?', (o['id'],)).fetchall()
        if exists:
            c.execute('UPDATE users SET balance=balance+? WHERE id=?', (o['total'], o['user_id']))  # hoàn tiền vào ví
        for i in items:
            if exists:
                take_inv(c, o['user_id'], i['product_id'], i['qty'])  # thu hồi vật phẩm khỏi kho
            c.execute('UPDATE products SET stock=stock+? WHERE id=?', (i['qty'], i['product_id']))  # trả lại tồn kho
        c.execute("UPDATE orders SET status='cancelled', cancel_by=?, cancel_reason=?, cancel_at=? WHERE id=?",
                  (by, reason, now(), o['id']))
        if exists:
            s = items_text(c, o['id'])
            send_msg(c, o['user_id'], by,
                     f"❌ Shop đã hủy đơn của bạn ({s})" + (f'. Lý do: {reason}' if reason else '')
                     + f". Số tiền {fmt(o['total'])} đã hoàn vào ví." if by == 'admin' else
                     f"❌ Mình đã hủy đơn ({s}, {fmt(o['total'])})" + (f'. Lý do: {reason}' if reason else '') + '.')


@action('order_status', 'admin')
def a_order_status(c, u, b):
    with tx(c):
        o = c.execute('SELECT * FROM orders WHERE id=?', (str(b.get('id')),)).fetchone()
        if not o or o['status'] == 'cancelled':
            raise Err('Đơn này đã hủy hoặc không còn tồn tại.')
        st = 'processing' if o['status'] == 'done' else 'done'
        c.execute('UPDATE orders SET status=? WHERE id=?', (st, o['id']))
        if c.execute('SELECT 1 FROM users WHERE id=?', (o['user_id'],)).fetchone():
            s = items_text(c, o['id'])
            send_msg(c, o['user_id'], 'admin',
                     f'✅ Đơn của bạn ({s}) đã giao thành công. Cảm ơn bạn đã mua hàng!' if st == 'done'
                     else f'⏳ Đơn của bạn ({s}) đang được xử lý lại.')
    return dict(status=st)


# ----- Nạp tiền -----
@action('topup_code', 'user')
def a_topup_code(c, u, b):
    while True:
        code = ''.join(secrets.choice(CODE_ABC) for _ in range(6))
        if not c.execute('SELECT 1 FROM topups WHERE code=?', (code,)).fetchone():
            return dict(code=code)


@action('topup', 'user')
def a_topup(c, u, b):
    code = text(b, 'code', 6)
    if not re.match(f'^[{CODE_ABC}]{{6}}$', code):
        raise Err('Mã nạp không hợp lệ, hãy mở lại cửa sổ nạp tiền.')
    amount = need_int(b.get('amount'), 1000, 1_000_000_000, 'Số tiền tối thiểu là 1.000đ.')
    with tx(c):
        if c.execute('SELECT 1 FROM topups WHERE code=?', (code,)).fetchone():
            raise Err('Mã nạp này đã dùng, hãy mở lại cửa sổ nạp tiền.')
        c.execute('''INSERT INTO topups(id, user_id, username, amount, code, note, method, status, created_at)
                     VALUES(?, ?, ?, ?, ?, ?, 'MoMo', 'pending', ?)''',
                  (new_id(c, 't'), u['id'], u['username'], amount, code, f"{u['username']} {code}", now()))


def _topup_pending(c, b):
    t = c.execute('SELECT * FROM topups WHERE id=?', (str(b.get('id')),)).fetchone()
    if not t or t['status'] != 'pending':
        raise Err('Yêu cầu này đã được xử lý.')
    return t


@action('topup_approve', 'admin')
def a_topup_approve(c, u, b):
    with tx(c):
        t = _topup_pending(c, b)
        c.execute("UPDATE topups SET status='approved' WHERE id=?", (t['id'],))
        n = 0
        if c.execute('SELECT 1 FROM users WHERE id=?', (t['user_id'],)).fetchone():
            c.execute('UPDATE users SET balance=balance+? WHERE id=?', (t['amount'], t['user_id']))
            n = grant_milestones(c, t['user_id'])
            if n:
                send_msg(c, t['user_id'], 'admin',
                         f'🎁 Chúc mừng! Bạn đạt mốc thưởng và nhận thêm {n} lượt quay. Vào mục Vòng quay để quay nhé.')
    return dict(spins=n)


@action('topup_reject', 'admin')
def a_topup_reject(c, u, b):
    with tx(c):
        t = _topup_pending(c, b)
        c.execute("UPDATE topups SET status='rejected' WHERE id=?", (t['id'],))


# ----- Vòng quay -----
@action('spin', 'user')
def a_spin(c, u, b):
    with tx(c):
        if c.execute('SELECT spins FROM users WHERE id=?', (u['id'],)).fetchone()[0] < 1:
            raise Err('Bạn chưa có lượt quay.')
        prizes = c.execute('SELECT * FROM wheel_prizes ORDER BY sort, rowid').fetchall()
        if not prizes:
            raise Err('Vòng quay chưa có phần thưởng.')
        tot = sum(p['pct'] for p in prizes)
        r = secrets.randbelow(1_000_000) / 1_000_000 * tot
        k = len(prizes) - 1
        for i, p in enumerate(prizes):
            if r < p['pct']:
                k = i
                break
            r -= p['pct']
        x = prizes[k]
        prod = c.execute('SELECT name, emoji FROM products WHERE id=?', (x['product_id'],)).fetchone()
        name, emoji = (prod['name'], prod['emoji']) if prod else (x['name'], x['emoji'])
        c.execute('UPDATE users SET spins=spins-1, spins_used=spins_used+1 WHERE id=?', (u['id'],))
        add_inv(c, u['id'], x['product_id'], name, emoji, x['qty'])
        c.execute('INSERT INTO spin_history(user_id, product_id, name, emoji, qty, created_at) VALUES(?, ?, ?, ?, ?, ?)',
                  (u['id'], x['product_id'], name, emoji, x['qty'], now()))
        c.execute('''DELETE FROM spin_history WHERE user_id=? AND id NOT IN
                     (SELECT id FROM spin_history WHERE user_id=? ORDER BY id DESC LIMIT 30)''', (u['id'], u['id']))
    return dict(k=k, qty=x['qty'], name=name, emoji=emoji)


@action('wheel_save', 'admin')
def a_wheel_save(c, u, b):
    try:
        pct = round(float(b.get('pct')), 1)
    except (TypeError, ValueError):
        pct = 0
    if not 0 < pct <= 100:
        raise Err('Tỉ lệ phải lớn hơn 0 và không quá 100%.')
    qty = need_int(b.get('qty'), 1, 100000, 'Số lượng thưởng phải từ 1 đến 100.000.')
    with tx(c):
        p = c.execute('SELECT * FROM products WHERE id=?', (str(b.get('pid')),)).fetchone()
        if not p:
            raise Err('Hãy chọn vật phẩm thưởng.')
        wid = b.get('id')
        if wid:
            if not c.execute('UPDATE wheel_prizes SET product_id=?, name=?, emoji=?, pct=?, qty=? WHERE id=?',
                             (p['id'], p['name'], p['emoji'], pct, qty, str(wid))).rowcount:
                raise Err('Không tìm thấy phần thưởng.')
        else:
            if c.execute('SELECT COUNT(*) FROM wheel_prizes').fetchone()[0] >= MAX_PRIZES:
                raise Err(f'Vòng quay tối đa {MAX_PRIZES} phần thưởng.')
            c.execute('''INSERT INTO wheel_prizes(id, product_id, name, emoji, pct, qty, sort)
                         VALUES(?, ?, ?, ?, ?, ?, (SELECT COALESCE(MAX(sort), 0)+1 FROM wheel_prizes))''',
                      (new_id(c, 'w'), p['id'], p['name'], p['emoji'], pct, qty))


@action('wheel_delete', 'admin')
def a_wheel_delete(c, u, b):
    with tx(c):
        if c.execute('SELECT COUNT(*) FROM wheel_prizes').fetchone()[0] <= 2:
            raise Err('Vòng quay cần ít nhất 2 phần thưởng.')
        c.execute('DELETE FROM wheel_prizes WHERE id=?', (str(b.get('id')),))


@action('wheel_even', 'admin')
def a_wheel_even(c, u, b):
    with tx(c):
        ids = [r[0] for r in c.execute('SELECT id FROM wheel_prizes ORDER BY sort, rowid')]
        if not ids:
            return
        each = round(100 / len(ids), 1)
        for i, wid in enumerate(ids):
            c.execute('UPDATE wheel_prizes SET pct=? WHERE id=?',
                      (round(100 - each * (len(ids) - 1), 1) if i == 0 else each, wid))
    return dict(n=len(ids))


@action('milestones', 'admin')
def a_milestones(c, u, b):
    lst = b.get('list')
    if not isinstance(lst, list) or not lst:
        raise Err('Các mốc phải là số nguyên dương, cách nhau bằng dấu phẩy.')
    nums = sorted({need_int(x, 1, 1_000_000_000, 'Các mốc phải là số nguyên dương, cách nhau bằng dấu phẩy.') for x in lst})
    if len(nums) > 20:
        raise Err('Tối đa 20 mốc.')
    with tx(c):
        set_set(c, 'milestones', nums)
        set_set(c, 'milestoneBy', 'spent' if b.get('by') == 'spent' else 'topup')
        n = sum(grant_milestones(c, r[0]) for r in c.execute('SELECT id FROM users').fetchall())
    return dict(granted=n)


# ----- Chat -----
@action('send', 'user')
def a_send(c, u, b):
    msg = text(b, 'text', 500)
    if not msg:
        raise Err('Tin nhắn trống.')
    with tx(c):
        if u['role'] == 'admin':
            cid = str(b.get('cid') or '')
            if not c.execute("SELECT 1 FROM users WHERE id=? AND role!='admin'", (cid,)).fetchone():
                raise Err('Không tìm thấy khách hàng này.')
            send_msg(c, cid, 'admin', msg)
        else:
            send_msg(c, u['id'], 'user', msg)


@action('read', 'user')
def a_read(c, u, b):
    if u['role'] == 'admin':
        c.execute("UPDATE messages SET is_read=1 WHERE user_id=? AND sender='user' AND is_read=0", (str(b.get('cid')),))
    else:
        c.execute("UPDATE messages SET is_read=1 WHERE user_id=? AND sender='admin' AND is_read=0", (u['id'],))


# ----- Admin: vật phẩm -----
@action('product_save', 'admin')
def a_product_save(c, u, b):
    name = text(b, 'name', 60)
    if not name:
        raise Err('Hãy nhập tên vật phẩm.')
    price = need_int(b.get('price'), 1, 1_000_000_000, 'Giá tối thiểu là 1đ.')
    stock = need_int(b.get('stock'), 0, 100_000_000, 'Tồn kho không hợp lệ.')
    cat = b.get('cat') if b.get('cat') in RULES['CATS'] else RULES['CATS'][0]
    emoji = text(b, 'emoji', 8) or '📦'
    desc = text(b, 'desc', 160)
    img = save_img(b.get('img'))
    with tx(c):
        pid = b.get('id')
        if pid:
            old = c.execute('SELECT img FROM products WHERE id=?', (str(pid),)).fetchone()
            if not old:
                raise Err('Không tìm thấy vật phẩm.')
            c.execute('UPDATE products SET emoji=?, img=?, name=?, cat=?, price=?, stock=?, descr=? WHERE id=?',
                      (emoji, img, name, cat, price, stock, desc, str(pid)))
            if old['img'] != img:
                drop_img_if_unused(c, old['img'])
        else:
            c.execute('''INSERT INTO products(id, emoji, img, name, cat, price, stock, descr, sort)
                         VALUES(?, ?, ?, ?, ?, ?, ?, ?, (SELECT COALESCE(MAX(sort), 0)+1 FROM products))''',
                      (new_id(c, 'p'), emoji, img, name, cat, price, stock, desc))


@action('product_delete', 'admin')
def a_product_delete(c, u, b):
    with tx(c):
        p = c.execute('SELECT * FROM products WHERE id=?', (str(b.get('id')),)).fetchone()
        if not p:
            raise Err('Không tìm thấy vật phẩm.')
        c.execute('DELETE FROM products WHERE id=?', (p['id'],))
        drop_img_if_unused(c, p['img'])


# ----- Admin: tài khoản -----
@action('user_add', 'admin')
def a_user_add(c, u, b):
    un, pw = text(b, 'un', 40), str(b.get('pw') or '')
    if not USER_RE.match(un):
        raise Err('Tên đăng nhập phải 3–20 ký tự, chỉ gồm chữ không dấu, số và dấu gạch dưới.')
    if len(pw) < 6:
        raise Err('Mật khẩu cần ít nhất 6 ký tự.')
    bal = need_int(b.get('balance'), 0, 1_000_000_000_000, 'Số dư ban đầu không hợp lệ.')
    with tx(c):
        if c.execute('SELECT 1 FROM users WHERE username=?', (un,)).fetchone():
            raise Err('Tên đăng nhập này đã tồn tại. Hãy chọn tên khác.')
        c.execute('INSERT INTO users(id, username, pass_hash, role, balance, created_at) VALUES(?, ?, ?, ?, ?, ?)',
                  (new_id(c, 'u'), un, generate_password_hash(pw), 'admin' if b.get('role') == 'admin' else 'user', bal, now()))


@action('user_edit', 'admin')
def a_user_edit(c, u, b):
    bal = need_int(b.get('balance'), 0, 1_000_000_000_000, 'Số dư không hợp lệ.')
    npw = str(b.get('npw') or '')
    if npw and len(npw) < 6:
        raise Err('Mật khẩu mới cần ít nhất 6 ký tự.')
    addspins = to_int(b.get('addspins')) or 0
    if not 0 <= addspins <= 1000:
        raise Err('Số lượt quay cộng thêm phải từ 0 đến 1000.')
    with tx(c):
        t = c.execute('SELECT * FROM users WHERE id=?', (str(b.get('id')),)).fetchone()
        if not t:
            raise Err('Không tìm thấy tài khoản.')
        c.execute('UPDATE users SET balance=?, spins=spins+? WHERE id=?', (bal, addspins, t['id']))
        if t['id'] != u['id']:
            c.execute('UPDATE users SET role=?, locked=? WHERE id=?',
                      ('admin' if b.get('role') == 'admin' else 'user', 1 if b.get('locked') else 0, t['id']))
        if npw:
            c.execute('UPDATE users SET pass_hash=? WHERE id=?', (generate_password_hash(npw), t['id']))
        inv = b.get('inv') if isinstance(b.get('inv'), dict) else {}
        for pid, q in inv.items():
            q = to_int(q)
            if q is None or q < 0:
                continue
            if q == 0:
                c.execute('DELETE FROM inventory WHERE user_id=? AND product_id=?', (t['id'], pid))
            else:
                c.execute('UPDATE inventory SET qty=? WHERE user_id=? AND product_id=?', (q, t['id'], pid))
        addp, addq = b.get('addp'), to_int(b.get('addq'))
        if addp and addq and addq >= 1:
            p = c.execute('SELECT * FROM products WHERE id=?', (str(addp),)).fetchone()
            if p:
                add_inv(c, t['id'], p['id'], p['name'], p['emoji'], addq)


@action('user_delete', 'admin')
def a_user_delete(c, u, b):
    uid = str(b.get('id'))
    if uid == u['id']:
        raise Err('Không thể xóa tài khoản đang đăng nhập.')
    with tx(c):
        c.execute('DELETE FROM users WHERE id=?', (uid,))


# ----- Admin: cài đặt -----
@action('settings_momo', 'admin')
def a_settings_momo(c, u, b):
    momo = text(b, 'momo', 20)
    if not re.match(r'^0\d{9}$', momo):
        raise Err('Số MoMo cần 10 chữ số, bắt đầu bằng 0.')
    with tx(c):
        set_set(c, 'momo', momo)
        set_set(c, 'momoName', text(b, 'momoName', 80))


@action('settings_notes', 'admin')
def a_settings_notes(c, u, b):
    notes = text(b, 'notes', 1500)
    if not notes:
        raise Err('Cần có ít nhất một lưu ý.')
    with tx(c):
        set_set(c, 'notes', notes)


@action('reset', 'admin')
def a_reset(c, u, b):
    wipe_and_seed(c)
    for f in os.listdir(UPLOADS):
        try:
            os.remove(os.path.join(UPLOADS, f))
        except OSError:
            pass
    session.clear()


# ===== Khởi động =====
def load_config():
    cfg = configparser.ConfigParser()
    cfg.read(os.path.join(BASE, 'config.ini'), encoding='utf-8')
    s = cfg['server'] if cfg.has_section('server') else {}
    return (s.get('host', '127.0.0.1'), int(s.get('port', 8000)),
            str(s.get('open_browser', 'yes')).lower() in ('1', 'yes', 'true', 'on'))


def setup():
    init_db()
    app.secret_key = load_secret_key()


PID_FILE = os.path.join(DATA, 'server.pid')
LOG_FILE = os.path.join(DATA, 'server.log')


def is_running(host, port):
    """Server của shop đã chạy ở cổng này chưa."""
    h = '127.0.0.1' if host in ('0.0.0.0', 'localhost', '') else host
    try:
        with urllib.request.urlopen(f'http://{h}:{port}/api/state', timeout=2) as r:
            return r.status == 200 and b'"rules"' in r.read()
    except Exception:
        return False


def stop_server(host, port):
    if not is_running(host, port):
        print('May chu dang khong chay.')
        return 0
    try:
        with open(PID_FILE) as f:
            pid = int(f.read().strip())
        os.kill(pid, signal.SIGTERM)
    except (OSError, ValueError):
        print('[LOI] Khong tat duoc may chu. Hay tat tien trinh pythonw.exe trong Task Manager.')
        return 1
    for _ in range(20):
        if not is_running(host, port):
            break
        time.sleep(0.25)
    try:
        os.remove(PID_FILE)
    except OSError:
        pass
    print('Da tat may chu.')
    return 0


def log_to_file():
    """Chạy ngầm không có cửa sổ: ghi thông báo và lỗi vào data/server.log."""
    if os.path.exists(LOG_FILE) and os.path.getsize(LOG_FILE) > 5 * 1024 * 1024:
        os.replace(LOG_FILE, LOG_FILE + '.old')
    f = open(LOG_FILE, 'a', encoding='utf-8', buffering=1)
    sys.stdout = sys.stderr = f
    logging.basicConfig(stream=f, level=logging.INFO, format='%(asctime)s %(levelname)s %(name)s: %(message)s')
    print(f'\n===== {time.strftime("%Y-%m-%d %H:%M:%S")} khoi dong =====')


def main():
    """Tham số: (không) = chạy trong cửa sổ; --background = chạy ngầm; --status; --open; --stop."""
    host, port, open_browser = load_config()
    if os.environ.get('HAYDAY_NO_BROWSER'):
        open_browser = False
    url = f'http://localhost:{port}' if host in ('127.0.0.1', '0.0.0.0', 'localhost') else f'http://{host}:{port}'
    arg = sys.argv[1] if len(sys.argv) > 1 else ''
    if arg == '--status':
        raise SystemExit(0 if is_running(host, port) else 1)
    if arg == '--open':
        webbrowser.open(url)
        return
    if arg == '--stop':
        raise SystemExit(stop_server(host, port))

    os.makedirs(DATA, exist_ok=True)
    if arg == '--background' or sys.stdout is None:
        log_to_file()
    setup()
    if is_running(host, port):
        print(f'  May chu da chay san tai {url}')
        if open_browser:
            webbrowser.open(url)
        return
    with socket.socket() as s:
        try:
            s.bind((host, port))
        except OSError:
            print(f'\n  [LOI] Cong {port} dang bi chuong trinh khac dung. Doi "port" trong config.ini.\n')
            raise SystemExit(1)
    with open(PID_FILE, 'w') as f:
        f.write(str(os.getpid()))
    print(f'\n  Kho Lang Hay Day dang chay tai: {url}')
    print(f'  CSDL: {DB_PATH}\n')
    if open_browser:
        threading.Timer(1.0, lambda: webbrowser.open(url)).start()
    from waitress import serve
    serve(app, host=host, port=port, threads=8)


if __name__ == '__main__':
    main()
