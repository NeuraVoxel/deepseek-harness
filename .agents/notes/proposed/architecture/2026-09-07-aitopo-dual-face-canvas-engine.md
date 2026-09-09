# Agent Note: AITopo dual-face Canvas engine under vendor/aitopo

Status: proposed

English | [中文](2026-09-07-aitopo-dual-face-canvas-engine.zh.md)

## Problem

`plugins/agent-observe` renders Session and Agent topology with hand-rolled SVG. That path does not scale to a shared graphics library that both humans and models can drive, and it leaves no clean path to Agent Teams drill-down or workflow alarms. `vendor/SDK2D` (twaver) contains a mature vector Network stack, but copying its source or public APIs is unacceptable for licensing and ownership reasons.

## Proposal

Ship `@neuravoxel/aitopo` as a first-party TypeScript package under `vendor/aitopo` (not a Cordis upstream pin):

1. Dual-face architecture: Document / Patch / Events for AI and plugins; Scene + View + Renderer internally.
2. Clean-room rewrite of twaver.vector ideas (dual canvas, dirty validate, interaction plugins) with new names and APIs; zero SDK2D imports.
3. Dirty-rect paint from day one; full-frame invalidate on camera or resize.
4. Alarm badges and single-level SubNetwork in the first engine milestone.
5. Engine plus vanilla DOM demo before any `plugins/agent-observe` integration.
6. Canvas 2D renderer behind a `Renderer` interface reserved for WebGL later; no React in the engine package.

Design: [vendor/aitopo/docs/2026-09-07-aitopo-design.md](../../../../vendor/aitopo/docs/2026-09-07-aitopo-design.md). Plan: [vendor/aitopo/docs/2026-09-07-aitopo-implementation-plan.md](../../../../vendor/aitopo/docs/2026-09-07-aitopo-implementation-plan.md). Plugin integration: [vendor/aitopo/docs/2026-09-07-aitopo-agent-observe-integration.md](../../../../vendor/aitopo/docs/2026-09-07-aitopo-agent-observe-integration.md).

## Alternatives considered

- Document-first only (no Scene/View): friendlier for agents, weaker for dirty paint and interaction.
- Scene-first only (twaver-like Element model as the public API): harder for model-driven patches.
- External separate repository: originally rejected in favor of `vendor/aitopo` for monorepo workspace wiring; ownership is superseded by the peer-repo decision [2026-09-09-ai-eng-kit-and-aitopo-peer-repos.md](../../implemented/architecture/2026-09-09-ai-eng-kit-and-aitopo-peer-repos.md) (submodule, then npm). Dual-face protocol and engine purity are unchanged.
- Direct twaver port or wrapper: rejected for clean-room and license clarity.

## Acceptance criteria

- `@neuravoxel/aitopo` package tests pass; typecheck under the package project.
- Demo loads fleet / flow / teams fixtures; patch, alarm, and SubNetwork enter/exit work.
- No React, Cordis, or `@deepseek-ai/dsh-*` dependencies in the engine package.
- No imports from `vendor/SDK2D`.
- `vendor/README.md` documents the first-party exception.
- `plugins/agent-observe` renders Fleet and Flow through `AITopoHost` only (no SVG stage / feature flag).

## Risks

- Dirty-rect incorrect clips may flash; mitigate with `debugPaintRects` and full-frame fallback.
- `vendor/` layout may be confused with Cordis pins; mitigate with README ownership text and sync-procedure exclusion.
- Dual Document/Scene sources can drift; mitigate with a single write path (`load` / `apply` / layout / enter-exit).
