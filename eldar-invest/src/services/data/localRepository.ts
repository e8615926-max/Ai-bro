import type { UserData } from '@/domain/types';
import { readJSON, removeKey, writeJSON } from '../storage';
import type { UserRepository } from './types';

const key = (uid: string) => `data:${uid}`;

export class LocalUserRepository implements UserRepository {
  async load(uid: string): Promise<UserData | null> {
    await new Promise((r) => setTimeout(r, 200));
    return readJSON<UserData>(key(uid));
  }
  async save(uid: string, data: UserData): Promise<void> {
    writeJSON(key(uid), data);
  }
  async remove(uid: string): Promise<void> {
    removeKey(key(uid));
  }
}
