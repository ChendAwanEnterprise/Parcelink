# Smart Parcel Sorting Rack (SPSR) — Development Plan

**Version:** 1.0  
**Date:** 26 November 2026  
**Owner:** System developer  
**Duration:** 6 weeks (26 Nov 2026 – 6 Jan 2027)  
**Delivery:** one zip, `SmartParcelRack_v1.0_2026-12.zip`

This plan covers the software side of SPSR. A separate prototype builder builds and wires the physical rack from the handover package. There is no contact with the builder during development, so every interface is decided here and frozen before hardware work starts.

---

## 1. What we are building

SPSR is an office parcel rack with numbered slots. Each slot has one LED and one button.

1. A courier submits a parcel. The system assigns the lowest empty slot and lights that LED solid.
2. The courier places the parcel and presses the button. The parcel is stored and the receiver gets a 4-digit pickup code.
3. The receiver enters Employee ID + code. That slot blinks.
4. The receiver takes the parcel and presses the button. The slot goes empty.

Everything runs on one laptop. No cloud, no hosting, no internet. Phones, the laptop, and the ESP32 share a local WiFi network (phone hotspot or pocket router). The database is one SQLite file in the project folder.

### In scope (system developer)

- Backend server and database
- Courier Portal, Receiver Portal, Admin Dashboard
- Rack Simulator and Hardware Test page
- ESP32 Arduino sketch, ready to upload
- `HANDOVER.md` (wiring, setup, troubleshooting) and the Client User Guide
- Zero-install `Parcel Rack.exe`, desktop start, QR code, wiring diagram

### Out of scope (prototype builder)

- Physical rack (foam board or cardboard, 4 to 6 compartments)
- Wiring LEDs, resistors, and buttons using the pin map
- Uploading the sketch and running the hardware checks

---

## 2. Roles and handover rules

| Role | Builds | Hands over / receives |
| --- | --- | --- |
| System developer | Server, database, web pages, simulator, test page, ESP32 sketch, guides | One zip folder |
| Prototype builder | Physical rack and wiring | The zip; follows `HANDOVER.md` |

Three rules make a no-contact handover work:

1. **The ESP32 is a thin client.** It never decides anything. It reads LED states and reports button presses. All logic lives on the server.
2. **Hardware details are settings.** WiFi name, server IP, slot count, and pin numbers sit at the top of the sketch and in `config.json`.
3. **The simulator uses the same API as the ESP32.** If the full flow works on the simulator, it works on the real rack.

---

## 3. Architecture

```
Phone / laptop browser
        │  web pages poll every 2 s
        ▼
Laptop server (Node.js + Express)
        │  SQLite file (spsr.db)
        │
        │  GET /api/rack/state     every 500 ms
        │  POST /api/rack/button   on press
        ▼
ESP32  ── or ──  Rack Simulator
(same two endpoints; interchangeable)
```

All intelligence sits in the laptop server. The ESP32 and the simulator are interchangeable.

---

## 4. Tech stack

| Layer | Choice | Why |
| --- | --- | --- |
| Backend | Node.js + Express | One REST API, one `npm start` |
| Database | SQLite (`better-sqlite3`) | Single file, nothing to install |
| Frontend | HTML, CSS, vanilla JavaScript | No build step; pages poll every 2 s |
| Hardware | Arduino IDE, ESP32 board package, WiFi, HTTPClient, ArduinoJson | Beginner-friendly for the builder |
| QR | Any free generator → `http://<laptop-ip>:3000/courier` | Printed and stuck on the rack |
| Version control | Git (private remote optional) | Backup. The handover itself is a zip, not a repo |
| Packaging | Node single-executable or `pkg` → `Parcel Rack.exe` | Builder double-clicks; DB created on first run. `npm start` stays as fallback |

Python (Flask + SQLite) is an equal alternative. The API, pages, and sketch stay the same. This plan uses Node.js.

---

## 5. Pages

