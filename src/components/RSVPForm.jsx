import { useState, useEffect, useRef } from 'react'
import './RSVPForm.css'
import ImageCropper from './ImageCropper'
import { AVAILABLE_ICONS, MAX_IMAGE_SIZE } from '../utils/constants'
import { conflictsWithDietaryPreferences } from '../utils/dietaryConflicts'

function RSVPForm({ onSubmit, onBackToMenu, menuCategories = [], existingRSVPs = [] }) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [menuChoices, setMenuChoices] = useState([])
  const [dietaryRequirements, setDietaryRequirements] = useState('')
  const [vegetarian, setVegetarian] = useState(false)
  const [vegan, setVegan] = useState(false)
  const [glutenIntolerant, setGlutenIntolerant] = useState(false)
  const [lactoseIntolerant, setLactoseIntolerant] = useState(false)
  const [selectedIcon, setSelectedIcon] = useState('🎄')
  const [selectedImage, setSelectedImage] = useState(null)
  const [imageFile, setImageFile] = useState(null)
  const [showCropper, setShowCropper] = useState(false)
  const [iconType, setIconType] = useState('emoji') // 'emoji' or 'image'
  const [errors, setErrors] = useState({})
  const menuChoicesRef = useRef(menuChoices)
  
  // Keep ref in sync with state
  useEffect(() => {
    menuChoicesRef.current = menuChoices
  }, [menuChoices])

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
      if (file.size > MAX_IMAGE_SIZE) {
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

  const handleMenuToggle = (menuId, category) => {
    // Find the category that contains this menu option
    const categoryData = menuCategories.find(cat => 
      cat.options.some(opt => opt.id === menuId)
    )
    
    if (!categoryData) return
    
    setMenuChoices(prev => {
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
    if (errors.menuChoices) {
      setErrors({ ...errors, menuChoices: null })
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
      vegetarian,
      vegan,
      glutenIntolerant,
      lactoseIntolerant
    )
  }

  // Effect to automatically unselect conflicting menu items when dietary preferences change
  useEffect(() => {
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
        vegetarian,
        vegan,
        glutenIntolerant,
        lactoseIntolerant
      )
    })

    // If there are conflicting choices, remove them
    if (conflictingChoices.length > 0) {
      setMenuChoices(prevChoices => 
        prevChoices.filter(choiceId => !conflictingChoices.includes(choiceId))
      )
    }
  }, [vegetarian, vegan, glutenIntolerant, lactoseIntolerant, menuCategories])

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
    const selectedInCategory = menuChoices.find(id => categoryOptionIds.includes(id))
    
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
    } else {
      // Check if email already exists (case-insensitive)
      const emailExists = existingRSVPs.some(rsvp => 
        rsvp.email && rsvp.email.toLowerCase() === email.toLowerCase()
      )
      if (emailExists) {
        newErrors.email = 'This email address is already registered. Please use a different email or look up your existing reservation.'
      }
    }

    // Check if user has selected one option from each category
    const selectedCategories = menuCategories.filter(category =>
      category.options.some(option => menuChoices.includes(option.id))
    )
    
    if (selectedCategories.length !== menuCategories.length) {
      newErrors.menuChoices = 'Please select one option from each category (starter, main, and dessert)'
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
      vegetarian,
      vegan,
      glutenIntolerant,
      lactoseIntolerant,
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
              const newEmail = e.target.value
              setEmail(newEmail)
              // Clear error when user starts typing
              if (errors.email) {
                setErrors({ ...errors, email: null })
              }
              // Real-time validation: check for duplicate email (only if email is valid format)
              if (newEmail && validateEmail(newEmail)) {
                const emailExists = existingRSVPs.some(rsvp => 
                  rsvp.email && rsvp.email.toLowerCase() === newEmail.toLowerCase()
                )
                if (emailExists) {
                  setErrors({ ...errors, email: 'This email address is already registered. Please use a different email or look up your existing reservation.' })
                }
              }
            }}
            placeholder="your.email@example.com"
            className={errors.email ? 'error' : ''}
          />
          {errors.email && <span className="error-message">{errors.email}</span>}
        </div>

        <div className="form-group">
          <label>Dietary Preferences</label>
          <div className="dietary-preferences">
            <label className="dietary-checkbox">
              <input
                type="checkbox"
                checked={vegetarian}
                onChange={(e) => setVegetarian(e.target.checked)}
              />
              <span>Vegetarian</span>
            </label>
            <label className="dietary-checkbox">
              <input
                type="checkbox"
                checked={vegan}
                onChange={(e) => setVegan(e.target.checked)}
              />
              <span>Vegan</span>
            </label>
            <label className="dietary-checkbox">
              <input
                type="checkbox"
                checked={glutenIntolerant}
                onChange={(e) => setGlutenIntolerant(e.target.checked)}
              />
              <span>Gluten Intolerant</span>
            </label>
            <label className="dietary-checkbox">
              <input
                type="checkbox"
                checked={lactoseIntolerant}
                onChange={(e) => setLactoseIntolerant(e.target.checked)}
              />
              <span>Lactose Intolerant</span>
            </label>
          </div>
        </div>

        <div className="form-group">
          <label>Menu Choices *</label>
          <p className="menu-description">Select one starter, one main, and one dessert:</p>
          <div className="menu-categories">
            {menuCategories.map(category => (
              <div key={category.category} className="menu-category">
                <h4 className="menu-category-title">{category.category}</h4>
                <div className="menu-options">
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
                        className={`menu-option ${isDisabled ? 'disabled' : ''} ${isDietaryConflict ? 'dietary-conflict' : ''}`}
                        title={isDietaryConflict ? 'This item conflicts with your dietary preferences' : ''}
                      >
                        <label className="menu-checkbox">
                          <input
                            type="checkbox"
                            checked={menuChoices.includes(option.id)}
                            onChange={() => handleMenuToggle(option.id, category)}
                            disabled={isDisabled}
                          />
                          <div className="menu-option-content">
                            <span className="menu-option-label">{option.label}</span>
                            <span className="menu-option-description">{option.description}</span>
                          </div>
                        </label>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
          {errors.menuChoices && (
            <span className="error-message">{errors.menuChoices}</span>
          )}
        </div>

        <div className="form-group">
          <label htmlFor="dietary-requirements">Additional Dietary Requirements</label>
          <textarea
            id="dietary-requirements"
            value={dietaryRequirements}
            onChange={(e) => setDietaryRequirements(e.target.value)}
            placeholder="Please list any other allergies, dietary restrictions, or special requirements (optional)"
            rows={4}
            className="dietary-textarea"
          />
          <p className="field-hint">This field is optional. Please let us know about any other allergies or special dietary needs.</p>
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
          <button type="submit" className="submit-button">
            Submit RSVP
          </button>
        </div>
      </form>
    </div>
  )
}

export default RSVPForm

