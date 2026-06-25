/**
 * server/routers/index.ts
 * Root application router — merges all domain routers into the single tRPC tree.
 * The AppRouter type is exported for use by the frontend tRPC client.
 */

import { router } from '../middleware/auth';
import { buyerRouter }    from './buyer';
import { ceoRouter }      from './ceo';
import { merchantRouter } from './merchant';
import { stockRouter }    from './stock';
import { deliveryRouter } from './delivery';

export const appRouter = router({
  buyer:    buyerRouter,
  ceo:      ceoRouter,
  merchant: merchantRouter,
  stock:    stockRouter,
  delivery: deliveryRouter,
});

// Export the AppRouter TYPE only — used by the frontend for full type inference.
// No runtime code is imported into the frontend; only the type shape.
export type AppRouter = typeof appRouter;