| Page | URL | User | Behaviour |
| --- | --- | --- | --- |
| Parcel Drop-off | `/courier` | Courier | Employee ID, courier company, parcel reference. Submit assigns a slot and lights its LED |
| Delivery Successful | `/courier/done/:id` | Courier | Slot, receiver, parcel ID, pickup code. Waits for the button, then shows "Stored" |
| Receiver Dashboard | `/receiver` | Staff | Enter Employee ID. Waiting parcels, slot, pickup code. Simulated notification banner |
| Parcel Collection | `/collect` | Staff | Employee ID + pickup code. On match, slot blinks and page shows "YOUR PARCEL IS IN SLOT 02" |
| Admin Dashboard | `/admin` | Reception | Rack grid (empty / occupied), parcel table, filters, search by name, overdue highlight, rack online/offline |
| Rack Simulator | `/simulator` | Developer | Virtual LEDs and buttons on the same API as the ESP32. "Simulator active" toggle so it does not fight a real board |
| Hardware Test | `/hwtest` | Builder | Force each LED on / off / blink. Live button log. ESP32 last-seen. Test mode pauses parcel logic |

Core behaviour:

- Automatic slot assignment: lowest-numbered `EMPTY` slot
- Dual access: courier deposits, receiver verifies and collects
- Random 4-digit pickup code per parcel
- LED solid = place parcel; LED blink = collect parcel
- Live slot status and parcel history (events table)

---

## 6. Data model

Four tables. Seed **10 employees** and **4 slots** on first run so the demo works immediately.

### `employees`

| Field | Type | Example |
| --- | --- | --- |
| emp_id (PK) | text | EMP003 |
| name | text | Aina |
| department | text | Finance |
| email | text, optional | aina@company.com |

### `slots`

| Field | Type | Example |
| --- | --- | --- |
| slot_no (PK) | integer | 2 |
| status | `EMPTY` / `RESERVED` / `OCCUPIED` | RESERVED |
| led | `off` / `on` / `blink` | on |
| parcel_id (FK) | text, nullable | P-1004 |

### `parcels`

| Field | Type | Example |
| --- | --- | --- |
| parcel_id (PK) | text | P-1004 |
| emp_id (FK) | text | EMP003 |
| courier_company | text | J&T Express |
| reference | text, optional | JT123456 |
| slot_no | integer | 2 |
| pickup_code | text, 4 digits | 4826 |
| status | `ASSIGNED` / `STORED` / `COLLECTING` / `COLLECTED` / `CANCELLED` | STORED |
| created_at, stored_at, collected_at | datetime | 2026-11-26 10:15 |
| failed_attempts | integer | 0 |

### `events` (audit log)

`id`, `time`, `type` (`ASSIGN`, `BUTTON`, `STORE`, `VERIFY_OK`, `VERIFY_FAIL`, `COLLECT`, `TIMEOUT`), `slot_no`, `parcel_id`, `details`.

---

## 7. Status flow

The same physical button means "stored" or "collected" depending on state. The server interprets every press.

```
Courier submit
    slot EMPTY → RESERVED, LED on
    parcel → ASSIGNED
        │
        │ button (within place timeout)
        ▼
    parcel STORED, slot OCCUPIED, LED off
        │
        │ correct pickup code
        ▼
    parcel COLLECTING, LED blink
        │
        │ button (within collect timeout)
        ▼
    parcel COLLECTED, slot EMPTY, LED off
```

| Slot when pressed | Parcel status | Result |
| --- | --- | --- |
| RESERVED | ASSIGNED | Parcel `STORED`, LED off |
| OCCUPIED | COLLECTING | Parcel `COLLECTED`, slot `EMPTY`, LED off |
| OCCUPIED | STORED | Ignored (no valid pickup yet) |
| EMPTY | none | Ignored |

Timeouts (all in `config.json`, shortened for demo):

