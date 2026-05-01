# Adafruit IO MQTT Subscriber

A browser-based MQTT subscriber that connects to Adafruit IO and displays real-time temperature and humidity data. Built with vanilla JavaScript and MQTT.js for use with GitHub Pages.

## Features

- **Secure WebSocket Connection**: Uses WSS to connect to Adafruit IO MQTT broker
- **Real-time Data**: Live temperature and humidity updates
- **User Authentication**: Enter your Adafruit IO username and AIO key
- **Customizable Feeds**: Configure which feed keys to subscribe to
- **Data History**: Shows recent sensor readings
- **Auto-reconnect**: Automatically reconnects if connection drops
- **Local Storage**: Saves credentials for convenience
- **Debug Console**: Detailed logs with copy-to-clipboard
- **Multi-URL Fallback**: Tries several broker addresses automatically
- **Data Monitor**: Alerts if no data received within 30 seconds
- **Subscription Display**: Shows exact MQTT topics you're subscribed to

## Quick Start

### 1. Verify Your Arduino is Publishing

**This is the most common issue.** Before using the web app, confirm your Arduino is successfully sending data to Adafruit IO.

**Check in this order:**

1. **Open Serial Monitor** in Arduino IDE (Ctrl+Shift+M) at 115200 baud
2. Look for messages like:
   ```
   Connected to WiFi
   Connected to MQTT broker!
   Temperature: 25.5 sent
   Humidity: 60.0 sent
   ```
