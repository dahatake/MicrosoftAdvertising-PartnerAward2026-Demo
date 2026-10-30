"use strict";
/* Task management (team collaboration, exceptions, decisions), the focus alert, and the AI-agent / virtual-future simulator. */
const SEVN = { red: "レッド", amber: "アンバー" };
const dueTxt = (n) => (n < 0 ? `期限超過 ${-n}日` : n === 0 ? "本日期限" : `期限まであと${n}日`);
const teamLabel = (k) => (k === "company" ? "全社" : DEPT[k] || (k === "manager" ? "業務責任者（全社）" : k));
const mdIn = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return d.toLocaleDateString(locale(), { month: "numeric", day: "numeric" }); };
const ymdIn = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return d.toLocaleDateString(locale(), { year: "numeric", month: "numeric", day: "numeric" }); };
const evText = (e) => (e.kind === "overload" ? `${e.name}の過負荷（${e.peak}%）` : e.kind === "late" ? `「${e.name}」の遅延（${e.peak}日）` : `判断期限の超過：${e.name}`);
const evIcon = (k) => ({ overload: "gauge", late: "clock", overdue: "flag" })[k];
const yen0 = (n) => (n ? "追加コスト " + yen(n) : "追加コストなし");

/* ------------------------------------------------ focus alert */
A.focusBanner = (f, { compact = false } = {}) => {
  if (f.status === "red" && f.top) {
    const t = f.top, key = `alert:${A.state.user}:${t.id}`;
    const el = h("section", { class: "alert red" + (compact ? " compact" : ""), "data-tilt": "", role: "alert" },
      h("div", { class: "al-sweep" }),
      h("div", { class: "al-ic" }, Art.tile("warn", 355, compact ? 54 : 78, "pulse")),
      h("div", { class: "al-body" },
        h("div", { class: "al-k" }, h("span", { class: "blink" }), "RED ALERT · あなたにとって最重要の例外", f.red_count > 1 ? h("b", { class: "chip bad" }, `他 ${f.red_count - 1} 件`) : null),
        h("h2", { class: "al-t" }, t.title),
        h("p", { class: "al-d" }, t.detail),
        h("div", { class: "row al-m" }, h("span", { class: "chip bad" }, dueTxt(t.due_in)), h("span", { class: "chip" }, t.scope === "company" ? "会社としての例外" : "チームの例外: " + teamLabel(t.team)),
          t.case_name ? h("span", { class: "chip" }, t.case_name) : null,
          h("span", { class: "chip ai" }, ic("sparkle", 12), `AI推奨 ${t.ai.best}: ${(t.options.find((o) => o.key === t.ai.best) || {}).label}`)),
        h("div", { class: "row", style: "margin-top:14px" },
          h("button", { class: "btn accent big", onclick: () => { A.state.focusDec = t.id; location.hash = "#/tasks"; A.render(); } }, ic("bolt", 16), "判断する"),
          h("button", { class: "btn big", onclick: () => A.simDecision(t, t.ai.best) }, ic("clock", 16), "AI推奨の未来を見る"))));
    if (!sessionStorage.getItem(key)) { sessionStorage.setItem(key, "1"); setTimeout(() => FX.alertPulse(), 350); }
    return el;
  }
  return h("section", { class: "alert green" + (compact ? " compact" : ""), "data-tilt": "" },
    h("div", { class: "al-sweep" }), h("div", { class: "al-ic" }, Art.tile("check", 150, compact ? 54 : 78, "calm")),
    h("div", { class: "al-body" }, h("div", { class: "al-k" }, h("span", { class: "dot-ok" }), "ALL GREEN · 緊急の例外はありません"),
      h("h2", { class: "al-t" }, "すべて順調です"),
      h("p", { class: "al-d" }, f.watch_count ? `注意して見るべき判断が ${f.watch_count} 件あります。` : "対応が必要な例外はありません。"),
      f.watch_count ? h("div", { class: "row", style: "margin-top:12px" }, h("a", { class: "btn", href: "#/tasks" }, "判断を確認する", ic("arrow", 14))) : null));
};
A.updatePill = async () => {
  const pill = $("#pill"); if (!pill) return;
  try {
    const f = await api("/api/ops/focus"); A.state.focus = f;
    pill.className = "pill " + f.status; pill.replaceChildren(h("i"), f.status === "red" ? `RED ${f.red_count}` : "GREEN");
    pill.title = tr(f.status === "red" ? "最重要の例外があります" : "緊急の例外はありません");
  } catch { /* ignore */ }
};

/* ------------------------------------------------ small d3 helpers */
const fitText = (s, w, px = 12) => { const per = (str) => [...str].reduce((a, c) => a + (c.charCodeAt(0) > 255 ? px : px * 0.56), 0); if (per(s) <= w) return s; let o = ""; for (const c of s) { if (per(o + c + "…") > w) break; o += c; } return o ? o + "…" : ""; };
const utilClr = d3.scaleLinear().domain([0, 0.5, 0.9, 1.05, 1.4]).range(["#0e3b4f", "#1f9d8b", "#fbbf24", "#f97316", "#ef4444"]).clamp(true);

