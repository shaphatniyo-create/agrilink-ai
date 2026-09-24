"""Creates esp8266-agrilink-http.ino from esp8266-agrilink-full.ino.

The new firmware sends every sensor reading straight to the AgriLink API
(POST /api/v1/iot/ingest, authenticated with the device code + secret issued
when you register the device in the app) and takes the pump command (AUTO /
ON / OFF) from the API's reply. The public MQTT broker is switched off by
default (USE_MQTT = false). Your WiFi and Telegram settings are copied over
unchanged. The original .ino is not modified.

Run from backend/:  python make_http_firmware.py
"""
import pathlib, sys

src = pathlib.Path(__file__).with_name('esp8266-agrilink-full.ino')
dst = pathlib.Path(__file__).with_name('esp8266-agrilink-http.ino')
s = src.read_text(encoding='utf-8').replace('\r\n', '\n')


def sub(old, new, count=1):
    global s
    if old not in s:
        sys.exit(f'Pattern not found in firmware: {old[:60]!r}')
    s = s.replace(old, new, count)


CONFIG = '''
// ---------- AGRILINK APP (direct HTTP upload) ----------
// Register the device in the app (Sensors page > Add device) and paste the
// device code + secret it shows ONCE. Use your PC's LAN address while testing
// locally, or the Render API address once hosted:
//   local : "http://192.168.1.154:4000/api/v1/iot/ingest"
//   Render: "https://agrilink-api.onrender.com/api/v1/iot/ingest"
const char* AGRILINK_URL = "http://192.168.1.154:4000/api/v1/iot/ingest";
const char* DEVICE_CODE  = "PASTE-DEVICE-CODE-HERE";
const char* DEVICE_KEY   = "PASTE-DEVICE-SECRET-HERE";
// Optional fixed position of the probe (0,0 = not sent)
const float FARM_LAT = 0.0;
const float FARM_LNG = 0.0;
// Public MQTT broker (broker.hivemq.com) is open to anyone; keep off unless needed.
const bool  USE_MQTT = false;
'''

# 1. config block right after the MQTT config section
sub('const char* TOPIC_CTRL   = "soil/npk/control";\n',
    'const char* TOPIC_CTRL   = "soil/npk/control";\n' + CONFIG)

# 2. extra TLS client + state
sub('WiFiClientSecure telegramClient;\n',
    'WiFiClientSecure telegramClient;\nWiFiClientSecure agrilinkSecure;\nWiFiClient       agrilinkPlain;\nString           lastPumpCommand = "";\nunsigned long    lastUploadOkAt  = 0;\n')

UPLOAD = r'''
// =====================================================
// AGRILINK — upload reading, apply pump command from the app
// =====================================================
void applyPumpCommand(const String& cmd)
{
  if (cmd.length() == 0 || cmd == lastPumpCommand) return;   // only act on changes
  lastPumpCommand = cmd;
  Serial.print("App pump command: "); Serial.println(cmd);
  if (cmd == "AUTO")      { autoMode = true;  autoPump(); }
  else if (cmd == "ON")   { autoMode = false; pumpON();  }
  else if (cmd == "OFF")  { autoMode = false; pumpOFF(); }
}

void sendToAgriLink()
{
  if (WiFi.status() != WL_CONNECTED) return;
  if (!sensorOK) { Serial.println("AgriLink: sensor error, reading not uploaded"); return; }

  JsonDocument body;
  body["deviceCode"]    = DEVICE_CODE;
  body["apiKey"]        = DEVICE_KEY;
  body["moisturePct"]   = moisture;
  body["temperatureC"]  = temperature;
  body["ph"]            = ph;
  body["nitrogenPpm"]   = nitrogen;
  body["phosphorusPpm"] = phosphorus;
  body["potassiumPpm"]  = potassium;
  body["pumpState"]     = pump ? "ON" : "OFF";
  if (FARM_LAT != 0.0 || FARM_LNG != 0.0) { body["latitude"] = FARM_LAT; body["longitude"] = FARM_LNG; }
  String payload;
  serializeJson(body, payload);

  HTTPClient http;
  bool ok;
  if (String(AGRILINK_URL).startsWith("https")) {
    agrilinkSecure.setInsecure();
    ok = http.begin(agrilinkSecure, AGRILINK_URL);
  } else {
    ok = http.begin(agrilinkPlain, AGRILINK_URL);
  }
  if (!ok) { Serial.println("AgriLink: cannot open connection"); return; }
  http.setTimeout(15000);   // Render free plan can take ~1 min to wake; later uploads succeed
  http.addHeader("Content-Type", "application/json");

  int code = http.POST(payload);
  Serial.print("AgriLink upload HTTP = "); Serial.println(code);
  if (code == 200 || code == 201) {
    lastUploadOkAt = millis();
    // Only keep the field we need from the reply
    JsonDocument filter;  filter["pumpCommand"] = true;
    JsonDocument reply;
    if (!deserializeJson(reply, http.getStream(), DeserializationOption::Filter(filter))) {
      const char* cmd = reply["pumpCommand"] | "";
      applyPumpCommand(String(cmd));
    }
  } else if (code == 401 || code == 403) {
    Serial.println("AgriLink: device code/secret rejected - re-check DEVICE_CODE / DEVICE_KEY");
  }
  http.end();
}
'''

# 3. upload function before the Telegram section
sub('// =====================================================\n// TELEGRAM — send message',
    UPLOAD + '\n// =====================================================\n// TELEGRAM — send message')

# 4. setup: MQTT only when enabled
sub('  mqttClient.setServer(MQTT_SERVER, MQTT_PORT);\n  mqttClient.setCallback(mqttCallback);\n  mqttReconnect();\n',
    '  if (USE_MQTT) {\n    mqttClient.setServer(MQTT_SERVER, MQTT_PORT);\n    mqttClient.setCallback(mqttCallback);\n    mqttReconnect();\n  }\n')

# 5. loop: MQTT keep-alive only when enabled; upload right after each sensor read
sub('  // Keep MQTT alive\n  if (!mqttClient.connected()) mqttReconnect();\n  mqttClient.loop();\n',
    '  // Keep MQTT alive (optional)\n  if (USE_MQTT) {\n    if (!mqttClient.connected()) mqttReconnect();\n    mqttClient.loop();\n  }\n')
sub('    readSensor();\n    autoPump();\n  }\n',
    '    readSensor();\n    autoPump();\n    sendToAgriLink();   // every SENSOR_INTERVAL (10 s)\n  }\n')
sub('  if (millis() - lastMQTT >= MQTT_INTERVAL)\n',
    '  if (USE_MQTT && millis() - lastMQTT >= MQTT_INTERVAL)\n')

# 6. any remaining publishMQTT() call in setup
if s.count('  publishMQTT();\n') >= 1:
    s = s.replace('  publishMQTT();\n', '  if (USE_MQTT) publishMQTT();\n')

dst.write_text(s.replace('\n', '\r\n'), encoding='utf-8')
print('Wrote', dst.name)
