#include <ESP8266WiFi.h>
#include <WiFiClientSecure.h>
#include <ESP8266HTTPClient.h>
#include <SoftwareSerial.h>
#include <ModbusMaster.h>
#include <ArduinoJson.h>
#include <PubSubClient.h>

// ---------- WIFI ----------
const char* SSID = "YOUR-WIFI-NAME";
const char* PASS = "YOUR-WIFI-PASSWORD";

// ---------- TELEGRAM ----------
const char* BOT_TOKEN = "YOUR-TELEGRAM-BOT-TOKEN";
const int64_t CHAT_ID = 0;

// ---------- MQTT (AgriLink Dashboard) ----------
const char* MQTT_SERVER  = "broker.hivemq.com";
const int   MQTT_PORT    = 1883;
const char* DEVICE_ID    = "FARM-001";
const char* TOPIC_DATA   = "soil/npk/data";
const char* TOPIC_CTRL   = "soil/npk/control";

// ---------- AGRILINK APP (direct HTTP upload) ----------
// Register the device in the app (Sensors page > Add device) and paste the
// device code + secret it shows ONCE. Use your PC's LAN address while testing
// locally, or the Render API address once hosted:
//   local : "http://192.168.1.154:4000/api/v1/iot/ingest"
//   Render: "https://agrilink-api.onrender.com/api/v1/iot/ingest"
const char* AGRILINK_URL = "http://192.168.1.100:4000/api/v1/iot/ingest";
const char* DEVICE_CODE  = "PASTE-DEVICE-CODE-HERE";
const char* DEVICE_KEY   = "PASTE-DEVICE-SECRET-HERE";
// Optional fixed position of the probe (0,0 = not sent)
const float FARM_LAT = 0.0;
const float FARM_LNG = 0.0;
// Public MQTT broker (broker.hivemq.com) is open to anyone; keep off unless needed.
const bool  USE_MQTT = false;

// ---------- PINS ----------
#define RELAY_PIN   D3
#define RE_DE_PIN   D5
#define RS485_RX    D6
#define RS485_TX    D7

// ---------- NPK SENSOR ----------
#define SLAVE_ID    1
#define MODBUS_BAUD 4800

// ---------- OBJECTS ----------
SoftwareSerial  rs485(RS485_RX, RS485_TX);
ModbusMaster    node;
WiFiClientSecure telegramClient;
WiFiClientSecure agrilinkSecure;
WiFiClient       agrilinkPlain;
String           lastPumpCommand = "";
unsigned long    lastUploadOkAt  = 0;
WiFiClient       mqttWifiClient;
PubSubClient     mqttClient(mqttWifiClient);

// ---------- SENSOR DATA ----------
float    moisture    = 0;
float    temperature = 0;
float    ph          = 0;
uint16_t ec          = 0;
uint16_t nitrogen    = 0;
uint16_t phosphorus  = 0;
uint16_t potassium   = 0;
bool     sensorOK    = false;
uint8_t  modbusError = 0;

// ---------- PUMP ----------
bool  pump         = false;
bool  autoMode     = true;
float startMoisture = 30.0;
float stopMoisture  = 60.0;

// ---------- TIMERS ----------
unsigned long lastSensor   = 0;
unsigned long lastTelegram = 0;
unsigned long lastMQTT     = 0;

const unsigned long SENSOR_INTERVAL   = 10000;
const unsigned long TELEGRAM_INTERVAL = 1500;
const unsigned long MQTT_INTERVAL     = 2000;   // publish to dashboard every 2s

long updateOffset = 0;

// =====================================================
// RS485 direction control
// =====================================================
void preTransmission()  { digitalWrite(RE_DE_PIN, HIGH); delay(2); }
void postTransmission() { delay(2); digitalWrite(RE_DE_PIN, LOW);  }

// =====================================================
// PUMP
// =====================================================
void pumpON()  { digitalWrite(RELAY_PIN, LOW);  pump = true;  Serial.println("PUMP = ON");  }
void pumpOFF() { digitalWrite(RELAY_PIN, HIGH); pump = false; Serial.println("PUMP = OFF"); }