function spark(el, arr, { h: Hh = 38, danger = 1.05 } = {}) {
  mount(el, (el, W) => {
    const x = d3.scaleLinear().domain([0, arr.length - 1]).range([2, W - 2]), y = d3.scaleLinear().domain([0, Math.max(1.3, d3.max(arr))]).range([Hh - 2, 2]);
    const svg = d3.select(el).append("svg").attr("width", W).attr("height", Hh), id = uid("sp");
    const lg = svg.append("defs").append("linearGradient").attr("id", id).attr("x1", 0).attr("x2", 0).attr("y1", 0).attr("y2", 1);
    lg.append("stop").attr("offset", 0).attr("stop-color", "#f97316").attr("stop-opacity", 0.6); lg.append("stop").attr("offset", 1).attr("stop-color", "#2dd4bf").attr("stop-opacity", 0.05);
    svg.append("line").attr("x1", 0).attr("x2", W).attr("y1", y(1)).attr("y2", y(1)).attr("stroke", "#ff7a82").attr("stroke-dasharray", "3 3").attr("opacity", 0.55);
    svg.append("path").datum(arr).attr("fill", `url(#${id})`).attr("d", d3.area().x((d, i) => x(i)).y0(Hh).y1((d) => y(d)).curve(d3.curveMonotoneX));
    const ln = svg.append("path").datum(arr).attr("fill", "none").attr("stroke", arr.some((v) => v > danger) ? "#ff7a82" : "#2dd4bf").attr("stroke-width", 1.8).attr("d", d3.line().x((d, i) => x(i)).y((d) => y(d)).curve(d3.curveMonotoneX));
    const L = ln.node().getTotalLength(); ln.attr("stroke-dasharray", `${L} ${L}`).attr("stroke-dashoffset", L).transition().duration(900).attr("stroke-dashoffset", 0);
  });
}

