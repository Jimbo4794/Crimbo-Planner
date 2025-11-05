// Utility functions for dietary preference conflict detection

/**
 * Checks if a menu item conflicts with dietary preferences
 * @param {string} optionId - The menu option ID
 * @param {string} optionLabel - The menu option label
 * @param {string} optionDescription - The menu option description
 * @param {Object} menuOption - The full menu option object (may contain dietary flags)
 * @param {boolean} vegetarian - User is vegetarian
 * @param {boolean} vegan - User is vegan
 * @param {boolean} glutenIntolerant - User is gluten intolerant
 * @param {boolean} lactoseIntolerant - User is lactose intolerant
 * @returns {boolean} - True if the menu item conflicts with dietary preferences
 */
export const conflictsWithDietaryPreferences = (
  optionId,
  optionLabel,
  optionDescription,
  menuOption,
  vegetarian,
  vegan,
  glutenIntolerant,
  lactoseIntolerant
) => {
  // First, try to use dietary flags from menu item if available
  if (menuOption && (
    menuOption.hasOwnProperty('vegetarian') || 
    menuOption.hasOwnProperty('vegan') || 
    menuOption.hasOwnProperty('glutenFree') || 
    menuOption.hasOwnProperty('lactoseFree')
  )) {
    // If menu item has dietary flags defined, use them for precise checking
    if (vegetarian && !menuOption.vegetarian && !menuOption.vegan) {
      // If user is vegetarian, item must be vegetarian or vegan
      return true
    }
    if (vegan && !menuOption.vegan) {
      // If user is vegan, item must be vegan
      return true
    }
    if (glutenIntolerant && !menuOption.glutenFree) {
      // If user is gluten intolerant, item must be gluten free
      return true
    }
    if (lactoseIntolerant && !menuOption.lactoseFree) {
      // If user is lactose intolerant, item must be lactose free
      return true
    }
    // If flags indicate compatibility, no conflict
    return false
  }

  // Fallback to text-based detection for backward compatibility (when flags don't exist)
  const lowerId = optionId.toLowerCase()
  const lowerLabel = (optionLabel || '').toLowerCase()
  const lowerDesc = (optionDescription || '').toLowerCase()
  const combined = `${lowerId} ${lowerLabel} ${lowerDesc}`

  // Meat/fish items (conflict with vegetarian and vegan)
  const meatFishIds = ['turkey', 'ham', 'prawns', 'fish', 'salmon']
  const isMeatFish = meatFishIds.includes(lowerId) || 
    combined.includes('turkey') || combined.includes('ham') || 
    combined.includes('prawn') || combined.includes('salmon') || 
    combined.includes('fish')

  // Dairy items (conflict with vegan and lactose intolerant)
  const dairyIds = ['soup', 'cheesecake', 'icecream', 'ice cream']
  const isDairy = dairyIds.includes(lowerId) ||
    combined.includes('cream') || combined.includes('cheese') || 
    combined.includes('parmesan') || combined.includes('butter') ||
    combined.includes('dairy') || combined.includes('milk')

  // Gluten items (conflict with gluten intolerant)
  const glutenIds = ['pudding', 'pie']
  const isGluten = glutenIds.includes(lowerId) ||
    combined.includes('crust') || combined.includes('breadcrumb') ||
    combined.includes('pastry') || combined.includes('crouton') ||
    combined.includes('flour') || combined.includes('gluten')

  // Check conflicts
  if (vegetarian && isMeatFish && lowerId !== 'vegetarian') return true
  if (vegan && (isMeatFish || isDairy) && lowerId !== 'vegan') return true
  if (glutenIntolerant && isGluten) return true
  if (lactoseIntolerant && isDairy) return true

  return false
}

