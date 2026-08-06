export const OFF_PRODUCT_FIELDS = [
  'product_name',
  'brands',
  'nutriments',
  'serving_size',
  'serving_quantity',
  'quantity',
] as const

/** Strip non-digits and normalize UPC-A (12) to EAN-13 (leading 0) for product lookup. */
export function normalizeBarcode(raw: string): string | null {
  const digits = raw.replace(/\D/g, '')
  if (!digits) return null

  let code = digits
  if (code.length === 12) {
    code = `0${code}`
  }

  if (code.length >= 8 && code.length <= 14) {
    return code
  }

  return null
}

export function normalizeBarcodeParam(raw: string | string[] | undefined): string | null {
  const barcode = Array.isArray(raw) ? raw[0] : raw
  if (!barcode) return null
  return normalizeBarcode(barcode)
}

export function buildOpenFoodFactsUrl(barcode: string): string {
  const fields = OFF_PRODUCT_FIELDS.join(',')
  return `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(barcode)}.json?fields=${fields}`
}

export type OpenFoodFactsLookupResult =
  | { ok: true; found: true; product: Record<string, unknown> }
  | { ok: true; found: false }
  | { ok: false; error: 'upstream_failed' | 'network_error' }

export async function lookupOpenFoodFactsProduct(
  barcode: string,
  fetchFn: typeof fetch = fetch,
): Promise<OpenFoodFactsLookupResult> {
  try {
    const response = await fetchFn(buildOpenFoodFactsUrl(barcode), {
      headers: {
        'User-Agent': 'InputOutput/1.0 (https://github.com/faulknerpearce/input_output)',
        Accept: 'application/json',
      },
    })

    if (!response.ok) {
      return { ok: false, error: 'upstream_failed' }
    }

    const data = (await response.json()) as {
      status?: number
      product?: Record<string, unknown>
    }

    if (data.status !== 1 || !data.product) {
      return { ok: true, found: false }
    }

    return { ok: true, found: true, product: data.product }
  } catch {
    return { ok: false, error: 'network_error' }
  }
}
