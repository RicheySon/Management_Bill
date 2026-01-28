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
('SALON/BARBER', 'Personal grooming services', 350.00),
('GENERAL MERCHANDISE', 'Various retail goods', 400.00);

-- =====================================================
-- CORE TABLES
-- =====================================================

-- Customers / Citizens
CREATE TABLE customers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    full_name VARCHAR(200) NOT NULL,
    phone_number VARCHAR(20) NOT NULL,
    email VARCHAR(100),
    gps_address VARCHAR(50),
    physical_location TEXT,
    landmark TEXT,
    electoral_area_id INTEGER REFERENCES electoral_areas(id),
    local_area_id INTEGER REFERENCES local_areas(id),
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
    street_name VARCHAR(200),
    gps_address VARCHAR(50),
    physical_location TEXT,
    landmark TEXT,
    electoral_area_id INTEGER REFERENCES electoral_areas(id),
    local_area_id INTEGER REFERENCES local_areas(id),
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
    property_id UUID REFERENCES properties(id) ON DELETE SET NULL,
    street_name VARCHAR(200),
    gps_address VARCHAR(50),
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

-- Sample Electoral Areas
INSERT INTO electoral_areas (name, code) VALUES
('TANTRAL HILL', 'TH'),
('ACCRA CENTRAL', 'AC'),
('HAATSO', 'HA'),
('MADINA', 'MD');

-- Sample Local Areas
INSERT INTO local_areas (name, electoral_area_id) VALUES
('GOIL Filling Station Area', 1),
('Nii Ayi Kushie Street', 1),
('Central Market', 2);

-- Sample Customer
INSERT INTO customers (full_name, phone_number, gps_address, physical_location, landmark, electoral_area_id)
VALUES ('INSPIRE EVENT & GIFTS', '0279685400', 'GG-845-8731', 'NII AYI KUSHIE ST', 'GOIL filling Station', 1);

COMMENT ON DATABASE postgres IS 'Municipal Revenue Management System - Production Database';
