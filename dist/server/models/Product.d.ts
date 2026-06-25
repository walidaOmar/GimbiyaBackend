/**
 * server/models/Product.ts
 * Product document with Kobo-denominated pricing.
 * Stock field is atomic-ready — only ever modified via $inc, never direct overwrite.
 */
import { Document, Types } from 'mongoose';
import { NigerianState } from '../types';
export interface IProduct extends Document {
    _id: Types.ObjectId;
    name: string;
    descriptionText: string;
    priceKobo: number;
    stock: number;
    categorySlug: string;
    merchantId: Types.ObjectId;
    assignedState: NigerianState;
    buildingFloor: 'LEVEL_1' | 'LEVEL_2';
    imageUrls: string[];
    isActive: boolean;
    soldCount: number;
    averageRating: number;
    reviewCount: number;
    createdAt: Date;
    updatedAt: Date;
}
export declare const Product: import("mongoose").Model<IProduct, {}, {}, {}, Document<unknown, {}, IProduct, {}, {}> & IProduct & Required<{
    _id: Types.ObjectId;
}> & {
    __v: number;
}, any>;
//# sourceMappingURL=Product.d.ts.map