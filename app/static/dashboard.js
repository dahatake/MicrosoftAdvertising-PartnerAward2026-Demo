"use strict";
/* Dashboard, case portfolio, creative gallery, exception queue and audit views. */
const KIND_LABEL = {
  UNBILLED: "検収済み未請求", INVOICE_BEFORE_ACCEPTANCE: "検収前請求", OVERBILLED: "契約額超過請求", DUPLICATE_INVOICE: "重複請求の疑い",
  ACCEPT_EXCEEDS_DELIVERY: "納品数量超過の検収", COST_OVERRUN: "原価超過", UNAPPROVED_CHANGE: "未承認変更の実行",
  EMERGENCY_APPROVAL_OVERDUE: "緊急変更の事後承認期限超過", UNAPPROVED_ASSET_USED: "未承認素材の使用", RIGHTS_EXPIRY: "権利期限の超過・不足", UNORDERED: "原価見込みに対する発注なし",
};
A.crumbs = (...parts) => $("#crumbs").replaceChildren(...parts.flatMap((p, i) => [i ? ic("chevR", 14) : null, typeof p === "string" ? (i === parts.length - 1 ? h("b", {}, p) : h("span", {}, p)) : p]).filter(Boolean));
const stageLabel = (stages, key) => (stages.find((s) => s.key === key) || {}).label || key;
const rv = (el, i = 0) => { if (A.noAnim) return el; el.classList.add("rv"); el.style.setProperty("--i", i); return el; };
const kpiTile = (k, v, s, i, fmt) => { const val = h("div", { class: "v" }, "0"); const t = rv(h("div", { class: "card kpi" }, h("div", { class: "k" }, k), val, h("div", { class: "s" }, s)), i); if (typeof v === "number") countUp(val, v, fmt || num); else val.textContent = v; return t; };

