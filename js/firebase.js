/**
 * LifeFlow — Firebase bootstrap.
 * Initialises the app once and re-exports the SDK pieces the rest of the
 * codebase needs, so no other module talks to the CDN directly.
 */
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import {
  getAuth,
  setPersistence,
  browserLocalPersistence,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  sendPasswordResetEmail,
  sendEmailVerification,
  updateProfile,
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider,
  deleteUser
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import {
  getFirestore,
  doc,
  collection,
  addDoc,
  setDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  writeBatch,
  increment,
  arrayUnion,
  arrayRemove,
  Timestamp
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import {
  getStorage,
  ref as storageRef,
  uploadBytes,
  getDownloadURL,
  deleteObject
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js';

import { firebaseConfig, ENABLE_ANALYTICS } from './config.js';

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

// Keep the session alive between visits (best-effort — private mode can block it).
setPersistence(auth, browserLocalPersistence).catch(() => {});

// Analytics is optional and only works on http(s) origins.
if (ENABLE_ANALYTICS && location.protocol.startsWith('http')) {
  import('https://www.gstatic.com/firebasejs/10.12.2/firebase-analytics.js')
    .then(({ getAnalytics, isSupported }) =>
      isSupported().then((ok) => { if (ok) getAnalytics(app); })
    )
    .catch(() => {});
}

export {
  // auth
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  sendPasswordResetEmail,
  sendEmailVerification,
  updateProfile,
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider,
  deleteUser,
  // firestore
  doc,
  collection,
  addDoc,
  setDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  writeBatch,
  increment,
  arrayUnion,
  arrayRemove,
  Timestamp,
  // storage
  storageRef,
  uploadBytes,
  getDownloadURL,
  deleteObject
};

/** Human-friendly messages for Firebase auth error codes. */
export function authErrorMessage(err) {
  const code = (err && err.code) || '';
  const map = {
    'auth/invalid-email': 'That email address doesn’t look right.',
    'auth/user-disabled': 'This account has been disabled.',
    'auth/user-not-found': 'No account found with that email.',
    'auth/wrong-password': 'Incorrect email or password.',
    'auth/invalid-credential': 'Incorrect email or password.',
    'auth/invalid-login-credentials': 'Incorrect email or password.',
    'auth/email-already-in-use': 'That email is already registered. Try logging in.',
    'auth/weak-password': 'Please choose a password with at least 6 characters.',
    'auth/too-many-requests': 'Too many attempts. Please wait a moment and try again.',
    'auth/network-request-failed': 'Network problem — check your connection.',
    'auth/requires-recent-login': 'Please log in again to complete this action.',
    'auth/missing-password': 'Please enter your password.',
    'auth/operation-not-allowed': 'Email sign-in is not enabled in Firebase yet.',
    'permission-denied': 'You don’t have permission for that. Check your Firestore rules.',
    unavailable: 'Can’t reach the server right now. Please retry.'
  };
  return map[code] || (err && err.message) || 'Something went wrong. Please try again.';
}
