import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import morgan from 'morgan';
import nodemailer from 'nodemailer';
import { fileURLToPath } from 'node:url';
import Razorpay from 'razorpay';
import { Booking, CleaningLog, MenuItem, Order, Room, SystemSettings, User } from './models.js';
import { seedDatabase } from './seedData.js';

dotenv.config();

const app = express();
const port = process.env.PORT || 5000;
const jwtSecret = process.env.JWT_SECRET || 'utkal-reserve-development-secret';
const allowedOrigins = (process.env.CLIENT_ORIGIN || 'http://localhost:5174,http://127.0.0.1:5174,http://localhost:5173,http://127.0.0.1:5173')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);
const primaryClientOrigin = (allowedOrigins[0] || 'http://localhost:5173').replace(/\/$/, '');
const paymentCurrency = String(process.env.PAYMENT_CURRENCY || 'INR').toUpperCase();
const smtpPort = Number(process.env.SMTP_PORT || 587);
const smtpSecure = String(process.env.SMTP_SECURE || '').toLowerCase() === 'true' || smtpPort === 465;
const mailFrom = process.env.MAIL_FROM || 'Utkal Reserve <no-reply@utkalreserve.local>';
const mailConfigured = Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
const razorpayConfigured = Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);
const mailTransport = mailConfigured
  ? nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: smtpPort,
      secure: smtpSecure,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    })
  : null;
const razorpay = razorpayConfigured
  ? new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET
    })
  : null;
let dbReady = false;
let dbError = '';
let dbPromise = null;
let seedPromise = null;

function isAllowedOrigin(origin) {
  if (!origin) return true;
  if (allowedOrigins.includes(origin)) return true;

  try {
    const hostname = new URL(origin).hostname;
    return hostname.endsWith('.vercel.app');
  } catch (_error) {
    return false;
  }
}

app.use(
  cors({
    origin(origin, callback) {
      if (isAllowedOrigin(origin)) return callback(null, true);
      return callback(new Error(`Origin ${origin} is not allowed by CORS.`));
    },
    credentials: true
  })
);
app.use(express.json({ limit: '2mb' }));
app.use(morgan('dev'));

const asyncHandler = (handler) => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);

const startOfDay = (date = new Date()) => {
  const value = new Date(date);
  value.setHours(0, 0, 0, 0);
  return value;
};

const endOfDay = (date = new Date()) => {
  const value = new Date(date);
  value.setHours(23, 59, 59, 999);
  return value;
};

const nightsBetween = (checkIn, checkOut) => {
  const start = new Date(checkIn);
  const end = new Date(checkOut);
  start.setHours(12, 0, 0, 0);
  end.setHours(12, 0, 0, 0);
  return Math.max(1, Math.ceil((end - start) / 86400000));
};

const signToken = (user) => jwt.sign({ id: user.id || user._id, role: user.role }, jwtSecret, { expiresIn: '7d' });

const publicUserFields = 'username email firstName lastName phone address avatar role jobTitle salary experience membershipTier loyaltyPoints createdAt';
const managedPanelRoles = ['frontdesk', 'guest', 'kitchen', 'housekeeping'];
const membershipTierSteps = ['Silver', 'Gold', 'Platinum', 'Diamond'];

function membershipTierForPoints(points = 0) {
  const normalizedPoints = Math.max(0, Number(points) || 0);
  const tierIndex = Math.min(membershipTierSteps.length - 1, Math.floor(normalizedPoints / 6000));
  return membershipTierSteps[tierIndex];
}

async function syncMembershipTier(user) {
  if (!user) return user;
  const nextTier = membershipTierForPoints(user.loyaltyPoints);
  if (user.membershipTier !== nextTier) {
    user.membershipTier = nextTier;
    await user.save();
  }
  return user;
}

async function addLoyaltyPoints(userId, pointsToAdd) {
  const increment = Math.max(0, Math.round(Number(pointsToAdd) || 0));
  if (!increment) return null;
  const user = await User.findById(userId);
  if (!user) return null;
  user.loyaltyPoints = Math.max(0, Number(user.loyaltyPoints || 0) + increment);
  user.membershipTier = membershipTierForPoints(user.loyaltyPoints);
  await user.save();
  return user;
}

function defaultPanelLocks() {
  return {
    frontdesk: { blocked: false, reason: '', updatedAt: null },
    guest: { blocked: false, reason: '', updatedAt: null },
    kitchen: { blocked: false, reason: '', updatedAt: null },
    housekeeping: { blocked: false, reason: '', updatedAt: null }
  };
}

async function getSystemSettings() {
  let settings = await SystemSettings.findOne({ key: 'primary' });
  if (!settings) {
    settings = await SystemSettings.create({
      key: 'primary',
      panelLocks: defaultPanelLocks(),
      alerts: []
    });
  }

  const currentLocks = settings.panelLocks?.toJSON ? settings.panelLocks.toJSON() : settings.panelLocks || {};
  settings.panelLocks = { ...defaultPanelLocks(), ...currentLocks };
  return settings;
}

function panelLockPayload(settings, role) {
  const lock = settings?.panelLocks?.[role] || {};
  return {
    blocked: Boolean(lock.blocked),
    reason: lock.reason || '',
    updatedAt: lock.updatedAt || null
  };
}

function activeAlertsForRole(settings, role) {
  const alerts = Array.isArray(settings?.alerts) ? settings.alerts : [];
  return alerts
    .filter((alert) => alert.active !== false && Array.isArray(alert.roles) && alert.roles.includes(role))
    .sort((left, right) => new Date(right.createdAt || 0) - new Date(left.createdAt || 0))
    .map((alert) => alert.toJSON ? alert.toJSON() : alert);
}

function blockMessageForRole(role, reason = '') {
  const label = role === 'frontdesk'
    ? 'Front Desk'
    : role === 'guest'
      ? 'Guest Portal'
      : role === 'kitchen'
        ? 'Kitchen'
        : role === 'housekeeping'
          ? 'Housekeeping'
          : 'This panel';
  return reason
    ? `${label} has been temporarily blocked by the admin. ${reason}`
    : `${label} has been temporarily blocked by the admin. Please contact the admin desk.`;
}

function requireDb(_req, res, next) {
  if (!dbReady) {
    return res.status(503).json({
      message: 'MongoDB is not connected. Add MONGODB_URI in .env, or start local MongoDB, then restart the server.',
      detail: dbError
    });
  }
  next();
}

const authorize = (roles = [], options = {}) =>
  asyncHandler(async (req, res, next) => {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : '';
    if (!token) return res.status(401).json({ message: 'Authentication required.' });

    try {
      const decoded = jwt.verify(token, jwtSecret);
      const user = await User.findById(decoded.id).select(publicUserFields);
      if (!user) return res.status(401).json({ message: 'Session expired.' });
      if (user.role === 'guest') await syncMembershipTier(user);
      if (roles.length && !roles.includes(user.role)) {
        return res.status(403).json({ message: 'You do not have access to this area.' });
      }
      if (!options.allowBlocked && user.role !== 'admin' && managedPanelRoles.includes(user.role)) {
        const settings = await getSystemSettings();
        const lock = panelLockPayload(settings, user.role);
        if (lock.blocked) {
          return res.status(423).json({
            message: blockMessageForRole(user.role, lock.reason),
            role: user.role,
            panelLock: lock
          });
        }
      }
      req.user = user;
      next();
    } catch (_error) {
      return res.status(401).json({ message: 'Invalid session.' });
    }
  });

