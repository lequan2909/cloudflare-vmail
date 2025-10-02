# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.0] - 2025-01-XX

### 🐛 Fixed

- Fixed TypeScript type errors in `ArtPlums.tsx` component
  - Added explicit return type `[number, number]` to `polar2cart` function (apps/astro/src/components/ArtPlums.tsx:37)
- Fixed TypeScript type inference error in ESLint configuration
  - Added JSDoc type annotation in `apps/astro/eslint.config.js`
- Fixed spelling errors across the codebase:
  - Renamed `DeleteEvereyThingButton` → `DeleteEveryThingButton`
  - Fixed `verifed` → `verified` in LoggedInMailboxForm
  - Fixed `foregrund` → `foreground` in Footer.astro
  - Fixed `datas` → `data` in DeleteEveryThingButton

### ⬆️ Dependencies

- Unified `zod` version to 3.22.4 across all packages using pnpm overrides
  - Added pnpm overrides configuration in root package.json

### ✨ Enhanced

- **Inbox Component** - Dramatically improved UX
  - Added Skeleton loading states for better perceived performance
  - Enhanced empty state with animated Sparkles icon
  - Added interactive usage guide with step-by-step instructions
  - Improved visual hierarchy and spacing
  - Better loading state detection to prevent flickering

- **CopyButton Component** - Better interaction feedback
  - Added tooltip states (idle/success/error)
  - Enhanced visual feedback with background color changes
  - Increased success state duration from 1s to 2s
  - Improved fallback handling for older browsers
  - Added better error handling for copy failures
  - Added icon sizing consistency

### 🎨 UI Improvements

- Created reusable Skeleton component for loading states
  - Location: `apps/astro/src/components/ui/skeleton.tsx`
  - Supports customization via className prop
  - Uses Tailwind animation utilities

### 📝 Documentation

- Added CHANGELOG.md to track version changes

### 🔧 Technical Improvements

- All TypeScript files now compile without errors
- Improved type safety with explicit type annotations
- Better code organization and consistency

---

## [1.0.0] - 2024-XX-XX

### Initial Release

- 🎯 Privacy-friendly temporary email service
- ✈️ Email sending and receiving support
- ✨ Password saving and email address retrieval
- 😄 Multiple domain suffix support
- 🚀 100% open source, fully based on Cloudflare
- 🎨 Modern UI with shadcn/ui components
- 🌓 Dark mode support
- 📱 Responsive design

---

## Upcoming

### v1.2.0 (Planned)

- Email notification system (browser notifications + audio)
- Mailbox expiry countdown timer
- Email read/unread status tracking
- Search and filter functionality
- Database migration for new fields (is_read, read_at, attachments)
- Rate limiting implementation
- Improved error handling

### v1.3.0 (Planned)

- Batch operations (select multiple emails)
- Statistics dashboard
- Multiple mailbox management
- QR code sharing
- Mobile optimization (bottom nav, pull-to-refresh)
- Keyboard shortcuts
- Accessibility improvements

### v2.0.0 (Future)

- Complete architecture refactor
- AI-powered email summaries
- Multi-language support (i18n)
- PWA support
- Full test coverage
- Performance optimizations

---

[1.1.0]: https://github.com/yourusername/emails/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/yourusername/emails/releases/tag/v1.0.0
