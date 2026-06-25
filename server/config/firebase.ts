/**
 * server/config/firebase.ts
 * Firebase Admin SDK initialization — single instance, imported everywhere.
 */

import { initializeApp, getApps, cert, App } from 'firebase-admin/app';
import { getAuth, Auth } from 'firebase-admin/auth';
import { getStorage, Storage } from 'firebase-admin/storage';

let app: App;

function initFirebase(): App {
  if (getApps().length > 0) return getApps()[0];

  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!serviceAccountJson) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON environment variable is not set.');
  }

  const serviceAccount = JSON.parse(serviceAccountJson);

  return initializeApp({
    credential: cert(serviceAccount),
    storageBucket: `${serviceAccount.project_id}.appspot.com`,
  });
}

app = initFirebase();

export const firebaseAuth: Auth = getAuth(app);
export const firebaseStorage: Storage = getStorage(app);
export default app;
