import { useState, useEffect } from 'react'
import MainMenu from './components/MainMenu'
import RSVPForm from './components/RSVPForm'
import SeatSelection from './components/SeatSelection'
import Admin from './components/Admin'
import './App.css'

const STORAGE_KEY = 'crimbo-planner-rsvps'
const MENU_STORAGE_KEY = 'crimbo-planner-menu'
const TABLES_COUNT_STORAGE_KEY = 'crimbo-planner-tables-count'
const SEATS_PER_TABLE_STORAGE_KEY = 'crimbo-planner-seats-per-table'
const DEFAULT_TABLES_COUNT = 5
const DEFAULT_SEATS_PER_TABLE = 8

const DEFAULT_MENU_CATEGORIES = [
  {
    category: 'Starters',
    options: [
      { id: 'soup', label: 'Cream of Mushroom Soup', description: 'Creamy mushroom soup with fresh herbs' },
      { id: 'salad', label: 'Caesar Salad', description: 'Crisp romaine lettuce with Caesar dressing and parmesan' },
      { id: 'prawns', label: 'Prawn Cocktail', description: 'Chilled prawns with cocktail sauce' }
    ]
  },
  {
    category: 'Mains',
    options: [
      { id: 'turkey', label: 'Roast Turkey', description: 'Traditional roast turkey with gravy' },
      { id: 'ham', label: 'Honey Glazed Ham', description: 'Succulent honey glazed ham' },
      { id: 'vegetarian', label: 'Vegetarian Option', description: 'Stuffed bell peppers with quinoa' },
      { id: 'vegan', label: 'Vegan Option', description: 'Roasted vegetable medley' },
      { id: 'fish', label: 'Salmon', description: 'Herb-crusted salmon fillet' }
    ]
  },
  {
    category: 'Desserts',
    options: [
      { id: 'pudding', label: 'Christmas Pudding', description: 'Traditional Christmas pudding with brandy sauce' },
      { id: 'pie', label: 'Mince Pie', description: 'Sweet mince pie with brandy butter' },
      { id: 'cheesecake', label: 'Baileys Cheesecake', description: 'Creamy Baileys Irish cream cheesecake' },
      { id: 'icecream', label: 'Vanilla Ice Cream', description: 'Classic vanilla ice cream' }
    ]
  }
]

// Load menu categories from localStorage
const loadMenuFromStorage = () => {
  try {
    const stored = localStorage.getItem(MENU_STORAGE_KEY)
    if (stored) {
      return JSON.parse(stored)
    }
  } catch (error) {
    console.error('Error loading menu from localStorage:', error)
  }
  return DEFAULT_MENU_CATEGORIES
}

// Load tables count from localStorage
const loadTablesCountFromStorage = () => {
  try {
    const stored = localStorage.getItem(TABLES_COUNT_STORAGE_KEY)
    if (stored) {
      const count = parseInt(stored, 10)
      return isNaN(count) || count < 1 ? DEFAULT_TABLES_COUNT : count
    }
  } catch (error) {
    console.error('Error loading tables count from localStorage:', error)
  }
  return DEFAULT_TABLES_COUNT
}

// Load seats per table from localStorage
const loadSeatsPerTableFromStorage = () => {
  try {
    const stored = localStorage.getItem(SEATS_PER_TABLE_STORAGE_KEY)
    if (stored) {
      const count = parseInt(stored, 10)
      return isNaN(count) || count < 1 ? DEFAULT_SEATS_PER_TABLE : count
    }
  } catch (error) {
    console.error('Error loading seats per table from localStorage:', error)
  }
  return DEFAULT_SEATS_PER_TABLE
}

// Save menu categories to localStorage
const saveMenuToStorage = (menuCategories) => {
  try {
    localStorage.setItem(MENU_STORAGE_KEY, JSON.stringify(menuCategories))
  } catch (error) {
    console.error('Error saving menu to localStorage:', error)
  }
}

// Load RSVPs from localStorage
const loadRSVPsFromStorage = () => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      return JSON.parse(stored)
    }
  } catch (error) {
    console.error('Error loading RSVPs from localStorage:', error)
  }
  return []
}

