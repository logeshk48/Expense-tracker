import { auth } from "./firebase-config.js?v=300";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup
} from "https://www.gstatic.com/firebasejs/12.9.0/firebase-auth.js";

const PROFILE_KEY = "et_profile_v3";

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

// Login & Signup UI
(function () {

  const loginBtn = document.getElementById("loginBtn");
  if (!loginBtn) return;

  const signupBtn = document.getElementById("signupBtn");
  const googleBtn = document.getElementById("googleBtn");

  const emailEl = document.getElementById("email");
  const passwordEl = document.getElementById("password");
  const confirmEl = document.getElementById("confirmPassword");
  const err = document.getElementById("loginError");

  function validateBasic() {
    const email = emailEl.value.trim();
    const password = passwordEl.value.trim();
    if (!email) return "Enter email.";
    if (password.length < 6) return "Password must be at least 6 characters.";
    return null;
  }

  // LOGIN
  loginBtn.addEventListener("click", async () => {
    err.textContent = "";

    const error = validateBasic();
    if (error) return err.textContent = error;

    try {
      const res = await signInWithEmailAndPassword(
        auth,
        emailEl.value.trim(),
        passwordEl.value.trim()
      );
      setProfile(res.user);
      location.href = "dashboard.html";
    } catch (e) {
      err.textContent = "Invalid email or password.";
    }
  });

  // SIGN UP
  signupBtn.addEventListener("click", async () => {
    err.textContent = "";

    const error = validateBasic();
    if (error) return err.textContent = error;

    if (passwordEl.value !== confirmEl.value) {
      return err.textContent = "Passwords do not match.";
    }

    try {
      const res = await createUserWithEmailAndPassword(
        auth,
        emailEl.value.trim(),
        passwordEl.value.trim()
      );
      setProfile(res.user);
      location.href = "dashboard.html";
    } catch (e) {
      if (e.code === "auth/email-already-in-use") {
        err.textContent = "Email already registered. Please login.";
      } else {
        err.textContent = "Signup failed. Try again.";
      }
    }
  });

  // GOOGLE LOGIN
  googleBtn.addEventListener("click", async () => {
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