const requireAuth = (...roles) => authorize(roles);
const requireSession = (...roles) => authorize(roles, { allowBlocked: true });

const populateBooking = (query) =>
  query.populate('guest', publicUserFields).populate('room').sort({ createdAt: -1 });

const populateOrder = (query) =>
  query
    .populate('guest', publicUserFields)
    .populate('room')
    .populate('booking')
    .populate('deliveredBy', publicUserFields)
    .sort({ createdAt: -1 });

async function calculateInvoice(bookingId) {
  const booking = await Booking.findById(bookingId).populate('guest', publicUserFields).populate('room');
  if (!booking) return null;
  const orders = await Order.find({ booking: booking._id }).sort({ createdAt: -1 });
  const nights = nightsBetween(booking.checkIn, booking.checkOut);
  const roomTotal = nights * booking.roomRate;
  const foodTotal = orders.reduce((total, order) => total + order.total, 0);
  const taxTotal = 0;
  const grandTotal = roomTotal + foodTotal + taxTotal;
  booking.roomTotal = roomTotal;
  booking.foodTotal = foodTotal;
  booking.taxTotal = taxTotal;
  booking.grandTotal = grandTotal;
  await booking.save();
  return { booking, orders, nights, roomTotal, foodTotal, taxTotal, grandTotal };
}

function displayName(person) {
  return `${person?.firstName || ''} ${person?.lastName || ''}`.trim() || person?.username || 'Guest';
}

const displayMoney = (value = 0) =>
  new Intl.NumberFormat(paymentCurrency === 'INR' ? 'en-IN' : 'en-US', {
    style: 'currency',
    currency: paymentCurrency,
    maximumFractionDigits: 0
  }).format(Number(value || 0));

const displayDate = (value) =>
  value
    ? new Intl.DateTimeFormat('en-US', { month: 'short', day: '2-digit', year: 'numeric' }).format(new Date(value))
    : '-';

const displayDateTime = (value) =>
  value
    ? new Intl.DateTimeFormat('en-IN', {
        month: 'short',
        day: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }).format(new Date(value))
    : '-';

function invoiceLineItems(invoice) {
  const roomType = invoice?.booking?.room?.type || 'Room';
  const nights = Number(invoice?.nights || 0);
  const roomRate = Number(invoice?.booking?.roomRate || 0);
  const roomTotal = Number(invoice?.roomTotal || 0);
  const items = [
    {
      description: `Room Charges (${roomType})`,
      quantity: `${nights} night${nights === 1 ? '' : 's'}`,
      unitPrice: roomRate,
      amount: roomTotal
    }
  ];

  for (const order of invoice?.orders || []) {
    const quantity = (order.items || []).reduce((sum, item) => sum + Number(item.quantity || 1), 0) || 1;
    const itemLabel = (order.items || [])
      .map((item) => `${item.name}${Number(item.quantity || 1) > 1 ? ` x${item.quantity}` : ''}`)
      .join(', ') || 'Room Service';

    items.push({
      description: `Room Service: ${itemLabel}`,
      quantity: `${quantity} item${quantity === 1 ? '' : 's'}`,
      unitPrice: Number(order.total || 0),
      amount: Number(order.total || 0)
    });
  }

  return items;
}

function buildEmailShell({ eyebrow, title, message, content, accent = '#2952e1' }) {
  return `
    <div style="margin:0;padding:28px;background:linear-gradient(135deg,#e8f3df 0%,#fff5c9 52%,#fde7ef 100%);font-family:Arial,Helvetica,sans-serif;color:#0f172a;">
      <div style="max-width:720px;margin:0 auto;background:#ffffff;border-radius:24px;overflow:hidden;border:1px solid #e2e8f0;box-shadow:0 24px 48px rgba(15,23,42,.12);">
        <div style="padding:28px 32px;background:linear-gradient(120deg,#1e293b 0%,${accent} 64%,#1ec5ea 100%);color:#ffffff;">
          <div style="font-size:12px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;opacity:.88;">${eyebrow}</div>
          <div style="margin-top:10px;font-size:31px;font-weight:800;line-height:1.1;">${title}</div>
          <div style="margin-top:8px;font-size:14px;line-height:1.7;color:rgba(255,255,255,.88);">${message}</div>
        </div>
        <div style="padding:28px 32px 32px;">
          ${content}
          <div style="margin-top:28px;padding-top:16px;border-top:1px solid #e2e8f0;color:#64748b;font-size:12px;line-height:1.7;">
            Utkal Reserve<br />
            Your Stay, Our Priority<br />
            Delta Square, Baramunda, Bhubaneswar, Khordha, PIN - 751003
          </div>
        </div>
      </div>
    </div>
  `;
}

function buildCheckInEmail(booking) {
  return {
    subject: `Check-in Confirmed for Room ${booking.room?.number || '-'} | Utkal Reserve`,
    html: buildEmailShell({
      eyebrow: 'Check-in Confirmed',
      title: `Welcome, ${displayName(booking.guest)}`,
      message: `Your stay has been checked in successfully. Our team is ready to make your visit comfortable from arrival to departure.`,
      accent: '#16a34a',
      content: `
        <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px;">
          <div style="padding:18px;border:1px solid #e2e8f0;border-radius:18px;background:#f8fbff;">
            <div style="font-size:12px;color:#64748b;font-weight:700;letter-spacing:.08em;text-transform:uppercase;">Guest</div>
            <div style="margin-top:10px;font-size:18px;font-weight:800;color:#1e293b;">${displayName(booking.guest)}</div>
            <div style="margin-top:6px;color:#64748b;font-size:13px;">${booking.guest?.email || '-'}</div>
            <div style="margin-top:4px;color:#64748b;font-size:13px;">${booking.guest?.phone || '-'}</div>
          </div>
          <div style="padding:18px;border:1px solid #e2e8f0;border-radius:18px;background:#f8fbff;">
            <div style="font-size:12px;color:#64748b;font-weight:700;letter-spacing:.08em;text-transform:uppercase;">Stay</div>
            <div style="margin-top:10px;font-size:18px;font-weight:800;color:#1e293b;">Room ${booking.room?.number || '-'} - ${booking.room?.type || 'Room'}</div>
            <div style="margin-top:6px;color:#64748b;font-size:13px;">Check-in: ${displayDateTime(booking.checkedInAt || new Date())}</div>
            <div style="margin-top:4px;color:#64748b;font-size:13px;">Check-out plan: ${displayDate(booking.checkOut)}</div>
          </div>
        </div>
        <div style="margin-top:18px;padding:18px;border-radius:18px;background:linear-gradient(135deg,#eff6ff,#fdf2f8);border:1px solid #dbeafe;">
          <div style="font-size:15px;font-weight:800;color:#1e293b;">Need anything during your stay?</div>
          <div style="margin-top:8px;color:#475569;font-size:14px;line-height:1.8;">You can contact the front desk anytime for room support, schedule updates, or room-service assistance.</div>
        </div>
      `
    })
  };
}

