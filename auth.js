// auth.js (module) - Redirect-safe Google + Email login
import { auth } from "./firebase-config.js?v=120";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithRedirect,
  getRedirectResult
} from "https://www.gstatic.com/firebasejs/12.9.0/firebase-auth.js";

const PROFILE_KEY = "et_profile_v1";
function setProfile(obj){ localStorage.setItem(PROFILE_KEY, JSON.stringify(obj)); }
function getProfile(){ try { return JSON.parse(localStorage.getItem(PROFILE_KEY) || "null"); } catch { return null; } }
function clearProfile(){ localStorage.removeItem(PROFILE_KEY); }

const isLoginPage = () => document.getElementById("loginForm") != null;
const isDashboardPage = () => location.pathname.toLowerCase().includes("dashboard.html");

// 1) Handle Google redirect result FIRST (when returning from Google)
(async function handleRedirect(){
  try {
    const res = await getRedirectResult(auth);
    if (res && res.user) {
      const name = res.user.displayName || "User";
      const email = res.user.email || "";
      setProfile({ name, email, ts: Date.now() });
      // go to dashboard
      location.href = "dashboard.html";
    }
  } catch (e) {
    // If there was no redirect result, ignore
  }
})();

// 2) Protect pages: wait for auth state
onAuthStateChanged(auth, (user) => {
  // If on dashboard and not logged in -> go login
  if (isDashboardPage() && !user) {
    location.href = "index.html";
    return;
  }

  // If on login page and already logged in -> go dashboard
  if (isLoginPage() && user) {
    location.href = "dashboard.html";
    return;
  }
});

// 3) Login page buttons
(function loginUI(){
  const loginBtn = document.getElementById("loginBtn");
  if (!loginBtn) return;

  const signupBtn = document.getElementById("signupBtn");
  const googleBtn = document.getElementById("googleBtn");

  const fullName = document.getElementById("fullName");
  const emailEl = document.getElementById("email");
  const passwordEl = document.getElementById("password");
  const err = document.getElementById("loginError");

  function readInputs(){
    const name = (fullName?.value || "").trim();
    const email = (emailEl?.value || "").trim();
    const pw = (passwordEl?.value || "").trim();

    if (name.length < 2) return { error: "Enter your name (min 2 letters)." };
    if (!email) return { error: "Enter your email." };
    if (pw.length < 6) return { error: "Password must be at least 6 characters." };
    return { name, email, pw };
  }

  loginBtn.addEventListener("click", async () => {
    err.textContent = "";
    const v = readInputs();
    if (v.error) return (err.textContent = v.error);

    try {
      await signInWithEmailAndPassword(auth, v.email, v.pw);
      setProfile({ name: v.name, email: v.email, ts: Date.now() });
      location.href = "dashboard.html";
    } catch (e) {
      console.error(e);
      err.textContent = "Login failed. Create account first or check password.";
    }
  });

  signupBtn.addEventListener("click", async () => {
    err.textContent = "";
    const v = readInputs();
    if (v.error) return (err.textContent = v.error);

    try {
      await createUserWithEmailAndPassword(auth, v.email, v.pw);
      setProfile({ name: v.name, email: v.email, ts: Date.now() });
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
      await signInWithRedirect(auth, provider);
    } catch (e) {
      console.error(e);
      err.textContent = "Google sign-in failed. Check Firebase Google + authorized domain.";
    }
  });
})();

// 4) Dashboard welcome + logout
(function dashboardUI(){
  const logoutBtn = document.getElementById("logoutBtn");
  const welcomeLine = document.getElementById("welcomeLine");

  const p = getProfile();
  if (welcomeLine && p?.name) welcomeLine.textContent = `Welcome, ${p.name} • Smart Financial Insights`;

  if (logoutBtn){
    logoutBtn.addEventListener("click", async () => {
      await signOut(auth);
      clearProfile();
      location.href = "index.html";
    });
  }
})();