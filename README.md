# 🎓 CampusBuzz — Smart Campus Event Manager

A full-stack Next.js application for managing college events with QR check-in, admin dashboard, email notifications, and student registration.

## ✨ Features

- **Student Auth** — Sign up / Login with NextAuth.js + JWT
- **Event Discovery** — Browse, search, and filter events by category
- **Event Registration** — One-click register with instant confirmation
- **QR Code System** — Unique QR code per registration, sent via email
- **Admin Dashboard** — Real-time stats: registrations, check-ins, attendance rate
- **QR Scanner** — Camera-based or manual ID check-in for admins
- **Email Notifications** — Beautiful HTML emails with QR code on registration
- **Responsive Design** — Works perfectly on mobile & desktop

## 🛠 Tech Stack

| Layer      | Technology                                  |
| ---------- | ------------------------------------------- |
| Frontend   | Next.js 14 (App Router), React, TypeScript  |
| Styling    | Tailwind CSS, Custom CSS Variables          |
| Auth       | NextAuth.js v4 (Credentials Provider + JWT) |
| Database   | MongoDB + Mongoose                          |
| Email      | Nodemailer (Gmail SMTP)                     |
| QR Code    | qrcode (generate) + html5-qrcode (scan)     |
| Animations | Framer Motion                               |
| Deployment | Vercel                                      |

## 🚀 Getting Started

### 1. Clone & Install

```bash
git clone https://github.com/your-username/CampusBuzz.git
cd CampusBuzz
npm install
```

### 2. Environment Setup

```bash
cp .env.example .env.local
```

Fill in your `.env.local`:

```env
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/CampusBuzz
NEXTAUTH_SECRET=your-secret-key
NEXTAUTH_URL=http://localhost:3000
EMAIL_USER=your-gmail@gmail.com
EMAIL_PASS=your-gmail-app-password
ADMIN_EMAIL=admin@youremail.com
ESEWA_MERCHANT_ID=EPAYTEST
ESEWA_SECRET_KEY=8gBm/:&EnhH.1/q
ESEWA_API_URL=https://uat.esewa.com.np
KHALTI_SECRET_KEY=your-secret-key
KHALTI_PUBLIC_KEY=your-public-key
KHALTI_API_URL=https://dev.khalti.com/api/v2
```

### 3. Run Development Server

```bash
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000)

### 4. Create Admin Account

Sign up with the email you set in `ADMIN_EMAIL` — it will automatically be assigned the admin role.

## 📁 Project Structure

```
src/
├── app/
│   ├── page.tsx              # Homepage
│   ├── events/               # Events listing + detail
│   ├── auth/                 # Login + Signup
│   ├── dashboard/            # Admin dashboard + event manager + QR scanner
│   └── api/                  # API routes
│       ├── auth/             # NextAuth + Signup
│       ├── events/           # CRUD events
│       ├── register/         # Event registration + QR generation
│       ├── checkin/          # QR check-in
│       └── admin/stats/      # Dashboard statistics
├── components/
│   └── Navbar.tsx
├── lib/
│   ├── mongodb.ts            # DB connection
│   ├── auth.ts               # Auth config
│   └── email.ts              # Nodemailer
└── models/
    ├── User.ts
    ├── Event.ts
    └── Registration.ts
```

## 🌐 Deploy to Vercel

```bash
npm install -g vercel
vercel --prod
```

Add your environment variables in the Vercel dashboard.

## 👤 Roles

| Role        | Capabilities                                                                    |
| ----------- | ------------------------------------------------------------------------------- |
| **Student** | Browse events, register, view QR code                                           |
| **Admin**   | All student features + create/edit/delete events, view dashboard, scan QR codes |