| Situation | Response |
| --- | --- |
| Courier never presses the button | After 5 min, parcel `CANCELLED`, slot `EMPTY`, LED off |
| Wrong pickup code | "Incorrect code" with attempts left. After 3 failures, lock that parcel for 5 min |
| Correct code, never collected | After 2 min of blinking, return to `STORED`, LED off. Staff can retry |
| Button on empty slot | Ignored and logged |
| Button twice quickly | 50 ms debounce on ESP32; server ignores if state already changed |
| Two couriers at once | Slot chosen inside a database transaction |
| ESP32 silent for 5 s | Admin and Hardware Test show "Rack offline"; courier page warns before assigning |
| Uncollected over 3 days | Highlighted red on Admin as overdue |
| Rack full | "Rack full, please hand parcel to reception". Nothing assigned |
| Unknown Employee ID | "Employee not found". Suggest names as the courier types |

---

## 8. Hardware API — freeze in Week 1, never change

### Hardware endpoints (ESP32 and simulator)

**`GET /api/rack/state`** — called every 500 ms. Also records last-seen time.

```json
{"slots":[{"slot":1,"led":"off"},{"slot":2,"led":"on"},{"slot":3,"led":"blink"},{"slot":4,"led":"off"}]}
```

**`POST /api/rack/button`**

```json
{"slot":2}
```

Response: `{"ok":true,"action":"STORED"}` or `"COLLECTED"` or `"IGNORED"`.

### Web endpoints

| Method | Endpoint | Purpose |
| --- | --- | --- |
| POST | `/api/parcels` | Courier submit. Returns parcel ID, slot, pickup code |
| GET | `/api/parcels/:id` | Status for Delivery Successful |
| GET | `/api/receiver/:empId` | Parcels waiting for an employee |
| POST | `/api/collect` | Body: empId + code. Starts `COLLECTING`, slot blinks |
| GET | `/api/admin/overview` | Slots, parcels, rack online status |
| POST | `/api/admin/slot/:no/led` | Hardware Test: force an LED state |
| GET | `/api/events?since=` | Live log for Hardware Test and Admin |

---

## 9. ESP32 sketch and wiring

Sketch stays under ~150 lines. Four jobs: connect WiFi, poll LED states, drive LEDs, report button presses.

Settings at the top of `esp32/rack/rack.ino`:

```cpp
const char* WIFI_SSID = "your-wifi";
const char* WIFI_PASS = "your-password";
const char* SERVER    = "http://192.168.1.10:3000";
const int NUM_SLOTS   = 4;
int LED_PINS[]        = {13, 12, 14, 27, 16, 17};
int BUTTON_PINS[]     = {26, 25, 33, 32, 18, 19};
```

Behaviour:

1. On boot, connect to WiFi and flash all LEDs once.
2. Every 500 ms, `GET /api/rack/state`.
3. Each loop: `on` = HIGH, `off` = LOW, `blink` = toggle every 300 ms.
4. Buttons on `INPUT_PULLUP`. On press (50 ms debounce), `POST /api/rack/button`.
5. If WiFi drops, blink onboard LED (GPIO 2) fast and retry every 5 s.
6. Serial Monitor at 115200 baud for every step.

| Slot | LED pin | Button pin |
| --- | --- | --- |
| 1 | GPIO 13 | GPIO 26 |
| 2 | GPIO 12 | GPIO 25 |
| 3 | GPIO 14 | GPIO 33 |
| 4 | GPIO 27 | GPIO 32 |
| 5 | GPIO 16 | GPIO 18 |
| 6 | GPIO 17 | GPIO 19 |

LED: GPIO → 220 Ω → LED long leg (+); short leg (−) → GND.  
Button: one leg → GPIO, other (diagonal) leg → GND. No resistor (`INPUT_PULLUP`).

GPIO 12 can block upload if pulled high at boot. If upload fails, unplug slot 2's LED or move that LED to GPIO 4.

Parts: 1 ESP32 DevKit, 4–6 green LEDs, 4–6 × 220 Ω, 4–6 tactile buttons, 1–2 breadboards, jumpers, micro-USB **data** cable, foam board or cardboard.

---

## 10. Simulator and Hardware Test

**Simulator (`/simulator`)**

- Draws N slots from `config.json`, each with a round LED and a button.
- Polls `GET /api/rack/state` every 500 ms. Grey / solid green / blinking green.
- Button click calls `POST /api/rack/button`.
- "Simulator active" toggle.
- Backup demo if hardware fails on presentation day.

