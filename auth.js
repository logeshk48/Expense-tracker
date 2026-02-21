// auth.js (module)
import { auth } from "./firebase-config.js?v=31";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.9.0/firebase-auth.js";

const PROFILE_KEY = "et_profile_v1";

function setProfile(obj){ localStorage.setItem(PROFILE_KEY, JSON.stringify(obj)); }
function getProfile(){ try { return JSON.parse(localStorage.getItem(PROFILE_KEY) || "null"); } catch { return null; } }
function clearProfile(){ localStorage.removeItem(PROFILE_KEY); }

function isDashboard(){ return location.pathname.toLowerCase().includes("dashboard.html"); }

// Protect dashboard
onAuthStateChanged(auth, (user) => {
  if (isDashboard() && !user) location.href = "index.html";
});

// Login page logic
(function () {
  const loginBtn = document.getElementById("loginBtn");
  if (!loginBtn) return;

  const signupBtn = document.getElementById("signupBtn");
  const googleBtn = document.getElementById("googleBtn");

  const fullName = document.getElementById("fullName");
  const email = document.getElementById("email");
  const password = document.getElementById("password");
  const err = document.getElementById("loginError");

  function readInputs(){
    const name = (fullName?.value || "").trim();
    const em = (email?.value || "").trim();
    const pw = (password?.value || "").trim();
    if (name.length < 2) return { error: "Enter your name (min 2 letters)." };
    if (!em) return { error: "Enter your email." };
    if (pw.length < 6) return { error: "Password must be at least 6 characters." };
    return { name, em, pw };
  }

  loginBtn.addEventListener("click", async () => {
    err.textContent = "";
    const v = readInputs();
    if (v.error) return (err.textContent = v.error);

    try {
      await signInWithEmailAndPassword(auth, v.em, v.pw);
      setProfile({ name: v.name, email: v.em, ts: Date.now() });
      location.href = "dashboard.html";
    } catch (e) {
      console.error(e);
      err.textContent = "Login failed. Create account first, or check password.";
    }
  });

  signupBtn.addEventListener("click", async () => {
    err.textContent = "";
    const v = readInputs();
    if (v.error) return (err.textContent = v.error);

    try {
      await createUserWithEmailAndPassword(auth, v.em, v.pw);
      setProfile({ name: v.name, email: v.em, ts: Date.now() });
      location.href = "dashboard.html";
    } catch (e) {
      console.error(e);
      err.textContent = "Signup failed. Email may already exist.";
    }
  });

  googleBtn.addEventListener("click", async () => {
    err.textContent = "";
    try {
      const provider = new GoogleAuthProvider();
      const res = await signInWithPopup(auth, provider);
      const userEmail = res.user?.email || "";
      const name = (fullName?.value || res.user?.displayName || "User").trim();
      setProfile({ name, email: userEmail, ts: Date.now() });
      location.href = "dashboard.html";
    } catch (e) {
      console.error(e);
      err.textContent = "Google sign-in failed (popup blocked or not enabled).";
    }
  });
})();

// Welcome line
(function () {
  const welcomeLine = document.getElementById("welcomeLine");
  if (!welcomeLine) return;
  const p = getProfile();
  if (p?.name) welcomeLine.textContent = `Welcome, ${p.name} • Smart Financial Insights`;
})();

// Logout
(function () {
  const logoutBtn = document.getElementById("logoutBtn");
  if (!logoutBtn) return;

  logoutBtn.addEventListener("click", async () => {
    await signOut(auth);
    clearProfile();
    location.href = "index.html";
  });
})();