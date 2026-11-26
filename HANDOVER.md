# Prototype builder handover

This is the guide for the person who builds the rack. The software is already written. Your job is to build the compartments, wire the LEDs and buttons, upload one file to the ESP32, and test.

The laptop runs the system. The ESP32 only switches LEDs and reports button presses. It does not decide anything.

## What you need

| Item | Quantity | Notes |
| --- | --- | --- |
| ESP32 DevKit (ESP32-WROOM-32) | 1 | Any 30-pin or 38-pin DevKit |
| Green LED, 5 mm | 4 (up to 6) | One per slot |
| 220 Ω resistor | 4 (up to 6) | One per LED |
| Push button, tactile, 4-leg | 4 (up to 6) | One per slot |
| Breadboard | 1–2 | Full-size is easier |
| Jumper wires | about 20 | Male-to-male |
| Micro-USB data cable | 1 | A charge-only cable will not upload |
| Foam board or cardboard | 1 set | The compartments |
| Windows laptop | 1 | Runs Parcel Rack |
| Phone hotspot or WiFi router | 1 | Must be 2.4 GHz. Laptop and ESP32 join the same network |
| Arduino IDE 2.x | 1 | Free, from https://arduino.cc |

## Build the rack

1. Make 4 open compartments, side by side or in a 2×2 grid, each big enough for a small parcel.
2. Label them Slot 01, 02, 03, 04 on the front.
3. Mount one LED and one button on the front edge of each compartment, under its label.
4. Keep the ESP32 and breadboard at the back or side, where the USB cable can reach.
5. Leave a blank space on the front for the courier QR. After the laptop is running, the Admin Dashboard shows that code. Print it or photograph it and stick it on the rack. If the laptop IP changes, the Admin page shows a new code. Use that one.

## Wire it

Wire each slot to these pins. Slot numbers in the software match this table.

| Slot | LED pin | Button pin |
| --- | --- | --- |
| 1 | GPIO 13 | GPIO 26 |
| 2 | GPIO 12 | GPIO 25 |
| 3 | GPIO 14 | GPIO 33 |
| 4 | GPIO 27 | GPIO 32 |
| 5 | GPIO 16 | GPIO 18 |
| 6 | GPIO 17 | GPIO 19 |

Each LED: ESP32 LED pin → 220 Ω resistor → LED long leg (+). LED short leg (−) → GND.

Each button: one leg → ESP32 button pin. The diagonally opposite leg → GND. No resistor. The sketch uses the board's internal pull-up.

Connect the breadboard GND rail to any ESP32 GND pin.

Open `docs/wiring-diagram.svg` in a browser for the same picture.

GPIO 12 can block upload on some boards if it is pulled high at boot. If upload stays on "Connecting…", unplug slot 2's LED while uploading, or move that LED to GPIO 4 and change `LED_PINS` in the sketch.

If you must use different pins, that is fine. Change the pin numbers in the sketch and upload again. Do not change anything else in the file.

## Start the system on the laptop

1. Unzip this folder to the Desktop. Do not install Node.js and do not open a terminal.
2. Turn on the phone hotspot (2.4 GHz) and connect the laptop to it.
3. Double-click `Parcel Rack.bat`. A black window opens and the Admin Dashboard opens in the browser. Keep the black window open. Closing it stops the system.
4. If Windows asks about the firewall, click Allow access for both private and public networks.
5. On the Admin Dashboard, read the **Courier link** card. It shows this laptop's IP, the courier web address, and a QR code. That IP is what you type into the ESP32. Example: if the card says `192.168.43.25`, the ESP32 `SERVER` line is `http://192.168.43.25:3000`.

## Upload the code to the ESP32

