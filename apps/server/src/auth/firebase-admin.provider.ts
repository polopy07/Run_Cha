import * as admin from 'firebase-admin';
import * as fs from 'node:fs';
import * as path from 'node:path';

function initializeFirebaseAdmin() {
  if (admin.apps.length) {
    return admin;
  }

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (projectId && clientEmail && privateKey) {
    admin.initializeApp({
      credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
    });
    return admin;
  }

  const serviceAccountPath =
    process.env.FIREBASE_SERVICE_ACCOUNT_PATH ??
    path.join(process.cwd(), 'firebase-service-key.json');

  if (!fs.existsSync(serviceAccountPath)) {
    throw new Error(
      `Firebase credentials not found. Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY env vars or provide ${serviceAccountPath}`,
    );
  }

  const serviceAccount = JSON.parse(
    fs.readFileSync(serviceAccountPath, 'utf8'),
  ) as admin.ServiceAccount;

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });

  return admin;
}

export function getFirebaseAdmin() {
  return initializeFirebaseAdmin();
}
