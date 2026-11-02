# StudioSpace Server

The REST API behind StudioSpace, a peer-to-peer marketplace where hosts list creative spaces and creators book them by the hour. It stores studios and bookings in MongoDB and protects every change with a JWT.

**Live API:** https://studio-space-server-kappa.vercel.app
**Live site:** https://studio-space-client-delta.vercel.app

## Features

- **Studio CRUD.** List, filter by category, view, add, update and delete studios. Only the owner can update or delete a studio.
- **Featured studios.** The 6 top-rated studios for the home page.
- **Bookings.** Creators book a studio and get a Pending booking. Hosts confirm or cancel it, and the booking records who cancelled.
- **Double-booking prevention.** A booking that overlaps a Pending or Confirmed slot for the same studio and date is rejected with 409 and a clear message.
- **Wishlist.** Logged-in users save favourite studios and get them back as a list.
- **JWT protection.** Private routes verify a Better Auth JWT against the client's JWKS and return 401 if it's missing or invalid. Ownership checks use the email from the token, never one sent by the client.

## API routes

🔒 = requires `Authorization: Bearer <jwt>`

| Method | Path | Description |
|---|---|---|
| GET | `/studios` | All studios |
| GET | `/featured-studios` | 6 top-rated studios |
| GET | `/studios/category/:category` | Studios in a category |
| GET | `/studios/:id` | One studio |
| GET 🔒 | `/my-listings/:email` | Studios the user owns |
| POST 🔒 | `/add-studios` | Create a studio |
| PATCH 🔒 | `/studios/:id` | Update an owned studio |
| DELETE 🔒 | `/studios/:id` | Delete an owned studio |
| POST 🔒 | `/my-bookings` | Book a studio (Pending) |
| GET 🔒 | `/my-bookings/:email` | The user's bookings |
| PATCH 🔒 | `/my-bookings/:id/cancel` | Creator cancels a Pending booking |
| GET 🔒 | `/listing-bookings/:email` | Bookings on the user's studios |
| PATCH 🔒 | `/my-bookings/:id/confirm` | Host confirms a Pending booking |
| PATCH 🔒 | `/listing-bookings/:id/cancel` | Host cancels a Pending booking |
| GET 🔒 | `/wishlist/:email` | The user's saved studios |
| POST 🔒 | `/wishlist` | Save a studio |
| DELETE 🔒 | `/wishlist/:studioId` | Remove a saved studio |

## Tech stack

| Area | Tools |
|---|---|
| Runtime | Node.js, TypeScript, tsx |
| Framework | Express 5, cors |
| Database | MongoDB (official driver), MongoDB Atlas |
| Auth | jose (JWT verification against Better Auth JWKS) |
| Hosting | Vercel |
