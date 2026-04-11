import 'dotenv/config';
import 'express-async-errors';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import path from 'path';
import { createServer } from 'http';
import { Server } from 'socket.io';

import { errorHandler, notFound } from './middleware/errorHandler';
import { activityLogMiddleware } from './middleware/activityLog';

// Routes
import authRoutes from './routes/auth.routes';
import userRoutes from './routes/users.routes';
import outletRoutes from './routes/outlets.routes';
import productRoutes from './routes/products.routes';
import categoryRoutes from './routes/categories.routes';
import taxGroupRoutes from './routes/taxGroups.routes';
import inventoryRoutes from './routes/inventory.routes';
import customerRoutes from './routes/customers.routes';
import orderRoutes from './routes/orders.routes';
import invoiceRoutes from './routes/invoices.routes';
import quotationRoutes from './routes/quotations.routes';
import discountRoutes from './routes/discounts.routes';
import expenseRoutes from './routes/expenses.routes';
import expenseCategoryRoutes from './routes/expenseCategories.routes';
import purchasesRoutes from './routes/purchases.routes';
import purchaseOrderRoutes from './routes/purchaseOrders.routes';
import purchaseBillRoutes from './routes/purchaseBills.routes';
import purchaseReturnRoutes from './routes/purchaseReturns.routes';
import reportRoutes from './routes/reports.routes';
import integrationRoutes from './routes/integrations.routes';
import shiftRoutes from './routes/shifts.routes';
import activityLogRoutes from './routes/activityLogs.routes';
import creditNoteRoutes from './routes/creditNotes.routes';
import incentiveRoutes from './routes/incentives.routes';
import customRoleRoutes from './routes/customRoles.routes';
import bulkPurchaseRoutes from './routes/bulkPurchases.routes';
import staffRoutes from './routes/staff.routes';
import priceListRoutes from './routes/priceLists.routes';
import gstRoutes from './routes/gst.routes';
import salesOrderRoutes from './routes/salesOrders.routes';

import prisma from './utils/prisma';
import { startScheduler } from './scheduler';
import { hashPassword } from './utils/bcrypt';

const app = express();
const httpServer = createServer(app);

// Socket.io
const io = new Server(httpServer, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    methods: ['GET', 'POST'],
  },
});

io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  if (!token) return next(new Error('Authentication required'));
  try {
    const { verifyToken } = require('./utils/jwt');
    verifyToken(token);
    next();
  } catch {
    next(new Error('Invalid token'));
  }
});

io.on('connection', (socket) => {
  console.log(`[WebSocket] Client connected: ${socket.id}`);
  socket.on('join-outlet', (outletId: string) => {
    socket.join(`outlet:${outletId}`);
  });
  socket.on('disconnect', () => {
    console.log(`[WebSocket] Client disconnected: ${socket.id}`);
  });
});

// Export io for use in services
export { io };

