// firebase-config.js

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-app.js";
import { getAuth, signInAnonymously } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-firestore.js";

// Your Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCdVOph2g6bcehoCoDdb5nL7CAODj45rao",
  authDomain: "expence-tracker-d520c.firebaseapp.com",
  projectId: "expence-tracker-d520c",
  storageBucket: "expence-tracker-d520c.firebasestorage.app",
  messagingSenderId: "116140989817",
  appId: "1:116140989817:web:3b4f67179bfa05fdbea3a8",
  measurementId: "G-0NGN83TWST"
};

// Initialize Firebase
export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

// Ensure anonymous login
export async function ensureAnonAuth() {
  if (auth.currentUser) return auth.currentUser;
  const res = await signInAnonymously(auth);
  return res.user;
}