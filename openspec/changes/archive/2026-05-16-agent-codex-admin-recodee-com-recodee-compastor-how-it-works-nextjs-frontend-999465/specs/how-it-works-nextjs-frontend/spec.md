## ADDED Requirements

### Requirement: how-it-works-nextjs-frontend behavior
The system SHALL provide a standalone Next.js frontend under `frontend/` that renders a "How it works" demo layout for GuardeX.

#### Scenario: Desktop split layout
- **WHEN** a user opens the root page on a desktop viewport
- **THEN** the page displays a dark two-pane layout with a chat/task panel on the left and code/source-control panel on the right
- **AND** the page includes top mode pills and bottom step controls matching the workflow narrative.

#### Scenario: Mobile stacking
- **WHEN** a user opens the root page on a small viewport
- **THEN** the layout stacks vertically without horizontal overflow
- **AND** all key content remains readable and interactable.

### Requirement: Next.js app-router project shape
The demo frontend SHALL use Next.js App Router conventions.

#### Scenario: Standard route structure
- **WHEN** the frontend project is inspected
- **THEN** it includes `app/layout.tsx`, `app/page.tsx`, and `app/globals.css`
- **AND** package scripts support local development (`dev`, `build`, `start`, `lint`).
