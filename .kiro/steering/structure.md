# Project Structure

## Monorepo Organization

This is a pnpm workspace-based monorepo with the following structure:

```
├── apps/                    # Application packages
│   ├── astro/              # Main Astro frontend application
│   └── emails-worker/      # Cloudflare Email Worker
├── packages/               # Shared packages
│   └── database/           # Database schema and utilities
└── [root config files]     # Workspace-level configuration
```

## Apps Directory

### `apps/astro/`
- **Purpose**: Main frontend application built with Astro + React
- **Deployment**: Cloudflare Pages
- **Key Features**: Email display, user interface, email sending
- **Structure**:
  - `src/components/ui/` - Reusable UI components (shadcn/ui style)
  - `src/pages/` - Astro pages and API routes
  - `src/pages/mails/` - Email-specific pages
  - `worker-configuration.d.ts` - Cloudflare Worker type definitions

### `apps/emails-worker/`
- **Purpose**: Cloudflare Worker for handling incoming emails
- **Deployment**: Cloudflare Workers
- **Responsibility**: Email reception and D1 database storage

## Packages Directory

### `packages/database/`
- **Purpose**: Shared database schema and ORM utilities
- **Technology**: Drizzle ORM with SQLite/D1
- **Usage**: Imported by both apps for consistent data access
- **Workspace Reference**: `"database": "workspace:^"`

## Path Aliases

The project uses TypeScript path mapping for clean imports:

```typescript
"@emails/*": ["./apps/astro/src/*"]     # Astro app internals
"@worker/*": ["./apps/emails-worker/src/*"]  # Worker internals  
"database": ["./packages/database"]     # Database package
```

## Configuration Files

### Root Level
- `tsconfig.json` - Composite TypeScript configuration with project references
- `eslint.config.js` - ESLint configuration using @antfu/eslint-config
- `.prettierrc` - Prettier formatting rules with Astro plugin
- `pnpm-workspace.yaml` - Workspace package definitions

### App-Specific
- Each app has its own `package.json` and `tsconfig.json`
- Astro app includes `wrangler.toml` for Cloudflare deployment (not in repo)

## Build Artifacts

The following directories are generated and should be ignored:
- `dist/` - Build output
- `.astro/` - Astro build cache
- `.wrangler/` - Wrangler build cache
- `node_modules/` - Dependencies
- `.tsbuildinfo` - TypeScript incremental build info

## Component Organization

UI components follow shadcn/ui patterns:
- Radix UI primitives as base components
- Custom styling with Tailwind CSS
- Consistent component APIs with proper TypeScript interfaces
- Reusable components in `apps/astro/src/components/ui/`