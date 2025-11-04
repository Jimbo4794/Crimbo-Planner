import { useState, useEffect } from 'react'
import './SeatSelection.css'

function SeatSelection({ rsvps, tablesCount = 5, seatsPerTable = 8, onSeatSelect, onNewRSVP, onChangeSeat, onUpdateMenuChoices, onUpdateDietaryRequirements, onBackToMenu, menuCategories = [] }) {
  const [selectedTable, setSelectedTable] = useState(null)
  const [selectedSeat, setSelectedSeat] = useState(null)
  const [changeSeatMode, setChangeSeatMode] = useState(false)
  const [lookupEmail, setLookupEmail] = useState('')
  const [lookupError, setLookupError] = useState('')
  const [foundRSVP, setFoundRSVP] = useState(null)
  const [editingMenu, setEditingMenu] = useState(false)
  const [tempMenuChoices, setTempMenuChoices] = useState([])
  const [explicitlySignedOut, setExplicitlySignedOut] = useState(false)
  const [editingDietary, setEditingDietary] = useState(false)
  const [tempDietaryRequirements, setTempDietaryRequirements] = useState('')

  // Helper function to get menu option label by ID
  const getMenuOptionLabel = (menuId) => {
    for (const category of menuCategories) {
      const option = category.options.find(opt => opt.id === menuId)
      if (option) return option.label
    }
    return menuId.charAt(0).toUpperCase() + menuId.slice(1) // Fallback to capitalized ID
  }

  // Get the latest RSVP (the one that just submitted) - used for display purposes
  const latestRSVP = rsvps.length > 0 ? rsvps[rsvps.length - 1] : null
  
  // Auto-sign in user if they just submitted an RSVP
  useEffect(() => {
    // If there's a latest RSVP and no found RSVP, and user hasn't explicitly signed out, auto-sign them in
    // This happens when user submits an RSVP and is redirected to seating
    if (latestRSVP && !foundRSVP && !explicitlySignedOut) {
      // Check if this RSVP was recently submitted (within last 2 minutes)
      // This ensures we only auto-sign in for new submissions, not old ones loaded from storage
      const submittedTime = new Date(latestRSVP.submittedAt).getTime()
      const now = Date.now()
      const timeDiff = now - submittedTime
      
      // Auto-sign in if submitted within last 2 minutes (plenty of time for navigation)
      if (timeDiff < 120000) {
        setFoundRSVP(latestRSVP)
      }
    }
  }, [latestRSVP, foundRSVP, explicitlySignedOut])
  
  // User is "signed in" if they've looked up their reservation via email OR if they just submitted an RSVP
  // But not if they've explicitly signed out
  const isSignedIn = !explicitlySignedOut && !!foundRSVP
  const currentUser = foundRSVP

  // Create a map of occupied seats
  // Include all seats, including the current user's seat (so we can display it)
  const occupiedSeats = {}
  rsvps.forEach(rsvp => {
    if (rsvp.table && rsvp.seat) {
      const key = `${rsvp.table}-${rsvp.seat}`
      occupiedSeats[key] = rsvp
    }
  })

  const handleSeatClick = (tableNumber, seatNumber) => {
    // Only allow seat selection if user is signed in
    if (!isSignedIn) {
      alert('Please look up your reservation first to select a seat.')
      return
    }

    const key = `${tableNumber}-${seatNumber}`
    
    // Check if this is the user's current seat
    const isMySeat = currentUser && currentUser.table === tableNumber && currentUser.seat === seatNumber
    if (isMySeat) {
      alert('This is your current seat. Please select a different seat to change your reservation.')
      return
    }
    
    if (occupiedSeats[key]) {
      // Show who has this seat
      const occupant = occupiedSeats[key]
      alert(`This seat is occupied by ${occupant.name || occupant.email}`)
      return
    }

    setSelectedTable(tableNumber)
    setSelectedSeat(seatNumber)
  }

  const handleConfirmSeat = () => {
    if (selectedTable && selectedSeat && currentUser) {
      if (foundRSVP) {
        // Changing seat for existing RSVP
        onChangeSeat(foundRSVP.email, selectedTable, selectedSeat)
        // Update foundRSVP to reflect the change
        setFoundRSVP({ ...foundRSVP, table: selectedTable, seat: selectedSeat })
      } else if (latestRSVP) {
        // New seat selection for latest RSVP (auto-signed in)
        onSeatSelect(selectedTable, selectedSeat)
        // Update foundRSVP to reflect they're now signed in with a seat
        setFoundRSVP({ ...latestRSVP, table: selectedTable, seat: selectedSeat })
      } else {
        // This shouldn't happen if we're enforcing sign-in, but handle it gracefully
        alert('Please look up your reservation first.')
      }
      setSelectedTable(null)
      setSelectedSeat(null)
    }
  }

  const handleLookupEmail = (e) => {
    e.preventDefault()
    setLookupError('')
    
    if (!lookupEmail.trim()) {
      setLookupError('Please enter an email address')
      return
    }

    const validateEmail = (email) => {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      return emailRegex.test(email)
    }

    if (!validateEmail(lookupEmail)) {
      setLookupError('Please enter a valid email address')
      return
    }

    // Find RSVP by email (case-insensitive)
    const found = rsvps.find(r => r.email.toLowerCase() === lookupEmail.toLowerCase().trim())
    
    if (!found) {
      setLookupError('No reservation found with this email address')
      return
    }

    setFoundRSVP(found)
    setExplicitlySignedOut(false) // Reset sign out flag when they look up
    setLookupError('')
    
    // If they already have a seat, clear it from the occupied seats map
    // so they can see it as available for selection
    if (found.table && found.seat) {
      // Clear their current selection state
      setSelectedTable(null)
      setSelectedSeat(null)
    }
  }

  const cancelChangeSeat = () => {
    setChangeSeatMode(false)
    setLookupEmail('')
    setLookupError('')
    setFoundRSVP(null)
    setSelectedTable(null)
    setSelectedSeat(null)
    setEditingMenu(false)
    setEditingDietary(false)
  }

  const handleSignOut = () => {
    setFoundRSVP(null)
    setExplicitlySignedOut(true)
    setSelectedTable(null)
    setSelectedSeat(null)
    setEditingMenu(false)
    setEditingDietary(false)
    setChangeSeatMode(false)
    setLookupEmail('')
    setLookupError('')
  }

  const handleStartEditMenu = () => {
    if (currentUser) {
      setTempMenuChoices([...currentUser.menuChoices])
      setEditingMenu(true)
    }
  }

  const handleStartEditDietary = () => {
    if (currentUser) {
      setTempDietaryRequirements(currentUser.dietaryRequirements || '')
      setEditingDietary(true)
    }
  }

  const handleMenuToggle = (menuId) => {
    setTempMenuChoices(prev => 
      prev.includes(menuId)
        ? prev.filter(id => id !== menuId)
        : [...prev, menuId]
    )
  }

  const handleSaveMenuChoices = () => {
    if (tempMenuChoices.length === 0) {
      alert('Please select at least one menu option')
      return
    }

    if (currentUser && onUpdateMenuChoices) {
      onUpdateMenuChoices(currentUser.email, tempMenuChoices)
      // Update foundRSVP to reflect the change
      setFoundRSVP({ ...foundRSVP, menuChoices: tempMenuChoices })
      setEditingMenu(false)
    }
  }

  const handleCancelEditMenu = () => {
    setEditingMenu(false)
    setTempMenuChoices([])
  }

  const handleSaveDietaryRequirements = () => {
    if (currentUser && onUpdateDietaryRequirements) {
      onUpdateDietaryRequirements(currentUser.email, tempDietaryRequirements)
      // Update foundRSVP to reflect the change
      setFoundRSVP({ ...foundRSVP, dietaryRequirements: tempDietaryRequirements.trim() })
      setEditingDietary(false)
    }
  }

  const handleCancelEditDietary = () => {
    setEditingDietary(false)
    setTempDietaryRequirements('')
  }

  const renderTable = (tableNumber) => {
    const seats = []
    // Use responsive sizing - adjust for mobile
    const isMobile = window.innerWidth <= 768
    const tableSize = isMobile ? 240 : 280
    const seatSize = isMobile ? 60 : 70
    const radius = isMobile ? 95 : 110 // Distance from center of table to center of seat
    const centerX = tableSize / 2 // Half of table width
    const centerY = tableSize / 2 // Half of table height
    
    for (let i = 1; i <= seatsPerTable; i++) {
      const key = `${tableNumber}-${i}`
      const isOccupied = !!occupiedSeats[key]
      const isSelected = selectedTable === tableNumber && selectedSeat === i
      const occupant = occupiedSeats[key]
      
      // Check if this is the current user's seat
      const isMySeat = currentUser && currentUser.table === tableNumber && currentUser.seat === i

      // Allow selection if seat is not occupied (can't select your own seat)
      const canSelect = !isOccupied && isSignedIn
      
      // Calculate angle for circular positioning (starting from top, going clockwise)
      // Start at -90 degrees (top) and distribute evenly
      const angle = ((i - 1) * (360 / seatsPerTable) - 90) * (Math.PI / 180)
      const x = centerX + radius * Math.cos(angle) - (seatSize / 2) // Center the seat
      const y = centerY + radius * Math.sin(angle) - (seatSize / 2) // Center the seat
      
      seats.push(
        <div
          key={i}
          className={`seat ${isOccupied ? 'occupied' : ''} ${isSelected ? 'selected' : ''} ${!isSignedIn ? 'disabled' : ''} ${isMySeat ? 'my-seat' : ''}`}
          onClick={() => canSelect && handleSeatClick(tableNumber, i)}
          style={{
            left: `${x}px`,
            top: `${y}px`
          }}
          title={
            isMySeat
              ? `Your seat - Click to change`
              : isOccupied 
                ? `Occupied by ${occupant.name || occupant.email}` 
                : !isSignedIn 
                  ? 'Please look up your reservation first' 
                  : `Seat ${i}`
          }
        >
          {isOccupied ? (
            <div className="seat-occupied">
              {occupant.iconType === 'image' && occupant.icon ? (
                <img src={occupant.icon} alt={occupant.name || 'Seat'} className="seat-icon-image" />
              ) : (
                <div className="seat-icon">{occupant.icon || '👤'}</div>
              )}
              <div className="seat-name">{occupant.name || occupant.email}</div>
            </div>
          ) : (
            <span className="seat-number">{i}</span>
          )}
          {isMySeat && (
            <div className="my-seat-badge">You</div>
          )}
        </div>
      )
    }

    return (
      <div key={tableNumber} className="table-container">
        <h3>Table {tableNumber}</h3>
        <div className="table">{seats}</div>
        <div className="table-info">
          <span className="seat-count">
            {Object.keys(occupiedSeats).filter(key => key.startsWith(`${tableNumber}-`)).length} / {seatsPerTable} seats
          </span>
        </div>
      </div>
    )
  }

  return (
    <div className="seat-selection-container">
      <div className="seat-selection-header">
        <h2>Choose Your Seat</h2>
        
        {/* Show email lookup if not signed in */}
        {!isSignedIn && (
          <div className="change-seat-form">
            <h3>Look Up Your Reservation</h3>
            <p className="lookup-description">Please enter your email address to access the seating plan and select a seat.</p>
            <form onSubmit={handleLookupEmail}>
              <div className="form-group-inline">
                <input
                  type="email"
                  value={lookupEmail}
                  onChange={(e) => {
                    setLookupEmail(e.target.value)
                    setLookupError('')
                  }}
                  placeholder="Enter your email address"
                  className={lookupError ? 'error' : ''}
                />
                <button type="submit" className="lookup-button">Look Up</button>
              </div>
              {lookupError && <span className="error-message">{lookupError}</span>}
            </form>
          </div>
        )}

        {/* Show user info if signed in */}
        {isSignedIn && currentUser && (
          <div className="rsvp-info">
            <p>Welcome, {currentUser.name || currentUser.email}!</p>
            {currentUser.table && currentUser.seat && (
              <div className="current-seat-info">
                <p className="current-seat-label">
                  <strong>Your Current Seat:</strong> Seat {currentUser.seat} at Table {currentUser.table}
                </p>
                <p className="current-seat-hint">✨ Your seat is highlighted in green on the seating plan below</p>
              </div>
            )}
            {!currentUser.seat && (
              <p className="no-seat-message">
                You haven't selected a seat yet. Choose a seat below to reserve your spot!
              </p>
            )}
            {!editingMenu ? (
              <div className="menu-summary-section">
                <div className="menu-summary-header">
                  <p className="menu-summary">
                    <strong>Menu choices:</strong> {currentUser.menuChoices.map(id => getMenuOptionLabel(id)).join(', ')}
                  </p>
                  <button onClick={handleStartEditMenu} className="edit-menu-button">
                    Edit Menu
                  </button>
                </div>
              </div>
            ) : (
              <div className="edit-menu-section">
                <h4>Edit Your Menu Choices</h4>
                <p className="menu-edit-description">Select at least one menu option from any category:</p>
                <div className="menu-categories-edit">
                  {menuCategories.map(category => (
                    <div key={category.category} className="menu-category-edit">
                      <h5 className="menu-category-title-edit">{category.category}</h5>
                      <div className="menu-options-edit">
                        {category.options.map(option => (
                          <div key={option.id} className="menu-option-edit">
                            <label className="menu-checkbox-edit">
                              <input
                                type="checkbox"
                                checked={tempMenuChoices.includes(option.id)}
                                onChange={() => handleMenuToggle(option.id)}
                              />
                              <div className="menu-option-content-edit">
                                <span className="menu-option-label-edit">{option.label}</span>
                                <span className="menu-option-description-edit">{option.description}</span>
                              </div>
                            </label>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="menu-edit-actions">
                  <button onClick={handleCancelEditMenu} className="cancel-edit-button">
                    Cancel
                  </button>
                  <button onClick={handleSaveMenuChoices} className="save-menu-button">
                    Save Changes
                  </button>
                </div>
              </div>
            )}
            
            {!editingDietary ? (
              <div className="dietary-section">
                <div className="dietary-header">
                  <p className="dietary-summary">
                    <strong>Dietary Requirements:</strong> {currentUser.dietaryRequirements || 'None specified'}
                  </p>
                  <button onClick={handleStartEditDietary} className="edit-dietary-button">
                    Edit
                  </button>
                </div>
              </div>
            ) : (
              <div className="edit-dietary-section">
                <h4>Edit Your Dietary Requirements</h4>
                <textarea
                  value={tempDietaryRequirements}
                  onChange={(e) => setTempDietaryRequirements(e.target.value)}
                  placeholder="Please list any allergies, dietary restrictions, or special requirements"
                  rows={4}
                  className="dietary-textarea-edit"
                />
                <div className="dietary-edit-actions">
                  <button onClick={handleCancelEditDietary} className="cancel-edit-button">
                    Cancel
                  </button>
                  <button onClick={handleSaveDietaryRequirements} className="save-dietary-button">
                    Save Changes
                  </button>
                </div>
              </div>
            )}

            {isSignedIn && currentUser && currentUser.seat && (
              <>
                <p className="change-seat-instruction">Select a new seat below to change your reservation:</p>
                <button onClick={handleSignOut} className="cancel-button">Sign Out</button>
              </>
            )}
            {isSignedIn && currentUser && !currentUser.seat && (
              <button onClick={handleSignOut} className="cancel-button">Sign Out</button>
            )}
          </div>
        )}

        {isSignedIn && currentUser && currentUser.seat && (
          <div className="confirmation-banner">
            ✅ {currentUser.name || currentUser.email} - Seat {currentUser.seat} at Table {currentUser.table} confirmed!
          </div>
        )}
      </div>

      <div className="legend">
        <div className="legend-item">
          <div className="seat-legend empty"></div>
          <span>Available</span>
        </div>
        <div className="legend-item">
          <div className="seat-legend occupied"></div>
          <span>Occupied</span>
        </div>
        <div className="legend-item">
          <div className="seat-legend selected"></div>
          <span>Selected</span>
        </div>
      </div>

      <div className="tables-grid">
        {Array.from({ length: tablesCount }, (_, i) => renderTable(i + 1))}
      </div>

      {selectedTable && selectedSeat && (
        <div className="dialog-overlay" onClick={() => {
          setSelectedTable(null)
          setSelectedSeat(null)
        }}>
          <div className="seat-confirmation-dialog" onClick={(e) => e.stopPropagation()}>
            <h3>Confirm Seat Selection</h3>
            <p>You've selected <strong>Seat {selectedSeat}</strong> at <strong>Table {selectedTable}</strong></p>
            <div className="dialog-actions">
              <button 
                onClick={() => {
                  setSelectedTable(null)
                  setSelectedSeat(null)
                }} 
                className="cancel-dialog-button"
              >
                Cancel
              </button>
              <button onClick={handleConfirmSeat} className="confirm-button">
                {foundRSVP && currentUser?.seat ? 'Confirm Seat Change' : 'Confirm Seat Selection'}
              </button>
            </div>
          </div>
        </div>
      )}

      {onBackToMenu && (
        <div className="seat-selection-actions">
          <button onClick={onBackToMenu} className="back-to-menu-button">
            Back to Menu
          </button>
        </div>
      )}
    </div>
  )
}

export default SeatSelection

