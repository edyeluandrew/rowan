import { useRef } from 'react'
import { Camera, ImagePlus, X } from 'lucide-react'

export default function PaymentProofPicker({ preview, onFile }) {
  const cameraRef = useRef(null)
  const galleryRef = useRef(null)

  const pick = (event) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (file) onFile(file)
  }

  return (
    <div>
      <p className="text-rowan-text text-xs font-medium mb-2">Photo of the payment</p>
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={pick} />
      <input ref={galleryRef} type="file" accept="image/*" className="hidden" onChange={pick} />
      {preview ? (
        <div className="relative">
          <img src={preview} alt="Payment photo" className="rounded-xl max-h-44 w-full object-cover border border-rowan-border" />
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
            onClick={() => cameraRef.current?.click()}
            className="border border-dashed border-rowan-border rounded-xl py-5 flex flex-col items-center gap-2 text-rowan-text"
          >
            <Camera size={20} className="text-rowan-yellow" />
            <span className="text-xs font-medium">Take photo</span>
          </button>
          <button
            type="button"
            onClick={() => galleryRef.current?.click()}
            className="border border-dashed border-rowan-border rounded-xl py-5 flex flex-col items-center gap-2 text-rowan-text"
          >
            <ImagePlus size={20} className="text-rowan-yellow" />
            <span className="text-xs font-medium">Upload screenshot</span>
          </button>
        </div>
      )}
    </div>
  )
}
