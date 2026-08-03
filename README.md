# Auburn Central Musallah — prayer times

A single self-contained HTML page showing daily salah and iqamah times for
Auburn, NSW. It makes **no network requests** — ten years of prayer times are
baked into the file — so it runs on a wall-mounted device with no internet.

## Files

| File | Purpose |
| --- | --- |
| `index.html` | The whole app. Open it directly, or host it. Nothing else is needed at runtime. |
| `build-times.js` | Regenerates the embedded prayer-time table. The only thing here that uses the internet. |
| `build-icons.js` | Regenerates the app icons and manifest. Only needed if the icon changes. |
| `manifest.webmanifest`, `icon-*.png` | Let a hosted copy install to a phone's home screen. Not needed offline. |
| `AlAdhan-api-1.json` | OpenAPI spec for the AlAdhan API, kept for reference. |

## Running it

Open `index.html` in any browser — including straight off a USB stick via
`file://`. No server required.

To view it on a phone on the same wifi:

```
npx serve
```

then browse to `http://<your-ip>:3000`.

## Running it as an app rather than a web page

**Wall display (best result).** Launch Chrome in kiosk mode — no tabs, no
address bar, nothing to tap out of:

```
chrome.exe --kiosk --app="file:///C:/path/to/index.html"
```

Put that in a shortcut in the Startup folder and the screen comes back up by
itself after a power cut. Add `--noerrdialogs --disable-session-crashed-bubble`
to suppress the "Chrome didn't shut down correctly" bar. Press `F11` or use the
**Full screen** button on the page if you'd rather not use kiosk mode.

**Phone.** Open the hosted URL, then:

- **iOS Safari** — Share → *Add to Home Screen*
- **Android Chrome** — menu → *Add to Home screen* / *Install app*

It launches with no browser chrome and its own icon. This needs the site served
over `https` (GitHub Pages is fine); it does not work from a `file://` copy.

Layout, scrolling and tap behaviour are already tuned for this: no rubber-band
overscroll, no tap highlight, and the board itself isn't selectable text.

## Changing the iqamah times

Iqamah times always come from the `DEFAULTS` block near the top of the `<script>`
in `index.html`. Nothing is stored on the device, so every device that opens the
file shows the same times.

```js
var DEFAULTS = {
  Fajr: "06:10",
  Dhuhr: "13:30",
  Asr: "16:15",
  Isha: "19:20",
  juma1: "12:45",
  juma2: "13:50",
  maghribOffset: 7   // minutes after the calculated Maghrib
};
```

Edit it directly, or use the **Iqamah times** panel on the page to try values
out and press **Copy block for index.html** to get the block back with your
changes. Panel edits are a preview only — they disappear on reload until pasted
into the file.

Maghrib is deliberately an offset rather than a fixed time, so it keeps tracking
sunset through the year.

> **Known limitation:** the four fixed times do not follow the seasons. In
> January, Asr starts around 6:03 pm and Isha around 9:40 pm, so an Asr iqamah
> of 4:15 pm and an Isha of 7:20 pm fall before the prayer has begun. They need
> adjusting seasonally, or converting to offsets like Maghrib.

## Regenerating the prayer times

The embedded table currently covers **2026–2035**. The page warns on screen for
the last 120 days of data, and refuses to show a date outside the range rather
than displaying something wrong.

On a machine with internet:

```
node build-times.js 2026 2035
```

This rewrites the generated block inside `index.html` in place. It needs Node 18
or newer (it uses the built-in `fetch`); there are no dependencies to install.

Times come from [AlAdhan](https://aladhan.com) using:

- **method 4** — Umm Al-Qura University, Makkah
- **school 1** — Hanafi (affects Asr only)
- city `Auburn`, state `NSW`, country `AU`

Note that Umm Al-Qura sets Isha at a fixed 90 minutes after Maghrib, widening to
120 minutes during Ramadan, rather than using a twilight angle.

## Behaviour worth knowing

- All date and time decisions are made in `Australia/Sydney`, whatever the
  device's own timezone is.
- As soon as the Isha iqamah passes, the table loads the next day's times so
  people leaving after Isha see the coming day's schedule. The **date in the
  header does not change until midnight**, and there is no "tomorrow" marker.
  One consequence: on a Thursday evening the board shows the Friday schedule —
  Juma in place of Dhuhr — under a Thursday date.
- On Fridays the Dhuhr row is replaced in place by Juma 1 and Juma 2, which
  inherit Dhuhr's start time. On other days Juma is listed below Isha for
  reference.
- The countdown targets the **iqamah** time, not the calculated start.

## Deploying

**Offline device:** copy `index.html` across. That's the whole deployment.

**Sharing a link:** any static host works. For GitHub Pages, push this repo,
then Settings → Pages → Deploy from a branch → `main` → `/ (root)`. Because the
file is named `index.html` it becomes the site root.

The device's clock is the one thing the page cannot check. With no internet
there is no NTP, so it should be set from a local time source or by hand
periodically — a display that is silently a few minutes fast is worse than none.
