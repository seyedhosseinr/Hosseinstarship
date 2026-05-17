<claude-mem-context>
# Memory Context

# [opus_4.6] recent context, 2026-05-17 2:57am CST

Legend: 🎯session 🔴bugfix 🟣feature 🔄refactor ✅change 🔵discovery ⚖️decision 🚨security_alert 🔐security_note
Format: ID TIME TYPE TITLE
Fetch details: get_observations([IDs]) | Search: mem-search skill

Stats: 50 obs (20,662t read) | 815,872t work | 97% savings

### Apr 17, 2026
S2 SegmentRenderer refactor cleanup and final handoff — narrow the commit scope, remove verification-only artifacts, and produce a reviewer-ready handoff report (Apr 17, 10:39 PM)
S3 Stage and commit SegmentRenderer orchestration layer refactor across 3 library-v2 reader files (Apr 17, 11:08 PM)
S4 Typography-only emphasis fix for Persian reader — make **bold**, *italic*, and `code` visually distinct using oblique synthesis and heavier font weights (Apr 17, 11:34 PM)
### Apr 18, 2026
S17 Docker build progress monitoring — step #12 DONE 2.3s (Apr 18, 1:03 AM)
### Apr 22, 2026
S40 Fix DashboardClient.tsx TypeError + restore project to best known-good state with algorithms/media-rail features (Apr 22, 1:26 AM)
### May 15, 2026
S41 Fix nested button hydration error in OutlinerDagNodeCard (renderers.tsx) (May 15, 5:06 PM)
S42 Hossein Starship Outliner — Visual Redesign of Surface Renderers (Apple-HIG Stripe Cards) (May 15, 9:34 PM)
S43 Prompt 5 — Pencil/Annotation Layer for Hossein Starship Outliner, plus pre-work: WebGL2 edge rendering integration and TypeScript cleanup (May 15, 9:45 PM)
S44 Make the forgetting curve readiness indicator in the dashboard scientifically accurate (FSRS-5 Power Law) and wire its data pipeline precisely (May 15, 10:22 PM)
980 11:10p 🟣 FSRS-5 Scientific Readiness Score with Maturity Metric in Medical Board Dashboard
982 11:11p ✅ FsrsStatsByChapter Type Extended with avgStability in StudyCockpitShell
983 " 🟣 DecayCurvesSVG Upgraded to FSRS-5 Power Law with Live R̄ Marker
984 " 🔵 Parallel FsrsStatsByChapter Implementations Found in Both Dashboard Files
### May 16, 2026
985 2:45a 🟣 ReaderHighlightLayer Upgraded with Structured Palette and Visual Layer
986 " 🔵 apply_patch Fails on Lines Containing Persian/Arabic Characters
987 " 🟣 readerHighlightPalette.ts - New Centralized Color Registry
988 2:46a 🟣 Reader Snapshot Recovery from cloudrun_redeploy_gitfiles_20260514
989 2:47a 🔵 toolbarStyle and BG_THEMES not in standalone files — embedded in reader components
990 " 🔵 toolbarStyle/BG_THEMES symbols span 4 files in snapshot
991 2:48a 🔵 Complete useReaderSettings hook and ReaderDisplaySettings UI recovered from snapshot
992 " 🔵 Main worktree useReaderSettings and ReaderDisplaySettings are older versions missing bgTheme/toolbarStyle
993 2:49a 🔵 Current worktree ChapterReaderV2 (875 lines) and ReaderStage missing GoodNotes rail and bgTheme support
996 " 🔵 Readiness Forgetting Curve Formula Found in Dashboard Codebase
994 " 🔵 Current ChapterReaderV2 uses simple penMode boolean; snapshot uses AnnotationTool state machine
995 2:50a 🔵 resolveSelectionAgainstCanonicalSurface exists in current worktree — snapshot import will resolve correctly
997 " 🟣 useReaderSettings.ts updated with BG_THEMES, ReaderBgTheme, ReaderToolbarStyle
998 " 🔵 buildHostedReadiness Is a Heuristic Composite Score, Not FSRS-Based
1000 2:51a 🟣 ReaderDisplaySettings.tsx updated with BgSwatchButton grid and TOOLBAR_STYLE_OPTIONS segment
999 " 🔵 Full Decay Curve Data Pipeline Traced: DB → avgRetention → Stability Inversion → SVG
1002 " 🔴 FSRS avgRetention SQL Formula Corrected from Exponential to FSRS-5 Power-Law
1001 2:52a 🟣 ReaderStage.tsx updated to accept bgTheme and spineOpen props
1003 " 🔴 Row Mapper Updated to Include avgStability and Clamp avgRetention to [0,100]
1004 2:53a 🟣 buildHostedReadiness Overhauled with Scientifically Calibrated Weights and FSRS-5 Retention Input
1005 " 🟣 Weighted avgRetrievability Aggregation Wired into readinessScore Call Site
1006 2:54a 🟣 DecayCurvesSVG Rewritten to Use FSRS-5 Power Law with Live Avg Retention Marker
1007 2:55a 🟣 ChapterReaderV2.tsx fully recovered — GoodNotes rail, AnnotationTool state machine, per-tool widths, bgTheme/spineOpen wired
1008 " 🔵 TypeScript errors after recovery: DrawTool missing "highlighter"/"circle", DrawingLayer missing annotationStrokeWidth/highlighterWidth props, ReaderReferenceRail missing spineOpen prop
1009 2:56a 🔵 DrawingLayer DrawTool is "pen"|"eraser" only; ReaderReferenceRail has no spineOpen or annotationStrokeWidth props
1010 " 🔵 DrawingLayer.tsx current version is 792 lines with DrawTool="pen"|"eraser" and no highlighter/circle/annotationStrokeWidth support
1011 " 🔵 Snapshot DrawingLayer and ReaderReferenceRail interface diffs confirmed — minimal targeted fixes needed
S45 Recovery of reader UI features from cloudrun snapshot (2026-05-14) into main worktree (opus_4.6): toolbarStyle, BG_THEMES, ReaderToolbarStyle, GoodNotes-style side tool rail (May 16, 2:58 AM)
1012 3:01a 🟣 Pencil / Annotation Layer — Prompt 5 Specification
1013 3:03a 🟣 OutlinerWebGLCanvas — 5-Pass WebGL2 Pipeline Component Created
1014 " 🟣 DagRenderer Upgraded: Ctrl+Scroll Zoom + WebGL LOD Integration
1015 " 🔵 TypeScript Check Passes After OutlinerWebGLCanvas Integration
1016 3:07a 🟣 Pencil / Annotation Layer — Hossein Starship Outliner Prompt 5
1017 3:09a 🔵 Next.js Build Warning: Critical Dependency in FrameMermaid.tsx
1018 3:10a 🔵 OutlinerWebGLCanvas Feature Checklist — All 10 Checks Pass
1019 3:11a 🔵 Next.js Production Build Fails — Three Missing Route/Page Modules
1020 3:17a 🟣 Pencil / Annotation Layer — Prompt 5 Design Spec
1021 3:18a 🔵 Next.js Build Warning: FrameMermaid.tsx Dynamic Dependency Expression
1023 " 🔴 Dashboard Runtime Error Fix and Parallel File Cleanup in urologynet2
1022 " 🔵 DagRenderer Wiring Checklist: Scale Transform Pattern Missing
1024 " 🔵 Scale Transform Found in renderers.tsx as Style Object Property
1029 3:19a 🔵 opus_4.6 Production Build Succeeds — Full Route Manifest
1025 " 🔵 Identified Three Warning Sources in urologynet2 hosseinstarship-clean-deploy
1026 " 🔴 Fixed Tailwind Arbitrary Duration Warnings in exam-v2 Components
1027 3:20a 🔴 Replaced @vite-ignore Dynamic Import with webpackIgnore in FrameMermaid
1028 " 🔵 avgStability Field Traced Through lite-queries.ts SQL Layer
1030 " 🔵 Next.js Build Fails Due to Missing common-tags Dependency in @serwist/build

Access 816k tokens of past work via get_observations([IDs]) or mem-search skill.
</claude-mem-context>