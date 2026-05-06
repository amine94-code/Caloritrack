import { useState, useEffect, useCallback } from "react";

const KEY_PROFILE = "ct_profile";
const KEY_DAYS    = "ct_days";
const KEY_WEIGHT  = "ct_weight";
const KEY_CUSTOM  = "ct_custom_foods";

const load = (k, d) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } };
const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };
const today = () => new Date().toISOString().slice(0, 10);

function calcTDEE({ poids, taille, age, sexe, activite }) {
  const bmr = sexe === "H" ? 10*poids+6.25*taille-5*age+5 : 10*poids+6.25*taille-5*age-161;
  const f = { sedentaire:1.2, leger:1.375, modere:1.55, actif:1.725, tres_actif:1.9 };
  return Math.round(bmr * (f[activite] || 1.55));
}
function deficitGoal(tdee, objectif) {
  if (objectif === "perte") return Math.max(1200, tdee - 500);
  if (objectif === "gain")  return tdee + 300;
  return tdee;
}

// ── Streaks ───────────────────────────────────────────────────────────────────
function calcStreak(days, goal) {
  let streak = 0;
  const d = new Date();
  for (let i = 0; i < 60; i++) {
    const key = new Date(d.getTime() - i * 86400000).toISOString().slice(0, 10);
    const cal = (days[key]?.items || []).reduce((s, x) => s + x.cal, 0);
    if (cal > 0 && cal <= goal * 1.05) streak++;
    else if (i > 0) break;
  }
  return streak;
}

// ── Messages d'encouragement ──────────────────────────────────────────────────
const QUOTES = [
  { ar: "إِنَّ اللَّهَ جَمِيلٌ يُحِبُّ الْجَمَالَ", fr: "Allah est beau et Il aime la beauté.", src: "Muslim" },
  { ar: "لِجَسَدِكَ عَلَيْكَ حَقٌّ", fr: "Ton corps a des droits sur toi.", src: "Bukhari" },
  { ar: "نِعْمَتَانِ مَغْبُونٌ فِيهِمَا كَثِيرٌ مِنَ النَّاسِ الصِّحَّةُ وَالْفَرَاغُ", fr: "Deux bienfaits sont négligés par beaucoup : la santé et le temps libre.", src: "Bukhari" },
  { ar: "الْمُؤْمِنُ الْقَوِيُّ خَيْرٌ وَأَحَبُّ إِلَى اللَّهِ مِنَ الْمُؤْمِنِ الضَّعِيفِ", fr: "Le croyant fort est meilleur et plus aimé d'Allah que le croyant faible.", src: "Muslim" },
  { ar: "مَا مَلَأَ آدَمِيٌّ وِعَاءً شَرًّا مِنْ بَطْنٍ", fr: "L'homme ne remplit pas de récipient pire que son ventre.", src: "Tirmidhi" },
];

function getEncouragement(pct, streak, totalCal, goal) {
  if (pct === 0) return { emoji: "🌅", title: "Bismillah !", msg: "Commence à enregistrer tes repas pour suivre ta journée." };
  if (pct > 1.15) return { emoji: "⚠️", title: "Objectif dépassé", msg: "Pas de souci, chaque jour est un nouveau départ. Compense demain avec une marche." };
  if (pct > 1.0)  return { emoji: "🎯", title: "Légèrement au-dessus", msg: `Seulement ${totalCal - goal} kcal de plus. Rien de grave, continue demain !` };
  if (pct > 0.9)  return { emoji: "✅", title: "Objectif atteint !", msg: streak > 2 ? `${streak} jours d'affilée ! Tu es en feu 🔥` : "Excellent travail aujourd'hui. Évite les grignotages en soirée." };
  if (pct > 0.6)  return { emoji: "💪", title: "Bonne progression", msg: `Plus que ${goal - totalCal} kcal. Un repas équilibré et c'est parfait.` };
  return { emoji: "👍", title: "C'est parti !", msg: `${goal - totalCal} kcal encore disponibles. Tu gères bien ta journée.` };
}