A.v.dashboard = async () => {
  const [d, focus, cu, pr] = await Promise.all([api("/api/dashboard"), api("/api/ops/focus"), api("/api/customers"), api("/api/products")]), k = d.kpis, p = d.portfolio, me = A.state.me;
  A.state.focus = focus;
  const brands = rv(h("section", { class: "card brands" }, h("h3", {}, "顧客と商材", h("small", {}, "広告主と、案件で扱う商材のラインアップ")),
    h("div", { class: "bgrid" }, cu.customers.map((c) => A.ent(h("div", { class: "bi", "data-tilt": "" }, custArt(c.id, 76), h("b", {}, c.name), h("span", { class: "mut" }, c.brand_group)), "customer", c.id)),
      pr.products.map((x) => A.ent(h("div", { class: "bi", "data-tilt": "" }, Art.product(x.id, 68, x.name), h("b", {}, x.name), h("span", { class: "mut" }, x.acceptance_rule)), "product", x.id)))), 2);
  A.crumbs("ホーム");
  const active = Object.values(p.stages).reduce((a, b) => a + b, 0), sum = (key) => p.daily.reduce((a, r) => a + r[key], 0);
  const wave = document.createElementNS("http://www.w3.org/2000/svg", "svg"); wave.setAttribute("class", "wave");
  const hero = rv(h("section", { class: "hero" }, wave,
    h("div", { class: "chip" }, `${A.state.me.role_label} の視点`),
    h("h1", { style: "margin-top:10px" }, `こんにちは、${me.user.name.replace(/[（(].*[）)]/, "").trim().split(" ").pop()}さん`),
    h("p", {}, "企画から展開・効果測定まで、広告作品のライフサイクルを部署をまたいで一つのデータで見渡します。"),
    h("div", { class: "row" }, h("a", { class: "btn solid", href: "#/cases", style: "text-decoration:none" }, "案件を開く", ic("arrow", 16)), h("a", { class: "btn", href: "#/creatives", style: "text-decoration:none" }, ic("play", 14), "広告作品を見る"))));
  const kpis = h("div", { class: "kpis" },
    kpiTile("稼働中の案件", active, "ライフサイクル進行中", 1),
    kpiTile("累計インプレッション", sum("impressions"), "媒体指標（参考）", 2),
    kpiTile("累計コンバージョン", sum("conversions"), "広告主提供の成果（因果ではありません）", 3),
    kpiTile("追跡率", k.trace_rate.value == null ? "—" : k.trace_rate.value * 100, `${k.trace_rate.linked}/${k.trace_rate.required} 工程 · 提案目標95%`, 4, (v) => v.toFixed(1) + "%"),
    kpiTile("変更承認遵守率", k.change_compliance.value == null ? "—" : k.change_compliance.value * 100, `${k.change_compliance.compliant}/${k.change_compliance.executed} 件 · 提案目標95%`, 5, (v) => v.toFixed(1) + "%"),
    kpiTile("未対応の例外", k.exceptions_open, `高 ${k.exceptions_by_severity.high} / 中 ${k.exceptions_by_severity.medium} / 低 ${k.exceptions_by_severity.low}`, 6));

  const pipe = h("div", { class: "chart" });
  const pipeCard = rv(h("section", { class: "card" }, h("h3", {}, "ライフサイクル・パイプライン", h("small", {}, "ステージをクリックで案件を絞り込み")), pipe), 3);

  const METRICS = { impressions: ["インプレッション", num, "#4da3ff"], clicks: ["クリック", num, "#8b6cff"], conversions: ["コンバージョン", num, "#2dd4bf"], spend: ["広告費", yen, "#f59e0b"] };
  const trendWrap = h("div"), metricSeg = h("div", { class: "seg" });
  let metric = "impressions";
  const drawTrend = () => {
    const [lab, fmt, color] = METRICS[metric], box = h("div", { class: "chart" });
    trendWrap.replaceChildren(box);
    Charts.trend(box, p.daily.map((r) => ({ day: r.day, v: r[metric] })), { fmt, color, label: lab });
    [...metricSeg.children].forEach((b) => b.classList.toggle("on", b.dataset.k === metric));
  };
  Object.entries(METRICS).forEach(([key, m]) => metricSeg.append(h("button", { "data-k": key, onclick: () => { metric = key; drawTrend(); } }, m[0])));
  const trendCard = rv(h("section", { class: "card" }, h("div", { class: "row" }, h("h3", { style: "margin:0" }, "配信パフォーマンス", h("small", {}, "日次 · 破線は7日平均")), h("span", { class: "sp" }), metricSeg), trendWrap), 4);

  const kinds = d3.rollups(p.exceptions, (v) => d3.sum(v, (x) => x.n), (x) => x.kind).map(([kind, n]) => ({ label: KIND_LABEL[kind] || kind, value: n }));
  kinds.sort((a, b) => b.value - a.value).forEach((x, i) => (x.color = PAL[i % PAL.length]));
  const donut = h("div", { class: "chart" });
  const exCard = rv(h("section", { class: "card" }, h("h3", {}, "例外の内訳", h("small", {}, "ホバーで詳細")), donut), 5);

  const fin = h("div", { class: "chart" });
  const finCard = rv(h("section", { class: "card" }, h("h3", {}, "案件別の契約・原価・請求"), fin,
    h("div", { class: "legend" }, [["契約額", "#4da3ff"], ["発注（原価）", "#f59e0b"], ["請求額", "#34d399"]].map(([t, c]) => h("span", {}, h("i", { style: `background:${c}` }), t)))), 6);
  const gantt = h("div", { class: "chart", id: "gdash" });
  const ganCard = rv(h("section", { class: "card" }, h("h3", {}, "配信カレンダー", h("small", {}, "全案件の配信計画")), gantt), 7);

  const strip = h("div", { class: "crgrid" }, A.state.creatives.slice(0, 4).map((c, i) => rv(h("div", { class: "card crd lift" },
    thumb(c.key, () => openViewer(A.state.creatives, i), c.title), h("div", { class: "tt" }, c.title), h("div", { class: "row" }, h("span", { class: "chip" }, KINDS[c.kind]), h("span", { class: "mut" }, c.size))), 8 + i)));

  const exTable = d.top_exceptions.length ? A.exceptionTable(d.top_exceptions, false, true) : h("p", { class: "empty" }, "未対応の例外はありません。");

  A.mount(h("div", {}, rv(A.focusBanner(focus), 0), h("div", { style: "height:16px" }), hero, kpis, h("div", { style: "height:16px" }), brands, h("div", { class: "sec" }, h("h2", {}, "全体像")), pipeCard,
    h("div", { class: "grid g2", style: "margin-top:16px" }, trendCard, exCard), h("div", { class: "grid g2", style: "margin-top:16px" }, finCard, ganCard),
    h("div", { class: "sec" }, h("h2", {}, "広告作品"), h("a", { href: "#/creatives", class: "mut" }, "すべて見る →")), strip,
    h("div", { class: "sec" }, h("h2", {}, "優先して対応する例外")), rv(h("section", { class: "card" }, exTable), 12)));
  Charts.wave(wave);
  Charts.pipeline(pipe, d.stages, p.stages, (key) => { A.state.stage = key; location.hash = "#/cases"; });
  drawTrend();
  Charts.donut(donut, kinds, "件");
  Charts.bars(fin, p.finance.map((f) => ({ ent: "case:" + f.id, label: f.name, series: [{ k: "契約額", v: f.contract, color: "#4da3ff" }, { k: "発注（原価）", v: f.cost, color: "#f59e0b" }, { k: "請求額", v: f.invoiced, color: "#34d399" }] })));
  Charts.gantt(gantt, p.flights, { showCase: true });
};

