-- 02_real_saas_ownership_schema.sql
-- Real Multi-Company SaaS Ownership System Architecture

-- 1. COMPANIES TABLE
CREATE TABLE IF NOT EXISTS companies (
    id INT AUTO_INCREMENT PRIMARY KEY,
    company_name VARCHAR(255) NOT NULL,
    company_code VARCHAR(50) UNIQUE NOT NULL,
    industry_type VARCHAR(100),
    company_size VARCHAR(50),
    company_email VARCHAR(255),
    company_phone VARCHAR(50),
    company_address TEXT,
    country VARCHAR(100),
    city VARCHAR(100),
    workspace_status VARCHAR(50) DEFAULT 'Active',
    billing_status VARCHAR(50) DEFAULT 'Good Standing',
    account_status VARCHAR(50) DEFAULT 'Active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 2. LICENSE OWNERS TABLE
CREATE TABLE IF NOT EXISTS license_owners (
    id INT AUTO_INCREMENT PRIMARY KEY,
    company_id INT NOT NULL,
    full_name VARCHAR(150) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    phone_number VARCHAR(50),
    designation VARCHAR(100) DEFAULT 'SaaS Owner',
    profile_image TEXT,
    account_status VARCHAR(50) DEFAULT 'Active',
    last_login TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
);

-- 3. COMPANY SUBSCRIPTIONS TABLE
CREATE TABLE IF NOT EXISTS company_subscriptions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    company_id INT NOT NULL,
    plan_name VARCHAR(100) NOT NULL,
    subscription_type VARCHAR(50) DEFAULT 'B2B',
    billing_cycle VARCHAR(50) DEFAULT 'Monthly',
    activation_date DATE NOT NULL,
    expiry_date DATE NOT NULL,
    seat_limit INT DEFAULT 10,
    seats_used INT DEFAULT 0,
    payment_status VARCHAR(50) DEFAULT 'Paid',
    subscription_status VARCHAR(50) DEFAULT 'Active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
);

-- 4. WORKSPACE STATISTICS TABLE
CREATE TABLE IF NOT EXISTS workspace_statistics (
    id INT AUTO_INCREMENT PRIMARY KEY,
    company_id INT NOT NULL UNIQUE,
    total_active_employees INT DEFAULT 0,
    current_active_projects INT DEFAULT 0,
    total_users INT DEFAULT 0,
    active_users INT DEFAULT 0,
    inactive_users INT DEFAULT 0,
    workspace_activity INT DEFAULT 0,
    storage_usage VARCHAR(50) DEFAULT '0GB',
    last_activity TIMESTAMP NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
);