/* ------------------------------------------------ team swimlane timeline */
function teamGantt(el, work, teams, H, onOpen) {
  mount(el, (el, W) => {
    const today = d3.timeDay.floor(new Date()), x0 = d3.timeDay.offset(today, -21), x1 = d3.timeDay.offset(today, H + 7), lab = Math.min(150, W * 0.2);
    const x = d3.scaleTime().domain([x0, x1]).range([lab, W - 8]), P = (s) => parseDay(s);
    const rows = teams.map((t) => {
      const items = work.filter((w) => w.team === t.key).sort((a, b) => a.start.localeCompare(b.start)), lanes = [];
      items.forEach((w) => { const s = x(P(w.start)), e = x(P(w.end_eff)); let i = lanes.findIndex((end) => end <= s - 3); if (i < 0) { i = lanes.length; lanes.push(0); } lanes[i] = e; w._lane = i; });
      return { t, items, n: Math.max(1, lanes.length) };
    });
    const bh = 24, pad = 12; let y = 24; rows.forEach((r) => { r.y = y; r.h = r.n * (bh + 4) + pad; y += r.h; });
    const Ht = y + 6, svg = d3.select(el).append("svg").attr("width", W).attr("height", Ht), pos = {};
    const defs = svg.append("defs"), hid = uid("hz");
    defs.append("pattern").attr("id", hid).attr("width", 6).attr("height", 6).attr("patternUnits", "userSpaceOnUse").attr("patternTransform", "rotate(45)").append("rect").attr("width", 3).attr("height", 6).attr("fill", "#ff5a63");
    defs.append("marker").attr("id", hid + "a").attr("viewBox", "0 0 8 8").attr("refX", 7).attr("refY", 4).attr("markerWidth", 6).attr("markerHeight", 6).attr("orient", "auto").append("path").attr("d", "M0 0L8 4L0 8z").attr("fill", "#9fb0c8");
    svg.append("g").attr("class", "axis").attr("transform", "translate(0,16)").call(d3.axisTop(x).ticks(Math.max(4, Math.floor(W / 110))).tickFormat(fmtMD).tickSize(0).tickPadding(4));
    rows.forEach((r, i) => {
      svg.append("rect").attr("x", 0).attr("y", r.y).attr("width", W).attr("height", r.h).attr("fill", i % 2 ? "transparent" : "currentColor").attr("opacity", 0.035);
      const g = svg.append("g").attr("class", "ent").attr("data-ent", "team:" + r.t.key).attr("transform", `translate(6,${r.y + 6})`); g.append("circle").attr("cx", 8).attr("cy", 10).attr("r", 8).attr("fill", `hsl(${TEAM_HUE[r.t.key]},70%,55%)`);
      g.append("text").attr("x", 22).attr("y", 14).style("font-size", "12px").style("font-weight", 600).text(fitText(tr(r.t.label), lab - 30));
    });
    svg.append("g").selectAll("line").data(d3.timeDay.range(x0, x1, 7)).join("line").attr("x1", (d) => x(d)).attr("x2", (d) => x(d)).attr("y1", 22).attr("y2", Ht).attr("stroke", "currentColor").attr("opacity", 0.07);
    rows.forEach((r) => r.items.forEach((w) => {
      const xs = Math.max(lab, x(P(w.start))), xe = Math.max(xs + 10, x(P(w.end))), xl = Math.max(xe, x(P(w.end_eff))), yy = r.y + 6 + w._lane * (bh + 4), width = Math.max(10, xe - xs); pos[w.id] = { xs, xe: Math.max(xe, xs + 10), y: yy + bh / 2 };
      const g = svg.append("g").attr("class", "tbar ent").attr("data-ent", "task:" + w.id).attr("tabindex", 0).style("animation-delay", Math.round(Math.random() * 500) + "ms");
      const fill = w.status === "done" ? "#3a8f6b" : w.status === "doing" ? `hsl(${TEAM_HUE[w.team]},70%,52%)` : `hsl(${TEAM_HUE[w.team]},35%,32%)`;
      g.append("rect").attr("x", xs).attr("y", yy).attr("width", width).attr("height", bh).attr("rx", 7).attr("fill", fill).attr("opacity", 0.92);
      if (w.status === "doing" && w.progress) g.append("rect").attr("x", xs).attr("y", yy + bh - 4).attr("width", width * w.progress / 100).attr("height", 4).attr("rx", 2).attr("fill", "#fff").attr("opacity", 0.75);
      if (w.late > 0) { g.append("rect").attr("x", xe).attr("y", yy).attr("width", Math.max(0, xl - xe)).attr("height", bh).attr("rx", 7).attr("fill", `url(#${hid})`).attr("opacity", 0.9); g.append("rect").attr("x", xe).attr("y", yy).attr("width", Math.max(0, xl - xe)).attr("height", bh).attr("rx", 7).attr("fill", "none").attr("stroke", "#ff5a63").attr("stroke-width", 1.2); }
      g.append("text").attr("x", xs + 8).attr("y", yy + 16).style("fill", "#fff").style("font-size", "11.5px").style("pointer-events", "none").text(fitText(w.title, width - 12, 11.5));
      g.on("pointermove", (e) => A.tip.show([Object.assign(document.createElement("b"), { textContent: w.title }), document.createElement("br"), document.createTextNode(`${w.case_name || ""}`), document.createElement("br"),
        document.createTextNode(`${fmtMD(P(w.start))} → ${fmtMD(P(w.end))}  ·  ${STATUS[w.status] || w.status} ${w.progress}%`), ...(w.late ? [document.createElement("br"), document.createTextNode(`遅延見込み ${w.late}日（${fmtMD(P(w.end_eff))}）`)] : [])], e)).on("pointerleave", A.tip.hide)
        .on("click", () => w.case_id && onOpen && onOpen(w.case_id));
    }));
    work.filter((w) => w.depends_on && pos[w.id] && pos[w.depends_on]).forEach((w) => {
      const a = pos[w.depends_on], b = pos[w.id], mx = Math.max(a.xe + 12, (a.xe + b.xs) / 2);
      svg.append("path").attr("d", `M${a.xe},${a.y} C${mx},${a.y} ${Math.min(mx, b.xs - 12)},${b.y} ${b.xs},${b.y}`).attr("fill", "none").attr("stroke", "#9fb0c8").attr("stroke-width", 1.4).attr("stroke-dasharray", "4 3").attr("marker-end", `url(#${hid}a)`).attr("opacity", 0.8);
    });
    const tx = x(today); svg.append("line").attr("x1", tx).attr("x2", tx).attr("y1", 20).attr("y2", Ht).attr("stroke", "#ff7a82").attr("stroke-width", 1.6);
    svg.append("text").attr("x", tx + 4).attr("y", Ht - 4).style("fill", "#ff7a82").style("font-size", "10px").text("今日");
  });
}

