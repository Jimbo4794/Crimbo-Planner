# Crimbo Planner 🎄

A React application for planning your Christmas party! Guests can RSVP with their email and menu choices, then select their preferred seat at one of the 8-person tables.

## Features

- 📧 **RSVP Form**: Collect email addresses and menu preferences
- 🪑 **Seat Selection**: Interactive seat selection with visual table layout
- 📊 **Real-time Updates**: See which seats are occupied in real-time
- 🎨 **Modern UI**: Beautiful, responsive design with Christmas theme

## Getting Started

### Prerequisites

- Node.js (v16 or higher)
- npm or yarn

### Installation

1. Clone the repository:
```bash
git clone https://github.com/Jimbo4794/Crimbo-Planner.git
cd Crimbo-Planner
```

2. Install dependencies:
```bash
npm install
```

3. (Optional) Create a `.env` file in the project root to set a custom admin password:
```bash
echo "VITE_ADMIN_PASSWORD=your-secure-password" > .env
```

4. Start the development server:
```bash
npm run dev
```

5. Open your browser and navigate to `http://localhost:5173`

### Build for Production

To create a production build:

```bash
npm run build
```

The built files will be in the `dist` directory. You can preview the production build with:

```bash
npm run preview
```

### Docker Deployment

#### Using Docker

1. Build the Docker image with a custom admin password (optional):
```bash
docker build -t crimbo-planner --build-arg VITE_ADMIN_PASSWORD=your-secure-password .
```

   Or build with default password (admin123):
```bash
docker build -t crimbo-planner .
```

2. Run the container:
```bash
docker run -d -p 8080:80 --name crimbo-planner \
  -v $(pwd)/data:/usr/share/nginx/html/data \
  crimbo-planner
```

   Or with a named volume for persistent data:
```bash
docker run -d -p 8080:80 --name crimbo-planner \
  -v crimbo-planner-data:/usr/share/nginx/html/data \
  crimbo-planner
```

3. Access the application at `http://localhost:8080`

**Setting Admin Password**: The admin password can be set during the Docker build process using the `VITE_ADMIN_PASSWORD` build argument. If not specified, it defaults to `admin123`. For development, create a `.env` file in the project root with `VITE_ADMIN_PASSWORD=your-password`.

#### Using Docker Compose

1. Build and start the container:
```bash
docker-compose up -d
```

2. Access the application at `http://localhost:8080`

3. Stop the container:
```bash
docker-compose down
```

The Docker image uses a multi-stage build:
- **Build stage**: Uses Node.js to build the React application
- **Production stage**: Uses nginx to serve the static files

**Note**: Since this app uses browser localStorage for data storage, data is stored in the user's browser and is not persisted in the container. To persist data across sessions, use the export/import features in the Admin panel.

The volume mount (`-v`) option creates a persistent directory on your host machine where exported data files can be saved. This is useful for backing up RSVP data and configuration exports.

## Usage

1. **RSVP**: Enter your email address and select at least one menu option
2. **Select Seat**: After submitting your RSVP, choose an available seat at any of the tables
3. **Multiple RSVPs**: Click "Submit Another RSVP" to add more guests

## Project Structure

```
Crimbo-Planner/
├── src/
│   ├── components/
│   │   ├── RSVPForm.jsx       # RSVP form component
│   │   ├── RSVPForm.css
│   │   ├── SeatSelection.jsx  # Seat selection component
│   │   └── SeatSelection.css
│   ├── App.jsx                # Main app component
│   ├── App.css
│   ├── main.jsx               # Entry point
│   └── index.css              # Global styles
├── index.html
├── package.json
└── vite.config.js
```

## Technologies Used

- React 18
- Vite
- CSS3 (with modern features)

## License

See LICENSE file for details.