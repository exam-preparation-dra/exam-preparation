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
export const DRESS_COLORS = ["#e8590c", "#1971c2", "#2f9e44", "#c2255c", "#7048e8", "#343a40", "#f08c00", "#e03131",
  "#0c8599", "#868e96", "#12b886", "#f783ac", "#4dabf7", "#ffd43b", "#862e9c", "#f1f3f5"];
export const EYE_COLORS = ["#4b2e1e", "#2b2118", "#8a6a2f", "#3f7d4e", "#3b6ea5", "#6b7280"];
export const PATTERNS = ["সাদামাটা", "ডোরাকাটা", "চেক", "ডট", "ছোট ফুল", "দুই রঙের ছায়া"];
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
const KEYS = ["g", "sk", "h", "hc", "ey", "mo", "dr", "dc", "gl", "ex", "bg", "ini", "ec", "pt", "d2"];
const OLD_KEYS = 12;   // avatars saved before ec/pt/d2 existed still open

export function defaultConfig(g = "f") {
  return g === "m"
    ? { g: "m", sk: 2, h: 0, hc: 1, ey: 0, mo: 0, dr: 1, dc: 1, gl: 0, ex: 0, bg: 1, ini: 1, ec: 0, pt: 0, d2: 7 }
    : { g: "f", sk: 1, h: 0, hc: 0, ey: 1, mo: 0, dr: 0, dc: 3, gl: 0, ex: 0, bg: 3, ini: 1, ec: 0, pt: 0, d2: 6 };
}

