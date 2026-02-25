// tips.js — Tips tab module (STATIC + SMART RULES + AI-STYLE)
// ✅ No HTML/CSS changes needed.
// ✅ Uses existing UI:
// - Button: #generateTipsBtn
// - List:   #tipsList

let _getExpenses = null;
let _money = null;
let _ymd = null;
let _parseDateSafe = null;

let _btn = null;
let _list = null;

function escHtml(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function buildCategoryTotals(list){
  const m = new Map();
  for (const e of list){
    const c = e.category || "Other";
    m.set(c, (m.get(c) || 0) + Number(e.amount || 0));
  }
  const arr = Array.from(m.entries()).map(([k,v]) => ({ category: k, total: v }));
  arr.sort((a,b)=> b.total - a.total);
  return arr;
}

function startOfMonth(d){
  return new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
}

function endOfMonth(d){
  return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
}

function inRange(dateStr, from, to){
  const d = _parseDateSafe(dateStr);
  if (from && d < from) return false;
  if (to && d > to) return false;
  return true;
}

function getThisMonthExpenses(all){
  const now = new Date();
  const from = startOfMonth(now);
  const to = endOfMonth(now);
  return all.filter(e => inRange(e.date, from, to));
}

function getLastMonthExpenses(all){
  const now = new Date();
  const last = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const from = startOfMonth(last);
  const to = endOfMonth(last);
  return all.filter(e => inRange(e.date, from, to));
}

function lastNDaysTotals(list, n=7){
  const now = new Date();
  const days = [];
  for (let i=n-1; i>=0; i--){
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const key = _ymd(d);
    days.push({ date: key, total: 0 });
  }
  const idx = new Map(days.map((x,i)=> [x.date, i]));
  for (const e of list){
    const i = idx.get(e.date);
    if (i != null) days[i].total += Number(e.amount || 0);
  }
  return days;
}

/* ---------------------------
   Static quotes
--------------------------- */
const STATIC_QUOTES = [
  "A budget is telling your money where to go instead of wondering where it went.",
  "Small amounts saved daily become big amounts over time.",
  "Track first. Improve next.",
  "Spend intentionally, not emotionally.",
  "Consistency beats intensity in saving.",
  "If you can’t buy it twice, think twice.",
];

/* ---------------------------
   Smart rule-based tips
--------------------------- */
function buildSmartTips(all){
  const tips = [];

  if (!all.length) {
    tips.push(`Start by adding 5–10 expenses. Then I can generate smart tips based on your real spending.`);
    return tips;
  }

  const thisMonth = getThisMonthExpenses(all);
  const lastMonth = getLastMonthExpenses(all);

  const totalAll = all.reduce((s,x)=> s + Number(x.amount||0), 0);
  const totalThis = thisMonth.reduce((s,x)=> s + Number(x.amount||0), 0);
  const totalLast = lastMonth.reduce((s,x)=> s + Number(x.amount||0), 0);

  // 1) Month comparison
  if (totalLast > 0) {
    const diff = totalThis - totalLast;
    const pct = (diff / totalLast) * 100;
    if (diff > 0) tips.push(`This month you spent <strong>${_money(Math.abs(diff))}</strong> more than last month (${pct.toFixed(1)}%). Try setting a mini budget for your top category.`);
    if (diff < 0) tips.push(`Great! This month you spent <strong>${_money(Math.abs(diff))}</strong> less than last month (${Math.abs(pct).toFixed(1)}%). Keep the same pattern.`);
    if (diff === 0) tips.push(`Your spending is equal to last month. If you want to improve, reduce your top category by 5–10%.`);
  } else {
    tips.push(`This is your first tracked month (no last-month data). Keep logging expenses daily to unlock better comparisons.`);
  }

  // 2) Top category dominance
  const catTotals = buildCategoryTotals(thisMonth.length ? thisMonth : all);
  const top = catTotals[0];
  const baseTotal = (thisMonth.length ? totalThis : totalAll) || 1;

  if (top) {
    const share = top.total / baseTotal;
    tips.push(`Your top spending category is <strong>${escHtml(top.category)}</strong> (${_money(top.total)}).`);

    if (share >= 0.40) {
      tips.push(`<strong>Warning:</strong> ${escHtml(top.category)} is <strong>${(share*100).toFixed(0)}%</strong> of your spend. Try reducing it by 10% this week.`);
    } else if (share >= 0.25) {
      tips.push(`${escHtml(top.category)} is a major part of your spending (${(share*100).toFixed(0)}%). Track it daily to stay in control.`);
    } else {
      tips.push(`Your spending is well distributed across categories. Keep it balanced.`);
    }
  }

  // 3) 7-day average
  const last7 = lastNDaysTotals(all, 7);
  const total7 = last7.reduce((s,x)=> s + x.total, 0);
  const avg7 = total7 / 7;
  tips.push(`Your last 7 days total is <strong>${_money(total7)}</strong>. Daily average: <strong>${_money(avg7)}</strong>. Try to keep most days near this average.`);

  // 4) Highest day vs lowest day (overall)
  const byDay = new Map();
  for (const e of all){
    byDay.set(e.date, (byDay.get(e.date) || 0) + Number(e.amount||0));
  }
  let hi = null, lo = null;
  for (const [date,total] of byDay.entries()){
    if (!hi || total > hi.total) hi = { date, total };
    if (!lo || total < lo.total) lo = { date, total };
  }
  if (hi) tips.push(`Your highest spend day: <strong>${escHtml(hi.date)}</strong> • <strong>${_money(hi.total)}</strong>. Look at what caused it and plan alternatives.`);
  if (lo) tips.push(`Your lowest spend day: <strong>${escHtml(lo.date)}</strong> • <strong>${_money(lo.total)}</strong>. Try repeating what worked on that day.`);

  // 5) Simple saving suggestion
  tips.push(`Quick savings idea: Choose one category (like Food/Shopping) and reduce it by <strong>${_money(500)}</strong> this week. Small wins build habits.`);

  return tips;
}

/* ---------------------------
   AI-style tips (local generator)
   - Not real AI API
   - Feels like AI suggestions
--------------------------- */
function aiStyleTips(all){
  const tips = [];

  if (!all.length) {
    tips.push(`AI Tip: Add a few expenses first — then I’ll generate personalized insights.`);
    return tips;
  }

  const thisMonth = getThisMonthExpenses(all);
  const base = thisMonth.length ? thisMonth : all;
  const total = base.reduce((s,x)=> s + Number(x.amount||0), 0) || 1;

  const cats = buildCategoryTotals(base);
  const top = cats[0];
  const second = cats[1];

  // pick a “tone”
  const styles = [
    (top, second) => `AI Insight: If you cut <strong>${escHtml(top?.category || "your top category")}</strong> by 10%, you could save about <strong>${_money((top?.total||0)*0.10)}</strong> this month.`,
    (top, second) => `AI Coach: Try a “no-spend day” once a week. It can reduce your monthly total by ~<strong>${_money(total * 0.06)}</strong> (estimate).`,
    (top, second) => `AI Suggestion: Your spend pattern suggests focusing on <strong>${escHtml(top?.category || "one category")}</strong>. Set a weekly cap and review every Sunday.`,
    (top, second) => second
      ? `AI Plan: Keep <strong>${escHtml(top.category)}</strong> stable and reduce <strong>${escHtml(second.category)}</strong> slightly for faster improvement.`
      : `AI Plan: Keep tracking daily. More data = better tips.`,
  ];

  // add 2-3 generated lines
  for (let i=0; i<3; i++){
    const fn = styles[Math.floor(Math.random() * styles.length)];
    tips.push(fn(top, second));
  }

  return tips;
}

/* ---------------------------
   Optional REAL AI endpoint (future)
   If you later add a Cloud Function / API:
   window.TIPS_AI_ENDPOINT = "https://...."
--------------------------- */
async function realAiTipsOrNull(all){
  const endpoint = window.TIPS_AI_ENDPOINT;
  if (!endpoint) return null;

  try {
    const payload = {
      expenses: all.slice(0, 300), // keep it small
    };

    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (!res.ok) throw new Error("AI endpoint failed");
    const data = await res.json();

    // expected: { tips: ["...", "..."] }
    if (Array.isArray(data?.tips) && data.tips.length) return data.tips;
    return null;
  } catch (e) {
    console.warn("AI endpoint error, using local AI-style tips instead.", e);
    return null;
  }
}

/* ---------------------------
   Render
--------------------------- */
function renderList(items){
  if (!_list) return;
  _list.innerHTML = items.map(t => `<li>${t}</li>`).join("");
}

function renderPreview(){
  if (!_list) return;
  _list.innerHTML = `<li class="tip-placeholder">Click "Generate Tips" to get personalized advice</li>`;
}

async function onGenerate(){
  const all = _getExpenses ? _getExpenses() : [];

  // 1) static quote
  const quote = STATIC_QUOTES[Math.floor(Math.random() * STATIC_QUOTES.length)];
  const staticBlock = [`<strong>Quote:</strong> ${escHtml(quote)}`];

  // 2) smart tips
  const smart = buildSmartTips(all);

  // 3) real AI (optional) OR local AI-style tips
  const real = await realAiTipsOrNull(all);
  const ai = real ? real.map(x => `AI: ${escHtml(x)}`) : aiStyleTips(all);

  // combine (keep readable)
  const finalList = []
    .concat(staticBlock)
    .concat(smart.map(x => x))
    .concat(ai.map(x => x));

  renderList(finalList);
}

/* ---------------------------
   Public API
--------------------------- */
export function initTipsUI({ getExpenses, money, ymd, parseDateSafe }){
  _getExpenses = getExpenses;
  _money = money;
  _ymd = ymd;
  _parseDateSafe = parseDateSafe;

  _btn = document.getElementById("generateTipsBtn");
  _list = document.getElementById("tipsList");

  if (!_btn || !_list) return;

  // prevent double binding
  if (_btn.dataset.bound === "1") return;
  _btn.dataset.bound = "1";

  _btn.addEventListener("click", onGenerate);
  renderPreview();
}

export function renderTips(){
  // optional: if you want auto refresh when entering tips tab in future
  // for now keep preview unless user clicks generate
  renderPreview();
}