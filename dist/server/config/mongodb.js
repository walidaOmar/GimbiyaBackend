"use strict";
/**
 * server/config/mongodb.ts
 * Mongoose connection with retry logic and connection event logging.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.connectMongoDB = connectMongoDB;
const mongoose_1 = __importDefault(require("mongoose"));
const MAX_RETRIES = 5;
const RETRY_DELAY_MS = 3000;
async function connectWithRetry(uri, attempt = 1) {
    try {
        await mongoose_1.default.connect(uri, {
            serverSelectionTimeoutMS: 8000,
            socketTimeoutMS: 45000,
        });
        console.log('[MongoDB] Connected successfully to Atlas cluster.');
    }
    catch (err) {
        if (attempt >= MAX_RETRIES) {
            console.error(`[MongoDB] Failed after ${MAX_RETRIES} attempts. Exiting.`);
            process.exit(1);
        }
        console.warn(`[MongoDB] Connection attempt ${attempt} failed. Retrying in ${RETRY_DELAY_MS}ms...`);
        await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
        return connectWithRetry(uri, attempt + 1);
    }
}
async function connectMongoDB() {
    const uri = process.env.MONGODB_URI;
    if (!uri)
        throw new Error('MONGODB_URI environment variable is not set.');
    mongoose_1.default.connection.on('disconnected', () => {
        console.warn('[MongoDB] Disconnected. Attempting reconnect...');
    });
    mongoose_1.default.connection.on('reconnected', () => {
        console.log('[MongoDB] Reconnected successfully.');
    });
    await connectWithRetry(uri);
}
exports.default = mongoose_1.default;
//# sourceMappingURL=mongodb.js.map