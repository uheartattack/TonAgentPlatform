/**
 * Bitrefill Service — search, browse, and purchase gift cards, eSIMs, mobile top-ups
 * Uses @bitrefill/cli under the hood
 * Payment: USDC on Base, Lightning, or Bitrefill balance
 */

import { execSync } from 'child_process';

const BITREFILL_TIMEOUT = 30_000;

interface BitrefillProduct {
  id: string;
  name: string;
  country: string;
  type: string;
  currency: string;
  category?: string;
  cashback?: number;
}

interface BitrefillPackage {
  value: string;
  price?: number;
  currency?: string;
}

interface BitrefillInvoice {
  invoiceId: string;
  status: string;
  paymentLink?: string;
  lightningInvoice?: string;
  x402PaymentUrl?: string;
  redemptionInfo?: any;
}

function runBitrefill(args: string): any {
  try {
    const result = execSync(`bitrefill ${args} --output json 2>/dev/null`, {
      encoding: 'utf8',
      timeout: BITREFILL_TIMEOUT,
      env: { ...process.env, BITREFILL_API_KEY: process.env.BITREFILL_API_KEY || '' },
    });
    return JSON.parse(result.trim());
  } catch (e: any) {
    // Try parsing stderr/stdout for JSON
    const output = e.stdout || e.stderr || '';
    try { return JSON.parse(output.trim()); } catch {}
    throw new Error(`Bitrefill CLI error: ${(e.message || '').slice(0, 200)}`);
  }
}

/**
 * Search products on Bitrefill
 */
export async function searchProducts(query: string, country = 'US', type?: string): Promise<BitrefillProduct[]> {
  const typeArg = type ? ` --product_type ${type}` : '';
  const data = runBitrefill(`search-products --query "${query.replace(/"/g, '')}" --country ${country.toUpperCase()}${typeArg}`);
  if (!data?.products) return [];
  return data.products.slice(0, 20).map((p: any) => ({
    id: p.id || p.slug,
    name: p.name,
    country: p.country,
    type: p.type,
    currency: p.currency,
    category: p.category,
    cashback: p.cashback_percentage,
  }));
}

/**
 * Get product details with available denominations
 */
export async function getProductDetails(productId: string): Promise<{ product: any; packages: BitrefillPackage[] }> {
  const data = runBitrefill(`get-product-details --product_id "${productId.replace(/"/g, '')}"`);
  const packages = (data?.packages || []).map((p: any) => {
    // Extract value after <&> separator if present
    const rawValue = p.package_value || p.value || '';
    const value = rawValue.includes('<&>') ? rawValue.split('<&>')[1] : rawValue;
    return { value, price: p.price, currency: p.currency };
  });
  return {
    product: {
      id: data?.id || productId,
      name: data?.name,
      country: data?.country,
      currency: data?.currency,
      description: data?.description?.slice(0, 200),
      redemptionInstructions: data?.redemption_instructions?.slice(0, 200),
    },
    packages,
  };
}

/**
 * Purchase a product
 * Returns invoice with payment link/lightning invoice
 */
export async function buyProduct(
  productId: string,
  packageValue: string,
  paymentMethod: 'usdc_base' | 'lightning' | 'balance' = 'lightning',
  quantity = 1,
): Promise<BitrefillInvoice> {
  const cartItem = JSON.stringify([{
    product_id: productId,
    package_value: packageValue,
    quantity,
  }]);
  const data = runBitrefill(
    `buy-products --cart_items '${cartItem}' --payment_method ${paymentMethod} --return_payment_link true`
  );
  return {
    invoiceId: data?.invoice_id || data?.id,
    status: data?.status || 'created',
    paymentLink: data?.payment_link,
    lightningInvoice: data?.lightningInvoice,
    x402PaymentUrl: data?.x402_payment_url,
  };
}

/**
 * Check invoice status
 */
export async function getInvoice(invoiceId: string): Promise<BitrefillInvoice> {
  const data = runBitrefill(`get-invoice-by-id --invoice_id "${invoiceId}"`);
  return {
    invoiceId: data?.id || invoiceId,
    status: data?.status,
    paymentLink: data?.payment_link,
    redemptionInfo: data?.redemption_info,
  };
}

/**
 * List recent orders
 */
export async function listOrders(limit = 5): Promise<any[]> {
  const data = runBitrefill(`list-orders --include_redemption_info true`);
  return (data?.orders || []).slice(0, limit);
}

/**
 * Get available categories for a country
 */
export async function getCategories(country = 'US'): Promise<string[]> {
  const data = runBitrefill(`search-products --query "*" --country ${country.toUpperCase()}`);
  return (data?.categories || []).map((c: any) => c.slug || c.name);
}
