// Labeled diagrams for the DIY guides: "what to look for" pictures drawn as inline
// SVG, so they follow the app's light and dark themes (colors come from the
// .dg-* classes in css/app.css). These are simplified, original illustrations;
// real cars vary, which each caption points out where it matters.

const W = 360, H = 230;

// ---- tiny drawing helpers -------------------------------------------------
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
// Text; lines can be an array for several lines.
const t = (x, y, lines, cls = "dg-text", anchor = "start") => {
  const arr = Array.isArray(lines) ? lines : [lines];
  return `<text x="${x}" y="${y}" class="${cls}" text-anchor="${anchor}">${arr
    .map((l, i) => `<tspan x="${x}" dy="${i ? 14 : 0}">${esc(l)}</tspan>`).join("")}</text>`;
};
// Leader line from a label to the part it names, ending in a dot.
const lead = (x1, y1, x2, y2) =>
  `<path class="dg-lead" d="M${x1} ${y1}L${x2} ${y2}"/><circle class="dg-dot" cx="${x2}" cy="${y2}" r="2.5"/>`;
// Arrow along a path.
const arrow = (d, cls = "dg-arrow") => `<path class="${cls}" d="${d}" marker-end="url(#dg-head)"/>`;
// Numbered step badge.
const num = (n, x, y) => `<circle class="dg-num" cx="${x}" cy="${y}" r="10"/><text class="dg-num-t" x="${x}" y="${y + 4}" text-anchor="middle">${n}</text>`;
const check = (x, y) => `<path class="dg-ok-line" d="M${x - 6} ${y}l4 4 8-9"/>`;
const cross = (x, y) => `<path class="dg-bad-line" d="M${x - 5} ${y - 5}l10 10M${x + 5} ${y - 5}l-10 10"/>`;

const svg = (body) => `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" focusable="false" aria-hidden="true">
  <defs><marker id="dg-head" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path class="dg-head" d="M0 0L10 5 0 10z"/></marker></defs>
  ${body}</svg>`;

// Little symbols used on caps and labels.
const oilCan = (x, y, s = 1) => `<g transform="translate(${x} ${y}) scale(${s})"><path class="dg-icon" d="M-9 2h11l4-4 3 2-4 5v3h-11l-3-3z"/><path class="dg-icon" d="M-6 2v-4h5"/></g>`;
const washerSym = (x, y) => `<g transform="translate(${x} ${y})"><path class="dg-icon" d="M-9 5q9-14 18 0z"/><path class="dg-icon" d="M-4 -3v-4M0 -4v-5M4 -3v-4"/></g>`;
const thermo = (x, y) => `<g transform="translate(${x} ${y})"><path class="dg-icon" d="M-2 3v-9a2 2 0 0 1 4 0v9a4 4 0 1 1-4 0z"/></g>`;

