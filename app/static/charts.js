"use strict";
/* d3 charts. Every chart renders into a container, is responsive (ResizeObserver) and animates on entry. */
const Charts = {};
const _d3text = d3.selection.prototype.text;
d3.selection.prototype.text = function (v) { // every chart label goes through the translator
  if (typeof v === "string") return _d3text.call(this, tr(v));
  if (typeof v === "function") return _d3text.call(this, function (...a) { const r = v.apply(this, a); return typeof r === "string" ? tr(r) : r; });
  return _d3text.apply(this, arguments);
};
const PAL = ["#4da3ff", "#8b6cff", "#2dd4bf", "#f59e0b", "#f472b6", "#34d399", "#fb7185", "#60a5fa", "#c084fc"];
const parseDay = d3.timeParse("%Y-%m-%d");
const fmtMD = d3.timeFormat("%-m/%-d");
let uidN = 0; const uid = (p) => `${p}${++uidN}`;

function mount(el, draw) {
  let w0 = 0, first = true;
  const run = () => {
    const w = Math.floor(el.clientWidth);
    if (!w || (w === w0 && !first)) return;
    w0 = w; el.replaceChildren(); draw(el, w, first); first = false;
  };
  const ro = new ResizeObserver(() => { clearTimeout(el._t); el._t = setTimeout(() => { if (!el.isConnected) { ro.disconnect(); return; } run(); }, 90); });
  ro.observe(el); run();
  let tries = 0; /* elements are often created before they are attached: poll until they have a size */
  const poll = () => { if (!first || ++tries > 80) return; if (el.isConnected && el.clientWidth) run(); else setTimeout(poll, 50); };
  setTimeout(poll, 0);
}
const empty = (el, msg) => el.append(Object.assign(document.createElement("div"), { className: "empty", textContent: tr(msg || "データがありません") }));

/* Lifecycle pipeline: cases per stage */
Charts.pipeline = (el, stages, counts, onClick) => mount(el, (el, W) => {
  const n = stages.length, H = 112, gap = 3, tip = 16, cw = (W - (n - 1) * gap) / n;
  const svg = d3.select(el).append("svg").attr("width", W).attr("height", H).attr("role", "img").attr("aria-label", tr("ライフサイクル別の案件数"));
  const g = svg.selectAll("g").data(stages).join("g").attr("transform", (d, i) => `translate(${i * (cw + gap)},0)`).style("cursor", "pointer").attr("opacity", 0)
    .attr("tabindex", 0).on("click", (e, d) => onClick && onClick(d.key)).on("keydown", (e, d) => { if (e.key === "Enter") onClick && onClick(d.key); })
    .on("pointermove", (e, d) => A.tip.show([Object.assign(document.createElement("b"), { textContent: d.label }), document.createElement("br"), document.createTextNode(d.desc)], e)).on("pointerleave", A.tip.hide);
  g.append("polygon").attr("points", (d, i) => `0,0 ${cw - tip},0 ${cw},${H / 2} ${cw - tip},${H} 0,${H}` + (i ? ` ${tip},${H / 2}` : ""))
    .attr("fill", (d, i) => d3.interpolateRgb("#2f7cf6", "#a06bff")(i / (n - 1))).attr("fill-opacity", (d) => (counts[d.key] ? 0.92 : 0.28));
  g.append("text").attr("x", (d, i) => (i ? tip : 0) + (cw - tip - (i ? tip : 0)) / 2 + 4).attr("y", 52).attr("text-anchor", "middle").attr("class", "cnt").style("fill", "#fff").style("font-size", "30px").style("font-weight", 700).text(0);
  g.append("text").attr("x", (d, i) => (i ? tip : 0) + (cw - tip - (i ? tip : 0)) / 2 + 4).attr("y", 80).attr("text-anchor", "middle").style("fill", "#fff").style("font-size", Math.max(10, Math.min(13, cw / 9)) + "px").text((d) => d.label);
  g.transition().delay((d, i) => i * 70).duration(600).attr("opacity", 1);
  g.select(".cnt").transition().delay((d, i) => i * 70).duration(900).tween("t", function (d) { const it = d3.interpolateRound(0, counts[d.key] || 0); return (t) => { this.textContent = it(t); }; });
});

