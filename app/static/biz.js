"use strict";
/* Entity hover-cards + click navigation (every screen), KPI/OKR dashboard, task & resource analytics, and the business relationship map. */
const fmtK = (unit, v) => (unit === "pct" ? (v * 100).toFixed(1) + "%" : unit === "days" ? `${Math.round(v)}日` : unit === "idx2" ? v.toFixed(2) : unit === "yenM" ? "¥" + Math.round(v).toLocaleString(locale()) + "M" : unit === "idx" ? v.toFixed(0) : `${Math.round(v)}件`);
const KSTAT = { met: ["目標達成", "ok", "#34d399"], on_track: ["順調", "ok", "#4ade80"], at_risk: ["要注意", "warn", "#fbbf24"], off_track: ["未達の恐れ", "bad", "#ff7a82"] };
const HEALTH = { green: ["順調", "#34d399"], amber: ["注意", "#fbbf24"], red: ["危険", "#ff5a63"] };
const custArt = (id, size = 48) => (Number(id) <= 2 ? Art.customer(id, size) : Art.resource("vendor", (Number(id) * 47) % 360, size));

/* ------------------------------------------------ hover card + navigation */
A.ent = (el, type, id) => { el.dataset.ent = `${type}:${id}`; el.classList.add("ent"); return el; };
const entCache = new Map();
const entGet = async (type, id) => {
  const key = `${A.state.user}|${A.state.lang}|${type}:${id}`;
  if (!entCache.has(key)) entCache.set(key, api(`/api/biz/entity?type=${encodeURIComponent(type)}&id=${encodeURIComponent(id)}`).catch(() => null));
  return entCache.get(key);
};
const entArt = (a, size) => {
  if (!a) return null;
  if (a.kind === "customer") return custArt(a.id, size);
  if (a.kind === "product") return Art.product(a.id, size);
  if (a.kind === "person") return Art.person({ seed: a.id, g: a.gender || "m", age: a.age || 35, size });
  if (a.kind === "resource") return a.rkind === "person" ? Art.person({ seed: a.id, g: a.gender || "m", age: a.age || 35, size }) : Art.resource(a.rkind, { vendor: 200, studio: 280, equipment: 160 }[a.rkind], size);
  if (a.kind === "team") return Art.tile(TEAM_ICON[a.id] || "flag", TEAM_HUE[a.id] || 210, size);
  return Art.tile(a.name || "flag", a.hue || 210, size);
};
let entEl = null, entTimer = 0, entBox = null;
const entHide = () => { clearTimeout(entTimer); entEl = null; if (entBox) { entBox.classList.remove("on"); } };
function entPlace(e) {
  if (!entBox || !entBox.classList.contains("on")) return;
  const w = entBox.offsetWidth, hh = entBox.offsetHeight; let x = e.clientX + 18, y = e.clientY + 14;
  if (x + w > innerWidth - 10) x = e.clientX - w - 18; if (y + hh > innerHeight - 10) y = Math.max(10, innerHeight - hh - 10);
  entBox.style.left = Math.max(10, x) + "px"; entBox.style.top = Math.max(10, y) + "px";
}
async function entShow(el, ev) {
  const [type, ...rest] = el.dataset.ent.split(":"), id = rest.join(":");
  const c = await entGet(type, id);
  if (!c || entEl !== el) return;
  if (!entBox) { entBox = h("div", { class: "entcard", role: "tooltip" }); document.body.append(entBox); }
  const art = entArt(c.art, 54);
  entBox.replaceChildren(
    h("div", { class: "ec-h" }, art ? h("span", { class: "ec-art" }, art) : null, h("div", { class: "sp" }, h("b", {}, c.title), h("div", { class: "mut" }, c.sub || ""), c.tags.length ? h("div", { class: "row", style: "margin-top:4px" }, c.tags.map((t) => h("span", { class: "chip" }, t))) : null)),
    h("dl", { class: "ec-f" }, c.facts.flatMap(([k, v]) => [h("dt", {}, k), h("dd", {}, String(v))])),
    c.spark ? h("div", { class: "ec-s" }) : null,
    h("div", { class: "ec-go" }, ic("arrow", 13), "クリックで関連画面へ"));
  if (c.spark) { const s = entBox.querySelector(".ec-s"), W = 270, Hh = 40, arr = c.spark, mx = d3.max(arr), mn = Math.min(0, d3.min(arr)), x = d3.scaleLinear().domain([0, arr.length - 1]).range([2, W - 2]), y = d3.scaleLinear().domain([mn, mx || 1]).range([Hh - 3, 3]);
    const svg = d3.select(s).append("svg").attr("width", W).attr("height", Hh); svg.append("path").datum(arr).attr("fill", "none").attr("stroke", "#58a8ff").attr("stroke-width", 2).attr("d", d3.line().x((d, i) => x(i)).y((d) => y(d)).curve(d3.curveMonotoneX));
    svg.append("circle").attr("cx", x(arr.length - 1)).attr("cy", y(arr[arr.length - 1])).attr("r", 3.5).attr("fill", "#58a8ff"); }
  trDom(entBox); entBox.classList.add("on"); entPlace(ev);
}
document.addEventListener("pointerover", (e) => {
  const t = e.target.closest && e.target.closest("[data-ent]");
  if (!t || t === entEl) return;
  entEl = t; clearTimeout(entTimer); if (entBox) entBox.classList.remove("on"); A.tip.hide(); const ev = e;
  entTimer = setTimeout(() => entShow(t, ev), 230);
});
document.addEventListener("pointerout", (e) => { const t = e.target.closest && e.target.closest("[data-ent]"); if (t && !t.contains(e.relatedTarget)) entHide(); });
document.addEventListener("pointermove", entPlace);
document.addEventListener("scroll", entHide, true);
A.go = async (type, id) => {
  entHide();
  if (type === "team") A.state.teamFocus = id;
  if (type === "decision") A.state.focusDec = Number(id);
  if (type === "product" || type === "vendor") A.state.relFocus = `${type}:${id}`;
  if (type === "customer") { location.hash = `#/customer/${id}`; return; }
  if (type === "case") { location.hash = `#/case/${id}`; return; }
  if (type === "resource") { location.hash = `#/resource/${id}`; return; }
  const c = await entGet(type, id);
  if (c) { if (location.hash === c.link) A.render(); else location.hash = c.link; }
};
document.addEventListener("click", (e) => {
  const t = e.target.closest && e.target.closest("[data-ent]");
  if (!t || e.defaultPrevented) return;
  if (e.target.closest("button,a,input,select,textarea,label") && !t.matches("button,a")) return;
  const [type, ...rest] = t.dataset.ent.split(":");
  e.preventDefault(); e.stopPropagation(); FX.sfx("click"); A.go(type, rest.join(":"));
}, true);
/* tooltips are suppressed on entity elements (the card replaces them) */
const _tipShow = A.tip.show; A.tip.show = (html, ev) => { if (ev && ev.target && ev.target.closest && ev.target.closest("[data-ent]")) return; _tipShow(html, ev); };

