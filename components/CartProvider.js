'use client';

import { createContext, useContext, useState, useEffect } from 'react';

const CartContext = createContext(null);

export function CartProvider({ children }) {
    const [cartItems, setCartItems] = useState({});
    const [isInitialLoad, setIsInitialLoad] = useState(true);

    // Fetch cart from DB on mount
    useEffect(() => {
        const loadCart = async () => {
            try {
                const res = await fetch('/api/user/cart');
                if (res.ok) {
                    const dbCart = await res.json();
                    if (dbCart && typeof dbCart === 'object' && !dbCart.error) {
                        setCartItems(dbCart);
                    }
                }
            } catch (e) {
                console.error('Failed to load cart from DB:', e);
            } finally {
                setIsInitialLoad(false);
            }
        };
        loadCart();
    }, []);

    const syncItemToDB = async (productId, quantity, unselected) => {
        try {
            await fetch('/api/user/cart', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ product_id: productId, quantity, unselected })
            });
        } catch (e) {
            console.error('Cart sync error:', e);
        }
    };

    const setQty = (productId, productData, count, unselected = false) => {
        const newQty = Math.max(0, count);
        setCartItems(prev => {
            const copy = { ...prev };
            if (newQty === 0) {
                delete copy[productId];
            } else {
                copy[productId] = { product: productData, qty: newQty, unselected };
            }
            return copy;
        });
        syncItemToDB(productId, newQty, unselected);
    };

    const addToCart = (product) => {
        setCartItems(prev => {
            const currentQty = prev[product.id]?.qty || 0;
            const newQty = currentQty + 1;
            syncItemToDB(product.id, newQty, false);
            return {
                ...prev,
                [product.id]: { product, qty: newQty, unselected: false }
            };
        });
    };

    const removeItem = (productId) => {
        setCartItems(prev => {
            const copy = { ...prev };
            delete copy[productId];
            return copy;
        });
        syncItemToDB(productId, 0, false);
    };

    const clearCart = () => {
        setCartItems({});
        fetch('/api/user/cart', { method: 'DELETE' }).catch(() => {});
    };

    return (
        <CartContext.Provider value={{
            cartItems,
            setQty,
            addToCart,
            removeItem,
            clearCart,
            totalItems: Object.values(cartItems).reduce((acc, item) => acc + (item?.qty || 0), 0)
        }}>
            {children}
        </CartContext.Provider>
    );
}

export function useCart() {
    const ctx = useContext(CartContext);
    if (!ctx) {
        return { cartItems: {}, setQty: () => {}, addToCart: () => {}, removeItem: () => {}, clearCart: () => {}, totalItems: 0 };
    }
    return ctx;
}