// =====================================================
// READ NPK SENSOR
// =====================================================
void readSensor()
{
  Serial.println("\n==============================");
  Serial.println("READING NPK SENSOR");
  Serial.println("==============================");

  digitalWrite(RE_DE_PIN, LOW);
  delay(20);

  uint8_t result = node.readHoldingRegisters(0x0000, 7);
  modbusError = result;
  Serial.print("Modbus result = 0x");
  Serial.println(result, HEX);

  if (result == node.ku8MBSuccess)
  {
    moisture    = node.getResponseBuffer(0) / 10.0;
    temperature = node.getResponseBuffer(1) / 10.0;
    ec          = node.getResponseBuffer(2);
    ph          = node.getResponseBuffer(3) / 10.0;
    nitrogen    = node.getResponseBuffer(4);
    phosphorus  = node.getResponseBuffer(5);
    potassium   = node.getResponseBuffer(6);
    sensorOK    = true;

    Serial.println("NPK SENSOR = OK");
    Serial.print("Moisture: ");    Serial.print(moisture);    Serial.println(" %");
    Serial.print("Temperature: "); Serial.print(temperature); Serial.println(" C");
    Serial.print("EC: ");          Serial.println(ec);
    Serial.print("pH: ");          Serial.println(ph);
    Serial.print("Nitrogen: ");    Serial.println(nitrogen);
    Serial.print("Phosphorus: ");  Serial.println(phosphorus);
    Serial.print("Potassium: ");   Serial.println(potassium);
  }
  else
  {
    sensorOK = false;
    Serial.println("NPK SENSOR ERROR");
    if (result == node.ku8MBResponseTimedOut)
      Serial.println("TIMEOUT: Check A/B wiring, power, baud rate and slave ID.");
    else if (result == node.ku8MBIllegalFunction)
      Serial.println("ILLEGAL FUNCTION");
    else if (result == node.ku8MBIllegalDataAddress)
      Serial.println("ILLEGAL REGISTER ADDRESS");
    else
      Serial.println("Check sensor configuration.");
    pumpOFF();
  }
}

// =====================================================
// AUTO PUMP
// =====================================================
void autoPump()
{
  if (!autoMode || !sensorOK) { pumpOFF(); return; }
  if (moisture <= startMoisture && !pump) pumpON();
  if (moisture >= stopMoisture  &&  pump) pumpOFF();
}

// =====================================================
// MQTT — reconnect
// =====================================================
void mqttReconnect()
{
  if (mqttClient.connected()) return;
  Serial.print("MQTT connecting...");
  String clientId = "agrilink-";
  clientId += String(ESP.getChipId(), HEX);
  if (mqttClient.connect(clientId.c_str()))
  {
    Serial.println("connected");
    mqttClient.subscribe(TOPIC_CTRL);
  }
  else
  {
    Serial.print("failed rc=");
    Serial.println(mqttClient.state());
  }
}

// =====================================================
// MQTT — incoming control messages from dashboard
// =====================================================
void mqttCallback(char* topic, byte* payload, unsigned int length)
{
  String msg = "";
  for (unsigned int i = 0; i < length; i++) msg += (char)payload[i];
  Serial.print("MQTT ctrl: "); Serial.println(msg);

  if (msg == "AUTO")               { autoMode = true;  autoPump(); }
  else if (msg == "MANUAL")        { autoMode = false; }
  else if (msg == "PUMP_ON")       { if (!autoMode) pumpON(); }
  else if (msg == "PUMP_OFF")      { if (!autoMode) pumpOFF(); }
}

// =====================================================
// MQTT — publish sensor reading to AgriLink dashboard
// =====================================================
void publishMQTT()
{
  if (WiFi.status() != WL_CONNECTED) return;
  if (!mqttClient.connected()) mqttReconnect();
  if (!mqttClient.connected()) return;

  // Build JSON payload that mqtt-bridge understands
  char buf[256];
  snprintf(buf, sizeof(buf),
    "{\"deviceId\":\"%s\","
    "\"moisture\":%.1f,"
    "\"temperature\":%.1f,"
    "\"ph\":%.1f,"
    "\"ec\":%u,"
    "\"nitrogen\":%u,"
    "\"phosphorus\":%u,"
    "\"potassium\":%u,"
    "\"pump\":%s,"
    "\"mode\":\"%s\","
    "\"startThreshold\":%.1f,"
    "\"stopThreshold\":%.1f,"
    "\"sensorOk\":%s,"
    "\"modbus\":%u}",
    DEVICE_ID,
    moisture, temperature, ph,
    ec, nitrogen, phosphorus, potassium,
    pump ? "true" : "false",
    autoMode ? "AUTO" : "MANUAL",
    startMoisture, stopMoisture,
    sensorOK ? "true" : "false",
    modbusError
  );

  mqttClient.publish(TOPIC_DATA, buf);
  Serial.println("MQTT published");
}


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

