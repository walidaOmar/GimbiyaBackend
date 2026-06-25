/**
 * server/types/schemas.ts
 * Zod validation schemas — the symbolic boundary between frontend input and backend logic.
 * Every tRPC procedure input MUST reference one of these schemas.
 */
import { z } from 'zod';
import { UserRole, NigerianState, InventoryReason } from './index';
export declare const MongoIdSchema: z.ZodString;
export declare const KoboAmountSchema: z.ZodNumber;
export declare const NigerianPhoneSchema: z.ZodString;
export declare const RegisterUserSchema: z.ZodObject<{
    name: z.ZodString;
    email: z.ZodString;
    phone: z.ZodString;
    role: z.ZodDefault<z.ZodNativeEnum<typeof UserRole>>;
    assignedState: z.ZodNativeEnum<typeof NigerianState>;
    firebaseUid: z.ZodString;
}, "strip", z.ZodTypeAny, {
    name: string;
    email: string;
    firebaseUid: string;
    role: UserRole;
    assignedState: NigerianState;
    phone: string;
}, {
    name: string;
    email: string;
    firebaseUid: string;
    assignedState: NigerianState;
    phone: string;
    role?: UserRole | undefined;
}>;
export declare const CreateProductSchema: z.ZodObject<{
    name: z.ZodString;
    descriptionText: z.ZodOptional<z.ZodString>;
    priceKobo: z.ZodNumber;
    initialStock: z.ZodNumber;
    categorySlug: z.ZodString;
    assignedState: any;
    buildingFloor: z.ZodEnum<["LEVEL_1", "LEVEL_2"]>;
    imageUrls: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
}, "strip", z.ZodTypeAny, {
    [x: string]: any;
    name?: unknown;
    descriptionText?: unknown;
    priceKobo?: unknown;
    initialStock?: unknown;
    categorySlug?: unknown;
    assignedState?: unknown;
    buildingFloor?: unknown;
    imageUrls?: unknown;
}, {
    [x: string]: any;
    name?: unknown;
    descriptionText?: unknown;
    priceKobo?: unknown;
    initialStock?: unknown;
    categorySlug?: unknown;
    assignedState?: unknown;
    buildingFloor?: unknown;
    imageUrls?: unknown;
}>;
export declare const UpdateProductPriceSchema: z.ZodObject<{
    productId: z.ZodString;
    priceKobo: z.ZodNumber;
    reasonNote: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    priceKobo: number;
    productId: string;
    reasonNote?: string | undefined;
}, {
    priceKobo: number;
    productId: string;
    reasonNote?: string | undefined;
}>;
export declare const CartItemSchema: z.ZodObject<{
    productId: z.ZodString;
    quantity: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    productId: string;
    quantity: number;
}, {
    productId: string;
    quantity: number;
}>;
export declare const CheckoutSchema: z.ZodObject<{
    cartItems: z.ZodArray<z.ZodObject<{
        productId: z.ZodString;
        quantity: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        productId: string;
        quantity: number;
    }, {
        productId: string;
        quantity: number;
    }>, "many">;
    shippingAddress: z.ZodString;
    buyerPhone: z.ZodString;
    paymentMethod: z.ZodDefault<z.ZodEnum<["CARD", "ACCOUNT_TRANSFER", "USSD"]>>;
}, "strip", z.ZodTypeAny, {
    shippingAddress: string;
    cartItems: {
        productId: string;
        quantity: number;
    }[];
    buyerPhone: string;
    paymentMethod: "CARD" | "ACCOUNT_TRANSFER" | "USSD";
}, {
    shippingAddress: string;
    cartItems: {
        productId: string;
        quantity: number;
    }[];
    buyerPhone: string;
    paymentMethod?: "CARD" | "ACCOUNT_TRANSFER" | "USSD" | undefined;
}>;
export declare const InventoryAdjustSchema: z.ZodObject<{
    productId: z.ZodString;
    deltaCount: z.ZodEffects<z.ZodNumber, number, number>;
    reasonCode: z.ZodNativeEnum<typeof InventoryReason>;
    noteText: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    productId: string;
    deltaCount: number;
    reasonCode: InventoryReason;
    noteText?: string | undefined;
}, {
    productId: string;
    deltaCount: number;
    reasonCode: InventoryReason;
    noteText?: string | undefined;
}>;
export declare const InboundManifestSchema: z.ZodObject<{
    supplierId: z.ZodString;
    items: z.ZodArray<z.ZodObject<{
        productId: z.ZodString;
        quantity: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        productId: string;
        quantity: number;
    }, {
        productId: string;
        quantity: number;
    }>, "many">;
    invoiceRef: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    items: {
        productId: string;
        quantity: number;
    }[];
    supplierId: string;
    invoiceRef?: string | undefined;
}, {
    items: {
        productId: string;
        quantity: number;
    }[];
    supplierId: string;
    invoiceRef?: string | undefined;
}>;
export declare const OtpHandoverSchema: z.ZodObject<{
    orderId: z.ZodString;
    submittedOtp: z.ZodString;
    signatureBase64: z.ZodString;
}, "strip", z.ZodTypeAny, {
    orderId: string;
    submittedOtp: string;
    signatureBase64: string;
}, {
    orderId: string;
    submittedOtp: string;
    signatureBase64: string;
}>;
export declare const UpdateLocationSchema: z.ZodObject<{
    orderId: z.ZodString;
    lat: z.ZodNumber;
    lng: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    orderId: string;
    lat: number;
    lng: number;
}, {
    orderId: string;
    lat: number;
    lng: number;
}>;
export declare const KycAdjudicationSchema: z.ZodEffects<z.ZodObject<{
    targetUserId: z.ZodString;
    action: z.ZodEnum<["APPROVE", "REJECT"]>;
    rejectionReason: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    targetUserId: string;
    action: "APPROVE" | "REJECT";
    rejectionReason?: string | undefined;
}, {
    targetUserId: string;
    action: "APPROVE" | "REJECT";
    rejectionReason?: string | undefined;
}>, {
    targetUserId: string;
    action: "APPROVE" | "REJECT";
    rejectionReason?: string | undefined;
}, {
    targetUserId: string;
    action: "APPROVE" | "REJECT";
    rejectionReason?: string | undefined;
}>;
export declare const PaginationSchema: z.ZodObject<{
    page: z.ZodDefault<z.ZodNumber>;
    limit: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    limit: number;
    page: number;
}, {
    limit?: number | undefined;
    page?: number | undefined;
}>;
export declare const CatalogQuerySchema: z.ZodObject<{
    assignedState: any;
    buildingFloor: z.ZodOptional<z.ZodEnum<["LEVEL_1", "LEVEL_2"]>>;
    categorySlug: z.ZodOptional<z.ZodString>;
    searchQuery: z.ZodOptional<z.ZodString>;
    minPriceKobo: z.ZodOptional<z.ZodNumber>;
    maxPriceKobo: z.ZodOptional<z.ZodNumber>;
} & {
    page: z.ZodDefault<z.ZodNumber>;
    limit: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    [x: string]: any;
    assignedState?: unknown;
    buildingFloor?: unknown;
    categorySlug?: unknown;
    searchQuery?: unknown;
    minPriceKobo?: unknown;
    maxPriceKobo?: unknown;
    page?: unknown;
    limit?: unknown;
}, {
    [x: string]: any;
    assignedState?: unknown;
    buildingFloor?: unknown;
    categorySlug?: unknown;
    searchQuery?: unknown;
    minPriceKobo?: unknown;
    maxPriceKobo?: unknown;
    page?: unknown;
    limit?: unknown;
}>;
export declare const DateRangeSchema: z.ZodObject<{
    from: z.ZodOptional<z.ZodString>;
    to: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    from?: string | undefined;
    to?: string | undefined;
}, {
    from?: string | undefined;
    to?: string | undefined;
}>;
//# sourceMappingURL=schemas.d.ts.map