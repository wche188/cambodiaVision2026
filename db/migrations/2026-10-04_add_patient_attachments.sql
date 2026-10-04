-- patient_attachments table
-- Run this against the cambodia_vision database to add the attachments feature.
-- Safe to run multiple times (uses IF NOT EXISTS).

CREATE TABLE IF NOT EXISTS patient_attachments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  patient_id INT NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  mime_type VARCHAR(100) NOT NULL,
  size_bytes INT UNSIGNED NOT NULL,
  data LONGTEXT NOT NULL,
  category ENUM('document', 'note', 'other') NOT NULL DEFAULT 'document',
  note TEXT,
  uploaded_by VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_patient (patient_id),
  INDEX idx_category (category),
  CONSTRAINT fk_patient_attachments_patient
    FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE
);

-- Drop the test PDF uploaded during the dev session (if it exists)
DELETE FROM patient_attachments WHERE file_name = 'qa-test-doc.pdf' AND patient_id = 17;
