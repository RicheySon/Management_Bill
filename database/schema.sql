-- Municipal Revenue Management System - Database Schema
-- PostgreSQL 14+
-- Author: AI Generated
-- Date: 2026-01-28

-- =====================================================
-- EXTENSIONS
-- =====================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- LOOKUP TABLES
-- =====================================================

-- Electoral Areas
CREATE TABLE electoral_areas (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    code VARCHAR(20) NOT NULL UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Local Areas / Communities
CREATE TABLE local_areas (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    electoral_area_id INTEGER REFERENCES electoral_areas(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Property Classifications
CREATE TABLE property_classifications (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE,
    description TEXT,
    base_rate DECIMAL(10, 2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert default property classifications
INSERT INTO property_classifications (name, description, base_rate) VALUES
('Residential', 'Residential properties for living purposes', 8.00),
('Commercial', 'Commercial properties for business use', 12.00),
('Industrial', 'Industrial properties for manufacturing/production', 15.00);

-- Business Categories
CREATE TABLE business_categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    base_fee DECIMAL(10, 2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert default business categories
INSERT INTO business_categories (name, description, base_fee) VALUES
('GIFT SHOP', 'Retail gift and novelty items', 400.00),
('ELECTRICALS', 'Electrical goods and services', 500.00),
('RESTAURANT', 'Food service and dining', 600.00),
('GROCERY', 'General merchandise and groceries', 450.00),
('PHARMACY', 'Pharmaceutical and medical supplies', 550.00),
('HARDWARE', 'Hardware and construction materials', 500.00),
('HARDWARE', 'Hardware and construction materials', 500.00),
('SALON/BARBER', 'Personal grooming services', 350.00),
('GENERAL MERCHANDISE', 'Various retail goods', 400.00);

-- =====================================================
-- RBAC TABLES (Role-Based Access Control)
-- =====================================================

-- Users Table
CREATE TABLE system_users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    full_name VARCHAR(200) NOT NULL,
    email VARCHAR(100) NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    status VARCHAR(20) DEFAULT 'ACTIVE', -- ACTIVE, INACTIVE, SUSPENDED
    last_login TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Roles Table
CREATE TABLE roles (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Permissions Table
CREATE TABLE permissions (
    id SERIAL PRIMARY KEY,
    code VARCHAR(50) NOT NULL UNIQUE, -- e.g., 'create_customer', 'generate_bill'
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Role-Permissions Join Table
CREATE TABLE role_permissions (
    role_id INTEGER REFERENCES roles(id) ON DELETE CASCADE,
    permission_id INTEGER REFERENCES permissions(id) ON DELETE CASCADE,
    PRIMARY KEY (role_id, permission_id)
);

-- User-Roles Join Table
CREATE TABLE user_roles (
    user_id UUID REFERENCES system_users(id) ON DELETE CASCADE,
    role_id INTEGER REFERENCES roles(id) ON DELETE CASCADE,
    PRIMARY KEY (user_id, role_id)
);

-- User-Electoral Areas Join Table
CREATE TABLE user_electoral_areas (
    user_id UUID REFERENCES system_users(id) ON DELETE CASCADE,
    electoral_area_id INTEGER REFERENCES electoral_areas(id) ON DELETE CASCADE,
    PRIMARY KEY (user_id, electoral_area_id)
);

-- Audit Logs Table
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES system_users(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL, -- e.g., 'CREATE_CUSTOMER', 'DELETE_BILL'
    entity_type VARCHAR(50), -- e.g., 'customers', 'bills'
    entity_id VARCHAR(50),
    old_values JSONB,
    new_values JSONB,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert Default Roles
INSERT INTO roles (name, description) VALUES
('Super Admin', 'Full system access'),
('Admin', 'Management and approval access'),
('Revenue Officer', 'Registration and billing access'),
('Cashier', 'Payment recording only'),
('Data Entry', 'Registration/Capturing only'),
('Supervisor', 'Review and approval access'),
('Auditor', 'Read-only access'),
('Revenue Collector', 'Field data collection and registration');

-- Insert Granular Permissions
INSERT INTO permissions (code, description) VALUES
('manage_users', 'Full user and role management'),
('configure_rates', 'Configure billing rates and system fees'),
('create_customer', 'Register new customers'),
('edit_customer', 'Modify customer details'),
('delete_customer', 'Delete customer records'),
('view_customer', 'View customer details'),
('register_property', 'Register new properties'),
('edit_property', 'Modify property details'),
('register_business', 'Register new businesses'),
('edit_business', 'Modify business details'),
('generate_bill', 'Generate new invoices/bills'),
('delete_bill', 'Cancel/Delete existing bills'),
('print_bill', 'Print individual bills'),
('bulk_print', 'Access bulk printing tools'),
('record_payment', 'Recieve and record payments'),
('void_payment', 'Void payment receipts'),
('view_reports', 'Access financial and revenue reports'),
('view_logs', 'View system audit logs');

-- Map Permissions to Super Admin (All)
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p WHERE r.name = 'Super Admin';

-- Map Permissions to Admin
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p 
WHERE r.name = 'Admin' AND p.code IN (
    'create_customer', 'edit_customer', 'view_customer',
    'register_property', 'edit_property',
    'register_business', 'edit_business',
    'generate_bill', 'print_bill', 'bulk_print', 'view_reports'
);

-- Map Permissions to Revenue Officer
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p 
WHERE r.name = 'Revenue Officer' AND p.code IN (
    'create_customer', 'view_customer',
    'register_property', 'register_business',
    'generate_bill', 'print_bill', 'record_payment'
);

-- Map Permissions to Cashier
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p 
WHERE r.name = 'Cashier' AND p.code IN (
    'view_customer', 'record_payment', 'print_bill'
);

-- Map Permissions to Data Entry
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p 
WHERE r.name = 'Data Entry' AND p.code IN (
    'create_customer', 'view_customer', 'register_property', 'register_business'
);

-- Map Permissions to Supervisor
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p 
WHERE r.name = 'Supervisor' AND p.code IN (
    'view_customer', 'view_reports', 'bulk_print'
);

-- Map Permissions to Auditor
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'Auditor' AND p.code IN (
    'view_customer', 'view_reports', 'view_logs'
);

-- Map Permissions to Revenue Collector
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'Revenue Collector' AND p.code IN (
    'create_customer', 'view_customer',
    'register_property',
    'register_business'
);

-- Seed Initial Super Admin (Password: admin123)
-- Hash generated for 'admin123' using bcrypt
INSERT INTO system_users (full_name, email, password_hash)
VALUES ('System Administrator', 'admin@ganorth.gov.gh', '$2b$10$79baPeV16rXtK2yFKJkrK.IQZ4L9pHrVrJDQkfS3SaQawCAI65w1W');

INSERT INTO user_roles (user_id, role_id)
SELECT u.id, r.id FROM system_users u, roles r 
WHERE u.email = 'admin@ganorth.gov.gh' AND r.name = 'Super Admin';

-- =====================================================
-- CORE TABLES
-- =====================================================

-- Customers / Citizens / Rate Payers
CREATE TABLE customers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    full_name VARCHAR(200) NOT NULL,
    phone_number VARCHAR(20) NOT NULL,
    email VARCHAR(100),
    address TEXT,
    gender VARCHAR(20),
    marital_status VARCHAR(20),
    gps_address VARCHAR(50),
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    physical_location TEXT,
    landmark TEXT,
    electoral_area_id INTEGER REFERENCES electoral_areas(id),
    local_area_id INTEGER REFERENCES local_areas(id),
    next_of_kin_name VARCHAR(200),
    next_of_kin_contact VARCHAR(20),
    ghana_card_no VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_customers_phone ON customers(phone_number);
CREATE INDEX idx_customers_name ON customers(full_name);
CREATE INDEX idx_customers_electoral_area ON customers(electoral_area_id);

-- Properties
CREATE TABLE properties (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    property_number VARCHAR(30) NOT NULL UNIQUE,
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    classification_id INTEGER NOT NULL REFERENCES property_classifications(id),
    property_use VARCHAR(50),
    building_type VARCHAR(50),
    no_of_storeys INTEGER DEFAULT 0,
    ownership VARCHAR(50),
    building_permit_status VARCHAR(50),
    account_number VARCHAR(50),
    parcel_number VARCHAR(50),
    house_number VARCHAR(50),
    source_of_water VARCHAR(50),
    sanitation_facility VARCHAR(50),
    solid_waste_disposal VARCHAR(50),
    liquid_waste_disposal VARCHAR(50),
    no_of_people INTEGER DEFAULT 0,
    no_of_bedrooms INTEGER DEFAULT 0,
    no_of_washrooms INTEGER DEFAULT 0,
    no_of_other_rooms INTEGER DEFAULT 0,
    street_name VARCHAR(200),
    gps_address VARCHAR(50),
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    town VARCHAR(100),
    physical_location TEXT,
    landmark TEXT,
    electoral_area_id INTEGER REFERENCES electoral_areas(id),
    local_area_id INTEGER REFERENCES local_areas(id),
    population_density VARCHAR(50),
    property_size DECIMAL(10, 2), -- in square meters
    year_registered INTEGER NOT NULL,
    status VARCHAR(20) DEFAULT 'ACTIVE', -- ACTIVE, INACTIVE, DEMOLISHED
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_properties_number ON properties(property_number);
CREATE INDEX idx_properties_customer ON properties(customer_id);
CREATE INDEX idx_properties_classification ON properties(classification_id);
CREATE INDEX idx_properties_electoral_area ON properties(electoral_area_id);

-- Businesses / Business Operating Permits (BOP)
CREATE TABLE businesses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_number VARCHAR(30) NOT NULL UNIQUE,
    business_name VARCHAR(200) NOT NULL,
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    category_id INTEGER NOT NULL REFERENCES business_categories(id),
    business_activity TEXT NOT NULL, -- What they sell/do
    business_contact VARCHAR(20),
    business_type_main VARCHAR(50),
    business_type_sub VARCHAR(100),
    business_category_class VARCHAR(20), -- Category A, B, C
    business_email VARCHAR(100),
    description TEXT,
    account_number VARCHAR(50),
    division_number VARCHAR(50),
    block_number VARCHAR(50),
    property_id UUID REFERENCES properties(id) ON DELETE SET NULL,
    street_name VARCHAR(200),
    gps_address VARCHAR(50),
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    town VARCHAR(100),
    physical_location TEXT,
    landmark TEXT,
    electoral_area_id INTEGER REFERENCES electoral_areas(id),
    local_area_id INTEGER REFERENCES local_areas(id),
    year_registered INTEGER NOT NULL,
    status VARCHAR(20) DEFAULT 'ACTIVE', -- ACTIVE, INACTIVE, CLOSED
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_businesses_number ON businesses(business_number);
CREATE INDEX idx_businesses_customer ON businesses(customer_id);
CREATE INDEX idx_businesses_category ON businesses(category_id);
CREATE INDEX idx_businesses_property ON businesses(property_id);
CREATE INDEX idx_businesses_electoral_area ON businesses(electoral_area_id);

-- Bills / Invoices
CREATE TABLE bills (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    bill_number VARCHAR(30) NOT NULL UNIQUE,
    bill_type VARCHAR(20) NOT NULL, -- PROPERTY_RATE, BOP
    customer_id UUID NOT NULL REFERENCES customers(id),
    property_id UUID REFERENCES properties(id),
    business_id UUID REFERENCES businesses(id),
    bill_period_year INTEGER NOT NULL,
    bill_period_description VARCHAR(100), -- e.g., "2025 Annual Property Rate"
    
    -- Charges breakdown
    current_rate DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    arrears DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    rebate DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    total_amount DECIMAL(10, 2) NOT NULL,
    amount_paid DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    amount_due DECIMAL(10, 2) NOT NULL,
    
    issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
    due_date DATE,
    payment_status VARCHAR(20) DEFAULT 'UNPAID', -- UNPAID, PARTIAL, PAID, OVERDUE
    
    -- Bill details (for printing)
    bill_details JSONB, -- Store itemized charges
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT chk_bill_target CHECK (
        (bill_type = 'PROPERTY_RATE' AND property_id IS NOT NULL) OR
        (bill_type = 'BOP' AND business_id IS NOT NULL)
    )
);

CREATE INDEX idx_bills_number ON bills(bill_number);
CREATE INDEX idx_bills_customer ON bills(customer_id);
CREATE INDEX idx_bills_property ON bills(property_id);
CREATE INDEX idx_bills_business ON bills(business_id);
CREATE INDEX idx_bills_status ON bills(payment_status);
CREATE INDEX idx_bills_period ON bills(bill_period_year);

-- Payments
CREATE TABLE payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    receipt_number VARCHAR(30) NOT NULL UNIQUE,
    gcr_number VARCHAR(50) NOT NULL,
    bill_id UUID NOT NULL REFERENCES bills(id),
    customer_id UUID NOT NULL REFERENCES customers(id),
    amount DECIMAL(10, 2) NOT NULL,
    payment_method VARCHAR(50), -- CASH, MOBILE_MONEY, CHEQUE, BANK_TRANSFER
    payment_reference VARCHAR(100),
    payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_payments_receipt ON payments(receipt_number);
CREATE INDEX idx_payments_bill ON payments(bill_id);
CREATE INDEX idx_payments_customer ON payments(customer_id);
CREATE INDEX idx_payments_date ON payments(payment_date);

-- =====================================================
-- AUTO-NUMBERING SEQUENCES
-- =====================================================

-- System Sequences Table (for tracking auto-numbers by year)
CREATE TABLE system_sequences (
    id SERIAL PRIMARY KEY,
    sequence_type VARCHAR(20) NOT NULL, -- PROPERTY, BUSINESS, BILL, RECEIPT
    year INTEGER NOT NULL,
    last_number INTEGER NOT NULL DEFAULT 0,
    prefix VARCHAR(10) NOT NULL, -- GN-PR, GN-BOP, etc.
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(sequence_type, year)
);

-- Initialize sequences for 2026
INSERT INTO system_sequences (sequence_type, year, last_number, prefix) VALUES
('PROPERTY', 2026, 0, 'GN-PR'),
('BUSINESS', 2026, 0, 'GN-BOP'),
('BILL', 2026, 0, 'GN-BILL'),
('RECEIPT', 2026, 0, 'GN-RCT');

-- =====================================================
-- FUNCTIONS & TRIGGERS
-- =====================================================

-- Function to generate next auto number
CREATE OR REPLACE FUNCTION generate_auto_number(
    p_sequence_type VARCHAR,
    p_year INTEGER DEFAULT EXTRACT(YEAR FROM CURRENT_DATE)
)
RETURNS VARCHAR AS $$
DECLARE
    v_prefix VARCHAR(10);
    v_next_number INTEGER;
    v_auto_number VARCHAR(30);
BEGIN
    -- Lock the row for update to prevent race conditions
    SELECT prefix, last_number + 1
    INTO v_prefix, v_next_number
    FROM system_sequences
    WHERE sequence_type = p_sequence_type AND year = p_year
    FOR UPDATE;
    
    -- If no sequence exists for this year, create it
    IF NOT FOUND THEN
        INSERT INTO system_sequences (sequence_type, year, last_number, prefix)
        VALUES (
            p_sequence_type,
            p_year,
            1,
            CASE p_sequence_type
                WHEN 'PROPERTY' THEN 'GN-PR'
                WHEN 'BUSINESS' THEN 'GN-BOP'
                WHEN 'BILL' THEN 'GN-BILL'
                WHEN 'RECEIPT' THEN 'GN-RCT'
            END
        )
        RETURNING prefix, last_number INTO v_prefix, v_next_number;
    ELSE
        -- Update the sequence
        UPDATE system_sequences
        SET last_number = v_next_number,
            updated_at = CURRENT_TIMESTAMP
        WHERE sequence_type = p_sequence_type AND year = p_year;
    END IF;
    
    -- Format: GN-PR-2026-000123
    v_auto_number := v_prefix || '-' || p_year || '-' || LPAD(v_next_number::TEXT, 6, '0');
    
    RETURN v_auto_number;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-generate property number
CREATE OR REPLACE FUNCTION trg_generate_property_number()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.property_number IS NULL OR NEW.property_number = '' THEN
        NEW.property_number := generate_auto_number('PROPERTY', NEW.year_registered);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER before_insert_property
BEFORE INSERT ON properties
FOR EACH ROW
EXECUTE FUNCTION trg_generate_property_number();

-- Trigger to auto-generate business number
CREATE OR REPLACE FUNCTION trg_generate_business_number()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.business_number IS NULL OR NEW.business_number = '' THEN
        NEW.business_number := generate_auto_number('BUSINESS', NEW.year_registered);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER before_insert_business
BEFORE INSERT ON businesses
FOR EACH ROW
EXECUTE FUNCTION trg_generate_business_number();

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION trg_update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_customers_timestamp
BEFORE UPDATE ON customers
FOR EACH ROW
EXECUTE FUNCTION trg_update_timestamp();

CREATE TRIGGER update_properties_timestamp
BEFORE UPDATE ON properties
FOR EACH ROW
EXECUTE FUNCTION trg_update_timestamp();

CREATE TRIGGER update_businesses_timestamp
BEFORE UPDATE ON businesses
FOR EACH ROW
EXECUTE FUNCTION trg_update_timestamp();

CREATE TRIGGER update_bills_timestamp
BEFORE UPDATE ON bills
FOR EACH ROW
EXECUTE FUNCTION trg_update_timestamp();

-- =====================================================
-- FEE CONFIGURATION TABLES
-- =====================================================

-- Fee Schedules - versioned fee schedules by year
CREATE TABLE fee_schedules (
    id SERIAL PRIMARY KEY,
    year INTEGER NOT NULL,
    name VARCHAR(200) NOT NULL,
    effective_date DATE NOT NULL,
    status VARCHAR(20) DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'ACTIVE', 'ARCHIVED')),
    notes TEXT,
    created_by UUID REFERENCES system_users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_fee_schedules_year ON fee_schedules(year);
CREATE INDEX idx_fee_schedules_status ON fee_schedules(status);

-- Property Rate Zones - rating zones linked to a fee schedule
CREATE TABLE property_rate_zones (
    id SERIAL PRIMARY KEY,
    fee_schedule_id INTEGER NOT NULL REFERENCES fee_schedules(id) ON DELETE CASCADE,
    zone_name VARCHAR(100) NOT NULL,
    zone_type VARCHAR(50) NOT NULL CHECK (zone_type IN ('RESIDENTIAL', 'COMMERCIAL', 'INDUSTRIAL', 'MIXED_USE')),
    zone_class INTEGER DEFAULT 1,
    rate_impost_min DECIMAL(10,6) NOT NULL,
    rate_impost_max DECIMAL(10,6),
    minimum_rate_min DECIMAL(10,2) NOT NULL,
    minimum_rate_max DECIMAL(10,2),
    affected_areas TEXT,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_property_rate_zones_schedule ON property_rate_zones(fee_schedule_id);
CREATE INDEX idx_property_rate_zones_type ON property_rate_zones(zone_type);

-- Business Fee Items - hierarchical business license items
CREATE TABLE business_fee_items (
    id SERIAL PRIMARY KEY,
    fee_schedule_id INTEGER NOT NULL REFERENCES fee_schedules(id) ON DELETE CASCADE,
    main_item_number INTEGER NOT NULL,
    sub_item_code VARCHAR(20),
    description VARCHAR(500) NOT NULL,
    parent_id INTEGER REFERENCES business_fee_items(id) ON DELETE CASCADE,
    frequency VARCHAR(50),
    cat_a_fee DECIMAL(10,2),
    cat_b_fee DECIMAL(10,2),
    cat_c_fee DECIMAL(10,2),
    cat_d_fee DECIMAL(10,2),
    cat_e_fee DECIMAL(10,2),
    cat_f_fee DECIMAL(10,2),
    is_group_header BOOLEAN DEFAULT FALSE,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_business_fee_items_schedule ON business_fee_items(fee_schedule_id);
CREATE INDEX idx_business_fee_items_parent ON business_fee_items(parent_id);
CREATE INDEX idx_business_fee_items_main ON business_fee_items(main_item_number);

-- Triggers
CREATE TRIGGER update_fee_schedules_timestamp
BEFORE UPDATE ON fee_schedules
FOR EACH ROW EXECUTE FUNCTION trg_update_timestamp();

CREATE TRIGGER update_property_rate_zones_timestamp
BEFORE UPDATE ON property_rate_zones
FOR EACH ROW EXECUTE FUNCTION trg_update_timestamp();

CREATE TRIGGER update_business_fee_items_timestamp
BEFORE UPDATE ON business_fee_items
FOR EACH ROW EXECUTE FUNCTION trg_update_timestamp();

-- =====================================================
-- VIEWS FOR REPORTING
-- =====================================================

-- View: Customer Summary with Property and Business Counts
CREATE VIEW vw_customer_summary AS
SELECT 
    c.id,
    c.full_name,
    c.phone_number,
    c.gps_address,
    ea.name as electoral_area,
    la.name as local_area,
    COUNT(DISTINCT p.id) as property_count,
    COUNT(DISTINCT b.id) as business_count,
    COALESCE(SUM(CASE WHEN bill.payment_status = 'UNPAID' THEN bill.amount_due ELSE 0 END), 0) as total_outstanding
FROM customers c
LEFT JOIN electoral_areas ea ON c.electoral_area_id = ea.id
LEFT JOIN local_areas la ON c.local_area_id = la.id
LEFT JOIN properties p ON c.id = p.customer_id
LEFT JOIN businesses b ON c.id = b.customer_id
LEFT JOIN bills bill ON c.id = bill.customer_id
GROUP BY c.id, c.full_name, c.phone_number, c.gps_address, ea.name, la.name;

-- View: Revenue Summary
CREATE VIEW vw_revenue_summary AS
SELECT 
    DATE_TRUNC('month', b.issue_date) as month,
    b.bill_type,
    COUNT(*) as bill_count,
    SUM(b.total_amount) as total_billed,
    SUM(b.amount_paid) as total_collected,
    SUM(b.amount_due) as total_outstanding
FROM bills b
GROUP BY DATE_TRUNC('month', b.issue_date), b.bill_type;

-- =====================================================
-- SAMPLE DATA (Optional - for testing)
-- =====================================================

-- GA North Municipal Electoral Areas
INSERT INTO electoral_areas (name, code) VALUES
('OFANKOR NORTH', 'OFN'),
('OFANKOR SOUTH', 'OFS'),
('AFIAMAN', 'AFI'),
('ABEASE', 'ABE'),
('AYAWASO', 'AYA'),
('AMANFROM', 'AMF'),
('AMAMORLEY', 'AML'),
('FISE', 'FIS'),
('ASOFAN', 'ASO'),
('OMANJOR', 'OMA'),
('POKUASE', 'POK'),
('TANTRA', 'TAN'),
('TROBU', 'TRO'),
('ABENSU', 'ABN');

COMMENT ON DATABASE postgres IS 'Municipal Revenue Management System - Production Database';
