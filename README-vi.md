# Cloudflare VMails (Tiếng Việt)

> Dịch vụ email tạm thời hiện đại, bảo mật, chạy 100% trên Cloudflare Edge.

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Astro](https://img.shields.io/badge/Astro-5.14-orange.svg)](https://astro.build)
[![Cloudflare](https://img.shields.io/badge/Cloudflare-Workers-orange.svg)](https://workers.cloudflare.com)

Dự án này được lấy cảm hứng từ **[oiov/vmail](https://github.com/oiov/vmail)** và được viết lại hoàn toàn với công nghệ hiện đại hơn.

## ✨ Tính Năng Chính

### Cơ Bản
- 🔒 **Bảo Mật & Riêng Tư** - Không cần đăng ký, ẩn danh mặc định.
- 📧 **Quản Lý Email** - Nhận và xem email tức thì.
- 🔐 **Hộp Thư Đăng Ký** - Tùy chọn đặt mật khẩu cho hộp thư vĩnh viễn.
- 🔍 **Tự Động Bắt OTP** - Tự động trích xuất mã xác thực (OTP) từ email.
- 🌐 **Đa Tên Miền** - Hỗ trợ nhiều đuôi domain khác nhau (Chọn ngẫu nhiên hoặc cố định).
- 🎨 **Giao Diện Hiện Đại** - Tối ưu cho cả Mobile và Desktop (Light/Dark mode).
- ⚡ **Tốc Độ Cao** - Chạy trên mạng lưới toàn cầu của Cloudflare.

### Tính Năng Nâng Cao (V2 & V3)
- 💾 **Lưu Trữ R2** - Tự động lưu file đính kèm và nội dung email vào Cloudflare R2 để tải nhanh hơn.
- 🤖 **Telegram Bot** - Nhận thông báo email qua Telegram, xem nội dung, xóa, và chặn người gửi ngay lập tức.
- 🔄 **Webhook Automation** - Tự động đẩy dữ liệu email tới n8n/Zapier để xử lý tự động hóa.
- 🧹 **Tự Động Dọn Dẹp** - Cron Job chạy hàng giờ để xóa email cũ (Giữ lại 1000 email mới nhất) để tiết kiệm dung lượng.
- 📤 **Gửi Email** - Hỗ trợ gửi email đi thông qua API (tích hợp Resend/SendGrid).
- 📊 **Thống Kê & Quản Lý** - Admin Panel cung cấp biểu đồ thống kê, Export dữ liệu, và quản lý danh sách chặn (Blocklist) theo domain.

## 🏗️ Kiến Trúc

```
┌─────────────────────────────────────────────────────────────┐
35: │                     Cloudflare Edge                          │
36: ├─────────────────────────────────────────────────────────────┤
37: │                                                              │
38: │  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐ │
39: │  │ Email Worker │───▶│  Cloudflare  │◀───│ Astro Pages  │ │
40: │  │ (Receives)   │    │     D1       │    │  (Frontend)  │ │
41: │  └──────────────┘    │  (Storage)   │    └──────────────┘ │
42: │         │            └──────────────┘           │          │
43: │         ▼                   │                   ▼          │
44: │    ┌─────────┐          ┌───────┐          ┌─────────┐    │
45: │    │ R2 Bucke│          │ Cron  │          │ Telegram│    │
46: │    └─────────┘          └───────┘          └─────────┘    │
47: └─────────────────────────────────────────────────────────────┘
```

## 🚀 Cài Đặt Nhanh

### 1. Requirements
- Node.js >= 18
- pnpm >= 8
- Tài khoản Cloudflare (đã add domain).

### 2. Config Environment
Tạo file `apps/emails-worker/wrangler.toml` và cấu hình các biến môi trường:

```toml
[vars]
API_KEY = "mat-khau-quan-tri-cua-ban"
MAIL_DOMAIN = "domain1.com,domain2.com"
MAX_EMAILS = "1000"
WEBHOOK_URL = "https://your-n8n.com/webhook/..."
# ... các config khác
```

### 3. Deploy
```bash
# Deploy Database Schema
wrangler d1 execute vmail-db --file=packages/database/schema.sql

# Deploy Worker
cd apps/emails-worker
pnpm deploy

# Deploy Frontend
cd apps/astro
pnpm deploy
```

## 📚 API Documentation
Xem chi tiết tài liệu API tại [docs/api-docs.md](docs/api-docs.md).
