// firebase.js — Firebase bootstrap (ES module)
import { initializeApp }                              from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword,
         signInWithEmailAndPassword, signOut,
         onAuthStateChanged }                         from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc,
         collection, addDoc, deleteDoc,
         query, orderBy, getDocs }                    from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// ── Config ─────────────────────────────────────────
const firebaseConfig = {
  apiKey: "AIzaSyCCKN9I9LJ9cikm18OKO6Qzc7hdDknZf9g",
  authDomain: "milkmanageshubh.firebaseapp.com",
  projectId: "milkmanageshubh",
  storageBucket: "milkmanageshubh.firebasestorage.app",
  messagingSenderId: "13155070443",
  appId: "1:13155070443:web:3af0df4f1ea45e6f31a9ae"
};

const firebaseApp = initializeApp(firebaseConfig);
const auth        = getAuth(firebaseApp);
const db          = getFirestore(firebaseApp);

function todayStr() {
    const d    = new Date();
    const yyyy = d.getFullYear();
    const mm   = String(d.getMonth() + 1).padStart(2, '0');
    const dd   = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

// ── Storage API (replaces storage.js) ──────────────
window.Storage = {

  async getUser() {
    return auth.currentUser;
  },
  
  async getPrices() {
    const uid  = auth.currentUser.uid;
    const ref  = doc(db, "users", uid, "settings", "prices");
    const snap = await getDoc(ref);
    return snap.exists() ? snap.data() : { cow: 60, buffalo: 75 };
  },

  async savePrices(prices) {
    const uid = auth.currentUser.uid;
    await setDoc(doc(db, "users", uid, "settings", "prices"), prices);
  },

  async getEntries() {
    const uid  = auth.currentUser.uid;
    const q    = query(collection(db, "users", uid, "entries"), orderBy("date", "desc"));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  },

  async addEntry(entry) {
    const uid = auth.currentUser.uid;
    const ref = await addDoc(collection(db, "users", uid, "entries"), entry);
    return { id: ref.id, ...entry };
  },

  async deleteEntry(id) {
    const uid = auth.currentUser.uid;
    await deleteDoc(doc(db, "users", uid, "entries", id));
  },

  async setEmailLimit() {
    const uid = auth.currentUser.uid;
    await setDoc(doc(db, "users", uid, "settings", "emailLimit"), {
      lastSentDate: todayStr()
    });
  },

  async getEmailLimit() {
    const uid  = auth.currentUser.uid;
    const snap = await getDoc(doc(db, "users", uid, "settings", "emailLimit"));
    if (!snap.exists()) return null;
    return snap.data();
  }
};

// ── Auth UI ─────────────────────────────────────────
function initAuth() {
  const tabs       = document.querySelectorAll(".tab");
  const form       = document.getElementById("auth-form");
  const submitBtn  = document.getElementById("auth-submit");
  const confirmFld = document.getElementById("confirm-field");
  const errMsg     = document.getElementById("auth-error");
  let mode         = "login";

  tabs.forEach(tab => {
    tab.addEventListener("click", () => {
      tabs.forEach(t => t.classList.remove("active"));
      tab.classList.add("active");
      mode = tab.dataset.tab;
      confirmFld.classList.toggle("hidden", mode !== "signup");
      submitBtn.textContent = mode === "login" ? "Sign In" : "Create Account";
      errMsg.classList.add("hidden");
    });
  });

  form.addEventListener("submit", async e => {
    e.preventDefault();
    errMsg.classList.add("hidden");
    submitBtn.disabled    = true;
    submitBtn.textContent = "Please wait…";

    const email    = document.getElementById("auth-email").value.trim();
    const password = document.getElementById("auth-password").value;
    const confirm  = document.getElementById("auth-confirm").value;

    try {
      if (mode === "signup") {
        if (password !== confirm) throw new Error("Passwords do not match.");
        if (password.length < 6)  throw new Error("Password must be at least 6 characters.");
        await createUserWithEmailAndPassword(auth, email, password);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (err) {
      showAuthError(friendlyError(err.code || err.message));
      submitBtn.disabled    = false;
      submitBtn.textContent = mode === "login" ? "Sign In" : "Create Account";
    }
  });

  document.getElementById("logout-btn").addEventListener("click", () => signOut(auth));
}

function showAuthError(msg) {
  const el = document.getElementById("auth-error");
  el.textContent = msg;
  el.classList.remove("hidden");
}

function friendlyError(code) {
  const map = {
    "auth/user-not-found":       "No account found with this email.",
    "auth/wrong-password":       "Incorrect password.",
    "auth/email-already-in-use": "An account with this email already exists.",
    "auth/invalid-email":        "Please enter a valid email address.",
    "auth/weak-password":        "Password must be at least 6 characters.",
    "auth/invalid-credential":   "Incorrect email or password.",
    "auth/too-many-requests":    "Too many attempts. Please try again later.",
  };
  return map[code] || "Something went wrong. Please try again.";
}

// ── Boot ────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  initAuth();

  onAuthStateChanged(auth, user => {
    if (user) {
      document.getElementById("auth-screen").classList.add("hidden");
      document.getElementById("app-screen").classList.remove("hidden");
      document.getElementById("user-label").textContent = user.email;
      App.start();
    } else {
      document.getElementById("auth-screen").classList.remove("hidden");
      document.getElementById("app-screen").classList.add("hidden");
    }
  });
});
