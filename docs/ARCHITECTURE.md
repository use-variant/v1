# Architecture Decision Record (ADR): Merge-as-a-Service (MaaS) Video SDK

This document outlines the core system mechanics for our MaaS Video Version Control platform. This project utilizes highly specific, non-standard engineering patterns designed to prevent browser memory crashes and eliminate redundant cloud rendering compute costs.

---

## 1. OpenTimelineIO (OTIO) JSON as the Source of Truth

**What it is:** We completely decouple timeline math from physical video rendering. Every edit, cut, transition, and conflict resolution is executed purely as mathematical operations on an OpenTimelineIO (OTIO) JSON manifest, backed by CRDTs (Conflict-free Replicated Data Types).

**Why it matters:** 
- **Zero Cloud Cost & Instant Operations:** Resolving a merge conflict requires zero cloud rendering or stitching. We are simply, mathematically rearranging pointers to timecodes.
- **Deterministic Merging:** By treating the timeline as an AST (Abstract Syntax Tree) of video clips, we can apply robust Git-style diffing and merging algorithms that are mathematically perfect.

## 2. Immutable Proxy Manifesting

**What it is:** Proxy videos (`.mp4`) uploaded by external freelancers or AI agents are treated as append-only chunks in S3 storage. We never stitch, re-encode, or modify these physical media files on the server during the Pull Request review phase.

**Why it matters:**
- **Data Integrity:** The original footage remains perfectly intact and accessible.
- **Cost Reduction:** It bypasses expensive FFmpeg transcoding loops every time a minor edit is proposed. The system behaves like a ledger referencing immutable chunks of media.

## 3. Virtual Chunking vs. Milestone Baking

**What it is:** 
- **Virtual Chunking:** During the active Pull Request review phase, the React frontend dynamically seeks and jumps between raw, unstitched proxy files on-the-fly using the JSON manifest pointers.
- **Milestone Baking:** Only when a Pull Request is officially squashed and merged into the `main` branch does a background FFmpeg worker trigger to "bake" a single, continuous proxy file.

**Why it matters:**
- **Performance & UX:** Users experience instant PR updates and conflict resolution right in the browser with zero loading bars.
- **Compute Efficiency:** We reserve heavy server-side encoding exclusively for stable milestones (`main`), entirely eliminating compute waste on abandoned PRs or minor iterative branches.

## 4. The 3-Player Object Pool (Just-In-Time Buffering)

**What it is:** A strict memory-management architecture for the React frontend DOM. The system is limited to exactly three `<video preload="metadata">` tags at any given time:
1. **The Active Player:** The chunk currently rendering to the HTML canvas.
2. **The Pre-loader:** Silently buffering the *next* chunk in the timeline sequence.
3. **The Garbage Collector:** Tearing down the memory footprint of the *previous* chunk.

**Why it matters:**
- **Crash Prevention:** A timeline might consist of 50+ cherry-picked video chunks. Loading 50 `<video>` elements in the DOM will instantly crash the browser due to the ~2GB memory limit. The 3-Player Object Pool strictly bounds memory consumption while guaranteeing a seamless, zero-latency 60fps playback experience.