/* ------------------------------------------------ OKR / KPI dashboard */
const ring = (el, v, color, size = 150, label) => {
  const r = size / 2 - 12, svg = d3.select(el).append("svg").attr("width", size).attr("height", size).attr("class", "ringc"), g = svg.append("g").attr("transform", `translate(${size / 2},${size / 2})`);
  const arc = d3.arc().innerRadius(r - 12).outerRadius(r).cornerRadius(7).startAngle(0);
  g.append("path").attr("d", arc({ endAngle: 6.283 })).attr("fill", "currentColor").attr("opacity", 0.1);
  const id = uid("rg"), lg = svg.append("defs").append("linearGradient").attr("id", id); lg.append("stop").attr("offset", 0).attr("stop-color", color); lg.append("stop").attr("offset", 1).attr("stop-color", "#a78bfa");
  const p = g.append("path").attr("fill", `url(#${id})`).attr("d", arc({ endAngle: 0 }));
  p.transition().duration(1400).ease(d3.easeCubicOut).attrTween("d", () => { const i = d3.interpolate(0, Math.min(v, 1) * 6.283); return (t) => arc({ endAngle: i(t) }); });
  const tx = g.append("text").attr("text-anchor", "middle").attr("dy", "0.1em").style("font-size", size / 4 + "px").style("font-weight", 800).style("fill", "currentColor").text("0%");
  tx.transition().duration(1400).tween("t", function () { const i = d3.interpolateRound(0, Math.round(v * 100)); return (t) => { this.textContent = i(t) + "%"; }; });
  if (label) g.append("text").attr("text-anchor", "middle").attr("y", size / 4 + 4).style("font-size", "11px").attr("opacity", 0.7).style("fill", "currentColor").text(label);
};
function radar(el, krs) {
  mount(el, (el, W) => {
    const S = Math.min(W, 420), R = S / 2 - 70, n = krs.length, svg = d3.select(el).append("svg").attr("width", W).attr("height", S), g = svg.append("g").attr("transform", `translate(${W / 2},${S / 2})`);
    const ang = (i) => (i / n) * Math.PI * 2 - Math.PI / 2, pt = (i, v) => [Math.cos(ang(i)) * R * v, Math.sin(ang(i)) * R * v];
    [0.25, 0.5, 0.75, 1].forEach((f) => g.append("polygon").attr("points", krs.map((k, i) => pt(i, f).join(",")).join(" ")).attr("fill", "none").attr("stroke", "currentColor").attr("opacity", f === 1 ? 0.35 : 0.12).attr("stroke-dasharray", f === 1 ? "4 3" : null));
    krs.forEach((k, i) => { const [x, y] = pt(i, 1); g.append("line").attr("x2", x).attr("y2", y).attr("stroke", "currentColor").attr("opacity", 0.1); const [lx, ly] = pt(i, 1.2);
      g.append("text").attr("x", lx).attr("y", ly).attr("text-anchor", Math.abs(lx) < 8 ? "middle" : lx > 0 ? "start" : "end").attr("dy", "0.35em").style("font-size", "10px").style("fill", "currentColor").attr("opacity", 0.75).text(fitText(tr(k.name), 96, 10)); });
    const poly = (vals) => vals.map((v, i) => pt(i, Math.min(1.1, v)).join(",")).join(" ");
    g.append("polygon").attr("points", poly(krs.map((k) => Math.min(1.1, k.proj_attain)))).attr("fill", "none").attr("stroke", "#fbbf24").attr("stroke-width", 1.6).attr("stroke-dasharray", "5 4").attr("opacity", 0.9);
    const cur = g.append("polygon").attr("points", poly(krs.map(() => 0))).attr("fill", "rgba(88,168,255,.28)").attr("stroke", "#58a8ff").attr("stroke-width", 2.5);
    cur.transition().duration(1200).ease(d3.easeBackOut.overshoot(1.1)).attr("points", poly(krs.map((k) => k.attain)));
    g.selectAll("circle").data(krs).join("circle").attr("cx", (k, i) => pt(i, 0)[0]).attr("cy", (k, i) => pt(i, 0)[1]).attr("r", 6).attr("fill", (k) => KSTAT[k.status][2]).attr("stroke", "#fff").attr("stroke-width", 1.5).attr("class", "ent").attr("data-ent", (k) => "kpi:" + k.id)
      .transition().duration(1200).ease(d3.easeBackOut.overshoot(1.1)).attr("cx", (k, i) => pt(i, Math.min(1.1, k.attain))[0]).attr("cy", (k, i) => pt(i, Math.min(1.1, k.attain))[1]);
  });
}
function krSpark(el, kr, day, len) {
  mount(el, (el, W) => {
    const Hh = 46, n = kr.series.length, x = d3.scaleLinear().domain([0, n + 4]).range([3, W - 3]), all = [...kr.series, kr.proj, kr.target, kr.baseline], y = d3.scaleLinear().domain([d3.min(all), d3.max(all)]).nice().range([Hh - 4, 4]);
    const svg = d3.select(el).append("svg").attr("width", W).attr("height", Hh);
    svg.append("line").attr("x1", 0).attr("x2", W).attr("y1", y(kr.target)).attr("y2", y(kr.target)).attr("stroke", "#34d399").attr("stroke-dasharray", "3 3").attr("opacity", 0.8);
    const ln = svg.append("path").datum(kr.series).attr("fill", "none").attr("stroke", KSTAT[kr.status][2]).attr("stroke-width", 2.2).attr("d", d3.line().x((d, i) => x(i)).y((d) => y(d)).curve(d3.curveMonotoneX));
    const L = ln.node().getTotalLength(); ln.attr("stroke-dasharray", `${L} ${L}`).attr("stroke-dashoffset", L).transition().duration(1100).attr("stroke-dashoffset", 0);
    svg.append("line").attr("x1", x(n - 1)).attr("y1", y(kr.series[n - 1])).attr("x2", x(n + 3)).attr("y2", y(kr.proj)).attr("stroke", "#fbbf24").attr("stroke-width", 2).attr("stroke-dasharray", "4 3").attr("opacity", 0).transition().delay(900).duration(400).attr("opacity", 1);
    svg.append("circle").attr("cx", x(n - 1)).attr("cy", y(kr.series[n - 1])).attr("r", 4).attr("fill", KSTAT[kr.status][2]);
  });
}
function okrTab(d) {
  const all = d.objectives.flatMap((o) => o.krs), top = h("div", { class: "okr-top" }), rg = h("div", { class: "ringw" }), rd = h("div", { class: "chart radar" });
  const pr = (d.day / d.len) * 100;
  top.append(h("div", { class: "card okr-hero" }, h("div", { class: "row" }, rg, h("div", { class: "sp" }, h("div", { class: "mut" }, "目標達成度（全KR平均）"), h("h2", { style: "font-size:26px;margin:4px 0" }, `Day ${d.day} / ${d.len}`),
    h("div", { class: "daybar" }, h("i", { style: `width:${pr}%` }), h("span", { style: `left:${pr}%` })), h("div", { class: "row", style: "margin-top:10px" }, Object.entries(d.counts).map(([k, n]) => h("span", { class: "chip " + KSTAT[k][1] }, `${KSTAT[k][0]} ${n}`))), h("p", { class: "mut", style: "font-size:11px;margin-top:8px" }, d.note)))),
    h("div", { class: "card" }, h("h3", {}, "KRの達成バランス", h("small", {}, "青=現在 / 黄の破線=Day 100の予測 / 外周=目標")), rd));
  ring(rg, d.overall, "#58a8ff", 150); radar(rd, all);
  const objs = d.objectives.map((o, oi) => rv(h("section", { class: "card obj" }, h("div", { class: "row" }, h("h3", { style: "margin:0" }, `${o.id}  ${o.title}`), h("span", { class: "sp" }), h("span", { class: "chip" }, `達成 ${Math.round(o.attain * 100)}%`)),
    h("div", { class: "krs" }, o.krs.map((k) => {
      const st = KSTAT[k.status], sp = h("div", { class: "chart" });
      const row = A.ent(h("div", { class: "kr" }, h("div", { class: "kr-n" }, h("b", {}, k.name), h("div", { class: "mut" }, k.source === "live" ? "実データから算出" : "模擬データ")),
        h("div", { class: "kr-v" }, h("b", {}, fmtK(k.unit, k.value)), h("div", { class: "mut" }, `目標 ${fmtK(k.unit, k.target)}`)),
        h("div", { class: "kr-b" }, h("div", { class: "bar" }, h("i", { style: `width:${Math.min(100, k.attain * 83)}%;background:${st[2]}` }), h("u", { title: tr("目標") }), h("s", { style: `left:${Math.min(100, k.proj_attain * 83)}%`, title: tr("Day 100の予測") })),
          h("div", { class: "mut" }, `達成率 ${Math.round(k.attain * 100)}% · Day100予測 ${fmtK(k.unit, k.proj)}`)),
        sp, h("span", { class: "chip " + st[1] }, st[0])), "kpi", k.id);
      krSpark(sp, k, d.day, d.len); return row;
    }))), oi + 1));
  return h("div", {}, top, h("div", { class: "stack", style: "margin-top:16px" }, objs));
}

