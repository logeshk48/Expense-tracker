// auth.js
import { auth } from "./firebase-config.js?v=200";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  GoogleAuthProvider,
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

// 1) handle redirect result from Google
(async function handleRedirect(){
  try{
    const res = await getRedirectResult(auth);
    if (res?.user){
      const name = res.user.displayName || "User";
      const email = res.user.email || "";
      setProfile({ name, email, ts: Date.now() });
      location.href = "dashboard.html";
    }
  }catch(e){
    // ignore if no redirect
  }
})();

// 2) route protection
onAuthStateChanged(auth, (user) => {
  if (isDashboardPage() && !user) location.href = "index.html";
  if (isLoginPage() && user) location.href = "dashboard.html";
});

// 3) login/signup page logic
(function loginUI(){
  const form = document.getElementById("loginForm");
  if (!form) return;

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

  let mode = "login"; // "login" | "signup"

  function setMode(m){
    mode = m;
    err.textContent = "";

    if (mode === "login"){
      modeLoginBtn.classList.add("active");
      modeSignupBtn.classList.remove("active");
      nameWrap.classList.add("hidden");
      confirmWrap.classList.add("hidden");
      primaryBtn.innerHTML = `<span class="btn-icon">→</span> Login`;
      hint.textContent = "Use your email & password to login.";
      fullName.value = "";
      confirmEl.value = "";
    } else {
      modeSignupBtn.classList.add("active");
      modeLoginBtn.classList.remove("active");
      nameWrap.classList.remove("hidden");
      confirmWrap.classList.remove("hidden");
      primaryBtn.innerHTML = `<span class="btn-icon">＋</span> Create Account`;
      hint.textContent = "Create your account using email + password.";
    }
  }

  modeLoginBtn.addEventListener("click", () => setMode("login"));
  modeSignupBtn.addEventListener("click", () => setMode("signup"));
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

  primaryBtn.addEventListener("click", async () => {
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
      if (mode === "login"){
        err.textContent = "Login failed. Check email/password or create account first.";
      } else {
        err.textContent = "Signup failed. Email may already exist.";
      }
    }
  });

  googleBtn.addEventListener("click", async () => {
    err.textContent = "";
    try{
      const provider = new GoogleAuthProvider();
      await signInWithRedirect(auth, provider);
    }catch(e){
      console.error(e);
      err.textContent = "Google sign-in failed. Check Firebase Google setup + authorized domain.";
    }
  });
})();

// 4) dashboard header welcome + logout
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