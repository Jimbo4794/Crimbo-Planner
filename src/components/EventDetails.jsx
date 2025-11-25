import { useState, useEffect } from 'react'
import './EventDetails.css'
import { fetchEventDetails } from '../api'
import logger from '../utils/logger'

// Helper function to render text with embedded images
const renderTextWithImages = (text, images) => {
  if (!text) {
    return text
  }

  // Check if text contains image placeholders
  const hasImagePlaceholders = /\[IMAGE:[^\]]+\]/.test(text)
  if (!hasImagePlaceholders) {
    return text
  }

  // Create a map of images by ID for quick lookup
  const imageMap = new Map()
  if (images && images.length > 0) {
    images.forEach(img => {
      if (img.id) {
        imageMap.set(img.id, img)
      }
    })
  }

  // Split text by image placeholders and render
  // Format: [IMAGE:image-id] or [IMAGE:image-id:width:height]
  const parts = []
  const regex = /\[IMAGE:([^:\]]+)(?::([^:\]]+))?(?::([^\]]+))?\]/g
  let lastIndex = 0
  let match
  let matchCount = 0

  while ((match = regex.exec(text)) !== null) {
    matchCount++
    // Add text before the match
    if (match.index > lastIndex) {
      const textBefore = text.substring(lastIndex, match.index)
      if (textBefore) {
        parts.push(textBefore)
      }
    }

    // Parse image ID and optional size parameters
    const imageId = match[1]
    const width = match[2] && match[2] !== 'auto' ? match[2] : null
    const height = match[3] && match[3] !== 'auto' ? match[3] : null
    
    const image = imageMap.get(imageId)
    if (image) {
      // Build style object for width and height
      const imageStyle = {}
      if (width) {
        imageStyle.width = width.includes('%') ? width : `${width}px`
      }
      if (height) {
        imageStyle.height = height.includes('%') ? height : `${height}px`
      }
      
      parts.push(
        <img
          key={`img-${imageId}-${match.index}`}
          src={image.data}
          alt="Event"
          className="embedded-event-image"
          style={Object.keys(imageStyle).length > 0 ? imageStyle : undefined}
        />
      )
    } else {
      // If image not found, just show the placeholder text (or nothing)
      // parts.push(`[Image: ${imageId} not found]`)
    }

    lastIndex = regex.lastIndex
  }

  // Add remaining text
  if (lastIndex < text.length) {
    const remainingText = text.substring(lastIndex)
    if (remainingText) {
      parts.push(remainingText)
    }
  }

  // If no matches were processed, return original text
  if (matchCount === 0) {
    return text
  }

  return parts.length > 0 ? parts : text
}

function EventDetails({ onBackToMenu, eventDetails: propEventDetails }) {
  const [eventDetails, setEventDetails] = useState({
    eventName: '',
    date: '',
    time: '',
    location: '',
    address: '',
    description: '',
    contactEmail: '',
    contactPhone: '',
    dressCode: '',
    additionalInfo: ''
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (propEventDetails) {
      setEventDetails(propEventDetails)
      setLoading(false)
    } else {
      loadEventDetails()
    }
  }, [propEventDetails])

  const loadEventDetails = async () => {
    try {
      setLoading(true)
      const data = await fetchEventDetails()
      if (data) {
        setEventDetails(data)
      }
    } catch (error) {
      logger.error('Error loading event details:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="event-details-container">
        <p>Loading...</p>
      </div>
    )
  }

  const hasEventDetails = eventDetails.eventName || eventDetails.date || eventDetails.location

  if (!hasEventDetails) {
    return (
      <div className="event-details-container">
        <h2>📅 Event Details</h2>
        <p className="event-details-description">
          Event details have not been set yet. Please contact an administrator.
        </p>
      </div>
    )
  }

  return (
    <div className="event-details-container">
      <h2>📅 Event Details</h2>
      <p className="event-details-description">
        Information about the Christmas party event.
      </p>

      <div className="event-details-view">
        <div className="info-section">
          <h3>Basic Information</h3>
          {eventDetails.eventName && (
            <div className="info-item">
              <span className="info-label">Event Name:</span>
              <span className="info-value">{eventDetails.eventName}</span>
            </div>
          )}
          {eventDetails.date && (
            <div className="info-item">
              <span className="info-label">Date:</span>
              <span className="info-value">{new Date(eventDetails.date).toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
            </div>
          )}
          {eventDetails.time && (
            <div className="info-item">
              <span className="info-label">Time:</span>
              <span className="info-value">{eventDetails.time}</span>
            </div>
          )}
        </div>

        {(eventDetails.location || eventDetails.address) && (
          <div className="info-section">
            <h3>Location</h3>
            {eventDetails.location && (
              <div className="info-item">
                <span className="info-label">Venue:</span>
                <span className="info-value">{eventDetails.location}</span>
              </div>
            )}
            {eventDetails.address && (
              <div className="info-item">
                <span className="info-label">Address:</span>
                <span className="info-value">{eventDetails.address}</span>
              </div>
            )}
          </div>
        )}

        {eventDetails.description && (
          <div className="info-section">
            <h3>Event Description</h3>
            <div className="info-item">
              <div className="info-value description-text">
                {renderTextWithImages(eventDetails.description, eventDetails.images)}
              </div>
            </div>
          </div>
        )}

        {(eventDetails.contactEmail || eventDetails.contactPhone) && (
          <div className="info-section">
            <h3>Contact Information</h3>
            {eventDetails.contactEmail && (
              <div className="info-item">
                <span className="info-label">Email:</span>
                <span className="info-value">
                  <a href={`mailto:${eventDetails.contactEmail}`}>{eventDetails.contactEmail}</a>
                </span>
              </div>
            )}
            {eventDetails.contactPhone && (
              <div className="info-item">
                <span className="info-label">Phone:</span>
                <span className="info-value">
                  <a href={`tel:${eventDetails.contactPhone}`}>{eventDetails.contactPhone}</a>
                </span>
              </div>
            )}
          </div>
        )}

        {(eventDetails.dressCode || eventDetails.additionalInfo) && (
          <div className="info-section">
            <h3>Additional Information</h3>
            {eventDetails.dressCode && (
              <div className="info-item">
                <span className="info-label">Dress Code:</span>
                <span className="info-value">{eventDetails.dressCode}</span>
              </div>
            )}
            {eventDetails.additionalInfo && (
              <div className="info-item">
                <div className="info-value description-text">
                  {renderTextWithImages(eventDetails.additionalInfo, eventDetails.images)}
                </div>
              </div>
            )}
          </div>
        )}

        {eventDetails.showImages !== false && eventDetails.images && eventDetails.images.length > 0 && (
          <div className="info-section">
            <h3>Event Images</h3>
            <div className="event-images-gallery">
              {eventDetails.images.map((image) => (
                <div key={image.id} className="event-image-container">
                  <img src={image.data} alt="Event" className="event-image" />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default EventDetails

