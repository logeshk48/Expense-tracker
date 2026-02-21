// auth.js (module) - Clean Email + Google Popup Login
import { auth } from "./firebase-config.js?v=200";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup
} from "https://www.gstatic.com/firebasejs/12.9.0/firebase-auth.js";

const PROFILE_KEY = "et_profile_v2";

function setProfile({ name, email }) {
  localStorage.setItem(PROFILE_KEY, JSON.stringify({ name, email, ts: Date.now() }));
}
function getProfile() {
  try { return JSON.parse(localStorage.getItem(PROFILE_KEY) || "null"); } catch { return null; }
}
function clearProfile() {
  localStorage.removeItem(PROFILE_KEY);
}

function isLoginPage() {
  return document.getElementById("loginForm") != null;
}
function isDashboardPage() {
  return location.pathname.toLowerCase().includes("dashboard.html");
}

function niceNameFromUser(user) {
  if (!user) return "User";
  if (user.displayName && user.displayName.trim()) return user.displayName.trim();
  if (user.email) return user.email.split("@")[0];
  return "User";
}

// 1) Protect pages (dashboard requires login)
onAuthStateChanged(auth, (user) => {
  if (isDashboardPage() && !user) {
    location.href = "index.html";
    return;
  }

  // If login page and already logged in, go dashboard
  if (isLoginPage() && user) {
    setProfile({ name: niceNameFromUser(user), email: user.email || "" });
    location.href = "dashboard.html";
    return;
  }
});

// 2) Login page actions
(function loginUI() {
  const loginBtn = document.getElementById("loginBtn");
  if (!loginBtn) return; // not on login page

  const signupBtn = document.getElementById("signupBtn");
  const googleBtn = document.getElementById("googleBtn");

  const emailEl = document.getElementById("email");
  const passwordEl = document.getElementById("password");
  const err = document.getElementById("loginError");

  function readInputs() {
    const email = (emailEl?.value || "").trim();
    const pw = (passwordEl?.value || "").trim();
    if (!email) return { error: "Enter your email." };
    if (pw.length < 6) return { error: "Password must be at least 6 characters." };
    return { email, pw };
  }

  loginBtn.addEventListener("click", async () => {
    err.textContent = "";
    const v = readInputs();
    if (v.error) return (err.textContent = v.error);

    try {
      const res = await signInWithEmailAndPassword(auth, v.email, v.pw);
      setProfile({ name: niceNameFromUser(res.user), email: res.user.email || v.email });
      location.href = "dashboard.html";
    } catch (e) {
      console.error(e);
      err.textContent = "Login failed. Check email/password or sign up first.";
    }
  });

  signupBtn.addEventListener("click", async () => {
    err.textContent = "";
    const v = readInputs();
    if (v.error) return (err.textContent = v.error);

    try {
      const res = await createUserWithEmailAndPassword(auth, v.email, v.pw);
      setProfile({ name: niceNameFromUser(res.user), email: res.user.email || v.email });
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

      const user = res.user;
      setProfile({
        name: niceNameFromUser(user),
        email: user.email || ""
      });

      location.href = "dashboard.html";
    } catch (e) {
      console.error(e);
      err.textContent =
        "Google sign-in failed. If popup blocked, allow popups and try again.";
    }
  });
})();

// 3) Dashboard welcome + logout
(function dashboardUI() {
  const logoutBtn = document.getElementById("logoutBtn");
  const welcomeLine = document.getElementById("welcomeLine");

  const p = getProfile();
  if (welcomeLine) {
    const name = p?.name || "User";
    welcomeLine.textContent = `Welcome, ${name} • Smart Financial Insights`;
  }

  if (logoutBtn) {
    logoutBtn.addEventListener("click", async () => {
      await signOut(auth);
      clearProfile();
      location.href = "index.html";
    });
  }
})();