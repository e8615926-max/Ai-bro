import { create } from 'zustand';
import { authService } from '@/services';
import type { AuthUser, SignInInput, SignUpInput } from '@/services/auth/types';
import { useAccount } from './account';

type Status = 'loading' | 'authenticated' | 'guest';

interface SessionState {
  status: Status;
  user: AuthUser | null;
  init: () => Promise<void>;
  signUp: (input: SignUpInput & { samplePortfolio: boolean }) => Promise<void>;
  signIn: (input: SignInInput) => Promise<void>;
  signOut: () => Promise<void>;
  updateName: (name: string) => Promise<void>;
  changePassword: (current: string, next: string) => Promise<void>;
  deleteAccount: (password: string) => Promise<void>;
}

export const useSession = create<SessionState>((set, get) => ({
  status: 'loading',
  user: null,

  init: async () => {
    try {
      const user = await authService.currentUser();
      if (user) {
        await useAccount.getState().load(user);
        set({ user, status: 'authenticated' });
      } else set({ user: null, status: 'guest' });
    } catch {
      set({ user: null, status: 'guest' });
    }
  },

  signUp: async ({ samplePortfolio, ...input }) => {
    const user = await authService.signUp(input);
    await useAccount.getState().create(user, { samplePortfolio });
    set({ user, status: 'authenticated' });
  },

  signIn: async (input) => {
    const user = await authService.signIn(input);
    await useAccount.getState().load(user);
    useAccount.getState().log('login', 'Signed in');
    set({ user, status: 'authenticated' });
  },

  signOut: async () => {
    useAccount.getState().log('logout', 'Signed out');
    await useAccount.getState().flush();
    await authService.signOut();
    useAccount.getState().clear();
    set({ user: null, status: 'guest' });
  },

  updateName: async (name) => {
    const user = await authService.updateProfile({ name });
    useAccount.getState().updateProfile({ name: user.name });
    set({ user });
  },

  changePassword: async (current, next) => {
    await authService.changePassword(current, next);
    useAccount.getState().log('security', 'Password changed');
  },

  deleteAccount: async (password) => {
    const uid = get().user?.uid;
    await authService.deleteAccount(password, async () => {
      if (uid) await useAccount.getState().destroy(uid);
    });
    set({ user: null, status: 'guest' });
  },
}));
