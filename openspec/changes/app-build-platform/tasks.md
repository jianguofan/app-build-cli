# Tasks - App Build Platform

## Overview
This document outlines the implementation tasks for the App Build Platform, divided into two phases:
- **Phase 1**: Core build and publish workflow (no database, default credentials)
- **Phase 2**: Database integration and advanced features

## Phase 1: Core Build & Publish Workflow

**Goal**: Deliver a working build and publish system using default credentials (admin/snapmaker@2016) and in-memory storage.

### 1.1 Project Setup
**Priority**: P0  
**Estimated effort**: 4 hours

- [x] Create monorepo project structure (packages/backend, packages/frontend)
- [x] Configure Docker Compose for containerized services
- [x] Configure TypeScript, ESLint, and Prettier
- [x] Set up Git repository with .gitignore
- [x] Create basic README with setup instructions

**Acceptance criteria**:
- Project structure follows monorepo best practices
- Docker Compose successfully starts all services
- Linting and formatting work across all packages

---

### 1.2 Backend Foundation (No Database)
**Priority**: P0  
**Estimated effort**: 6 hours

- [x] Initialize NestJS project in packages/backend
- [x] Configure environment variable management (.env support)
- [x] Implement in-memory storage service for build tasks
- [x] Set up basic logging with Winston or Pino
- [x] Configure CORS for frontend communication
- [x] Create health check endpoint

**Acceptance criteria**:
- NestJS server starts successfully
- In-memory storage can persist data during runtime
- Health check endpoint returns 200 OK

**Technical notes**:
- Use Map or class-based in-memory store for build tasks
- No Prisma or database setup in Phase 1

---

### 1.3 Frontend Foundation
**Priority**: P0  
**Estimated effort**: 6 hours

- [x] Initialize React + Vite project in packages/frontend
- [x] Configure Ant Design component library
- [x] Set up React Router for navigation
- [x] Configure Zustand for state management
- [x] Set up Axios with base URL configuration
- [x] Create main layout component with header and sidebar

**Acceptance criteria**:
- Frontend dev server starts successfully
- Ant Design components render correctly
- Routing works between pages
- API client can communicate with backend

---

### 1.4 Simple Authentication
**Priority**: P0  
**Estimated effort**: 4 hours

- [x] Implement hardcoded authentication (admin/snapmaker@2016)
- [x] Create JWT token generation and validation
- [x] Implement login API endpoint
- [x] Create login page UI
- [x] Implement auth guard for protected routes
- [x] Store JWT token in localStorage

**Acceptance criteria**:
- User can log in with admin/snapmaker@2016
- JWT token is generated and validated correctly
- Protected routes redirect to login if not authenticated
- Token persists across page refreshes

**Technical notes**:
- No user registration or role management in Phase 1
- Single hardcoded admin user only

---

### 1.5 Build Task Management
**Priority**: P0  
**Estimated effort**: 8 hours

- [x] Design build task data model (in-memory)
- [x] Implement build task CRUD API endpoints
- [x] Configure Bull queue for task processing
- [x] Implement task queue processor
- [x] Create build task list page with table
- [x] Create build task creation form
- [x] Implement task status updates (pending, running, success, failed)

**Acceptance criteria**:
- Users can create new build tasks via UI
- Build tasks are queued and processed sequentially
- Task list shows real-time status updates
- Task details can be viewed

**Data model**:
```typescript
interface BuildTask {
  id: string;
  platform: 'ios' | 'android';
  branch: string;
  buildType: 'debug' | 'release';
  status: 'pending' | 'running' | 'success' | 'failed';
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  logs: string[];
}
```

---

### 1.6 Build Executor
**Priority**: P0  
**Estimated effort**: 10 hours

- [x] Configure SSH connection to host machine
- [x] Implement workspace preparation logic (clone repo, checkout branch)
- [x] Integrate existing build_app.sh script
- [x] Implement build log collection and streaming
- [x] Implement WebSocket for real-time log push
- [x] Create frontend log viewer component with auto-scroll
- [x] Handle build success/failure and update task status

