"use strict";
/* Case workspace: a Dynamics-style business process flow across the ad lifecycle, viewed through department lenses. */
const LENSES = [["all", "全体"], ["sales", "営業"], ["production", "制作"], ["media", "媒体・運用"], ["finance", "経理"], ["legal", "法務"], ["analyst", "分析"]];
const CUSTOMER_GRAD = { 1: ["#0f4fb8", "#7a3de8"], 2: ["#0a7a6b", "#1a5fa0"] };
const NEXT_TASK = { todo: "doing", doing: "done", done: "todo" };

const dot = (state) => h("span", { class: "dot " + state }, state === "ok" ? ic("check", 12) : state === "bad" ? "!" : null);
const checksBlock = (list) => h("div", {}, list.map((c) => h("div", { class: "ck" }, dot(c.ok ? "ok" : "bad"), h("div", { class: "t" }, c.label, h("small", {}, c.detail)))));

function taskBlock(d, filterDept, onlyStage) {
  const cs = A.state.cs, stages = d.stages, active = d.case.status === "active";
  const tasks = d.tasks.filter((t) => (!filterDept || filterDept === "all" || t.dept === filterDept) && (!onlyStage || t.stage === onlyStage));
  if (!tasks.length) return h("p", { class: "mut" }, "該当するタスクはありません");
  const byStage = d3.group(tasks, (t) => t.stage);
  return h("div", {}, [...byStage].map(([st, ts]) => h("div", {}, onlyStage ? null : h("div", { class: "mut", style: "font-size:11px;margin:10px 0 2px;letter-spacing:.08em" }, stageLabel(stages, st)),
    ts.map((t) => { const mine = active && (role() === t.dept || role() === "manager");
      return h("div", { class: "ck" }, h("button", { class: "dot " + (t.status === "done" ? "ok" : t.status === "doing" ? "doing" : ""), disabled: !mine, "aria-label": `${t.title}: ${tr(STATUS[t.status])}`,
        title: mine ? `クリックで「${STATUS[NEXT_TASK[t.status]]}」へ` : "担当部署のみ更新できます", onclick: () => act(() => api(`/api/tasks/${t.id}/status`, "POST", { status: NEXT_TASK[t.status] })) }, t.status === "done" ? ic("check", 12) : null),
        h("div", { class: "t" }, t.title, h("small", {}, `${tr(DEPT[t.dept])} · ${tr(STATUS[t.status])}${t.done_at ? " · " + t.done_at.slice(0, 10) : ""}`))); }))));
}

const lineOptions = (d) => d.lines.map((l) => [l.id, l.description]);
function ingestBtn(kind, label, line, fields) {
  return h("button", { class: "btn sm", disabled: !can("ingest_" + kind) || A.state.cs.d.case.status !== "active", onclick: () => form(`${label}の取込（正本イベントの模擬）: ${line.description}`, [...fields, { name: "date", label: "日付", type: "date" }, { name: "external_ref", label: "外部参照ID（同一IDの再送は無視）" }],
    (v) => api("/api/ingest/" + kind, "POST", { line_id: line.id, ...v })) }, label);
}
const F_PO = [{ name: "vendor", label: "取引先" }, { name: "amount", label: "金額", type: "number", min: 0 }];
const F_DL = [{ name: "qty", label: "数量", type: "number", step: "any" }, { name: "evidence", label: "証跡" }];
const F_AC = [{ name: "qty", label: "数量", type: "number", step: "any" }, { name: "accepted_by", label: "検収者" }, { name: "evidence", label: "証跡" }];
const F_IV = [{ name: "qty", label: "数量", type: "number", step: "any" }, { name: "amount", label: "金額", type: "number", min: 0 }];

function lineTable(d, buttons) {
  return h("div", { class: "tscroll" }, h("table", {}, h("thead", {}, h("tr", {}, ["明細", "契約額", "原価予算 / 発注", "納品", "検収", "請求", buttons.length ? "取込（模擬）" : ""].map((t, i) => h("th", { class: i > 0 && i < 6 ? "n" : "" }, t)))),
    h("tbody", {}, d.lines.map((l) => h("tr", {}, h("td", {}, h("div", { class: "row nw" }, A.ent(h("span", { class: "pmas" }, Art.product(l.product_id, 36)), "product", l.product_id), h("div", {}, l.description, h("div", { class: "mut", style: "font-size:11px" }, `${l.product_name} v${l.product_version} ・ ${l.acceptance_rule}`)))),
      h("td", { class: "n" }, yen(l.state.contract_amount)), h("td", { class: "n" }, yen(l.state.cost_budget), " / ", h("span", { class: l.state.po_amount > l.state.cost_budget ? "bad" : "" }, yen(l.state.po_amount))),
      h("td", { class: "n" }, `${l.state.delivered_qty}/${l.qty}`), h("td", { class: "n" }, `${l.state.accepted_qty}/${l.qty}`), h("td", { class: "n" }, `${l.state.invoiced_qty}/${l.qty}`),
      h("td", {}, h("div", { class: "row" }, buttons.map(([k, t, f]) => ingestBtn(k, t, l, f)))))))));
}

