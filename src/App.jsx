import { useState, useEffect, useRef } from 'react'
import MainMenu from './components/MainMenu'
import RSVPForm from './components/RSVPForm'
import SeatSelection from './components/SeatSelection'
import Admin from './components/Admin'
import LiftSharing from './components/LiftSharing'
import EventDetails from './components/EventDetails'
import Feedback from './components/Feedback'
import Framies from './components/Framies'
import BackgroundMosaic from './components/BackgroundMosaic'
import { fetchRSVPs, saveRSVPs, fetchMenu, saveMenu, fetchConfig, saveConfig, fetchEventDetails, saveEventDetails } from './api'
import { DEFAULT_TABLES_COUNT, DEFAULT_SEATS_PER_TABLE } from './utils/constants'
import { getSocket, disconnectSocket } from './utils/websocket'
import logger from './utils/logger'
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

// Helper function to normalize menu data from old object format to array format
const normalizeMenuData = (menuData) => {
  if (!menuData) return null
  if (Array.isArray(menuData)) return menuData
  
  // Handle old object format with numeric keys
  if (typeof menuData === 'object' && !Array.isArray(menuData)) {
    const keys = Object.keys(menuData).filter(key => key !== '_version' && !isNaN(parseInt(key)))
    if (keys.length > 0) {
      // Convert object with numeric keys to array
      const sortedKeys = keys.sort((a, b) => parseInt(a) - parseInt(b))
      return sortedKeys.map(key => menuData[key])
    }
  }
  
  return menuData
}


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
  const [eventDetails, setEventDetails] = useState(null) // Event details object
  const [rsvpLocked, setRsvpLocked] = useState(false) // Lock state for RSVP submissions
  const [seatingLocked, setSeatingLocked] = useState(false) // Lock state for seat changes
  const [framiesNominationsLocked, setFramiesNominationsLocked] = useState(false) // Lock state for Framies nominations
  const [framiesVotingLocked, setFramiesVotingLocked] = useState(false) // Lock state for Framies voting
  const [currentStep, setCurrentStep] = useState('menu') // 'menu', 'rsvp', 'seating', 'liftsharing', 'eventdetails', 'feedback', 'framies', or 'admin'
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [rsvpsVersion, setRsvpsVersion] = useState(0) // Version counter to force re-renders
  const [pendingRSVPId, setPendingRSVPId] = useState(null) // Track RSVP ID that was just created locally
  
  // Refs to track if updates are from WebSocket (to prevent infinite save loops)
  const isUpdatingFromWebSocket = useRef(false)
  // Track if initial data load was successful (prevents saving empty array after failed load)
  const initialLoadSuccessful = useRef(false)

  // Load initial data from API
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true)
        setError(null)

        // Load all data in parallel
        const [rsvpsData, menuData, configData, eventData] = await Promise.all([
          fetchRSVPs().catch(() => []),
          fetchMenu().catch(() => null),
          fetchConfig().catch(() => ({ tablesCount: DEFAULT_TABLES_COUNT, seatsPerTable: DEFAULT_SEATS_PER_TABLE })),
          fetchEventDetails().catch(() => null)
        ])

        // Mark initial load as successful only if we got valid data
        // This prevents saving empty array if the API call failed
        initialLoadSuccessful.current = true
        setRsvps(rsvpsData)
        if (menuData) {
          const normalizedMenu = normalizeMenuData(menuData)
          if (normalizedMenu && Array.isArray(normalizedMenu)) {
            setMenuCategories(normalizedMenu)
          }
        }
        setTablesCount(configData.tablesCount || DEFAULT_TABLES_COUNT)
        setSeatsPerTable(configData.seatsPerTable || DEFAULT_SEATS_PER_TABLE)
        setTablePositions(configData.tablePositions || null)
        setCustomAreas(configData.customAreas || null)
        setGridCols(configData.gridCols || 12)
        setGridRows(configData.gridRows || 8)
        setTableDisplayNames(configData.tableDisplayNames || null)
        setRsvpLocked(configData.rsvpLocked || false)
        setSeatingLocked(configData.seatingLocked || false)
        setFramiesNominationsLocked(configData.framiesNominationsLocked || false)
        setFramiesVotingLocked(configData.framiesVotingLocked || false)
        setEventDetails(eventData)
      } catch (err) {
        logger.error('Error loading data:', err)
        setError('Failed to load data. Please refresh the page.')
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [])

  // Set up WebSocket connection and listeners for real-time updates
  useEffect(() => {
    const socket = getSocket()
    
    // Test connection
    socket.on('test', (data) => {
      logger.debug('Test event received from server:', data)
    })

    // Listen for RSVP updates
    socket.on('rsvps:updated', (updatedRsvps) => {
      logger.debug('Received rsvps:updated event', updatedRsvps?.length, 'RSVPs')
      if (Array.isArray(updatedRsvps)) {
        // Set flag BEFORE updating state to prevent save loop
        isUpdatingFromWebSocket.current = true
        // Create a new array reference to ensure React detects the change
        const newRsvps = [...updatedRsvps]
        logger.debug('Updating RSVPs state from WebSocket, new count:', newRsvps.length)
        setRsvps(newRsvps)
        // Increment version to force re-render
        setRsvpsVersion(prev => prev + 1)
        // Reset flag after state update completes (use longer timeout to ensure useEffect has run)
        setTimeout(() => {
          isUpdatingFromWebSocket.current = false
        }, 500)
      }
    })

    // Listen for menu updates
    socket.on('menu:updated', (updatedMenu) => {
      if (Array.isArray(updatedMenu)) {
        isUpdatingFromWebSocket.current = true
        const normalizedMenu = normalizeMenuData(updatedMenu)
        if (normalizedMenu && Array.isArray(normalizedMenu)) {
          setMenuCategories(normalizedMenu)
        }
        setTimeout(() => {
          isUpdatingFromWebSocket.current = false
        }, 100)
      }
    })

    // Listen for config updates
    socket.on('config:updated', (updatedConfig) => {
      if (updatedConfig && typeof updatedConfig === 'object') {
        isUpdatingFromWebSocket.current = true
        if (updatedConfig.tablesCount !== undefined) {
          setTablesCount(updatedConfig.tablesCount)
        }
        if (updatedConfig.seatsPerTable !== undefined) {
          setSeatsPerTable(updatedConfig.seatsPerTable)
        }
        if (updatedConfig.tablePositions !== undefined) {
          setTablePositions(updatedConfig.tablePositions)
        }
        if (updatedConfig.customAreas !== undefined) {
          setCustomAreas(updatedConfig.customAreas)
        }
        if (updatedConfig.gridCols !== undefined) {
          setGridCols(updatedConfig.gridCols)
        }
        if (updatedConfig.gridRows !== undefined) {
          setGridRows(updatedConfig.gridRows)
        }
        if (updatedConfig.tableDisplayNames !== undefined) {
          setTableDisplayNames(updatedConfig.tableDisplayNames)
        }
        if (updatedConfig.rsvpLocked !== undefined) {
          setRsvpLocked(updatedConfig.rsvpLocked)
        }
        if (updatedConfig.seatingLocked !== undefined) {
          setSeatingLocked(updatedConfig.seatingLocked)
        }
        if (updatedConfig.framiesNominationsLocked !== undefined) {
          setFramiesNominationsLocked(updatedConfig.framiesNominationsLocked)
        }
        if (updatedConfig.framiesVotingLocked !== undefined) {
          setFramiesVotingLocked(updatedConfig.framiesVotingLocked)
        }
        setTimeout(() => {
          isUpdatingFromWebSocket.current = false
        }, 100)
      }
    })

    // Listen for event details updates
    socket.on('event:updated', (updatedEventDetails) => {
      if (updatedEventDetails) {
        isUpdatingFromWebSocket.current = true
        setEventDetails(updatedEventDetails)
        setTimeout(() => {
          isUpdatingFromWebSocket.current = false
        }, 100)
      }
    })

    // Cleanup on unmount
    return () => {
      socket.off('rsvps:updated')
      socket.off('menu:updated')
      socket.off('config:updated')
      socket.off('event:updated')
    }
  }, [])

  // Save to API whenever RSVPs change (but not if update came from WebSocket)
  useEffect(() => {
    // Skip if we're still loading initial data
    if (loading) return
    
    // Skip if initial load wasn't successful (prevents saving empty array after failed load)
    if (!initialLoadSuccessful.current) {
      logger.debug('Skipping RSVP save - initial load was not successful')
      return
    }
    
    // Skip if this update came from WebSocket
    if (isUpdatingFromWebSocket.current) {
      logger.debug('Skipping RSVP save - update came from WebSocket')
      return
    }
    
    // Only save if RSVPs array actually changed (not just reference)
    // This prevents unnecessary saves on re-renders
    logger.debug('Saving RSVPs to API, count:', rsvps.length)
    saveRSVPs(rsvps).catch(err => {
      logger.error('Error saving RSVPs:', err)
      setError('Failed to save RSVPs. Please try again.')
    })
  }, [rsvps, loading])

  // Save to API whenever menu categories change (but not if update came from WebSocket)
  useEffect(() => {
    if (!loading && !isUpdatingFromWebSocket.current) {
      saveMenu(menuCategories).catch(err => {
        logger.error('Error saving menu:', err)
        setError('Failed to save menu. Please try again.')
      })
    }
  }, [menuCategories, loading])

  // Save to API whenever tables count, seats per table, table positions, custom areas, grid size, table display names, or lock states change (but not if update came from WebSocket)
  useEffect(() => {
    if (!loading && !isUpdatingFromWebSocket.current) {
      saveConfig(tablesCount, seatsPerTable, tablePositions, customAreas, gridCols, gridRows, tableDisplayNames, rsvpLocked, seatingLocked, framiesNominationsLocked, framiesVotingLocked).catch(err => {
        logger.error('Error saving config:', err)
        setError('Failed to save configuration. Please try again.')
      })
    }
  }, [tablesCount, seatsPerTable, tablePositions, customAreas, gridCols, gridRows, tableDisplayNames, rsvpLocked, seatingLocked, framiesNominationsLocked, framiesVotingLocked, loading])

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
    // Track this RSVP ID so SeatSelection knows to auto-sign in for this one
    setPendingRSVPId(newRSVP.id)
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

  const handleUpdateIcon = (email, icon, iconType) => {
    // Find the RSVP by email (case-insensitive)
    const rsvpIndex = rsvps.findIndex(r => r.email.toLowerCase() === email.toLowerCase())
    
    if (rsvpIndex === -1) {
      alert('Reservation not found!')
      return
    }

    // Update the RSVP with new icon
    const updatedRSVPs = rsvps.map((r, index) => 
      index === rsvpIndex
        ? { ...r, icon: icon, iconType: iconType }
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

  const handleUpdateEventDetails = (updatedEventDetails) => {
    setEventDetails(updatedEventDetails)
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

  const handleUpdateRsvpLocked = (locked) => {
    setRsvpLocked(locked)
  }

  const handleUpdateSeatingLocked = (locked) => {
    setSeatingLocked(locked)
  }

  const handleUpdateFramiesNominationsLocked = (locked) => {
    setFramiesNominationsLocked(locked)
  }

  const handleUpdateFramiesVotingLocked = (locked) => {
    setFramiesVotingLocked(locked)
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
      <BackgroundMosaic />
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
        {currentStep !== 'menu' && (
          <nav className="app-navigation">
            <button
              onClick={() => handleNavigate('rsvp')}
              className={`nav-tab ${currentStep === 'rsvp' ? 'active' : ''}`}
            >
              📝 RSVP
            </button>
            <button
              onClick={() => handleNavigate('seating')}
              className={`nav-tab ${currentStep === 'seating' ? 'active' : ''}`}
            >
              🪑 Seating
            </button>
            <button
              onClick={() => handleNavigate('liftsharing')}
              className={`nav-tab ${currentStep === 'liftsharing' ? 'active' : ''}`}
            >
              🚗 Lift Sharing
            </button>
            <button
              onClick={() => handleNavigate('eventdetails')}
              className={`nav-tab ${currentStep === 'eventdetails' ? 'active' : ''}`}
            >
              📅 Event Details
            </button>
            <button
              onClick={() => handleNavigate('feedback')}
              className={`nav-tab ${currentStep === 'feedback' ? 'active' : ''}`}
            >
              💬 Feedback
            </button>
            <button
              onClick={() => handleNavigate('framies')}
              className={`nav-tab ${currentStep === 'framies' ? 'active' : ''}`}
            >
              🏆 Framies
            </button>
          </nav>
        )}
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
            rsvpLocked={rsvpLocked}
          />
        ) : currentStep === 'liftsharing' ? (
          <LiftSharing 
            onBackToMenu={handleBackToMenu}
            rsvps={rsvps}
          />
        ) : currentStep === 'eventdetails' ? (
          <EventDetails 
            onBackToMenu={handleBackToMenu}
            eventDetails={eventDetails}
          />
        ) : currentStep === 'feedback' ? (
          <Feedback 
            onBackToMenu={handleBackToMenu}
          />
        ) : currentStep === 'framies' ? (
          <Framies 
            onBackToMenu={handleBackToMenu}
            rsvps={rsvps}
            framiesNominationsLocked={framiesNominationsLocked}
            framiesVotingLocked={framiesVotingLocked}
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
            eventDetails={eventDetails}
            rsvpLocked={rsvpLocked}
            seatingLocked={seatingLocked}
            framiesNominationsLocked={framiesNominationsLocked}
            framiesVotingLocked={framiesVotingLocked}
            onUpdateRSVPs={handleUpdateRSVPs}
            onUpdateMenuCategories={handleUpdateMenuCategories}
            onUpdateTablesCount={handleUpdateTablesCount}
            onUpdateSeatsPerTable={handleUpdateSeatsPerTable}
            onUpdateTablePositions={setTablePositions}
            onUpdateCustomAreas={setCustomAreas}
            onUpdateGridCols={setGridCols}
            onUpdateGridRows={setGridRows}
            onUpdateEventDetails={handleUpdateEventDetails}
            onUpdateRsvpLocked={handleUpdateRsvpLocked}
            onUpdateSeatingLocked={handleUpdateSeatingLocked}
            onUpdateFramiesNominationsLocked={handleUpdateFramiesNominationsLocked}
            onUpdateFramiesVotingLocked={handleUpdateFramiesVotingLocked}
            onBackToMenu={handleBackToMenu}
          />
        ) : (
          <SeatSelection 
            rsvps={rsvps}
            pendingRSVPId={pendingRSVPId}
            onPendingRSVPProcessed={() => setPendingRSVPId(null)}
            tablesCount={tablesCount}
            seatsPerTable={seatsPerTable}
            tablePositions={tablePositions}
            customAreas={customAreas}
            gridCols={gridCols}
            gridRows={gridRows}
            tableDisplayNames={tableDisplayNames}
            seatingLocked={seatingLocked}
            onSeatSelect={handleSeatSelection}
            onChangeSeat={handleChangeSeat}
            onUpdateMenuChoices={handleUpdateMenuChoices}
            onUpdateDietaryRequirements={handleUpdateDietaryRequirements}
            onUpdateDietaryPreferences={handleUpdateDietaryPreferences}
            onUpdateIcon={handleUpdateIcon}
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

