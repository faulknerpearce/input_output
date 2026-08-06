import {
  lookupOpenFoodFactsProduct,
  normalizeBarcode,
} from '@input_output/shared'
import type { Plugin } from 'vite'

/** Mirrors the Cloudflare Pages `/api/product/:barcode` handler during `vite dev`. */
export function productLookupPlugin(): Plugin {
  return {
    name: 'product-lookup-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const match = req.url?.match(/^\/api\/product\/([^/?]+)/)
        if (!match || req.method !== 'GET') {
          next()
          return
        }

        const barcode = normalizeBarcode(decodeURIComponent(match[1]))
        if (!barcode) {
          res.statusCode = 400
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ error: 'Invalid barcode' }))
          return
        }

        const result = await lookupOpenFoodFactsProduct(barcode)
        res.setHeader('Content-Type', 'application/json')

        if (!result.ok) {
          res.statusCode = 502
          res.end(JSON.stringify({ error: 'Product lookup failed' }))
          return
        }

        if (!result.found) {
          res.statusCode = 404
          res.end(JSON.stringify({ found: false }))
          return
        }

        res.statusCode = 200
        res.setHeader('Cache-Control', 'public, max-age=3600')
        res.end(JSON.stringify({ found: true, product: result.product }))
      })
    },
  }
}