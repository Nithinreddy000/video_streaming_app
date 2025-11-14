# VideoSentinel - Enterprise Video Management Platform

> AI-Powered Video Processing Platform with Multi-tenant Architecture, Real-time Updates, and Azure AI Content Safety Integration

---

## 📋 Table of Contents

- [Overview](#overview)
- [Key Features](#key-features)
- [System Architecture](#system-architecture)
- [Technology Stack](#technology-stack)
- [Azure Services Integration](#azure-services-integration)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Configuration](#configuration)
- [Core Features Documentation](#core-features-documentation)
- [API Documentation](#api-documentation)
- [Database Schema](#database-schema)
- [Security](#security)
- [Video Processing Pipeline](#video-processing-pipeline)
- [Deployment](#deployment)
- [Troubleshooting](#troubleshooting)
- [License](#license)

---

## 🎯 Overview

**VideoSentinel** is a comprehensive, enterprise-grade video management platform designed for organizations that need automated content moderation, secure multi-tenant architecture, and scalable video processing capabilities. The platform combines powerful video processing with Azure AI Content Safety to provide automated content analysis and moderation workflows.

### What Problems Does It Solve?

- **Content Moderation at Scale**: Automatically analyze videos for inappropriate content using Azure AI
- **Multi-tenant Isolation**: Complete data separation between organizations
- **Real-time Processing Updates**: Live progress tracking for video uploads and processing
- **Role-Based Access Control**: Granular permissions for different user roles
- **Adaptive Video Streaming**: HLS/DASH support with multiple quality levels
- **Background Processing**: Scalable queue-based video transcoding and analysis

---

## ✨ Key Features

### 🔐 **Authentication & Authorization**
- JWT-based authentication with access and refresh tokens
- Role-based access control (Viewer, Editor, Admin)
- Multi-tenant architecture with complete data isolation
- Organization-level access control for videos
- Secure password hashing with bcrypt

### 🎬 **Video Management**
- Drag-and-drop video upload with progress tracking
- Support for multiple video formats (MP4, MOV, AVI, MKV, WebM, MPEG)
- Video metadata management (title, description, tags, category)
- Organization-based video access control
- Video search and filtering by status, category, and AI classification
- Pagination support for large video libraries

### 🤖 **AI Content Safety**
- Automated video content analysis using Azure AI Content Safety
- Frame extraction and batch analysis
- Content classification (Hate, Violence, Self-Harm, Sexual)
- Severity scoring (0-6 scale) per category
- Flagged content review workflow
- Admin moderation dashboard

### 📊 **Real-time Updates**
- Socket.IO integration for live updates
- Upload progress tracking
- Processing status updates
- AI analysis completion notifications
- Video ready notifications

### 🎥 **Video Processing**
- FFmpeg-based video transcoding
- Multiple resolution support (360p, 480p, 720p, 1080p)
- HLS adaptive bitrate streaming
- Automatic thumbnail generation
- Bull Queue for background processing
- Horizontal scaling support

### 👥 **Multi-tenant Features**
- Organization (Tenant) management
- User invitation system with email invitations
- Per-organization user management
- Tenant-level data isolation in MongoDB
- Role assignment per organization

### 📈 **Analytics & Monitoring**
- View count tracking
- Video analytics dashboard
- Processing statistics
- User activity monitoring
- System performance metrics

### 🎨 **Modern UI/UX**
- Responsive design with Tailwind CSS
- Dark/Light theme support
- Framer Motion animations
- Real-time dashboard updates
- Intuitive video player with HLS support
- Professional admin panel

---

## 🏗️ System Architecture

### High-Level Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                       CLIENT LAYER (React + TypeScript)                 │
│  ┌─────────────────┐  ┌──────────────┐  ┌─────────────────┐            │
│  │  Upload Page    │  │  Dashboard   │  │  Video Player   │            │
│  │  (Drag & Drop)  │  │  (Analytics) │  │  (HLS/Video.js) │            │
│  └────────┬────────┘  └──────┬───────┘  └────────┬────────┘            │
│           │                  │                    │                     │
│           └──────────────────┴────────────────────┘                     │
│                              │                                          │
│                    REST API + Socket.IO Client                          │
└──────────────────────────────┼──────────────────────────────────────────┘
                               │
                               │ HTTPS
                               │
┌──────────────────────────────┼──────────────────────────────────────────┐
│                     APPLICATION LAYER (Node.js + Express)               │
│  ┌────────────────────────────────────────────────────────────────┐    │
│  │  Express Server (Port 5000)                                    │    │
│  │  • CORS Middleware        • Helmet Security Headers            │    │
│  │  • Rate Limiting          • Compression                        │    │
│  │  • JWT Authentication     • Multer File Upload                 │    │
│  └────────────────────────────────────────────────────────────────┘    │
│                               │                                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                 │
│  │ Auth Module  │  │ Video Module │  │  Streaming   │                 │
│  │ • Register   │  │ • Upload     │  │  Module      │                 │
│  │ • Login      │  │ • CRUD Ops   │  │ • HLS/DASH   │                 │
│  │ • JWT        │  │ • Access Ctrl│  │ • MP4        │                 │
│  └──────────────┘  └──────────────┘  └──────────────┘                 │
│                                                                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                 │
│  │ Tenant Mgmt  │  │  Socket.IO   │  │  Analytics   │                 │
│  │ • Org CRUD   │  │  Server      │  │  Module      │                 │
│  │ • Invitations│  │ • Room Mgmt  │  │ • Metrics    │                 │
│  └──────────────┘  └──────────────┘  └──────────────┘                 │
└──────────────────────────────┬──────────────────────────────────────────┘
                               │
        ┌──────────────────────┼───────────────────────┐
        │                      │                       │
┌───────▼──────────┐  ┌────────▼────────┐  ┌──────────▼─────────┐
│  MongoDB Atlas   │  │  Redis Cloud    │  │  Azure Blob        │
│                  │  │                 │  │  Storage           │
│ • Users          │  │ • Bull Queue    │  │                    │
│ • Tenants        │  │ • Session Store │  │ • Original Files   │
│ • Videos         │  │ • Socket Cache  │  │ • Processed Videos │
│ • Analytics      │  │ • Job Data      │  │ • HLS Segments     │
│ • Invitations    │  └─────────────────┘  │ • Thumbnails       │
└──────────────────┘                       └────────────────────┘
        │                      │
        │              ┌───────▼────────┐
        │              │  Bull Workers  │
        │              │                │
        │              │ Worker Process │
        │              └───────┬────────┘
        │                      │
┌───────▼──────────────────────▼───────────────────────────────────────┐
│                     PROCESSING LAYER (Worker Services)               │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │   Video Processing Pipeline (Bull Queue Workers)               │  │
│  │                                                                 │  │
│  │   ┌─────────────┐   ┌─────────────┐   ┌─────────────┐         │  │
│  │   │   FFmpeg    │   │  Thumbnail  │   │    Azure    │         │  │
│  │   │  Processor  │ → │  Generator  │ → │  AI Content │         │  │
│  │   │             │   │             │   │   Safety    │         │  │
│  │   └─────────────┘   └─────────────┘   └─────────────┘         │  │
│  │         │                   │                   │               │  │
│  │         └───────────────────┴───────────────────┘               │  │
│  │                             │                                   │  │
│  │                   Socket.IO Notifications                       │  │
│  └────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────┘
                               │
┌──────────────────────────────▼───────────────────────────────────────┐
│                        AZURE AI SERVICES                             │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │  Azure AI Content Safety                                       │  │
│  │  • Video Frame Analysis     • Content Classification           │  │
│  │  • Severity Detection       • Custom Category Support          │  │
│  │  • Batch Processing         • Real-time Analysis               │  │
│  └────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────┘
```

### Component Interaction Flow

```
┌──────────┐
│  Client  │
└────┬─────┘
     │
     │ 1. Upload Video
     ▼
┌────────────────┐
│  Express API   │ ──2. Store in Azure Blob──► ┌─────────────────┐
└────┬───────────┘                             │  Azure Blob     │
     │                                         │  Storage        │
     │ 3. Create Video Record                  └─────────────────┘
     ▼
┌────────────────┐
│    MongoDB     │
└────┬───────────┘
     │
     │ 4. Queue Processing Job
     ▼
┌────────────────┐
│  Bull Queue    │ ──5. Worker Picks Up Job──► ┌─────────────────┐
└────────────────┘                             │  Bull Worker    │
                                               └────┬────────────┘
                                                    │
                                                    │ 6. Transcode (FFmpeg)
                                                    ▼
                                               ┌─────────────────┐
                                               │  Process Video  │
                                               │  • 360p, 720p   │
                                               │  • HLS Segments │
                                               │  • Thumbnails   │
                                               └────┬────────────┘
                                                    │
                                                    │ 7. Extract Frames
                                                    ▼
                                               ┌─────────────────┐
                                               │   Azure AI      │
                                               │ Content Safety  │
                                               │  • Analyze      │
                                               │  • Classify     │
                                               └────┬────────────┘
                                                    │
                                                    │ 8. Update Video Status
                                                    ▼
                                               ┌─────────────────┐
                                               │    Socket.IO    │
                                               │   Notification  │
                                               └────┬────────────┘
                                                    │
                                                    ▼
                                               ┌─────────────────┐
                                               │  Client Update  │
                                               │  (Ready/Failed) │
                                               └─────────────────┘
```

---

## 🛠️ Technology Stack

### **Backend**

| Technology | Version | Purpose |
|------------|---------|---------|
| **Node.js** | 18+ | Server runtime environment |
| **Express.js** | 4.x | Web application framework |
| **MongoDB** | 8.x (Mongoose) | NoSQL database for metadata |
| **Redis** | 4.x (IORedis) | Caching and message broker |
| **Bull** | 4.x | Job queue for background processing |
| **Socket.IO** | 4.x | Real-time bidirectional communication |
| **FFmpeg** | 4.x (fluent-ffmpeg) | Video transcoding |
| **JWT** | 9.x (jsonwebtoken) | Authentication tokens |
| **Bcrypt** | 2.x | Password hashing |
| **Multer** | 1.4.x | Multipart form data handling |
| **Joi** | 17.x | Input validation |
| **Winston** | 3.x | Logging framework |
| **Helmet** | 7.x | Security headers |
| **CORS** | 2.x | Cross-origin resource sharing |

### **Frontend**

| Technology | Version | Purpose |
|------------|---------|---------|
| **React** | 19.x | UI library |
| **TypeScript** | 5.x | Type safety |
| **Vite** | 5.x | Build tool and dev server |
| **Tailwind CSS** | 3.x | Utility-first CSS framework |
| **Zustand** | 5.x | State management |
| **React Router** | 7.x | Client-side routing |
| **Axios** | 1.x | HTTP client |
| **Socket.IO Client** | 4.x | Real-time updates |
| **Video.js** | 8.x | Video player (HLS support) |
| **Framer Motion** | 12.x | Animation library |
| **React Hook Form** | 7.x | Form handling |
| **Zod** | 4.x | Schema validation |
| **Lucide React** | 0.x | Icon library |
| **Radix UI** | Latest | Headless UI components |
| **React Dropzone** | 14.x | File upload |

### **Development Tools**

- **ESLint** - Code linting
- **Prettier** - Code formatting
- **Nodemon** - Auto-restart dev server
- **TypeScript** - Type checking
- **Git** - Version control

---

## ☁️ Azure Services Integration

### **1. Azure Blob Storage**

**Purpose**: Scalable object storage for video files and processed assets

**Features Used**:
- Container-based organization
- Block blob storage for large video files
- Public access levels for streaming content
- SAS tokens for secure access
- Blob metadata for file information

**Configuration**:
```javascript
const { BlobServiceClient } = require('@azure/storage-blob');

const blobServiceClient = BlobServiceClient.fromConnectionString(
  process.env.AZURE_STORAGE_CONNECTION_STRING
);
```

**Containers Structure**:
- `videos-original` - Original uploaded video files
- `videos-processed` - Transcoded video files
- `videos-hls` - HLS segments and playlists
- `thumbnails` - Video thumbnail images

**Storage Operations**:
- Upload original videos with progress tracking
- Store processed video files (multiple resolutions)
- Store HLS segments for adaptive streaming
- Store thumbnail images
- Generate secure streaming URLs

### **2. Azure AI Content Safety**

**Purpose**: Automated content moderation and safety analysis

**Features Used**:
- Video frame analysis
- Multi-category classification
- Severity scoring (0-6 scale)
- Batch processing support

**Content Categories Analyzed**:
1. **Hate Speech** - Discriminatory or offensive content
2. **Violence** - Violent or graphic content
3. **Self-Harm** - Content promoting self-injury
4. **Sexual Content** - Adult or inappropriate content

**Configuration**:
```javascript
const ContentSafetyClient = require('@azure-rest/ai-content-safety').default;
const { AzureKeyCredential } = require('@azure/core-auth');

const client = ContentSafetyClient(
  process.env.AZURE_CONTENT_SAFETY_ENDPOINT,
  new AzureKeyCredential(process.env.AZURE_CONTENT_SAFETY_KEY)
);
```

**Analysis Workflow**:
1. Extract frames from video (every 2 seconds)
2. Convert frames to base64
3. Batch analyze frames (up to 4 at a time)
4. Aggregate severity scores across frames
5. Calculate overall safety score (0-100)
6. Flag videos with high severity (≥4)
7. Mark for manual review if needed

**Severity Levels**:
- `0-1` - Safe
- `2-3` - Low risk (monitored)
- `4-5` - Medium risk (flagged for review)
- `6` - High risk (requires immediate review)

**API Endpoint**: `POST /contentsafety/image:analyze?api-version=2024-02-15-preview`

---

## 📁 Project Structure

```
pulse_assignment/
│
├── backend/                          # Node.js Backend
│   ├── src/
│   │   ├── config/                   # Configuration files
│   │   │   ├── database.js           # MongoDB connection setup
│   │   │   ├── redis.js              # Redis and Bull Queue config
│   │   │   ├── azure.js              # Azure SDK clients
│   │   │   └── socket.js             # Socket.IO server setup
│   │   │
│   │   ├── middlewares/              # Express middlewares
│   │   │   ├── auth.middleware.js    # JWT authentication
│   │   │   ├── rbac.middleware.js    # Role-based access control
│   │   │   ├── tenant.middleware.js  # Multi-tenant isolation
│   │   │   ├── upload.middleware.js  # Multer file upload
│   │   │   ├── error.middleware.js   # Global error handler
│   │   │   └── validator.middleware.js # Input validation
│   │   │
│   │   ├── models/                   # Mongoose models
│   │   │   ├── User.model.js         # User schema
│   │   │   ├── Tenant.model.js       # Organization/Tenant schema
│   │   │   ├── Video.model.js        # Video metadata schema
│   │   │   ├── Analytics.model.js    # Analytics data schema
│   │   │   └── Invitation.model.js   # User invitation schema
│   │   │
│   │   ├── modules/                  # Feature modules (Controllers + Routes)
│   │   │   ├── auth/                 # Authentication module
│   │   │   ├── videos/               # Video management module
│   │   │   ├── streaming/            # Video streaming module
│   │   │   ├── tenants/              # Tenant management module
│   │   │   ├── users/                # User management module
│   │   │   ├── analytics/            # Analytics module
│   │   │   └── invitations/          # Invitation module
│   │   │
│   │   ├── workers/                  # Bull Queue workers
│   │   │   ├── video.processor.js    # FFmpeg video processing
│   │   │   ├── ai.analyzer.js        # Azure AI content analysis
│   │   │   └── thumbnail.generator.js # Thumbnail extraction
│   │   │
│   │   ├── services/                 # Business logic services
│   │   │   ├── azure.blob.service.js # Azure Blob Storage operations
│   │   │   ├── azure.ai.service.js   # Azure AI Content Safety
│   │   │   ├── ffmpeg.service.js     # FFmpeg video processing
│   │   │   ├── email.service.js      # Email notifications
│   │   │   └── analytics.service.js  # Analytics calculations
│   │   │
│   │   ├── utils/                    # Utility functions
│   │   │   ├── logger.js             # Winston logger configuration
│   │   │   ├── helpers.js            # Helper functions
│   │   │   ├── constants.js          # Application constants
│   │   │   ├── validators.js         # Custom validators
│   │   │   └── errors.js             # Custom error classes
│   │   │
│   │   ├── socket/                   # Socket.IO handlers
│   │   │   └── socket.handler.js     # Real-time event handlers
│   │   │
│   │   ├── app.js                    # Express application setup
│   │   └── server.js                 # Server entry point
│   │
│   ├── .env.example                  # Environment variables template
│   ├── .gitignore
│   ├── package.json
│   └── package-lock.json
│
├── frontend/                         # React Frontend
│   ├── src/
│   │   ├── components/               # React components
│   │   │   ├── auth/                 # Authentication components
│   │   │   ├── video/                # Video-related components
│   │   │   ├── layout/               # Layout components
│   │   │   ├── ui/                   # Reusable UI components
│   │   │   └── routes/               # Route protection
│   │   │
│   │   ├── pages/                    # Page components
│   │   │   ├── DashboardPage.tsx     # Dashboard with stats
│   │   │   ├── LibraryPage.tsx       # Video library
│   │   │   ├── UploadPage.tsx        # Video upload
│   │   │   ├── VideoDetailPage.tsx   # Video player page
│   │   │   ├── LoginPage.tsx         # Login page
│   │   │   ├── RegisterPage.tsx      # Registration page
│   │   │   ├── OrganizationsPage.tsx # Organization management
│   │   │   ├── UsersPage.tsx         # User management
│   │   │   ├── InvitationsPage.tsx   # Invitation management
│   │   │   └── AdminModerationPage.tsx # Content moderation
│   │   │
│   │   ├── hooks/                    # Custom React hooks
│   │   ├── services/                 # API services
│   │   ├── store/                    # State management (Zustand)
│   │   ├── types/                    # TypeScript types
│   │   ├── utils/                    # Utility functions
│   │   ├── App.tsx                   # Main App component
│   │   └── main.tsx                  # Entry point
│   │
│   ├── public/                       # Static assets
│   ├── .env.example                  # Environment variables template
│   ├── .gitignore
│   ├── package.json
│   ├── tailwind.config.js            # Tailwind CSS configuration
│   ├── tsconfig.json                 # TypeScript configuration
│   └── vite.config.ts                # Vite configuration
│
├── .gitignore                        # Root .gitignore
└── README.md                         # This file
```

---

## 🚀 Getting Started

### Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** 18+ and npm
- **MongoDB** (local or MongoDB Atlas account)
- **Redis** (local or cloud instance)
- **FFmpeg** (for video processing)
- **Azure Account** with:
  - Azure Blob Storage resource
  - Azure AI Content Safety resource

### Installation Steps

#### 1. Clone the Repository

```bash
git clone <repository-url>
cd pulse_assignment
```

#### 2. Backend Setup

```bash
cd backend

# Install dependencies
npm install

# Create environment file
cp .env.example .env

# Edit .env with your configuration
# (See Configuration section below)

# Start development server
npm run dev
```

The backend will start on `http://localhost:5000`

#### 3. Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Create environment file
cp .env.example .env

# Edit .env with your configuration
VITE_API_BASE_URL=http://localhost:5000/api/v1
VITE_SOCKET_URL=http://localhost:5000

# Start development server
npm run dev
```

The frontend will start on `http://localhost:5173`

#### 4. Install FFmpeg (if not already installed)

**Windows:**
Download from [ffmpeg.org](https://ffmpeg.org/download.html) and add to PATH

**macOS:**
```bash
brew install ffmpeg
```

**Linux (Ubuntu/Debian):**
```bash
sudo apt update
sudo apt install ffmpeg
```

---

## ⚙️ Configuration

### Backend Environment Variables (.env)

```env
# Server Configuration
PORT=5000
NODE_ENV=development
FRONTEND_URL=http://localhost:5173

# Database
MONGODB_URI=mongodb://localhost:27017/videosentinel
# OR MongoDB Atlas:
# MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/videosentinel

# Redis
REDIS_URL=redis://localhost:6379
# OR Redis Cloud:
# REDIS_URL=redis://username:password@host:port

# JWT Secrets (Generate strong random strings)
JWT_ACCESS_SECRET=your_access_secret_min_32_characters
JWT_REFRESH_SECRET=your_refresh_secret_min_32_characters
JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_EXPIRY=7d

# Azure Blob Storage
AZURE_STORAGE_CONNECTION_STRING=DefaultEndpointsProtocol=https;AccountName=youraccountname;AccountKey=youraccountkey;EndpointSuffix=core.windows.net
AZURE_STORAGE_CONTAINER_ORIGINAL=videos-original
AZURE_STORAGE_CONTAINER_PROCESSED=videos-processed
AZURE_STORAGE_CONTAINER_HLS=videos-hls
AZURE_STORAGE_CONTAINER_THUMBNAILS=thumbnails

# Azure AI Content Safety
AZURE_CONTENT_SAFETY_ENDPOINT=https://your-resource.cognitiveservices.azure.com/
AZURE_CONTENT_SAFETY_KEY=your_ai_content_safety_key

# File Upload Limits
MAX_FILE_SIZE=5368709120
# 5GB in bytes (5 * 1024 * 1024 * 1024)

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
# 15 minutes in milliseconds
RATE_LIMIT_MAX_REQUESTS=100

# Logging
LOG_LEVEL=info
# Options: error, warn, info, http, verbose, debug, silly
```

### Frontend Environment Variables (.env)

```env
# API Configuration
VITE_API_BASE_URL=http://localhost:5000/api/v1
VITE_SOCKET_URL=http://localhost:5000

# Upload Configuration
VITE_MAX_UPLOAD_SIZE=5368709120
# 5GB in bytes
VITE_CHUNK_SIZE=5242880
# 5MB chunks for upload

# Feature Flags
VITE_ENABLE_AI_MODERATION=true
VITE_ENABLE_ANALYTICS=true
```

### Generating JWT Secrets

```bash
# Generate secure random strings for JWT secrets
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

---

## 📄 License

ISC License

---

## 🤝 Support

For issues, questions, or feature requests:

- **GitHub Issues**: [Create an issue](https://github.com/your-repo/issues)
- **Documentation**: Refer to this README and inline code comments
- **Azure Support**: [Azure Support Portal](https://portal.azure.com)

---

**Built with ❤️ using Node.js, React, TypeScript, MongoDB, Redis, Azure, and FFmpeg**

---

*Last Updated: January 2025*
