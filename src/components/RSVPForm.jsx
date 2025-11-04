import { useState } from 'react'
import './RSVPForm.css'
import ImageCropper from './ImageCropper'

const AVAILABLE_ICONS = [
  '🎄', '🎅', '❄️', '🎁', '🦌', '⭐', '🎀', '🔔', 
  '⛄', '🎄', '🕯️', '🍪', '🎊', '🦌', '🌟', '🎈'
]

function RSVPForm({ onSubmit, onBackToMenu, menuCategories = [] }) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [menuChoices, setMenuChoices] = useState([])
  const [dietaryRequirements, setDietaryRequirements] = useState('')
  const [selectedIcon, setSelectedIcon] = useState('🎄')
  const [selectedImage, setSelectedImage] = useState(null)
  const [imageFile, setImageFile] = useState(null)
  const [showCropper, setShowCropper] = useState(false)
  const [iconType, setIconType] = useState('emoji') // 'emoji' or 'image'
  const [errors, setErrors] = useState({})

  const validateEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email)
  }

  const handleImageSelect = (e) => {
    const file = e.target.files[0]
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        alert('Please select a valid image file')
        return
      }
      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        alert('Image size must be less than 5MB')
        return
      }
      setImageFile(file)
      setShowCropper(true)
      setIconType('image')
    }
  }

  const handleCropComplete = (croppedImage) => {
    setSelectedImage(croppedImage)
    setShowCropper(false)
    setImageFile(null)
  }

  const handleCancelCrop = () => {
    setShowCropper(false)
    setImageFile(null)
    if (!selectedImage) {
      setIconType('emoji')
    }
  }

  const handleRemoveImage = () => {
    setSelectedImage(null)
    setIconType('emoji')
  }

  const handleIconTypeChange = (type) => {
    setIconType(type)
    if (type === 'emoji' && !selectedIcon) {
      setSelectedIcon('🎄')
    }
  }

  const handleMenuToggle = (menuId) => {
    setMenuChoices(prev => 
      prev.includes(menuId)
        ? prev.filter(id => id !== menuId)
        : [...prev, menuId]
    )
    // Clear error when user selects something
    if (errors.menuChoices) {
      setErrors({ ...errors, menuChoices: null })
    }
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    const newErrors = {}

    if (!name.trim()) {
      newErrors.name = 'Name is required'
    }

    if (!email) {
      newErrors.email = 'Email is required'
    } else if (!validateEmail(email)) {
      newErrors.email = 'Please enter a valid email address'
    }

    if (menuChoices.length === 0) {
      newErrors.menuChoices = 'Please select at least one menu option'
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return
    }

    onSubmit({ 
      name: name.trim(), 
      email, 
      menuChoices, 
      dietaryRequirements: dietaryRequirements.trim(), 
      icon: iconType === 'image' ? selectedImage : selectedIcon,
      iconType: iconType
    })
  }

  return (
    <div className="rsvp-form-container">
      <h2>RSVP to the Christmas Party</h2>
      <form onSubmit={handleSubmit} className="rsvp-form">
        <div className="form-group">
          <label htmlFor="name">Name *</label>
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
            placeholder="Your full name"
            className={errors.name ? 'error' : ''}
          />
          {errors.name && <span className="error-message">{errors.name}</span>}
        </div>

        <div className="form-group">
          <label htmlFor="email">Email Address *</label>
          <input
            type="email"
            id="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value)
              if (errors.email) {
                setErrors({ ...errors, email: null })
              }
            }}
            placeholder="your.email@example.com"
            className={errors.email ? 'error' : ''}
          />
          {errors.email && <span className="error-message">{errors.email}</span>}
        </div>

        <div className="form-group">
          <label>Menu Choices *</label>
          <p className="menu-description">Select at least one menu option from any category:</p>
          <div className="menu-categories">
            {menuCategories.map(category => (
              <div key={category.category} className="menu-category">
                <h4 className="menu-category-title">{category.category}</h4>
                <div className="menu-options">
                  {category.options.map(option => (
                    <div key={option.id} className="menu-option">
                      <label className="menu-checkbox">
                        <input
                          type="checkbox"
                          checked={menuChoices.includes(option.id)}
                          onChange={() => handleMenuToggle(option.id)}
                        />
                        <div className="menu-option-content">
                          <span className="menu-option-label">{option.label}</span>
                          <span className="menu-option-description">{option.description}</span>
                        </div>
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
          {errors.menuChoices && (
            <span className="error-message">{errors.menuChoices}</span>
          )}
        </div>

        <div className="form-group">
          <label htmlFor="dietary-requirements">Dietary Requirements</label>
          <textarea
            id="dietary-requirements"
            value={dietaryRequirements}
            onChange={(e) => setDietaryRequirements(e.target.value)}
            placeholder="Please list any allergies, dietary restrictions, or special requirements (optional)"
            rows={4}
            className="dietary-textarea"
          />
          <p className="field-hint">This field is optional. Please let us know about any allergies or special dietary needs.</p>
        </div>

        <div className="form-group">
          <label>Choose Your Seat Icon</label>
          <p className="menu-description">Select an emoji icon or upload your own image:</p>
          
          <div className="icon-type-selector">
            <button
              type="button"
              className={`icon-type-button ${iconType === 'emoji' ? 'active' : ''}`}
              onClick={() => handleIconTypeChange('emoji')}
            >
              Emoji Icon
            </button>
            <button
              type="button"
              className={`icon-type-button ${iconType === 'image' ? 'active' : ''}`}
              onClick={() => handleIconTypeChange('image')}
            >
              Upload Image
            </button>
          </div>

          {iconType === 'emoji' && (
            <>
              <div className="icon-selection">
                {AVAILABLE_ICONS.map((icon, index) => (
                  <button
                    key={index}
                    type="button"
                    className={`icon-option ${selectedIcon === icon ? 'selected' : ''}`}
                    onClick={() => setSelectedIcon(icon)}
                    title={`Select ${icon}`}
                  >
                    {icon}
                  </button>
                ))}
              </div>
              <p className="field-hint">Your selected icon: {selectedIcon} - This will appear on your seat in the seating plan.</p>
            </>
          )}

          {iconType === 'image' && (
            <>
              <div className="image-upload-section">
                {selectedImage ? (
                  <div className="selected-image-preview">
                    <img src={selectedImage} alt="Selected" className="preview-image" />
                    <button type="button" onClick={handleRemoveImage} className="remove-image-button">
                      Remove Image
                    </button>
                  </div>
                ) : (
                  <label htmlFor="image-upload" className="image-upload-label">
                    <input
                      type="file"
                      id="image-upload"
                      accept="image/*"
                      onChange={handleImageSelect}
                      style={{ display: 'none' }}
                    />
                    <span className="upload-button">📷 Upload Image</span>
                  </label>
                )}
              </div>
              <p className="field-hint">
                {selectedImage 
                  ? 'Your image will appear on your seat. Click "Remove Image" to choose a different one.'
                  : 'Upload an image and crop it to a circular shape. The image will appear on your seat in the seating plan.'}
              </p>
            </>
          )}

          {showCropper && imageFile && (
            <ImageCropper
              imageFile={imageFile}
              onCropComplete={handleCropComplete}
              onCancel={handleCancelCrop}
            />
          )}
        </div>

        <div className="form-actions">
          {onBackToMenu && (
            <button type="button" onClick={onBackToMenu} className="back-button">
              Back to Menu
            </button>
          )}
          <button type="submit" className="submit-button">
            Submit RSVP
          </button>
        </div>
      </form>
    </div>
  )
}

export default RSVPForm

