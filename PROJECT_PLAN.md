# Employee Management System (EMS) — Master Project Plan (v2)

## 1. Project Overview & Multi-Platform Vision

The Employee Management System (EMS) is an enterprise solution with two distinct user-facing interfaces sharing a unified backend engine:

1. **Employee Android Mobile App (Native)**:
   - For on-the-go and on-site staff.
   - Daily attendance: Punch In and Punch Out with front-facing camera selfie and high-accuracy GPS.
   - Work From Office (WFO) geofence verification.
   - Work From Home (WFH) active work session tracking with an Android Foreground Service and persistent status bar indicator.
   - Daily task checklist and End-of-Day (EOD) work report submission.

2. **Founder & Team Leader Web Dashboard**:
   - Optimized for desktop and tablet screens.
   - **Founder/Admin**: Organization settings, geofence setup, staff provisioning, company-wide attendance monitoring, live map oversight, audit reports, and payroll/attendance exports.
   - **Team Leader (TL)**: Role-gated dashboard view to assign tasks, inspect team attendance/photos, review EOD reports, and submit performance ratings. *(Can be ported to mobile later if needed).*

3. **Central Backend & Database**:
   - Single source of truth.
   - Enforces all business rules, authentication, geofence calculations, and secure photo access across both mobile and web clients.

---

## 2. Recommended Production Architecture

```
   ┌───────────────────────────────┐       ┌───────────────────────────────┐
   │    Employee Mobile App        │       │  Founder & TL Web Dashboard   │
   │  (React Native + Expo Android)│       │         (React + Vite)        │
   └───────────────┬───────────────┘       └───────────────┬───────────────┘
                   │                                       │
                   │ HTTPS / JSON REST API                 │ HTTPS / JSON REST API
                   │ + Bearer JWT Token                    │ + Bearer JWT Token
                   │                                       │
                   ▼                                       ▼
   ┌───────────────────────────────────────────────────────────────────────┐
   │                       Central Backend API                             │
   │                       (Node.js + Express)                             │
   │   - Shared JWT Authentication & Role Authorization                    │
   │   - Server-Side Haversine Geofence Verification                       │
   │   - Photo Upload & Signed URL Security                                │
   │   - Business Rules (Shift rules, double-punch prevention)             │
   └───────────────────┬───────────────────────────────┬───────────────────┘
                       │                               │
                       ▼                               ▼
       ┌───────────────────────────────┐   ┌───────────────────────────────┐
       │     PostgreSQL Database       │   │    Private Cloud Storage      │
       │    (Hosted via Supabase)      │   │    (Supabase Storage Bucket)  │
       │   - Users, Roles, Geofences   │   │   - Encrypted/Private Selfies │
       │   - Attendance & WFH Pings    │   │   - Restricted Signed URLs    │
       │   - Tasks, Reports, Audits    │   │     (Admin / TL / Owner only) │
       └───────────────────────────────┘   └───────────────────────────────┘
```

---

## 3. Technology Stack Evaluation

| Component | Selected Technology | Why This Choice & Evaluation |
| :--- | :--- | :--- |
| **Employee Mobile App** | **React Native with Expo** | Build a real, installable native Android app (`.apk`) using JavaScript/React. Provides direct access to native Android camera, native GPS, and background task manager without learning Java/Kotlin. |
| **Founder Web Dashboard** | **React (built with Vite)** | High-performance, rich desktop dashboard with charts, data grids, maps, and CSV exports. Fast to build and maintain. |
| **Backend API** | **Node.js + Express** | Single REST API serving both Android and Web. Same language (JavaScript) across the entire stack. Simple, transparent, and battle-tested. |
| **Database** | **Supabase (Managed PostgreSQL)** | Production-grade relational database from Day 1. Accessible over the internet by both your local computer and real Android phones anywhere. Free tier requires zero local database installation on Windows. Includes an online visual dashboard to view tables. |
| **Photo Storage** | **Supabase Private Storage** | S3-compatible private cloud storage. Attendance selfies are kept strictly private and accessed only through short-lived secure signed URLs. |

---

## 4. In-Depth Technical Evaluations

### A. React Native with Expo for the Android App
* **Is Expo suitable for a real Android app?**
  Yes. Expo is currently the industry standard for React Native. It compiles down to real native Android code and can generate standalone `.apk` files for direct installation on employee phones.