**Acceptance criteria**:
- Build executor can SSH to host and run build script
- Build logs stream to frontend in real-time
- Build artifacts are generated successfully
- Task status updates correctly on completion

**Technical notes**:
- Reuse existing build_app.sh script without modifications
- Store build artifacts in configured output directory

---

### 1.7 iOS Publishing
**Priority**: P0  
**Estimated effort**: 12 hours

- [x] Research App Store Connect API authentication
- [x] Implement App Store Connect API client
- [x] Implement IPA upload to App Store Connect
- [x] Integrate existing Pgyer (蒲公英) upload code
- [x] Add iOS publish configuration form (API keys, bundle ID)
- [x] Implement publish status tracking
- [x] Create publish history view

**Acceptance criteria**:
- IPA files upload successfully to App Store Connect
- IPA files upload successfully to Pgyer
- Publish status is tracked and displayed
- Users can view publish history

**Configuration needed**:
- App Store Connect API key (issuer ID, key ID, private key)
- Pgyer API key
- Bundle identifier

---

### 1.8 Android Publishing - Major Stores
**Priority**: P0  
**Estimated effort**: 16 hours

- [x] Research Xiaomi Open Platform API
- [x] Implement Xiaomi store upload client
- [x] Research Huawei AppGallery Connect API
- [x] Implement Huawei store upload client
- [x] Research Tencent MyApp (应用宝) API
- [x] Implement Tencent MyApp upload client
- [x] Add Android publish configuration form
- [x] Implement publish status tracking for each store
- [x] Create unified publish status dashboard

**Acceptance criteria**:
- APK files upload successfully to Xiaomi, Huawei, and Tencent stores
- Publish status is tracked for each store
- Users can view publish progress in dashboard

**Configuration needed**:
- Xiaomi: App ID, App Key, App Secret
- Huawei: Client ID, Client Secret, App ID
- Tencent: Organization ID, App Key

---

### 1.9 Android Publishing - Additional Stores
**Priority**: P1  
**Estimated effort**: 12 hours

- [x] Research VIVO Open Platform API
- [x] Implement VIVO store upload client
- [x] Research OPPO Open Platform API
- [x] Implement OPPO store upload client
- [x] Research 360 Mobile Assistant API (optional)
- [x] Implement 360 store upload client (optional)
- [x] Update publish dashboard to include new stores

**Acceptance criteria**:
- APK files upload successfully to VIVO and OPPO stores
- Publish status tracked for all stores
- Dashboard shows unified view of all store statuses

---

### 1.10 End-to-End Testing
**Priority**: P0  
**Estimated effort**: 8 hours

- [x] Test complete iOS build and publish flow
- [x] Test complete Android build and publish flow
- [x] Test error handling (build failures, upload failures)
- [x] Test concurrent build tasks
- [x] Verify log streaming performance
- [x] Test authentication and session management
- [x] Document known issues and limitations

**Acceptance criteria**:
- iOS build → App Store + Pgyer flow works end-to-end
- Android build → all stores flow works end-to-end
- Error scenarios are handled gracefully
- System remains stable under load

---

### 1.11 Basic Documentation
**Priority**: P0  
**Estimated effort**: 4 hours

- [x] Write deployment guide (Docker Compose setup)
- [x] Document configuration requirements (API keys, SSH setup)
- [x] Create user guide for build and publish workflow
- [x] Document troubleshooting steps for common issues
- [x] Add architecture diagram

**Acceptance criteria**:
- New users can deploy the system following the guide
- All required configurations are documented
- Common issues have documented solutions

---

### 1.12 Build Integration Fixes
**Priority**: P0  
**Estimated effort**: 4 hours