function assetCard(d, a, openIdx) {
  const c = a.sample_key ? creativeBy(a.sample_key) : null;
  const items = d.assets.filter((x) => x.sample_key).map((x) => ({ key: x.sample_key, title: x.name, kind: x.kind, sub: `${d.customer.name} · ${d.case.name}`, status: x.approved ? "承認済み" : "未承認" }));
  const idx = items.findIndex((x) => x.key === a.sample_key);
  const media = c ? thumb(a.sample_key, () => openViewer(items, idx), a.name) : h("div", { class: "thumb", style: "display:grid;place-items:center;cursor:default" }, h("div", { class: "mut" }, KINDS[a.kind] + "（プレビューなし）"));
  const risky = a.rights_expiry && a.rights_expiry < d.case.end_date;
  return h("div", { class: "card crd" }, media, h("div", { class: "tt" }, a.name), h("div", { class: "row" }, h("span", { class: "chip" }, KINDS[a.kind]), h("span", { class: "mut" }, `v${a.version}`),
    h("span", { class: "chip " + (a.approved ? "good" : "medium") }, a.approved ? "承認済み" : "未承認"), risky ? h("span", { class: "chip high" }, "権利期限不足") : null),
    h("div", { class: "mut", style: "font-size:12px" }, `権利期限: ${a.rights_expiry || "未設定"}`, a.used_at ? ` ・ 使用 ${a.used_at.slice(0, 10)}` : ""),
    h("div", { class: "row" },
      !a.approved ? h("button", { class: "btn sm", disabled: !can("approve_asset"), title: can("approve_asset") ? "" : "法務・業務責任者が承認します", onclick: () => act(() => api(`/api/assets/${a.id}/approve`, "POST", {}), "承認しました") }, "承認") : null,
      !a.used_at ? h("button", { class: "btn sm", disabled: !can("use_asset"), onclick: () => act(() => api(`/api/assets/${a.id}/use`, "POST", {}), "使用を記録しました") }, "使用を記録") : null));
}

function addAsset(d) {
  form("広告作品を登録", [
    { name: "name", label: "作品名" },
    { name: "kind", label: "種別", type: "select", options: Object.entries(KINDS) },
    { name: "sample_key", label: "デモ作品（HTML5）を割り当て", type: "select", options: [["", "（割り当てなし）"], ...A.state.creatives.map((c) => [c.key, `${tr(KINDS[c.kind])}: ${c.title}`])] },
    { name: "version", label: "版", type: "number", value: 1, min: 1 }, { name: "rights_expiry", label: "権利期限", type: "date" }],
  (v) => api(`/api/cases/${d.case.id}/assets`, "POST", { ...v, sample_key: v.sample_key || null }), { ok: "広告作品を登録しました" });
}
function addLine(d) {
  api("/api/products").then(({ products }) => form("契約明細を追加", [
    { name: "product_id", label: "商材", type: "select", options: products.map((p) => [p.id, `${p.name} v${p.version}`]) }, { name: "description", label: "明細名" },
    { name: "qty", label: "数量", type: "number", value: 1, step: "any", min: 0 }, { name: "unit_price", label: "単価（円）", type: "number", min: 0 }, { name: "cost_budget", label: "原価予算（円）", type: "number", value: 0, min: 0 }],
  (v) => api(`/api/cases/${d.case.id}/lines`, "POST", { ...v, product_id: Number(v.product_id) }), { ok: "明細を追加しました" })).catch((e) => toast(e.message, "err"));
}
function addFlight(d) {
  const mediaLines = d.lines;
  form("配信計画を登録", [
    { name: "line_id", label: "契約明細", type: "select", options: lineOptions(d) }, { name: "channel", label: "媒体・チャネル" },
    { name: "kind", label: "種別", type: "select", options: [["digital", "デジタル"], ["broadcast", "放送（素材はテレビ局へ別途搬入）"]] },
    { name: "start_date", label: "開始日", type: "date", value: d.case.start_date }, { name: "end_date", label: "終了日", type: "date", value: d.case.end_date },
    { name: "budget", label: "配信予算（円）", type: "number", min: 0 }, { name: "creative_id", label: "広告作品", type: "select", options: [["", "（なし）"], ...d.assets.map((a) => [a.id, `${a.name}${a.approved ? "" : "（未承認）"}`])] }],
  (v) => api(`/api/cases/${d.case.id}/flights`, "POST", { ...v, line_id: Number(v.line_id), creative_id: v.creative_id ? Number(v.creative_id) : null }), { ok: "配信計画を登録しました" });
}
function addMetrics(d) {
  const today = new Date().toISOString().slice(0, 10);
  form("成果データを記録（広告主・媒体の報告値）", [
    { name: "flight_id", label: "配信", type: "select", options: d.flights.map((f) => [f.id, f.channel]) }, { name: "day", label: "日付", type: "date", value: today },
    { name: "impressions", label: "インプレッション", type: "number", value: 0, min: 0 }, { name: "clicks", label: "クリック", type: "number", value: 0, min: 0 },
    { name: "conversions", label: "コンバージョン（広告主提供）", type: "number", value: 0, min: 0 }, { name: "spend", label: "広告費（円）", type: "number", value: 0, min: 0 }],
  (v) => api(`/api/cases/${d.case.id}/metrics`, "POST", { ...v, flight_id: Number(v.flight_id) }), { ok: "成果データを記録しました", intro: "同じ配信・日付は上書きされます。配信期間内かつ本日以前の日付のみ指定できます。" });
}

