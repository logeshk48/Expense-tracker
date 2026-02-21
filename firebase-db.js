// firebase-db.js
import { db } from "./firebase-config.js";

import {
  collection,
  doc,
  getDocs,
  setDoc,
  deleteDoc,
  query,
  where
} from "https://www.gstatic.com/firebasejs/12.9.0/firebase-firestore.js";

const EXP_COLLECTION = "expenses";

export async function loadExpensesFromCloud(uid){
  const q = query(collection(db, EXP_COLLECTION), where("uid", "==", uid));
  const snap = await getDocs(q);

  const items = [];
  snap.forEach(d => items.push(d.data()));

  // latest first
  items.sort((a,b)=> (b.date || "").localeCompare(a.date || ""));
  return items;
}

export async function saveExpenseToCloud(item){
  // item must contain id
  await setDoc(doc(db, EXP_COLLECTION, item.id), item);
}

export async function deleteExpenseFromCloud(id){
  await deleteDoc(doc(db, EXP_COLLECTION, id));
}