A.v.cases = async () => {
  const { cases, stages } = await api("/api/cases");
  A.crumbs("案件");
  const filter = A.state.stage || "all";
  const seg = h("div", { class: "seg" }, [["all", "すべて"], ...stages.map((s) => [s.key, s.label])].map(([k, t]) => h("button", { class: k === filter ? "on" : "", onclick: () => { A.state.stage = k === "all" ? null : k; A.render(); } }, t)));
  const list = cases.filter((c) => filter === "all" || c.stage === filter);
  const idx = (c) => stages.findIndex((s) => s.key === c.stage);
  const cards = list.map((c, i) => rv(A.ent(h("article", { class: "card cc lift", tabindex: 0, onkeydown: (e) => { if (e.key === "Enter") location.hash = `#/case/${c.id}`; } },
    h("div", { class: "row" }, h("span", { class: "cmas" }, A.ent(h("span", { class: "cmas" }, custArt(c.customer_id, 38)), "customer", c.customer_id)), h("span", { class: "chip info" }, c.status === "completed" ? "完了" : stageLabel(stages, c.stage)), h("span", { class: "mut" }, c.customer_name), h("span", { class: "sp" }), c.open_exceptions ? h("span", { class: "chip high" }, `例外 ${c.open_exceptions}`) : h("span", { class: "chip good" }, "例外なし")),
    h("div", { class: "tt" }, c.name),
    h("div", { class: "mut", style: "font-size:12px" }, c.objective || "ブリーフ未入力"),
    h("div", { class: "dots", title: "ライフサイクルの進行" }, stages.map((s, j) => h("i", { class: c.status === "completed" || j < idx(c) ? "d" : j === idx(c) ? "a" : "" }))),
    h("div", { class: "row minis" }, c.assets.length ? c.assets.map((a) => h("span", { class: "chip", title: a.name }, KINDS[a.kind] || a.kind)) : h("span", { class: "mut", style: "font-size:12px" }, "広告作品は未登録")),
    h("div", { class: "nums" }, h("div", {}, h("b", {}, yenM(c.summary.contract_amount)), h("span", {}, "契約額")), h("div", {}, h("b", {}, yenM(c.summary.invoiced_amount)), h("span", {}, "請求額")),
      h("div", {}, h("b", {}, yenM(c.budget)), h("span", {}, "予算")),       h("div", {}, h("b", {}, c.summary.margin_complete ? yenM(c.summary.expected_margin) : yenM(c.summary.expected_margin) + "（暫定）"), h("span", {}, "見込採算")))), "case", c.id), i));
  A.mount(h("div", {}, h("div", { class: "row" }, h("h2", { style: "font-size:24px" }, "案件ポートフォリオ"), h("span", { class: "sp" }), seg),
    h("p", { class: "mut", style: "margin:6px 0 16px" }, "カードを開くと、企画から効果測定までのワークフローを部署の視点で確認・編集できます。"),
    cards.length ? h("div", { class: "grid g3" }, cards) : h("div", { class: "card empty" }, "該当する案件がありません。")));
};