// Middleware
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
}));
app.use(morgan('combined'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static uploads
const uploadDir = process.env.UPLOAD_DIR || 'uploads';
app.use('/uploads', express.static(path.resolve(uploadDir)));

// Activity log middleware (after auth, for mutating requests)
app.use(activityLogMiddleware);

// API Routes
const API_PREFIX = '/api';

app.use(`${API_PREFIX}/auth`, authRoutes);
app.use(`${API_PREFIX}/users`, userRoutes);
app.use(`${API_PREFIX}/outlets`, outletRoutes);
app.use(`${API_PREFIX}/products`, productRoutes);
app.use(`${API_PREFIX}/categories`, categoryRoutes);
app.use(`${API_PREFIX}/tax-groups`, taxGroupRoutes);
app.use(`${API_PREFIX}/inventory`, inventoryRoutes);
app.use(`${API_PREFIX}/customers`, customerRoutes);
app.use(`${API_PREFIX}/orders`, orderRoutes);
app.use(`${API_PREFIX}/invoices`, invoiceRoutes);
app.use(`${API_PREFIX}/quotations`, quotationRoutes);
app.use(`${API_PREFIX}/discounts`, discountRoutes);
app.use(`${API_PREFIX}/expenses`, expenseRoutes);
app.use(`${API_PREFIX}/expense-categories`, expenseCategoryRoutes);
app.use(`${API_PREFIX}/vendors`, purchasesRoutes);
app.use(`${API_PREFIX}/purchase-orders`, purchaseOrderRoutes);
app.use(`${API_PREFIX}/purchase-bills`, purchaseBillRoutes);
app.use(`${API_PREFIX}/purchase-returns`, purchaseReturnRoutes);
app.use(`${API_PREFIX}/reports`, reportRoutes);
app.use(`${API_PREFIX}/integrations`, integrationRoutes);
app.use(`${API_PREFIX}/shifts`, shiftRoutes);
app.use(`${API_PREFIX}/activity-logs`, activityLogRoutes);
app.use(`${API_PREFIX}/credit-notes`, creditNoteRoutes);
app.use(`${API_PREFIX}/incentives`, incentiveRoutes);
app.use(`${API_PREFIX}/custom-roles`, customRoleRoutes);
app.use(`${API_PREFIX}/bulk-purchases`, bulkPurchaseRoutes);
app.use(`${API_PREFIX}/staff`, staffRoutes);
app.use(`${API_PREFIX}/price-lists`, priceListRoutes);
app.use(`${API_PREFIX}/gst`, gstRoutes);
app.use(`${API_PREFIX}/sales-orders`, salesOrderRoutes);

// Health check
app.get('/health', (_req, res) => res.json({ status: 'UP', timestamp: new Date().toISOString() }));
app.get(`${API_PREFIX}/health`, (_req, res) => res.json({ status: 'UP', timestamp: new Date().toISOString() }));

// 404 & Error handlers
app.use(notFound);
app.use(errorHandler);

// ── DataSeeder equivalent ───────────────────────────────────────────────────
async function seedDatabase() {
  // Seed built-in roles
  const roleNames = ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'CASHIER', 'INVENTORY_MANAGER', 'ACCOUNTANT'];
  for (const name of roleNames) {
    await prisma.role.upsert({
      where: { name: name as never },
      update: {},
      create: { name: name as never },
    });
  }

  // Seed default tax groups (GST)
  const taxGroups = [
    { name: 'GST 0%', totalRate: 0, cgstRate: 0, sgstRate: 0, igstRate: 0, cessRate: 0, inclusive: false },
    { name: 'GST 5%', totalRate: 5, cgstRate: 2.5, sgstRate: 2.5, igstRate: 0, cessRate: 0, inclusive: false },
    { name: 'GST 12%', totalRate: 12, cgstRate: 6, sgstRate: 6, igstRate: 0, cessRate: 0, inclusive: false },
    { name: 'GST 18%', totalRate: 18, cgstRate: 9, sgstRate: 9, igstRate: 0, cessRate: 0, inclusive: false },
    { name: 'GST 28%', totalRate: 28, cgstRate: 14, sgstRate: 14, igstRate: 0, cessRate: 0, inclusive: false },
  ];

  for (const tg of taxGroups) {
    const exists = await prisma.taxGroup.findUnique({ where: { name: tg.name } });
    if (!exists) {
      await prisma.taxGroup.create({ data: tg as never });
      console.log(`[Seeder] Created tax group: ${tg.name}`);
    }
  }

  // Seed default outlet
  const outletCount = await prisma.outlet.count();
  if (outletCount === 0) {
    const outlet = await prisma.outlet.create({
      data: {
        name: 'Main Store',
        code: 'MAIN',
        active: true,
      },
    });
    console.log(`[Seeder] Created default outlet: ${outlet.name}`);

    // Seed super admin
    const adminEmail = 'admin@pos.com';
    const existingAdmin = await prisma.user.findUnique({ where: { email: adminEmail } });
    if (!existingAdmin) {
      const superAdminRole = await prisma.role.findUnique({ where: { name: 'SUPER_ADMIN' } });
      if (superAdminRole) {
        const hashedPwd = await hashPassword('Admin@123');
        await prisma.user.create({
          data: {
            name: 'Super Admin',
            email: adminEmail,
            password: hashedPwd,
            outletId: outlet.id,
            active: true,
            userRoles: { create: [{ roleId: superAdminRole.id }] },
          },
        });
        console.log(`[Seeder] Created super admin: ${adminEmail} / Admin@123`);
      }
    }
  }

  // Seed default expense categories
  const defaultCategories = [
    { name: 'Rent', color: '#EF4444', icon: 'home' },
    { name: 'Utilities', color: '#F97316', icon: 'zap' },
    { name: 'Salaries', color: '#EAB308', icon: 'users' },
    { name: 'Marketing', color: '#22C55E', icon: 'megaphone' },
    { name: 'Supplies', color: '#3B82F6', icon: 'package' },
    { name: 'Maintenance', color: '#8B5CF6', icon: 'wrench' },
    { name: 'Other', color: '#6B7280', icon: 'receipt' },
  ];

  for (const cat of defaultCategories) {
    const exists = await prisma.expenseCategory.findFirst({ where: { name: cat.name, system: true } });
    if (!exists) {
      await prisma.expenseCategory.create({ data: { ...cat, system: true, active: true } });
    }
  }
}

// ── Server startup ──────────────────────────────────────────────────────────
const PORT = parseInt(process.env.PORT || '8080');

httpServer.listen(PORT, async () => {
  console.log(`[Server] POS Backend running on port ${PORT}`);
  console.log(`[Server] Environment: ${process.env.NODE_ENV || 'development'}`);

  try {
    await prisma.$connect();
    console.log('[Database] Connected successfully');

    await seedDatabase();
    console.log('[Seeder] Database seed complete');

    startScheduler();
  } catch (err) {
    console.error('[Startup] Error during initialization:', err);
  }
});

process.on('SIGTERM', async () => {
  console.log('[Server] SIGTERM received, shutting down gracefully...');
  await prisma.$disconnect();
  httpServer.close();
});

process.on('SIGINT', async () => {
  await prisma.$disconnect();
  process.exit(0);
});

export default app;
