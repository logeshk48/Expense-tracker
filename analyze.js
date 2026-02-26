// analyze.js
// Analyze tab module (AI-style predictions, still rule-based)
// ✅ No HTML/CSS changes needed.
// Uses existing UI:
// - #insightsBox
// - #topCategoryBox

let _getExpenses = null;
let _money = null;
let _parseDateSafe = null;

function buildCategoryTotals(list) {
  const m = new Map();
  for (const e of list) {
    const c = e.category || "Other";
    m.set(c, (m.get(c) || 0) + Number(e.amount || 0));
  }
  const arr = Array.from(m.entries()).map(([k, v]) => ({ category: k, total: v }));
  arr.sort((a, b) => b.total - a.total);
  return arr;
}

function ymd(d) {
  return d.toISOString().slice(0, 10);
}

function startOfMonth(d) {
  return new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
}

function endOfMonth(d) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
}

function getRangeTotals(expenses, fromDate, toDate) {
  const from = fromDate ? new Date(fromDate) : null;
  const to = toDate ? new Date(toDate) : null;
  if (from) from.setHours(0, 0, 0, 0);
  if (to) to.setHours(23, 59, 59, 999);

  let total = 0;
  let count = 0;
  const activeDays = new Set();

  for (const e of expenses) {
    const d = _parseDateSafe(e.date);
    if (from && d < from) continue;
    if (to && d > to) continue;
    total += Number(e.amount || 0);
    count += 1;
    if (e.date) activeDays.add(e.date);
  }

  return { total, count, activeDays: activeDays.size || 0 };
}

function lastNDaysTotals(expenses, n = 7) {
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  const days = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    days.push({ date: ymd(d), total: 0, dayIndex: d.getDay() }); // 0 Sun..6 Sat
  }

  const idx = new Map(days.map((x, i) => [x.date, i]));
  for (const e of expenses) {
    const i = idx.get(e.date);
    if (i != null) days[i].total += Number(e.amount || 0);
  }
  return days;
}

function classifyTrend(prev, curr) {
  // avoid divide-by-zero explosions
  if (prev <= 0 && curr > 0) return { label: "Up", note: "New spending spike detected." };
  if (prev <= 0 && curr <= 0) return { label: "Stable", note: "No spending in both periods." };

  const diff = curr - prev;
  const pct = (diff / prev) * 100;

  if (pct > 12) return { label: "Up", note: `Spending is up by ~${pct.toFixed(0)}%.` };
  if (pct < -12) return { label: "Down", note: `Good! Spending is down by ~${Math.abs(pct).toFixed(0)}%.` };
  return { label: "Stable", note: "Spending pace looks steady." };
}

function weekdayName(i) {
  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][i] || "—";
}

export function initAnalyzeUI({ getExpenses, money, parseDateSafe }) {
  _getExpenses = getExpenses;
  _money = money;
  _parseDateSafe = parseDateSafe;
}
function clamp(n, a, b) { 
  return Math.max(a, Math.min(b, n)); 
}

