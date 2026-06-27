-- Migration 001: Add patient status pipeline and production tables
-- This migration adds the status pipeline, GP examination, surgery decision,
-- admin users, and system configuration tables.

-- Add status column to patients table
ALTER TABLE patients
  ADD COLUMN status ENUM(
    'Registered', 'Seen_by_GP', 'Surgery_Eligible',
    'Not_Eligible', 'Surgery_Scheduled', 'Complete'
  ) NOT NULL DEFAULT 'Registered' AFTER photo,
  ADD INDEX idx_status (status);

-- Status transition history
CREATE TABLE IF NOT EXISTS status_history (
  id INT AUTO_INCREMENT PRIMARY KEY,
  patient_id INT NOT NULL,
  from_status VARCHAR(50),
  to_status VARCHAR(50) NOT NULL,
  changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  changed_by VARCHAR(100),
  FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
  INDEX idx_patient_status (patient_id, changed_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- GP examination data
CREATE TABLE IF NOT EXISTS gp_examinations (
  id INT AUTO_INCREMENT PRIMARY KEY,
  patient_id INT NOT NULL UNIQUE,
  visual_acuity_left VARCHAR(20) NOT NULL,
  visual_acuity_right VARCHAR(20) NOT NULL,
  diagnosis_notes TEXT NOT NULL,
  recommendation TEXT NOT NULL,
  examined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
  INDEX idx_patient_exam (patient_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Surgery eligibility decisions
CREATE TABLE IF NOT EXISTS surgery_decisions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  patient_id INT NOT NULL UNIQUE,
  eligibility ENUM('Surgery_Eligible', 'Not_Eligible') NOT NULL,
  surgery_type VARCHAR(255),
  eye ENUM('left', 'right', 'both'),
  scheduled_date DATE,
  ineligibility_reason TEXT,
  decided_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
  INDEX idx_patient_surgery (patient_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Admin users table (replaces volunteers table for admin accounts)
CREATE TABLE IF NOT EXISTS admin_users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(100) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- System configuration (stores shared passphrase hash)
CREATE TABLE IF NOT EXISTS system_config (
  config_key VARCHAR(100) PRIMARY KEY,
  config_value TEXT NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Drop the old volunteers table (replaced by admin_users + system_config)
DROP TABLE IF EXISTS volunteers;
