<div align="center">

# ACCX

**A modern, secure account & credential management vault with a sleek dual-theme interface.**

[![Deployed on Vercel](https://img.shields.io/badge/Deployed%20on-Vercel-black?style=for-the-badge&logo=vercel)](https://accx-app.vercel.app)
[![Built with React](https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-6-3178C6?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind%20CSS-4-06B6D4?style=for-the-badge&logo=tailwindcss)](https://tailwindcss.com)

[Live Demo](https://accx-app.vercel.app) · [Report Bug](https://github.com/nexuss0781/ACCX/issues) · [Request Feature](https://github.com/nexuss0781/ACCX/issues)

</div>

---

## Overview

ACCX is a full-featured account management system designed for individuals who want a single, organized vault for their digital credentials, notes, and sensitive information. Built with a modern React stack and a dual-theme (light/dark) interface, ACCX combines usability with a refined, professional aesthetic.

---

## Features

### Authentication
- Secure login and registration flow
- Persistent sessions via Zustand + localStorage
- Protected routes with automatic redirects

### Accounts Vault
- **Full CRUD** — create, read, update, and delete accounts
- Card-based layout with category and folder badges
- Password reveal, copy-to-clipboard, and masked display
- **Custom fields** — add unlimited key-value fields via the `+` icon (text, password, URL, email, number types)
- Favorite accounts with quick-access from the dashboard
- External link to the account's website

### Categories
- Create, edit, and delete categories with custom colors and icons
- Accounts are tagged and filterable by category
- Visual usage bars showing account distribution

### Folders
- Organize accounts into folders (Personal, Work, Shared, etc.)
- Custom colors and descriptions per folder
- Folder-based filtering across the accounts page

### Notes
- Create, edit, and delete notes with rich text content
- **8 color options** for visual organization
- Pin/unpin notes to keep important ones at the top
- Masonry-style card layout with color-coded filter bar

### Dashboard
- **Metric cards** — total accounts, folders, categories, and notes at a glance
- **Area chart** — growth overview over time (Recharts)
- **Pie chart** — account distribution by category
- **Favorites panel** — quick access to starred accounts
- **Activity feed** — tracks all recent creates, updates, and deletes with timestamps

### Search & Filter
- Full-text search on every page (accounts, categories, folders, notes)
- Category and folder dropdown filters on the accounts page
- Color filter bar on the notes page
- Real-time result counts

### Dual Theme
- **Dark mode** (default) — true dark zinc-950 background with teal accent
- **Light mode** — off-white base with refined zinc gray scale
- Toggle via Sun/Moon icon in the header
- Persisted to localStorage, respects `prefers-color-scheme` on first visit
- Smooth 200ms transition between themes

### Collapsible Sidebar
- Collapsible navigation with smooth animation
- Active route indicators with accent color
- Tooltips when collapsed
- User profile display with avatar initials

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Framework** | React 19 + TypeScript |
| **Build Tool** | Vite 8 |
| **Styling** | Tailwind CSS 4 with CSS custom properties |
| **State** | Zustand with localStorage persistence |
| **Routing** | React Router v7 |
| **Charts** | Recharts |
| **Icons** | Lucide React |
| **Utilities** | date-fns, clsx |
| **Deployment** | Vercel |

---

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm, yarn, or pnpm

### Installation

```bash
# Clone the repository
git clone https://github.com/nexuss0781/ACCX.git
cd ACCX

# Install dependencies
npm install

# Start development server
npm run dev
```

The app will be available at `http://localhost:5173`.

### Build

```bash
npm run build
```

Output is in the `dist/` directory.

### Preview

```bash
npm run preview
```

---

## Project Structure

```
src/
├── components/
│   ├── layout/
│   │   ├── Header.tsx          # Page header with search, theme toggle, notifications
│   │   ├── Layout.tsx          # Main layout wrapper with sidebar offset
│   │   └── Sidebar.tsx         # Collapsible navigation sidebar
│   └── ui/
│       ├── Badge.tsx           # Color-coded badge component
│       ├── Button.tsx          # Multi-variant button (primary, secondary, ghost, danger)
│       ├── ConfirmDialog.tsx   # Destructive action confirmation modal
│       ├── EmptyState.tsx      # Empty state placeholder with action
│       ├── Input.tsx           # Form input with label, icon, error state
│       ├── Modal.tsx           # Overlay modal with ESC and backdrop close
│       ├── Select.tsx          # Dropdown select with label
│       └── ThemeToggle.tsx     # Sun/Moon theme switcher
├── pages/
│   ├── LoginPage.tsx           # Authentication — login
│   ├── RegisterPage.tsx        # Authentication — registration
│   ├── DashboardPage.tsx       # Metrics, charts, activity feed
│   ├── AccountsPage.tsx        # Account cards with full CRUD + custom fields
│   ├── CategoriesPage.tsx      # Category management with color/icon picker
│   ├── FoldersPage.tsx         # Folder management
│   └── NotesPage.tsx           # Color-coded notes with masonry layout
├── store/
│   └── index.ts                # Zustand store with all state + actions
├── types/
│   └── index.ts                # TypeScript interfaces and constants
├── utils/
│   ├── index.ts                # Utility functions (timeAgo, maskPassword, cn)
│   └── theme.ts                # Theme application and toggling logic
├── App.tsx                     # Router configuration with auth guards
├── main.tsx                    # Entry point with theme initialization
└── index.css                   # Tailwind + dual-theme CSS custom properties
```

---

## Design System

ACCX uses a **CSS custom property** system for theming, bridged into Tailwind via `@theme inline`. Every surface, text, border, and accent color is tokenized — no hardcoded colors in components.

### Color Palette

| Role | Light | Dark |
|------|-------|------|
| Base background | `#fafafa` | `#09090b` |
| Surface (cards) | `#ffffff` | `#18181b` |
| Raised (hover) | `#f4f4f5` | `#27272a` |
| Border | `#e4e4e7` | `#27272a` |
| Text primary | `#09090b` | `#fafafa` |
| Accent | `#0d9488` | `#14b8a6` |
| Danger | `#dc2626` | `#f87171` |

### Typography

- **Display / Body:** Inter (300–800)
- **Monospace:** JetBrains Mono (passwords, code)

---

## Deployment

ACCX is deployed on Vercel with zero-configuration:

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel --prod
```

The Vercel project auto-detects Vite and configures build/output settings.

---

## Contributing

Contributions are welcome. Please follow the existing code style and commit conventions.

1. Fork the repository
2. Create a feature branch (`git checkout -b feat/amazing-feature`)
3. Commit with conventional format (`feat(scope): description`)
4. Push and open a Pull Request

---

## License

This project is open source and available under the [MIT License](LICENSE).

---

<div align="center">

**Built by [Tadiyos Aschalew](https://github.com/nexuss0781)**

</div>