// auth.js (WORKING: Popup + Redirect fallback + Always route to dashboard)
import { auth } from "./firebase-config.js?v=999";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  updateProfile
} from "https://www.gstatic.com/firebasejs/12.9.0/firebase-auth.js";

const PROFILE_KEY = "et_profile_v1";
function setProfile(obj){ localStorage.setItem(PROFILE_KEY, JSON.stringify(obj)); }
function getProfile(){ try { return JSON.parse(localStorage.getItem(PROFILE_KEY) || "null"); } catch { return null; } }
function clearProfile(){ localStorage.removeItem(PROFILE_KEY); }

const isLoginPage = () => document.getElementById("loginForm") != null;
const isDashboardPage = () => location.pathname.toLowerCase().includes("dashboard.html");
function initThemeToggle() {
  const btn = document.getElementById("themeToggleBtn");
  const icon = document.getElementById("themeToggleIcon");
  if (!btn) return;

  const savedTheme = localStorage.getItem("theme") || "dark";
  document.documentElement.classList.toggle("light", savedTheme === "light");
  updateThemeIcon();

  function updateThemeIcon() {
    const isLight = document.documentElement.classList.contains("light");
    if (icon) icon.textContent = isLight ? "☀️" : "🌙";
  }

  function applyTheme() {
    const isLightNow = document.documentElement.classList.contains("light");
    const nextIsLight = !isLightNow;

    document.documentElement.classList.toggle("light", nextIsLight);
    localStorage.setItem("theme", nextIsLight ? "light" : "dark");
    updateThemeIcon();
  }

  btn.addEventListener("click", () => {
    const rect = btn.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;

    const endRadius = Math.hypot(
      Math.max(x, window.innerWidth - x),
      Math.max(y, window.innerHeight - y)
    );

    if (!document.startViewTransition) {
      applyTheme();
      return;
    }

    const transition = document.startViewTransition(() => {
      applyTheme();
    });

    transition.ready.then(() => {
      document.documentElement.animate(
        {
          clipPath: [
            `circle(0px at ${x}px ${y}px)`,
            `circle(${endRadius}px at ${x}px ${y}px)`
          ]
        },
        {
          duration: 500,
          easing: "ease-in-out",
          pseudoElement: "::view-transition-new(root)"
        }
      );
    });
  });
}

// 1) Handle redirect result (when coming back from Google)
(async function handleRedirectResult(){
  try{
    const res = await getRedirectResult(auth);
    if (res?.user){
      const name = res.user.displayName || "User";
      const email = res.user.email || "";
      setProfile({ name, email, ts: Date.now() });

      // Always go to dashboard
      location.href = "dashboard.html";
    }
  } catch(e){
    // show error on login page if any
    const errBox = document.getElementById("loginError");
    if (errBox && e?.code) errBox.textContent = `Google sign-in error: ${e.code}`;
    console.error("getRedirectResult error:", e);
  }
})();

// 2) Route protection
onAuthStateChanged(auth, (user) => {
  if (isDashboardPage() && !user) location.href = "index.html";
  if (isLoginPage() && user) location.href = "dashboard.html";
});

// 3) Login/Signup UI
(function loginUI(){
  const form = document.getElementById("loginForm");
  if (!form) return;
  initThemeToggle();

  const modeLoginBtn = document.getElementById("modeLogin");
  const modeSignupBtn = document.getElementById("modeSignup");
  const primaryBtn = document.getElementById("primaryBtn");
  const googleBtn = document.getElementById("googleBtn");
  const hint = document.getElementById("loginHint");

  const nameWrap = document.getElementById("nameWrap");
  const confirmWrap = document.getElementById("confirmWrap");

  const fullName = document.getElementById("fullName");
  const emailEl = document.getElementById("email");
  const passwordEl = document.getElementById("password");
  const confirmEl = document.getElementById("confirmPassword");
  const err = document.getElementById("loginError");

  let mode = "login";

  function setMode(m){
  mode = m;
  err.textContent = "";

  if (mode === "login") {

    // Activate login tab
    modeLoginBtn.classList.add("active");
    modeSignupBtn.classList.remove("active");

    // Hide signup-only fields
    nameWrap.classList.add("hidden");
    confirmWrap.classList.add("hidden");

    // Show Google in login
    googleBtn.style.display = "block";

    primaryBtn.innerHTML = `<span class="btn-icon">→</span> Login`;
    hint.textContent = "Use your email & password to login.";

  } else {

    // Activate signup tab
    modeSignupBtn.classList.add("active");
    modeLoginBtn.classList.remove("active");

    // Show signup fields
    nameWrap.classList.remove("hidden");
    confirmWrap.classList.remove("hidden");

    // Show Google in signup too (optional)
    googleBtn.style.display = "block";

    primaryBtn.innerHTML = `<span class="btn-icon">＋</span> Create Account`;
    hint.textContent = "Create your account using email + password.";
  }
}

  modeLoginBtn?.addEventListener("click", () => setMode("login"));
  modeSignupBtn?.addEventListener("click", () => setMode("signup"));
  setMode("login");

  function readInputs(){
    const name = (fullName?.value || "").trim();
    const email = (emailEl?.value || "").trim();
    const pw = (passwordEl?.value || "").trim();
    const cpw = (confirmEl?.value || "").trim();

    if (!email) return { error: "Enter your email." };
    if (pw.length < 6) return { error: "Password must be at least 6 characters." };

    if (mode === "signup"){
      if (name.length < 2) return { error: "Enter your full name (min 2 letters)." };
      if (cpw.length < 6) return { error: "Confirm password must be at least 6 characters." };
      if (pw !== cpw) return { error: "Password and confirm password do not match." };
    }
    return { name, email, pw };
  }

  primaryBtn?.addEventListener("click", async () => {
    err.textContent = "";
    const v = readInputs();
    if (v.error) return (err.textContent = v.error);

    try{
      if (mode === "login"){
        await signInWithEmailAndPassword(auth, v.email, v.pw);
        const user = auth.currentUser;
        setProfile({ name: user?.displayName || "User", email: v.email, ts: Date.now() });
        location.href = "dashboard.html";
      } else {
        const cred = await createUserWithEmailAndPassword(auth, v.email, v.pw);
        if (v.name) await updateProfile(cred.user, { displayName: v.name });
        setProfile({ name: v.name || "User", email: v.email, ts: Date.now() });
        location.href = "dashboard.html";
      }
    }catch(e){
      console.error(e);
      err.textContent = (mode === "login")
        ? "Login failed. Check email/password or create account first."
        : "Signup failed. Email may already exist.";
    }
  });

  // ✅ Google sign-in: popup first, redirect fallback
  googleBtn?.addEventListener("click", async () => {
    err.textContent = "";
    try{
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: "select_account" });

      const res = await signInWithPopup(auth, provider);
      if (res?.user){
        const name = res.user.displayName || "User";
        const email = res.user.email || "";
        setProfile({ name, email, ts: Date.now() });
        location.href = "dashboard.html";
      }
    }catch(e){
      console.error("Google popup error:", e);
      const code = e?.code || "";

      // Popup blocked => redirect
      if (code === "auth/popup-blocked" || code === "auth/cancelled-popup-request"){
        const provider = new GoogleAuthProvider();
        provider.setCustomParameters({ prompt: "select_account" });
        await signInWithRedirect(auth, provider);
        return;
      }

      err.textContent = `Google sign-in failed: ${code || "unknown error"}`;
    }
  });
})();

// 4) Dashboard header + logout
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