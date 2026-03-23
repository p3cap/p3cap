const { getApps, initializeApp, applicationDefault, cert } = require("firebase-admin/app");

function getFirebaseApp() {
  if (getApps().length > 0) {
    return getApps()[0];
  }

  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.GCLOUD_PROJECT;

  if (serviceAccountJson) {
    const serviceAccount = JSON.parse(serviceAccountJson);
    return initializeApp({
      credential: cert(serviceAccount),
      projectId: serviceAccount.project_id || projectId
    });
  }

  return initializeApp({
    credential: applicationDefault(),
    projectId
  });
}

module.exports = {
  getFirebaseApp
};
