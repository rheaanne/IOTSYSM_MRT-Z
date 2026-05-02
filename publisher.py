import paho.mqtt.client as mqtt
import time
import random

AIO_USERNAME = "Eyya"
AIO_KEY      = "your_actual_aio_key_here"   # ← replace this

FEEDS = [
    "villamor-temp", "villamor-hum",
    "afpovai-temp",  "afpovai-hum",
    "san-lorenzo-temp", "san-lorenzo-hum",
    "better-living-temp", "better-living-hum",
]

def on_connect(client, userdata, flags, rc):
    if rc == 0:
        print("[MQTT] Connected to Adafruit IO!")
    else:
        reasons = {
            1: "Wrong protocol version",
            2: "Client ID rejected",
            3: "Broker unavailable",
            4: "Wrong username or password",
            5: "Not authorized",
        }
        print(f"[MQTT] Failed: {reasons.get(rc, f'Error code {rc}')}")

def on_publish(client, userdata, mid):
    print(f"[MQTT] Published message {mid}")

def main():
    # ↓ fix: CallbackAPIVersion.VERSION1 for paho-mqtt v2
    client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION1)
    client.username_pw_set(AIO_USERNAME, AIO_KEY)
    client.tls_set()

    client.on_connect = on_connect
    client.on_publish = on_publish

    print("[MQTT] Connecting to Adafruit IO...")
    client.connect("io.adafruit.com", port=8883, keepalive=60)
    client.loop_start()

    try:
        while True:
            for feed in FEEDS:
                topic = f"{AIO_USERNAME}/feeds/{feed}"
                value = round(random.uniform(20, 35), 1) if "temp" in feed \
                        else round(random.uniform(40, 80), 1)
                client.publish(topic, str(value))
                print(f"[TEST] Published to {feed}: {value}")
                time.sleep(1)
            time.sleep(10)

    except KeyboardInterrupt:
        print("\n[MQTT] Stopped.")
        client.loop_stop()
        client.disconnect()

if __name__ == "__main__":
    main()