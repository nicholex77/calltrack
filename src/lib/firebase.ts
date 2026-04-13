console.log("🔥 Firebase file loaded");
console.log("🔥 Firebase initialized");

import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
const firebaseConfig = {
  apiKey: "AIzaSyBmbw5QxG4oXe3zmKhvRFGxo99XoqLbCDQ",
  authDomain: "calltrack-6fcc1.firebaseapp.com",
  projectId: "calltrack-6fcc1",
  storageBucket: "calltrack-6fcc1.firebasestorage.app",
  messagingSenderId: "607936233966",
  appId: "1:607936233966:web:b4a276a5632b032c680eff",
  measurementId: "G-EM639Z0GKE"
};
const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);
export const auth = getAuth(app);