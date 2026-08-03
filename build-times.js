#!/usr/bin/env node
//
// Regenerates the prayer-time table embedded in index.html.
//
//   node build-times.js              -> current year + 9 more
//   node build-times.js 2026 2035    -> an explicit range
//
// This is the ONLY part of the project that touches the network. Run it on a
// machine with internet, then copy index.html to the offline device. The page
// itself never makes a request.
//
// Times come from AlAdhan with method=4 (Umm Al-Qura University, Makkah) and
// school=1 (Hanafi). The API returns e.g. "05:21 (AEST)"; the zone suffix is
// stripped here, so the baked values already have DST applied for the correct
// part of each year.

const fs = require("fs");
const path = require("path");

const CITY_QUERY = "city=Auburn&state=NSW&country=AU&method=4&school=1";

// Order matters: the page decodes the packed string using this same order.
const KEYS = ["Fajr", "Sunrise", "Dhuhr", "Asr", "Maghrib", "Sunset", "Isha"];
const PACKED_LENGTH = KEYS.length * 4;

const BEGIN = "  // >>> BEGIN GENERATED DATA";
const END = "  // <<< END GENERATED DATA";

const HTML = path.join(__dirname, "index.html");

function pad(n) { return String(n).padStart(2, "0"); }

async function fetchYear(year) {
  const url = `https://api.aladhan.com/v1/calendarByCity/${year}?${CITY_QUERY}`;
  const res = await fetch(url);
  if (!res.ok) { throw new Error(`${year}: HTTP ${res.status}`); }

  const body = await res.json();
  if (!body.data) { throw new Error(`${year}: unexpected response shape`); }

  const days = {};
  const zones = new Set();

  for (let month = 1; month <= 12; month++) {
    const entries = body.data[String(month)];
    if (!entries) { throw new Error(`${year}: month ${month} missing`); }

    for (const entry of entries) {
      const [dd, mm, yyyy] = entry.date.gregorian.date.split("-");
      if (Number(yyyy) !== year) {
        throw new Error(`${year}: got a ${yyyy} date back`);
      }

      const packed = KEYS.map((key) => {
        const raw = entry.timings[key];
        if (!raw) { throw new Error(`${year}-${mm}-${dd}: ${key} missing`); }
        const zone = raw.match(/\(([^)]+)\)/);
        if (zone) { zones.add(zone[1]); }
        return raw.split(" ")[0].replace(":", "");
      }).join("");

      if (!new RegExp("^\\d{" + PACKED_LENGTH + "}$").test(packed)) {
        throw new Error(`${year}-${mm}-${dd}: bad encoding "${packed}"`);
      }
      days[mm + dd] = packed;
    }
  }

  const expected = new Date(Date.UTC(year, 1, 29)).getUTCMonth() === 1 ? 366 : 365;
  const count = Object.keys(days).length;
  if (count !== expected) {
    throw new Error(`${year}: expected ${expected} days, got ${count}`);
  }

  return { days, count, zones: [...zones].sort() };
}

async function main() {
  const now = new Date();
  const from = Number(process.argv[2]) || now.getUTCFullYear();
  const to = Number(process.argv[3]) || from + 9;

  if (!(from >= 2000 && to >= from && to - from < 50)) {
    console.error("Usage: node build-times.js [startYear] [endYear]");
    process.exit(1);
  }

  const lines = [];
  let bytes = 0;

  for (let year = from; year <= to; year++) {
    process.stdout.write(`fetching ${year} ... `);
    const { days, count, zones } = await fetchYear(year);
    const json = JSON.stringify(days);
    bytes += json.length;
    lines.push(`    "${year}": ${json}`);
    console.log(`${count} days, ${json.length.toLocaleString()} bytes, ${zones.join(" + ")}`);
  }

  const block = [
    BEGIN + " - do not edit by hand.",
    `  // Built ${now.toISOString().slice(0, 10)} from AlAdhan (${CITY_QUERY}).`,
    `  // Packed per day as ${KEYS.join("/")}, "HHMM" x6.`,
    `  var TIMES_RANGE = { from: ${from}, to: ${to} };`,
    "  var TIMES = {",
    lines.join(",\n"),
    "  };",
    END
  ].join("\n");

  const html = fs.readFileSync(HTML, "utf8");
  const start = html.indexOf(BEGIN);
  const finish = html.indexOf(END);
  if (start === -1 || finish === -1) {
    throw new Error("Could not find the generated-data markers in index.html");
  }

  const updated = html.slice(0, start) + block + html.slice(finish + END.length);
  fs.writeFileSync(HTML, updated);

  console.log(
    `\nwrote ${to - from + 1} years (${Math.round(bytes / 1024)} KB of data) into index.html` +
    `\nindex.html is now ${Math.round(updated.length / 1024)} KB total` +
    `\ncovers ${from}-01-01 through ${to}-12-31`
  );
}

main().catch((err) => {
  console.error("\nFAILED: " + err.message);
  console.error("index.html was not modified.");
  process.exit(1);
});
