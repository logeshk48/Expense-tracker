import { auth } from "./firebase-config.js?v=500";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup,
  sendPasswordResetEmail
} from "https://www.gstatic.com/firebasejs/12.9.0/firebase-auth.js";

const PROFILE_KEY = "et_profile_v5";

function setProfile(user) {
  const name = user.displayName || (user.email ? user.email.split("@")[0] : "User");
  localStorage.setItem(PROFILE_KEY, JSON.stringify({
    name,
    email: user.email || "",
    ts: Date.now()
  }));
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

// Protect pages
onAuthStateChanged(auth, (user) => {
  if (isDashboardPage() && !user) {
    location.href = "index.html";
    return;
  }

  if (isLoginPage() && user) {
    setProfile(user);
    location.href = "dashboard.html";
    return;
  }
});

(function () {
  const mainBtn = document.getElementById("mainBtn");
  if (!mainBtn) return; // not on login page

  const switchMode = document.getElementById("switchMode");
  const switchText = document.getElementById("switchText");
  const confirmField = document.getElementById("confirmField");
  const forgotWrap = document.getElementById("forgotWrap");

  const emailEl = document.getElementById("email");
  const passwordEl = document.getElementById("password");
  const confirmEl = document.getElementById("confirmPassword");
  const err = document.getElementById("loginError");

  const togglePassword = document.getElementById("togglePassword");
  const toggleConfirm = document.getElementById("toggleConfirm");

  let isSignup = false; // default = login

  // ----- Eye icon toggles -----
  function attachEyeToggle(input, icon) {
    if (!input || !icon) return;
    icon.addEventListener("click", () => {
      input.type = (input.type === "password") ? "text" : "password";
    });
  }
  attachEyeToggle(passwordEl, togglePassword);
  attachEyeToggle(confirmEl, toggleConfirm);

  // ----- Toggle login/signup mode -----
  switchMode.addEventListener("click", (e) => {
    e.preventDefault();

    isSignup = !isSignup;
    err.textContent = "";
    err.style.color = ""; // reset

    // clear passwords when switching
    passwordEl.value = "";
    if (confirmEl) confirmEl.value = "";

    if (isSignup) {
      mainBtn.textContent = "Create Account";
      confirmField.style.display = "block";
      if (forgotWrap) forgotWrap.style.display = "none";
      switchText.textContent = "Already have an account?";
      switchMode.textContent = "Login";
      passwordEl.setAttribute("autocomplete", "new-password");
    } else {
      mainBtn.textContent = "Login";
      confirmField.style.display = "none";
      if (forgotWrap) forgotWrap.style.display = "block";
      switchText.textContent = "Don't have an account?";
      switchMode.textContent = "Create Account";
      passwordEl.setAttribute("autocomplete", "current-password");
    }
  });

  // ----- Main action (Login or Signup) -----
  mainBtn.addEventListener("click", async () => {
    err.textContent = "";
    err.style.color = "";

    const email = (emailEl.value || "").trim();
    const password = (passwordEl.value || "").trim();

    if (!email) return (err.textContent = "Enter email.");
    if (password.length < 6) return (err.textContent = "Password must be at least 6 characters.");

    if (isSignup) {
      const confirm = (confirmEl?.value || "").trim();
      if (!confirm) return (err.textContent = "Please confirm your password.");
      if (password !== confirm) return (err.textContent = "Passwords do not match.");

      try {
        const res = await createUserWithEmailAndPassword(auth, email, password);
        setProfile(res.user);
        location.href = "dashboard.html";
      } catch (e) {
        console.error(e);
        if (e.code === "auth/email-already-in-use") {
          err.textContent = "Email already registered. Please login.";
        } else if (e.code === "auth/invalid-email") {
          err.textContent = "Invalid email format.";
        } else {
          err.textContent = "Signup failed. Try again.";
        }
      }
    } else {
      try {
        const res = await signInWithEmailAndPassword(auth, email, password);
        setProfile(res.user);
        location.href = "dashboard.html";
      } catch (e) {
        console.error(e);
        err.textContent = "Invalid email or password.";
      }
    }
  });

  // ----- Forgot Password (Login mode only) -----
  const forgotBtn = document.getElementById("forgotPassword");
  if (forgotBtn) {
    forgotBtn.addEventListener("click", async (e) => {
      e.preventDefault();
      err.textContent = "";
      err.style.color = "";

      const email = (emailEl.value || "").trim();
      if (!email) {
        err.textContent = "Enter your email first to reset password.";
        return;
      }

      try {
        await sendPasswordResetEmail(auth, email);
        err.style.color = "lightgreen";
        err.textContent = "Reset email sent. Check inbox/spam.";
      } catch (e) {
        console.error(e);
        err.textContent = "Reset failed. Check email and try again.";
      }
    });
  }

  // ----- Google Login (Popup) -----
  const googleBtn = document.getElementById("googleBtn");
  googleBtn.addEventListener("click", async () => {
    err.textContent = "";
    err.style.color = "";

    try {
      const provider = new GoogleAuthProvider();
      const res = await signInWithPopup(auth, provider);
      setProfile(res.user);
      location.href = "dashboard.html";
    } catch (e) {
      console.error(e);
      err.textContent = "Google sign-in failed. If popup blocked, allow popups.";
    }
  });
})();

// Dashboard logout
(function () {
  const logoutBtn = document.getElementById("logoutBtn");
  if (!logoutBtn) return;

  logoutBtn.addEventListener("click", async () => {
    await signOut(auth);
    clearProfile();
    location.href = "index.html";
  });

  // Optional: update welcome line from profile
  const welcomeLine = document.getElementById("welcomeLine");
  const p = getProfile();
  if (welcomeLine && p?.name) {
    welcomeLine.textContent = `Welcome, ${p.name} • Smart Financial Insights`;
  }
})();