// ── Foods ─────────────────────────────────────────────────────────────────────
const BASE_FOODS = [
  { cat:"🍚 Féculents",  name:"Riz blanc cuit",            cal:130, unit:"100g" },
  { cat:"🍚 Féculents",  name:"Riz basmati cuit",          cal:121, unit:"100g" },
  { cat:"🍚 Féculents",  name:"Pâtes cuites",              cal:131, unit:"100g" },
  { cat:"🍚 Féculents",  name:"Semoule couscous cuite",    cal:112, unit:"100g" },
  { cat:"🍚 Féculents",  name:"Purée de pommes de terre",  cal:90,  unit:"portion" },
  { cat:"🍚 Féculents",  name:"Pomme de terre vapeur",     cal:77,  unit:"100g" },
  { cat:"🍚 Féculents",  name:"Quinoa cuit",               cal:120, unit:"100g" },
  { cat:"🍚 Féculents",  name:"Boulgour cuit",             cal:83,  unit:"100g" },
  { cat:"🍚 Féculents",  name:"Lentilles cuites",          cal:116, unit:"100g" },
  { cat:"🍚 Féculents",  name:"Pois chiches cuits",        cal:164, unit:"100g" },
  { cat:"🍚 Féculents",  name:"Haricots rouges cuits",     cal:127, unit:"100g" },
  { cat:"🍚 Féculents",  name:"Pain blanc (1 tranche)",    cal:80,  unit:"tranche" },
  { cat:"🍚 Féculents",  name:"Pain complet (1 tranche)",  cal:70,  unit:"tranche" },
  { cat:"🍚 Féculents",  name:"Baguette (portion)",        cal:140, unit:"portion" },
  { cat:"🍚 Féculents",  name:"Msemen (1 galette)",        cal:220, unit:"galette" },
  { cat:"🍚 Féculents",  name:"Batbout",                   cal:180, unit:"unité" },
  { cat:"🥩 Viandes",    name:"Poulet grillé",             cal:165, unit:"100g" },
  { cat:"🥩 Viandes",    name:"Blanc de poulet vapeur",    cal:110, unit:"100g" },
  { cat:"🥩 Viandes",    name:"Cuisse de poulet",          cal:185, unit:"100g" },
  { cat:"🥩 Viandes",    name:"Escalope de dinde",         cal:104, unit:"100g" },
  { cat:"🥩 Viandes",    name:"Merguez (1 pièce)",         cal:120, unit:"unité" },
  { cat:"🥩 Viandes",    name:"Kefta (100g)",              cal:210, unit:"100g" },
  { cat:"🥩 Viandes",    name:"Agneau gigot cuit",         cal:191, unit:"100g" },
  { cat:"🥩 Viandes",    name:"Côte d'agneau",             cal:218, unit:"100g" },
  { cat:"🥩 Viandes",    name:"Boeuf haché 5%",            cal:135, unit:"100g" },
  { cat:"🥩 Viandes",    name:"Boeuf haché 15%",           cal:215, unit:"100g" },
  { cat:"🥩 Viandes",    name:"Chawarma poulet",           cal:175, unit:"100g" },
  { cat:"🥩 Viandes",    name:"Poulet rôti (portion)",     cal:250, unit:"portion" },
  { cat:"🐟 Poissons",   name:"Dos de colin",              cal:82,  unit:"100g" },
  { cat:"🐟 Poissons",   name:"Saumon grillé",             cal:208, unit:"100g" },
  { cat:"🐟 Poissons",   name:"Thon en boîte naturel",     cal:116, unit:"100g" },
  { cat:"🐟 Poissons",   name:"Cabillaud",                 cal:69,  unit:"100g" },
  { cat:"🐟 Poissons",   name:"Sardines grillées",         cal:185, unit:"100g" },
  { cat:"🐟 Poissons",   name:"Maquereau grillé",          cal:205, unit:"100g" },
  { cat:"🐟 Poissons",   name:"Crevettes cuites",          cal:99,  unit:"100g" },
  { cat:"🥚 Oeufs/Lait", name:"Oeuf entier",               cal:70,  unit:"unité" },
  { cat:"🥚 Oeufs/Lait", name:"Oeufs brouillés (2)",       cal:180, unit:"portion" },
  { cat:"🥚 Oeufs/Lait", name:"Omelette nature (2 oeufs)", cal:160, unit:"portion" },
  { cat:"🥚 Oeufs/Lait", name:"Yaourt nature",             cal:59,  unit:"pot 125g" },
  { cat:"🥚 Oeufs/Lait", name:"Yaourt grec",               cal:97,  unit:"pot 150g" },
  { cat:"🥚 Oeufs/Lait", name:"Fromage blanc 0%",          cal:45,  unit:"100g" },
  { cat:"🥚 Oeufs/Lait", name:"Skyr nature",               cal:57,  unit:"pot 150g" },
  { cat:"🥚 Oeufs/Lait", name:"Lait demi-écrémé",          cal:46,  unit:"100ml" },
  { cat:"🥚 Oeufs/Lait", name:"Fromage emmental (30g)",    cal:113, unit:"portion" },
  { cat:"🥦 Légumes",    name:"Brocoli vapeur",            cal:34,  unit:"100g" },
  { cat:"🥦 Légumes",    name:"Haricots verts",            cal:31,  unit:"100g" },
  { cat:"🥦 Légumes",    name:"Carottes cuites",           cal:41,  unit:"100g" },
  { cat:"🥦 Légumes",    name:"Tomate",                    cal:18,  unit:"100g" },
  { cat:"🥦 Légumes",    name:"Salade verte",              cal:15,  unit:"100g" },
  { cat:"🥦 Légumes",    name:"Courgette",                 cal:17,  unit:"100g" },
  { cat:"🥦 Légumes",    name:"Épinards cuits",            cal:23,  unit:"100g" },
  { cat:"🥦 Légumes",    name:"Aubergine grillée",         cal:33,  unit:"100g" },
  { cat:"🥦 Légumes",    name:"Zaalouk",                   cal:80,  unit:"portion" },
  { cat:"🥦 Légumes",    name:"Taktouka",                  cal:70,  unit:"portion" },
  { cat:"🍎 Fruits",     name:"Pomme",                     cal:52,  unit:"unité" },
  { cat:"🍎 Fruits",     name:"Banane",                    cal:89,  unit:"unité" },
  { cat:"🍎 Fruits",     name:"Orange",                    cal:47,  unit:"unité" },
  { cat:"🍎 Fruits",     name:"Poire",                     cal:57,  unit:"unité" },
  { cat:"🍎 Fruits",     name:"Fraises (200g)",            cal:64,  unit:"portion" },
  { cat:"🍎 Fruits",     name:"Avocat (1/2)",              cal:120, unit:"demi" },
  { cat:"🍎 Fruits",     name:"Pastèque (200g)",           cal:60,  unit:"portion" },
  { cat:"🍎 Fruits",     name:"Mangue (200g)",             cal:130, unit:"portion" },
  { cat:"🍎 Fruits",     name:"Dattes (3 pièces)",         cal:75,  unit:"portion" },
  { cat:"🍎 Fruits",     name:"Figues (2 pièces)",         cal:74,  unit:"portion" },
  { cat:"🍫 Snacks",     name:"Amandes (30g)",             cal:174, unit:"poignée" },
  { cat:"🍫 Snacks",     name:"Noix (30g)",                cal:196, unit:"poignée" },
  { cat:"🍫 Snacks",     name:"Chocolat noir (2 carrés)",  cal:110, unit:"portion" },
  { cat:"🍫 Snacks",     name:"Chebakia (1 pièce)",        cal:140, unit:"unité" },
  { cat:"🍫 Snacks",     name:"Baklava (1 pièce)",         cal:135, unit:"unité" },
  { cat:"🍫 Snacks",     name:"Makroud (1 pièce)",         cal:120, unit:"unité" },
  { cat:"🍫 Snacks",     name:"Croissant au beurre",       cal:231, unit:"unité" },
  { cat:"🍫 Snacks",     name:"Pain au chocolat",          cal:285, unit:"unité" },
  { cat:"☕ Boissons",   name:"Café noir",                 cal:2,   unit:"tasse" },
  { cat:"☕ Boissons",   name:"Café au lait",              cal:60,  unit:"tasse" },
  { cat:"☕ Boissons",   name:"Thé menthe sucré",          cal:50,  unit:"verre" },
  { cat:"☕ Boissons",   name:"Thé menthe sans sucre",     cal:2,   unit:"verre" },
  { cat:"☕ Boissons",   name:"Lait (200ml)",              cal:92,  unit:"verre" },
  { cat:"☕ Boissons",   name:"Jus d'orange (200ml)",      cal:88,  unit:"verre" },
  { cat:"☕ Boissons",   name:"Smoothie fruits (200ml)",   cal:110, unit:"verre" },
  { cat:"☕ Boissons",   name:"Coca-cola (33cl)",          cal:139, unit:"canette" },
  { cat:"☕ Boissons",   name:"Eau",                       cal:0,   unit:"verre" },
  { cat:"🫕 Plats",      name:"Couscous poulet",           cal:420, unit:"assiette" },
  { cat:"🫕 Plats",      name:"Couscous légumes",          cal:280, unit:"assiette" },
  { cat:"🫕 Plats",      name:"Tajine poulet-olives",      cal:360, unit:"portion" },
  { cat:"🫕 Plats",      name:"Tajine agneau-pruneaux",    cal:410, unit:"portion" },
  { cat:"🫕 Plats",      name:"Harira (bol)",              cal:155, unit:"bol" },
  { cat:"🫕 Plats",      name:"Chorba (bol)",              cal:140, unit:"bol" },
  { cat:"🫕 Plats",      name:"Shakshuka (2 oeufs)",       cal:220, unit:"portion" },
  { cat:"🫕 Plats",      name:"Riz au poulet",             cal:380, unit:"assiette" },
  { cat:"🫕 Plats",      name:"Soupe de légumes",          cal:60,  unit:"bol" },
  { cat:"🫕 Plats",      name:"Wrap poulet",               cal:320, unit:"unité" },
  { cat:"🫕 Plats",      name:"Burger boeuf halal",        cal:480, unit:"unité" },
];

