import * as admin from 'firebase-admin';
import * as fs from 'node:fs';
import * as path from 'node:path';

function getServiceAccountFromEnv(): admin.ServiceAccount | null {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;

  const hasAnyEnv = projectId || clientEmail || privateKey;
  const hasAllEnv = projectId && clientEmail && privateKey;

  if (hasAnyEnv && !hasAllEnv) {
    throw new Error(
      'Firebase Admin env vars are incomplete. Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY together.',
    );
  }

  if (!hasAllEnv) {
    return null;
  }

  return {
    projectId,
    clientEmail,
    privateKey: privateKey.replace(/\\n/g, '\n'),
  };
}

function initializeFirebaseAdmin() {
  if (admin.apps.length) {
    return admin;
  }

  const envServiceAccount = getServiceAccountFromEnv();
  if (envServiceAccount) {
    admin.initializeApp({
      credential: admin.credential.cert(envServiceAccount),
    });

    console.log('[Firebase] initialized via env vars');
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
  console.log('[Firebase] initialized via JSON file');

  return admin;
}

export function getFirebaseAdmin() {
  return initializeFirebaseAdmin();
}