function buildCheckoutEmail(invoice) {
  const lineRows = invoiceLineItems(invoice)
    .map(
      (item) => `
        <tr>
          <td style="padding:12px 14px;border-bottom:1px solid #e2e8f0;color:#1e293b;font-weight:700;">${item.description}</td>
          <td style="padding:12px 14px;border-bottom:1px solid #e2e8f0;color:#64748b;">${item.quantity}</td>
          <td style="padding:12px 14px;border-bottom:1px solid #e2e8f0;color:#64748b;">${displayMoney(item.unitPrice)}</td>
          <td style="padding:12px 14px;border-bottom:1px solid #e2e8f0;color:#1e293b;font-weight:800;text-align:right;">${displayMoney(item.amount)}</td>
        </tr>
      `
    )
    .join('');

  const booking = invoice.booking;
  return {
    subject: `Checkout Invoice for Room ${booking.room?.number || '-'} | Utkal Reserve`,
    html: buildEmailShell({
      eyebrow: 'Checkout Complete',
      title: `Thank you, ${displayName(booking.guest)}`,
      message: `Your stay has been checked out successfully. We have included your final bill summary below for your records.`,
      accent: '#7c3aed',
      content: `
        <div style="display:flex;justify-content:space-between;gap:16px;align-items:flex-start;flex-wrap:wrap;">
          <div>
            <div style="font-size:12px;color:#64748b;font-weight:700;letter-spacing:.08em;text-transform:uppercase;">Invoice</div>
            <div style="margin-top:8px;font-size:20px;font-weight:800;color:#1e293b;">Room ${booking.room?.number || '-'}</div>
            <div style="margin-top:4px;color:#64748b;font-size:13px;">${displayDate(booking.checkIn)} - ${displayDate(booking.checkOut)}</div>
          </div>
          <div style="padding:10px 14px;border-radius:999px;background:#dcfce7;color:#166534;font-size:12px;font-weight:800;letter-spacing:.08em;">PAID</div>
        </div>
        <div style="margin-top:18px;overflow:hidden;border:1px solid #e2e8f0;border-radius:18px;">
          <table style="width:100%;border-collapse:collapse;background:#ffffff;">
            <thead>
              <tr style="background:#f8fafc;">
                <th style="padding:12px 14px;text-align:left;color:#64748b;font-size:12px;">Description</th>
                <th style="padding:12px 14px;text-align:left;color:#64748b;font-size:12px;">Qty / Days</th>
                <th style="padding:12px 14px;text-align:left;color:#64748b;font-size:12px;">Unit Price</th>
                <th style="padding:12px 14px;text-align:right;color:#64748b;font-size:12px;">Amount</th>
              </tr>
            </thead>
            <tbody>${lineRows}</tbody>
          </table>
        </div>
        <div style="margin-top:18px;margin-left:auto;max-width:290px;padding:18px;border-radius:18px;background:linear-gradient(135deg,#eef4ff,#fff1f8);border:1px solid #dbeafe;">
          <div style="display:flex;justify-content:space-between;color:#475569;font-size:14px;margin-bottom:10px;"><span>Subtotal</span><strong>${displayMoney(invoice.roomTotal + invoice.foodTotal)}</strong></div>
          <div style="display:flex;justify-content:space-between;color:#475569;font-size:14px;margin-bottom:10px;"><span>Taxes</span><strong>${displayMoney(invoice.taxTotal)}</strong></div>
          <div style="display:flex;justify-content:space-between;color:#1e3a8a;font-size:20px;font-weight:800;"><span>Total Due</span><span>${displayMoney(invoice.grandTotal)}</span></div>
          <div style="margin-top:12px;color:#64748b;font-size:12px;">Payment Method: ${booking.paymentMethod || 'Front Desk'}</div>
          <div style="margin-top:4px;color:#64748b;font-size:12px;">Checked out at: ${displayDateTime(booking.checkedOutAt || new Date())}</div>
        </div>
        <div style="margin-top:18px;padding:18px;border-radius:18px;background:#f8fafc;border:1px solid #e2e8f0;color:#475569;font-size:14px;line-height:1.8;">
          You can sign in to your guest portal for future reservations and room-service history.<br />
          <a href="${primaryClientOrigin}/login" style="color:#2952e1;font-weight:700;text-decoration:none;">Open Guest Portal</a>
        </div>
      `
    })
  };
}

async function sendHotelEmail({ to, subject, html }) {
  if (!mailConfigured || !mailTransport) {
    return { sent: false, configured: false, reason: 'Email transport is not configured.' };
  }

  try {
    const info = await mailTransport.sendMail({ from: mailFrom, to, subject, html });
    return { sent: true, configured: true, messageId: info.messageId };
  } catch (error) {
    console.error('Mail send failed:', error.message);
    return { sent: false, configured: true, reason: error.message };
  }
}

async function sendCheckInEmail(booking) {
  if (!booking?.guest?.email) return { sent: false, configured: mailConfigured, reason: 'Guest email is missing.' };
  return sendHotelEmail({
    to: booking.guest.email,
    ...buildCheckInEmail(booking)
  });
}

async function sendCheckoutEmail(invoice) {
  if (!invoice?.booking?.guest?.email) return { sent: false, configured: mailConfigured, reason: 'Guest email is missing.' };
  return sendHotelEmail({
    to: invoice.booking.guest.email,
    ...buildCheckoutEmail(invoice)
  });
}

async function createRazorpayOrder(invoice) {
  if (!razorpayConfigured || !razorpay) {
    const error = new Error('Razorpay is not configured on this server yet.');
    error.status = 503;
    throw error;
  }

  const amount = Math.round(Number(invoice?.grandTotal || 0) * 100);
  if (!['checked-in', 'completed'].includes(invoice?.booking?.status)) {
    const error = new Error('Only checked-in guests can be billed through Razorpay checkout.');
    error.status = 409;
    throw error;
  }
  if (!amount) {
    const error = new Error('Invoice total is zero, so no online payment order can be created.');
    error.status = 400;
    throw error;
  }

  const receipt = `utkal-${String(invoice.booking.id || invoice.booking._id).slice(-8)}-${Date.now().toString().slice(-6)}`;
  const order = await razorpay.orders.create({
    amount,
    currency: paymentCurrency,
    receipt,
    notes: {
      bookingId: String(invoice.booking.id || invoice.booking._id),
      roomNumber: String(invoice.booking.room?.number || '-'),
      guest: displayName(invoice.booking.guest)
    }
  });

  invoice.booking.paymentProvider = 'razorpay';
  invoice.booking.paymentStatus = 'created';
  invoice.booking.paymentOrderId = order.id;
  invoice.booking.paymentReceipt = receipt;
  invoice.booking.paymentCurrency = order.currency;
  invoice.booking.paymentAmount = amount / 100;
  await invoice.booking.save();

  return order;
}