export function renderAnalyze() {
  const expenses = _getExpenses ? _getExpenses() : [];

  const insightsBox = document.getElementById("insightsBox");
  const topCategoryBox = document.getElementById("topCategoryBox");

  if (!insightsBox || !topCategoryBox) return;

  const totalAll = expenses.reduce((s, x) => s + Number(x.amount || 0), 0);
  const countAll = expenses.length;

  // Top category
  const catTotalsAll = buildCategoryTotals(expenses);
  const top = catTotalsAll[0];

  // Highest spend day (overall)
  const byDay = new Map();
  for (const e of expenses) {
    byDay.set(e.date, (byDay.get(e.date) || 0) + Number(e.amount || 0));
  }
  let bestDay = null;
  for (const [date, val] of byDay.entries()) {
    if (!bestDay || val > bestDay.val) bestDay = { date, val };
  }

  // Avg per active day
  const uniqueDays = new Set(expenses.map(e => e.date)).size || 1;
  const avgPerActiveDay = totalAll / uniqueDays;

  // ---------------------------
  // AI-style Predictions (rule-based)
  // ---------------------------
  // Trend: last 7 vs previous 7
  const last7 = lastNDaysTotals(expenses, 7);
  const prev7 = lastNDaysTotals(expenses, 14).slice(0, 7); // first 7 of last 14 = previous week
  const sumLast7 = last7.reduce((s, x) => s + x.total, 0);
  const sumPrev7 = prev7.reduce((s, x) => s + x.total, 0);
  const trend = classifyTrend(sumPrev7, sumLast7);

  // Forecast next 7 days (simple avg-based)
  const avgLast7 = sumLast7 / 7;
  const forecast7 = avgLast7 * 7;

  // Overspend weekday pattern (using last 30 days)
  const now = new Date();
  const from30 = new Date(now);
  from30.setDate(from30.getDate() - 29);
  const last30 = getRangeTotals(expenses, from30, now);

  // compute weekday totals for last 30 days
  const weekdayTotals = new Array(7).fill(0);
  for (const e of expenses) {
    const d = _parseDateSafe(e.date);
    if (d < from30 || d > now) continue;
    weekdayTotals[d.getDay()] += Number(e.amount || 0);
  }
  let peakWeekday = 0;
  for (let i = 1; i < 7; i++) if (weekdayTotals[i] > weekdayTotals[peakWeekday]) peakWeekday = i;

  // Budget risk (optional, if saved)
  const savedBudget = Number(localStorage.getItem("et_monthly_budget") || 0);
  const startM = startOfMonth(now);
  const endM = endOfMonth(now);

  const thisMonth = getRangeTotals(expenses, startM, endM);
  const daysInMonth = Math.round((endM - startM) / (1000 * 60 * 60 * 24)) + 1;
  const dayOfMonth = now.getDate();
  const daysLeft = Math.max(0, daysInMonth - dayOfMonth);

  let budgetRiskLabel = "—";
  let budgetRiskNote = "No budget set.";
  if (savedBudget > 0) {
    const remaining = savedBudget - thisMonth.total;
    const allowedPerDay = daysLeft > 0 ? (remaining / daysLeft) : remaining;
    const pace = thisMonth.total / Math.max(1, dayOfMonth); // avg per day so far
    const targetPace = savedBudget / daysInMonth;

    if (thisMonth.total > savedBudget) {
      budgetRiskLabel = "High Risk";
      budgetRiskNote = `Over budget by ${_money(Math.abs(remaining))}.`;
    } else if (pace > targetPace * 1.12) {
      budgetRiskLabel = "Warning";
      budgetRiskNote = `Spending pace is high. Need ~${_money(Math.max(0, allowedPerDay))}/day to stay within budget.`;
    } else {
      budgetRiskLabel = "Safe";
      budgetRiskNote = `On track. You can spend ~${_money(Math.max(0, allowedPerDay))}/day for the rest of the month.`;
    }
  }

  // Top category dominance warning
  let topCategoryNote = "—";
  if (top && totalAll > 0) {
    const share = top.total / totalAll;
    if (share >= 0.40) topCategoryNote = `Warning: ${top.category} is ${(share * 100).toFixed(0)}% of your total spending.`;
    else if (share >= 0.25) topCategoryNote = `${top.category} is a major share (${(share * 100).toFixed(0)}%).`;
    else topCategoryNote = "Spending looks balanced across categories.";
  }

  // ---------------------------
  // Render cards
  // ---------------------------
  const items = [
    { k: "Total Spend", v: _money(totalAll) },
    { k: "Total Records", v: String(countAll) },
    { k: "Avg / Active Day", v: _money(avgPerActiveDay) },
    { k: "Most Expensive Day", v: bestDay ? `${bestDay.date} • ${_money(bestDay.val)}` : "—" },

    // AI-style cards
    { k: "Trend (7d vs 7d)", v: `${trend.label} • ${trend.note}` },
    { k: "Next 7d Forecast", v: `${_money(forecast7)} (based on avg ${_money(avgLast7)}/day)` },
    { k: "Budget Risk", v: `${budgetRiskLabel} • ${budgetRiskNote}` },
    { k: "Overspend Pattern", v: `Most spend on ${weekdayName(peakWeekday)} (last 30 days)` },
  ];

  insightsBox.innerHTML = items.map(x => `
    <div class="insight">
      <div class="k">${x.k}</div>
      <div class="v">${x.v}</div>
    </div>
  `).join("");

  // Top category highlight (existing card)
  const topText = top ? `${top.category} • ${_money(top.total)}` : "—";
  const content = topCategoryBox.querySelector(".highlight-content");
  if (content) content.textContent = topText;
  // ✅ Feature #1: Top Category % + Progress Bar
const share = (top && totalAll > 0) ? (top.total / totalAll) : 0;
const pct = Math.round(share * 100);
const barWidth = clamp(pct, 0, 100);

let extra = topCategoryBox.querySelector(".topcat-extra");
if (!extra) {
  extra = document.createElement("div");
  extra.className = "topcat-extra";
  extra.style.marginTop = "10px";
  topCategoryBox.appendChild(extra);
}

extra.innerHTML = `
  <div style="font-size:12px; opacity:.9; display:flex; justify-content:space-between;">
    <span>Top category share</span>
    <b>${top ? pct + "%" : "—"}</b>
  </div>

  <div style="height:8px; margin-top:8px; border-radius:999px; background:rgba(255,255,255,.12); overflow:hidden;">
    <div style="height:100%; width:${top ? barWidth : 0}%; border-radius:999px; background:rgba(130, 220, 255, .75);"></div>
  </div>
`;

  // Add small “AI note” under Top Category card WITHOUT HTML change:
  // We’ll reuse the card by adding title as tooltip.
  if (topCategoryBox) topCategoryBox.title = topCategoryNote;
}