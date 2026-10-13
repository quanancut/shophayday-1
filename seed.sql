-- Dữ liệu mẫu ban đầu (chạy một lần khi tạo CSDL mới hoặc khi bấm "Khôi phục dữ liệu mẫu").
-- Tài khoản admin / admin123 được app.py tạo riêng vì cần băm mật khẩu.
BEGIN;

INSERT INTO settings (key, value) VALUES
  ('seq',         '100'),
  ('momo',        '"0835203303"'),
  ('momoName',    '""'),
  ('notes',       '"Vui lòng kiểm tra tin nhắn Zalo/Facebook và mục Chat với shop khi cửa hàng liên hệ với bạn.\nNhập đúng số Zalo hoặc link Facebook, ghi rõ tên nông trại hoặc ID Hay Day ở ô ghi chú để shop giao đúng người.\nTheo dõi tình trạng đơn tại Ví & đơn hàng: Đang xử lý, sau đó chuyển sang Thành công khi shop giao xong."'),
  ('milestones',  '[20000, 50000, 100000]'),
  ('milestoneBy', '"topup"');

INSERT INTO products (id, emoji, name, cat, price, stock, descr, sort) VALUES
  ('p1',       '🪙', 'Gói 10.000 xu',       'Tiền tệ',     25000,  50, 'Xu trong game, giao ngay sau khi xác nhận.',  1),
  ('p2',       '💎', 'Gói 50 kim cương',    'Tiền tệ',     60000,  30, 'Dùng mở rộng đất, mua máy móc, tăng tốc.',    2),
  ('p3',       '🪓', 'Rìu',                 'Công cụ',      3000, 200, 'Chặt cây, mở khu đất mới.',                    3),
  ('p4',       '🪚', 'Cưa',                 'Công cụ',      3000, 200, 'Cưa gỗ ở các khu đất cần dọn.',               4),
  ('p5',       '🧨', 'Thuốc nổ',            'Công cụ',      4000, 150, 'Phá đá trong hầm mỏ.',                         5),
  ('p6',       '💣', 'TNT',                 'Công cụ',      5000, 120, 'Phá đá lớn, khai thác nhanh hơn.',             6),
  ('p7',       '🔨', 'Búa',                 'Công cụ',      3500, 100, 'Dùng để mở rộng khu mỏ.',                      7),
  ('p8',       '📜', 'Giấy chứng nhận đất', 'Công cụ',      6000,  80, 'Mở rộng thêm đất canh tác.',                   8),
  ('p9',       '🪵', 'Ván gỗ',              'Nguyên liệu',  2000, 300, 'Nâng cấp kho, nhà máy.',                       9),
  ('p10',      '🌾', 'Lúa mì (100)',        'Nguyên liệu',  8000,  60, 'Gói 100 lúa mì cho máy làm bánh.',            10),
  ('p11',      '🌽', 'Ngô (100)',           'Nguyên liệu',  8000,  60, 'Gói 100 ngô cho thức ăn gia súc.',            11),
  ('p12',      '🍞', 'Bánh mì (20)',        'Sản phẩm',    12000,  40, 'Gói 20 ổ bánh mì cho đơn hàng xe tải.',       12),
  ('p13',      '🥛', 'Sữa (20)',            'Sản phẩm',    12000,  40, 'Gói 20 chai sữa từ bò.',                      13),
  ('p14',      '🥚', 'Trứng (30)',          'Sản phẩm',    10000,   0, 'Gói 30 trứng gà. Đang hết hàng.',             14),
  ('p_shovel', '⛏️', 'Xẻng',                'Công cụ',      3000, 200, 'Dọn đất, mở rộng khu canh tác.',              15);

INSERT INTO wheel_prizes (id, product_id, name, emoji, pct, qty, sort) VALUES
  ('w1', 'p3',       'Rìu',  '🪓', 34, 50, 1),
  ('w2', 'p4',       'Cưa',  '🪚', 33, 50, 2),
  ('w3', 'p_shovel', 'Xẻng', '⛏️', 33, 50, 3);

COMMIT;