async function finalizeCheckout(bookingId, payment = {}) {
  const invoice = await calculateInvoice(bookingId);
  if (!invoice) return null;
  if (!['checked-in', 'completed'].includes(invoice.booking.status)) {
    const error = new Error('Only checked-in guests can be checked out.');
    error.status = 409;
    throw error;
  }

  const firstCompletion = invoice.booking.status !== 'completed';
  invoice.booking.status = 'completed';
  invoice.booking.paymentMethod = payment.paymentMethod || invoice.booking.paymentMethod || 'Credit/Debit Card';
  invoice.booking.paymentProvider = payment.paymentProvider || invoice.booking.paymentProvider || '';
  invoice.booking.paymentStatus = payment.paymentStatus || invoice.booking.paymentStatus || 'paid';
  invoice.booking.paymentOrderId = payment.paymentOrderId || invoice.booking.paymentOrderId || '';
  invoice.booking.paymentId = payment.paymentId || invoice.booking.paymentId || '';
  invoice.booking.paymentSignature = payment.paymentSignature || invoice.booking.paymentSignature || '';
  invoice.booking.paymentReceipt = payment.paymentReceipt || invoice.booking.paymentReceipt || '';
  invoice.booking.paymentCurrency = payment.paymentCurrency || invoice.booking.paymentCurrency || paymentCurrency;
  invoice.booking.paymentAmount = payment.paymentAmount || invoice.booking.paymentAmount || invoice.grandTotal;
  if (!invoice.booking.checkedOutAt) invoice.booking.checkedOutAt = new Date();

  if (firstCompletion) {
    invoice.booking.room.status = 'dirty';
    await invoice.booking.room.save();
    await addLoyaltyPoints(invoice.booking.guest._id, invoice.grandTotal);
  }

  await invoice.booking.save();
  const refreshedInvoice = await calculateInvoice(invoice.booking._id);
  const mail = firstCompletion ? await sendCheckoutEmail(refreshedInvoice) : { sent: false, configured: mailConfigured, reason: 'Checkout was already completed earlier.' };
  return { invoice: refreshedInvoice, mail };
}

async function unavailableRoomIds(checkIn, checkOut) {
  if (!checkIn || !checkOut) return [];
  const overlapping = await Booking.find({
    status: { $in: ['pending', 'confirmed', 'checked-in'] },
    checkIn: { $lt: new Date(checkOut) },
    checkOut: { $gt: new Date(checkIn) }
  }).select('room');
  return overlapping.map((booking) => booking.room.toString());
}

async function ensureDbConnection() {
  if (mongoose.connection.readyState === 1 && dbReady) {
    return true;
  }

  if (dbPromise) {
    return dbPromise;
  }

  dbPromise = (async () => {
    try {
      const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/utkal_reserve';
      if (mongoose.connection.readyState !== 1) {
        await mongoose.connect(uri, { serverSelectionTimeoutMS: 8000 });
      }

      dbReady = true;
      dbError = '';

      if (String(process.env.SEED_ON_START || 'true').toLowerCase() !== 'false' && !seedPromise) {
        seedPromise = seedDatabase().catch((error) => {
          console.warn(`Seed skipped: ${error.message}`);
        });
      }

      if (seedPromise) {
        await seedPromise;
      }

      return true;
    } catch (error) {
      dbReady = false;
      dbError = error.message;
      throw error;
    } finally {
      dbPromise = null;
    }
  })();

  return dbPromise;
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, dbReady, dbError, brand: 'Utkal Reserve' });
});

app.use('/api', requireDb);

app.post(
  '/api/auth/login',
  asyncHandler(async (req, res) => {
    const identifier = String(req.body.identifier || req.body.email || req.body.username || '').toLowerCase().trim();
    const password = String(req.body.password || '');
    const user = await User.findOne({ $or: [{ email: identifier }, { username: identifier }] });
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ message: 'Invalid username or password.' });
    }
    if (user.role !== 'admin' && managedPanelRoles.includes(user.role)) {
      const settings = await getSystemSettings();
      const lock = panelLockPayload(settings, user.role);
      if (lock.blocked) {
        return res.status(423).json({
          message: blockMessageForRole(user.role, lock.reason),
          role: user.role,
          panelLock: lock
        });
      }
    }
    res.json({ token: signToken(user), user: user.toJSON() });
  })
);

app.post(
  '/api/auth/register',
  asyncHandler(async (req, res) => {
    const { firstName, lastName, email, phone, address } = req.body;
    const username = String(req.body.username || email?.split('@')[0] || '').toLowerCase().trim();
    const existing = await User.findOne({ $or: [{ email: String(email).toLowerCase() }, { username }] });
    if (existing) return res.status(409).json({ message: 'A user with this email or username already exists.' });
    const user = await User.create({
      username,
      email,
      password: await bcrypt.hash(String(req.body.password), 10),
      role: 'guest',
      firstName,
      lastName,
      phone,
      address,
      membershipTier: membershipTierForPoints(0),
      loyaltyPoints: 0
    });
    res.status(201).json({ token: signToken(user), user: user.toJSON() });
  })
);

app.get('/api/auth/me', requireAuth(), (req, res) => res.json({ user: req.user }));

app.get(
  '/api/system/status',
  requireSession(),
  asyncHandler(async (req, res) => {
    const settings = await getSystemSettings();
    const panelLocks = Object.fromEntries(managedPanelRoles.map((role) => [role, panelLockPayload(settings, role)]));
    res.json({
      panelLocks,
      currentRole: req.user.role,
      blocked: req.user.role !== 'admin' && managedPanelRoles.includes(req.user.role) ? panelLockPayload(settings, req.user.role) : { blocked: false, reason: '', updatedAt: null },
      alerts: req.user.role !== 'admin' && managedPanelRoles.includes(req.user.role) ? activeAlertsForRole(settings, req.user.role) : []
    });
  })
);

app.patch(
  '/api/users/me',
  requireAuth(),
  asyncHandler(async (req, res) => {
    const allowed = ['firstName', 'lastName', 'phone', 'address', 'avatar'];
    const update = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) update[key] = req.body[key];
    }
    const user = await User.findByIdAndUpdate(req.user._id, update, { new: true }).select(publicUserFields);
    res.json({ user });
  })
);

app.get(
  '/api/public/rooms',
  asyncHandler(async (req, res) => {
    const { checkIn, checkOut } = req.query;
    const excluded = await unavailableRoomIds(checkIn, checkOut);
    const rooms = await Room.find().sort({ number: 1 });
    res.json({
      rooms: rooms.map((room) => {
        const json = room.toJSON();
        json.availableForDates = room.status === 'available' && !excluded.includes(room.id);
        return json;
      })
    });
  })
);

app.get('/api/public/menu', asyncHandler(async (_req, res) => res.json({ menu: await MenuItem.find().sort({ name: 1 }) })));

