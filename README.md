# Kho Làng Hay Day – web shop vật phẩm

Máy chủ **Python (Flask)** + CSDL **SQLite**. Mọi tính toán tiền, tồn kho, giảm giá, vòng quay đều do server xử lý.

## Chạy
**Bấm đúp `run.bat`.** Trình duyệt tự mở `http://localhost:8000`.

`run.bat` tự làm hết:
1. Tìm Python: dùng `.venv` hoặc `python\` có sẵn trong thư mục; nếu không có thì dùng Python cài trên máy (≥ 3.9) để tạo `.venv`; nếu máy không có Python thì **tự tải Python portable** vào thư mục `python\` (không cài vào Windows).
2. Kiểm tra thư viện (Flask, Waitress), thiếu thì tự cài.
3. Chạy server **ngầm** (không có cửa sổ). Cửa sổ đen tự đóng sau vài giây, web vẫn chạy.
   Server đang chạy rồi mà bấm `run.bat` lần nữa thì chỉ mở trình duyệt.

**Tắt server:** bấm đúp `stop.bat`. (Tắt máy tính thì server cũng tắt; mở lại bằng `run.bat`.)

Thông báo/lỗi của server ghi vào `data\server.log`.
Muốn chạy trong cửa sổ để xem lỗi trực tiếp: mở cmd tại thư mục này, gõ `run.bat console`.

Lần chạy đầu cần Internet. Từ lần sau chạy offline được.

**Tài khoản quản trị mặc định:** `admin` / `admin123` – đổi mật khẩu ngay trong Quản trị → Tài khoản → Sửa.

## Chép sang máy khác
Chép cả thư mục. Không cần chép `.venv\` (nếu chép, run.bat tự phát hiện và tạo lại).
Chép kèm `python\` thì máy mới không cần tải lại Python.
Muốn mang theo dữ liệu thì chép kèm thư mục `data\` và `uploads\` (nhớ **tắt server trước khi chép**).

## Cấu trúc
| Đường dẫn | Nội dung |
|---|---|
| `run.bat` | Chạy app ngầm (tự cài đặt) |
| `stop.bat` | Tắt server |
| `app.py` | Server: API, đăng nhập, nghiệp vụ |
| `schema.sql` | Cấu trúc các bảng SQLite |
| `seed.sql` | Dữ liệu mẫu ban đầu (15 vật phẩm, vòng quay, cài đặt) |
| `config.ini` | Cổng, địa chỉ, tự mở trình duyệt |
| `static\` | Giao diện (HTML, CSS, JS) |
| `data\hayday.db` | **CSDL – toàn bộ dữ liệu thật** (tự tạo lần đầu) |
| `data\secret.key` | Khóa phiên đăng nhập (tự tạo; xóa thì mọi người phải đăng nhập lại) |
| `uploads\` | Ảnh vật phẩm |
| `_ban_cu_localstorage\` | Bản cũ chạy bằng localStorage, giữ để đối chiếu, có thể xóa |

## Sao lưu
Tắt server, chép `data\hayday.db` và `uploads\` ra chỗ khác. Khôi phục: chép ngược lại.
Mở/xem CSDL bằng [DB Browser for SQLite](https://sqlitebrowser.org/) hoặc extension *SQLite Viewer* trong VS Code.

## Chuyển dữ liệu từ bản cũ (localStorage)
1. Mở bản cũ trên đúng trình duyệt đã dùng trước đây (ví dụ Live Server `http://127.0.0.1:5500`, thư mục `_ban_cu_localstorage`).
2. Bấm F12 → tab **Console**, gõ: `copy(localStorage.getItem('hayday_shop_v1'))` rồi Enter.
3. Tạo file `du_lieu_cu.json` trong thư mục này, dán (Ctrl+V) vào, lưu lại.
4. Tắt server nếu đang chạy, bấm đúp `nhap_du_lieu_cu.bat`, gõ `yes` để xác nhận.

Dữ liệu trong `data\hayday.db` sẽ bị **thay thế**. Mật khẩu cũ của khách vẫn đăng nhập được.

## Cấu hình
`config.ini`:
- `port` – đổi nếu cổng 8000 bị phần mềm khác chiếm.
- `host = 0.0.0.0` – cho điện thoại/máy khác cùng WiFi vào bằng `http://<IP-máy-này>:8000` (có thể phải cho phép qua Windows Firewall).

Quy tắc bán hàng (tối thiểu mỗi món/mỗi đơn, bước số lượng, giảm giá) nằm ở biến `RULES` đầu file `app.py`.
Số MoMo, lưu ý khi mua, phần thưởng vòng quay và các mốc chỉnh trong trang **Quản trị**.

## Ghi chú khi lên VPS sau này
- Dùng `waitress` sẵn có (hoặc gunicorn trên Linux) phía sau Nginx, bật HTTPS.
- Khi chạy HTTPS, thêm `SESSION_COOKIE_SECURE=True` trong `app.config` ở `app.py`.
- Sao lưu `data\` và `uploads\` định kỳ.
