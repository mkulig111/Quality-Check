
import {genkit, GenkitError} from 'genkit';
import {googleAI} from '@genkit-ai/googleai';
import {initializeApp, getApps, App, ServiceAccount, cert} from 'firebase-admin/app';
import {getFirestore} from 'firebase-admin/firestore';
import {getStorage} from 'firebase-admin/storage';
import {getAuth} from 'firebase-admin/auth';
import * as fs from 'fs';
import * as path from 'path';

let adminApp: App;

if (!getApps().length) {
  const serviceAccountPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;

  if (!serviceAccountPath) {
    throw new GenkitError({
      status: 'INVALID_ARGUMENT',
      message: 'GOOGLE_APPLICATION_CREDENTIALS environment variable not set. Please point it to your service account key file.',
    });
  }

  if (!fs.existsSync(serviceAccountPath)) {
      throw new GenkitError({
          status: 'NOT_FOUND',
          message: `Service account key file not found at path: ${serviceAccountPath}. Please check the path in your .env file.`,
      });
  }
  
  const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));

  adminApp = initializeApp({
    credential: cert(serviceAccount),
    storageBucket: 'qualitycheck-42z32.firebasestorage.app'
  });
} else {
  adminApp = getApps()[0];
}

export const adminFirestore = getFirestore(adminApp);
export const adminStorage = getStorage(adminApp);
export const adminAuth = getAuth(adminApp);

export const ai = genkit({
  plugins: [googleAI()],
  model: 'googleai/gemini-2.0-flash',
});
