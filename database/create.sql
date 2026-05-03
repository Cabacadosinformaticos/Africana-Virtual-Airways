CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  email VARCHAR(160) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  vatsim_cid VARCHAR(32) NULL,
  role ENUM('admin', 'user') NOT NULL DEFAULT 'user',
  is_primary_admin TINYINT(1) NOT NULL DEFAULT 0,
  created_by_user_id INT NULL,
  joined_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  flight_hours INT NOT NULL DEFAULT 0,
  points INT NOT NULL DEFAULT 0,
  INDEX idx_users_created_by (created_by_user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS aircraft (
  id INT AUTO_INCREMENT PRIMARY KEY,
  registration VARCHAR(32) NOT NULL UNIQUE,
  type VARCHAR(120) NOT NULL,
  category VARCHAR(60) NOT NULL,
  hub VARCHAR(8) NOT NULL,
  hub_name VARCHAR(120) NOT NULL,
  economy_seats INT NOT NULL DEFAULT 0,
  business_seats INT NOT NULL DEFAULT 0,
  first_seats INT NOT NULL DEFAULT 0,
  range_km INT NOT NULL DEFAULT 0,
  cruise_speed_kmh INT NOT NULL DEFAULT 0,
  status VARCHAR(40) NOT NULL DEFAULT 'active',
  image TEXT NULL,
  description TEXT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS airports (
  icao VARCHAR(8) NOT NULL PRIMARY KEY,
  iata VARCHAR(4) NULL,
  name VARCHAR(200) NOT NULL,
  city VARCHAR(100) NOT NULL,
  country VARCHAR(100) NOT NULL,
  lat DECIMAL(9,4) NOT NULL,
  lon DECIMAL(9,4) NOT NULL,
  hub TINYINT(1) NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS routes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  from_airport VARCHAR(8) NOT NULL,
  to_airport VARCHAR(8) NOT NULL,
  hub_airport VARCHAR(8) NOT NULL,
  distance_km INT NOT NULL,
  duration_minutes INT NOT NULL,
  aircraft_id INT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  UNIQUE KEY uq_route_pair (from_airport, to_airport),
  CONSTRAINT fk_routes_aircraft
    FOREIGN KEY (aircraft_id) REFERENCES aircraft(id)
    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS route_schedules (
  id INT AUTO_INCREMENT PRIMARY KEY,
  route_id INT NOT NULL,
  flight_number VARCHAR(16) NOT NULL UNIQUE,
  slot_code VARCHAR(20) NOT NULL,
  departure_time TIME NOT NULL,
  active TINYINT(1) NOT NULL DEFAULT 1,
  CONSTRAINT fk_route_schedules_route
    FOREIGN KEY (route_id) REFERENCES routes(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS bookings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  booking_ref VARCHAR(16) NOT NULL UNIQUE,
  user_id INT NULL,
  user_name VARCHAR(160) NOT NULL,
  passenger_email VARCHAR(160) NOT NULL,
  flight_number VARCHAR(64) NOT NULL,
  from_airport VARCHAR(8) NOT NULL,
  to_airport VARCHAR(8) NOT NULL,
  travel_date DATE NOT NULL,
  cabin_class ENUM('economy', 'business', 'first') NOT NULL,
  passengers INT NOT NULL DEFAULT 1,
  total_price DECIMAL(10, 2) NOT NULL DEFAULT 0,
  status ENUM('confirmed', 'on_time', 'delayed', 'cancelled') NOT NULL DEFAULT 'confirmed',
  seat_selection VARCHAR(16) NULL,
  passenger_details JSON NOT NULL,
  itinerary JSON NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  cancelled_at DATETIME NULL,
  CONSTRAINT fk_bookings_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE SET NULL,
  INDEX idx_bookings_user (user_id),
  INDEX idx_bookings_date (travel_date),
  INDEX idx_bookings_status (status),
  INDEX idx_bookings_lookup (booking_ref, passenger_email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS booking_passengers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  booking_id INT NOT NULL,
  passenger_index INT NOT NULL DEFAULT 0,
  first_name VARCHAR(120) NOT NULL,
  last_name VARCHAR(120) NOT NULL,
  email VARCHAR(160) NOT NULL,
  phone VARCHAR(64) NULL,
  nationality VARCHAR(120) NULL,
  seat_selection VARCHAR(16) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_booking_passenger_index (booking_id, passenger_index),
  INDEX idx_booking_passengers_email (email),
  CONSTRAINT fk_booking_passengers_booking
    FOREIGN KEY (booking_id) REFERENCES bookings(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS booking_segments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  booking_id INT NOT NULL,
  segment_index INT NOT NULL DEFAULT 0,
  route_id INT NULL,
  flight_number VARCHAR(32) NOT NULL,
  from_airport VARCHAR(8) NOT NULL,
  to_airport VARCHAR(8) NOT NULL,
  departure_date DATE NOT NULL,
  arrival_date DATE NOT NULL,
  departure_time VARCHAR(16) NOT NULL,
  arrival_time VARCHAR(16) NOT NULL,
  departure_datetime DATETIME NOT NULL,
  arrival_datetime DATETIME NOT NULL,
  duration_minutes INT NOT NULL DEFAULT 0,
  distance_km INT NOT NULL DEFAULT 0,
  aircraft_id INT NULL,
  aircraft_registration VARCHAR(32) NULL,
  aircraft_type VARCHAR(120) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_booking_segment_index (booking_id, segment_index),
  INDEX idx_booking_segments_flight_date (flight_number, departure_date),
  CONSTRAINT fk_booking_segments_booking
    FOREIGN KEY (booking_id) REFERENCES bookings(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_booking_segments_aircraft
    FOREIGN KEY (aircraft_id) REFERENCES aircraft(id)
    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS booked_seats (
  id INT AUTO_INCREMENT PRIMARY KEY,
  flight_number VARCHAR(16) NOT NULL,
  departure_date DATE NOT NULL,
  seat_id VARCHAR(8) NOT NULL,
  cabin_class ENUM('economy', 'business', 'first') NOT NULL,
  booking_ref VARCHAR(16) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_flight_seat (flight_number, departure_date, seat_id),
  INDEX idx_booked_seats_ref (booking_ref),
  CONSTRAINT fk_booked_seats_booking
    FOREIGN KEY (booking_ref) REFERENCES bookings(booking_ref)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS airline_stats (
  id INT AUTO_INCREMENT PRIMARY KEY,
  total_flights INT NOT NULL DEFAULT 0,
  total_hours INT NOT NULL DEFAULT 0,
  active_members INT NOT NULL DEFAULT 0,
  founded_date DATE NOT NULL,
  first_flight_from VARCHAR(8) NOT NULL,
  first_flight_to VARCHAR(8) NOT NULL,
  first_flight_date DATE NOT NULL,
  division VARCHAR(160) NOT NULL,
  callsign_prefix VARCHAR(8) NOT NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
