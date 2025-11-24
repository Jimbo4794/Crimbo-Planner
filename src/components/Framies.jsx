import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import './Framies.css'
import ImageCropper from './ImageCropper'
import { MAX_IMAGE_SIZE } from '../utils/constants'
import { fetchFramies, saveFramies, fetchAwards } from '../api'
import { getSocket } from '../utils/websocket'
import logger from '../utils/logger'

function Framies({ onBackToMenu, rsvps = [], framiesNominationsLocked = false, framiesVotingLocked = false }) {
  const [framiesData, setFramiesData] = useState({ nominations: [], votes: [] })
  const [awards, setAwards] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [nominationForm, setNominationForm] = useState({ awardId: '', nominee: '', rationale: '' })
  const [nominationImage, setNominationImage] = useState(null)
  const [nominationImageFile, setNominationImageFile] = useState(null)
  const [showImageCropper, setShowImageCropper] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitMessage, setSubmitMessage] = useState(null)
  const [showNominationDialog, setShowNominationDialog] = useState(false)
  const isUpdatingFromWebSocket = useRef(false)

  // Get list of people from RSVPs for nomination dropdown
  const peopleList = rsvps
    .filter(rsvp => rsvp.name && rsvp.name.trim())
    .map(rsvp => rsvp.name.trim())
    .filter((name, index, self) => self.indexOf(name) === index) // Remove duplicates
    .sort()

  // Load initial data
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true)
        setError(null)
        const [data, awardsData] = await Promise.all([
          fetchFramies(),
          fetchAwards()
        ])
        setFramiesData(data || { nominations: [], votes: [] })
        setAwards(awardsData || [])
      } catch (err) {
        logger.error('Error loading framies data:', err)
        setError('Failed to load framies data. Please refresh the page.')
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [])

  // Set up WebSocket connection for real-time updates
  useEffect(() => {
    const socket = getSocket()

    socket.on('framies:updated', (updatedData) => {
      if (updatedData && typeof updatedData === 'object') {
        isUpdatingFromWebSocket.current = true
        setFramiesData(updatedData)
        setTimeout(() => {
          isUpdatingFromWebSocket.current = false
        }, 100)
      }
    })

    socket.on('awards:updated', (updatedAwards) => {
      if (Array.isArray(updatedAwards)) {
        setAwards(updatedAwards)
      }
    })

    return () => {
      socket.off('framies:updated')
      socket.off('awards:updated')
    }
  }, [])

  // Save to API whenever data changes (but not if update came from WebSocket)
  useEffect(() => {
    if (!loading && !isUpdatingFromWebSocket.current) {
      saveFramies(framiesData).catch(err => {
        logger.error('Error saving framies data:', err)
        setError('Failed to save framies data. Please try again.')
      })
    }
  }, [framiesData, loading])

  const handleImageSelect = (e) => {
    const file = e.target.files[0]
    if (file) {
      if (!file.type.startsWith('image/')) {
        setSubmitMessage({ type: 'error', text: 'Please select a valid image file' })
        setTimeout(() => setSubmitMessage(null), 5000)
        return
      }
      if (file.size > MAX_IMAGE_SIZE) {
        setSubmitMessage({ type: 'error', text: 'Image size must be less than 5MB' })
        setTimeout(() => setSubmitMessage(null), 5000)
        return
      }
      // Use original image by default
      const reader = new FileReader()
      reader.onload = (e) => {
        setNominationImage(e.target.result)
        setNominationImageFile(file) // Keep the file for potential cropping later
      }
      reader.readAsDataURL(file)
    }
  }

  const handleStartCrop = () => {
    if (nominationImageFile) {
      setShowImageCropper(true)
    }
  }

  const handleCropComplete = (croppedImage) => {
    setNominationImage(croppedImage)
    setShowImageCropper(false)
    // Keep nominationImageFile in case user wants to crop again
  }

  const handleCancelCrop = () => {
    setShowImageCropper(false)
    // Keep the original image and file when cancelling crop
  }

  const handleRemoveImage = () => {
    setNominationImage(null)
    setNominationImageFile(null)
    const fileInput = document.getElementById('nomination-image-upload')
    if (fileInput) {
      fileInput.value = ''
    }
  }

  const handleNominate = async (e) => {
    e.preventDefault()
    
    // Check if nominations are locked
    if (framiesNominationsLocked) {
      setSubmitMessage({ type: 'error', text: 'Framies nominations are currently locked. Please contact the administrator.' })
      setTimeout(() => setSubmitMessage(null), 5000)
      return
    }
    
    if (!nominationForm.awardId || !nominationForm.nominee.trim()) {
      setSubmitMessage({ type: 'error', text: 'Please select an award and enter a nominee name.' })
      setTimeout(() => setSubmitMessage(null), 5000)
      return
    }

    try {
      setSubmitting(true)
      const newNomination = {
        id: Date.now().toString(),
        awardId: nominationForm.awardId,
        nominee: nominationForm.nominee.trim(),
        rationale: nominationForm.rationale.trim() || '',
        supportingImage: nominationImage || null,
        nominatedBy: 'Anonymous', // Could be enhanced to use RSVP name/email
        nominatedAt: new Date().toISOString()
      }

      const updatedData = {
        nominations: [...(framiesData.nominations || []), newNomination],
        votes: framiesData.votes || []
      }

      setFramiesData(updatedData)
      setNominationForm({ awardId: '', nominee: '', rationale: '' })
      setNominationImage(null)
      setNominationImageFile(null)
      const fileInput = document.getElementById('nomination-image-upload')
      if (fileInput) {
        fileInput.value = ''
      }
      setSubmitMessage({ type: 'success', text: 'Nomination submitted successfully!' })
      setTimeout(() => setSubmitMessage(null), 5000)
      setShowNominationDialog(false) // Close dialog after successful submission
    } catch (err) {
      logger.error('Error submitting nomination:', err)
      setSubmitMessage({ type: 'error', text: 'Failed to submit nomination. Please try again.' })
      setTimeout(() => setSubmitMessage(null), 5000)
    } finally {
      setSubmitting(false)
    }
  }


  // Handle Escape key to close dialogs
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        if (showNominationDialog) {
          setShowNominationDialog(false)
        }
      }
    }
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [showNominationDialog])

  if (loading) {
    return (
      <div className="framies-container">
        <p>Loading...</p>
      </div>
    )
  }

  return (
    <div className="framies-container">
      <h2>🏆 Framies!</h2>
      <p className="framies-description">
        Nominate your favorite people in various award categories!
      </p>

      {submitMessage && (
        <div className={`submit-message ${submitMessage.type}`}>
          {submitMessage.text}
        </div>
      )}

      {error && (
        <div className="error-message">
          {error}
          <button onClick={() => setError(null)} className="error-dismiss">×</button>
        </div>
      )}

      {framiesNominationsLocked && (
        <div className="lock-notice">
          <p>🔒 Framies nominations are currently locked. New nominations cannot be added at this time.</p>
        </div>
      )}
      <div className="framies-actions">
        <button 
          onClick={() => setShowNominationDialog(true)}
          className="action-button nomination-button"
          disabled={framiesNominationsLocked}
        >
          ➕ Make a Nomination
        </button>
      </div>

      {/* Nomination Dialog */}
      {showNominationDialog && createPortal(
        <div 
          className="dialog-overlay" 
          onClick={() => setShowNominationDialog(false)}
        >
          <div 
            className="nomination-dialog" 
            onClick={(e) => e.stopPropagation()}
          >
            <div className="nomination-dialog-header">
              <h3>Make a Nomination</h3>
              <button
                className="close-dialog-button"
                onClick={() => setShowNominationDialog(false)}
                aria-label="Close dialog"
              >
                ×
              </button>
            </div>
            <div className="nomination-dialog-content">
              <form onSubmit={handleNominate} className="nomination-form">
                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="award-select">Award Category *</label>
                    <select
                      id="award-select"
                      value={nominationForm.awardId}
                      onChange={(e) => setNominationForm({ ...nominationForm, awardId: e.target.value })}
                      required
                    >
                      <option value="">Select an award...</option>
                      {awards.map(award => (
                        <option key={award.id} value={award.id}>
                          {award.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label htmlFor="nominee-input">Nominee Name *</label>
                    <input
                      id="nominee-input"
                      type="text"
                      value={nominationForm.nominee}
                      onChange={(e) => setNominationForm({ ...nominationForm, nominee: e.target.value })}
                      placeholder="Enter nominee name"
                      list="people-list"
                      required
                    />
                    {peopleList.length > 0 && (
                      <datalist id="people-list">
                        {peopleList.map((name, idx) => (
                          <option key={idx} value={name} />
                        ))}
                      </datalist>
                    )}
                  </div>
                </div>

                <div className="form-group">
                  <label htmlFor="rationale-input">Rationale (Optional)</label>
                  <textarea
                    id="rationale-input"
                    value={nominationForm.rationale}
                    onChange={(e) => setNominationForm({ ...nominationForm, rationale: e.target.value })}
                    placeholder="Explain why this person deserves this award..."
                    rows={4}
                    className="nomination-textarea"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="nomination-image-upload">Supporting Image (Optional)</label>
                  {nominationImage ? (
                    <div className="nomination-image-preview">
                      <img src={nominationImage} alt="Supporting image" className="preview-image" />
                      <div className="image-preview-buttons">
                        <button
                          type="button"
                          onClick={handleStartCrop}
                          className="crop-image-button"
                        >
                          ✂️ Crop Image
                        </button>
                        <button
                          type="button"
                          onClick={handleRemoveImage}
                          className="remove-image-button"
                        >
                          Remove Image
                        </button>
                      </div>
                    </div>
                  ) : (
                    <label htmlFor="nomination-image-upload" className="image-upload-label">
                      <input
                        type="file"
                        id="nomination-image-upload"
                        accept="image/*"
                        onChange={handleImageSelect}
                        style={{ display: 'none' }}
                      />
                      <span className="upload-button">📷 Upload Supporting Image</span>
                    </label>
                  )}
                  <p className="form-help">Upload an image to support your nomination (max 5MB)</p>
                </div>

                {showImageCropper && nominationImageFile && (
                  <ImageCropper
                    imageFile={nominationImageFile}
                    onCropComplete={handleCropComplete}
                    onCancel={handleCancelCrop}
                  />
                )}

                <button type="submit" className="submit-button" disabled={submitting}>
                  {submitting ? 'Submitting...' : 'Submit Nomination'}
                </button>
              </form>
            </div>
          </div>
        </div>,
        document.body
      )}

      <div className="awards-section">
        <h3>Award Categories</h3>
        <div className="awards-grid">
          {awards.map(award => {
            return (
              <div 
                key={award.id} 
                className="award-card"
              >
                <div className="award-header">
                  <h4>{award.label}</h4>
                </div>
                <div className="award-summary">
                  <p className="award-description">{award.description || ''}</p>
                </div>
              </div>
            )
          })}
        </div>
      </div>

    </div>
  )
}

export default Framies

