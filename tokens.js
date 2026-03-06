/**
 * tokens.js — Centralized Firebase Synchronization
 * This version syncs token status across all admin devices in real-time.
 */

// 1. YOUR FIREBASE CONFIGURATION
// Create a project at console.firebase.google.com, add a web app, and paste your config here!
const firebaseConfig = {
  apiKey: "AIzaSyB_S0VSR7vvdVX_xY-bUIOOvvbY1P1BUvI",
  authDomain: "mekchat-2026.firebaseapp.com",
  databaseURL: "https://mekchat-2026-default-rtdb.firebaseio.com",
  projectId: "mekchat-2026",
  storageBucket: "mekchat-2026.firebasestorage.app",
  messagingSenderId: "951422237744",
  appId: "1:951422237744:web:b9cdc2a571c98f6c2201f5",
  measurementId: "G-1BNDY9YZ4Z"
};

// Internal state
let SHARED_STATE = {};
let dbRef = null;

// Initialize Firebase
async function initFirebase() {
  if (typeof firebase === 'undefined') {
    console.warn("Firebase SDK not loaded yet. Waiting...");
    return;
  }

  if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
    if (typeof firebase.analytics === 'function') firebase.analytics();
  }

  dbRef = firebase.database().ref('foodTokensState');

  // Load from local storage initially as fallback/cache for immediate UI
  try {
    const local = localStorage.getItem('foodTokensState');
    if (local) SHARED_STATE = JSON.parse(local);
    console.log("Firebase Init: Loaded cached state from storage.");
  } catch (e) { }

  // Listen for real-time updates from other devices
  dbRef.on('value', (snapshot) => {
    const data = snapshot.val();
    if (data) {
      SHARED_STATE = data;
      localStorage.setItem('foodTokensState', JSON.stringify(SHARED_STATE));
      console.log("Firebase Sync: Cloud state received.");
    } else {
      console.log("Firebase Sync: Cloud database is empty.");
      // If we have something locally but cloud is empty, it means we might be the first or sync just started
    }

    // Refresh all Admin UI components
    if (typeof renderTokensList === 'function') renderTokensList();
    if (typeof renderBoughtList === 'function') renderBoughtList();
    if (typeof refreshStats === 'function') refreshStats();

    // If student result is open, refresh their status badge
    if (typeof currentStudent !== 'undefined' && currentStudent && typeof showResult === 'function') {
      showResult(currentStudent);
    }
  }, (error) => {
    console.error("Firebase Sync Error:", error);
    if (error.code === 'PERMISSION_DENIED') {
      alert("CRITICAL: Firebase Sync Failed! Please go to Firebase Console > Rules and set '.read' and '.write' to 'true'.");
    }
  });
}

// Start Init
initFirebase();

// ─── API ──────────────────────────────────────────────────────────────────────

function getTokensState() {
  return SHARED_STATE;
}

/**
 * Mark a token as used and sync to cloud.
 */
function markTokenUsed(tokenId, registerNumber) {
  const entry = {
    used: true,
    usedAt: new Date().toISOString(),
    registerNumber: String(registerNumber)
  };

  // Update local immediately for UI speed
  SHARED_STATE[tokenId] = entry;

  // Push to cloud
  if (dbRef) {
    dbRef.child(tokenId).set(entry).catch(err => {
      console.error("Cloud sync failed:", err);
      localStorage.setItem('foodTokensState', JSON.stringify(SHARED_STATE)); // fallback
    });
  }
}

/**
 * Revert a token to unused status and sync to cloud.
 */
function unmarkTokenUsed(tokenId) {
  if (SHARED_STATE[tokenId]) {
    delete SHARED_STATE[tokenId];
    if (dbRef) {
      dbRef.child(tokenId).remove().catch(err => console.error("Cloud delete failed:", err));
    }
  }
}

/**
 * Check if a token has been used.
 */
function getTokenStatus(tokenId) {
  return SHARED_STATE[tokenId] || { used: false };
}

/**
 * Get statistics.
 */
function getStats(students) {
  const total = students.length;
  const used = Object.values(SHARED_STATE).filter(t => t.used).length;
  return { total, used, remaining: total - used };
}

/**
 * Reset all (Admin Only Danger)
 */
function resetAllTokens() {
  if (confirm("DANGER: This will clear the ENTIRE database. Proceed?")) {
    if (dbRef) dbRef.remove();
    SHARED_STATE = {};
  }
}
