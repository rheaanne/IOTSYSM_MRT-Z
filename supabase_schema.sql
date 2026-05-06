-- Drop old table if it exists
DROP TABLE IF EXISTS sensor_readings;

-- Create sensor_logs table for historical data
CREATE TABLE sensor_logs (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  feed_name TEXT NOT NULL,
  value FLOAT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_sensor_logs_feed_name ON sensor_logs (feed_name);
CREATE INDEX idx_sensor_logs_created_at ON sensor_logs (created_at DESC);