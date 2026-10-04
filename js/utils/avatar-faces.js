/* =========================================================
   ANIMATED FACE AVATARS
   12 ready-made animated faces any student can use as a profile picture.
   Each face is a tiny self-contained SVG (CSS animations only, no scripts)
   turned into a data: URI. Because every page already renders profile
   pictures as <img src="${photoURL}">, a face is stored in the normal
   students/{id}.photoURL field and shows up everywhere (header, leaderboard,
   chat, profile, share card...) with zero changes to those pages.
   SVG animations DO run inside <img>, so the faces stay animated.
   ========================================================= */

const CSS = `
.h{animation:bob 3s ease-in-out infinite}
.b{transform-box:fill-box;transform-origin:center;animation:bl 4.2s infinite}
.b2{animation-delay:.08s}
.w{transform-box:fill-box;transform-origin:center;animation:wk 5s infinite}
.p{transform-box:fill-box;transform-origin:center;animation:pl 1.2s ease-in-out infinite}
.m{transform-box:fill-box;transform-origin:center;animation:ta .7s ease-in-out infinite}
.o{transform-box:fill-box;transform-origin:center;animation:op 2.4s ease-in-out infinite}
.sp{transform-box:fill-box;transform-origin:center;animation:sp 6s linear infinite}
.z{animation:zz 2.6s ease-in infinite;opacity:0}
.z2{animation-delay:1.3s}
.sh{animation:sh 3.6s ease-in-out infinite}
.sc{animation:sc 2.4s ease-in-out infinite}
.bk{animation:ant 1s steps(2) infinite}
.br{transform-box:fill-box;transform-origin:center;animation:br 3.4s ease-in-out infinite}
.tr{animation:tr 2s ease-in infinite;opacity:0}
@keyframes bob{0%,100%{transform:translateY(1px)}50%{transform:translateY(-2.5px)}}
@keyframes bl{0%,92%,100%{transform:scaleY(1)}96%{transform:scaleY(.08)}}
@keyframes wk{0%,70%,100%{transform:scaleY(1)}78%,86%{transform:scaleY(.08)}}
@keyframes pl{0%,100%{transform:scale(1)}50%{transform:scale(1.22)}}
@keyframes ta{0%,100%{transform:scaleY(.45)}50%{transform:scaleY(1.1)}}
@keyframes op{0%,100%{transform:scale(.8)}50%{transform:scale(1.2)}}
@keyframes sp{to{transform:rotate(360deg)}}
@keyframes zz{0%{transform:translate(0,0) scale(.6);opacity:0}25%{opacity:1}100%{transform:translate(9px,-18px) scale(1.1);opacity:0}}
@keyframes sh{0%,55%{transform:translateX(-40px)}100%{transform:translateX(120px)}}
@keyframes sc{0%,100%{transform:translateX(-3px)}50%{transform:translateX(3px)}}
@keyframes ant{50%{opacity:.2}}
@keyframes br{0%,100%{transform:translateY(0)}50%{transform:translateY(-5px)}}
@keyframes tr{0%{transform:translateY(0);opacity:0}20%{opacity:.9}100%{transform:translateY(14px);opacity:0}}
`.replace(/\s*\n\s*/g, "");

const INK = "#2b2118";

// eyes helper: two round eyes that blink
const eyes = (lx = 36, rx = 64, y = 46, r = 5.5, fill = INK) =>
  `<ellipse class="b" cx="${lx}" cy="${y}" rx="${r}" ry="${r + 1}" fill="${fill}"/>` +
  `<ellipse class="b b2" cx="${rx}" cy="${y}" rx="${r}" ry="${r + 1}" fill="${fill}"/>` +
  `<circle cx="${lx + 1.8}" cy="${y - 2}" r="1.6" fill="#fff"/><circle cx="${rx + 1.8}" cy="${y - 2}" r="1.6" fill="#fff"/>`;

const cheeks = (c = "#ff8a8a") =>
  `<circle cx="25" cy="58" r="5" fill="${c}" opacity=".45"/><circle cx="75" cy="58" r="5" fill="${c}" opacity=".45"/>`;

const smile = `<path d="M34 61 Q50 76 66 61" fill="none" stroke="${INK}" stroke-width="4" stroke-linecap="round"/>`;

