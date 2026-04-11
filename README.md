# POS — Point of Sale System

Full-stack POS application for web and mobile.

## Architecture

| Layer | Tech |
|-------|------|
| Backend API | Spring Boot 3 + Java 21 |
| Database | PostgreSQL + Redis |
| Web | React 18 + TypeScript + Vite + Tailwind |
| Mobile | Flutter 3 |
| Auth | JWT + Spring Security |
| Payments | Razorpay |
| SMS | MSG91 |
| WhatsApp | WhatsApp Business API |
| Email | JavaMail / SMTP |

## Quick Start

```bash
# Start infrastructure
docker-compose up -d

# Backend
cd backend && ./mvnw spring-boot:run

# Web
cd web && npm install && npm run dev

# Mobile
cd mobile && flutter pub get && flutter run
```

## Modules

- Auth & Role Management
- Multi-Outlet Management
- Product Catalog & Variants
- Inventory & Stock Transfer
- Sales & Checkout
- Payment Processing
- Customer & Loyalty
- Discounts, Offers & Coupons
- Credit Notes & Returns
- Shift Management
- Receipt Delivery (Email/SMS/WhatsApp)
- Reports & Analytics
- Supplier & Purchase Orders