A.newCase = async () => {
  const { customers } = await api("/api/customers"), today = new Date(), iso = (d) => d.toISOString().slice(0, 10), later = new Date(today.getTime() + 60 * 864e5);
  form("新規案件を作成（企画・提案ステージから開始）", [
    { name: "customer_id", label: "顧客", type: "select", options: customers.map((c) => [c.id, c.name]) },
    { name: "name", label: "案件名" }, { name: "objective", label: "目的", type: "textarea" }, { name: "target", label: "ターゲット" },
    { name: "budget", label: "予算（円）", type: "number", value: 0, min: 0 }, { name: "kpi_name", label: "KPI名（例: 試乗予約）" }, { name: "kpi_target", label: "KPI目標値", type: "number", min: 0 },
    { name: "start_date", label: "開始日", type: "date", value: iso(today) }, { name: "end_date", label: "終了日", type: "date", value: iso(later) }],
  async (v) => { const r = await api("/api/cases", "POST", { ...v, customer_id: Number(v.customer_id) }); location.hash = `#/case/${r.id}`; },
  { submit: "作成して開く", ok: "案件を作成しました", intro: "ブリーフ・契約・制作・審査・展開・請求・効果測定の7ステージで進めます。" });
};

A.v.creatives = async () => {
  const { cases } = await api("/api/cases"), cats = A.state.creatives; A.crumbs("広告作品");
  const used = (key) => cases.filter((c) => c.assets.some((a) => a.sample_key === key));
  let kind = "all";
  const grid = h("div", { class: "crgrid" }), seg = h("div", { class: "seg" });
  const draw = () => {
    const list = cats.filter((c) => kind === "all" || c.kind === kind);
    grid.replaceChildren(...list.map((c, i) => rv(h("article", { class: "card crd lift" }, thumb(c.key, () => openViewer(list, i), c.title),
      h("div", { class: "row" }, h("span", { class: "chip" }, KINDS[c.kind]), h("span", { class: "mut" }, c.size)), h("div", { class: "tt" }, c.title), h("div", { class: "mut", style: "font-size:12px" }, c.desc),
      h("div", { class: "row" }, used(c.key).map((cs) => A.ent(h("a", { class: "chip info", href: `#/case/${cs.id}`, style: "text-decoration:none" }, cs.name.slice(0, 12)), "case", cs.id)), used(c.key).length ? null : h("span", { class: "mut" }, "未使用")),
      h("button", { class: "btn sm", onclick: () => openViewer(list, i) }, ic("play", 14), "全画面で見る")), i)));
    [...seg.children].forEach((b) => b.classList.toggle("on", b.dataset.k === kind));
  };
  [["all", "すべて"], ...Object.entries(KINDS).filter(([k]) => cats.some((c) => c.kind === k))].forEach(([k, t]) => seg.append(h("button", { "data-k": k, onclick: () => { kind = k; draw(); } }, t)));
  A.mount(h("div", {}, h("div", { class: "row" }, h("h2", { style: "font-size:24px" }, "広告作品ギャラリー"), h("span", { class: "sp" }), seg),
    h("p", { class: "mut", style: "margin:6px 0 16px" }, "Web・動画・画像・ソーシャル・インタラクティブの5種類の架空キャンペーン作品（HTML5）。サムネイルも実際に動いています。"), grid));
  draw();
};

