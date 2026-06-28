-- Cambodia Vision Database Initialization
-- Full production schema — runs automatically when MySQL container starts

CREATE TABLE IF NOT EXISTS patients (
    id INT AUTO_INCREMENT PRIMARY KEY,
    patient_number VARCHAR(4) NOT NULL UNIQUE,
    gender ENUM('Male', 'Female', 'Child') NOT NULL,
    is_pregnant ENUM('No', 'Yes') DEFAULT 'No',
    blood_group VARCHAR(5),
    family_name VARCHAR(255) NOT NULL,
    given_name VARCHAR(255),
    age INT NOT NULL,
    has_tb BOOLEAN DEFAULT FALSE,
    contact_phone VARCHAR(50) NOT NULL,
    province VARCHAR(255) NOT NULL,
    district VARCHAR(255) NOT NULL,
    village VARCHAR(255),
    commune VARCHAR(255),
    reason_for_visit TEXT,
    photo LONGTEXT,
    status ENUM(
        'Registered', 'Form_Printed', 'In_Progress',
        'Prepare_for_Surgery', 'Surgery_Completed',
        'Surgery_Eligible', 'Not_Eligible', 'Surgery_Scheduled', 'Complete'
    ) NOT NULL DEFAULT 'Registered',
    stations_visited JSON DEFAULT '[]',
    form_printed TINYINT(1) DEFAULT 0,
    treatment VARCHAR(255),
    anaesthesia_date DATE,
    surgery_date DATE,
    registration_date DATE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_patient_number (patient_number),
    INDEX idx_gender (gender),
    INDEX idx_status (status),
    INDEX idx_province (province),
    INDEX idx_district (district),
    INDEX idx_registration_date (registration_date),
    INDEX idx_anaesthesia_date (anaesthesia_date),
    INDEX idx_surgery_date (surgery_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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

-- Admin users table (individual admin credentials)
CREATE TABLE IF NOT EXISTS admin_users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(100) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(255),
    role ENUM('admin', 'station_manager') NOT NULL DEFAULT 'admin',
    assigned_station VARCHAR(50) DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- System configuration (stores shared passphrase hash, etc.)
CREATE TABLE IF NOT EXISTS system_config (
    config_key VARCHAR(100) PRIMARY KEY,
    config_value TEXT NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Surgeons list
CREATE TABLE IF NOT EXISTS surgeons (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    active TINYINT(1) DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Surgery records (detailed surgery data per patient)
CREATE TABLE IF NOT EXISTS surgery_records (
    id INT AUTO_INCREMENT PRIMARY KEY,
    patient_id INT NOT NULL,
    eye ENUM('left', 'right', 'both') NOT NULL,
    procedure_type TEXT,
    iol_type TEXT,
    incision TEXT,
    also_used JSON,
    complications JSON,
    surgeon_id INT NOT NULL,
    surgeon_notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
    FOREIGN KEY (surgeon_id) REFERENCES surgeons(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Station queue status (busy levels)
CREATE TABLE IF NOT EXISTS station_status (
    station VARCHAR(50) PRIMARY KEY,
    busy_level ENUM('low', 'mid', 'high') NOT NULL DEFAULT 'mid',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Seed default station statuses
INSERT INTO station_status (station, busy_level) VALUES
  ('Doctor', 'mid'),
  ('Optometry', 'mid'),
  ('Refraction', 'mid'),
  ('Glasses_Dispensed', 'mid'),
  ('Ear_Therapy', 'mid'),
  ('Surgery', 'mid')
ON DUPLICATE KEY UPDATE station=station;

-- Seed default surgeons
INSERT INTO surgeons (name) VALUES
  ('Dr Michael Newman'),
  ('Dr Gary Schiller'),
  ('Dr John Lee'),
  ('Dr Audrey Muregesan'),
  ('Dr Brett Drury'),
  ('Dr Domit Azar'),
  ('Dr Wu Zhouquan'),
  ('Dr Zhong Zhiwei')
ON DUPLICATE KEY UPDATE name=name;
