import { ensureAnonAuth } from "./firebase-config.js";
import { loadExpensesFromCloud, saveExpenseToCloud, deleteExpenseFromCloud } from "./firebase-db.js";

function money(n) {
  return `₹${Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}
function ymd(d) { return d.toISOString().slice(0, 10); }
function parseDateSafe(s){ return new Date((s || "") + "T00:00:00"); }

function startOfWeek(date){
  const d = new Date(date);
  const day = d.getDay();
  const diff = (day === 0 ? -6 : 1 - day);
  d.setDate(d.getDate() + diff);
  d.setHours(0,0,0,0);
  return d;
}

document.addEventListener("DOMContentLoaded", async () => {
  if (!location.pathname.toLowerCase().includes("dashboard.html")) return;

  // Must be logged in (local)
  const authLocal = JSON.parse(localStorage.getItem("et_auth_v1") || "null");
  if (!authLocal) { location.href = "index.html"; return; }

  // Firebase anonymous user (uid)
  const user = await ensureAnonAuth();
  const uid = user.uid;

  // Elements
  const expenseForm = document.getElementById("expenseForm");
  const amountEl = document.getElementById("amount");
  const categoryEl = document.getElementById("category");
  const dateEl = document.getElementById("date");
  const noteEl = document.getElementById("note");
  const expenseList = document.getElementById("expenseList");

  const todayTotalEl = document.getElementById("todayTotal");
  const weekTotalEl  = document.getElementById("weekTotal");
  const monthTotalEl = document.getElementById("monthTotal");
  const yearTotalEl  = document.getElementById("yearTotal");
  const countPill    = document.getElementById("countPill");

  const exportBtn = document.getElementById("exportBtn");
  const clearAllBtn = document.getElementById("clearAllBtn");

  if (dateEl) dateEl.value = ymd(new Date());

  // Load from cloud
  let expenses = await loadExpensesFromCloud(uid);

  function totals(){
    const now = new Date();
    const todayStr = ymd(now);
    const weekStart = startOfWeek(now);
    const month = now.getMonth(), year = now.getFullYear();

    let t=0,w=0,m=0,y=0;
    for (const e of expenses){
      const amt = Number(e.amount || 0);
      const d = parseDateSafe(e.date);

      if (e.date === todayStr) t += amt;
      if (d >= weekStart) w += amt;
      if (d.getFullYear() === year && d.getMonth() === month) m += amt;
      if (d.getFullYear() === year) y += amt;
    }

    if (todayTotalEl) todayTotalEl.textContent = money(t);
    if (weekTotalEl) weekTotalEl.textContent  = money(w);
    if (monthTotalEl) monthTotalEl.textContent = money(m);
    if (yearTotalEl) yearTotalEl.textContent  = money(y);
    if (countPill) countPill.textContent = `${expenses.length} items`;
  }

  function renderList(){
    expenseList.innerHTML = "";
    const rows = [...expenses].sort((a,b)=> (b.date||"").localeCompare(a.date||""));

    for (const e of rows){
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${e.date || ""}</td>
        <td>${e.category || ""}</td>
        <td>${money(e.amount || 0)}</td>
        <td>${(e.note || "").replaceAll("<","&lt;").replaceAll(">","&gt;")}</td>
        <td>
          <div class="row-actions">
            <button class="icon-btn" data-del="${e.id}">Delete</button>
          </div>
        </td>
      `;
      expenseList.appendChild(tr);
    }
  }

  function renderAll(){
    totals();
    renderList();
  }

  // Add expense -> save to Firestore
  expenseForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const amount = Number(amountEl.value);
    const category = categoryEl.value;
    const date = dateEl.value;
    const note = (noteEl.value || "").trim();

    if (!amount || amount <= 0) return alert("Enter a valid amount.");
    if (!category) return alert("Select a category.");
    if (!date) return alert("Select a date.");

    const id = (crypto?.randomUUID ? crypto.randomUUID() : String(Date.now()));

    const item = { id, uid, amount, category, date, note, createdAt: Date.now() };

    await saveExpenseToCloud(item);
    expenses.push(item);

    expenseForm.reset();
    dateEl.value = ymd(new Date());
    renderAll();
  });

  // Delete -> Firestore
  expenseList.addEventListener("click", async (e) => {
    const btn = e.target.closest("[data-del]");
    if (!btn) return;

    const id = btn.getAttribute("data-del");
    await deleteExpenseFromCloud(id);

    expenses = expenses.filter(x => x.id !== id);
    renderAll();
  });

  // Export CSV
  if (exportBtn){
    exportBtn.addEventListener("click", () => {
      const header = ["date","category","amount","note"];
      const esc = (v) => `"${String(v ?? "").replaceAll('"','""')}"`;
      const lines = [header.join(",")].concat(
        expenses.map(e => [e.date, e.category, e.amount, e.note].map(esc).join(","))
      );
      const blob = new Blob([lines.join("\n")], {type:"text/csv;charset=utf-8;"});
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "expenses.csv";
      a.click();
      URL.revokeObjectURL(url);
    });
  }

  // Clear all (cloud) — simple version: clear local list only
  if (clearAllBtn){
    clearAllBtn.addEventListener("click", async () => {
      if (!confirm("Clear all expenses?")) return;

      // delete all docs one by one
      for (const e of expenses){
        await deleteExpenseFromCloud(e.id);
      }
      expenses = [];
      renderAll();
    });
  }

  renderAll();
});