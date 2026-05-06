-- Create sensor_readings table in Supabase
CREATE TABLE sensor_readings (
    id SERIAL PRIMARY KEY,
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    location TEXT NOT NULL,
    sensor_type TEXT NOT NULL CHECK (sensor_type IN ('temp', 'hum')),
    value REAL NOT NULL
);

-- Optional: Create an index on timestamp for faster queries
CREATE INDEX idx_sensor_readings_timestamp ON sensor_readings (timestamp);

-- Optional: Create an index on location
CREATE INDEX idx_sensor_readings_location ON sensor_readings (location);