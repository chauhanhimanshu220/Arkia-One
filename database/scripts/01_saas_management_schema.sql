-- 01_saas_management_schema.sql
-- Super Admin Management Portal Database Setup

-- Create Super Admins table
CREATE TABLE IF NOT EXISTS super_admins (
    id INT AUTO_INCREMENT PRIMARY KEY,
    full_name VARCHAR(100) NOT NULL,
    email VARCHAR(150) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) DEFAULT 'Owner',
    profile_image TEXT,
    account_status VARCHAR(20) DEFAULT 'Active',
    access_level VARCHAR(50) DEFAULT 'Full Platform Access',
    last_login TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Seed default Super Admin account
INSERT INTO super_admins (full_name, email, password_hash, role, access_level)
VALUES (
    'Sunil Kumar', 
    'sunil.kumar@arkiatechnology.com', 
    '$2b$10$fNveF2e4LG0QXVfGRXQ7I.msO8fZgUY43Kgx5sN4jYza.bvEaUX1u', 
    'Owner', 
    'Full Platform Access'
)
ON DUPLICATE KEY UPDATE email = email;

-- SaaS Oversight: companies table (note: avoiding conflict with main 'companies' if it exists, let's name it saas_companies just in case, or we use 'saas_registered_companies')
-- Let's stick to user request: 'companies' but it might conflict. Let's create `saas_companies` to be safe, but alias it in the query.
-- The user said: "Create scalable tables for: companies, company_subscriptions". Let's name them with a prefix 'saas_' to guarantee no conflict with the workspace 'companies'.

CREATE TABLE IF NOT EXISTS saas_companies (
    id INT AUTO_INCREMENT PRIMARY KEY,
    company_name VARCHAR(150) NOT NULL,
    tenant_id VARCHAR(100) UNIQUE,
    contact_email VARCHAR(150),
    contact_phone VARCHAR(50),
    workspace_status VARCHAR(50) DEFAULT 'Active',
    account_status VARCHAR(50) DEFAULT 'Active',
    billing_status VARCHAR(50) DEFAULT 'Good Standing',
    total_active_employees INT DEFAULT 0,
    current_active_projects INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS saas_company_subscriptions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    company_id INT NOT NULL,
    plan_name VARCHAR(100) NOT NULL,
    status VARCHAR(50) DEFAULT 'Active',
    start_date DATE NOT NULL,
    expiry_date DATE NOT NULL,
    total_seats INT DEFAULT 0,
    used_seats INT DEFAULT 0,
    amount_paid DECIMAL(10,2) DEFAULT 0.00,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (company_id) REFERENCES saas_companies(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS saas_billing_records (
    id INT AUTO_INCREMENT PRIMARY KEY,
    company_id INT NOT NULL,
    invoice_id VARCHAR(100) NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    status VARCHAR(50) DEFAULT 'Paid',
    billing_date DATE NOT NULL,
    due_date DATE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (company_id) REFERENCES saas_companies(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS saas_platform_activity_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    admin_id INT,
    action VARCHAR(255) NOT NULL,
    target_entity VARCHAR(100),
    entity_id INT,
    ip_address VARCHAR(45),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (admin_id) REFERENCES super_admins(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS saas_workspace_statistics (
    id INT AUTO_INCREMENT PRIMARY KEY,
    date DATE NOT NULL UNIQUE,
    total_companies INT DEFAULT 0,
    active_subscriptions INT DEFAULT 0,
    expired_subscriptions INT DEFAULT 0,
    total_platform_users INT DEFAULT 0,
    total_active_employees INT DEFAULT 0,
    current_active_projects INT DEFAULT 0,
    monthly_revenue DECIMAL(15,2) DEFAULT 0.00,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS saas_system_health_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    service_name VARCHAR(100) NOT NULL,
    status VARCHAR(50) NOT NULL,
    cpu_usage DECIMAL(5,2),
    memory_usage DECIMAL(5,2),
    uptime_seconds INT,
    recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