// Save RSVPs to localStorage
const saveRSVPsToStorage = (rsvps) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(rsvps))
  } catch (error) {
    console.error('Error saving RSVPs to localStorage:', error)
  }
}

function App() {
  const [rsvps, setRsvps] = useState(() => loadRSVPsFromStorage())
  const [menuCategories, setMenuCategories] = useState(() => loadMenuFromStorage())
  const [tablesCount, setTablesCount] = useState(() => loadTablesCountFromStorage())
  const [seatsPerTable, setSeatsPerTable] = useState(() => loadSeatsPerTableFromStorage())
  const [currentStep, setCurrentStep] = useState('menu') // 'menu', 'rsvp', 'seating', or 'admin'

  // Save to localStorage whenever RSVPs change
  useEffect(() => {
    saveRSVPsToStorage(rsvps)
  }, [rsvps])

  // Save to localStorage whenever menu categories change
  useEffect(() => {
    saveMenuToStorage(menuCategories)
  }, [menuCategories])

  // Save to localStorage whenever tables count changes
  useEffect(() => {
    try {
      localStorage.setItem(TABLES_COUNT_STORAGE_KEY, tablesCount.toString())
    } catch (error) {
      console.error('Error saving tables count to localStorage:', error)
    }
  }, [tablesCount])

  // Save to localStorage whenever seats per table changes
  useEffect(() => {
    try {
      localStorage.setItem(SEATS_PER_TABLE_STORAGE_KEY, seatsPerTable.toString())
    } catch (error) {
      console.error('Error saving seats per table to localStorage:', error)
    }
  }, [seatsPerTable])

  const handleRSVPSubmit = (rsvpData) => {
    const newRSVP = {
      id: Date.now().toString(),
      name: rsvpData.name,
      email: rsvpData.email,
      menuChoices: rsvpData.menuChoices,
      dietaryRequirements: rsvpData.dietaryRequirements || '',
      icon: rsvpData.icon || '🎄',
      iconType: rsvpData.iconType || 'emoji',
      seat: null,
      table: null,
      submittedAt: new Date().toISOString()
    }
    setRsvps([...rsvps, newRSVP])
    setCurrentStep('seating')
  }

  const handleNavigate = (step) => {
    setCurrentStep(step)
  }

  const handleSeatSelection = (tableNumber, seatNumber) => {
    // Get the most recent RSVP (the one that just submitted)
    const latestRSVP = rsvps[rsvps.length - 1]
    if (latestRSVP && !latestRSVP.seat) {
      // Check if seat is already taken
      const isTaken = rsvps.some(r => r.table === tableNumber && r.seat === seatNumber)
      if (isTaken) {
        alert('This seat is already taken! Please choose another.')
        return
      }
      
      const updatedRSVPs = rsvps.map((rsvp, index) => 
        index === rsvps.length - 1 
          ? { ...rsvp, table: tableNumber, seat: seatNumber }
          : rsvp
      )
      setRsvps(updatedRSVPs)
      // localStorage will be updated automatically via useEffect
    }
  }

  const handleChangeSeat = (email, newTableNumber, newSeatNumber) => {
    // Find the RSVP by email (case-insensitive)
    const rsvpIndex = rsvps.findIndex(r => r.email.toLowerCase() === email.toLowerCase())
    
    if (rsvpIndex === -1) {
      alert('Reservation not found!')
      return
    }

    const rsvp = rsvps[rsvpIndex]
    
    // Check if the new seat is already taken by someone else
    const isTaken = rsvps.some((r, index) => 
      index !== rsvpIndex && r.table === newTableNumber && r.seat === newSeatNumber
    )
    
    if (isTaken) {
      alert('This seat is already taken! Please choose another.')
      return
    }

    // Update the RSVP with new seat assignment
    const updatedRSVPs = rsvps.map((r, index) => 
      index === rsvpIndex
        ? { ...r, table: newTableNumber, seat: newSeatNumber }
        : r
    )
    
    setRsvps(updatedRSVPs)
    // localStorage will be updated automatically via useEffect
  }

  const handleUpdateMenuChoices = (email, newMenuChoices) => {
    // Find the RSVP by email (case-insensitive)
    const rsvpIndex = rsvps.findIndex(r => r.email.toLowerCase() === email.toLowerCase())
    
    if (rsvpIndex === -1) {
      alert('Reservation not found!')
      return
    }

    if (newMenuChoices.length === 0) {
      alert('Please select at least one menu option')
      return
    }

    // Update the RSVP with new menu choices
    const updatedRSVPs = rsvps.map((r, index) => 
      index === rsvpIndex
        ? { ...r, menuChoices: newMenuChoices }
        : r
    )
    
    setRsvps(updatedRSVPs)
    // localStorage will be updated automatically via useEffect
  }

  const handleUpdateDietaryRequirements = (email, newDietaryRequirements) => {
    // Find the RSVP by email (case-insensitive)
    const rsvpIndex = rsvps.findIndex(r => r.email.toLowerCase() === email.toLowerCase())
    
    if (rsvpIndex === -1) {
      alert('Reservation not found!')
      return
    }

    // Update the RSVP with new dietary requirements
    const updatedRSVPs = rsvps.map((r, index) => 
      index === rsvpIndex
        ? { ...r, dietaryRequirements: newDietaryRequirements.trim() }
        : r
    )
    
    setRsvps(updatedRSVPs)
    // localStorage will be updated automatically via useEffect
  }

  const handleNewRSVP = () => {
    setCurrentStep('rsvp')
  }

  const handleBackToMenu = () => {
    setCurrentStep('menu')
  }

  const handleUpdateRSVPs = (updatedRSVPs) => {
    setRsvps(updatedRSVPs)
  }

  const handleUpdateMenuCategories = (updatedMenuCategories) => {
    setMenuCategories(updatedMenuCategories)
  }

  const handleUpdateTablesCount = (newTablesCount) => {
    // Validate: must be at least 1
    if (newTablesCount < 1) {
      alert('Number of tables must be at least 1')
      return
    }
    setTablesCount(newTablesCount)
  }

  const handleUpdateSeatsPerTable = (newSeatsPerTable) => {
    // Validate: must be at least 1
    if (newSeatsPerTable < 1) {
      alert('Number of seats per table must be at least 1')
      return
    }
    setSeatsPerTable(newSeatsPerTable)
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>🎄 Crimbo Planner</h1>
        <p className="subtitle">Christmas Party RSVP & Seating</p>
      </header>

      <main className="app-main">
        {currentStep === 'menu' ? (
          <MainMenu onNavigate={handleNavigate} />
        ) : currentStep === 'rsvp' ? (
          <RSVPForm 
            onSubmit={handleRSVPSubmit} 
            onBackToMenu={handleBackToMenu}
            menuCategories={menuCategories}
          />
        ) : currentStep === 'admin' ? (
          <Admin 
            rsvps={rsvps}
            menuCategories={menuCategories}
            tablesCount={tablesCount}
            seatsPerTable={seatsPerTable}
            onUpdateRSVPs={handleUpdateRSVPs}
            onUpdateMenuCategories={handleUpdateMenuCategories}
            onUpdateTablesCount={handleUpdateTablesCount}
            onUpdateSeatsPerTable={handleUpdateSeatsPerTable}
            onBackToMenu={handleBackToMenu}
          />
        ) : (
          <SeatSelection 
            rsvps={rsvps}
            tablesCount={tablesCount}
            seatsPerTable={seatsPerTable}
            onSeatSelect={handleSeatSelection}
            onNewRSVP={handleNewRSVP}
            onChangeSeat={handleChangeSeat}
            onUpdateMenuChoices={handleUpdateMenuChoices}
            onUpdateDietaryRequirements={handleUpdateDietaryRequirements}
            onBackToMenu={handleBackToMenu}
            menuCategories={menuCategories}
          />
        )}
      </main>

      <footer className="app-footer">
        <p>Made with ❤️ for your Christmas party</p>
      </footer>
    </div>
  )
}

export default App