/* Time series with moving average and crosshair. rows: [{day, v}] */
Charts.trend = (el, rows, o = {}) => mount(el, (el, W) => {
  if (!rows.length) return empty(el);
  const data = rows.map((r) => ({ d: parseDay(r.day), v: r.v }));
  const H = o.h || 250, m = { t: 14, r: 14, b: 26, l: 58 }, color = o.color || PAL[0], fmt = o.fmt || num, id = uid("g");
  const x = d3.scaleTime().domain(d3.extent(data, (d) => d.d)).range([m.l, W - m.r]);
  const y = d3.scaleLinear().domain([0, (d3.max(data, (d) => d.v) || 1) * 1.12]).nice().range([H - m.b, m.t]);
  const svg = d3.select(el).append("svg").attr("width", W).attr("height", H);
  const defs = svg.append("defs"); const lg = defs.append("linearGradient").attr("id", id).attr("x1", 0).attr("x2", 0).attr("y1", 0).attr("y2", 1);
  lg.append("stop").attr("offset", 0).attr("stop-color", color).attr("stop-opacity", 0.55); lg.append("stop").attr("offset", 1).attr("stop-color", color).attr("stop-opacity", 0);
  svg.append("g").attr("class", "axis grid-l").attr("transform", `translate(${m.l},0)`).call(d3.axisLeft(y).ticks(5).tickSize(-(W - m.l - m.r)).tickFormat(""));
  svg.append("g").attr("class", "axis").attr("transform", `translate(${m.l},0)`).call(d3.axisLeft(y).ticks(5).tickSize(0).tickPadding(8).tickFormat((v) => d3.format(".2s")(v).replace("G", "B")));
  svg.append("g").attr("class", "axis").attr("transform", `translate(0,${H - m.b})`).call(d3.axisBottom(x).ticks(Math.max(3, Math.floor(W / 90))).tickFormat(fmtMD));
  const area = d3.area().x((d) => x(d.d)).y0(y(0)).y1((d) => y(d.v)).curve(d3.curveMonotoneX);
  const line = d3.line().x((d) => x(d.d)).y((d) => y(d.v)).curve(d3.curveMonotoneX);
  svg.append("path").datum(data).attr("fill", `url(#${id})`).attr("d", d3.area().x((d) => x(d.d)).y0(y(0)).y1(y(0)).curve(d3.curveMonotoneX)).transition().duration(900).ease(d3.easeCubicOut).attr("d", area);
  const p = svg.append("path").datum(data).attr("fill", "none").attr("stroke", color).attr("stroke-width", 2.5).attr("d", line);
  const L = p.node().getTotalLength(); p.attr("stroke-dasharray", `${L} ${L}`).attr("stroke-dashoffset", L).transition().duration(1100).ease(d3.easeCubicOut).attr("stroke-dashoffset", 0);
  const ma = data.map((d, i) => ({ d: d.d, v: d3.mean(data.slice(Math.max(0, i - 6), i + 1), (q) => q.v) }));
  svg.append("path").datum(ma).attr("fill", "none").attr("stroke", "#f59e0b").attr("stroke-width", 1.6).attr("stroke-dasharray", "4 4").attr("opacity", 0).attr("d", line).transition().delay(700).duration(500).attr("opacity", 0.95);
  const cross = svg.append("g").style("display", "none"); cross.append("line").attr("y1", m.t).attr("y2", H - m.b).attr("stroke", "currentColor").attr("opacity", 0.25);
  const dot = cross.append("circle").attr("r", 5).attr("fill", color).attr("stroke", "#fff").attr("stroke-width", 2);
  const bis = d3.bisector((d) => d.d).center;
  svg.append("rect").attr("x", m.l).attr("y", m.t).attr("width", W - m.l - m.r).attr("height", H - m.t - m.b).attr("fill", "transparent")
    .on("pointermove", (e) => { const mx = d3.pointer(e)[0], d = data[bis(data, x.invert(mx))]; cross.style("display", null).attr("transform", `translate(${x(d.d)},0)`); dot.attr("cy", y(d.v));
      A.tip.show([Object.assign(document.createElement("b"), { textContent: d3.timeFormat("%Y/%-m/%-d")(d.d) }), document.createElement("br"), document.createTextNode(`${o.label || ""} ${fmt(d.v)}`), document.createElement("br"), document.createTextNode(`7日平均 ${fmt(ma[data.indexOf(d)].v)}`)], e); })
    .on("pointerleave", () => { cross.style("display", "none"); A.tip.hide(); });
});