const ALL_CATS = [...new Set(BASE_FOODS.map(f => f.cat))];
const MEALS = ["Petit-déjeuner", "Déjeuner", "Dîner", "Collation"];

// ── Design tokens ─────────────────────────────────────────────────────────────
const C = {
  bg:      "#080f08",
  bg2:     "#0e1a0e",
  card:    "#121f12",
  border:  "#1e321e",
  green:   "#4ade80",
  greenD:  "#22c55e",
  greenDk: "#166534",
  muted:   "#6b9e6b",
  text:    "#f0faf0",
  textSub: "#94a394",
  red:     "#f87171",
  gold:    "#fbbf24",
};

const css = {
  app:  { minHeight: "100vh", background: C.bg, color: C.text, fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif", paddingBottom: 110 },
  card: { background: C.card, border: `1px solid ${C.border}`, borderRadius: 20, padding: 18, marginBottom: 14 },
  inp:  { width: "100%", background: C.bg2, border: `1px solid ${C.border}`, borderRadius: 12, padding: "12px 14px", color: C.text, fontSize: 16, boxSizing: "border-box", outline: "none", WebkitAppearance: "none" },
  btn:  { background: `linear-gradient(135deg, ${C.greenD}, ${C.greenDk})`, border: "none", borderRadius: 12, padding: "13px 20px", color: "#fff", fontSize: 15, cursor: "pointer", fontWeight: 700, letterSpacing: 0.3 },
  btnG: { background: "transparent", border: `1px solid ${C.border}`, borderRadius: 12, padding: "10px 16px", color: C.muted, fontSize: 13, cursor: "pointer" },
  sel:  { background: C.bg2, border: `1px solid ${C.border}`, borderRadius: 12, padding: "12px 14px", color: C.text, fontSize: 15, width: "100%", outline: "none", WebkitAppearance: "none" },
  lbl:  { fontSize: 12, color: C.muted, marginBottom: 6, display: "block", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 },
  h2:   { fontSize: 18, color: C.text, fontWeight: 700, marginBottom: 14 },
  row:  { display: "flex", gap: 10, alignItems: "center" },
};

// ── Ring ──────────────────────────────────────────────────────────────────────
function Ring({ pct, cal, goal }) {
  const r = 70, cx = 84, cy = 84, circ = 2 * Math.PI * r;
  const over = pct > 1;
  const color = over ? C.red : pct > 0.9 ? C.green : C.greenD;
  return (
    <svg viewBox="0 0 168 168" style={{ width: 168, height: 168 }}>
      <defs>
        <linearGradient id="ringGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={color} />
          <stop offset="100%" stopColor={over ? "#dc2626" : "#16a34a"} />
        </linearGradient>
      </defs>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={C.bg2} strokeWidth={14} />
      <circle cx={cx} cy={cy} r={r} fill="none"
        stroke="url(#ringGrad)" strokeWidth={14}
        strokeDasharray={`${Math.min(pct, 1) * circ} ${circ}`}
        strokeLinecap="round"
        transform={`rotate(-90 ${cx} ${cy})`}
        style={{ transition: "stroke-dasharray .8s cubic-bezier(.4,0,.2,1)" }} />
      <text x={cx} y={cy - 10} textAnchor="middle" fill={C.text} fontSize={28} fontWeight="800">{cal}</text>
      <text x={cx} y={cy + 10} textAnchor="middle" fill={C.muted} fontSize={12}>kcal</text>
      <text x={cx} y={cy + 28} textAnchor="middle" fill={color} fontSize={11} fontWeight="600">
        {over ? `+${cal - goal} dépassé` : `${goal - cal} restantes`}
      </text>
    </svg>
  );
}

// ── Streak badge ──────────────────────────────────────────────────────────────
function StreakBadge({ streak }) {
  if (streak < 2) return null;
  const fire = streak >= 7 ? "🔥🔥" : streak >= 3 ? "🔥" : "⚡";
  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 5, background: "linear-gradient(135deg,#92400e,#78350f)", border: "1px solid #d97706", borderRadius: 20, padding: "4px 12px" }}>
      <span style={{ fontSize: 14 }}>{fire}</span>
      <span style={{ fontSize: 13, fontWeight: 700, color: C.gold }}>{streak} jours</span>
    </div>
  );
}

// ── Quote card ────────────────────────────────────────────────────────────────
function QuoteCard({ quote }) {
  return (
    <div style={{ background: "linear-gradient(135deg,#0f2610,#162416)", border: `1px solid #2d5a2d`, borderRadius: 20, padding: "18px 20px", marginBottom: 14 }}>
      <div style={{ fontSize: 11, color: C.muted, marginBottom: 8, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>Hadith du jour</div>
      <div style={{ fontSize: 18, color: C.green, textAlign: "right", marginBottom: 10, lineHeight: 1.6, fontFamily: "serif" }}>{quote.ar}</div>
      <div style={{ fontSize: 13, color: C.text, lineHeight: 1.6, fontStyle: "italic" }}>"{quote.fr}"</div>
      <div style={{ fontSize: 11, color: C.muted, marginTop: 6 }}>— {quote.src}</div>
    </div>
  );
}

// ── Encouragement card ────────────────────────────────────────────────────────
function EncouragementCard({ pct, streak, totalCal, goal }) {
  const enc = getEncouragement(pct, streak, totalCal, goal);
  const barColor = pct > 1 ? C.red : pct > 0.9 ? C.green : C.greenD;
  const barW = Math.min(100, Math.round(pct * 100));
  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 20, padding: "16px 18px", marginBottom: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
        <span style={{ fontSize: 28 }}>{enc.emoji}</span>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: C.text }}>{enc.title}</div>
          <div style={{ fontSize: 13, color: C.textSub, marginTop: 2 }}>{enc.msg}</div>
        </div>
      </div>
      <div style={{ background: C.bg2, borderRadius: 8, height: 8 }}>
        <div style={{ width: `${barW}%`, background: `linear-gradient(90deg,${barColor},${barColor}88)`, height: "100%", borderRadius: 8, transition: "width .8s ease" }} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, fontSize: 11, color: C.muted }}>
        <span>{totalCal} kcal mangés</span>
        <span>Objectif : {goal} kcal</span>
      </div>
    </div>
  );
}

