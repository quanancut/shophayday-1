-- Cấu trúc CSDL SQLite cho Kho Làng Hay Day.
-- Tiền lưu bằng số nguyên (đồng). Thời gian lưu bằng mili-giây Unix (giống Date.now() của JavaScript).

CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL                       -- giá trị dạng JSON
);

CREATE TABLE IF NOT EXISTS users (
  id              TEXT PRIMARY KEY,
  username        TEXT NOT NULL UNIQUE COLLATE NOCASE,
  pass_hash       TEXT NOT NULL,
  role            TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  balance         INTEGER NOT NULL DEFAULT 0 CHECK (balance >= 0),
  locked          INTEGER NOT NULL DEFAULT 0,
  contact_channel TEXT,
  contact_value   TEXT,
  spins           INTEGER NOT NULL DEFAULT 0,  -- lượt quay còn lại
  spins_used      INTEGER NOT NULL DEFAULT 0,  -- lượt đã quay
  created_at      INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS products (
  id     TEXT PRIMARY KEY,
  name   TEXT NOT NULL,
  emoji  TEXT NOT NULL DEFAULT '📦',
  img    TEXT NOT NULL DEFAULT '',            -- đường dẫn /uploads/... hoặc rỗng
  cat    TEXT NOT NULL,
  price  INTEGER NOT NULL CHECK (price > 0),
  stock  INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
  descr  TEXT NOT NULL DEFAULT '',
  sort   INTEGER NOT NULL DEFAULT 0
);

-- Kho vật phẩm của từng khách (giữ tên/emoji để vẫn hiện khi vật phẩm bị xóa khỏi shop)
CREATE TABLE IF NOT EXISTS inventory (
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL,
  name       TEXT NOT NULL,
  emoji      TEXT NOT NULL,
  qty        INTEGER NOT NULL CHECK (qty > 0),
  PRIMARY KEY (user_id, product_id)
);

CREATE TABLE IF NOT EXISTS orders (
  id              TEXT PRIMARY KEY,
  user_id         TEXT NOT NULL,
  username        TEXT NOT NULL,
  sub             INTEGER NOT NULL,           -- tạm tính
  disc            INTEGER NOT NULL DEFAULT 0, -- tiền giảm
  total           INTEGER NOT NULL,           -- thực trả
  contact_channel TEXT,
  contact_value   TEXT,
  contact_note    TEXT,
  status          TEXT NOT NULL DEFAULT 'processing' CHECK (status IN ('processing', 'done', 'cancelled')),
  cancel_by       TEXT,
  cancel_reason   TEXT,
  cancel_at       INTEGER,
  created_at      INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id);

CREATE TABLE IF NOT EXISTS order_items (
  order_id   TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL,
  name       TEXT NOT NULL,
  qty        INTEGER NOT NULL,
  price      INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_items_order ON order_items(order_id);

CREATE TABLE IF NOT EXISTS topups (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL,
  username   TEXT NOT NULL,
  amount     INTEGER NOT NULL CHECK (amount > 0),
  code       TEXT NOT NULL UNIQUE,
  note       TEXT,
  method     TEXT NOT NULL DEFAULT 'MoMo',
  status     TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_topups_user ON topups(user_id);

CREATE TABLE IF NOT EXISTS messages (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,  -- cuộc chat của khách nào
  sender     TEXT NOT NULL CHECK (sender IN ('user', 'admin')),
  text       TEXT NOT NULL,
  is_read    INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_messages_user ON messages(user_id);

CREATE TABLE IF NOT EXISTS wheel_prizes (
  id         TEXT PRIMARY KEY,
  product_id TEXT NOT NULL,
  name       TEXT NOT NULL,
  emoji      TEXT NOT NULL,
  pct        REAL NOT NULL CHECK (pct > 0),
  qty        INTEGER NOT NULL CHECK (qty > 0),
  sort       INTEGER NOT NULL DEFAULT 0
);

-- Mốc tiền khách đã nhận lượt quay (mỗi mốc một lần)
CREATE TABLE IF NOT EXISTS milestone_claims (
  user_id   TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  milestone INTEGER NOT NULL,
  PRIMARY KEY (user_id, milestone)
);

CREATE TABLE IF NOT EXISTS spin_history (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL,
  name       TEXT NOT NULL,
  emoji      TEXT NOT NULL,
  qty        INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_spins_user ON spin_history(user_id);
