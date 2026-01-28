# Supabase Setup Guide for Municipal Revenue Management System

This guide walks you through setting up your Municipal Revenue Management System with Supabase as the database.

## Why Supabase?

✅ **Free tier** with generous limits  
✅ **Managed PostgreSQL** - no server maintenance  
✅ **Automatic backups** and point-in-time recovery  
✅ **Global edge network** for fast access  
✅ **Built-in API** (optional for future use)  
✅ **Easy deployment** - production-ready instantly  

---

## Step-by-Step Setup

### 1. Create Supabase Account & Project

1. **Sign Up:**
   - Go to [https://supabase.com](https://supabase.com)
   - Click "Start Your Project"
   - Sign up with GitHub, Google, or email

2. **Create New Project:**
   - Click "New Project" button
   - **Organization**: Select or create your organization
   - **Name**: `municipal-revenue` (or your preferred name)
   - **Database Password**: Set a **strong password** (save this securely!)
   - **Region**: Choose closest to your location (e.g., `West US`, `EU Central`)
   - **Pricing Plan**: Select "Free" tier (sufficient for development)
   - Click "Create New Project"

3. **Wait for Provisioning:**
   - Project creation takes ~2 minutes
   - You'll see "Setting up your project..." loading screen
   - Once ready, you'll see the project dashboard

---

### 2. Get Database Connection Details

1. **Navigate to Database Settings:**
   - In left sidebar, click **Settings** (gear icon)
   - Click **Database**

2. **Copy Connection String:**
   - Scroll to "Connection string" section
   - **Important:** Select **"Connection pooling"** tab (not "Session mode")
   - Mode: Choose **"Transaction"**
   - Click on the connection string to copy it
   
   It will look like:
   ```
   postgresql://postgres.abcdefghijklmnop:[YOUR-PASSWORD]@aws-0-us-west-1.pooler.supabase.com:6543/postgres
   ```

3. **Note Your Password:**
   - Replace `[YOUR-PASSWORD]` in the connection string with the password you set in Step 1
   - **Save this complete connection string** - you'll need it for the backend `.env` file

---

### 3. Run Database Schema in Supabase

1. **Open SQL Editor:**
   - In left sidebar, click **SQL Editor**
   - Click "+ New Query" button

2. **Paste Schema:**
   - Open your local file: `database/schema.sql`
   - Copy **ALL contents** (Ctrl+A, Ctrl+C)
   - Paste into the Supabase SQL Editor

3. **Execute Schema:**
   - Click "Run" button (or press `Ctrl+Enter`)
   - Wait for execution (may take 10-20 seconds)
   - You should see: **"Success. No rows returned"**

4. **Verify Tables Created:**
   - In left sidebar, click **Table Editor**
   - You should see all tables listed:
     - `customers`
     - `properties`
     - `businesses`
     - `bills`
     - `payments`
     - `electoral_areas`
     - `local_areas`
     - `property_classifications`
     - `business_categories`
     - `system_sequences`

---

### 4. Configure Backend to Use Supabase

1. **Navigate to Backend Directory:**
   ```bash
   cd backend
   ```

2. **Create/Edit `.env` File:**
   ```bash
   # Copy example file if you haven't already
   cp .env.example .env
   
   # Edit the file
   code .env  # or use your preferred editor
   ```

3. **Set Environment Variables:**
   ```env
   # Paste your Supabase connection string here
   DATABASE_URL=postgresql://postgres.xxxxx:your-password@aws-0-xx-xxxx.pooler.supabase.com:6543/postgres
   
   # IMPORTANT: Set SSL to true for Supabase
   DATABASE_SSL=true
   
   # Server Configuration
   PORT=5000
   NODE_ENV=development
   
   # CORS - Add your frontend URL
   ALLOWED_ORIGINS=http://localhost:3000
   
   # Municipal Configuration
   MUNICIPAL_CODE=GN
   MUNICIPAL_NAME=GA NORTH MUNICIPAL
   ```

4. **Install Dependencies:**
   ```bash
   npm install
   ```

5. **Test Database Connection:**
   ```bash
   npm run dev
   ```
   
   You should see:
   ```
   ✅ Database connected successfully
   Server running on port 5000
   ```

---

### 5. Configure Frontend

1. **Navigate to Frontend Directory:**
   ```bash
   cd ../frontend
   ```

2. **Verify `.env.local` File:**
   ```bash
   # File should already exist with:
   NEXT_PUBLIC_API_URL=http://localhost:5000/api
   ```

3. **Install Dependencies:**
   ```bash
   npm install
   ```

4. **Start Frontend:**
   ```bash
   npm run dev
   ```
   
   Frontend runs on: http://localhost:3000

---

## Verify Everything Works

### Test 1: Register a Customer
1. Open http://localhost:3000
2. Click "Customers" → "Register New Customer"
3. Fill in form and submit
4. Check Supabase Table Editor → `customers` table
5. You should see the new customer record

### Test 2: Check Auto-Numbering
1. Register a property
2. Note the auto-generated Property Number (e.g., `GN-PR-2026-000001`)
3. Check `system_sequences` table in Supabase
4. Verify the sequence counter incremented

### Test 3: View in Supabase Dashboard
- Go to Supabase → Table Editor
- Browse through tables to see your data
- Use SQL Editor to run custom queries

---

## Supabase Dashboard Features

### Table Editor
- View and edit data directly
- Filter and search records
- Add/delete rows manually
- View relationships between tables

### SQL Editor
- Run custom SQL queries
- Create saved queries
- View query history
- Export results as CSV

### Database Backup (Paid Plans)
- Automatic daily backups
- Point-in-time recovery
- Manual backup creation

### Monitoring
- View connection metrics
- Monitor query performance
- Check database size and usage

---

## Production Deployment

### Backend Deployment (Railway/Render/Vercel)

1. **Set Environment Variable:**
   ```env
   DATABASE_URL=your-supabase-connection-string
   DATABASE_SSL=true
   NODE_ENV=production
   ```

2. **Deploy:**
   - Push code to GitHub
   - Connect your deployment platform
   - Auto-deploys on push

### Frontend Deployment (Vercel)

1. **Set Environment Variable:**
   ```env
   NEXT_PUBLIC_API_URL=https://your-backend-url.com/api
   ```

2. **Deploy:**
   - Connect GitHub repository to Vercel
   - Auto-deploys on every commit

---

## Security Best Practices

### 🔒 Database Security

1. **Row Level Security (RLS)** - Enable in future versions:
   ```sql
   ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
   ```

2. **API Keys** - Never expose your Supabase `service_role` key in frontend

3. **Connection Pooling** - Already configured (using pooler.supabase.com)

4. **SSL/TLS** - Already enabled with `DATABASE_SSL=true`

### 🔐 Environment Variables

- **Never commit** `.env` files to Git (already in `.gitignore`)
- Use separate databases for development and production
- Rotate database passwords regularly
- Use Vercel/Railway's built-in secret management

---

## Troubleshooting

### Issue: "Database connection failed"

**Solution:**
1. Verify connection string is correct
2. Check password doesn't contain special characters that need URL encoding
3. Ensure `DATABASE_SSL=true` is set
4. Verify Supabase project is not paused (free tier pauses after 7 days inactivity)

### Issue: "Too many connections"

**Solution:**
- Use connection pooling URL (`:6543` port) instead of direct connection (`:5432`)
- Already configured in our setup

### Issue: "Schema not found"

**Solution:**
1. Re-run the schema.sql in Supabase SQL Editor
2. Check for errors in SQL execution
3. Verify all tables were created in Table Editor

### Issue: "Permission denied for table"

**Solution:**
- Ensure you're using the connection string with the correct database user
- Check user permissions in Supabase dashboard

### Issue: Supabase project paused

**Solution:**
- Free tier projects pause after 7 days of inactivity
- Simply visit your project dashboard to resume
- Upgrade to paid plan for always-on databases

---

## Migration from Local PostgreSQL to Supabase

If you started with local PostgreSQL and want to move to Supabase:

### Export Local Data

```bash
# Export data from local PostgreSQL
pg_dump -U postgres -d municipal_revenue --data-only --inserts > data_export.sql
```

### Import to Supabase

1. Run schema.sql in Supabase SQL Editor (fresh schema)
2. Run data_export.sql in Supabase SQL Editor (your data)
3. Update backend `.env` with Supabase connection string
4. Restart backend server

---

## Supabase Limits (Free Tier)

| Resource | Free Tier Limit |
|----------|----------------|
| Database Size | 500 MB |
| API Requests | Unlimited |
| Storage | 1 GB |
| Bandwidth | 2 GB |
| Edge Functions | 500K requests/month |

**For production**, consider upgrading to Pro plan ($25/month):
- 8 GB database
- 100 GB storage
- 250 GB bandwidth
- Daily backups
- No project pausing

---

## Next Steps

Once Supabase is set up:

1. ✅ Test all features (customer, property, business registration)
2. ✅ Generate test bills and verify PDF generation
3. ✅ Test bulk printing
4. ✅ Check reports and analytics
5. 🚀 Deploy to production!

---

## Support & Resources

- **Supabase Docs:** https://supabase.com/docs
- **Supabase Discord:** https://discord.supabase.com
- **PostgreSQL Docs:** https://www.postgresql.org/docs/

For issues specific to this Municipal Revenue System, refer to the main [README.md](README.md).

---

**🎉 Congratulations! Your Municipal Revenue Management System is now running on Supabase!**
