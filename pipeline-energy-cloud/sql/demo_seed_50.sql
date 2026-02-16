USE pipeline_cloud;
SET NAMES utf8mb4;

START TRANSACTION;

INSERT INTO t_project (number, name, responsible, build_date)
VALUES ('CN-PL-2024-001', 'Daqing-Harbin Crude Pipeline Revamp', 'Liu Wei', '2024-03-12 10:00:00');
SET @p1 = LAST_INSERT_ID();

INSERT INTO t_project (number, name, responsible, build_date)
VALUES ('CN-PL-2024-002', 'Qingdao-Weifang Product Line Upgrade', 'Zhang Ming', '2024-04-18 09:30:00');
SET @p2 = LAST_INSERT_ID();

INSERT INTO t_project (number, name, responsible, build_date)
VALUES ('CN-PL-2024-003', 'Xinjiang Trunkline Energy Retrofit', 'Wang Lei', '2024-05-06 14:20:00');
SET @p3 = LAST_INSERT_ID();

INSERT INTO t_project (number, name, responsible, build_date)
VALUES ('CN-PL-2024-004', 'Sichuan-Chongqing Refined Oil Corridor', 'Chen Hao', '2024-06-02 11:15:00');
SET @p4 = LAST_INSERT_ID();

INSERT INTO t_project (number, name, responsible, build_date)
VALUES ('CN-PL-2024-005', 'Pearl River Delta Jet Fuel Supply Line', 'Li Jian', '2024-06-28 16:40:00');
SET @p5 = LAST_INSERT_ID();

INSERT INTO t_project (number, name, responsible, build_date)
VALUES ('CN-PL-2024-006', 'Ningxia-Gansu Pipeline Capacity Expansion', 'Sun Qiang', '2024-07-21 13:05:00');
SET @p6 = LAST_INSERT_ID();

INSERT INTO t_project (number, name, responsible, build_date)
VALUES ('CN-PL-2024-007', 'Bohai Offshore Landing Pipeline Optimization', 'Xu Peng', '2024-08-10 15:55:00');
SET @p7 = LAST_INSERT_ID();

INSERT INTO t_project (number, name, responsible, build_date)
VALUES ('CN-PL-2024-008', 'Inner Mongolia Long-Distance Crude Transfer', 'Gao Bin', '2024-09-04 10:45:00');
SET @p8 = LAST_INSERT_ID();

INSERT INTO t_project (number, name, responsible, build_date)
VALUES ('CN-PL-2024-009', 'Yunnan Plateau Pipeline Stability Program', 'He Rui', '2024-10-16 09:10:00');
SET @p9 = LAST_INSERT_ID();

INSERT INTO t_project (number, name, responsible, build_date)
VALUES ('CN-PL-2024-010', 'Northeast Winter Operation Reliability Project', 'Deng Chao', '2024-11-08 14:35:00');
SET @p10 = LAST_INSERT_ID();

