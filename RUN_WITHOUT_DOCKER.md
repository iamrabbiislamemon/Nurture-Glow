# Running Nurture-Glow Without Docker

This guide will help you run the Nurture-Glow project locally without Docker.

## Prerequisites

Install these on your system:
- **Node.js** (v18 or higher) - [Download](https://nodejs.org/)
- **MySQL Server** (v8.0) - [Download](https://dev.mysql.com/downloads/mysql/)
- **npm** or **yarn** (comes with Node.js)

## Step 1: Install MySQL Server

### On Windows:
1. Download MySQL installer from [mysql.com](https://dev.mysql.com/downloads/mysql/)
2. Run the installer and complete the setup wizard
3. Choose "Development Default" configuration
4. Configure MySQL as a Windows Service
5. Set root password (remember this!)
6. Complete installation

### Verify MySQL Installation:
```powershell
mysql --version
```

## Step 2: Create Database

Open MySQL Command Line or MySQL Workbench and run:

```sql
CREATE DATABASE neonest;
```

You can verify it:
```sql
SHOW DATABASES;
```

## Step 3: Setup Environment Variables

### Backend (.env)

Create a `.env` file in `Nurture-Glow/backend/`:

```
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=root
DB_NAME=neonest
NODE_ENV=development
PORT=4000
JWT_SECRET=your-secret-key-min-32-characters-long
CORS_ORIGIN=http://localhost:5173
```

Replace:
- `DB_PASSWORD` with your MySQL root password
- `JWT_SECRET` with a secure random string (min 32 characters)

### Frontend (.env)

Create a `.env` file in `Nurture-Glow/Nurture-Glow/`:

```
VITE_API_URL=http://localhost:4000
```

## Step 4: Install Dependencies

Open two separate terminals:

### Terminal 1 - Backend Setup:
```powershell
cd "d:\Nurture-Glow\Nurture-Glow\backend"
npm install
```

### Terminal 2 - Frontend Setup:
```powershell
cd "d:\Nurture-Glow\Nurture-Glow\Nurture-Glow"
npm install
```

## Step 5: Initialize Database

Once backend dependencies are installed, seed the database:

```powershell
cd "d:\Nurture-Glow\Nurture-Glow\backend"
npm run seed
```

This will create all required tables and populate initial data.

## Step 6: Start the Project

Keep both terminals open and run commands simultaneously:

### Terminal 1 - Start Backend:
```powershell
cd "d:\Nurture-Glow\Nurture-Glow\backend"
npm run dev
```

Expected output:
```
Server running on http://localhost:4000
Database connected: neonest
```

### Terminal 2 - Start Frontend:
```powershell
cd "d:\Nurture-Glow\Nurture-Glow\Nurture-Glow"
npm run dev
```

Expected output:
```
VITE v6.0.11
➜ Local: http://localhost:5173/
```

## Step 7: Access the Application

Open your browser and navigate to:
```
http://localhost:5173
```

## Troubleshooting

### MySQL Connection Error
```
Error: connect ECONNREFUSED 127.0.0.1:3306
```
**Solution:**
- Ensure MySQL server is running
- Check credentials in `.env` file
- Verify MySQL is listening on port 3306

### Port Already in Use
```
Error: listen EADDRINUSE: address already in use :::4000
```
**Solution:**
- Change PORT in backend `.env` (e.g., PORT=4001)
- Or kill process using the port:
  ```powershell
  # Find process on port 4000
  netstat -ano | findstr :4000
  
  # Kill the process (replace PID)
  taskkill /PID <PID> /F
  ```

### Database Tables Not Created
**Solution:**
```powershell
cd "d:\Nurture-Glow\Nurture-Glow\backend"
npm run seed
```

### Module Not Found Errors
**Solution:**
```powershell
# Clear node_modules and reinstall
rm -r node_modules
rm package-lock.json
npm install
```

## Project Structure

```
Nurture-Glow/
├── backend/           # Express.js API server (Port 4000)
│   ├── src/
│   │   ├── index.js   # Main server file
│   │   ├── db.js      # Database connection
│   │   └── seed.js    # Database seeding
│   └── package.json
│
└── Nurture-Glow/      # React + Vite frontend (Port 5173)
    ├── src/
    ├── package.json
    └── vite.config.ts
```

## Development Commands

### Backend
- `npm run dev` - Start with hot reload (nodemon)
- `npm run start` - Start production server
- `npm run seed` - Initialize database

### Frontend
- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build

## Database Management

### Using MySQL Command Line:
```powershell
mysql -u root -p
# Then enter your password

# View all tables
USE neonest;
SHOW TABLES;

# View table structure
DESCRIBE users;
```

### Reset Database:
```powershell
# In MySQL
DROP DATABASE neonest;
CREATE DATABASE neonest;

# Then reseed
npm run seed
```

## Next Steps

Once running locally:
1. Create a user account on the login page
2. Explore the dashboard
3. Test different features
4. Check browser console for any errors
5. Check backend terminal for request logs

## Getting Help

If you encounter issues:
1. Check the error message carefully
2. Verify MySQL is running: `mysql --version`
3. Check `.env` file credentials
4. Review logs in both terminals
5. Ensure ports 4000 and 5173 are not in use

---

Happy development! 🚀