/* ---- stage workspaces ---- */
const editableBrief = (d) => can("edit_brief") && d.case.status === "active" && ["plan", "contract"].includes(d.case.stage);
function wsPlan(d) {
  const c = d.case, ro = !editableBrief(d), f = {};
  const field = (key, label, type = "text", ta) => { const i = ta ? h("textarea", { rows: 2, maxlength: 300 }) : h("input", { type, step: type === "number" ? "any" : null, min: type === "number" ? 0 : null }); i.value = c[key] ?? ""; i.disabled = ro; f[key] = i; return h("div", {}, h("label", { class: "mut", style: "font-size:12px;display:block;margin:10px 0 3px" }, label), i); };
  const body = h("div", { class: "grid g2", style: "gap:0 18px" }, field("objective", "目的", "text", true), field("target", "ターゲット", "text", true), field("budget", "予算（円）", "number"), field("kpi_name", "KPI名"), field("kpi_target", "KPI目標値", "number"), field("start_date", "開始日", "date"), field("end_date", "終了日", "date"));
  const save = h("button", { class: "btn accent", disabled: ro, onclick: () => act(() => api(`/api/cases/${c.id}/brief`, "POST", { objective: f.objective.value, target: f.target.value, budget: Number(f.budget.value || 0), kpi_name: f.kpi_name.value, kpi_target: f.kpi_target.value === "" ? null : Number(f.kpi_target.value), start_date: f.start_date.value, end_date: f.end_date.value }), "ブリーフを保存しました") }, "ブリーフを保存");
  return h("div", {}, body, h("div", { class: "row", style: "margin-top:14px" }, save, ro ? h("span", { class: "mut" }, ["plan", "contract"].includes(c.stage) ? "営業・業務責任者が編集できます" : "契約確定後は変更管理を利用してください") : null));
}
function wsContract(d) {
  const budgetBar = h("div"), canEdit = can("edit_lines") && d.case.status === "active" && ["plan", "contract"].includes(d.case.stage), s = d.summary;
  Promise.resolve().then(() => Charts.hbars(budgetBar, [{ label: "契約額 / 予算", value: s.contract_amount, max: d.case.budget || s.contract_amount || 1, sub: `${yen(s.contract_amount)} / ${yen(d.case.budget)}`, tone: s.contract_amount > d.case.budget && d.case.budget ? "bad" : "" },
    { label: "見込原価 / 契約額", value: d.lines.reduce((a, l) => a + l.state.cost_budget, 0), max: s.contract_amount || 1, sub: "原価予算の合計", tone: "warn" }]));
  return h("div", {}, d.lines.length ? lineTable(d, []) : h("p", { class: "empty" }, "契約明細はまだありません。"), h("div", { class: "row", style: "margin:12px 0" }, h("button", { class: "btn accent", disabled: !canEdit, onclick: () => addLine(d) }, ic("plus", 14), "明細を追加"), canEdit ? null : h("span", { class: "mut" }, "営業・業務責任者が、企画〜契約ステージで追加できます（以降は変更管理）")), budgetBar);
}
function wsProduce(d) {
  return h("div", {}, h("div", { class: "row", style: "margin-bottom:12px" }, h("button", { class: "btn accent", disabled: !can("create_asset") || d.case.status !== "active", onclick: () => addAsset(d) }, ic("plus", 14), "広告作品を登録"),
    h("span", { class: "mut" }, "制作担当が作品（Web・動画・画像・ソーシャル・インタラクティブ）を登録します")),
  d.assets.length ? h("div", { class: "crgrid" }, d.assets.map((a) => assetCard(d, a))) : h("p", { class: "empty" }, "まだ広告作品がありません。"));
}
function wsReview(d) {
  const box = h("div", { class: "chart" }); Promise.resolve().then(() => Charts.rights(box, d.assets, d.case.end_date, new Date().toISOString().slice(0, 10)));
  const pend = d.changes.filter((c) => c.status === "pending").length;
  return h("div", {}, h("p", { class: "note info", style: "margin-bottom:12px" }, "法務が権利・表現を確認して作品を承認し、営業が顧客承認を取得します。権利期限が案件終了日より前の作品は配信に使えません。"),
    d.assets.length ? h("div", { class: "crgrid" }, d.assets.map((a) => assetCard(d, a))) : h("p", { class: "empty" }, "確認対象の作品がありません。"),
    h("h3", { style: "margin:18px 0 6px" }, "権利期限と案件終了日"), box, pend ? h("p", { class: "warn", style: "margin-top:8px" }, `承認待ちの変更が${pend}件あります（変更管理で確認）`) : null);
}
function wsDeploy(d) {
  const g = h("div", { class: "chart", id: "gcase" }), pace = h("div");
  Promise.resolve().then(() => { Charts.gantt(g, d.flights.map((f) => ({ ...f, case_name: d.case.name })), {}); Charts.hbars(pace, d.flights.map((f) => ({ label: f.channel, value: f.totals.spend, max: f.budget, sub: `${yenM(f.totals.spend)} / ${yenM(f.budget)}`, tone: f.totals.spend > f.budget ? "bad" : "" }))); });
  const canF = can("manage_flights") && d.case.status === "active";
  return h("div", {}, h("div", { class: "row", style: "margin-bottom:10px" }, h("button", { class: "btn accent", disabled: !canF || STAGE_IDX(d) < 3, onclick: () => addFlight(d) }, ic("plus", 14), "配信計画を追加"), h("span", { class: "mut" }, "媒体担当が、承認済み作品を紐づけて配信を計画・開始します")),
    g, h("div", { class: "tscroll", style: "margin-top:10px" }, d.flights.length ? h("table", {}, h("thead", {}, h("tr", {}, ["配信", "期間", "予算", "作品", "状態", ""].map((t) => h("th", {}, t)))), h("tbody", {}, d.flights.map((f) => { const cr = d.assets.find((a) => a.id === f.creative_id);
      return h("tr", {}, h("td", {}, f.channel, h("div", { class: "mut", style: "font-size:11px" }, f.kind === "broadcast" ? "放送" : "デジタル")), h("td", {}, `${f.start_date}〜${f.end_date}`), h("td", { class: "n" }, yen(f.budget)),
        h("td", {}, cr ? h("span", { class: "chip " + (cr.approved ? "good" : "medium") }, cr.name.slice(0, 14)) : h("span", { class: "mut" }, f.kind === "broadcast" ? "放送素材" : "未紐づけ")),         h("td", { class: "nw" }, h("span", { class: "chip " + (f.status === "live" ? "info" : "") }, STATUS[f.status])),
                h("td", { class: "nw" }, f.status === "planned" ? h("button", { class: "btn sm", disabled: !canF, onclick: () => act(() => api(`/api/flights/${f.id}/status`, "POST", { status: "live" }), "配信を開始しました") }, "配信開始") : f.status === "live" ? h("button", { class: "btn sm", disabled: !canF, onclick: () => act(() => api(`/api/flights/${f.id}/status`, "POST", { status: "done" }), "配信を完了しました") }, "配信完了") : null)); }))) : h("p", { class: "empty" }, "配信計画はまだありません。")),
    h("h3", { style: "margin:18px 0 8px" }, "予算消化（配信別）"), pace,
    h("h3", { style: "margin:18px 0 8px" }, "発注・納品"), lineTable(d, [["po", "発注", F_PO], ["delivery", "納品", F_DL]]));
}
const STAGE_IDX = (d) => d.stages.findIndex((s) => s.key === d.case.stage);
function wsBill(d) {
  const bars = h("div"); Promise.resolve().then(() => Charts.hbars(bars, d.lines.flatMap((l) => [{ label: `${l.description}（検収→請求）`, value: l.state.invoiced_qty, max: Math.max(l.state.accepted_qty, l.state.invoiced_qty) || 1, sub: `請求${l.state.invoiced_qty} / 検収${l.state.accepted_qty}`, tone: l.state.invoiced_qty > l.state.accepted_qty ? "bad" : l.state.invoiced_qty < l.state.accepted_qty ? "warn" : "" }])));
  const ex = d.exceptions.filter((e) => e.status === "open" && ["UNBILLED", "INVOICE_BEFORE_ACCEPTANCE", "OVERBILLED", "DUPLICATE_INVOICE", "ACCEPT_EXCEEDS_DELIVERY"].includes(e.kind));
  return h("div", {}, lineTable(d, [["acceptance", "検収", F_AC], ["invoice", "請求", F_IV]]), h("h3", { style: "margin:18px 0 8px" }, "検収と請求の照合"), bars,
    h("h3", { style: "margin:18px 0 8px" }, "請求関連の例外"), ex.length ? A.exceptionTable(ex.map((e) => ({ ...e, case_name: null })), false, true) : h("p", { class: "ok" }, "請求関連の未対応例外はありません"));
}
function wsMeasure(d) {
  const k = d.case.kpi_target, conv = d.metrics.reduce((a, m) => a + m.conversions, 0), box = h("div"), gauge = h("div"), wrap = h("div");
  const byDay = d3.rollups(d.metrics, (v) => ({ impressions: d3.sum(v, (x) => x.impressions), clicks: d3.sum(v, (x) => x.clicks), conversions: d3.sum(v, (x) => x.conversions), spend: d3.sum(v, (x) => x.spend) }), (m) => m.day).sort((a, b) => d3.ascending(a[0], b[0]));
  const M = { impressions: ["インプレッション", num, "#4da3ff"], clicks: ["クリック", num, "#8b6cff"], conversions: ["コンバージョン", num, "#2dd4bf"], spend: ["広告費", yen, "#f59e0b"] }; let metric = "conversions";
  const seg = h("div", { class: "seg" }); const draw = () => { const [lab, fmt, color] = M[metric], c = h("div", { class: "chart" }); wrap.replaceChildren(c); Charts.trend(c, byDay.map(([day, v]) => ({ day, v: v[metric] })), { fmt, color, label: lab, h: 220 }); [...seg.children].forEach((b) => b.classList.toggle("on", b.dataset.k === metric)); };
  Object.entries(M).forEach(([key, m]) => seg.append(h("button", { "data-k": key, onclick: () => { metric = key; draw(); } }, m[0])));
  Promise.resolve().then(() => { Charts.gauge(gauge, conv, k, d.case.kpi_name ? `KPI: ${d.case.kpi_name}` : "KPI未設定"); draw(); });
  const tot = (f) => f.totals;
  return h("div", {}, h("p", { class: "note", style: "margin-bottom:12px" }, "媒体指標（表示・クリック）と、広告主が提供する成果（コンバージョン）は別の指標です。ここでの比較は因果効果を示すものではありません。"),
    h("div", { class: "grid g2" }, h("div", {}, h("h3", { style: "margin-bottom:6px" }, "KPI達成度"), gauge), h("div", {}, h("div", { class: "row" }, h("h3", { style: "margin:0" }, "日次推移"), h("span", { class: "sp" }), seg), wrap)),
    h("div", { class: "row", style: "margin:14px 0 8px" }, h("h3", { style: "margin:0" }, "配信別の成果"), h("span", { class: "sp" }), h("button", { class: "btn sm accent", disabled: !can("record_metrics") || !d.flights.length || STAGE_IDX(d) < 4 || d.case.status !== "active", onclick: () => addMetrics(d) }, ic("plus", 12), "成果を記録")),
    d.flights.length ? h("div", { class: "tscroll" }, h("table", {}, h("thead", {}, h("tr", {}, ["配信", "インプレッション", "クリック", "CTR", "コンバージョン", "広告費", "CPA"].map((t, i) => h("th", { class: i ? "n" : "" }, t)))),
      h("tbody", {}, d.flights.map((f) => h("tr", {}, h("td", {}, f.channel), h("td", { class: "n" }, num(tot(f).impressions)), h("td", { class: "n" }, num(tot(f).clicks)), h("td", { class: "n" }, tot(f).impressions ? pct(tot(f).clicks / tot(f).impressions) : "—"),
        h("td", { class: "n" }, num(tot(f).conversions)), h("td", { class: "n" }, yen(tot(f).spend)), h("td", { class: "n" }, tot(f).conversions ? yen(tot(f).spend / tot(f).conversions) : "—")))))) : h("p", { class: "empty" }, "配信が登録されていません。"), box);
}
const WS = { plan: wsPlan, contract: wsContract, produce: wsProduce, review: wsReview, deploy: wsDeploy, bill: wsBill, measure: wsMeasure };

