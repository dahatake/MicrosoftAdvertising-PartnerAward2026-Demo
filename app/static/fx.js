"use strict";
/* Entertainment layer: generative cinematic BGM + UI sound effects (Web Audio, nothing is downloaded),
   and film-style visual effects (particles, shockwaves, lens streaks, shake, cinematic intro). */
const FX = (() => {
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const st = { bgm: localStorage.getItem("fx_bgm") !== "0", sfx: localStorage.getItem("fx_sfx") !== "0" };
  let ctx, master, rev, bgmBus, sfxBus, arpBus, timer, nextT = 0, bar = 0;
  const BPM = 84, BEAT = 60 / BPM, BAR = BEAT * 4;
  const CH = [[57, 60, 64, 69], [53, 57, 60, 65], [48, 52, 55, 60], [55, 59, 62, 67]]; // Am - F - C - G
  const mtof = (m) => 440 * 2 ** ((m - 69) / 12);

  function impulse(sec, decay) {
    const len = Math.floor(ctx.sampleRate * sec), b = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) { const d = b.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay); }
    return b;
  }
  function init() {
    if (ctx) { if (ctx.state === "suspended") ctx.resume(); return true; }
    try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch { return false; }
    const comp = ctx.createDynamicsCompressor(); master = ctx.createGain(); master.gain.value = 0.85; master.connect(comp); comp.connect(ctx.destination);
    rev = ctx.createConvolver(); rev.buffer = impulse(3, 2.4); const rg = ctx.createGain(); rg.gain.value = 0.42; rev.connect(rg); rg.connect(master);
    bgmBus = ctx.createGain(); bgmBus.gain.value = st.bgm ? 0.5 : 0; bgmBus.connect(master); bgmBus.connect(rev);
    sfxBus = ctx.createGain(); sfxBus.connect(master); const sr = ctx.createGain(); sr.gain.value = 0.45; sfxBus.connect(sr); sr.connect(rev);
    arpBus = ctx.createGain(); arpBus.connect(bgmBus);
    const dl = ctx.createDelay(1); dl.delayTime.value = BEAT * 0.75; const fb = ctx.createGain(); fb.gain.value = 0.38; arpBus.connect(dl); dl.connect(fb); fb.connect(dl); dl.connect(bgmBus);
    nextT = ctx.currentTime + 0.1;
    if (st.bgm) startBgm();
    return true;
  }
  const env = (g, t, a, peak, d, end = 0.0001) => { g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(end, t + a + d); };
  function tone(f, t, dur, { type = "sine", vol = 0.1, to, bus = sfxBus, a = 0.005, det = 0 } = {}) {
    const o = ctx.createOscillator(), g = ctx.createGain(); o.type = type; o.frequency.setValueAtTime(f, t); o.detune.value = det;
    if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
    env(g, t, a, vol, dur); o.connect(g); g.connect(bus); o.start(t); o.stop(t + dur + 0.05); return g;
  }
  let noiseBuf;
  function noise(t, dur, { vol = 0.1, f0 = 800, f1 = 800, q = 1, type = "bandpass", bus = sfxBus, a = 0.01 } = {}) {
    if (!noiseBuf) { noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
    const s = ctx.createBufferSource(), fl = ctx.createBiquadFilter(), g = ctx.createGain(); s.buffer = noiseBuf; fl.type = type; fl.Q.value = q;
    fl.frequency.setValueAtTime(f0, t); fl.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + dur);
    env(g, t, a, vol, dur); s.connect(fl); fl.connect(g); g.connect(bus); s.start(t); s.stop(t + dur + 0.05);
  }
  function kick(t, v = 0.3) { tone(130, t, 0.35, { vol: v, to: 38, bus: bgmBus }); }

  function playBar(t, b) {
    const ch = CH[b % 4];
    ch.forEach((m) => [-9, 9].forEach((dt) => {
      const o = ctx.createOscillator(), fl = ctx.createBiquadFilter(), g = ctx.createGain(); o.type = "sawtooth"; o.frequency.value = mtof(m - 12); o.detune.value = dt;
      fl.type = "lowpass"; fl.frequency.setValueAtTime(260, t); fl.frequency.linearRampToValueAtTime(1100, t + BAR * 0.8); fl.frequency.linearRampToValueAtTime(300, t + BAR + 0.6);
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.028, t + 1.3); g.gain.setValueAtTime(0.028, t + BAR - 0.2); g.gain.linearRampToValueAtTime(0.0001, t + BAR + 0.9);
      o.connect(fl); fl.connect(g); g.connect(bgmBus); o.start(t); o.stop(t + BAR + 1);
    }));
    tone(mtof(ch[0] - 24), t, BAR + 0.4, { vol: 0.2, bus: bgmBus, a: 0.25 });
    [0, 1, 2, 3, 2, 1, 2, 3].forEach((k, i) => tone(mtof(ch[k] + 12), t + i * BEAT / 2, 0.45, { type: "triangle", vol: 0.05, bus: arpBus }));
    kick(t, b % 8 === 0 ? 0.42 : 0.24); kick(t + BEAT * 2, 0.2);
    for (let i = 0; i < 4; i++) noise(t + BEAT * (i + 0.5), 0.06, { vol: 0.025, f0: 7000, f1: 6000, type: "highpass", bus: bgmBus });
    if (b % 8 === 0 && b > 0) { tone(55, t, 2.4, { type: "sawtooth", vol: 0.1, bus: bgmBus, to: 41 }); noise(t - BAR, BAR, { vol: 0.06, f0: 300, f1: 5000, bus: bgmBus, a: BAR * 0.9 }); }
  }
  function pump() { if (!ctx) return; while (nextT < ctx.currentTime + 0.8) { playBar(nextT, bar++); nextT += BAR; } }
  function startBgm() { if (timer) return; nextT = Math.max(nextT, ctx.currentTime + 0.1); pump(); timer = setInterval(pump, 300); }
  function stopBgm() { clearInterval(timer); timer = null; }

  const S = {
    click: (t) => { tone(1240, t, 0.07, { type: "triangle", vol: 0.07, to: 1900 }); },
    hover: (t) => { tone(2400, t, 0.03, { vol: 0.012 }); },
    nav: (t) => { noise(t, 0.5, { vol: 0.08, f0: 300, f1: 4800, q: 1.4, a: 0.2 }); tone(220, t, 0.4, { type: "sawtooth", vol: 0.02, to: 660 }); },
    open: (t) => { noise(t, 0.35, { vol: 0.07, f0: 500, f1: 3000, q: 2 }); tone(440, t, 0.25, { type: "triangle", vol: 0.05, to: 880 }); },
    close: (t) => { tone(660, t, 0.18, { type: "triangle", vol: 0.04, to: 330 }); },
    success: (t) => { [523, 659, 784, 1047].forEach((f, i) => tone(f, t + i * 0.07, 0.8, { type: "triangle", vol: 0.07 })); },
    shield: (t) => { [880, 1175, 1568].forEach((f, i) => tone(f, t + i * 0.05, 0.5, { vol: 0.05 })); },
    approve: (t) => { tone(90, t, 1.4, { vol: 0.5, to: 32 }); noise(t, 0.9, { vol: 0.22, f0: 3000, f1: 200, q: 0.6 }); [392, 523, 659, 784, 1047].forEach((f, i) => tone(f, t + 0.12 + i * 0.06, 1.6, { type: "triangle", vol: 0.06 })); },
    alert: (t) => { tone(110, t, 0.9, { type: "sawtooth", vol: 0.1, to: 82 }); tone(155.6, t, 0.9, { type: "sawtooth", vol: 0.08, to: 116 }); tone(440, t, 0.6, { type: "square", vol: 0.03, to: 880 }); noise(t, 0.7, { vol: 0.06, f0: 200, f1: 2500, a: 0.4 }); },
    think: (t) => { for (let i = 0; i < 4; i++) tone(700 + Math.random() * 1400, t + i * 0.045, 0.06, { type: "square", vol: 0.018 }); },
    tick: (t, n = 0) => { tone(500 + n * 22, t, 0.05, { type: "triangle", vol: 0.03 }); },
    err: (t) => { tone(160, t, 0.25, { type: "sawtooth", vol: 0.08, to: 90 }); },
    boom: (t) => { tone(70, t, 1.1, { vol: 0.5, to: 28 }); noise(t, 0.6, { vol: 0.2, f0: 2000, f1: 120, q: 0.5 }); },
    riser: (t) => { noise(t, 1.6, { vol: 0.12, f0: 200, f1: 7000, q: 1.2, a: 1.4 }); tone(110, t, 1.6, { type: "sawtooth", vol: 0.04, to: 880, a: 1.4 }); },
  };
  const last = {};
  function sfx(name, arg) {
    if (!st.sfx || !ctx || ctx.state !== "running" || !S[name]) return;
    const now = performance.now(); if (name === "hover" && now - (last.hover || 0) < 90) return; last.hover = name === "hover" ? now : last.hover;
    S[name](ctx.currentTime + 0.005, arg);
  }
  function setBgm(on) {
    st.bgm = on; localStorage.setItem("fx_bgm", on ? "1" : "0");
    if (on) { if (init()) { bgmBus.gain.cancelScheduledValues(ctx.currentTime); bgmBus.gain.setTargetAtTime(0.5, ctx.currentTime, 0.3); startBgm(); } }
    else if (ctx) { bgmBus.gain.setTargetAtTime(0, ctx.currentTime, 0.25); setTimeout(() => { if (!st.bgm) stopBgm(); }, 900); }
  }
  function setSfx(on) { st.sfx = on; localStorage.setItem("fx_sfx", on ? "1" : "0"); if (on) init(); }

  /* ---------------- visuals ---------------- */
  let cv, cx, parts = [], raf = 0;
  function canvas() {
    if (cv) return;
    cv = document.createElement("canvas"); cv.id = "fxc"; cv.setAttribute("aria-hidden", "true"); document.body.append(cv); cx = cv.getContext("2d");
    const fit = () => { cv.width = innerWidth; cv.height = innerHeight; }; fit(); addEventListener("resize", fit);
  }
  function loop() {
    cx.clearRect(0, 0, cv.width, cv.height); cx.globalCompositeOperation = "lighter";
    parts = parts.filter((p) => p.life > 0);
    for (const p of parts) {
      p.life -= 1; p.vy += p.g; p.vx *= 0.985; p.x += p.vx; p.y += p.vy;
      const a = Math.max(0, p.life / p.max); cx.fillStyle = `hsla(${p.h},95%,${p.l}%,${a})`;
      if (p.tri) { cx.save(); cx.translate(p.x, p.y); cx.rotate(p.life * 0.2); cx.fillRect(-p.r, -p.r / 2, p.r * 2, p.r); cx.restore(); } else { cx.beginPath(); cx.arc(p.x, p.y, p.r * (0.4 + a), 0, 6.283); cx.fill(); }
    }
    raf = parts.length ? requestAnimationFrame(loop) : 0; if (!raf) cx.clearRect(0, 0, cv.width, cv.height);
  }
  function burst(x, y, { n = 26, hue = 200, spread = 7, g = 0.12, conf = false } = {}) {
    if (reduce) return; canvas();
    for (let i = 0; i < n; i++) {
      const a = Math.random() * 6.283, s = (0.3 + Math.random()) * spread;
      parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - (conf ? 3 : 0), g, r: conf ? 4 + Math.random() * 3 : 1.5 + Math.random() * 2.5, life: 50 + Math.random() * 40, max: 90, h: hue + Math.random() * 50 - 25, l: 60 + Math.random() * 20, tri: conf });
    }
    if (!raf) raf = requestAnimationFrame(loop);
  }
  const div = (cls, x, y, ms) => { const d = document.createElement("div"); d.className = cls; if (x != null) { d.style.left = x + "px"; d.style.top = y + "px"; } document.body.append(d); setTimeout(() => d.remove(), ms); return d; };
  const ring = (x, y) => { if (!reduce) div("fx-ring", x, y, 1100); };
  const flash = (cls = "fx-flash") => { if (!reduce) div(cls, null, null, 900); };
  const streak = (y) => { if (!reduce) div("fx-streak", 0, y, 1300); };
  function shake(ms = 450, cls = "shake") { if (reduce) return; const s = document.querySelector(".shell"); s.classList.add(cls); setTimeout(() => s.classList.remove(cls), ms); }
  function celebrate(x = innerWidth / 2, y = innerHeight / 2) {
    sfx("approve"); ring(x, y); flash(); streak(y); shake(500);
    [[0, 0, 190], [-220, -80, 320], [240, -60, 50], [-120, 120, 150], [140, 110, 280]].forEach(([dx, dy, h], i) => setTimeout(() => burst(x + dx, y + dy, { n: 34, hue: h, spread: 8 }), i * 110));
    setTimeout(() => { for (let i = 0; i < 4; i++) burst(Math.random() * innerWidth, -10, { n: 24, hue: Math.random() * 360, spread: 4, g: 0.16, conf: true }); }, 250);
  }
  function alertPulse() { if (!reduce) { flash("fx-redflash"); shake(600, "shake2"); } sfx("alert"); }

  function scramble(el, text, ms = 700) {
    if (reduce) { el.textContent = text; return; }
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#%&", t0 = performance.now();
    (function f(t) { const k = Math.min(1, (t - t0) / ms), n = Math.floor(text.length * k); el.textContent = text.slice(0, n) + [...text.slice(n)].map((c) => (c === " " ? " " : chars[Math.floor(Math.random() * chars.length)])).join(""); if (k < 1) requestAnimationFrame(f); else el.textContent = text; })(t0);
  }
  const type = (el, text, cps = 70) => new Promise((res) => {
    if (reduce) { el.textContent = text; return res(); }
    let i = 0; const step = () => { el.textContent = text.slice(0, ++i); if (i < text.length) setTimeout(step, 1000 / cps); else res(); }; step();
  });

  /* ambient dust (cheap: ~40 additive dots) */
  function dust() {
    if (reduce) return;
    const c = document.createElement("canvas"); c.id = "dust"; c.setAttribute("aria-hidden", "true"); document.body.prepend(c); const g = c.getContext("2d");
    const fit = () => { c.width = innerWidth; c.height = innerHeight; }; fit(); addEventListener("resize", fit);
    const P = Array.from({ length: 42 }, () => ({ x: Math.random(), y: Math.random(), r: 0.6 + Math.random() * 1.8, s: 0.00006 + Math.random() * 0.00016, h: 190 + Math.random() * 90, ph: Math.random() * 6 }));
    (function f(t) {
      if (!document.hidden) {
        g.clearRect(0, 0, c.width, c.height); g.globalCompositeOperation = "lighter";
        for (const p of P) { p.y -= p.s * 16; p.x += Math.sin(t / 3000 + p.ph) * 0.0002; if (p.y < -0.02) { p.y = 1.02; p.x = Math.random(); } g.fillStyle = `hsla(${p.h},90%,70%,${0.18 + 0.14 * Math.sin(t / 900 + p.ph)})`; g.beginPath(); g.arc(p.x * c.width, p.y * c.height, p.r, 0, 6.283); g.fill(); }
      }
      requestAnimationFrame(f);
    })(0);
  }

  /* cinematic intro: letterbox, title reveal, light sweep. Needs a click, which also unlocks audio. */
  function intro(onDone) {
    if (reduce || sessionStorage.getItem("intro") === "1" || /nointro/.test(location.search)) { onDone && onDone(); return; }
    const o = document.createElement("div"); o.id = "intro"; o.setAttribute("role", "dialog"); o.setAttribute("aria-label", tr("オープニング"));
    o.append(h("i", { class: "bar t" }), h("i", { class: "bar b" }), h("div", { class: "beam" }),
      h("div", { class: "ttl" }, h("div", { class: "kick" }, tr("PARTNER AWARD 2026 · DEMO")), h("h1", {}, [..."CAMPAIGN FLOW"].map((c, i) => h("span", { style: `--i:${i}` }, c === " " ? "\u00a0" : c))),
        h("p", {}, tr("企画から効果測定まで、すべてがひとつの流れに。")), h("button", { class: "btn accent big", id: "introGo" }, ic("play", 16), tr("はじめる"))));
    document.body.append(o);
    let done = false;
    const go = () => {
      if (done) return; done = true; sessionStorage.setItem("intro", "1"); init(); sfx("boom"); flash(); setTimeout(() => sfx("riser"), 10);
      o.classList.add("out"); const r = o.getBoundingClientRect(); burst(innerWidth / 2, innerHeight / 2, { n: 40, hue: 210, spread: 9 }); ring(innerWidth / 2, innerHeight / 2);
      setTimeout(() => { o.remove(); onDone && onDone(); }, 900);
    };
    o.querySelector("#introGo").addEventListener("click", go);
    addEventListener("keydown", function k(e) { if (e.key === "Enter" || e.key === "Escape") { removeEventListener("keydown", k); go(); } });
    setTimeout(() => o.querySelector("#introGo").focus(), 1200);
  }

  /* global interaction hooks */
  function wire() {
    const first = () => { init(); removeEventListener("pointerdown", first); removeEventListener("keydown", first); };
    addEventListener("pointerdown", first); addEventListener("keydown", first);
    document.addEventListener("click", (e) => {
      const t = e.target.closest && e.target.closest("button,.btn,.nav-i,.opt,.tabbtn,a.card,.thumb,[data-fx]");
      if (!t || t.disabled) return;
      sfx("click");
      if (!reduce) {
        const r = t.getBoundingClientRect(), sp = document.createElement("span"); sp.className = "rip"; sp.style.left = e.clientX - r.left + "px"; sp.style.top = e.clientY - r.top + "px";
        if (getComputedStyle(t).position === "static") t.style.position = "relative"; t.style.overflow = t.style.overflow || "hidden"; t.append(sp); setTimeout(() => sp.remove(), 650);
        if (t.classList.contains("accent")) burst(e.clientX, e.clientY, { n: 14, hue: 220, spread: 5 });
      }
    });
    document.addEventListener("pointerover", (e) => { const t = e.target.closest && e.target.closest(".btn,.nav-i,.opt,.card.lift,.team-c"); if (t && !t.contains(e.relatedTarget)) sfx("hover"); });
    document.addEventListener("pointermove", (e) => {
      if (reduce) return; const c = e.target.closest && e.target.closest("[data-tilt]");
      if (c) { const r = c.getBoundingClientRect(), px = (e.clientX - r.left) / r.width - 0.5, py = (e.clientY - r.top) / r.height - 0.5; c.style.setProperty("--ry", px * 7 + "deg"); c.style.setProperty("--rx", -py * 7 + "deg"); }
    });
    document.addEventListener("pointerout", (e) => { const c = e.target.closest && e.target.closest("[data-tilt]"); if (c && !c.contains(e.relatedTarget)) { c.style.setProperty("--ry", "0deg"); c.style.setProperty("--rx", "0deg"); } });
  }
  return { st, init, sfx, setBgm, setSfx, burst, ring, flash, streak, shake, celebrate, alertPulse, scramble, type, intro, dust, wire, reduce };
})();
