-- Attendance was only taken from the September 2026 gathering. Earlier gatherings hold a guest list that was
-- imported from a spreadsheet, so their "attended" flags say nothing about who actually came.
-- Reports use this column to show a guest-list size for those gatherings and real attendance for the rest.
ALTER TABLE events ADD COLUMN attendance_tracked INTEGER NOT NULL DEFAULT 1;

-- A gathering whose registrations are all imported has no real attendance record.
UPDATE events
SET attendance_tracked = 0
WHERE id IN (
  SELECT event_id FROM registrations
  GROUP BY event_id
  HAVING SUM(CASE WHEN source != 'import' THEN 1 ELSE 0 END) = 0
);
