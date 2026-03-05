-- TaxPal MySQL Database Schema
-- Run this in phpMyAdmin on your cPanel
-- Database name: taxpal_db

CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(36) PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS profiles (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL UNIQUE,
    full_name VARCHAR(255) DEFAULT NULL,
    avatar_url TEXT DEFAULT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_user_id (user_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS user_roles (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL,
    role ENUM('admin', 'moderator', 'user') NOT NULL DEFAULT 'user',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_user_id (user_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS feature_usage (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL,
    feature_type VARCHAR(50) NOT NULL,
    usage_count INT NOT NULL DEFAULT 0,
    month_year VARCHAR(7) NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_user_feature_month (user_id, feature_type, month_year),
    INDEX idx_user_id (user_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS subscriptions (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL,
    plan_type VARCHAR(50) NOT NULL DEFAULT 'quarterly',
    status VARCHAR(20) NOT NULL DEFAULT 'inactive',
    amount DECIMAL(10,2) NOT NULL DEFAULT 0,
    currency VARCHAR(3) NOT NULL DEFAULT 'NGN',
    flutterwave_tx_ref VARCHAR(255) DEFAULT NULL,
    flutterwave_tx_id VARCHAR(255) DEFAULT NULL,
    starts_at DATETIME DEFAULT NULL,
    expires_at DATETIME DEFAULT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_user_id (user_id),
    INDEX idx_status (status),
    INDEX idx_tx_ref (flutterwave_tx_ref),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS invoices (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL,
    invoice_number VARCHAR(50) NOT NULL,
    items JSON NOT NULL,
    subtotal DECIMAL(10,2) NOT NULL DEFAULT 0,
    vat_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
    total DECIMAL(10,2) NOT NULL DEFAULT 0,
    company_name VARCHAR(255) DEFAULT NULL,
    company_address TEXT DEFAULT NULL,
    company_email VARCHAR(255) DEFAULT NULL,
    company_phone VARCHAR(50) DEFAULT NULL,
    client_name VARCHAR(255) DEFAULT NULL,
    client_address TEXT DEFAULT NULL,
    client_email VARCHAR(255) DEFAULT NULL,
    bank_name VARCHAR(255) DEFAULT NULL,
    account_name VARCHAR(255) DEFAULT NULL,
    account_number VARCHAR(50) DEFAULT NULL,
    sort_code VARCHAR(50) DEFAULT NULL,
    notes TEXT DEFAULT NULL,
    logo_url TEXT DEFAULT NULL,
    pdf_data LONGTEXT DEFAULT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_user_id (user_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS invoice_templates (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL,
    template_name VARCHAR(255) NOT NULL,
    client_name VARCHAR(255) DEFAULT NULL,
    client_address TEXT DEFAULT NULL,
    client_email VARCHAR(255) DEFAULT NULL,
    business_name VARCHAR(255) DEFAULT NULL,
    business_address TEXT DEFAULT NULL,
    business_phone VARCHAR(50) DEFAULT NULL,
    business_email VARCHAR(255) DEFAULT NULL,
    bank_name VARCHAR(255) DEFAULT NULL,
    account_name VARCHAR(255) DEFAULT NULL,
    account_number VARCHAR(50) DEFAULT NULL,
    sort_code VARCHAR(50) DEFAULT NULL,
    notes TEXT DEFAULT NULL,
    table_color VARCHAR(20) DEFAULT '#228B22',
    signature_text TEXT DEFAULT NULL,
    signature_image LONGTEXT DEFAULT NULL,
    logo_url TEXT DEFAULT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_user_id (user_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS saved_clients (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL,
    client_name VARCHAR(255) NOT NULL,
    client_address TEXT DEFAULT NULL,
    client_email VARCHAR(255) DEFAULT NULL,
    client_phone VARCHAR(50) DEFAULT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_user_id (user_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS default_business_details (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL UNIQUE,
    business_name VARCHAR(255) DEFAULT NULL,
    business_address TEXT DEFAULT NULL,
    business_phone VARCHAR(50) DEFAULT NULL,
    business_email VARCHAR(255) DEFAULT NULL,
    bank_name VARCHAR(255) DEFAULT NULL,
    account_name VARCHAR(255) DEFAULT NULL,
    account_number VARCHAR(50) DEFAULT NULL,
    sort_code VARCHAR(50) DEFAULT NULL,
    logo_url TEXT DEFAULT NULL,
    table_color VARCHAR(20) DEFAULT '#228B22',
    signature_text TEXT DEFAULT NULL,
    signature_image LONGTEXT DEFAULT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_user_id (user_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS user_push_tokens (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL,
    push_token TEXT NOT NULL,
    platform VARCHAR(20) DEFAULT 'web',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_user_token (user_id, push_token(191)),
    INDEX idx_user_id (user_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS chat_sessions (
    id VARCHAR(36) PRIMARY KEY,
    session_id VARCHAR(255) NOT NULL,
    user_id VARCHAR(36) DEFAULT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'open',
    language VARCHAR(10) NOT NULL DEFAULT 'en',
    consultant_typing BOOLEAN NOT NULL DEFAULT FALSE,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_session_id (session_id),
    INDEX idx_user_id (user_id),
    INDEX idx_status (status),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS chat_messages (
    id VARCHAR(36) PRIMARY KEY,
    session_id VARCHAR(255) NOT NULL,
    sender_type ENUM('user','consultant','ai','system') NOT NULL,
    sender_id VARCHAR(36) DEFAULT NULL,
    content TEXT NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_session_id (session_id),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS tax_rates (
    id VARCHAR(36) PRIMARY KEY,
    tax_type VARCHAR(50) NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT DEFAULT NULL,
    rate DECIMAL(10,4) NOT NULL,
    min_amount DECIMAL(15,2) DEFAULT NULL,
    max_amount DECIMAL(15,2) DEFAULT NULL,
    effective_date DATE NOT NULL DEFAULT (CURRENT_DATE),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_tax_type (tax_type),
    INDEX idx_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS tax_content (
    id VARCHAR(36) PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    title_yo VARCHAR(255) DEFAULT NULL,
    title_ha VARCHAR(255) DEFAULT NULL,
    title_pcm VARCHAR(255) DEFAULT NULL,
    title_ig VARCHAR(255) DEFAULT NULL,
    content TEXT NOT NULL,
    content_yo TEXT DEFAULT NULL,
    content_ha TEXT DEFAULT NULL,
    content_pcm TEXT DEFAULT NULL,
    content_ig TEXT DEFAULT NULL,
    category VARCHAR(100) NOT NULL,
    icon VARCHAR(50) DEFAULT 'FileText',
    display_order INT DEFAULT 0,
    is_published BOOLEAN DEFAULT TRUE,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_category (category),
    INDEX idx_published (is_published)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS api_configurations (
    id VARCHAR(36) PRIMARY KEY,
    config_type VARCHAR(100) NOT NULL,
    config_data JSON NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_config_type (config_type),
    INDEX idx_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS smtp_settings (
    id VARCHAR(36) PRIMARY KEY,
    host VARCHAR(255) DEFAULT NULL,
    port INT DEFAULT 587,
    username VARCHAR(255) DEFAULT NULL,
    password VARCHAR(255) DEFAULT NULL,
    encryption VARCHAR(20) DEFAULT 'tls',
    from_email VARCHAR(255) DEFAULT NULL,
    from_name VARCHAR(255) DEFAULT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Insert default PAYE tax rates
INSERT INTO tax_rates (id, tax_type, name, rate, min_amount, max_amount) VALUES
(UUID(), 'paye', 'First ₦300,000', 7.0, 0, 300000),
(UUID(), 'paye', 'Next ₦300,000', 11.0, 300000, 600000),
(UUID(), 'paye', 'Next ₦500,000', 15.0, 600000, 1100000),
(UUID(), 'paye', 'Next ₦500,000', 19.0, 1100000, 1600000),
(UUID(), 'paye', 'Next ₦1,600,000', 21.0, 1600000, 3200000),
(UUID(), 'paye', 'Above ₦3,200,000', 24.0, 3200000, NULL);
