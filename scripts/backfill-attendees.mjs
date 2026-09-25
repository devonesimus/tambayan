#!/usr/bin/env node
/**
 * Seed local D1 from ~/Downloads/OFW Attendees.xlsx.
 * Not a migration. Do not pass --remote unless you mean to backfill production.
 *
 * Usage: node scripts/backfill-attendees.mjs
 */
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { inflateRawSync } from "node:zlib";

const remote = process.argv.includes("--remote");
const xlsxPath = join(process.env.HOME || "", "Downloads", "OFW Attendees.xlsx");
const ATTENDED_STYLES = new Set(["19", "20", "21", "29", "30", "31", "32", "33", "37"]);
const MONTHS = [
  ["D", "January", "2026-01-25T14:00:00+08:00"],
  ["E", "February", "2026-02-22T14:00:00+08:00"],
  ["F", "March", "2026-03-29T14:00:00+08:00"],
  ["G", "April", "2026-04-26T14:00:00+08:00"],
  ["H", "May", "2026-05-31T14:00:00+08:00"],
  ["I", "June", "2026-06-28T14:00:00+08:00"],
  ["J", "July", "2026-07-26T14:00:00+08:00"],
  ["K", "August", "2026-08-30T14:00:00+08:00"],
];
const VENUE = "Level 1 Main Auditorium, 798 Thomson Road, Singapore 298186";

function fold(name) {
  return String(name || "")
    .replace(/[\u200B-\u200D\u2060\uFEFF]/g, "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function sqlRequired(value) {
  return `'${String(value || "").replaceAll("'", "''")}'`;
}

function sqlText(value) {
  if (value == null || value === "") return "NULL";
  return `'${String(value).replaceAll("'", "''")}'`;
}

function excelDate(value) {
  const raw = String(value || "").replace(/[\u200B-\u200D\u2060\uFEFF]/g, "").trim();
  if (!raw) return null;
  if (/^\d+(\.\d+)?$/.test(raw)) {
    const date = new Date(Date.UTC(1899, 11, 30) + Number(raw) * 86400000);
    return date.toISOString().slice(0, 10);
  }
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10);
}

function readZip(buf) {
  const files = new Map();
  let offset = 0;
  while (offset < buf.length - 4) {
    const sig = buf.readUInt32LE(offset);
    if (sig !== 0x04034b50) break;
    const method = buf.readUInt16LE(offset + 8);
    const compSize = buf.readUInt32LE(offset + 18);
    const nameLen = buf.readUInt16LE(offset + 26);
    const extraLen = buf.readUInt16LE(offset + 28);
    const name = buf.subarray(offset + 30, offset + 30 + nameLen).toString();
    const start = offset + 30 + nameLen + extraLen;
    const data = buf.subarray(start, start + compSize);
    files.set(name, method === 0 ? data : inflateRawSync(data));
    offset = start + compSize;
  }
  return files;
}

function parseSheet(buf) {
  const files = readZip(buf);
  const ns = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
  const sharedXml = files.get("xl/sharedStrings.xml").toString();
  const shared = [...sharedXml.matchAll(/<si[\s\S]*?<\/si>/g)].map((si) =>
    [...si[0].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((t) => t[1]).join(""),
  );
  const sheet = files.get("xl/worksheets/sheet1.xml").toString();
  const rows = [];
  for (const row of sheet.matchAll(/<row [^>]*>([\s\S]*?)<\/row>/g)) {
    const data = {};
    for (const cell of row[1].matchAll(/<c r="([A-Z]+)\d+"([^>/]*)(\/>|>([\s\S]*?)<\/c>)/g)) {
      const col = cell[1];
      const attrs = cell[2];
      const inner = cell[4] || "";
      const style = /(?:^|\s)s="(\d+)"/.exec(attrs)?.[1] || "";
      const type = /(?:^|\s)t="([^"]+)"/.exec(attrs)?.[1] || "";
      const value = /<v>([\s\S]*?)<\/v>/.exec(inner)?.[1] || "";
      data[col] = { text: type === "s" ? shared[Number(value)] || "" : value, style };
    }
    if (data.A?.text && data.A.text !== "NAME") rows.push(data);
  }
  return rows;
}

function d1(command) {
  const args = ["wrangler", "d1", "execute", "tambayan-db", remote ? "--remote" : "--local", "--json", "--command", command];
  const out = execFileSync("npx", args, { encoding: "utf8" });
  const start = out.indexOf("[");
  return JSON.parse(out.slice(start));
}

