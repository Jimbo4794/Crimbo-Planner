import { useState, useEffect } from 'react'
import './Admin.css'
import ImageCropper from './ImageCropper'
import { AVAILABLE_ICONS, MAX_IMAGE_SIZE, MAX_BACKGROUND_IMAGE_SIZE } from '../utils/constants'
import { saveEventDetails, fetchFeedback, deleteFeedback, adminLogin, adminLogout, checkAdminSession, createManualBackup, fetchAwards, saveAwards, fetchFramies, fetchBackgroundImages, addBackgroundImage, deleteBackgroundImage } from '../api'
import { getSocket } from '../utils/websocket'
import logger from '../utils/logger'

function Admin({ rsvps, menuCategories, tablesCount, seatsPerTable, tablePositions, customAreas, gridCols, gridRows, eventDetails, rsvpLocked, seatingLocked, framiesNominationsLocked, framiesVotingLocked, onUpdateRSVPs, onUpdateMenuCategories, onUpdateTablesCount, onUpdateSeatsPerTable, onUpdateTablePositions, onUpdateCustomAreas, onUpdateGridCols, onUpdateGridRows, onUpdateEventDetails, onUpdateRsvpLocked, onUpdateSeatingLocked, onUpdateFramiesNominationsLocked, onUpdateFramiesVotingLocked, onBackToMenu }) {
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
  const [activeTab, setActiveTab] = useState('users') // 'users', 'menu', 'seating', 'arrangement', 'event', 'feedback', 'awards', 'background', or 'storage'
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
        logger.error('Error logging out:', error)
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
      logger.error('Error loading feedback:', error)
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
      logger.error('Error deleting feedback:', error)
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
      logger.error('Error saving event details:', error)
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
          className={`tab-button ${activeTab === 'awards' ? 'active' : ''}`}
          onClick={() => setActiveTab('awards')}
        >
          Awards
        </button>
        <button
          className={`tab-button ${activeTab === 'background' ? 'active' : ''}`}
          onClick={() => setActiveTab('background')}
        >
          Background Images
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
            
            <div className="lock-controls">
              <h4>Lock Controls</h4>
              <div className="lock-controls-row">
                <div className="lock-control-item">
                  <label htmlFor="rsvp-lock">
                    Lock RSVP Submissions:
                  </label>
                  <input
                    type="checkbox"
                    id="rsvp-lock"
                    checked={rsvpLocked}
                    onChange={(e) => onUpdateRsvpLocked(e.target.checked)}
                  />
                  <span className={`lock-status ${rsvpLocked ? 'locked' : 'unlocked'}`}>
                    {rsvpLocked ? '🔒 Locked' : '🔓 Unlocked'}
                  </span>
                </div>
                <div className="lock-control-item">
                  <label htmlFor="seating-lock">
                    Lock Seating Plan:
                  </label>
                  <input
                    type="checkbox"
                    id="seating-lock"
                    checked={seatingLocked}
                    onChange={(e) => onUpdateSeatingLocked(e.target.checked)}
                  />
                  <span className={`lock-status ${seatingLocked ? 'locked' : 'unlocked'}`}>
                    {seatingLocked ? '🔒 Locked' : '🔓 Unlocked'}
                  </span>
                </div>
                <div className="lock-control-item">
                  <label htmlFor="framies-nominations-lock">
                    Lock Framies Nominations:
                  </label>
                  <input
                    type="checkbox"
                    id="framies-nominations-lock"
                    checked={framiesNominationsLocked}
                    onChange={(e) => onUpdateFramiesNominationsLocked(e.target.checked)}
                  />
                  <span className={`lock-status ${framiesNominationsLocked ? 'locked' : 'unlocked'}`}>
                    {framiesNominationsLocked ? '🔒 Locked' : '🔓 Unlocked'}
                  </span>
                </div>
                <div className="lock-control-item">
                  <label htmlFor="framies-voting-lock">
                    Lock Framies Voting:
                  </label>
                  <input
                    type="checkbox"
                    id="framies-voting-lock"
                    checked={framiesVotingLocked}
                    onChange={(e) => onUpdateFramiesVotingLocked(e.target.checked)}
                  />
                  <span className={`lock-status ${framiesVotingLocked ? 'locked' : 'unlocked'}`}>
                    {framiesVotingLocked ? '🔒 Locked' : '🔓 Unlocked'}
                  </span>
                </div>
              </div>
              <p className="lock-controls-description">
                When RSVP submissions are locked, users cannot submit new RSVPs. When the seating plan is locked, users cannot change their seat assignments. When Framies nominations are locked, users cannot add new nominations. When Framies voting is locked, users cannot vote.
              </p>
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
        {activeTab === 'awards' && (
          <AwardManagement />
        )}
        {activeTab === 'background' && (
          <BackgroundImageManagement adminSessionId={adminSessionId} />
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
            adminSessionId={adminSessionId}
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

function StorageManagement({ rsvps, menuCategories, tablesCount, seatsPerTable, onUpdateRSVPs, onUpdateMenuCategories, onUpdateTablesCount, onUpdateSeatsPerTable, adminSessionId }) {
  const [importError, setImportError] = useState('')
  const [importSuccess, setImportSuccess] = useState('')
  const [backupMessage, setBackupMessage] = useState(null)
  const [backupLoading, setBackupLoading] = useState(false)

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

  const handleManualBackup = async () => {
    if (!adminSessionId) {
      setBackupMessage({ type: 'error', text: 'Admin session required. Please log in again.' })
      setTimeout(() => setBackupMessage(null), 5000)
      return
    }

    try {
      setBackupLoading(true)
      setBackupMessage(null)
      const result = await createManualBackup(adminSessionId)
      
      if (result.success) {
        const backupFiles = result.backups || []
        const fileList = backupFiles.map(b => b.file).join(', ')
        setBackupMessage({ 
          type: 'success', 
          text: `Backup created successfully! Files backed up: ${fileList}` 
        })
      } else {
        setBackupMessage({ type: 'error', text: 'Failed to create backup' })
      }
      
      setTimeout(() => setBackupMessage(null), 5000)
    } catch (error) {
      logger.error('Error creating manual backup:', error)
      setBackupMessage({ 
        type: 'error', 
        text: error.message || 'Failed to create backup. Please try again.' 
      })
      setTimeout(() => setBackupMessage(null), 5000)
    } finally {
      setBackupLoading(false)
    }
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
        logger.error('Import error:', error)
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
          <h4>Server Backup</h4>
          <p className="action-description">
            Create a server-side backup of all data files (RSVPs, Framies, Lift Shares). Backups are stored on the server and are automatically created every 6 hours.
          </p>
          <button 
            onClick={handleManualBackup} 
            className="backup-button"
            disabled={backupLoading}
          >
            {backupLoading ? '⏳ Creating Backup...' : '💾 Create Manual Backup'}
          </button>
          {backupMessage && (
            <div className={`backup-message ${backupMessage.type === 'success' ? 'success-message' : 'error-message'}`}>
              {backupMessage.text}
            </div>
          )}
        </div>

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
      </div>
    </div>
  )
}

function AwardManagement() {
  const [awards, setAwards] = useState([])
  const [framiesData, setFramiesData] = useState({ nominations: [], votes: [] })
  const [loading, setLoading] = useState(true)
  const [loadingVotes, setLoadingVotes] = useState(true)
  const [editingAward, setEditingAward] = useState(null)
  const [newAwardName, setNewAwardName] = useState('')
  const [newAwardDescription, setNewAwardDescription] = useState('')
  const [message, setMessage] = useState(null)
  const [saving, setSaving] = useState(false)
  const [expandedSections, setExpandedSections] = useState({
    addAward: true,
    currentAwards: true,
    voteStats: true
  })

  // Generate UUID v4
  const generateUUID = () => {
    return crypto.randomUUID()
  }

  useEffect(() => {
    loadAwards()
    loadFramies()
  }, [])

  const loadAwards = async () => {
    try {
      setLoading(true)
      const awardsData = await fetchAwards()
      setAwards(awardsData || [])
    } catch (error) {
      logger.error('Error loading awards:', error)
      setMessage({ type: 'error', text: 'Failed to load awards' })
      setTimeout(() => setMessage(null), 5000)
    } finally {
      setLoading(false)
    }
  }

  const loadFramies = async () => {
    try {
      setLoadingVotes(true)
      const data = await fetchFramies()
      setFramiesData(data || { nominations: [], votes: [] })
    } catch (error) {
      logger.error('Error loading framies data:', error)
    } finally {
      setLoadingVotes(false)
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

  // Get vote statistics for an award
  const getAwardVoteStats = (awardId) => {
    const nominations = getNominationsForAward(awardId)
    const nominationStats = nominations.map(nom => ({
      ...nom,
      voteCount: getVoteCount(nom.id)
    })).sort((a, b) => b.voteCount - a.voteCount)
    
    const totalVotes = nominationStats.reduce((sum, nom) => sum + nom.voteCount, 0)
    const uniqueVoters = new Set((framiesData.votes || [])
      .filter(v => nominations.some(n => n.id === v.nominationId))
      .map(v => v.voterEmail || v.voterId)
    ).size

    return {
      nominations: nominationStats,
      totalVotes,
      uniqueVoters,
      nominationCount: nominations.length
    }
  }

  const handleSaveAwards = async (updatedAwards) => {
    try {
      setSaving(true)
      setMessage(null)
      await saveAwards(updatedAwards)
      setAwards(updatedAwards)
      setMessage({ type: 'success', text: 'Awards saved successfully!' })
      setTimeout(() => setMessage(null), 3000)
    } catch (error) {
      logger.error('Error saving awards:', error)
      setMessage({ type: 'error', text: error.message || 'Failed to save awards' })
      setTimeout(() => setMessage(null), 5000)
    } finally {
      setSaving(false)
    }
  }

  const handleAddAward = () => {
    if (!newAwardName.trim()) {
      setMessage({ type: 'error', text: 'Please enter an award name' })
      setTimeout(() => setMessage(null), 3000)
      return
    }

    const updatedAwards = [...awards, {
      id: generateUUID(),
      label: newAwardName.trim(),
      description: newAwardDescription.trim() || ''
    }]
    
    handleSaveAwards(updatedAwards)
    setNewAwardName('')
    setNewAwardDescription('')
  }

  const handleEditAward = (award) => {
    setEditingAward({ ...award })
  }

  const handleUpdateAward = () => {
    if (!editingAward.label.trim()) {
      setMessage({ type: 'error', text: 'Please enter an award name' })
      setTimeout(() => setMessage(null), 3000)
      return
    }

    const updatedAwards = awards.map(a => 
      a.id === editingAward.id ? { 
        id: editingAward.id, 
        label: editingAward.label.trim(),
        description: editingAward.description?.trim() || ''
      } : a
    )
    
    handleSaveAwards(updatedAwards)
    setEditingAward(null)
  }

  const handleDeleteAward = (awardId) => {
    if (!window.confirm(`Are you sure you want to delete the award "${awards.find(a => a.id === awardId)?.label}"?`)) {
      return
    }

    const updatedAwards = awards.filter(a => a.id !== awardId)
    handleSaveAwards(updatedAwards)
  }

  const handleMoveAward = (index, direction) => {
    const newIndex = index + direction
    if (newIndex < 0 || newIndex >= awards.length) return

    const updatedAwards = [...awards]
    const [moved] = updatedAwards.splice(index, 1)
    updatedAwards.splice(newIndex, 0, moved)
    handleSaveAwards(updatedAwards)
  }

  const toggleSection = (section) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }))
  }

  const handleExportVotingData = () => {
    const csvRows = []
    
    // Add summary section with winners
    csvRows.push('AWARD WINNERS SUMMARY')
    csvRows.push('')
    csvRows.push(['Award Category', 'Winner', 'Vote Count', 'Rationale', 'Total Votes in Category', 'Total Voters'].join(','))
    
    awards.forEach(award => {
      const stats = getAwardVoteStats(award.id)
      if (stats.nominations.length > 0) {
        const winner = stats.nominations[0] // First one is the winner (sorted by vote count)
        const rationaleStr = `"${(winner.rationale || '').replace(/"/g, '""')}"`
        const row = [
          `"${award.label}"`,
          `"${winner.nominee}"`,
          winner.voteCount,
          rationaleStr,
          stats.totalVotes,
          stats.uniqueVoters
        ]
        csvRows.push(row.join(','))
      } else {
        const row = [
          `"${award.label}"`,
          'No nominations',
          '0',
          '""',
          '0',
          '0'
        ]
        csvRows.push(row.join(','))
      }
    })
    
    // Add separator
    csvRows.push('')
    csvRows.push('DETAILED VOTING DATA')
    csvRows.push('')
    
    // Create CSV header for detailed data
    const headers = ['Award Category', 'Nominee', 'Vote Count', 'Rationale', 'Voter Emails', 'Nominated At', 'Nominated By']
    csvRows.push(headers.join(','))
    
    // Convert voting data to CSV rows
    awards.forEach(award => {
      const stats = getAwardVoteStats(award.id)
      
      stats.nominations.forEach(nomination => {
        // Get all voters for this nomination
        const votes = (framiesData.votes || []).filter(v => v.nominationId === nomination.id)
        const voterEmails = votes
          .map(v => v.voterEmail || v.voterId || 'Unknown')
          .filter((email, index, self) => self.indexOf(email) === index) // Remove duplicates
          .join('; ')
        
        const rationaleStr = `"${(nomination.rationale || '').replace(/"/g, '""')}"`
        const voterEmailsStr = `"${voterEmails.replace(/"/g, '""')}"`
        const nominatedAt = nomination.nominatedAt 
          ? new Date(nomination.nominatedAt).toLocaleString() 
          : ''
        const nominatedBy = nomination.nominatedBy || 'Anonymous'
        
        const row = [
          `"${award.label}"`,
          `"${nomination.nominee}"`,
          nomination.voteCount,
          rationaleStr,
          voterEmailsStr,
          `"${nominatedAt}"`,
          `"${nominatedBy}"`
        ]
        csvRows.push(row.join(','))
      })
    })
    
    // Create CSV content
    const csvContent = csvRows.join('\n')
    
    // Create blob and download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    link.setAttribute('href', url)
    link.setAttribute('download', `framies-voting-data-${new Date().toISOString().split('T')[0]}.csv`)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  if (loading) {
    return <div className="award-management-section">Loading awards...</div>
  }

  return (
    <div className="award-management-section">
      <h3>Award Category Management</h3>
      <p className="section-description">
        Manage the award categories that appear on the Framies page. Users can nominate and vote for people in these categories.
      </p>

      {message && (
        <div className={`award-message ${message.type === 'success' ? 'success-message' : 'error-message'}`}>
          {message.text}
        </div>
      )}

      <div className="award-form-section collapsible-section">
        <div 
          className="collapsible-header"
          onClick={() => toggleSection('addAward')}
        >
          <h4>Add New Award</h4>
          <span className="collapse-icon">{expandedSections.addAward ? '▼' : '▶'}</span>
        </div>
        {expandedSections.addAward && (
          <div className="collapsible-content">
            <div className="award-form-fields">
          <div className="form-group">
            <label htmlFor="new-award-name">Award Name *</label>
            <input
              id="new-award-name"
              type="text"
              value={newAwardName}
              onChange={(e) => setNewAwardName(e.target.value)}
              placeholder="e.g., Best Dancer"
            />
          </div>
          <div className="form-group">
            <label htmlFor="new-award-description">Description</label>
            <input
              id="new-award-description"
              type="text"
              value={newAwardDescription}
              onChange={(e) => setNewAwardDescription(e.target.value)}
              placeholder="e.g., Who has the best moves on the dance floor?"
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  handleAddAward()
                }
              }}
            />
          </div>
            </div>
            <button onClick={handleAddAward} className="add-award-button" disabled={saving}>
              ➕ Add Award
            </button>
          </div>
        )}
      </div>

      <div className="awards-list-section collapsible-section">
        <div 
          className="collapsible-header"
          onClick={() => toggleSection('currentAwards')}
        >
          <h4>Current Awards ({awards.length})</h4>
          <span className="collapse-icon">{expandedSections.currentAwards ? '▼' : '▶'}</span>
        </div>
        {expandedSections.currentAwards && (
          <div className="collapsible-content">
            {awards.length === 0 ? (
          <p className="no-awards">No awards configured. Add your first award above.</p>
        ) : (
          <div className="awards-list">
            {awards.map((award, index) => (
              <div key={award.id} className="award-item">
                {editingAward && editingAward.id === award.id ? (
                  <div className="award-edit-form">
                    <div className="form-group">
                      <label>Award Name</label>
                      <input
                        type="text"
                        value={editingAward.label}
                        onChange={(e) => setEditingAward({ ...editingAward, label: e.target.value })}
                      />
                    </div>
                    <div className="form-group">
                      <label>Description</label>
                      <input
                        type="text"
                        value={editingAward.description || ''}
                        onChange={(e) => setEditingAward({ ...editingAward, description: e.target.value })}
                        placeholder="e.g., Who has the best moves on the dance floor?"
                        onKeyPress={(e) => {
                          if (e.key === 'Enter') {
                            handleUpdateAward()
                          }
                        }}
                      />
                    </div>
                    <div className="award-edit-actions">
                      <button onClick={handleUpdateAward} className="save-button" disabled={saving}>
                        💾 Save
                      </button>
                      <button onClick={() => setEditingAward(null)} className="cancel-button">
                        ✖️ Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="award-display">
                      <span className="award-label-display">{award.label}</span>
                    </div>
                    <div className="award-actions">
                      <button
                        onClick={() => handleMoveAward(index, -1)}
                        disabled={index === 0}
                        className="move-button"
                        title="Move up"
                      >
                        ⬆️
                      </button>
                      <button
                        onClick={() => handleMoveAward(index, 1)}
                        disabled={index === awards.length - 1}
                        className="move-button"
                        title="Move down"
                      >
                        ⬇️
                      </button>
                      <button onClick={() => handleEditAward(award)} className="edit-button">
                        ✏️ Edit
                      </button>
                      <button onClick={() => handleDeleteAward(award.id)} className="delete-button">
                        🗑️ Delete
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
            )}
          </div>
        )}
      </div>

      <div className="award-votes-section collapsible-section">
        <div 
          className="collapsible-header award-votes-header"
          onClick={() => toggleSection('voteStats')}
        >
          <h4>Vote Statistics</h4>
          <div className="header-actions" onClick={(e) => e.stopPropagation()}>
            <button onClick={handleExportVotingData} className="export-button" disabled={loadingVotes || awards.length === 0}>
              📥 Export Voting Data
            </button>
            <button onClick={loadFramies} className="refresh-button" disabled={loadingVotes}>
              {loadingVotes ? 'Loading...' : '🔄 Refresh'}
            </button>
            <span className="collapse-icon">{expandedSections.voteStats ? '▼' : '▶'}</span>
          </div>
        </div>
        {expandedSections.voteStats && (
          <div className="collapsible-content">
            {loadingVotes ? (
          <p className="loading-text">Loading vote data...</p>
        ) : awards.length === 0 ? (
          <p className="no-data">No awards to display votes for.</p>
        ) : (
          <div className="award-votes-grid">
            {awards.map(award => {
              const stats = getAwardVoteStats(award.id)
              return (
                <div key={award.id} className="award-vote-card">
                  <div className="award-vote-header">
                    <h5>{award.label}</h5>
                    <div className="award-vote-summary">
                      <span className="vote-stat">
                        <strong>{stats.totalVotes}</strong> total vote{stats.totalVotes !== 1 ? 's' : ''}
                      </span>
                      <span className="vote-stat">
                        <strong>{stats.uniqueVoters}</strong> voter{stats.uniqueVoters !== 1 ? 's' : ''}
                      </span>
                      <span className="vote-stat">
                        <strong>{stats.nominationCount}</strong> nomination{stats.nominationCount !== 1 ? 's' : ''}
                      </span>
                    </div>
                  </div>
                  {stats.nominations.length === 0 ? (
                    <p className="no-nominations">No nominations yet.</p>
                  ) : (
                    <div className="nomination-votes-list">
                      {stats.nominations.map((nomination, idx) => (
                        <div key={nomination.id} className="nomination-vote-item">
                          <div className="nomination-vote-info">
                            <span className="nomination-rank">#{idx + 1}</span>
                            <span className="nomination-name">{nomination.nominee}</span>
                            <span className="nomination-vote-count">
                              {nomination.voteCount} vote{nomination.voteCount !== 1 ? 's' : ''}
                            </span>
                          </div>
                          {nomination.rationale && (
                            <p className="nomination-vote-rationale">{nomination.rationale}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
            )}
          </div>
        )}
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

function BackgroundImageManagement({ adminSessionId }) {
  const [images, setImages] = useState([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [message, setMessage] = useState(null)

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

  const loadImages = async () => {
    try {
      setLoading(true)
      const data = await fetchBackgroundImages()
      setImages(Array.isArray(data) ? data : [])
    } catch (error) {
      logger.error('Error loading background images:', error)
      setMessage({ type: 'error', text: 'Failed to load background images' })
      setTimeout(() => setMessage(null), 5000)
    } finally {
      setLoading(false)
    }
  }

  // Compress image using Canvas API
  const compressImage = async (file, maxWidth = 1920, maxHeight = 1920, quality = 0.8) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = (event) => {
        const img = new Image()
        img.onload = () => {
          // Calculate new dimensions while maintaining aspect ratio
          let width = img.width
          let height = img.height
          
          if (width > maxWidth || height > maxHeight) {
            const ratio = Math.min(maxWidth / width, maxHeight / height)
            width = width * ratio
            height = height * ratio
          }
          
          // Create canvas and draw resized image
          const canvas = document.createElement('canvas')
          canvas.width = width
          canvas.height = height
          const ctx = canvas.getContext('2d')
          ctx.drawImage(img, 0, 0, width, height)
          
          // Convert to JPEG with compression (smaller than PNG)
          const compressedDataUrl = canvas.toDataURL('image/jpeg', quality)
          resolve(compressedDataUrl)
        }
        img.onerror = () => reject(new Error(`Failed to load image: ${file.name}`))
        img.src = event.target.result
      }
      reader.onerror = () => reject(new Error(`Failed to read file: ${file.name}`))
      reader.readAsDataURL(file)
    })
  }

  const handleImageUpload = async (e) => {
    const files = Array.from(e.target.files || [])
    if (files.length === 0) return

    // Validate all files first
    const invalidFiles = files.filter(file => !file.type.startsWith('image/'))
    if (invalidFiles.length > 0) {
      setMessage({ type: 'error', text: `Please select valid image files. ${invalidFiles.length} file(s) are not images.` })
      setTimeout(() => setMessage(null), 5000)
      e.target.value = ''
      return
    }

    const oversizedFiles = files.filter(file => file.size > MAX_BACKGROUND_IMAGE_SIZE)
    if (oversizedFiles.length > 0) {
      setMessage({ type: 'error', text: `Some images are too large. ${oversizedFiles.length} file(s) exceed 10MB limit.` })
      setTimeout(() => setMessage(null), 5000)
      e.target.value = ''
      return
    }

    try {
      setUploading(true)
      setMessage(null)

      let successCount = 0
      let errorCount = 0
      const errors = []

      // Process files sequentially to avoid overwhelming the server
      for (const file of files) {
        try {
          // Compress and convert to base64
          const originalSize = file.size
          const imageData = await compressImage(file)
          
          // Calculate compressed size (approximate from base64)
          const compressedSize = (imageData.length * 3) / 4
          const compressionRatio = ((originalSize - compressedSize) / originalSize * 100).toFixed(1)
          
          logger.debug(`Compressed ${file.name}: ${(originalSize / 1024 / 1024).toFixed(2)}MB -> ${(compressedSize / 1024 / 1024).toFixed(2)}MB (${compressionRatio}% reduction)`)

          await addBackgroundImage(imageData, adminSessionId)
          successCount++
        } catch (error) {
          logger.error(`Error uploading ${file.name}:`, error)
          errorCount++
          errors.push(`${file.name}: ${error.message || 'Failed to upload'}`)
        }
      }

      // Reload images after all uploads
      await loadImages()

      // Show appropriate message
      if (successCount > 0 && errorCount === 0) {
        setMessage({ 
          type: 'success', 
          text: `Successfully uploaded ${successCount} image${successCount !== 1 ? 's' : ''}!` 
        })
        setTimeout(() => setMessage(null), 3000)
      } else if (successCount > 0 && errorCount > 0) {
        setMessage({ 
          type: 'error', 
          text: `Uploaded ${successCount} image(s), but ${errorCount} failed. ${errors.join('; ')}` 
        })
        setTimeout(() => setMessage(null), 8000)
      } else {
        setMessage({ 
          type: 'error', 
          text: `Failed to upload all images. ${errors.join('; ')}` 
        })
        setTimeout(() => setMessage(null), 8000)
      }
    } catch (error) {
      logger.error('Error uploading images:', error)
      setMessage({ type: 'error', text: 'Failed to upload images' })
      setTimeout(() => setMessage(null), 5000)
    } finally {
      setUploading(false)
      e.target.value = '' // Reset file input
    }
  }

  const handleDeleteImage = async (imageId) => {
    if (!window.confirm('Are you sure you want to delete this background image?')) {
      return
    }

    try {
      setMessage(null)
      await deleteBackgroundImage(imageId, adminSessionId)
      await loadImages()
      setMessage({ type: 'success', text: 'Image deleted successfully!' })
      setTimeout(() => setMessage(null), 3000)
    } catch (error) {
      logger.error('Error deleting background image:', error)
      setMessage({ type: 'error', text: error.message || 'Failed to delete image' })
      setTimeout(() => setMessage(null), 5000)
    }
  }

  if (loading) {
    return <div className="background-image-management-section">Loading background images...</div>
  }

  return (
    <div className="background-image-management-section">
      <h3>Background Image Catalog</h3>
      <p className="section-description">
        Manage the catalog of images used in the background mosaic. Images are randomly arranged in a mosaic pattern across the background.
      </p>

      {message && (
        <div className={`background-message ${message.type === 'success' ? 'success-message' : 'error-message'}`}>
          {message.text}
        </div>
      )}

      <div className="background-upload-section">
        <h4>Add New Image</h4>
        <label htmlFor="background-image-upload" className="background-upload-label">
          <input
            type="file"
            id="background-image-upload"
            accept="image/*"
            multiple
            onChange={handleImageUpload}
            disabled={uploading}
            style={{ display: 'none' }}
          />
          <span className="background-upload-button">
            {uploading ? '⏳ Uploading...' : '📷 Upload Images'}
          </span>
        </label>
        <p className="form-help">Upload one or more images to add to the background mosaic catalog (max 10MB per image). Images are automatically compressed and resized to optimize loading times.</p>
      </div>

      <div className="background-images-list">
        <h4>Current Images ({images.length})</h4>
        {images.length === 0 ? (
          <p className="no-data">No background images yet. Upload your first image above.</p>
        ) : (
          <div className="background-images-grid">
            {images.map((image) => (
              <div key={image.id} className="background-image-item">
                <div className="background-image-preview">
                  <img src={image.data} alt="Background" />
                </div>
                <div className="background-image-actions">
                  <button
                    onClick={() => handleDeleteImage(image.id)}
                    className="delete-button"
                    title="Delete image"
                  >
                    🗑️ Delete
                  </button>
                </div>
                <div className="background-image-meta">
                  <span className="background-image-date">
                    Added: {new Date(image.addedAt).toLocaleDateString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default Admin

