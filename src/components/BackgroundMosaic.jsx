import { useState, useEffect } from 'react'
import { fetchBackgroundImages } from '../api'
import { getSocket } from '../utils/websocket'
import './BackgroundMosaic.css'

function BackgroundMosaic() {
  const [images, setImages] = useState([])
  const [loading, setLoading] = useState(true)
  const [gridSize, setGridSize] = useState({ cols: 0, rows: 0 })

  // Define loadImages before it's used in useEffect
  const loadImages = async () => {
    try {
      setLoading(true)
      const data = await fetchBackgroundImages()
      const imageArray = Array.isArray(data) ? data : []
      setImages(imageArray)
      console.log('Background images loaded:', imageArray.length)
    } catch (error) {
      console.error('Error loading background images:', error)
      setImages([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadImages()
    
    // Listen for WebSocket updates
    const socket = getSocket()
    socket.on('background-images:updated', (updatedImages) => {
      if (Array.isArray(updatedImages)) {
        setImages(updatedImages)
      }
    })

    return () => {
      socket.off('background-images:updated')
    }
  }, [])

  useEffect(() => {
    // Calculate grid size based on viewport
    const calculateGrid = () => {
      const viewportWidth = window.innerWidth
      const viewportHeight = window.innerHeight
      
      // Target tile size (adjustable)
      const targetTileSize = 200
      const cols = Math.max(3, Math.floor(viewportWidth / targetTileSize))
      const rows = Math.max(3, Math.floor(viewportHeight / targetTileSize))
      
      setGridSize({ cols, rows })
    }

    calculateGrid()
    
    // Recalculate on window resize
    const handleResize = () => {
      calculateGrid()
    }
    
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  // Generate dynamic keyframes for image cycling
  // This must be before any conditional returns to follow Rules of Hooks
  const imageDisplayDuration = 8 // seconds each image is displayed (slower animation)
  const fadeDuration = 1 // seconds for fade in/out (slower transitions)

  useEffect(() => {
    if (images.length === 0) {
      // Remove keyframes if no images
      const styleElement = document.getElementById('mosaic-keyframes')
      if (styleElement) {
        styleElement.remove()
      }
      return
    }

    const styleId = 'mosaic-keyframes'
    let styleElement = document.getElementById(styleId)
    
    if (!styleElement) {
      styleElement = document.createElement('style')
      styleElement.id = styleId
      document.head.appendChild(styleElement)
    }

    // Calculate cycle duration based on number of images
    const totalCycleDuration = images.length * imageDisplayDuration

    // Calculate percentages - each image shows for imagePercent of the cycle
    const imagePercent = 100 / images.length
    const fadePercent = (fadeDuration / totalCycleDuration) * 100
    
    // Generate keyframes where each image shows for its time slot
    // With animation-delay, each image layer will start at different times
    // So we need keyframes that show the image for imagePercent% of the cycle
    let keyframes = '@keyframes imageCycle {\n'
    keyframes += '  0% { opacity: 0; transform: scale(1.05); }\n'
    
    // Fade in quickly
    keyframes += `  ${fadePercent.toFixed(2)}% { opacity: 1; transform: scale(1); }\n`
    // Stay visible for most of the image's time slot
    keyframes += `  ${(imagePercent - fadePercent).toFixed(2)}% { opacity: 1; transform: scale(1); }\n`
    // Fade out at the end of this image's time slot
    keyframes += `  ${imagePercent.toFixed(2)}% { opacity: 0; transform: scale(0.95); }\n`
    // Stay hidden for the rest of the cycle
    keyframes += '  100% { opacity: 0; transform: scale(0.95); }\n'
    keyframes += '}'
    
    styleElement.textContent = keyframes

    return () => {
      // Cleanup on unmount
      const element = document.getElementById(styleId)
      if (element) {
        element.remove()
      }
    }
  }, [images.length, imageDisplayDuration, fadeDuration])

  // Always render the container to hide the old background immediately
  // Even if loading or no images, the container will hide the default background via CSS
  const totalTiles = gridSize.cols > 0 && gridSize.rows > 0 ? gridSize.cols * gridSize.rows : 0
  const totalCycleDuration = images.length > 0 ? images.length * imageDisplayDuration : 20
  const hasImages = !loading && images.length > 0 && gridSize.cols > 0 && gridSize.rows > 0

  return (
    <div 
      className="background-mosaic"
      style={hasImages ? {
        gridTemplateColumns: `repeat(${gridSize.cols}, 1fr)`,
        gridTemplateRows: `repeat(${gridSize.rows}, 1fr)`
      } : undefined}
    >
      {hasImages && Array.from({ length: totalTiles }, (_, tileIndex) => {
        // Randomize start offset for each tile (0 to full cycle duration)
        // Use tileIndex as seed for consistent randomization per tile
        const randomSeed = tileIndex * 7919 // Prime number for better distribution
        const randomOffset = (Math.sin(randomSeed) * 0.5 + 0.5) * totalCycleDuration
        
        // Shuffle images for each tile to add more randomization
        // Use tileIndex as seed to ensure consistent shuffle per tile
        const shuffledImages = [...images].sort((a, b) => {
          const hashA = (tileIndex * 7919 + a.id.charCodeAt(0)) % 1000
          const hashB = (tileIndex * 7919 + b.id.charCodeAt(0)) % 1000
          return hashA - hashB
        })
        
        // Calculate random starting image index for this tile (0 to images.length-1)
        // This ensures each tile starts with a different random image immediately
        const initialImageIndex = shuffledImages.length > 0 
          ? Math.floor((Math.sin(randomSeed * 2) * 0.5 + 0.5) * shuffledImages.length)
          : 0
        
        // Add random delay variation per image layer (0 to 2 seconds)
        const getRandomDelay = (imgIndex) => {
          const hash = (tileIndex * 7919 + imgIndex * 997) % 1000
          return (hash / 1000) * 2 // 0 to 2 seconds random delay
        }
        
        return (
          <div
            key={`tile-${tileIndex}`}
            className="mosaic-tile"
            style={{
              '--cycle-duration': `${totalCycleDuration}s`,
              '--image-duration': `${imageDisplayDuration}s`,
              '--start-offset': `${randomOffset}s`,
              '--total-images': images.length,
              '--initial-image-index': initialImageIndex
            }}
          >
            {shuffledImages.map((image, imgIndex) => {
              const randomDelay = getRandomDelay(imgIndex)
              const isInitialImage = imgIndex === initialImageIndex
              // Calculate delay: normal delay is imgIndex * imageDisplayDuration
              // For initial image, subtract half its display duration to put it in middle of visible phase
              const baseDelay = imgIndex * imageDisplayDuration + randomDelay
              const adjustedDelay = isInitialImage 
                ? baseDelay - (imageDisplayDuration * 0.5) // Put initial image in middle of its visible phase
                : baseDelay
              
              return (
                <div
                  key={`${image.id}-${tileIndex}-${imgIndex}`}
                  className={`mosaic-tile-image ${isInitialImage ? 'initial-image' : ''}`}
                  style={{
                    backgroundImage: `url(${image.data})`,
                    '--image-index': imgIndex,
                    '--random-delay': `${randomDelay}s`,
                    '--adjusted-delay': `${adjustedDelay}s`,
                    // Set opacity inline for initial image to ensure it's visible immediately
                    ...(isInitialImage ? { opacity: 1, transform: 'scale(1)' } : {})
                  }}
                />
              )
            })}
          </div>
        )
      })}
    </div>
  )
}

export default BackgroundMosaic