- [x] Fix build_app.sh parameter passing (use named args: --platform=apk --build_mode=profile etc.)
- [x] Fix iOS artifact path (build/ios/ipa/Snapmaker.ipa instead of build/ios/Runner.ipa)
- [x] Fix Android artifact path (build/app/outputs/flutter-apk/app-{flavor}-{mode}.apk)
- [x] Add profile build mode support to DTO and frontend
- [x] Add pgyerAccountType parameter support (DTO, model, processor, frontend form)
- [x] Change to shared repo strategy (avoid full clone per build, use git fetch + checkout)
- [x] Auto-restore signing files (key.properties + signedkey.jks) from persistent storage
- [x] Add Keychain unlock for iOS codesign via KEYCHAIN_PASSWORD env var
- [x] Source user shell profile in SSH commands for pub.dev mirror support

**Acceptance criteria**:
- Android profile build succeeds end-to-end (tested: 131s, 135MB APK)
- iOS debug build succeeds end-to-end (tested: 147s, 65MB IPA)
- Second build reuses cloned repo (no full clone)
- Build parameters match actual build_app.sh interface

---

### 1.13 Frontend Enhancement & Download Support
**Priority**: P0  
**Estimated effort**: 6 hours

- [x] Add artifact download API endpoint (GET /api/builds/:id/download)
- [x] Support JWT auth via query param for browser downloads
- [x] Wire up download buttons in BuildDetail page
- [x] Create Publishes management page (/publishes) with table, filters, pagination
- [x] Create Settings page (/settings) with system config, publishing platform status, env vars
- [x] Add backend config API (GET /api/config, GET /api/config/env)
- [x] Build Dashboard page with stats cards (total builds, success rate, running, avg duration) and recent builds table
- [x] Add backend stats API (GET /api/builds/stats, GET /api/builds/recent)
- [x] Fix unused import in BuildTasks page

**Acceptance criteria**:
- All 4 sidebar pages render with real content (Dashboard, Builds, Publishes, Settings)
- APK/IPA files downloadable from browser
- Dashboard shows build statistics
- Settings shows configuration status with masked secrets

---

## Phase 2: Database Integration & Advanced Features

**Goal**: Replace in-memory storage with PostgreSQL, add user management, analytics, and advanced features.

### 2.1 Database Setup
**Priority**: P1  
**Estimated effort**: 8 hours

- [ ] Configure Prisma ORM
- [ ] Design database schema (users, builds, publishes, configs)
- [ ] Configure PostgreSQL connection
- [ ] Implement database migrations
- [ ] Migrate in-memory data structures to database models
- [ ] Update all CRUD operations to use database

**Acceptance criteria**:
- Database schema is properly designed and normalized
- All data persists across server restarts
- Migrations run successfully

---

### 2.2 User Management System
**Priority**: P1  
**Estimated effort**: 10 hours

- [ ] Implement user CRUD API
- [ ] Implement role-based access control (RBAC)
- [ ] Create user management UI
- [ ] Create role management UI
- [ ] Implement password hashing and validation
- [ ] Add user registration flow
- [ ] Implement audit logging for user actions

**Acceptance criteria**:
- Multiple users can be created and managed
- Role-based permissions work correctly
- Audit logs track all user actions

---

### 2.3 Configuration Management
**Priority**: P1  
**Estimated effort**: 8 hours

- [ ] Implement configuration CRUD API
- [ ] Implement credential encryption for API keys
- [ ] Create configuration management UI
- [ ] Create credential management UI
- [ ] Implement configuration versioning
- [ ] Add configuration import/export

**Acceptance criteria**:
- API keys and secrets are encrypted at rest
- Configuration changes are versioned
- Users can import/export configurations

---

### 2.4 Analytics Dashboard
**Priority**: P1  
**Estimated effort**: 10 hours

- [ ] Design dashboard layout
- [ ] Implement build statistics API
- [ ] Create build success rate chart
- [ ] Create build duration trend chart
- [ ] Create platform distribution chart
- [ ] Create recent builds list
- [ ] Add date range filtering

