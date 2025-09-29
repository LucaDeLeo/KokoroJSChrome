# Project Brief: KokoroJS Chrome Extension

## Executive Summary

**KokoroJS Chrome Extension** is a privacy-first, offline text-to-speech browser extension that brings natural-sounding voice synthesis directly to any webpage. The extension solves the problem of inaccessible or inconvenient TTS solutions by providing instant, high-quality voice synthesis for selected text without requiring external services or compromising user privacy.

Targeting content consumers, accessibility users, and productivity enthusiasts, KokoroJS leverages the state-of-the-art Kokoro-82M ONNX model to deliver studio-quality voice synthesis that runs entirely in the browser. The key value proposition is combining enterprise-grade TTS quality with complete data privacy, zero latency after initial setup, and seamless integration into existing browsing workflows.

## Problem Statement

Current text-to-speech solutions face significant limitations that create barriers for users who need or want audio content consumption:

**Current State:** Users must either rely on cloud-based TTS services that compromise privacy and require constant internet connectivity, use built-in browser TTS with robotic voices, or copy-paste text into separate applications. Most existing TTS extensions either have poor voice quality, require subscription fees, or send user data to external servers.

**Impact:** This fragmentation affects millions of users including:
- People with dyslexia or reading disabilities who need audio support (affecting 5-10% of population)
- Productivity-focused users who want to consume content while multitasking
- Language learners needing pronunciation assistance
- Users with visual impairments requiring screen reading capabilities
- Privacy-conscious individuals unwilling to share their reading content with third parties

**Why Existing Solutions Fall Short:**
- Cloud-based solutions violate privacy and require constant connectivity
- Native browser TTS lacks natural voice quality and customization
- Standalone applications break workflow and require manual text transfer
- Current extensions either compromise on quality or require paid subscriptions

**Urgency:** With increasing digital content consumption and growing privacy awareness post-GDPR/CCPA, users need a solution that respects their data while providing professional-grade functionality. The recent advances in edge AI models like Kokoro make this technically feasible for the first time.

## Proposed Solution

KokoroJS Chrome Extension revolutionizes browser-based TTS by bringing state-of-the-art neural voice synthesis directly to the user's device, eliminating the privacy/quality trade-off that has plagued this space.

**Core Concept:** A Chrome extension that runs the Kokoro-82M ONNX model locally using WebAssembly and WebGPU acceleration, processing all text-to-speech conversion on the user's device without any external API calls.

**Key Differentiators:**
- **100% Offline After Setup:** Once the model downloads, no internet required
- **Studio-Quality Voices:** Multiple natural voices from the Kokoro model
- **Zero Data Leakage:** Text never leaves the user's device
- **Instant Access:** One-click or keyboard shortcut activation on any webpage
- **Smart Chunking:** Semantic text splitting for natural pauses and flow

**Why This Solution Will Succeed:**
- Leverages proven StreamingKokoroJS codebase with existing TTS implementation
- Chrome's new Offscreen API enables proper audio handling in extensions
- IndexedDB provides unlimited storage for the 300MB model
- WebGPU/WASM ensures performance comparable to native applications

**High-Level Vision:** Transform every webpage into an audiobook with professional narration quality, making the entire internet accessible through natural speech while maintaining complete user privacy.

## Target Users

### Primary User Segment: Productivity Power Users

**Profile:**
- Age: 25-45 professionals and students
- Tech-savvy individuals who use multiple browser extensions
- Consume 3+ hours of digital content daily
- Value efficiency and multitasking capabilities

**Current Behaviors:**
- Read long-form articles, documentation, and research papers
- Often have multiple tabs open simultaneously
- Listen to podcasts/audiobooks during commutes or exercise
- Copy-paste text into TTS apps when needed

**Specific Needs:**
- Ability to "read" while doing other tasks
- Quick text selection and playback
- Variable speed control for different content types
- High-quality voices that don't cause listening fatigue

**Goals:**
- Increase content consumption efficiency
- Reduce eye strain from extended reading
- Learn/absorb information during otherwise unproductive time

### Secondary User Segment: Accessibility Users

**Profile:**
- Individuals with dyslexia, ADHD, or visual impairments
- Students with learning differences
- Elderly users with declining vision
- Non-native speakers learning English

**Current Behaviors:**
- Use screen readers or accessibility tools
- Struggle with long-form text content
- Rely on audio content when available
- Often avoid text-heavy websites

**Specific Needs:**
- Reliable TTS that works on any website
- Clear pronunciation and adjustable speed
- Ability to replay sections easily
- Visual highlighting synchronized with audio

