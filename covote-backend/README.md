# Co-Vote Standalone Backend

This is a standalone Node.js backend for the Co-Vote application. It allows you to host the SQLite database remotely and sync it with the frontend across different devices or networks.

## Prerequisites
- [Node.js](https://nodejs.org/) installed on your machine or server.

## Installation

1. Open your terminal and navigate to this folder (`covote-backend`).
2. Install the dependencies:
   ```bash
   npm install
   ```

## Running the Server

Start the server in development mode (auto-restarts on changes):
```bash
npm run dev
```

Or start it normally:
```bash
npm start
```

The server will start on `http://localhost:3001` by default (or the port specified by your environment's `PORT` variable).

## Connecting the Frontend

Once the standalone backend is running, you can connect the Co-Vote frontend to it:

1. Open the Co-Vote application in your browser.
2. On the initial connection screen, locate the **"Mode Serveur Web (Cloud)"** section.
3. Enter the full URL to the `/api/db` endpoint of this backend.
   - If running locally on the same machine: `http://localhost:3001/api/db`
   - If deployed remotely (e.g., Render, Heroku, VPS): `https://your-deployed-url.com/api/db`
4. Click **Connecter**.

The frontend will automatically create the database on this server (if it doesn't exist) and sync all future votes and changes to it!

## Security Note for Production
In `server.ts`, CORS is currently configured to allow all origins (`origin: '*'*`). If you deploy this to production, you should update the CORS configuration to only allow your specific frontend domain for better security:

```typescript
app.use(cors({
  origin: 'https://your-frontend-domain.com',
  methods: ['GET', 'POST']
}));
```
