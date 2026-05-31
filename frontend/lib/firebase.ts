import AsyncStorage from '@react-native-async-storage/async-storage';
import { initializeApp } from 'firebase/app';
import { getAuth, initializeAuth } from 'firebase/auth';
import * as FirebaseAuth from 'firebase/auth';

const firebaseApiKey = (
  process.env.EXPO_PUBLIC_FIREBASE_API_KEY ||
  process.env.FIREBASE_API_KEY ||
  process.env.NEXT_PUBLIC_FIREBASE_API_KEY ||
  ''
).trim();
const firebaseApiKeyMissing =
  !firebaseApiKey ||
  firebaseApiKey === 'OVDE API KEY' ||
  firebaseApiKey.toLowerCase().includes('replace_with');

const firebaseConfig = {
  apiKey: firebaseApiKey,
  authDomain: 'card-rush-arena-makao.firebaseapp.com',
  projectId: 'card-rush-arena-makao',
  storageBucket: 'card-rush-arena-makao.firebasestorage.app',
  messagingSenderId: '800745763611',
  appId: '1:800745763611:web:cdd39583341d8723aed9be',
};

export function assertFirebaseConfigured() {
  if (firebaseApiKeyMissing) {
    throw new Error('Firebase API key is missing. Set EXPO_PUBLIC_FIREBASE_API_KEY in Vercel and redeploy.');
  }
}

const globalScope = globalThis as typeof globalThis & {
  __cardRushFirebaseApp?: ReturnType<typeof initializeApp>;
  __cardRushFirebaseAuth?: ReturnType<typeof initializeAuth>;
};

const getReactNativePersistence = (FirebaseAuth as any).getReactNativePersistence as
  | ((storage: typeof AsyncStorage) => unknown)
  | undefined;

export function getFirebaseAuth() {
  assertFirebaseConfigured();

  const firebaseApp = globalScope.__cardRushFirebaseApp ?? initializeApp(firebaseConfig);
  globalScope.__cardRushFirebaseApp = firebaseApp;

  const firebaseAuth = globalScope.__cardRushFirebaseAuth ?? (
    getReactNativePersistence
      ? initializeAuth(firebaseApp, { persistence: getReactNativePersistence(AsyncStorage) as any })
      : getAuth(firebaseApp)
  );
  globalScope.__cardRushFirebaseAuth = firebaseAuth;
  return firebaseAuth;
}