/* Donut. data: [{label, value, color, sub}] */
Charts.donut = (el, data, center) => mount(el, (el, W) => {
  data = data.filter((d) => d.value > 0);
  if (!data.length) return empty(el, "未対応の例外はありません");
  const S = Math.min(W, 230), r = S / 2;
  const box = d3.select(el).append("div").style("display", "flex").style("gap", "18px").style("align-items", "center").style("flex-wrap", "wrap");
  const svg = box.append("svg").attr("width", S).attr("height", S).style("flex", "none").append("g").attr("transform", `translate(${r},${r})`);
  const arc = d3.arc().innerRadius(r * 0.62).outerRadius(r - 4).cornerRadius(5).padAngle(0.025), big = d3.arc().innerRadius(r * 0.6).outerRadius(r).cornerRadius(5).padAngle(0.025);
  const total = d3.sum(data, (d) => d.value);
  const ctr = svg.append("text").attr("text-anchor", "middle").attr("y", 8).style("font-size", "34px").style("font-weight", 700).style("fill", "var(--fg)").text(total);
  const sub = svg.append("text").attr("text-anchor", "middle").attr("y", 30).text(center || "");
  const paths = svg.selectAll("path").data(d3.pie().value((d) => d.value).sort(null)(data)).join("path").attr("fill", (d) => d.data.color).style("cursor", "pointer")
    .on("pointerenter", function (e, d) { d3.select(this).transition().duration(150).attr("d", big); ctr.text(d.data.value); sub.text(d.data.label.slice(0, 10)); })
    .on("pointerleave", function () { d3.select(this).transition().duration(150).attr("d", arc); ctr.text(total); sub.text(center || ""); });
  paths.transition().duration(900).attrTween("d", (d) => { const i = d3.interpolate({ startAngle: d.startAngle, endAngle: d.startAngle }, d); return (t) => arc(i(t)); });
  const lg = box.append("div").style("display", "grid").style("gap", "6px").style("font-size", "12px").style("min-width", "150px").style("flex", "1");
  data.forEach((d) => { const row = lg.append("div").style("display", "flex").style("gap", "8px").style("align-items", "center"); row.append("i").style("width", "10px").style("height", "10px").style("border-radius", "3px").style("background", d.color).style("flex", "none");
    row.append("span").style("flex", 1).style("color", "var(--fg2)").text(d.label); row.append("b").style("font-variant-numeric", "tabular-nums").text(d.value); });
});

/* Grouped horizontal bars. items: [{label, series:[{k,v,color}]}] */
Charts.bars = (el, items, o = {}) => mount(el, (el, W) => {
  if (!items.length) return empty(el);
  const fmt = o.fmt || yenM, keys = items[0].series.map((s) => s.k), m = { t: 4, r: 70, b: 22, l: Math.min(190, W * 0.34) };
  const gh = 22 * keys.length + 16, H = items.length * gh + m.t + m.b;
  const x = d3.scaleLinear().domain([0, d3.max(items, (d) => d3.max(d.series, (s) => s.v)) || 1]).nice().range([m.l, W - m.r]);
  const y0 = d3.scaleBand().domain(items.map((d, i) => i)).range([m.t, H - m.b]).paddingInner(0.18), y1 = d3.scaleBand().domain(keys).range([0, y0.bandwidth()]).padding(0.12);
  const svg = d3.select(el).append("svg").attr("width", W).attr("height", H);
  svg.append("g").attr("class", "axis grid-l").attr("transform", `translate(0,${H - m.b})`).call(d3.axisBottom(x).ticks(5).tickSize(-(H - m.t - m.b)).tickFormat((v) => d3.format(".2s")(v).replace("G", "B")));
  const rows = svg.selectAll("g.r").data(items).join("g").attr("class", (d) => (d.ent ? "r ent" : "r")).attr("data-ent", (d) => d.ent || null).attr("transform", (d, i) => `translate(0,${y0(i)})`);
  rows.append("text").attr("x", m.l - 10).attr("y", y0.bandwidth() / 2).attr("dy", "0.35em").attr("text-anchor", "end").attr("class", "lbl").text((d) => (d.label.length > 16 ? d.label.slice(0, 15) + "…" : d.label)).append("title").text((d) => d.label);
  const bar = rows.selectAll("g.b").data((d) => d.series.map((s) => ({ ...s, row: d }))).join("g").attr("class", "b").attr("transform", (s) => `translate(0,${y1(s.k)})`);
  bar.append("rect").attr("x", m.l).attr("height", y1.bandwidth()).attr("rx", 4).attr("fill", (s) => s.color).attr("width", 0)
    .on("pointermove", (e, s) => A.tip.show(`${s.row.label} / ${s.k}: ${yen(s.v)}`, e)).on("pointerleave", A.tip.hide)
    .transition().delay((s, i) => i * 40).duration(800).ease(d3.easeCubicOut).attr("width", (s) => x(s.v) - m.l);
  bar.append("text").attr("x", (s) => x(s.v) + 6).attr("y", y1.bandwidth() / 2).attr("dy", "0.35em").style("font-size", "11px").style("fill", "var(--fg2)").attr("opacity", 0).text((s) => fmt(s.v)).transition().delay(600).duration(400).attr("opacity", 1);
});