/* ---- department lenses: the same data, seen and edited from each department ---- */
function kv(rowsData) { return h("dl", { class: "kv" }, rowsData.flatMap(([k, v]) => [h("dt", {}, k), h("dd", {}, v)])); }
function lensPanel(d, lens) {
  const s = d.summary, c = d.case, box = h("div");
  const head = (t, sub) => h("h3", {}, t, h("small", {}, sub || ""));
  if (lens === "all") {
    const by = d3.rollups(d.tasks, (v) => ({ done: v.filter((t) => t.status === "done").length, n: v.length }), (t) => t.dept);
    Promise.resolve().then(() => Charts.hbars(box, by.map(([dept, v]) => ({ label: DEPT[dept], value: v.done, max: v.n, sub: `${v.done}/${v.n} タスク完了` }))));
    return h("div", {}, head("全体サマリー", "部署別のタスク進捗"), box, kv([["顧客", d.customer.name], ["目的", c.objective || "—"], ["ターゲット", c.target || "—"], ["契約額", yen(s.contract_amount)], ["見込採算", yen(s.expected_margin) + (s.margin_complete ? "" : "（暫定）")], ["例外", `${d.exceptions.filter((e) => e.status === "open").length}件`]]));
  }
  if (lens === "sales") {
    const pend = d.changes.filter((x) => x.status === "pending");
    Promise.resolve().then(() => Charts.hbars(box, [{ label: "契約額 / 予算", value: s.contract_amount, max: c.budget || s.contract_amount || 1, sub: `${yenM(s.contract_amount)} / ${yenM(c.budget)}` }, { label: "請求額 / 契約額", value: s.invoiced_amount, max: s.contract_amount || 1, sub: `${yenM(s.invoiced_amount)} / ${yenM(s.contract_amount)}` }]));
    return h("div", {}, head("営業の視点", "顧客・契約・承認"), kv([["顧客", d.customer.name], ["目的", c.objective || "—"], ["KPI", c.kpi_name ? `${c.kpi_name} ${num(c.kpi_target)}` : "—"], ["承認待ち変更", `${pend.length}件`]]), h("div", { style: "margin:12px 0" }, box),
      h("div", { class: "row" }, h("button", { class: "btn sm", disabled: !can("create_change") || c.status !== "active", onclick: () => A.newChange(d) }, "変更を登録")));
  }
  if (lens === "production") {
    const unap = d.assets.filter((a) => !a.approved).length;
    return h("div", {}, head("制作の視点", "作品・素材・版"), kv([["登録作品", `${d.assets.length}件`], ["未承認", `${unap}件`], ["使用済み", `${d.assets.filter((a) => a.used_at).length}件`]]),
      h("div", { class: "row", style: "margin-top:10px" }, h("button", { class: "btn sm", disabled: !can("create_asset") || c.status !== "active", onclick: () => addAsset(d) }, "広告作品を登録")),
      h("div", { style: "margin-top:12px" }, d.assets.filter((a) => a.sample_key).slice(0, 3).map((a, i) => h("div", { style: "margin-bottom:8px" }, thumb(a.sample_key, () => openViewer(d.assets.filter((x) => x.sample_key).map((x) => ({ key: x.sample_key, title: x.name, kind: x.kind, status: x.approved ? "承認済み" : "未承認" })), i), a.name)))));
  }
  if (lens === "media") {
    Promise.resolve().then(() => Charts.hbars(box, d.flights.map((f) => ({ label: f.channel, value: f.totals.spend, max: f.budget, sub: `${yenM(f.totals.spend)} / ${yenM(f.budget)}`, tone: f.totals.spend > f.budget ? "bad" : "" }))));
    return h("div", {}, head("媒体・運用の視点", "配信・発注・納品"), kv([["配信計画", `${d.flights.length}件（配信中 ${d.flights.filter((f) => f.status === "live").length}）`], ["発注額", yen(s.po_amount)]]), h("div", { style: "margin:12px 0" }, box),
      h("div", { class: "row" }, h("button", { class: "btn sm", disabled: !can("manage_flights") || STAGE_IDX(d) < 3 || c.status !== "active", onclick: () => addFlight(d) }, "配信計画を追加")));
  }
  if (lens === "finance") {
    const ex = d.exceptions.filter((e) => e.status === "open" && ["UNBILLED", "INVOICE_BEFORE_ACCEPTANCE", "OVERBILLED", "DUPLICATE_INVOICE", "COST_OVERRUN"].includes(e.kind));
    Promise.resolve().then(() => Charts.hbars(box, [{ label: "請求額 / 契約額", value: s.invoiced_amount, max: s.contract_amount || 1, sub: `${yenM(s.invoiced_amount)} / ${yenM(s.contract_amount)}` }, { label: "発注額 / 契約額（原価率）", value: s.po_amount, max: s.contract_amount || 1, sub: `${yenM(s.po_amount)}`, tone: "warn" }]));
    return h("div", {}, head("経理の視点", "請求・原価・照合"), kv([["見込採算", yen(s.expected_margin) + (s.margin_complete ? "" : "（暫定）")], ["請求関連の例外", `${ex.length}件`]]), h("div", { style: "margin:12px 0" }, box),
      ex.slice(0, 3).map((e) => h("div", { class: "ck" }, sev(e.severity), h("div", { class: "t" }, e.detail))));
  }
  if (lens === "legal") {
    Promise.resolve().then(() => Charts.rights(box, d.assets, c.end_date, new Date().toISOString().slice(0, 10)));
    return h("div", {}, head("法務の視点", "権利・表現・契約"), kv([["未承認作品", `${d.assets.filter((a) => !a.approved).length}件`], ["権利期限の不足", `${d.assets.filter((a) => a.rights_expiry && a.rights_expiry < c.end_date).length}件`]]), h("div", { style: "margin-top:10px" }, box));
  }
  const conv = d.metrics.reduce((a, m) => a + m.conversions, 0);
  Promise.resolve().then(() => Charts.gauge(box, conv, c.kpi_target, c.kpi_name ? `KPI: ${c.kpi_name}` : "KPI未設定"));
  return h("div", {}, head("分析の視点", "成果・KPI"), box, h("div", { class: "row", style: "margin-top:10px" }, h("button", { class: "btn sm", disabled: !can("record_metrics") || !d.flights.length || STAGE_IDX(d) < 4 || c.status !== "active", onclick: () => addMetrics(d) }, "成果を記録")));
}

