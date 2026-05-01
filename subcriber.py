import paho.mqtt.client as mqtt
import sqlite3
from datetime import datetime

# ==========================================
# CREDENTIALS — update your AIO key here
# ==========================================
AIO_USERNAME = "Eyya"
AIO_KEY      = "your_new_aio_key_here"
TEMP_FEED    = f"{AIO_USERNAME}/feeds/san-lorenzo-temp"
HUM_FEED     = f"{AIO_USERNAME}/feeds/san-lorenzo-hum"

# ==========================================
# DATABASE SETUP
# ==========================================
def init_db():
    conn = sqlite3.connect("sensor_data.db")
    cursor = conn.cursor()
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS readings (
            id        INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp TEXT    NOT NULL,
            feed      TEXT    NOT NULL,
            value     REAL    NOT NULL
        )
    """)
    conn.commit()
    conn.close()
    print("[DB] Database ready.")

def save_reading(feed, value):
    conn = sqlite3.connect("sensor_data.db")
    cursor = conn.cursor()
    cursor.execute(
        "INSERT INTO readings (timestamp, feed, value) VALUES (?, ?, ?)",
        (datetime.now().strftime("%Y-%m-%d %H:%M:%S"), feed, value)
    )
    conn.commit()
    conn.close()
    print(f"[DB] Saved → {feed}: {value}")

# ==========================================
# MQTT CALLBACKS
# ==========================================
def on_connect(client, userdata, flags, rc):
    if rc == 0:
        print("[MQTT] Connected to Adafruit IO!")
        client.subscribe(TEMP_FEED)
        client.subscribe(HUM_FEED)
        print(f"[MQTT] Subscribed to temp and humidity feeds")
    else:
        reasons = {
            1: "Wrong protocol version",
            2: "Client ID rejected",
            3: "Broker unavailable",
            4: "Wrong username or password",
            5: "Not authorized",
        }
        print(f"[MQTT] Failed: {reasons.get(rc, f'Error code {rc}')}")

def on_message(client, userdata, msg):
    topic   = msg.topic
    payload = msg.payload.decode("utf-8").strip()
    print(f"[MQTT] Received → [{topic}] = {payload}")

    try:
        value = float(payload)
        save_reading(topic, value)
    except ValueError:
        print(f"[MQTT] Could not parse: {payload}")

def on_disconnect(client, userdata, rc):
    print(f"[MQTT] Disconnected (rc={rc})")

# ==========================================
# MAIN
# ==========================================
def main():
    init_db()

    client = mqtt.Client(client_id=f"python_sub_{datetime.now().timestamp()}")
    client.username_pw_set(AIO_USERNAME, AIO_KEY)
    client.tls_set()

    client.on_connect    = on_connect
    client.on_message    = on_message
    client.on_disconnect = on_disconnect

    print("[MQTT] Connecting to Adafruit IO...")
    client.connect("io.adafruit.com", port=8883, keepalive=60)

    try:
        client.loop_forever()
    except KeyboardInterrupt:
        print("\n[MQTT] Stopped.")
        client.disconnect()

if __name__ == "__main__":
    main()