* **How background GPS tracking works on Android (and its realistic limits)**:
  1. **Foreground Service Requirement**: Android operating systems (Android 10+) will kill any background app that tries to track location silently. To keep tracking alive when the app is minimized or the screen is turned off, the app must run an **Android Foreground Service** using `expo-location` and `expo-task-manager`.
  2. **Visible Notification**: Android mandates a persistent status bar notification (e.g., *"EMS Active Session — Tracking active work hours"*). This provides transparency to the employee and prevents Android from killing the process.
  3. **Battery Optimization Exemptions (OEM Killers)**: Manufacturers like Xiaomi, Samsung, and OnePlus aggressively terminate background services to save battery ("Doze Mode"). Our app must include a prompt guiding the employee to disable battery optimization for the EMS app.
  4. **Testing Environment**: While basic UI can be previewed in the Expo Go app, full background foreground services require an **Expo Development Build** or standalone APK. We will plan for this transition smoothly.
  5. **Pragmatic Interval**: Continuous 1-second GPS drains a phone's battery in 3–4 hours. We will implement periodic pings (e.g., every 10–15 minutes during an active WFH shift) to balance accuracy with battery health.

### B. Shared Backend, Authentication, and Database
* **Single API**: The Node.js Express server does not care whether a request originates from an Android phone or a Chrome browser on Windows.
* **Authentication Flow**:
  1. User enters Email and Password on either the Mobile App or Web Dashboard.
  2. Server verifies the password hash (using `bcrypt`) in PostgreSQL.
  3. Server signs a JSON Web Token (JWT) containing `{ userId, role, name, department }` and returns it.
  4. **On Android**: The token is stored securely in encrypted storage (`expo-secure-store`).
  5. **On Web**: The token is stored in `localStorage` or secure session storage.
  6. **On Every Request**: Both clients send the HTTP header: `Authorization: Bearer <token>`.
  7. Express middleware inspects the token, confirms the user is active, checks their role, and allows or denies access.

### C. Database Comparison: SQLite vs. Supabase PostgreSQL
* **Why not SQLite for this project?**
  - **Network Isolation**: SQLite is a file on your local Windows hard drive. A physical Android mobile phone testing on 4G or Wi-Fi cannot directly access a local Windows file.
  - **Syntax & Migration Friction**: SQLite lacks native date/timestamp types, native boolean types, and has different locking behavior during concurrent writes. Moving from SQLite to PostgreSQL later is **not** automatic; it often breaks SQL queries, schema definitions, and migration scripts.
* **Why Supabase (PostgreSQL)?**
  - **Cloud-Accessible from Day 1**: Accessible securely over HTTPS by your local development machine, an Android emulator, or a physical phone on your desk.
  - **Built-in Private File Storage**: Solves the attendance photo upload and viewing problem immediately with private cloud buckets.
  - **Zero Local Server Setup**: No need to install and configure PostgreSQL services, users, or Windows background daemons.
  - **Visual Dashboard**: Supabase provides an intuitive web browser UI where you can view, edit, and inspect table rows live without typing SQL queries.

---

## 5. Security & Privacy Blueprint

1. **Server-Side Geofencing**:
   - Geofence verification calculations (Haversine formula) are executed strictly on the Express backend.
   - The mobile app sends raw GPS coordinates (`lat`, `lng`, `accuracy`). The server calculates the exact distance to the office and flags whether the punch is inside or outside the authorized perimeter.
2. **Photo Access Control**:
   - Attendance photos are uploaded directly to a private bucket.
   - The bucket is not publicly accessible via static URLs.
   - When an Admin or Team Leader views an employee's punch card, the server issues a time-limited signed URL (e.g., valid for 15 minutes).
3. **Role-Based Guards**:
   - Route-level middleware on the backend blocks employees from querying company-wide reports, editing geofences, or viewing colleagues' attendance records.

---

## 6. Project Structure (Clean Monorepo)

```
EmployeeApp/
├── PROJECT_PLAN.md
├── README.md
├── server/                 # Node.js + Express REST API
│   ├── src/
│   │   ├── config/         # Supabase & environment configuration
│   │   ├── controllers/    # Request handlers (auth, attendance, tasks)
│   │   ├── middleware/     # Auth & Role verification guards
│   │   ├── routes/         # Express API routes
│   │   ├── services/       # Geofence math, storage services
│   │   └── index.js        # Server entry point
│   └── package.json
│
├── web/                    # Founder & Team Leader Web Dashboard
│   ├── src/
│   │   ├── components/     # Cards, Modals, Tables, Maps
│   │   ├── pages/          # Admin Dashboard, TL Audit, Staff Directory
│   │   ├── services/       # API client (Axios/Fetch)
│   │   └── App.jsx
│   ├── index.html
│   └── package.json
│
└── mobile/                 # Employee Native Android Mobile App
    ├── app/ or src/
    │   ├── screens/        # Punch Screen, Active Session, Tasks, Profile
    │   ├── components/     # Camera selfie preview, status badges
    │   ├── services/       # Location background task, API client
    │   └── App.js
    ├── app.json            # Expo config (permissions, Android package name)
    └── package.json
```

---

## 7. Phased Implementation Roadmap

Every stage is self-contained, easily testable, and must pass verification before moving to the next.

