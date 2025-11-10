import { useState, useEffect } from 'react'
import './Admin.css'
import ImageCropper from './ImageCropper'
import { AVAILABLE_ICONS, MAX_IMAGE_SIZE } from '../utils/constants'
import { saveEventDetails, fetchFeedback, deleteFeedback, adminLogin, adminLogout, checkAdminSession } from '../api'

function Admin({ rsvps, menuCategories, tablesCount, seatsPerTable, tablePositions, customAreas, gridCols, gridRows, eventDetails, onUpdateRSVPs, onUpdateMenuCategories, onUpdateTablesCount, onUpdateSeatsPerTable, onUpdateTablePositions, onUpdateCustomAreas, onUpdateGridCols, onUpdateGridRows, onUpdateEventDetails, onBackToMenu }) {
  // Helper function to get menu option label by ID
  const getMenuOptionLabel = (menuId) => {
    for (const category of menuCategories) {
      const option = category.options.find(opt => opt.id === menuId)
      if (option) return option.label
    }
    return menuId.charAt(0).toUpperCase() + menuId.slice(1) // Fallback to capitalized ID
  }
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [password, setPassword] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [activeTab, setActiveTab] = useState('users') // 'users', 'menu', 'seating', 'arrangement', 'event', 'feedback', or 'storage'
  const [editingRSVP, setEditingRSVP] = useState(null)
  const [editingMenu, setEditingMenu] = useState(false)
  const [eventDetailsForm, setEventDetailsForm] = useState({
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
  const [savingEventDetails, setSavingEventDetails] = useState(false)
  const [eventDetailsMessage, setEventDetailsMessage] = useState(null)
  const [feedbackList, setFeedbackList] = useState([])
  const [loadingFeedback, setLoadingFeedback] = useState(false)
  const [adminSessionId, setAdminSessionId] = useState(() => {
    // Try to restore session from localStorage
    return localStorage.getItem('adminSessionId') || null
  })
  const [checkingSession, setCheckingSession] = useState(false)

  // Check if we have a valid session on mount
  useEffect(() => {
    if (adminSessionId) {
      setCheckingSession(true)
      checkAdminSession(adminSessionId)
        .then(() => {
          setIsAuthenticated(true)
        })
        .catch(() => {
          // Session invalid, clear it
          setAdminSessionId(null)
          localStorage.removeItem('adminSessionId')
        })
        .finally(() => {
          setCheckingSession(false)
        })
    }
  }, [adminSessionId])

  const handlePasswordSubmit = async (e) => {
    e.preventDefault()
    setPasswordError('')
    
    try {
      const result = await adminLogin(password)
      if (result.success && result.sessionId) {
        setAdminSessionId(result.sessionId)
        localStorage.setItem('adminSessionId', result.sessionId)
        setIsAuthenticated(true)
        setPassword('')
        setPasswordError('')
      }
    } catch (error) {
      setPasswordError(error.message || 'Incorrect password')
      setPassword('')
    }
  }

  const handleSignOut = async () => {
    if (adminSessionId) {
      try {
        await adminLogout(adminSessionId)
      } catch (error) {
        console.error('Error logging out:', error)
      }
    }
    setAdminSessionId(null)
    localStorage.removeItem('adminSessionId')
    setIsAuthenticated(false)
    setPassword('')
    setPasswordError('')
    setEditingRSVP(null)
    setEditingMenu(false)
  }

  // Load event details when tab is opened or eventDetails prop changes
  useEffect(() => {
    if (eventDetails) {
      setEventDetailsForm(eventDetails)
    }
  }, [eventDetails])

  // Load feedback when feedback tab is opened
  useEffect(() => {
    if (activeTab === 'feedback' && isAuthenticated) {
      loadFeedback()
    }
  }, [activeTab, isAuthenticated])

  const loadFeedback = async () => {
    try {
      setLoadingFeedback(true)
      const data = await fetchFeedback()
      setFeedbackList(data || [])
    } catch (error) {
      console.error('Error loading feedback:', error)
    } finally {
      setLoadingFeedback(false)
    }
  }

  const handleDeleteFeedback = async (feedbackId) => {
    if (!window.confirm('Are you sure you want to delete this feedback?')) {
      return
    }

    try {
      await deleteFeedback(feedbackId)
      const updatedFeedback = feedbackList.filter(f => f.id !== feedbackId)
      setFeedbackList(updatedFeedback)
    } catch (error) {
      console.error('Error deleting feedback:', error)
      alert('Failed to delete feedback. Please try again.')
    }
  }

  const handleEventDetailsInputChange = (field, value) => {
    setEventDetailsForm(prev => ({
      ...prev,
      [field]: value
    }))
    if (eventDetailsMessage) {
      setEventDetailsMessage(null)
    }
  }

  const handleSaveEventDetails = async (e) => {
    e.preventDefault()
    try {
      setSavingEventDetails(true)
      await saveEventDetails(eventDetailsForm)
      if (onUpdateEventDetails) {
        onUpdateEventDetails(eventDetailsForm)
      }
      setEventDetailsMessage({ type: 'success', text: 'Event details saved successfully!' })
      setTimeout(() => setEventDetailsMessage(null), 3000)
    } catch (error) {
      console.error('Error saving event details:', error)
      setEventDetailsMessage({ type: 'error', text: 'Failed to save event details. Please try again.' })
    } finally {
      setSavingEventDetails(false)
    }
  }

  const handleDeleteRSVP = (rsvpId) => {
    if (window.confirm('Are you sure you want to delete this RSVP?')) {
      const updatedRSVPs = rsvps.filter(r => r.id !== rsvpId)
      onUpdateRSVPs(updatedRSVPs)
      if (editingRSVP && editingRSVP.id === rsvpId) {
        setEditingRSVP(null)
      }
    }
  }

  const handleEditRSVP = (rsvp) => {
    setEditingRSVP({ 
      ...rsvp, 
      icon: rsvp.icon || '🎄',
      iconType: rsvp.iconType || 'emoji'
    })
  }

  const handleAdminImageSelect = (e, setEditingRSVP) => {
    const file = e.target.files[0]
    if (file) {
      if (!file.type.startsWith('image/')) {
        alert('Please select a valid image file')
        return
      }
      if (file.size > MAX_IMAGE_SIZE) {
        alert('Image size must be less than 5MB')
        return
      }
      // Store file temporarily for cropping
      setEditingRSVP(prev => ({ ...prev, _tempImageFile: file, _showCropper: true, iconType: 'image' }))
    }
  }

  const handleAdminCropComplete = (croppedImage, setEditingRSVP) => {
    setEditingRSVP(prev => ({ 
      ...prev, 
      icon: croppedImage, 
      _tempImageFile: null, 
      _showCropper: false 
    }))
  }

  const handleAdminCancelCrop = (setEditingRSVP) => {
    setEditingRSVP(prev => ({ 
      ...prev, 
      _tempImageFile: null, 
      _showCropper: false 
    }))
  }

  const handleSaveRSVP = () => {
    if (!editingRSVP) return
    
    if (!editingRSVP.name || !editingRSVP.name.trim()) {
      alert('Name is required')
      return
    }
    
    if (!editingRSVP.email || !editingRSVP.email.trim()) {
      alert('Email is required')
      return
    }
    
    if (editingRSVP.menuChoices.length === 0) {
      alert('At least one menu choice is required')
      return
    }
    
    const updatedRSVPs = rsvps.map(r => 
      r.id === editingRSVP.id ? editingRSVP : r
    )
    onUpdateRSVPs(updatedRSVPs)
    setEditingRSVP(null)
  }

  const handleCancelEditRSVP = () => {
    setEditingRSVP(null)
  }

  const handleExportCSV = () => {
    // Helper function to get menu choices for a specific category
    const getMenuChoicesForCategory = (menuChoiceIds, categoryName) => {
      // Find the category
      const category = menuCategories.find(cat => 
        cat.category.toLowerCase() === categoryName.toLowerCase()
      )
      if (!category) return []
      
      // Get menu choice IDs that belong to this category
      const categoryChoiceIds = category.options.map(opt => opt.id)
      const matchingChoices = menuChoiceIds.filter(id => categoryChoiceIds.includes(id))
      
      // Return the labels for matching choices
      return matchingChoices.map(id => getMenuOptionLabel(id))
    }
    
    // Create CSV header
    const headers = ['Name', 'Email', 'Starter', 'Mains', 'Dessert', 'Vegetarian', 'Vegan', 'Gluten Intolerant', 'Lactose Intolerant', 'Dietary Requirements', 'Table', 'Seat']
    
    // Convert RSVPs to CSV rows
    const csvRows = [
      headers.join(',')
    ]
    
    rsvps.forEach(rsvp => {
      const starterChoices = getMenuChoicesForCategory(rsvp.menuChoices, 'Starters')
      const mainsChoices = getMenuChoicesForCategory(rsvp.menuChoices, 'Mains')
      const dessertChoices = getMenuChoicesForCategory(rsvp.menuChoices, 'Desserts')
      
      const starterStr = `"${starterChoices.join('; ').replace(/"/g, '""')}"`
      const mainsStr = `"${mainsChoices.join('; ').replace(/"/g, '""')}"`
      const dessertStr = `"${dessertChoices.join('; ').replace(/"/g, '""')}"`
      const dietaryStr = `"${(rsvp.dietaryRequirements || '').replace(/"/g, '""')}"` // Escape quotes in CSV
      const row = [
        `"${rsvp.name}"`,
        `"${rsvp.email}"`,
        starterStr,
        mainsStr,
        dessertStr,
        rsvp.vegetarian ? 'Yes' : 'No',
        rsvp.vegan ? 'Yes' : 'No',
        rsvp.glutenIntolerant ? 'Yes' : 'No',
        rsvp.lactoseIntolerant ? 'Yes' : 'No',
        dietaryStr,
        rsvp.table || '',
        rsvp.seat || ''
      ]
      csvRows.push(row.join(','))
    })
    
    // Create CSV content
    const csvContent = csvRows.join('\n')
    
    // Create blob and download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    link.setAttribute('href', url)
    link.setAttribute('download', `crimbo-planner-rsvps-${new Date().toISOString().split('T')[0]}.csv`)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  if (checkingSession) {
    return (
      <div className="admin-container">
        <div className="admin-login">
          <h2>Admin Login</h2>
          <p>Checking session...</p>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return (
      <div className="admin-container">
        <div className="admin-login">
          <h2>Admin Login</h2>
          <form onSubmit={handlePasswordSubmit}>
            <div className="form-group">
              <label htmlFor="admin-password">Password</label>
              <input
                type="password"
                id="admin-password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value)
                  setPasswordError('')
                }}
                placeholder="Enter admin password"
                className={passwordError ? 'error' : ''}
                disabled={checkingSession}
              />
              {passwordError && <span className="error-message">{passwordError}</span>}
            </div>
            <button type="submit" className="login-button" disabled={checkingSession}>
              {checkingSession ? 'Logging in...' : 'Login'}
            </button>
          </form>
        </div>
      </div>
    )
  }

  return (
    <div className="admin-container">
      <div className="admin-header">
        <h2>Admin Panel</h2>
        <button onClick={handleSignOut} className="sign-out-button">Sign Out</button>
      </div>

      <div className="admin-tabs">
        <button
          className={`tab-button ${activeTab === 'users' ? 'active' : ''}`}
          onClick={() => setActiveTab('users')}
        >
          Users ({rsvps.length})
        </button>
        <button
          className={`tab-button ${activeTab === 'menu' ? 'active' : ''}`}
          onClick={() => setActiveTab('menu')}
        >
          Menu Options
        </button>
        <button
          className={`tab-button ${activeTab === 'seating' ? 'active' : ''}`}
          onClick={() => setActiveTab('seating')}
        >
          Seating Configuration
        </button>
        <button
          className={`tab-button ${activeTab === 'arrangement' ? 'active' : ''}`}
          onClick={() => setActiveTab('arrangement')}
        >
          Table Arrangement
        </button>
        <button
          className={`tab-button ${activeTab === 'event' ? 'active' : ''}`}
          onClick={() => setActiveTab('event')}
        >
          Event Details
        </button>
        <button
          className={`tab-button ${activeTab === 'feedback' ? 'active' : ''}`}
          onClick={() => setActiveTab('feedback')}
        >
          Feedback ({feedbackList.length})
        </button>
        <button
          className={`tab-button ${activeTab === 'storage' ? 'active' : ''}`}
          onClick={() => setActiveTab('storage')}
        >
          Data Management
        </button>
      </div>

      <div className="admin-content">
        {activeTab === 'users' && (
          <div className="users-section">
            <div className="users-section-header">
              <h3>RSVP Management</h3>
              <button onClick={handleExportCSV} className="export-button">
                📥 Export to CSV
              </button>
            </div>
            {rsvps.length === 0 ? (
              <p className="no-data">No RSVPs yet</p>
            ) : (
              <div className="rsvps-list">
                {rsvps.map(rsvp => (
                  <div key={rsvp.id} className="rsvp-card">
                    {editingRSVP && editingRSVP.id === rsvp.id ? (
                      <div className="edit-rsvp-form">
                        <div className="form-group">
                          <label>Name</label>
                          <input
                            type="text"
                            value={editingRSVP.name}
                            onChange={(e) => setEditingRSVP({ ...editingRSVP, name: e.target.value })}
                          />
                        </div>
                        <div className="form-group">
                          <label>Email</label>
                          <input
                            type="email"
                            value={editingRSVP.email}
                            onChange={(e) => setEditingRSVP({ ...editingRSVP, email: e.target.value })}
                          />
                        </div>
                        <div className="form-group">
                          <label>Table</label>
                          <input
                            type="number"
                            value={editingRSVP.table || ''}
                            onChange={(e) => setEditingRSVP({ ...editingRSVP, table: e.target.value ? parseInt(e.target.value) : null })}
                          />
                        </div>
                        <div className="form-group">
                          <label>Seat</label>
                          <input
                            type="number"
                            value={editingRSVP.seat || ''}
                            onChange={(e) => setEditingRSVP({ ...editingRSVP, seat: e.target.value ? parseInt(e.target.value) : null })}
                          />
                        </div>
                        <div className="form-group">
                          <label>Dietary Preferences</label>
                          <div className="admin-dietary-preferences">
                            <label className="admin-dietary-checkbox">
                              <input
                                type="checkbox"
                                checked={editingRSVP.vegetarian || false}
                                onChange={(e) => setEditingRSVP({ ...editingRSVP, vegetarian: e.target.checked })}
                              />
                              <span>Vegetarian</span>
                            </label>
                            <label className="admin-dietary-checkbox">
                              <input
                                type="checkbox"
                                checked={editingRSVP.vegan || false}
                                onChange={(e) => setEditingRSVP({ ...editingRSVP, vegan: e.target.checked })}
                              />
                              <span>Vegan</span>
                            </label>
                            <label className="admin-dietary-checkbox">
                              <input
                                type="checkbox"
                                checked={editingRSVP.glutenIntolerant || false}
                                onChange={(e) => setEditingRSVP({ ...editingRSVP, glutenIntolerant: e.target.checked })}
                              />
                              <span>Gluten Intolerant</span>
                            </label>
                            <label className="admin-dietary-checkbox">
                              <input
                                type="checkbox"
                                checked={editingRSVP.lactoseIntolerant || false}
                                onChange={(e) => setEditingRSVP({ ...editingRSVP, lactoseIntolerant: e.target.checked })}
                              />
                              <span>Lactose Intolerant</span>
                            </label>
                          </div>
                        </div>
                        <div className="form-group">
                          <label>Additional Dietary Requirements</label>
                          <textarea
                            value={editingRSVP.dietaryRequirements || ''}
                            onChange={(e) => setEditingRSVP({ ...editingRSVP, dietaryRequirements: e.target.value })}
                            placeholder="Additional dietary requirements, allergies, or special needs"
                            rows={3}
                            className="admin-textarea"
                          />
                        </div>
                        <div className="form-group">
                          <label>Icon</label>
                          <div className="admin-icon-type-selector">
                            <button
                              type="button"
                              className={`admin-icon-type-button ${(!editingRSVP.iconType || editingRSVP.iconType === 'emoji') ? 'active' : ''}`}
                              onClick={() => setEditingRSVP({ ...editingRSVP, iconType: 'emoji', icon: editingRSVP.icon && editingRSVP.iconType === 'image' ? '🎄' : editingRSVP.icon || '🎄' })}
                            >
                              Emoji
                            </button>
                            <button
                              type="button"
                              className={`admin-icon-type-button ${editingRSVP.iconType === 'image' ? 'active' : ''}`}
                              onClick={() => setEditingRSVP({ ...editingRSVP, iconType: 'image' })}
                            >
                              Image
                            </button>
                          </div>

                          {(!editingRSVP.iconType || editingRSVP.iconType === 'emoji') && (
                            <>
                              <div className="admin-icon-selection">
                                {AVAILABLE_ICONS.map((icon, index) => (
                                  <button
                                    key={index}
                                    type="button"
                                    className={`admin-icon-option ${editingRSVP.icon === icon ? 'selected' : ''}`}
                                    onClick={() => setEditingRSVP({ ...editingRSVP, icon, iconType: 'emoji' })}
                                    title={`Select ${icon}`}
                                  >
                                    {icon}
                                  </button>
                                ))}
                              </div>
                              <p className="form-help">Current icon: {editingRSVP.icon || '🎄'}</p>
                            </>
                          )}

                          {editingRSVP.iconType === 'image' && (
                            <>
                              <div className="admin-image-upload-section">
                                {editingRSVP.icon && editingRSVP.iconType === 'image' && editingRSVP.icon.startsWith('data:') ? (
                                  <div className="admin-selected-image-preview">
                                    <img src={editingRSVP.icon} alt="Selected" className="admin-preview-image" />
                                    <button 
                                      type="button" 
                                      onClick={() => setEditingRSVP({ ...editingRSVP, icon: '🎄', iconType: 'emoji' })} 
                                      className="admin-remove-image-button"
                                    >
                                      Remove Image
                                    </button>
                                  </div>
                                ) : (
                                  <label htmlFor="admin-image-upload" className="admin-image-upload-label">
                                    <input
                                      type="file"
                                      id="admin-image-upload"
                                      accept="image/*"
                                      onChange={(e) => handleAdminImageSelect(e, setEditingRSVP)}
                                      style={{ display: 'none' }}
                                    />
                                    <span className="admin-upload-button">📷 Upload Image</span>
                                  </label>
                                )}
                              </div>
                              <p className="form-help">
                                {editingRSVP.icon && editingRSVP.icon.startsWith('data:')
                                  ? 'Image uploaded. Click "Remove Image" to change.'
                                  : 'Upload an image and crop it to a circular shape.'}
                              </p>
                            </>
                          )}

                          {editingRSVP._showCropper && editingRSVP._tempImageFile && (
                            <ImageCropper
                              imageFile={editingRSVP._tempImageFile}
                              onCropComplete={(img) => handleAdminCropComplete(img, setEditingRSVP)}
                              onCancel={() => handleAdminCancelCrop(setEditingRSVP)}
                            />
                          )}
                        </div>
                        <div className="form-group">
                          <label>Menu Choices</label>
                          <div className="admin-menu-choices">
                            {menuCategories.map(category => (
                              <div key={category.category} className="admin-menu-category">
                                <strong>{category.category}:</strong>
                                <div className="admin-menu-options">
                                  {category.options.map(option => (
                                    <label key={option.id} className="admin-menu-checkbox">
                                      <input
                                        type="checkbox"
                                        checked={editingRSVP.menuChoices.includes(option.id)}
                                        onChange={(e) => {
                                          if (e.target.checked) {
                                            setEditingRSVP({ ...editingRSVP, menuChoices: [...editingRSVP.menuChoices, option.id] })
                                          } else {
                                            setEditingRSVP({ ...editingRSVP, menuChoices: editingRSVP.menuChoices.filter(id => id !== option.id) })
                                          }
                                        }}
                                      />
                                      <span>{option.label}</span>
                                    </label>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                        <div className="form-actions">
                          <button onClick={handleSaveRSVP} className="save-button">Save</button>
                          <button onClick={handleCancelEditRSVP} className="cancel-button">Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="rsvp-info">
                          <h4>
                            {rsvp.iconType === 'image' && rsvp.icon && rsvp.icon.startsWith('data:') ? (
                              <img src={rsvp.icon} alt={rsvp.name} className="rsvp-info-icon-image" />
                            ) : (
                              <span>{rsvp.icon || '🎄'}</span>
                            )} {rsvp.name}
                          </h4>
                          <p><strong>Email:</strong> {rsvp.email}</p>
                          <p><strong>Menu Choices:</strong> {rsvp.menuChoices.map(id => getMenuOptionLabel(id)).join(', ')}</p>
                          <p><strong>Dietary Preferences:</strong> {
                            [
                              rsvp.vegetarian && 'Vegetarian',
                              rsvp.vegan && 'Vegan',
                              rsvp.glutenIntolerant && 'Gluten Intolerant',
                              rsvp.lactoseIntolerant && 'Lactose Intolerant'
                            ].filter(Boolean).join(', ') || 'None'
                          }</p>
                          <p><strong>Additional Dietary Requirements:</strong> {rsvp.dietaryRequirements || 'None specified'}</p>
                          {rsvp.table && rsvp.seat ? (
                            <p><strong>Seat:</strong> Table {rsvp.table}, Seat {rsvp.seat}</p>
                          ) : (
                            <p><strong>Seat:</strong> Not assigned</p>
                          )}
                          <p className="submitted-date"><strong>Submitted:</strong> {new Date(rsvp.submittedAt).toLocaleString()}</p>
                        </div>
                        <div className="rsvp-actions">
                          <button onClick={() => handleEditRSVP(rsvp)} className="edit-button">Edit</button>
                          <button onClick={() => handleDeleteRSVP(rsvp.id)} className="delete-button">Delete</button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'menu' && (
          <MenuManagement 
            menuCategories={menuCategories}
            onUpdateMenuCategories={onUpdateMenuCategories}
          />
        )}

        {activeTab === 'seating' && (
          <SeatingConfiguration
            tablesCount={tablesCount}
            seatsPerTable={seatsPerTable}
            onUpdateTablesCount={onUpdateTablesCount}
            onUpdateSeatsPerTable={onUpdateSeatsPerTable}
          />
        )}

        {activeTab === 'arrangement' && (
          <TableArrangement
            tablesCount={tablesCount}
            tablePositions={tablePositions}
            customAreas={customAreas}
            gridCols={gridCols}
            gridRows={gridRows}
            onUpdateTablePositions={onUpdateTablePositions}
            onUpdateCustomAreas={onUpdateCustomAreas}
            onUpdateGridCols={onUpdateGridCols}
            onUpdateGridRows={onUpdateGridRows}
          />
        )}

        {activeTab === 'event' && (
          <div className="event-details-admin-section">
            <h3>Event Details Management</h3>
            {eventDetailsMessage && (
              <div className={`admin-message ${eventDetailsMessage.type}`}>
                {eventDetailsMessage.text}
              </div>
            )}
            <form onSubmit={handleSaveEventDetails} className="event-details-admin-form">
              <div className="form-section">
                <h4>Basic Information</h4>
                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="admin-event-name">Event Name *</label>
                    <input
                      type="text"
                      id="admin-event-name"
                      value={eventDetailsForm.eventName}
                      onChange={(e) => handleEventDetailsInputChange('eventName', e.target.value)}
                      placeholder="e.g., Christmas Party 2024"
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="admin-date">Date</label>
                    <input
                      type="date"
                      id="admin-date"
                      value={eventDetailsForm.date}
                      onChange={(e) => handleEventDetailsInputChange('date', e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="admin-time">Time</label>
                    <input
                      type="time"
                      id="admin-time"
                      value={eventDetailsForm.time}
                      onChange={(e) => handleEventDetailsInputChange('time', e.target.value)}
                    />
                  </div>
                </div>
              </div>

              <div className="form-section">
                <h4>Location</h4>
                <div className="form-group">
                  <label htmlFor="admin-location">Venue Name</label>
                  <input
                    type="text"
                    id="admin-location"
                    value={eventDetailsForm.location}
                    onChange={(e) => handleEventDetailsInputChange('location', e.target.value)}
                    placeholder="e.g., Grand Hotel, Community Centre"
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="admin-address">Address</label>
                  <textarea
                    id="admin-address"
                    value={eventDetailsForm.address}
                    onChange={(e) => handleEventDetailsInputChange('address', e.target.value)}
                    placeholder="Full address including postcode"
                    rows={3}
                  />
                </div>
              </div>

              <div className="form-section">
                <h4>Event Description</h4>
                <div className="form-group">
                  <label htmlFor="admin-description">Description</label>
                  <textarea
                    id="admin-description"
                    value={eventDetailsForm.description}
                    onChange={(e) => handleEventDetailsInputChange('description', e.target.value)}
                    placeholder="Tell guests about the event..."
                    rows={5}
                  />
                </div>
              </div>

              <div className="form-section">
                <h4>Contact Information</h4>
                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="admin-contact-email">Contact Email</label>
                    <input
                      type="email"
                      id="admin-contact-email"
                      value={eventDetailsForm.contactEmail}
                      onChange={(e) => handleEventDetailsInputChange('contactEmail', e.target.value)}
                      placeholder="contact@example.com"
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="admin-contact-phone">Contact Phone</label>
                    <input
                      type="tel"
                      id="admin-contact-phone"
                      value={eventDetailsForm.contactPhone}
                      onChange={(e) => handleEventDetailsInputChange('contactPhone', e.target.value)}
                      placeholder="+44 1234 567890"
                    />
                  </div>
                </div>
              </div>

              <div className="form-section">
                <h4>Additional Information</h4>
                <div className="form-group">
                  <label htmlFor="admin-dress-code">Dress Code</label>
                  <input
                    type="text"
                    id="admin-dress-code"
                    value={eventDetailsForm.dressCode}
                    onChange={(e) => handleEventDetailsInputChange('dressCode', e.target.value)}
                    placeholder="e.g., Smart Casual, Black Tie, Festive"
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="admin-additional-info">Additional Information</label>
                  <textarea
                    id="admin-additional-info"
                    value={eventDetailsForm.additionalInfo}
                    onChange={(e) => handleEventDetailsInputChange('additionalInfo', e.target.value)}
                    placeholder="Any other important information for guests..."
                    rows={4}
                  />
                </div>
              </div>

              <div className="form-actions">
                <button type="submit" className="save-button" disabled={savingEventDetails}>
                  {savingEventDetails ? 'Saving...' : 'Save Event Details'}
                </button>
              </div>
            </form>
          </div>
        )}
        {activeTab === 'feedback' && (
          <div className="feedback-admin-section">
            <div className="feedback-section-header">
              <h3>Feedback Management</h3>
              <button onClick={loadFeedback} className="refresh-button" disabled={loadingFeedback}>
                {loadingFeedback ? 'Loading...' : '🔄 Refresh'}
              </button>
            </div>
            {loadingFeedback ? (
              <p className="loading-text">Loading feedback...</p>
            ) : feedbackList.length === 0 ? (
              <p className="no-data">No feedback submitted yet</p>
            ) : (
              <div className="feedback-list">
                {feedbackList.map((feedback) => (
                  <div key={feedback.id} className="feedback-item">
                    <div className="feedback-item-header">
                      <div className="feedback-meta">
                        <span className="feedback-name">{feedback.name || 'Anonymous'}</span>
                        {feedback.rating && (
                          <span className="feedback-rating">
                            {'⭐'.repeat(feedback.rating)}
                          </span>
                        )}
                      </div>
                      <div className="feedback-actions">
                        <span className="feedback-date">
                          {new Date(feedback.submittedAt).toLocaleString('en-GB', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </span>
                        <button
                          onClick={() => handleDeleteFeedback(feedback.id)}
                          className="delete-feedback-button"
                          title="Delete feedback"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                    <div className="feedback-text">
                      {feedback.feedbackText}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        {activeTab === 'storage' && (
          <StorageManagement
            rsvps={rsvps}
            menuCategories={menuCategories}
            tablesCount={tablesCount}
            seatsPerTable={seatsPerTable}
            onUpdateRSVPs={onUpdateRSVPs}
            onUpdateMenuCategories={onUpdateMenuCategories}
            onUpdateTablesCount={onUpdateTablesCount}
            onUpdateSeatsPerTable={onUpdateSeatsPerTable}
          />
        )}
      </div>
    </div>
  )
}

function MenuManagement({ menuCategories, onUpdateMenuCategories }) {
  const [editingCategory, setEditingCategory] = useState(null)
  const [tempMenuCategories, setTempMenuCategories] = useState(menuCategories)

  const handleStartEdit = () => {
    setTempMenuCategories(JSON.parse(JSON.stringify(menuCategories)))
    setEditingCategory(true)
  }

  const handleSaveMenu = () => {
    // Validate menu categories
    for (const category of tempMenuCategories) {
      if (!category.category || !category.category.trim()) {
        alert('All categories must have a name')
        return
      }
      
      if (category.options.length === 0) {
        alert(`Category "${category.category}" must have at least one option`)
        return
      }
      
      for (const option of category.options) {
        if (!option.label || !option.label.trim()) {
          alert('All menu options must have a name')
          return
        }
        if (!option.id || !option.id.trim()) {
          alert('All menu options must have an ID')
          return
        }
      }
    }
    
    onUpdateMenuCategories(tempMenuCategories)
    setEditingCategory(false)
  }

  const handleCancelEdit = () => {
    setTempMenuCategories(JSON.parse(JSON.stringify(menuCategories)))
    setEditingCategory(false)
  }

  const handleAddOption = (categoryIndex) => {
    const updated = [...tempMenuCategories]
    // Generate a unique ID based on category and timestamp
    const categoryName = updated[categoryIndex].category.toLowerCase().replace(/\s+/g, '-')
    updated[categoryIndex].options.push({
      id: `${categoryName}-${Date.now()}`,
      label: 'New Option',
      description: 'Description',
      vegetarian: false,
      vegan: false,
      glutenFree: false,
      lactoseFree: false
    })
    setTempMenuCategories(updated)
  }

  const handleRemoveOption = (categoryIndex, optionIndex) => {
    const updated = [...tempMenuCategories]
    updated[categoryIndex].options.splice(optionIndex, 1)
    setTempMenuCategories(updated)
  }

  const handleUpdateOption = (categoryIndex, optionIndex, field, value) => {
    const updated = [...tempMenuCategories]
    updated[categoryIndex].options[optionIndex][field] = value
    setTempMenuCategories(updated)
  }

  return (
    <div className="menu-management-section">
      <div className="menu-management-header">
        <h3>Menu Options Management</h3>
        {!editingCategory ? (
          <button onClick={handleStartEdit} className="edit-menu-button">Edit Menu</button>
        ) : (
          <div className="menu-edit-actions">
            <button onClick={handleSaveMenu} className="save-button">Save Changes</button>
            <button onClick={handleCancelEdit} className="cancel-button">Cancel</button>
          </div>
        )}
      </div>

      <div className="menu-categories-admin">
        {tempMenuCategories.map((category, categoryIndex) => (
          <div key={categoryIndex} className="menu-category-admin">
            <h4>{category.category}</h4>
            {editingCategory ? (
              <div className="menu-options-admin">
                {category.options.map((option, optionIndex) => (
                  <div key={option.id || optionIndex} className="menu-option-admin">
                    <div className="form-group">
                      <label>Option Name</label>
                      <input
                        type="text"
                        value={option.label}
                        onChange={(e) => handleUpdateOption(categoryIndex, optionIndex, 'label', e.target.value)}
                      />
                    </div>
                    <div className="form-group">
                      <label>Description</label>
                      <input
                        type="text"
                        value={option.description}
                        onChange={(e) => handleUpdateOption(categoryIndex, optionIndex, 'description', e.target.value)}
                      />
                    </div>
                    <div className="form-group">
                      <label>Dietary Information</label>
                      <div className="admin-menu-dietary-flags">
                        <label className="admin-menu-dietary-flag">
                          <input
                            type="checkbox"
                            checked={option.vegetarian || false}
                            onChange={(e) => handleUpdateOption(categoryIndex, optionIndex, 'vegetarian', e.target.checked)}
                          />
                          <span>Vegetarian</span>
                        </label>
                        <label className="admin-menu-dietary-flag">
                          <input
                            type="checkbox"
                            checked={option.vegan || false}
                            onChange={(e) => handleUpdateOption(categoryIndex, optionIndex, 'vegan', e.target.checked)}
                          />
                          <span>Vegan</span>
                        </label>
                        <label className="admin-menu-dietary-flag">
                          <input
                            type="checkbox"
                            checked={option.glutenFree || false}
                            onChange={(e) => handleUpdateOption(categoryIndex, optionIndex, 'glutenFree', e.target.checked)}
                          />
                          <span>Gluten Free</span>
                        </label>
                        <label className="admin-menu-dietary-flag">
                          <input
                            type="checkbox"
                            checked={option.lactoseFree || false}
                            onChange={(e) => handleUpdateOption(categoryIndex, optionIndex, 'lactoseFree', e.target.checked)}
                          />
                          <span>Lactose Free</span>
                        </label>
                      </div>
                      <p className="form-help">Check the dietary flags that apply to this menu item.</p>
                    </div>
                    <button 
                      onClick={() => handleRemoveOption(categoryIndex, optionIndex)}
                      className="remove-option-button"
                    >
                      Remove
                    </button>
                  </div>
                ))}
                <button 
                  onClick={() => handleAddOption(categoryIndex)}
                  className="add-option-button"
                >
                  + Add Option
                </button>
              </div>
            ) : (
              <div className="menu-options-display">
                {category.options.map((option, optionIndex) => (
                  <div key={option.id || optionIndex} className="menu-option-display">
                    <strong>{option.label}</strong>
                    <span>{option.description}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

function SeatingConfiguration({ tablesCount, seatsPerTable, onUpdateTablesCount, onUpdateSeatsPerTable }) {
  const [tempTablesCount, setTempTablesCount] = useState(tablesCount)
  const [tempSeatsPerTable, setTempSeatsPerTable] = useState(seatsPerTable)

  // Sync temp state when props change
  useEffect(() => {
    setTempTablesCount(tablesCount)
  }, [tablesCount])

  useEffect(() => {
    setTempSeatsPerTable(seatsPerTable)
  }, [seatsPerTable])

  const handleTablesCountChange = (e) => {
    const value = parseInt(e.target.value, 10)
    if (!isNaN(value) && value >= 1) {
      setTempTablesCount(value)
    }
  }

  const handleSeatsPerTableChange = (e) => {
    const value = parseInt(e.target.value, 10)
    if (!isNaN(value) && value >= 1) {
      setTempSeatsPerTable(value)
    }
  }

  const handleSave = () => {
    if (tempTablesCount < 1) {
      alert('Number of tables must be at least 1')
      return
    }
    if (tempSeatsPerTable < 1) {
      alert('Number of seats per table must be at least 1')
      return
    }
    onUpdateTablesCount(tempTablesCount)
    onUpdateSeatsPerTable(tempSeatsPerTable)
    alert('Seating configuration saved!')
  }

  const handleReset = () => {
    setTempTablesCount(tablesCount)
    setTempSeatsPerTable(seatsPerTable)
  }

  return (
    <div className="seating-configuration-section">
      <div className="seating-configuration-header">
        <h3>Seating Configuration</h3>
        <div className="seating-config-actions">
          <button onClick={handleSave} className="save-button">Save Changes</button>
          <button onClick={handleReset} className="cancel-button">Reset</button>
        </div>
      </div>

      <div className="seating-config-form">
        <div className="form-group">
          <label htmlFor="tables-count">Number of Tables</label>
          <input
            type="number"
            id="tables-count"
            min="1"
            value={tempTablesCount}
            onChange={handleTablesCountChange}
            className="admin-input"
          />
          <p className="form-help">Current: {tablesCount} table{tablesCount !== 1 ? 's' : ''}</p>
        </div>

        <div className="form-group">
          <label htmlFor="seats-per-table">Seats per Table</label>
          <input
            type="number"
            id="seats-per-table"
            min="1"
            value={tempSeatsPerTable}
            onChange={handleSeatsPerTableChange}
            className="admin-input"
          />
          <p className="form-help">Current: {seatsPerTable} seat{seatsPerTable !== 1 ? 's' : ''} per table</p>
        </div>

        <div className="seating-summary">
          <h4>Total Capacity</h4>
          <p className="capacity-display">
            {tempTablesCount * tempSeatsPerTable} total seats ({tempTablesCount} table{tempTablesCount !== 1 ? 's' : ''} × {tempSeatsPerTable} seat{tempSeatsPerTable !== 1 ? 's' : ''})
          </p>
        </div>
      </div>
    </div>
  )
}

function StorageManagement({ rsvps, menuCategories, tablesCount, seatsPerTable, onUpdateRSVPs, onUpdateMenuCategories, onUpdateTablesCount, onUpdateSeatsPerTable }) {
  const [importError, setImportError] = useState('')
  const [importSuccess, setImportSuccess] = useState('')

  const handleExportData = () => {
    const exportData = {
      rsvps,
      menuCategories,
      tablesCount,
      seatsPerTable,
      exportedAt: new Date().toISOString(),
      version: '1.0'
    }

    const jsonString = JSON.stringify(exportData, null, 2)
    const blob = new Blob([jsonString], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `crimbo-planner-backup-${new Date().toISOString().split('T')[0]}.json`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  const handleImportData = (e) => {
    const file = e.target.files[0]
    if (!file) return

    setImportError('')
    setImportSuccess('')

    const reader = new FileReader()
    reader.onload = (event) => {
      try {
        const importedData = JSON.parse(event.target.result)

        // Validate the imported data structure
        if (!importedData || typeof importedData !== 'object') {
          throw new Error('Invalid file format')
        }

        // Confirm with user before importing
        const confirmMessage = `This will replace all current data:\n\n` +
          `- ${importedData.rsvps?.length || 0} RSVPs\n` +
          `- ${importedData.menuCategories?.length || 0} menu categories\n` +
          `- ${importedData.tablesCount || 'N/A'} tables\n` +
          `- ${importedData.seatsPerTable || 'N/A'} seats per table\n\n` +
          `Are you sure you want to continue?`

        if (!window.confirm(confirmMessage)) {
          e.target.value = '' // Reset file input
          return
        }

        // Import the data
        if (importedData.rsvps && Array.isArray(importedData.rsvps)) {
          onUpdateRSVPs(importedData.rsvps)
        }

        if (importedData.menuCategories && Array.isArray(importedData.menuCategories)) {
          onUpdateMenuCategories(importedData.menuCategories)
        }

        if (importedData.tablesCount !== undefined && typeof importedData.tablesCount === 'number') {
          onUpdateTablesCount(importedData.tablesCount)
        }

        if (importedData.seatsPerTable !== undefined && typeof importedData.seatsPerTable === 'number') {
          onUpdateSeatsPerTable(importedData.seatsPerTable)
        }

        setImportSuccess('Data imported successfully!')
        e.target.value = '' // Reset file input

        // Clear success message after 3 seconds
        setTimeout(() => setImportSuccess(''), 3000)
      } catch (error) {
        console.error('Import error:', error)
        setImportError(`Failed to import data: ${error.message}`)
        e.target.value = '' // Reset file input
      }
    }

    reader.onerror = () => {
      setImportError('Failed to read file')
      e.target.value = '' // Reset file input
    }

    reader.readAsText(file)
  }

  const handleClearAllData = () => {
    const confirmMessage = `⚠️ WARNING: This will permanently delete ALL data:\n\n` +
      `- All RSVPs (${rsvps.length})\n` +
      `- All menu categories\n` +
      `- Seating configuration\n\n` +
      `This action cannot be undone!\n\n` +
      `Are you absolutely sure?`

    if (!window.confirm(confirmMessage)) {
      return
    }

    // Double confirmation
    if (!window.confirm('This is your last chance. Delete ALL data?')) {
      return
    }

    onUpdateRSVPs([])
    // Reset to defaults (you may want to add default menu categories)
    onUpdateTablesCount(5)
    onUpdateSeatsPerTable(8)
    
    alert('All data has been cleared.')
  }

  const getStorageInfo = () => {
    // Calculate approximate size from current data
    try {
      const rsvpsSize = new Blob([JSON.stringify(rsvps)]).size
      const menuSize = new Blob([JSON.stringify(menuCategories)]).size
      const configSize = new Blob([JSON.stringify({ tablesCount, seatsPerTable })]).size
      const totalSize = rsvpsSize + menuSize + configSize

      return {
        totalSize,
        totalSizeKB: (totalSize / 1024).toFixed(2),
        itemCount: 3
      }
    } catch (error) {
      return { totalSize: 0, totalSizeKB: '0', itemCount: 0 }
    }
  }

  const storageInfo = getStorageInfo()

  return (
    <div className="storage-management-section">
      <h3>Data Management</h3>
      
      <div className="storage-info">
        <h4>Current Storage</h4>
        <p className="storage-stats">
          <strong>Storage Location:</strong> Server container (persistent)<br />
          <strong>Data Size:</strong> {storageInfo.totalSizeKB} KB<br />
          <strong>RSVPs:</strong> {rsvps.length}<br />
          <strong>Menu Categories:</strong> {menuCategories.length}<br />
          <strong>Tables:</strong> {tablesCount}<br />
          <strong>Seats per Table:</strong> {seatsPerTable}
        </p>
      </div>

      <div className="storage-actions">
        <div className="storage-action-group">
          <h4>Export Data</h4>
          <p className="action-description">
            Export all data (RSVPs, menu, seating configuration) to a JSON file that can be saved anywhere on your computer.
          </p>
          <button onClick={handleExportData} className="export-data-button">
            📥 Export All Data to File
          </button>
        </div>

        <div className="storage-action-group">
          <h4>Import Data</h4>
          <p className="action-description">
            Import data from a previously exported JSON file. This will replace all current data.
          </p>
          <label htmlFor="import-file" className="import-file-label">
            <input
              type="file"
              id="import-file"
              accept=".json"
              onChange={handleImportData}
              style={{ display: 'none' }}
            />
            <span className="import-button">📤 Import Data from File</span>
          </label>
          {importError && <div className="error-message">{importError}</div>}
          {importSuccess && <div className="success-message">{importSuccess}</div>}
        </div>

        <div className="storage-action-group">
          <h4>Clear All Data</h4>
          <p className="action-description">
            Permanently delete all data. This cannot be undone!
          </p>
          <button onClick={handleClearAllData} className="clear-data-button">
            🗑️ Clear All Data
          </button>
        </div>
      </div>
    </div>
  )
}

function TableArrangement({ tablesCount, tablePositions, customAreas, gridCols = 12, gridRows = 8, onUpdateTablePositions, onUpdateCustomAreas, onUpdateGridCols, onUpdateGridRows }) {
  const GRID_COLS = gridCols
  const GRID_ROWS = gridRows
  const [editingPositions, setEditingPositions] = useState(() => {
    // Initialize positions from saved data or create default grid positions
    if (tablePositions && Array.isArray(tablePositions)) {
      return [...tablePositions]
    }
    // Default: arrange tables in a grid
    const positions = []
    const colsPerRow = Math.ceil(Math.sqrt(tablesCount))
    for (let i = 0; i < tablesCount; i++) {
      const row = Math.floor(i / colsPerRow)
      const col = i % colsPerRow
      positions.push({
        tableNumber: i + 1,
        x: Math.max(1, Math.min(GRID_COLS - 1, col * 2 + 2)),
        y: Math.max(1, Math.min(GRID_ROWS - 1, row * 2 + 2))
      })
    }
    return positions
  })
  const [editingAreas, setEditingAreas] = useState(() => {
    // Initialize areas with default width/height if not present
    if (customAreas && Array.isArray(customAreas)) {
      return customAreas.map(area => ({
        ...area,
        width: area.width || 1,
        height: area.height || 1
      }))
    }
    return []
  })
  const [draggedTable, setDraggedTable] = useState(null)
  const [draggedArea, setDraggedArea] = useState(null)
  const [resizingArea, setResizingArea] = useState(null)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  const [resizeStart, setResizeStart] = useState({ x: 0, y: 0, width: 0, height: 0 })
  const [newAreaLabel, setNewAreaLabel] = useState('')
  const [editingAreaId, setEditingAreaId] = useState(null)

  const handleSave = () => {
    onUpdateTablePositions(editingPositions)
    onUpdateCustomAreas(editingAreas.length > 0 ? editingAreas : null)
    alert('Table arrangement saved!')
  }

  const handleReset = () => {
    // Reset to default grid
    const positions = []
    const colsPerRow = Math.ceil(Math.sqrt(tablesCount))
    for (let i = 0; i < tablesCount; i++) {
      const row = Math.floor(i / colsPerRow)
      const col = i % colsPerRow
      positions.push({
        tableNumber: i + 1,
        x: Math.max(1, Math.min(GRID_COLS - 1, col * 2 + 2)),
        y: Math.max(1, Math.min(GRID_ROWS - 1, row * 2 + 2))
      })
    }
    setEditingPositions(positions)
  }

  const handleClear = () => {
    if (window.confirm('Clear all table positions and custom areas? Tables will use default grid layout.')) {
      onUpdateTablePositions(null)
      onUpdateCustomAreas(null)
      setEditingPositions([])
      setEditingAreas([])
      alert('Table arrangement cleared!')
    }
  }

  const handleAddArea = () => {
    if (!newAreaLabel.trim()) {
      alert('Please enter a label for the area')
      return
    }
    const newArea = {
      id: Date.now().toString(),
      label: newAreaLabel.trim(),
      x: 0,
      y: 0,
      width: 1,
      height: 1
    }
    setEditingAreas([...editingAreas, newArea])
    setNewAreaLabel('')
  }

  const handleDeleteArea = (areaId) => {
    if (window.confirm('Delete this custom area?')) {
      setEditingAreas(editingAreas.filter(area => area.id !== areaId))
    }
  }

  const handleEditAreaLabel = (areaId, newLabel) => {
    if (!newLabel.trim()) {
      return
    }
    setEditingAreas(editingAreas.map(area => 
      area.id === areaId ? { ...area, label: newLabel.trim() } : area
    ))
    setEditingAreaId(null)
  }

  const handleAreaResizeStart = (e, areaId) => {
    e.preventDefault()
    e.stopPropagation()
    const area = editingAreas.find(a => a.id === areaId)
    if (!area) return
    
    const grid = document.querySelector('.table-arrangement-grid')
    if (!grid) return
    
    const gridRect = grid.getBoundingClientRect()
    const cellSize = getGridCellSize()
    const startX = e.clientX
    const startY = e.clientY
    
    setResizeStart({
      x: area.x * cellSize,
      y: area.y * cellSize,
      width: (area.width || 1) * cellSize,
      height: (area.height || 1) * cellSize,
      startClientX: startX,
      startClientY: startY
    })
    setResizingArea(areaId)
    setDraggedArea(null)
  }

  const getGridCellSize = () => {
    return 60 // pixels per grid cell
  }

  const handleMouseDown = (e, tableNumber) => {
    e.preventDefault()
    const rect = e.currentTarget.getBoundingClientRect()
    setDragOffset({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    })
    setDraggedTable(tableNumber)
    setDraggedArea(null)
  }

  const handleAreaMouseDown = (e, areaId) => {
    e.preventDefault()
    const rect = e.currentTarget.getBoundingClientRect()
    setDragOffset({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    })
    setDraggedArea(areaId)
    setDraggedTable(null)
  }

  const handleMouseMove = (e) => {
    const grid = document.querySelector('.table-arrangement-grid')
    if (!grid) return
    
    const gridRect = grid.getBoundingClientRect()
    const cellSize = getGridCellSize()
    
    if (resizingArea) {
      // Handle resize
      const deltaX = e.clientX - resizeStart.startClientX
      const deltaY = e.clientY - resizeStart.startClientY
      
      const newWidth = Math.max(cellSize, resizeStart.width + deltaX)
      const newHeight = Math.max(cellSize, resizeStart.height + deltaY)
      
      const widthInCells = Math.round(newWidth / cellSize)
      const heightInCells = Math.round(newHeight / cellSize)
      
      setEditingAreas(prev => {
        return prev.map(area => {
          if (area.id === resizingArea) {
            const updated = {
              ...area,
              width: Math.max(1, Math.min(GRID_COLS - area.x, widthInCells)),
              height: Math.max(1, Math.min(GRID_ROWS - area.y, heightInCells))
            }
            // Ensure area doesn't go outside grid bounds
            if (updated.x + updated.width > GRID_COLS) {
              updated.width = Math.max(1, GRID_COLS - updated.x)
            }
            if (updated.y + updated.height > GRID_ROWS) {
              updated.height = Math.max(1, GRID_ROWS - updated.y)
            }
            return updated
          }
          return area
        })
      })
    } else {
      // Handle drag
      const x = Math.round((e.clientX - gridRect.left - dragOffset.x + cellSize / 2) / cellSize)
      const y = Math.round((e.clientY - gridRect.top - dragOffset.y + cellSize / 2) / cellSize)
      
      const clampedX = Math.max(0, Math.min(GRID_COLS - 1, x))
      const clampedY = Math.max(0, Math.min(GRID_ROWS - 1, y))
      
      if (draggedTable) {
        setEditingPositions(prev => {
          const updated = prev.map(pos => 
            pos.tableNumber === draggedTable 
              ? { ...pos, x: clampedX, y: clampedY }
              : pos
          )
          // If table doesn't exist, add it
          if (!updated.find(p => p.tableNumber === draggedTable)) {
            updated.push({ tableNumber: draggedTable, x: clampedX, y: clampedY })
          }
          return updated
        })
      } else if (draggedArea) {
        setEditingAreas(prev => {
          return prev.map(area => {
            if (area.id === draggedArea) {
              const width = area.width || 1
              const height = area.height || 1
              // Ensure area doesn't go outside grid bounds
              const maxX = Math.max(0, GRID_COLS - width)
              const maxY = Math.max(0, GRID_ROWS - height)
              return { 
                ...area, 
                x: Math.min(clampedX, maxX), 
                y: Math.min(clampedY, maxY)
              }
            }
            return area
          })
        })
      }
    }
  }

  const handleMouseUp = () => {
    setDraggedTable(null)
    setDraggedArea(null)
    setResizingArea(null)
  }

  useEffect(() => {
    if (draggedTable || draggedArea || resizingArea) {
      const moveHandler = (e) => handleMouseMove(e)
      const upHandler = () => handleMouseUp()
      document.addEventListener('mousemove', moveHandler)
      document.addEventListener('mouseup', upHandler)
      return () => {
        document.removeEventListener('mousemove', moveHandler)
        document.removeEventListener('mouseup', upHandler)
      }
    }
  }, [draggedTable, draggedArea, resizingArea, dragOffset, resizeStart])

  const cellSize = getGridCellSize()

  return (
    <div className="table-arrangement-section">
      <div className="table-arrangement-header">
        <h3>Table Arrangement</h3>
        <div className="table-arrangement-actions">
          <button onClick={handleSave} className="save-button">Save Arrangement</button>
          <button onClick={handleReset} className="cancel-button">Reset to Grid</button>
          <button onClick={handleClear} className="cancel-button">Clear Arrangement</button>
        </div>
      </div>
      
      <div className="grid-size-controls">
        <div className="grid-size-control-group">
          <label htmlFor="grid-cols">Grid Columns (X):</label>
          <input
            type="number"
            id="grid-cols"
            min="4"
            max="24"
            value={GRID_COLS}
            onChange={(e) => {
              const value = parseInt(e.target.value, 10)
              if (!isNaN(value) && value >= 4 && value <= 24) {
                onUpdateGridCols(value)
              }
            }}
            className="grid-size-input"
          />
        </div>
        <div className="grid-size-control-group">
          <label htmlFor="grid-rows">Grid Rows (Y):</label>
          <input
            type="number"
            id="grid-rows"
            min="4"
            max="24"
            value={GRID_ROWS}
            onChange={(e) => {
              const value = parseInt(e.target.value, 10)
              if (!isNaN(value) && value >= 4 && value <= 24) {
                onUpdateGridRows(value)
              }
            }}
            className="grid-size-input"
          />
        </div>
      </div>
      
      <p className="arrangement-description">
        Drag tables and custom areas to position them on the room layout. The arrangement will be saved and used in the seating plan view.
      </p>

      <div className="custom-areas-controls">
        <div className="add-area-control">
          <input
            type="text"
            value={newAreaLabel}
            onChange={(e) => setNewAreaLabel(e.target.value)}
            placeholder="Enter area label (e.g., Entrance, Bar, Stage)"
            className="area-label-input"
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                handleAddArea()
              }
            }}
          />
          <button onClick={handleAddArea} className="add-area-button">Add Area</button>
        </div>
      </div>

      <div className="table-arrangement-grid" style={{ width: GRID_COLS * cellSize, height: GRID_ROWS * cellSize }}>
        {/* Grid cells */}
        {Array.from({ length: GRID_ROWS }, (_, row) =>
          Array.from({ length: GRID_COLS }, (_, col) => (
            <div
              key={`${row}-${col}`}
              className="grid-cell"
              style={{
                position: 'absolute',
                left: col * cellSize,
                top: row * cellSize,
                width: cellSize,
                height: cellSize
              }}
            />
          ))
        )}
        
        {/* Tables */}
        {Array.from({ length: tablesCount }, (_, i) => {
          const tableNumber = i + 1
          const position = editingPositions.find(p => p.tableNumber === tableNumber) || { x: 0, y: 0 }
          return (
            <div
              key={tableNumber}
              className={`arrangement-table ${draggedTable === tableNumber ? 'dragging' : ''}`}
              style={{
                position: 'absolute',
                left: position.x * cellSize,
                top: position.y * cellSize,
                width: cellSize,
                height: cellSize,
                cursor: 'move'
              }}
              onMouseDown={(e) => handleMouseDown(e, tableNumber)}
            >
              <div className="arrangement-table-label">T{tableNumber}</div>
            </div>
          )
        })}
        
        {/* Custom Areas */}
        {editingAreas.map(area => {
          const areaWidth = (area.width || 1) * cellSize
          const areaHeight = (area.height || 1) * cellSize
          return (
            <div
              key={area.id}
              className={`arrangement-area ${draggedArea === area.id ? 'dragging' : ''} ${resizingArea === area.id ? 'resizing' : ''}`}
              style={{
                position: 'absolute',
                left: area.x * cellSize,
                top: area.y * cellSize,
                width: areaWidth,
                height: areaHeight,
                cursor: draggedArea === area.id ? 'move' : 'default'
              }}
              onMouseDown={(e) => {
                // Only handle drag if not clicking on resize handle or delete button
                if (!e.target.closest('.area-resize-handle') && !e.target.closest('.delete-area-button')) {
                  handleAreaMouseDown(e, area.id)
                }
              }}
            >
              {editingAreaId === area.id ? (
                <input
                  type="text"
                  defaultValue={area.label}
                  className="area-label-edit"
                  autoFocus
                  onBlur={(e) => handleEditAreaLabel(area.id, e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      handleEditAreaLabel(area.id, e.target.value)
                    }
                  }}
                  onClick={(e) => e.stopPropagation()}
                />
              ) : (
                <>
                  <div 
                    className="arrangement-area-label"
                    onDoubleClick={() => setEditingAreaId(area.id)}
                  >
                    {area.label}
                  </div>
                  <div 
                    className="area-resize-handle"
                    onMouseDown={(e) => handleAreaResizeStart(e, area.id)}
                    title="Drag to resize"
                  />
                  <button
                    className="delete-area-button"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleDeleteArea(area.id)
                    }}
                    title="Delete area"
                  >
                    ×
                  </button>
                </>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default Admin

