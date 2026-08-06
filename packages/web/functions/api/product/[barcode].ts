/// <reference types="@cloudflare/workers-types" />

import { lookupOpenFoodFactsProduct, normalizeBarcodeParam } from '@input_output/shared'

export const onRequest: PagesFunction = async (context) => {
  const barcode = normalizeBarcodeParam(context.params.barcode)
  if (!barcode) {
    return Response.json({ error: 'Invalid barcode' }, { status: 400 })
  }

  const result = await lookupOpenFoodFactsProduct(barcode)

  if (!result.ok) {
    return Response.json({ error: 'Product lookup failed' }, { status: 502 })
  }

  if (!result.found) {
    return Response.json({ found: false }, { status: 404 })
  }

  return Response.json(
    { found: true, product: result.product },
    {
      headers: {
        'Cache-Control': 'public, max-age=3600',
      },
    },
  )
}
