import { ensureAnonAuth } from "./firebase-config.js";
import {
  loadExpensesFromCloud,
  saveExpenseToCloud,
  deleteExpenseFromCloud
} from "./firebase-db.js";

function money(n) {
  return `₹${Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}
function ymd(d) { return d.toISOString().slice(0, 10); }
function parseDateSafe(s){
  if (!s) return new Date(0);
  const [y,m,d] = s.split("-").map(Number);
  return new Date(y, (m||1)-1, d||1); // local midnight, no timezone shift
}

function startOfWeek(date){
  const d = new Date(date);
  const day = d.getDay();           // 0=Sun
  const diff = (day === 0 ? -6 : 1 - day); // Monday start
  d.setDate(d.getDate() + diff);
  d.setHours(0,0,0,0);
  return d;
}

document.addEventListener("DOMContentLoaded", async () => {
  if (!location.pathname.toLowerCase().includes("dashboard.html")) return;

  // Must be logged in (local login)
  const authLocal = JSON.parse(localStorage.getItem("et_auth_v1") || "null");
  if (!authLocal) { location.href = "index.html"; return; }

  // Firebase anonymous user
  const user = await ensureAnonAuth();
  const uid = user.uid;

  // Elements (Quick Overview)
  const todayTotalEl = document.getElementById("todayTotal");
  const weekTotalEl  = document.getElementById("weekTotal");
  const monthTotalEl = document.getElementById("monthTotal");
  const yearTotalEl  = document.getElementById("yearTotal");
  const countPill    = document.getElementById("countPill");

  // Form
  const expenseForm = document.getElementById("expenseForm");
  const amountEl = document.getElementById("amount");
  const categoryEl = document.getElementById("category");
  const dateEl = document.getElementById("date");
  const noteEl = document.getElementById("note");

  // Table
  const expenseList = document.getElementById("expenseList");

  // Buttons
  const exportBtn = document.getElementById("exportBtn");
  const clearAllBtn = document.getElementById("clearAllBtn");

  // Default date
  if (dateEl && !dateEl.value) dateEl.value = ymd(new Date());

  // Load expenses from Firestore
  let expenses = await loadExpensesFromCloud(uid);

  function computeTotals(){
    const now = new Date();
    const todayStr = ymd(now);
    const weekStart = startOfWeek(now);
    const m = now.getMonth();
    const y = now.getFullYear();

    let today = 0, week = 0, month = 0, year = 0;

    for (const e of expenses){
      const amt = Number(e.amount || 0);
      const d = parseDateSafe(e.date);

      if ((e.date || "") === todayStr) today += amt;
      if (d >= weekStart) week += amt;
      if (d.getFullYear() === y && d.getMonth() === m) month += amt;
      if (d.getFullYear() === y) year += amt;
    }

    if (todayTotalEl) todayTotalEl.textContent = money(today);
    if (weekTotalEl)  weekTotalEl.textContent  = money(week);
    if (monthTotalEl) monthTotalEl.textContent = money(month);
    if (yearTotalEl)  yearTotalEl.textContent  = money(year);
    if (countPill)    countPill.textContent    = `${expenses.length} items`;
  }

  function renderList(){
    if (!expenseList) return;
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
    computeTotals();
    renderList();
  }

  // Add expense
  if (expenseForm){
    expenseForm.addEventListener("submit", async (ev) => {
      ev.preventDefault();

      const amount = Number(amountEl?.value || 0);
      const category = categoryEl?.value || "";
      const date = dateEl?.value || "";
      const note = (noteEl?.value || "").trim();

      if (!amount || amount <= 0) return alert("Enter a valid amount.");
      if (!category) return alert("Select a category.");
      if (!date) return alert("Select a date.");

      const id = (crypto?.randomUUID ? crypto.randomUUID() : String(Date.now()));
      const item = { id, uid, amount, category, date, note, createdAt: Date.now() };

      try {
        await saveExpenseToCloud(item);
      } catch (err) {
        console.error("Firestore save failed:", err);
        alert("Not saved to cloud. Check Firestore Rules (Permissions).");
        return;
      }

      expenses.push(item);
      renderAll();

      expenseForm.reset();
      if (dateEl) dateEl.value = ymd(new Date());
    });
  }

  // Delete expense
  if (expenseList){
    expenseList.addEventListener("click", async (ev) => {
      const btn = ev.target.closest("[data-del]");
      if (!btn) return;

      const id = btn.getAttribute("data-del");
      try {
        await deleteExpenseFromCloud(id);
      } catch (err) {
        console.error("Firestore delete failed:", err);
        alert("Delete failed. Check Firestore Rules.");
        return;
      }

      expenses = expenses.filter(x => x.id !== id);
      renderAll();
    });
  }

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

  // Clear All (cloud)
  if (clearAllBtn){
    clearAllBtn.addEventListener("click", async () => {
      if (!confirm("Clear all expenses?")) return;

      // delete sequentially (simple + safe)
      for (const e of expenses){
        await deleteExpenseFromCloud(e.id);
      }
      expenses = [];
      renderAll();
    });
  }

  // Initial render
  renderAll();
});