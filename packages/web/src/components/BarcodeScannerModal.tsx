import { BrowserMultiFormatReader, type IScannerControls } from '@zxing/browser'
import { BarcodeFormat, DecodeHintType } from '@zxing/library'
import { normalizeBarcode } from '@input_output/shared'
import { useEffect, useRef, useState } from 'react'
import type { MappedBarcodeProduct } from '../lib/openFoodFacts'
import { lookupBarcodeProduct, ProductNotFoundError } from '../lib/openFoodFacts'
import { inputBase, labelBase } from '../lib/styles'
import Modal from './Modal'

interface BarcodeScannerModalProps {
  onProductFound: (product: MappedBarcodeProduct) => void
  onClose: () => void
}

function createBarcodeReader(): BrowserMultiFormatReader {
  const hints = new Map<DecodeHintType, BarcodeFormat[]>()
  hints.set(DecodeHintType.POSSIBLE_FORMATS, [
    BarcodeFormat.EAN_13,
    BarcodeFormat.EAN_8,
    BarcodeFormat.UPC_A,
    BarcodeFormat.UPC_E,
  ])
  return new BrowserMultiFormatReader(hints)
}

async function pickRearCameraId(): Promise<string | undefined> {
  const devices = await BrowserMultiFormatReader.listVideoInputDevices()
  if (devices.length === 0) return undefined

  const rear = devices.find((device) => /back|rear|environment/i.test(device.label))
  return rear?.deviceId ?? devices[devices.length - 1]?.deviceId
}

