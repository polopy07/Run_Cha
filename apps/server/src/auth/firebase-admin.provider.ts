import * as admin from 'firebase-admin';
import * as fs from 'node:fs';
import * as path from 'node:path';

if (!admin.apps.length) {
  const serviceAccountPath =
    process.env.FIREBASE_SERVICE_ACCOUNT_PATH ??
    path.join(process.cwd(), 'firebase-service-key.json');

  if (!fs.existsSync(serviceAccountPath)) {
    throw new Error(
      `Firebase service account file not found: ${serviceAccountPath}`,
    );
  }

  const serviceAccount = JSON.parse(
    fs.readFileSync(serviceAccountPath, 'utf8'),
  ) as admin.ServiceAccount;

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

export const firebaseAdmin = admin;