A.newChange = (d) => form("変更を登録", [
  { name: "description", label: "変更内容", type: "textarea" }, { name: "line_id", label: "対象明細", type: "select", options: [["", "（明細指定なし）"], ...lineOptions(d)] },
  { name: "amount_delta", label: "金額増減", type: "number", value: 0, step: "any" }, { name: "cost_delta", label: "原価増減", type: "number", value: 0, step: "any" },
  { name: "days_delta", label: "納期影響（日）", type: "number", value: 0 }, { name: "emergency", label: "緊急（事後承認）", type: "checkbox" }, { name: "post_approval_due", label: "事後承認期限（緊急時必須）", type: "date" }],
(v) => api(`/api/cases/${d.case.id}/changes`, "POST", { ...v, line_id: v.line_id ? Number(v.line_id) : null }),
{ extra: { label: "影響候補を確認", run: async (v, out) => { try { const r = await api("/api/changes/impact", "POST", { case_id: d.case.id, description: v.description, days_delta: v.days_delta || 0 });
  out.style.display = "block"; out.replaceChildren(h("b", {}, "影響候補（ルールベース）"), ...r.candidates.map((x) => h("div", {}, `・${x.description}（一致度 ${x.score}）`, h("div", { class: "mut" }, x.basis.join(" / ")))), ...r.notes.map((n) => h("div", {}, "・" + n)), h("div", { class: "mut" }, r.disclaimer)); } catch (e) { toast(e.message, "err"); } } } });