INSERT INTO t_pipeline
(pro_id, name, length, diameter, thickness, throughput, start_altitude, end_altitude, roughness, work_time)
VALUES
(@p1, 'Daqing-Harbin Mainline A', 612.50, 813.00, 12.00, 2200.00, 152.00, 121.00, 0.00010, 8000.00),
(@p1, 'Daqing-Harbin Mainline B', 635.80, 762.00, 11.00, 1980.00, 148.00, 116.00, 0.00011, 7980.00),
(@p2, 'Qingdao-Weifang Product Segment A', 188.20, 508.00, 9.50, 760.00, 35.00, 22.00, 0.00009, 8160.00),
(@p2, 'Qingdao-Weifang Product Segment B', 205.40, 457.00, 9.00, 680.00, 31.00, 19.00, 0.00010, 8120.00),
(@p3, 'Xinjiang Trunkline West Section', 1028.60, 1016.00, 16.00, 2650.00, 925.00, 615.00, 0.00012, 7900.00),
(@p3, 'Xinjiang Trunkline East Section', 846.30, 914.00, 14.00, 2380.00, 790.00, 458.00, 0.00012, 7920.00),
(@p4, 'Sichuan-Chongqing Corridor North', 324.70, 610.00, 10.00, 980.00, 468.00, 302.00, 0.00011, 8050.00),
(@p4, 'Sichuan-Chongqing Corridor South', 298.10, 559.00, 10.00, 910.00, 455.00, 280.00, 0.00011, 8030.00),
(@p5, 'PRD Jet Fuel Loop East', 142.90, 426.00, 8.00, 520.00, 21.00, 9.00, 0.00008, 8280.00),
(@p5, 'PRD Jet Fuel Loop West', 167.50, 426.00, 8.00, 560.00, 24.00, 10.00, 0.00008, 8260.00),
(@p6, 'Ningxia-Gansu Segment A', 412.60, 711.00, 12.00, 1350.00, 1290.00, 1085.00, 0.00013, 7840.00),
(@p6, 'Ningxia-Gansu Segment B', 389.40, 660.00, 11.00, 1210.00, 1248.00, 1042.00, 0.00013, 7860.00),
(@p7, 'Bohai Landing Trunkline A', 96.30, 559.00, 9.50, 840.00, 12.00, 5.00, 0.00009, 8200.00),
(@p7, 'Bohai Landing Trunkline B', 103.70, 508.00, 9.00, 760.00, 14.00, 6.00, 0.00009, 8180.00),
(@p8, 'Inner Mongolia Transfer Section 1', 725.20, 813.00, 13.00, 2100.00, 1120.00, 905.00, 0.00012, 7960.00),
(@p8, 'Inner Mongolia Transfer Section 2', 688.40, 762.00, 12.00, 1850.00, 1086.00, 860.00, 0.00012, 7940.00),
(@p9, 'Yunnan Plateau Climb Section', 354.50, 610.00, 11.00, 880.00, 1625.00, 1180.00, 0.00014, 7720.00),
(@p9, 'Yunnan Plateau Valley Section', 331.80, 559.00, 10.00, 810.00, 1320.00, 860.00, 0.00014, 7700.00),
(@p10, 'Northeast Winter Reliability Line A', 508.90, 711.00, 12.00, 1480.00, 270.00, 180.00, 0.00011, 8100.00),
(@p10, 'Northeast Winter Reliability Line B', 536.20, 660.00, 11.50, 1390.00, 292.00, 186.00, 0.00011, 8080.00);

INSERT INTO t_pump_station
(name, pump_efficiency, electric_efficiency, displacement, come_power, zmi480_lift, zmi375_lift)
VALUES
('Daqing North Pump Station', 86.50, 95.20, 4200.00, 1.35, 510.00, 392.00),
('Harbin South Pump Station', 85.90, 94.80, 3980.00, 1.28, 498.00, 386.00),
('Weifang Hub Pump Station', 87.20, 95.60, 2560.00, 1.12, 472.00, 365.00),
('Urumqi West Pump Station', 84.70, 94.10, 4650.00, 1.62, 525.00, 405.00),
('Karamay Booster Station', 85.10, 94.30, 4520.00, 1.58, 518.00, 399.00),
('Chongqing East Pump Station', 86.80, 95.10, 2890.00, 1.18, 485.00, 374.00),
('Guangzhou Airport Fuel Station', 88.10, 96.00, 2100.00, 0.96, 455.00, 352.00),
('Lanzhou Midline Pump Station', 85.40, 94.50, 3360.00, 1.42, 503.00, 389.00),
('Bohai Terminal Pump Station', 87.60, 95.70, 2480.00, 1.05, 468.00, 360.00),
('Hohhot Main Pump Station', 86.20, 95.00, 3810.00, 1.47, 507.00, 391.00),
('Kunming Highland Pump Station', 84.90, 94.20, 2740.00, 1.54, 512.00, 396.00),
('Shenyang Winterized Pump Station', 85.80, 94.90, 3120.00, 1.33, 495.00, 382.00);

INSERT INTO t_oil_property (name, density, viscosity)
VALUES
('Daqing Crude Blend', 842.00, 0.000008),
('Shengli Crude Blend', 856.00, 0.000010),
('Imported Medium Crude', 873.00, 0.000015),
('Low Sulfur Light Crude', 812.00, 0.000005),
('Jet Fuel Kerosene Grade', 790.00, 0.000003),
('Diesel Product Mix', 828.00, 0.000004),
('Winterized Crude Blend', 861.00, 0.000012),
('High Wax Crude Blend', 889.00, 0.000021);

COMMIT;