/* Gantt of flights across the calendar */
Charts.gantt = (el, flights, o = {}) => mount(el, (el, W) => {
  if (!flights.length) return empty(el, "配信計画はまだありません");
  const rowH = 38, m = { t: 22, r: 16, b: 8, l: Math.min(230, W * 0.3) }, H = flights.length * rowH + m.t + m.b, lim = Math.max(10, Math.floor((m.l - 14) / 6.4));
  const data = flights.map((f) => ({ ...f, s: parseDay(f.start_date), e: d3.timeDay.offset(parseDay(f.end_date), 1) }));
  const today = parseDay(o.today || d3.timeFormat("%Y-%m-%d")(new Date()));
  const dom = [d3.min(data, (d) => d.s), d3.max(data, (d) => d.e)]; dom[0] = d3.min([dom[0], today]); dom[1] = d3.max([dom[1], today]);
  const x = d3.scaleTime().domain([d3.timeDay.offset(dom[0], -3), d3.timeDay.offset(dom[1], 3)]).range([m.l, W - m.r]);
  const svg = d3.select(el).append("svg").attr("width", W).attr("height", H);
  const defs = svg.append("defs"), gid = uid("gt"); const st = { done: ["#2dd4bf", "#0ea5a0"], live: ["#4da3ff", "#8b6cff"], planned: ["#94a3b8", "#64748b"] };
  Object.entries(st).forEach(([k, c]) => { const g = defs.append("linearGradient").attr("id", gid + k).attr("x1", 0).attr("x2", 1); g.append("stop").attr("offset", 0).attr("stop-color", c[0]); g.append("stop").attr("offset", 1).attr("stop-color", c[1]); });
  svg.append("g").attr("class", "axis grid-l").attr("transform", `translate(0,${m.t})`).call(d3.axisTop(x).ticks(Math.max(3, Math.floor(W / 100))).tickSize(-(H - m.t - m.b)).tickFormat(fmtMD));
  const rows = svg.selectAll("g.f").data(data).join("g").attr("class", (d) => (d.case_id ? "f ent" : "f")).attr("data-ent", (d) => (d.case_id ? "case:" + d.case_id : null)).attr("transform", (d, i) => `translate(0,${m.t + i * rowH})`);
  rows.append("text").attr("x", m.l - 10).attr("y", rowH / 2 - 2).attr("text-anchor", "end").attr("class", "lbl").text((d) => (d.channel.length > lim ? d.channel.slice(0, lim - 1) + "…" : d.channel)).append("title").text((d) => d.channel);
  rows.append("text").attr("x", m.l - 10).attr("y", rowH / 2 + 12).attr("text-anchor", "end").style("font-size", "10px").text((d) => (o.showCase ? d.case_name.slice(0, 16) : (d.kind === "broadcast" ? "放送" : "デジタル")));
  rows.append("rect").attr("x", (d) => x(d.s)).attr("y", 6).attr("height", rowH - 14).attr("rx", 8).attr("fill", (d) => `url(#${gid}${d.status})`).attr("opacity", (d) => (d.status === "planned" ? 0.55 : 0.95)).attr("stroke", (d) => (d.status === "planned" ? "#94a3b8" : "none")).attr("stroke-dasharray", "4 3")
    .attr("width", 0).on("pointermove", (e, d) => A.tip.show([Object.assign(document.createElement("b"), { textContent: d.channel }), document.createElement("br"), document.createTextNode(`${d.start_date} 〜 ${d.end_date}`), document.createElement("br"), document.createTextNode(`予算 ${yen(d.budget)} ・ ${STATUS[d.status]}`)], e)).on("pointerleave", A.tip.hide)
    .transition().delay((d, i) => i * 80).duration(800).ease(d3.easeCubicOut).attr("width", (d) => Math.max(6, x(d.e) - x(d.s)));
  rows.append("text").attr("x", (d) => x(d.s) + 10).attr("y", rowH / 2 + 1).attr("dy", "0.1em").style("fill", "#fff").style("font-size", "11px").style("font-weight", 600).style("pointer-events", "none").attr("opacity", 0)
    .text((d) => (x(d.e) - x(d.s) > 90 ? `${yenM(d.budget)} · ${STATUS[d.status]}` : "")).transition().delay(700).duration(400).attr("opacity", 1);
  if (today >= x.domain()[0] && today <= x.domain()[1]) {
    const tx = x(today);
    svg.append("line").attr("x1", tx).attr("x2", tx).attr("y1", m.t - 4).attr("y2", H - m.b).attr("stroke", "#f59e0b").attr("stroke-width", 1.5).attr("stroke-dasharray", "4 3");
    svg.append("text").attr("x", tx).attr("y", 10).attr("text-anchor", "middle").style("fill", "#f59e0b").style("font-weight", 700).text("今日");
  }
});