const clamp = (v, n) => Math.max(0, Math.min(n - 1, Number.isFinite(+v) ? Math.floor(+v) : 0));
export function normalizeConfig(c) {
  const g = c?.g === "m" ? "m" : "f";
  const out = {
    g,
    sk: clamp(c?.sk, SKINS.length), h: clamp(c?.h, 6), hc: clamp(c?.hc, HAIR_COLORS.length),
    ey: clamp(c?.ey, EYES.length), mo: clamp(c?.mo, MOUTHS.length), dr: clamp(c?.dr, 5),
    dc: clamp(c?.dc, DRESS_COLORS.length), gl: clamp(c?.gl, GLASSES.length),
    ex: +c?.ex || 0, bg: clamp(c?.bg, BACKGROUNDS.length), ini: c?.ini ? 1 : 0,
    ec: clamp(c?.ec, EYE_COLORS.length), pt: clamp(c?.pt, PATTERNS.length),
    d2: clamp(c?.d2 ?? 6, DRESS_COLORS.length)
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
// fills use the shared vertical gradient #hr; thin light strokes add strand highlights
function hair(g, h, c) {
  const d = shade(c, -0.22), L = shade(c, 0.3);
  const P = (dd, f = "url(#hr)") => `<path d='${dd}' fill='${f}'/>`;
  const C = (x, y, r, f = "url(#hr)") => `<circle cx='${x}' cy='${y}' r='${r}' fill='${f}'/>`;
  const S = (dd, o = 0.4) => `<path d='${dd}' fill='none' stroke='${L}' stroke-width='.8' stroke-linecap='round' opacity='${o}'/>`;
  let back = "", front = "";
  if (g === "f") {
    switch (h) {
      case 0: // long, centre parting
        back = `<g class='sw'>${P("M30 40Q27 20 50 19Q73 20 70 40L75 80Q62 85 50 82Q38 85 25 80Z")}${S("M31 52Q29 66 28 78", .3)}${S("M69 52Q71 66 72 78", .3)}</g>`;
        front = `<g class='sw'>${P("M31.5 42Q30 22 50 20.5Q70 22 68.5 42Q64 30 50 29.5Q36 30 31.5 42Z")}${P("M31 42Q29.5 62 27 76Q36 70 35.5 52Q34 46 31 42Z", d)}${P("M69 42Q70.5 62 73 76Q64 70 64.5 52Q66 46 69 42Z", d)}<path d='M50 21V29.5' stroke='${d}' stroke-width='.9'/>${S("M40 24Q35 32 33.5 42")}${S("M60 24Q65 32 66.5 42")}${S("M44 22.4Q40 27 38.4 33", .3)}</g>`;
        break;
      case 1: // bob with fringe
        back = `<g class='sw'>${P("M30.5 44Q26 19 50 18.5Q74 19 69.5 44L70.5 61Q50 67 29.5 61Z")}</g>`;
        front = `<g class='sw'>${P("M31.5 41Q31 22 50 20.5Q69 22 68.5 41L68 34Q50 38 32 34Z")}${P("M31 44Q29.5 56 30.5 60Q36 58 36 50Z", d)}${P("M69 44Q70.5 56 69.5 60Q64 58 64 50Z", d)}${S("M40 22.5Q34 28 33 36")}${S("M47 22Q42 28 41 34", .3)}${S("M33 46Q31.6 53 32 58", .3)}</g>`;
        break;
      case 2: // ponytail
        back = `<g class='pt'>${P("M63 27Q86 22 82 50Q80 64 73 72Q75 54 67 42Z")}${S("M70 32Q80 38 78 56", .35)}${C(65, 29, 2.4, shade(c, -0.4))}</g>`;
        front = `<g class='sw'>${P("M31.5 42Q30 22 50 20.5Q70 22 68.5 42Q62 33 50 31Q40 32 31.5 42Z")}${P("M31.5 42Q29.5 50 31 56Q34 50 35.5 44Z", d)}${S("M40 23Q35 30 34 38")}${S("M52 21.5Q60 24 64 31", .35)}</g>`;
        break;
      case 3: // top bun
        back = `<g class='sw'>${C(50, 13.5, 9)}${S("M44 10Q50 6.6 56 10", .45)}${S("M43.6 15Q50 12 56.4 15", .3)}</g>`;
        front = `<g class='sw'>${P("M31.5 42Q30 22 50 20.5Q70 22 68.5 42Q63 31 50 30.5Q37 31 31.5 42Z")}${C(50, 21.5, 2.2, shade(c, -0.4))}${S("M40 24Q35 30 34 38")}${S("M60 24Q65 30 66 38", .3)}</g>`;
        break;
      case 4: // curly puff
        back = `<g class='sw'>${C(31, 36, 9)}${C(39, 25, 10)}${C(50, 21, 11)}${C(61, 25, 10)}${C(69, 36, 9)}${C(28, 49, 7)}${C(72, 49, 7)}${C(32, 58, 5.5)}${C(68, 58, 5.5)}${C(44, 20, 2.6, L)}${C(58, 22, 2.2, L)}${C(33, 33, 2, L)}</g>`;
        front = `<g class='sw'>${P("M32.5 40Q32 26 50 24.5Q68 26 67.5 40Q62 31 50 30Q38 31 32.5 40Z")}${C(38, 29, 3.4, L)}${C(46, 27, 3.4, L)}${C(54, 27, 3.4, L)}${C(62, 29, 3.4, L)}</g>`;
        break;
      default: // twin braids
        back = `<g class='pt'>${P("M30 44Q27 20 50 19Q73 20 70 44Z")}${[52, 59, 66, 73].map((y, i) => C(i % 2 ? 28.4 : 30.4, y, 4.2)).join("")}${[52, 59, 66, 73].map((y, i) => C(i % 2 ? 71.6 : 69.6, y, 4.2)).join("")}${C(29.4, 79, 2.6, shade(c, -0.4))}${C(70.6, 79, 2.6, shade(c, -0.4))}</g>`;
        front = `<g class='sw'>${P("M31.5 42Q30 22 50 20.5Q70 22 68.5 42Q64 30 50 29.5Q36 30 31.5 42Z")}<path d='M50 21V29.5' stroke='${d}' stroke-width='.9'/>${S("M40 24Q35 31 34 40")}${S("M60 24Q65 31 66 40", .3)}</g>`;
    }
  } else {
    switch (h) {
      case 0: // classic side part
        front = `<g class='sw'>${P("M32 41Q30 21 50 20Q70 21 68 41Q66 31 57 29Q43 33 32 41Z")}${P("M32 41Q32.5 36 35 33Q34 38 34.5 42Z", d)}${S("M42 22Q36 27 34 34")}${S("M52 21Q62 23 65 31", .35)}${S("M47 28Q53 27 57 29", .3)}</g>`;
        break;
      case 1: // quiff
        front = `<g class='sw'>${P("M32 42Q27 20 45 16.5Q62 13 69 24Q72 33 68 42Q66 32 56 29.5Q42 31 32 42Z")}${S("M44 17.5Q58 14.5 66 22", .55)}${S("M36 30Q38 22 46 19", .35)}${S("M52 20Q62 20 67 28", .3)}</g>`;
        break;
      case 2: // short crop
        front = `<g class='sw'>${P("M32.5 38Q32.5 23.5 50 22Q67.5 23.5 67.5 38Q60.5 31 50 31Q39.5 31 32.5 38Z")}${S("M40 24.6Q50 22.6 60 24.6", .4)}${S("M36 31Q35 27 38 25", .3)}</g>`;
        break;
      case 3: // curls
        front = `<g class='sw'>${C(36, 28, 7)}${C(44, 22.5, 7.4)}${C(52, 21.5, 7.4)}${C(60, 23.5, 7)}${C(66, 30, 6.4)}${C(33, 36, 5.6)}${C(41, 29, 3, L)}${C(57, 26, 3, L)}${C(48, 21, 2.2, L)}${C(64, 28, 1.8, L)}</g>`;
        break;
      case 4: // wavy medium
        back = `<g class='sw'>${P("M30.5 42Q26 19 50 18.5Q74 19 69.5 42L72.5 62Q64 58 62 50L38 50Q36 58 27.5 62Z")}${S("M31 50Q29 56 28.6 60", .3)}</g>`;
        front = `<g class='sw'>${P("M31.5 42Q30 22 50 20Q70 22 68.5 42Q64 31 54 29Q46 33 40 33Q35 36 31.5 42Z")}${S("M40 22.4Q34 28 33 37")}${S("M52 20.6Q62 22 66 30", .35)}${S("M42 30Q48 29 54 28.6", .3)}</g>`;
        break;
      default: // spikes
        front = `<g class='sw'>${P("M33.5 38L35 23L41 30L45 17L50 28L55 17L59 30L65 23L66.5 38Q50 29 33.5 38Z")}${S("M42 29L45 19", .5)}${S("M56 29L55.5 19.4", .4)}${S("M36.4 30L36 25", .35)}</g>`;
    }
  }
  return { back, front };
}

/* ---------------- eyes / brows / mouth ---------------- */
function eyes(g, k, mo, iris, skin) {
  const f = g === "f";
  const lids = (x, rot = 0, rx = 3.6, top = 40.9) =>
    `<path d='M${x - rx} 43.5Q${x} ${top} ${x + rx} 43.5' fill='none' stroke='${INK}' stroke-width='1.25' stroke-linecap='round' transform='rotate(${rot} ${x} 43.6)'/>` +
    `<path d='M${x - rx + .6} 41.9Q${x} ${top - 1.9} ${x + rx - .6} 41.9' fill='none' stroke='${shade(skin, -0.3)}' stroke-width='.55' opacity='.55'/>`;
  const one = (x, side) => {
    const out = side * 1; // +1 right eye, -1 left eye
    const lash = f ? `<path d='M${x + out * 3.5} 43.1L${x + out * 4.9} 41.8' stroke='${INK}' stroke-width='.9' stroke-linecap='round'/>` : "";
    if (k === 2) { // happy arcs
      return `<path d='M${x - 3} 44.6Q${x} 40.8 ${x + 3} 44.6' fill='none' stroke='${INK}' stroke-width='1.7' stroke-linecap='round'/>${f ? lash : ""}`;
    }
    const big = k === 1, sharp = k === 4;
    const rx = big ? 3.9 : sharp ? 3.7 : 3.5, ry = big ? 3.2 : sharp ? 2 : 2.6, ir = big ? 2.55 : sharp ? 1.75 : 2.1;
    const rot = sharp ? -out * 5 : 0;
    let s = `<g class='bl'><ellipse cx='${x}' cy='43.6' rx='${rx}' ry='${ry}' fill='#fdfcfa' transform='rotate(${rot} ${x} 43.6)'/>` +
      `<g class='ey'><circle cx='${x}' cy='43.7' r='${ir}' fill='${iris}'/><circle cx='${x}' cy='43.7' r='${ir * 0.5}' fill='#111'/><circle cx='${x + ir * 0.45}' cy='${43.7 - ir * 0.45}' r='${big ? 1.05 : .75}' fill='#fff'/>${big ? `<circle cx='${x - ir * 0.4}' cy='${43.7 + ir * 0.4}' r='.5' fill='#fff' opacity='.85'/>` : ""}</g>`;
    if (k === 3) s += `<path d='M${x - 3.8} 43.4Q${x} 45 ${x + 3.8} 43.4V39.6H${x - 3.8}Z' fill='${skin}'/><path d='M${x - 3.8} 43.4Q${x} 45 ${x + 3.8} 43.4' fill='none' stroke='${INK}' stroke-width='1.2' stroke-linecap='round'/>`;
    else s += lids(x, rot, rx, big ? 40.2 : 40.9);
    return s + `</g>` + (k === 3 ? "" : lash);
  };
  const right = mo === 4 // wink
    ? `<path d='M53.8 44.2Q57 41 60.2 44.2' fill='none' stroke='${INK}' stroke-width='1.6' stroke-linecap='round'/>` + (f ? `<path d='M60.2 43.6L61.6 42.4' stroke='${INK}' stroke-width='.9' stroke-linecap='round'/>` : "")
    : one(57, 1);
  return one(43, -1) + right;
}
const brows = (g, c) => {
  const col = shade(c, -0.12);
  return g === "f"
    ? `<path d='M37.8 38.4Q42.4 34.4 47.6 36.6Q42.8 36 37.8 38.4Z' fill='${col}'/><path d='M62.2 38.4Q57.6 34.4 52.4 36.6Q57.2 36 62.2 38.4Z' fill='${col}'/>`
    : `<path d='M37.6 38.6Q42 34.6 47.8 36.2L47.8 37.8Q42.8 36.6 37.8 39.8Z' fill='${col}'/><path d='M62.4 38.6Q58 34.6 52.2 36.2L52.2 37.8Q57.2 36.6 62.2 39.8Z' fill='${col}'/>`;
};
function mouth(k, lip) {
  const dk = shade(lip, -0.45);
  switch (k) {
    case 0: return `<path d='M44.6 53.5Q47.4 52.2 50 53Q52.6 52.2 55.4 53.5Q50 59.8 44.6 53.5Z' fill='${lip}'/><path d='M44.6 53.5Q50 55.6 55.4 53.5' fill='none' stroke='${dk}' stroke-width='.6' stroke-linecap='round'/><path d='M46.6 56.3Q50 58 53.4 56.3' fill='none' stroke='#fff' stroke-width='.5' opacity='.35'/>`;
    case 1: return `<path d='M44 53Q50 54.4 56 53Q55.4 60.8 50 60.8Q44.6 60.8 44 53Z' fill='#7a2230'/><path d='M45.2 53.5Q50 54.6 54.8 53.5V55.6Q50 56.4 45.2 55.6Z' fill='#fff'/><path d='M46.4 58.6Q50 56.8 53.6 58.6Q50 61 46.4 58.6Z' fill='#e0707e'/><path d='M44 53Q47 51.8 50 52.8Q53 51.8 56 53' fill='none' stroke='${lip}' stroke-width='1.1' stroke-linecap='round'/>`;
    case 2: return `<path d='M46.2 53.9Q48.2 53 50 53.6Q51.8 53 53.8 53.9Q50 57.6 46.2 53.9Z' fill='${lip}'/><path d='M46.2 53.9Q50 55.4 53.8 53.9' fill='none' stroke='${dk}' stroke-width='.55' stroke-linecap='round'/>`;
    case 3: return `<path d='M46.2 54.3Q48.2 53.2 50 53.8Q51.8 53.2 53.8 54.3Q50 57 46.2 54.3Z' fill='${lip}'/><path d='M46.2 54.3Q50 55 53.8 54.3' fill='none' stroke='${dk}' stroke-width='.6' stroke-linecap='round'/>`;
    default: return `<path d='M45 54.6Q47.6 53.4 50 54Q52.8 52.6 56 52.8Q55 58.2 50 57.4Q47 57 45 54.6Z' fill='${lip}'/><path d='M45 54.6Q50 55.8 56 52.8' fill='none' stroke='${dk}' stroke-width='.6' stroke-linecap='round'/>`;
  }
}

/* ---------------- glasses ---------------- */
function glasses(k) {
  if (!k) return "";
  const s = `stroke='#2b2f36' stroke-width='1.15' fill='#cfe8ff' fill-opacity='.16'`;
  const frame = k === 1
    ? `<circle cx='43' cy='43.6' r='5.7' ${s}/><circle cx='57' cy='43.6' r='5.7' ${s}/><path d='M39.6 40.4Q41.6 39.4 43.4 39.6' fill='none' stroke='#fff' stroke-width='.8' stroke-linecap='round' opacity='.6'/>`
    : `<rect x='37.4' y='39.4' width='11.2' height='8.6' rx='2.6' ${s}/><rect x='51.4' y='39.4' width='11.2' height='8.6' rx='2.6' ${s}/><path d='M39 41.2H42.4' stroke='#fff' stroke-width='.8' stroke-linecap='round' opacity='.6'/>`;
  return frame + `<path d='M48.6 43Q50 41.8 51.4 43M37.4 43L33.6 42M62.6 43L66.4 42' fill='none' stroke='#2b2f36' stroke-width='1.15' stroke-linecap='round'/>`;
}

/* ---------------- extras (drawn over the hair) ---------------- */
function extra(id, dcol, d2col, hairc) {
  switch (id) {
    case 1:
      return `<path d='M31 41Q30 16.5 50 16.5Q70 16.5 69 41' fill='none' stroke='#2b2f36' stroke-width='2.6' stroke-linecap='round'/><rect x='27.6' y='39' width='6' height='12' rx='3' fill='#2b2f36'/><rect x='66.4' y='39' width='6' height='12' rx='3' fill='#2b2f36'/><circle cx='30.6' cy='45' r='1.5' fill='${d2col}'/><circle cx='69.4' cy='45' r='1.5' fill='${d2col}'/>`;
    case 2:
      return `<path d='M32 34Q32.5 16.5 50 16Q67.5 16.5 68 34Z' fill='${dcol}'/><path d='M40 17.4Q50 14.6 60 17.4' fill='none' stroke='#fff' stroke-width='.8' opacity='.35'/><path d='M33 34H67Q75 35.6 71 38H37Q30 37 33 34Z' fill='${d2col}'/><circle cx='50' cy='16.3' r='1.8' fill='${d2col}'/>`;
    case 3:
      return `<path d='M38 27.5V35Q50 40 62 35V27.5Z' fill='#1f2933'/><path d='M50 14L79 24.5L50 34L21 24.5Z' fill='#2b3440'/><path d='M50 14L79 24.5L50 34' fill='none' stroke='#fff' stroke-opacity='.18' stroke-width='.8'/><circle cx='50' cy='24.3' r='1.6' fill='#f2b632'/><g class='ts'><path d='M50 24.3L73.5 25.6V38' fill='none' stroke='#f2b632' stroke-width='1.2'/><circle cx='73.5' cy='39.2' r='2.1' fill='#f2b632'/></g>`;
    case 4:
      return `<g transform='translate(63 28)'>${[0, 72, 144, 216, 288].map(a => `<circle cx='${(Math.cos(a * Math.PI / 180) * 3).toFixed(1)}' cy='${(Math.sin(a * Math.PI / 180) * 3).toFixed(1)}' r='2.5' fill='${d2col}'/>`).join("")}<circle r='1.9' fill='#ffd43b'/></g>`;
    case 5:
      return `<circle cx='33' cy='50' r='1.4' fill='#f2b632'/><circle cx='33' cy='53.2' r='2' fill='#f2b632'/><circle cx='33' cy='53.2' r='.7' fill='#fff' opacity='.6'/><circle cx='67' cy='50' r='1.4' fill='#f2b632'/><circle cx='67' cy='53.2' r='2' fill='#f2b632'/><circle cx='67' cy='53.2' r='.7' fill='#fff' opacity='.6'/>`;
    case 6:
      return `<path d='M32 38Q50 17.5 68 38' fill='none' stroke='${d2col}' stroke-width='2.8' stroke-linecap='round'/>`;
    default: return "";
  }
}

/* ---------------- name on the dress: a neat name tag, full name ---------------- */
function graphemes(s) {
  try { return Array.from(new Intl.Segmenter("bn", { granularity: "grapheme" }).segment(s), x => x.segment); }
  catch { return Array.from(s); }
}
function cleanName(name) { return String(name || "").trim().replace(/\s+/g, " ").slice(0, 26); }
function nameTag(name, cx, cy, maxW, tone) {
  const nm = cleanName(name);
  if (!nm) return "";
  const cw = 0.62;                       // average glyph width in em
  const n1 = graphemes(nm).length;
  let lines = [nm], fs = Math.min(5, (maxW - 5) / (n1 * cw));
  if (fs < 3.9 && nm.includes(" ")) {    // long name -> two lines
    const mid = nm.length / 2;
    let cut = -1;
    for (let i = 0; i < nm.length; i++) if (nm[i] === " " && (cut < 0 || Math.abs(i - mid) < Math.abs(cut - mid))) cut = i;
    lines = [nm.slice(0, cut), nm.slice(cut + 1)];
    const n2 = Math.max(...lines.map(l => graphemes(l).length));
    fs = Math.min(4.6, (maxW - 5) / (n2 * cw));
  }
  fs = Math.max(2.9, fs);
  const widths = lines.map(l => graphemes(l).length * cw * fs);
  const w = Math.max(15, Math.min(maxW, Math.max(...widths) + 5));
  const lh = fs * 1.28, h = lines.length * lh + 3;
  const x0 = cx - w / 2, y0 = cy - h / 2;
  const txt = lines.map((l, i) =>
    `<text x='${cx}' y='${(y0 + 1.5 + lh * (i + 0.5) + fs * 0.34).toFixed(2)}' text-anchor='middle' font-size='${fs.toFixed(2)}' font-weight='800' font-family='${FONT}' fill='${tone.ink}' textLength='${Math.min(w - 4, widths[i]).toFixed(1)}' lengthAdjust='spacingAndGlyphs'>${esc(l)}</text>`).join("");
  return `<rect x='${x0.toFixed(1)}' y='${(y0 + .5).toFixed(1)}' width='${w.toFixed(1)}' height='${h.toFixed(1)}' rx='${Math.min(3.2, h / 2).toFixed(1)}' fill='#000' opacity='.18'/>` +
    `<rect x='${x0.toFixed(1)}' y='${y0.toFixed(1)}' width='${w.toFixed(1)}' height='${h.toFixed(1)}' rx='${Math.min(3.2, h / 2).toFixed(1)}' fill='${tone.bg}' fill-opacity='.95'/>` +
    `<rect x='${(x0 + .7).toFixed(1)}' y='${(y0 + .7).toFixed(1)}' width='${(w - 1.4).toFixed(1)}' height='${(h - 1.4).toFixed(1)}' rx='${Math.min(2.6, h / 2).toFixed(1)}' fill='none' stroke='${tone.edge}' stroke-width='.4'/>` + txt;
}

/* ---------------- body / dress ---------------- */
function body(g, dr, c, d2, ini, name) {
  const c2 = shade(c, -0.22), c3 = shade(c, 0.3);
  const W = "#f8f9fa";
  let neckline = "Q50 78 56 72";
  if ((g === "f" && dr === 0) || (g === "m" && dr === 4) || (g === "f" && dr === 3)) neckline = "Q50 90 56 72";
  if (g === "m" && dr === 1) neckline = "Q50 84 56 72";
  if (g === "m" && dr === 2) neckline = "Q50 76 56 72";
  const baseD = `M10 100Q10 77 34 72Q42 71 44 72${neckline}Q58 71 66 72Q90 77 90 100Z`;
  const base = `<path d='${baseD}' fill='url(#bd)'/>` +
    `<path d='M10 100Q10 77 26 73Q17 85 19 100Z' fill='#000' opacity='.12'/><path d='M90 100Q90 77 74 73Q83 85 81 100Z' fill='#000' opacity='.12'/>` +
    `<path d='M30 99Q33 90 38 83M70 99Q67 90 62 83' fill='none' stroke='${c2}' stroke-width='.9' stroke-linecap='round' opacity='.35'/>`;
  let hood = "", add = "", patD = baseD, tag = [50, 93.4, 36];
  const hoodie = (g === "f" && dr === 2) || (g === "m" && dr === 3);
  if (hoodie) {
    hood = `<path d='M27 74Q28 60 50 60Q72 60 73 74Q50 88 27 74Z' fill='${c2}'/><path d='M31 72Q50 82 69 72' fill='none' stroke='#000' stroke-width='1' opacity='.15'/>`;
    add = `<path d='M45 77V85M55 77V85' stroke='${d2}' stroke-width='1.2' stroke-linecap='round'/><circle cx='45' cy='85.8' r='1.3' fill='${d2}'/><circle cx='55' cy='85.8' r='1.3' fill='${d2}'/><path d='M34 73Q50 80 66 73' fill='none' stroke='${c2}' stroke-width='2.4'/>`;
    tag = [50, 94.2, 34];
  } else if (g === "f" && dr === 0) { // kurti, V trim
    add = `<path d='M44 72Q50 90 56 72' fill='none' stroke='${d2}' stroke-width='2'/><path d='M44.8 74Q50 88 55.2 74' fill='none' stroke='${W}' stroke-width='.5' stroke-dasharray='1.2 1.2' opacity='.8'/>`;
    tag = [50, 95.6, 34];
  } else if (g === "f" && dr === 1) { // school dress: collar + bow
    add = `<path d='M43 72L50 79L40 80Z' fill='${W}'/><path d='M57 72L50 79L60 80Z' fill='${W}'/><path d='M50 80L44 76.5V83.5ZM50 80L56 76.5V83.5Z' fill='${d2}'/><circle cx='50' cy='80' r='1.8' fill='${shade(d2, -0.25)}'/>`;
    tag = [50, 94.6, 34];
  } else if ((g === "f" && dr === 3) || (g === "m" && dr === 4)) { // blazer
    add = `<path d='M43 72L50 90L57 72Z' fill='${W}'/><path d='M36 71.5L44.5 72L50 91L41 96Z' fill='${c2}'/><path d='M64 71.5L55.5 72L50 91L59 96Z' fill='${c2}'/><path d='M44.5 72L50 91L41 96' fill='none' stroke='#fff' stroke-width='.4' opacity='.3'/>` +
      (g === "m" ? `<path d='M48 76h4l1 3h-6zM47.2 79.4h5.6l1.6 16-4.4 3.4-4.4-3.4z' fill='${d2}'/>` : `<path d='M46.4 80L50 84L53.6 80L50 77.6Z' fill='${d2}' opacity='.9'/>`);
    tag = [31.5, 92.6, 24];
  } else if (g === "f" && dr === 4) { // saree
    const pal = "M14 80Q24 72 37 72L92 100H62Z";
    patD = pal;
    add = `<path d='${pal}' fill='${d2}'/>`;
    add += `<path d='M14 80Q24 72 37 72L92 100H62Z' fill='url(#bd2)'/><path d='M37 72L62 100' stroke='#f2b632' stroke-width='1.6'/><path d='M40 72.6L66 100' stroke='#f2b632' stroke-width='.6' stroke-dasharray='1.4 1.4'/>`;
    tag = [33, 93.6, 26];
  } else if (g === "m" && dr === 0) { // t-shirt
    add = `<path d='M40 72.6Q50 79 60 72.6' fill='none' stroke='${c2}' stroke-width='2'/>`;
    tag = [50, 91.4, 36];
  } else if (g === "m" && dr === 1) { // shirt
    add = `<path d='M41 70.5L50 84L38.4 78.4Z' fill='${W}'/><path d='M59 70.5L50 84L61.6 78.4Z' fill='${W}'/><path d='M50 84V100' stroke='${c2}' stroke-width='.9'/><circle cx='50' cy='90' r='.9' fill='${c2}'/><circle cx='50' cy='96' r='.9' fill='${c2}'/><path d='M41 70.5L50 84L38.4 78.4' fill='none' stroke='#000' stroke-width='.4' opacity='.18'/>`;
    tag = [32, 92.8, 24];
  } else if (g === "m" && dr === 2) { // panjabi
    add = `<path d='M43 71.5Q50 77 57 71.5V77Q50 82 43 77Z' fill='${d2}'/><path d='M50 80V100' stroke='${c3}' stroke-width='3'/><circle cx='50' cy='84' r='1' fill='#f2b632'/><circle cx='50' cy='90' r='1' fill='#f2b632'/><circle cx='50' cy='96' r='1' fill='#f2b632'/>`;
    tag = [30.5, 92.6, 22];
  }
  const dark = lum(c) < 0.5;
  const tone = { bg: "#ffffff", ink: "#2b2118", edge: shade(c, -0.1) };
  const nameSvg = ini ? nameTag(name, tag[0], tag[1], tag[2], tone) : "";
  return { hood, base, add: add + nameSvg, patD, dark };
}

function patternDefs(pt, c, d2) {
  switch (pt) {
    case 1: return `<pattern id='pp' width='4.4' height='4.4' patternUnits='userSpaceOnUse'><rect width='1.8' height='4.4' fill='${d2}' opacity='.8'/></pattern>`;
    case 2: return `<pattern id='pp' width='6' height='6' patternUnits='userSpaceOnUse'><rect width='3' height='6' fill='${d2}' opacity='.4'/><rect width='6' height='3' fill='${d2}' opacity='.4'/></pattern>`;
    case 3: return `<pattern id='pp' width='5' height='5' patternUnits='userSpaceOnUse'><circle cx='2.5' cy='2.5' r='1' fill='${d2}' opacity='.9'/></pattern>`;
    case 4: return `<pattern id='pp' width='8' height='8' patternUnits='userSpaceOnUse'><g fill='${d2}'><circle cx='4' cy='2.6' r='1'/><circle cx='4' cy='5.4' r='1'/><circle cx='2.6' cy='4' r='1'/><circle cx='5.4' cy='4' r='1'/></g><circle cx='4' cy='4' r='.8' fill='#ffd43b'/></pattern>`;
    default: return "";
  }
}

/* ---------------- main ---------------- */
export function buildAvatarSvg(cfgIn, { name = "", animate = true } = {}) {
  const c = normalizeConfig(cfgIn);
  const skin = SKINS[c.sk], sd = shade(skin, -0.14), sd2 = shade(skin, -0.28);
  const hc = HAIR_COLORS[c.hc], dcol = DRESS_COLORS[c.dc], d2col = DRESS_COLORS[c.d2];
  const iris = EYE_COLORS[c.ec];
  const [b1, b2] = BACKGROUNDS[c.bg];
  const lip = c.sk >= 4 ? (c.g === "f" ? "#9c3a48" : "#7a3d36") : (c.g === "f" ? "#c4485c" : "#b9625b");
  const H = hair(c.g, c.h, hc);
  const B = body(c.g, c.dr, dcol, d2col, c.ini, name);
  const beard = c.ex === 7 ? `<path d='M32.6 46Q33 63 50 66.5Q67 63 67.4 46Q64 57 50 58Q36 57 32.6 46Z' fill='url(#hr)'/><path d='M40 60Q50 64 60 60' fill='none' stroke='${shade(hc, .3)}' stroke-width='.7' opacity='.35'/>` : "";
  const cfgStr = KEYS.map(k => (k === "g" ? (c.g === "m" ? 1 : 0) : c[k])).join(".");
  const head = c.g === "m"
    ? "M32.2 41Q32.2 22 50 22Q67.8 22 67.8 41Q67.6 53 62.4 59.6Q56.6 63.8 50 63.8Q43.4 63.8 37.6 59.6Q32.4 53 32.2 41Z"
    : "M32.8 41Q32.8 22 50 22Q67.2 22 67.2 41Q66.8 52.6 61 58.6Q55.6 63 50 63Q44.4 63 39 58.6Q33.2 52.6 32.8 41Z";
  const bodyFill = c.pt === 5 ? `<linearGradient id='bd' x1='0' y1='0' x2='0' y2='1'><stop offset='0' stop-color='${dcol}'/><stop offset='1' stop-color='${d2col}'/></linearGradient>`
    : `<linearGradient id='bd' x1='0' y1='0' x2='0' y2='1'><stop offset='0' stop-color='${shade(dcol, .14)}'/><stop offset='1' stop-color='${shade(dcol, -.16)}'/></linearGradient>`;
  const pat = c.pt >= 1 && c.pt <= 4 ? `<path d='${B.patD}' fill='url(#pp)'/>` : "";
  return `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><!--AV:${cfgStr}-->` +
    (animate ? `<style>${CSS}</style>` : "") +
    `<defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='${b1}'/><stop offset='1' stop-color='${b2}'/></linearGradient>` +
    `<radialGradient id='f' cx='.42' cy='.36' r='.75'><stop offset='0' stop-color='${shade(skin, .1)}'/><stop offset='.7' stop-color='${skin}'/><stop offset='1' stop-color='${sd}'/></radialGradient>` +
    `<radialGradient id='cb'><stop offset='0' stop-color='#ff6b81' stop-opacity='.5'/><stop offset='1' stop-color='#ff6b81' stop-opacity='0'/></radialGradient>` +
    `<linearGradient id='hr' gradientUnits='userSpaceOnUse' x1='0' y1='14' x2='0' y2='82'><stop offset='0' stop-color='${shade(hc, .2)}'/><stop offset='.5' stop-color='${hc}'/><stop offset='1' stop-color='${shade(hc, -.18)}'/></linearGradient>` +
    bodyFill + (c.dr === 4 ? `<linearGradient id='bd2' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='#fff' stop-opacity='.18'/><stop offset='1' stop-color='#000' stop-opacity='.12'/></linearGradient>` : "") +
    patternDefs(c.pt, dcol, d2col) + `</defs>` +
    `<rect width='100' height='100' fill='url(#g)'/>` +
    `<circle cx='50' cy='46' r='34' fill='#fff' opacity='.12'/>` +
    `<path class='tw' d='M84 15l1.6 3.8 3.8 1.6-3.8 1.6-1.6 3.8-1.6-3.8-3.8-1.6 3.8-1.6z' fill='#fff' opacity='.85'/>` +
    `<path class='tw t2' d='M15 30l1.1 2.6 2.6 1.1-2.6 1.1-1.1 2.6-1.1-2.6-2.6-1.1 2.6-1.1z' fill='#fff' opacity='.7'/>` +
    `<g class='bd'>${B.hood}<path d='M43.5 56h13v18q-6.5 6-13 0z' fill='${sd}'/><path d='M43.5 58Q50 68 56.5 58V66Q50 71 43.5 66Z' fill='${sd2}' opacity='.5'/>${B.base}${pat}${B.add}</g>` +
    `<g class='hd'>${H.back}` +
    `<ellipse cx='32.6' cy='44.8' rx='2.7' ry='4' fill='${skin}'/><ellipse cx='67.4' cy='44.8' rx='2.7' ry='4' fill='${skin}'/><ellipse cx='32.8' cy='45' rx='1.2' ry='2.4' fill='${sd}'/><ellipse cx='67.2' cy='45' rx='1.2' ry='2.4' fill='${sd}'/>` +
    `<path d='${head}' fill='url(#f)'/>` +
    `<path d='M33 40Q50 26 67 40Q50 31 33 40Z' fill='#000' opacity='.09'/>` +
    `<circle cx='38.6' cy='50.6' r='5' fill='url(#cb)'/><circle cx='61.4' cy='50.6' r='5' fill='url(#cb)'/>` +
    `<path d='M42 59.4Q50 64 58 59.4Q50 62.2 42 59.4Z' fill='${sd2}' opacity='.35'/>` +
    beard + brows(c.g, hc) + eyes(c.g, c.ey, c.mo, iris, skin) +
    `<path d='M48.9 40.6Q48.2 46 47.8 48.4' fill='none' stroke='${sd}' stroke-width='.6' stroke-linecap='round' opacity='.45'/>` +
    `<path d='M47.6 49Q50 51.3 52.4 49' fill='none' stroke='${sd2}' stroke-width='.9' stroke-linecap='round' opacity='.85'/><circle cx='50' cy='47.8' r='1.3' fill='${shade(skin, .3)}' opacity='.4'/>` +
    mouth(c.mo, lip) + glasses(c.gl) + H.front + extra(c.ex, dcol, d2col, hc) + `</g></svg>`;
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
    if (v.length < OLD_KEYS) return null;
    const o = {};
    KEYS.forEach((k, i) => { if (i < v.length) o[k] = k === "g" ? (v[i] ? "m" : "f") : v[i]; });
    return normalizeConfig(o);
  } catch { return null; }
}
