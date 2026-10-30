"use strict";
/* Trading partners (customers), project management (EVM / risks / milestones / WBS) and resource detail. */
const CST = { active: ["取引中", "#34d399", "ok"], dormant: ["休眠", "#fbbf24", "warn"], prospect: ["新規見込み", "#a78bfa", "info"] };
const STAGE_C = { lead: "リード", proposal: "提案", negotiation: "商談", verbal: "内諾" };
const OUTC = { won: ["受注", "#34d399"], partial: ["一部受注", "#fbbf24"], lost: ["失注", "#ff7a82"] };

function gauge(el, v, size = 200) {
  const r = size / 2 - 14, svg = d3.select(el).append("svg").attr("width", size).attr("height", size / 2 + 22), g = svg.append("g").attr("transform", `translate(${size / 2},${size / 2 + 4})`);
  const arc = d3.arc().innerRadius(r - 16).outerRadius(r).cornerRadius(8).startAngle(-Math.PI / 2), col = v >= 70 ? "#34d399" : v >= 50 ? "#fbbf24" : "#ff7a82";
  g.append("path").attr("d", arc({ endAngle: Math.PI / 2 })).attr("fill", "currentColor").attr("opacity", 0.1);
  g.append("path").attr("fill", col).attr("d", arc({ endAngle: -Math.PI / 2 })).transition().duration(1400).ease(d3.easeElasticOut.amplitude(0.8).period(0.7)).attrTween("d", () => { const i = d3.interpolate(-Math.PI / 2, -Math.PI / 2 + Math.PI * v / 100); return (t) => arc({ endAngle: i(t) }); });
  const tx = g.append("text").attr("text-anchor", "middle").attr("y", -8).style("font-size", size / 4.2 + "px").style("font-weight", 800).style("fill", "currentColor").text(0);
  tx.transition().duration(1400).tween("t", function () { const i = d3.interpolateRound(0, v); return (t) => { this.textContent = i(t); }; });
}
function miniRadar(el, axes) {
  mount(el, (el, W) => {
    const S = Math.min(W, 300), R = S / 2 - 72, n = axes.length, svg = d3.select(el).append("svg").attr("width", W).attr("height", S), g = svg.append("g").attr("transform", `translate(${W / 2},${S / 2})`);
    const ang = (i) => (i / n) * Math.PI * 2 - Math.PI / 2, pt = (i, v) => [Math.cos(ang(i)) * R * v, Math.sin(ang(i)) * R * v];
    [0.5, 1].forEach((f) => g.append("polygon").attr("points", axes.map((a, i) => pt(i, f).join(",")).join(" ")).attr("fill", "none").attr("stroke", "currentColor").attr("opacity", 0.18));
    axes.forEach((a, i) => { const [lx, ly] = pt(i, 1.25); g.append("text").attr("x", lx).attr("y", ly).attr("text-anchor", Math.abs(lx) < 8 ? "middle" : lx > 0 ? "start" : "end").attr("dy", "0.35em").style("font-size", "11px").style("fill", "currentColor").text(tr(a.label) + " " + a.value); });
    const poly = (f) => axes.map((a, i) => pt(i, f * a.value / 100).join(",")).join(" ");
    g.append("polygon").attr("points", poly(0)).attr("fill", "rgba(139,108,255,.3)").attr("stroke", "#8b6cff").attr("stroke-width", 2.4).transition().duration(1100).ease(d3.easeBackOut).attr("points", poly(1));
  });
}
const finChart = (el, fin) => mount(el, (el, W) => {
  const Hh = 250, m = { t: 16, r: 46, b: 26, l: 52 }, x = d3.scaleBand().domain(fin.map((f) => f.fy)).range([m.l, W - m.r]).padding(0.3), y = d3.scaleLinear().domain([0, d3.max(fin, (f) => f.revenue) * 1.15]).range([Hh - m.b, m.t]);
  const y2 = d3.scaleLinear().domain([0, d3.max(fin, (f) => f.ad_spend) * 1.3]).range([Hh - m.b, m.t]), svg = d3.select(el).append("svg").attr("width", W).attr("height", Hh), id = uid("fb");
  const lg = svg.append("defs").append("linearGradient").attr("id", id).attr("x1", 0).attr("x2", 0).attr("y1", 0).attr("y2", 1); lg.append("stop").attr("offset", 0).attr("stop-color", "#58a8ff"); lg.append("stop").attr("offset", 1).attr("stop-color", "#8b6cff").attr("stop-opacity", 0.5);
  svg.append("g").attr("class", "axis grid-l").attr("transform", `translate(${m.l},0)`).call(d3.axisLeft(y).ticks(4).tickSize(-(W - m.l - m.r)).tickFormat(""));
  svg.append("g").attr("class", "axis").attr("transform", `translate(${m.l},0)`).call(d3.axisLeft(y).ticks(4).tickSize(0).tickPadding(6).tickFormat((v) => "¥" + d3.format(".2s")(v).replace("G", "B")));
  svg.append("g").attr("class", "axis").attr("transform", `translate(${W - m.r},0)`).call(d3.axisRight(y2).ticks(4).tickSize(0).tickPadding(6).tickFormat((v) => d3.format(".2s")(v).replace("G", "B")));
  svg.append("g").attr("class", "axis").attr("transform", `translate(0,${Hh - m.b})`).call(d3.axisBottom(x).tickSize(0).tickPadding(6));
  svg.selectAll("rect").data(fin).join("rect").attr("x", (f) => x(f.fy)).attr("width", x.bandwidth()).attr("rx", 6).attr("fill", `url(#${id})`).attr("y", y(0)).attr("height", 0).transition().delay((f, i) => i * 90).duration(900).ease(d3.easeBackOut).attr("y", (f) => y(f.revenue)).attr("height", (f) => y(0) - y(f.revenue));
  const line = (key, color, dash) => { const p = svg.append("path").datum(fin).attr("fill", "none").attr("stroke", color).attr("stroke-width", 2.6).attr("stroke-dasharray", dash).attr("d", d3.line().x((f) => x(f.fy) + x.bandwidth() / 2).y((f) => y2(f[key])).curve(d3.curveMonotoneX)); const L = p.node().getTotalLength(); p.attr("stroke-dasharray", `${L} ${L}`).attr("stroke-dashoffset", L).transition().delay(500).duration(1200).attr("stroke-dashoffset", 0); };
  line("ad_spend", "#f59e0b");
  svg.selectAll("circle").data(fin).join("circle").attr("cx", (f) => x(f.fy) + x.bandwidth() / 2).attr("cy", (f) => y2(f.ad_spend)).attr("r", 4).attr("fill", "#f59e0b");
  svg.selectAll("rect.hit").data(fin).join("rect").attr("class", "hit").attr("x", (f) => x(f.fy)).attr("y", m.t).attr("width", x.bandwidth()).attr("height", Hh - m.t - m.b).attr("fill", "transparent")
    .on("pointermove", (e, f) => A.tip.show([Object.assign(document.createElement("b"), { textContent: `FY${f.fy}` }), document.createElement("br"), document.createTextNode(`${tr("売上高")} ${yenM(f.revenue)}`), document.createElement("br"), document.createTextNode(`${tr("営業利益")} ${yenM(f.op_profit)}（${(f.op_profit / f.revenue * 100).toFixed(1)}%）`), document.createElement("br"), document.createTextNode(`${tr("広告費")} ${yenM(f.ad_spend)}`)], e)).on("pointerleave", A.tip.hide);
});
function dealTimeline(el, deals, cid) {
  mount(el, (el, W) => {
    const Hh = 170, years = [...new Set(deals.map((d) => d.year))], m = { l: 30, r: 30 }, x = d3.scalePoint().domain(d3.range(d3.min(years), d3.max(years) + 1)).range([m.l + 20, W - m.r - 20]), rr = d3.scaleSqrt().domain([0, d3.max(deals, (d) => d.amount) || 1]).range([7, 30]);
    const svg = d3.select(el).append("svg").attr("width", W).attr("height", Hh);
    svg.append("line").attr("x1", m.l).attr("x2", W - m.r).attr("y1", Hh - 34).attr("y2", Hh - 34).attr("stroke", "currentColor").attr("opacity", 0.2);
    x.domain().forEach((yy) => svg.append("text").attr("x", x(yy)).attr("y", Hh - 14).attr("text-anchor", "middle").style("font-size", "11px").style("fill", "currentColor").attr("opacity", 0.7).text(yy));
    const cnt = {}; deals.forEach((d) => { d._i = cnt[d.year] = (cnt[d.year] || 0) + 1; });
    svg.selectAll("circle").data(deals).join("circle").attr("class", "ent").attr("data-ent", (d) => "deal:" + d.id).attr("cx", (d) => x(d.year) + (d._i - 1) * 6 - 6).attr("cy", Hh - 40).attr("r", 0).attr("fill", (d) => OUTC[d.outcome][1]).attr("fill-opacity", 0.75).attr("stroke", "#fff").attr("stroke-width", 1.4)
      .transition().delay((d, i) => i * 90).duration(900).ease(d3.easeBounceOut).attr("cy", (d) => Hh - 40 - rr(d.amount) - (d._i - 1) * 18).attr("r", (d) => rr(d.amount));
  });
}
function bubbleMap(el, list) {
  mount(el, (el, W) => {
    const Hh = 360, m = { t: 20, r: 30, b: 40, l: 50 }, x = d3.scaleLog().domain([5e8, 2e10]).range([m.l, W - m.r]), y = d3.scaleLinear().domain([0, 100]).range([Hh - m.b, m.t]), rr = d3.scaleSqrt().domain([0, d3.max(list, (c) => c.weighted_pipeline) || 1]).range([9, 38]);
    const svg = d3.select(el).append("svg").attr("width", W).attr("height", Hh);
    svg.append("rect").attr("x", x(3e9)).attr("y", y(100)).attr("width", W - m.r - x(3e9)).attr("height", y(55) - y(100)).attr("fill", "#34d399").attr("opacity", 0.08).attr("rx", 10);
    svg.append("text").attr("x", W - m.r - 8).attr("y", y(100) + 16).attr("text-anchor", "end").style("font-size", "11px").style("fill", "#34d399").text(tr("狙い目（広告予算が大きく、見込みが高い）"));
    svg.append("g").attr("class", "axis grid-l").attr("transform", `translate(${m.l},0)`).call(d3.axisLeft(y).ticks(5).tickSize(-(W - m.l - m.r)).tickFormat(""));
    svg.append("g").attr("class", "axis").attr("transform", `translate(${m.l},0)`).call(d3.axisLeft(y).ticks(5).tickSize(0).tickPadding(6));
    svg.append("g").attr("class", "axis").attr("transform", `translate(0,${Hh - m.b})`).call(d3.axisBottom(x).tickValues([1e9, 2e9, 5e9, 1e10]).tickFormat((v) => yenM(v)));
    svg.append("text").attr("x", W - m.r).attr("y", Hh - 6).attr("text-anchor", "end").style("font-size", "10px").style("fill", "currentColor").attr("opacity", 0.7).text(tr("顧客の年間広告費 →"));
    svg.append("text").attr("x", m.l + 4).attr("y", 12).style("font-size", "10px").style("fill", "currentColor").attr("opacity", 0.7).text(tr("↑ 営業ポテンシャル"));
    const g = svg.selectAll("g.b").data(list).join("g").attr("class", "b ent").attr("data-ent", (c) => "customer:" + c.id).attr("transform", (c) => `translate(${x(c.ad_spend)},${y(0)})`).style("cursor", "pointer");
    g.append("circle").attr("r", (c) => rr(c.weighted_pipeline)).attr("fill", (c) => CST[c.status][1]).attr("fill-opacity", 0.5).attr("stroke", (c) => CST[c.status][1]).attr("stroke-width", 2.4);
    g.append("text").attr("text-anchor", "middle").attr("dy", "0.35em").style("font-size", "11px").style("font-weight", 700).style("fill", "#fff").style("pointer-events", "none").text((c) => c.name.replace(/株式会社|ホールディングス/g, "").slice(0, 7));
    g.transition().delay((c, i) => i * 100).duration(1200).ease(d3.easeElasticOut.amplitude(1).period(0.6)).attr("transform", (c) => `translate(${x(c.ad_spend)},${y(c.score)})`);
  });
}
A.v.customers = async () => {
  const d = await api("/api/biz/customers"); A.crumbs("取引先");
  const st = (A.state.cu = A.state.cu || { f: "all" }), box = h("div"), seg = h("div", { class: "seg" });
  const draw = () => {
    const list = d.customers.filter((c) => st.f === "all" || c.status === st.f);
    const bub = h("div", { class: "chart" });
    const rows_ = list.slice().sort((a, b) => (b.score ?? -1) - (a.score ?? -1)).map((c, i) => rv(A.ent(h("div", { class: "ct-row" },
      h("div", { class: "who" }, h("span", { class: "av" }, custArt(c.id, 46)), h("div", {}, h("b", {}, c.name), h("div", { class: "mut" }, `${c.industry} · ${c.employees.toLocaleString(locale())}${tr("名")}`))),
      h("div", {}, h("span", { class: "chip " + CST[c.status][2] }, CST[c.status][0]), h("div", { class: "mut" }, c.since ? `${tr("取引開始")} ${c.since}` : tr("取引なし"))),
      c.restricted ? h("div", { class: "mut sp3" }, "財務情報の閲覧権限がありません") : [h("div", {}, h("b", {}, yenM(c.revenue)), h("div", { class: "mut" }, `${tr("広告費")} ${yenM(c.ad_spend)}`)),
        h("div", {}, h("div", { class: "ub" }, h("i", { style: `width:${Math.min(100, c.our_share * 3)}%;background:#58a8ff` })), h("span", { class: "mut" }, `${tr("当社シェア")} ${c.our_share}%`), h("span", { class: "chip", style: "margin-left:6px" }, `${tr("与信")} ${c.credit_grade}`)),
        h("div", {}, h("div", { class: "ub" }, h("i", { style: `width:${c.score}%;background:${c.score >= 70 ? "#34d399" : c.score >= 50 ? "#fbbf24" : "#ff7a82"}` })), h("b", {}, `${c.score}`), h("span", { class: "mut" }, ` ${tr(c.band)}`)),
        h("div", {}, h("b", {}, yenM(c.weighted_pipeline)), h("div", { class: "mut" }, `${tr("獲得可能額（推定）")} ${yenM(c.potential)}`))]), "customer", c.id), Math.min(i, 10)));
    box.replaceChildren(d.restricted ? h("div", { class: "note info" }, "あなたの役割では、取引先の財務・与信・商談の詳細は閲覧できません。") : h("section", { class: "card" }, h("h3", {}, "営業ポテンシャル・マップ", h("small", {}, "横=顧客の年間広告費 / 縦=営業ポテンシャル / 円の大きさ=加重パイプライン")), bub),
      h("section", { class: "card ctab", style: "margin-top:16px" }, rows_.length ? rows_ : h("p", { class: "empty" }, "該当する取引先がありません")));
    if (!d.restricted) bubbleMap(bub, list.map((c) => ({ ...c, ad_spend: c.ad_spend || 1e9 })));
    [...seg.children].forEach((b) => b.classList.toggle("on", b.dataset.k === st.f));
  };
  [["all", "すべて"], ["active", "取引中"], ["dormant", "休眠"], ["prospect", "新規見込み"]].forEach(([k, t]) => seg.append(h("button", { "data-k": k, onclick: () => { st.f = k; draw(); } }, t)));
  A.mount(h("div", {}, h("div", { class: "row", style: "margin-bottom:14px" }, h("h1", { style: "font-size:26px;margin:0" }, "取引先"), h("span", { class: "sp" }), seg), box)); draw();
};
A.v.customer = async (id) => {
  const c = await api("/api/biz/customer/" + id); A.crumbs(h("a", { href: "#/customers" }, "取引先"), c.name);
  const stc = CST[c.status];
  const hero = rv(h("section", { class: "chero", style: "--c1:#1d4ed8;--c2:#7c3aed" }, h("div", { class: "cmas big" }, custArt(c.id, 120)),
    h("div", { class: "row" }, h("span", { class: "chip" }, stc[0]), h("span", { class: "chip" }, c.industry), h("span", { class: "chip" }, c.hq)), h("h1", { style: "margin-top:10px" }, c.name), h("div", { class: "meta" }, h("span", {}, c.note), h("span", {}, `${c.employees.toLocaleString(locale())}${tr("名")}`), h("span", {}, c.since ? `${tr("取引開始")} ${c.since}` : tr("新規見込み"))),
    h("div", { class: "row", style: "margin-top:14px" }, h("button", { class: "btn", onclick: () => { A.state.relFocus = `customer:${c.id}`; location.hash = "#/relations"; } }, ic("flow", 14), "ビジネス関連図で見る"))));
  if (c.restricted) { A.mount(h("div", {}, hero, h("div", { class: "note info", style: "margin-top:16px" }, "あなたの役割では、財務・与信・商談の詳細は閲覧できません。"), contactsCard(c), casesCard(c))); return; }
  const sc = c.score, gg = h("div", { class: "gaugew" }), rd = h("div", { class: "chart" }), fin = h("div", { class: "chart" }), dn = h("div", { class: "chart" }), dt = h("div", { class: "chart" });
  const recs = c.recommendations.map((r, i) => rv(h("div", { class: "rec" }, h("span", { class: "n" }, i + 1), h("div", {}, h("b", {}, r.title), h("div", { class: "mut" }, r.why))), i + 2));
  const cr = c.credit, gradeC = { A: "#34d399", B: "#fbbf24", C: "#ff7a82" }[cr.grade];
  const opps = c.opportunities.map((o) => A.ent(h("div", { class: "opp" }, h("div", { class: "row" }, h("b", { class: "sp" }, o.title), h("span", { class: "chip" }, STAGE_C[o.stage])), h("div", { class: "ub" }, h("i", { style: `width:${o.probability}%;background:linear-gradient(90deg,#22d3ee,#8b6cff)` })),
    h("div", { class: "row mut" }, h("span", {}, `${tr("金額")} ${yenM(o.amount)}`), h("span", {}, `${tr("確度")} ${o.probability}%`), h("span", {}, `${tr("加重")} ${yenM(o.weighted)}`), h("span", {}, `${tr("受注見込")} ${o.close_in}${tr("日後")}`))), "opportunity", o.id));
  A.mount(h("div", {}, hero,
    h("div", { class: "grid g3", style: "margin-top:16px" },
      rv(h("section", { class: "card" }, h("h3", {}, "営業ポテンシャル", h("small", {}, "財務・広告意欲・関係・商談・与信から算出")), h("div", { class: "row", style: "justify-content:center" }, gg), h("div", { class: "row", style: "justify-content:center" }, h("span", { class: "chip " + (sc.total >= 70 ? "ok" : sc.total >= 50 ? "warn" : "bad") }, `${tr("可能性")} ${tr(sc.band)}`), h("span", { class: "chip" }, `${tr("獲得可能額（推定）")} ${yenM(sc.potential)}`))), 1),
      rv(h("section", { class: "card" }, h("h3", {}, "スコアの内訳"), rd), 2),
      rv(h("section", { class: "card" }, h("h3", {}, "与信・回収"), h("div", { class: "grade", style: `--g:${gradeC}` }, h("b", {}, cr.grade), h("span", {}, `${tr("信用スコア")} ${cr.score}`)),
        h("dl", { class: "ec-f" }, h("dt", {}, "支払条件"), h("dd", {}, `${cr.terms}${tr("日")}`), h("dt", {}, "平均入金遅延"), h("dd", { class: cr.delay > 10 ? "bad" : "" }, `${cr.delay}${tr("日")}`), h("dt", {}, "累計の取引額"), h("dd", {}, yenM(c.lifetime_revenue)), h("dt", {}, "当社シェア"), h("dd", {}, `${c.our_share}%`))), 3)),
    h("div", { class: "sec" }, h("h2", {}, "次の一手（AIによる提案）"), h("span", { class: "mut" }, "財務状態・過去の取引・商談から導いた優先アクション")), h("div", { class: "grid g3" }, recs),
    h("div", { class: "grid g2", style: "margin-top:16px" }, h("section", { class: "card" }, h("h3", {}, "財務の推移", h("small", {}, "青の棒=売上高 / 橙の線=広告費")), fin),
      h("section", { class: "card" }, h("h3", {}, "広告予算のシェア", h("small", {}, `今年の広告費 ${yenM(c.wallet.ad_spend)} のうち当社の割合`)), dn)),
    h("div", { class: "grid g2", style: "margin-top:16px" }, h("section", { class: "card" }, h("h3", {}, "過去の取引", h("small", {}, "円の大きさ=金額 / 緑=受注 黄=一部 赤=失注")), dt, h("div", { class: "legend" }, Object.values(OUTC).map(([t, col]) => h("span", {}, h("i", { style: `background:${col}` }), t)))),
      h("section", { class: "card" }, h("h3", {}, "進行中の商談", h("small", {}, `加重パイプライン ${yenM(sc.weighted_pipeline)}`)), h("div", { class: "stack" }, opps.length ? opps : h("p", { class: "empty" }, "進行中の商談はありません")))),
    h("div", { class: "grid g2", style: "margin-top:16px" }, contactsCard(c), casesCard(c))));
  gauge(gg, sc.total, 220);
  miniRadar(rd, [{ label: "財務", value: sc.fin }, { label: "広告意欲", value: sc.appetite }, { label: "関係", value: sc.relation }, { label: "商談", value: sc.pipeline }, { label: "与信の安全度", value: Math.max(0, 100 - sc.risk * 2) }]);
  finChart(fin, c.financials);
  Charts.donut(dn, [{ label: "当社", value: c.wallet.ours, color: "#58a8ff" }, { label: "他社", value: Math.max(1, c.wallet.ad_spend - c.wallet.ours), color: "#5b6b8a" }], "");
  dealTimeline(dt, c.deals, c.id);
};
const contactsCard = (c) => h("section", { class: "card" }, h("h3", {}, "担当者", h("small", {}, "最終接点と関係の温度")), h("div", { class: "stack" }, c.contacts.map((p) => A.ent(h("div", { class: "bench" }, h("span", { class: "av" }, Art.person({ seed: 900 + p.id, g: p.gender, age: p.age, size: 40 })),
  h("div", { class: "sp" }, h("b", {}, p.name), h("div", { class: "mut" }, `${p.role} · ${p.decision_role}`)), h("div", { class: "heart", title: tr("関係の温度") }, [1, 2, 3, 4, 5].map((i) => h("i", { class: i <= p.sentiment ? "on" : "" }))), h("span", { class: "mut" }, `${p.last_days}${tr("日前")}`)), "contact", p.id))));
