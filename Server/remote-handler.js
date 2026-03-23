const { getFirestore } = require("firebase-admin/firestore");
const { createRequestHandler } = require("./app");
const { createFirestoreStateStore } = require("./state-store");
const { getFirebaseApp } = require("./firebase-admin");

const stateStore = createFirestoreStateStore({
  db: getFirestore(getFirebaseApp()),
  collectionName: process.env.STATE_COLLECTION || "readmeCookie",
  documentId: process.env.STATE_DOCUMENT || "state"
});

const remoteHandler = createRequestHandler({
  stateStore,
  defaultRedirectUrl: process.env.README_REDIRECT_URL || ""
});

module.exports = {
  remoteHandler
};
