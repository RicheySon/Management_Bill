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

Before you begin, ensure you have the following installed:

- **Node.js** (v18 or higher)
- **PostgreSQL** (v14 or higher)
- **npm** or **yarn**

## 🚀 Installation & Setup

### 1. Database Setup

```bash
# Create PostgreSQL database
createdb municipal_revenue

# Run the database schema
psql -d municipal_revenue -f database/schema.sql
```

### 2. Backend Setup

```bash
# Navigate to backend directory
cd backend

# Install dependencies
npm install

# Copy environment file
cp .env.example .env

# Edit .env file with your database credentials
# DATABASE_HOST=localhost
# DATABASE_PORT=5432
# DATABASE_NAME=municipal_revenue
# DATABASE_USER=postgres
# DATABASE_PASSWORD=your_password

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

### Backend Deployment (Railway/Render)

1. Create new PostgreSQL database instance
2. Run `database/schema.sql` on production database
3. Deploy backend with environment variables set
4. Ensure `DATABASE_SSL=true` for production

### Frontend Deployment (Vercel)

1. Connect GitHub repository
2. Set environment variable: `NEXT_PUBLIC_API_URL=https://your-backend-url.com/api`
3. Deploy

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
