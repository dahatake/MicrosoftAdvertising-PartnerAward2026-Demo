"use strict";
const NAV = [["dashboard", "ホーム", "home", 215], ["analytics", "分析ダッシュボード", "gauge", 190], ["cases", "案件", "cases", 250], ["projects", "プロジェクト", "flag", 160], ["tasks", "タスク管理", "tasks", 20], ["resources", "リソース管理", "resources", 175],
  ["customers", "取引先", "vendor", 200], ["relations", "ビジネス関連図", "flow", 270], ["creatives", "広告作品", "creative", 310], ["exceptions", "例外キュー", "alert", 355], ["audit", "監査ログ", "shield", 140]];
const NAV_PARENT = { case: "cases", project: "projects", resource: "resources", customer: "customers" };
let busy = false, again = false, keepScroll = false, lastRoute = null;

A.mount = (el) => {
  const y = keepScroll ? window.scrollY : 0;
  $("#main").replaceChildren(el);
  window.scrollTo(0, y);
};
async function renderOnce() {
  const [, route = "dashboard", arg] = location.hash.split("/");
  const name = A.v[route] ? route : "dashboard";
  document.querySelectorAll(".nav-i").forEach((a) => a.classList.toggle("on", a.dataset.r === (NAV_PARENT[name] || name)));
  if (lastRoute !== null && lastRoute !== name && !keepScroll) { FX.sfx("nav"); FX.streak(innerHeight * 0.35); }
  lastRoute = name;
  try {
    A.state.me = await api("/api/me");
    $("#newCase").disabled = !can("create_case");
    setAvatar();
    A.updatePill();
    await A.v[name](arg ? Number(arg) : undefined);
  } catch (e) {
    toast(e.message, "err");
    if (name === "case") location.hash = "#/cases"; else A.mount(h("div", { class: "card empty bad" }, e.message));
  }
}
A.render = async () => {
  if (busy) { again = true; keepScroll = true; return; }
  busy = true;
  try { do { again = false; await renderOnce(); keepScroll = true; } while (again); } finally { busy = false; keepScroll = false; }
};

function setTheme(t) {
  document.documentElement.dataset.theme = t; localStorage.setItem("theme", t);
  $("#theme").replaceChildren(ic(t === "dark" ? "sun" : "moon"));
}

function setAvatar() { const box = $("#uav"); if (box && A.state.user) box.replaceChildren(userAvatar(A.state.user, 30)); }
function setSoundIcons() {
  $("#bgmBtn").replaceChildren(ic("music", 16)); $("#bgmBtn").classList.toggle("off", !FX.st.bgm); $("#bgmBtn").setAttribute("aria-pressed", FX.st.bgm);
  $("#sfxBtn").replaceChildren(ic(FX.st.sfx ? "vol" : "mute", 16)); $("#sfxBtn").classList.toggle("off", !FX.st.sfx); $("#sfxBtn").setAttribute("aria-pressed", FX.st.sfx);
}

/* Static shell text is authored in Japanese and translated on demand. */
function buildShell() {
  document.title = tr("Campaign Flow — 案件ライフサイクル（ローカル・デモ）");
  $("#rail").setAttribute("aria-label", tr("主要ナビゲーション"));
  $(".brand").setAttribute("aria-label", tr("Campaign Flow ホーム"));
  $("#nav").replaceChildren(...NAV.map(([r, t, i, hue]) => h("a", { class: "nav-i", href: `#/${r}`, "data-r": r }, Art.tile(i, hue, 30), t)));
  $("#newCase").replaceChildren(ic("plus", 16), tr("新規案件"));
  $("#bgmBtn").setAttribute("aria-label", tr("BGM")); $("#bgmBtn").title = tr("BGM のオン／オフ");
  $("#sfxBtn").setAttribute("aria-label", tr("効果音")); $("#sfxBtn").title = tr("効果音のオン／オフ");
  setSoundIcons();
  $(".rail-foot").replaceChildren(tr("ローカル専用 · 架空データ"), h("br"), tr("127.0.0.1 のみで動作"));
  $(".persona span:not(.uav)").textContent = tr("視点");
  $("#pill").setAttribute("aria-label", tr("アラート状態"));
  $("#roleBtn").replaceChildren(ic("person", 15), tr("ロール選択"));
  $("#roleBtn").setAttribute("title", tr("ロール選択画面に戻る"));
  $("#user").setAttribute("aria-label", tr("ユーザー切替"));
  $("#theme").setAttribute("aria-label", tr("テーマ切替")); $("#theme").setAttribute("title", tr("ライト／ダーク"));
  $(".foot").textContent = tr("Fluent 2 の原則（Natural on every platform / Built for focus / One for all, all for one / Unmistakably Microsoft）に沿ったデモUI。ユーザー切替は権限分離の確認用で、認証ではありません。");
  document.querySelectorAll("#lang button").forEach((b) => { const on = b.dataset.l === A.state.lang; b.classList.toggle("on", on); b.setAttribute("aria-pressed", on); });
  document.documentElement.lang = A.state.lang;
}

async function loadUsers() {
  const { users, roles } = await api("/api/users"), sel = $("#user");
  A.state.users = users; A.state.roles = roles;
  sel.replaceChildren(...users.map((u) => h("option", { value: u.id }, `${A.state.lang === "ja" ? u.name.replace(/^\S+\s+/, "") : u.name}（${roles[u.role]}）`)));
  A.state.user = users.some((u) => u.id === A.state.user) ? A.state.user : users[0].id;
  sel.value = A.state.user;
}

