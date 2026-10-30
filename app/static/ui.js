"use strict";
/* Core helpers: DOM builder, API, icons, dialogs, toasts, tooltip, creative thumbnails and the immersive viewer. */
const A = (window.A = { state: { user: sessionStorage.getItem("user"), me: null, creatives: [], theme: null, lang: localStorage.getItem("lang") === "en" ? "en" : "ja" }, v: {} });
const $ = (s, r = document) => r.querySelector(s);

/* ---- i18n: Japanese strings are the keys; English comes from /api/i18n (same dictionary the server uses) ---- */
const CJK = /[\u3000-\u9fff\uff00-\uffef]/;
const I18N = { exact: new Map(), tpl: [] };
const PH = /\{(\d+)\}/;
function loadDict(map) {
  I18N.exact.clear(); I18N.tpl = [];
  for (const [ja, en] of Object.entries(map)) {
    if (PH.test(ja)) {
      const lit = ja.split(/\{\d+\}/), rx = new RegExp("^" + lit.map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("(.+?)") + "$", "s");
      I18N.tpl.push([lit.join("").length, rx, en]);
    } else I18N.exact.set(ja, en);
  }
  I18N.tpl.sort((a, b) => b[0] - a[0]);
}
function trCore(core) {
  if (I18N.exact.has(core)) return I18N.exact.get(core);
  for (const [, rx, en] of I18N.tpl) {
    const m = rx.exec(core);
    if (m) { const g = m.slice(1).map(tr); return en.replace(/\{(\d+)\}/g, (_, i) => g[i - 1]); }
  }
  for (const sep of [" / ", "、"]) {
    if (core.includes(sep)) {
      const parts = core.split(sep).map((p) => (CJK.test(p) ? trCore(p.trim()) : p));
      if (parts.every((p) => p != null)) return parts.join(sep === " / " ? " / " : ", ");
    }
  }
  return null;
}
function tr(s) {
  if (A.state.lang !== "en" || typeof s !== "string" || !CJK.test(s)) return s;
  const core = s.trim(), out = trCore(core);
  if (out == null) return s;
  return s.slice(0, s.length - s.trimStart().length) + out + s.slice(s.trimEnd().length);
}
const locale = () => (A.state.lang === "en" ? "en-US" : "ja-JP");
/* translate text nodes and common attributes already in the DOM (used for the shell and tooltips) */
function trDom(root) {
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let n = w.nextNode(); n; n = w.nextNode()) n.nodeValue = tr(n.nodeValue);
  root.querySelectorAll("[title],[aria-label],[placeholder]").forEach((e) => ["title", "aria-label", "placeholder"].forEach((a) => e.hasAttribute(a) && e.setAttribute(a, tr(e.getAttribute(a)))));
}

function h(tag, attrs, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (k === "class") el.className = v;
    else if (k === "style") el.style.cssText = v; // CSSOM: allowed by CSP (setAttribute("style") is not)
    else if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
    else if (v === true) el.setAttribute(k, "");
    else if (v !== false && v != null) el.setAttribute(k, k === "title" || k === "aria-label" || k === "placeholder" ? tr(String(v)) : v);
  }
  for (const kid of kids.flat(Infinity)) if (kid != null && kid !== false) el.append(kid.nodeType ? kid : document.createTextNode(tr(String(kid))));
  return el;
}
const yen = (n) => "¥" + Math.round(n || 0).toLocaleString(locale());
const yenM = (n) => (Math.abs(n) >= 1e9 ? "¥" + (n / 1e9).toFixed(1) + "B" : Math.abs(n) >= 1e6 ? "¥" + (n / 1e6).toFixed(1) + "M" : yen(n));
const num = (n) => Math.round(n || 0).toLocaleString(locale());
const pct = (v) => (v == null ? "—" : (v * 100).toFixed(1) + "%");
const can = (p) => !!(A.state.me && A.state.me.perms.includes(p));
const role = () => (A.state.me ? A.state.me.user.role : "");