```
Stage 1: Central Backend Foundation & Supabase Setup
   ↓
Stage 2: Shared Authentication & Role Authorization (API)
   ↓
Stage 3: Founder / Admin Web Dashboard (Staff & Geofence Setup)
   ↓
Stage 4: Employee Android App Skeleton & Mobile Login (Expo)
   ↓
Stage 5: Mobile Attendance Core (Punch In/Out with Camera & GPS)
   ↓
Stage 6: Android Background Location & WFH Active Session
   ↓
Stage 7: Task Management & Daily EOD Reports (Mobile + Web)
   ↓
Stage 8: Team Leader Audits & Performance Ratings (Web)
   ↓
Stage 9: Founder Analytics, Live Map Oversight & Data Exports
   ↓
Stage 10: Production Hardening, Standalone APK Build & Deployment
```

---

### Detailed Stage Breakdown

#### Stage 1: Central Backend Foundation & Supabase Setup
- **What will be built**:
  - `server/` directory with Express API structure.
  - Supabase project connection (free cloud PostgreSQL).
  - Database schema tables created: `users`, `geofences`, `attendance`, `session_pings`, `tasks`, `reports`, `audits`.
  - Health check endpoint (`/api/health`) verifying live database connectivity.
- **Affected Areas**: `server/`, Supabase Console.
- **How to test**:
  - Run backend server.
  - Visit `http://localhost:5000/api/health` in browser -> returns `{ status: "ok", db: "connected" }`.
- **Completion Criteria**: Express server runs and connects to the cloud database successfully.

---

#### Stage 2: Shared Authentication & Role-Based Access Control (RBAC)
- **What will be built**:
  - Password hashing with `bcrypt`.
  - JWT token generation and verification middleware (`requireAuth`, `requireRole`).
  - Seed initial Founder/Admin account.
  - Auth endpoints: `/api/auth/login`, `/api/auth/me`.
- **Affected Areas**: `server/src/routes/auth.js`, `server/src/middleware/auth.js`.
- **How to test**:
  - Test login with valid Admin credentials -> receives JWT token and user profile.
  - Test login with invalid password -> receives clear 401 error.
  - Test accessing protected route without token -> rejected with 401.
- **Completion Criteria**: Complete authentication lifecycle working and verified via API calls.

---

#### Stage 3: Founder / Admin Web Dashboard (Staff & Geofence Setup)
- **What will be built**:
  - `web/` directory with React + Vite.
  - Modern web login interface for Founder and Team Leader.
  - Employee Management module: Add new employees, assign roles (`employee`, `team_leader`), set departments.
  - Office Geofence configuration: Set office coordinates (Latitude, Longitude) and allowed radius (meters).
- **Affected Areas**: `web/`, `server/src/routes/employees.js`, `server/src/routes/geofences.js`.
- **How to test**:
  - Founder logs into Web Dashboard in browser.
  - Creates a new test Employee account.
  - Configures an office geofence.
  - Verifies new employee appears in the Supabase database.
- **Completion Criteria**: Founder can manage employees and geofences from a working web dashboard.

---

#### Stage 4: Employee Android Mobile App Skeleton & Mobile Login (Expo)
- **What will be built**:
  - `mobile/` directory initialized with React Native (Expo).
  - Mobile splash screen, branding, and modern Mobile Login screen.
  - Secure token storage integration (`expo-secure-store`).
  - Auto-login check (persisting login session across app restarts).
  - Role check: prevents Admin/TL from mistakenly using the employee punch app if they should be on the web dashboard.
- **Affected Areas**: `mobile/src/screens/LoginScreen.jsx`, `mobile/src/services/api.js`.
- **How to test**:
  - Run Expo development server.
  - Open the app on an Android phone (via Expo Go or Android Emulator).
  - Log in using the Employee credentials created in Stage 3.
  - Close and reopen app -> verify session remains logged in.
- **Completion Criteria**: Employee can log into the real Android app on an actual device or emulator.

---

#### Stage 5: Mobile Attendance Core (Punch In/Out with Camera & GPS)
- **What will be built**:
  - Native front-facing camera selfie capture (`expo-camera`).
  - Native GPS coordinate capture (`expo-location`).
  - Selection between **Work From Office (WFO)** and **Work From Home (WFH)**.
  - Secure photo upload to Supabase Private Storage.
  - Server-side Haversine geofence verification:
    - If WFO: Must be within office radius. If outside, flags punch as "Outside Geofence".
    - If WFH: Records coordinates and marks as remote session.
  - State enforcement: Prevents duplicate punches.
- **Affected Areas**: `mobile/src/screens/PunchScreen.jsx`, `server/src/routes/attendance.js`, `server/src/services/geofence.js`.
- **How to test**:
  - Employee opens Android app, taps "Punch In (WFO)".
  - Camera opens, snaps selfie, acquires GPS, and submits.
  - Verify attendance record, coordinates, and photo appear in database and Admin web view.
