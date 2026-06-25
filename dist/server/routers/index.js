"use strict";
/**
 * server/routers/index.ts
 * Root application router — merges all domain routers into the single tRPC tree.
 * The AppRouter type is exported for use by the frontend tRPC client.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.appRouter = void 0;
const auth_1 = require("../middleware/auth");
const buyer_1 = require("./buyer");
const ceo_1 = require("./ceo");
const merchant_1 = require("./merchant");
const stock_1 = require("./stock");
const delivery_1 = require("./delivery");
exports.appRouter = (0, auth_1.router)({
    buyer: buyer_1.buyerRouter,
    ceo: ceo_1.ceoRouter,
    merchant: merchant_1.merchantRouter,
    stock: stock_1.stockRouter,
    delivery: delivery_1.deliveryRouter,
});
//# sourceMappingURL=index.js.map