/* ------------------------------------------------ task analytics */
function cfdChart(el, cfd) {
  mount(el, (el, W) => {
    const Hh = 260, m = { t: 14, r: 12, b: 24, l: 34 }, x = d3.scaleLinear().domain([-21, 28]).range([m.l, W - m.r]), tot = d3.max(cfd, (r) => r.done + r.doing + r.todo), y = d3.scaleLinear().domain([0, tot]).nice().range([Hh - m.b, m.t]);
    const svg = d3.select(el).append("svg").attr("width", W).attr("height", Hh), stack = d3.stack().keys(["done", "doing", "todo"])(cfd), clr = ["#3a8f6b", "#58a8ff", "#5b6b8a"], id = uid("cl");
    svg.append("defs").append("clipPath").attr("id", id).append("rect").attr("x", 0).attr("y", 0).attr("height", Hh).attr("width", 0).transition().duration(1500).ease(d3.easeCubicOut).attr("width", W);
    svg.append("g").attr("class", "axis grid-l").attr("transform", `translate(${m.l},0)`).call(d3.axisLeft(y).ticks(5).tickSize(-(W - m.l - m.r)).tickFormat(""));
    svg.append("g").attr("class", "axis").attr("transform", `translate(${m.l},0)`).call(d3.axisLeft(y).ticks(5).tickSize(0).tickPadding(6));
    svg.append("g").attr("class", "axis").attr("transform", `translate(0,${Hh - m.b})`).call(d3.axisBottom(x).ticks(8).tickFormat((d) => (d === 0 ? tr("今日") : (d > 0 ? "+" : "") + d)));
    const g = svg.append("g").attr("clip-path", `url(#${id})`);
    g.selectAll("path").data(stack).join("path").attr("fill", (d, i) => clr[i]).attr("opacity", 0.88).attr("d", d3.area().x((d) => x(d.data.d)).y0((d) => y(d[0])).y1((d) => y(d[1])).curve(d3.curveStepAfter));
    svg.append("line").attr("x1", x(0)).attr("x2", x(0)).attr("y1", m.t).attr("y2", Hh - m.b).attr("stroke", "#ff7a82").attr("stroke-width", 2);
    const cur = svg.append("g").style("display", "none"); cur.append("line").attr("y1", m.t).attr("y2", Hh - m.b).attr("stroke", "#fff").attr("opacity", 0.5);
    svg.append("rect").attr("x", m.l).attr("y", m.t).attr("width", W - m.l - m.r).attr("height", Hh - m.t - m.b).attr("fill", "transparent").on("pointermove", (e) => { const d = Math.round(x.invert(d3.pointer(e)[0])), r = cfd.find((q) => q.d === d); if (!r) return; cur.style("display", null).attr("transform", `translate(${x(d)},0)`);
      A.tip.show([Object.assign(document.createElement("b"), { textContent: `T${d >= 0 ? "+" : ""}${d}` }), document.createElement("br"), document.createTextNode(`完了 ${r.done} / 進行中 ${r.doing} / 未着手 ${r.todo}`)], e); }).on("pointerleave", () => { cur.style("display", "none"); A.tip.hide(); });
  });
}
function taskScatter(el, pts) {
  mount(el, (el, W) => {
    const Hh = 280, m = { t: 14, r: 14, b: 30, l: 40 }, x = d3.scaleLinear().domain([-5, 32]).range([m.l, W - m.r]), y = d3.scaleLinear().domain([0, 100]).range([Hh - m.b, m.t]);
    const svg = d3.select(el).append("svg").attr("width", W).attr("height", Hh);
    svg.append("rect").attr("x", x(-5)).attr("y", y(40)).attr("width", x(7) - x(-5)).attr("height", y(0) - y(40)).attr("fill", "#ff5a63").attr("opacity", 0.1);
    svg.append("text").attr("x", x(-4.5)).attr("y", y(36)).style("font-size", "10px").style("fill", "#ff7a82").text("期限が近く進捗が低い（要対応）");
    svg.append("g").attr("class", "axis grid-l").attr("transform", `translate(${m.l},0)`).call(d3.axisLeft(y).ticks(5).tickSize(-(W - m.l - m.r)).tickFormat(""));
    svg.append("g").attr("class", "axis").attr("transform", `translate(${m.l},0)`).call(d3.axisLeft(y).ticks(5).tickSize(0).tickPadding(6).tickFormat((d) => d + "%"));
    svg.append("g").attr("class", "axis").attr("transform", `translate(0,${Hh - m.b})`).call(d3.axisBottom(x).ticks(8).tickFormat((d) => `+${d}`));
    svg.append("text").attr("x", W - m.r).attr("y", Hh - 4).attr("text-anchor", "end").style("font-size", "10px").attr("opacity", 0.7).style("fill", "currentColor").text("期限までの日数 →");
    svg.selectAll("circle").data(pts).join("circle").attr("class", "ent").attr("data-ent", (d) => "task:" + d.id).attr("cx", (d) => x(Math.max(-5, Math.min(32, d.due)))).attr("cy", y(0)).attr("r", 0).attr("fill", (d) => `hsl(${TEAM_HUE[d.team]},70%,58%)`).attr("fill-opacity", 0.8)
      .attr("stroke", (d) => (d.late > 0 ? "#ff5a63" : "#fff")).attr("stroke-width", (d) => (d.late > 0 ? 3 : 1)).transition().delay((d, i) => i * 45).duration(900).ease(d3.easeElasticOut.amplitude(1.1)).attr("cy", (d) => y(d.progress)).attr("r", (d) => 9 + Math.min(8, d.late * 1.2));
  });
}
function stackedBars(el, teams) {
  mount(el, (el, W) => {
    const rowH = 30, Hh = teams.length * rowH + 14, lab = 84, mx = d3.max(teams, (t) => t.todo + t.doing + t.done), x = d3.scaleLinear().domain([0, mx]).range([lab, W - 40]);
    const svg = d3.select(el).append("svg").attr("width", W).attr("height", Hh), clr = { done: "#3a8f6b", doing: "#58a8ff", todo: "#5b6b8a" };
    teams.forEach((t, i) => { const y = 6 + i * rowH, g = svg.append("g").attr("class", "ent").attr("data-ent", "team:" + t.key); g.append("text").attr("x", 0).attr("y", y + 16).style("font-size", "12px").style("fill", "currentColor").text(fitText(tr(t.label), lab - 8, 12));
      let acc = 0; ["done", "doing", "todo"].forEach((k) => { const w = x(t[k]) - x(0); g.append("rect").attr("x", x(acc)).attr("y", y).attr("height", 22).attr("rx", 5).attr("fill", clr[k]).attr("width", 0).transition().delay(i * 70).duration(800).attr("width", Math.max(0, w - 2)); acc += t[k]; });
      if (t.late) g.append("text").attr("x", x(acc) + 8).attr("y", y + 16).style("font-size", "11px").style("fill", "#ff7a82").text(`遅延 ${t.late}`); });
  });
}
function taskTab(d) {
  const kt = (k, v, s, i, f) => kpiTile(k, v, s, i, f);
  const cfd = h("div", { class: "chart" }), sc = h("div", { class: "chart" }), sb = h("div", { class: "chart" }), dn = h("div", { class: "chart" });
  const kinds = d.exception_kinds.map((x, i) => ({ label: KIND_LABEL[x.kind] || x.kind, value: x.n, color: PAL[i % PAL.length] }));
  const late = d.teams.reduce((a, t) => a + t.late, 0);
  const el = h("div", {}, h("div", { class: "kpis flat" }, kt("未完了の作業", d.teams.reduce((a, t) => a + t.todo + t.doing, 0), "全チーム", 1), kt("遅延見込みの作業", late, "過負荷による後ろ倒し", 2), kt("判断待ち", d.decisions.open, `うちレッド ${d.decisions.red}`, 3), kt("将来の予測例外", d.totals.exceptions, "今後28日", 4)),
    h("div", { class: "grid g2", style: "margin-top:16px" }, h("section", { class: "card" }, h("h3", {}, "累積フロー図（作業の流れ）", h("small", {}, "完了・進行中・未着手の推移と予測（遅延を織り込み）")), h("div", { class: "legend" }, [["完了", "#3a8f6b"], ["進行中", "#58a8ff"], ["未着手", "#5b6b8a"]].map(([t, c]) => h("span", {}, h("i", { style: `background:${c}` }), t))), cfd),
      h("section", { class: "card" }, h("h3", {}, "チーム別の作業状況", h("small", {}, "クリックでタスク管理へ")), sb)),
    h("div", { class: "grid g2", style: "margin-top:16px" }, h("section", { class: "card" }, h("h3", {}, "期限リスク・マップ", h("small", {}, "横=期限までの日数 / 縦=進捗 / 赤枠=遅延見込み")), sc), h("section", { class: "card" }, h("h3", {}, "例外の種類（未対応）"), dn)));
  cfdChart(cfd, d.cfd); taskScatter(sc, d.scatter); stackedBars(sb, d.teams); Charts.donut(dn, kinds, "件");
  return el;
}

