import { useState, useEffect, useRef } from 'react'
import './Framies.css'
import { fetchFramies, saveFramies, fetchAwards } from '../api'
import { getSocket } from '../utils/websocket'
import logger from '../utils/logger'

function Framies({ onBackToMenu, rsvps = [] }) {
  const [framiesData, setFramiesData] = useState({ nominations: [], votes: [] })
  const [awards, setAwards] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [nominationForm, setNominationForm] = useState({ awardId: '', nominee: '' })
  const [submitting, setSubmitting] = useState(false)
  const [submitMessage, setSubmitMessage] = useState(null)
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

  const handleNominate = async (e) => {
    e.preventDefault()
    
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
        nominatedBy: 'Anonymous', // Could be enhanced to use RSVP name/email
        nominatedAt: new Date().toISOString()
      }

      const updatedData = {
        nominations: [...(framiesData.nominations || []), newNomination],
        votes: framiesData.votes || []
      }

      setFramiesData(updatedData)
      setNominationForm({ awardId: '', nominee: '' })
      setSubmitMessage({ type: 'success', text: 'Nomination submitted successfully!' })
      setTimeout(() => setSubmitMessage(null), 5000)
    } catch (err) {
      logger.error('Error submitting nomination:', err)
      setSubmitMessage({ type: 'error', text: 'Failed to submit nomination. Please try again.' })
      setTimeout(() => setSubmitMessage(null), 5000)
    } finally {
      setSubmitting(false)
    }
  }

  const handleVote = async (nominationId) => {
    try {
      // Get or create a persistent voter ID using localStorage
      let voterId = localStorage.getItem('framies_voter_id')
      if (!voterId) {
        voterId = `voter_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        localStorage.setItem('framies_voter_id', voterId)
      }
      
      // Check if this voter has already voted for this nomination
      const existingVote = (framiesData.votes || []).find(
        v => v.nominationId === nominationId && v.voterId === voterId
      )

      if (existingVote) {
        setSubmitMessage({ type: 'error', text: 'You have already voted for this nomination.' })
        setTimeout(() => setSubmitMessage(null), 5000)
        return
      }

      const newVote = {
        id: Date.now().toString(),
        nominationId,
        voterId,
        votedAt: new Date().toISOString()
      }

      const updatedData = {
        nominations: framiesData.nominations || [],
        votes: [...(framiesData.votes || []), newVote]
      }

      setFramiesData(updatedData)
      setSubmitMessage({ type: 'success', text: 'Vote recorded!' })
      setTimeout(() => setSubmitMessage(null), 3000)
    } catch (err) {
      logger.error('Error voting:', err)
      setSubmitMessage({ type: 'error', text: 'Failed to record vote. Please try again.' })
      setTimeout(() => setSubmitMessage(null), 5000)
    }
  }

  // Get nominations for a specific award
  const getNominationsForAward = (awardId) => {
    return (framiesData.nominations || []).filter(n => n.awardId === awardId)
  }

  // Get vote count for a nomination
  const getVoteCount = (nominationId) => {
    return (framiesData.votes || []).filter(v => v.nominationId === nominationId).length
  }

  // Get all votes for nominations in an award (to find winner)
  const getAwardResults = (awardId) => {
    const nominations = getNominationsForAward(awardId)
    return nominations.map(nom => ({
      ...nom,
      voteCount: getVoteCount(nom.id)
    })).sort((a, b) => b.voteCount - a.voteCount)
  }

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
        Nominate and vote for your favorite people in various award categories!
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

      <div className="nomination-section">
        <h3>Make a Nomination</h3>
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

          <button type="submit" className="submit-button" disabled={submitting}>
            {submitting ? 'Submitting...' : 'Submit Nomination'}
          </button>
        </form>
      </div>

      <div className="awards-section">
        <h3>Award Categories</h3>
        <div className="awards-grid">
          {awards.map(award => {
            const results = getAwardResults(award.id)
            return (
              <div key={award.id} className="award-card">
                <div className="award-header">
                  <h4>{award.label}</h4>
                </div>

                {results.length === 0 ? (
                  <p className="no-nominations">No nominations yet. Be the first to nominate someone!</p>
                ) : (
                  <div className="nominations-list">
                    {results.map((nomination) => (
                      <div key={nomination.id} className="nomination-item">
                        <div className="nomination-info">
                          <span className="nominee-name">{nomination.nominee}</span>
                          <span className="vote-count">{nomination.voteCount} vote{nomination.voteCount !== 1 ? 's' : ''}</span>
                        </div>
                        <button
                          onClick={() => handleVote(nomination.id)}
                          className="vote-button"
                          title="Vote for this nomination"
                        >
                          👍 Vote
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export default Framies