**Goals:**
- Access web content independently
- Improve reading comprehension
- Reduce cognitive load when consuming text
- Maintain privacy about their accessibility needs

## Goals & Success Metrics

### Business Objectives
- Achieve 10,000+ active users within 6 months of launch
- Maintain 4.5+ star rating on Chrome Web Store
- Process 1M+ text selections monthly by month 12
- Enable 500+ hours of audio content consumption weekly by month 6

### User Success Metrics
- 80% of users use the extension at least weekly
- Average session length exceeds 10 minutes
- 60% of users customize voice settings
- Less than 2% uninstall rate in first week

### Key Performance Indicators (KPIs)
- **Activation Rate:** 70% of installers use TTS within first day
- **Retention Rate:** 40% thirty-day retention
- **Performance Score:** <3 second time-to-first-audio for average text selection
- **Model Download Completion:** 85% successful model downloads on first attempt
- **Privacy Score:** 0 external API calls after model download

## MVP Scope

### Core Features (Must Have)
- **Text Selection Detection:** Detect and offer TTS for any selected text on any webpage
- **One-Click Playback:** Floating button appears near text selection for instant playback
- **Voice Selection:** Choose from at least 3 different Kokoro voices
- **Playback Controls:** Play, pause, stop, and skip functionality
- **Speed Control:** Adjust playback speed from 0.5x to 3.0x
- **Context Menu Integration:** Right-click option to speak selected text
- **Model Management:** Automatic download and storage of Kokoro-82M model in IndexedDB
- **Offline Operation:** Full functionality without internet after initial setup

### Out of Scope for MVP
- Synchronized highlighting of text being spoken
- PDF or Google Docs integration
- Voice cloning or custom voice training
- Multi-language support beyond English
- Sentence-level navigation controls
- Export to audio file functionality
- Reading history or bookmarks
- Cloud sync of settings

### MVP Success Criteria
The MVP is successful when users can select any text on any standard webpage, click a button or use a keyboard shortcut, and hear that text spoken in a natural voice without any external API calls or internet connectivity requirements after initial setup.

## Post-MVP Vision

### Phase 2 Features
- **Visual Sync:** Highlight words/sentences as they're spoken
- **Enhanced Navigation:** Skip by sentence, paragraph, or heading
- **Reading Queue:** Queue multiple selections for continuous playback
- **Audio Export:** Save selections as MP3/WAV files
- **Customization:** Font size preferences for reading mode
- **Smart Features:** Auto-detect and skip ads, navigation elements
- **LLM Content Preprocessing:** Intelligent content transformation for optimal audio experience:
  - Convert tables to natural spoken format (e.g., "Row 1: Name is John, Age is 25")
  - Generate descriptions for images using alt text or visual AI
  - Restructure lists and nested content for linear narration
  - Clean up formatting artifacts (repeated headers, navigation breadcrumbs)
  - Expand abbreviations and acronyms on first occurrence
  - Add contextual explanations for code blocks and formulas

### Long-term Vision
Within 1-2 years, KokoroJS becomes the de facto standard for browser-based TTS, expanding to support multiple languages, integrate with productivity tools, and potentially offering a premium tier with advanced voice models and cloud backup of reading history. The extension evolves into a comprehensive reading assistant that can summarize content, answer questions about text, and provide reading statistics.

### Expansion Opportunities
- **Firefox/Safari Versions:** Cross-browser compatibility
- **Mobile Companion App:** Sync reading lists to mobile devices
- **API for Developers:** Allow websites to integrate with KokoroJS
- **Educational Edition:** Special features for schools and universities
- **Corporate Edition:** Enterprise deployment with centralized management
- **Voice Marketplace:** Platform for additional voice models

## Technical Considerations

### Platform Requirements
- **Target Platforms:** Chrome 109+ (for Offscreen API), Microsoft Edge 109+
- **Browser/OS Support:** Windows 10+, macOS 10.15+, Linux (Ubuntu 20.04+)
- **Performance Requirements:** 4GB RAM minimum, 500MB free disk space, GPU recommended for WebGPU acceleration

### Technology Preferences
- **Frontend:** Vanilla JavaScript with ES6 modules, webpack for bundling
- **Backend:** Service Worker for background processing, no external backend
- **Database:** IndexedDB for model storage, chrome.storage.local for settings
- **Hosting/Infrastructure:** Chrome Web Store distribution, no external infrastructure needed
- **LLM Integration (Phase 2):** Local small language model (e.g., Phi-3 mini) or API integration for content preprocessing

### Architecture Considerations
- **Repository Structure:** Monorepo with clear separation of extension components
- **Service Architecture:** Service Worker + Content Scripts + Offscreen Document pattern
- **Integration Requirements:** Chrome Extension APIs (contextMenus, storage, tabs, runtime)
- **Security/Compliance:** Content Security Policy compliant, no remote code execution, all processing client-side