3. **Visit Adafruit IO** (https://io.adafruit.com) → **Feeds** → your feed
4. Confirm you see live data updating in the chart

**If Arduino isn't connecting:**
- Check WiFi credentials
- Verify AIO key/username match Adafruit IO exactly
- Ensure you called `mqtt.connect()` and checked `mqtt.connected()`
- Look for error messages in Serial Monitor

**Expected Arduino MQTT Topics:**
```
<your-username>/feeds/temperature
<your-username>/feeds/humidity
```

Example working Arduino code:
```cpp
#include <WiFi.h>
#include <Adafruit_MQTT.h>
#include <Adafruit_MQTT_Client.h>

#define WIFI_SSID       "your_wifi"
#define WIFI_PASS       "your_password"
#define AIO_USERNAME    "your_username"
#define AIO_KEY         "your_aio_key"

WiFiClient client;
Adafruit_MQTT_Client mqtt(&client, "io.adafruit.com", 1883, AIO_USERNAME, AIO_KEY);
Adafruit_MQTT_Publish tempFeed = Adafruit_MQTT_Publish(&mqtt, AIO_USERNAME "/feeds/temperature");
Adafruit_MQTT_Publish humFeed = Adafruit_MQTT_Publish(&mqtt, AIO_USERNAME "/feeds/humidity");

void setup() {
  Serial.begin(115200);
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  while (WiFi.status() != WL_CONNECTED) {
    delay(1000);
    Serial.println("Connecting to WiFi...");
  }
  Serial.println("WiFi connected");
  
  // Connect to Adafruit IO MQTT
  while (!mqtt.connect()) {
    Serial.println("MQTT reconnecting...");
    delay(5000);
  }
  Serial.println("Connected to Adafruit IO MQTT!");
  
  // Publish test values
  tempFeed.publish(25.5);
  humFeed.publish(60.0);
}

void loop() {
  mqtt.parsePackets(1000);
  // Publish sensor readings periodically...
}
```

### 2. Open the Web App

For local testing, use a local server (not `file://`):
```bash
# Python 3
python -m http.server 8000

# Or Node.js
npx serve
```
Then open `http://localhost:8000`

For production, deploy to GitHub Pages (see below).

### 3. Enter Your Credentials

- **Adafruit IO Username**: Exact username (case-sensitive)
- **Adafruit IO Key**: Full key starting with `aio_` (from Adafruit IO → My Apps → View AIO Key)
- **Temperature Feed Key**: Usually `temperature` (change if your Arduino uses different name)
- **Humidity Feed Key**: Usually `humidity`

**Important:** Feed keys must exactly match what your Arduino uses. If Arduino publishes to `"temp"` instead of `"temperature"`, enter `temp` in the form.

### 4. Click Connect

Watch the **Debug Log** panel:
- ✅ Green checkmarks mean success
- ❌ Red errors show what failed
- The **Subscription Info** box shows the exact MQTT topics you're listening to

When data arrives:
- Temperature and humidity values update live
- History table fills with recent readings
- "Last update" timestamp refreshes

## Deploy to GitHub Pages

1. Create a GitHub repository
2. Add all files: `index.html`, `style.css`, `app.js`, `README.md`
3. Settings → Pages → Source: `main` branch, `/root` folder
4. Save → site publishes at `https://<username>.github.io/<repo>/`

## Understanding the Debug Log

The debug console tells you exactly what's happening:

```
🔗 Attempt 1/4: wss://io.adafruit.com:8080/mqtt  ← Trying broker
✅ Connected via: wss://io.adafruit.com:8080/mqtt  ← Success!
📡 Topics: username/feeds/temperature, username/feeds/humidity
✅ Subscribed to temperature
✅ Subscribed to humidity
📨 [username/feeds/temperature] = 25.5           ← Data arrived!
✅ First data packet received!
```

If connection fails:
```
❌ All broker URLs failed
❌ Connection failed: Connection timeout
🔧 TROUBLESHOOTING:
1. Check network - is port 8080 blocked?
2. Try a different network (mobile hotspot)
3. Disable VPN/Firewall temporarily
📋 Expected MQTT Topics:
   Temperature: username/feeds/temperature
   Humidity: username/feeds/humidity
```

**Copy the log** with the **📋 Copy** button and share it when asking for help (redact your AIO key!).

## Common Issues & Fixes

### 🔴 "Connection failed: timeout"
**Cause:** Network blocks WebSocket port 8080 or credentials wrong  
**Fix:**
- Try mobile hotspot (bypasses corporate firewall)
- Double-check username/AIO key
- Verify Adafruit IO is up: https://io.adafruit.com/status

### 🔴 "Not authorized" error
**Cause:** Wrong credentials or feed doesn't exist  
**Fix:**
1. Log into Adafruit IO → My Apps → copy fresh AIO key
2. Go to Feeds → verify feed names exist exactly
3. If feeds missing, create them or adjust web form feed keys

### 🔴 Connected but no data ever arrives
**Cause:** Feed name mismatch OR Arduino not actually publishing  
**Fix:**
1. Check the **Subscription Info** box on dashboard - note the exact topics
2. Compare with your Arduino code's `AIO_USERNAME "/feeds/..."` strings
3. They must match **exactly** (including case)
4. Verify Arduino Serial Monitor shows "sent" messages
5. Check Adafruit IO website - do you see data there?
   - If yes → wrong feed keys in web app
   - If no → Arduino publishing issue

### 🔴 Page refreshes when clicking Connect
**Fixed in v2.0** - if still happening, JavaScript may be blocked. Ensure:
- Browser allows JavaScript
- No extensions blocking scripts
- MQTT.js CDN loaded (check Network tab in DevTools)

### 🔴 Debug console is empty
- Check browser console (F12) for JavaScript errors
- Ensure MQTT.js CDN is accessible
- Try hard refresh (Ctrl+F5)

## Architecture

```
┌─────────────┐     WebSocket (WSS)     ┌──────────────────┐
│   Browser   │ ───────────────────────▶ │ Adafruit IO      │
│   (app.js)  │   wss://io.adafruit.com │ MQTT Broker      │
│             │ ◀─────────────────────── │                  │
│  MQTT.js    │      MQTT Messages      │   Feeds:         │
│  Client     │                          │   temperature    │
│             │                          │   humidity       │
└─────────────┘                          └──────────────────┘
       │
       ▼
┌─────────────────────┐
│   Arduino/ESP32     │
│   (publishes to     │
│    same topics)     │
└─────────────────────┘
```

## File Structure

```
.
├── index.html      # UI: login + dashboard
├── style.css       # Green theme, animations, responsive
├── app.js          # MQTT logic, debug console, data handling
└── README.md       # This file
```

## Security Notes

- AIO key stored in `localStorage` (browser only, not sent anywhere else)
- Connection is direct to Adafruit IO (no intermediate server)
- For production, consider rotating keys regularly
- Use read-only keys if you only need to subscribe (not publish)

## Need Help?

1. Check the **Debug Log** in the app - it's very detailed
2. Copy the log (📋 Copy button) and remove your AIO key
3. Create a GitHub issue with:
   - Debug log
   - Arduino publishing code snippet
   - Screenshot of your Adafruit IO feed names

---

**Note:** This subscriber connects directly to Adafruit IO via WebSockets. No backend server required. Works on GitHub Pages.