**Hardware Test (`/hwtest`)**

- Badge: "ESP32 online, last seen 0.4 s ago" or "ESP32 offline".
- Per slot: On / Off / Blink. Also All on, All off, Blink all.
- Live log: "10:21:05 Button pressed on slot 3".
- "Test mode" pauses parcel logic so test presses do not change real parcels.

Builder's check: every LED responds to its On button, and every button press appears in the log with the right slot number.

---

## 11. Folder structure

```
smart-parcel-system/
├── HANDOVER.md              ← builder guide (read first)
├── README.md                ← developer notes
├── DEVELOPMENT_PLAN.md      ← this plan
├── config.json              ← slots, port, time limits
├── package.json
├── server/
│   ├── index.js             ← Express, pages + API
│   ├── db.js                ← SQLite setup + seed
│   ├── rack.js              ← assignment, button logic, timeouts
│   └── routes/              ← parcels, receiver, collect, admin, rack
├── public/
│   ├── courier.html
│   ├── receiver.html
│   ├── collect.html
│   ├── admin.html
│   ├── simulator.html
│   ├── hwtest.html
│   ├── css/style.css
│   └── js/                  ← one script per page
├── esp32/
│   └── rack/rack.ino
├── data/spsr.db             ← created automatically
└── docs/
    ├── wiring-diagram.png
    ├── qr-courier.png
    ├── Client-User-Guide.md
    └── SPSR_System_Development_Plan.pdf
```

Handover zip (what the builder and client receive — source repo is not in the zip):

```
SmartParcelRack_v1.0_2026-12.zip
├── Parcel Rack.exe
├── data/
├── esp32/rack/rack.ino
├── HANDOVER.pdf
├── Client User Guide.pdf
├── QR code.png
├── wiring-diagram.png
└── demo-video.mp4
```

---

## 12. Six-week timeline

Start: **Thursday 26 November 2026**. Handover target: **Tuesday 6 January 2027** (zip dated December 2026).

Weeks 4 and 5 may overlap. **Do not skip the Week 3 gate.** A working simulator flow is what makes the hardware handover safe.

### Four gates

| Gate | When | Pass condition |
| --- | --- | --- |
| G1 API frozen | End of Week 1 (2 Dec) | `GET /api/rack/state` and `POST /api/rack/button` match section 8. Documented. No later changes |
| G2 Simulator flow | End of Week 3 (16 Dec) | One parcel goes drop-off → stored → collect → empty on `/simulator`. T1–T4 pass |
| G3 Tests + sketch | End of Week 5 (30 Dec) | T1–T12 pass on the simulator. Sketch compiles in Arduino IDE |
| G4 Handover zip | End of Week 6 (6 Jan) | Fresh zip runs on a second laptop. Guides readable by someone who has not seen the project |

### Week 1 — Foundation and frozen API (26 Nov – 2 Dec)

- Init Node project, `config.json` (port 3000, 4 slots, timeouts: 5 min place, 3 tries, 5 min lock, 2 min blink, 5 s offline, 3 days overdue).
- SQLite schema + seed (10 employees including Aina / EMP003, 4 slots).
- Express serves static pages and JSON.
- Implement both hardware endpoints with the exact JSON in section 8. Button handler returns `STORED` / `COLLECTED` / `IGNORED` from a stub state machine.
- Record ESP32 last-seen on each poll.
- **Gate G1:** freeze the two hardware endpoints. Write them at the top of `README.md`.

### Week 2 — Parcel logic and courier flow (3–9 Dec)

- Slot assignment inside a transaction (lowest `EMPTY` slot).
- Full status machine in `server/rack.js` (section 7).
- `POST /api/parcels`, `GET /api/parcels/:id`.
- Pages: `/courier` and `/courier/done/:id` (poll every 2 s).
- Employee-not-found with name suggestions. Rack-full message. Offline warning before assign.
- Events written for every transition.

### Week 3 — Simulator, receiver, collect (10–16 Dec) — mandatory gate

