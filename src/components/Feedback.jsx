import { useState } from 'react'
import './Feedback.css'
import { saveFeedback } from '../api'
import logger from '../utils/logger'

function Feedback({ onBackToMenu }) {
  const [name, setName] = useState('')
  const [feedbackText, setFeedbackText] = useState('')
  const [rating, setRating] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [submitMessage, setSubmitMessage] = useState(null)
  const [errors, setErrors] = useState({})

  const handleSubmit = async (e) => {
    e.preventDefault()
    const newErrors = {}

    if (!feedbackText.trim()) {
      newErrors.feedbackText = 'Please enter your feedback'
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return
    }

    try {
      setSubmitting(true)
      const feedback = {
        id: Date.now().toString(),
        name: name.trim() || 'Anonymous',
        feedbackText: feedbackText.trim(),
        rating: rating || null,
        submittedAt: new Date().toISOString()
      }
      
      await saveFeedback(feedback)
      setSubmitMessage({ type: 'success', text: 'Thank you for your feedback!' })
      setName('')
      setFeedbackText('')
      setRating(0)
      setErrors({})
      
      setTimeout(() => {
        setSubmitMessage(null)
      }, 5000)
    } catch (error) {
      logger.error('Error submitting feedback:', error)
      setSubmitMessage({ type: 'error', text: 'Failed to submit feedback. Please try again.' })
    } finally {
      setSubmitting(false)
    }
  }

  const handleRatingClick = (value) => {
    setRating(value)
    if (errors.rating) {
      setErrors({ ...errors, rating: null })
    }
  }

  return (
    <div className="feedback-container">
      <h2>💬 Feedback</h2>
      <p className="feedback-description">
        We'd love to hear your thoughts about the event! Your feedback helps us improve future events.
      </p>

      {submitMessage && (
        <div className={`submit-message ${submitMessage.type}`}>
          {submitMessage.text}
        </div>
      )}

      <form onSubmit={handleSubmit} className="feedback-form">
        <div className="form-group">
          <label htmlFor="name">Your Name (Optional)</label>
          <input
            type="text"
            id="name"
            value={name}
            onChange={(e) => {
              setName(e.target.value)
              if (errors.name) {
                setErrors({ ...errors, name: null })
              }
            }}
            placeholder="Your name (optional)"
          />
          <p className="field-hint">You can leave this blank to submit anonymously</p>
        </div>

        <div className="form-group">
          <label htmlFor="rating">Rating (Optional)</label>
          <div className="rating-container">
            {[1, 2, 3, 4, 5].map((value) => (
              <button
                key={value}
                type="button"
                className={`rating-star ${rating >= value ? 'selected' : ''}`}
                onClick={() => handleRatingClick(value)}
                title={`${value} star${value > 1 ? 's' : ''}`}
              >
                ⭐
              </button>
            ))}
          </div>
          {rating > 0 && (
            <p className="rating-text">You selected {rating} star{rating > 1 ? 's' : ''}</p>
          )}
        </div>

        <div className="form-group">
          <label htmlFor="feedback-text">Your Feedback *</label>
          <textarea
            id="feedback-text"
            value={feedbackText}
            onChange={(e) => {
              setFeedbackText(e.target.value)
              if (errors.feedbackText) {
                setErrors({ ...errors, feedbackText: null })
              }
            }}
            placeholder="Tell us what you thought about the event..."
            rows={8}
            className={errors.feedbackText ? 'error' : ''}
          />
          {errors.feedbackText && (
            <span className="error-message">{errors.feedbackText}</span>
          )}
          <p className="field-hint">Please share your thoughts, suggestions, or any comments about the event</p>
        </div>

        <div className="form-actions">
          <button type="submit" className="submit-button" disabled={submitting}>
            {submitting ? 'Submitting...' : 'Submit Feedback'}
          </button>
        </div>
      </form>
    </div>
  )
}

export default Feedback

