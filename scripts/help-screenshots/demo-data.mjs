// Fake demo data for the Help screenshots. Every name and number is invented.
// Dates follow the day this runs, so an "open" event is always still ahead and the screens stay consistent.
import { STATE_DIR } from "./common.mjs";
import fs from "node:fs";
import path from "node:path";

let seed = 20260927;
const rand = () => {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const q = (s) => (s == null ? "NULL" : `'${String(s).replace(/'/g, "''")}'`);

// [name, tier]  R regular, M sometimes, O occasional, D drifted (came early on, not lately)
const roster = [
  ["Maricel Dela Cruz", "R"], ["Rodel Bautista", "R"], ["Jocelyn Ramos", "R"], ["Ronnie Villanueva", "R"],
  ["Evelyn Santos", "R"], ["Arnel Mercado", "R"], ["Liza Manalo", "R"], ["Jerome Castillo", "R"],
  ["Marites Aquino", "R"], ["Danilo Pascual", "R"], ["Cristina Reyes", "R"], ["Emmanuel Domingo", "R"],
  ["Rowena Flores", "M"], ["Gerald Navarro", "M"], ["Analyn Soriano", "M"], ["Benjie Corpuz", "M"],
  ["Lorna Garcia", "M"], ["Mark Anthony Tolentino", "M"], ["Shiela Mae Ocampo", "M"], ["Rey Delos Santos", "M"],
  ["Nenita Cruz", "M"], ["Joel Salazar", "M"], ["Grace Lim", "M"], ["Michelle Hernandez", "M"],
  ["Ferdinand Yap", "M"], ["Clarissa Abad", "M"], ["Noel Panganiban", "O"], ["Josephine Andrada", "O"],
  ["Ramil Cabrera", "O"], ["Teresita Magno", "O"], ["Jun-Jun Estrada", "O"], ["Angelica Velasco", "O"],
  ["Roderick Sison", "O"], ["Precious Mendoza", "O"], ["Allan Buenaventura", "O"], ["Dolores Tan", "O"],
  ["Wilfredo Lacson", "D"], ["Kristine Joy Alonzo", "D"], ["Erwin Bernardo", "D"], ["Maribel Estacio", "D"],
  ["Cynthia Robles", "D"], ["Joey Macaraeg", "D"],
  // near-duplicates, for the People review screens
  ["Joselyn Ramos", "O"], ["Ronnie Villanueva Jr", "O"],
];
const people = roster.map(([name, tier], i) => {
  const id = `p-${String(i + 1).padStart(3, "0")}`;
  const mobile = i % 9 === 4 ? null : `${i % 2 ? 8 : 9}${String(100 + i * 7).padStart(3, "0")}${String(4000 + i * 13).slice(-4)}`;
  const first = name.split(" ")[0].toLowerCase().replace(/[^a-z]/g, "");
  const last = name.split(" ").pop().toLowerCase().replace(/[^a-z]/g, "");
  const email = i % 3 === 0 ? `${first}.${last}@example.com` : null;
  const month = 1 + ((i * 5) % 12);
  const birth = i % 5 === 1 ? null : `${1978 + (i % 20)}-${String(month).padStart(2, "0")}-${String(3 + ((i * 3) % 24)).padStart(2, "0")}`;
  const joined = i < 26 ? `${2024 + (i % 2)}-${String(1 + (i % 12)).padStart(2, "0")}-${String(10 + (i % 15)).padStart(2, "0")}` : null;
  const carer = i % 4 === 2 ? roster[(i + 5) % 12][0] : null;
  return { id, name, tier, mobile, email, birth, joined, carer };
});
for (const p of people.slice(-2)) Object.assign(p, { mobile: null, email: null, birth: null, joined: null, carer: null });

// ---- Dates, all in Singapore time and relative to today ----
const now = new Date();
const nowIso = now.toISOString();
const sgToday = new Date(now.getTime() + 8 * 3600e3).toISOString().slice(0, 10);
const shiftDay = (ymd, days) => {
  const d = new Date(`${ymd}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};
const lastSunday = (year, month0) => {
  const d = new Date(Date.UTC(year, month0 + 1, 0));
  d.setUTCDate(d.getUTCDate() - d.getUTCDay());
  return d.toISOString().slice(0, 10);
};
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const titleFor = (ymd) => `OFW Tambayan — ${MONTHS[Number(ymd.slice(5, 7)) - 1]} ${ymd.slice(0, 4)}`;
const shortFor = (ymd) => `${MONTHS[Number(ymd.slice(5, 7)) - 1].slice(0, 3)} ${ymd.slice(0, 4)}`;

const sundays = [];
const [ty, tm] = [Number(sgToday.slice(0, 4)), Number(sgToday.slice(5, 7)) - 1];
for (let offset = -8; offset <= 3; offset++) {
  const d = new Date(Date.UTC(ty, tm + offset, 1));
  sundays.push(lastSunday(d.getUTCFullYear(), d.getUTCMonth()));
}
const past = sundays.filter((s) => s <= sgToday).slice(-6);
const ahead = sundays.filter((s) => s > sgToday);
const VENUE = "Level 1 Main Auditorium, 798 Thomson Road, Singapore 298186";

const events = [
  ...past.map((held, i) => ({
    id: `evt-past-${i + 1}`, held, title: titleFor(held), status: "closed",
    tracked: i < 3 ? 0 : 1, kind: i < 3 ? "import" : "done",
  })),
  {
    id: "evt-open", held: ahead[0], title: titleFor(ahead[0]), status: "open", tracked: 1, kind: "open",
    ann_t: "Join us this Sunday at OFW Tambayan",
    ann_b: "Every last Sunday, 2–4 PM. Come for fellowship, worship, and a shared merienda with fellow OFWs in Singapore.",
  },
  { id: "evt-draft", held: ahead[1], title: titleFor(ahead[1]), status: "draft", tracked: 1, kind: "draft" },
];

const chance = {
  R: [0.9, 0.85, 0.9, 0.85, 0.9, 0.9, 0.9],
  M: [0.45, 0.55, 0.5, 0.5, 0.45, 0.5, 0.5],
  O: [0.15, 0.2, 0.15, 0.25, 0.2, 0.3, 0.3],
  D: [0.8, 0.7, 0.75, 0, 0, 0, 0.05],
};
const clampNow = (iso) => (iso > nowIso ? nowIso : iso);
const regs = [];
events.forEach((ev, ei) => {
  if (ev.kind === "draft") return;
  people.forEach((p, pi) => {
    if (p.tier === "O" && pi >= 42 && ei < 4) return; // the near-duplicates only show up recently
    if (rand() > chance[p.tier][ei]) return;
    let src = ev.kind === "import" ? "import" : "public";
    if (ev.kind === "done" && rand() < 0.12) src = "admin";
    let created;
    if (src === "import") created = `${ev.held}T06:00:00.000Z`;
    else if (src === "admin") created = `${ev.held}T06:${String(10 + Math.floor(rand() * 40))}:00.000Z`;
    else {
      const base = ev.held <= sgToday ? ev.held : sgToday;
      const back = Math.round(Math.pow(rand(), 1.8) * 20) + 1;
      created = `${shiftDay(base, -back)}T${String(1 + Math.floor(rand() * 13)).padStart(2, "0")}:${String(Math.floor(rand() * 60)).padStart(2, "0")}:00.000Z`;
    }
    created = clampNow(created);
    const attended = ev.kind === "open" ? 0 : ev.kind === "import" ? (rand() < 0.5 ? 1 : 0) : (src === "admin" || rand() < 0.86 ? 1 : 0);
    regs.push({ id: `r-${ev.id}-${p.id}`, ev, p, src, created, attended });
  });
});

let sql = `-- Fake demo data for the Help screenshots. Every name and number is invented.\n`;
sql += `DELETE FROM registrations; DELETE FROM people; DELETE FROM events; DELETE FROM admin_audit; DELETE FROM person_links; DELETE FROM gallery_images; DELETE FROM videos;\n`;
for (const e of events) {
  sql += `INSERT INTO events (id, slug, title, held_at, status, address, announcement_title, announcement_body, attendance_tracked, created_at) VALUES (${q(e.id)}, ${q(e.held)}, ${q(e.title)}, ${q(`${e.held}T14:00:00+08:00`)}, ${q(e.status)}, ${q(VENUE)}, ${q(e.ann_t)}, ${q(e.ann_b || "")}, ${e.tracked}, ${q(shiftDay(e.held, -40) + " 02:00:00")});\n`;
}
for (const p of people) {
  sql += `INSERT INTO people (id, name, mobile, email, birth_date, joined_on, carer_name, created_at) VALUES (${q(p.id)}, ${q(p.name)}, ${q(p.mobile)}, ${q(p.email)}, ${q(p.birth)}, ${q(p.joined)}, ${q(p.carer)}, '2026-03-01 00:00:00');\n`;
}
for (const r of regs) {
  sql += `INSERT INTO registrations (id, event_id, name, email, mobile, privacy_policy_agreed_at, source, person_id, attended, created_at) VALUES (${q(r.id)}, ${q(r.ev.id)}, ${q(r.p.name)}, ${q(r.p.email)}, ${q(r.p.mobile || "")}, ${r.src === "public" ? q(r.created) : "NULL"}, ${q(r.src)}, ${q(r.p.id)}, ${r.attended}, ${q(r.created)});\n`;
}
const A = "admin@example.com";
const B = "leah.santos@example.com";
const at = (daysAgo, hhmm) => clampNow(`${shiftDay(sgToday, -daysAgo)}T${hhmm}:00.000Z`);
const openTitle = events.find((e) => e.kind === "open").title;
const photoEvent = past[4];
const audit = [
  [at(21, "02:10"), B, "Signed in"],
  [at(21, "02:14"), B, `Created event ${openTitle}`],
  [at(21, "02:16"), B, `Set ${openTitle} to Open`],
  [at(14, "11:40"), A, "Signed in"],
  [at(14, "11:43"), A, `Uploaded 12 photos to ${shortFor(photoEvent)}`],
  [at(7, "09:05"), B, "Signed in"],
  [at(7, "09:12"), B, "Added short Welcome to OFW Tambayan"],
  [at(2, "13:30"), A, "Signed in"],
  [at(2, "13:34"), A, `Updated event ${openTitle}`],
  [at(1, "10:02"), B, "Signed in"],
];
audit.forEach(([t, a, s], i) => {
  sql += `INSERT INTO admin_audit (id, created_at, actor, action, summary) VALUES ('a-${i}', ${q(t)}, ${q(a)}, 'demo', ${q(s)});\n`;
});
[["Welcome to OFW Tambayan", "demoWelcome01"], ["Sunday fellowship highlights", "demoHighlt02"], ["Sharing our stories", "demoStories03"]].forEach(([t, id], i) => {
  sql += `INSERT INTO videos (id, title, youtube_url, sort_order) VALUES ('v-${i}', ${q(t)}, ${q(`https://www.youtube.com/shorts/${id}`)}, ${i});\n`;
});

fs.mkdirSync(STATE_DIR, { recursive: true });
fs.writeFileSync(path.join(STATE_DIR, "demo-data.sql"), sql);
const brief = (e) => ({ id: e.id, slug: e.held, title: e.title, short: shortFor(e.held), tracked: e.tracked === 1 });
fs.writeFileSync(
  path.join(STATE_DIR, "meta.json"),
  JSON.stringify({
    today: sgToday,
    month: Number(sgToday.slice(5, 7)),
    open: brief(events.find((e) => e.kind === "open")),
    draft: brief(events.find((e) => e.kind === "draft")),
    past: events.filter((e) => e.kind === "import" || e.kind === "done").map(brief),
  }, null, 2),
);
console.log(`${people.length} people, ${regs.length} registrations, ${events.length} events (open: ${events.find((e) => e.kind === "open").held})`);
