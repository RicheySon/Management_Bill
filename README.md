# Municipal Revenue Management System

A comprehensive web-based system for managing municipal revenue collection, including residential property rates, business operating permits (BOP), customer registration, billing, payments, and bulk document printing.

## 🌟 Features

### ✅ Customer & Property Management
- Customer registration with full contact details
- GPS address and landmark tracking
- Electoral area and local community classification
- Unique auto-generated Property Numbers (`GN-PR-2026-000123`)
- Property classification (Residential, Commercial, Industrial)
- Property size-based rate calculation

### ✅ Business Operating Permit (BOP)
- Business registration and categorization
- Unique auto-generated BOP Numbers (`GN-BOP-2026-000045`)
- Business activity tracking
- Link businesses to properties (optional)
- Category-based fee calculation

### ✅ Billing & Payments
- Automated bill generation for properties and businesses
- Arrears tracking and calculation
- Payment recording with receipt generation
- Multiple payment methods support
- Bill history and payment status tracking

### ✅ Bill Printing
- **Exact GA North Municipal bill format replication**
- Individual bill PDF generation
- Bulk bill printing with advanced filters:
  - Filter by electoral area
  - Filter by property type/business category
  - Filter by payment status
  - Filter by billing year
- A4 print-ready format
- Official receipt generation

### ✅ Administration & Reporting
- Dashboard with revenue statistics
- Daily, monthly, and yearly revenue reports
- Defaulters tracking
- Area-based revenue analytics
- Business category performance reports
- Recent payments overview

## 🛠️ Technology Stack

### Backend
- **Node.js** + **TypeScript**
- **Express.js** - REST API framework
- **PostgreSQL** - Relational database
- **PDFKit** - PDF generation
- **Joi** - Request validation

### Frontend
- **Next.js 14** - React framework with App Router
- **TypeScript** - Type safety
- **Tailwind CSS** - Styling
- **React Hook Form** - Form handling
- **Axios** - HTTP client
- **Lucide Icons** - Icon library

## 📋 Prerequisites

Before you begin, ensure you have the following:

- **Node.js** (v18 or higher)
- **npm** or **yarn**
- **Supabase Account** (recommended) OR **Local PostgreSQL** (v14 or higher)

## 🚀 Installation & Setup

### 1. Database Setup

#### Option A: Supabase (Recommended for Production) ☁️

