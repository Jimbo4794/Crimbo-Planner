import { useState, useEffect } from 'react'
import MainMenu from './components/MainMenu'
import RSVPForm from './components/RSVPForm'
import SeatSelection from './components/SeatSelection'
import Admin from './components/Admin'
import LiftSharing from './components/LiftSharing'
import { fetchRSVPs, saveRSVPs, fetchMenu, saveMenu, fetchConfig, saveConfig } from './api'
import { DEFAULT_TABLES_COUNT, DEFAULT_SEATS_PER_TABLE } from './utils/constants'
import './App.css'

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


function App() {
  const [rsvps, setRsvps] = useState([])
  const [menuCategories, setMenuCategories] = useState(DEFAULT_MENU_CATEGORIES)
  const [tablesCount, setTablesCount] = useState(DEFAULT_TABLES_COUNT)
  const [seatsPerTable, setSeatsPerTable] = useState(DEFAULT_SEATS_PER_TABLE)
  const [tablePositions, setTablePositions] = useState(null) // Array of {tableNumber, x, y} or null for default grid
  const [customAreas, setCustomAreas] = useState(null) // Array of {id, label, x, y} for custom labeled areas
  const [gridCols, setGridCols] = useState(12) // Number of columns in arrangement grid
  const [gridRows, setGridRows] = useState(8) // Number of rows in arrangement grid
  const [tableDisplayNames, setTableDisplayNames] = useState(null) // Object mapping tableNumber to display name
  const [currentStep, setCurrentStep] = useState('menu') // 'menu', 'rsvp', 'seating', 'liftsharing', or 'admin'
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Load initial data from API
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true)
        setError(null)

        // Load all data in parallel
        const [rsvpsData, menuData, configData] = await Promise.all([
          fetchRSVPs().catch(() => []),
          fetchMenu().catch(() => null),
          fetchConfig().catch(() => ({ tablesCount: DEFAULT_TABLES_COUNT, seatsPerTable: DEFAULT_SEATS_PER_TABLE }))
        ])

        setRsvps(rsvpsData)
        if (menuData) {
          setMenuCategories(menuData)
        }
        setTablesCount(configData.tablesCount || DEFAULT_TABLES_COUNT)
        setSeatsPerTable(configData.seatsPerTable || DEFAULT_SEATS_PER_TABLE)
        setTablePositions(configData.tablePositions || null)
        setCustomAreas(configData.customAreas || null)
        setGridCols(configData.gridCols || 12)
        setGridRows(configData.gridRows || 8)
        setTableDisplayNames(configData.tableDisplayNames || null)
      } catch (err) {
        console.error('Error loading data:', err)
        setError('Failed to load data. Please refresh the page.')
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [])

  // Save to API whenever RSVPs change
  useEffect(() => {
    if (!loading) {
      saveRSVPs(rsvps).catch(err => {
        console.error('Error saving RSVPs:', err)
        setError('Failed to save RSVPs. Please try again.')
      })
    }
  }, [rsvps, loading])

  // Save to API whenever menu categories change
  useEffect(() => {
    if (!loading) {
      saveMenu(menuCategories).catch(err => {
        console.error('Error saving menu:', err)
        setError('Failed to save menu. Please try again.')
      })
    }
  }, [menuCategories, loading])

  // Save to API whenever tables count, seats per table, table positions, custom areas, grid size, or table display names change
  useEffect(() => {
    if (!loading) {
      saveConfig(tablesCount, seatsPerTable, tablePositions, customAreas, gridCols, gridRows, tableDisplayNames).catch(err => {
        console.error('Error saving config:', err)
        setError('Failed to save configuration. Please try again.')
      })
    }
  }, [tablesCount, seatsPerTable, tablePositions, customAreas, gridCols, gridRows, tableDisplayNames, loading])

  const handleRSVPSubmit = (rsvpData) => {
    const newRSVP = {
      id: Date.now().toString(),
      name: rsvpData.name,
      email: rsvpData.email,
      menuChoices: rsvpData.menuChoices,
      dietaryRequirements: rsvpData.dietaryRequirements || '',
      vegetarian: rsvpData.vegetarian || false,
      vegan: rsvpData.vegan || false,
      glutenIntolerant: rsvpData.glutenIntolerant || false,
      lactoseIntolerant: rsvpData.lactoseIntolerant || false,
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
      // API will be updated automatically via useEffect
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
    // API will be updated automatically via useEffect
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
    // API will be updated automatically via useEffect
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
    // API will be updated automatically via useEffect
  }

  const handleUpdateDietaryPreferences = (email, dietaryPreferences) => {
    // Find the RSVP by email (case-insensitive)
    const rsvpIndex = rsvps.findIndex(r => r.email.toLowerCase() === email.toLowerCase())
    
    if (rsvpIndex === -1) {
      alert('Reservation not found!')
      return
    }

    // Update the RSVP with new dietary preferences
    const updatedRSVPs = rsvps.map((r, index) => 
      index === rsvpIndex
        ? { 
            ...r, 
            vegetarian: dietaryPreferences.vegetarian || false,
            vegan: dietaryPreferences.vegan || false,
            glutenIntolerant: dietaryPreferences.glutenIntolerant || false,
            lactoseIntolerant: dietaryPreferences.lactoseIntolerant || false
          }
        : r
    )
    
    setRsvps(updatedRSVPs)
    // API will be updated automatically via useEffect
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

  if (loading) {
    return (
      <div className="app">
        <header className="app-header">
          <h1>🎄 Crimbo Planner</h1>
          <p className="subtitle">Christmas Party RSVP & Seating</p>
        </header>
        <main className="app-main">
          <div style={{ textAlign: 'center', padding: '2rem' }}>
            <p>Loading...</p>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="app">
      <header className="app-header">
        <div className="app-header-content">
          <div>
            <h1>🎄 Crimbo Planner</h1>
            <p className="subtitle">Christmas Party RSVP & Seating</p>
          </div>
          {currentStep !== 'menu' && (
            <button onClick={handleBackToMenu} className="header-back-button">
              Back to Menu
            </button>
          )}
        </div>
      </header>
      {error && (
        <div style={{ 
          background: '#ff6b6b', 
          color: 'white', 
          padding: '0.5rem 1rem', 
          textAlign: 'center',
          margin: '0 1rem'
        }}>
          {error}
          <button 
            onClick={() => setError(null)} 
            style={{ marginLeft: '1rem', background: 'white', border: 'none', padding: '0.25rem 0.5rem', cursor: 'pointer' }}
          >
            ×
          </button>
        </div>
      )}

      <main className="app-main">
        {currentStep === 'menu' ? (
          <MainMenu onNavigate={handleNavigate} />
        ) : currentStep === 'rsvp' ? (
          <RSVPForm 
            onSubmit={handleRSVPSubmit} 
            onBackToMenu={handleBackToMenu}
            menuCategories={menuCategories}
            existingRSVPs={rsvps}
          />
        ) : currentStep === 'liftsharing' ? (
          <LiftSharing 
            onBackToMenu={handleBackToMenu}
            rsvps={rsvps}
          />
        ) : currentStep === 'admin' ? (
          <Admin 
            rsvps={rsvps}
            menuCategories={menuCategories}
            tablesCount={tablesCount}
            seatsPerTable={seatsPerTable}
            tablePositions={tablePositions}
            customAreas={customAreas}
            gridCols={gridCols}
            gridRows={gridRows}
            onUpdateRSVPs={handleUpdateRSVPs}
            onUpdateMenuCategories={handleUpdateMenuCategories}
            onUpdateTablesCount={handleUpdateTablesCount}
            onUpdateSeatsPerTable={handleUpdateSeatsPerTable}
            onUpdateTablePositions={setTablePositions}
            onUpdateCustomAreas={setCustomAreas}
            onUpdateGridCols={setGridCols}
            onUpdateGridRows={setGridRows}
            onBackToMenu={handleBackToMenu}
          />
        ) : (
          <SeatSelection 
            rsvps={rsvps}
            tablesCount={tablesCount}
            seatsPerTable={seatsPerTable}
            tablePositions={tablePositions}
            customAreas={customAreas}
            gridCols={gridCols}
            gridRows={gridRows}
            tableDisplayNames={tableDisplayNames}
            onSeatSelect={handleSeatSelection}
            onChangeSeat={handleChangeSeat}
            onUpdateMenuChoices={handleUpdateMenuChoices}
            onUpdateDietaryRequirements={handleUpdateDietaryRequirements}
            onUpdateDietaryPreferences={handleUpdateDietaryPreferences}
            onBackToMenu={handleBackToMenu}
            onNavigate={handleNavigate}
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

