"use strict";
/**
 * server/config/firebase.ts
 * Firebase Admin SDK initialization — single instance, imported everywhere.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.firebaseStorage = exports.firebaseAuth = void 0;
const app_1 = require("firebase-admin/app");
const auth_1 = require("firebase-admin/auth");
const storage_1 = require("firebase-admin/storage");
let app;
function initFirebase() {
    if ((0, app_1.getApps)().length > 0)
        return (0, app_1.getApps)()[0];
    const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    if (!serviceAccountJson) {
        throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON environment variable is not set.');
    }
    const serviceAccount = JSON.parse(serviceAccountJson);
    return (0, app_1.initializeApp)({
        credential: (0, app_1.cert)(serviceAccount),
        storageBucket: `${serviceAccount.project_id}.appspot.com`,
    });
}
app = initFirebase();
exports.firebaseAuth = (0, auth_1.getAuth)(app);
exports.firebaseStorage = (0, storage_1.getStorage)(app);
exports.default = app;
//# sourceMappingURL=firebase.js.map