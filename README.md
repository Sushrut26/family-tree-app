# Family Tree Application

A full-stack personal family tree application with role-based permissions, family password protection, and a beautiful nature-inspired UI.

## Features

### Backend
- **Authentication**: JWT-based email/password authentication
- **Family Password**: Secondary authentication layer for family access control
- **Person Management**: CRUD operations with branch ownership permissions
- **Relationship Management**: Support for PARENT, SPOUSE, and SIBLING relationships
- **Audit Logging**: Track all data changes with user attribution
- **Export**: JSON export functionality
- **Admin Panel**: User management and audit log viewing

### Frontend
- **Nature-Inspired Design**: Emerald green (growth), Amber (heritage), Violet (creativity) palette
- **Protected Routes**: Authentication and family password guards
- **State Management**: Zustand for efficient state handling
- **Type Safety**: Full TypeScript coverage
- **Responsive**: Mobile-friendly design (upcoming)
- **Toast Notifications**: User-friendly feedback system

## Tech Stack

### Backend
- **Runtime**: Node.js with TypeScript
- **Framework**: Express.js v5
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: JWT (jsonwebtoken) + bcrypt
- **Validation**: Zod schemas

### Frontend
- **Framework**: React 19
- **Build Tool**: Vite 7
- **Language**: TypeScript
- **Styling**: Tailwind CSS v4
- **State**: Zustand
- **Routing**: React Router v6
- **HTTP Client**: Axios
- **Tree Visualization**: React Flow (upcoming)

## Project Structure

```
family-tree-app/
├── backend/
│   ├── prisma/
│   │   ├── migrations/
│   │   ├── schema.prisma
│   │   └── seed.ts
│   └── src/
│       ├── config/
│       ├── controllers/
│       ├── middleware/
│       ├── routes/
│       ├── services/
│       ├── utils/
│       └── app.ts
└── frontend/
    └── src/
        ├── components/
        ├── lib/
        ├── pages/
        ├── stores/
        ├── types/
        └── App.tsx
```

## Getting Started

### Prerequisites
- Node.js 20.19+ or 22.12+
- PostgreSQL database
- npm or yarn

### Backend Setup

1. Navigate to backend directory:
```bash
cd backend
```

2. Install dependencies:
```bash
npm install
```

3. Create `.env` file (copy from `.env.example`):
```bash
cp .env.example .env
```

4. Update `.env` with your database URL and secrets:
```env
DATABASE_URL="postgresql://user:password@localhost:5432/family_tree"
JWT_SECRET="your-secret-key"
JWT_EXPIRY="7d"
FRONTEND_URL="http://localhost:5173"
PORT=3000
NODE_ENV="development"
```

5. Run database migrations:
```bash
npx prisma migrate dev
```

6. Seed the database (creates admin user and family password):
```bash
npm run seed
```

Default credentials:
- **Admin**: admin@family.com / admin123
- **Family Password**: family2024

7. Start the development server:
```bash
npm run dev
```

Backend will run on `http://localhost:3000`

### Frontend Setup

1. Navigate to frontend directory:
```bash
cd frontend
```

2. Install dependencies:
```bash
npm install
```

3. Create `.env.local` file (copy from `.env.example`):
```bash
cp .env.example .env.local
```

4. Start the development server:
```bash
npm run dev
```

Frontend will run on `http://localhost:5173`

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `GET /api/auth/me` - Get current user

### Family Password
- `POST /api/family-config/verify` - Verify family password
- `PUT /api/family-config/update` - Update family password (admin only)

### Persons
- `GET /api/persons` - Get all persons
- `GET /api/persons/:id` - Get person by ID
- `POST /api/persons` - Create person
- `PUT /api/persons/:id` - Update person
- `DELETE /api/persons/:id` - Delete person
- `GET /api/persons/:id/can-edit` - Check edit permission

### Relationships
- `GET /api/relationships` - Get all relationships
- `GET /api/relationships/:id` - Get relationship by ID
- `POST /api/relationships` - Create relationship
- `DELETE /api/relationships/:id` - Delete relationship

### Export
- `GET /api/export?format=json` - Export tree as JSON

### Admin
- `GET /api/audit` - Get all audit logs (admin only)
- `GET /api/audit/entity/:entityType/:entityId` - Get entity logs
- `GET /api/audit/user/:userId` - Get user logs

## Development Status

✅ **Completed**
- Backend infrastructure
- Authentication system
- Family password layer
- Person and relationship CRUD
- Branch ownership permissions
- Audit logging
- JSON export
- Frontend foundation
- State management
- Routing infrastructure
- Design system

🚧 **In Progress**
- Authentication UI pages
- Family password modal
- React Flow tree visualization
- Person management UI
- Admin panel UI

## License

Private project - All rights reserved

## Authors

- Sushrut Khirwadkar
- Co-authored with Claude Sonnet 4.5