/* Role picker: shown at start-up and whenever the user returns to it from the top bar. */
const ROLE_INFO = {
  sales1: "顧客との契約・変更を担当。案件の起案と承認依頼", sales2: "A社の案件のみ閲覧できる営業（顧客スコープの確認用）", media1: "配信計画・発注・運用。リソースの再配分",
  prod1: "制作の進行と広告作品の登録。制作チームのリソース", fin1: "検収・請求・入金の照合。請求差異の対応", legal1: "広告作品の権利確認と承認、契約レビュー",
  ana1: "成果の記録と分析。KPI/OKRの確認", mgr1: "全社の判断・承認。会社としての例外とAutopilot", audit1: "監査ログと全体の統制を閲覧（変更はできません）",
};
let pickerOpen = false;
function closePicker() { const p = $("#rolepick"); if (p) { p.classList.add("out"); setTimeout(() => p.remove(), 450); } pickerOpen = false; document.body.classList.remove("noscroll"); }
function showRolePicker({ first = false } = {}) {
  return new Promise((resolve) => {
    if (pickerOpen) return resolve(false);
    pickerOpen = true; document.body.classList.add("noscroll");
    const dlg = $("#dlg"); if (dlg.open) dlg.close(); const v = $("#viewer"); if (!v.hidden) { v.hidden = true; v.replaceChildren(); }
    const users = A.state.users, roles = A.state.roles;
    const pick = (u) => {
      FX.init(); FX.sfx("success"); FX.ring(innerWidth / 2, innerHeight / 2); FX.burst(innerWidth / 2, innerHeight / 2, { n: 34, hue: 210, spread: 8 });
      A.state.user = u.id; A.state.cs = null; sessionStorage.setItem("user", u.id); sessionStorage.setItem("roleChosen", "1");
      $("#user").value = u.id; closePicker(); location.hash = "#/dashboard"; resolve(true);
    };
    const card = (u, i) => h("button", { type: "button", class: "rcard" + (u.id === A.state.user && !first ? " cur" : ""), style: `--i:${i}`, "data-tilt": "", onclick: () => pick(u) },
      h("span", { class: "rav" }, userAvatar(u.id, 96)), h("b", {}, A.state.lang === "ja" ? u.name.replace(/^\S+\s+/, "") : u.name), h("span", { class: "chip" }, roles[u.role]), h("small", {}, ROLE_INFO[u.id] || ""));
    const el = h("div", { id: "rolepick", role: "dialog", "aria-modal": "true", "aria-label": tr("ロールを選択") },
      h("div", { class: "rp-in" }, h("div", { class: "kick" }, "CAMPAIGN FLOW"), h("h1", {}, "ロールを選択してください"),
        h("p", {}, "選んだロールの視点で、同じデータを部署ごとの権限・画面で確認できます。いつでも上部の「ロール選択」から切り替えられます。"),
        h("div", { class: "rgrid" }, users.map(card)),
        h("p", { class: "mut", style: "font-size:12px;margin-top:18px" }, "これはデモ用の視点切替です。実際の認証ではありません。"),
        first ? null : h("button", { class: "btn", type: "button", onclick: () => { closePicker(); resolve(false); } }, "キャンセル")));
    trDom(el); document.body.append(el);
    el.addEventListener("keydown", (e) => { if (e.key === "Escape" && !first) { closePicker(); resolve(false); } });
    setTimeout(() => { const c = el.querySelector(".rcard.cur") || el.querySelector(".rcard"); c && c.focus({ preventScroll: true }); }, 500);
  });
}

async function setLang(l) {
  if (l === A.state.lang) return;
  A.state.lang = l; localStorage.setItem("lang", l);
  const dlg = $("#dlg"); if (dlg.open) dlg.close();
  const v = $("#viewer"); if (!v.hidden) { v.hidden = true; v.replaceChildren(); }
  buildShell();
  await loadUsers();
  A.state.creatives = (await api("/api/creatives")).creatives;
  await A.render();
}

async function init() {
  loadDict((await api("/api/i18n")).en);
  setTheme(localStorage.getItem("theme") || (matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark"));
  FX.dust(); FX.wire();
  $("#theme").onclick = () => setTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark");
  $("#bgmBtn").onclick = () => { FX.setBgm(!FX.st.bgm); setSoundIcons(); FX.sfx("click"); };
  $("#sfxBtn").onclick = () => { FX.setSfx(!FX.st.sfx); setSoundIcons(); FX.sfx("click"); };
  $("#pill").onclick = () => { location.hash = "#/tasks"; };
  $("#newCase").onclick = () => A.newCase();
  document.querySelectorAll("#lang button").forEach((b) => b.addEventListener("click", () => setLang(b.dataset.l)));
  $("#user").addEventListener("change", () => { A.state.user = $("#user").value; sessionStorage.setItem("user", A.state.user); A.state.cs = null; FX.sfx("success"); FX.ring(innerWidth - 120, 40); location.hash = "#/dashboard"; A.render(); });
  buildShell();
  await loadUsers();
  A.state.creatives = (await api("/api/creatives")).creatives;
  addEventListener("hashchange", () => { keepScroll = false; if (!pickerOpen) A.render(); });
  $("#roleBtn").onclick = () => { FX.sfx("nav"); showRolePicker().then((ok) => ok && A.render()); };
  await new Promise((r) => FX.intro(r));
  if (!sessionStorage.getItem("roleChosen")) { await showRolePicker({ first: true }); }
  await A.render();
}
init().catch((e) => toast(e.message, "err"));