app.get(
  '/api/admin/command-center',
  requireAuth('admin'),
  asyncHandler(async (_req, res) => {
    const [rooms, bookings, orders, staff, guests, menu, settings] = await Promise.all([
      Room.find().sort({ number: 1 }),
      Booking.find().populate('guest', publicUserFields).populate('room').sort({ createdAt: -1 }),
      Order.find().populate('guest', publicUserFields).populate('room').sort({ createdAt: -1 }),
      User.find({ role: { $ne: 'guest' } }).select(publicUserFields).sort({ firstName: 1, lastName: 1 }),
      User.find({ role: 'guest' }).select(publicUserFields).sort({ createdAt: -1 }),
      MenuItem.find().sort({ name: 1 }),
      getSystemSettings()
    ]);

    const todayStart = startOfDay();
    const todayEnd = endOfDay();
    const dirtyRooms = rooms.filter((room) => ['dirty', 'maintenance'].includes(room.status));
    const readyOrders = orders.filter((order) => order.status === 'ready');
    const pendingBookings = bookings.filter((booking) => booking.status === 'confirmed');
    const arrivalsToday = bookings.filter((booking) => booking.checkIn >= todayStart && booking.checkIn <= todayEnd);
    const departuresToday = bookings.filter((booking) => booking.checkOut >= todayStart && booking.checkOut <= todayEnd && ['confirmed', 'checked-in'].includes(booking.status));

    const systemNotifications = (settings.alerts || [])
      .filter((alert) => alert.active !== false)
      .slice(-6)
      .map((alert) => ({
        id: `system-${alert.id || alert._id}`,
        title: alert.title,
        message: `${alert.message} · ${Array.isArray(alert.roles) ? alert.roles.join(', ') : 'all panels'}`,
        route: '/admin',
        createdAt: alert.createdAt || alert.updatedAt || new Date().toISOString()
      }));

    const notifications = [
      ...systemNotifications,
      ...readyOrders.slice(0, 2).map((order) => ({
        id: `ready-order-${order.id}`,
        title: `Room ${order.room?.number || '--'} order is ready`,
        message: `${displayName(order.guest)} has a room-service order waiting for delivery.`,
        route: '/admin/kitchen/monitor',
        createdAt: order.updatedAt || order.createdAt
      })),
      ...dirtyRooms.slice(0, 2).map((room) => ({
        id: `room-${room.id}`,
        title: `Room ${room.number} needs attention`,
        message: room.status === 'maintenance' ? 'Room is marked for maintenance follow-up.' : 'Housekeeping follow-up is still pending.',
        route: `/admin/rooms/${room.id}/edit`,
        createdAt: room.updatedAt || room.createdAt
      })),
      ...arrivalsToday.slice(0, 2).map((booking) => ({
        id: `arrival-${booking.id}`,
        title: `${displayName(booking.guest)} arrives today`,
        message: `Room ${booking.room?.number || '--'} is scheduled to check in today.`,
        route: '/admin/bookings',
        createdAt: booking.createdAt
      })),
      ...departuresToday.slice(0, 2).map((booking) => ({
        id: `departure-${booking.id}`,
        title: `${displayName(booking.guest)} departs today`,
        message: `Prepare checkout for Room ${booking.room?.number || '--'}.`,
        route: '/admin/bookings',
        createdAt: booking.updatedAt || booking.createdAt
      }))
    ]
      .sort((left, right) => new Date(right.createdAt) - new Date(left.createdAt))
      .slice(0, 8);

    const searchIndex = [
      ...rooms.map((room) => ({
        id: `room-${room.id}`,
        type: 'Room',
        title: `Room ${room.number}`,
        subtitle: `${room.type} · ${room.status}`,
        meta: `${room.price} ${room.capacity}`,
        keywords: [room.number, room.type, room.status, ...(room.amenities || [])].join(' '),
        route: `/admin/rooms/${room.id}/edit`
      })),
      ...staff.map((member) => ({
        id: `staff-${member.id}`,
        type: 'Staff',
        title: displayName(member),
        subtitle: `${member.jobTitle || member.role} · ${member.email || '-'}`,
        meta: `${member.username || ''} ${member.phone || ''}`,
        keywords: [member.firstName, member.lastName, member.username, member.email, member.role, member.jobTitle].filter(Boolean).join(' '),
        route: `/admin/staff/${member.id}/edit`
      })),
      ...guests.map((guest) => ({
        id: `guest-${guest.id}`,
        type: 'Guest',
        title: displayName(guest),
        subtitle: `${guest.email || '-'} · ${guest.phone || '-'}`,
        meta: `${guest.username || ''} ${guest.address || ''}`,
        keywords: [guest.firstName, guest.lastName, guest.username, guest.email, guest.phone, guest.address].filter(Boolean).join(' '),
        route: `/admin/guests?guestId=${guest.id}`
      })),
      ...menu.map((item) => ({
        id: `menu-${item.id}`,
        type: 'Menu',
        title: item.name,
        subtitle: `${item.category} · $${Number(item.price || 0).toFixed(2)}`,
        meta: item.available ? 'Available' : 'Unavailable',
        keywords: [item.name, item.category, item.description].filter(Boolean).join(' '),
        route: `/admin/kitchen/menu/${item.id}/edit`
      })),
      ...bookings.slice(0, 20).map((booking) => ({
        id: `booking-${booking.id}`,
        type: 'Booking',
        title: `${displayName(booking.guest)} · Room ${booking.room?.number || '--'}`,
        subtitle: `${booking.status} · ${new Date(booking.checkIn).toLocaleDateString('en-US', { month: 'short', day: '2-digit' })}`,
        meta: `${booking.room?.type || ''}`,
        keywords: [displayName(booking.guest), booking.guest?.email, booking.room?.number, booking.room?.type, booking.status].filter(Boolean).join(' '),
        route: '/admin/bookings'
      }))
    ];

    res.json({
      live: {
        pendingBookings: pendingBookings.length,
        dirtyRooms: dirtyRooms.length,
        readyOrders: readyOrders.length,
        arrivalsToday: arrivalsToday.length,
        departuresToday: departuresToday.length
      },
      notifications,
      searchIndex
    });
  })
);

app.get(
  '/api/admin/overview',
  requireAuth('admin'),
  asyncHandler(async (_req, res) => {
    const [rooms, bookings, orders] = await Promise.all([Room.find(), Booking.find().populate('room'), Order.find()]);
    const completed = bookings.filter((booking) => booking.status === 'completed');
    const active = bookings.filter((booking) => booking.status === 'checked-in');
    const deliveredFood = orders.filter((order) => order.status === 'delivered');
    const totalRevenue = completed.reduce((total, booking) => total + booking.grandTotal, 0) + deliveredFood.reduce((total, order) => total + order.total, 0);
    const occupied = rooms.filter((room) => room.status === 'occupied').length;
    const roomPopularity = rooms.reduce((acc, room) => {
      acc[room.type] = (acc[room.type] || 0) + bookings.filter((booking) => booking.room?.id === room.id).length;
      return acc;
    }, {});
    const trendLabels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul'];
    res.json({
      stats: {
        totalRevenue,
        roomsAvailable: rooms.filter((room) => room.status === 'available').length,
        occupancyRate: rooms.length ? Math.round((occupied / rooms.length) * 100) : 0,
        activeGuests: active.length
      },
      revenueTrend: trendLabels.map((name, index) => ({
        name,
        revenue: Math.round((totalRevenue / 7) * (0.45 + index * 0.18) + index * 8)
      })),
      roomPopularity: Object.entries(roomPopularity).map(([name, value]) => ({ name, value: value || 1 }))
    });
  })
);

app.get(
  '/api/admin/system-controls',
  requireAuth('admin'),
  asyncHandler(async (_req, res) => {
    const settings = await getSystemSettings();
    res.json({
      panelLocks: Object.fromEntries(managedPanelRoles.map((role) => [role, panelLockPayload(settings, role)])),
      alerts: (settings.alerts || [])
        .sort((left, right) => new Date(right.createdAt || 0) - new Date(left.createdAt || 0))
        .map((alert) => alert.toJSON ? alert.toJSON() : alert)
    });
  })
);