export default function BarcodeScannerModal({
  onProductFound,
  onClose,
}: BarcodeScannerModalProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const readerRef = useRef<BrowserMultiFormatReader | null>(null)
  const controlsRef = useRef<IScannerControls | null>(null)
  const sessionRef = useRef(0)
  const lookupInFlightRef = useRef(false)
  const lastScannedRef = useRef<string | null>(null)
  const onProductFoundRef = useRef(onProductFound)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [lookupError, setLookupError] = useState<string | null>(null)
  const [lookingUp, setLookingUp] = useState(false)
  const [manualBarcode, setManualBarcode] = useState('')

  useEffect(() => {
    onProductFoundRef.current = onProductFound
  })

  const stopCamera = () => {
    controlsRef.current?.stop()
    controlsRef.current = null
  }

  const runLookup = async (barcode: string) => {
    if (lookupInFlightRef.current) return
    lookupInFlightRef.current = true
    setLookingUp(true)
    setLookupError(null)
    stopCamera()

    try {
      const product = await lookupBarcodeProduct(barcode)
      onProductFoundRef.current(product)
    } catch (err) {
      if (err instanceof ProductNotFoundError) {
        setLookupError('Product not found. Try another barcode or add the entry manually.')
      } else {
        setLookupError(err instanceof Error ? err.message : 'Failed to look up product')
      }
      lookupInFlightRef.current = false
      setLookingUp(false)
      lastScannedRef.current = null
      sessionRef.current += 1
    }
  }

  const startCamera = async () => {
    const sessionId = sessionRef.current
    const video = videoRef.current
    if (!video) return

    const reader = readerRef.current ?? createBarcodeReader()
    readerRef.current = reader

    try {
      const deviceId = await pickRearCameraId()
      if (sessionId !== sessionRef.current) return

      const controls = await reader.decodeFromVideoDevice(deviceId, video, (result) => {
        if (sessionId !== sessionRef.current || lookupInFlightRef.current || !result) return

        const barcode = normalizeBarcode(result.getText())
        if (!barcode || lastScannedRef.current === barcode) return

        lastScannedRef.current = barcode
        void runLookup(barcode)
      })

      if (sessionId !== sessionRef.current) {
        controls.stop()
        return
      }

      controlsRef.current = controls
      setCameraError(null)
    } catch {
      if (sessionId !== sessionRef.current) return
      setCameraError('Camera access denied or unavailable. Enter the barcode manually below.')
    }
  }

  useEffect(() => {
    let cancelled = false
    const boot = window.setTimeout(() => {
      if (!cancelled) void startCamera()
    }, 50)

    return () => {
      cancelled = true
      window.clearTimeout(boot)
      sessionRef.current += 1
      stopCamera()
      window.setTimeout(() => {
        BrowserMultiFormatReader.releaseAllStreams()
      }, 200)
    }
    // Mount-only camera setup
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!lookupError || lookingUp) return
    const restart = window.setTimeout(() => {
      void startCamera()
    }, 300)
    return () => window.clearTimeout(restart)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lookupError, lookingUp])

  const handleManualLookup = () => {
    const barcode = normalizeBarcode(manualBarcode)
    if (!barcode) {
      setLookupError('Enter a valid barcode with 8–14 digits')
      return
    }
    lastScannedRef.current = barcode
    void runLookup(barcode)
  }

  return (
    <Modal titleId="barcode-scanner-title" onClose={onClose} size="wide">
      <h3
        id="barcode-scanner-title"
        style={{
          fontFamily: "'Space Grotesk','Inter',sans-serif",
          fontSize: 22,
          fontWeight: 600,
          margin: '0 0 4px 0',
        }}
      >
        Scan Barcode
      </h3>
      <p style={{ fontSize: 13, color: '#71717a', margin: '0 0 20px 0' }}>
        Point your camera at a food product barcode, or enter the number manually.
      </p>

      {lookupError && (
        <div
          role="alert"
          style={{
            marginBottom: 16,
            padding: '10px 14px',
            background: '#fee2e2',
            color: '#991b1b',
            borderRadius: 12,
            fontSize: 13,
          }}
        >
          {lookupError}
        </div>
      )}

      <div
        style={{
          position: 'relative',
          borderRadius: 20,
          overflow: 'hidden',
          background: '#18181b',
          aspectRatio: '4 / 3',
          marginBottom: 20,
        }}
      >
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            display: cameraError ? 'none' : 'block',
          }}
        />
        {cameraError && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              padding: 24,
              textAlign: 'center',
              color: '#a1a1aa',
              fontSize: 13,
            }}
          >
            {cameraError}
          </div>
        )}
        {lookingUp && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'rgba(0,0,0,0.55)',
              color: 'white',
              fontSize: 14,
              fontWeight: 500,
              gap: 10,
            }}
          >
            <i className="fa-solid fa-spinner fa-spin" aria-hidden="true" />
            Looking up product...
          </div>
        )}
      </div>

      <div style={{ marginBottom: 20 }}>
        <label htmlFor="manual-barcode" style={labelBase}>
          Barcode number
        </label>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            id="manual-barcode"
            type="text"
            inputMode="numeric"
            autoComplete="off"
            value={manualBarcode}
            onChange={(e) => setManualBarcode(e.target.value.replace(/\D/g, ''))}
            placeholder="e.g. 0036000291452"
            style={{ ...inputBase, flex: 1 }}
            disabled={lookingUp}
          />
          <button
            type="button"
            onClick={handleManualLookup}
            disabled={lookingUp || manualBarcode.trim().length < 8}
            style={{
              padding: '10px 16px',
              borderRadius: 12,
              border: '1px solid var(--zone-accent)',
              background: 'var(--zone-accent)',
              color: 'white',
              fontSize: 13,
              fontWeight: 500,
              cursor: lookingUp ? 'not-allowed' : 'pointer',
              opacity: lookingUp || manualBarcode.trim().length < 8 ? 0.6 : 1,
              flexShrink: 0,
            }}
          >
            Lookup
          </button>
        </div>
      </div>

      <button
        type="button"
        onClick={onClose}
        style={{
          width: '100%',
          padding: '10px 16px',
          borderRadius: 12,
          border: '1px solid #e4e4e7',
          background: 'white',
          color: '#52525b',
          fontSize: 13,
          fontWeight: 500,
          cursor: 'pointer',
        }}
      >
        Cancel
      </button>
    </Modal>
  )
}