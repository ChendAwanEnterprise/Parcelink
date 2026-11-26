# Bella Smart Parcel — client user guide

This guide is for the people who use the parcel rack every day. You do not need any technical knowledge. If something goes wrong, use the last section.

## What the system does

The rack has numbered slots. Each slot has a light and a button. When a courier delivers a parcel, the system chooses a free slot and lights it. When staff come to collect, they type a code and their slot blinks. Nobody needs to search the rack.

| Light | Meaning |
| --- | --- |
| Off | The slot is empty, or a parcel is waiting quietly inside |
| Steady green | Courier: put the parcel in this slot |
| Blinking green | Staff: your parcel is in this slot |

## Starting the system each morning

This takes about 2 minutes. One person, usually reception, does it once a day.

1. Switch on the WiFi hotspot or router labelled Parcel Rack WiFi.
2. Switch on the reception laptop and connect it to Parcel Rack WiFi.
3. Double-click **Parcel Rack** (`Parcel Rack.bat`) on the Desktop. A black window opens. Do not close this window while the system is in use. You can minimise it.
4. The Admin Dashboard opens in the browser by itself. If it does not, open the bookmark **Parcel Rack Admin**.
5. Plug in the rack's USB cable. After a few seconds all the slot lights flash once.
6. Check the top of the Admin Dashboard. It should say **Rack online** in green once the rack, or the simulator, is connected. If it says **Rack offline**, wait 30 seconds, then use the table at the end of this guide.
7. The **Courier link** card shows the address phones should use and the QR code for the rack. If the WiFi was just switched on, reload the page so the card picks up the new address. Print or photograph that code and keep it on the rack.

On a day with no physical rack, open **Simulator** from the Admin page and leave **Simulator active** ticked. The lights appear on the screen instead.

## For couriers: dropping off a parcel

1. Connect the phone to Parcel Rack WiFi. The password is on the sign next to the rack.
2. Scan the QR code on the rack with the phone camera.
3. Fill in the form: the receiver's Employee ID (on the parcel label, or ask reception), the courier company, and the tracking number if you have one.
4. Tap **Submit Delivery**.
5. One slot lights steady green. The phone shows the same slot number and a 4-digit pickup code.
6. Put the parcel in that slot and press the button on that slot.
7. The phone shows **Stored**. You are done.

If the button is not pressed within 5 minutes, the slot is released and the courier submits again.

If the page says the rack is full, every slot is in use. Hand the parcel to reception.

## For staff: collecting a parcel

1. Join Parcel Rack WiFi.
2. Open the bookmark **My Parcels**. Enter your Employee ID. If a parcel is waiting, the page shows the slot and the 4-digit pickup code. Example: "Your parcel is in Slot 02, code 4826".
3. At the rack, open **Collect**. Enter your Employee ID and the pickup code.
4. Tap **Verify & Locate Parcel**. Your slot blinks and the page shows the slot number, for example **YOUR PARCEL IS IN SLOT 02**.
5. Take the parcel and press the button on that slot.
6. The light turns off and the page shows **Parcel collected**.

If the code is wrong 3 times, that parcel is locked for 5 minutes. Wait, or ask reception.

If the light stops blinking before you press the button, enter the code again. The parcel is still there.

## For reception: the Admin Dashboard

- **Courier link** shows this laptop's address and the QR code couriers scan. Use the address on that card for phone bookmarks. If the card says to join the WiFi, connect the laptop and reload.
- **Rack view** shows every slot as empty or occupied, and the name of the person the parcel belongs to.
- **Parcel list** shows every parcel. Use the search box to find a staff name. The filter can show Waiting, Collected, or Cancelled.
- **Overdue** parcels (waiting more than 3 days) are shown in red. Remind those staff to collect.
- **Lost code:** search the staff name, click the parcel, and read out the pickup code after you have checked their ID.
- **Load demo** fills slots 1 and 3 so a practice drop-off for Aina (EMP003) uses slot 2. Use this for a presentation, not during a normal day.
- **Clear parcels** empties the rack. It asks you to confirm first. Staff parcels on the rack would be cleared, so do not use it while real parcels are stored.

## Shutting down at the end of the day

1. Check the Admin Dashboard. Parcels still waiting are safe. They will still be there tomorrow.
2. Close the black Parcel Rack window.
3. Unplug the rack's USB cable and switch off the WiFi hotspot.
4. Shut down the laptop as usual.

## When something goes wrong

| Problem | What to do |
| --- | --- |
| Dashboard says Rack offline | Check the rack USB cable. Unplug it, wait 5 seconds, plug it back in. Wait 30 seconds. |
| Phone cannot open the page after scanning the QR | The phone must be on Parcel Rack WiFi, not mobile data. |
| Page says Rack full | All slots are in use. The courier hands the parcel to reception. |
| Page says Employee not found | Check the Employee ID on the parcel. Reception can look up the name on the dashboard. |
| No slot lights up after submitting | Check Rack online on the dashboard. If it is online, unplug the rack, wait 5 seconds, and plug it back in. |
| Browser says the site cannot be reached | The black window was closed. Double-click Parcel Rack again. |
| Anything else | Close the black window, unplug the rack, then start from "Starting the system each morning". Parcel records are kept. |

## Bookmarks to save

- Parcel Rack Admin: `http://localhost:3000/admin` on the reception laptop
- My Parcels and Collect: use the address on the Admin **Courier link** card, changing `/courier` to `/receiver` or `/collect`

That address is also the one written on the rack sign. It looks like `http://192.168.43.25:3000/courier`.
