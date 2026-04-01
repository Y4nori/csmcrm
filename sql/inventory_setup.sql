-- ============================================
-- CSM Inventory Management System
-- Database Setup Script (2026-04-01 simplified)
-- 4拠点のみ、カテゴリ・閾値なし、在庫全て0
-- ============================================

-- Drop existing tables if they exist (for clean setup)
DROP VIEW IF EXISTS v_stock_by_branch;
DROP VIEW IF EXISTS v_stock_total;
DROP TABLE IF EXISTS inventory_logs;
DROP TABLE IF EXISTS inventory_stocks;
DROP TABLE IF EXISTS inventory_products;
DROP TABLE IF EXISTS inventory_categories;
DROP TABLE IF EXISTS inventory_branches;

-- ============================================
-- 1. Branches (営業所) - 4拠点のみ
-- ============================================
CREATE TABLE inventory_branches (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    code VARCHAR(20),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_branch_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO inventory_branches (name, code) VALUES
('倉庫', 'WAREHOUSE'),
('大阪', 'OSAKA'),
('京滋', 'KEIJI'),
('神戸', 'KOBE');

-- ============================================
-- 2. Categories (カテゴリ) - 維持するが非表示
-- ============================================
CREATE TABLE inventory_categories (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    sort_order INT DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_category_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO inventory_categories (name, sort_order) VALUES
('資材', 1);

-- ============================================
-- 3. Products (製品)
-- ============================================
CREATE TABLE inventory_products (
    id INT AUTO_INCREMENT PRIMARY KEY,
    category_id INT NOT NULL DEFAULT 1,
    name VARCHAR(200) NOT NULL,
    code VARCHAR(50),
    unit VARCHAR(20) DEFAULT '個',
    alert_threshold INT DEFAULT 0,
    reorder_quantity INT DEFAULT 0,
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (category_id) REFERENCES inventory_categories(id) ON DELETE CASCADE,
    UNIQUE KEY uk_product_name (name),
    INDEX idx_category (category_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO inventory_products (category_id, name, unit, alert_threshold) VALUES
(1, '641エスコ103', '個', 0),
(1, '641シート', '枚', 0),
(1, '641ベスクル103', '個', 0),
(1, 'AIR640', '個', 0),
(1, 'AIR640ミニ', '個', 0),
(1, 'CLホイコ', '枚', 0),
(1, 'LUICS', '枚', 0),
(1, 'Nホイコ', '枚', 0),
(1, 'Pホイコ', '枚', 0),
(1, 'アースコレクトモニター シバムシ', '個', 0),
(1, 'アースコレクトモニター メイガ', '個', 0),
(1, 'アースボードカバー', '個', 0);

-- ============================================
-- 4. Stocks (在庫) - 全て0で初期化
-- ============================================
CREATE TABLE inventory_stocks (
    id INT AUTO_INCREMENT PRIMARY KEY,
    branch_id INT NOT NULL,
    product_id INT NOT NULL,
    quantity INT DEFAULT 0,
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (branch_id) REFERENCES inventory_branches(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES inventory_products(id) ON DELETE CASCADE,
    UNIQUE KEY uk_branch_product (branch_id, product_id),
    INDEX idx_branch (branch_id),
    INDEX idx_product (product_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Initialize stock with quantity=0 for all branch-product combinations
INSERT INTO inventory_stocks (branch_id, product_id, quantity)
SELECT b.id, p.id, 0
FROM inventory_branches b
CROSS JOIN inventory_products p;

-- ============================================
-- 5. Logs (入出庫履歴)
-- ============================================
CREATE TABLE inventory_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    branch_id INT NOT NULL,
    product_id INT NOT NULL,
    transaction_type ENUM('in', 'out', 'adjust', 'transfer_in', 'transfer_out') NOT NULL,
    quantity INT NOT NULL,
    quantity_before INT,
    quantity_after INT,
    related_branch_id INT,
    note TEXT,
    user_id INT,
    user_name VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (branch_id) REFERENCES inventory_branches(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES inventory_products(id) ON DELETE CASCADE,
    FOREIGN KEY (related_branch_id) REFERENCES inventory_branches(id) ON DELETE SET NULL,
    INDEX idx_branch (branch_id),
    INDEX idx_product (product_id),
    INDEX idx_created (created_at),
    INDEX idx_type (transaction_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================
-- Views for easy reporting
-- ============================================

CREATE OR REPLACE VIEW v_stock_by_branch AS
SELECT
    b.id as branch_id,
    b.name as branch_name,
    p.id as product_id,
    p.name as product_name,
    p.unit,
    COALESCE(s.quantity, 0) as quantity
FROM inventory_branches b
CROSS JOIN inventory_products p
LEFT JOIN inventory_stocks s ON s.branch_id = b.id AND s.product_id = p.id
WHERE b.is_active = 1 AND p.is_active = 1
ORDER BY b.id, p.name;

CREATE OR REPLACE VIEW v_stock_total AS
SELECT
    p.id as product_id,
    p.name as product_name,
    p.unit,
    SUM(COALESCE(s.quantity, 0)) as total_quantity
FROM inventory_products p
LEFT JOIN inventory_stocks s ON s.product_id = p.id
WHERE p.is_active = 1
GROUP BY p.id, p.name, p.unit
ORDER BY p.name;

-- ============================================
-- Completion message
-- ============================================
SELECT 'Inventory system setup completed successfully!' as message;
SELECT CONCAT('Branches: ', COUNT(*)) as count FROM inventory_branches;
SELECT CONCAT('Products: ', COUNT(*)) as count FROM inventory_products;
SELECT CONCAT('Stock records: ', COUNT(*)) as count FROM inventory_stocks;
