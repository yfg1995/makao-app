import AsyncStorage from '@react-native-async-storage/async-storage';
import { initializeApp } from 'firebase/app';
import { getAuth, initializeAuth } from 'firebase/auth';
import * as FirebaseAuth from 'firebase/auth';

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY || 'OVDE API KEY',
  authDomain: 'card-rush-arena-makao.firebaseapp.com',
  projectId: 'card-rush-arena-makao',
  storageBucket: 'card-rush-arena-makao.firebasestorage.app',
  messagingSenderId: '800745763611',
  appId: '1:800745763611:web:cdd39583341d8723aed9be',
};

const globalScope = globalThis as typeof globalThis & {
  __cardRushFirebaseApp?: ReturnType<typeof initializeApp>;
  __cardRushFirebaseAuth?: ReturnType<typeof initializeAuth>;
};

export const firebaseApp = globalScope.__cardRushFirebaseApp ?? initializeApp(firebaseConfig);
globalScope.__cardRushFirebaseApp = firebaseApp;

const getReactNativePersistence = (FirebaseAuth as any).getReactNativePersistence as
  | ((storage: typeof AsyncStorage) => unknown)
  | undefined;

export const firebaseAuth = globalScope.__cardRushFirebaseAuth ?? (
  getReactNativePersistence
    ? initializeAuth(firebaseApp, { persistence: getReactNativePersistence(AsyncStorage) as any })
    : getAuth(firebaseApp)
);
globalScope.__cardRushFirebaseAuth = firebaseAuth;