app.patch(
  '/api/admin/system-controls/roles/:role',
  requireAuth('admin'),
  asyncHandler(async (req, res) => {
    const role = String(req.params.role || '').trim();
    if (!managedPanelRoles.includes(role)) {
      return res.status(400).json({ message: 'This panel cannot be managed from admin controls.' });
    }

    const settings = await getSystemSettings();
    settings.panelLocks[role] = {
      blocked: Boolean(req.body.blocked),
      reason: String(req.body.reason || '').trim(),
      updatedAt: new Date()
    };
    await settings.save();

    res.json({
      role,
      panelLock: panelLockPayload(settings, role),
      panelLocks: Object.fromEntries(managedPanelRoles.map((panelRole) => [panelRole, panelLockPayload(settings, panelRole)]))
    });
  })
);

app.post(
  '/api/admin/system-controls/alerts',
  requireAuth('admin'),
  asyncHandler(async (req, res) => {
    const title = String(req.body.title || '').trim();
    const message = String(req.body.message || '').trim();
    const severity = ['info', 'warning', 'critical'].includes(String(req.body.severity || '')) ? String(req.body.severity) : 'info';
    const roles = Array.isArray(req.body.roles)
      ? req.body.roles.filter((role) => managedPanelRoles.includes(role))
      : managedPanelRoles;

    if (!title || !message) {
      return res.status(400).json({ message: 'Alert title and message are both required.' });
    }
    if (!roles.length) {
      return res.status(400).json({ message: 'Select at least one panel to receive the alert.' });
    }

    const settings = await getSystemSettings();
    settings.alerts.push({
      title,
      message,
      severity,
      roles,
      route: String(req.body.route || '').trim(),
      active: true,
      createdBy: req.user._id
    });
    settings.alerts = settings.alerts.slice(-40);
    await settings.save();

    const latestAlert = settings.alerts[settings.alerts.length - 1];
    res.status(201).json({
      alert: latestAlert.toJSON ? latestAlert.toJSON() : latestAlert,
      alerts: settings.alerts
        .sort((left, right) => new Date(right.createdAt || 0) - new Date(left.createdAt || 0))
        .map((alert) => alert.toJSON ? alert.toJSON() : alert)
    });
  })
);

app.patch(
  '/api/admin/system-controls/alerts/:id',
  requireAuth('admin'),
  asyncHandler(async (req, res) => {
    const settings = await getSystemSettings();
    const alert = settings.alerts.id(req.params.id);
    if (!alert) return res.status(404).json({ message: 'Alert not found.' });

    if (req.body.active !== undefined) alert.active = Boolean(req.body.active);
    if (req.body.message !== undefined) alert.message = String(req.body.message || '').trim();
    if (req.body.title !== undefined) alert.title = String(req.body.title || '').trim();
    await settings.save();

    res.json({
      alert: alert.toJSON ? alert.toJSON() : alert,
      alerts: settings.alerts
        .sort((left, right) => new Date(right.createdAt || 0) - new Date(left.createdAt || 0))
        .map((entry) => entry.toJSON ? entry.toJSON() : entry)
    });
  })
);

app.get('/api/admin/staff', requireAuth('admin'), asyncHandler(async (_req, res) => res.json({ staff: await User.find({ role: { $ne: 'guest' } }).select(publicUserFields).sort({ role: 1 }) })));

app.post(
  '/api/admin/staff',
  requireAuth('admin'),
  asyncHandler(async (req, res) => {
    const user = await User.create({
      ...req.body,
      username: String(req.body.username).toLowerCase().trim(),
      email: String(req.body.email).toLowerCase().trim(),
      password: await bcrypt.hash(String(req.body.password || 'utkal123'), 10)
    });
    res.status(201).json({ staff: user.toJSON() });
  })
);

app.put(
  '/api/admin/staff/:id',
  requireAuth('admin'),
  asyncHandler(async (req, res) => {
    const update = { ...req.body };
    if (update.password) update.password = await bcrypt.hash(String(update.password), 10);
    else delete update.password;
    const user = await User.findByIdAndUpdate(req.params.id, update, { new: true }).select(publicUserFields);
    res.json({ staff: user });
  })
);

app.delete('/api/admin/staff/:id', requireAuth('admin'), asyncHandler(async (req, res) => res.json({ deleted: Boolean(await User.findByIdAndDelete(req.params.id)) })));

app.get('/api/admin/guests', requireAuth('admin', 'frontdesk'), asyncHandler(async (_req, res) => res.json({ guests: await User.find({ role: 'guest' }).select(publicUserFields).sort({ createdAt: -1 }) })));
app.put(
  '/api/admin/guests/:id',
  requireAuth('admin'),
  asyncHandler(async (req, res) => {
    const update = {};
    for (const key of ['firstName', 'lastName', 'phone', 'address', 'avatar']) {
      if (req.body[key] !== undefined) update[key] = req.body[key];
    }
    if (req.body.username !== undefined) update.username = String(req.body.username || '').toLowerCase().trim();
    if (req.body.email !== undefined) update.email = String(req.body.email || '').toLowerCase().trim();
    const guest = await User.findOneAndUpdate({ _id: req.params.id, role: 'guest' }, update, { new: true }).select(publicUserFields);
    if (!guest) return res.status(404).json({ message: 'Guest not found.' });
    res.json({ guest });
  })
);
app.delete(
  '/api/admin/guests/:id',
  requireAuth('admin'),
  asyncHandler(async (req, res) => {
    const [bookingCount, orderCount] = await Promise.all([
      Booking.countDocuments({ guest: req.params.id }),
      Order.countDocuments({ guest: req.params.id })
    ]);
    if (bookingCount || orderCount) {
      return res.status(409).json({ message: 'Guest has booking history and cannot be deleted.' });
    }
    const deleted = await User.findOneAndDelete({ _id: req.params.id, role: 'guest' });
    res.json({ deleted: Boolean(deleted) });
  })
);

app.get('/api/admin/rooms', requireAuth('admin'), asyncHandler(async (_req, res) => res.json({ rooms: await Room.find().sort({ number: 1 }) })));
app.post('/api/admin/rooms', requireAuth('admin'), asyncHandler(async (req, res) => res.status(201).json({ room: await Room.create(req.body) })));
app.put('/api/admin/rooms/:id', requireAuth('admin'), asyncHandler(async (req, res) => res.json({ room: await Room.findByIdAndUpdate(req.params.id, req.body, { new: true }) })));
app.delete('/api/admin/rooms/:id', requireAuth('admin'), asyncHandler(async (req, res) => res.json({ deleted: Boolean(await Room.findByIdAndDelete(req.params.id)) })));

app.get('/api/admin/menu', requireAuth('admin'), asyncHandler(async (_req, res) => res.json({ menu: await MenuItem.find().sort({ name: 1 }) })));
app.post('/api/admin/menu', requireAuth('admin'), asyncHandler(async (req, res) => res.status(201).json({ item: await MenuItem.create(req.body) })));
app.put('/api/admin/menu/:id', requireAuth('admin'), asyncHandler(async (req, res) => res.json({ item: await MenuItem.findByIdAndUpdate(req.params.id, req.body, { new: true }) })));
app.delete('/api/admin/menu/:id', requireAuth('admin'), asyncHandler(async (req, res) => res.json({ deleted: Boolean(await MenuItem.findByIdAndDelete(req.params.id)) })));