/* Force-directed map of how IDs link across systems (FR-INT-01). */
Charts.force = (el, graph, onNode) => mount(el, (el, W) => {
  const H = 440, color = { case: "#8b6cff", line: "#4da3ff", po: "#f59e0b", delivery: "#2dd4bf", acceptance: "#34d399", invoice: "#f472b6", asset: "#fb7185", change: "#c084fc", flight: "#60a5fa" };
  const names = { case: "案件", line: "契約明細", po: "発注", delivery: "納品", acceptance: "検収", invoice: "請求", asset: "広告作品", change: "変更", flight: "配信" };
  const nodes = graph.nodes.map((d) => ({ ...d })), links = graph.links.map((d) => ({ ...d }));
  const svg = d3.select(el).append("svg").attr("width", W).attr("height", H).style("cursor", "grab");
  const rad = (d) => ({ case: 22, line: 14, asset: 11, flight: 11, change: 10 }[d.type] || 8);
  const sim = d3.forceSimulation(nodes).force("link", d3.forceLink(links).id((d) => d.id)  .distance((l) => (l.a === "case" ? 150 : 64)).strength(0.9)).force("charge", d3.forceManyBody().strength(-380))
      .force("center", d3.forceCenter(W / 2, H / 2)).force("x", d3.forceX(W / 2).strength(0.02)).force("y", d3.forceY(H / 2).strength(0.04)).force("collide", d3.forceCollide((d) => rad(d) + 6));
  const root = svg.append("g");
  svg.call(d3.zoom().scaleExtent([0.5, 3]).on("zoom", (e) => root.attr("transform", e.transform)));
  const link = root.append("g").attr("stroke", "currentColor").attr("stroke-opacity", 0.22).selectAll("line").data(links).join("line").attr("stroke-width", 1.4);
  const node = root.append("g").selectAll("g").data(nodes).join("g").style("cursor", "pointer").attr("opacity", 0)
    .on("pointerenter", (e, d) => { A.tip.show([Object.assign(document.createElement("b"), { textContent: names[d.type] }), document.createElement("br"), document.createTextNode(d.label + (d.ref ? ` [${d.ref}]` : ""))], e); link.attr("stroke-opacity", (l) => (l.source === d || l.target === d ? 0.9 : 0.1)).attr("stroke", (l) => (l.source === d || l.target === d ? color[d.type] : "currentColor")); })
    .on("pointermove", A.tip.move).on("pointerleave", () => { A.tip.hide(); link.attr("stroke-opacity", 0.22).attr("stroke", "currentColor"); })
    .on("click", (e, d) => onNode && onNode(d))
    .call(d3.drag().on("start", (e, d) => { if (!e.active) sim.alphaTarget(0.3).restart(); d.fx = d.x; d.fy = d.y; }).on("drag", (e, d) => { d.fx = e.x; d.fy = e.y; }).on("end", (e, d) => { if (!e.active) sim.alphaTarget(0); d.fx = null; d.fy = null; }));
  node.append("circle").attr("r", 0).attr("fill", (d) => color[d.type]).attr("stroke", "#fff").attr("stroke-opacity", 0.7).attr("stroke-width", 2).transition().delay((d, i) => i * 14).duration(600).attr("r", rad);
  node.transition().delay((d, i) => i * 14).duration(500).attr("opacity", 1);
  node.filter((d) => d.type === "case" || d.type === "line").append("text").attr("dy", (d) => rad(d) + 13).attr("text-anchor", "middle").style("font-size", "11px").style("fill", "var(--fg)").style("pointer-events", "none").text((d) => (d.label.length > 14 ? d.label.slice(0, 13) + "…" : d.label));
  sim.on("tick", () => { link.attr("x1", (d) => d.source.x).attr("y1", (d) => d.source.y).attr("x2", (d) => d.target.x).attr("y2", (d) => d.target.y); node.attr("transform", (d) => `translate(${d.x},${d.y})`); });
  const lg = d3.select(el).append("div").attr("class", "legend"); Object.keys(color).filter((k) => nodes.some((n) => n.type === k)).forEach((k) => lg.append("span").html("").call((s) => { s.append("i").style("background", color[k]); s.append("span").text(names[k]); }));
  const obs = new MutationObserver(() => { if (!el.isConnected) { sim.stop(); obs.disconnect(); } }); obs.observe(document.body, { childList: true, subtree: true });
});