const casesCard = (c) => h("section", { class: "card" }, h("h3", {}, "この取引先の案件"), h("div", { class: "stack" }, c.cases.length ? c.cases.map((k) => A.ent(h("div", { class: "opp" }, h("div", { class: "row" }, h("b", { class: "sp" }, k.name), h("span", { class: "chip info" }, k.stage_label), k.open_exceptions ? h("span", { class: "chip high" }, `${tr("例外")} ${k.open_exceptions}`) : null),
  h("div", { class: "row mut" }, h("span", {}, `${tr("契約額")} ${yenM(k.contract)}`), h("span", {}, `${tr("請求額")} ${yenM(k.invoiced)}`), h("span", {}, `${tr("見込採算")} ${yenM(k.margin)}`))), "case", k.id)) : [h("p", { class: "empty" }, "案件はまだありません（見込み段階）")]));

/* ------------------------------------------------ projects */
const hdot = (hl) => h("span", { class: "hdot", style: `--c:${HEALTH[hl][1]}`, title: tr(HEALTH[hl][0]) });
A.v.projects = async () => {
  const d = await api("/api/biz/projects"); A.crumbs("プロジェクト");
  const bub = h("div", { class: "chart" });
  const cards = d.projects.map((p, i) => rv(A.ent(h("article", { class: "card lift pj", "data-tilt": "" },
    h("div", { class: "row" }, hdot(p.health), h("b", { class: "sp" }, p.name), h("span", { class: "chip info" }, p.stage_label)),
    h("div", { class: "mut" }, `${p.customer_name} · ${p.start} 〜 ${p.end}`),
    h("div", { class: "pj-k" }, [["SPI", p.spi, p.spi < 0.9], ["CPI", p.cpi, p.cpi < 0.9], ["リスク", p.risk_max, p.risk_max >= 15], ["例外", p.open_exceptions, p.open_exceptions >= 3]].map(([k, v, bad]) => h("div", {}, h("b", { class: bad ? "bad" : "ok" }, v), h("span", {}, k)))),
    h("div", { class: "ub" }, h("i", { style: `width:${p.progress * 100}%;background:linear-gradient(90deg,#22d3ee,#8b6cff)` })),     h("div", { class: "row mut" }, h("span", {}, `${tr("進捗")} ${Math.round(p.progress * 100)}%`), h("span", { class: "sp" }), h("span", {}, p.next_milestone ? `${tr("次")}: ${p.next_milestone.name}（${p.next_milestone.in}${tr("日後")}）` : ""))), "project", p.id), i + 1));
  A.mount(h("div", {}, h("h1", { style: "font-size:26px;margin:0 0 14px" }, "プロジェクト管理"), h("section", { class: "card" }, h("h3", {}, "ポートフォリオ・マップ", h("small", {}, "横=進捗指数(SPI) / 縦=コスト指数(CPI) / 円の大きさ=予算 / 右上ほど良好")), bub), h("div", { class: "sec" }, h("h2", {}, "プロジェクト一覧")), h("div", { class: "grid g2" }, cards)));
  mount(bub, (el, W) => {
    const Hh = 340, m = { t: 14, r: 20, b: 34, l: 44 }, x = d3.scaleLinear().domain([0.4, 1.4]).range([m.l, W - m.r]), y = d3.scaleLinear().domain([0.2, 1.6]).range([Hh - m.b, m.t]), rr = d3.scaleSqrt().domain([0, d3.max(d.projects, (p) => p.bac)]).range([12, 40]);
    const svg = d3.select(el).append("svg").attr("width", W).attr("height", Hh);
    svg.append("rect").attr("x", x(0.4)).attr("y", y(0.9)).attr("width", x(0.9) - x(0.4)).attr("height", y(0.2) - y(0.9)).attr("fill", "#ff5a63").attr("opacity", 0.1);
    svg.append("rect").attr("x", x(0.95)).attr("y", y(1.6)).attr("width", x(1.4) - x(0.95)).attr("height", y(0.95) - y(1.6)).attr("fill", "#34d399").attr("opacity", 0.1);
    svg.append("line").attr("x1", x(1)).attr("x2", x(1)).attr("y1", m.t).attr("y2", Hh - m.b).attr("stroke", "currentColor").attr("opacity", 0.3).attr("stroke-dasharray", "4 3"); svg.append("line").attr("x1", m.l).attr("x2", W - m.r).attr("y1", y(1)).attr("y2", y(1)).attr("stroke", "currentColor").attr("opacity", 0.3).attr("stroke-dasharray", "4 3");
    svg.append("g").attr("class", "axis").attr("transform", `translate(0,${Hh - m.b})`).call(d3.axisBottom(x).ticks(6).tickSize(0).tickPadding(6)); svg.append("g").attr("class", "axis").attr("transform", `translate(${m.l},0)`).call(d3.axisLeft(y).ticks(6).tickSize(0).tickPadding(6));
    svg.append("text").attr("x", W - m.r).attr("y", Hh - 4).attr("text-anchor", "end").style("font-size", "10px").style("fill", "currentColor").attr("opacity", 0.7).text("SPI →"); svg.append("text").attr("x", m.l + 6).attr("y", 12).style("font-size", "10px").style("fill", "currentColor").attr("opacity", 0.7).text("↑ CPI");
    const g = svg.selectAll("g.p").data(d.projects).join("g").attr("class", "p ent").attr("data-ent", (p) => "project:" + p.id).attr("transform", (p) => `translate(${x(Math.min(1.38, Math.max(0.42, p.spi)))},${y(0.2)})`).style("cursor", "pointer");
    g.append("circle").attr("r", (p) => rr(p.bac)).attr("fill", (p) => HEALTH[p.health][1]).attr("fill-opacity", 0.45).attr("stroke", (p) => HEALTH[p.health][1]).attr("stroke-width", 2.5);
    g.append("text").attr("text-anchor", "middle").attr("dy", "0.35em").style("font-size", "12px").style("font-weight", 700).style("fill", "#fff").style("pointer-events", "none").text((p) => "#" + p.id);
    g.transition().delay((p, i) => i * 120).duration(1200).ease(d3.easeElasticOut.amplitude(1).period(0.65)).attr("transform", (p) => `translate(${x(Math.min(1.38, Math.max(0.42, p.spi)))},${y(Math.min(1.58, Math.max(0.22, p.cpi)))})`);
  });
};
function evmChart(el, series, evm) {
  mount(el, (el, W) => {
    const Hh = 300, m = { t: 14, r: 14, b: 26, l: 62 }, x = d3.scaleLinear().domain(d3.extent(series, (r) => r.d)).range([m.l, W - m.r]), mx = Math.max(evm.bac, d3.max(series, (r) => Math.max(r.pv || 0, r.acf || 0, r.evf || 0))) * 1.1, y = d3.scaleLinear().domain([0, mx]).nice().range([Hh - m.b, m.t]);
    const svg = d3.select(el).append("svg").attr("width", W).attr("height", Hh);
    svg.append("g").attr("class", "axis grid-l").attr("transform", `translate(${m.l},0)`).call(d3.axisLeft(y).ticks(5).tickSize(-(W - m.l - m.r)).tickFormat(""));
    svg.append("g").attr("class", "axis").attr("transform", `translate(${m.l},0)`).call(d3.axisLeft(y).ticks(5).tickSize(0).tickPadding(6).tickFormat((v) => yenM(v)));
    svg.append("g").attr("class", "axis").attr("transform", `translate(0,${Hh - m.b})`).call(d3.axisBottom(x).ticks(7).tickFormat((d) => (d === 0 ? tr("今日") : (d > 0 ? "+" : "") + d)));
    const line = (key, color, w, dash, filt) => { const data = series.filter((r) => r[key] != null); if (!data.length) return; const p = svg.append("path").datum(data).attr("fill", "none").attr("stroke", color).attr("stroke-width", w).attr("d", d3.line().x((r) => x(r.d)).y((r) => y(r[key])).curve(d3.curveMonotoneX)); const L = p.node().getTotalLength(); p.attr("stroke-dasharray", dash ? dash : `${L} ${L}`).attr("stroke-dashoffset", dash ? 0 : L).attr("opacity", dash ? 0 : 1); p.transition().delay(dash ? 900 : 0).duration(1200).ease(d3.easeCubicOut).attr("stroke-dashoffset", 0).attr("opacity", 1); };
    svg.append("line").attr("x1", m.l).attr("x2", W - m.r).attr("y1", y(evm.bac)).attr("y2", y(evm.bac)).attr("stroke", "#a78bfa").attr("stroke-dasharray", "2 4").attr("opacity", 0.8); svg.append("text").attr("x", m.l + 4).attr("y", y(evm.bac) - 5).style("font-size", "10px").style("fill", "#a78bfa").text("BAC " + yenM(evm.bac));
    line("pv", "#9fb0c8", 2.4); line("ev", "#58a8ff", 3.2); line("ac", "#f59e0b", 3.2); line("evf", "#58a8ff", 2.4, "6 4"); line("acf", "#f59e0b", 2.4, "6 4");
    svg.append("line").attr("x1", x(0)).attr("x2", x(0)).attr("y1", m.t).attr("y2", Hh - m.b).attr("stroke", "#ff7a82").attr("stroke-width", 1.8);
    svg.append("rect").attr("x", m.l).attr("y", m.t).attr("width", W - m.l - m.r).attr("height", Hh - m.t - m.b).attr("fill", "transparent").on("pointermove", (e) => { const d0 = x.invert(d3.pointer(e)[0]), r = series.reduce((a, b) => (Math.abs(b.d - d0) < Math.abs(a.d - d0) ? b : a)); const f = (v) => (v == null ? "—" : yenM(v));
      A.tip.show([Object.assign(document.createElement("b"), { textContent: `${r.d >= 0 ? "+" : ""}${r.d}${tr("日")}` }), document.createElement("br"), document.createTextNode(`PV ${f(r.pv)}`), document.createElement("br"), document.createTextNode(`EV ${f(r.ev ?? r.evf)}`), document.createElement("br"), document.createTextNode(`AC ${f(r.ac ?? r.acf)}`)], e); }).on("pointerleave", A.tip.hide);
  });
}
function riskMatrix(el, risks) {
  mount(el, (el, W) => {
    const S = Math.min(W, 380), cell = (S - 50) / 5, svg = d3.select(el).append("svg").attr("width", W).attr("height", S), g = svg.append("g").attr("transform", "translate(40,6)");
    for (let p = 1; p <= 5; p++) for (let i = 1; i <= 5; i++) g.append("rect").attr("x", (i - 1) * cell).attr("y", (5 - p) * cell).attr("width", cell - 2).attr("height", cell - 2).attr("rx", 6).attr("fill", p * i >= 20 ? "#ff5a63" : p * i >= 12 ? "#f59e0b" : p * i >= 6 ? "#facc15" : "#34d399").attr("opacity", 0.22);
    d3.range(1, 6).forEach((i) => { g.append("text").attr("x", (i - 1) * cell + cell / 2).attr("y", S - 14).attr("text-anchor", "middle").style("font-size", "10px").style("fill", "currentColor").text(i); g.append("text").attr("x", -10).attr("y", (5 - i) * cell + cell / 2 + 4).attr("text-anchor", "end").style("font-size", "10px").style("fill", "currentColor").text(i); });
    svg.append("text").attr("x", 40 + (S - 50) / 2).attr("y", S - 2).attr("text-anchor", "middle").style("font-size", "10px").style("fill", "currentColor").attr("opacity", 0.7).text(tr("影響 →")); svg.append("text").attr("x", 10).attr("y", 14).style("font-size", "10px").style("fill", "currentColor").attr("opacity", 0.7).text("↑" + tr("確率"));
    const slot = {}; risks.forEach((r) => { const k = r.probability + "," + r.impact; r._s = slot[k] = (slot[k] || 0) + 1; });
    g.selectAll("circle").data(risks.filter((r) => r.status !== "closed")).join("circle").attr("class", "ent").attr("data-ent", (r) => "risk:" + r.id).attr("cx", (r) => (r.impact - 1) * cell + cell / 2 + (r._s - 1) * 12 - 6).attr("cy", -20).attr("r", 0).attr("fill", (r) => (r.score >= 20 ? "#ff5a63" : r.score >= 12 ? "#f59e0b" : "#34d399")).attr("stroke", "#fff").attr("stroke-width", 2)
      .transition().delay((r, i) => i * 120).duration(900).ease(d3.easeBounceOut).attr("cy", (r) => (5 - r.probability) * cell + cell / 2).attr("r", 12);
  });
}
A.v.project = async (id) => {
  const p = await api("/api/biz/project/" + id); A.crumbs(h("a", { href: "#/projects" }, "プロジェクト"), p.case.name);
  const e = p.evm, hl = p.health, evmBox = h("div", { class: "chart" }), rm = h("div", { class: "chart" }), wb = h("div", { class: "chart" });
  const teams = [...new Set(p.wbs.map((w) => w.team))].map((k) => ({ key: k, label: teamLabel(k) }));
  const work = p.wbs.map((w) => ({ ...w, case_id: p.case.id, case_name: p.case.name, end_eff: new Date(new Date(w.end).getTime() + w.late * 864e5).toISOString().slice(0, 10) }));
  const tile = (k, v, s, bad) => h("div", { class: "card kpi" }, h("div", { class: "k" }, k), h("div", { class: "v " + (bad ? "bad" : "") }, v), h("div", { class: "s" }, s));
  const ms = p.milestones.map((m) => A.ent(h("div", { class: "ms " + m.status }, h("i", {}), h("div", {}, h("b", {}, m.name), h("div", { class: "mut" }, `${m.day} · ${m.in >= 0 ? m.in + tr("日後") : -m.in + tr("日前")}`))), "milestone", m.id));
  const risks = p.risks.map((r) => A.ent(h("div", { class: "rk" }, h("span", { class: "rs", style: `--c:${r.score >= 20 ? "#ff5a63" : r.score >= 12 ? "#f59e0b" : "#34d399"}` }, r.score), h("div", { class: "sp" }, h("b", {}, r.title), h("div", { class: "mut" }, `${teamLabel(r.team)} · ${r.mitigation}`)), h("span", { class: "chip" }, tr({ open: "未対応", mitigating: "対策中", closed: "解消" }[r.status]))), "risk", r.id));
  const decs = p.decisions.map((d) => A.ent(h("div", { class: "rk" }, h("span", { class: "hdot", style: `--c:${d.severity === "red" ? "#ff5a63" : "#fbbf24"}` }), h("b", { class: "sp" }, d.title), h("span", { class: "chip" }, d.status === "open" ? tr("未決") : tr("決定済み"))), "decision", d.id));
  const tl = p.team_load.map((t) => h("div", { class: "skr" }, h("span", { class: "lb" }, teamLabel(t.team)), h("div", { class: "ub" }, h("i", { style: `width:${Math.min(100, t.person_days * 2.2)}%;background:hsl(${TEAM_HUE[t.team] || 210},70%,56%)` })), h("b", {}, `${t.person_days}${tr("人日")}`)));
  const people = [...new Map(p.resources.map((r) => [r.resource_id, r])).values()].map((r) => A.ent(h("span", { class: "face", title: r.name }, resAvatar({ id: r.resource_id, kind: r.kind, gender: r.gender, age: r.age, name: r.name }, 34)), "resource", r.resource_id));
  A.mount(h("div", {},
    rv(h("section", { class: "chero", style: `--c1:${HEALTH[hl][1]}55;--c2:#4338ca` }, h("div", { class: "row" }, h("span", { class: "chip" }, `${tr("健全性")}: ${tr(HEALTH[hl][0])}`), h("span", { class: "chip" }, p.stage_label), A.ent(h("span", { class: "chip" }, p.case.customer_name), "customer", p.case.customer_id), h("span", { class: "sp" }), h("a", { class: "btn", href: `#/case/${p.case.id}` }, "案件ワークフローを開く", ic("arrow", 14))),
      h("h1", { style: "margin-top:10px" }, p.case.name), h("div", { class: "meta" }, h("span", {}, `${p.case.start_date} 〜 ${p.case.end_date}`), h("span", {}, p.case.objective || "")),
      h("div", { class: "stats" }, [["予算（BAC）", yenM(e.bac)], ["進捗", Math.round(e.progress * 100) + "%"], ["未対応の例外", p.open_exceptions], ["契約額", yenM(p.summary.contract_amount)]].map(([k, v]) => h("div", {}, h("b", {}, v), h("span", {}, k))))), 0),
    h("div", { class: "kpis flat", style: "margin-top:16px" }, tile("SPI（進捗指数）", e.spi, "EV ÷ PV（1.0=計画どおり）", e.spi < 0.9), tile("CPI（コスト指数）", e.cpi, "EV ÷ AC（1.0=予算どおり）", e.cpi < 0.9), tile("完成時総コスト（EAC）", yenM(e.eac), `差異 ${yenM(e.vac)}`, e.vac < 0), tile("実コスト（AC）", yenM(e.ac), `EV ${yenM(e.ev)} / PV ${yenM(e.pv)}`)),
    h("div", { class: "split", style: "margin-top:16px" }, h("section", { class: "card" }, h("h3", {}, "アーンドバリュー（EVM）", h("small", {}, "計画(PV)・出来高(EV)・実コスト(AC)と完成予測")), h("div", { class: "legend" }, [["PV 計画", "#9fb0c8"], ["EV 出来高", "#58a8ff"], ["AC 実コスト", "#f59e0b"]].map(([t, c]) => h("span", {}, h("i", { style: `background:${c}` }), t))), evmBox),
      h("section", { class: "card" }, h("h3", {}, "マイルストーン"), h("div", { class: "mslist" }, ms))),
    h("section", { class: "card", style: "margin-top:16px" }, h("h3", {}, "WBS・チーム別スケジュール", h("small", {}, "チームが連携して進める作業。点線=依存、斜線=遅延見込み")), wb),
    h("div", { class: "grid g2", style: "margin-top:16px" }, h("section", { class: "card" }, h("h3", {}, "リスクマトリクス", h("small", {}, "確率 × 影響")), rm), h("section", { class: "card" }, h("h3", {}, "リスク・課題・判断（RAID）"), h("div", { class: "stack" }, risks, decs, p.changes.length ? p.changes.map((c) => h("div", { class: "rk" }, h("span", { class: "chip" }, tr("変更")), h("b", { class: "sp" }, c.description), h("span", { class: "chip" }, tr(STATUS[c.status] || c.status)))) : null))),
    h("div", { class: "grid g2", style: "margin-top:16px" }, h("section", { class: "card" }, h("h3", {}, "資源計画（チーム別の稼働量）"), h("div", { class: "skills-l" }, tl)), h("section", { class: "card" }, h("h3", {}, "アサインされているリソース"), h("div", { class: "faces big" }, people)))));
  evmChart(evmBox, p.series, e); riskMatrix(rm, p.risks); teamGantt(wb, work, teams, 28, null);
};

