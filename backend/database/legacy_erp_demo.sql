-- Legacy ERP demo database for local MySQL and production MySQL imports.
-- Import with: mysql -u root -p namotech_demo < legacy_erp_demo.sql

SET NAMES utf8mb4;
SET time_zone = '+00:00';
SET FOREIGN_KEY_CHECKS = 0;

CREATE DATABASE IF NOT EXISTS `namotech_demo`
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE `namotech_demo`;

DROP TABLE IF EXISTS `personal_access_tokens`;
DROP TABLE IF EXISTS `cube_reports`;
DROP TABLE IF EXISTS `reports`;
DROP TABLE IF EXISTS `client_registrations`;
DROP TABLE IF EXISTS `users`;

CREATE TABLE `users` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `username` varchar(255) NOT NULL,
  `email` varchar(255) NOT NULL,
  `password` varchar(255) NOT NULL,
  `firstname` varchar(255) NOT NULL,
  `lastname` varchar(255) NOT NULL,
  `phone` varchar(50) NOT NULL,
  `gender` tinyint unsigned NOT NULL DEFAULT 1,
  `is_admin` tinyint(1) NOT NULL DEFAULT 0,
  `remember_token` varchar(100) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `users_email_unique` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `personal_access_tokens` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `tokenable_type` varchar(255) NOT NULL,
  `tokenable_id` bigint unsigned NOT NULL,
  `name` varchar(255) NOT NULL,
  `token` varchar(64) NOT NULL,
  `abilities` text DEFAULT NULL,
  `last_used_at` timestamp NULL DEFAULT NULL,
  `expires_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `personal_access_tokens_token_unique` (`token`),
  KEY `personal_access_tokens_tokenable_type_tokenable_id_index` (`tokenable_type`,`tokenable_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `client_registrations` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `uid_no` varchar(255) NOT NULL,
  `received_date` date NOT NULL,
  `agency_name` varchar(255) NOT NULL,
  `reporting_address` varchar(255) NOT NULL,
  `mobile_no` varchar(50) NOT NULL,
  `name_of_work` text NOT NULL,
  `sample_details` text NOT NULL,
  `total_payment` decimal(12,2) NOT NULL DEFAULT 0.00,
  `advance_payment` decimal(12,2) NOT NULL DEFAULT 0.00,
  `balance_dues` decimal(12,2) NOT NULL DEFAULT 0.00,
  `payment_followup` varchar(255) DEFAULT NULL,
  `remark` text DEFAULT NULL,
  `qty` varchar(255) DEFAULT NULL,
  `scan_copy` varchar(255) DEFAULT NULL,
  `scan_copy_1` varchar(255) DEFAULT NULL,
  `scan_copy_2` varchar(255) DEFAULT NULL,
  `scan_copy_3` varchar(255) DEFAULT NULL,
  `scan_copy_4` varchar(255) DEFAULT NULL,
  `report_copy` varchar(255) DEFAULT NULL,
  `assign_to` varchar(255) NOT NULL DEFAULT 'lab',
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `client_registrations_uid_no_unique` (`uid_no`),
  KEY `client_registrations_received_date_index` (`received_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `reports` (
  `iReportId` bigint unsigned NOT NULL AUTO_INCREMENT,
  `uid_no` varchar(255) NOT NULL,
  `ulr_no` varchar(255) DEFAULT NULL,
  `customer_details` text NOT NULL,
  `agency_name` varchar(255) NOT NULL,
  `reference_no` varchar(255) DEFAULT NULL,
  `material_details` text DEFAULT NULL,
  `source_location` text DEFAULT NULL,
  `work_order_no` varchar(255) DEFAULT NULL,
  `sample_date` date DEFAULT NULL,
  `sample_tested_date` date DEFAULT NULL,
  `dispatch_date` date DEFAULT NULL,
  `sampled_by` varchar(255) DEFAULT NULL,
  `environment_condition` varchar(255) DEFAULT NULL,
  `report_type` varchar(255) NOT NULL,
  `status` varchar(255) NOT NULL DEFAULT 'Pending',
  `cancel_remark` varchar(255) DEFAULT NULL,
  `user_id` bigint unsigned DEFAULT NULL,
  `created_by` bigint unsigned DEFAULT NULL,
  `updated_by` bigint unsigned DEFAULT NULL,
  `updated_date` bigint unsigned DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`iReportId`),
  KEY `reports_uid_no_index` (`uid_no`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `cube_reports` (
  `iCubeId` bigint unsigned NOT NULL AUTO_INCREMENT,
  `iReportId` bigint unsigned NOT NULL,
  `uid_no` varchar(255) NOT NULL,
  `location` varchar(255) DEFAULT NULL,
  `size_of_cube` varchar(255) DEFAULT NULL,
  `date_of_casting` date DEFAULT NULL,
  `date_of_testing` date DEFAULT NULL,
  `age_of_specimen` varchar(255) DEFAULT NULL,
  `avg_comp_strength` varchar(255) DEFAULT NULL,
  `is_code_comp_strength` varchar(255) DEFAULT NULL,
  `load_1` varchar(255) DEFAULT NULL,
  `load_2` varchar(255) DEFAULT NULL,
  `load_3` varchar(255) DEFAULT NULL,
  `comp_strength_1` varchar(255) DEFAULT NULL,
  `comp_strength_2` varchar(255) DEFAULT NULL,
  `comp_strength_3` varchar(255) DEFAULT NULL,
  `set_count` int unsigned NOT NULL DEFAULT 1,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`iCubeId`),
  KEY `cube_reports_iReportId_index` (`iReportId`),
  KEY `cube_reports_uid_no_index` (`uid_no`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `users` (`id`, `username`, `email`, `password`, `firstname`, `lastname`, `phone`, `gender`, `is_admin`, `remember_token`, `created_at`, `updated_at`) VALUES
(1, 'super admin', 'admin@admin.com', '$2y$10$yfi5nUQGXUZtMdl27dWAyOd/jMOmATBpiUvJDmUu9hJ5Ro6BE5wsK', 'Angel Jude', 'Suarez', '09272777334', 1, 1, NULL, NOW(), NOW()),
(12, 'adones', 'adones@gmail.com', '$2y$10$WLS.lZeiEfyXYfR0l/wkXeRRuqazsgIAMC9//L44J4KkZGbbqcKYC', 'adones', 'evangelista', '09123456789', 1, 0, NULL, NOW(), NOW());

INSERT INTO `client_registrations` (`id`, `uid_no`, `received_date`, `agency_name`, `reporting_address`, `mobile_no`, `name_of_work`, `sample_details`, `total_payment`, `advance_payment`, `balance_dues`, `payment_followup`, `remark`, `qty`, `scan_copy`, `scan_copy_1`, `scan_copy_2`, `scan_copy_3`, `scan_copy_4`, `report_copy`, `assign_to`, `created_at`, `updated_at`) VALUES
(1, 'REG-2026-0001', CURDATE(), 'Legacy Works Agency', 'Main Office, Sample City', '09000000001', 'Concrete cube testing', 'First sample migrated from the legacy intake flow.', 2500.00, 1500.00, 1000.00, 'Call tomorrow', 'Seeded record', '3', NULL, NULL, NULL, NULL, NULL, NULL, 'lab', NOW(), NOW()),
(2, 'REG-2026-0002', DATE_SUB(CURDATE(), INTERVAL 1 DAY), 'Bridge Build Ltd', 'North Industrial Estate', '09000000002', 'Bitumen core test', 'Pending payment record for the billing queue.', 1800.00, 1800.00, 0.00, 'Settled', 'Seeded record', '2', NULL, NULL, NULL, NULL, NULL, NULL, 'lab', NOW(), NOW());

INSERT INTO `reports` (`iReportId`, `uid_no`, `ulr_no`, `customer_details`, `agency_name`, `reference_no`, `material_details`, `source_location`, `work_order_no`, `sample_date`, `sample_tested_date`, `dispatch_date`, `sampled_by`, `environment_condition`, `report_type`, `status`, `cancel_remark`, `user_id`, `created_by`, `updated_by`, `updated_date`, `created_at`, `updated_at`) VALUES
(1, 'REG-2026-0001', 'NCS/LAB/2026/00001', 'Sample customer details for cube testing', 'Legacy Works Agency', 'REF-001', 'Concrete cube', 'Main Office, Sample City', 'WO-001', CURDATE(), CURDATE(), CURDATE(), 'Inspector A', 'Normal', 'cc_cube', 'Pending', NULL, 1, NULL, NULL, NULL, NOW(), NOW());

INSERT INTO `cube_reports` (`iCubeId`, `iReportId`, `uid_no`, `location`, `size_of_cube`, `date_of_casting`, `date_of_testing`, `age_of_specimen`, `avg_comp_strength`, `is_code_comp_strength`, `load_1`, `load_2`, `load_3`, `comp_strength_1`, `comp_strength_2`, `comp_strength_3`, `set_count`, `created_at`, `updated_at`) VALUES
(1, 1, 'REG-2026-0001', 'Main Office, Sample City', '150', CURDATE(), CURDATE(), '28', '0', '0', '0', '0', '0', '0', '0', '0', 1, NOW(), NOW());

SET FOREIGN_KEY_CHECKS = 1;