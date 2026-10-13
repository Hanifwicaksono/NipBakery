import { initializeApp, getApps, getApp } from 'firebase/app'
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from 'firebase/app-check'
import { 
  initializeFirestore, 
  persistentLocalCache, 
  persistentMultipleTabManager
} from 'firebase/firestore'
import type { Firestore } from 'firebase/firestore'
import { 
  getAuth, 
  signInAnonymously, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged 
} from 'firebase/auth'
import type { Auth, User } from 'firebase/auth'
import { getStorage } from 'firebase/storage'
import type { FirebaseStorage } from 'firebase/storage'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
}

// Initialize Firebase
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp()
const appCheckSiteKey = import.meta.env.VITE_FIREBASE_APPCHECK_SITE_KEY

if (appCheckSiteKey) {
  // Localhost needs a registered debug token after App Check enforcement.
  if (import.meta.env.DEV) {
    (globalThis as Record<string, unknown>).FIREBASE_APPCHECK_DEBUG_TOKEN = true
  }

  initializeAppCheck(app, {
    provider: new ReCaptchaEnterpriseProvider(appCheckSiteKey),
    isTokenAutoRefreshEnabled: true,
  })
} else {
  console.warn('Firebase App Check is disabled: VITE_FIREBASE_APPCHECK_SITE_KEY is missing.')
}

// Initialize Firestore with persistent multi-tab local cache
const db: Firestore = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager(),
  }),
})

const auth: Auth = getAuth(app)
const storage: FirebaseStorage = getStorage(app)

// Provider setup
const googleProvider = new GoogleAuthProvider()
googleProvider.setCustomParameters({ prompt: 'select_account' })

// Helper function to sign in anonymously (Guest Mode)
export const signInAsGuest = async (): Promise<User> => {
  try {
    const userCredential = await signInAnonymously(auth)
    console.log('Signed in anonymously as:', userCredential.user.uid)
    return userCredential.user
  } catch (error) {
    console.error('Anonymous auth failed:', error)
    throw error;
  }
}

export { 
  app, 
  db, 
  auth, 
  storage, 
  googleProvider,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged
}
export default app