const ICONS = {
  home: "M4 11l8-7 8 7v9a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1z",
  cases: "M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z",
  creative: "M4 5h16v14H4zM10 9l5 3-5 3z",
  alert: "M12 3l10 18H2zM12 10v5M12 18v.5",
  shield: "M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6zM9 12l2 2 4-4",
  plus: "M12 5v14M5 12h14",
  sun: "M12 8a4 4 0 100 8 4 4 0 000-8zM12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.4 1.4M17.6 17.6L19 19M5 19l1.4-1.4M17.6 6.4L19 5",
  moon: "M20 14A8 8 0 0110 4a8 8 0 1010 10z",
  close: "M6 6l12 12M18 6L6 18",
  check: "M5 12l5 5 9-10",
  chevR: "M9 5l7 7-7 7",
  chevL: "M15 5l-7 7 7 7",
  desktop: "M3 5h18v11H3zM8 20h8M12 16v4",
  tablet: "M6 3h12a1 1 0 011 1v16a1 1 0 01-1 1H6a1 1 0 01-1-1V4a1 1 0 011-1zM11 18h2",
  phone: "M8 3h8a1 1 0 011 1v16a1 1 0 01-1 1H8a1 1 0 01-1-1V4a1 1 0 011-1zM11 18h2",
  play: "M7 4l13 8-13 8z",
  back: "M15 5l-7 7 7 7",
  arrow: "M5 12h14M13 6l6 6-6 6",
  tasks: "M9 6h11M9 12h11M9 18h11M4 6l1 1 2-2M4 12l1 1 2-2M4 18l1 1 2-2",
  resources: "M9 11a3.2 3.2 0 100-6.4 3.2 3.2 0 000 6.4zM3 20v-1.5a5 5 0 0112 0V20M16.5 5a3 3 0 010 6M18 14.5a4.6 4.6 0 013.5 4.5V20",
  ai: "M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 15.5l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z",
  bolt: "M13 2L4 14h7l-1 8 9-12h-7z",
  clock: "M12 3a9 9 0 100 18 9 9 0 000-18zM12 7v5l3 2",
  table: "M3 5h18v14H3zM3 10h18M9 5v14",
  gantt: "M4 6h8M8 12h12M6 18h9",
  heat: "M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z",
  flow: "M3 6c8 0 8 6 18 6M3 18c8 0 8-6 18-6M3 12h4",
  vendor: "M4 21V8l8-5 8 5v13zM9 21v-6h6v6M9 10h.01M15 10h.01",
  studio: "M3 9h18v11H3zM3 9l3-5h4L7 9M12 9l3-5h4l-3 5",
  equipment: "M3 7h12v10H3zM15 11l6-3.5v9L15 13z",
  person: "M12 12a4 4 0 100-8 4 4 0 000 8zM4 21a8 8 0 0116 0",
  vol: "M4 9v6h4l5 4V5L8 9zM16.5 9a4 4 0 010 6M19 6.5a8 8 0 010 11",
  mute: "M4 9v6h4l5 4V5L8 9zM17 9.5l5 5M22 9.5l-5 5",
  music: "M9 18V5l11-2v13M6 21a3 3 0 100-6 3 3 0 000 6zM17 19a3 3 0 100-6 3 3 0 000 6z",
  target: "M12 3a9 9 0 100 18 9 9 0 000-18zM12 7.5a4.5 4.5 0 100 9 4.5 4.5 0 000-9zM12 11.5v1",
  flag: "M5 21V4M5 4h12l-2 4 2 4H5",
  pause: "M8 5v14M16 5v14",
  rocket: "M12 2c4 3 5 8 3 13H9c-2-5-1-10 3-13zM9 15l-3 3 .5-4.5M15 15l3 3-.5-4.5M12 8.5a1.2 1.2 0 100 2.4 1.2 1.2 0 000-2.4zM10.5 18c.5 2 .8 3 1.5 4 .7-1 1-2 1.5-4",
  gauge: "M4 16a8 8 0 1116 0M12 16l4-5M7 16h.01M17 16h.01M12 8v.01",
  sparkle: "M12 2l1.5 6.5L20 10l-6.5 1.5L12 18l-1.5-6.5L4 10l6.5-1.5z",
  warn: "M12 3l10 18H2zM12 10v5M12 18v.5",
  skip: "M5 5l9 7-9 7zM17 5v14",
};
function ic(name, size = 18) {
  const s = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  s.setAttribute("viewBox", "0 0 24 24"); s.setAttribute("width", size); s.setAttribute("height", size); s.setAttribute("class", "ic"); s.setAttribute("aria-hidden", "true");
  const p = document.createElementNS("http://www.w3.org/2000/svg", "path"); p.setAttribute("d", ICONS[name]); s.append(p);
  return s;
}