/* ------------------------------------------------ decision cards */
function confRing(v) { return h("div", { class: "conf", style: `--v:${v}` }, h("b", {}, v + "%"), h("small", {}, "信頼度")); }
function decCard(d, onChange) {
  let pick = d.chosen || d.ai.best;
  const best = d.options.find((o) => o.key === d.ai.best), maxS = Math.max(...d.options.map((o) => o.ai.score)), minS = Math.min(...d.options.map((o) => o.ai.score));
  const optEls = d.options.map((o) => {
    const isBest = o.key === d.ai.best, bar = 100 - ((o.ai.score - minS) / Math.max(1, maxS - minS)) * 70;
    const el = h("button", { type: "button", class: "opt" + (isBest ? " best" : ""), role: "radio", "aria-checked": "false", disabled: d.status !== "open" || undefined,
      onclick: () => { pick = o.key; mark(); } },
      h("div", { class: "k" }, o.key), isBest ? h("span", { class: "chip ai" }, ic("sparkle", 11), "AI推奨") : null,
      h("b", {}, o.label), h("p", {}, o.desc), h("div", { class: "row" }, h("span", { class: "chip" }, yen0(o.cost)), h("span", { class: "chip" }, `予測例外 ${o.ai.exceptions}件`)),
      h("ul", { class: "pc" }, o.pros.map((x) => h("li", { class: "pro" }, x)), o.cons.map((x) => h("li", { class: "con" }, x))),
      h("div", { class: "sc" }, h("i", { style: `width:${bar}%` })));
    el.dataset.k = o.key; return el;
  });
  const mark = () => optEls.forEach((e) => { const on = e.dataset.k === pick; e.classList.toggle("on", on); e.setAttribute("aria-checked", on); });
  const okBtn = h("button", { class: "btn accent big", disabled: !d.can_decide || undefined, onclick: async (ev) => {
    const r = ev.currentTarget.getBoundingClientRect();
    try { await api(`/api/ops/decisions/${d.id}/decide`, "POST", { option: pick }); FX.celebrate(r.left + r.width / 2, r.top + r.height / 2); toast("判断を許諾し、計画に反映しました"); A.state.focusDec = null; await A.render(); } catch (e) { FX.sfx("err"); toast(e.message, "err"); }
  } }, ic("check", 16), "許諾して実行");
  const card = h("article", { class: "card dec " + d.severity + (d.status !== "open" ? " done" : ""), id: "dec" + d.id },
    h("div", { class: "dec-h" }, Art.tile(d.severity === "red" ? "warn" : "flag", d.severity === "red" ? 355 : 40, 46, d.severity === "red" ? "pulse" : ""),
      h("div", { class: "sp" }, A.ent(h("h3", {}, d.title), "decision", d.id), h("div", { class: "row" },
        h("span", { class: "chip " + (d.severity === "red" ? "bad" : "warn") }, d.severity === "red" ? "レッド" : "アンバー"),
        h("span", { class: "chip" }, d.scope === "company" ? "会社としての例外" : "チーム: " + teamLabel(d.team)), d.case_name ? A.ent(h("span", { class: "chip" }, d.case_name), "case", d.case_id) : null,
        d.status === "open" ? h("span", { class: "chip " + (d.due_in < 0 ? "bad" : "") }, dueTxt(d.due_in)) : h("span", { class: "chip ok" }, ic("check", 12), `決定済み: ${d.chosen}（${d.decided_via === "ai" ? "AI Autopilot" : "人の判断"}）`)))),
    h("p", { class: "dec-d" }, d.detail),
    h("div", { class: "aibox" }, h("div", { class: "aihead" }, Art.tile("ai", 265, 36, "orbt"), h("div", { class: "sp" }, h("div", { class: "mut", style: "font-size:11px" }, "Flow Agent の分析（将来の日次シミュレーションに基づく）"),
      h("b", {}, d.ai.headline)), confRing(d.ai.confidence)),
      h("ul", { class: "why" }, d.ai.lines.map((l) => h("li", {}, l)))),
    h("div", { class: "opts", role: "radiogroup", "aria-label": tr("選択肢") }, optEls),
    d.status === "open" ? h("div", { class: "row", style: "margin-top:14px" },
      h("button", { class: "btn big", onclick: () => A.simDecision(d, pick) }, ic("clock", 16), "選択した案の未来を見る"),
      h("button", { class: "btn", onclick: () => { pick = d.ai.best; mark(); FX.sfx("success"); } }, ic("sparkle", 14), "AI推奨を選ぶ"), h("span", { class: "sp" }),
      d.can_decide ? null : h("span", { class: "mut" }, "この判断を行う権限がありません（閲覧のみ）"), okBtn) : null);
  mark(); return card;
}
A.simDecision = (d, optKey) => A.openSim({
  title: d.title, sub: `選択肢 ${optKey}: ${(d.options.find((o) => o.key === optKey) || {}).label}`, agent: false, mode: "decision",
  load: async () => { const r = await api(`/api/ops/decisions/${d.id}/simulate`, "POST", { option: optKey }); r.steps = [{ title: r.option, lines: [...r.impact, yen0(r.cost)] }]; return r; },
  apply: d.can_decide && d.status === "open" ? { label: "許諾して実行", run: () => api(`/api/ops/decisions/${d.id}/decide`, "POST", { option: optKey }) } : null,
});

