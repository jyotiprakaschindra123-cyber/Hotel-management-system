# Utkal Reserve

**Your Stay, Our Priority**

Utkal Reserve is a full-stack hotel management system built with the MERN stack. It includes a public hotel website, a guest portal, and dedicated dashboards for admin, front desk, kitchen, and housekeeping operations.

This project was built to mirror a modern hotel booking and operations workflow, including bookings, check-in, checkout, invoicing, room service, housekeeping, admin controls, email notifications, and online payment integration.

Deployment Link -: https://hms-eight-xi.vercel.app/

## Highlights

- Public hotel website with home, rooms, about, login, and registration flows
- Guest portal for:
  - booking rooms
  - viewing bookings
  - ordering food
  - tracking food orders
  - updating profile settings
- Admin panel for:
  - dashboard and analytics
  - staff management
  - room management
  - kitchen menu and monitoring
  - booking management
  - guest management
  - panel block/unblock controls
  - broadcast alerts to other panels
- Front desk dashboard for:
  - arrivals and departures
  - walk-in booking
  - room status
  - guest list
  - billing and checkout
- Kitchen dashboard for:
  - active orders
  - delivery history
  - profile management
- Housekeeping dashboard for:
  - room cleaning task board
  - cleaning history
  - profile management
- Razorpay integration for invoice payment
- SMTP email integration for check-in and checkout mail notifications
- PDF invoice download
- Loyalty points and automatic membership tier upgrades

## Tech Stack

### Frontend

- React
- React Router
- Vite
- Recharts
- Lucide React
- jsPDF

### Backend

- Node.js
- Express
- MongoDB
- Mongoose
- JWT authentication
- Nodemailer
- Razorpay

### Deployment

- Vercel-ready configuration included

## Project Structure

```text
.
├── api/                  # Vercel API entry
├── client/
│   ├── src/
│   │   ├── App.jsx       # Main app and dashboard flows
│   │   ├── api.js        # API helper and client cache logic
│   │   └── styles.css    # Full styling
│   └── vite.config.js
├── server/
│   ├── index.js          # Express API
│   ├── models.js         # Mongoose models
│   ├── seed.js           # Seed entry
│   └── seedData.js       # Demo seed content
├── .env.example
├── package.json
└── vercel.json
```

## Main Modules

### Public Website

- Homepage with featured rooms
- About page
- Rooms listing
- Login and signup

### Guest Portal

- Dashboard
- My Bookings
- Book New Room
- Order Food
- Food Orders
- Profile Settings

### Admin Panel

- Dashboard with analytics
- Staff Management
- Rooms
- Kitchen
  - Manage Menu
  - Add Food Item
  - Kitchen Monitor
  - Delivery History
- Bookings
- Guests
- Panel controls
- Broadcast alerts

### Front Desk

- Dashboard
- Booking History
- Walk In Booking
- Room Status
- Guest List

### Kitchen

- Active Orders
- History
- My Profile

### Housekeeping

- Task Board
- Cleaning History
- My Profile

## Important Business Rules

- Guests can order food only after front desk check-in confirmation
- Checkout is performed from the invoice flow
- Checkout moves the room to `dirty` status for housekeeping
- Loyalty tier upgrades automatically every `6000` points:
  - `0 - 5999` -> Silver
  - `6000 - 11999` -> Gold
  - `12000 - 17999` -> Platinum
  - `18000+` -> Diamond

## Demo Login Credentials

These are seeded demo accounts for local/testing use:

| Role | Username | Password |
|---|---|---|
| Admin | `hmsadmin` | `hms123` |
| Front Desk | `frontdesk` | `front123` |
| Guest | `sumit` | `guest123` |
| Kitchen | `kitchen` | `kitchen123` |
| Housekeeping | `housekeeper` | `clean123` |

An additional admin can also be created manually if needed.

## Environment Variables

Use `.env.example` as your template.

```env
PORT=5100
CLIENT_ORIGIN=http://localhost:5174,http://127.0.0.1:5174
MONGODB_URI=mongodb://127.0.0.1:27017/utkal_reserve
JWT_SECRET=replace-this-with-a-long-random-secret
SEED_ON_START=true
PAYMENT_CURRENCY=INR
RAZORPAY_KEY_ID=rzp_test_replace_me
RAZORPAY_KEY_SECRET=replace-me
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=replace-me@example.com
SMTP_PASS=replace-me
MAIL_FROM=Utkal Reserve <replace-me@example.com>
```

## Local Setup

### 1. Clone the repo

```bash
git clone https://github.com/jyotiprakaschindra123-cyber/LMS.git
cd LMS
```

### 2. Install dependencies

```bash
npm install
```

### 3. Create your environment file

```bash
cp .env.example .env
```

Then update `.env` with your actual MongoDB, Razorpay, and SMTP values.

### 4. Start the app

```bash
npm run dev
```

### 5. Open the app

- Frontend: `http://localhost:5174`
- Backend: `http://localhost:5100/api/health`

## Available Scripts

```bash
npm run dev       # run frontend + backend together
npm run server    # run backend only
npm run client    # run frontend only
npm run seed      # seed demo data
npm run build     # production build
npm run preview   # preview production build locally
```

## Payments

Razorpay is integrated in the invoice flow.

- Guests are billed from the invoice page
- Admin and front desk can trigger invoice checkout
- Payment verification is handled server-side

Use Razorpay test keys while developing.

## Email Service

The project supports SMTP mail sending for:

- guest check-in confirmation
- guest checkout with bill summary

For Gmail, use an app password instead of your normal account password.

## Deployment on Vercel

This repo already includes Vercel configuration.

### Build settings

- Build command: `npm run build`
- Output directory: `dist`

### Required environment variables

Add the same values from your local `.env` into:

`Vercel -> Project Settings -> Environment Variables`

Important:

- set `CLIENT_ORIGIN` to your exact deployed domain
- keep secrets out of GitHub
- use environment variables in Vercel instead of committing `.env`

## Performance Notes

The project includes:

- client-side request caching and deduping for repeated GET requests
- reduced unnecessary polling behavior in hidden tabs
- vendor chunk splitting for better frontend caching
- lazy loading for heavy invoice/PDF generation code

For the next performance step, adding MongoDB indexes and realtime event delivery is recommended.

## Security Notes

- Never commit your real `.env` file
- Rotate secrets if they were ever exposed
- Use strong JWT secrets in production
- Use live Razorpay credentials only after end-to-end testing with test keys

## Future Improvements

- WebSocket or realtime pub/sub updates
- image optimization and upload pipeline
- role-based audit logs
- automated testing
- route-level code splitting by dashboard
- stronger analytics and reports

## Authoring Notes

This project has been customized extensively for:

- hotel booking flow
- operational dashboards
- branded Utkal Reserve experience
- deployment on Vercel

## License

This project is currently provided as a custom implementation. Add your preferred license before public reuse or redistribution.

