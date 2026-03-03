// chat.js — Floating Chatbot (Global, works on ALL tabs)
// Uses existing HTML IDs:
// #etChatFab, #etChatPanel, #etChatClose, #etChatMsgs, #etChatInput, #etChatSend

let _getExpenses = null;
let _money = null;
let _parseDateSafe = null;

function ymd(d) { return d.toISOString().slice(0, 10); }

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

function lastNDaysTotals(expenses, n = 7) {
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  const days = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    days.push({ date: ymd(d), total: 0 });
  }

  const idx = new Map(days.map((x, i) => [x.date, i]));
  for (const e of expenses) {
    const i = idx.get(e.date);
    if (i != null) days[i].total += Number(e.amount || 0);
  }
  return days;
}

function startOfMonth(d) {
  return new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
}
function endOfMonth(d) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
}

function inRange(dateStr, from, to) {
  const d = _parseDateSafe(dateStr);
  if (from && d < from) return false;
  if (to && d > to) return false;
  return true;
}

function answerFromData(qRaw, expenses) {
  const q = String(qRaw || "").trim().toLowerCase();
  if (!q) return "Type a question 🙂 Example: total spend, top category, last 7 days, this month.";

  const totalAll = expenses.reduce((s, x) => s + Number(x.amount || 0), 0);

  // help
  if (q.includes("help") || q.includes("what can you do") || q === "hi" || q === "hello") {
    return [
      "I can answer based on your expenses ✅",
      "Try:",
      "• total spend",
      "• top category",
      "• today spend",
      "• this week",
      "• this month",
      "• last 7 days",
      "• last 7 days average",
    ].join("\n");
  }

  // top category
  if (q.includes("top category") || q.includes("highest category") || q.includes("most spend category")) {
    const cats = buildCategoryTotals(expenses);
    const top = cats[0];
    if (!top) return "No expenses yet. Add some expenses first.";
    const pct = totalAll > 0 ? Math.round((top.total / totalAll) * 100) : 0;
    return `Top category is **${top.category}**: ${_money(top.total)} (${pct}%).`;
  }

  // total spend
  if (q.includes("total") && (q.includes("spend") || q.includes("spent") || q.includes("expense"))) {
    return `Your total spend is ${_money(totalAll)}.`;
  }

  // today
  if (q.includes("today")) {
    const t = ymd(new Date());
    const sum = expenses
      .filter(e => (e.date || "") === t)
      .reduce((s, x) => s + Number(x.amount || 0), 0);
    return `Today (${t}) you spent ${_money(sum)}.`;
  }

  // this month
  if (q.includes("this month") || q.includes("current month")) {
    const now = new Date();
    const from = startOfMonth(now);
    const to = endOfMonth(now);
    const monthSum = expenses
      .filter(e => inRange(e.date, from, to))
      .reduce((s, x) => s + Number(x.amount || 0), 0);
    return `This month you spent ${_money(monthSum)}.`;
  }

  // this week (simple: last 7 days)
  if (q.includes("this week") || q.includes("week")) {
    const last7 = lastNDaysTotals(expenses, 7);
    const sum7 = last7.reduce((s, x) => s + x.total, 0);
    return `Last 7 days total: ${_money(sum7)}.`;
  }

  // last 7 days average
  if (q.includes("average") && (q.includes("7") || q.includes("seven"))) {
    const last7 = lastNDaysTotals(expenses, 7);
    const sum7 = last7.reduce((s, x) => s + x.total, 0);
    const avg = sum7 / 7;
    return `Last 7 days average: ${_money(avg)} per day.`;
  }

  // last 7 days
  if (q.includes("last 7") || q.includes("last seven") || q.includes("7 days")) {
    const last7 = lastNDaysTotals(expenses, 7);
    const sum7 = last7.reduce((s, x) => s + x.total, 0);
    const lines = last7.map(d => `${d.date}: ${_money(d.total)}`).join("\n");
    return `Last 7 days total: ${_money(sum7)}\n\n${lines}`;
  }

  return "I didn’t understand. Try: **total spend**, **top category**, **today**, **this month**, **last 7 days**.";
}

function addMsg(msgsEl, who, text) {
  const row = document.createElement("div");
  row.className = `et-msg ${who}`;
  row.textContent = text;
  msgsEl.appendChild(row);
  msgsEl.scrollTop = msgsEl.scrollHeight;
}

function openPanel(panel) {
  panel.classList.add("open");
  panel.setAttribute("aria-hidden", "false");
}
function closePanel(panel) {
  panel.classList.remove("open");
  panel.setAttribute("aria-hidden", "true");
}

export function initFloatingChat({ getExpenses, money, parseDateSafe }) {
  _getExpenses = getExpenses;
  _money = money;
  _parseDateSafe = parseDateSafe;

  const fab = document.getElementById("etChatFab");
  const panel = document.getElementById("etChatPanel");
  const closeBtn = document.getElementById("etChatClose");
  const msgs = document.getElementById("etChatMsgs");
  const input = document.getElementById("etChatInput");
  const send = document.getElementById("etChatSend");

  if (!fab || !panel || !closeBtn || !msgs || !input || !send) return;

  // welcome once
  if (!msgs.dataset.inited) {
    msgs.dataset.inited = "1";
    addMsg(msgs, "bot", "Hi! I’m your Expense Assistant.\nType: total spend, top category, last 7 days 🙂");
  }

  function doSend() {
    const text = input.value.trim();
    if (!text) return;
    input.value = "";
    addMsg(msgs, "me", text);

    const expenses = _getExpenses ? _getExpenses() : [];
    const reply = answerFromData(text, expenses);
    addMsg(msgs, "bot", reply);
  }

  fab.addEventListener("click", () => {
    openPanel(panel);
    setTimeout(() => input.focus(), 50);
  });

  closeBtn.addEventListener("click", () => closePanel(panel));

  send.addEventListener("click", doSend);
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") doSend();
    if (e.key === "Escape") closePanel(panel);
  });
}