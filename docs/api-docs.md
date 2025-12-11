# Cloudflare VMail API Documentation

## Authentication
All API endpoints (except public ones) require authentication via Header.

- **Header**: `X-API-Key`
- **Value**: Your configured `API_KEY` in `wrangler.toml`.

---

## 🔧 Management Endpoints

### 1. Manual Cleanup
Trigger the cleanup routine immediately (useful for testing or manual maintenance).
- **URL**: `GET /api/v1/cleanup`
- **Auth**: Required
- **Response**:
  ```json
  {
    "success": true,
    "message": "Cleanup routine executed."
  }
  ```

### 2. Send Email
Send an email using the configured 3rd-party provider (Resend/SendGrid).
- **URL**: `POST /api/v1/send`
- **Auth**: Required
- **Body**:
  ```json
  {
    "to": "recipient@example.com",
    "subject": "Hello from VMail",
    "content": "<p>This is an HTML email</p>",
    "from": "Sender Name <sender@your-domain.com>" // Optional
  }
  ```

---

## 📬 Inbox Endpoints (Automation)

### 3. Get Latest Email
Ideally used for OTP polling. Returns the single most recent email for an address.
- **URL**: `GET /api/v1/latest/:address`
- **Auth**: Required
- **Response**:
  ```json
  {
    "id": "email_id_123",
    "subject": "Your Login Code",
    "text": "Your code is 123456...",
    "html": "...",
    "created_at": "2024-12-10T10:00:00Z"
  }
  ```

### 4. Get Inbox
Fetch list of emails for a specific address.
- **URL**: `GET /api/v1/inbox/:address`
- **Auth**: Required
- **Query Params**: `?limit=10` (Default 10)

---

## 🔄 Webhooks
The system can send a POST request to your configured `WEBHOOK_URL` whenever a new email arrives.

**Payload Structure**:
```json
{
  "id": "email_uuid",
  "from": "Sender <sender@example.com>",
  "to": "your-alias@your-domain.com",
  "subject": "Email Subject",
  "text": "Plain text content...",
  "html": "HTML content...",
  "headers": { ... },
  "attachments": [
    {
      "filename": "image.png",
      "contentType": "image/png",
      "size": 1024
    }
  ]
}
```
