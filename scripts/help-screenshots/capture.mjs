// Capture the Help page screenshots from the demo app: a computer window and an iPhone for every screen.
//   npm run help:shots                 all screens
//   npm run help:shots -- events menu  only screens whose name starts with these
// Needs the demo app running (npm run help:demo) and Google Chrome installed (set CHROME to use another path).
import puppeteer from "puppeteer-core";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { BASE, OUT, PHOTOS, creds, d1Sql, readMeta } from "./common.mjs";

const CHROME = process.env.CHROME || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const DESKTOP = { width: 1100, height: 800, deviceScaleFactor: 2 };
const PHONE = { width: 402, height: 800, deviceScaleFactor: 2, isMobile: true, hasTouch: true };
const UA_PHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 26_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.5 Mobile/15E148 Safari/604.1";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const only = process.argv.slice(2);
const want = (name) => only.length === 0 || only.some((o) => name === o || name.startsWith(o));
const meta = readMeta();
// `main` is a finished gathering with attendance marked. `older` is one from before attendance was taken.
const main = meta.past[4];
const older = meta.past[1];

try {
  const health = await fetch(`${BASE}/api/health`);
  if (!health.ok) throw new Error(String(health.status));
} catch {
  console.error(`The demo app is not running at ${BASE}. Start it with: npm run help:demo`);
  process.exit(1);
}

// ---- helpers ----
async function login(page, which = 1) {
  const { email, password } = creds(which);
  await page.goto(`${BASE}/admin/login`, { waitUntil: "networkidle0" });
  await page.type('input[name="email"]', email);
  await page.type('input[name="password"]', password);
  await Promise.all([page.waitForNavigation({ waitUntil: "networkidle0" }), page.click('button[type="submit"]')]);
}
async function newView(browser, kind, context) {
  const page = await context.newPage();
  if (kind === "phone") {
    await page.setUserAgent(UA_PHONE);
    await page.setViewport(PHONE);
  } else {
    await page.setViewport(DESKTOP);
  }
  // The demo videos are fake, so serve a local picture where YouTube's thumbnail would be.
  await page.setRequestInterception(true);
  page.on("request", (req) => {
    if (/ytimg\.com|youtube\.com\/vi\//.test(req.url())) {
      return req.respond({ status: 200, contentType: "image/jpeg", body: fs.readFileSync(path.join(PHOTOS, "thumb.jpg")) });
    }
    req.continue();
  });
  return page;
}
async function save(page, name, kind, wait = 350) {
  await sleep(wait);
  await page.screenshot({ path: path.join(OUT, `${name}-${kind}.webp`), type: "webp", quality: 80 });
}
/** Ring what a screenshot is about. */
async function mark(page, selectors) {
  await page.evaluate((sels) => {
    const style = document.createElement("style");
    style.textContent = `[data-hl]{outline:3px solid #f08a24 !important;outline-offset:3px;border-radius:10px;box-shadow:0 0 0 7px rgba(240,138,36,.18) !important;}`;
    document.head.appendChild(style);
    for (const s of sels) document.querySelectorAll(s).forEach((el) => el.setAttribute("data-hl", ""));
  }, selectors);
}
const open = async (page, url, ready) => {
  await page.goto(`${BASE}${url}`, { waitUntil: "networkidle0" });
  if (ready) await page.waitForSelector(ready, { timeout: 8000 });
};
const scrollTo = (page, sel, block = "start") => page.$eval(sel, (el, b) => el.scrollIntoView({ block: b }), block);
const rowsReady = "#reg-table tbody tr";
const regs = `/admin/registrations?event_id=${meta.open.id}`;
const purgeAudit = () => d1Sql("DELETE FROM admin_audit WHERE action <> 'demo'");

