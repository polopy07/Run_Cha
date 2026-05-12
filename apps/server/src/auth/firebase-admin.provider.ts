import * as admin from 'firebase-admin';
import * as serviceAccount from '../../firebase-service-key.json';

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount as admin.ServiceAccount),
  });
}

export const firebaseAdmin = admin;