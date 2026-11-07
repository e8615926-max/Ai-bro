/**
 * Cloud Firestore repository. Each user's account is a single document at
 * users/{uid}; see firestore.rules for the access policy.
 */
import type { UserData } from '@/domain/types';
import { getFirebaseApp } from '../firebase';
import type { UserRepository } from './types';

async function db() {
  const [app, fs] = await Promise.all([getFirebaseApp(), import('firebase/firestore')]);
  return { db: fs.getFirestore(app), fs };
}

export class FirestoreUserRepository implements UserRepository {
  async load(uid: string): Promise<UserData | null> {
    const { db: d, fs } = await db();
    const snap = await fs.getDoc(fs.doc(d, 'users', uid));
    return snap.exists() ? (snap.data() as UserData) : null;
  }
  async save(uid: string, data: UserData): Promise<void> {
    const { db: d, fs } = await db();
    await fs.setDoc(fs.doc(d, 'users', uid), data);
  }
  async remove(uid: string): Promise<void> {
    const { db: d, fs } = await db();
    await fs.deleteDoc(fs.doc(d, 'users', uid));
  }
}