app.get(
  '/api/admin/kitchen-performance',
  requireAuth('admin'),
  asyncHandler(async (_req, res) => {
    const orders = await populateOrder(Order.find());
    const deliveredOrders = orders
      .filter((order) => order.status === 'delivered')
      .sort((left, right) => new Date(right.updatedAt || right.createdAt) - new Date(left.updatedAt || left.createdAt));
    const topServers = Object.values(
      deliveredOrders.reduce((acc, order) => {
        const key = order.deliveredBy?.id || 'unknown';
        if (!acc[key]) {
          acc[key] = {
            id: key,
            name: order.deliveredBy
              ? `${order.deliveredBy.firstName || ''} ${order.deliveredBy.lastName || ''}`.trim() || order.deliveredBy.username || 'Unknown'
              : 'None',
            avatar: order.deliveredBy?.avatar || '',
            initials: order.deliveredBy
              ? `${order.deliveredBy.firstName?.[0] || ''}${order.deliveredBy.lastName?.[0] || order.deliveredBy.username?.[0] || ''}`.toUpperCase()
              : '?',
            unknown: !order.deliveredBy,
            count: 0
          };
        }
        acc[key].count += 1;
        return acc;
      }, {})
    )
      .sort((left, right) => right.count - left.count || left.name.localeCompare(right.name))
      .slice(0, 2)
      .map((entry, index) => ({ ...entry, rank: index + 1 }));

    res.json({
      totals: {
        pending: orders.filter((order) => order.status === 'pending').length,
        delivered: deliveredOrders.length
      },
      topServers,
      deliveryLog: deliveredOrders
    });
  })
);

app.get(
  '/api/rooms/status',
  requireAuth('admin', 'frontdesk', 'housekeeping'),
  asyncHandler(async (_req, res) => res.json({ rooms: await Room.find().sort({ number: 1 }) }))
);

app.get(
  '/api/bookings',
  requireAuth('admin', 'frontdesk', 'guest'),
  asyncHandler(async (req, res) => {
    const filter = req.user.role === 'guest' ? { guest: req.user._id } : {};
    const bookings = await populateBooking(Booking.find(filter));
    res.json({ bookings });
  })
);

app.post(
  '/api/bookings',
  requireAuth('guest'),
  asyncHandler(async (req, res) => {
    const room = await Room.findById(req.body.roomId);
    if (!room) return res.status(404).json({ message: 'Room not found.' });
    const excluded = await unavailableRoomIds(req.body.checkIn, req.body.checkOut);
    if (room.status !== 'available' || excluded.includes(room.id)) {
      return res.status(409).json({ message: 'This room is not available for those dates.' });
    }
    const nights = nightsBetween(req.body.checkIn, req.body.checkOut);
    const booking = await Booking.create({
      guest: req.user._id,
      room: room._id,
      checkIn: req.body.checkIn,
      checkOut: req.body.checkOut,
      guests: req.body.guests || 1,
      source: 'online',
      status: 'confirmed',
      roomRate: room.price,
      roomTotal: nights * room.price,
      grandTotal: nights * room.price
    });
    await addLoyaltyPoints(req.user._id, room.price);
    res.status(201).json({ booking: await populateBooking(Booking.findById(booking._id)) });
  })
);

app.post(
  '/api/bookings/walk-in',
  requireAuth('frontdesk', 'admin'),
  asyncHandler(async (req, res) => {
    const room = await Room.findById(req.body.roomId);
    if (!room || room.status !== 'available') return res.status(409).json({ message: 'Selected room is not available.' });
    const email = String(req.body.email).toLowerCase().trim();
    let guest = await User.findOne({ email });
    if (!guest) {
      guest = await User.create({
        username: `${email.split('@')[0]}${Date.now().toString().slice(-4)}`,
        email,
        password: await bcrypt.hash('guest123', 10),
        role: 'guest',
        firstName: req.body.firstName,
        lastName: req.body.lastName,
        phone: req.body.phone,
        address: req.body.address,
        membershipTier: membershipTierForPoints(0)
      });
    }
    const nights = nightsBetween(req.body.checkIn, req.body.checkOut);
    const booking = await Booking.create({
      guest,
      room,
      checkIn: req.body.checkIn,
      checkOut: req.body.checkOut,
      guests: req.body.guests || 1,
      source: 'walk-in',
      status: 'checked-in',
      roomRate: room.price,
      roomTotal: nights * room.price,
      grandTotal: nights * room.price,
      checkedInAt: new Date()
    });
    room.status = 'occupied';
    await room.save();
    const populatedBooking = await populateBooking(Booking.findById(booking._id));
    const mail = await sendCheckInEmail(populatedBooking);
    res.status(201).json({ booking: populatedBooking, mail });
  })
);

app.patch(
  '/api/bookings/:id/check-in',
  requireAuth('frontdesk', 'admin'),
  asyncHandler(async (req, res) => {
    const booking = await Booking.findById(req.params.id).populate('room');
    if (!booking) return res.status(404).json({ message: 'Booking not found.' });
    const alreadyCheckedIn = booking.status === 'checked-in';
    booking.status = 'checked-in';
    booking.checkedInAt = booking.checkedInAt || new Date();
    booking.room.status = 'occupied';
    await booking.room.save();
    await booking.save();
    const populatedBooking = await populateBooking(Booking.findById(booking._id));
    const mail = alreadyCheckedIn ? { sent: false, configured: mailConfigured, reason: 'Guest was already checked in.' } : await sendCheckInEmail(populatedBooking);
    res.json({ booking: populatedBooking, mail });
  })
);

app.get(
  '/api/bookings/:id/invoice',
  requireAuth('frontdesk', 'admin'),
  asyncHandler(async (req, res) => {
    const invoice = await calculateInvoice(req.params.id);
    if (!invoice) return res.status(404).json({ message: 'Booking not found.' });
    res.json({ invoice });
  })
);

app.post(
  '/api/payments/razorpay/order',
  requireAuth('frontdesk', 'admin'),
  asyncHandler(async (req, res) => {
    const invoice = await calculateInvoice(req.body.bookingId);
    if (!invoice) return res.status(404).json({ message: 'Booking not found.' });
    if (invoice.booking.status === 'completed') {
      return res.status(409).json({ message: 'This booking is already checked out.' });
    }

    const order = await createRazorpayOrder(invoice);
    res.json({
      keyId: process.env.RAZORPAY_KEY_ID,
      order,
      prefill: {
        name: displayName(invoice.booking.guest),
        email: invoice.booking.guest?.email || '',
        contact: invoice.booking.guest?.phone || ''
      },
      invoice: {
        bookingId: String(invoice.booking.id || invoice.booking._id),
        roomNumber: invoice.booking.room?.number || '-',
        total: invoice.grandTotal,
        currency: paymentCurrency
      }
    });
  })
);

app.post(
  '/api/payments/razorpay/verify',
  requireAuth('frontdesk', 'admin'),
  asyncHandler(async (req, res) => {
    if (!razorpayConfigured) {
      return res.status(503).json({ message: 'Razorpay is not configured on this server yet.' });
    }

    const invoice = await calculateInvoice(req.body.bookingId);
    if (!invoice) return res.status(404).json({ message: 'Booking not found.' });
    if (!invoice.booking.paymentOrderId) {
      return res.status(400).json({ message: 'No Razorpay order is linked to this booking yet.' });
    }

    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(`${invoice.booking.paymentOrderId}|${req.body.razorpay_payment_id}`)
      .digest('hex');

    if (expectedSignature !== req.body.razorpay_signature) {
      return res.status(400).json({ message: 'Payment verification failed. Signature did not match.' });
    }

    const result = await finalizeCheckout(invoice.booking._id, {
      paymentMethod: 'Razorpay',
      paymentProvider: 'razorpay',
      paymentStatus: 'paid',
      paymentOrderId: invoice.booking.paymentOrderId,
      paymentId: req.body.razorpay_payment_id,
      paymentSignature: req.body.razorpay_signature,
      paymentReceipt: invoice.booking.paymentReceipt,
      paymentCurrency: paymentCurrency,
      paymentAmount: invoice.grandTotal
    });

    res.json({ ...result, paid: true, verified: true });
  })
);