const rows = parseSheet(readFileSync(xlsxPath));
const existingPeople = d1("SELECT id, name FROM people")[0].results;
const existingEvents = d1("SELECT id, held_at FROM events")[0].results;
const byName = new Map(existingPeople.map((person) => [fold(person.name), person.id]));

const statements = [];
const monthEvent = new Map();
for (const [col, label, heldAt] of MONTHS) {
  const month = heldAt.slice(0, 7);
  const found = existingEvents.find((event) => String(event.held_at).startsWith(month));
  const id = found?.id || `evt-${label.toLowerCase()}-2026`;
  monthEvent.set(col, id);
  if (!found) {
    statements.push(
      `INSERT INTO events (id, slug, title, held_at, address, announcement_body, status) VALUES (${sqlText(id)}, ${sqlText(`${label.toLowerCase()}-2026`)}, ${sqlText(`OFW Tambayan — ${label} 2026`)}, ${sqlText(heldAt)}, ${sqlText(VENUE)}, '', 'closed');`,
    );
  }
}

let created = 0;
let linked = 0;
let attendance = 0;
const newPeople = [];
for (const row of rows) {
  const name = String(row.A.text).replace(/[\u200B-\u200D\u2060\uFEFF]/g, "").trim().replace(/\s+/g, " ");
  const key = fold(name);
  let id = byName.get(key);
  const mobileRaw = String(row.B?.text || "").replace(/[\u200B-\u200D\u2060\uFEFF]/g, "").replace(/\D/g, "");
  const mobile = mobileRaw.length >= 8 ? mobileRaw : "";
  const birth = excelDate(row.C?.text);
  const joined = excelDate(row.P?.text);
  const carer = String(row.Q?.text || "").trim();
  if (id) {
    linked += 1;
    statements.push(
      `UPDATE people SET mobile = COALESCE(NULLIF(mobile, ''), ${sqlText(mobile)}), birth_date = COALESCE(birth_date, ${sqlText(birth)}), joined_on = COALESCE(joined_on, ${sqlText(joined)}), carer_name = COALESCE(NULLIF(carer_name, ''), ${sqlText(carer)}) WHERE id = ${sqlText(id)};`,
    );
    statements.push(`UPDATE registrations SET person_id = ${sqlText(id)} WHERE person_id IS NULL AND lower(trim(name)) = ${sqlText(key)};`);
  } else {
    id = crypto.randomUUID();
    byName.set(key, id);
    created += 1;
    newPeople.push({ id, name, carer });
    statements.push(
      `INSERT INTO people (id, name, mobile, birth_date, joined_on, carer_name, created_at) VALUES (${sqlText(id)}, ${sqlText(name)}, ${sqlText(mobile)}, ${sqlText(birth)}, ${sqlText(joined)}, ${sqlText(carer)}, datetime('now'));`,
    );
  }
  for (const [col] of MONTHS) {
    if (!ATTENDED_STYLES.has(row[col]?.style || "")) continue;
    const eventId = monthEvent.get(col);
    const regId = crypto.randomUUID();
    attendance += 1;
    statements.push(
      `INSERT INTO registrations (id, event_id, name, mobile, source, attended, person_id, created_at)
       SELECT ${sqlText(regId)}, ${sqlText(eventId)}, ${sqlText(name)}, ${sqlRequired(mobile)}, 'import', 1, ${sqlText(id)}, datetime('now')
       WHERE NOT EXISTS (SELECT 1 FROM registrations WHERE person_id = ${sqlText(id)} AND event_id = ${sqlText(eventId)});`,
    );
  }
}

for (const person of newPeople) {
  if (!person.carer || /[/]/.test(person.carer) || person.carer.split(/\s{2,}|,/).length > 3) continue;
  const carerId = byName.get(fold(person.carer));
  if (carerId && carerId !== person.id) {
    statements.push(`UPDATE people SET carer_id = ${sqlText(carerId)} WHERE id = ${sqlText(person.id)} AND carer_id IS NULL;`);
  }
}
const file = join(mkdtempSync(join(tmpdir(), "tambayan-seed-")), "seed.sql");
writeFileSync(file, statements.join("\n"));
execFileSync("npx", ["wrangler", "d1", "execute", "tambayan-db", remote ? "--remote" : "--local", "--file", file], {
  stdio: "inherit",
});
console.log(`People created ${created}, linked ${linked}, attendance rows ${attendance}`);
