# Lake Ride Pros Driver Portal

A Progressive Web App (PWA) for Lake Ride Pros drivers. The portal lets drivers claim rides, track time, access drop-off tips, manage tickets and more. It is built with **React**, **Vite** and **Material UI**, and includes Firebase authentication and offline support via `vite-plugin-pwa`.

## Features

- **Ride Claiming** – view unclaimed rides and claim them with filtering by vehicle or day.
- **Time Clock** – track start/end times for rides with a log of previous sessions.
- **Driver Tools** – directory of drivers, vehicle drop-off guides and escalation contacts.
- **Ticket Management** – generate, scan and view QR code tickets.
- **Admin Utilities** – view time logs and add rides (admin role only).
- **Offline Ready** – ships as a PWA and works offline once installed.

## Prerequisites

- **Node.js** `>=18`
- No additional environment variables are required.

Install dependencies once with:

```bash
npm install
```

## Development

Start the development server with hot reload:

```bash
npm run dev
```

The app will open in your browser on the Vite dev server.

## Building

Create a production build in the `dist` folder:

```bash
npm run build
```

You can locally preview the built output using:

```bash
npm run preview
```

## Deployment

Deploy the contents of the generated `dist` directory to any static hosting provider.

## Optional Scripts

At the moment the project does not define linting or testing scripts, but `eslint.config.js` is provided if you wish to run ESLint manually.