- `/simulator`: N slots, 500 ms poll, button posts, "Simulator active" toggle.
- `GET /api/receiver/:empId`, `POST /api/collect`.
- Pages: `/receiver` (notification banner) and `/collect`.
- Place timeout and collect timeout running from `config.json`.
- **Gate G2:** demo script steps 1–7 work entirely on the simulator (Aina / EMP003 / J&T / JT123456).

### Week 4 — Admin, hardware test, ESP32 sketch (17–23 Dec)

May start in parallel with late Week 3 once G2 is close.

- `GET /api/admin/overview`, search, overdue highlight, rack online/offline badge.
- `/admin` rack grid and parcel table.
- `/hwtest`: force LED, all on/off/blink, live event log, test mode that does not mutate parcels.
- `esp32/rack/rack.ino` per section 9 (WiFi, poll, LEDs, debounce, serial log).
- Wrong-code lockout (3 tries, 5 min).

### Week 5 — Unhappy paths, guides, hardware smoke test (24–30 Dec)

- Finish edge cases still open: double-press, concurrent assign, restart restores DB (T12), empty-slot press logged.
- Shorten timeouts via `config.json` and re-run T5, T8, T10 quickly.
- `HANDOVER.md` from Appendix B (parts, build, wire, upload, test, troubleshoot).
- Client User Guide from Appendix A.
- Wiring diagram and courier QR (placeholder IP, documented as "replace with laptop IP").
- If an ESP32 and two LEDs are available (~RM30): compile, upload, confirm one LED and one button on `/hwtest`. If not, record that the sketch is compile-checked only — this is the top risk.
- **Gate G3:** T1–T12 green on the simulator. Sketch compiles.

### Week 6 — Package and handover (31 Dec – 6 Jan)

- Build `Parcel Rack.exe`. First run creates the database and opens `http://localhost:3000/admin`.
- Desktop-start note in the client guide (icon launches exe and browser).
- Export `HANDOVER.pdf` and `Client User Guide.pdf`.
- 3-minute screen recording of the full simulator flow (`demo-video.mp4`).
- Zip layout in section 11. Test the zip on a **different laptop** that has never run the project.
- Delete DB, restart, confirm re-seed.
- Someone who has not seen the project reads each guide once.
- **Gate G4:** checklist in section 14 all ticked. Zip name includes version and date.

---

## 13. Testing

Run every test on the simulator first. The builder repeats the hardware block, then T1–T4 and T10, on the real rack.

| # | Test | Expected |
| --- | --- | --- |
| T1 | Courier submits for EMP003 with slots 1 and 3 occupied | Slot 2 assigned, LED 2 on, code shown |
| T2 | Press button on slot 2 | Parcel STORED, LED 2 off, receiver sees notification |
| T3 | Receiver enters EMP003 + correct code | Slot 2 blinks, page shows "SLOT 02" |
| T4 | Press button on slot 2 | Parcel COLLECTED, slot 2 EMPTY, admin updates |
| T5 | Wrong code 3 times | Error each time, then locked for 5 min |
| T6 | Submit with all slots full | "Rack full", nothing assigned |
| T7 | Unknown Employee ID | "Employee not found" |
| T8 | Submit, then no button until timeout | Parcel CANCELLED, slot EMPTY |
| T9 | Press button on empty slot | Ignored, logged |
| T10 | Stop simulator / unplug ESP32 | "Rack offline" within 5 s |
| T11 | Open courier page on a phone via QR | Page loads over local WiFi |
| T12 | Restart server mid-flow | Parcels and slots restored from database |

Demo prep (section 15) uses slots 1 and 3 pre-occupied so the happy path lands on slot 2.

---

## 14. Handover checklist

Before the zip leaves:

- [ ] T1–T12 pass on the simulator
- [ ] Sketch compiles in Arduino IDE with no errors
- [ ] Fresh zip runs on a different laptop
- [ ] Deleting the database re-seeds cleanly
- [ ] QR image in `docs/`
- [ ] Wiring diagram in `docs/`
- [ ] `HANDOVER.md` and Client User Guide each read once by someone new to the project
- [ ] Desktop icon, bookmarks ("Parcel Rack Admin", "My Parcels"), and rack-sign notes written for reception
- [ ] 3-minute simulator recording included
- [ ] Version and date in the zip file name

