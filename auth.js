import { auth } from "./firebase-config.js?v=400";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup
} from "https://www.gstatic.com/firebasejs/12.9.0/firebase-auth.js";

const PROFILE_KEY = "et_profile_v4";

function setProfile(user) {
  const name = user.displayName || (user.email ? user.email.split("@")[0] : "User");
  localStorage.setItem(PROFILE_KEY, JSON.stringify({
    name,
    email: user.email,
    ts: Date.now()
  }));
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
  }

  if (isLoginPage() && user) {
    setProfile(user);
    location.href = "dashboard.html";
  }
});

// Toggle Logic
(function () {

  const mainBtn = document.getElementById("mainBtn");
  if (!mainBtn) return;

  const switchMode = document.getElementById("switchMode");
  const switchText = document.getElementById("switchText");
  const confirmField = document.getElementById("confirmField");

  const emailEl = document.getElementById("email");
  const passwordEl = document.getElementById("password");
  const confirmEl = document.getElementById("confirmPassword");
  const err = document.getElementById("loginError");

  let isSignup = false; // default = login

  switchMode.addEventListener("click", (e) => {
    e.preventDefault();
    isSignup = !isSignup;

    err.textContent = "";
    passwordEl.value = "";
    if (confirmEl) confirmEl.value = "";

    if (isSignup) {
      mainBtn.textContent = "Create Account";
      confirmField.style.display = "block";
      switchText.textContent = "Already have an account?";
      switchMode.textContent = "Login";
    } else {
      mainBtn.textContent = "Login";
      confirmField.style.display = "none";
      switchText.textContent = "Don't have an account?";
      switchMode.textContent = "Create Account";
    }
  });

  mainBtn.addEventListener("click", async () => {

    err.textContent = "";
    const email = emailEl.value.trim();
    const password = passwordEl.value.trim();

    if (!email) return err.textContent = "Enter email.";
    if (password.length < 6) return err.textContent = "Password must be at least 6 characters.";

    if (isSignup) {
      if (password !== confirmEl.value) {
        return err.textContent = "Passwords do not match.";
      }

      try {
        const res = await createUserWithEmailAndPassword(auth, email, password);
        setProfile(res.user);
        location.href = "dashboard.html";
      } catch (e) {
        if (e.code === "auth/email-already-in-use") {
          err.textContent = "Email already registered. Please login.";
        } else {
          err.textContent = "Signup failed.";
        }
      }

    } else {

      try {
        const res = await signInWithEmailAndPassword(auth, email, password);
        setProfile(res.user);
        location.href = "dashboard.html";
      } catch (e) {
        err.textContent = "Invalid email or password.";
      }

    }
  });

  // Google
  document.getElementById("googleBtn").addEventListener("click", async () => {
    err.textContent = "";
    try {
      const provider = new GoogleAuthProvider();
      const res = await signInWithPopup(auth, provider);
      setProfile(res.user);
      location.href = "dashboard.html";
    } catch (e) {
      err.textContent = "Google sign-in failed.";
    }
  });

})();

// Logout
(function(){
  const logoutBtn = document.getElementById("logoutBtn");
  if (!logoutBtn) return;

  logoutBtn.addEventListener("click", async () => {
    await signOut(auth);
    clearProfile();
    location.href = "index.html";
  });
})();