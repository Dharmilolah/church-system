# ⛪ ChurchAccount

A full-stack church financial management system built with **Next.js 15**, **Supabase**, and **Tailwind CSS**.

## Features

- 🔐 **Authentication** — Email/password login & church registration
- 👥 **Member Management** — Add, search, and manage church members by branch
- 🙏 **Tithes & Offerings** — Record tithes with member tracking or anonymous giving
- 💸 **Income & Expenses** — Full transaction tracking with categories
- 📊 **Reports & Analytics** — Visual charts for tithes, income vs. expenses, member growth
- 🏛️ **Multi-branch Support** — Manage multiple church branches
- 🔒 **Role-based Access** — Admin and Treasurer roles with Row Level Security

## Tech Stack

- **Frontend:** Next.js 15 (App Router), TypeScript, Tailwind CSS
- **Backend:** Supabase (PostgreSQL, Auth, RLS)
- **Charts:** Recharts
- **Icons:** Lucide React

## Getting Started

### 1. Clone the repo

```bash
git clone <your-repo-url>
cd churchaccount
```

### 2. Install dependencies

```bash
npm install
```

### 3. Set up environment variables

```bash
cp .env.example .env.local
```

Then fill in your Supabase credentials in `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://isvqwielxbbmplwpzaob.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
```

### 4. Run the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the app.

## Database Schema

The app uses the following tables in Supabase:

| Table | Description |
|-------|-------------|
| `churches` | Church profiles with unique code |
| `branches` | Church branches/locations |
| `users` | App users with roles (admin/treasurer) |
| `profiles` | Extended user profiles |
| `members` | Church congregation members |
| `tithe_records` | Tithe and offering records |
| `transactions` | General income and expense transactions |
| `categories` | Transaction categories |

## Deployment

Deploy to Vercel:

```bash
npm run build
vercel deploy
```

Add the environment variables in your Vercel project settings.

## Roles

- **Admin** — Full access to all features
- **Treasurer** — Can record tithes and transactions

---

Built with ❤️ for church communities.