// ── Week bars ─────────────────────────────────────────────────────────────────
function WeekBars({ days, goal }) {
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0=Sun, 1=Mon...
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((dayOfWeek + 6) % 7)); // go back to Monday

  const wd = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    const key = d.toISOString().slice(0, 10);
    const cal = (days[key]?.items || []).reduce((s, x) => s + x.cal, 0);
    return { key, label: ["Lun","Mar","Mer","Jeu","Ven","Sam","Dim"][i], cal, isToday: key === today() };
  });
  const maxCal = Math.max(...wd.map(d => d.cal), goal);
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 4, height: 70 }}>
        {wd.map(d => {
          const h = d.cal > 0 ? Math.max(6, (d.cal / maxCal) * 60) : 0;
          const col = d.cal > goal ? C.red : d.isToday ? C.green : C.greenDk;
          return (
            <div key={d.key} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
              {d.cal > 0 && <div style={{ fontSize: 9, color: C.muted }}>{d.cal}</div>}
              <div style={{ width: "100%", height: 60, display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
                <div style={{ background: d.isToday ? `linear-gradient(180deg,${C.green},${C.greenDk})` : col, height: h, borderRadius: "6px 6px 4px 4px", opacity: d.isToday ? 1 : 0.7, transition: "height .6s ease", boxShadow: d.isToday ? `0 0 12px ${C.green}44` : "none" }} />
              </div>
              <div style={{ fontSize: 10, color: d.isToday ? C.green : C.muted, fontWeight: d.isToday ? 700 : 400 }}>{d.label}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Weight chart ──────────────────────────────────────────────────────────────
function WeightChart({ entries }) {
  if (entries.length < 2) {
    return <div style={{ color: C.muted, fontSize: 13, textAlign: "center", padding: "20px 0" }}>Ajoute au moins 2 pesées pour voir la courbe</div>;
  }
  const vals = entries.map(e => e.val);
  const min = Math.min(...vals) - 0.5, max = Math.max(...vals) + 0.5;
  const W = 300, H = 80;
  const px = (i) => (i / (entries.length - 1)) * (W - 20) + 10;
  const py = (v) => H - ((v - min) / (max - min)) * (H - 16) - 8;
  const pts = entries.map((e, i) => `${px(i)},${py(e.val)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", maxWidth: W }}>
      <defs>
        <linearGradient id="wGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={C.green} stopOpacity="0.3" />
          <stop offset="100%" stopColor={C.green} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={`10,${H} ${pts} ${px(entries.length-1)},${H}`} fill="url(#wGrad)" />
      <polyline points={pts} fill="none" stroke={C.green} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
      {entries.map((e, i) => (
        <g key={i}>
          <circle cx={px(i)} cy={py(e.val)} r={4} fill={C.bg} stroke={C.green} strokeWidth={2} />
          {(i === 0 || i === entries.length - 1) && (
            <text x={px(i)} y={py(e.val) - 10} textAnchor="middle" fill={C.green} fontSize={10} fontWeight="600">{e.val}</text>
          )}
        </g>
      ))}
    </svg>
  );
}

// ── Food Picker ───────────────────────────────────────────────────────────────
function FoodPicker({ onAdd, customFoods }) {
  const [search,  setSearch]  = useState("");
  const [cat,     setCat]     = useState("Tous");
  const [selFood, setSelFood] = useState(null);
  const [qty,     setQty]     = useState(1);

  const allFoods = customFoods.length > 0 ? [...customFoods, ...BASE_FOODS] : BASE_FOODS;
  const extraCats = customFoods.length > 0 ? ["⭐ Mes aliments"] : [];
  const allCats = [...new Set([...extraCats, ...ALL_CATS])];

  const filtered = allFoods.filter(f => {
    const matchCat  = cat === "Tous" || f.cat === cat;
    const matchName = f.name.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchName;
  });

  const handleAdd = () => {
    if (!selFood) return;
    onAdd({ name: selFood.name, calories: Math.round(selFood.cal * qty), quantite: `${qty !== 1 ? qty + "× " : ""}${selFood.unit}` });
    setSelFood(null); setQty(1); setSearch("");
  };

  return (
    <div>
      <input
        placeholder="Rechercher un aliment..."
        value={search}
        onChange={e => { setSearch(e.target.value); setSelFood(null); }}
        style={{ ...css.inp, marginBottom: 10 }}
      />
      <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 8, marginBottom: 10 }}>
        {["Tous", ...allCats].map(c => (
          <button key={c} onClick={() => { setCat(c); setSelFood(null); }} style={{
            whiteSpace: "nowrap", padding: "6px 14px", borderRadius: 20, fontSize: 12, cursor: "pointer", fontWeight: 600,
            background: cat === c ? C.greenD : C.bg2,
            border: `1px solid ${cat === c ? C.greenD : C.border}`,
            color: cat === c ? "#fff" : C.muted,
            transition: "all .2s",
          }}>{c === "Tous" ? "Tous" : c}</button>
        ))}
      </div>
      <div style={{ maxHeight: 230, overflowY: "auto", borderRadius: 14, border: `1px solid ${C.border}`, background: C.bg2 }}>
        {filtered.length === 0 && (
          <div style={{ padding: 20, textAlign: "center", color: C.muted, fontSize: 13 }}>Aucun résultat</div>
        )}
        {filtered.map((f, i) => {
          const sel = selFood && selFood.name === f.name;
          return (
            <div key={i} onClick={() => { setSelFood(f); setQty(1); }} style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              padding: "12px 14px", cursor: "pointer",
              background: sel ? "linear-gradient(90deg,#14291499,#0e1a0e)" : "transparent",
              borderLeft: `3px solid ${sel ? C.green : "transparent"}`,
              borderBottom: `1px solid ${C.border}`,
              transition: "all .15s",
            }}>
              <div>
                <div style={{ fontSize: 14, color: sel ? C.text : "#d4ead4", fontWeight: sel ? 600 : 400 }}>
                  {f.custom && <span style={{ fontSize: 10, color: C.green, marginRight: 5 }}>★</span>}
                  {f.name}
                </div>
                <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{f.unit}</div>
              </div>
              <span style={{ fontSize: 14, color: sel ? C.green : C.muted, fontWeight: 700, minWidth: 55, textAlign: "right" }}>{f.cal}</span>
            </div>
          );
        })}
      </div>
      {selFood && (
        <div style={{ background: "linear-gradient(135deg,#14291499,#0e220e)", border: `1px solid ${C.greenD}`, borderRadius: 16, padding: "14px 16px", marginTop: 10 }}>
          <div style={{ fontSize: 14, color: C.green, fontWeight: 700, marginBottom: 12 }}>{selFood.name}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
            <button onClick={() => setQty(q => Math.max(0.5, +(q - 0.5).toFixed(1)))} style={{ ...css.btnG, width: 40, height: 40, padding: 0, fontSize: 22, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center" }}>−</button>
            <div style={{ flex: 1, textAlign: "center" }}>
              <div style={{ fontSize: 20, fontWeight: 700, color: C.text }}>{qty}</div>
              <div style={{ fontSize: 11, color: C.muted }}>{selFood.unit}</div>
            </div>
            <button onClick={() => setQty(q => +(q + 0.5).toFixed(1))} style={{ ...css.btnG, width: 40, height: 40, padding: 0, fontSize: 22, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center" }}>+</button>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ fontSize: 24, fontWeight: 800, color: C.green }}>{Math.round(selFood.cal * qty)}</div>
              <div style={{ fontSize: 11, color: C.muted }}>kcal</div>
            </div>
            <button style={{ ...css.btn, padding: "12px 24px" }} onClick={handleAdd}>Ajouter au repas</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Add Custom Food ───────────────────────────────────────────────────────────
function AddCustomFood({ customFoods, setCustomFoods }) {
  const [name, setName] = useState("");
  const [cal,  setCal]  = useState("");
  const [unit, setUnit] = useState("portion");
  const [done, setDone] = useState(false);

  const handleAdd = () => {
    if (!name.trim() || !cal) return;
    const newFood = { cat: "⭐ Mes aliments", name: name.trim(), cal: +cal, unit: unit.trim() || "portion", custom: true };
    const updated = [...customFoods, newFood];
    setCustomFoods(updated);
    save(KEY_CUSTOM, updated);
    setName(""); setCal(""); setUnit("portion");
    setDone(true);
    setTimeout(() => setDone(false), 2000);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div>
        <label style={css.lbl}>Nom</label>
        <input placeholder="ex : Mhajeb, Baghrir..." value={name} onChange={e => setName(e.target.value)} style={css.inp} />
      </div>
      <div style={css.row}>
        <div style={{ flex: 1 }}>
          <label style={css.lbl}>Calories</label>
          <input type="number" placeholder="250" value={cal} onChange={e => setCal(e.target.value)} style={css.inp} />
        </div>
        <div style={{ flex: 1 }}>
          <label style={css.lbl}>Portion</label>
          <input placeholder="1 galette" value={unit} onChange={e => setUnit(e.target.value)} style={css.inp} />
        </div>
      </div>
      <button style={{ ...css.btn, background: done ? "#166534" : undefined, width: "100%" }} onClick={handleAdd}>
        {done ? "✓ Aliment créé !" : "+ Créer l'aliment"}
      </button>
      {customFoods.length > 0 && (
        <div style={{ marginTop: 4 }}>
          <div style={{ fontSize: 12, color: C.muted, marginBottom: 8, fontWeight: 600, textTransform: "uppercase" }}>Mes aliments ({customFoods.length})</div>
          {customFoods.map((f, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: `1px solid ${C.border}` }}>
              <div>
                <span style={{ fontSize: 13, color: C.text }}>{f.name}</span>
                <span style={{ fontSize: 11, color: C.muted, marginLeft: 8 }}>{f.unit}</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 13, color: C.green, fontWeight: 600 }}>{f.cal} kcal</span>
                <button onClick={() => { const u = customFoods.filter((_, j) => j !== i); setCustomFoods(u); save(KEY_CUSTOM, u); }} style={{ background: "none", border: "none", cursor: "pointer", color: "#7a3a3a", fontSize: 18, padding: 0 }}>✕</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Journal ───────────────────────────────────────────────────────────────────
function Journal({ days, selDate, setSelDate, meal, setMeal, addItems, removeFood, customFoods, setCustomFoods }) {
  const [tab, setTab] = useState("picker");
  const dayData = days[selDate] || { items: [] };
  const grouped = MEALS.reduce((a, m) => { a[m] = dayData.items.filter(i => i.meal === m); return a; }, {});
  const totalCal = dayData.items.reduce((s, i) => s + i.cal, 0);

  return (
    <div style={{ padding: "16px 16px 0" }}>
      <div style={{ ...css.card, padding: "12px 14px" }}>
        <div style={css.row}>
          <input type="date" value={selDate} max={today()} onChange={e => setSelDate(e.target.value)} style={{ ...css.inp, flex: 1 }} />
          <select value={meal} onChange={e => setMeal(e.target.value)} style={{ ...css.sel, flex: 1 }}>
            {MEALS.map(m => <option key={m}>{m}</option>)}
          </select>
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        {[["picker", "Choisir"], ["custom", "Créer"]].map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)} style={{
            flex: 1, padding: "12px", borderRadius: 14, border: "none", cursor: "pointer", fontSize: 14, fontWeight: 700,
            background: tab === id ? `linear-gradient(135deg,${C.greenD},${C.greenDk})` : C.card,
            color: tab === id ? "#fff" : C.muted,
            boxShadow: tab === id ? `0 4px 12px ${C.greenD}44` : "none",
          }}>{label}</button>
        ))}
      </div>

      <div style={css.card}>
        {tab === "picker"
          ? <FoodPicker onAdd={(item) => addItems([item], meal)} customFoods={customFoods} />
          : <AddCustomFood customFoods={customFoods} setCustomFoods={setCustomFoods} />
        }
      </div>

      {dayData.items.length > 0 && (
        <div style={{ background: `linear-gradient(135deg,${C.greenDk}33,${C.bg2})`, border: `1px solid ${C.greenDk}`, borderRadius: 20, padding: "14px 18px", textAlign: "center", marginBottom: 14 }}>
          <div style={{ fontSize: 11, color: C.muted, marginBottom: 4, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>Total journée</div>
          <div style={{ fontSize: 26, fontWeight: 800, color: C.green }}>{totalCal} <span style={{ fontSize: 14, fontWeight: 400, color: C.muted }}>kcal</span></div>
        </div>
      )}

      {MEALS.map(m => grouped[m].length > 0 && (
        <div key={m} style={css.card}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <span style={{ fontSize: 14, color: C.green, fontWeight: 700 }}>{m}</span>
            <span style={{ fontSize: 14, color: C.text, fontWeight: 700 }}>{grouped[m].reduce((s, i) => s + i.cal, 0)} kcal</span>
          </div>
          {grouped[m].map(item => (
            <div key={item.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "9px 0", borderBottom: `1px solid ${C.border}` }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, color: "#d4ead4" }}>{item.name}</div>
                {item.qty && <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{item.qty}</div>}
              </div>
              <span style={{ fontSize: 14, color: C.green, fontWeight: 600, marginRight: 12 }}>{item.cal}</span>
              <button onClick={() => removeFood(item.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "#5a2a2a", fontSize: 20, padding: 0, lineHeight: 1 }}>×</button>
            </div>
          ))}
        </div>
      ))}

      {dayData.items.length === 0 && tab === "picker" && (
        <div style={{ textAlign: "center", color: C.muted, padding: "40px 20px", fontSize: 14 }}>
          <div style={{ fontSize: 32, marginBottom: 10 }}>🍽️</div>
          Sélectionne un aliment pour commencer
        </div>
      )}
    </div>
  );
}

// ── Dashboard ─────────────────────────────────────────────────────────────────
function Dashboard({ days, goal, tdee, totalCal, pct, dayData, selDate, lastW, weight, delta, streak }) {
  const quote = QUOTES[new Date().getDay() % QUOTES.length];
  const filled = Object.values(days).filter(d => d.items?.length > 0).length;

  return (
    <div style={{ padding: "16px 16px 0" }}>
      <div style={{ ...css.card, background: `linear-gradient(160deg,#142814,${C.card})`, padding: "20px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
          <div>
            <div style={{ fontSize: 12, color: C.muted, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>
              {selDate === today() ? "Aujourd'hui" : selDate}
            </div>
            {streak >= 2 && <StreakBadge streak={streak} />}
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 11, color: C.muted }}>Objectif</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: C.text }}>{goal} kcal</div>
          </div>
        </div>
        <div style={{ display: "flex", justifyContent: "center", margin: "10px 0" }}>
          <Ring pct={pct} cal={totalCal} goal={goal} />
        </div>
        <div style={{ display: "flex", justifyContent: "space-around" }}>
          {[["TDEE", `${tdee} kcal`], ["Repas", dayData.items.length], ["Jours", filled]].map(([lbl, val]) => (
            <div key={lbl} style={{ textAlign: "center" }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: C.text }}>{val}</div>
              <div style={{ fontSize: 10, color: C.muted, marginTop: 2, textTransform: "uppercase", letterSpacing: 0.4 }}>{lbl}</div>
            </div>
          ))}
        </div>
      </div>

      <EncouragementCard pct={pct} streak={streak} totalCal={totalCal} goal={goal} />

      <div style={css.card}>
        <div style={css.h2}>Cette semaine</div>
        <WeekBars days={days} goal={goal} />
      </div>

      {lastW && (
        <div style={css.card}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <div style={css.h2}>Poids</div>
            {delta && (
              <span style={{
                background: +delta < 0 ? "#14291488" : "#290e0e88",
                border: `1px solid ${+delta < 0 ? C.greenDk : "#7f1d1d"}`,
                color: +delta < 0 ? C.green : C.red,
                borderRadius: 20, padding: "4px 12px", fontSize: 13, fontWeight: 700,
              }}>{+delta > 0 ? "+" : ""}{delta} kg</span>
            )}
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 14 }}>
            <span style={{ fontSize: 32, fontWeight: 800, color: C.text }}>{lastW}</span>
            <span style={{ fontSize: 16, color: C.muted }}>kg</span>
          </div>
          <WeightChart entries={weight.slice(-10)} />
        </div>
      )}

      <QuoteCard quote={quote} />
    </div>
  );
}

// ── Poids ─────────────────────────────────────────────────────────────────────
function Poids({ weight, setWeight, newW, setNewW, addWeight }) {
  const [weightDate, setWeightDate] = useState(today());
  const [kg,  setKg]  = useState(75);
  const [dec, setDec] = useState(0);

  const val = +(kg + dec / 10).toFixed(1);

  const handleAdd = () => {
    setWeight(prev => [...prev, { date: weightDate, val, id: Date.now() }].sort((a, b) => a.date.localeCompare(b.date)));
  };

  const removeWeight = (idx) => setWeight(prev => prev.filter((_, i) => i !== idx));

  const formatDate = (dateStr) => {
    const d = new Date(dateStr + "T12:00:00");
    return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
  };

  const Stepper = ({ label, value, onDec, onInc, unit }) => (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
      <div style={{ fontSize: 11, color: C.muted, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>{label}</div>
      <button onClick={onInc} style={{ background: `${C.greenDk}55`, border: `1px solid ${C.border}`, borderRadius: 12, width: 44, height: 44, fontSize: 22, color: C.green, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>+</button>
      <div style={{ fontSize: 34, fontWeight: 800, color: C.text, minWidth: 50, textAlign: "center", lineHeight: 1 }}>
        {String(value).padStart(2, "0")}
        <div style={{ fontSize: 11, color: C.muted, fontWeight: 400, marginTop: 4 }}>{unit}</div>
      </div>
      <button onClick={onDec} style={{ background: `${C.greenDk}55`, border: `1px solid ${C.border}`, borderRadius: 12, width: 44, height: 44, fontSize: 22, color: C.green, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>−</button>
    </div>
  );

  return (
    <div style={{ padding: "16px 16px 0" }}>
      <div style={css.card}>
        <div style={css.h2}>Ajouter une pesée</div>

        {/* Date */}
        <div style={{ marginBottom: 20 }}>
          <label style={css.lbl}>Date</label>
          <input type="date" value={weightDate} max={today()} onChange={e => setWeightDate(e.target.value)} style={css.inp} />
        </div>

        {/* Weight picker */}
        <div style={{ background: C.bg2, border: `1px solid ${C.border}`, borderRadius: 20, padding: "20px 16px", marginBottom: 16 }}>
          <div style={{ textAlign: "center", marginBottom: 16 }}>
            <span style={{ fontSize: 42, fontWeight: 800, color: C.green }}>{val}</span>
            <span style={{ fontSize: 18, color: C.muted, marginLeft: 6 }}>kg</span>
          </div>
          <div style={{ display: "flex", justifyContent: "center", gap: 20, alignItems: "flex-start" }}>
            <Stepper
              label="kg"
              value={kg}
              onInc={() => setKg(k => Math.min(300, k + 1))}
              onDec={() => setKg(k => Math.max(20, k - 1))}
              unit="entier"
            />
            <div style={{ width: 1, background: C.border, height: 140, alignSelf: "center" }} />
            <Stepper
              label="décimale"
              value={dec}
              onInc={() => setDec(d => (d + 1) % 10)}
              onDec={() => setDec(d => (d - 1 + 10) % 10)}
              unit=".0"
            />
          </div>
        </div>

        <button style={{ ...css.btn, width: "100%", padding: 14, fontSize: 16 }} onClick={handleAdd}>
          Enregistrer {val} kg
        </button>
      </div>

      {weight.length > 0 && (
        <div style={css.card}>
          <div style={css.h2}>Évolution</div>
          <WeightChart entries={weight} />
          <div style={{ marginTop: 16, maxHeight: 280, overflowY: "auto" }}>
            {[...weight].reverse().map((e, i) => {
              const realIdx = weight.length - 1 - i;
              return (
                <div key={realIdx} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: `1px solid ${C.border}` }}>
                  <span style={{ fontSize: 13, color: C.muted }}>{formatDate(e.date)}</span>
                  <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                    <span style={{ fontSize: 15, color: C.text, fontWeight: 700 }}>{e.val} kg</span>
                    <button onClick={() => removeWeight(realIdx)} style={{ background: "#2a0e0e", border: `1px solid #5a2a2a`, borderRadius: 8, cursor: "pointer", color: "#f87171", fontSize: 14, padding: "4px 10px", fontWeight: 600 }}>Supprimer</button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Profile form ──────────────────────────────────────────────────────────────
function ProfileForm({ pf, setPf, onSave }) {
  const set = (k, v) => setPf(p => ({ ...p, [k]: v }));
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={css.row}>
        <div style={{ flex: 1 }}>
          <label style={css.lbl}>Poids (kg)</label>
          <input type="number" placeholder="82" value={pf.poids} onChange={e => set("poids", e.target.value)} style={css.inp} />
        </div>
        <div style={{ flex: 1 }}>
          <label style={css.lbl}>Taille (cm)</label>
          <input type="number" placeholder="178" value={pf.taille} onChange={e => set("taille", e.target.value)} style={css.inp} />
        </div>
      </div>
      <div style={css.row}>
        <div style={{ flex: 1 }}>
          <label style={css.lbl}>Âge</label>
          <input type="number" placeholder="35" value={pf.age} onChange={e => set("age", e.target.value)} style={css.inp} />
        </div>
        <div style={{ flex: 1 }}>
          <label style={css.lbl}>Sexe</label>
          <select value={pf.sexe} onChange={e => set("sexe", e.target.value)} style={css.sel}>
            <option value="H">Homme</option>
            <option value="F">Femme</option>
          </select>
        </div>
      </div>
      <div>
        <label style={css.lbl}>Niveau d'activité</label>
        <select value={pf.activite} onChange={e => set("activite", e.target.value)} style={css.sel}>
          <option value="sedentaire">Sédentaire (bureau)</option>
          <option value="leger">Léger (marche)</option>
          <option value="modere">Modéré (sport 3-5h/sem)</option>
          <option value="actif">Actif</option>
          <option value="tres_actif">Très actif</option>
        </select>
      </div>
      <div>
        <label style={css.lbl}>Objectif</label>
        <div style={{ display: "flex", gap: 8 }}>
          {[["perte", "🔻 Perte"], ["maintien", "↔ Maintien"], ["gain", "📈 Prise"]].map(([v, l]) => (
            <button key={v} onClick={() => set("objectif", v)} style={{
              flex: 1, padding: "11px 6px", borderRadius: 12, cursor: "pointer", fontSize: 12, fontWeight: 700,
              background: pf.objectif === v ? `linear-gradient(135deg,${C.greenD},${C.greenDk})` : C.bg2,
              border: `1px solid ${pf.objectif === v ? C.greenD : C.border}`,
              color: pf.objectif === v ? "#fff" : C.muted,
            }}>{l}</button>
          ))}
        </div>
      </div>
      <button style={{ ...css.btn, width: "100%", padding: 14, fontSize: 16, marginTop: 4 }} onClick={onSave}>
        Calculer mon objectif →
      </button>
    </div>
  );
}

// ── ProfilView ────────────────────────────────────────────────────────────────
function ProfilView({ profile, setProfile, tdee, goal }) {
  const [ed, setEd]   = useState(false);
  const [loc, setLoc] = useState({ ...profile });
  return (
    <div style={{ padding: "16px 16px 0" }}>
      {!ed ? (
        <>
          <div style={css.card}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <div style={css.h2}>Mon profil</div>
              <button style={css.btnG} onClick={() => setEd(true)}>Modifier</button>
            </div>
            {[
              ["Poids", profile.poids + " kg"],
              ["Taille", profile.taille + " cm"],
              ["Âge", profile.age + " ans"],
              ["Sexe", profile.sexe === "H" ? "Homme" : "Femme"],
              ["Objectif", profile.objectif === "perte" ? "Perte de poids" : profile.objectif === "gain" ? "Prise de masse" : "Maintien"],
            ].map(([l, v]) => (
              <div key={l} style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: `1px solid ${C.border}`, fontSize: 14 }}>
                <span style={{ color: C.muted }}>{l}</span>
                <span style={{ color: C.text, fontWeight: 600 }}>{v}</span>
              </div>
            ))}
          </div>
          <div style={css.card}>
            <div style={css.h2}>Mes besoins</div>
            {[["TDEE (dépense totale)", tdee + " kcal"], ["Objectif journalier", goal + " kcal"]].map(([l, v]) => (
              <div key={l} style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: `1px solid ${C.border}`, fontSize: 14 }}>
                <span style={{ color: C.muted }}>{l}</span>
                <span style={{ color: C.text, fontWeight: 600 }}>{v}</span>
              </div>
            ))}
            {profile.objectif === "perte" && (
              <div style={{ background: `${C.greenDk}33`, borderRadius: 12, padding: "12px 14px", marginTop: 14, fontSize: 13, color: "#86efac", lineHeight: 1.5 }}>
                Déficit de {tdee - goal} kcal/jour → perte estimée ~0,5 kg/semaine
              </div>
            )}
          </div>
        </>
      ) : (
        <div style={css.card}>
          <div style={css.h2}>Modifier le profil</div>
          <ProfileForm pf={loc} setPf={setLoc} onSave={() => { setProfile({ ...loc, poids: +loc.poids, taille: +loc.taille, age: +loc.age }); setEd(false); }} />
        </div>
      )}
    </div>
  );
}

// ── APP ───────────────────────────────────────────────────────────────────────
export default function App() {
  const [view,        setView]        = useState("dashboard");
  const [profile,     setProfile]     = useState(() => load(KEY_PROFILE, null));
  const [days,        setDays]        = useState(() => load(KEY_DAYS, {}));
  const [weight, setWeight] = useState(() => load(KEY_WEIGHT, []));
  const [customFoods, setCustomFoods] = useState(() => load(KEY_CUSTOM, []));
  const [selDate,     setSelDate]     = useState(today);
  const [meal,        setMeal]        = useState("Déjeuner");
  const [newW,        setNewW]        = useState("");
  const [pf,          setPf]          = useState({ poids: "", taille: "", age: "", sexe: "H", activite: "modere", objectif: "perte" });

  useEffect(() => { save(KEY_DAYS,    days);        }, [days]);
  useEffect(() => { save(KEY_WEIGHT,  weight);      }, [weight]);
  useEffect(() => { save(KEY_PROFILE, profile);     }, [profile]);
  useEffect(() => { save(KEY_CUSTOM,  customFoods); }, [customFoods]);

  const tdee     = profile ? calcTDEE(profile) : 2000;
  const goal     = profile ? deficitGoal(tdee, profile.objectif) : 2000;
  const dayData  = days[selDate] || { items: [] };
  const totalCal = dayData.items.reduce((s, i) => s + i.cal, 0);
  const pct      = totalCal / goal;
  const lastW    = weight.length ? weight[weight.length - 1].val : null;
  const firstW   = weight.length > 1 ? weight[0].val : null;
  const delta    = firstW && lastW ? (lastW - firstW).toFixed(1) : null;
  const streak   = profile ? calcStreak(days, goal) : 0;

  const addItems = useCallback((items, m) => {
    const ni = items.map(it => ({ meal: m, name: it.name, cal: it.calories, qty: it.quantite, id: Date.now() + Math.random() }));
    setDays(prev => { const d = prev[selDate] || { items: [] }; return { ...prev, [selDate]: { items: [...d.items, ...ni] } }; });
  }, [selDate]);

  const removeFood = useCallback((id) => {
    setDays(prev => { const d = prev[selDate] || { items: [] }; return { ...prev, [selDate]: { items: d.items.filter(i => i.id !== id) } }; });
  }, [selDate]);

  const addWeight = () => {
    if (!newW) return;
    setWeight(prev => [...prev, { date: today(), val: +newW, id: Date.now() }].sort((a, b) => a.date.localeCompare(b.date)));
    setNewW("");
  };

  const saveProfile = () => {
    if (!pf.poids || !pf.taille || !pf.age) return;
    setProfile({ ...pf, poids: +pf.poids, taille: +pf.taille, age: +pf.age });
    setView("dashboard");
  };

  if (!profile) {
    return (
      <div style={css.app}>
        <div style={{ padding: "24px 20px", maxWidth: 440, margin: "0 auto" }}>
          <div style={{ textAlign: "center", padding: "30px 0 24px" }}>
            <div style={{ fontSize: 56, marginBottom: 12 }}>🥦</div>
            <h1 style={{ margin: 0, fontSize: 28, fontWeight: 800, color: C.green, letterSpacing: -0.5 }}>CaloriTrack</h1>
            <p style={{ color: C.muted, fontSize: 14, marginTop: 8 }}>Ton compagnon santé halal</p>
          </div>
          <div style={css.card}>
            <ProfileForm pf={pf} setPf={setPf} onSave={saveProfile} />
          </div>
        </div>
      </div>
    );
  }

  const navItems = [
    { id: "dashboard", icon: "📊", label: "Tableau" },
    { id: "journal",   icon: "🍽️", label: "Journal" },
    { id: "poids",     icon: "⚖️", label: "Poids" },
    { id: "profil",    icon: "👤", label: "Profil" },
  ];

  return (
    <div style={css.app}>
      <div style={{ background: `linear-gradient(180deg,${C.bg} 0%,transparent 100%)`, padding: "16px 18px 12px", position: "sticky", top: 0, zIndex: 10, backdropFilter: "blur(12px)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 20, fontWeight: 800, color: C.green, letterSpacing: -0.3 }}>🥦 CaloriTrack</div>
            <div style={{ color: C.muted, fontSize: 12, marginTop: 2 }}>
              {goal} kcal/jour · {profile.objectif === "perte" ? "Perte de poids" : profile.objectif === "gain" ? "Prise de masse" : "Maintien"}
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            {lastW && <div style={{ fontSize: 18, fontWeight: 700, color: C.text }}>{lastW} <span style={{ fontSize: 12, color: C.muted }}>kg</span></div>}
            {streak >= 2 && <div style={{ fontSize: 11, color: C.gold }}>🔥 {streak} jours</div>}
          </div>
        </div>
      </div>

      {view === "dashboard" && (
        <Dashboard days={days} goal={goal} tdee={tdee} totalCal={totalCal} pct={pct}
          dayData={dayData} selDate={selDate} lastW={lastW} weight={weight} delta={delta} streak={streak} />
      )}
      {view === "journal" && (
        <Journal days={days} selDate={selDate} setSelDate={setSelDate}
          meal={meal} setMeal={setMeal} addItems={addItems} removeFood={removeFood}
          customFoods={customFoods} setCustomFoods={setCustomFoods} />
      )}
      {view === "poids" && (
        <Poids weight={weight} setWeight={setWeight} newW={newW} setNewW={setNewW} addWeight={addWeight} />
      )}
      {view === "profil" && (
        <ProfilView profile={profile} setProfile={setProfile} tdee={tdee} goal={goal} />
      )}

      <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 10, padding: "0 16px 28px" }}>
        <nav style={{
          background: `${C.bg}dd`,
          backdropFilter: "blur(24px)",
          WebkitBackdropFilter: "blur(24px)",
          border: `1px solid ${C.border}`,
          borderRadius: 28,
          display: "flex",
          justifyContent: "space-around",
          alignItems: "center",
          padding: "8px 6px",
          boxShadow: `0 8px 32px #00000088, 0 0 0 1px ${C.border}`,
        }}>
          {navItems.map(({ id, icon, label }) => {
            const active = view === id;
            return (
              <button key={id} onClick={() => setView(id)} style={{
                background: "none", border: "none", cursor: "pointer",
                display: "flex", flexDirection: "column", alignItems: "center",
                flex: 1, padding: "2px 0", position: "relative",
              }}>
                <div style={{
                  display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
                  padding: active ? "8px 20px" : "8px 12px",
                  borderRadius: 20,
                  background: active ? `linear-gradient(135deg, ${C.greenD}22, ${C.greenDk}44)` : "transparent",
                  border: `1px solid ${active ? C.greenD + "66" : "transparent"}`,
                  transition: "all .25s cubic-bezier(.4,0,.2,1)",
                  boxShadow: active ? `0 0 16px ${C.green}22` : "none",
                  minWidth: active ? 80 : 48,
                }}>
                  <span style={{ fontSize: 20, lineHeight: 1, filter: active ? `drop-shadow(0 0 6px ${C.green}88)` : "none", transition: "filter .25s" }}>{icon}</span>
                  <span style={{
                    fontSize: 10, fontWeight: active ? 700 : 500,
                    color: active ? C.green : C.muted,
                    letterSpacing: active ? 0.3 : 0,
                    transition: "all .25s",
                  }}>{label}</span>
                </div>
              </button>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
