/**
 * Shared pricing logic for the B2B portal to ensure consistency 
 * between Cart and Payment pages.
 */

export const getBaseTryPrice = (p, globalMargin, globalUsdActive, globalUsdRate, rates) => {
    // We use the list_price directly as it already includes the product's specific margin.
    // globalMargin now acts as an additional markup (e.g. for showroom mode).
    let initialPrice = Number(p.list_price) || 0;
    let price = initialPrice * (1 + (Number(globalMargin || 0) / 100));

    if (p.currency === 'USD') {
        // 1. Check if this specific product has a fixed USD rate
        if (p.fixed_usd_rate && Number(p.fixed_usd_rate) > 0) {
            price = price * Number(p.fixed_usd_rate);
        }
        // 2. Otherwise check if global USD fixing is active
        else if (globalUsdActive && globalUsdRate !== null && globalUsdRate >= 0) {
            price = price * globalUsdRate;
        }
        // 3. Fallback to live rate
        else {
            price = price * (rates?.USD || 1);
        }
    } else if (p.currency === 'EUR') {
        price = price * (rates?.EUR || 1);
    }
    
    return price;
};

export const getDiscountedPrice = (p, base, discountPercent, rates, priceGroup = null) => {
    // 1. Fixed Price check (highest priority)
    if (p.is_fixed_price && p.fixed_price_value > 0) {
        let price = Number(p.fixed_price_value);
        const cur = p.fixed_price_currency || 'TRY';
        if (cur === 'USD' && rates?.USD) price *= rates.USD;
        else if (cur === 'EUR' && rates?.EUR) price *= rates.EUR;
        return price / 1.20;
    }

    // 2. Determine Group Discount (Supplier-specific rule or fallback to general)
    let effectiveGroupDiscount = discountPercent || 0;
    if (priceGroup?.rules && p.supplier_brand) {
        const specificRule = priceGroup.rules[p.supplier_brand];
        if (specificRule !== undefined) {
            effectiveGroupDiscount = Number(specificRule);
        }
    }

    const prodDiscount = Number(p.discount_rate || 0);
    const afterProd = base * (1 - prodDiscount / 100);
    const afterGroup = afterProd * (1 - effectiveGroupDiscount / 100);
    return afterGroup;
};

export const calculateCartTotals = (cartItems, discountPercent, globalMargin, globalUsdActive, globalUsdRate, rates, priceGroup = null) => {
    const selectedItems = Array.isArray(cartItems) 
        ? cartItems 
        : Object.values(cartItems).filter(item => !item.unselected);

    const subtotal = selectedItems.reduce((acc, i) => {
        const base = getBaseTryPrice(i.product, globalMargin, globalUsdActive, globalUsdRate, rates);
        return acc + (base * i.qty);
    }, 0);

    const totalAfterDiscount = selectedItems.reduce((acc, i) => {
        const base = getBaseTryPrice(i.product, globalMargin, globalUsdActive, globalUsdRate, rates);
        const finalPrice = getDiscountedPrice(i.product, base, discountPercent, rates, priceGroup);
        return acc + (finalPrice * i.qty);
    }, 0);

    const totalDiscount = subtotal - totalAfterDiscount;
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
