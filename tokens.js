/**
 * tokens.js — Shared token storage utility
 * Uses localStorage to persist token usage state across sessions.
 */

const STORAGE_KEY = 'foodTokensState';

function getTokensState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveTokensState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

/**
 * Mark a token as used.
 * @param {string} tokenId
 * @param {string} registerNumber
 */
function markTokenUsed(tokenId, registerNumber) {
  const state = getTokensState();
  state[tokenId] = {
    used: true,
    usedAt: new Date().toISOString(),
    registerNumber
  };
  saveTokensState(state);
}

/**
 * Revert a token to unused status.
 * @param {string} tokenId
 */
function unmarkTokenUsed(tokenId) {
  const state = getTokensState();
  if (state[tokenId]) {
    delete state[tokenId];
    saveTokensState(state);
  }
}

/**
 * Check if a token has been used.
 * @param {string} tokenId
 * @returns {{ used: boolean, usedAt?: string, registerNumber?: string }}
 */
function getTokenStatus(tokenId) {
  const state = getTokensState();
  return state[tokenId] || { used: false };
}

/**
 * Get statistics for the admin dashboard.
 * @param {Array} students - Full student array
 * @returns {{ total: number, used: number, remaining: number }}
 */
function getStats(students) {
  const state = getTokensState();
  const total = students.length;
  const used = Object.values(state).filter(t => t.used).length;
  return { total, used, remaining: total - used };
}

/**
 * Reset all token states (admin utility).
 */
function resetAllTokens() {
  localStorage.removeItem(STORAGE_KEY);
}
