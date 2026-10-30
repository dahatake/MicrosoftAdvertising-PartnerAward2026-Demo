"use strict";
/* Procedural illustrations: bust-up portraits, anime-style customer/product mascots, and immersive glass icon tiles.
   Everything is inline SVG built from presentation attributes only (the CSP forbids inline style). */
const Art = (() => {
  let n = 0;
  const rng = (seed) => { let s = (seed * 9301 + 49297) % 233280; return () => ((s = (s * 9301 + 49297) % 233280) / 233280); };
  const pick = (r, a) => a[Math.floor(r() * a.length) % a.length];
  const svg = (inner, vb, size, label) => {
    const t = document.createElement("template");
    t.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}" width="${size}" height="${size}" class="art" role="img" aria-label="${label || ""}">${inner}</svg>`;
    return t.content.firstChild;
  };
  const kfaces = (cx, cy, s, cheeks = true) => `
    <ellipse cx="${cx - 11 * s}" cy="${cy}" rx="${3.4 * s}" ry="${4.6 * s}" fill="#1b1d2e"/><ellipse cx="${cx + 11 * s}" cy="${cy}" rx="${3.4 * s}" ry="${4.6 * s}" fill="#1b1d2e"/>
    <circle cx="${cx - 12 * s}" cy="${cy - 1.8 * s}" r="${1.3 * s}" fill="#fff"/><circle cx="${cx + 10 * s}" cy="${cy - 1.8 * s}" r="${1.3 * s}" fill="#fff"/>
    ${cheeks ? `<ellipse cx="${cx - 18 * s}" cy="${cy + 6 * s}" rx="${4 * s}" ry="${2.4 * s}" fill="#ff8fb1" opacity=".55"/><ellipse cx="${cx + 18 * s}" cy="${cy + 6 * s}" rx="${4 * s}" ry="${2.4 * s}" fill="#ff8fb1" opacity=".55"/>` : ""}
    <path d="M${cx - 4 * s} ${cy + 6 * s} Q${cx} ${cy + 10 * s} ${cx + 4 * s} ${cy + 6 * s}" fill="none" stroke="#1b1d2e" stroke-width="${1.6 * s}" stroke-linecap="round"/>`;

  /* ---------- people ---------- */
  function person({ seed = 1, g = "m", age = 35, size = 64, label = "" }) {
    const r = rng(seed * 7 + age), id = "p" + ++n, f = g === "f", old = age >= 55, mid = age >= 45;
    const skin = pick(r, ["#f6d5bd", "#efc3a0", "#e6b48f", "#d49c74"]), skinD = "#00000022";
    const hue = (seed * 47) % 360;
    const hairC = old ? pick(r, ["#cfd2da", "#e8eaf0"]) : mid ? pick(r, ["#4a4350", "#8b8d96", "#3a2c28"]) : pick(r, ["#17151b", "#2b1f1a", "#4a2f20", "#6b3f26", "#1d2540"]);
    const suit = f ? pick(r, ["#5b3a73", "#8a3b4f", "#2f5d73", "#3a3f55"]) : pick(r, ["#26344f", "#2e3138", "#3b4a63", "#1f3b44"]);
    const glasses = r() > (mid ? 0.35 : 0.62), stache = !f && mid && r() > 0.5;
    const style = f ? pick(r, ["bob", "long", "bun"]) : pick(r, ["short", "side", "spike"]);
    const ey = 60, fw = f ? 22 : 24;
    let back = "", front = "";
    if (f) {
      if (style === "long") back = `<path d="M32 52 C26 92 34 110 46 112 L74 112 C86 110 94 92 88 52 Z" fill="${hairC}"/>`;
      if (style === "bob") back = `<path d="M32 52 C28 84 34 96 44 98 L76 98 C86 96 92 84 88 52 Z" fill="${hairC}"/>`;
      if (style === "bun") back = `<circle cx="60" cy="14" r="11" fill="${hairC}"/>`;
      front = `<path d="M35 56 C32 28 50 19 62 20 C78 21 90 32 85 56 C82 42 72 33 58 34 C46 36 39 44 35 56Z" fill="${hairC}"/>
               <path d="M60 22 C70 26 80 34 84 52 C78 40 70 36 60 36Z" fill="#ffffff22"/>`;
    } else if (old && r() > 0.45) {
      front = `<path d="M35 56 C32 44 38 36 44 34 C40 40 38 48 37 58Z M85 56 C88 44 82 36 76 34 C80 40 82 48 83 58Z" fill="${hairC}"/><path d="M44 34 C52 28 68 28 76 34 C66 31 54 31 44 34Z" fill="${hairC}"/>`;
    } else if (style === "spike") {
      front = `<path d="M34 56 C30 34 40 20 50 22 L54 12 L62 21 L70 11 L74 22 C86 24 92 38 86 56 C82 44 74 38 60 38 C46 38 38 44 34 56Z" fill="${hairC}"/>`;
    } else {
      front = `<path d="M35 55 C32 30 46 21 60 21 C76 21 90 30 85 55 C82 43 74 37 64 36 C58 42 44 42 35 55Z" fill="${hairC}"/>`;
    }
    const wr = age >= 48 ? `<path d="M44 36 Q60 32 76 36" fill="none" stroke="#7a5a4a" stroke-width=".9" opacity=".5"/><path d="M48 70 Q46 78 50 82M72 70 Q74 78 70 82" fill="none" stroke="#7a5a4a" stroke-width="1" opacity=".55"/>` : "";
    const gl = glasses ? `<g fill="none" stroke="${f ? "#b04a7a" : "#222a3a"}" stroke-width="1.8"><rect x="39" y="${ey - 7}" width="18" height="13" rx="5"/><rect x="63" y="${ey - 7}" width="18" height="13" rx="5"/><path d="M57 ${ey - 2}h6"/></g>` : "";
    const tie = !f && age >= 30 && r() > 0.3 ? `<path d="M57 99h6l2 22-5 5-5-5z" fill="${pick(r, ["#c2410c", "#1d4ed8", "#7e22ce", "#b91c1c"])}"/>` : "";
    const inner = `
      <defs><linearGradient id="${id}b" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="hsl(${hue},75%,46%)"/><stop offset="1" stop-color="hsl(${(hue + 50) % 360},70%,20%)"/></linearGradient>
      <radialGradient id="${id}g" cx=".3" cy=".2" r=".9"><stop offset="0" stop-color="#ffffff55"/><stop offset="1" stop-color="#ffffff00"/></radialGradient></defs>
      <rect width="120" height="130" fill="url(#${id}b)"/><circle cx="92" cy="22" r="30" fill="#ffffff14"/><rect width="120" height="130" fill="url(#${id}g)"/>
      ${back}
      <path d="M8 132 C8 102 34 94 60 94 C86 94 112 102 112 132Z" fill="${suit}"/>
      <path d="M46 95 L60 116 L74 95 L68 92 L60 100 L52 92Z" fill="#f4f6fa"/>${tie}
      ${f ? `<path d="M50 96 Q60 106 70 96" fill="none" stroke="#f5d68a" stroke-width="1.6"/><circle cx="60" cy="105" r="2.2" fill="#f5d68a"/>` : ""}
      <rect x="51" y="78" width="18" height="20" rx="6" fill="${skin}"/><rect x="51" y="78" width="18" height="9" fill="${skinD}"/>
      <ellipse cx="36" cy="62" rx="4.5" ry="6.5" fill="${skin}"/><ellipse cx="84" cy="62" rx="4.5" ry="6.5" fill="${skin}"/>
      <ellipse cx="60" cy="58" rx="${fw}" ry="28" fill="${skin}"/>
      ${front}${wr}
      <path d="M${f ? 44 : 43} ${ey - 11} Q49 ${ey - 14} 55 ${ey - 11}M65 ${ey - 11} Q71 ${ey - 14} ${f ? 76 : 77} ${ey - 11}" fill="none" stroke="${hairC}" stroke-width="2.2" stroke-linecap="round"/>
      <ellipse cx="49" cy="${ey}" rx="3.6" ry="4.4" fill="#1b1d2e"/><ellipse cx="71" cy="${ey}" rx="3.6" ry="4.4" fill="#1b1d2e"/>
      <circle cx="50.2" cy="${ey - 1.6}" r="1.4" fill="#fff"/><circle cx="72.2" cy="${ey - 1.6}" r="1.4" fill="#fff"/>
      ${f && age < 45 ? `<ellipse cx="42" cy="70" rx="5" ry="3" fill="#ff8fb1" opacity=".4"/><ellipse cx="78" cy="70" rx="5" ry="3" fill="#ff8fb1" opacity=".4"/>` : ""}
      <path d="M60 64 q-2 5 1 6" fill="none" stroke="#a9755a" stroke-width="1.2" stroke-linecap="round" opacity=".7"/>
      ${stache ? `<path d="M50 74 Q60 70 70 74 Q60 77 50 74Z" fill="${hairC}"/>` : ""}
      <path d="M52 77 Q60 ${f ? 84 : 83} 68 77" fill="${f ? "#e0556e" : "none"}" stroke="${f ? "#e0556e" : "#9b5b4a"}" stroke-width="1.8" stroke-linecap="round"/>
      ${gl}`;
    return svg(inner, "0 0 120 130", size, label);
  }

  /* ---------- anime-style customer mascots ---------- */
  function customer(key, size = 96, label = "") {
    const id = "c" + ++n;
    if (String(key) === "2") {
      return svg(`
        <defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#1e3a8a"/><stop offset="1" stop-color="#0f172a"/></linearGradient></defs>
        <rect width="120" height="120" rx="22" fill="url(#${id})"/>
        <path d="M0 96 L28 78 L56 90 L84 66 L120 84 V120H0Z" fill="#38bdf833"/><path d="M12 100 H108" stroke="#7dd3fc" stroke-width="2" opacity=".5" stroke-dasharray="6 6"/>
        <path d="M22 118 C24 92 40 86 60 86 C80 86 96 92 98 118Z" fill="#334155"/><path d="M48 88 L60 104 L72 88Z" fill="#e2e8f0"/><path d="M40 92 L60 112 L80 92" fill="none" stroke="#38bdf8" stroke-width="2.5"/>
        <rect x="53" y="72" width="14" height="18" fill="#f6d5bd"/><ellipse cx="60" cy="52" rx="25" ry="27" fill="#fbe3d0"/>
        <path d="M33 54 C26 24 44 8 62 10 C82 8 96 26 87 54 C84 40 78 30 64 28 L56 36 L52 28 C44 32 36 42 33 54Z" fill="#9fb4d8"/>
        <path d="M60 10 L70 2 L72 14Z M44 14 L40 4 L52 12Z" fill="#9fb4d8"/>
        <path d="M33 50 H87" stroke="#38bdf8" stroke-width="5" opacity=".9"/><path d="M33 50 H87" stroke="#e0f2fe" stroke-width="1.2"/>
        <ellipse cx="48" cy="58" rx="7" ry="9" fill="#fff"/><ellipse cx="72" cy="58" rx="7" ry="9" fill="#fff"/>
        <ellipse cx="48" cy="59" rx="5" ry="7.4" fill="#0ea5e9"/><ellipse cx="72" cy="59" rx="5" ry="7.4" fill="#0ea5e9"/>
        <ellipse cx="48" cy="60" rx="2.6" ry="4.6" fill="#0c1a3a"/><ellipse cx="72" cy="60" rx="2.6" ry="4.6" fill="#0c1a3a"/>
        <circle cx="45.5" cy="55.5" r="2.2" fill="#fff"/><circle cx="69.5" cy="55.5" r="2.2" fill="#fff"/><path d="M46 63l3-2-1 4z M70 63l3-2-1 4z" fill="#7dd3fc"/>
        <path d="M40 46 Q48 42 56 46M64 46 Q72 42 80 46" fill="none" stroke="#475569" stroke-width="2" stroke-linecap="round"/>
        <path d="M52 74 Q60 80 68 74" fill="#e0556e" stroke="#e0556e" stroke-width="1.5" stroke-linecap="round"/>
        <path d="M86 20 l4 8 8 1-6 5 2 8-8-4-7 4 2-8-6-5 8-1z" fill="#fde047" opacity=".9"/>`, "0 0 120 120", size, label);
    }
    return svg(`
      <defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#22d3ee"/><stop offset="1" stop-color="#6366f1"/></linearGradient>
      <radialGradient id="${id}h" cx=".5" cy=".4" r=".7"><stop offset="0" stop-color="#67e8f9"/><stop offset="1" stop-color="#0891b2"/></radialGradient></defs>
      <rect width="120" height="120" rx="22" fill="url(#${id})"/>
      <g fill="#ffffff55"><circle cx="18" cy="24" r="5"/><circle cx="102" cy="40" r="7"/><circle cx="26" cy="96" r="4"/><circle cx="98" cy="98" r="5"/></g>
      <path d="M20 54 C2 62 4 100 26 108 C22 90 24 70 34 58Z" fill="url(#${id}h)"/><path d="M100 54 C118 62 116 100 94 108 C98 90 96 70 86 58Z" fill="url(#${id}h)"/>
      <path d="M26 120 C28 96 42 90 60 90 C78 90 92 96 94 120Z" fill="#fff"/><path d="M46 91 L60 104 L74 91" fill="#7dd3fc"/><path d="M60 100 l-4 6 4 6 4-6z" fill="#f472b6"/>
      <rect x="53" y="76" width="14" height="16" fill="#fbe3d0"/><ellipse cx="60" cy="54" rx="27" ry="28" fill="#fdebdd"/>
      <path d="M32 56 C26 22 46 8 62 9 C82 8 96 24 88 56 C86 40 80 30 70 27 C64 36 46 38 36 50Z" fill="url(#${id}h)"/>
      <path d="M60 9 C70 16 80 26 82 44 C76 32 68 26 58 26Z" fill="#ffffff44"/>
      <path d="M88 22 q8 6 4 16 q-9-2-8-9z" fill="#fff"/><circle cx="90" cy="30" r="2.6" fill="#22d3ee"/>
      <ellipse cx="47" cy="58" rx="8" ry="10" fill="#fff"/><ellipse cx="73" cy="58" rx="8" ry="10" fill="#fff"/>
      <ellipse cx="47" cy="59" rx="6" ry="8.4" fill="#0e7490"/><ellipse cx="73" cy="59" rx="6" ry="8.4" fill="#0e7490"/>
      <ellipse cx="47" cy="61" rx="3" ry="5" fill="#082f49"/><ellipse cx="73" cy="61" rx="3" ry="5" fill="#082f49"/>
      <circle cx="44" cy="55" r="2.6" fill="#fff"/><circle cx="70" cy="55" r="2.6" fill="#fff"/><circle cx="50" cy="64" r="1.4" fill="#fff"/><circle cx="76" cy="64" r="1.4" fill="#fff"/>
      <path d="M39 48 Q46 44 54 47M66 47 Q74 44 81 48" fill="none" stroke="#155e75" stroke-width="2" stroke-linecap="round"/>
      <ellipse cx="37" cy="71" rx="5" ry="3" fill="#ff8fb1" opacity=".55"/><ellipse cx="83" cy="71" rx="5" ry="3" fill="#ff8fb1" opacity=".55"/>
      <path d="M54 74 Q60 81 66 74Z" fill="#e0556e"/>
      <path d="M14 20 l3 6 6 1-5 4 1 7-6-3-6 3 1-7-5-4 6-1z" fill="#fde047"/>`, "0 0 120 120", size, label);
  }

  /* ---------- anime-style product characters ---------- */
  function product(id0, size = 72, label = "") {
    const id = "q" + ++n, k = Number(id0);
    const hues = { 1: ["#f472b6", "#7c3aed"], 2: ["#fb923c", "#dc2626"], 3: ["#34d399", "#0891b2"], 4: ["#60a5fa", "#4338ca"], 5: ["#a78bfa", "#0ea5e9"], 6: ["#fbbf24", "#ea580c"] }[k] || ["#60a5fa", "#7c3aed"];
    const bg = `<defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${hues[0]}"/><stop offset="1" stop-color="${hues[1]}"/></linearGradient></defs><rect width="100" height="100" rx="20" fill="url(#${id})"/><circle cx="82" cy="18" r="24" fill="#ffffff1c"/>`;
    const parts = {
      1: `<rect x="18" y="42" width="64" height="40" rx="6" fill="#1f2937"/><path d="M18 42 L26 26 L40 26 L32 42Z M40 42 L48 26 L62 26 L54 42Z M62 42 L70 26 L84 26 L76 42Z" fill="#f9fafb"/><path d="M18 42 H82" stroke="#fff" stroke-width="3"/>${kfaces(50, 62, 0.9)}<path d="M80 14 l2 5 5 1-4 3 1 5-5-3-5 3 1-5-4-3 5-1z" fill="#fde047"/>`,
      2: `<path d="M50 10 C70 22 74 46 66 70 H34 C26 46 30 22 50 10Z" fill="#f8fafc"/><path d="M34 70 L20 84 L30 56Z M66 70 L80 84 L70 56Z" fill="#f43f5e"/><circle cx="50" cy="40" r="11" fill="#38bdf8" stroke="#e2e8f0" stroke-width="3"/><path d="M40 72 Q50 96 60 72Z" fill="#fde047"/><path d="M44 72 Q50 88 56 72Z" fill="#fb923c"/>${kfaces(50, 40, 0.42, false)}`,
      3: `<ellipse cx="50" cy="58" rx="32" ry="30" fill="#f1f5f9"/><path d="M26 34 L34 20 L44 32Z M74 34 L66 20 L56 32Z" fill="#cbd5e1"/><rect x="26" y="68" width="48" height="16" rx="4" fill="#0f172a" opacity=".25"/><path d="M32 80 L44 72 L54 78 L68 66" fill="none" stroke="#fff" stroke-width="3.5" stroke-linecap="round"/><g fill="none" stroke="#0f172a" stroke-width="2.4"><circle cx="38" cy="50" r="11"/><circle cx="62" cy="50" r="11"/><path d="M49 50h2"/></g><circle cx="38" cy="50" r="5" fill="#0f172a"/><circle cx="62" cy="50" r="5" fill="#0f172a"/><circle cx="36" cy="48" r="1.8" fill="#fff"/><circle cx="60" cy="48" r="1.8" fill="#fff"/><path d="M46 60 L50 66 L54 60Z" fill="#fbbf24"/>`,
      4: `<path d="M38 22 L50 34 L62 22" fill="none" stroke="#e5e7eb" stroke-width="3" stroke-linecap="round"/><rect x="16" y="32" width="68" height="50" rx="12" fill="#f8fafc"/><rect x="22" y="38" width="44" height="38" rx="8" fill="#0f172a"/><rect x="22" y="38" width="44" height="38" rx="8" fill="#38bdf833"/>${kfaces(44, 56, 0.8)}<circle cx="75" cy="48" r="4" fill="#fb7185"/><circle cx="75" cy="62" r="4" fill="#fbbf24"/>`,
      5: `<path d="M24 66 C10 66 8 46 24 44 C26 28 48 24 56 36 C70 28 90 38 84 56 C94 60 90 76 76 74 L30 74 C28 74 26 70 24 66Z" fill="#f8fafc"/><circle cx="50" cy="54" r="17" fill="#6366f1"/><path d="M45 46 L60 54 L45 62Z" fill="#fff"/><path d="M86 22 q10 4 8 14" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".7"/><path d="M12 30 q-6 6-2 14" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".7"/>${kfaces(50, 80, 0.5)}`,
      6: `<rect x="14" y="22" width="72" height="58" rx="10" fill="#f8fafc"/><path d="M14 32 a10 10 0 0 1 10-10 H76 a10 10 0 0 1 10 10Z" fill="#cbd5e1"/><circle cx="24" cy="27" r="2.6" fill="#f87171"/><circle cx="33" cy="27" r="2.6" fill="#fbbf24"/><circle cx="42" cy="27" r="2.6" fill="#34d399"/><rect x="22" y="38" width="56" height="34" rx="5" fill="#e2e8f0"/>${kfaces(50, 55, 0.8)}<path d="M66 60 l16 8-7 2-3 7z" fill="#111827" stroke="#fff" stroke-width="1.6"/>`,
    };
    return svg(bg + (parts[k] || parts[1]), "0 0 100 100", size, label);
  }

  /* ---------- non-person resources ---------- */
  function resource(kind, hue = 210, size = 64, label = "") {
    const id = "r" + ++n;
    const bg = `<defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="hsl(${hue},80%,52%)"/><stop offset="1" stop-color="hsl(${(hue + 60) % 360},75%,24%)"/></linearGradient></defs><rect width="100" height="100" rx="20" fill="url(#${id})"/>`;
    const g = {
      vendor: `<rect x="22" y="30" width="38" height="52" rx="3" fill="#f8fafc"/><rect x="56" y="48" width="24" height="34" rx="3" fill="#e2e8f0"/><g fill="#0ea5e9">${[0, 1, 2, 3].flatMap((r) => [0, 1].map((c) => `<rect x="${28 + c * 16}" y="${36 + r * 11}" width="8" height="6"/>`)).join("")}</g><circle cx="76" cy="30" r="11" fill="#fde047"/><path d="M76 24v12M70 30h12" stroke="#a16207" stroke-width="3"/>`,
      studio: `<path d="M10 78 L50 62 L90 78Z" fill="#0f172a" opacity=".55"/><path d="M26 22 H74 L86 70 H14Z" fill="#fef3c7" opacity=".25"/><rect x="38" y="20" width="24" height="14" rx="3" fill="#f8fafc"/><path d="M62 24 L80 16 V38 L62 30Z" fill="#cbd5e1"/><circle cx="46" cy="27" r="4" fill="#38bdf8"/><path d="M50 34 L38 70 M50 34 L62 70 M50 34 V72" stroke="#f1f5f9" stroke-width="3"/>`,
      equipment: `<rect x="20" y="36" width="44" height="32" rx="6" fill="#f8fafc"/><circle cx="42" cy="52" r="11" fill="#0f172a"/><circle cx="42" cy="52" r="6" fill="#38bdf8"/><circle cx="39" cy="49" r="2" fill="#fff"/><path d="M64 46 L82 38 V66 L64 58Z" fill="#cbd5e1"/><rect x="28" y="28" width="12" height="8" rx="2" fill="#e2e8f0"/>`,
    }[kind] || "";
    return svg(bg + g, "0 0 100 100", size, label);
  }

  /* ---------- glass icon tile (immersive) ---------- */
  function tile(name, hue = 210, size = 34, cls = "") {
    const t = document.createElement("span");
    t.className = "tile " + cls;
    t.style.setProperty("--h", hue); t.style.setProperty("--s", size + "px");
    t.append(ic(name, Math.round(size * 0.56)));
    return t;
  }
  return { person, customer, product, resource, tile };
})();

const USER_ART = {
  sales1: { seed: 1, g: "m", age: 35 }, sales2: { seed: 2, g: "f", age: 28 }, media1: { seed: 4, g: "f", age: 41 }, prod1: { seed: 6, g: "m", age: 45 },
  fin1: { seed: 10, g: "f", age: 49 }, legal1: { seed: 11, g: "m", age: 55 }, ana1: { seed: 12, g: "f", age: 29 }, mgr1: { seed: 14, g: "m", age: 50 }, audit1: { seed: 15, g: "f", age: 62 },
};
const userAvatar = (id, size = 28) => Art.person({ ...(USER_ART[id] || { seed: 3, g: "m", age: 35 }), size });
const resAvatar = (r, size = 44) => (r.kind === "person" ? Art.person({ seed: r.id, g: r.gender || "m", age: r.age || 35, size, label: r.name }) : Art.resource(r.kind, { vendor: 200, studio: 280, equipment: 160 }[r.kind], size, r.name));
const TEAM_HUE = { sales: 210, media: 170, production: 285, finance: 40, legal: 340, analyst: 150, manager: 255 };
const TEAM_ICON = { sales: "target", media: "rocket", production: "studio", finance: "table", legal: "shield", analyst: "gauge", manager: "flag" };
