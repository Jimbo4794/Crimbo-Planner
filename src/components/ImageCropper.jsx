import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import './ImageCropper.css'

function ImageCropper({ imageFile, onCropComplete, onCancel }) {
  const [imageSrc, setImageSrc] = useState(null)
  const [cropPosition, setCropPosition] = useState({ x: 0, y: 0 })
  const [scale, setScale] = useState(1)
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const canvasRef = useRef(null)
  const imageRef = useRef(null)
  const containerRef = useRef(null)
  const cropCircleRef = useRef(null)
  const overlayRef = useRef(null)
  const containerElementRef = useRef(null)

  const CROP_SIZE = 200 // Size of the circular crop area

  useEffect(() => {
    if (imageFile) {
      const reader = new FileReader()
      reader.onload = (e) => {
        setImageSrc(e.target.result)
      }
      reader.readAsDataURL(imageFile)
    }
  }, [imageFile])

  useEffect(() => {
    if (imageSrc && containerRef.current) {
      const img = new Image()
      img.onload = () => {
        imageRef.current = img
        
        // Get actual container dimensions
        const container = containerRef.current
        const containerWidth = container.clientWidth
        const containerHeight = container.clientHeight
        
        // Calculate scale to fit image within container (maintaining aspect ratio)
        const scaleX = containerWidth / img.width
        const scaleY = containerHeight / img.height
        const initialScale = Math.min(scaleX, scaleY)
        
        setScale(initialScale)
        
        // Center the crop circle initially
        const centerX = containerWidth / 2
        const centerY = containerHeight / 2
        const cropHalfSize = CROP_SIZE / 2
        
        setCropPosition({ 
          x: centerX - cropHalfSize, 
          y: centerY - cropHalfSize 
        })
      }
      img.src = imageSrc
    }
  }, [imageSrc])

  const handleCropCircleMouseDown = (e) => {
    setIsDragging(true)
    const rect = containerRef.current.getBoundingClientRect()
    const cropCenterX = cropPosition.x + CROP_SIZE / 2
    const cropCenterY = cropPosition.y + CROP_SIZE / 2
    setDragStart({
      x: e.clientX - rect.left - cropCenterX,
      y: e.clientY - rect.top - cropCenterY
    })
    e.preventDefault()
    e.stopPropagation()
  }

  const handleMouseMove = (e) => {
    if (!isDragging || !imageRef.current || !containerRef.current) return
    
    const rect = containerRef.current.getBoundingClientRect()
    const containerWidth = containerRef.current.clientWidth
    const containerHeight = containerRef.current.clientHeight
    
    // Calculate new crop center position
    const newCropCenterX = e.clientX - rect.left - dragStart.x
    const newCropCenterY = e.clientY - rect.top - dragStart.y
    
    // Calculate crop position (top-left of crop circle)
    let newX = newCropCenterX - CROP_SIZE / 2
    let newY = newCropCenterY - CROP_SIZE / 2
    
    // Calculate image dimensions at current scale
    const scaledImageWidth = imageRef.current.width * scale
    const scaledImageHeight = imageRef.current.height * scale
    
    // Calculate image position (centered in container)
    const imageOffsetX = (scaledImageWidth - containerWidth) / 2
    const imageOffsetY = (scaledImageHeight - containerHeight) / 2
    
    // Constrain crop circle to stay within the visible image bounds
    const minX = -imageOffsetX
    const minY = -imageOffsetY
    const maxX = containerWidth + imageOffsetX - CROP_SIZE
    const maxY = containerHeight + imageOffsetY - CROP_SIZE
    
    newX = Math.max(minX, Math.min(newX, maxX))
    newY = Math.max(minY, Math.min(newY, maxY))
    
    setCropPosition({ x: newX, y: newY })
    e.preventDefault()
  }

  const handleMouseUp = () => {
    setIsDragging(false)
  }

  const handleZoom = (e) => {
    e.preventDefault()
    e.stopPropagation()
    if (!imageRef.current || !containerRef.current) return
    
    // Calculate zoom direction (negative deltaY = zoom in, positive = zoom out)
    const zoomFactor = e.deltaY > 0 ? 0.95 : 1.05
    const newScale = Math.max(0.5, Math.min(5, scale * zoomFactor))
    
    if (newScale === scale) return // No change in scale
    
    // Keep crop circle at same position relative to container
    // The image will scale but stay centered
    setScale(newScale)
  }

  useEffect(() => {
    // Prevent body scroll when cropper is open and preserve scroll position
    const scrollY = window.scrollY || window.pageYOffset || document.documentElement.scrollTop
    const originalOverflow = document.body.style.overflow
    const originalPosition = document.body.style.position
    const originalTop = document.body.style.top
    const originalWidth = document.body.style.width
    const originalPaddingRight = document.body.style.paddingRight
    const originalScrollBehavior = document.documentElement.style.scrollBehavior

    // Calculate scrollbar width to prevent layout shift
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth

    // Use requestAnimationFrame to ensure smooth transition
    requestAnimationFrame(() => {
      // Lock body scroll while preserving scroll position
      document.body.style.overflow = 'hidden'
      document.body.style.position = 'fixed'
      document.body.style.top = `-${scrollY}px`
      document.body.style.width = '100%'
      if (scrollbarWidth > 0) {
        document.body.style.paddingRight = `${scrollbarWidth}px`
      }
      document.documentElement.style.scrollBehavior = 'auto'
    })

    return () => {
      // Restore original styles
      document.body.style.overflow = originalOverflow
      document.body.style.position = originalPosition
      document.body.style.top = originalTop
      document.body.style.width = originalWidth
      document.body.style.paddingRight = originalPaddingRight
      document.documentElement.style.scrollBehavior = originalScrollBehavior
      
      // Restore scroll position after a brief delay to ensure styles are restored
      requestAnimationFrame(() => {
        window.scrollTo({
          top: scrollY,
          behavior: 'auto'
        })
      })
    }
  }, [])

  const handleCrop = () => {
    if (!imageRef.current || !canvasRef.current || !containerRef.current) return

    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    const img = imageRef.current
    const containerWidth = containerRef.current.clientWidth
    const containerHeight = containerRef.current.clientHeight
    
    canvas.width = CROP_SIZE
    canvas.height = CROP_SIZE
    
    // Create circular clipping path
    ctx.beginPath()
    ctx.arc(CROP_SIZE / 2, CROP_SIZE / 2, CROP_SIZE / 2, 0, Math.PI * 2)
    ctx.clip()
    
    // Calculate the actual source coordinates in the original image
    const scaledImageWidth = img.width * scale
    const scaledImageHeight = img.height * scale
    const imageOffsetX = (scaledImageWidth - containerWidth) / 2
    const imageOffsetY = (scaledImageHeight - containerHeight) / 2
    
    // Convert crop position to source image coordinates
    // Crop position is relative to container, need to account for image offset
    const sourceX = (cropPosition.x + imageOffsetX) / scale
    const sourceY = (cropPosition.y + imageOffsetY) / scale
    const sourceSize = CROP_SIZE / scale
    
    // Draw cropped and scaled image
    ctx.drawImage(
      img,
      sourceX, sourceY, sourceSize, sourceSize,
      0, 0, CROP_SIZE, CROP_SIZE
    )
    
    // Convert to base64
    const croppedImage = canvas.toDataURL('image/png')
    onCropComplete(croppedImage)
  }

  if (!imageSrc) return null

  const cropperContent = (
    <div 
      ref={overlayRef}
      className="image-cropper-overlay" 
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onCancel()
        }
      }}
      onWheel={(e) => {
        // Only handle wheel events if they're on the cropper container
        if (!e.target.closest('.cropper-preview-container')) {
          return
        }
        e.preventDefault()
        e.stopPropagation()
      }}
    >
      <div 
        ref={containerElementRef}
        className="image-cropper-container"
        onClick={(e) => e.stopPropagation()}
      >
        <h3>Crop Your Image</h3>
        <p className="cropper-instructions">
          Drag the circle to select area • Scroll to zoom image • The circular area will be your seat icon
        </p>
        
        <div 
          className="cropper-preview-container"
          ref={containerRef}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onWheel={(e) => {
            handleZoom(e)
            e.preventDefault()
            e.stopPropagation()
          }}
          onTouchStart={(e) => {
            // Prevent touch scrolling on the page
            if (e.target === e.currentTarget || e.target.closest('.cropper-overlay-circle')) {
              e.preventDefault()
            }
          }}
        >
          {imageSrc && imageRef.current && (
            <div 
              className="cropper-image-wrapper"
              style={{
                width: `${imageRef.current.width * scale}px`,
                height: `${imageRef.current.height * scale}px`,
                left: `${(containerRef.current?.clientWidth || 400) / 2 - (imageRef.current.width * scale) / 2}px`,
                top: `${(containerRef.current?.clientHeight || 400) / 2 - (imageRef.current.height * scale) / 2}px`
              }}
            >
              <img 
                src={imageSrc} 
                alt="Crop preview"
                className="cropper-source-image"
                style={{
                  width: `${imageRef.current.width * scale}px`,
                  height: `${imageRef.current.height * scale}px`,
                  display: 'block'
                }}
              />
            </div>
          )}
          <div 
            className="cropper-overlay-circle"
            ref={cropCircleRef}
            style={{
              left: `${cropPosition.x}px`,
              top: `${cropPosition.y}px`,
              cursor: isDragging ? 'grabbing' : 'grab'
            }}
            onMouseDown={handleCropCircleMouseDown}
          />
        </div>
        
        <div className="cropper-controls">
          <button type="button" onClick={onCancel} className="cancel-crop-button">
            Cancel
          </button>
          <button type="button" onClick={handleCrop} className="apply-crop-button">
            Apply Crop
          </button>
        </div>
      </div>
      <canvas ref={canvasRef} style={{ display: 'none' }} />
    </div>
  )

  // Render using portal to ensure it's at the document root level
  return createPortal(cropperContent, document.body)
}

export default ImageCropper

