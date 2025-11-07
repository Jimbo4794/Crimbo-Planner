import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import './SeatSelection.css'
import { conflictsWithDietaryPreferences } from '../utils/dietaryConflicts'
import { AUTO_SIGNIN_TIMEOUT } from '../utils/constants'

function SeatSelection({ rsvps, tablesCount = 5, seatsPerTable = 8, tablePositions = null, customAreas = null, gridCols = 12, gridRows = 8, tableDisplayNames = null, onSeatSelect, onChangeSeat, onUpdateMenuChoices, onUpdateDietaryRequirements, onUpdateDietaryPreferences, onBackToMenu, onNavigate, menuCategories = [] }) {
  const [lookupEmail, setLookupEmail] = useState('')
  const [lookupError, setLookupError] = useState('')
  const [foundRSVP, setFoundRSVP] = useState(null)
  const [showLookupDialog, setShowLookupDialog] = useState(false)
  const [expandedTable, setExpandedTable] = useState(null) // Track which table is shown in dialog
  const [editingMenu, setEditingMenu] = useState(false)
  const [tempMenuChoices, setTempMenuChoices] = useState([])
  const [explicitlySignedOut, setExplicitlySignedOut] = useState(false)
  const [editingDietary, setEditingDietary] = useState(false)
  const [tempDietaryRequirements, setTempDietaryRequirements] = useState('')
  const [tempVegetarian, setTempVegetarian] = useState(false)
  const [tempVegan, setTempVegan] = useState(false)
  const [tempGlutenIntolerant, setTempGlutenIntolerant] = useState(false)
  const [tempLactoseIntolerant, setTempLactoseIntolerant] = useState(false)
  const [menuErrors, setMenuErrors] = useState({})
  const menuChoicesRef = useRef([])
  
  // Keep ref in sync with state
  useEffect(() => {
    menuChoicesRef.current = tempMenuChoices
  }, [tempMenuChoices])

  // Handle Escape key to close dialogs
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        if (showLookupDialog) {
          setShowLookupDialog(false)
          setLookupEmail('')
          setLookupError('')
        }
        if (expandedTable !== null) {
          setExpandedTable(null)
        }
      }
    }
    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [showLookupDialog, expandedTable])

  // Helper function to get menu option label by ID
  const getMenuOptionLabel = (menuId) => {
    for (const category of menuCategories) {
      const option = category.options.find(opt => opt.id === menuId)
      if (option) return option.label
    }
    return menuId.charAt(0).toUpperCase() + menuId.slice(1) // Fallback to capitalized ID
  }

  // Helper function to get table display name
  const getTableDisplayName = (tableNumber) => {
    if (tableDisplayNames && tableDisplayNames[tableNumber]) {
      return tableDisplayNames[tableNumber]
    }
    return `Table ${tableNumber}`
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
      if (timeDiff < AUTO_SIGNIN_TIMEOUT) {
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
      setShowLookupDialog(true)
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

    // Automatically confirm seat selection
    if (currentUser) {
      if (foundRSVP) {
        // Changing seat for existing RSVP
        onChangeSeat(foundRSVP.email, tableNumber, seatNumber)
        // Update foundRSVP to reflect the change
        setFoundRSVP({ ...foundRSVP, table: tableNumber, seat: seatNumber })
      } else if (latestRSVP) {
        // New seat selection for latest RSVP (auto-signed in)
        onSeatSelect(tableNumber, seatNumber)
        // Update foundRSVP to reflect they're now signed in with a seat
        setFoundRSVP({ ...latestRSVP, table: tableNumber, seat: seatNumber })
      } else {
        // This shouldn't happen if we're enforcing sign-in, but handle it gracefully
        alert('Please look up your reservation first.')
      }
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
    setShowLookupDialog(false) // Close dialog on successful lookup
    setLookupEmail('') // Clear email field
  }

  const handleSignOut = () => {
    setFoundRSVP(null)
    setExplicitlySignedOut(true)
    setEditingMenu(false)
    setEditingDietary(false)
    setLookupEmail('')
    setLookupError('')
  }

  const handleStartEditMenu = () => {
    if (currentUser) {
      setTempMenuChoices([...currentUser.menuChoices])
      setTempVegetarian(currentUser.vegetarian || false)
      setTempVegan(currentUser.vegan || false)
      setTempGlutenIntolerant(currentUser.glutenIntolerant || false)
      setTempLactoseIntolerant(currentUser.lactoseIntolerant || false)
      setMenuErrors({})
      setEditingMenu(true)
    }
  }

  const handleStartEditDietary = () => {
    if (currentUser) {
      setTempDietaryRequirements(currentUser.dietaryRequirements || '')
      setEditingDietary(true)
    }
  }

  // Helper function to find menu option by ID
  const findMenuOption = (optionId) => {
    for (const category of menuCategories) {
      const option = category.options.find(opt => opt.id === optionId)
      if (option) return option
    }
    return null
  }

  // Wrapper function for conflictsWithDietaryPreferences with current dietary preferences
  const checkConflicts = (optionId, optionLabel, optionDescription) => {
    const menuOption = findMenuOption(optionId)
    return conflictsWithDietaryPreferences(
      optionId,
      optionLabel,
      optionDescription,
      menuOption,
      tempVegetarian,
      tempVegan,
      tempGlutenIntolerant,
      tempLactoseIntolerant
    )
  }

  // Effect to automatically unselect conflicting menu items when dietary preferences change
  useEffect(() => {
    if (!editingMenu) return
    
    const currentChoices = menuChoicesRef.current
    if (currentChoices.length === 0) return

    // Check each selected menu choice for conflicts
    const conflictingChoices = currentChoices.filter(choiceId => {
      // Find the menu option
      let menuOption = null
      for (const category of menuCategories) {
        const option = category.options.find(opt => opt.id === choiceId)
        if (option) {
          menuOption = option
          break
        }
      }
      
      if (!menuOption) return false

      // Check conflicts using shared utility
      return conflictsWithDietaryPreferences(
        choiceId,
        menuOption.label || '',
        menuOption.description || '',
        menuOption,
        tempVegetarian,
        tempVegan,
        tempGlutenIntolerant,
        tempLactoseIntolerant
      )
    })

    // If there are conflicting choices, remove them
    if (conflictingChoices.length > 0) {
      setTempMenuChoices(prevChoices => 
        prevChoices.filter(choiceId => !conflictingChoices.includes(choiceId))
      )
    }
  }, [tempVegetarian, tempVegan, tempGlutenIntolerant, tempLactoseIntolerant, menuCategories, editingMenu])

  // Helper function to check if an option should be disabled
  const isOptionDisabled = (optionId, category, option) => {
    // Find the category that contains this option
    const categoryData = menuCategories.find(cat => 
      cat.options.some(opt => opt.id === optionId)
    )
    
    if (!categoryData) return false
    
    // Get all option IDs from this category
    const categoryOptionIds = categoryData.options.map(opt => opt.id)
    
    // Find which option is currently selected in this category
    const selectedInCategory = tempMenuChoices.find(id => categoryOptionIds.includes(id))
    
    // Disable if another option is selected in this category (but not this one)
    const categoryConflict = selectedInCategory !== undefined && selectedInCategory !== optionId
    
    // Disable if conflicts with dietary preferences
    const dietaryConflict = checkConflicts(
      optionId, 
      option?.label, 
      option?.description
    )
    
    return categoryConflict || dietaryConflict
  }

  const handleMenuToggle = (menuId, category) => {
    // Find the category that contains this menu option
    const categoryData = menuCategories.find(cat => 
      cat.options.some(opt => opt.id === menuId)
    )
    
    if (!categoryData) return
    
    setTempMenuChoices(prev => {
      // Get all option IDs from this category
      const categoryOptionIds = categoryData.options.map(opt => opt.id)
      
      // Remove any existing selections from this category
      const withoutCategory = prev.filter(id => !categoryOptionIds.includes(id))
      
      // If this option is already selected, deselect it
      if (prev.includes(menuId)) {
        return withoutCategory
      }
      
      // Otherwise, add this option (only one per category)
      return [...withoutCategory, menuId]
    })
    
    // Clear error when user selects something
    if (menuErrors.menuChoices) {
      setMenuErrors({ ...menuErrors, menuChoices: null })
    }
  }

  const handleSaveMenuChoices = () => {
    const newErrors = {}

    // Check if user has selected one option from each category
    const selectedCategories = menuCategories.filter(category =>
      category.options.some(option => tempMenuChoices.includes(option.id))
    )
    
    if (selectedCategories.length !== menuCategories.length) {
      newErrors.menuChoices = 'Please select one option from each category (starter, main, and dessert)'
    }

    if (Object.keys(newErrors).length > 0) {
      setMenuErrors(newErrors)
      return
    }

    // Update dietary preferences if they changed
    if (currentUser && onUpdateDietaryPreferences) {
      const dietaryChanged = 
        currentUser.vegetarian !== tempVegetarian ||
        currentUser.vegan !== tempVegan ||
        currentUser.glutenIntolerant !== tempGlutenIntolerant ||
        currentUser.lactoseIntolerant !== tempLactoseIntolerant

      if (dietaryChanged) {
        onUpdateDietaryPreferences(currentUser.email, {
          vegetarian: tempVegetarian,
          vegan: tempVegan,
          glutenIntolerant: tempGlutenIntolerant,
          lactoseIntolerant: tempLactoseIntolerant
        })
      }
    }

    // Update menu choices
    if (currentUser && onUpdateMenuChoices) {
      onUpdateMenuChoices(currentUser.email, tempMenuChoices)
      // Update foundRSVP to reflect the change
      setFoundRSVP({ 
        ...foundRSVP, 
        menuChoices: tempMenuChoices,
        vegetarian: tempVegetarian,
        vegan: tempVegan,
        glutenIntolerant: tempGlutenIntolerant,
        lactoseIntolerant: tempLactoseIntolerant
      })
      setEditingMenu(false)
      setMenuErrors({})
    }
  }

  const handleCancelEditMenu = () => {
    setEditingMenu(false)
    setTempMenuChoices([])
    setMenuErrors({})
    // Reset dietary preferences to original values
    if (currentUser) {
      setTempVegetarian(currentUser.vegetarian || false)
      setTempVegan(currentUser.vegan || false)
      setTempGlutenIntolerant(currentUser.glutenIntolerant || false)
      setTempLactoseIntolerant(currentUser.lactoseIntolerant || false)
    }
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

  const renderTableInDialog = (tableNumber) => {
    const seats = []
    // Use responsive sizing - adjust for mobile
    const isMobile = window.innerWidth <= 768
    const tableSize = isMobile ? 240 : 320
    const seatSize = isMobile ? 60 : 70
    const radius = isMobile ? 95 : 120 // Distance from center of table to center of seat
    const centerX = tableSize / 2 // Half of table width
    const centerY = tableSize / 2 // Half of table height
    
    for (let i = 1; i <= seatsPerTable; i++) {
      const key = `${tableNumber}-${i}`
      const isOccupied = !!occupiedSeats[key]
      const occupant = occupiedSeats[key]
      
      // Check if this is the current user's seat
      const isMySeat = currentUser && currentUser.table === tableNumber && currentUser.seat === i
      
      // Calculate angle for circular positioning (starting from top, going clockwise)
      // Start at -90 degrees (top) and distribute evenly
      const angle = ((i - 1) * (360 / seatsPerTable) - 90) * (Math.PI / 180)
      const x = centerX + radius * Math.cos(angle) - (seatSize / 2) // Center the seat
      const y = centerY + radius * Math.sin(angle) - (seatSize / 2) // Center the seat
      
      seats.push(
        <div
          key={i}
          className={`seat ${isOccupied ? 'occupied' : ''} ${isMySeat ? 'my-seat' : ''}`}
          onClick={(e) => {
            e.stopPropagation() // Prevent dialog close from firing
            handleSeatClick(tableNumber, i)
          }}
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
                  ? 'Click to look up your reservation' 
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
      <div className="table" style={{ width: `${tableSize}px`, height: `${tableSize}px` }}>
        {seats}
      </div>
    )
  }

  const renderTable = (tableNumber) => {
    const handleTableClick = (e) => {
      // Don't handle table click if clicking on a seat
      if (e.target.closest('.seat') !== null) {
        return
      }
      
      // Open table in dialog (allowed for both signed in and not signed in users)
      setExpandedTable(tableNumber)
    }

    // Count occupied seats for this table
    const occupiedCount = Object.keys(occupiedSeats).filter(key => key.startsWith(`${tableNumber}-`)).length
    
    // Get all RSVPs for this table
    const tableRsvps = rsvps.filter(rsvp => rsvp.table === tableNumber && rsvp.seat)
    
    // Limit preview to first 6 icons, show "+X more" if there are more
    const maxPreviewIcons = 6
    const previewRsvps = tableRsvps.slice(0, maxPreviewIcons)
    const remainingCount = Math.max(0, tableRsvps.length - maxPreviewIcons)
    
    // Always show compact card view (table opens in dialog)
    return (
      <div 
        key={tableNumber} 
        className={`table-card ${!isSignedIn ? 'clickable-table' : ''}`} 
        data-table-number={tableNumber}
        onClick={handleTableClick}
      >
        <div className="table-card-header">
          <h3>
            {getTableDisplayName(tableNumber)}
          </h3>
        </div>
        {tableRsvps.length > 0 && (
          <div className="table-card-preview">
            {previewRsvps.map((rsvp, index) => (
              <div key={`${rsvp.email}-${index}`} className="table-card-seat-preview" title={rsvp.name || rsvp.email}>
                {rsvp.iconType === 'image' && rsvp.icon ? (
                  <img src={rsvp.icon} alt={rsvp.name || 'Seat'} className="table-card-seat-icon" />
                ) : (
                  <div className="table-card-seat-emoji">{rsvp.icon || '👤'}</div>
                )}
              </div>
            ))}
            {remainingCount > 0 && (
              <div className="table-card-seat-preview more-seats" title={`${remainingCount} more guest${remainingCount > 1 ? 's' : ''}`}>
                +{remainingCount}
              </div>
            )}
          </div>
        )}
        <div className="table-card-info">
          <span className="seat-count">
            {occupiedCount} / {seatsPerTable} seats
          </span>
        </div>
      </div>
    )
  }

  // Render dialogs using portals to ensure they're outside the container
  const lookupDialogContent = showLookupDialog && (
    <div className="dialog-overlay" onClick={() => {
      setShowLookupDialog(false)
      setLookupEmail('')
      setLookupError('')
    }}>
      <div className="lookup-dialog" onClick={(e) => e.stopPropagation()}>
        <h3>Look Up Your Reservation</h3>
        <p className="lookup-description">Please enter your email address to access the seating plan and select a seat.</p>
        <form onSubmit={handleLookupEmail}>
          <div className="form-group">
            <input
              type="email"
              value={lookupEmail}
              onChange={(e) => {
                setLookupEmail(e.target.value)
                setLookupError('')
              }}
              placeholder="Enter your email address"
              className={lookupError ? 'error' : ''}
              autoFocus
            />
            {lookupError && <span className="error-message">{lookupError}</span>}
          </div>
          <div className="dialog-actions">
            <button type="button" onClick={() => {
              setShowLookupDialog(false)
              setLookupEmail('')
              setLookupError('')
            }} className="cancel-dialog-button">
              Cancel
            </button>
            {onNavigate && (
              <button 
                type="button" 
                onClick={() => {
                  setShowLookupDialog(false)
                  setLookupEmail('')
                  setLookupError('')
                  onNavigate('rsvp')
                }} 
                className="new-rsvp-dialog-button"
              >
                Submit New RSVP
              </button>
            )}
            <button type="submit" className="lookup-button">
              Look Up
            </button>
          </div>
        </form>
      </div>
    </div>
  )

  const tableDialogContent = expandedTable !== null && (
    <div className="dialog-overlay" onClick={() => setExpandedTable(null)}>
      <div className="table-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="table-dialog-header">
          <h3>{getTableDisplayName(expandedTable)}</h3>
          <button 
            className="close-table-dialog-button"
            onClick={() => setExpandedTable(null)}
            aria-label="Close table"
          >
            ×
          </button>
        </div>
        <div className="table-dialog-content">
          {renderTableInDialog(expandedTable)}
        </div>
        <div className="table-dialog-info">
          <span className="seat-count">
            {Object.keys(occupiedSeats).filter(key => key.startsWith(`${expandedTable}-`)).length} / {seatsPerTable} seats
          </span>
        </div>
      </div>
    </div>
  )

  return (
    <>
      <div className="seat-selection-container">

      <div className="seat-selection-header">
        <h2>Choose Your Seat</h2>

        {/* Show user info if signed in */}
        {isSignedIn && currentUser && (
          <div className="rsvp-info">
            <p>Welcome, {currentUser.name || currentUser.email}!</p>
            {currentUser.table && currentUser.seat && (
              <div className="current-seat-info">
                <p className="current-seat-label">
                  <strong>Your Current Seat:</strong> Seat {currentUser.seat} at {getTableDisplayName(currentUser.table)}
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
                <p className="menu-edit-description">Select one starter, one main, and one dessert:</p>
                
                <div className="form-group">
                  <label>Dietary Preferences</label>
                  <div className="dietary-preferences">
                    <label className="dietary-checkbox">
                      <input
                        type="checkbox"
                        checked={tempVegetarian}
                        onChange={(e) => setTempVegetarian(e.target.checked)}
                      />
                      <span>Vegetarian</span>
                    </label>
                    <label className="dietary-checkbox">
                      <input
                        type="checkbox"
                        checked={tempVegan}
                        onChange={(e) => setTempVegan(e.target.checked)}
                      />
                      <span>Vegan</span>
                    </label>
                    <label className="dietary-checkbox">
                      <input
                        type="checkbox"
                        checked={tempGlutenIntolerant}
                        onChange={(e) => setTempGlutenIntolerant(e.target.checked)}
                      />
                      <span>Gluten Intolerant</span>
                    </label>
                    <label className="dietary-checkbox">
                      <input
                        type="checkbox"
                        checked={tempLactoseIntolerant}
                        onChange={(e) => setTempLactoseIntolerant(e.target.checked)}
                      />
                      <span>Lactose Intolerant</span>
                    </label>
                  </div>
                </div>

                <div className="form-group">
                  <label>Menu Choices *</label>
                  <div className="menu-categories-edit">
                    {menuCategories.map(category => (
                      <div key={category.category} className="menu-category-edit">
                        <h5 className="menu-category-title-edit">{category.category}</h5>
                        <div className="menu-options-edit">
                          {category.options.map(option => {
                            const isDisabled = isOptionDisabled(option.id, category, option)
                            const isDietaryConflict = checkConflicts(
                              option.id, 
                              option.label, 
                              option.description
                            )
                            return (
                              <div 
                                key={option.id} 
                                className={`menu-option-edit ${isDisabled ? 'disabled' : ''} ${isDietaryConflict ? 'dietary-conflict' : ''}`}
                                title={isDietaryConflict ? 'This item conflicts with your dietary preferences' : ''}
                              >
                                <label className="menu-checkbox-edit">
                                  <input
                                    type="checkbox"
                                    checked={tempMenuChoices.includes(option.id)}
                                    onChange={() => handleMenuToggle(option.id, category)}
                                    disabled={isDisabled}
                                  />
                                  <div className="menu-option-content-edit">
                                    <span className="menu-option-label-edit">{option.label}</span>
                                    <span className="menu-option-description-edit">{option.description}</span>
                                  </div>
                                </label>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                  {menuErrors.menuChoices && (
                    <span className="error-message">{menuErrors.menuChoices}</span>
                  )}
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
            ✅ {currentUser.name || currentUser.email} - Seat {currentUser.seat} at {getTableDisplayName(currentUser.table)} confirmed!
          </div>
        )}
      </div>

      <div className={`tables-grid ${tablePositions ? 'arranged' : ''}`} 
           style={tablePositions ? {
             gridTemplateColumns: `repeat(${gridCols}, 1fr)`,
             gridTemplateRows: `repeat(${gridRows}, minmax(100px, auto))`
           } : {}}>
        {/* Render custom areas if arrangement exists */}
        {tablePositions && customAreas && customAreas.map(area => {
          const areaWidth = (area.width || 1)
          const areaHeight = (area.height || 1)
          return (
            <div
              key={area.id}
              className="custom-area-display"
              style={{
                gridColumn: `${area.x + 1} / span ${areaWidth}`,
                gridRow: `${area.y + 1} / span ${areaHeight}`,
                zIndex: 0
              }}
              title={area.label}
            >
              <div className="custom-area-label">{area.label}</div>
            </div>
          )
        })}
        
        {/* Render tables */}
        {Array.from({ length: tablesCount }, (_, i) => {
          const tableNumber = i + 1
          const position = tablePositions?.find(p => p.tableNumber === tableNumber)
          return (
            <div
              key={tableNumber}
              className={position ? 'table-positioned' : ''}
              style={position ? {
                gridColumn: position.x + 1,
                gridRow: position.y + 1,
                zIndex: 1
              } : {}}
            >
              {renderTable(tableNumber)}
            </div>
          )
        })}
      </div>
      </div>

      {/* Render dialogs using portals to document body */}
      {lookupDialogContent && createPortal(lookupDialogContent, document.body)}
      {tableDialogContent && createPortal(tableDialogContent, document.body)}
    </>
  )
}

export default SeatSelection