// =====================================================
// TELEGRAM — send message
// =====================================================
bool sendTelegram(String message)
{
  if (WiFi.status() != WL_CONNECTED) return false;
  telegramClient.setInsecure();
  HTTPClient https;
  String url = "https://api.telegram.org/bot";
  url += BOT_TOKEN;
  url += "/sendMessage";
  if (!https.begin(telegramClient, url)) return false;
  https.setTimeout(4000);
  https.addHeader("Content-Type", "application/json");
  JsonDocument doc;
  doc["chat_id"] = CHAT_ID;
  doc["text"]    = message;
  String body;
  serializeJson(doc, body);
  int code = https.POST(body);
  Serial.print("Telegram HTTP = "); Serial.println(code);
  https.end();
  return code >= 200 && code < 300;
}

// =====================================================
// STATUS MESSAGE
// =====================================================
String getStatus()
{
  String s = "SMART SOIL FARM\n\n";
  s += "Moisture: ";    s += String(moisture, 1);    s += " %\n";
  s += "Temperature: "; s += String(temperature, 1); s += " C\n";
  s += "pH: ";          s += String(ph, 1);          s += "\n";
  s += "EC: ";          s += String(ec);              s += "\n";
  s += "Nitrogen: ";    s += String(nitrogen);        s += "\n";
  s += "Phosphorus: ";  s += String(phosphorus);      s += "\n";
  s += "Potassium: ";   s += String(potassium);       s += "\n\n";
  s += "Pump: ";        s += pump ? "ON\n" : "OFF\n";
  s += "Mode: ";        s += autoMode ? "AUTO\n" : "MANUAL\n";
  s += "Start: ";       s += String(startMoisture, 1); s += " %\n";
  s += "Stop: ";        s += String(stopMoisture, 1);  s += " %\n";
  s += "Sensor: ";      s += sensorOK ? "OK" : "ERROR";
  return s;
}

// =====================================================
// TELEGRAM COMMAND HANDLER
// =====================================================
void processCommand(String command)
{
  command.trim();
  command.toLowerCase();
  Serial.print("COMMAND: "); Serial.println(command);

  if (command == "/status" || command == "status")         { sendTelegram(getStatus()); return; }
  if (command == "/help"   || command == "/start" || command == "help")
  {
    sendTelegram("SMART SOIL CONTROL\n\n/status\n/auto\n/manual\n/pump_on\n/pump_off\n/threshold 30 60");
    return;
  }
  if (command == "/auto"   || command == "auto")           { autoMode = true;  autoPump(); sendTelegram("AUTO MODE ENABLED\n\n" + getStatus()); return; }
  if (command == "/manual" || command == "manual")         { autoMode = false; sendTelegram("MANUAL MODE ENABLED\n\n" + getStatus()); return; }
  if (command == "/pump_on"  || command == "pump on")
  {
    if (!autoMode) { pumpON();  sendTelegram("PUMP TURNED ON\n\n"  + getStatus()); }
    else           { sendTelegram("Pump ON refused.\n\nUse /manual first."); }
    return;
  }
  if (command == "/pump_off" || command == "pump off")
  {
    if (!autoMode) { pumpOFF(); sendTelegram("PUMP TURNED OFF\n\n" + getStatus()); }
    else           { sendTelegram("Pump OFF refused.\n\nUse /manual first."); }
    return;
  }
  if (command.startsWith("/threshold"))
  {
    int sp1 = command.indexOf(' ');
    if (sp1 < 0) { sendTelegram("Usage:\n/threshold 30 60"); return; }
    String vals = command.substring(sp1 + 1);
    int sp2 = vals.indexOf(' ');
    if (sp2 < 0) { sendTelegram("Usage:\n/threshold 30 60"); return; }
    float st = vals.substring(0, sp2).toFloat();
    float sp = vals.substring(sp2 + 1).toFloat();
    if (st < 0 || st > 100 || sp < 0 || sp > 100 || st >= sp) { sendTelegram("Invalid threshold.\n\nExample:\n/threshold 30 60"); return; }
    startMoisture = st; stopMoisture = sp;
    autoPump();
    sendTelegram("THRESHOLD UPDATED\n\n" + getStatus());
    return;
  }
  sendTelegram("Unknown command.\n\nUse /help");
}

