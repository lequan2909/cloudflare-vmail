# Technology Stack

## Core Technologies

- **Frontend**: Astro 5.x with React 19.x integration
- **Runtime**: Node.js >= 18
- **Package Manager**: pnpm (workspace-based monorepo)
- **Database**: Cloudflare D1 (SQLite) with Drizzle ORM
- **Deployment**: Cloudflare Pages + Workers
- **Language**: TypeScript with strict configuration

## Key Dependencies

### UI & Styling
- **UI Components**: Radix UI primitives with shadcn/ui patterns
- **Styling**: Tailwind CSS 4.x with custom animations
- **Icons**: Iconify React, Radix Icons, Lucide React
- **Animations**: Framer Motion

### Backend & Data
- **ORM**: Drizzle ORM with Drizzle Kit for migrations
- **Validation**: Zod schemas
- **Email Services**: Mailgun.js, Resend
- **Authentication**: Jose (JWT handling)

### Development Tools
- **Linting**: ESLint with @antfu/eslint-config
- **Formatting**: Prettier with Astro plugin
- **Type Checking**: TypeScript composite project setup
- **Bundling**: Astro's built-in Vite-based bundler

## Build Commands

### Development
```bash
pnpm dev              # Start all apps and packages in dev mode
pnpm dev:packages     # Start only packages in watch mode
pnpm dev:apps         # Start only apps in dev mode
```

### Building
```bash
pnpm build            # Build packages first, then apps
pnpm build:packages   # Build only packages
pnpm build:apps       # Build only apps
```

### Quality Assurance
```bash
pnpm lint             # Run ESLint across all workspaces
pnpm type-check       # TypeScript compilation check
pnpm type-check:watch # TypeScript watch mode
pnpm test             # Run tests across all workspaces
```

### Deployment
```bash
pnpm deploy           # Build and deploy all apps
```

### Utilities
```bash
pnpm clean            # Clean all build artifacts
pnpm start            # Start production builds
```

## Cloudflare Specific

### Wrangler Commands
```bash
wrangler types        # Generate Cloudflare Worker types
wrangler pages dev    # Local Pages development
wrangler pages deploy # Deploy to Cloudflare Pages
```

### Database Operations
```bash
pnpm db:generate      # Generate Drizzle migrations
pnpm db:push          # Push schema changes to D1
```