# Project Subagents Guide

This project uses specialized subagents to handle different aspects of development. Each agent is optimized for specific tasks and has deep knowledge of relevant technologies.

## Available Agents

### 1. **Backend Specialist** (`backend-specialist`)
Focus: NestJS backend development, APIs, authentication, and database operations

**Use when:**
- Implementing or fixing API endpoints
- Working on authentication strategies (Google OAuth, JWT, Local)
- Developing user module features
- Writing backend validation and error handling
- Debugging backend issues
- Optimizing database operations

**Key areas:**
- `/src/modules/auth/` - Authentication logic
- `/src/modules/users/` - User management
- `/src/main.ts` - Server configuration
- Passport strategies and guards

---

### 2. **Frontend Specialist** (`frontend-specialist`)
Focus: Next.js frontend, React components, and client-side authentication

**Use when:**
- Creating or updating React components
- Implementing OAuth callback flows
- Managing authentication state on client
- Integrating with backend APIs
- Building UI and styling
- Debugging frontend issues
- Optimizing performance

**Key areas:**
- `/frontend/app/` - Next.js pages
- `/frontend/src/services/auth.service.ts` - Client auth logic
- Component development and styling
- API integration

---

### 3. **Full-Stack Coordinator** (`full-stack-coordinator`)
Focus: Features spanning both frontend and backend

**Use when:**
- Implementing new features end-to-end
- Coordinating API changes with frontend integration
- Debugging issues across services
- Refactoring authentication flows
- Managing API contracts and migrations
- Planning and executing large features

**Key areas:**
- Auth flows across services
- API design and frontend integration
- Feature implementation from design to deployment
- End-to-end testing

---

### 4. **Database Specialist** (`database-specialist`)
Focus: MongoDB schema, migrations, and data operations

**Use when:**
- Designing or modifying database schemas
- Planning data migrations
- Optimizing database queries
- Creating data validation rules
- Investigating data integrity issues
- Analyzing performance bottlenecks

**Key areas:**
- `/src/modules/users/schemas/` - MongoDB schemas
- Data model design
- Query optimization
- Migration planning

---

### 5. **QA Tester** (`qa-tester`)
Focus: Testing, quality assurance, and test coverage

**Use when:**
- Writing unit tests for services/controllers
- Creating E2E tests for user flows
- Debugging test failures
- Improving test coverage
- Testing authentication flows
- Identifying regressions

**Key areas:**
- `/backend/test/` - E2E tests
- Service/controller unit tests
- Test coverage improvement
- CI/CD test validation

---

## How to Request a Specific Agent

To spawn a specific agent, use the Agent tool with the agent's name:

```
Agent({
  subagent_type: "backend-specialist",
  description: "Fix the Google OAuth validation issue",
  prompt: "The Google OAuth callback is returning 401. Debug the google.strategy.ts file..."
})
```

## Project Architecture

```
Project Root/
├── backend/                 (NestJS + MongoDB)
│   └── src/modules/
│       ├── auth/           → Use: backend-specialist, full-stack-coordinator
│       └── users/          → Use: database-specialist, backend-specialist
├── frontend/               (Next.js + React)
│   ├── app/                → Use: frontend-specialist
│   └── src/services/       → Use: frontend-specialist, full-stack-coordinator
└── .claude/agents/         (This directory)
```

## Recommendations

- **New Feature**: Start with `full-stack-coordinator` to plan the feature end-to-end
- **API Bug**: Use `backend-specialist` to debug and fix
- **UI Issue**: Use `frontend-specialist` to investigate and resolve
- **Performance**: Use `database-specialist` for data issues, `backend-specialist` for API, `frontend-specialist` for client-side
- **Testing**: Use `qa-tester` to improve coverage and find regressions
- **Auth Flows**: Use `full-stack-coordinator` for end-to-end changes

## Model Configuration

All agents are configured to use:
- **Model**: `claude-sonnet-5` (for complex analysis and code generation)
- **Reasoning**: Extended (for thorough problem-solving)
- **Tools**: Full access to all development tools

This ensures high-quality code and thorough analysis across all specializations.
