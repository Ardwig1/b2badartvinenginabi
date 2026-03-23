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
    const setQty = (productId, productData, count, unselected = false) => {
        const newQty = Math.max(0, count);

        setCartItems(prev => {
            const current = prev[productId] || { product: productData, qty: 0 };

            if (newQty === 0) {
                const copy = { ...prev };
                delete copy[productId];
                return copy;
            }

            return {
                ...prev,
                [productId]: { product: productData, qty: newQty, unselected }
            };
        });

        // Log asynchronously outside of the state setter
        const currentQty = cartItems[productId]?.qty || 0;
        const cid = typeof window !== 'undefined' ? localStorage.getItem('b2b_company_id') : null;
        if (!cid) return; // don't log if company unknown
        if (newQty === 0) {
            fetch('/api/log-activity', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ company_id: cid, action_type: 'cart_remove', details: { id: productId, name: productData?.name, oem_no: productData?.oem_no } })
            }).catch(e => console.error(e));
        } else {
            fetch('/api/log-activity', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ company_id: cid, action_type: 'cart_update', details: { id: productId, name: productData?.name, oem_no: productData?.oem_no, prevQty: currentQty, newQty } })
            }).catch(e => console.error(e));
        }
    };

    const addToCart = (product) => {
        setCartItems(prev => {
            const currentQty = prev[product.id]?.qty || 0;
            return {
                ...prev,
                [product.id]: { product, qty: currentQty + 1, unselected: false }
            };
        });

        const cid = typeof window !== 'undefined' ? localStorage.getItem('b2b_company_id') : null;
        if (!cid) return;
        fetch('/api/log-activity', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ company_id: cid, action_type: 'cart_add', details: { id: product.id, name: product.name, oem_no: product.oem_no, qty: 1 } })
        }).catch(e => console.error(e));
    };

    const removeItem = (productId) => {
        const item = cartItems[productId];

        setCartItems(prev => {
            const copy = { ...prev };
            delete copy[productId];
            return copy;
        });

        // Log removal
        if (item) {
            const cid = typeof window !== 'undefined' ? localStorage.getItem('b2b_company_id') : null;
            if (cid) {
                fetch('/api/log-activity', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ company_id: cid, action_type: 'cart_remove', details: { id: productId, name: item.product?.name, oem_no: item.product?.oem_no } })
                }).catch(e => console.error(e));
            }
        }
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
