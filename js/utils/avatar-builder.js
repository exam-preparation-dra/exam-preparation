/* =========================================================
   AVATAR BUILDER — animated girl / boy avatars students can dress up.

   buildAvatarSvg(cfg, { name, animate }) -> SVG text
   avatarUri(cfg, name)                  -> data: URI (goes into students/{id}.photoURL)
   parseAvatarConfig(uri)                -> cfg | null  (re-open the editor later)

   Same trick as avatar-faces.js: one small self-contained SVG with CSS
   animations only (blink, breathing, head bob, hair sway, eye wander,
   twinkle), turned into a data: URI. Every page already shows profile
   pictures as <img src="${photoURL}">, so the avatar appears everywhere
   with no other change. The chosen options are stored inside the SVG itself
   (a tiny comment), so no new Firestore field and no new rules are needed.

   Size: firestore.rules only accepts photoURL < 12000 characters, so the
   SVG is kept compact and the URI is encoded minimally (see toUri()).
   ========================================================= */

/* ---------------- option tables ---------------- */
export const SKINS = ["#fde3d1", "#f7cfae", "#e8ab80", "#c98b5c", "#a2653d", "#6f4429"];
export const HAIR_COLORS = ["#25201d", "#4a2c1d", "#7b4a2b", "#a85f2f", "#d9a441", "#b8bcc4", "#3b5bdb", "#e64980", "#7048e8", "#12a594"];
export const DRESS_COLORS = ["#e8590c", "#1971c2", "#2f9e44", "#c2255c", "#7048e8", "#343a40", "#f08c00", "#e03131", "#0c8599", "#868e96"];
export const BACKGROUNDS = [
  ["#ffd6a5", "#ff9f68"], ["#a5d8ff", "#5c9cff"], ["#b2f2bb", "#51cf66"], ["#fcc2d7", "#f06595"],
  ["#d0bfff", "#845ef7"], ["#ffec99", "#fcc419"], ["#99e9f2", "#22b8cf"], ["#3a4150", "#1c2029"]
];

export const HAIRS = {
  f: ["লম্বা চুল", "বব কাট", "পনিটেল", "খোঁপা", "কোঁকড়া", "বেণী"],
  m: ["ক্লাসিক", "কুইফ", "ছোট ছাঁট", "কোঁকড়া", "ওয়েভি", "স্পাইক"]
};
export const EYES = ["গোল", "ঝিলমিল", "খুশি", "ঘুম ঘুম", "ধারালো"];
export const MOUTHS = ["হাসি", "বড় হাসি", "মিষ্টি", "শান্ত", "চোখ টিপ"];
export const DRESSES = {
  f: ["কুর্তি", "স্কুল ড্রেস", "হুডি", "ব্লেজার", "শাড়ি"],
  m: ["টি-শার্ট", "শার্ট", "পাঞ্জাবি", "হুডি", "ব্লেজার"]
};
export const GLASSES = ["নেই", "গোল চশমা", "চৌকো চশমা"];
// extras: id -> label ; which genders may use it
export const EXTRAS = [
  { id: 0, label: "কিছু না", g: "fm" },
  { id: 1, label: "হেডফোন", g: "fm" },
  { id: 2, label: "ক্যাপ", g: "fm" },
  { id: 3, label: "গ্র্যাজুয়েট ক্যাপ", g: "fm" },
  { id: 4, label: "ফুল", g: "f" },
  { id: 5, label: "কানের দুল", g: "f" },
  { id: 6, label: "হেডব্যান্ড", g: "f" },
  { id: 7, label: "দাড়ি", g: "m" }
];
export const extrasFor = (g) => EXTRAS.filter(e => e.g.includes(g));

/* cfg keys: g sk h hc ey mo dr dc gl ex bg ini */
const KEYS = ["g", "sk", "h", "hc", "ey", "mo", "dr", "dc", "gl", "ex", "bg", "ini"];

export function defaultConfig(g = "f") {
  return g === "m"
    ? { g: "m", sk: 2, h: 0, hc: 1, ey: 0, mo: 0, dr: 1, dc: 1, gl: 0, ex: 0, bg: 1, ini: 1 }
    : { g: "f", sk: 1, h: 0, hc: 0, ey: 1, mo: 0, dr: 0, dc: 3, gl: 0, ex: 0, bg: 3, ini: 1 };
}