/* ------------------------------------------------ resource analytics */
function supplyDemand(el, sd, kind) {
  mount(el, (el, W) => {
    const Hh = 260, m = { t: 14, r: 12, b: 24, l: 34 }, x = d3.scaleLinear().domain([0, 28]).range([m.l, W - m.r]), cap = sd[0].cap[kind], mx = Math.max(cap, d3.max(sd, (r) => r.demand[kind])) * 1.15, y = d3.scaleLinear().domain([0, mx]).nice().range([Hh - m.b, m.t]);
    const svg = d3.select(el).append("svg").attr("width", W).attr("height", Hh), id = uid("sd"), lg = svg.append("defs").append("linearGradient").attr("id", id).attr("x1", 0).attr("x2", 0).attr("y1", 0).attr("y2", 1);
    lg.append("stop").attr("offset", 0).attr("stop-color", "#f97316").attr("stop-opacity", 0.7); lg.append("stop").attr("offset", 1).attr("stop-color", "#58a8ff").attr("stop-opacity", 0.1);
    svg.append("g").attr("class", "axis grid-l").attr("transform", `translate(${m.l},0)`).call(d3.axisLeft(y).ticks(5).tickSize(-(W - m.l - m.r)).tickFormat(""));
    svg.append("g").attr("class", "axis").attr("transform", `translate(${m.l},0)`).call(d3.axisLeft(y).ticks(5).tickSize(0).tickPadding(6));
    svg.append("g").attr("class", "axis").attr("transform", `translate(0,${Hh - m.b})`).call(d3.axisBottom(x).ticks(7).tickFormat((d) => "T+" + d));
    const area = d3.area().x((r) => x(r.d)).y0(y(0)).y1((r) => y(r.demand[kind])).curve(d3.curveMonotoneX);
    svg.append("path").datum(sd).attr("fill", `url(#${id})`).attr("d", d3.area().x((r) => x(r.d)).y0(y(0)).y1(y(0))).transition().duration(1100).attr("d", area);
    const p = svg.append("path").datum(sd).attr("fill", "none").attr("stroke", "#f97316").attr("stroke-width", 2.6).attr("d", d3.line().x((r) => x(r.d)).y((r) => y(r.demand[kind])).curve(d3.curveMonotoneX)); const L = p.node().getTotalLength(); p.attr("stroke-dasharray", `${L} ${L}`).attr("stroke-dashoffset", L).transition().duration(1200).attr("stroke-dashoffset", 0);
    svg.append("line").attr("x1", m.l).attr("x2", W - m.r).attr("y1", y(cap)).attr("y2", y(cap)).attr("stroke", "#34d399").attr("stroke-width", 2).attr("stroke-dasharray", "6 4");
    svg.append("text").attr("x", W - m.r - 4).attr("y", y(cap) - 6).attr("text-anchor", "end").style("font-size", "11px").style("fill", "#34d399").text(`${tr("供給（キャパシティ）")} ${cap}`);
    svg.append("rect").attr("x", m.l).attr("y", m.t).attr("width", W - m.l - m.r).attr("height", Hh - m.t - m.b).attr("fill", "transparent").on("pointermove", (e) => { const dd = sd[Math.max(0, Math.min(28, Math.round(x.invert(d3.pointer(e)[0]))))]; A.tip.show([Object.assign(document.createElement("b"), { textContent: `T+${dd.d}` }), document.createElement("br"), document.createTextNode(`${tr("需要")} ${dd.demand[kind]} / ${tr("供給")} ${cap}`)], e); }).on("pointerleave", A.tip.hide);
  });
}
function histogram(el, hist) {
  mount(el, (el, W) => {
    const Hh = 220, m = { t: 14, r: 10, b: 38, l: 30 }, labs = ["〜25%", "〜50%", "〜75%", "〜100%", "〜125%", "〜150%", "〜175%", "175%〜"], x = d3.scaleBand().domain(d3.range(8)).range([m.l, W - m.r]).padding(0.2), y = d3.scaleLinear().domain([0, d3.max(hist) + 1]).range([Hh - m.b, m.t]);
    const svg = d3.select(el).append("svg").attr("width", W).attr("height", Hh);
    svg.append("g").attr("class", "axis").attr("transform", `translate(${m.l},0)`).call(d3.axisLeft(y).ticks(4).tickSize(0).tickPadding(6));
    svg.selectAll("rect").data(hist).join("rect").attr("x", (d, i) => x(i)).attr("width", x.bandwidth()).attr("rx", 5).attr("y", y(0)).attr("height", 0).attr("fill", (d, i) => utilClr((i + 0.5) * 0.25)).transition().delay((d, i) => i * 70).duration(800).ease(d3.easeBackOut).attr("y", (d) => y(d)).attr("height", (d) => y(0) - y(d));
    svg.selectAll("text.l").data(labs).join("text").attr("class", "l").attr("x", (d, i) => x(i) + x.bandwidth() / 2).attr("y", Hh - 20).attr("text-anchor", "middle").style("font-size", "10px").style("fill", "currentColor").attr("opacity", 0.7).text((d) => d);
    svg.selectAll("text.v").data(hist).join("text").attr("class", "v").attr("x", (d, i) => x(i) + x.bandwidth() / 2).attr("y", (d) => y(d) - 4).attr("text-anchor", "middle").style("font-size", "11px").style("fill", "currentColor").text((d) => (d ? d : ""));
  });
}
function resTab(d) {
  let kind = "person";
  const sdBox = h("div", { class: "chart" }), seg = h("div", { class: "seg" }), hi = h("div", { class: "chart" }), mix = h("div", { class: "chart" }), cost = h("div", { class: "chart" });
  const drawSd = () => { sdBox.replaceChildren(); supplyDemand(sdBox, d.supply_demand, kind); [...seg.children].forEach((b) => b.classList.toggle("on", b.dataset.k === kind)); };
  Object.entries(RKIND).forEach(([k, t]) => seg.append(h("button", { "data-k": k, onclick: () => { kind = k; drawSd(); } }, t)));
  const skills = d.skills.slice(0, 10).map((s) => { const r = s.demand / Math.max(1, s.supply); return h("div", { class: "skr" }, h("span", { class: "lb" }, s.skill), h("div", { class: "ub" }, h("i", { style: `width:${Math.min(100, r * 70)}%;background:${utilClr(r)}` }), h("u", {})), h("b", { class: r > 1.05 ? "bad" : "" }, Math.round(r * 100) + "%")); });
  const bench = d.bench.map((b) => A.ent(h("div", { class: "bench" }, h("span", { class: "av" }, resAvatar(b, 36)), h("div", { class: "sp" }, h("b", {}, b.name), h("div", { class: "mut" }, `${RKIND[b.kind]} · ${teamLabel(b.team)}`)), h("b", { class: "ok" }, `${b.spare}`), h("span", { class: "mut" }, "余力(人日)")), "resource", b.id));
  const el = h("div", {}, h("div", { class: "kpis flat" }, kpiTile("今後28日の過負荷", d.totals.overload_days, "リソース日", 1), kpiTile("遅延見込みの合計", d.totals.late_days, "日（全タスク）", 2), kpiTile("将来の予測例外", d.totals.exceptions, "今後28日", 3), kpiTile("外部の依存度", Math.round(d.mix.filter((m) => m.kind !== "person").reduce((a, m) => a + m.value, 0) / Math.max(1, d.mix.reduce((a, m) => a + m.value, 0)) * 100), "稼働量に占める外部・設備の割合", 4, (v) => v + "%")),
    h("section", { class: "card", style: "margin-top:16px" }, h("div", { class: "row" }, h("h3", { style: "margin:0" }, "需要と供給（キャパシティ）", h("small", {}, "橙=需要（配分された稼働）/ 緑の破線=供給")), h("span", { class: "sp" }), seg), sdBox),
    h("div", { class: "grid g2", style: "margin-top:16px" }, h("section", { class: "card" }, h("h3", {}, "稼働率の分布", h("small", {}, "リソースの28日平均稼働率")), hi), h("section", { class: "card" }, h("h3", {}, "スキル別の需給バランス", h("small", {}, "需要÷供給（105%超は逼迫）")), h("div", { class: "skills-l" }, skills))),
    h("div", { class: "grid g2", style: "margin-top:16px" }, h("section", { class: "card" }, h("h3", {}, "余力のあるリソース（上位）", h("small", {}, "今後28日の空き稼働")), h("div", { class: "stack" }, bench)),
      h("section", { class: "card" }, h("h3", {}, d.cost ? "チーム別の稼働コスト（今後28日）" : "リソースの構成（稼働量）"), d.cost ? cost : mix)));
  drawSd(); histogram(hi, d.hist);
  Charts.donut(mix, d.mix.map((m, i) => ({ label: RKIND[m.kind], value: m.value, color: PAL[i] })), "人日");
  if (d.cost) Charts.bars(cost, d.cost.map((c) => ({ label: teamLabel(c.team), series: [{ k: "コスト", v: c.value, color: `hsl(${TEAM_HUE[c.team]},70%,58%)` }] })));
  return el;
}
A.v.analytics = async () => {
  const st = (A.state.an = A.state.an || { tab: "okr" });
  A.crumbs("分析ダッシュボード");
  const body = h("div", {}), seg = h("div", { class: "seg big" });
  const TABS = [["okr", "KPI / OKR", "gauge"], ["tasks", "タスク分析", "tasks"], ["res", "リソース分析", "resources"]];
  const draw = async () => {
    [...seg.children].forEach((b) => b.classList.toggle("on", b.dataset.k === st.tab));
    body.replaceChildren(h("div", { class: "empty" }, "読み込み中…"));
    try { const d = st.tab === "okr" ? await api("/api/biz/okr") : st.tab === "tasks" ? await api("/api/biz/analytics/tasks") : await api("/api/biz/analytics/resources"); body.replaceChildren(st.tab === "okr" ? okrTab(d) : st.tab === "tasks" ? taskTab(d) : resTab(d)); }
    catch (e) { body.replaceChildren(h("div", { class: "card empty bad" }, e.message)); }
  };
  TABS.forEach(([k, t, i]) => seg.append(h("button", { "data-k": k, class: "tabbtn", onclick: () => { st.tab = k; draw(); } }, ic(i, 15), t)));
  A.mount(h("div", {}, h("div", { class: "row", style: "margin-bottom:14px" }, h("h1", { style: "font-size:26px;margin:0" }, "分析ダッシュボード"), h("span", { class: "sp" }), seg), body));
  await draw();
};

