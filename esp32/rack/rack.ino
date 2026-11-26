#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>

// Builder: edit these six settings, then upload.
const char* WIFI_SSID = "your-wifi";
const char* WIFI_PASS = "your-password";
const char* SERVER    = "http://192.168.1.10:3000";
const int NUM_SLOTS   = 4;
int LED_PINS[]        = {13, 12, 14, 27, 16, 17};
int BUTTON_PINS[]     = {26, 25, 33, 32, 18, 19};

String ledState[6];
int lastButton[6];
unsigned long lastDebounce[6];
unsigned long lastPoll = 0;
unsigned long lastBlink = 0;
unsigned long lastWifiTry = 0;
bool blinkOn = false;

void connectWifi() {
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  Serial.print("Connecting WiFi");
  unsigned long start = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - start < 15000) {
    delay(250);
    Serial.print(".");
  }
  Serial.println();
  if (WiFi.status() == WL_CONNECTED) {
    Serial.print("WiFi connected ");
    Serial.println(WiFi.localIP());
  } else {
    Serial.println("WiFi failed");
  }
}

void applyLeds() {
  if (millis() - lastBlink >= 300) {
    lastBlink = millis();
    blinkOn = !blinkOn;
  }
  for (int i = 0; i < NUM_SLOTS; i++) {
    bool on = ledState[i] == "on" || (ledState[i] == "blink" && blinkOn);
    digitalWrite(LED_PINS[i], on ? HIGH : LOW);
  }
}

void pollState() {
  if (WiFi.status() != WL_CONNECTED || millis() - lastPoll < 500) return;
  lastPoll = millis();
  HTTPClient http;
  http.begin(String(SERVER) + "/api/rack/state");
  http.setTimeout(800);
  int code = http.GET();
  if (code == 200) {
    JsonDocument doc;
    if (deserializeJson(doc, http.getString()) == DeserializationError::Ok) {
      for (JsonObject slot : doc["slots"].as<JsonArray>()) {
        int n = slot["slot"];
        if (n >= 1 && n <= NUM_SLOTS) ledState[n - 1] = slot["led"].as<String>();
      }
      Serial.println("Server OK");
    }
  } else {
    Serial.printf("State HTTP %d\n", code);
  }
  http.end();
}

void readButtons() {
  if (WiFi.status() != WL_CONNECTED) return;
  for (int i = 0; i < NUM_SLOTS; i++) {
    int reading = digitalRead(BUTTON_PINS[i]);
    if (reading == LOW && lastButton[i] == HIGH && millis() - lastDebounce[i] > 50) {
      lastDebounce[i] = millis();
      HTTPClient http;
      http.begin(String(SERVER) + "/api/rack/button");
      http.addHeader("Content-Type", "application/json");
      String body = "{\"slot\":" + String(i + 1) + "}";
      int code = http.POST(body);
      Serial.printf("Button slot %d -> %d %s\n", i + 1, code, http.getString().c_str());
      http.end();
    }
    lastButton[i] = reading;
  }
}

void setup() {
  Serial.begin(115200);
  pinMode(2, OUTPUT);
  for (int i = 0; i < NUM_SLOTS; i++) {
    pinMode(LED_PINS[i], OUTPUT);
    pinMode(BUTTON_PINS[i], INPUT_PULLUP);
    ledState[i] = "off";
    lastButton[i] = HIGH;
    digitalWrite(LED_PINS[i], HIGH);
  }
  delay(400);
  for (int i = 0; i < NUM_SLOTS; i++) digitalWrite(LED_PINS[i], LOW);
  connectWifi();
}

void loop() {
  if (WiFi.status() != WL_CONNECTED) {
    digitalWrite(2, (millis() / 150) % 2 ? HIGH : LOW);
    if (millis() - lastWifiTry > 5000) {
      lastWifiTry = millis();
      Serial.println("WiFi retry");
      WiFi.disconnect();
      WiFi.begin(WIFI_SSID, WIFI_PASS);
    }
    delay(20);
    return;
  }
  digitalWrite(2, LOW);
  pollState();
  applyLeds();
  readButtons();
}