function graphData(d) {
  const nodes = [{ id: "c", type: "case", label: d.case.name }], links = [];
  d.lines.forEach((l) => { nodes.push({ id: "l" + l.id, type: "line", label: l.description }); links.push({ source: "c", target: "l" + l.id, a: "case" });
    [["purchase_orders", "po", "p"], ["deliveries", "delivery", "d"], ["acceptances", "acceptance", "a"], ["invoices", "invoice", "i"]].forEach(([k, type, pre]) => l[k].forEach((r) => { nodes.push({ id: pre + r.id, type, label: r.external_ref || `#${r.id}`, ref: r.external_ref }); links.push({ source: "l" + l.id, target: pre + r.id }); })); });
  d.assets.forEach((a) => { nodes.push({ id: "s" + a.id, type: "asset", label: a.name }); links.push({ source: "c", target: "s" + a.id, a: "case" }); });
  d.changes.forEach((x) => { nodes.push({ id: "h" + x.id, type: "change", label: x.description, ref: `変更#${x.id}` }); links.push({ source: x.line_id ? "l" + x.line_id : "c", target: "h" + x.id }); });
  d.flights.forEach((f) => { nodes.push({ id: "f" + f.id, type: "flight", label: f.channel }); links.push({ source: "l" + f.line_id, target: "f" + f.id }); if (f.creative_id) links.push({ source: "f" + f.id, target: "s" + f.creative_id }); });
  return { nodes, links };
}