A.exceptionTable = (list, showCase, compact) => {
  if (!list.length) return h("p", { class: "empty" }, "例外はありません。");
  const lbl = (e) => e.kind_label || KIND_LABEL[e.kind] || e.kind;
  return h("div", { class: "tscroll" }, h("table", {}, h("thead", {}, h("tr", {}, ["重要度", "種別", "内容", "担当", "期限", compact ? "" : "状態", compact ? "" : "操作"].map((t) => h("th", {}, t)))),
    h("tbody", {}, list.map((e) => A.ent(h("tr", { class: "click" },
      h("td", { class: "nw" }, sev(e.severity)), h("td", { class: "nw" }, lbl(e)), h("td", {}, showCase && e.case_name ? A.ent(h("div", { class: "mut" }, e.case_name), "case", e.case_id) : null, e.detail, e.resolution ? h("div", { class: "mut" }, e.resolution) : null),
      A.ent(h("td", { class: "nw" }, DEPT[e.owner] || e.owner), DEPT[e.owner] ? "team" : "exception", DEPT[e.owner] ? e.owner : e.id), h("td", { class: "nw" }, e.due, e.overdue ? h("span", { class: "bad" }, " 超過") : ""),
      compact ? h("td") : h("td", { class: "nw" }, STATUS[e.status]),
      compact ? h("td") : h("td", {}, e.status === "open" ? h("div", { class: "row" },
        h("button", { class: "btn sm", disabled: !can("resolve_exception"), onclick: () => form("対応メモ", [{ name: "reason", label: "メモ" }], (v) => api(`/api/exceptions/${e.id}/resolve`, "POST", v)) }, "メモ"),
        h("button", { class: "btn sm", disabled: !can("accept_exception"), onclick: () => form("差異を承認（理由必須）", [{ name: "reason", label: "理由" }], (v) => api(`/api/exceptions/${e.id}/accept`, "POST", v)) }, "差異承認")) : null)), "exception", e.id)))));
};

A.v.exceptions = async () => {
  const { exceptions } = await api("/api/exceptions?status=all"); A.crumbs("例外キュー");
  let filter = "open"; const box = h("div"), seg = h("div", { class: "seg" });
  const draw = () => { box.replaceChildren(A.exceptionTable(exceptions.filter((e) => filter === "all" || e.status === filter), true)); [...seg.children].forEach((b) => b.classList.toggle("on", b.dataset.k === filter)); };
  [["open", "未対応"], ["accepted", "差異承認"], ["resolved", "解決"], ["all", "すべて"]].forEach(([k, t]) => seg.append(h("button", { "data-k": k, onclick: () => { filter = k; draw(); } }, t)));
  A.mount(h("div", {}, h("div", { class: "row" }, h("h2", { style: "font-size:24px" }, "例外キュー"), h("span", { class: "sp" }), seg,
    h("button", { class: "btn", disabled: !can("reconcile"), onclick: () => act(async () => { const r = await api("/api/reconcile", "POST", {}); toast(`照合完了: 新規${r.created}件 / 自動解決${r.auto_resolved}件`); }) }, "照合を実行")),
    h("p", { class: "note info", style: "margin:12px 0" }, "条件が解消された例外は照合時に自動解決されます。「メモ」は対応記録であり、状態は変えません。"), rv(h("section", { class: "card" }, box), 1)));
  draw();
};

A.v.audit = async () => {
  A.crumbs("監査ログ");
  if (!can("read_audit")) return A.mount(h("div", { class: "card empty bad" }, "監査ログを閲覧する権限がありません（監査・業務責任者・法務）。"));
  const { audit } = await api("/api/audit");
  A.mount(h("div", {}, h("h2", { style: "font-size:24px;margin-bottom:12px" }, "監査ログ（直近200件）"), rv(h("section", { class: "card tscroll" }, h("table", {}, h("thead", {}, h("tr", {}, ["日時", "ユーザー", "操作", "対象", "詳細"].map((t) => h("th", {}, t)))),
    h("tbody", {}, audit.map((a) => h("tr", {}, h("td", {}, a.ts.replace("T", " ")), h("td", {}, a.user_id), h("td", {}, a.action), (["case", "decision", "asset", "exception"].includes(a.entity) ? A.ent(h("td", {}, `${a.entity} ${a.entity_id ?? ""}`), a.entity, a.entity_id) : h("td", {}, `${a.entity} ${a.entity_id ?? ""}`)), h("td", {}, a.detail)))))), 1)));
};


