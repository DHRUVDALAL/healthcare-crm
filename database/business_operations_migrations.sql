-- Business Operations Module Migrations
-- Extends invoices table and creates invoice_payments table

ALTER TABLE invoices ADD COLUMN IF NOT EXISTS fee_type ENUM('percentage', 'fixed') NOT NULL DEFAULT 'percentage';
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS fixed_fee_amount DECIMAL(12,2) NULL DEFAULT 0.00;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS subtotal DECIMAL(12,2) NULL DEFAULT 0.00;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS gst_percentage DECIMAL(5,2) NULL DEFAULT 0.00;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS gst_amount DECIMAL(12,2) NULL DEFAULT 0.00;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS paid_amount DECIMAL(12,2) NULL DEFAULT 0.00;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS payment_method VARCHAR(64) NULL;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS transaction_reference VARCHAR(128) NULL;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS created_by INT NULL;

ALTER TABLE invoices MODIFY COLUMN payment_status ENUM('pending','partially_paid','paid','overdue','cancelled') NOT NULL DEFAULT 'pending';

CREATE TABLE IF NOT EXISTS invoice_payments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  invoice_id INT NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  payment_method VARCHAR(64) NOT NULL,
  transaction_reference VARCHAR(128) NULL,
  payment_date DATE NOT NULL,
  notes TEXT NULL,
  created_by INT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_invoice_payments_invoice (invoice_id),
  CONSTRAINT fk_invoice_payments_invoice FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
