"""Nhập dữ liệu từ bản cũ (localStorage) vào CSDL SQLite.

Cách dùng: xem README.md, mục "Chuyển dữ liệu từ bản cũ".
    run.bat import du_lieu_cu.json
LƯU Ý: toàn bộ dữ liệu hiện có trong data/hayday.db sẽ bị thay thế.
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import app as A  # noqa: E402


def main():
    path = sys.argv[1] if len(sys.argv) > 1 and sys.argv[1] else os.path.join(A.BASE, 'du_lieu_cu.json')
    if not os.path.exists(path):
        print(f'[LOI] Khong tim thay file {path}')
        print('      Xem README.md muc "Chuyen du lieu tu ban cu" de lay file nay.')
        return 1
    with open(path, encoding='utf-8-sig') as f:
        raw = f.read().strip()
    old = A.json.loads(raw)
    if isinstance(old, str):  # dán nhầm chuỗi JSON lồng trong chuỗi
        old = A.json.loads(old)
    if not isinstance(old, dict) or 'users' not in old:
        print('[LOI] File khong dung dinh dang du lieu cua shop.')
        return 1

    ans = input('Toan bo du lieu hien co trong data/hayday.db se bi THAY THE. Go "yes" de tiep tuc: ')
    if ans.strip().lstrip('﻿').lower() != 'yes':
        print('Da huy.')
        return 1

    A.init_db()
    c = A.connect()
    A.wipe_and_seed(c)
    s = old.get('settings') or {}
    users = old.get('users') or []
    user_ids = {u['id'] for u in users}
    with A.tx(c):
        c.execute("DELETE FROM users")  # wipe_and_seed tạo sẵn admin mẫu, bỏ đi vì dùng tài khoản cũ
        c.execute('DELETE FROM products')
        c.execute('DELETE FROM wheel_prizes')
        A.set_set(c, 'seq', max(int(old.get('seq') or 100), 100) + 1000)
        for k in ('momo', 'momoName', 'notes', 'milestoneBy'):
            if s.get(k):
                A.set_set(c, k, s[k])
        if isinstance(s.get('milestones'), list) and s['milestones']:
            A.set_set(c, 'milestones', sorted({int(x) for x in s['milestones']}))

        for i, p in enumerate(old.get('products') or [], 1):
            try:
                img = A.save_img(p.get('img')) if str(p.get('img') or '').startswith('data:image/') else ''
            except A.Err:
                img = ''
            c.execute('INSERT INTO products(id, emoji, img, name, cat, price, stock, descr, sort) VALUES(?,?,?,?,?,?,?,?,?)',
                      (p['id'], p.get('emoji') or '📦', img, p['name'], p.get('cat') or A.RULES['CATS'][0],
                       max(1, int(p.get('price') or 1)), max(0, int(p.get('stock') or 0)), p.get('desc') or '', i))

        for i, w in enumerate(s.get('wheel') or [], 1):
            qty = w.get('qty') or round(((w.get('min') or 50) + (w.get('max') or 50)) / 2)
            c.execute('INSERT INTO wheel_prizes(id, product_id, name, emoji, pct, qty, sort) VALUES(?,?,?,?,?,?,?)',
                      (w['id'], w['pid'], w.get('name') or '', w.get('emoji') or '📦', float(w.get('pct') or 1), max(1, int(qty)), i))

        for u in users:
            w = u.get('wheel') or {}
            ct = u.get('contact') or {}
            c.execute('''INSERT INTO users(id, username, pass_hash, role, balance, locked, contact_channel, contact_value,
                         spins, spins_used, created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)''',
                      (u['id'], u['username'], 'legacy:' + str(u.get('pass') or ''), 'admin' if u.get('role') == 'admin' else 'user',
                       max(0, int(u.get('balance') or 0)), 1 if u.get('locked') else 0, ct.get('channel'), ct.get('value'),
                       int(w.get('spins') or 0), int(w.get('used') or 0), int(u.get('created') or A.now())))
            for pid, v in (u.get('inv') or {}).items():
                if int(v.get('qty') or 0) > 0:
                    c.execute('INSERT INTO inventory(user_id, product_id, name, emoji, qty) VALUES(?,?,?,?,?)',
                              (u['id'], pid, v.get('name') or pid, v.get('emoji') or '📦', int(v['qty'])))
            for m in set(w.get('claimed') or []):
                c.execute('INSERT INTO milestone_claims(user_id, milestone) VALUES(?,?)', (u['id'], int(m)))
            for h in reversed(w.get('history') or []):
                c.execute('INSERT INTO spin_history(user_id, product_id, name, emoji, qty, created_at) VALUES(?,?,?,?,?,?)',
                          (u['id'], h.get('id') or '', h.get('name') or '', h.get('emoji') or '', int(h.get('qty') or 0), int(h.get('time') or 0)))

        for o in old.get('orders') or []:
            ct = o.get('contact') or {}
            c.execute('''INSERT INTO orders(id, user_id, username, sub, disc, total, contact_channel, contact_value, contact_note,
                         status, cancel_by, cancel_reason, cancel_at, created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)''',
                      (o['id'], o['userId'], o.get('username') or '', int(o.get('sub') or o.get('total') or 0), int(o.get('disc') or 0),
                       int(o.get('total') or 0), ct.get('channel'), ct.get('value'), ct.get('note') or '',
                       o.get('status') if o.get('status') in ('processing', 'done', 'cancelled') else 'processing',
                       o.get('cancelBy'), o.get('cancelReason') or '', o.get('cancelTime'), int(o.get('time') or 0)))
            for it in o.get('items') or []:
                c.execute('INSERT INTO order_items(order_id, product_id, name, qty, price) VALUES(?,?,?,?,?)',
                          (o['id'], it['pid'], it.get('name') or '', int(it['qty']), int(it.get('price') or 0)))

        for i, t in enumerate(old.get('topups') or []):
            c.execute('''INSERT INTO topups(id, user_id, username, amount, code, note, method, status, created_at)
                         VALUES(?,?,?,?,?,?,?,?,?)''',
                      (t['id'], t['userId'], t.get('username') or '', max(1, int(t.get('amount') or 1)),
                       t.get('code') or f'OLD{i:05d}', t.get('note') or '', t.get('method') or 'MoMo',
                       t.get('status') if t.get('status') in ('pending', 'approved', 'rejected') else 'pending', int(t.get('time') or 0)))

        for m in old.get('messages') or []:
            if m.get('cid') in user_ids:
                c.execute('INSERT INTO messages(id, user_id, sender, text, is_read, created_at) VALUES(?,?,?,?,?,?)',
                          (m['id'], m['cid'], 'admin' if m.get('from') == 'admin' else 'user', m.get('text') or '',
                           1 if m.get('read') else 0, int(m.get('time') or 0)))
    A.ensure_admin(c)
    n = {t: c.execute(f'SELECT COUNT(*) FROM {t}').fetchone()[0] for t in ('users', 'products', 'orders', 'topups', 'messages')}
    c.close()
    print(f"Da nhap xong: {n['users']} tai khoan, {n['products']} vat pham, {n['orders']} don hang, "
          f"{n['topups']} lan nap, {n['messages']} tin nhan.")
    print('Mat khau cu van dang nhap duoc (he thong tu nang cap cach ma hoa o lan dang nhap dau tien).')
    return 0


if __name__ == '__main__':
    sys.exit(main())