1. **Create a Supabase Project:**
   - Go to [https://supabase.com](https://supabase.com)
   - Click "New Project"
   - Choose organization and set project name: `municipal-revenue`
   - Set a strong database password
   - Select region closest to your users
   - Wait for project to be created (~2 minutes)

2. **Get Connection Details:**
   - In your Supabase project dashboard, go to **Settings** → **Database**
   - Under "Connection string", copy the **Connection pooling** URI (recommended for serverless)
   - It looks like: `postgresql://postgres.xxxxx:password@aws-0-xx-xxxx.pooler.supabase.com:6543/postgres`

3. **Run Database Schema:**
   - In Supabase dashboard, go to **SQL Editor**
   - Click "New Query"
   - Copy and paste contents of `database/schema.sql`
   - Click "Run" or press `Ctrl+Enter`
   - You should see "Success. No rows returned"

4. **Verify Setup:**
   - Go to **Table Editor** in Supabase
   - You should see all tables: `customers`, `properties`, `businesses`, `bills`, etc.

#### Option B: Local PostgreSQL (Development)

```bash
# Create PostgreSQL database
createdb municipal_revenue

# Run the database schema
psql -d municipal_revenue -f database/schema.sql
```

> 📘 **Need help with Supabase?** See the detailed [Supabase Setup Guide](SUPABASE_SETUP.md) for step-by-step instructions with screenshots and troubleshooting.

### 2. Backend Setup

```bash
# Navigate to backend directory
cd backend

# Install dependencies
npm install

# Copy environment file
cp .env.example .env
```

**Edit `.env` file with your database credentials:**

**For Supabase:**
```env
# Use the connection pooling URI from Supabase
DATABASE_URL=postgresql://postgres.xxxxx:your-password@aws-0-xx-xxxx.pooler.supabase.com:6543/postgres
DATABASE_SSL=true

# Server Configuration
PORT=5000
NODE_ENV=development

# CORS
ALLOWED_ORIGINS=http://localhost:3000

# Municipal Configuration
MUNICIPAL_CODE=GN
MUNICIPAL_NAME=GA NORTH MUNICIPAL
```

**For Local PostgreSQL:**
```env
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_NAME=municipal_revenue
DATABASE_USER=postgres
DATABASE_PASSWORD=your_password
DATABASE_SSL=false

# Server Configuration  
PORT=5000
NODE_ENV=development

# CORS
ALLOWED_ORIGINS=http://localhost:3000

# Municipal Configuration
MUNICIPAL_CODE=GN
MUNICIPAL_NAME=GA NORTH MUNICIPAL
```

**Start the server:**
```bash
# Build TypeScript
npm run build

# Start development server
npm run dev
```

Backend will run on **http://localhost:5000**

### 3. Frontend Setup

```bash
# Navigate to frontend directory
cd frontend

# Install dependencies
npm install

# Copy environment file (already created)
# .env.local already contains:
# NEXT_PUBLIC_API_URL=http://localhost:5000/api

# Start development server
npm run dev
```

Frontend will run on **http://localhost:3000**

## 📝 Usage Guide

### Register a New Customer
1. Navigate to **Customers** → **Register New Customer**
2. Fill in customer details:
   - Full Name
   - Phone Number
   - GPS Address
   - Electoral Area
   - Landmark
3. Click **Register Customer**

### Register a Property
1. Navigate to **Properties** → **Register New Property**
2. Select customer/owner from dropdown
3. Choose property classification (Residential/Commercial/Industrial)
4. Enter property size and location details
5. Click **Register Property**
6. **Property Number is auto-generated** (e.g., `GN-PR-2026-000001`)

### Register a Business (BOP)
1. Navigate to **Businesses** → **Register New Business**
2. Enter business name and select owner
3. Choose business category
4. Describe business activity
5. Optionally link to a property
6. Click **Register Business**
7. **BOP Number is auto-generated** (e.g., `GN-BOP-2026-000001`)

### Generate a Bill
1. Navigate to **Billing**
2. Select bill type (Property Rate or BOP)
3. Choose customer and property/business
4. Select billing year
5. Click **Generate Bill**
6. System calculates total amount including arrears

### Print Bills
**Single Bill:**
- Go to bill details page
- Click **Print Bill** button
- PDF downloads automatically

**Bulk Bills:**
1. Navigate to **Print** page
2. Apply filters:
   - Electoral Area
   - Bill Type (Property/BOP)
   - Payment Status
   - Year
3. Click **Generate Bulk PDF**
4. All matching bills are compiled into one PDF

## 🔧 Configuration

### Municipal Settings

Edit these values in the backend `.env` file:

```env
MUNICIPAL_CODE=GN
MUNICIPAL_NAME=GA NORTH MUNICIPAL
```

### Rate Configuration

Property rates and BOP fees can be configured in the database:

```sql
-- Update property classification rates
UPDATE property_classifications SET base_rate = 10.00 WHERE name = 'Residential';

-- Update business category fees
UPDATE business_categories SET base_fee = 500.00 WHERE name = 'GIFT SHOP';
```

### Add Electoral Areas

```sql
INSERT INTO electoral_areas (name, code) VALUES ('NEW AREA', 'NA');
INSERT INTO local_areas (name, electoral_area_id) VALUES ('Community Name', 1);
```

## 🖨️ Bill Format

The system generates bills matching the **GA North Municipal** format exactly:

- Municipal header with logo placeholders
- Customer details (Name, Phone, Customer Number)
- Property/Business information
- GPS coordinates and electoral area
- Itemized charges table (Current Rate, Arrears, Rebates)
- Amount Paid and Amount Due
- Bill period and issue date
- Footer with payment instructions

## 📊 API Endpoints

### Customers
- `POST /api/customers` - Create customer
- `GET /api/customers` - List customers
- `GET /api/customers/:id` - Get customer details

### Properties
- `POST /api/properties` - Register property (auto-generates number)
- `GET /api/properties` - List properties
- `GET /api/properties/:id` - Get property details

### Businesses
- `POST /api/businesses` - Register business (auto-generates BOP number)
- `GET /api/businesses` - List businesses
- `GET /api/businesses/:id` - Get business details

### Billing
- `POST /api/bills/generate` - Generate bill
- `GET /api/bills` - List bills
- `POST /api/bills/:id/payment` - Record payment

### Printing
- `GET /api/print/bill/:id` - Download bill PDF
- `POST /api/print/bills/bulk` - Generate bulk bills PDF
- `GET /api/print/receipt/:paymentId` - Download receipt PDF

### Reports
- `GET /api/reports/dashboard` - Dashboard statistics
- `GET /api/reports/revenue` - Revenue reports
- `GET /api/reports/defaulters` - Unpaid bills report
- `GET /api/reports/by-area` - Area-based analytics

## 🔒 Security Considerations

- Use strong database passwords
- Enable SSL for production PostgreSQL connections
- Implement authentication (NextAuth.js recommended for future versions)
- Use environment variables for sensitive data
- Enable CORS only for trusted origins

## 🚢 Deployment

### Database (Supabase - Recommended)

**Your database is already production-ready if using Supabase!**

No additional setup needed - Supabase provides:
- ✅ Automatic backups
- ✅ SSL/TLS encryption
- ✅ Connection pooling
- ✅ Global CDN
- ✅ 99.9% uptime SLA

Just ensure you're using the **Connection Pooling** URI in production.

### Backend Deployment (Railway/Render/Vercel)

1. **Create new project** in your deployment platform
2. **Connect GitHub repository**
3. **Set Environment Variables:**
   ```env
   DATABASE_URL=your-supabase-connection-pooling-uri
   DATABASE_SSL=true
   NODE_ENV=production
   PORT=5000
   ALLOWED_ORIGINS=https://your-frontend-domain.com
   MUNICIPAL_CODE=GN
   MUNICIPAL_NAME=GA NORTH MUNICIPAL
   ```
4. **Deploy** - Platform will auto-build and start

**Recommended Platforms:**
- **Railway** - Best for Node.js backends, $5/month
- **Render** - Free tier available, auto-deploy on push  
- **Vercel** - Serverless functions (requires some refactoring)

### Frontend Deployment (Vercel - Recommended)

1. **Connect GitHub repository** to Vercel
2. **Configure Project:**
   - Framework Preset: Next.js
   - Root Directory: `frontend`
   - Build Command: `npm run build`
   - Output Directory: `.next`
3. **Set Environment Variable:**
   ```env
   NEXT_PUBLIC_API_URL=https://your-backend-url.com/api
   ```
4. **Deploy** - Auto-deploys on every push to main branch

🎉 **Your system is now live!**

## 🐛 Troubleshooting

**Database connection failed:**
```bash
# Check PostgreSQL is running
sudo systemctl status postgresql

# Verify credentials in .env file
psql -U postgres -d municipal_revenue
```

**Auto-numbering not working:**
```sql
-- Check sequences table
SELECT * FROM system_sequences;

-- Reinitialize if needed
INSERT INTO system_sequences (sequence_type, year, last_number, prefix) 
VALUES ('PROPERTY', 2026, 0, 'GN-PR');
```

**PDF generation errors:**
```bash
# Ensure PDFKit is installed
npm install pdfkit @types/pdfkit
```

## 📄 License

This project is proprietary software developed for GA North Municipal.

## 🤝 Support

For technical support, contact the development team or refer to the implementation plan documentation.

---

**Built with ❤️ for efficient municipal revenue management**
