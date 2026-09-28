/**
 * Mirrors a Tambayan sign-up into the Gospel Weekend site (pinoy-rag-agent, gospelweekend.fsdac.app)
 * for the one gathering each year whose date doubles as a day of that four-day event. Reaches it
 * over a Cloudflare Service Binding (wrangler.jsonc: services -> GOSPEL_WEEKEND) — a private,
 * account-internal call, not a public HTTPS request — but the route on the other end still checks
 * a shared secret regardless, since a Service Binding is a transport choice, not the boundary.
 *
 * This is intentionally best-effort: a Tambayan registration must always succeed even if this call
 * fails or the sibling Worker is down. Callers should record a failure (see recordAudit) rather
 * than surface it to the guest.
 */
import { recordAudit } from "./helpers";

/** Kept in sync by hand with GOSPEL_WEEKEND_EVENT_DATES in the pinoy-rag-agent repo. */
export const GOSPEL_WEEKEND_DATES = ["Oct 8", "Oct 9", "Oct 10", "Oct 11"] as const;
export type GospelWeekendDate = (typeof GOSPEL_WEEKEND_DATES)[number];

export function isGospelWeekendDate(value: string): value is GospelWeekendDate {
  return (GOSPEL_WEEKEND_DATES as readonly string[]).includes(value);
}

export type SyncResult =
  | { ok: true; synced: true; id: string; action: "created" | "updated" }
  | { ok: true; synced: false }
  | { ok: false; error: string };

/** Reports synced: false (as ok) when the event isn't a Gospel Weekend day. */
export async function syncGospelWeekendAttendance(
  env: Env,
  gospelWeekendDate: string | null,
  guest: { name: string; email: string | null; mobile: string },
): Promise<SyncResult> {
  if (!gospelWeekendDate) return { ok: true, synced: false };
  if (!env.GOSPEL_WEEKEND) return { ok: false, error: "GOSPEL_WEEKEND service binding is not configured" };

  try {
    const res = await env.GOSPEL_WEEKEND.fetch("https://gospelweekend.fsdac.app/api/internal/attendance", {
      method: "POST",
      headers: { "content-type": "application/json", "x-tambayan-token": env.TAMBAYAN_SYNC_TOKEN || "" },
      body: JSON.stringify({
        name: guest.name,
        mobile: guest.mobile,
        email: guest.email || "",
        attendanceDate: gospelWeekendDate,
      }),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      return { ok: false, error: `HTTP ${res.status}${detail ? `: ${detail.slice(0, 200)}` : ""}` };
    }
    const data = (await res.json()) as { id: string; action: "created" | "updated" };
    return { ok: true, synced: true, id: data.id, action: data.action };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Fires the sync, records the returned Gospel Weekend id on this Tambayan registration so a
 * later removal can find it again, and — on failure only — leaves a trail an admin will see on
 * Activity/Dashboard.
 */
export async function syncGospelWeekendAttendanceAndLog(
  env: Env,
  event: { id: string; title: string; gospel_weekend_date: string | null },
  registrationId: string,
  guest: { name: string; email: string | null; mobile: string },
): Promise<void> {
  if (!event.gospel_weekend_date) return;
  const result = await syncGospelWeekendAttendance(env, event.gospel_weekend_date, guest);
  if (!result.ok) {
    console.error("Gospel Weekend sync failed", { eventId: event.id, error: result.error });
    await recordAudit(env, {
      actor: "system",
      action: "gospel_weekend.sync_failed",
      targetId: event.id,
      summary: `Could not register ${guest.name} for ${event.gospel_weekend_date} on Gospel Weekend (${event.title}): ${result.error}`,
    });
    return;
  }
  if (result.synced) {
    await env.DB.prepare(`UPDATE registrations SET gospel_weekend_registration_id = ? WHERE id = ?`)
      .bind(result.id, registrationId)
      .run();
  }
}

/** No-ops (as ok) when the binding isn't configured — same best-effort contract as the sync above. */
async function deleteGospelWeekendAttendance(
  env: Env,
  gospelWeekendRegistrationId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!env.GOSPEL_WEEKEND) return { ok: false, error: "GOSPEL_WEEKEND service binding is not configured" };

  try {
    const res = await env.GOSPEL_WEEKEND.fetch("https://gospelweekend.fsdac.app/api/internal/attendance", {
      method: "DELETE",
      headers: { "content-type": "application/json", "x-tambayan-token": env.TAMBAYAN_SYNC_TOKEN || "" },
      body: JSON.stringify({ id: gospelWeekendRegistrationId }),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      return { ok: false, error: `HTTP ${res.status}${detail ? `: ${detail.slice(0, 200)}` : ""}` };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * The un-sync counterpart to syncGospelWeekendAttendanceAndLog, for when an admin removes a
 * registration that had previously synced. A registration with no stored
 * gospel_weekend_registration_id is a silent no-op — it either never synced (the event wasn't a
 * Gospel Weekend day at the time, or the earlier sync failed) or the event isn't linked to a
 * Gospel Weekend day now, and there is nothing to reach on the other end either way.
 */
export async function unsyncGospelWeekendAttendanceAndLog(
  env: Env,
  event: { id: string; title: string; gospel_weekend_date: string | null },
  registration: { name: string; gospel_weekend_registration_id: string | null },
): Promise<void> {
  if (!event.gospel_weekend_date || !registration.gospel_weekend_registration_id) return;
  const result = await deleteGospelWeekendAttendance(env, registration.gospel_weekend_registration_id);
  if (!result.ok) {
    console.error("Gospel Weekend un-sync failed", { eventId: event.id, error: result.error });
    await recordAudit(env, {
      actor: "system",
      action: "gospel_weekend.unsync_failed",
      targetId: event.id,
      summary: `Could not remove ${registration.name} from ${event.gospel_weekend_date} on Gospel Weekend (${event.title}): ${result.error}`,
    });
  }
}