// ---- the diagrams -----------------------------------------------------------
const DIAGRAMS = {
  "check-oil-level": {
    alt: "Engine bay with the yellow dipstick handle and oil fill cap labeled, and a close-up of the dipstick tip showing the oil level between the low and full marks.",
    caption: "The dipstick handle is usually yellow or orange. A good reading sits between the two marks.",
    svg: svg(`
      <rect class="dg-panel" x="8" y="20" width="200" height="190" rx="14"/>
      ${t(108, 40, "Under the hood", "dg-sub", "middle")}
      <rect class="dg-body" x="36" y="74" width="144" height="92" rx="12"/>
      <rect class="dg-body2" x="52" y="62" width="112" height="22" rx="6"/>
      <circle class="dg-hl" cx="78" cy="73" r="11"/><path class="dg-hl-line" d="M78 84v26"/>
      <circle class="dg-metal" cx="138" cy="73" r="12"/>${oilCan(139, 72, .8)}
      ${lead(70, 196, 76, 86)}${t(22, 202, "Dipstick (yellow loop)", "dg-text")}
      ${lead(176, 120, 146, 80)}${t(150, 132, ["Oil fill", "cap"], "dg-text")}
      <rect class="dg-panel" x="224" y="20" width="128" height="190" rx="14"/>
      ${t(288, 40, "Dipstick tip", "dg-sub", "middle")}
      <rect class="dg-metal" x="250" y="52" width="16" height="148" rx="8"/>
      <rect class="dg-oil" x="250" y="118" width="16" height="82" rx="8"/>
      <path class="dg-mark" d="M244 96h28M244 150h28"/>
      ${t(278, 100, "FULL", "dg-text")}${t(278, 154, "LOW", "dg-text")}
      ${check(286, 122)}${t(278, 140, "Good", "dg-ok-t")}
    `),
  },
  "tire-pressure": {
    alt: "The tire pressure sticker inside the driver's door frame, and a wheel with the valve stem where the gauge presses on.",
    caption: "Use the pressure on the door-frame sticker, not the maximum printed on the tire.",
    svg: svg(`
      <rect class="dg-panel" x="8" y="14" width="170" height="202" rx="14"/>
      ${t(93, 34, "Driver's door frame", "dg-sub", "middle")}
      <path class="dg-body" d="M30 48h60v150H30z"/><path class="dg-body2" d="M98 48h60v150H98z"/>
      <rect class="dg-hl" x="104" y="76" width="48" height="74" rx="5"/>
      ${t(128, 92, "FRONT", "dg-tiny", "middle")}${t(128, 107, "35 PSI", "dg-strong", "middle")}${t(128, 126, "REAR", "dg-tiny", "middle")}${t(128, 141, "33 PSI", "dg-strong", "middle")}
      ${t(93, 212, "Pressure sticker", "dg-text", "middle")}
      <rect class="dg-panel" x="190" y="14" width="162" height="202" rx="14"/>
      ${t(271, 34, "Each wheel", "dg-sub", "middle")}
      <circle class="dg-tire" cx="271" cy="118" r="66"/><circle class="dg-metal" cx="271" cy="118" r="38"/>
      <circle class="dg-body2" cx="271" cy="118" r="12"/>
      <rect class="dg-hl" x="300" y="138" width="9" height="20" rx="3" transform="rotate(-35 304 148)"/>
      ${lead(318, 196, 306, 152)}${t(271, 208, "Valve stem: gauge here", "dg-text", "middle")}
    `),
  },
  "tire-tread": {
    alt: "Two penny tests side by side: when the tread covers the top of Lincoln's head the tread is OK; when the whole head shows, replace the tire.",
    caption: "Penny upside down in a groove: if you can see all of Lincoln's head, the tread is worn out.",
    svg: svg(`
      ${[[8, true], [184, false]].map(([x, ok]) => {
        const surface = ok ? 140 : 162; // where the tread's top edge sits in front of the coin
        return `
        <rect class="dg-panel" x="${x}" y="14" width="168" height="202" rx="14"/>
        ${t(x + 84, 34, ok ? "Head partly hidden" : "Whole head visible", "dg-sub", "middle")}
        <circle class="dg-penny" cx="${x + 84}" cy="112" r="44"/>
        <circle class="dg-head-shape" cx="${x + 84}" cy="128" r="13"/>
        <path class="dg-head-shape" d="M${x + 72} 140q12 12 24 0"/>
        <rect class="dg-tread-cover" x="${x + 14}" y="${surface}" width="140" height="${178 - surface}" rx="4"/>
        <path class="dg-tread-line" d="M${x + 14} ${surface}h140"/>
        ${t(x + 150, surface + 14, "Tread", "dg-inv", "end")}
        ${ok ? check(x + 52, 198) : cross(x + 52, 198)}
        ${t(x + 66, 202, ok ? "OK" : "Replace", ok ? "dg-ok-t" : "dg-bad-t")}`;
      }).join("")}
    `),
  },
  "wiper-blades": {
    alt: "A wiper arm lifted off the windshield, with the U-shaped hook, the blade's clip and the release tab labeled, and a towel on the glass.",
    caption: "Press the release tab and slide the blade down out of the hook. Keep a towel under the bare arm.",
    svg: svg(`
      <rect class="dg-glass" x="8" y="14" width="344" height="202" rx="14"/>
      <rect class="dg-towel" x="40" y="170" width="120" height="30" rx="6"/>${t(100, 190, "Towel", "dg-sub", "middle")}
      <path class="dg-arm" d="M70 172L200 70q14-10 20 6l-6 30"/>
      <path class="dg-arm" d="M214 106q-4 18-20 14"/>
      <rect class="dg-blade" x="168" y="112" width="170" height="12" rx="6" transform="rotate(-8 253 118)"/>
      <rect class="dg-hl" x="196" y="104" width="30" height="20" rx="4" transform="rotate(-8 211 114)"/>
      ${lead(256, 52, 214, 96)}${t(250, 40, ["U-shaped hook", "(end of the arm)"], "dg-text")}
      ${lead(250, 170, 214, 116)}${t(240, 182, ["Release tab:", "press, slide down"], "dg-text")}
      ${arrow("M230 140q-14 18-34 20")}
    `),
  },
  "washer-fluid": {
    alt: "Four caps under the hood. The washer fluid cap shows a windshield with a spray of water; the oil, coolant and brake fluid caps are marked as not for washer fluid.",
    caption: "Look for the windshield-and-spray symbol. Never put washer fluid in any other cap.",
    svg: svg(`
      <rect class="dg-panel" x="8" y="14" width="344" height="202" rx="14"/>
      ${t(180, 36, "Caps under the hood", "dg-sub", "middle")}
      <circle class="dg-hl-blue" cx="72" cy="106" r="38"/>${washerSym(72, 108)}
      ${check(72, 166)}${t(72, 194, ["Washer fluid", "fill here"], "dg-ok-t", "middle")}
      <circle class="dg-metal" cx="170" cy="106" r="26"/>${oilCan(171, 105, .9)}${t(170, 152, "Oil", "dg-sub", "middle")}
      <circle class="dg-metal" cx="236" cy="106" r="26"/>${thermo(236, 108)}${t(236, 152, "Coolant", "dg-sub", "middle")}
      <circle class="dg-metal" cx="302" cy="106" r="26"/><circle class="dg-icon" cx="302" cy="106" r="9"/><path class="dg-icon" d="M290 96a16 16 0 0 0 0 20M314 96a16 16 0 0 1 0 20"/>${t(302, 152, "Brake", "dg-sub", "middle")}
      ${cross(236, 176)}${t(236, 200, "Not these", "dg-bad-t", "middle")}
    `),
  },
  "coolant-level": {
    alt: "The see-through coolant reservoir with MAX and MIN lines and the coolant level between them, and a warning to only open the cap when the engine is cold.",
    caption: "Check by looking through the side of the tank. Only open the cap on a cold engine.",
    svg: svg(`
      <rect class="dg-panel" x="8" y="14" width="344" height="202" rx="14"/>
      <rect class="dg-tank" x="70" y="60" width="120" height="132" rx="14"/>
      <rect class="dg-coolant" x="72" y="118" width="116" height="72" rx="12"/>
      <rect class="dg-metal" x="104" y="40" width="52" height="22" rx="6"/>${thermo(130, 51)}
      <path class="dg-mark" d="M62 92h18M62 160h18"/>
      ${t(56, 96, "MAX", "dg-text", "end")}${t(56, 164, "MIN", "dg-text", "end")}
      ${lead(232, 134, 178, 132)}${t(236, 130, ["Level between", "the lines = good"], "dg-ok-t")}
      <rect class="dg-warn-box" x="224" y="34" width="118" height="54" rx="10"/>
      ${t(283, 56, "Engine cold", "dg-warn-t", "middle")}${t(283, 72, "before opening", "dg-warn-t2", "middle")}
      ${lead(224, 62, 158, 50)}
    `),
  },
  "engine-air-filter": {
    alt: "The black air filter box with its lid unclipped, the pleated filter lifted out, and the large intake tube that leads to the engine.",
    caption: "Release the clips, lift the lid, and set the new filter in the same way the old one sat.",
    svg: svg(`
      <rect class="dg-panel" x="8" y="14" width="344" height="202" rx="14"/>
      <rect class="dg-box" x="40" y="112" width="170" height="84" rx="10"/>
      <rect class="dg-box" x="34" y="56" width="182" height="26" rx="8" transform="rotate(-6 125 69)"/>
      <rect class="dg-filter" x="58" y="96" width="134" height="22" rx="4"/>
      <path class="dg-pleat" d="${Array.from({ length: 16 }, (_, i) => `M${64 + i * 8} 99v16`).join("")}"/>
      <rect class="dg-hl" x="34" y="120" width="12" height="20" rx="3"/><rect class="dg-hl" x="204" y="120" width="12" height="20" rx="3"/>
      <path class="dg-tube" d="M210 154h60q30 0 30-30V70"/>
      ${t(300, 60, "To engine", "dg-sub", "middle")}
      ${lead(70, 214, 42, 136)}${t(76, 216, "Clips (one each side)", "dg-text")}
      ${lead(240, 106, 186, 106)}${t(244, 104, ["Pleated", "filter"], "dg-text")}
      ${t(125, 44, "Lid", "dg-sub", "middle")}
    `),
  },
  "cabin-air-filter": {
    alt: "The glove box swung down out of the way, the narrow filter cover behind it, and the filter's airflow arrow pointing down.",
    caption: "Most cabin filters sit behind the glove box. Match the airflow arrow on the new filter to the old one.",
    svg: svg(`
      <rect class="dg-panel" x="8" y="14" width="344" height="202" rx="14"/>
      <rect class="dg-body2" x="24" y="40" width="200" height="74" rx="10"/>${t(124, 32, "Dashboard", "dg-sub", "middle")}
      <rect class="dg-hl" x="62" y="78" width="124" height="22" rx="4"/>${t(124, 93, "Filter cover", "dg-strong", "middle")}
      <path class="dg-box" d="M40 114h170l-18 70H58z"/>${t(124, 158, "Glove box", "dg-sub2", "middle")}
      ${arrow("M226 132q18 24 0 44")}${t(232, 196, ["Swing it down", "past the stops"], "dg-text")}
      <rect class="dg-filter" x="250" y="40" width="80" height="94" rx="6"/>
      <path class="dg-pleat" d="${Array.from({ length: 9 }, (_, i) => `M${256 + i * 9} 46v82`).join("")}"/>
      ${arrow("M290 52v66", "dg-arrow-strong")}${t(290, 152, ["AIR FLOW", "arrow"], "dg-text", "middle")}
    `),
  },
  "headlight-bulb": {
    alt: "The back of a headlight housing with the wire connector unplugged and the bulb twisting out counterclockwise, and a bulb showing to hold it by the base, not the glass.",
    caption: "Unplug the connector, twist the bulb to the left to remove it, and hold the new one by its base.",
    svg: svg(`
      <rect class="dg-panel" x="8" y="14" width="196" height="202" rx="14"/>
      ${t(106, 34, "Back of the headlight", "dg-sub", "middle")}
      <path class="dg-box" d="M24 64q10-18 30-18h110q20 0 20 20v100q0 20-20 20H54q-30 0-30-30z"/>
      <circle class="dg-metal" cx="104" cy="116" r="34"/>
      <rect class="dg-hl" x="94" y="96" width="20" height="40" rx="4"/>
      <path class="dg-wire" d="M114 116h40q10 0 14 10l10 40"/>
      ${arrow("M66 90a44 44 0 0 1 60-12")}${t(52, 202, "Twist left to remove", "dg-text")}
      <rect class="dg-panel" x="216" y="14" width="136" height="202" rx="14"/>
      <ellipse class="dg-glass-bulb" cx="284" cy="84" rx="20" ry="26"/>
      <rect class="dg-ok-fill" x="268" y="108" width="32" height="40" rx="5"/>
      ${cross(320, 74)}${t(284, 32, ["Glass:", "don't touch"], "dg-bad-t", "middle")}
      ${check(318, 128)}${t(284, 170, ["Hold by", "the base"], "dg-ok-t", "middle")}
    `),
  },
  "oil-change": {
    alt: "Side view under the front of the car: the oil pan with its drain plug at the lowest point, the drain pan below, the round oil filter on the engine, and the transmission pan farther back marked as not the one to open.",
    caption: "Make sure you open the engine's drain plug, not the transmission's. Your manual can confirm which is which.",
    svg: svg(`
      <rect class="dg-panel" x="8" y="14" width="344" height="202" rx="14"/>
      <path class="dg-ground" d="M14 206h332"/>
      <rect class="dg-body2" x="30" y="30" width="170" height="70" rx="12"/>${t(115, 70, "Engine", "dg-sub2", "middle")}
      <path class="dg-metal" d="M40 100h150l-10 30H50z"/>
      <rect class="dg-hl" x="104" y="128" width="20" height="12" rx="3"/>
      <rect class="dg-filter-can" x="196" y="64" width="30" height="44" rx="8"/>
      <path class="dg-pan" d="M80 176h70l-8 22H88z"/>${t(158, 192, "Drain pan", "dg-text")}
      <path class="dg-drip" d="M114 142q-6 14 0 28"/>
      <path class="dg-metal" d="M244 96h80l-8 22h-64z"/>${cross(284, 136)}
      ${lead(36, 150, 104, 134)}${t(18, 162, ["Drain", "plug"], "dg-text")}
      ${lead(262, 64, 222, 78)}${t(248, 46, ["Oil filter", "(round can)"], "dg-text")}
      ${t(284, 166, ["Transmission:", "not this one"], "dg-bad-t", "middle")}
    `),
  },
  "tire-rotation": {
    alt: "A car seen from above with arrows showing the common front-wheel-drive rotation: front tires move straight back, rear tires cross to the opposite front corners.",
    caption: "A common pattern for front-wheel-drive cars. Check your owner's manual for yours; directional tires only move front to back.",
    svg: svg(`
      <rect class="dg-panel" x="8" y="14" width="344" height="202" rx="14"/>
      <path class="dg-car" d="M140 34h80q22 0 22 26v104q0 26-22 26h-80q-22 0-22-26V60q0-26 22-26z"/>
      <rect class="dg-glass" x="134" y="58" width="92" height="26" rx="8"/>
      ${t(180, 50, "FRONT", "dg-tiny", "middle")}
      ${[[106, 64, "FL"], [238, 64, "FR"], [106, 140, "RL"], [238, 140, "RR"]].map(([x, y, l]) =>
        `<rect class="dg-tire" x="${x}" y="${y}" width="16" height="34" rx="5"/>${t(x < 180 ? x - 22 : x + 38, y + 22, l, "dg-text", x < 180 ? "end" : "start")}`).join("")}
      ${arrow("M96 100v38", "dg-arrow-strong")}${arrow("M264 100v38", "dg-arrow-strong")}
      ${arrow("M128 150L230 96", "dg-arrow-alt")}${arrow("M232 150L130 96", "dg-arrow-alt")}
      ${t(20, 210, "Blue: fronts go straight back", "dg-sub")}${t(340, 210, "Purple: rears cross", "dg-sub", "end")}
    `),
  },
  "battery-check": {
    alt: "A car battery with the positive terminal marked plus in red and the negative terminal marked minus in black, white corrosion on a terminal, and the order to disconnect negative first and reconnect positive first.",
    caption: "Off: negative first, then positive. On: positive first, then negative.",
    svg: svg(`
      <rect class="dg-panel" x="8" y="14" width="344" height="202" rx="14"/>
      <rect class="dg-battery" x="30" y="104" width="170" height="96" rx="10"/>
      <rect class="dg-pos" x="52" y="84" width="30" height="22" rx="4"/>${t(67, 100, "+", "dg-term", "middle")}
      <rect class="dg-neg" x="148" y="84" width="30" height="22" rx="4"/>${t(163, 100, "−", "dg-term", "middle")}
      <circle class="dg-corrosion" cx="56" cy="86" r="6"/><circle class="dg-corrosion" cx="76" cy="82" r="5"/><circle class="dg-corrosion" cx="70" cy="90" r="4"/>
      ${t(70, 156, "RED +", "dg-inv", "middle")}${t(160, 156, "BLACK −", "dg-inv", "middle")}
      ${lead(40, 52, 58, 82)}${t(22, 36, ["Crusty white or green", "= corrosion"], "dg-text")}
      <rect class="dg-card" x="216" y="38" width="126" height="70" rx="10"/>
      ${t(228, 58, "Disconnect", "dg-strong")}${num(1, 238, 80)}${t(254, 85, "− first", "dg-text")}${num(2, 238, 100)}${t(254, 105, "then +", "dg-text")}
      <rect class="dg-card" x="216" y="122" width="126" height="70" rx="10"/>
      ${t(228, 142, "Reconnect", "dg-strong")}${num(1, 238, 164)}${t(254, 169, "+ first", "dg-text")}${num(2, 238, 184)}${t(254, 189, "then −", "dg-text")}
    `),
  },
  "jump-start": {
    alt: "Jumper cable order between a dead battery and a good battery: 1, red to the dead battery's plus; 2, red to the good battery's plus; 3, black to the good battery's minus; 4, black to bare metal on the dead car's engine.",
    caption: "Connect in order 1 to 4. Clamp 4 goes on bare metal, not the dead battery's minus. Remove in reverse, 4 to 1.",
    svg: svg(`
      <rect class="dg-panel" x="8" y="14" width="344" height="202" rx="14"/>
      
      <rect class="dg-battery" x="34" y="70" width="100" height="64" rx="8"/>
      <rect class="dg-pos" x="46" y="56" width="22" height="16" rx="3"/>${t(57, 69, "+", "dg-term", "middle")}
      <rect class="dg-neg" x="100" y="56" width="22" height="16" rx="3"/>${t(111, 69, "−", "dg-term", "middle")}
      <rect class="dg-battery" x="226" y="70" width="100" height="64" rx="8"/>
      <rect class="dg-pos" x="238" y="56" width="22" height="16" rx="3"/>${t(249, 69, "+", "dg-term", "middle")}
      <rect class="dg-neg" x="292" y="56" width="22" height="16" rx="3"/>${t(303, 69, "−", "dg-term", "middle")}
      ${t(84, 108, "DEAD", "dg-inv", "middle")}${t(276, 108, "GOOD", "dg-inv", "middle")}<rect class="dg-metal" x="40" y="160" width="90" height="34" rx="8"/>${t(85, 174, "Bare metal", "dg-tiny", "middle")}${t(85, 187, "(engine bolt)", "dg-tiny", "middle")}
      <path class="dg-cable-red" d="M57 56q0-20 30-20h132q30 0 30 20"/>
      <path class="dg-cable-black" d="M303 56q0-16 18-16h8q14 0 14 14v134q0 14-14 14H150q-20 0-20-15"/>
      ${num(1, 40, 52)}${num(2, 232, 48)}${num(3, 318, 82)}${num(4, 146, 202)}
    `),
  },
  "brake-pads": {
    alt: "A brake rotor with the caliper clamped over its edge, and a close-up comparing a healthy pad with plenty of material to a worn pad thinner than about one eighth of an inch.",
    caption: "Replace pads when the friction material is thinner than about 1/8 inch (3 mm).",
    svg: svg(`
      <rect class="dg-panel" x="8" y="14" width="172" height="202" rx="14"/>
      ${t(94, 34, "Through the wheel", "dg-sub", "middle")}
      <circle class="dg-rotor" cx="90" cy="124" r="66"/><circle class="dg-body2" cx="90" cy="124" r="24"/>
      <path class="dg-caliper" d="M126 70q36 14 44 54-8 40-44 54l-10-20q20-12 24-34-4-22-24-34z"/>
      ${lead(150, 202, 150, 166)}${t(94, 208, "Caliper", "dg-text", "middle")}
      <rect class="dg-panel" x="190" y="14" width="162" height="202" rx="14"/>
      ${t(271, 34, "Pad, side view", "dg-sub", "middle")}
      <rect class="dg-metal" x="206" y="50" width="12" height="62"/><rect class="dg-pad" x="218" y="50" width="34" height="62"/>
      <rect class="dg-rotor" x="252" y="44" width="10" height="74"/>
      ${check(300, 74)}${t(274, 100, "Healthy", "dg-ok-t")}
      <rect class="dg-metal" x="206" y="132" width="12" height="62"/><rect class="dg-pad-worn" x="218" y="132" width="7" height="62"/>
      <rect class="dg-rotor" x="225" y="126" width="10" height="74"/>
      ${cross(300, 150)}${t(246, 176, ["Under 1/8 in", "(3 mm): replace"], "dg-bad-t")}
    `),
  },
  "spark-plugs": {
    alt: "Cross-section of the top of the engine: the ignition coil pulled up out of the spark plug well, the spark plug at the bottom, and a close-up of the plug's tip showing the gap.",
    caption: "Work one cylinder at a time. Thread new plugs in by hand first, then tighten to the torque in your manual.",
    svg: svg(`
      <rect class="dg-panel" x="8" y="14" width="200" height="202" rx="14"/>
      <rect class="dg-body2" x="24" y="96" width="168" height="108" rx="8"/>${t(108, 196, "Engine head", "dg-sub2", "middle")}
      <rect class="dg-well" x="88" y="96" width="40" height="80"/>
      <rect class="dg-hl" x="94" y="22" width="28" height="64" rx="6"/><rect class="dg-metal" x="99" y="86" width="18" height="12"/>
      ${arrow("M138 76V36", "dg-arrow-strong")}${t(150, 50, ["Coil", "pulls up"], "dg-text")}
      <rect class="dg-plug-ins" x="100" y="128" width="16" height="30" rx="3"/><rect class="dg-metal" x="98" y="158" width="20" height="18"/>
      ${lead(50, 82, 98, 140)}${t(18, 66, ["Spark", "plug"], "dg-text")}
      <rect class="dg-panel" x="218" y="14" width="134" height="202" rx="14"/>
      ${t(285, 34, "Plug tip", "dg-sub", "middle")}
      <rect class="dg-metal" x="262" y="48" width="46" height="70" rx="4"/>
      <path class="dg-metal" d="M272 118h26v20h-26z"/>
      <rect class="dg-electrode" x="282" y="138" width="6" height="22"/>
      <path class="dg-electrode-g" d="M298 132v42h-16"/>
      <path class="dg-gap" d="M262 160h16M262 174h16"/>${t(258, 171, "Gap", "dg-text", "end")}${t(285, 196, ["Check it with", "a gap gauge"], "dg-sub2", "middle")}
    `),
  },
};

export function diagramFor(slug) {
  return DIAGRAMS[slug] ?? null;
}

export const DIAGRAM_SLUGS = Object.keys(DIAGRAMS);
