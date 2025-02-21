# Gander Warehouse Platform

This monorepo contains both the client and warehouse portals for the Gander Warehouse platform.

## Project Structure

```
/
├── client/         # Client-facing Next.js application (Port 3000)
├── warehouse/      # Warehouse management Next.js application (Port 3001)
└── package.json    # Root package.json for running both applications
```

## Prerequisites

- Node.js (v18 or higher recommended)
- npm (comes with Node.js)

## Getting Started

1. **Install Dependencies**
   
   From the root directory, run:
   ```bash
   npm run install-all
   ```
   This will install dependencies for both the client and warehouse applications, as well as root dependencies.

2. **Start Development Servers**
   
   To run both applications simultaneously:
   ```bash
   npm run dev
   ```
   This will start:
   - Client portal at [http://localhost:3000](http://localhost:3000)
   - Warehouse portal at [http://localhost:3001](http://localhost:3001)

## Available Scripts

- `npm run dev` - Runs both applications in development mode
- `npm run install-all` - Installs dependencies for all applications

## Individual Applications

### Client Portal
- Directory: `/client`
- Port: 3000
- Purpose: Client-facing application

### Warehouse Portal
- Directory: `/warehouse`
- Port: 3001
- Purpose: Warehouse management system

## Contributing

[Add your contribution guidelines here]

## License

[Add your license information here] 