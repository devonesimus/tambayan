/* Builds the Trends report as a PowerPoint deck. Runs in the browser for the real export, and under Node so a
   sample deck can be rendered and reviewed. Numbers come from /admin/reports.json, the same ones shown on screen. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.TambayanDeck = factory();
})(typeof self !== "undefined" ? self : this, function () {
  // Brand colours, and fonts that exist on every computer, since the site's own fonts cannot travel inside a deck.
  const C = {
    navy: "27346B", deep: "1B2555", orange: "EAA12F", ink: "1A1F2E", muted: "5C6578",
    line: "E3E6EE", paper: "F7F8FB", white: "FFFFFF", soft: "C9D0E6", grey: "B9B4AA", zebra: "F1F3F9",
  };
  const HEAD = "Georgia";
  const BODY = "Calibri";
  const M = 0.7; // side margin, inches
  const W = 13.333;
  const CONTENT_W = W - M * 2;

  const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
  const shadow = () => ({ type: "outer", color: C.navy, opacity: 0.1, blur: 8, offset: 2, angle: 90 });

  function build(PptxGenJS, data, opts) {
    const options = opts || {};
    data = Object.assign({}, data, { period: String(data.period).replace(/^(.+?) – \1$/, "$1") });
    const pptx = new PptxGenJS();
    pptx.layout = "LAYOUT_WIDE";
    pptx.author = "OFW Tambayan SG";
    pptx.company = "OFW Tambayan SG";
    pptx.title = `Gathering report, ${data.period}`;
    pptx.subject = "How gatherings are doing over time";
    const shape = pptx.ShapeType;

    const footer = `OFW Tambayan SG  ·  Gathering report  ·  ${data.period}`;
    pptx.defineSlideMaster({ title: "COVER", background: { color: C.navy } });
    pptx.defineSlideMaster({
      title: "CONTENT",
      background: { color: C.paper },
      objects: [
        { rect: { x: M, y: 0, w: 0.9, h: 0.09, fill: { color: C.orange }, line: { color: C.orange, width: 0 } } },
        { line: { x: M, y: 6.98, w: CONTENT_W, h: 0, line: { color: C.line, width: 0.75 } } },
        { text: { text: footer, options: { x: M, y: 7.03, w: 9, h: 0.3, fontFace: BODY, fontSize: 9, color: C.muted, margin: 0, valign: "middle" } } },
      ],
      slideNumber: { x: W - M - 0.8, y: 7.03, w: 0.8, h: 0.3, fontFace: BODY, fontSize: 9, color: C.muted, align: "right" },
    });

    const heading = (slide, title, subtitle) => {
      slide.addText(title, { x: M, y: 0.5, w: CONTENT_W, h: 0.7, fontFace: HEAD, fontSize: 30, bold: true, color: C.navy, margin: 0, valign: "top" });
      slide.addShape(shape.rect, { x: M, y: 1.26, w: 0.75, h: 0.06, fill: { color: C.orange }, line: { color: C.orange, width: 0 } });
      if (subtitle) slide.addText(subtitle, { x: M, y: 1.42, w: CONTENT_W, h: 0.4, fontFace: BODY, fontSize: 14, color: C.muted, margin: 0, valign: "top" });
    };
    const card = (slide, x, y, w, h) =>
      slide.addShape(shape.roundRect, { x, y, w, h, rectRadius: 0.12, fill: { color: C.white }, line: { color: C.line, width: 0.75 }, shadow: shadow() });
    const kicker = (slide, text, x, y, w) =>
      slide.addText(text.toUpperCase(), { x, y, w, h: 0.3, fontFace: BODY, fontSize: 10.5, bold: true, color: C.muted, charSpacing: 2, margin: 0, valign: "middle" });

    const s = data.summary;
    const grainNoun = data.grain === "month" ? "month" : data.grain === "year" ? "year" : "gathering";

    // 1. Cover
    {
      const slide = pptx.addSlide({ masterName: "COVER" });
      slide.addShape(shape.ellipse, { x: 8.7, y: -2.3, w: 7.2, h: 7.2, fill: { color: C.orange, transparency: 88 }, line: { color: C.orange, width: 0, transparency: 100 } });
      slide.addShape(shape.ellipse, { x: 10.4, y: 3.3, w: 5.4, h: 5.4, fill: { color: C.soft, transparency: 92 }, line: { color: C.soft, width: 0, transparency: 100 } });
      if (options.logo) slide.addImage({ data: options.logo, x: M, y: 0.7, w: 2.3, h: 2.3 * (369 / 640), altText: "OFW Tambayan" });
      slide.addText("Gathering report", { x: M, y: 2.7, w: 9, h: 1.1, fontFace: HEAD, fontSize: 48, bold: true, color: C.white, margin: 0, valign: "middle" });
      slide.addShape(shape.rect, { x: M, y: 3.95, w: 0.9, h: 0.07, fill: { color: C.orange }, line: { color: C.orange, width: 0 } });
      slide.addText(data.period, { x: M, y: 4.2, w: 9, h: 0.5, fontFace: BODY, fontSize: 24, color: C.orange, margin: 0, valign: "middle" });
      slide.addText(`${plural(s.gatherings, "gathering", "gatherings")}  ·  Prepared ${data.generated}`, { x: M, y: 4.75, w: 9, h: 0.4, fontFace: BODY, fontSize: 15, color: C.soft, margin: 0, valign: "middle" });
      slide.addText("OFW TAMBAYAN SG", { x: M, y: 6.6, w: 6, h: 0.3, fontFace: BODY, fontSize: 11, bold: true, color: C.soft, charSpacing: 4, margin: 0, valign: "middle" });
      slide.addNotes("How gatherings are doing over the chosen period. The numbers match the Trends page in the admin.");
    }

    // 2. At a glance
    {
      const slide = pptx.addSlide({ masterName: "CONTENT" });
      heading(slide, "At a glance", `${data.period}  ·  ${plural(s.gatherings, "gathering", "gatherings")}`);
      const cards = [
        { label: "Average guests", value: String(s.averageGuests), hint: data.anyUntracked ? "per gathering, on the guest list" : "per gathering" },
        { label: "Different people", value: String(s.differentPeople), hint: "across the period" },
        { label: "Returning share", value: s.returningShare === null ? "—" : `${s.returningShare}%`, hint: data.hasBaseline ? "excludes the first gathering on record" : "of guests had been before" },
      ];
      if (s.showUp) cards.push({ label: "Show-up", value: `${s.showUp.rate}%`, hint: `${plural(s.showUp.gatherings, "gathering", "gatherings")} with attendance` });
      if (s.busiest) cards.push({ label: "Busiest", value: String(s.busiest.guests), hint: s.busiest.title });
      const gap = 0.25;
      const w = (CONTENT_W - gap * (cards.length - 1)) / cards.length;
      cards.forEach((k, i) => {
        const x = M + i * (w + gap);
        card(slide, x, 2.1, w, 2.55);
        slide.addShape(shape.rect, { x: x + 0.3, y: 2.42, w: 0.4, h: 0.05, fill: { color: C.orange }, line: { color: C.orange, width: 0 } });
        kicker(slide, k.label, x + 0.3, 2.56, w - 0.5);
        slide.addText(k.value, { x: x + 0.3, y: 3.05, w: w - 0.5, h: 1.0, fontFace: HEAD, fontSize: 44, bold: true, color: C.navy, margin: 0, valign: "middle" });
        slide.addText(k.hint, { x: x + 0.3, y: 4.05, w: w - 0.5, h: 0.5, fontFace: BODY, fontSize: 11.5, color: C.muted, margin: 0, valign: "top" });
      });
      const parts = [
        `Across ${plural(s.gatherings, "gathering", "gatherings")}, ${s.averageGuests} ${s.averageGuests === 1 ? "guest was" : "guests were"} on the guest list on average.`,
      ];
      if (s.returningShare !== null) parts.push(`${s.returningShare}% of guests had been before.`);
      if (s.showUp) parts.push(`Of those who registered, ${s.showUp.rate}% came.`);
      slide.addShape(shape.rect, { x: M, y: 5.2, w: 0.06, h: 1.05, fill: { color: C.orange }, line: { color: C.orange, width: 0 } });
      slide.addText(parts.join(" "), { x: M + 0.3, y: 5.2, w: CONTENT_W - 0.3, h: 1.05, fontFace: BODY, fontSize: 18, color: C.ink, margin: 0, valign: "middle" });
      slide.addNotes("Average = guests on the list per gathering. Returning share leaves out the first gathering on record, when everyone looks new only because nothing came before. Show-up = came as a share of registered, for gatherings where attendance was marked.");
    }

    // 3. Guests on the list
    {
      const slide = pptx.addSlide({ masterName: "CONTENT" });
      const sub =
        data.grain === "gathering"
          ? "Returning and first-time guests at each gathering"
          : `Returning and first-time guests by ${grainNoun}, totalled across each ${grainNoun}'s gatherings`;
      heading(slide, "Guests on the list", sub);
      const labels = data.buckets.map((b) => b.label);
      const series = [
        { name: "Returning", labels, values: data.buckets.map((b) => b.returning) },
        { name: "First time", labels, values: data.buckets.map((b) => Math.max(0, b.firstTime - Math.min(b.baselineGuests, b.firstTime))) },
      ];
      const colors = [C.navy, C.orange];
      if (data.buckets.some((b) => b.baselineGuests > 0)) {
        series.push({ name: "First gathering on record", labels, values: data.buckets.map((b) => Math.min(b.baselineGuests, b.firstTime)) });
        colors.push(C.grey);
      }
      const few = data.buckets.length <= 8;
      slide.addChart(pptx.charts.BAR, series, {
        x: M, y: 1.95, w: CONTENT_W, h: 4.3, barDir: "col", barGrouping: "stacked", barGapWidthPct: 55,
        chartColors: colors, showLegend: true, legendPos: "b", legendFontFace: BODY, legendFontSize: 11, legendColor: C.muted,
        catAxisLabelFontFace: BODY, catAxisLabelFontSize: 10.5, catAxisLabelColor: C.muted, catAxisLineShow: true,
        valAxisLabelFontFace: BODY, valAxisLabelFontSize: 10.5, valAxisLabelColor: C.muted, valAxisLineShow: false, valAxisMinVal: 0,
        valGridLine: { color: C.line, size: 0.75 }, catGridLine: { style: "none" },
        showValue: few, dataLabelColor: C.white, dataLabelFontFace: BODY, dataLabelFontSize: 10.5, dataLabelFormatCode: "#,##0;;;",
        altText: `Guests on the list for ${plural(data.buckets.length, grainNoun, grainNoun + "s")}, split into returning and first time.`,
      });
      const notes = [];
      if (data.grain !== "gathering") notes.push(`Bars are totals for each ${grainNoun}. The average per gathering is in the table at the end.`);
      if (data.hasBaseline) notes.push("The first gathering on record is grey: everyone looks new only because nothing came before it.");
      if (data.anyUntracked) notes.push(`Attendance was only taken from ${data.attendanceFrom || "now"} on. Earlier gatherings show the guest list from the spreadsheet, not a headcount.`);
      if (notes.length) slide.addText(notes.join("  "), { x: M, y: 6.35, w: CONTENT_W, h: 0.5, fontFace: BODY, fontSize: 10.5, italic: true, color: C.muted, margin: 0, valign: "top" });
      slide.addNotes("Returning = on the list at an earlier gathering. First time = the first time we have seen them.");
    }

    // 4. Who actually came
    {
      const slide = pptx.addSlide({ masterName: "CONTENT" });
      heading(slide, "Who actually came", "The guest list next to the guests marked as attended");
      if (data.pairs.length) {
        const labels = data.pairs.map((p) => p.label);
        slide.addChart(
          pptx.charts.BAR,
          [
            { name: "On the list", labels, values: data.pairs.map((p) => p.listed) },
            { name: "Came", labels, values: data.pairs.map((p) => p.attended) },
          ],
          {
            x: M, y: 1.95, w: 8.7, h: 4.45, barDir: "col", barGrouping: "clustered", barGapWidthPct: 60,
            chartColors: [C.soft, C.navy], showLegend: true, legendPos: "b", legendFontFace: BODY, legendFontSize: 11, legendColor: C.muted,
            catAxisLabelFontFace: BODY, catAxisLabelFontSize: 10.5, catAxisLabelColor: C.muted,
            valAxisLabelFontFace: BODY, valAxisLabelFontSize: 10.5, valAxisLabelColor: C.muted, valAxisLineShow: false, valAxisMinVal: 0,
            valGridLine: { color: C.line, size: 0.75 }, catGridLine: { style: "none" },
            showValue: data.pairs.length <= 8, dataLabelColor: C.ink, dataLabelFontFace: BODY, dataLabelFontSize: 10.5, dataLabelPosition: "outEnd",
            altText: "On the list compared with came, for each gathering where attendance was marked.",
          },
        );
        const x = M + 9.05;
        const w = CONTENT_W - 9.05;
        card(slide, x, 1.95, w, 4.45);
        slide.addShape(shape.rect, { x: x + 0.3, y: 2.25, w: 0.4, h: 0.05, fill: { color: C.orange }, line: { color: C.orange, width: 0 } });
        kicker(slide, "Show-up", x + 0.3, 2.38, w - 0.5);
        slide.addText(s.showUp ? `${s.showUp.rate}%` : "—", { x: x + 0.3, y: 2.75, w: w - 0.5, h: 1, fontFace: HEAD, fontSize: 48, bold: true, color: C.navy, margin: 0, valign: "middle" });
        slide.addText(
          `Of the guests who registered, this share came. Based on ${plural(data.pairs.length, "gathering", "gatherings")} where attendance was marked.` +
            (data.waiting.length ? `\n\nNot marked yet: ${data.waiting.join(", ")}.` : ""),
          { x: x + 0.3, y: 3.75, w: w - 0.55, h: 1.5, fontFace: BODY, fontSize: 12.5, color: C.muted, margin: 0, valign: "top" },
        );
        const listed = data.pairs.reduce((sum, p) => sum + p.listed, 0);
        const came = data.pairs.reduce((sum, p) => sum + p.attended, 0);
        slide.addShape(shape.line, { x: x + 0.3, y: 5.3, w: w - 0.6, h: 0, line: { color: C.line, width: 0.75 } });
        [["Registered", listed], ["Came", came]].forEach(([name, value], i) => {
          const half = (w - 0.6) / 2;
          slide.addText(String(value), { x: x + 0.3 + i * half, y: 5.4, w: half, h: 0.5, fontFace: HEAD, fontSize: 24, bold: true, color: C.navy, margin: 0, valign: "middle" });
          slide.addText(name.toUpperCase(), { x: x + 0.3 + i * half, y: 5.88, w: half, h: 0.3, fontFace: BODY, fontSize: 9.5, bold: true, color: C.muted, charSpacing: 2, margin: 0, valign: "middle" });
        });
      } else {
        card(slide, M + 1.5, 2.3, CONTENT_W - 3, 3.2);
        slide.addText(
          data.waiting.length
            ? `Attendance has not been marked yet for ${data.waiting.join(", ")}.\nMark who came on the guest list, and this slide fills in.`
            : `No attendance was taken in this period.\nIt has been taken from ${data.attendanceFrom || "now"} on, so this slide fills in as gatherings are marked.`,
          { x: M + 2, y: 2.6, w: CONTENT_W - 4, h: 2.6, fontFace: BODY, fontSize: 18, color: C.ink, align: "center", valign: "middle", margin: 0 },
        );
      }
      slide.addNotes("Came = guests marked as attended on the guest list. Show-up = came as a share of registered.");
    }

    // 5. Regulars and people worth a check-in
    {
      const slide = pptx.addSlide({ masterName: "CONTENT" });
      heading(slide, "Regulars and people worth a check-in", "Based on every gathering that has happened, not just this period");
      const f = data.followUp;
      const cardW = (CONTENT_W - 0.3) / 2;
      const groups = [
        { title: "Regulars", count: f.regularsCount, list: f.regulars, text: `Came to at least 3 of the last ${f.windowSize} gatherings.`, none: "No one yet." },
        { title: "Worth a check-in", count: f.driftingCount, list: f.drifting, text: "Came at least twice, but not in the last 3 gatherings.", none: "No one has gone quiet." },
      ];
      const cardH = groups[0].list ? 4.45 : 3.25;
      groups.forEach((g, i) => {
        const x = M + i * (cardW + 0.3);
        card(slide, x, 1.95, cardW, cardH);
        slide.addShape(shape.rect, { x: x + 0.35, y: 2.25, w: 0.4, h: 0.05, fill: { color: C.orange }, line: { color: C.orange, width: 0 } });
        kicker(slide, g.title, x + 0.35, 2.38, cardW - 0.7);
        slide.addText(String(g.count), { x: x + 0.35, y: 2.75, w: 1.8, h: 0.95, fontFace: HEAD, fontSize: 54, bold: true, color: C.navy, margin: 0, valign: "middle" });
        slide.addText(g.count ? g.text : `${g.none} ${g.text}`, { x: x + 2.2, y: 2.85, w: cardW - 2.55, h: 0.8, fontFace: BODY, fontSize: 12.5, color: C.muted, margin: 0, valign: "middle" });
        slide.addShape(shape.line, { x: x + 0.35, y: 3.9, w: cardW - 0.7, h: 0, line: { color: C.line, width: 0.75 } });
        if (g.list && g.list.length) {
          const long = g.list.some((p) => p.note.length > 16 || p.name.length > 20);
          const shown = g.list.slice(0, long ? 6 : 10);
          const cols = long ? [shown, []] : [shown.slice(0, 5), shown.slice(5)];
          cols.forEach((col, ci) => {
            if (!col.length) return;
            const runs = [];
            col.forEach((p, pi) => {
              runs.push({ text: p.name, options: { bold: true, color: C.ink, fontSize: 12.5, breakLine: false } });
              runs.push({ text: `  ${p.note}`, options: { color: C.muted, fontSize: 10.5, breakLine: pi < col.length - 1 } });
            });
            slide.addText(runs, { x: x + 0.35 + ci * ((cardW - 0.7) / 2), y: 4.05, w: long ? cardW - 0.7 : (cardW - 0.7) / 2 - 0.1, h: 1.75, fontFace: BODY, margin: 0, valign: "top", paraSpaceAfter: 4 });
          });
          if (g.list.length > shown.length) {
            slide.addText(`+ ${g.list.length - shown.length} more`, { x: x + 0.35, y: 5.85, w: cardW - 0.7, h: 0.35, fontFace: BODY, fontSize: 10.5, italic: true, color: C.muted, margin: 0, valign: "middle" });
          }
        } else if (g.list) {
          slide.addText("No one to list.", { x: x + 0.35, y: 4.05, w: cardW - 0.7, h: 0.4, fontFace: BODY, fontSize: 12.5, italic: true, color: C.muted, margin: 0 });
        } else {
          slide.addText("Names are left out of this deck. Tick “Include names” before exporting to list them.", {
            x: x + 0.35, y: 4.1, w: cardW - 0.7, h: 1.0, fontFace: BODY, fontSize: 12.5, italic: true, color: C.muted, margin: 0, valign: "top",
          });
        }
      });
      slide.addNotes("Regulars and people worth a check-in are worked out from every gathering that has happened. A duplicate profile can make one person look like two, so review possible duplicates on the People page first.");
    }

    // 6. The numbers (as many slides as the table needs)
    {
      const perGathering = data.grain === "gathering";
      const header = perGathering
        ? ["Gathering", "On the list", "Returning", "First time", "Came", "Show-up"]
        : [grainNoun[0].toUpperCase() + grainNoun.slice(1), "Gatherings", "Average", "On the list", "Returning", "First time"];
      const colW = perGathering ? [3.4, 1.7, 1.7, 1.7, 1.7, 1.73] : [3.0, 1.75, 1.75, 1.85, 1.85, 1.73];
      const rows = data.buckets.map((b) =>
        perGathering
          ? [b.title, b.guests, b.returning, b.firstTime, b.came === null ? "—" : b.came, b.showUp === null ? "—" : `${b.showUp}%`]
          : [b.title, b.gatherings, b.average, b.guests, b.returning, b.firstTime],
      );
      const perSlide = 10;
      const pages = Math.max(1, Math.ceil(rows.length / perSlide));
      for (let page = 0; page < pages; page++) {
        const slide = pptx.addSlide({ masterName: "CONTENT" });
        heading(slide, pages > 1 ? `The numbers (${page + 1} of ${pages})` : "The numbers", perGathering ? "One row for each gathering" : `One row for each ${grainNoun}`);
        const head = header.map((t, i) => ({ text: t, options: { bold: true, color: C.white, fill: { color: C.navy }, align: i === 0 ? "left" : "center", fontFace: BODY, fontSize: 12 } }));
        const body = rows.slice(page * perSlide, (page + 1) * perSlide).map((r, ri) =>
          r.map((v, i) => ({ text: String(v), options: { color: C.ink, bold: i === 0, fill: { color: ri % 2 ? C.zebra : C.white }, align: i === 0 ? "left" : "center", fontFace: BODY, fontSize: 12 } })),
        );
        slide.addTable([head, ...body], {
          x: M, y: 1.95, w: CONTENT_W, colW, rowH: 0.42, valign: "middle", margin: [0, 0.14, 0, 0.14],
          border: { type: "solid", color: C.line, pt: 0.75 },
        });
        if (perGathering && rows.some((r) => r[4] === "—") && page === pages - 1) {
          slide.addText("A dash means attendance was not taken or has not been marked.", { x: M, y: 6.55, w: CONTENT_W, h: 0.3, fontFace: BODY, fontSize: 10.5, italic: true, color: C.muted, margin: 0 });
        }
      }
    }
    return pptx;
  }

  // ---- The export button on the Trends page ----
  function wire() {
    const button = document.getElementById("deck-export");
    if (!button) return;
    const status = document.getElementById("deck-status");
    const names = document.getElementById("deck-names");
    const say = (text, bad) => {
      if (!status) return;
      status.textContent = text;
      status.classList.toggle("is-error", Boolean(bad));
    };
    const toDataUrl = (blob) =>
      new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(blob);
      });

    button.addEventListener("click", async () => {
      if (typeof window.PptxGenJS !== "function") {
        say("The PowerPoint tool did not load. Check your connection and try again.", true);
        return;
      }
      button.disabled = true;
      say("Building your deck…");
      try {
        const query = new URLSearchParams(button.getAttribute("data-query") || "");
        if (names && names.checked) query.set("names", "1");
        const res = await fetch(`/admin/reports.json?${query.toString()}`);
        if (!res.ok) throw new Error("Could not load the report numbers.");
        const data = await res.json();
        let logo = null;
        try {
          const logoRes = await fetch("/brand/ofwt-logo-white.png");
          if (logoRes.ok) logo = await toDataUrl(await logoRes.blob());
        } catch (e) {}
        const deck = build(window.PptxGenJS, data, { logo });
        await deck.writeFile({ fileName: `ofw-tambayan-gathering-report-${data.from}-to-${data.to}.pptx` });
        say("Downloaded.");
      } catch (err) {
        say(err instanceof Error ? err.message : "Something went wrong. Please try again.", true);
      } finally {
        button.disabled = false;
      }
    });
  }
  if (typeof document !== "undefined") wire();

  return { build };
});