// ---- admin screens (signed in as the demo admin) ----
const shots = {
  async dashboard(page, kind) { await open(page, "/admin"); await save(page, "dashboard", kind); },
  async menu(page, kind) {
    await open(page, "/admin");
    await page.click(kind === "phone" ? "#admin-menu" : "#admin-account");
    await sleep(500);
    await save(page, "menu", kind);
  },
  async "events-status"(page, kind) {
    await open(page, "/admin/events");
    await page.evaluate((openTitle, mainTitle) => {
      const rows = [...document.querySelectorAll(".admin-event-list li")];
      rows.find((x) => x.textContent.includes(openTitle))?.querySelector('[data-to="closed"]')?.setAttribute("data-hl", "");
      rows.find((x) => x.textContent.includes(mainTitle))?.querySelector('[data-to="open"]')?.setAttribute("data-hl", "");
    }, meta.open.title, main.title);
    await mark(page, []);
    if (kind === "phone") await scrollTo(page, ".admin-event-list li:nth-child(2)");
    await save(page, "events-status", kind);
  },
  async "events-filter"(page, kind) {
    await open(page, "/admin/events");
    await page.click('input[name="ev-status"][value="closed"]');
    await sleep(300);
    await mark(page, [".ev-filter .segmented", "#event-pager"]);
    if (kind === "phone") { await scrollTo(page, "#events-heading"); await page.evaluate(() => window.scrollBy(0, -90)); }
    await save(page, "events-filter", kind);
  },
  async "events-delete"(page, kind) {
    await open(page, "/admin/events");
    await page.click('input[name="ev-status"][value="draft"]');
    await sleep(300);
    await mark(page, [".admin-icon-btn.is-danger"]);
    if (kind === "phone") { await scrollTo(page, "#events-heading"); await page.evaluate(() => window.scrollBy(0, -90)); }
    await save(page, "events-delete", kind);
  },
  async "event-form"(page, kind) {
    await open(page, `/admin/events?id=${meta.open.id}`);
    if (kind === "phone") await scrollTo(page, "#event-form-panel");
    await save(page, "event-form", kind);
  },
  async "event-date"(page, kind) {
    await open(page, "/admin/events");
    if (kind === "phone") await scrollTo(page, "#event-form-panel");
    await page.click(".date-pick-btn");
    await sleep(400);
    await save(page, "event-date", kind);
  },
  async registrations(page, kind) { await open(page, regs, rowsReady); await save(page, "registrations", kind); },
  async "registrations-search"(page, kind) {
    await open(page, regs, rowsReady);
    await page.type("#reg-search", "ma");
    await sleep(900);
    await save(page, "registrations-search", kind);
  },
  async "guest-add"(page, kind) {
    await open(page, regs, rowsReady);
    await page.click("#add-guest-open");
    await sleep(500);
    await page.type('#admin-reg-form input[name="name"]', "Carlo Mendoza");
    await page.type('#admin-reg-form input[name="mobile"]', "9123 4567");
    await sleep(500);
    await save(page, "guest-add", kind);
  },
  async "guest-suggest"(page, kind) {
    await open(page, regs, rowsReady);
    await page.click("#add-guest-open");
    await sleep(500);
    await page.type('#admin-reg-form input[name="name"]', "Rod");
    await sleep(1000);
    await save(page, "guest-suggest", kind);
  },
  async "guest-attendance"(page, kind) {
    await open(page, regs, rowsReady);
    await page.click("tr.reg-row:nth-child(3)");
    await sleep(600);
    await mark(page, ['[data-attended="1"]']);
    await save(page, "guest-attendance", kind);
  },
  async "guest-details"(page, kind) {
    await open(page, regs, rowsReady);
    await page.click("tr.reg-row:nth-child(3)");
    await sleep(500);
    await page.click("#tab-details");
    await sleep(500);
    await save(page, "guest-details", kind);
  },
  async "guest-remove"(page, kind) {
    await open(page, regs, rowsReady);
    await page.click("tr.reg-row:nth-child(3)");
    await sleep(500);
    await scrollTo(page, ".reg-remove", "center").catch(() => {});
    await mark(page, ["#guest-remove"]);
    await save(page, "guest-remove", kind);
  },
  async export(page, kind) {
    await open(page, regs, rowsReady);
    await page.click("#export-toggle");
    await sleep(400);
    await mark(page, ["#export-toggle"]);
    await save(page, "export", kind);
  },
  async duplicates(page, kind) {
    await open(page, regs, rowsReady);
    await scrollTo(page, "tr.is-conflict", "center");
    await sleep(300);
    await page.click("tr.is-conflict .reg-dupe").catch(() => {});
    await sleep(500);
    await save(page, "duplicates", kind);
  },
  async people(page, kind) { await open(page, "/admin/people"); await save(page, "people", kind); },
  async "people-duplicates"(page, kind) {
    await open(page, "/admin/people");
    await page.click("details.pp-dupes summary");
    await sleep(500);
    await mark(page, [".pp-pairs .btn"]);
    await save(page, "people-duplicates", kind);
  },
  async "people-birthdays"(page, kind) {
    await open(page, "/admin/people");
    await page.select("#pp-month", String(meta.month));
    await sleep(600);
    await save(page, "people-birthdays", kind);
  },
  async person(page, kind) { await open(page, "/admin/people?person=p-003"); await save(page, "person", kind); },
  async "person-merge"(page, kind) {
    await open(page, "/admin/people?person=p-003");
    await scrollTo(page, ".pp-cards");
    await sleep(300);
    await save(page, "person-merge", kind);
  },
  async "report-gathering"(page, kind) { await open(page, `/admin/reports?event_id=${main.id}`); await save(page, "report-gathering", kind); },
  async "report-signups"(page, kind) {
    await open(page, `/admin/reports?event_id=${main.id}`);
    await scrollTo(page, ".report-grid .admin-panel:nth-child(3)");
    await save(page, "report-signups", kind);
  },
  async "report-older"(page, kind) { await open(page, `/admin/reports?event_id=${older.id}`); await save(page, "report-older", kind); },
  async trends(page, kind) { await open(page, "/admin/reports?view=trends&range=all"); await save(page, "trends", kind); },
  async "trends-people"(page, kind) {
    await open(page, "/admin/reports?view=trends&range=all");
    await scrollTo(page, ".report-grid .admin-panel:nth-child(3)");
    await save(page, "trends-people", kind);
  },
  async gallery(page, kind) { await open(page, `/admin/gallery?event_id=${main.id}`); await save(page, "gallery", kind); },
  async "gallery-photos"(page, kind) {
    await open(page, `/admin/gallery?event_id=${main.id}`);
    await scrollTo(page, ".admin-photo-list");
    await mark(page, [".admin-photo-list li:nth-child(2) .admin-photo-delete"]);
    await save(page, "gallery-photos", kind);
  },
  async videos(page, kind) { await open(page, "/admin/videos"); await save(page, "videos", kind); },
  async activity(page, kind) { await open(page, "/admin/activity"); await save(page, "activity", kind); },
  async password(page, kind) { await open(page, "/admin/password"); await save(page, "password", kind); },
};

