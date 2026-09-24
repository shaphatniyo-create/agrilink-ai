# ESP32 field sensor integration

Connects an ESP32 with a GSM module (e.g. SIM800L/SIM7000) or WiFi, an NPK
multi-parameter soil probe (RS485/Modbus, typical of cheap Chinese soil
sensors), and a DC irrigation pump (switched via a relay) to the AgriLink AI
platform. The ESP32 pushes readings; the platform never pushes commands to
the pump in this version -- it only displays what the device reports and
raises alerts. Remote pump control is a natural next step once this baseline
is proven out on real hardware.

## 1. Register a device

From the farmer (or admin) dashboard, open **Field sensors (soil & pump)**
and click **Add sensor**. This calls:

```
POST /iot/devices
Authorization: Bearer <your normal login token>
{ "farmId": "<the farm this sensor belongs to>", "label": "North field" }
```

The response includes a `deviceCode` (e.g. `IOT-A1B2C3D4`) and an `apiKey`.
**The `apiKey` is shown exactly once** -- copy both values into the ESP32's
firmware/config before leaving the page. There's no way to retrieve the key
again; if you lose it, deactivate the device and register a new one.

## 2. Ingest endpoint

The device itself does not log in as a user. It authenticates every push
with its own `deviceCode` + `apiKey`, checked in `IotService#ingest`
(no JWT involved):

```
POST https://<your-backend-host>/api/v1/iot/ingest
Content-Type: application/json

{
  "deviceCode": "IOT-A1B2C3D4",
  "apiKey": "<the secret from step 1>",
  "moisturePct": 42.5,
  "temperatureC": 23.1,
  "ph": 6.2,
  "nitrogenPpm": 38,
  "phosphorusPpm": 22,
  "potassiumPpm": 30,
  "pumpState": "OFF"
}
```

All sensor fields are optional -- send whatever your probe actually read
that cycle (e.g. omit `ph` if your probe doesn't measure it). `pumpState` is
`"ON"` or `"OFF"`, read from whatever GPIO pin/relay drives the DC pump.

The response echoes the stored reading and any new alerts it triggered
(e.g. `LOW_MOISTURE`), based on the default thresholds in
`backend/src/iot/knowledge/soil-thresholds.ts`.

## 3. Minimal ESP32 sketch (WiFi)

```cpp
#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>

const char* WIFI_SSID = "your-wifi";
const char* WIFI_PASSWORD = "your-password";
const char* INGEST_URL = "https://<your-backend-host>/api/v1/iot/ingest";
const char* DEVICE_CODE = "IOT-A1B2C3D4";
const char* API_KEY = "<the secret from step 1>";
const int PUMP_RELAY_PIN = 26;

void setup() {
  Serial.begin(115200);
  pinMode(PUMP_RELAY_PIN, OUTPUT);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  while (WiFi.status() != WL_CONNECTED) { delay(500); }
}

void loop() {
  // Replace these with real reads from your NPK probe (typically RS485/
  // Modbus -- use a library such as ModbusMaster over a MAX485 module).
  float moisture = readMoisture();
  float temperature = readTemperature();
  float ph = readPh();
  float n = readNitrogen(), p = readPhosphorus(), k = readPotassium();
  bool pumpOn = digitalRead(PUMP_RELAY_PIN) == HIGH;

  StaticJsonDocument<512> doc;
  doc["deviceCode"] = DEVICE_CODE;
  doc["apiKey"] = API_KEY;
  doc["moisturePct"] = moisture;
  doc["temperatureC"] = temperature;
  doc["ph"] = ph;
  doc["nitrogenPpm"] = n;
  doc["phosphorusPpm"] = p;
  doc["potassiumPpm"] = k;
  doc["pumpState"] = pumpOn ? "ON" : "OFF";
  String body;
  serializeJson(doc, body);

  HTTPClient http;
  http.begin(INGEST_URL);
  http.addHeader("Content-Type", "application/json");
  int status = http.POST(body);
  Serial.printf("ingest status: %d\n", status);
  http.end();

  delay(10 * 60 * 1000); // every 10 minutes -- tune to battery/data budget
}
```

## 4. GSM instead of WiFi

If the field site has no WiFi, replace the `WiFi.h`/`HTTPClient.h` calls with
a GSM modem library (e.g. **TinyGSM** for a SIM800L/SIM7000) that opens a
GPRS/LTE-M data session and performs the same HTTPS POST over the cellular
connection. The JSON payload and endpoint are identical -- only the
transport changes; the backend has no idea (or need to know) whether the
request arrived over WiFi or a SIM card's data plan. A typical structure:

```cpp
#include <TinyGsmClient.h>
// ... configure modem, APN, TinyGsmClientSecure for HTTPS ...
// then use TinyGsmClient/HttpClient exactly as you would WiFiClient.
```

Exact AT-command timing, APN, and power-sequencing depend on your specific
GSM module and SIM card carrier -- consult your module's datasheet and the
TinyGSM examples for your chipset.

## 5. What the platform does with this

- The Plant Doctor/dashboard shows the **latest reading per device** plus
  the pump's last-reported state, refreshed whenever the dashboard is open.
- If a reading breaches a default threshold (soil moisture, pH, N/P/K -- see
  `soil-thresholds.ts`), an alert appears on the farmer's (and admin's)
  dashboard automatically. A later normal reading auto-resolves it.
- If a device goes quiet for more than 6 hours, a `DEVICE_OFFLINE` alert is
  raised the next time anyone opens the dashboard (checked lazily, no
  background job needed) -- worth checking SIM balance/signal/power first.
- Nothing here sends commands back to the pump. If you want the dashboard to
  be able to switch the pump remotely, that needs a command-polling or
  push-notification channel added to `IotService` -- flagged here as a
  clearly scoped future addition, not built yet.
