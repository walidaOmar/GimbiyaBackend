/**
 * server/models/CartItem.ts
 */
import { Schema, model, Document, Types } from 'mongoose';

export interface ICartItem extends Document {
  userId:    Types.ObjectId;
  productId: Types.ObjectId;
  quantity:  number;
  createdAt: Date;
  updatedAt: Date;
}

const CartItemSchema = new Schema<ICartItem>(
  {
    userId:    { type: Schema.Types.ObjectId, ref: 'User', required: true },
    productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    quantity:  { type: Number, required: true, min: 1 },
  },
  { timestamps: true }
);

// Composite index: one entry per user per product
CartItemSchema.index({ userId: 1, productId: 1 }, { unique: true });

export const CartItem = model<ICartItem>('CartItem', CartItemSchema);


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

const CategorySchema = new Schema<ICategory>(
  {
    name:        { type: String, required: true, trim: true },
    slug:        { type: String, required: true, unique: true, lowercase: true, index: true },
    description: { type: String, default: '' },
    imageUrl:    { type: String, default: '' },
    isActive:    { type: Boolean, default: true },
  },
  { timestamps: true }
);

export const Category = model<ICategory>('Category', CategorySchema);
