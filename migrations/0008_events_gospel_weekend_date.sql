-- Optional: this event's date is also one day of the FSDAC Gospel Weekend (Thu 8 - Sun 11 Oct
-- 2026), run by a sibling church site (pinoy-rag-agent, gospelweekend.fsdac.app). When set, a
-- public sign-up for this event also registers that day's attendance there, over a private
-- Worker-to-Worker call (see src/gospel-weekend-sync.ts). NULL for every ordinary gathering.
ALTER TABLE events ADD COLUMN gospel_weekend_date TEXT;
