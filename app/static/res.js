"use strict";
/* Resource management: table, gantt, sankey and heatmap views over people, vendors, studios and equipment. */
const RKIND = { person: "人材", vendor: "外部パートナー", studio: "スタジオ", equipment: "機材" };
const RKIND_ICON = { person: "person", vendor: "vendor", studio: "studio", equipment: "equipment" };
const RKIND_HUE = { person: 215, vendor: 200, studio: 280, equipment: 160 };
const uState = (u) => (u > 1.05 ? ["過負荷", "bad"] : u >= 0.85 ? ["適正", "ok"] : u < 0.4 ? ["余力あり", "info"] : ["標準", ""]);
const caseClr = (id) => PAL[((id || 0) + 2) % PAL.length];

A.v.resources = async () => {
  const [r, f] = await Promise.all([api("/api/ops/resources"), api("/api/ops/focus")]);
  A.state.focus = f; A.crumbs("リソース管理"); A.updatePill();
  const H = r.horizon, st = (A.state.res = A.state.res || { tab: "table", kind: "all", team: "all" });
  let vt = 0, cur = null;
  const vis = () => r.resources.filter((x) => (st.kind === "all" || x.kind === st.kind) && (st.team === "all" || x.team === st.team));
  const uAt = (x, d) => x.util[7 + d];
  const body = h("div", { class: "rbody" }), kp = h("div", { class: "kpis" });
  const clk = h("span", { class: "vtlab" }), slider = h("input", { type: "range", min: 0, max: H - 1, value: 0, "aria-label": tr("仮想の将来時刻") });

  const kpis = () => {
    const rs = r.resources, vals = [(d3.mean(rs.filter((x) => x.kind === "person"), (x) => uAt(x, vt)) || 0) * 100, rs.filter((x) => uAt(x, vt) > 1.05).length, rs.filter((x) => uAt(x, vt) < 0.4).length, r.totals.exceptions];
    const fm = [(v) => v.toFixed(0) + "%", num, num, num], subs = [`T+${vt}日`, `全${rs.length}件中`, "稼働率40%未満", `今後${H}日 · 過負荷${r.totals.overload_days}リソース日`];
    if (!kp.children.length) kp.replaceChildren(...["人材の平均稼働率", "過負荷のリソース", "余力のあるリソース", "将来の例外（予測）"].map((t, i) => kpiTile(t, vals[i], subs[i], i + 1, fm[i])));
    else [...kp.children].forEach((c, i) => { c.querySelector(".v").textContent = fm[i](vals[i]); c.querySelector(".s").textContent = tr(subs[i]); });
  };

  /* ---- table */
  const table = () => {
    const rows = vis().slice().sort((a, b) => uAt(b, 0) - uAt(a, 0)), upd = [];
    const head = h("div", { class: "rt head" }, ["リソース", "種別・チーム", "スキル", "稼働率（仮想時刻）", `今後${H}日の推移`, "状態", r.show_rate ? "単価/日" : "備考"].map((t) => h("div", {}, t)));
    const card = h("div", { class: "card rtable" }, head, rows.map((x, i) => {
      const sp = h("div", { class: "chart" }), fill = h("i"), pc = h("b"), chip = h("span", { class: "chip" });
      upd.push(() => { const u = uAt(x, vt), [lab, cls] = uState(u); fill.style.width = Math.min(100, u * 70) + "%"; fill.style.background = utilClr(u); pc.className = cls; pc.textContent = Math.round(u * 100) + "%"; chip.className = "chip " + cls; chip.textContent = tr(lab); });
      const row = rv(A.ent(h("div", { class: "rt", "data-tilt": "" },
        h("div", { class: "who" }, h("span", { class: "av" }, resAvatar(x, 46)), h("div", {}, h("b", {}, x.name), h("div", { class: "mut" }, x.title))),
        h("div", {}, h("span", { class: "chip" }, ic(RKIND_ICON[x.kind], 12), RKIND[x.kind]), h("div", { class: "mut" }, teamLabel(x.team))),
        h("div", { class: "skills" }, x.skills.split(" / ").map((s) => h("span", { class: "chip" }, s))),
        h("div", {}, h("div", { class: "ub" }, fill, h("u", {})), pc, x.capacity > 1 ? h("span", { class: "mut" }, ` · 同時${x.capacity}枠`) : null),
        sp, h("div", {}, chip), h("div", { class: "mut" }, r.show_rate ? yen(x.rate) : x.note || "—")), "resource", x.id), Math.min(i, 12));
      spark(sp, x.util.slice(7), { h: 34 }); return row;
    }));
    upd.forEach((f) => f()); card._upd = () => upd.forEach((f) => f()); return card;
  };

  /* ---- gantt */
  const gantt = () => {
    const box = h("div", { class: "chart" }), rs = vis().slice().sort((a, b) => ["person", "vendor", "studio", "equipment"].indexOf(a.kind) - ["person", "vendor", "studio", "equipment"].indexOf(b.kind) || a.team.localeCompare(b.team) || a.id - b.id);
    mount(box, (el, W) => {
      const today = d3.timeDay.floor(new Date()), x0 = d3.timeDay.offset(today, -7), x1 = d3.timeDay.offset(today, H + 12), lab = Math.min(190, W * 0.24), x = d3.scaleTime().domain([x0, x1]).range([lab, W - 8]);
      let y = 24; const rows = rs.map((res) => { const al = r.allocations.filter((a) => a.resource_id === res.id).sort((a, b) => a.start.localeCompare(b.start)), lanes = [];
        al.forEach((a) => { const s = x(parseDay(a.start)); let i = lanes.findIndex((e) => e <= s - 2); if (i < 0) { i = lanes.length; lanes.push(0); } lanes[i] = x(parseDay(a.end)); a._l = i; });
        const n = Math.max(1, lanes.length), hh = n * 15 + 12, row = { res, al, n, y, hh }; y += hh; return row; });
      const svg = d3.select(el).append("svg").attr("width", W).attr("height", y + 8);
      svg.append("g").attr("class", "axis").attr("transform", "translate(0,16)").call(d3.axisTop(x).ticks(Math.max(4, Math.floor(W / 100))).tickFormat(fmtMD).tickSize(0).tickPadding(4));
      rows.forEach((rw, i) => {
        svg.append("rect").attr("x", 0).attr("y", rw.y).attr("width", W).attr("height", rw.hh).attr("fill", "currentColor").attr("opacity", i % 2 ? 0 : 0.035);
        const gi = svg.append("g").attr("class", "ent").attr("data-ent", "resource:" + rw.res.id).attr("transform", `translate(4,${rw.y + 3})`); gi.append("circle").attr("cx", 9).attr("cy", 9).attr("r", 8).attr("fill", `hsl(${RKIND_HUE[rw.res.kind]},65%,52%)`);
        gi.append("text").attr("x", 22).attr("y", 13).style("font-size", "11.5px").text(fitText(rw.res.name, lab - 28, 11.5));
        rw.res.util.slice(7).forEach((u, d) => { if (u > 1.05) svg.append("rect").attr("x", x(d3.timeDay.offset(today, d))).attr("y", rw.y).attr("width", x(d3.timeDay.offset(today, 1)) - x(today)).attr("height", rw.hh).attr("fill", "#ff5a63").attr("opacity", 0.2 + Math.min(0.3, (u - 1) * 0.6)); });
        rw.al.forEach((a) => { const xs = Math.max(lab, x(parseDay(a.start))), xe = Math.max(xs + 6, x(d3.timeDay.offset(parseDay(a.end), 1))), w = Math.max(6, xe - xs), yy = rw.y + 6 + a._l * 15;
          const g = svg.append("g").attr("tabindex", 0).attr("class", "ent").attr("data-ent", "alloc:" + a.id); g.append("rect").attr("x", xs).attr("y", yy).attr("width", w).attr("height", 13).attr("rx", 5).attr("fill", caseClr(a.case_id)).attr("opacity", 0.55 + Math.min(0.4, a.load * 0.4));
          g.append("text").attr("x", xs + 5).attr("y", yy + 10).style("font-size", "9.5px").style("fill", "#fff").style("pointer-events", "none").text(fitText(a.work, w - 8, 9.5));
          g.on("pointermove", (e) => A.tip.show([Object.assign(document.createElement("b"), { textContent: a.work }), document.createElement("br"), document.createTextNode(a.case_name), document.createElement("br"), document.createTextNode(`${fmtMD(parseDay(a.start))} → ${fmtMD(parseDay(a.end))} · 負荷 ${Math.round(a.load * 100)}%`)], e)).on("pointerleave", A.tip.hide).on("click", () => a.case_id && (location.hash = `#/case/${a.case_id}`)); });
      });
      const cx = () => x(d3.timeDay.offset(today, vt)); const cur = svg.append("g"); cur.append("line").attr("y1", 20).attr("y2", y).attr("stroke", "#ff7a82").attr("stroke-width", 1.8); cur.append("text").attr("y", 12).attr("x", 4).style("fill", "#ff7a82").style("font-size", "10px").text(`T+${vt}`);
      cur.attr("transform", `translate(${cx()},0)`); box._set = () => { cur.attr("transform", `translate(${cx()},0)`); cur.select("text").text(`T+${vt}`); };
    });
    return h("div", { class: "card" }, h("h3", {}, "リソース・ガント", h("small", {}, "赤い帯は過負荷（稼働率105%超）· バーの濃さは負荷 · 色は案件")), box);
  };

  /* ---- sankey (kind -> team -> case) */
  const sankey = () => {
    const box = h("div", { class: "chart" });
    mount(box, (el, W) => {
      const kt = r.sankey.kind_team.filter((d) => d.value > 0), tc = r.sankey.team_case.filter((d) => d.value > 0);
      const kinds = [...new Set(kt.map((d) => d.kind))], teams = [...new Set(kt.map((d) => d.team))], cases = [...new Set(tc.map((d) => d.case))];
      const vals = { k: {}, t: {}, c: {} }; kt.forEach((d) => { vals.k[d.kind] = (vals.k[d.kind] || 0) + d.value; vals.t[d.team] = (vals.t[d.team] || 0) + d.value; }); tc.forEach((d) => { vals.c[d.case] = (vals.c[d.case] || 0) + d.value; });
      const Hh = 440, gap = 12, nw = 14, padL = 6, padR = Math.min(230, W * 0.28), xs = [padL, (W - padR - padL) / 2 + padL - nw / 2, W - padR - nw];
      const cols = [[kinds.sort((a, b) => vals.k[b] - vals.k[a]), "k"], [teams.sort((a, b) => vals.t[b] - vals.t[a]), "t"], [cases.sort((a, b) => vals.c[b] - vals.c[a]), "c"]];
      const sc = Math.min(...cols.map(([ns, kk]) => (Hh - 20 - gap * (ns.length - 1)) / (d3.sum(ns, (n) => vals[kk][n]) || 1)));
      const node = {}, cid = {}; tc.forEach((d) => { cid[d.case] = d.case_id; });
      cols.forEach(([ns, kk], ci) => { let y = 10 + (Hh - 20 - (d3.sum(ns, (n) => vals[kk][n]) * sc + gap * (ns.length - 1))) / 2; ns.forEach((n) => { const hh = vals[kk][n] * sc; node[kk + n] = { x: xs[ci], y, h: hh, o: 0, i: 0, kk, n, v: vals[kk][n] }; y += hh + gap; }); });
      const clr = (nd) => (nd.kk === "k" ? `hsl(${RKIND_HUE[nd.n]},75%,58%)` : nd.kk === "t" ? `hsl(${TEAM_HUE[nd.n]},70%,58%)` : caseClr(nd.n.length));
      const svg = d3.select(el).append("svg").attr("width", W).attr("height", Hh), defs = svg.append("defs"), links = [];
      kt.sort((a, b) => node["t" + a.team].y - node["t" + b.team].y).forEach((d) => links.push({ s: node["k" + d.kind], t: node["t" + d.team], v: d.value, label: `${RKIND[d.kind]} → ${teamLabel(d.team)}` }));
      tc.sort((a, b) => node["c" + a.case].y - node["c" + b.case].y).forEach((d) => links.push({ s: node["t" + d.team], t: node["c" + d.case], v: d.value, label: `${teamLabel(d.team)} → ${d.case}` }));
      links.forEach((l) => { l.w = l.v * sc; l.y0 = l.s.y + l.s.o + l.w / 2; l.y1 = l.t.y + l.t.i + l.w / 2; l.s.o += l.w; l.t.i += l.w; });
      const g = svg.append("g").attr("fill", "none");
      const paths = g.selectAll("path").data(links).join("path").attr("d", (l) => { const x0 = l.s.x + nw, x1 = l.t.x, m = (x0 + x1) / 2; return `M${x0},${l.y0} C${m},${l.y0} ${m},${l.y1} ${x1},${l.y1}`; })
        .attr("stroke", (l, i) => { const id = uid("sk"); const lg = defs.append("linearGradient").attr("id", id).attr("gradientUnits", "userSpaceOnUse").attr("x1", l.s.x + nw).attr("x2", l.t.x); lg.append("stop").attr("offset", 0).attr("stop-color", clr(l.s)); lg.append("stop").attr("offset", 1).attr("stop-color", clr(l.t)); return `url(#${id})`; })
        .attr("stroke-width", (l) => Math.max(1.5, l.w)).attr("stroke-opacity", 0.42);
      paths.each(function () { const L = this.getTotalLength(); d3.select(this).attr("stroke-dasharray", `${L} ${L}`).attr("stroke-dashoffset", L).transition().duration(1300).ease(d3.easeCubicOut).attr("stroke-dashoffset", 0); });
      paths.on("pointermove", function (e, l) { paths.attr("stroke-opacity", (q) => (q === l ? 0.8 : 0.12)); A.tip.show([Object.assign(document.createElement("b"), { textContent: l.label }), document.createElement("br"), document.createTextNode(`${l.v.toFixed(1)} 人日相当`)], e); }).on("pointerleave", () => { paths.attr("stroke-opacity", 0.42); A.tip.hide(); });
      Object.values(node).forEach((nd) => { svg.append("rect").attr("class", nd.kk === "k" ? null : "ent").attr("data-ent", nd.kk === "t" ? "team:" + nd.n : nd.kk === "c" ? "case:" + cid[nd.n] : null).attr("x", nd.x).attr("y", nd.y).attr("width", nw).attr("height", Math.max(3, nd.h)).attr("rx", 4).attr("fill", clr(nd));
        const left = nd.kk === "c" ? nd.x + nw + 8 : nd.kk === "k" ? nd.x + nw + 6 : nd.x + nw + 6, label = nd.kk === "k" ? RKIND[nd.n] : nd.kk === "t" ? teamLabel(nd.n) : nd.n;
        svg.append("text").attr("x", nd.kk === "t" ? nd.x - 6 : left).attr("text-anchor", nd.kk === "t" ? "end" : "start").attr("y", nd.y + Math.max(3, nd.h) / 2 + 4).style("font-size", "12px").style("font-weight", 600).text(fitText(label, nd.kk === "c" ? padR - 20 : 140, 12)); });
      ["リソースの種類", "チーム", "案件"].forEach((t, i) => svg.append("text").attr("x", i === 1 ? xs[1] + nw / 2 : xs[i]).attr("text-anchor", i === 1 ? "middle" : "start").attr("y", 8).style("font-size", "10px").style("fill", "currentColor").attr("opacity", 0.6).text(t));
    });
    return h("div", { class: "card" }, h("h3", {}, "リソース・フロー（サンキー）", h("small", {}, `今後${H}日間の稼働量（人日相当）：種類 → チーム → 案件 · ホバーで強調`)), box);
  };

  /* ---- heatmap */
  const heat = () => {
    const box = h("div", { class: "chart" }), rs = vis().slice().sort((a, b) => ["person", "vendor", "studio", "equipment"].indexOf(a.kind) - ["person", "vendor", "studio", "equipment"].indexOf(b.kind) || a.team.localeCompare(b.team));
    mount(box, (el, W) => {
      const lab = Math.min(190, W * 0.25), cw = Math.max(8, (W - lab - 8) / H), rh = 20, Ht = 30 + rs.length * rh + 8, svg = d3.select(el).append("svg").attr("width", W).attr("height", Ht);
      for (let d = 0; d < H; d += 7) svg.append("text").attr("x", lab + d * cw).attr("y", 12).style("font-size", "10px").attr("opacity", 0.7).text(mdIn(d));
      rs.forEach((x, i) => { const y = 22 + i * rh; svg.append("text").attr("class", "ent").attr("data-ent", "resource:" + x.id).attr("x", 4).attr("y", y + 14).style("font-size", "11.5px").text(fitText(x.name, lab - 10, 11.5));
        for (let d = 0; d < H; d++) { const u = x.util[7 + d]; svg.append("rect").attr("x", lab + d * cw + 0.5).attr("y", y).attr("width", cw - 1).attr("height", rh - 2).attr("rx", 3).attr("fill", u === 0 ? "currentColor" : utilClr(u)).attr("opacity", u === 0 ? 0.06 : 0.9)
          .on("pointermove", (e) => A.tip.show([Object.assign(document.createElement("b"), { textContent: x.name }), document.createElement("br"), document.createTextNode(`T+${d}（${mdIn(d)}）: ${Math.round(u * 100)}%`)], e)).on("pointerleave", A.tip.hide); } });
      const cur = svg.append("rect").attr("y", 16).attr("width", cw + 1).attr("height", Ht - 18).attr("rx", 3).attr("fill", "none").attr("stroke", "#fff").attr("stroke-width", 2).attr("x", lab + vt * cw - 0.5);
      box._set = () => cur.attr("x", lab + vt * cw - 0.5);
    });
    return h("div", { class: "card" }, h("h3", {}, "稼働率ヒートマップ", h("small", {}, "縦: リソース / 横: 将来の日付（仮想時刻）· 白枠が選択中の日")),
      h("div", { class: "legend" }, [["余力", "#1f9d8b"], ["適正", "#fbbf24"], ["過負荷", "#ef4444"]].map(([t, c]) => h("span", {}, h("i", { style: `background:${c}` }), t))), box);
  };

  const TABS = [["table", "テーブル", "table", table], ["gantt", "ガント", "gantt", gantt], ["sankey", "サンキー", "flow", sankey], ["heat", "ヒートマップ", "heat", heat]];
  const tabSeg = h("div", { class: "seg big" }, TABS.map(([k, t, i]) => h("button", { "data-k": k, class: "tabbtn", onclick: () => { st.tab = k; draw(); } }, ic(i, 15), t)));
  const kindSeg = h("div", { class: "seg" }, [["all", "すべて"], ...Object.entries(RKIND)].map(([k, t]) => h("button", { "data-k": k, onclick: () => { st.kind = k; draw(); } }, t)));
  const teamSel = h("select", { "aria-label": tr("チーム"), onchange: (e) => { st.team = e.target.value; draw(); } }, [h("option", { value: "all" }, "全チーム"), ...Object.keys(r.teams).filter((k) => k !== "manager").map((k) => h("option", { value: k }, r.teams[k]))]);
  teamSel.value = st.team;
  const draw = () => {
    const t = TABS.find((x) => x[0] === st.tab); const el = t[3](); cur = el; body.replaceChildren(rv(el, 0));
    [...tabSeg.children].forEach((b) => b.classList.toggle("on", b.dataset.k === st.tab)); [...kindSeg.children].forEach((b) => b.classList.toggle("on", b.dataset.k === st.kind));
    slider.disabled = st.tab === "sankey"; kpis();
  };
  const setClk = (d) => { clk.textContent = tr(`T+${d}日 · `) + ymdIn(d); };
  const setVt = (d) => { vt = d; setClk(d); kpis(); if (cur && cur._upd) cur._upd(); else { const c = body.querySelector(".chart"); c && c._set && c._set(); } };
  slider.oninput = () => { FX.sfx("tick", +slider.value); setVt(+slider.value); };
  setClk(0);
  A.mount(h("div", {},
    h("div", { class: "row", style: "margin-bottom:14px" }, h("h1", { style: "font-size:26px;margin:0" }, "リソース管理"), h("span", { class: "sp" }),
      h("button", { class: "btn agent big", onclick: () => A.autopilot("resources") }, ic("ai", 18), "AI Agentによる最適化")),
    rv(A.focusBanner(f, { compact: true }), 0), kp,
    h("div", { class: "row rbar" }, tabSeg, kindSeg, teamSel, h("span", { class: "sp" }), h("div", { class: "vt" }, ic("clock", 14), h("span", { class: "mut" }, "仮想の将来時刻"), slider, clk)), body));
  draw();
};