// =====================================================
// CHECK TELEGRAM UPDATES
// =====================================================
void checkTelegram()
{
  if (WiFi.status() != WL_CONNECTED) return;
  if (millis() - lastTelegram < TELEGRAM_INTERVAL) return;
  lastTelegram = millis();

  telegramClient.setInsecure();
  HTTPClient https;
  String url = "https://api.telegram.org/bot";
  url += BOT_TOKEN;
  url += "/getUpdates?offset=";
  url += String(updateOffset);
  url += "&limit=5&timeout=0";
  if (!https.begin(telegramClient, url)) return;
  https.setTimeout(4000);
  int code = https.GET();
  if (code != 200) { Serial.print("Telegram GET error: "); Serial.println(code); https.end(); return; }
  String response = https.getString();
  https.end();

  JsonDocument doc;
  if (deserializeJson(doc, response)) { Serial.println("Telegram JSON error"); return; }

  for (JsonObject upd : doc["result"].as<JsonArray>())
  {
    long uid = upd["update_id"];
    updateOffset = uid + 1;
    JsonObject msg = upd["message"];
    if (msg.isNull()) continue;
    int64_t cid = msg["chat"]["id"] | (int64_t)0;
    if (cid != CHAT_ID) { Serial.println("Unauthorized Telegram user"); continue; }
    String text = msg["text"] | "";
    text.trim();
    if (text.length() > 0) processCommand(text);
    yield();
  }
}

// =====================================================
// WIFI
// =====================================================
void connectWiFi()
{
  Serial.println("\nConnecting WiFi...");
  WiFi.mode(WIFI_STA);
  WiFi.begin(SSID, PASS);
  unsigned long start = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - start < 20000)
  { delay(300); Serial.print("."); }
  Serial.println();
  if (WiFi.status() == WL_CONNECTED)
  { Serial.println("WiFi CONNECTED"); Serial.print("IP: "); Serial.println(WiFi.localIP()); }
  else
  { Serial.println("WiFi FAILED"); }
}

// =====================================================
// SETUP
// =====================================================
void setup()
{
  Serial.begin(115200);
  delay(1000);
  Serial.println("\n==============================");
  Serial.println(" SMART SOIL NPK SYSTEM");
  Serial.println(" ESP8266 + RS485 + TELEGRAM + MQTT");
  Serial.println("==============================");

  // Relay OFF
  pinMode(RELAY_PIN, OUTPUT);
  digitalWrite(RELAY_PIN, HIGH);
  pump = false;

  // RS485
  pinMode(RE_DE_PIN, OUTPUT);
  digitalWrite(RE_DE_PIN, LOW);
  rs485.begin(MODBUS_BAUD);
  node.begin(SLAVE_ID, rs485);
  node.preTransmission(preTransmission);
  node.postTransmission(postTransmission);
  Serial.println("RS485 initialized");

  // WiFi
  connectWiFi();

  // MQTT
  if (USE_MQTT) {
    mqttClient.setServer(MQTT_SERVER, MQTT_PORT);
    mqttClient.setCallback(mqttCallback);
    mqttReconnect();
  }

  // First sensor read
  delay(500);
  readSensor();
  autoPump();

  // Announce
  sendTelegram("SMART SOIL SYSTEM ONLINE\n\n" + getStatus());
  if (USE_MQTT) publishMQTT();

  Serial.println("\nSYSTEM READY");
}

// =====================================================
// LOOP
// =====================================================
void loop()
{
  // Keep MQTT alive (optional)
  if (USE_MQTT) {
    if (!mqttClient.connected()) mqttReconnect();
    mqttClient.loop();
  }

  // Telegram polling
  checkTelegram();

  // Sensor read every SENSOR_INTERVAL
  if (millis() - lastSensor >= SENSOR_INTERVAL)
  {
    lastSensor = millis();
    readSensor();
    autoPump();
    sendToAgriLink();   // every SENSOR_INTERVAL (10 s)
  }

  // Publish to AgriLink dashboard every MQTT_INTERVAL (2s)
  if (USE_MQTT && millis() - lastMQTT >= MQTT_INTERVAL)
  {
    lastMQTT = millis();
    if (USE_MQTT) publishMQTT();
  }

  yield();
}
