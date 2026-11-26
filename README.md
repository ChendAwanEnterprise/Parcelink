# Bella Smart Parcel — developer notes

Frozen hardware API. Do not change these two endpoints. The ESP32 sketch and the simulator both use them.

`GET /api/rack/state` every 500 ms. Also records that the rack was seen.

```json
{"slots":[{"slot":1,"led":"off"},{"slot":2,"led":"on"},{"slot":3,"led":"blink"},{"slot":4,"led":"off"}]}
```

`POST /api/rack/button` with body `{"slot":2}`.

```json
{"ok":true,"action":"STORED"}
```

`action` is `STORED`, `COLLECTED`, or `IGNORED`.

## Run

Requires Node.js 22. From this folder:

```bat
npm install
npm start
```

Or double-click `Parcel Rack.bat`. That launcher uses `runtime\node.exe` and `dist\server.cjs`. The client laptop does not install Node and does not run `npm install`. The Admin Dashboard opens at http://localhost:3000/admin. The database file `data/spsr.db` is created and seeded on first run (10 employees, 4 empty slots). Delete that file and start again to re-seed.

`npm test` runs T1–T12 plus overdue, blink-timeout, and a concurrent assign against `config.test.json`.

The Admin **Courier link** card shows this laptop's IP and a live QR code. The client does not generate a QR file. `npm run qr` only writes `docs/qr-courier.png` for a developer who wants a static picture.

## Pages

| Page | URL |
| --- | --- |
| Drop-off | /courier |
| Delivery | /courier/done/:id |
| My parcels | /receiver |
| Collect | /collect |
| Admin | /admin |
| Simulator | /simulator |
| Hardware test | /hwtest |

Phones on the same WiFi use `http://<laptop-ip>:3000/...`. Allow Node through Windows Firewall when asked.

## Demo

1. Open `/simulator` and leave **Simulator active** on. That polling is what makes the rack "online".
2. On `/admin`, click **Load demo**. Slots 1 and 3 are occupied.
3. On a phone, or in another tab, open `/courier`. Submit EMP003, J&T Express, JT123456.
4. Slot 2 lights. Press its button on the simulator. The phone shows Stored.
5. `/receiver` as EMP003 shows the code. `/collect` with that code blinks slot 2.
6. Press the button again. The slot is empty and Admin shows the timeline.

## Settings

`config.json` holds the port, slot count, and timeouts: 5 minutes to press after drop-off, 3 wrong codes, 5 minute lock, 2 minutes of blinking, 5 seconds to call the rack offline, 3 days before a parcel is overdue.

Adding an employee: insert a row into `employees` in `data/spsr.db` (DB Browser for SQLite, or HeidiSQL's SQLite support). Use an ID like `EMP011`. Restart is not required for the next lookup.

## Layout

`server/rack.js` owns slot assignment, button meaning, and timeouts. `server/db.js` creates and seeds SQLite through Node's built-in `node:sqlite` (`--experimental-sqlite`). The plan named `better-sqlite3`; this build uses the built-in driver so the app does not need a C++ compile. Web JSON is camelCase. The hardware JSON stays exactly as frozen above.

`collecting_at` and `locked_until` are extra parcel columns used for the blink timeout and the 3-strike lock. They are not part of the public hardware API.