/* Semi-circle gauge */
Charts.gauge = (el, value, target, label) => mount(el, (el, W) => {
  const S = Math.min(W, 260), r = S / 2, svg = d3.select(el).append("svg").attr("width", S).attr("height", r + 34).style("margin", "0 auto").style("display", "block");
  const g = svg.append("g").attr("transform", `translate(${r},${r + 6})`), arc = d3.arc().innerRadius(r * 0.72).outerRadius(r - 2).cornerRadius(8).startAngle(-Math.PI / 2);
  const id = uid("ga"), lg = svg.append("defs").append("linearGradient").attr("id", id); lg.append("stop").attr("offset", 0).attr("stop-color", "#4da3ff"); lg.append("stop").attr("offset", 1).attr("stop-color", "#a06bff");
  g.append("path").attr("d", arc.endAngle(Math.PI / 2)()).attr("fill", "var(--stroke)");
  const k = target ? Math.min(1, value / target) : 0, fg = g.append("path").attr("fill", `url(#${id})`);
  const t = g.append("text").attr("text-anchor", "middle").attr("y", -6).style("font-size", "30px").style("font-weight", 700).style("fill", "var(--fg)").text(target ? "0%" : "—");
  g.append("text").attr("text-anchor", "middle").attr("y", 16).text(target ? `${num(value)} / ${num(target)}` : "目標未設定");
  fg.transition().duration(1200).ease(d3.easeCubicOut).attrTween("d", () => { const i = d3.interpolate(0, k * Math.PI); return (q) => arc.endAngle(-Math.PI / 2 + i(q))(); });
  if (target) t.transition().duration(1200).tween("t", function () { const i = d3.interpolate(0, value / target * 100); return (q) => { this.textContent = Math.round(i(q)) + "%"; }; });
  if (label) d3.select(el).append("div").style("text-align", "center").style("color", "var(--fg2)").style("font-size", "12px").text(label);
});

