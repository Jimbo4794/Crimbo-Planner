import { useState, useEffect } from 'react'
import './Admin.css'
import ImageCropper from './ImageCropper'

// Get admin password from environment variable, fallback to default
const ADMIN_PASSWORD = import.meta.env.VITE_ADMIN_PASSWORD || 'admin123'

const AVAILABLE_ICONS = [
  '🎄', '🎅', '❄️', '🎁', '🦌', '⭐', '🎀', '🔔', 
  '⛄', '🎄', '🕯️', '🍪', '🎊', '🦌', '🌟', '🎈'
]

function Admin({ rsvps, menuCategories, tablesCount, seatsPerTable, onUpdateRSVPs, onUpdateMenuCategories, onUpdateTablesCount, onUpdateSeatsPerTable, onBackToMenu }) {
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
  const [activeTab, setActiveTab] = useState('users') // 'users', 'menu', 'seating', or 'storage'
  const [editingRSVP, setEditingRSVP] = useState(null)
  const [editingMenu, setEditingMenu] = useState(false)

  const handlePasswordSubmit = (e) => {
    e.preventDefault()
    if (password === ADMIN_PASSWORD) {
      setIsAuthenticated(true)
      setPasswordError('')
    } else {
      setPasswordError('Incorrect password')
      setPassword('')
    }
  }

  const handleSignOut = () => {
    setIsAuthenticated(false)
    setPassword('')
    setPasswordError('')
    setEditingRSVP(null)
    setEditingMenu(false)
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
      if (file.size > 5 * 1024 * 1024) {
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
    // Create CSV header
    const headers = ['Name', 'Email', 'Icon', 'Menu Choices', 'Dietary Requirements', 'Table', 'Seat', 'Submitted At']
    
    // Convert RSVPs to CSV rows
    const csvRows = [
      headers.join(',')
    ]
    
    rsvps.forEach(rsvp => {
      const menuChoicesLabels = rsvp.menuChoices.map(id => getMenuOptionLabel(id))
      const menuChoicesStr = `"${menuChoicesLabels.join('; ')}"` // Use semicolon to separate, quoted to handle commas
      const dietaryStr = `"${(rsvp.dietaryRequirements || '').replace(/"/g, '""')}"` // Escape quotes in CSV
      const row = [
        `"${rsvp.name}"`,
        `"${rsvp.email}"`,
        rsvp.icon || '🎄',
        menuChoicesStr,
        dietaryStr,
        rsvp.table || '',
        rsvp.seat || '',
        `"${new Date(rsvp.submittedAt).toLocaleString()}"`
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
              />
              {passwordError && <span className="error-message">{passwordError}</span>}
            </div>
            <button type="submit" className="login-button">Login</button>
          </form>
          {onBackToMenu && (
            <button onClick={onBackToMenu} className="back-button">Back to Menu</button>
          )}
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
                          <label>Dietary Requirements</label>
                          <textarea
                            value={editingRSVP.dietaryRequirements || ''}
                            onChange={(e) => setEditingRSVP({ ...editingRSVP, dietaryRequirements: e.target.value })}
                            placeholder="Dietary requirements, allergies, or special needs"
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
                          <p><strong>Dietary Requirements:</strong> {rsvp.dietaryRequirements || 'None specified'}</p>
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

      {onBackToMenu && (
        <div className="admin-footer">
          <button onClick={onBackToMenu} className="back-button">Back to Menu</button>
        </div>
      )}
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
      description: 'Description'
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

export default Admin