// ---- screens that need no login (or a different one) ----
const publicShots = {
  async login(page, kind) { await open(page, "/admin/login"); await save(page, "login", kind); },
  async "pub-home-open"(page, kind) { await open(page, "/"); await save(page, "pub-home-open", kind); },
  async "pub-gallery-event"(page, kind) { await open(page, `/gallery/${main.slug}`); await save(page, "pub-gallery-event", kind); },
};

// ---- run ----
fs.mkdirSync(OUT, { recursive: true });
const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ["--hide-scrollbars"] });
const run = async (name, fn, context) => {
  for (const kind of ["desktop", "phone"]) {
    const page = await newView(browser, kind, context);
    try {
      await fn(page, kind);
      console.log("ok  ", name, kind);
    } catch (err) {
      console.log("FAIL", name, kind, String(err.message).split("\n")[0]);
    }
    await page.close();
  }
};

const admin = await browser.createBrowserContext();
const boot = await newView(browser, "desktop", admin);
await login(boot);

// Stand-in photos for the Gallery screens, uploaded the way an organizer would. Skipped once they exist.
async function ensureGallery(eventId, files) {
  const page = await newView(browser, "desktop", admin);
  await open(page, `/admin/gallery?event_id=${eventId}`);
  const have = await page.$$eval(".admin-photo-list li", (li) => li.length);
  if (have === 0) {
    await page.type('input[name="caption"]', "Sunday fellowship");
    await (await page.$("#gallery-files")).uploadFile(...files);
    await Promise.all([page.waitForNavigation({ waitUntil: "networkidle0", timeout: 60000 }).catch(() => {}), page.click('#gallery-form button[type="submit"]')]);
    await sleep(1500);
  }
  await page.close();
}
const photo = (i) => path.join(PHOTOS, `gathering-${String(i).padStart(2, "0")}.jpg`);
await ensureGallery(main.id, Array.from({ length: 12 }, (_, i) => photo(i + 1)));
await ensureGallery(meta.past[3].id, Array.from({ length: 6 }, (_, i) => photo(i + 7)));
purgeAudit();

for (const [name, fn] of Object.entries(shots)) if (want(name)) await run(name, fn, admin);

const anon = await browser.createBrowserContext();
for (const [name, fn] of Object.entries(publicShots)) if (want(name)) await run(name, fn, anon);

if (want("password-first")) {
  const volunteer = await browser.createBrowserContext();
  const first = await newView(browser, "desktop", volunteer);
  await login(first, 2);
  await run("password-first", async (page, kind) => { await open(page, "/admin/password"); await save(page, "password-first", kind); }, volunteer);
}

// What visitors see once nothing is open: close the open event, look, then reopen it.
if (want("pub-home-closed") || want("pub-register-closed") || want("pub-closed")) {
  const setStatus = (to) => boot.evaluate(async (id, status) => {
    const res = await fetch("/api/admin/events/status", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id, status }) });
    return res.ok;
  }, meta.open.id, to);
  await open(boot, "/admin");
  await setStatus("closed");
  try {
    await run("pub-home-closed", async (page, kind) => { await open(page, "/"); await save(page, "pub-home-closed", kind); }, anon);
    await run("pub-register-closed", async (page, kind) => { await open(page, "/register"); await save(page, "pub-register-closed", kind); }, anon);
  } finally {
    await setStatus("open");
  }
}

purgeAudit();
await browser.close();