`HANDOVER.md` order: what this is and parts list → wiring + diagram → start the system and find the IP → upload the sketch (6 settings) → `/hwtest` every LED and button → demo script → troubleshooting table → how to change slot count, timeouts, and employees.

Troubleshooting to include: ESP32 offline (network / IP / firewall), upload fails (data cable, BOOT, GPIO 12), LED dead (polarity or GND), button not logged (diagonal legs / pin map), phone on mobile data, laptop IP changed after hotspot restart.

---

## 15. Demo script (~3 minutes)

One parcel for Aina, arrival to collection.

1. Admin on the laptop: 4 slots, slots 1 and 3 occupied.
2. Phone scans the rack QR. Enter EMP003, J&T Express, JT123456. Submit.
3. Slot 2 LED solid green. Phone shows Slot 02 and the pickup code.
4. Place the box, press the button. Phone shows "Stored". Admin shows slot 2 occupied.
5. Receiver page as Aina: "Your parcel is in Slot 02, code 4826".
6. Collect page: EMP003 + 4826. Slot 2 blinks. Page shows "YOUR PARCEL IS IN SLOT 02".
7. Take the box, press the button. Slot 2 empty. History shows the timeline.
8. Bonus: one wrong code, then fill the rack to show "Rack full".

If the hardware fails: open `/simulator`, turn Simulator active on, run the same steps.

---

## 16. Risks

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Sketch never tested on a real ESP32 | Builder stuck with nobody to ask | Keep the sketch minimal and logged. Buy one ESP32 + 2 LEDs (~RM30) for one smoke test if possible |
| Builder wires differently | Wrong slot lights or buttons | Pins are settings. `/hwtest` shows the mismatch immediately |
| Venue WiFi uses a captive portal | ESP32 cannot reach the laptop | Phone hotspot, documented in `HANDOVER.md`. Hotspot must be 2.4 GHz |
| Laptop IP changes | ESP32 loses the server | Hotspot usually keeps the IP. Troubleshooting step: update `SERVER` and re-upload |
| Hardware fails during the demo | No live LEDs | Switch to the simulator. Same flow, same data |
| Builder cannot install Node | Server will not start | Ship `Parcel Rack.exe` |

---

## 17. Future upgrades (report only, not in the prototype)

Email or Telegram notifications, staff login, IR or weight sensor instead of a button, LCD/OLED slot display, multiple racks, parcel photo capture.

---

## 18. Decisions already made

| # | Decision | Reason |
| --- | --- | --- |
| 1 | Developer builds only the system; someone else builds the rack | Agreed split of work |
| 2 | No contact with the builder | Every interface is decided here and shipped complete |
| 3 | Developer writes the ESP32 sketch | One owner, no mismatch |
| 4 | Server runs on the laptop, not inside the ESP32 | System and hardware stay separate |
| 5 | ESP32 is a thin client | All logic in one place; hardware stays small |
| 6 | Hardware API is two endpoints, frozen in Week 1 | Fixed contract for a builder you cannot talk to |
| 7 | Simulator uses those same two endpoints | Build and demo with no hardware |
| 8 | Hardware Test page | Builder checks wiring without learning the system |
| 9 | Fully local | No server environment; works on a hotspot |
| 10 | `Parcel Rack.exe` and a desktop icon | Client and builder are non-technical |
| 11 | Buttons, not sensors | Simplest reliable prototype |
| 12 | Node.js + Express + SQLite + plain HTML/JS | One language, no database server. Flask is an equal alternative |
| 13 | Handover is one zip (Drive, OneDrive, or USB) | Receivers do not use Git. The zip is the tested version and works offline |
| 14 | One plan document; export client and builder guides as PDFs for the zip | Single source |

Source copy and any private Git repo stay with the developer. They are not part of the handover. Later fixes go out as a new zip with a higher version.
