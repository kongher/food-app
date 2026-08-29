# Food App — Quán Ngon

Ứng dụng đặt món theo bàn (QR), không cần đăng nhập.

## Chạy đồng thời Frontend + Backend

Cài đặt (lần đầu):

```bash
npm install
npm install --prefix backend
npm install --prefix frontend
```

Chạy cả hai cổng:

```bash
npm run dev
```

- Backend API: http://localhost:3000
- Frontend khách (bàn 3): http://localhost:5173/table/3
- Trang gốc (không gán bàn): http://localhost:5173/
- Frontend quản trị: http://localhost:5173/admin

Hoặc mở 2 terminal:

```bash
npm run dev --prefix backend
npm run dev --prefix frontend
```

## CORS và Proxy

- Vite (cổng 5173) proxy `/api` → `http://localhost:3000` (xem `frontend/vite.config.ts`).
- Frontend gọi API bằng đường dẫn tương đối `/api/...` nên không dính lỗi CORS khi dev.
- Backend vẫn bật CORS cho `http://localhost:5173` phòng khi gọi thẳng sang cổng 3000.

## API chính

| Method | Đường dẫn | Mô tả |
| --- | --- | --- |
| GET | `/api/menu` | Categories + products đang bán |
| GET | `/api/products` | Tất cả món (kể cả đang ẩn) |
| POST | `/api/products` | Thêm món |
| PUT/PATCH | `/api/products/:id` | Sửa / ẩn-hiện món |
| DELETE | `/api/products/:id` | Xóa món |
| POST | `/api/orders` | Khách đặt món `{ tableNumber, items }` |
| GET | `/api/orders` | Danh sách đơn |
| PATCH | `/api/orders/:id` | `{ status: "completed" }` |
| GET | `/api/orders/stream` | SSE realtime cho quán |