- **Completion Criteria**: Real native camera capture and GPS geofence punch recorded accurately.

---

#### Stage 6: Android Background Location & WFH Active Session
- **What will be built**:
  - Android Foreground Service configured with persistent status bar notification ("EMS Active Session").
  - Background task manager (`expo-task-manager`) executing periodic location updates during active WFH shift.
  - In-app visible tracking status indicator (Green = Active, Yellow = Paused, Gray = Off).
  - Battery optimization check dialog.
  - Server endpoint `/api/attendance/session-ping` storing periodic audit breadcrumbs.
- **Affected Areas**: `mobile/src/services/backgroundLocation.js`, `mobile/app.json`, `server/src/routes/session.js`.
- **How to test**:
  - Employee punches in under WFH mode.
  - Minimize app and lock screen -> verify foreground notification remains visible in Android status bar.
  - Wait 15 minutes -> verify periodic location pings appear in backend audit logs.
  - Punch Out -> verify foreground service and notification terminate cleanly.
- **Completion Criteria**: Android app maintains tracking during active shift with clear notification and stops on punch out.

---

#### Stage 7: Task Management & Daily EOD Reports (Mobile + Web)
- **What will be built**:
  - Web: Team Leader and Founder can create and assign tasks to employees with priorities and due dates.
  - Mobile: Employee sees assigned tasks, marks them "In Progress" or "Completed".
  - Mobile EOD Report screen: Employee submits daily work summary and challenges faced before punching out.
  - Web: Team Leader and Founder view submitted EOD reports.
- **Affected Areas**: `server/src/routes/tasks.js`, `server/src/routes/reports.js`, `mobile/src/screens/TasksScreen.jsx`, `web/src/pages/TasksPage.jsx`.
- **How to test**:
  - TL assigns task from web dashboard -> Employee receives task on phone.
  - Employee marks task complete and submits EOD report.
  - TL refreshes web dashboard and reviews report.
- **Completion Criteria**: Full task lifecycle and daily reporting operational across mobile and web.

---

#### Stage 8: Team Leader Audits & Performance Ratings (Web)
- **What will be built**:
  - Team Leader Audit page on Web Dashboard.
  - Filter by team members and dates.
  - Review punch times, selfie photos (via private signed URLs), geofence status, and completed tasks.
  - Performance scoring module (1–5 stars for punctuality, quality, consistency + manager remarks).
- **Affected Areas**: `web/src/pages/LeaderAuditPage.jsx`, `server/src/routes/audits.js`.
- **How to test**:
  - TL logs in on web, selects an employee's day record.
  - Reviews punch photo and tasks, submits a 4-star rating with remarks.
  - Verify audit log is permanently attached to that employee's date record.
- **Completion Criteria**: Structured performance review trail accessible to Founder and Team Leader.

---

#### Stage 9: Founder Analytics, Live Map Oversight & Data Exports
- **What will be built**:
  - Executive Founder Dashboard metrics: Total staff, present today, WFO count, WFH count, late arrivals, missing reports.
  - Interactive map view: Office geofence circle + pins for employee punches and active WFH sessions.
  - Comprehensive attendance data table with date/department filters.
  - One-click CSV and Excel export generator for company payroll records.
- **Affected Areas**: `web/src/pages/FounderDashboard.jsx`, `server/src/services/export.js`.
- **How to test**:
  - Founder opens dashboard -> high-level metrics reflect live system state.
  - Filter attendance by last 30 days and export CSV -> download opens cleanly in Excel.
- **Completion Criteria**: Complete organizational visibility and payroll export readiness.

---

#### Stage 10: Production Hardening, Standalone APK Build & Deployment
- **What will be built**:
  - Standalone Android APK build generation using Expo EAS Build (installable on any Android phone without Expo Go).
  - Security hardening: rate limiting, request validation, CORS lock down, production error handlers.
  - Deployment configuration: Backend API deployment (e.g., Render, Railway, or VPS) and Web Dashboard deployment (e.g., Vercel or Netlify).
  - Final end-to-end user testing guide.
- **Affected Areas**: `mobile/eas.json`, `server/src/index.js`, production deployment configs.
- **How to test**:
  - Download generated `.apk` to a real Android phone, install, and run full test (login, selfie punch, WFH tracking, punch out).
  - Access web dashboard from an external computer.
- **Completion Criteria**: Real Android APK runs standalone on employee devices, and web dashboard is live.

---

## 8. Development Protocol & Next Steps

1. **One Stage at a Time**: We will never skip ahead or create incomplete fragments.
2. **Plain English Walkthroughs**: Every step will have clear, simple testing instructions.
3. **Approval Gate**: We only proceed to the next stage when you have tested and approved the previous one.