const clamp = (v, n) => Math.max(0, Math.min(n - 1, Number.isFinite(+v) ? Math.floor(+v) : 0));
export function normalizeConfig(c) {
  const g = c?.g === "m" ? "m" : "f";
  const out = {
    g,
    sk: clamp(c?.sk, SKINS.length), h: clamp(c?.h, 6), hc: clamp(c?.hc, HAIR_COLORS.length),
    ey: clamp(c?.ey, EYES.length), mo: clamp(c?.mo, MOUTHS.length), dr: clamp(c?.dr, 5),
    dc: clamp(c?.dc, DRESS_COLORS.length), gl: clamp(c?.gl, GLASSES.length),
    ex: +c?.ex || 0, bg: clamp(c?.bg, BACKGROUNDS.length), ini: c?.ini ? 1 : 0
  };
  if (!extrasFor(g).some(e => e.id === out.ex)) out.ex = 0;
  return out;
}

/* ---------------- colour helpers ---------------- */
function shade(hex, amt) {            // amt < 0 darker, > 0 lighter
  const n = parseInt(hex.slice(1), 16);
  const f = c => Math.round(amt < 0 ? c * (1 + amt) : c + (255 - c) * amt);
  return "#" + [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(f).map(c => c.toString(16).padStart(2, "0")).join("");
}
const lum = hex => { const n = parseInt(hex.slice(1), 16); return (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255; };
const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

/* ---------------- animation CSS ---------------- */
const CSS = [
  ".hd{animation:hb 3.4s ease-in-out infinite}",
  ".bd{transform-box:view-box;transform-origin:50px 100px;animation:br 3.4s ease-in-out infinite}",
  ".bl{transform-box:fill-box;transform-origin:center;animation:bk 4.6s infinite}",
  ".b2{animation-delay:.07s}",
  ".ey{animation:lk 8s ease-in-out infinite}",
  ".sw{transform-box:view-box;transform-origin:50px 20px;animation:sw 4.2s ease-in-out infinite}",
  ".pt{transform-box:view-box;transform-origin:64px 28px;animation:pt 3s ease-in-out infinite}",
  ".ts{transform-box:view-box;transform-origin:74px 25px;animation:pt 2.4s ease-in-out infinite}",
  ".tw{transform-box:fill-box;transform-origin:center;animation:tw 3s ease-in-out infinite}",
  ".t2{animation-delay:1.4s}",
  "@keyframes hb{0%,100%{transform:translateY(.8px)}50%{transform:translateY(-1.6px)}}",
  "@keyframes br{0%,100%{transform:scaleY(1)}50%{transform:scaleY(1.018)}}",
  "@keyframes bk{0%,93%,100%{transform:scaleY(1)}96.5%{transform:scaleY(.1)}}",
  "@keyframes lk{0%,40%,100%{transform:translateX(0)}50%,62%{transform:translateX(.9px)}72%,88%{transform:translateX(-.9px)}}",
  "@keyframes sw{0%,100%{transform:rotate(-.9deg)}50%{transform:rotate(.9deg)}}",
  "@keyframes pt{0%,100%{transform:rotate(-4deg)}50%{transform:rotate(5deg)}}",
  "@keyframes tw{0%,100%{transform:scale(.4);opacity:.2}50%{transform:scale(1);opacity:.95}}"
].join("");

const INK = "#2b2118";
const MOUTH = "#b5424d";
const FONT = "Noto Sans Bengali,Hind Siliguri,sans-serif";

/* ---------------- hair (back layer, front layer) ---------------- */
function hair(g, h, c) {
  const d = shade(c, -0.18), L = shade(c, 0.18);
  const P = (dd, f = c) => `<path d='${dd}' fill='${f}'/>`;
  const C = (x, y, r, f = c) => `<circle cx='${x}' cy='${y}' r='${r}' fill='${f}'/>`;
  let back = "", front = "";
  if (g === "f") {
    switch (h) {
      case 0: // long, centre parting
        back = `<g class='sw'>${P("M30 40Q27 20 50 19Q73 20 70 40L75 80Q62 85 50 82Q38 85 25 80Z")}</g>`;
        front = `<g class='sw'>${P("M31.5 42Q30 22 50 20.5Q70 22 68.5 42Q64 30 50 29.5Q36 30 31.5 42Z")}${P("M31 42Q29.5 62 27 76Q36 70 35.5 52Q34 46 31 42Z", d)}${P("M69 42Q70.5 62 73 76Q64 70 64.5 52Q66 46 69 42Z", d)}<path d='M50 21V29.5' stroke='${d}' stroke-width='.9'/></g>`;
        break;
      case 1: // bob with fringe
        back = `<g class='sw'>${P("M30.5 44Q26 19 50 18.5Q74 19 69.5 44L70.5 61Q50 67 29.5 61Z")}</g>`;
        front = `<g class='sw'>${P("M31.5 41Q31 22 50 20.5Q69 22 68.5 41L68 34Q50 38 32 34Z")}${P("M31 44Q29.5 56 30.5 60Q36 58 36 50Z", d)}${P("M69 44Q70.5 56 69.5 60Q64 58 64 50Z", d)}</g>`;
        break;
      case 2: // ponytail
        back = `<g class='pt'>${P("M63 27Q86 22 82 50Q80 64 73 72Q75 54 67 42Z")}${C(65, 29, 2.4, shade(c, -0.35))}</g>`;
        front = `<g class='sw'>${P("M31.5 42Q30 22 50 20.5Q70 22 68.5 42Q62 33 50 31Q40 32 31.5 42Z")}${P("M31.5 42Q29.5 50 31 56Q34 50 35.5 44Z", d)}</g>`;
        break;
      case 3: // top bun
        back = `<g class='sw'>${C(50, 13.5, 9)}${C(50, 13.5, 9, "none")}</g>`;
        front = `<g class='sw'>${P("M31.5 42Q30 22 50 20.5Q70 22 68.5 42Q63 31 50 30.5Q37 31 31.5 42Z")}${C(50, 21.5, 2.2, shade(c, -0.35))}<path d='M42 10Q50 7 58 10' stroke='${L}' stroke-width='1.1' fill='none' stroke-linecap='round' opacity='.6'/></g>`;
        break;
      case 4: // curly puff
        back = `<g class='sw'>${C(31, 36, 9)}${C(39, 25, 10)}${C(50, 21, 11)}${C(61, 25, 10)}${C(69, 36, 9)}${C(28, 49, 7)}${C(72, 49, 7)}${C(32, 58, 5.5)}${C(68, 58, 5.5)}</g>`;
        front = `<g class='sw'>${P("M32.5 40Q32 26 50 24.5Q68 26 67.5 40Q62 31 50 30Q38 31 32.5 40Z")}${C(38, 29, 3.4, L)}${C(46, 27, 3.4, L)}${C(54, 27, 3.4, L)}${C(62, 29, 3.4, L)}</g>`;
        break;
      default: // twin braids
        back = `<g class='pt'>${P("M30 44Q27 20 50 19Q73 20 70 44Z")}${[52, 59, 66, 73].map((y, i) => C(i % 2 ? 28.4 : 30.4, y, 4.2)).join("")}${[52, 59, 66, 73].map((y, i) => C(i % 2 ? 71.6 : 69.6, y, 4.2)).join("")}${C(29.4, 79, 2.6, shade(c, -0.35))}${C(70.6, 79, 2.6, shade(c, -0.35))}</g>`;
        front = `<g class='sw'>${P("M31.5 42Q30 22 50 20.5Q70 22 68.5 42Q64 30 50 29.5Q36 30 31.5 42Z")}<path d='M50 21V29.5' stroke='${d}' stroke-width='.9'/></g>`;
    }
  } else {
    switch (h) {
      case 0: // classic side part
        front = `<g class='sw'>${P("M32 41Q30 21 50 20Q70 21 68 41Q66 31 57 29Q43 33 32 41Z")}${P("M32 41Q32.5 36 35 33Q34 38 34.5 42Z", d)}</g>`;
        break;
      case 1: // quiff
        front = `<g class='sw'>${P("M32 42Q27 20 45 16.5Q62 13 69 24Q72 33 68 42Q66 32 56 29.5Q42 31 32 42Z")}${P("M45 16.5Q58 14 66 22Q56 19 45 21Z", L)}</g>`;
        break;
      case 2: // short crop
        front = `<g class='sw'>${P("M32.5 38Q32.5 23.5 50 22Q67.5 23.5 67.5 38Q60.5 31 50 31Q39.5 31 32.5 38Z")}</g>`;
        break;
      case 3: // curls
        front = `<g class='sw'>${C(36, 28, 7)}${C(44, 22.5, 7.4)}${C(52, 21.5, 7.4)}${C(60, 23.5, 7)}${C(66, 30, 6.4)}${C(33, 36, 5.6)}${C(41, 29, 3, L)}${C(57, 26, 3, L)}</g>`;
        break;
      case 4: // wavy medium
        back = `<g class='sw'>${P("M30.5 42Q26 19 50 18.5Q74 19 69.5 42L72.5 62Q64 58 62 50L38 50Q36 58 27.5 62Z")}</g>`;
        front = `<g class='sw'>${P("M31.5 42Q30 22 50 20Q70 22 68.5 42Q64 31 54 29Q46 33 40 33Q35 36 31.5 42Z")}</g>`;
        break;
      default: // spikes
        front = `<g class='sw'>${P("M33.5 38L35 23L41 30L45 17L50 28L55 17L59 30L65 23L66.5 38Q50 29 33.5 38Z")}</g>`;
    }
  }
  return { back, front };
}

/* ---------------- eyes / brows / mouth ---------------- */
function eyes(g, k, mo) {
  const f = g === "f";
  const lash = f && (k === 0 || k === 1 || k === 4)
    ? `<path d='M40.6 42.4L39 41.2M59.4 42.4L61 41.2' stroke='${INK}' stroke-width='1' stroke-linecap='round'/>` : "";
  let l, r;
  const one = (x) => {
    switch (k) {
      case 0: return `<ellipse class='bl' cx='${x}' cy='43.5' rx='2.1' ry='2.7' fill='${INK}'/><circle cx='${x + .8}' cy='42.5' r='.8' fill='#fff'/>`;
      case 1: return `<ellipse class='bl' cx='${x}' cy='43.5' rx='2.8' ry='3.4' fill='${INK}'/><circle cx='${x + 1}' cy='42.2' r='1.1' fill='#fff'/><circle cx='${x - 1}' cy='44.8' r='.6' fill='#fff'/>`;
      case 2: return `<path d='M${x - 2.6} 44.8Q${x} 40.8 ${x + 2.6} 44.8' fill='none' stroke='${INK}' stroke-width='1.8' stroke-linecap='round'/>`;
      case 3: return `<path d='M${x - 2.4} 43.6Q${x} 47.2 ${x + 2.4} 43.6Z' fill='${INK}'/><path d='M${x - 2.8} 43.6H${x + 2.8}' stroke='${INK}' stroke-width='1.2' stroke-linecap='round'/>`;
      default: return `<ellipse class='bl' cx='${x}' cy='43.8' rx='2.5' ry='1.9' fill='${INK}'/><circle cx='${x + .9}' cy='43.2' r='.7' fill='#fff'/>`;
    }
  };
  l = one(43);
  r = mo === 4 ? `<path d='M54.6 44.2Q57 41.4 59.4 44.2' fill='none' stroke='${INK}' stroke-width='1.7' stroke-linecap='round'/>` : one(57);
  return `<g class='ey'>${l}${r}${lash}</g>`;
}
const brows = (g, c) => {
  const w = g === "f" ? 1.3 : 1.9, col = shade(c, -0.1);
  return `<path d='M38.4 37Q43 34.4 47.2 36.4M52.8 36.4Q57 34.4 61.6 37' fill='none' stroke='${col}' stroke-width='${w}' stroke-linecap='round'/>`;
};
function mouth(k) {
  switch (k) {
    case 0: return `<path d='M44.8 53.8Q50 58.8 55.2 53.8' fill='none' stroke='${MOUTH}' stroke-width='1.7' stroke-linecap='round'/>`;
    case 1: return `<path d='M44 53Q50 54 56 53Q55 60.6 50 60.6Q45 60.6 44 53Z' fill='#8f2d3a'/><path d='M45.4 53.4Q50 54.2 54.6 53.4V55.2H45.4Z' fill='#fff'/>`;
    case 2: return `<path d='M46.6 54.2Q50 56.6 53.4 54.2' fill='none' stroke='${MOUTH}' stroke-width='1.6' stroke-linecap='round'/>`;
    case 3: return `<path d='M46.6 55H53.4' stroke='${MOUTH}' stroke-width='1.6' stroke-linecap='round'/>`;
    default: return `<path d='M45.4 54.8Q50 57.4 55.6 53.2' fill='none' stroke='${MOUTH}' stroke-width='1.7' stroke-linecap='round'/>`;
  }
}

/* ---------------- glasses ---------------- */
function glasses(k) {
  if (!k) return "";
  const s = `stroke='#2b2f36' stroke-width='1.2' fill='rgba(255,255,255,.14)'`;
  const frame = k === 1
    ? `<circle cx='43' cy='43.6' r='5.6' ${s}/><circle cx='57' cy='43.6' r='5.6' ${s}/>`
    : `<rect x='37.4' y='39.4' width='11.2' height='8.6' rx='2.6' ${s}/><rect x='51.4' y='39.4' width='11.2' height='8.6' rx='2.6' ${s}/>`;
  return frame + `<path d='M48.4 43Q50 41.8 51.6 43M37.4 43L33.6 42M62.6 43L66.4 42' fill='none' stroke='#2b2f36' stroke-width='1.2' stroke-linecap='round'/>`;
}

/* ---------------- extras (drawn over the hair) ---------------- */
function extra(id, dcol, hairc) {
  switch (id) {
    case 1:
      return `<path d='M31 41Q30 16.5 50 16.5Q70 16.5 69 41' fill='none' stroke='#2b2f36' stroke-width='2.6' stroke-linecap='round'/><rect x='27.6' y='39' width='6' height='12' rx='3' fill='#2b2f36'/><rect x='66.4' y='39' width='6' height='12' rx='3' fill='#2b2f36'/><circle cx='30.6' cy='45' r='1.5' fill='${dcol}'/><circle cx='69.4' cy='45' r='1.5' fill='${dcol}'/>`;
    case 2:
      return `<path d='M32 34Q32.5 16.5 50 16Q67.5 16.5 68 34Z' fill='${dcol}'/><path d='M33 34H67Q75 35.6 71 38H37Q30 37 33 34Z' fill='${shade(dcol, -0.22)}'/><circle cx='50' cy='16.3' r='1.8' fill='${shade(dcol, -0.22)}'/>`;
    case 3:
      return `<path d='M38 27.5V35Q50 40 62 35V27.5Z' fill='#1f2933'/><path d='M50 14L79 24.5L50 34L21 24.5Z' fill='#2b3440'/><path d='M50 14L79 24.5L50 34' fill='none' stroke='#fff' stroke-opacity='.18' stroke-width='.8'/><circle cx='50' cy='24.3' r='1.6' fill='#f2b632'/><g class='ts'><path d='M50 24.3L73.5 25.6V38' fill='none' stroke='#f2b632' stroke-width='1.2'/><circle cx='73.5' cy='39.2' r='2.1' fill='#f2b632'/></g>`;
    case 4:
      return `<g transform='translate(63 28)'>${[0, 72, 144, 216, 288].map(a => `<circle cx='${(Math.cos(a * Math.PI / 180) * 3).toFixed(1)}' cy='${(Math.sin(a * Math.PI / 180) * 3).toFixed(1)}' r='2.5' fill='#ff8fab'/>`).join("")}<circle r='1.9' fill='#ffd43b'/></g>`;
    case 5:
      return `<circle cx='33' cy='50' r='1.4' fill='#f2b632'/><circle cx='33' cy='53.2' r='2' fill='#f2b632'/><circle cx='67' cy='50' r='1.4' fill='#f2b632'/><circle cx='67' cy='53.2' r='2' fill='#f2b632'/>`;
    case 6:
      return `<path d='M32 38Q50 17.5 68 38' fill='none' stroke='${dcol}' stroke-width='2.8' stroke-linecap='round'/>`;
    default: return "";
  }
}

/* ---------------- body / dress ---------------- */
function body(g, dr, c, ini, letter) {
  const c2 = shade(c, -0.2), c3 = shade(c, 0.28);
  const W = "#f8f9fa";
  let neckline = "Q50 78 56 72";
  if ((g === "f" && dr === 0) || (g === "m" && dr === 4) || (g === "f" && dr === 3)) neckline = "Q50 90 56 72";
  if (g === "m" && dr === 1) neckline = "Q50 84 56 72";
  if (g === "m" && dr === 2) neckline = "Q50 76 56 72";
  const base = `<path d='M10 100Q10 77 34 72Q42 71 44 72${neckline}Q58 71 66 72Q90 77 90 100Z' fill='${c}'/>`;
  let hood = "", add = "", lx = 50, ly = 91, lr = 6;
  const hoodie = (g === "f" && dr === 2) || (g === "m" && dr === 3);
  if (hoodie) {
    hood = `<path d='M27 74Q28 60 50 60Q72 60 73 74Q50 88 27 74Z' fill='${c2}'/>`;
    add = `<path d='M45 77V86M55 77V86' stroke='#fff' stroke-width='1.2' stroke-linecap='round'/><circle cx='45' cy='86.6' r='1.2' fill='#fff'/><circle cx='55' cy='86.6' r='1.2' fill='#fff'/><path d='M34 73Q50 80 66 73' fill='none' stroke='${c2}' stroke-width='2.4'/>`;
    ly = 93; lr = 5.4;
  } else if (g === "f" && dr === 0) { // kurti, V trim
    add = `<path d='M44 72Q50 90 56 72' fill='none' stroke='${c3}' stroke-width='1.8'/><path d='M50 88V100' stroke='${c3}' stroke-width='1' stroke-dasharray='1.5 1.5'/>`;
    lx = 50; ly = 94; lr = 5;
  } else if (g === "f" && dr === 1) { // school dress: collar + bow
    add = `<path d='M43 72L50 79L40 80Z' fill='${W}'/><path d='M57 72L50 79L60 80Z' fill='${W}'/><path d='M50 80L44 76.5V83.5ZM50 80L56 76.5V83.5Z' fill='#e03131'/><circle cx='50' cy='80' r='1.8' fill='#c92a2a'/>`;
    ly = 93; lr = 5.6;
  } else if ((g === "f" && dr === 3) || (g === "m" && dr === 4)) { // blazer
    add = `<path d='M43 72L50 90L57 72Z' fill='${W}'/><path d='M36 71.5L44.5 72L50 91L41 96Z' fill='${c2}'/><path d='M64 71.5L55.5 72L50 91L59 96Z' fill='${c2}'/>` +
      (g === "m" ? `<path d='M48 76h4l1 3h-6zM47.2 79.4h5.6l1.6 16-4.4 3.4-4.4-3.4z' fill='#c92a2a'/>` : "");
    lx = 31; ly = 91; lr = 4.8;
  } else if (g === "f" && dr === 4) { // saree
    add = `<path d='M14 80Q24 72 37 72L92 100H62Z' fill='${c3}'/><path d='M37 72L62 100' stroke='#f2b632' stroke-width='1.6'/><path d='M40 72.6L66 100' stroke='#f2b632' stroke-width='.6' stroke-dasharray='1.4 1.4'/>`;
    lx = 71; ly = 87; lr = 4.6;
  } else if (g === "m" && dr === 0) { // t-shirt
    add = `<path d='M40 72.6Q50 79 60 72.6' fill='none' stroke='${c2}' stroke-width='2'/>`;
  } else if (g === "m" && dr === 1) { // shirt
    add = `<path d='M41 70.5L50 84L38.4 78.4Z' fill='${W}'/><path d='M59 70.5L50 84L61.6 78.4Z' fill='${W}'/><path d='M50 84V100' stroke='${c2}' stroke-width='.9'/><circle cx='50' cy='90' r='.9' fill='${c2}'/><circle cx='50' cy='96' r='.9' fill='${c2}'/>`;
    lx = 33; ly = 91; lr = 4.8;
  } else if (g === "m" && dr === 2) { // panjabi
    add = `<path d='M43 71.5Q50 77 57 71.5V77Q50 82 43 77Z' fill='${c2}'/><path d='M50 80V100' stroke='${c3}' stroke-width='3'/><circle cx='50' cy='84' r='1' fill='#f2b632'/><circle cx='50' cy='90' r='1' fill='#f2b632'/><circle cx='50' cy='96' r='1' fill='#f2b632'/>`;
    lx = 31; ly = 90; lr = 4.8;
  }
  const dark = lum(c) < 0.55;
  const letterSvg = ini && letter
    ? `<circle cx='${lx}' cy='${ly}' r='${lr}' fill='${dark ? "#fff" : "#2b2118"}' fill-opacity='.92'/><text x='${lx}' y='${ly + lr * 0.36}' text-anchor='middle' font-size='${(lr * 1.28).toFixed(1)}' font-weight='800' font-family='${FONT}' fill='${dark ? c : "#fff"}'>${esc(letter)}</text>`
    : "";
  return { hood, base, add: add + letterSvg };
}

/* ---------------- main ---------------- */
function initialOf(name) {
  const ch = Array.from(String(name || "").trim())[0] || "";
  return /[a-z]/.test(ch) ? ch.toUpperCase() : ch;
}

export function buildAvatarSvg(cfgIn, { name = "", animate = true } = {}) {
  const c = normalizeConfig(cfgIn);
  const skin = SKINS[c.sk], sd = shade(skin, -0.1), sd2 = shade(skin, -0.22);
  const hc = HAIR_COLORS[c.hc], dcol = DRESS_COLORS[c.dc];
  const [b1, b2] = BACKGROUNDS[c.bg];
  const H = hair(c.g, c.h, hc);
  const B = body(c.g, c.dr, dcol, c.ini, initialOf(name));
  const beard = c.ex === 7 ? `<path d='M32.6 46Q33 63 50 66.5Q67 63 67.4 46Q64 57 50 58Q36 57 32.6 46Z' fill='${shade(hc, -0.05)}'/>` : "";
  const cfgStr = KEYS.map(k => (k === "g" ? (c.g === "m" ? 1 : 0) : c[k])).join(".");
  return `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><!--AV:${cfgStr}-->` +
    (animate ? `<style>${CSS}</style>` : "") +
    `<defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='${b1}'/><stop offset='1' stop-color='${b2}'/></linearGradient></defs>` +
    `<rect width='100' height='100' fill='url(#g)'/>` +
    `<path class='tw' d='M84 15l1.6 3.8 3.8 1.6-3.8 1.6-1.6 3.8-1.6-3.8-3.8-1.6 3.8-1.6z' fill='#fff' opacity='.85'/>` +
    `<path class='tw t2' d='M15 30l1.1 2.6 2.6 1.1-2.6 1.1-1.1 2.6-1.1-2.6-2.6-1.1 2.6-1.1z' fill='#fff' opacity='.7'/>` +
    `<g class='bd'>${B.hood}<path d='M44 56h12v20q-6 6-12 0z' fill='${sd}'/>${B.base}${B.add}</g>` +
    `<g class='hd'>${H.back}` +
    `<circle cx='32.8' cy='44.5' r='3.5' fill='${skin}'/><circle cx='67.2' cy='44.5' r='3.5' fill='${skin}'/>` +
    `<ellipse cx='50' cy='42' rx='${c.g === "m" ? 17.8 : 17.3}' ry='19.6' fill='${skin}'/>` +
    `<circle cx='39.2' cy='50.4' r='3.3' fill='#ff7b8a' opacity='.28'/><circle cx='60.8' cy='50.4' r='3.3' fill='#ff7b8a' opacity='.28'/>` +
    beard + brows(c.g, hc) + eyes(c.g, c.ey, c.mo) +
    `<path d='M49.4 47.6Q50.4 49.8 52 48.9' fill='none' stroke='${sd2}' stroke-width='1' stroke-linecap='round'/>` +
    mouth(c.mo) + glasses(c.gl) + H.front + extra(c.ex, dcol, hc) + `</g></svg>`;
}

/* ---------------- data URI (compact encoding) ---------------- */
function toUri(svg) {
  // only the characters that would break a data: URI are escaped; the rest
  // stays readable, which keeps the stored string short (rules limit: 12000)
  const body = svg.replace(/%/g, "%25").replace(/#/g, "%23").replace(/</g, "%3C").replace(/>/g, "%3E")
    .replace(/[\u0080-\uFFFF]/g, ch => encodeURIComponent(ch));
  return "data:image/svg+xml;utf8," + body;
}
export function avatarUri(cfg, name = "", animate = true) {
  return toUri(buildAvatarSvg(cfg, { name, animate }));
}

export function parseAvatarConfig(uri) {
  if (typeof uri !== "string" || !uri.startsWith("data:image/svg+xml")) return null;
  try {
    const raw = decodeURIComponent(uri.slice(uri.indexOf(",") + 1));
    const m = raw.match(/<!--AV:([\d.]+)-->/);
    if (!m) return null;
    const v = m[1].split(".").map(Number);
    if (v.length < KEYS.length) return null;
    const o = {};
    KEYS.forEach((k, i) => { o[k] = k === "g" ? (v[i] ? "m" : "f") : v[i]; });
    return normalizeConfig(o);
  } catch { return null; }
}