/* ------------------------------------------------ business relationship map */
const RELCLR = { order: "#58a8ff", deal: "#a78bfa", product: "#f472b6", team: "#2dd4bf", staff: "#34d399", vendor: "#fbbf24", asset: "#fb7185", kpi: "#60a5fa" };
A.v.relations = async () => {
  const g = await api("/api/biz/graph");
  A.crumbs("ビジネス関連図");
  const box = h("div", { class: "chart rel" }), info = h("div", { class: "row mut" });
  let focus = A.state.relFocus || null; A.state.relFocus = null;
  const legend = h("div", { class: "legend big" }, Object.entries(g.legend).map(([k, t]) => h("span", {}, h("i", { style: `background:${RELCLR[k]}` }), t)));
  A.mount(h("div", {}, h("div", { class: "row", style: "margin-bottom:6px" }, h("h1", { style: "font-size:26px;margin:0" }, "ビジネス関連図"), h("span", { class: "sp" }), info),
    h("p", { class: "mut", style: "margin-bottom:10px" }, "顧客 → 案件 → 商材・チーム → 人・外部の取引先 → 作品・成果指標 という事業のつながりを表示します。ノードにマウスを乗せると詳細、クリックで関連画面へ。線は取引・稼働の大きさです。"), legend, h("section", { class: "card", style: "margin-top:10px;padding:10px" }, box)));
  const cols = g.cols.length;
  mount(box, (el, W) => {
    const nodes = g.nodes.map((n) => ({ ...n })), byId = Object.fromEntries(nodes.map((n) => [n.id, n])), links = g.links.map((l) => ({ ...l, s: byId[l.source], t: byId[l.target] })).filter((l) => l.s && l.t);
    const adj = {}; links.forEach((l) => { (adj[l.s.id] = adj[l.s.id] || []).push(l.t.id); (adj[l.t.id] = adj[l.t.id] || []).push(l.s.id); });
    const colNodes = d3.range(cols).map((c) => nodes.filter((n) => n.col === c));
    colNodes.forEach((ns, c) => ns.forEach((n, i) => (n.o = i)));
    for (let pass = 0; pass < 4; pass++) colNodes.forEach((ns, c) => { if (!c) return; ns.forEach((n) => { const nb = (adj[n.id] || []).map((id) => byId[id]).filter((m) => m.col < c); n.o = nb.length ? d3.mean(nb, (m) => m.o) : n.o; }); ns.sort((a, b) => a.o - b.o).forEach((n, i) => (n.o = i)); });
    const rowH = 26, maxN = d3.max(colNodes, (c) => c.length), Hh = Math.max(420, maxN * rowH + 40), nw = 14, padL = 8, colW = (W - 16 - 230) / (cols - 1), X = (c) => padL + c * colW;
    colNodes.forEach((ns, c) => { const off = (Hh - 30 - ns.length * rowH) / 2 + 24; ns.forEach((n, i) => { n.x = X(c); n.y = off + i * rowH + rowH / 2; }); });
    const svg = d3.select(el).append("svg").attr("width", W).attr("height", Hh), defs = svg.append("defs");
    g.cols.forEach((t, c) => svg.append("text").attr("x", X(c)).attr("y", 14).style("font-size", "11px").style("font-weight", 700).style("fill", "currentColor").attr("opacity", 0.6).text(tr(t)));
    const vmax = d3.max(links, (l) => l.value), sw = d3.scaleSqrt().domain([0, vmax]).range([1.2, 12]);
    const lg = svg.append("g").attr("fill", "none"), path = lg.selectAll("path").data(links).join("path").attr("class", "rl").attr("d", (l) => { const x0 = l.s.x + nw, x1 = l.t.x, m = (x0 + x1) / 2; return `M${x0},${l.s.y} C${m},${l.s.y} ${m},${l.t.y} ${x1},${l.t.y}`; })
      .attr("stroke", (l) => RELCLR[l.rel]).attr("stroke-width", (l) => sw(l.value)).attr("stroke-opacity", 0.38);
    lg.selectAll("path.rf").data(links).join("path").attr("class", "rf").attr("d", (l) => { const x0 = l.s.x + nw, x1 = l.t.x, m = (x0 + x1) / 2; return `M${x0},${l.s.y} C${m},${l.s.y} ${m},${l.t.y} ${x1},${l.t.y}`; }).attr("stroke", "#fff").attr("stroke-width", 1.2).attr("pointer-events", "none");
    const ng = svg.append("g").selectAll("g").data(nodes).join("g").attr("class", "rn ent").attr("transform", (n) => `translate(${n.x},${n.y})`).attr("data-ent", (n) => (n.type === "kpi_case" ? null : `${n.type}:${n.ref}`)).style("cursor", "pointer");
    ng.append("rect").attr("x", 0).attr("y", -9).attr("width", nw).attr("height", 18).attr("rx", 5).attr("fill", (n) => ({ customer: "#58a8ff", case: "#8b6cff", opportunity: "#a78bfa", product: "#f472b6", team: "#2dd4bf", resource: "#34d399", vendor: "#fbbf24", asset: "#fb7185", kpi_case: "#60a5fa" })[n.type]);
    ng.append("text").attr("x", nw + 6).attr("y", 4).style("font-size", "11.5px").style("fill", "currentColor").text((n) => fitText(tr(n.label), n.col >= cols - 1 ? 220 : colW - nw - 14, 11.5));
    ng.filter((n) => n.type === "kpi_case").on("click", () => (location.hash = "#/analytics"));
    path.on("pointermove", (e, l) => A.tip.show([Object.assign(document.createElement("b"), { textContent: l.label }), document.createElement("br"), document.createTextNode(`${l.s.label} → ${l.t.label}`)], e)).on("pointerleave", A.tip.hide);
    const apply = () => {
      if (!focus) { path.attr("stroke-opacity", 0.38); ng.attr("opacity", 1); info.replaceChildren(); return; }
      const f = byId[focus]; if (!f) { focus = null; return apply(); }
      const keep = new Set([f.id]); let frontier = [f.id];
      for (const dir of ["left", "right"]) { frontier = [f.id]; while (frontier.length) { const nx = []; links.forEach((l) => { if (dir === "right" && frontier.includes(l.s.id) && !keep.has(l.t.id)) { keep.add(l.t.id); nx.push(l.t.id); } if (dir === "left" && frontier.includes(l.t.id) && !keep.has(l.s.id)) { keep.add(l.s.id); nx.push(l.s.id); } }); frontier = nx; } }
      path.attr("stroke-opacity", (l) => (keep.has(l.s.id) && keep.has(l.t.id) ? 0.85 : 0.05)); ng.attr("opacity", (n) => (keep.has(n.id) ? 1 : 0.15));
      info.replaceChildren(h("span", { class: "chip ai" }, ic("sparkle", 12), `選択中: ${f.label}`), h("button", { class: "btn sm", onclick: () => { focus = null; apply(); } }, "選択を解除"));
    };
    ng.on("contextmenu", (e, n) => { e.preventDefault(); focus = focus === n.id ? null : n.id; apply(); });
    if (focus) apply();
    svg.append("text").attr("x", W - 8).attr("y", Hh - 6).attr("text-anchor", "end").style("font-size", "10px").style("fill", "currentColor").attr("opacity", 0.5).text(tr("右クリックで関連するつながりだけを強調"));
  });
};
