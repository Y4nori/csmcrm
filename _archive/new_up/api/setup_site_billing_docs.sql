-- 現場別請求月テーブル
CREATE TABLE IF NOT EXISTS site_billing_months (
    id INT AUTO_INCREMENT PRIMARY KEY,
    site_id INT NOT NULL,
    billing_month INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (site_id) REFERENCES sites(id) ON DELETE CASCADE,
    UNIQUE KEY unique_site_month (site_id, billing_month)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 現場書類テーブル
CREATE TABLE IF NOT EXISTS site_documents (
    id INT AUTO_INCREMENT PRIMARY KEY,
    site_id INT NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    url VARCHAR(500),
    file_type VARCHAR(100),
    doc_type VARCHAR(50) DEFAULT 'その他',
    doc_date DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (site_id) REFERENCES sites(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- インデックス追加
CREATE INDEX idx_site_documents_site_id ON site_documents(site_id);
CREATE INDEX idx_site_documents_doc_type ON site_documents(doc_type);
