/**
 * server/config/firebase.ts
 * Firebase Admin SDK initialization — single instance, imported everywhere.
 */
import { App } from 'firebase-admin/app';
import { Auth } from 'firebase-admin/auth';
import { Storage } from 'firebase-admin/storage';
declare let app: App;
export declare const firebaseAuth: Auth;
export declare const firebaseStorage: Storage;
export default app;
//# sourceMappingURL=firebase.d.ts.map