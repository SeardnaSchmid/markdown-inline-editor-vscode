# Runtime Pipeline

This document describes the extension's runtime flow after the 2026 structure refactor.

## Overview

The runtime is intentionally split into a small set of stages:

1. `extension.ts`
   - Builds shared services
   - Registers commands, providers, and event handlers
   - Exposes a small integration-test API

2. `registration/`
   - Wires VS Code lifecycle events and providers
   - Keeps activation logic out of feature modules

3. `markdown-parse-cache.ts`
   - Owns parser reuse and document-version keyed cache entries

4. `parser/core.ts`
   - Produces `decorations`, `scopes`, `mermaidBlocks`, and `mathRegions`
   - `parser.ts` remains the public facade

5. `link-interactions/shared.ts`
   - Converts parser decorations into interactive targets and VS Code ranges
   - Shared by link provider, hover, and click flows

6. `decorator.ts`
   - Orchestrates filtered rendering
   - Delegates state, scheduling, Mermaid rendering, and low-level application to `decorator/` helpers

7. `logging.ts`
   - Owns the shared output channel
   - Centralizes warning/error reporting and opt-in performance metrics

## Design Intent

The structure is aimed at reducing growth pressure on single files:

- `extension.ts` is a composition root, not a feature bucket
- parser types are stable and importable without pulling in the parser implementation
- link interactions have one shared resolution path
- decorator internals are split by responsibility: scheduling, state, application, async render coordination
- debug and performance diagnostics are opt-in and written to a single output channel

## Current Boundaries

- Public parser API: `src/parser.ts`
- Public decorator API: `src/decorator.ts`
- Internal helper modules should remain behavior-preserving and low-level
- New user-facing commands should land in `src/commands/`
- New registration wiring should land in `src/registration/`
- Runtime warnings should use `src/logging.ts` instead of direct `console.*` calls

## Refactor Rule

When adding a feature, prefer extending an existing subsystem over adding behavior to `extension.ts`, `parser.ts`, or `decorator.ts` directly unless the change is truly orchestration-only.