**Acceptance criteria**:
- Dashboard displays meaningful metrics
- Charts update based on selected date range
- Performance is acceptable with large datasets

---

### 2.5 Notification System
**Priority**: P2  
**Estimated effort**: 8 hours

- [ ] Implement DingTalk notification client
- [ ] Implement WeCom (企业微信) notification client
- [ ] Implement email notification
- [ ] Create notification configuration UI
- [ ] Implement notification templates
- [ ] Add notification preferences per user

**Acceptance criteria**:
- Notifications sent on build completion
- Notifications sent on publish status changes
- Users can configure notification preferences

---

### 2.6 Advanced Features
**Priority**: P2  
**Estimated effort**: 12 hours

- [ ] Implement scheduled builds (cron-based)
- [ ] Implement Git webhook triggers
- [ ] Implement build cancellation
- [ ] Implement build artifact cleanup policy
- [ ] Add build priority queue
- [ ] Implement build retry mechanism

**Acceptance criteria**:
- Scheduled builds run automatically
- Webhooks trigger builds on git push
- Users can cancel running builds
- Old artifacts are cleaned up automatically

---

### 2.7 Performance & Security
**Priority**: P1  
**Estimated effort**: 8 hours

- [ ] Implement API rate limiting
- [ ] Add database query optimization and indexing
- [ ] Implement API response caching
- [ ] Add CSRF protection
- [ ] Implement input validation and sanitization
- [ ] Add security headers
- [ ] Conduct security audit

**Acceptance criteria**:
- API rate limiting prevents abuse
- Database queries are optimized
- Common security vulnerabilities are addressed

---

### 2.8 Monitoring & Alerting
**Priority**: P2  
**Estimated effort**: 6 hours

- [ ] Integrate Sentry for error tracking
- [ ] Implement system health checks
- [ ] Add build failure alerts
- [ ] Add certificate expiration reminders
- [ ] Add disk space monitoring
- [ ] Create monitoring dashboard

**Acceptance criteria**:
- Errors are tracked in Sentry
- Alerts sent for critical issues
- System health is visible in dashboard

---

## Milestones

### Milestone 1: Phase 1 Complete (MVP)
**Target**: End of Week 2

**Deliverables**:
- Working build and publish system
- iOS publishing to App Store + Pgyer
- Android publishing to 5+ major stores
- Real-time build logs
- Basic authentication
- Deployment documentation

**Success criteria**:
- System can build and publish apps end-to-end
- No database required
- Ready for internal testing

---

### Milestone 2: Phase 2 Complete (Production Ready)
**Target**: End of Week 4

**Deliverables**:
- Database-backed persistence
- Multi-user support with RBAC
- Analytics dashboard
- Notification system
- Advanced features (scheduling, webhooks)
- Security hardening

**Success criteria**:
- System ready for production deployment
- All core features complete
- Documentation complete
- Team training completed

---

## Dependencies

### External Dependencies
- Docker and Docker Compose
- SSH access to build host machine
- API credentials for all app stores
- Git repository access

### Technical Dependencies
- Node.js 18+
- PostgreSQL 14+ (Phase 2)
- Redis 6+ (for Bull queue)

---

## Risk Assessment

### High Risk
- **App store API changes**: Store APIs may change without notice
  - Mitigation: Implement robust error handling and logging
  
- **Build script compatibility**: Existing build_app.sh may need modifications
  - Mitigation: Test thoroughly in Phase 1

### Medium Risk
- **SSH connection stability**: Network issues may interrupt builds
  - Mitigation: Implement retry logic and connection pooling

- **Concurrent build performance**: Multiple builds may strain resources
  - Mitigation: Implement queue limits and resource monitoring

### Low Risk
- **Frontend state management**: Complex state may be hard to manage
  - Mitigation: Use Zustand for predictable state updates