const SEV = { high: "高", medium: "中", low: "低" };
const STATUS = { pending: "承認待ち", approved: "承認済み", rejected: "却下済み", open: "未対応", resolved: "解決", accepted: "差異承認", planned: "計画", live: "配信中", done: "完了", todo: "未着手", doing: "進行中" };
const KINDS = { web: "Webサイト", video: "動画", image: "画像バナー", social: "ソーシャル", interactive: "インタラクティブ", audio: "音声", other: "その他" };
const DEPT = { sales: "営業", media: "媒体・運用", production: "制作", finance: "経理", legal: "法務", analyst: "分析" };
const sev = (s) => h("span", { class: "chip " + s }, SEV[s] || s);

async function api(path, method = "GET", body) {
  const res = await fetch(path, {
    method, headers: { "X-User": A.state.user || "", "X-Lang": A.state.lang, ...(body !== undefined ? { "Content-Type": "application/json" } : {}) },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `エラー (${res.status})`);
  return data;
}

function toast(msg, kind) {
  const t = h("div", { class: "toast " + (kind === "err" ? "err" : "") }, msg);
  $("#toasts").append(t);
  setTimeout(() => t.remove(), kind === "err" ? 6000 : 3200);
}
async function act(fn, okMsg) {
  try { await fn(); if (okMsg) toast(okMsg); await A.render(); } catch (e) { toast(e.message, "err"); }
}

function form(title, fields, onSubmit, opts = {}) {
  const dlg = $("#dlg"), f = $("#dlgForm");
  f.className = "stack"; f.replaceChildren(h("h3", { style: "font-size:18px;margin:0 0 6px" }, title));
  if (opts.intro) f.append(h("p", { class: "mut" }, opts.intro));
  const inputs = {};
  for (const fd of fields) {
    let input;
    if (fd.type === "select") input = h("select", {}, fd.options.map((o) => h("option", { value: o[0] }, o[1])));
    else if (fd.type === "textarea") input = h("textarea", { rows: 3, maxlength: fd.max || 300 });
    else input = h("input", { type: fd.type || "text", step: fd.step, min: fd.min, maxlength: fd.type ? null : 200, placeholder: fd.ph });
    if (fd.type === "checkbox") input.checked = !!fd.value; else if (fd.value != null) input.value = fd.value;
    inputs[fd.name] = input;
    f.append(h("label", {}, fd.label), input);
  }
  const out = h("div", { class: "note info", style: "display:none;margin-top:10px" });
  f.append(out);
  const values = () => Object.fromEntries(fields.map((fd) => {
    const el = inputs[fd.name]; let v = fd.type === "checkbox" ? el.checked : el.value;
    if (fd.type === "number") v = v === "" ? undefined : Number(v);
    if (fd.type === "date" && v === "") v = undefined;
    return [fd.name, v];
  }));
  const btns = [h("button", { class: "btn accent", type: "submit" }, opts.submit || "実行"), h("button", { class: "btn", type: "button", onclick: () => dlg.close() }, "キャンセル")];
  if (opts.extra) btns.unshift(h("button", { class: "btn", type: "button", onclick: () => opts.extra.run(values(), out) }, opts.extra.label));
  f.append(h("div", { class: "row", style: "margin-top:16px" }, btns));
  f.onsubmit = (e) => { e.preventDefault(); dlg.close(); act(() => onSubmit(values()), opts.ok || "保存しました"); };
  dlg.showModal();
}

/* tooltip */
const tipEl = () => $("#tip");
A.tip = {
  show(html, ev) { const t = tipEl(); t.replaceChildren(...(Array.isArray(html) ? html : [html]).map((x) => (typeof x === "string" ? document.createTextNode(x) : x))); trDom(t); t.classList.add("on"); A.tip.move(ev); },
  move(ev) { const t = tipEl(); const w = t.offsetWidth, hh = t.offsetHeight; let x = ev.clientX + 14, y = ev.clientY + 14; if (x + w > innerWidth - 8) x = ev.clientX - w - 14; if (y + hh > innerHeight - 8) y = ev.clientY - hh - 14; t.style.left = x + "px"; t.style.top = y + "px"; },
  hide() { tipEl().classList.remove("on"); },
};

/* cursor-following glow on cards (Fluent "reveal") */
document.addEventListener("pointermove", (e) => {
  const c = e.target.closest && e.target.closest(".card");
  if (c) { const r = c.getBoundingClientRect(); c.style.setProperty("--mx", e.clientX - r.left + "px"); c.style.setProperty("--my", e.clientY - r.top + "px"); }
});

/* creative thumbnails: live, sandboxed, scaled iframes */
const creativeBy = (key) => A.state.creatives.find((c) => c.key === key);
const ro = new ResizeObserver((es) => es.forEach((e) => { const f = e.target.firstChild; if (f && f.tagName === "IFRAME") f.style.transform = `scale(${e.contentRect.width / 1280})`; }));
const langQ = () => `lang=${A.state.lang}`;
function thumb(key, onOpen, label) {
  const box = h("div", { class: "thumb", role: "button", tabindex: "0", "aria-label": (label || "作品") + "をプレビュー", onclick: onOpen, onkeydown: (e) => { if (e.key === "Enter") onOpen(); } },
    h("iframe", { src: `/creatives/${key}.html?thumb=1&${langQ()}`, sandbox: "allow-scripts", loading: "lazy", tabindex: "-1", title: label || key }),
    h("div", { class: "play" }, h("span", {}, ic("play", 14), "全画面プレビュー")));
  requestAnimationFrame(() => ro.observe(box));
  return box;
}

/* immersive viewer */
const DEVICES = { desktop: [1280, 800, "desktop", "PC"], tablet: [820, 1100, "tablet", "タブレット"], phone: [390, 780, "phone", "スマホ"] };
function openViewer(items, index = 0, startDevice = "desktop") {
  const v = $("#viewer"); let i = index, dev = startDevice;
  const close = () => { v.hidden = true; v.replaceChildren(); document.removeEventListener("keydown", key); removeEventListener("resize", fit); };
  const key = (e) => { if (e.key === "Escape") close(); else if (e.key === "ArrowRight") go(1); else if (e.key === "ArrowLeft") go(-1); };
  const stage = h("div", { class: "stage" }), side = h("aside");
  const frame = h("div", { class: "dev" }), ifr = h("iframe", { sandbox: "allow-scripts", title: "作品プレビュー" });
  frame.append(ifr); stage.append(frame);
  const seg = h("div", { class: "seg" }, Object.entries(DEVICES).map(([k, d]) => h("button", { "data-d": k, onclick: () => { dev = k; fit(); mark(); } }, ic(d[2], 14), " ", d[3])));
  const mark = () => [...seg.children].forEach((b) => b.classList.toggle("on", b.dataset.d === dev));
  stage.append(h("div", { class: "vt" }, h("button", { class: "btn icon", "aria-label": "閉じる", onclick: close }, ic("close")), seg, h("span", { class: "sp" }),
    h("button", { class: "btn icon", "aria-label": "前へ", onclick: () => go(-1) }, ic("chevL")), h("button", { class: "btn icon", "aria-label": "次へ", onclick: () => go(1) }, ic("chevR"))));
  function fit() {
    const [w, hh] = DEVICES[dev], aw = stage.clientWidth - 48, ah = stage.clientHeight - 80, s = Math.min(1, aw / w, ah / hh);
    frame.style.width = w * s + "px"; frame.style.height = hh * s + "px"; ifr.style.width = w + "px"; ifr.style.height = hh + "px"; ifr.style.transform = `scale(${s})`;
  }
  function show() {
    const it = items[i], c = creativeBy(it.key) || {};
    ifr.src = `/creatives/${it.key}.html?${langQ()}`;
    side.replaceChildren(...[h("span", { class: "chip" }, KINDS[it.kind || c.kind] || ""), h("h3", {}, it.title || c.title), h("p", {}, it.sub || c.brand || ""), h("p", {}, c.desc || ""),
      h("p", {}, "サイズ: ", c.size || "—"), it.status ? h("p", {}, "状態: ", it.status) : null,
      h("p", { style: "font-size:12px;opacity:.7;margin-top:18px" }, "※ 架空ブランドのデモ作品です。サンドボックス内で実行され、外部通信は行いません。"),
      h("p", { style: "font-size:12px;opacity:.7" }, `${i + 1} / ${items.length}  ·  ← → で切替、Esc で閉じる`)].filter(Boolean));
  }
  function go(d) { i = (i + d + items.length) % items.length; show(); }
  v.replaceChildren(stage, side); v.hidden = false; show(); mark();
  requestAnimationFrame(fit); addEventListener("resize", fit); document.addEventListener("keydown", key);
}

function countUp(el, to, fmt = num) {
  const from = 0, t0 = performance.now(), dur = 900;
  (function f(t) { const k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 3); el.textContent = fmt(from + (to - from) * e); if (k < 1) requestAnimationFrame(f); })(t0);
}