/* ------------------------------------------------ the page */
A.v.tasks = async () => {
  const [b, f] = await Promise.all([api("/api/ops/board"), api("/api/ops/focus")]);
  A.state.focus = f; A.crumbs("タスク管理"); A.updatePill();
  const open = b.decisions.filter((d) => d.status === "open"), closed = b.decisions.filter((d) => d.status !== "open");
  let filt = "all";
  const list = h("div", { class: "stack" }), seg = h("div", { class: "seg" });
  const draw = () => {
    const rows = open.filter((d) => filt === "all" || (filt === "company" ? d.scope === "company" : d.scope === "team")).concat(filt === "all" ? closed : []);
    list.replaceChildren(...(rows.length ? rows.map((d, i) => rv(decCard(d), i)) : [h("p", { class: "empty" }, "対応が必要な判断はありません")]));
    [...seg.children].forEach((x) => x.classList.toggle("on", x.dataset.k === filt));
  };
  [["all", `すべて（${open.length}）`], ["company", `会社の例外（${open.filter((d) => d.scope === "company").length}）`], ["team", `チームの例外（${open.filter((d) => d.scope === "team").length}）`]]
    .forEach(([k, t]) => seg.append(h("button", { "data-k": k, onclick: () => { filt = k; draw(); } }, t)));

  const teamCards = h("div", { class: "grid g3" }, b.teams.map((t, i) => {
    const sp = h("div", { class: "chart sp" });
    const hot = Math.max(...t.util) > 1.05;
    const c = rv(A.ent(h("article", { class: "card team-c lift", id: "team-" + t.key, "data-tilt": "" },
      h("div", { class: "row" }, Art.tile(TEAM_ICON[t.key], TEAM_HUE[t.key], 38), h("b", { style: "font-size:15px" }, t.label), h("span", { class: "sp" }), t.red ? h("span", { class: "chip bad" }, `レッド ${t.red}`) : t.open_decisions ? h("span", { class: "chip warn" }, `判断待ち ${t.open_decisions}`) : h("span", { class: "chip ok" }, "順調")),
      h("div", { class: "faces" }, t.people.slice(0, 5).map((p) => A.ent(h("span", { class: "face", title: p.name }, Art.person({ seed: p.id, g: p.gender, age: p.age, size: 30 })), "resource", p.id)), t.externals ? h("span", { class: "face more" }, `+${t.externals}`) : null),
      h("div", { class: "now" }, h("div", { class: "mut", style: "font-size:11px" }, "今やっていること"), h("b", {}, t.now ? t.now.title : "待機中"), t.now ? h("div", { class: "mut" }, `${t.now.case || ""} · 〜 ${fmtMD(parseDay(t.now.end))}`) : null),
      h("div", { class: "row mut", style: "font-size:12px" }, h("span", {}, ic("clock", 12), ` 次の期限 ${t.next_due ? fmtMD(parseDay(t.next_due)) : "—"}`), h("span", {}, `未完了 ${t.open} 件`), h("span", { class: hot ? "bad" : "ok" }, `ピーク負荷 ${Math.round(Math.max(...t.util) * 100)}%`)),
      sp), "team", t.key), 2 + i);
    spark(sp, t.util); return c;
  }));
  const gantt = h("div", { class: "chart" });
  const gcard = rv(h("section", { class: "card" }, h("h3", {}, "チーム連携タイムライン", h("small", {}, "どのチームが、いつまでに、何をしているか · 点線は依存関係 · 斜線は遅延見込み")),
    h("div", { class: "legend" }, [["進行中", "#58a8ff"], ["未着手", "#5b6b8a"], ["完了", "#3a8f6b"], ["遅延見込み", "#ff5a63"]].map(([t, c]) => h("span", {}, h("i", { style: `background:${c}` }), t))), gantt), 8);

  A.mount(h("div", {},
    h("div", { class: "row", style: "margin-bottom:14px" }, h("h1", { style: "font-size:26px;margin:0" }, "タスク管理"), h("span", { class: "sp" }),
      h("button", { class: "btn agent big", onclick: () => A.autopilot("tasks") }, ic("ai", 18), "AI Agentによる最適化")),
    rv(A.focusBanner(f), 0),
    h("div", { class: "sec" }, h("h2", {}, "チーム連携ボード"), h("span", { class: "mut" }, "個人ではなくチーム単位で、今の状況と将来の負荷を把握します")), teamCards,
    h("div", { style: "margin-top:16px" }, gcard),
    h("div", { class: "sec" }, h("h2", {}, "例外・判断が必要なタスク"), h("span", { class: "sp" }), seg), list));
  draw();
  Charts.__tg = () => teamGantt(gantt, b.work, b.teams, b.horizon, (id) => (location.hash = `#/case/${id}`)); Charts.__tg();
  if (A.state.teamFocus) { const el = document.getElementById("team-" + A.state.teamFocus); if (el) setTimeout(() => { el.scrollIntoView({ behavior: "smooth", block: "center" }); el.classList.add("spot"); }, 350); A.state.teamFocus = null; }
  if (A.state.focusDec) { const el = document.getElementById("dec" + A.state.focusDec); if (el) setTimeout(() => { el.scrollIntoView({ behavior: "smooth", block: "center" }); el.classList.add("spot"); }, 350); A.state.focusDec = null; }
};

/* ------------------------------------------------ AI agent entry */
A.autopilot = (scope) => A.openSim({
  title: scope === "tasks" ? "タスクの判断をAutopilotで実行" : "リソースの再配分をAutopilotで実行", sub: "Flow Agent が将来を日次でシミュレーションし、最良の組み合わせを探索します",
  agent: true, mode: scope, load: () => api("/api/ops/ai/plan", "POST", { scope }), apply: { label: "許諾してAutopilotを実行", run: () => api("/api/ops/ai/apply", "POST", { scope }) },
});