/* ------------------------------------------------ resource detail */
A.v.resource = async (id) => {
  const r = await api("/api/biz/resource/" + id); A.crumbs(h("a", { href: "#/resources" }, "リソース管理"), r.name);
  const ch = h("div", { class: "chart" }), u0 = r.util[7];
  const al = r.allocations.map((a) => A.ent(h("div", { class: "rk" }, h("div", { class: "sp" }, h("b", {}, a.work), h("div", { class: "mut" }, `${a.case_name} · ${fmtMD(parseDay(a.start))} → ${fmtMD(parseDay(a.end))}`)), h("span", { class: "chip" }, `${tr("負荷")} ${Math.round(a.load * 100)}%`)), a.case_id ? "case" : "resource", a.case_id || r.id));
  A.mount(h("div", {}, rv(h("section", { class: "chero", style: "--c1:#0f766e;--c2:#4338ca" }, h("div", { class: "cmas big" }, resAvatar({ id: r.id, kind: r.kind, gender: r.gender, age: r.age, name: r.name }, 120)),
    h("div", { class: "row" }, h("span", { class: "chip" }, RKIND[r.kind]), A.ent(h("span", { class: "chip" }, teamLabel(r.team)), "team", r.team)), h("h1", { style: "margin-top:10px" }, r.name), h("div", { class: "meta" }, h("span", {}, r.title), h("span", {}, r.skills), h("span", {}, r.note || "")),
    h("div", { class: "stats" }, [["今日の稼働率", Math.round(u0 * 100) + "%"], ["ピーク（28日）", Math.round(Math.max(...r.util.slice(7)) * 100) + "%"], ["キャパシティ", r.capacity], ["単価/日", r.rate ? yen(r.rate) : "—"]].map(([k, v]) => h("div", {}, h("b", {}, v), h("span", {}, k))))), 0),
    h("section", { class: "card", style: "margin-top:16px" }, h("h3", {}, "稼働率の推移", h("small", {}, "赤の破線=過負荷ライン（105%）")), ch),
    h("section", { class: "card", style: "margin-top:16px" }, h("h3", {}, "配分された作業"), h("div", { class: "stack" }, al.length ? al : h("p", { class: "empty" }, "配分はありません")))));
  mount(ch, (el, W) => {
    const Hh = 240, m = { t: 12, r: 12, b: 24, l: 40 }, n = r.util.length, x = d3.scaleLinear().domain([-7, n - 8]).range([m.l, W - m.r]), y = d3.scaleLinear().domain([0, Math.max(1.5, d3.max(r.util) * 1.1)]).range([Hh - m.b, m.t]);
    const svg = d3.select(el).append("svg").attr("width", W).attr("height", Hh), id = uid("ru"), lg = svg.append("defs").append("linearGradient").attr("id", id).attr("x1", 0).attr("x2", 0).attr("y1", 0).attr("y2", 1); lg.append("stop").attr("offset", 0).attr("stop-color", "#f97316").attr("stop-opacity", 0.6); lg.append("stop").attr("offset", 1).attr("stop-color", "#2dd4bf").attr("stop-opacity", 0.05);
    svg.append("g").attr("class", "axis grid-l").attr("transform", `translate(${m.l},0)`).call(d3.axisLeft(y).ticks(4).tickSize(-(W - m.l - m.r)).tickFormat(""));
    svg.append("g").attr("class", "axis").attr("transform", `translate(${m.l},0)`).call(d3.axisLeft(y).ticks(4).tickSize(0).tickPadding(6).tickFormat((v) => Math.round(v * 100) + "%"));
    svg.append("g").attr("class", "axis").attr("transform", `translate(0,${Hh - m.b})`).call(d3.axisBottom(x).ticks(7).tickFormat((d) => (d === 0 ? tr("今日") : (d > 0 ? "+" : "") + d)));
    svg.append("path").datum(r.util).attr("fill", `url(#${id})`).attr("d", d3.area().x((v, i) => x(i - 7)).y0(y(0)).y1(y(0)).curve(d3.curveStepAfter)).transition().duration(1100).attr("d", d3.area().x((v, i) => x(i - 7)).y0(y(0)).y1((v) => y(v)).curve(d3.curveStepAfter));
    const p = svg.append("path").datum(r.util).attr("fill", "none").attr("stroke", "#f97316").attr("stroke-width", 2.6).attr("d", d3.line().x((v, i) => x(i - 7)).y((v) => y(v)).curve(d3.curveStepAfter)); const L = p.node().getTotalLength(); p.attr("stroke-dasharray", `${L} ${L}`).attr("stroke-dashoffset", L).transition().duration(1200).attr("stroke-dashoffset", 0);
    svg.append("line").attr("x1", m.l).attr("x2", W - m.r).attr("y1", y(1.05)).attr("y2", y(1.05)).attr("stroke", "#ff7a82").attr("stroke-dasharray", "5 4"); svg.append("line").attr("x1", x(0)).attr("x2", x(0)).attr("y1", m.t).attr("y2", Hh - m.b).attr("stroke", "#ff7a82").attr("stroke-width", 1.6);
  });
};
