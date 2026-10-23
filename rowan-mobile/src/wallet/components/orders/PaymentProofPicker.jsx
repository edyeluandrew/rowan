import { useRef, useState } from 'react'
import { Camera as CapCamera, CameraResultType, CameraSource } from '@capacitor/camera'
import { Camera, ImagePlus, X } from 'lucide-react'

function fileFromBase64(base64, fileName, ext) {
  const byteChars = atob(base64)
  const bytes = new Uint8Array(byteChars.length)
  for (let i = 0; i < byteChars.length; i += 1) bytes[i] = byteChars.charCodeAt(i)
  const type = ext === 'png' ? 'image/png' : 'image/jpeg'
  return new File([bytes], fileName, { type })
}

export default function PaymentProofPicker({ preview, onFile }) {
  const galleryRef = useRef(null)
  const [busy, setBusy] = useState(false)

  const fromCamera = async (source) => {
    if (busy) return
    setBusy(true)
    try {
      const photo = await CapCamera.getPhoto({
        quality: 80,
        allowEditing: false,
        resultType: CameraResultType.Base64,
        source,
      })
      const ext = photo.format === 'png' ? 'png' : 'jpeg'
      onFile(fileFromBase64(photo.base64String, `payment_${Date.now()}.${ext}`, ext))
    } catch (err) {
      const cancelled = /cancel|dismiss/i.test(err?.message || '')
      if (!cancelled && source === CameraSource.Photos) galleryRef.current?.click()
    } finally {
      setBusy(false)
    }
  }

  const fromFile = (event) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (file) onFile(file)
  }

  return (
    <div>
      <p className="text-rowan-text text-xs font-medium mb-2">Photo of the mobile money payment</p>
      <input ref={galleryRef} type="file" accept="image/*" className="hidden" onChange={fromFile} />
      {preview ? (
        <div className="relative">
          <img src={preview} alt="Payment photo" className="rounded-xl max-h-36 w-full object-cover border border-rowan-border" />
          <button
            type="button"
            onClick={() => onFile(null)}
            className="absolute top-2 right-2 bg-black/60 rounded-full p-1 text-white"
            aria-label="Remove photo"
          >
            <X size={16} />
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => fromCamera(CameraSource.Camera)}
            className="border border-dashed border-rowan-border rounded-xl py-4 flex flex-col items-center gap-2 text-rowan-text disabled:opacity-60"
          >
            <Camera size={20} className="text-rowan-yellow" />
            <span className="text-xs font-medium">Take photo</span>
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => fromCamera(CameraSource.Photos)}
            className="border border-dashed border-rowan-border rounded-xl py-4 flex flex-col items-center gap-2 text-rowan-text disabled:opacity-60"
          >
            <ImagePlus size={20} className="text-rowan-yellow" />
            <span className="text-xs font-medium">Upload screenshot</span>
          </button>
        </div>
      )}
    </div>
  )
}
