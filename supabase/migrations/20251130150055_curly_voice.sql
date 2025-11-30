-- Pembukuan Kasir Database Schema
-- Created: 2025
-- Description: Complete database schema for cashier bookkeeping system

CREATE DATABASE IF NOT EXISTS pembukuan_kasir;
USE pembukuan_kasir;

-- Table: users
-- Purpose: Store user accounts for kasir and owner
CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  role ENUM('kasir', 'owner') NOT NULL DEFAULT 'kasir',
  status ENUM('aktif', 'nonaktif') NOT NULL DEFAULT 'aktif',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Table: modal
-- Purpose: Store modal input from various applications
CREATE TABLE modal (
  id INT AUTO_INCREMENT PRIMARY KEY,
  modal_type ENUM('karangsari', 'fastpay', 'mmbc', 'payfazz', 'posfin', 'buku_agen', 'modal_kas') NOT NULL,
  nominal DECIMAL(15,2) NOT NULL DEFAULT 0,
  user_id INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY unique_modal_user (modal_type, user_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Table: transfer
-- Purpose: Store money transfer transactions
CREATE TABLE transfer (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tanggal DATE NOT NULL,
  bank_tujuan VARCHAR(50) NOT NULL,
  nomor_rekening VARCHAR(50) NOT NULL,
  nama_pemilik VARCHAR(100) NOT NULL,
  nominal DECIMAL(15,2) NOT NULL,
  biaya DECIMAL(15,2) NOT NULL DEFAULT 0,
  total DECIMAL(15,2) GENERATED ALWAYS AS (nominal + biaya) STORED,
  keterangan TEXT,
  status ENUM('pending', 'lunas') DEFAULT 'pending',
  user_id INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_tanggal (tanggal),
  INDEX idx_status (status),
  INDEX idx_user_id (user_id)
);

-- Table: transfer_favorit
-- Purpose: Store favorite transfer destinations
CREATE TABLE transfer_favorit (
  id INT AUTO_INCREMENT PRIMARY KEY,
  bank_tujuan VARCHAR(50) NOT NULL,
  nomor_rekening VARCHAR(50) NOT NULL,
  nama_pemilik VARCHAR(100) NOT NULL,
  user_id INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY unique_favorit (bank_tujuan, nomor_rekening, nama_pemilik, user_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Table: transfer_debit
-- Purpose: Store debit card transfer transactions
CREATE TABLE transfer_debit (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tanggal DATE NOT NULL,
  biaya DECIMAL(15,2) NOT NULL,
  keterangan TEXT NOT NULL,
  status ENUM('pending', 'lunas') DEFAULT 'pending',
  user_id INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_tanggal (tanggal),
  INDEX idx_status (status),
  INDEX idx_user_id (user_id)
);

-- Table: tarik_tunai
-- Purpose: Store cash withdrawal transactions
CREATE TABLE tarik_tunai (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tanggal DATE NOT NULL,
  bank VARCHAR(50) NOT NULL,
  nominal_tarik DECIMAL(15,2) NOT NULL,
  biaya_tarik DECIMAL(15,2) NOT NULL,
  keterangan TEXT,
  status ENUM('pending', 'lunas') DEFAULT 'pending',
  user_id INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_tanggal (tanggal),
  INDEX idx_status (status),
  INDEX idx_user_id (user_id)
);

-- Table: saldo
-- Purpose: Store current balance for each user
CREATE TABLE saldo (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  total_saldo DECIMAL(15,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY unique_user_saldo (user_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Table: logs
-- Purpose: Store system logs and audit trail
CREATE TABLE logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  action VARCHAR(100) NOT NULL,
  table_name VARCHAR(50) NOT NULL,
  record_id INT,
  old_values JSON,
  new_values JSON,
  ip_address VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user_id (user_id),
  INDEX idx_action (action),
  INDEX idx_table_name (table_name),
  INDEX idx_created_at (created_at)
);

-- Insert default users
INSERT INTO users (username, password, role, status, created_at) VALUES
('admin', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'owner', 'aktif', NOW()), -- password: password
('kasir', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'kasir', 'aktif', NOW()); -- password: password

-- Initialize saldo for default users
INSERT INTO saldo (user_id, total_saldo, created_at, updated_at) VALUES
(1, 0, NOW(), NOW()),
(2, 0, NOW(), NOW());

-- Insert sample modal data
INSERT INTO modal (modal_type, nominal, user_id, created_at, updated_at) VALUES
('karangsari', 1000000, 1, NOW(), NOW()),
('fastpay', 500000, 1, NOW(), NOW()),
('mmbc', 750000, 1, NOW(), NOW()),
('payfazz', 300000, 1, NOW(), NOW()),
('posfin', 400000, 1, NOW(), NOW()),
('buku_agen', 600000, 1, NOW(), NOW()),
('modal_kas', 2000000, 1, NOW(), NOW()),
('karangsari', 800000, 2, NOW(), NOW()),
('fastpay', 400000, 2, NOW(), NOW()),
('mmbc', 600000, 2, NOW(), NOW());

-- Insert sample transfer data
INSERT INTO transfer (tanggal, bank_tujuan, nomor_rekening, nama_pemilik, nominal, biaya, keterangan, status, user_id, created_at) VALUES
('2025-01-01', 'BCA', '1234567890', 'John Doe', 100000, 2500, 'Transfer untuk pembayaran', 'lunas', 1, NOW()),
('2025-01-01', 'BRI', '0987654321', 'Jane Smith', 150000, 3000, 'Transfer gaji karyawan', 'pending', 1, NOW()),
('2025-01-02', 'Mandiri', '1122334455', 'Bob Wilson', 200000, 2500, 'Pembayaran supplier', 'lunas', 2, NOW());

-- Insert sample transfer favorit
INSERT INTO transfer_favorit (bank_tujuan, nomor_rekening, nama_pemilik, user_id, created_at) VALUES
('BCA', '1234567890', 'John Doe', 1, NOW()),
('BRI', '0987654321', 'Jane Smith', 1, NOW()),
('Mandiri', '1122334455', 'Bob Wilson', 2, NOW());

-- Insert sample transfer debit data
INSERT INTO transfer_debit (tanggal, biaya, keterangan, status, user_id, created_at) VALUES
('2025-01-01', 5000, 'Transfer menggunakan kartu debit BCA', 'lunas', 1, NOW()),
('2025-01-02', 3000, 'Transfer debit untuk pembayaran online', 'pending', 2, NOW());

-- Insert sample tarik tunai data
INSERT INTO tarik_tunai (tanggal, bank, nominal_tarik, biaya_tarik, keterangan, status, user_id, created_at) VALUES
('2025-01-01', 'BCA', 500000, 5000, 'Tarik tunai untuk modal usaha', 'lunas', 1, NOW()),
('2025-01-02', 'BRI', 300000, 4000, 'Tarik tunai emergency', 'pending', 2, NOW()),
('2025-01-02', 'Mandiri', 200000, 3000, 'Tarik tunai untuk operasional', 'lunas', 1, NOW());

-- Insert sample logs
INSERT INTO logs (user_id, action, table_name, record_id, new_values, created_at) VALUES
(1, 'INSERT', 'transfer', 1, '{"nominal": 100000, "biaya": 2500}', NOW()),
(1, 'UPDATE', 'transfer', 1, '{"status": "lunas"}', NOW()),
(2, 'INSERT', 'tarik_tunai', 1, '{"nominal_tarik": 300000, "biaya_tarik": 4000}', NOW());

-- Update saldo based on sample data
UPDATE saldo SET total_saldo = (
  -- Modal total
  (SELECT COALESCE(SUM(nominal), 0) FROM modal WHERE user_id = saldo.user_id) +
  -- Transfer total (nominal + biaya)
  (SELECT COALESCE(SUM(nominal + biaya), 0) FROM transfer WHERE user_id = saldo.user_id) +
  -- Transfer debit total (only biaya)
  (SELECT COALESCE(SUM(biaya), 0) FROM transfer_debit WHERE user_id = saldo.user_id) +
  -- Tarik tunai net (biaya_tarik - nominal_tarik)
  (SELECT COALESCE(SUM(biaya_tarik - nominal_tarik), 0) FROM tarik_tunai WHERE user_id = saldo.user_id)
), updated_at = NOW();

-- Create triggers for automatic saldo updates
DELIMITER //

-- Trigger for modal changes
CREATE TRIGGER modal_after_insert_update 
AFTER INSERT ON modal
FOR EACH ROW
BEGIN
  INSERT INTO saldo (user_id, total_saldo, created_at, updated_at) 
  VALUES (NEW.user_id, 0, NOW(), NOW())
  ON DUPLICATE KEY UPDATE 
  total_saldo = (
    (SELECT COALESCE(SUM(nominal), 0) FROM modal WHERE user_id = NEW.user_id) +
    (SELECT COALESCE(SUM(nominal + biaya), 0) FROM transfer WHERE user_id = NEW.user_id) +
    (SELECT COALESCE(SUM(biaya), 0) FROM transfer_debit WHERE user_id = NEW.user_id) +
    (SELECT COALESCE(SUM(biaya_tarik - nominal_tarik), 0) FROM tarik_tunai WHERE user_id = NEW.user_id)
  ),
  updated_at = NOW();
END//

-- Trigger for transfer changes
CREATE TRIGGER transfer_after_insert 
AFTER INSERT ON transfer
FOR EACH ROW
BEGIN
  INSERT INTO saldo (user_id, total_saldo, created_at, updated_at) 
  VALUES (NEW.user_id, 0, NOW(), NOW())
  ON DUPLICATE KEY UPDATE 
  total_saldo = (
    (SELECT COALESCE(SUM(nominal), 0) FROM modal WHERE user_id = NEW.user_id) +
    (SELECT COALESCE(SUM(nominal + biaya), 0) FROM transfer WHERE user_id = NEW.user_id) +
    (SELECT COALESCE(SUM(biaya), 0) FROM transfer_debit WHERE user_id = NEW.user_id) +
    (SELECT COALESCE(SUM(biaya_tarik - nominal_tarik), 0) FROM tarik_tunai WHERE user_id = NEW.user_id)
  ),
  updated_at = NOW();
END//

-- Trigger for transfer debit changes
CREATE TRIGGER transfer_debit_after_insert 
AFTER INSERT ON transfer_debit
FOR EACH ROW
BEGIN
  INSERT INTO saldo (user_id, total_saldo, created_at, updated_at) 
  VALUES (NEW.user_id, 0, NOW(), NOW())
  ON DUPLICATE KEY UPDATE 
  total_saldo = (
    (SELECT COALESCE(SUM(nominal), 0) FROM modal WHERE user_id = NEW.user_id) +
    (SELECT COALESCE(SUM(nominal + biaya), 0) FROM transfer WHERE user_id = NEW.user_id) +
    (SELECT COALESCE(SUM(biaya), 0) FROM transfer_debit WHERE user_id = NEW.user_id) +
    (SELECT COALESCE(SUM(biaya_tarik - nominal_tarik), 0) FROM tarik_tunai WHERE user_id = NEW.user_id)
  ),
  updated_at = NOW();
END//

-- Trigger for tarik tunai changes
CREATE TRIGGER tarik_tunai_after_insert 
AFTER INSERT ON tarik_tunai
FOR EACH ROW
BEGIN
  INSERT INTO saldo (user_id, total_saldo, created_at, updated_at) 
  VALUES (NEW.user_id, 0, NOW(), NOW())
  ON DUPLICATE KEY UPDATE 
  total_saldo = (
    (SELECT COALESCE(SUM(nominal), 0) FROM modal WHERE user_id = NEW.user_id) +
    (SELECT COALESCE(SUM(nominal + biaya), 0) FROM transfer WHERE user_id = NEW.user_id) +
    (SELECT COALESCE(SUM(biaya), 0) FROM transfer_debit WHERE user_id = NEW.user_id) +
    (SELECT COALESCE(SUM(biaya_tarik - nominal_tarik), 0) FROM tarik_tunai WHERE user_id = NEW.user_id)
  ),
  updated_at = NOW();
END//

DELIMITER ;

-- Create views for easier reporting

-- View: user_summary
CREATE VIEW user_summary AS
SELECT 
  u.id,
  u.username,
  u.role,
  u.status,
  COALESCE(s.total_saldo, 0) as current_saldo,
  COALESCE(modal_total.total, 0) as total_modal,
  COALESCE(transfer_count.count, 0) as total_transfers,
  COALESCE(tarik_count.count, 0) as total_withdrawals
FROM users u
LEFT JOIN saldo s ON u.id = s.user_id
LEFT JOIN (
  SELECT user_id, SUM(nominal) as total 
  FROM modal 
  GROUP BY user_id
) modal_total ON u.id = modal_total.user_id
LEFT JOIN (
  SELECT user_id, COUNT(*) as count 
  FROM transfer 
  GROUP BY user_id
) transfer_count ON u.id = transfer_count.user_id
LEFT JOIN (
  SELECT user_id, COUNT(*) as count 
  FROM tarik_tunai 
  GROUP BY user_id
) tarik_count ON u.id = tarik_count.user_id;

-- View: daily_summary
CREATE VIEW daily_summary AS
SELECT 
  DATE(created_at) as tanggal,
  'transfer' as type,
  COUNT(*) as jumlah_transaksi,
  SUM(nominal + biaya) as total_amount
FROM transfer
GROUP BY DATE(created_at)
UNION ALL
SELECT 
  DATE(created_at) as tanggal,
  'transfer_debit' as type,
  COUNT(*) as jumlah_transaksi,
  SUM(biaya) as total_amount
FROM transfer_debit
GROUP BY DATE(created_at)
UNION ALL
SELECT 
  DATE(created_at) as tanggal,
  'tarik_tunai' as type,
  COUNT(*) as jumlah_transaksi,
  SUM(biaya_tarik - nominal_tarik) as total_amount
FROM tarik_tunai
GROUP BY DATE(created_at)
ORDER BY tanggal DESC, type;

-- Indexes for better performance
CREATE INDEX idx_users_role_status ON users(role, status);
CREATE INDEX idx_modal_user_type ON modal(user_id, modal_type);
CREATE INDEX idx_transfer_tanggal_user ON transfer(tanggal, user_id);
CREATE INDEX idx_transfer_debit_tanggal_user ON transfer_debit(tanggal, user_id);
CREATE INDEX idx_tarik_tunai_tanggal_user ON tarik_tunai(tanggal, user_id);

-- Show final status
SELECT 'Database pembukuan_kasir berhasil dibuat!' as status;
SELECT CONCAT('Total tables: ', COUNT(*)) as table_count FROM information_schema.tables WHERE table_schema = 'pembukuan_kasir';
SELECT 'Sample data berhasil diinsert!' as data_status;