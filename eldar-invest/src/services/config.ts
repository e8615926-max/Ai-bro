/**
 * Backend selection.
 *
 * ELDAR INVEST ships with two interchangeable backends behind the same
 * interfaces (see services/auth/types.ts and services/data/types.ts):
 *
 *  - "local"    — runs entirely in the browser (default, used for the demo).
 *  - "firebase" — Firebase Authentication + Cloud Firestore. Enabled
 *                 automatically when every VITE_FIREBASE_* variable is set.
 */
export const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY as string | undefined,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string | undefined,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID as string | undefined,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET as string | undefined,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID as string | undefined,
  appId: import.meta.env.VITE_FIREBASE_APP_ID as string | undefined,
};

export const isFirebaseConfigured = Object.values(firebaseConfig).every((v) => typeof v === 'string' && v.length > 0);

export const backendName: 'local' | 'firebase' = isFirebaseConfigured ? 'firebase' : 'local';
