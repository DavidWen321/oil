USE pipeline_cloud;
SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- Minimal demo data for calculation pages.
-- This script clears only the 4 base data tables used by the calculation dropdowns.
TRUNCATE TABLE t_pipeline;
TRUNCATE TABLE t_project;
TRUNCATE TABLE t_pump_station;
TRUNCATE TABLE t_oil_property;

SET FOREIGN_KEY_CHECKS = 1;

START TRANSACTION;

INSERT INTO t_project (number, name, responsible, build_date)
VALUES ('DEMO-001', 'North Trunkline Upgrade', 'Li Wei', '2025-01-15 09:00:00');
SET @p1 = LAST_INSERT_ID();

INSERT INTO t_project (number, name, responsible, build_date)
VALUES ('DEMO-002', 'East Product Pipeline Retrofit', 'Wang Jun', '2025-02-10 10:30:00');
SET @p2 = LAST_INSERT_ID();

INSERT INTO t_project (number, name, responsible, build_date)
VALUES ('DEMO-003', 'Plateau Transfer Efficiency Program', 'Zhang Min', '2025-03-05 14:20:00');
SET @p3 = LAST_INSERT_ID();

INSERT INTO t_pipeline
  (pro_id, name, length, diameter, thickness, throughput, start_altitude, end_altitude, roughness, work_time)
VALUES
  (@p1, 'North Mainline Section A', 286.50, 610.00, 10.00, 980.00, 135.00, 88.00, 0.00010, 8000.00),
  (@p1, 'North Mainline Section B', 314.80, 559.00, 9.50, 920.00, 128.00, 84.00, 0.00010, 7980.00),
  (@p2, 'East Refined Line Section A', 168.20, 508.00, 9.00, 720.00, 32.00, 18.00, 0.00009, 8160.00),
  (@p2, 'East Refined Line Section B', 194.40, 457.00, 8.50, 680.00, 28.00, 14.00, 0.00009, 8120.00),
  (@p3, 'Plateau Transfer West', 402.60, 711.00, 12.00, 1320.00, 1260.00, 1020.00, 0.00013, 7840.00),
  (@p3, 'Plateau Transfer East', 376.90, 660.00, 11.50, 1210.00, 1195.00, 960.00, 0.00013, 7860.00);

INSERT INTO t_pump_station
  (name, pump_efficiency, electric_efficiency, displacement, come_power, zmi480_lift, zmi375_lift)
VALUES
  ('North Hub Station', 86.50, 95.20, 3200.00, 1.20, 485.00, 372.00),
  ('North Booster Station', 85.80, 94.90, 3050.00, 1.16, 476.00, 365.00),
  ('East Transfer Station', 87.10, 95.60, 2480.00, 1.05, 462.00, 356.00),
  ('East Terminal Station', 86.30, 95.10, 2360.00, 0.98, 455.00, 348.00),
  ('Plateau West Station', 84.90, 94.30, 3520.00, 1.48, 512.00, 395.00),
  ('Plateau East Station', 85.40, 94.60, 3380.00, 1.41, 504.00, 388.00);

INSERT INTO t_oil_property (name, density, viscosity)
VALUES
  ('Light Crude Blend', 820.00, 0.000006),
  ('Standard Crude Blend', 850.00, 0.000010),
  ('Heavy Crude Blend', 890.00, 0.000020),
  ('Diesel Product', 835.00, 0.000004),
  ('Jet Fuel', 790.00, 0.000003);

COMMIT;