## Constraints & Assumptions

### Constraints
- **Budget:** Self-funded development, no external investment initially
- **Timeline:** 5-7 days for MVP development, 2 weeks to Chrome Web Store approval
- **Resources:** Single developer initially, community contributions after open-source release
- **Technical:** 300MB model size limitation, WebGPU not universally available, Service Worker memory limits

### Key Assumptions
- Users will accept 300MB download for quality voices
- Chrome's Offscreen API remains stable and available
- IndexedDB storage limits won't be problematic
- WebAssembly performance sufficient for real-time synthesis
- Chrome Web Store will approve TTS extension with large model
- Users value privacy enough to choose local over cloud

## Risks & Open Questions

### Key Risks
- **Model Size Rejection:** Chrome Web Store may reject extension due to 300MB model size
- **Performance Degradation:** Service Worker throttling could impact synthesis speed
- **Memory Constraints:** Devices with limited RAM may struggle with model loading
- **WebGPU Adoption:** Slow WebGPU adoption means many users stuck with slower WASM
- **Competition:** Google may enhance native Chrome TTS, reducing need for extension

### Open Questions
- What's the optimal chunking strategy for different text types?
- Should we offer model quality tiers (smaller/faster vs larger/better)?
- How do we handle websites with complex DOM structures or dynamic content?
- What's the best UI pattern for long-form reading sessions?
- Should we implement telemetry for performance monitoring?
- How do we handle multilingual text detection?
- Should LLM preprocessing be automatic or user-triggered?
- What's the latency trade-off for LLM preprocessing worth?
- Should we cache preprocessed content for repeated reads?
- How do we handle privacy concerns with LLM API usage?
- Can we run a small LLM locally for preprocessing without impacting performance?

### Areas Needing Further Research
- Optimal compression strategies for model storage
- Battery impact on laptops during extended usage
- Accessibility compliance for users with screen readers
- Performance benchmarking across different hardware configurations
- User preferences for voice characteristics and speaking styles
- LLM model selection for content preprocessing (local vs API trade-offs)
- Optimal prompting strategies for table-to-speech conversion
- Image description generation accuracy and performance
- Caching strategies for preprocessed content

## Appendices

### A. Research Summary

**Technical Feasibility Analysis:**
Based on the StreamingKokoroJS codebase analysis, the conversion to Chrome extension is technically viable with the following findings:
- Core TTS engine (35KB) is lightweight and modular
- Kokoro-82M model provides 6 distinct high-quality voices
- WebAssembly fallback ensures broad compatibility
- Semantic text chunking already implemented
- Audio streaming architecture supports real-time playback

**Competitive Analysis:**
- Read Aloud Extension: 1M+ users, cloud-based, privacy concerns
- Natural Reader: Freemium model, limited free voices
- Google TTS: Built-in but robotic quality
- Speechify: High quality but expensive subscription model

**Market Opportunity:**
- 300M+ Chrome users globally
- TTS market growing 14.7% CAGR
- Increasing demand for accessibility tools
- Privacy-first solutions gaining traction post-Cambridge Analytica

### B. Stakeholder Input

*To be gathered during development phase*

### C. References

- [Chrome Extension Manifest V3 Documentation](https://developer.chrome.com/docs/extensions/mv3/)
- [Chrome Offscreen API Documentation](https://developer.chrome.com/docs/extensions/reference/offscreen/)
- [StreamingKokoroJS Repository](https://github.com/original-repo-link)
- [Kokoro TTS Model Paper](https://model-paper-link)
- [WebAssembly Performance Benchmarks](https://wasm-benchmarks-link)
- [IndexedDB Storage Limits Documentation](https://storage-limits-link)

## Next Steps

### Immediate Actions
1. Fork and audit StreamingKokoroJS codebase for security/licensing
2. Set up Chrome extension development environment
3. Create manifest.json with appropriate permissions
4. Implement basic service worker with model loading
5. Test Offscreen API for audio playback
6. Create simple content script for text selection

### PM Handoff

This Project Brief provides the full context for KokoroJS Chrome Extension. Please start in 'PRD Generation Mode', review the brief thoroughly to work with the user to create the PRD section by section as the template indicates, asking for any necessary clarification or suggesting improvements.

The extension represents a unique opportunity to democratize high-quality TTS while respecting user privacy. The technical architecture is proven, the market need is clear, and the implementation path is well-defined. With focused execution over the next 5-7 days, we can deliver an MVP that fundamentally changes how users interact with text content on the web.
