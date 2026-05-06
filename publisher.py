import time
import random
import ssl
from datetime import datetime
from supabase import create_client, Client

# Supabase Configuration
SUPABASE_URL = "https://mheccuaathqhcfodbkif.supabase.co"       # ← replace with your Supabase URL
SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1oZWNjdWFhdGhxaGNmb2Ria2lmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc4NjM3NzAsImV4cCI6MjA5MzQzOTc3MH0.wr7oyYT-7QIey23AzWnfgL_cypQQVEtj2SCkSQQHIOw"  # ← replace with your Supabase anon key

supabase: Client = create_client(SUPABASE_URL, SUPABASE_ANON_KEY)

# Sensor feed definitions (NodeID-type format)
SENSORS = [
    {"feed_name": "VLM-01-temperature", "type": "temperature"},
    {"feed_name": "VLM-01-humidity", "type": "humidity"},
    {"feed_name": "AFP-01-temperature", "type": "temperature"},
    {"feed_name": "AFP-01-humidity", "type": "humidity"},
    {"feed_name": "SLZ-01-temperature", "type": "temperature"},
    {"feed_name": "SLZ-01-humidity", "type": "humidity"},
    {"feed_name": "BLV-01-temperature", "type": "temperature"},
    {"feed_name": "BLV-01-humidity", "type": "humidity"},
]

def publish_to_supabase():
    """Publish sensor data to Supabase sensor_logs table via secure WebSocket"""
    for sensor in SENSORS:
        try:
            # Generate mock sensor data
            if sensor["type"] == "temperature":
                value = round(random.uniform(20, 35), 1)
            else:  # humidity
                value = round(random.uniform(40, 80), 1)
            
            # Insert into sensor_logs table
            data = {
                "feed_name": sensor["feed_name"],
                "value": value,
                # created_at will be automatically set by Supabase DEFAULT NOW()
            }
            
            response = supabase.table("sensor_logs").insert(data).execute()
            print(f"[Supabase] Published → {sensor['feed_name']}: {value}")
            
        except Exception as e:
            print(f"[Supabase] Error publishing {sensor['feed_name']}: {e}")
        
        time.sleep(0.5)  # Small delay between inserts

def main():
    print("[Supabase Publisher] Starting secure WebSocket connection (wss:// on Port 443)...")
    print(f"[Supabase] URL: {SUPABASE_URL}")
    print("[Supabase] Table: sensor_logs")
    print("[Supabase] Schema: feed_name, value, created_at\n")
    
    try:
        while True:
            print(f"\n[{datetime.now().strftime('%H:%M:%S')}] Publishing sensor data...")
            publish_to_supabase()
            time.sleep(10)  # Publish every 10 seconds
            
    except KeyboardInterrupt:
        print("\n[Supabase Publisher] Stopped.")

if __name__ == "__main__":
    main()