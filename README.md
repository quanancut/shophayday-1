# Kho Làng Hay Day – web shop vật phẩm (bản demo)

Web tĩnh, không cần cài đặt thư viện. Dữ liệu lưu trong **localStorage** của trình duyệt.

## Cấu trúc
- `index.html` – khung trang
- `style.css` – giao diện (có chế độ sáng/tối tự động)
- `app.js` – toàn bộ logic: tài khoản, vật phẩm, giỏ hàng, giảm giá, nạp tiền MoMo, chat, trạng thái/hủy đơn, vòng quay theo mốc

## Chạy trong VS Code
1. Mở thư mục này bằng VS Code (`File > Open Folder`).
2. Cài extension **Live Server** (VS Code sẽ gợi ý sẵn).
3. Chuột phải `index.html` → **Open with Live Server** (mở `http://127.0.0.1:5500`).

Hoặc dùng terminal:
```
python -m http.server 8000
```
rồi vào `http://localhost:8000`.

## Tài khoản mẫu
`admin` / `admin123` (đổi mật khẩu ngay trong Quản trị → Tài khoản → Sửa).

## Cấu hình nhanh trong `app.js`
| Hằng số | Ý nghĩa | Mặc định |
|---|---|---|
| `MIN_ITEM` / `STEP_QTY` | Mua tối thiểu mỗi món / bước nhảy số lượng | 10 / 10 |
| `MIN_ORDER` | Tối thiểu mỗi đơn (cái) | 100 |
| `DISCOUNT_QTY` / `DISCOUNT_PCT` | Mua trên bao nhiêu cái / % giảm | 1000 / 10 |
| `db.settings.momo` | Số MoMo nhận tiền (sửa trong Quản trị → Cài đặt) | 0835203303 |

Phần thưởng, tỉ lệ và các mốc lượt quay chỉnh trong **Quản trị → Vòng quay**.

## Lưu ý
- Dữ liệu chỉ nằm trong từng trình duyệt: khách khác nhau **không** thấy dữ liệu của nhau, và người dùng có thể tự sửa dữ liệu. Chỉ phù hợp để demo/test.
- Muốn chạy thật cần backend + cơ sở dữ liệu (ví dụ Supabase hoặc Node.js + PostgreSQL), mọi tính toán số dư, tồn kho, giảm giá, vòng quay phải do server xử lý.
- Xóa dữ liệu test: Quản trị → Cài đặt → "Xóa toàn bộ và khôi phục dữ liệu mẫu".
