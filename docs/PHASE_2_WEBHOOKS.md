# Hướng Dẫn Sử Dụng & Kế Hoạch Test - Phase 2: Webhooks

Tài liệu này hướng dẫn cách cấu hình và kiểm thử tính năng Webhook (Tự động hóa) vừa được triển khai.

## 1. Tổng Quan
Tính năng Webhook cho phép Cloudflare Worker tự động gửi dữ liệu email đến (JSON) tới một URL bên ngoài (ví dụ: n8n, Zapier) ngay khi nhận được email. Điều này giúp kích hoạt các quy trình tự động hóa (lưu trữ, phân loại với AI, thông báo...).

## 2. Cấu Hình
Để kích hoạt webhook, bạn cần thiết lập biến môi trường `WEBHOOK_URL` trong Cloudflare Worker.

### Các bước thực hiện:
1.  Truy cập **Cloudflare Dashboard** -> **Workers & Pages**.
2.  Chọn Worker: `emails-worker`.
3.  Vào **Settings** -> **Variables and Secrets**.
4.  Thêm (hoặc sửa) biến `WEBHOOK_URL`.
    *   **Value**: URL Webhook của bạn (ví dụ từ n8n: `https://n8n.docxs.online/webhook/email-trigger-path`).
    *   **Encrypt**: Nên chọn Encrypt nếu URL có chứa token nhạy cảm.
5.  Bấm **Deploy** (hoặc Save and Deploy).

## 3. Cấu Trúc Dữ Liệu (Payload)
Khi có email mới, hệ thống sẽ gửi một `POST` request với body JSON như sau:

```json
{
  "id": "email_unique_id",
  "from": "sender@example.com",
  "to": "your-alias@vmail.dev",
  "subject": "Tiêu đề email",
  "text": "Nội dung văn bản thuần...",
  "html": "<div>Nội dung HTML...</div>",
  "receivedAt": "2023-10-27T10:00:00.000Z",
  "attachments": [
    {
      "filename": "document.pdf",
      "url": "https://emails-worker.yourname.workers.dev/api/v1/attachments/email_id/document.pdf"
    }
  ]
}
```

> **Lưu ý**: Field `summary` hiện tại đang bị tắt (chưa triển khai AI tóm tắt).

## 4. Kế Hoạch Test (Testing Plan)

Do tính chất của Worker, để đảm bảo tính năng hoạt động ổn định, bạn cần thực hiện quy trình test thực tế theo các bước sau:

### Bước 1: Chuẩn bị Webhook
*   Tạo một workflow đơn giản trên **n8n** (hoặc dùng [Webhook.site](https://webhook.site) để test nhanh).
*   Sử dụng node **Webhook** (POST method).
*   Copy URL webhook.

### Bước 2: Cấu hình Worker
*   Cập nhật `WEBHOOK_URL` trong Cloudflare Worker với URL vừa copy.

### Bước 3: Gửi Email Test
*   Dùng tài khoản Gmail hoặc email cá nhân khác.
*   Gửi một email tới địa chỉ vmail của bạn (ví dụ: `test@docxs.online`).
*   **Case 1: Email thường**: Chỉ có text title và body.
*   **Case 2: Email có đính kèm**: Đính kèm 1 ảnh và 1 file PDF.

### Bước 4: Xác minh Kết quả
1.  **Check n8n/Webhook.site**:
    *   Xác nhận có request POST gửi tới.
    *   Kiểm tra JSON có đủ các trường: `from`, `subject`, `text`, `attachments`.
2.  **Check Attachment (nếu có)**:
    *   Trong JSON nhận được, copy đường link `url` của attachment.
    *   Paste vào trình duyệt (Tab ẩn danh) để xem coi có tải được file không (tính năng R2 public link).

### 5. Troubleshooting (Xử lý lỗi)
*   **Không nhận được Webhook?**
    *   Check Logs trong Cloudflare Worker (Tab **Logs** -> **Real-time Logs**) khi gửi email.
    *   Tìm dòng lỗi "Webhook failed" hoặc "Webhook Error".
    *   Đảm bảo `WEBHOOK_URL` chính xác (không thừa khoảng trắng).
*   **Attachment Link lỗi 404?**
    *   Kiểm tra lại cấu hình R2 bucket binding trong `wrangler.toml` (đã thực hiện ở Phase 1).

---
**Trạng thái hiện tại**: **ĐÃ DEPLOY THÀNH CÔNG**.
*   Biến `WEBHOOK_URL` đã được cài đặt cứng là: `https://n8n.docxs.online/webhook-test/vmail-incoming`.
*   Anh có thể bắt đầu test ngay lập tức bằng cách gửi email.
*   Lưu ý: URL này đang là `webhook-test`, anh nên bật n8n ở chế độ **Execute** (hoặc Listen) để bắt request. Nếu muốn chạy tự động ngầm (Production), nhớ đổi sang URL Production và cập nhật lại biến này trên Dashboard sau nhé.