/* ------------------------------------------------ virtual-future simulator */
A.openSim = async (cfg) => {
  const root = h("div", { class: "sim", role: "dialog", "aria-modal": "true", "aria-label": tr("未来シミュレーション") });
  document.body.append(root); document.body.classList.add("noscroll"); FX.init(); FX.sfx("open"); FX.flash("fx-flash soft");
  let timer = null, closed = false;
  const close = () => { if (closed) return; closed = true; clearInterval(timer); document.removeEventListener("keydown", onKey); root.classList.add("out"); FX.sfx("close"); setTimeout(() => { root.remove(); document.body.classList.remove("noscroll"); }, 350); };
  const onKey = (e) => { if (e.key === "Escape") close(); };
  document.addEventListener("keydown", onKey);

  /* phase 1: the agent "thinks" */
  const log = h("ul", { class: "alog" }), bar = h("i"), skip = h("button", { class: "btn ghost", type: "button" }, ic("skip", 14), "スキップ");
  const think = h("div", { class: "think" }, h("div", { class: "orb" }, h("i"), h("i"), h("i")), h("h2", {}, cfg.agent ? "Flow Agent が分析しています" : "未来をシミュレーションしています"), h("div", { class: "prog" }, bar), log, skip);
  root.append(think);
  const lines = cfg.agent ? ["全リソースと全タスクの稼働データを読み込んでいます…", "将来を日単位でシミュレーションしています…", "判断候補の組み合わせを評価しています…", "例外の発生を未然に防ぐ配分を探索しています…", "最適案を確定しました。"]
    : ["選んだ案を現在の計画に仮適用しています…", "将来を日単位でシミュレーションしています…", "結果を可視化します。"];
  const loading = cfg.load();
  let skipped = false; skip.onclick = () => { skipped = true; };
  let res, err;
  loading.then((r) => (res = r)).catch((e) => (err = e));
  for (let i = 0; i < lines.length && !skipped; i++) {
    const li = h("li", {}); log.append(li); FX.sfx("think"); bar.style.width = ((i + 1) / lines.length) * 100 + "%";
    await FX.type(li, tr(lines[i]), 90); await new Promise((r) => setTimeout(r, cfg.agent ? 330 : 200)); if (closed) return;
  }
  try { await loading; } catch (e) { if (!closed) { toast(e.message, "err"); FX.sfx("err"); close(); } return; }
  if (closed) return;
  think.remove(); FX.sfx("success"); FX.ring(innerWidth / 2, innerHeight / 3);

  /* phase 2: the future */
  const bs = res.baseline.series, as = res.after.series, H = bs.length - 1, curs = {};
  let day = 0, speed = 1;
  const key = (e) => `${e.kind}:${e.ref}`;
  const aKeys = new Set(res.after.events.map(key)), bKeys = new Set(res.baseline.events.map(key));
  const evs = [...res.baseline.events.map((e) => ({ ...e, st: aKeys.has(key(e)) ? "stay" : "prevented" })), ...res.after.events.filter((e) => !bKeys.has(key(e))).map((e) => ({ ...e, st: "new" }))].sort((a, b) => a.day - b.day);
  const prevented = evs.filter((e) => e.st === "prevented").length;

  const clk = h("div", { class: "clk" }), slider = h("input", { type: "range", min: 0, max: H, value: 0, "aria-label": tr("仮想の将来時刻") }), playBtn = h("button", { class: "btn icon accent", "aria-label": tr("再生") }, ic("play", 16));
  const tiles = ["open", "over", "exc"].map((k) => ({ k, el: h("div", { class: "card tl" }, h("div", { class: "k" }, { open: "未完了タスク", over: "過負荷のリソース", exc: "累積の例外" }[k]), h("div", { class: "vv" }), h("div", { class: "dd" })) }));
  const teamBox = h("div", { class: "tload" });
  const evList = h("ul", { class: "evl" }, evs.length ? evs.map((e) => h("li", { class: "ev " + e.st, "data-d": e.day }, h("span", { class: "dd" }, `T+${e.day}`), ic(evIcon(e.kind), 14), h("span", { class: "sp" }, evText(e)),
    h("span", { class: "chip " + (e.st === "prevented" ? "ok" : "bad") }, e.st === "prevented" ? "未然に防止" : e.st === "new" ? "新たに発生" : "発生見込み"))) : [h("li", { class: "empty" }, "将来の例外は予測されません")]);
  const stepsEl = h("div", { class: "steps" }, (res.steps || []).map((s, i) => h("article", { class: "step", style: `--i:${i}` },
    h("div", { class: "row" }, h("b", { class: "sp" }, s.title), s.confidence ? h("span", { class: "chip ai" }, ic("sparkle", 11), `信頼度 ${s.confidence}%`) : null, s.cost ? h("span", { class: "chip" }, yen0(s.cost)) : null),
    s.headline ? h("p", { class: "mut" }, s.headline) : null, h("ul", { class: "why" }, (s.lines || []).concat(s.impact || []).map((l) => h("li", {}, l))))));
  const tabs = h("div", { class: "seg" }), pane = h("div", { class: "pane" });
  const show = (k) => { pane.replaceChildren(k === "steps" ? stepsEl : evList); [...tabs.children].forEach((x) => x.classList.toggle("on", x.dataset.k === k)); };
  [["steps", cfg.mode === "decision" ? "選択した案の内容" : "AIの判断・配分"], ["events", `未来のできごと（${evs.length}）`]].forEach(([k, t]) => tabs.append(h("button", { "data-k": k, onclick: () => show(k) }, t)));

  const charts = ["exc", "open", "over"].map((k) => ({ k, el: h("div", { class: "chart" }) }));
  const T = (k, lab, clr) => h("section", { class: "card" }, h("h3", {}, lab, h("span", { class: "sp" }), h("span", { class: "legend" }, h("span", {}, h("i", { style: "background:#ff7a82" }), "何もしない"), h("span", {}, h("i", { style: `background:${clr}` }), "実行した場合"))), charts.find((c) => c.k === k).el);
  const tb = res.baseline.totals, ta = res.after.totals;
  const delta = (a, b) => h("span", { class: b < a ? "ok" : b > a ? "bad" : "mut" }, `${a} → ${b}`);
  const sum = h("div", { class: "sumbar" }, h("div", {}, h("small", {}, `将来${H}日間の例外`), h("b", {}, delta(tb.exceptions, ta.exceptions))), h("div", {}, h("small", {}, "過負荷のリソース日数"), h("b", {}, delta(tb.overload_days, ta.overload_days))),
    h("div", {}, h("small", {}, "遅延見込みの合計(日)"), h("b", {}, delta(tb.late_days, ta.late_days))), h("div", {}, h("small", {}, "未然に防止できる例外"), h("b", { class: "ok" }, `${prevented} 件`)), h("div", {}, h("small", {}, "追加コスト"), h("b", {}, yen(res.cost || 0))));

  const setDay = (d, user) => {
    const prev = day; day = Math.max(0, Math.min(H, d)); slider.value = day;
    clk.replaceChildren(h("span", { class: "tt" }, `T+${day}日`), h("span", { class: "dt" }, ymdIn(day)));
    tiles.forEach((t) => { const a = bs[day][t.k], b = as[day][t.k]; t.el.querySelector(".vv").replaceChildren(h("span", { class: "bad" }, a), " → ", h("span", { class: b < a ? "ok" : b > a ? "bad" : "" }, b));
      t.el.querySelector(".dd").textContent = tr(b < a ? `${a - b} 減少` : b > a ? `${b - a} 増加` : "変化なし"); });
    teamBox.replaceChildren(...Object.keys(bs[day].util).map((k) => { const u0 = bs[day].util[k], u1 = as[day].util[k];
      return h("div", { class: "tl-r" }, h("span", { class: "lb" }, teamLabel(k)), h("div", { class: "tr2" }, h("i", { class: "b", style: `width:${Math.min(100, u0 * 70)}%;background:${utilClr(u0)}` }), h("i", { class: "a", style: `width:${Math.min(100, u1 * 70)}%;background:${utilClr(u1)}` }), h("u", {})), h("span", { class: "pc" }, `${Math.round(u0 * 100)}→${Math.round(u1 * 100)}%`)); }));
    Object.values(curs).forEach((f) => f(day));
    evList.querySelectorAll(".ev").forEach((li) => { const d = +li.dataset.d; li.classList.toggle("past", d <= day); if (!user && d > prev && d <= day) { li.classList.add("fire"); setTimeout(() => li.classList.remove("fire"), 900); FX.sfx(li.classList.contains("prevented") ? "shield" : "err"); if (!li.classList.contains("prevented")) FX.shake(260); else FX.burst(innerWidth * 0.72, innerHeight * 0.5, { n: 12, hue: 150, spread: 4 }); } });
  };
  const play = () => { if (timer) { clearInterval(timer); timer = null; playBtn.replaceChildren(ic("play", 16)); return; } if (day >= H) setDay(0, true); playBtn.replaceChildren(ic("pause", 16));
    timer = setInterval(() => { if (day >= H) { clearInterval(timer); timer = null; playBtn.replaceChildren(ic("play", 16)); FX.sfx("success"); return; } FX.sfx("tick", day); setDay(day + 1); }, 420 / speed); };
  playBtn.onclick = play; slider.oninput = () => { if (timer) play(); FX.sfx("tick", +slider.value); setDay(+slider.value, true); };
  const spd = h("div", { class: "seg" }, [1, 2, 4].map((s) => h("button", { class: s === 1 ? "on" : "", onclick: (e) => { speed = s; [...spd.children].forEach((b) => b.classList.remove("on")); e.currentTarget.classList.add("on"); if (timer) { play(); play(); } } }, `×${s}`)));

  const apply = cfg.apply ? h("button", { class: "btn accent big", onclick: async (ev) => {
    const r = ev.currentTarget.getBoundingClientRect(); ev.currentTarget.disabled = true;
    try { await cfg.apply.run(); FX.celebrate(r.left + r.width / 2, r.top + r.height / 2); toast("許諾しました。現在のタスクとリソース配分に反映しました"); setTimeout(close, 700); A.state.focusDec = null; await A.render(); }
    catch (e) { ev.currentTarget.disabled = false; FX.sfx("err"); toast(e.message, "err"); }
  } }, ic("check", 16), cfg.apply.label) : null;
  const main = h("div", { class: "sim-main" },
    h("header", { class: "sim-top" }, h("div", { class: "sp" }, h("div", { class: "row" }, h("span", { class: "chip ai" }, ic("sparkle", 12), "Flow Agent"), h("span", { class: "mut" }, cfg.sub)), h("h2", {}, cfg.title)), clk,
      h("button", { class: "btn icon", "aria-label": tr("閉じる"), onclick: close }, ic("close"))),
    h("div", { class: "sim-grid" },
      h("div", { class: "stack" }, T("exc", "将来の例外（累積）", "#4ade80"), h("div", { class: "grid g2" }, T("open", "未完了タスク数", "#4ade80"), T("over", "過負荷のリソース数", "#4ade80"))),
      h("div", { class: "stack" }, h("div", { class: "tiles" }, tiles.map((t) => t.el)), h("section", { class: "card" }, h("h3", {}, "チーム負荷（この日）", h("small", {}, "上: 何もしない / 下: 実行した場合")), teamBox), h("section", { class: "card" }, tabs, pane))),
    h("footer", { class: "sim-foot" }, h("div", { class: "ctl" }, playBtn, slider, spd), sum, h("div", { class: "row" }, h("button", { class: "btn big", onclick: close }, cfg.apply ? "却下して閉じる" : "閉じる"), apply)));
  root.append(main);
  const mk = (k, label, clr, fmt) => {
    const c = charts.find((x) => x.k === k);
    mount(c.el, (el, W) => {
      const Hh = k === "exc" ? 200 : 150, m = { t: 10, r: 12, b: 22, l: 34 }, x = d3.scaleLinear().domain([0, H]).range([m.l, W - m.r]);
      const mx = Math.max(1, d3.max(bs, (r) => r[k]), d3.max(as, (r) => r[k])) * 1.15, y = d3.scaleLinear().domain([0, mx]).nice().range([Hh - m.b, m.t]);
      const svg = d3.select(el).append("svg").attr("width", W).attr("height", Hh), id = uid("sg");
      const lg = svg.append("defs").append("linearGradient").attr("id", id).attr("x1", 0).attr("x2", 0).attr("y1", 0).attr("y2", 1);
      lg.append("stop").attr("offset", 0).attr("stop-color", clr).attr("stop-opacity", 0.4); lg.append("stop").attr("offset", 1).attr("stop-color", clr).attr("stop-opacity", 0);
      svg.append("g").attr("class", "axis grid-l").attr("transform", `translate(${m.l},0)`).call(d3.axisLeft(y).ticks(4).tickSize(-(W - m.l - m.r)).tickFormat(""));
      svg.append("g").attr("class", "axis").attr("transform", `translate(${m.l},0)`).call(d3.axisLeft(y).ticks(4).tickSize(0).tickPadding(6));
      svg.append("g").attr("class", "axis").attr("transform", `translate(0,${Hh - m.b})`).call(d3.axisBottom(x).ticks(Math.min(H, 7)).tickFormat((d) => "T+" + d));
      const ln = d3.line().x((r) => x(r.d)).y((r) => y(r[k])).curve(d3.curveStepAfter);
      svg.append("path").datum(as).attr("fill", `url(#${id})`).attr("d", d3.area().x((r) => x(r.d)).y0(y(0)).y1((r) => y(r[k])).curve(d3.curveStepAfter));
      const p0 = svg.append("path").datum(bs).attr("fill", "none").attr("stroke", "#ff7a82").attr("stroke-width", 2).attr("stroke-dasharray", "5 4").attr("d", ln);
      const p1 = svg.append("path").datum(as).attr("fill", "none").attr("stroke", clr).attr("stroke-width", 3).attr("d", ln);
      [p0, p1].forEach((p, i) => { const L = p.node().getTotalLength(); if (i) p.attr("stroke-dasharray", `${L} ${L}`).attr("stroke-dashoffset", L).transition().duration(1200).ease(d3.easeCubicOut).attr("stroke-dashoffset", 0); });
      const cg = svg.append("g"); cg.append("line").attr("y1", m.t).attr("y2", Hh - m.b).attr("stroke", "#fff").attr("opacity", 0.55);
      const d0 = cg.append("circle").attr("r", 5).attr("fill", "#ff7a82").attr("stroke", "#fff").attr("stroke-width", 1.5), d1 = cg.append("circle").attr("r", 5.5).attr("fill", clr).attr("stroke", "#fff").attr("stroke-width", 1.5);
      curs[k] = (d) => { cg.attr("transform", `translate(${x(d)},0)`); d0.attr("cy", y(bs[d][k])); d1.attr("cy", y(as[d][k])); }; curs[k](day);
      svg.append("rect").attr("x", m.l).attr("y", m.t).attr("width", W - m.l - m.r).attr("height", Hh - m.t - m.b).attr("fill", "transparent").style("cursor", "ew-resize")
        .on("pointermove", (e) => { if (e.buttons) { if (timer) play(); setDay(Math.round(x.invert(d3.pointer(e)[0])), true); } }).on("pointerdown", (e) => { if (timer) play(); setDay(Math.round(x.invert(d3.pointer(e)[0])), true); });
    });
  };
  mk("exc", "", "#4ade80"); mk("open", "", "#4ade80"); mk("over", "", "#4ade80");
  show(cfg.mode === "decision" || !res.steps.length ? "events" : "steps");
  setDay(0, true); FX.sfx("riser");
  setTimeout(() => (apply || playBtn).focus({ preventScroll: true }), 400);
};



