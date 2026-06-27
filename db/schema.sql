-- Cambodia Vision Database Schema for MySQL
-- Run this SQL to create the database and tables

-- Create database
CREATE DATABASE IF NOT EXISTS cambodia_vision;
USE cambodia_vision;

-- Create patients table
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
    photo TEXT,
    treatment VARCHAR(255),
    anaesthesia_date DATE,
    surgery_date DATE,
    registration_date DATE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_patient_number (patient_number),
    INDEX idx_gender (gender),
    INDEX idx_province (province),
    INDEX idx_district (district),
    INDEX idx_registration_date (registration_date),
    INDEX idx_anaesthesia_date (anaesthesia_date),
    INDEX idx_surgery_date (surgery_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Create volunteers table for authentication
CREATE TABLE IF NOT EXISTS volunteers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(100) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(255),
    role ENUM('admin', 'volunteer') DEFAULT 'volunteer',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Insert default admin user (password: admin123)
-- Note: Run bcrypt hash for the password before inserting
INSERT INTO volunteers (username, password_hash, full_name, role) VALUES
('admin', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZRGdjGj/n3.SNsYQQxRq7l7l7l7l7', 'Administrator', 'admin');
