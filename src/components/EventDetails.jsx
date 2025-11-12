import { useState, useEffect } from 'react'
import './EventDetails.css'
import { fetchEventDetails } from '../api'
import logger from '../utils/logger'

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
              <span className="info-value description-text">{eventDetails.description}</span>
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
                <span className="info-value description-text">{eventDetails.additionalInfo}</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default EventDetails

