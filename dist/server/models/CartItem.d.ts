/**
 * server/models/CartItem.ts
 */
import { Document, Types } from 'mongoose';
export interface ICartItem extends Document {
    userId: Types.ObjectId;
    productId: Types.ObjectId;
    quantity: number;
    createdAt: Date;
    updatedAt: Date;
}
export declare const CartItem: import("mongoose").Model<ICartItem, {}, {}, {}, Document<unknown, {}, ICartItem, {}, {}> & ICartItem & Required<{
    _id: Types.ObjectId;
}> & {
    __v: number;
}, any>;
/**
 * server/models/Category.ts
 */
export interface ICategory extends Document {
    name: string;
    slug: string;
    description: string;
    imageUrl: string;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
}
export declare const Category: import("mongoose").Model<ICategory, {}, {}, {}, Document<unknown, {}, ICategory, {}, {}> & ICategory & Required<{
    _id: Types.ObjectId;
}> & {
    __v: number;
}, any>;
//# sourceMappingURL=CartItem.d.ts.map