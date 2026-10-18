# online-group-learning

Next.js + React 19 + TypeScript + Tailwind CSS v4 project.

## Development Server

- `npm run dev` to start the Next.js development server
- `npm run build` to build production bundle
- `npm run start` to start production server

## Project Structure

- `src/app/` - Next.js App Router (pages and layouts)
  - `src/app/layout.tsx` - Root layout with theme provider and globals.css
  - `src/app/page.tsx` - Landing page route (`/`)
  - `src/app/globals.css` - Global CSS entrypoint with Tailwind CSS v4 PostCSS
  - `src/app/login/page.tsx` - Authentication login route (`/login`)
  - `src/app/register/page.tsx` - Authentication register route (`/register`)
  - `src/app/forgot-password/page.tsx` - Password recovery route (`/forgot-password`)
  - `src/app/dashboard/page.tsx` - Student dashboard route (`/dashboard`)
  - `src/app/rooms/[roomId]/page.tsx` - Dynamic room route (`/rooms/:roomId`)
  - `src/app/room/page.tsx` - Fallback room route (`/room`)
  - `src/app/meetings/[meetingId]/page.tsx` - WebRTC meeting route (`/meetings/:meetingId`)
  - `src/app/meeting/page.tsx` - Fallback meeting route (`/meeting`)
  - `src/app/profile/page.tsx` - User profile route (`/profile`)
  - `src/app/settings/page.tsx` - User settings route (`/settings`)
- `src/features/` - Domain-driven feature modules
  - `src/features/auth/` - Authentication components, types, services
  - `src/features/landing/` - Landing page components, hero, features, workflow
  - `src/features/dashboard/` - Dashboard view, statistics, room grid, meetings
  - `src/features/room/` - Room hero, overview, meetings tab, members tab, modals
  - `src/features/meeting/` - Meeting workspace, header, video rail, controls
  - `src/features/whiteboard/` - Whiteboard canvas, toolbar, diagram nodes, AI assistant
  - `src/features/chat/` - RoomChat and MeetingChat components
  - `src/features/account/` - Profile and Settings views
- `src/components/common/` - Shared UI components (Modal)
- `src/components/layout/` - Layout components (AppShell)
- `src/context/` - Global ThemeContext
- `src/services/` - Base API client stub for NestJS integration
- `src/data/` - Mock data
- `src/types/` - Shared TypeScript interfaces

## Dependencies

- Runtime: React 19, React DOM 19, Next.js 15
- Styling: Tailwind CSS v4 with `@tailwindcss/postcss` and PostCSS
- Icons: lucide-react