app.patch(
  '/api/bookings/:id/checkout',
  requireAuth('frontdesk', 'admin'),
  asyncHandler(async (req, res) => {
    const result = await finalizeCheckout(req.params.id, {
      paymentMethod: req.body.paymentMethod || 'Credit/Debit Card',
      paymentProvider: req.body.paymentMethod === 'Razorpay' ? 'razorpay' : 'frontdesk',
      paymentStatus: 'paid',
      paymentCurrency,
      paymentAmount: req.body.paymentAmount
    });
    if (!result) return res.status(404).json({ message: 'Booking not found.' });
    res.json({ ...result, paid: true });
  })
);

app.get(
  '/api/frontdesk/overview',
  requireAuth('frontdesk', 'admin'),
  asyncHandler(async (_req, res) => {
    const todayStart = startOfDay();
    const todayEnd = endOfDay();
    const [arrivals, departures, rooms] = await Promise.all([
      populateBooking(Booking.find({ status: 'confirmed', checkIn: { $lte: todayEnd } })),
      populateBooking(Booking.find({ status: 'checked-in', checkOut: { $lte: todayEnd } })),
      Room.find()
    ]);
    res.json({
      stats: {
        expectedArrivals: arrivals.length,
        pendingDepartures: departures.length,
        totalOccupancy: rooms.length ? Math.round((rooms.filter((room) => room.status === 'occupied').length / rooms.length) * 100) : 0
      },
      arrivals,
      departures,
      date: todayStart
    });
  })
);

app.get(
  '/api/guests/dashboard',
  requireAuth('guest'),
  asyncHandler(async (req, res) => {
    const bookings = await populateBooking(Booking.find({ guest: req.user._id }));
    const orders = await Order.find({ guest: req.user._id });
    const active = bookings.find((booking) => ['confirmed', 'checked-in'].includes(booking.status));
    const checkedInBooking = bookings.find((booking) => booking.status === 'checked-in') || null;
    const currentBill = active ? active.grandTotal + orders.filter((order) => String(order.booking) === String(active._id)).reduce((total, order) => total + order.total, 0) : 0;
    res.json({
      user: req.user,
      stats: {
        currentBill,
        membershipTier: membershipTierForPoints(req.user.loyaltyPoints),
        loyaltyPoints: req.user.loyaltyPoints
      },
      bookings,
      active,
      checkedInBooking
    });
  })
);

app.get(
  '/api/orders',
  requireAuth('admin', 'kitchen', 'guest', 'frontdesk'),
  asyncHandler(async (req, res) => {
    const filter = {};
    if (req.user.role === 'guest') filter.guest = req.user._id;
    if (req.query.active === 'true') filter.status = { $in: ['pending', 'cooking', 'ready'] };
    if (req.query.history === 'true') filter.status = 'delivered';
    res.json({ orders: await populateOrder(Order.find(filter)) });
  })
);

app.post(
  '/api/orders',
  requireAuth('guest'),
  asyncHandler(async (req, res) => {
    const booking = await Booking.findOne({ guest: req.user._id, status: 'checked-in' }).sort({ createdAt: -1 });
    if (!booking) {
      const pendingBooking = await Booking.findOne({ guest: req.user._id, status: 'confirmed' }).sort({ createdAt: -1 });
      if (pendingBooking) {
        return res.status(409).json({ message: 'Room service unlocks after the front desk completes your check-in confirmation.' });
      }
      return res.status(409).json({ message: 'You need a checked-in stay before ordering room service.' });
    }
    const requestedItems = Array.isArray(req.body.items) ? req.body.items : [];
    const menuIds = requestedItems.map((item) => item.menuItem);
    const menu = await MenuItem.find({ _id: { $in: menuIds }, available: true });
    const items = requestedItems
      .map((item) => {
        const found = menu.find((entry) => entry.id === item.menuItem);
        return found ? { menuItem: found._id, name: found.name, price: found.price, quantity: Number(item.quantity || 1) } : null;
      })
      .filter(Boolean);
    if (!items.length) return res.status(400).json({ message: 'Select at least one menu item.' });
    const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const order = await Order.create({ guest: req.user._id, booking: booking._id, room: booking.room, items, total, notes: req.body.notes || '' });
    res.status(201).json({ order: await populateOrder(Order.findById(order._id)) });
  })
);

app.patch(
  '/api/orders/:id/status',
  requireAuth('admin', 'kitchen'),
  asyncHandler(async (req, res) => {
    const status = String(req.body.status || '').trim();
    const update = { $set: { status } };
    if (status === 'delivered') update.$set.deliveredBy = req.user._id;
    else update.$unset = { deliveredBy: 1 };

    const order = await Order.findByIdAndUpdate(req.params.id, update, { new: true });
    if (!order) return res.status(404).json({ message: 'Order not found.' });
    res.json({ order: await populateOrder(Order.findById(order._id)) });
  })
);

app.get(
  '/api/housekeeping/tasks',
  requireAuth('housekeeping', 'admin'),
  asyncHandler(async (_req, res) => {
    const rooms = await Room.find({ status: { $in: ['dirty', 'maintenance'] } }).sort({ number: 1 });
    res.json({ rooms, pending: rooms.length });
  })
);

app.patch(
  '/api/housekeeping/rooms/:id/clean',
  requireAuth('housekeeping', 'admin'),
  asyncHandler(async (req, res) => {
    const room = await Room.findById(req.params.id);
    if (!room) return res.status(404).json({ message: 'Room not found.' });
    room.status = 'available';
    room.housekeepingNote = '';
    await room.save();
    const log = await CleaningLog.create({ room: room._id, housekeeper: req.user._id, status: 'changed', verified: true });
    res.json({ room, log });
  })
);

app.get(
  '/api/housekeeping/history',
  requireAuth('housekeeping', 'admin'),
  asyncHandler(async (req, res) => {
    const filter = req.user.role === 'housekeeping' ? { housekeeper: req.user._id } : {};
    res.json({
      logs: await CleaningLog.find(filter).populate('room').populate('housekeeper', publicUserFields).sort({ completedAt: -1 })
    });
  })
);

app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(error.status || 500).json({ message: error.message || 'Server error.' });
});

async function boot() {
  try {
    await ensureDbConnection();
    console.log(`MongoDB connected: ${mongoose.connection.name}`);
  } catch (error) {
    dbError = error.message;
    console.warn(`MongoDB unavailable: ${dbError}`);
  }

  app.listen(port, () => {
    console.log(`Utkal Reserve API running on http://localhost:${port}`);
  });
}

const isDirectRun = process.argv[1] === fileURLToPath(import.meta.url);

if (isDirectRun) {
  boot();
}

export { app, ensureDbConnection };
export default app;
