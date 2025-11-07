import './MainMenu.css'

function MainMenu({ onNavigate }) {
  return (
    <div className="main-menu-container">
      <h2>Christmas Party Planner</h2>
      <p className="menu-subtitle">What would you like to do?</p>
      
      <div className="menu-options">
        <button 
          onClick={() => onNavigate('rsvp')} 
          className="menu-option"
        >
          <div className="menu-icon">📝</div>
          <div className="menu-content">
            <h3>RSVP</h3>
            <p>Submit a new RSVP with your name, email, and menu choices</p>
          </div>
        </button>

        <button 
          onClick={() => onNavigate('seating')} 
          className="menu-option"
        >
          <div className="menu-icon">🪑</div>
          <div className="menu-content">
            <h3>Seating Plan</h3>
            <p>View tables, select seats, or change your existing seat</p>
          </div>
        </button>

        <button 
          onClick={() => onNavigate('liftsharing')} 
          className="menu-option"
        >
          <div className="menu-icon">🚗</div>
          <div className="menu-content">
            <h3>Lift Sharing</h3>
            <p>Organise lift sharing - offer a lift or sign up for one</p>
          </div>
        </button>

        <button 
          onClick={() => onNavigate('eventdetails')} 
          className="menu-option"
        >
          <div className="menu-icon">📅</div>
          <div className="menu-content">
            <h3>Event Details</h3>
            <p>View and edit event information, date, location, and more</p>
          </div>
        </button>

        <button 
          onClick={() => onNavigate('feedback')} 
          className="menu-option"
        >
          <div className="menu-icon">💬</div>
          <div className="menu-content">
            <h3>Feedback</h3>
            <p>Share your thoughts and feedback about the event</p>
          </div>
        </button>

        <button 
          onClick={() => onNavigate('admin')} 
          className="menu-option"
        >
          <div className="menu-icon">⚙️</div>
          <div className="menu-content">
            <h3>Admin</h3>
            <p>Manage users and menu options (password required)</p>
          </div>
        </button>
      </div>
    </div>
  )
}

export default MainMenu