A.v.case = async (id) => {
  const d = await api("/api/cases/" + id), c = d.case, stages = d.stages, cur = Math.max(0, stages.findIndex((s) => s.key === c.stage));
  let cs = A.state.cs;
  if (!cs || cs.id !== id) cs = A.state.cs = { id, stage: c.status === "completed" ? "measure" : c.stage, lens: ({ sales: "sales", production: "production", media: "media", finance: "finance", legal: "legal", analyst: "analyst" })[role()] || "all", last: c.stage };
  else if (cs.last !== c.stage) { cs.stage = c.stage; cs.last = c.stage; }
  cs.d = d;
  A.crumbs(h("a", { href: "#/cases" }, "案件"), c.name);
  const paint = () => {
    const sel = cs.stage, selIdx = stages.findIndex((s) => s.key === sel), g = CUSTOMER_GRAD[c.customer_id] || CUSTOMER_GRAD[1], s = d.summary, done = c.status === "completed";
    const bpf = h("div", { class: "bpf", role: "tablist", "aria-label": "ライフサイクルのステージ" }, stages.map((st, i) => h("button", { class: `bs ${done || i < cur ? "done" : i === cur ? "act" : ""} ${st.key === sel ? "sel" : ""}`, role: "tab", "aria-selected": st.key === sel, onclick: () => { cs.stage = st.key; A.noAnim = true; paint(); A.noAnim = false; } },
      h("span", { class: "n" }, h("i", {}, done || i < cur ? ic("check", 12) : i + 1), h("span", { class: "lb" }, st.label)), h("small", {}, DEPT[st.owner] + "が主担当"))));
    const hero = rv(h("section", { class: "chero", style: `--c1:${g[0]};--c2:${g[1]}` }, h("div", { class: "cmas big" }, custArt(c.customer_id, 120)),
      h("div", { class: "row" }, h("span", { class: "chip" }, done ? "完了" : `現在: ${stages[cur].label}`), A.ent(h("span", { class: "chip" }, d.customer.name), "customer", c.customer_id), h("span", { class: "sp" }), h("a", { class: "btn sm", href: `#/project/${c.id}`, style: "text-decoration:none;color:#fff" }, "プロジェクト管理"), h("span", { class: "chip" }, `例外 ${d.exceptions.filter((e) => e.status === "open").length}件`)),
      h("h1", { style: "margin-top:10px" }, c.name), h("div", { class: "meta" }, h("span", {}, `${c.start_date} 〜 ${c.end_date}`), h("span", {}, `担当: ${c.owner}`), h("span", {}, c.objective || "ブリーフ未入力")),
      h("div", { class: "stats" }, [["契約額", yen(s.contract_amount)], ["予算", yen(c.budget)], ["請求額", yen(s.invoiced_amount)], ["見込採算", yen(s.expected_margin) + (s.margin_complete ? "" : "（暫定）")]].map(([k, v]) => h("div", {}, h("b", {}, v), h("span", {}, k)))), bpf));

    const st = stages[selIdx], checks = d.checks[sel], state = done || selIdx < cur ? "done" : selIdx === cur ? "current" : "future";
    const okAll = checks.every((x) => x.ok), canAdv = c.status === "active" && state === "current" && (role() === "manager" || ({ plan: ["sales"], contract: ["sales"], produce: ["production"], review: ["legal", "sales"], deploy: ["media"], bill: ["finance"], measure: ["analyst"] })[sel].includes(role()));
    const tasksHere = d.tasks.filter((t) => t.stage === sel);
    const gate = rv(h("section", { class: "card" }, h("div", { class: "stagehead" }, h("div", {}, h("div", { class: "mut", style: "font-size:12px" }, `ステージ ${selIdx + 1} / ${stages.length}`), h("div", { class: "big" }, st.label)), h("span", { class: "sp" }),
        h("span", { class: "chip " + (state === "done" ? "good" : state === "current" ? "info" : "") }, state === "done" ? "完了済み" : state === "current" ? "進行中" : "未到達")),
      h("p", { class: "mut", style: "margin:6px 0 12px" }, st.desc), h("div", { class: "grid g2", style: "gap:0 24px" }, h("div", {}, h("h3", {}, "進行条件", h("small", {}, `${checks.filter((x) => x.ok).length}/${checks.length} 達成`)), checksBlock(checks)), h("div", {}, h("h3", {}, "このステージのタスク"), taskBlock(d, "all", sel))),
      h("div", { class: "row", style: "margin-top:14px" },
        h("button", { class: "btn accent", disabled: !canAdv, title: !canAdv ? (state === "current" ? "このステージの担当部署のみ進められます" : "現在のステージのみ進められます") : okAll ? "" : "未達の条件があります", onclick: () => act(() => api(`/api/cases/${c.id}/advance`, "POST", {}), selIdx === stages.length - 1 ? "案件を完了しました" : "次のステージへ進みました") }, selIdx === stages.length - 1 ? "案件を完了する" : "次のステージへ", ic("arrow", 16)),
        role() === "manager" && (c.status === "completed" || cur > 0) ? h("button", { class: "btn", onclick: () => form("前のステージへ差戻し", [{ name: "reason", label: "理由（必須）" }], (v) => api(`/api/cases/${c.id}/revert`, "POST", v), { ok: "差し戻しました" }) }, "差戻し（責任者）") : null,
        !okAll && state === "current" ? h("span", { class: "warn" }, "未達の条件を満たすと進められます") : null)), 2);

    const ws = rv(h("section", { class: "card" }, h("h3", {}, `${st.label}の作業領域`, h("small", {}, "同じデータを各部署が入力・編集します")), WS[sel](d)), 3);
    const lensBar = h("div", { class: "lens", role: "tablist", "aria-label": "部署の視点" }, LENSES.map(([k, t]) => h("button", { class: `${k === cs.lens ? "on" : ""} ${k === role() ? "me" : ""}`, role: "tab", onclick: () => { cs.lens = k; A.noAnim = true; paint(); A.noAnim = false; } }, t)));
    const lens = rv(h("aside", { class: "card" }, h("div", { class: "mut", style: "font-size:12px;margin-bottom:8px" }, "部署の視点（同じ案件データの切り口）"), lensBar, h("div", { style: "margin-top:14px" }, lensPanel(d, cs.lens)),
      cs.lens !== "all" ? h("div", { style: "margin-top:14px" }, h("h3", {}, `${DEPT[cs.lens]}のタスク`), taskBlock(d, cs.lens)) : null), 4);

    const map = h("div", { class: "chart" }); Promise.resolve().then(() => Charts.force(map, graphData(d), null));
    const chg = d.changes.length ? h("div", { class: "tscroll" }, h("table", {}, h("thead", {}, h("tr", {}, ["#", "内容", "金額 / 原価 / 納期", "状態", "操作"].map((t) => h("th", {}, t)))), h("tbody", {}, d.changes.map((x) => h("tr", {}, h("td", {}, x.id),
      h("td", {}, x.description, x.emergency ? h("span", { class: "warn" }, ` 緊急（事後承認期限 ${x.post_approval_due ? x.post_approval_due.slice(0, 10) : "-"}）`) : ""), h("td", { class: "nw" }, `${yen(x.amount_delta)} / ${yen(x.cost_delta)} / ${x.days_delta}日`), h("td", { class: "nw" }, h("span", { class: "chip " + (x.status === "approved" ? "good" : x.status === "pending" ? "medium" : "") }, STATUS[x.status]), x.executed_at ? " ・実行済" : ""),
      h("td", {}, h("div", { class: "row" },
        x.status === "pending" ? h("button", { class: "btn sm", disabled: !can("approve_change"), onclick: () => act(() => api(`/api/changes/${x.id}/approve`, "POST", {}), "承認しました") }, "承認") : null,
        x.status === "pending" ? h("button", { class: "btn sm", disabled: !can("approve_change"), onclick: () => act(() => api(`/api/changes/${x.id}/reject`, "POST", {}), "却下しました") }, "却下") : null,
        !x.executed_at && x.status !== "rejected" ? h("button", { class: "btn sm", disabled: !can("execute_change"), onclick: () => act(() => api(`/api/changes/${x.id}/execute`, "POST", {}), "実行を記録しました") }, "実行") : null))))))) : h("p", { class: "mut" }, "変更はありません。");
    const root = h("div", {}, hero, h("div", { class: "split", style: "margin-top:16px" }, h("div", { class: "grid", style: "align-content:start" }, gate, ws), lens),
      h("div", { class: "grid g2", style: "margin-top:16px" }, rv(h("section", { class: "card" }, h("h3", {}, "データのつながり", h("small", {}, "ドラッグ・ズームできます。ノードにホバーで関連を強調")), map), 5),
        rv(h("section", { class: "card" }, h("div", { class: "row" }, h("h3", { style: "margin:0" }, "変更管理"), h("span", { class: "sp" }), h("button", { class: "btn sm", disabled: !can("create_change") || c.status !== "active", onclick: () => A.newChange(d) }, ic("plus", 12), "変更を登録")), chg), 6)),
      h("div", { class: "sec" }, h("h2", {}, "この案件の例外")), rv(h("section", { class: "card" }, A.exceptionTable(d.exceptions.map((e) => ({ ...e, kind_label: KIND_LABEL[e.kind] })), false)), 7),
      h("div", { class: "sec" }, h("h2", {}, "時系列")), rv(h("section", { class: "card" }, h("ul", { class: "tl" }, d.timeline.map((e) => h("li", {}, `${e.at}  ${e.type}: ${e.line}`, e.ref ? h("span", { class: "mut" }, `  [${e.ref}]`) : "")))), 8));
    A.mount(root);
  };
  paint();
};