1. Install Arduino IDE 2.x.
2. File → Preferences → Additional boards manager URLs. Paste `https://espressif.github.io/arduino-esp32/package_esp32_index.json` and click OK.
3. Tools → Board → Boards Manager. Search `esp32`. Install **esp32 by Espressif Systems**.
4. Tools → Manage Libraries. Install **ArduinoJson** by Benoit Blanchon.
5. Open `esp32/rack/rack.ino`.
6. Edit only the settings at the top:
   - `WIFI_SSID` and `WIFI_PASS`: the hotspot name and password
   - `SERVER`: `http://` + the IP shown on the Admin **Courier link** card + `:3000`, for example `http://192.168.43.25:3000`
   - `NUM_SLOTS`: how many slots you built
   - `LED_PINS` and `BUTTON_PINS`: only if you used different pins
7. Plug in the ESP32. Tools → Board → ESP32 Dev Module. Tools → Port → the new COM port.
8. Click Upload. If it stays on "Connecting…", hold the BOOT button until the upload starts.
9. Tools → Serial Monitor, 115200 baud. You should see `WiFi connected` and then `Server OK`.

## Test the hardware

1. On the laptop open http://localhost:3000/hwtest.
2. The top should say ESP32 online. If it says offline, see the troubleshooting table.
3. Click On for each slot. The matching LED lights. Click Blink. It blinks. Click All off.
4. Press each slot's button. The log shows `Button pressed on slot N` with the right number.
5. Turn on **Test mode** before you press buttons if real parcels are already in the system. Test mode logs the press and does not store or collect a parcel.
6. If an LED or button is on the wrong slot, swap the wires or the pin numbers and upload again.

## Run the full test

1. On a phone joined to the same hotspot, scan the QR code shown on the Admin Dashboard. Submit a parcel for `EMP003`.
2. A slot lights steady green. Press its button. The phone shows Delivery Successful.
3. Open http://localhost:3000/collect (or the Collect page on the phone). Enter `EMP003` and the pickup code shown on the phone.
4. The slot blinks. Press its button. Admin shows the slot empty and the parcel Collected.

If those four steps work, the rack is ready. For the presentation, use Admin → Load demo (slots 1 and 3 occupied), then drop off EMP003 so the story lands on slot 2.

If the hardware fails during the demo, open http://localhost:3000/simulator and leave **Simulator active** checked. The on-screen buttons run the same flow.

## Troubleshooting

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| ESP32 offline on /hwtest | Different WiFi, wrong IP, or firewall | Same hotspot for both. Recheck the IP on the Admin card. Allow Parcel Rack through Windows Firewall |
| Serial Monitor says WiFi failed | Wrong name or password, or a 5 GHz hotspot | Check spelling. Set the hotspot to 2.4 GHz |
| Upload fails | Charge-only cable, or GPIO 12 | Use a data cable. Hold BOOT. Unplug slot 2's LED during upload |
| LED never lights | LED reversed, or no GND | Long leg toward the resistor. Check the GND rail |
| LED always on | Wire is on 3.3 V instead of the GPIO | Move the wire to the GPIO in the table |
| Button press not logged | Both legs on the same side | Use diagonally opposite legs. Check the pin map |
| Phone cannot open the page | Phone is on mobile data | Join the hotspot |
| Laptop IP changed | Hotspot was restarted | Read the new IP on the Admin Courier link card, update `SERVER`, upload again |
| Browser says the site cannot be reached | The black window was closed | Double-click `Parcel Rack.bat` again |

## Changing settings

- Slot count and time limits: edit `config.json`, then close the black window and start `Parcel Rack.bat` again. Slot count is read when the database is created. To add slots 5 and 6 on a database that already exists, set `"slots": 6` and restart. Empty slots are added. Existing parcels stay.
- Time limits in `config.json` are in milliseconds. 300000 is 5 minutes. 120000 is 2 minutes. 5000 is 5 seconds. 259200000 is 3 days.
- New employee: add a row to the `employees` table in `data/spsr.db` with an ID such as `EMP011`, a name, and a department.
- New QR code: reload the Admin Dashboard. The Courier link card shows the current code. Print or photograph that. Do not look for a QR picture in the folder.
- A later software fix arrives as a new zip with a higher version in the file name. Do not mix files from two zips.
