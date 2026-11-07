/**
 * Lazily initialised Firebase app. The SDK is only downloaded when the
 * Firebase backend is enabled (see services/config.ts).
 */
import { firebaseConfig } from './config';

let appPromise: Promise<import('firebase/app').FirebaseApp> | null = null;

export function getFirebaseApp() {
  if (!appPromise) {
    appPromise = import('firebase/app').then(({ initializeApp, getApps }) =>
      getApps()[0] ?? initializeApp(firebaseConfig as Record<string, string>),
    );
  }
  return appPromise;
}
