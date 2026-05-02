import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export interface CartItem {
  productId: string;
  variantId: string;
  productName: string;
  variantLabel: string;
  qty: number;
  unitPrice: number;
  lineTotal: number;
  hsnCode?: string;
}

export interface CouponData {
  code: string;
  type: 'PERCENT' | 'FLAT';
  value: number;
  minOrder?: number;
}

interface CartContextType {
  items: CartItem[];
  addItem: (item: Omit<CartItem, 'lineTotal'>) => void;
  removeItem: (productId: string, variantId: string) => void;
  updateQty: (productId: string, variantId: string, qty: number) => void;
  clearCart: () => void;
  loadHeldBill: (payload: { items: Omit<CartItem, 'lineTotal'>[]; customer?: any | null; coupon?: CouponData | null }) => void;
  subtotal: number;
  gst: number;
  discount: number;
  total: number;
  coupon: CouponData | null;
  applyCoupon: (coupon: CouponData | null) => void;
  customer: any | null;
  setCustomer: (customer: any | null) => void;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export const CartProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [items, setItems] = useState<CartItem[]>([]);
  const [coupon, setCoupon] = useState<CouponData | null>(null);
  const [customer, setCustomer] = useState<any | null>(null);

  const addItem = (newItem: Omit<CartItem, 'lineTotal'>) => {
    setItems(prev => {
      const existing = prev.find(i => i.productId === newItem.productId && i.variantId === newItem.variantId);
      if (existing) {
        return prev.map(i => 
          (i.productId === newItem.productId && i.variantId === newItem.variantId)
            ? { ...i, qty: i.qty + newItem.qty, lineTotal: (i.qty + newItem.qty) * i.unitPrice }
            : i
        );
      }
      return [...prev, { ...newItem, lineTotal: newItem.qty * newItem.unitPrice }];
    });
  };

  const removeItem = (productId: string, variantId: string) => {
    setItems(prev => prev.filter(i => !(i.productId === productId && i.variantId === variantId)));
  };

  const updateQty = (productId: string, variantId: string, qty: number) => {
    if (qty <= 0) {
      removeItem(productId, variantId);
      return;
    }
    setItems(prev => prev.map(i => 
      (i.productId === productId && i.variantId === variantId)
        ? { ...i, qty, lineTotal: qty * i.unitPrice }
        : i
    ));
  };

  const clearCart = () => {
    setItems([]);
    setCoupon(null);
    setCustomer(null);
  };

  const loadHeldBill: CartContextType['loadHeldBill'] = ({ items: newItems, customer: c, coupon: co }) => {
    setItems(newItems.map(i => ({ ...i, lineTotal: i.qty * i.unitPrice })));
    setCustomer(c ?? null);
    setCoupon(co ?? null);
  };

  const subtotal = items.reduce((sum, item) => sum + item.lineTotal, 0);
  
  let discount = 0;
  if (coupon) {
    if (coupon.type === 'PERCENT') {
      discount = (subtotal * coupon.value) / 100;
    } else {
      discount = coupon.value;
    }
  }

  const taxableAmount = subtotal - discount;
  const gst = taxableAmount * 0.18;
  const total = taxableAmount + gst;

  return (
    <CartContext.Provider value={{ 
      items, addItem, removeItem, updateQty, clearCart, loadHeldBill,
      subtotal, gst, discount, total, 
      coupon, applyCoupon: setCoupon,
      customer, setCustomer
    }}>
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) throw new Error('useCart must be used within CartProvider');
  return context;
};
