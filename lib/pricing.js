/**
 * Shared pricing logic for the B2B portal to ensure consistency 
 * between Cart and Payment pages.
 */

export const getBaseTryPrice = (p, globalMargin, globalUsdActive, globalUsdRate, rates) => {
    let initialPrice = Number(p.list_price) || 0;
    let rawCost = initialPrice / 1.36;
    let price = rawCost * (1 + (globalMargin / 100));

    if (globalUsdActive && globalUsdRate !== null && globalUsdRate >= 0 && p.currency === 'USD') {
        price = price * globalUsdRate;
    } else {
        if (p.currency === 'USD') price = price * (rates?.USD || 1);
        else if (p.currency === 'EUR') price = price * (rates?.EUR || 1);
    }
    return price;
};

export const getDiscountedPrice = (p, base, discountPercent) => {
    const prodDiscount = Number(p.discount_rate || 0);
    const groupDiscount = discountPercent || 0;

    const afterProd = base * (1 - prodDiscount / 100);
    const afterGroup = afterProd * (1 - groupDiscount / 100);
    return afterGroup;
};

export const calculateCartTotals = (cartItems, discountPercent, globalMargin, globalUsdActive, globalUsdRate, rates) => {
    const selectedItems = Array.isArray(cartItems) 
        ? cartItems 
        : Object.values(cartItems).filter(item => !item.unselected);

    const subtotal = selectedItems.reduce((acc, i) => {
        const base = getBaseTryPrice(i.product, globalMargin, globalUsdActive, globalUsdRate, rates);
        return acc + (base * i.qty);
    }, 0);

    const totalDiscount = selectedItems.reduce((acc, i) => {
        const base = getBaseTryPrice(i.product, globalMargin, globalUsdActive, globalUsdRate, rates);
        return acc + (base * (discountPercent / 100) * i.qty);
    }, 0);

    const totalAfterDiscount = subtotal - totalDiscount;
    const vat = totalAfterDiscount * 0.20;
    const grandTotal = Number((totalAfterDiscount + vat).toFixed(2));

    return {
        subtotal,
        totalDiscount,
        totalAfterDiscount,
        vat,
        grandTotal
    };
};
