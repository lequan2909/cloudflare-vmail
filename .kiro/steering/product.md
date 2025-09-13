# Product Overview

Cloudflare VMails is a privacy-friendly temporary email service that requires no registration. Built entirely on Cloudflare's infrastructure, it provides a complete email solution using only free-tier services.

## Key Features

- **Privacy-first**: No registration required, temporary email addresses
- **Full email functionality**: Send and receive emails
- **Password protection**: Save passwords and retrieve email addresses
- **Multi-domain support**: Multiple domain suffixes available
- **Cloudflare-native**: 100% hosted on Cloudflare services
- **Open source**: Fully transparent and self-deployable

## Architecture

The system follows a simple workflow:
1. Cloudflare Email Worker receives incoming emails
2. Emails are stored in Cloudflare D1 database
3. Astro frontend queries and displays emails from D1
4. Users can send emails through integrated email services (Mailgun/Resend)

## Target Users

- Users needing temporary email addresses for privacy
- Developers testing email functionality
- Anyone wanting to avoid spam on their primary email