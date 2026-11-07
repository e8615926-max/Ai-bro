/** Used by the single-file build, which only ships the local backend. */
const unavailable = () => {
  throw new Error('Firebase is not included in the standalone build.');
};
export const initializeApp = unavailable;
export const getApps = () => [];
export const getAuth = unavailable;
export const getFirestore = unavailable;
export default {};
