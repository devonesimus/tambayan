"""Put several screens side by side (computer left, phone right) to review them at a glance.
   python3 scripts/help-screenshots/contact-sheet.py sheet.jpg dashboard menu events-status"""
import sys, os
from PIL import Image
D = os.path.join(os.path.dirname(__file__), "../../public/help")
out, names = sys.argv[1], sys.argv[2:]
rows = []
for n in names:
    a = Image.open(f"{D}/{n}-desktop.webp").convert("RGB")
    b = Image.open(f"{D}/{n}-phone.webp").convert("RGB")
    a = a.resize((880, int(a.height * 880 / a.width)))
    b = b.resize((300, int(b.height * 300 / b.width)))
    rows.append((a, b))
sheet = Image.new("RGB", (880 + 300 + 48, sum(max(a.height, b.height) + 16 for a, b in rows)), (200, 200, 205))
y = 8
for a, b in rows:
    sheet.paste(a, (8, y))
    sheet.paste(b, (880 + 24, y))
    y += max(a.height, b.height) + 16
sheet.save(out, quality=88)
