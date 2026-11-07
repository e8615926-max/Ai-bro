import type { UserData } from '@/domain/types';

/** Contract for persisting a user's virtual account. */
export interface UserRepository {
  load(uid: string): Promise<UserData | null>;
  save(uid: string, data: UserData): Promise<void>;
  remove(uid: string): Promise<void>;
}