/* Progress bars. items: [{label, value, max, sub, tone}] */
Charts.hbars = (el, items) => {
  if (!items.length) return empty(el);
  const root = d3.select(el).style("display", "grid").style("gap", "12px");
  const row = root.selectAll("div.r").data(items).join("div").attr("class", "r");
  const top = row.append("div").style("display", "flex").style("justify-content", "space-between").style("gap", "10px").style("font-size", "12px").style("margin-bottom", "4px");
  top.append("span").text((d) => d.label); top.append("span").style("color", "var(--fg2)").text((d) => d.sub || "");
  const pb = row.append("div").attr("class", (d) => "pb" + (d.tone || (d.max && d.value > d.max ? "bad" : "") ? " " + (d.tone || "bad") : "")); const bar = pb.append("i").style("width", "0%");
  bar.transition().delay((d, i) => i * 60).duration(900).ease(d3.easeCubicOut).style("width", (d) => Math.min(100, d.max ? (d.value / d.max) * 100 : 0) + "%");
};

/* Rights expiry versus campaign end */
Charts.rights = (el, assets, caseEnd, today) => mount(el, (el, W) => {
  const list = assets.filter((a) => a.rights_expiry);
  if (!list.length) return empty(el, "権利期限が登録された作品はありません");
  const rowH = 34, m = { t: 22, r: 16, b: 6, l: Math.min(180, W * 0.36) }, H = list.length * rowH + m.t + m.b;
  const end = parseDay(caseEnd), t0 = parseDay(today), exp = list.map((a) => parseDay(a.rights_expiry));
  const x = d3.scaleTime().domain([d3.min([t0, ...exp, end]), d3.max([t0, ...exp, end])].map((d, i) => d3.timeDay.offset(d, i ? 14 : -7))).range([m.l, W - m.r]);
  const svg = d3.select(el).append("svg").attr("width", W).attr("height", H);
  svg.append("g").attr("class", "axis grid-l").attr("transform", `translate(0,${m.t})`).call(d3.axisTop(x).ticks(Math.max(3, Math.floor(W / 110))).tickSize(-(H - m.t - m.b)).tickFormat(fmtMD));
  svg.append("line").attr("x1", x(end)).attr("x2", x(end)).attr("y1", m.t).attr("y2", H - m.b).attr("stroke", "#8b6cff").attr("stroke-width", 2);
  svg.append("text").attr("x", x(end)).attr("y", 10).attr("text-anchor", "middle").style("fill", "#8b6cff").style("font-weight", 700).text("案件終了");
  const rows = svg.selectAll("g.rr").data(list).join("g").attr("class", "rr").attr("transform", (d, i) => `translate(0,${m.t + i * rowH + rowH / 2})`);
  rows.append("text").attr("x", m.l - 10).attr("dy", "0.35em").attr("text-anchor", "end").attr("class", "lbl").text((d) => (d.name.length > 14 ? d.name.slice(0, 13) + "…" : d.name));
  const bad = (d) => parseDay(d.rights_expiry) < end;
  rows.append("line").attr("x1", x(t0)).attr("x2", x(t0)).attr("y1", 0).attr("y2", 0).attr("stroke", (d) => (bad(d) ? "#ff7a82" : "#34d399")).attr("stroke-width", 6).attr("stroke-linecap", "round").transition().duration(900).attr("x2", (d) => x(parseDay(d.rights_expiry)));
  rows.append("circle").attr("cx", (d) => x(parseDay(d.rights_expiry))).attr("r", 0).attr("fill", (d) => (bad(d) ? "#ff7a82" : "#34d399")).attr("stroke", "#fff").attr("stroke-width", 2).transition().delay(800).duration(300).attr("r", 7);
  rows.append("title").text((d) => `${d.name}: 権利期限 ${d.rights_expiry}`);
});

/* Decorative animated hero wave (d3.timer) */
Charts.wave = (svgEl) => {
  const svg = d3.select(svgEl), W = 1200, H = 200; svg.attr("viewBox", `0 0 ${W} ${H}`).attr("preserveAspectRatio", "none");
  const layers = [0.9, 0.6, 0.35].map((o, i) => svg.append("path").attr("fill", "#fff").attr("fill-opacity", 0.1 + i * 0.04));
  const t = d3.timer((ms) => { if (!svgEl.isConnected) { if (ms > 2000) t.stop(); return; } layers.forEach((p, i) => { p.attr("d", d3.area().x((d) => d).y0(H).y1((d) => H * (0.45 + i * 0.12) + Math.sin(d / (110 + i * 40) + ms / (1400 - i * 260) + i) * (22 - i * 4) + Math.sin(d / 47 - ms / 900) * 5).curve(d3.curveBasis)(d3.range(0, W + 30, 30))); }); });
};
