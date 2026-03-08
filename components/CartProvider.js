'use client';

import { createContext, useContext, useState, useEffect } from 'react';

const CartContext = createContext(null);

export function CartProvider({ children }) {
    const [cartItems, setCartItems] = useState({});

    // Load cart from local storage on mount
    useEffect(() => {
        try {
            const saved = localStorage.getItem('b2b_cart');
            if (saved) {
                setCartItems(JSON.parse(saved));
            }
        } catch (e) {
            console.error('Failed to load cart:', e);
        }
    }, []);

    // Save cart to local storage whenever it changes
    useEffect(() => {
        try {
            localStorage.setItem('b2b_cart', JSON.stringify(cartItems));
        } catch (e) {
            console.error('Failed to save cart:', e);
        }
    }, [cartItems]);

    // Add 1 or update specific quantity
    const setQty = (productId, productData, count) => {
        setCartItems(prev => {
            const current = prev[productId] || { product: productData, qty: 0 };
            const newQty = Math.max(0, count);

            if (newQty === 0) {
                const copy = { ...prev };
                delete copy[productId];
                return copy;
            }

            return {
                ...prev,
                [productId]: { product: productData, qty: newQty }
            };
        });
    };

    const addToCart = (product) => {
        setCartItems(prev => {
            const currentQty = prev[product.id]?.qty || 0;
            return {
                ...prev,
                [product.id]: { product, qty: currentQty + 1 }
            };
        });
    };

    const removeItem = (productId) => {
        setCartItems(prev => {
            const copy = { ...prev };
            delete copy[productId];
            return copy;
        });
    };

    const clearCart = () => {
        setCartItems({});
    };

    return (
        <CartContext.Provider value={{
            cartItems,
            setCartItems,
            setQty,
            addToCart,
            removeItem,
            clearCart,
            totalItems: Object.values(cartItems).reduce((acc, item) => acc + item.qty, 0)
        }}>
            {children}
        </CartContext.Provider>
    );
}

export function useCart() {
    const ctx = useContext(CartContext);
    if (!ctx) {
        return {
            cartItems: {},
            setCartItems: () => { },
            setQty: () => { },
            addToCart: () => { },
            removeItem: () => { },
            clearCart: () => { },
            totalItems: 0,
        };
    }
    return ctx;
}
