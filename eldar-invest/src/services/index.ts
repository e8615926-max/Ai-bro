import { isFirebaseConfigured } from './config';
import { FirebaseAuthService } from './auth/firebaseAuth';
import { LocalAuthService } from './auth/localAuth';
import type { AuthService } from './auth/types';
import { FirestoreUserRepository } from './data/firestoreRepository';
import { LocalUserRepository } from './data/localRepository';
import type { UserRepository } from './data/types';

export const authService: AuthService = isFirebaseConfigured ? new FirebaseAuthService() : new LocalAuthService();
export const userRepository: UserRepository = isFirebaseConfigured ? new FirestoreUserRepository() : new LocalUserRepository();

export { backendName, isFirebaseConfigured } from './config';