function svg(bg, body) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><style>${CSS}</style>` +
    `<rect width="100" height="100" fill="${bg}"/><g class="h">${body}</g></svg>`;
}

const head = (fill, extra = "") =>
  `<circle cx="50" cy="52" r="34" fill="${fill}" stroke="rgba(0,0,0,.12)" stroke-width="1.5"/>${extra}`;

export const FACES = [
  {
    id: "happy", label: "হাসিখুশি",
    svg: svg("#ffe9a8", head("#ffd54a") + eyes() + cheeks() + smile)
  },
  {
    id: "cool", label: "কুল",
    svg: svg("#bfe3ff", head("#ffcf5a") +
      `<g><rect x="23" y="38" width="22" height="15" rx="6" fill="#1d2433"/><rect x="55" y="38" width="22" height="15" rx="6" fill="#1d2433"/><rect x="44" y="43" width="12" height="3.5" fill="#1d2433"/>` +
      `<g clip-path="inset(0)"><rect class="sh" x="22" y="36" width="5" height="20" fill="#fff" opacity=".35" transform="skewX(-20)"/></g></g>` +
      `<path d="M36 64 Q52 74 68 60" fill="none" stroke="${INK}" stroke-width="4" stroke-linecap="round"/>`)
  },
  {
    id: "wink", label: "উইংক",
    svg: svg("#ffd1e3", head("#ffd54a") +
      `<ellipse cx="36" cy="46" rx="5.5" ry="6.5" fill="${INK}"/><circle cx="37.8" cy="44" r="1.6" fill="#fff"/>` +
      `<path class="w" d="M57 46 Q64 40 71 46" fill="none" stroke="${INK}" stroke-width="4" stroke-linecap="round"/>` +
      cheeks() + `<path d="M34 61 Q50 78 68 60" fill="none" stroke="${INK}" stroke-width="4" stroke-linecap="round"/>` +
      `<path d="M72 28 l2 5 5 2 -5 2 -2 5 -2 -5 -5 -2 5 -2z" fill="#fff" class="p"/>`)
  },
  {
    id: "laugh", label: "হাহা",
    svg: svg("#d6f5d0", head("#ffd54a") +
      `<path d="M28 46 Q36 38 44 46" fill="none" stroke="${INK}" stroke-width="4" stroke-linecap="round"/>` +
      `<path d="M56 46 Q64 38 72 46" fill="none" stroke="${INK}" stroke-width="4" stroke-linecap="round"/>` +
      `<g class="m"><path d="M32 58 Q50 86 68 58 Z" fill="#7a1f2b"/><path d="M40 70 Q50 78 60 70 Q50 66 40 70Z" fill="#ff7b8a"/></g>` +
      `<path class="tr" d="M26 52 q-3 6 0 9 q3 -3 0 -9z" fill="#5bc8ff"/><path class="tr" style="animation-delay:1s" d="M74 52 q-3 6 0 9 q3 -3 0 -9z" fill="#5bc8ff"/>`)
  },
  {
    id: "love", label: "ভালোবাসা",
    svg: svg("#ffc9d4", head("#ffd54a") +
      `<path class="p" d="M36 52 C26 44 28 36 35 36 C38 36 36 38 36 40 C36 38 34 36 37 36 C44 36 46 44 36 52Z" fill="#ff3d5e"/>` +
      `<path class="p" style="animation-delay:.15s" d="M64 52 C54 44 56 36 63 36 C66 36 64 38 64 40 C64 38 62 36 65 36 C72 36 74 44 64 52Z" fill="#ff3d5e"/>` +
      cheeks("#ff6b8a") + `<path d="M40 63 Q50 72 60 63" fill="none" stroke="${INK}" stroke-width="4" stroke-linecap="round"/>`)
  },
  {
    id: "sleepy", label: "ঘুমকাতুরে",
    svg: svg("#d9d4ff", head("#ffd54a") +
      `<path d="M28 48 Q36 54 44 48" fill="none" stroke="${INK}" stroke-width="4" stroke-linecap="round"/>` +
      `<path d="M56 48 Q64 54 72 48" fill="none" stroke="${INK}" stroke-width="4" stroke-linecap="round"/>` +
      `<ellipse class="o" cx="50" cy="68" rx="5" ry="4" fill="#7a1f2b"/>` +
      `<text class="z" x="68" y="34" font-size="14" font-weight="900" font-family="sans-serif" fill="#5b4bd6">z</text>` +
      `<text class="z z2" x="74" y="26" font-size="11" font-weight="900" font-family="sans-serif" fill="#5b4bd6">z</text>`)
  },
  {
    id: "wow", label: "অবাক",
    svg: svg("#ffe0b8", head("#ffd54a") +
      `<g class="br"><path d="M26 33 Q35 28 44 33" fill="none" stroke="${INK}" stroke-width="3.5" stroke-linecap="round"/><path d="M56 33 Q65 28 74 33" fill="none" stroke="${INK}" stroke-width="3.5" stroke-linecap="round"/></g>` +
      `<circle class="b" cx="36" cy="47" r="7" fill="#fff" stroke="${INK}" stroke-width="2"/><circle cx="36" cy="47" r="3" fill="${INK}"/>` +
      `<circle class="b b2" cx="64" cy="47" r="7" fill="#fff" stroke="${INK}" stroke-width="2"/><circle cx="64" cy="47" r="3" fill="${INK}"/>` +
      `<ellipse class="o" cx="50" cy="70" rx="6" ry="7.5" fill="#7a1f2b"/>`)
  },
  {
    id: "robot", label: "রোবট",
    svg: svg("#cfe9ee",
      `<line x1="50" y1="14" x2="50" y2="24" stroke="#5b6b78" stroke-width="3"/><circle class="bk" cx="50" cy="12" r="4.5" fill="#ff4d4d"/>` +
      `<rect x="18" y="24" width="64" height="58" rx="14" fill="#b8c7d1" stroke="#5b6b78" stroke-width="2.5"/>` +
      `<rect x="26" y="34" width="48" height="26" rx="8" fill="#1d2d3a"/>` +
      `<g class="sc"><rect class="b" x="32" y="40" width="12" height="12" rx="3" fill="#59f0ff"/><rect class="b b2" x="56" y="40" width="12" height="12" rx="3" fill="#59f0ff"/></g>` +
      `<rect x="34" y="68" width="32" height="6" rx="3" fill="#5b6b78"/><g stroke="#cfe9ee" stroke-width="1.5"><line x1="42" y1="68" x2="42" y2="74"/><line x1="50" y1="68" x2="50" y2="74"/><line x1="58" y1="68" x2="58" y2="74"/></g>` +
      `<circle cx="14" cy="52" r="4" fill="#5b6b78"/><circle cx="86" cy="52" r="4" fill="#5b6b78"/>`)
  },
  {
    id: "cat", label: "বিড়াল",
    svg: svg("#ffe3cf",
      `<path d="M20 44 L24 16 L44 28Z" fill="#f4a259" stroke="rgba(0,0,0,.12)" stroke-width="1.5"/><path d="M80 44 L76 16 L56 28Z" fill="#f4a259" stroke="rgba(0,0,0,.12)" stroke-width="1.5"/>` +
      `<path d="M25 36 L27 24 L36 30Z" fill="#ffb3b3"/><path d="M75 36 L73 24 L64 30Z" fill="#ffb3b3"/>` +
      head("#f4a259") +
      `<ellipse class="b" cx="37" cy="50" rx="4.5" ry="6.5" fill="${INK}"/><ellipse class="b b2" cx="63" cy="50" rx="4.5" ry="6.5" fill="${INK}"/>` +
      `<circle cx="38.5" cy="47.5" r="1.5" fill="#fff"/><circle cx="64.5" cy="47.5" r="1.5" fill="#fff"/>` +
      `<path d="M46 60 L54 60 L50 65Z" fill="#ff7b8a"/><path d="M50 65 Q44 72 38 68 M50 65 Q56 72 62 68" fill="none" stroke="${INK}" stroke-width="2.5" stroke-linecap="round"/>` +
      `<g stroke="${INK}" stroke-width="1.8" stroke-linecap="round" opacity=".7"><line x1="14" y1="60" x2="30" y2="62"/><line x1="14" y1="68" x2="30" y2="66"/><line x1="86" y1="60" x2="70" y2="62"/><line x1="86" y1="68" x2="70" y2="66"/></g>`)
  },
  {
    id: "alien", label: "এলিয়েন",
    svg: svg("#1f2a4a",
      `<g fill="#fff" opacity=".8"><circle class="p" cx="14" cy="18" r="1.6"/><circle class="p" style="animation-delay:.4s" cx="86" cy="26" r="1.4"/><circle class="p" style="animation-delay:.8s" cx="80" cy="84" r="1.6"/><circle class="p" style="animation-delay:.2s" cx="16" cy="80" r="1.3"/></g>` +
      `<line x1="38" y1="20" x2="34" y2="8" stroke="#6fdc6f" stroke-width="3"/><circle class="p" cx="34" cy="8" r="4" fill="#b6ff6a"/>` +
      `<line x1="62" y1="20" x2="66" y2="8" stroke="#6fdc6f" stroke-width="3"/><circle class="p" style="animation-delay:.5s" cx="66" cy="8" r="4" fill="#b6ff6a"/>` +
      `<path d="M50 20 C80 20 86 50 70 72 C62 82 38 82 30 72 C14 50 20 20 50 20Z" fill="#7be07b" stroke="rgba(0,0,0,.2)" stroke-width="1.5"/>` +
      `<ellipse class="b" cx="36" cy="48" rx="9" ry="12" fill="#10221a" transform="rotate(-18 36 48)"/><ellipse class="b b2" cx="64" cy="48" rx="9" ry="12" fill="#10221a" transform="rotate(18 64 48)"/>` +
      `<circle cx="39" cy="43" r="2.6" fill="#fff"/><circle cx="67" cy="43" r="2.6" fill="#fff"/>` +
      `<path d="M43 68 Q50 73 57 68" fill="none" stroke="#10221a" stroke-width="3" stroke-linecap="round"/>`)
  },
  {
    id: "panda", label: "পান্ডা",
    svg: svg("#dff5e1",
      `<circle cx="22" cy="26" r="11" fill="#2b2b2b"/><circle cx="78" cy="26" r="11" fill="#2b2b2b"/>` +
      head("#fff") +
      `<ellipse cx="35" cy="48" rx="9" ry="11" fill="#2b2b2b" transform="rotate(20 35 48)"/><ellipse cx="65" cy="48" rx="9" ry="11" fill="#2b2b2b" transform="rotate(-20 65 48)"/>` +
      `<circle class="b" cx="36" cy="48" r="3.6" fill="#fff"/><circle class="b b2" cx="64" cy="48" r="3.6" fill="#fff"/>` +
      `<ellipse cx="50" cy="62" rx="5" ry="3.6" fill="#2b2b2b"/><path d="M42 68 Q50 75 58 68" fill="none" stroke="#2b2b2b" stroke-width="3" stroke-linecap="round"/>`)
  },
  {
    id: "star", label: "তারকা",
    svg: svg("#ffe6f7", head("#ffd54a") +
      `<g class="sp"><path d="M36 38 l2.8 5.8 6.4.9 -4.6 4.5 1.1 6.3 -5.7-3 -5.7 3 1.1-6.3 -4.6-4.5 6.4-.9z" fill="#ff9f1c" stroke="#d97a00" stroke-width="1"/></g>` +
      `<g class="sp"><path d="M64 38 l2.8 5.8 6.4.9 -4.6 4.5 1.1 6.3 -5.7-3 -5.7 3 1.1-6.3 -4.6-4.5 6.4-.9z" fill="#ff9f1c" stroke="#d97a00" stroke-width="1"/></g>` +
      cheeks() + `<path d="M32 62 Q50 82 68 62 Z" fill="#7a1f2b"/><path d="M38 64 H62" stroke="#fff" stroke-width="4"/>`)
  }
];

export const faceUri = (face) => "data:image/svg+xml;utf8," + encodeURIComponent(face.svg);

export const FACE_URIS = FACES.map(f => ({ id: f.id, label: f.label, uri: faceUri(f) }));

// true when a photoURL is one of our built-in animated faces
export const isFaceUri = (url) => typeof url === "string" && url.startsWith("data:image/svg+xml");
