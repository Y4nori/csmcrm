-- ============================================
-- CSM Inventory Management System
-- Database Setup Script
-- ============================================

-- Drop existing tables if they exist (for clean setup)
DROP TABLE IF EXISTS inventory_logs;
DROP TABLE IF EXISTS inventory_stocks;
DROP TABLE IF EXISTS inventory_products;
DROP TABLE IF EXISTS inventory_categories;
DROP TABLE IF EXISTS inventory_branches;

-- ============================================
-- 1. Branches (営業所)
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

-- Insert 6 branches
INSERT INTO inventory_branches (name, code) VALUES
('大阪営業', 'OSAKA'),
('阪和営業', 'HANWA'),
('大阪北営業所', 'OSAKA_N'),
('京滋営業', 'KEIJI'),
('福知山営業', 'FUKUCHI'),
('神戸営業所', 'KOBE');

-- ============================================
-- 2. Categories (カテゴリ)
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

-- Insert 8 categories
INSERT INTO inventory_categories (name, sort_order) VALUES
('粘着トラップ', 1),
('捕虫器', 2),
('フェロモン', 3),
('防虫機器', 4),
('ネズミ', 5),
('スプレー', 6),
('蛍光灯', 7),
('防護服', 8);

-- ============================================
-- 3. Products (製品)
-- ============================================
CREATE TABLE inventory_products (
    id INT AUTO_INCREMENT PRIMARY KEY,
    category_id INT NOT NULL,
    name VARCHAR(200) NOT NULL,
    code VARCHAR(50),
    unit VARCHAR(20) DEFAULT '個',
    alert_threshold INT DEFAULT 10,
    reorder_quantity INT DEFAULT 50,
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (category_id) REFERENCES inventory_categories(id) ON DELETE CASCADE,
    UNIQUE KEY uk_product_name (name),
    INDEX idx_category (category_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Insert 33 products across 8 categories

-- Category 1: 粘着トラップ (13 products)
INSERT INTO inventory_products (category_id, name, unit) VALUES
(1, 'Pホイコ', '枚'),
(1, 'CLホイコ', '枚'),
(1, '虫1シート', '枚'),
(1, 'ティオニ20', '枚'),
(1, 'プロボード', '枚'),
(1, 'ムシペチャ', '枚'),
(1, 'Nホイコ', '枚'),
(1, 'ペスクル', '枚'),
(1, 'コバエシート', '枚'),
(1, '虫っとり光', '枚'),
(1, 'LUICS', '枚'),
(1, 'ピオニS6', '枚'),
(1, 'パナプレート', '枚');

-- Category 2: 捕虫器 (2 products)
INSERT INTO inventory_products (category_id, name, unit) VALUES
(2, 'ムシポン', '個'),
(2, 'ドガード', '個');

-- Category 3: フェロモン (3 products)
INSERT INTO inventory_products (category_id, name, unit) VALUES
(3, 'アースコレクトモニター メイガ', '個'),
(3, 'アースコレクトモニター シバムシ', '個'),
(3, '誘引剤', '個');

-- Category 4: 防虫機器 (4 products)
INSERT INTO inventory_products (category_id, name, unit) VALUES
(4, 'ハニカム防虫ファンAC', '個'),
(4, 'ハニカム防虫ファンDB', '個'),
(4, 'AIR640', '個'),
(4, 'AIR640ミニ', '個');

-- Category 5: ネズミ (3 products)
INSERT INTO inventory_products (category_id, name, unit) VALUES
(5, 'ネズコロン', 'パック'),
(5, 'チュウモアブロック', '袋'),
(5, 'スーパーデスモア', '袋');

-- Category 6: スプレー (2 products)
INSERT INTO inventory_products (category_id, name, unit) VALUES
(6, 'ゴキジェット', '本'),
(6, 'コバエジェット', '本');

-- Category 7: 蛍光灯 (2 products)
INSERT INTO inventory_products (category_id, name, unit) VALUES
(7, 'エバーライツWAN20W', '本'),
(7, 'エバーライツ30W', '本');

-- Category 8: 防護服 (4 products)
INSERT INTO inventory_products (category_id, name, unit) VALUES
(8, 'タイベック S', '着'),
(8, 'タイベック M', '着'),
(8, 'タイベック L', '着'),
(8, 'タイベック LL', '着');

-- ============================================
-- 4. Stocks (在庫)
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

-- Initialize stock with quantity=1 for all branch-product combinations
INSERT INTO inventory_stocks (branch_id, product_id, quantity)
SELECT b.id, p.id, 1
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

-- Stock summary by branch
CREATE OR REPLACE VIEW v_stock_by_branch AS
SELECT
    b.id as branch_id,
    b.name as branch_name,
    c.name as category_name,
    p.id as product_id,
    p.name as product_name,
    p.unit,
    COALESCE(s.quantity, 0) as quantity,
    p.alert_threshold,
    CASE WHEN COALESCE(s.quantity, 0) <= p.alert_threshold THEN 1 ELSE 0 END as is_low_stock
FROM inventory_branches b
CROSS JOIN inventory_products p
JOIN inventory_categories c ON p.category_id = c.id
LEFT JOIN inventory_stocks s ON s.branch_id = b.id AND s.product_id = p.id
WHERE b.is_active = 1 AND p.is_active = 1
ORDER BY b.id, c.sort_order, p.id;

-- Total stock across all branches
CREATE OR REPLACE VIEW v_stock_total AS
SELECT
    p.id as product_id,
    c.name as category_name,
    p.name as product_name,
    p.unit,
    SUM(COALESCE(s.quantity, 0)) as total_quantity,
    p.alert_threshold
FROM inventory_products p
JOIN inventory_categories c ON p.category_id = c.id
LEFT JOIN inventory_stocks s ON s.product_id = p.id
WHERE p.is_active = 1
GROUP BY p.id, c.name, p.name, p.unit, p.alert_threshold
ORDER BY c.sort_order, p.id;

-- ============================================
-- Completion message
-- ============================================
SELECT 'Inventory system setup completed successfully!' as message;
SELECT CONCAT('Branches: ', COUNT(*)) as count FROM inventory_branches;
SELECT CONCAT('Categories: ', COUNT(*)) as count FROM inventory_categories;
SELECT CONCAT('Products: ', COUNT(*)) as count FROM inventory_products;
SELECT CONCAT('Stock records: ', COUNT(*)) as count FROM inventory_stocks;
