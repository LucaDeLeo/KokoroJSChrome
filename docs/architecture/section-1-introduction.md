# Section 1: Introduction

This document outlines the architectural approach for enhancing KokoroJS Chrome Extension with the conversion from a standalone web application to a fully-functional Chrome Extension. Its primary goal is to serve as the guiding architectural blueprint for AI-driven development of new features while ensuring seamless integration with the existing system.

**Relationship to Existing Architecture:**
This document defines the complete transformation architecture from the existing web application to Chrome Extension, addressing the fundamental restructuring required for Manifest V3 compliance, including Service Worker implementation, Content Scripts for webpage interaction, and Offscreen API for audio handling.

## Existing Project Analysis

**Current Project State:**
- **Primary Purpose:** High-quality text-to-speech web application using Kokoro-82M ONNX model
- **Current Tech Stack:** HTML/JS web app with Service Worker caching, Web Worker processing, CDN-based dependencies
- **Architecture Style:** Client-side PWA with offline-first approach
- **Deployment Method:** Static web hosting with CDN resource loading

**Available Documentation:**
- Comprehensive Project Brief (docs/brief.md)
- Detailed Brownfield PRD for extension conversion
- Existing codebase with modular TTS components

**Identified Constraints:**
- Manifest V3 restrictions: No CDN loading, 30-second service worker limit
- Chrome Extension CSP: No inline scripts/styles on many sites
- Storage limitations: IndexedDB may be evicted under pressure
- Memory constraints: 300MB model + overhead = 600MB+ RAM usage
- Offscreen API singleton: Only one instance for all tabs

## Change Log
| Change | Date | Version | Description | Author |
|--------|------|---------|-------------|--------|
| Initial Architecture | 2025-09-28 | 1.0 | Created Brownfield Architecture for Chrome Extension conversion | Winston (Architect) |
| Modular Redesign | 2025-09-28 | 2.0 | Complete redesign following modular philosophy with plugin architecture | Winston (Architect) |
