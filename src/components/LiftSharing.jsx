import { useState, useEffect, useRef } from 'react'
import './LiftSharing.css'
import { fetchLiftShares, saveLiftShares } from '../api'
import { getSocket } from '../utils/websocket'

function LiftSharing({ onBackToMenu, rsvps = [] }) {
  const [liftShares, setLiftShares] = useState([])
  const [loading, setLoading] = useState(true)
  const [showDriverForm, setShowDriverForm] = useState(false)
  const [showPassengerForm, setShowPassengerForm] = useState(false)
  const [selectedLiftId, setSelectedLiftId] = useState(null)
  
  // Driver form state
  const [driverName, setDriverName] = useState('')
  const [whereFrom, setWhereFrom] = useState('')
  const [availableSeats, setAvailableSeats] = useState(1)
  const [driverErrors, setDriverErrors] = useState({})
  
  // Passenger form state
  const [passengerName, setPassengerName] = useState('')
  const [passengerErrors, setPassengerErrors] = useState({})
  
  // Ref to track if updates are from WebSocket (to prevent infinite save loops)
  const isUpdatingFromWebSocket = useRef(false)

  useEffect(() => {
    loadLiftShares()
  }, [])
  
  // Set up WebSocket listener for real-time lift share updates
  useEffect(() => {
    const socket = getSocket()
    
    socket.on('liftshares:updated', (updatedLiftShares) => {
      if (Array.isArray(updatedLiftShares)) {
        isUpdatingFromWebSocket.current = true
        setLiftShares(updatedLiftShares)
        setTimeout(() => {
          isUpdatingFromWebSocket.current = false
        }, 100)
      }
    })
    
    return () => {
      socket.off('liftshares:updated')
    }
  }, [])

  const loadLiftShares = async () => {
    try {
      setLoading(true)
      const data = await fetchLiftShares()
      setLiftShares(data || [])
    } catch (error) {
      console.error('Error loading lift shares:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleDriverSubmit = async (e) => {
    e.preventDefault()
    const newErrors = {}

    if (!driverName.trim()) {
      newErrors.name = 'Name is required'
    }

    if (availableSeats < 1 || availableSeats > 8) {
      newErrors.seats = 'You must select between 1 and 8 seats'
    }

    if (Object.keys(newErrors).length > 0) {
      setDriverErrors(newErrors)
      return
    }

    const newLiftShare = {
      id: Date.now().toString(),
      driverName: driverName.trim(),
      whereFrom: whereFrom.trim(),
      availableSeats: parseInt(availableSeats),
      passengers: [],
      createdAt: new Date().toISOString()
    }

    try {
      const updated = [...liftShares, newLiftShare]
      setLiftShares(updated)
      await saveLiftShares(updated)
      setShowDriverForm(false)
      setDriverName('')
      setWhereFrom('')
      setAvailableSeats(1)
      setDriverErrors({})
    } catch (error) {
      console.error('Error saving lift share:', error)
      alert('Failed to save lift share. Please try again.')
    }
  }

  const handlePassengerSubmit = async (e) => {
    e.preventDefault()
    const newErrors = {}

    if (!passengerName.trim()) {
      newErrors.name = 'Name is required'
    }

    if (Object.keys(newErrors).length > 0) {
      setPassengerErrors(newErrors)
      return
    }

    const selectedLift = liftShares.find(ls => ls.id === selectedLiftId)
    if (!selectedLift) {
      alert('Selected lift not found')
      return
    }

    // Check if seat is still available
    if (selectedLift.passengers.length >= selectedLift.availableSeats) {
      alert('Sorry, this lift is now full')
      setShowPassengerForm(false)
      setSelectedLiftId(null)
      await loadLiftShares()
      return
    }

    // Check if name is already a passenger in this lift (case-insensitive)
    const nameExists = selectedLift.passengers.some(p => 
      p.name && p.name.toLowerCase().trim() === passengerName.toLowerCase().trim()
    )
    if (nameExists) {
      newErrors.name = 'This name is already registered as a passenger in this lift'
      setPassengerErrors(newErrors)
      return
    }

    // Check if name is the driver
    if (selectedLift.driverName.toLowerCase().trim() === passengerName.toLowerCase().trim()) {
      newErrors.name = 'You cannot be a passenger in your own lift'
      setPassengerErrors(newErrors)
      return
    }

    const newPassenger = {
      name: passengerName.trim(),
      joinedAt: new Date().toISOString()
    }

    try {
      const updated = liftShares.map(ls => 
        ls.id === selectedLiftId
          ? { ...ls, passengers: [...ls.passengers, newPassenger] }
          : ls
      )
      setLiftShares(updated)
      await saveLiftShares(updated)
      setShowPassengerForm(false)
      setSelectedLiftId(null)
      setPassengerName('')
      setPassengerErrors({})
    } catch (error) {
      console.error('Error saving passenger:', error)
      alert('Failed to save passenger. Please try again.')
    }
  }

  const handleRemovePassenger = async (liftId, passengerIndex) => {
    if (!confirm('Are you sure you want to remove this passenger?')) {
      return
    }

    try {
      const updated = liftShares.map(ls => 
        ls.id === liftId
          ? { ...ls, passengers: ls.passengers.filter((_, index) => index !== passengerIndex) }
          : ls
      )
      setLiftShares(updated)
      await saveLiftShares(updated)
    } catch (error) {
      console.error('Error removing passenger:', error)
      alert('Failed to remove passenger. Please try again.')
    }
  }

  const handleRemoveLift = async (liftId) => {
    if (!confirm('Are you sure you want to remove this lift? All passengers will be removed.')) {
      return
    }

    try {
      const updated = liftShares.filter(ls => ls.id !== liftId)
      setLiftShares(updated)
      await saveLiftShares(updated)
    } catch (error) {
      console.error('Error removing lift:', error)
      alert('Failed to remove lift. Please try again.')
    }
  }

  const getAvailableSeats = (liftShare) => {
    return Math.max(0, liftShare.availableSeats - liftShare.passengers.length)
  }

  if (loading) {
    return (
      <div className="lift-sharing-container">
        <p>Loading...</p>
      </div>
    )
  }

  return (
    <div className="lift-sharing-container">
      <h2>🚗 Lift Sharing</h2>
      <p className="lift-sharing-description">
        Organise lift sharing for the Christmas party. Drivers can offer available seats, and passengers can sign up for lifts.
      </p>

      <div className="lift-sharing-actions">
        <button 
          onClick={() => {
            setShowDriverForm(!showDriverForm)
            setShowPassengerForm(false)
            setSelectedLiftId(null)
          }}
          className="action-button driver-button"
        >
          {showDriverForm ? 'Cancel' : '🚗 Offer a Lift'}
        </button>
      </div>

      {showDriverForm && (
        <div className="lift-form-container">
          <h3>Offer a Lift</h3>
          <form onSubmit={handleDriverSubmit} className="lift-form">
            <div className="form-group">
              <label htmlFor="driver-name">Your Name *</label>
              <input
                type="text"
                id="driver-name"
                value={driverName}
                onChange={(e) => {
                  setDriverName(e.target.value)
                  if (driverErrors.name) {
                    setDriverErrors({ ...driverErrors, name: null })
                  }
                }}
                placeholder="Your full name"
                className={driverErrors.name ? 'error' : ''}
              />
              {driverErrors.name && <span className="error-message">{driverErrors.name}</span>}
            </div>

            <div className="form-group">
              <label htmlFor="where-from">Where From</label>
              <input
                type="text"
                id="where-from"
                value={whereFrom}
                onChange={(e) => setWhereFrom(e.target.value)}
                placeholder="e.g., City Centre, Station, etc."
              />
              <p className="field-hint">Where will you be picking up passengers from?</p>
            </div>

            <div className="form-group">
              <label htmlFor="available-seats">Available Seats *</label>
              <select
                id="available-seats"
                value={availableSeats}
                onChange={(e) => {
                  setAvailableSeats(parseInt(e.target.value))
                  if (driverErrors.seats) {
                    setDriverErrors({ ...driverErrors, seats: null })
                  }
                }}
                className={driverErrors.seats ? 'error' : ''}
              >
                {[1, 2, 3, 4, 5, 6, 7, 8].map(num => (
                  <option key={num} value={num}>{num}</option>
                ))}
              </select>
              {driverErrors.seats && <span className="error-message">{driverErrors.seats}</span>}
              <p className="field-hint">How many passengers can you take?</p>
            </div>

            <div className="form-actions">
              <button type="submit" className="submit-button">
                Offer Lift
              </button>
            </div>
          </form>
        </div>
      )}

      {showPassengerForm && (
        <div className="lift-form-container">
          <h3>Sign Up for a Lift</h3>
          <form onSubmit={handlePassengerSubmit} className="lift-form">
            <div className="form-group">
              <label htmlFor="passenger-name">Your Name *</label>
              <input
                type="text"
                id="passenger-name"
                value={passengerName}
                onChange={(e) => {
                  setPassengerName(e.target.value)
                  if (passengerErrors.name) {
                    setPassengerErrors({ ...passengerErrors, name: null })
                  }
                }}
                placeholder="Your full name"
                className={passengerErrors.name ? 'error' : ''}
              />
              {passengerErrors.name && <span className="error-message">{passengerErrors.name}</span>}
            </div>

            <div className="form-actions">
              <button type="submit" className="submit-button">
                Sign Up
              </button>
              <button 
                type="button" 
                onClick={() => {
                  setShowPassengerForm(false)
                  setSelectedLiftId(null)
                  setPassengerName('')
                  setPassengerErrors({})
                }}
                className="cancel-button"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="lifts-list">
        <h3>Available Lifts</h3>
        {liftShares.length === 0 ? (
          <p className="no-lifts">No lifts available yet. Be the first to offer a lift!</p>
        ) : (
          <div className="lifts-grid">
            {liftShares.map(liftShare => {
              const available = getAvailableSeats(liftShare)
              const isFull = available === 0
              
              return (
                <div key={liftShare.id} className={`lift-card ${isFull ? 'full' : ''}`}>
                  <div className="lift-card-header">
                    <div className="lift-driver-info">
                      <span className="driver-icon">🚗</span>
                      <div>
                        <div className="driver-name">{liftShare.driverName}</div>
                        {liftShare.whereFrom && (
                          <div className="where-from">📍 {liftShare.whereFrom}</div>
                        )}
                      </div>
                    </div>
                    <div className="lift-seats-info">
                      <span className={`seats-badge ${isFull ? 'full' : 'available'}`}>
                        {available} / {liftShare.availableSeats} seats
                      </span>
                    </div>
                  </div>
                  
                  <div className="lift-passengers">
                    {liftShare.passengers.length > 0 ? (
                      <div className="passengers-list">
                        <div className="passengers-label">Passengers:</div>
                        {liftShare.passengers.map((passenger, index) => (
                          <div key={index} className="passenger-item">
                            <span className="passenger-name">{passenger.name}</span>
                            <button
                              onClick={() => handleRemovePassenger(liftShare.id, index)}
                              className="remove-passenger-button"
                              title="Remove passenger"
                            >
                              ×
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="no-passengers">No passengers yet</div>
                    )}
                  </div>

                  <div className="lift-card-actions">
                    {!isFull && (
                      <button
                        onClick={() => {
                          setShowPassengerForm(true)
                          setSelectedLiftId(liftShare.id)
                          setShowDriverForm(false)
                        }}
                        className="signup-button"
                      >
                        Sign Up for This Lift
                      </button>
                    )}
                    {isFull && (
                      <div className="full-badge">Full</div>
                    )}
                    <button
                      onClick={() => handleRemoveLift(liftShare.id)}
                      className="remove-lift-button"
                      title="Remove lift"
                    >
                      Remove Lift
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

export default LiftSharing

