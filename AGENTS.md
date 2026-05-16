<claude-mem-context>
# Memory Context

# [opus_4.6] recent context, 2026-05-16 2:45am CST

Legend: 🎯session 🔴bugfix 🟣feature 🔄refactor ✅change 🔵discovery ⚖️decision 🚨security_alert 🔐security_note
Format: ID TIME TYPE TITLE
Fetch details: get_observations([IDs]) | Search: mem-search skill

Stats: 50 obs (17,798t read) | 472,766t work | 96% savings

### Apr 17, 2026
S2 SegmentRenderer refactor cleanup and final handoff — narrow the commit scope, remove verification-only artifacts, and produce a reviewer-ready handoff report (Apr 17, 10:39 PM)
S1 Refactor duplicated section/frame rendering logic in library-v2 into a shared SegmentRenderer component (Apr 17, 10:39 PM)
S3 Stage and commit SegmentRenderer orchestration layer refactor across 3 library-v2 reader files (Apr 17, 11:08 PM)
S4 Typography-only emphasis fix for Persian reader — make **bold**, *italic*, and `code` visually distinct using oblique synthesis and heavier font weights (Apr 17, 11:34 PM)
### Apr 18, 2026
S17 Docker build progress monitoring — step #12 DONE 2.3s (Apr 18, 1:03 AM)
### Apr 22, 2026
S40 Fix DashboardClient.tsx TypeError + restore project to best known-good state with algorithms/media-rail features (Apr 22, 1:26 AM)
### May 15, 2026
S41 Fix nested button hydration error in OutlinerDagNodeCard (renderers.tsx) (May 15, 5:06 PM)
S42 Hossein Starship Outliner — Visual Redesign of Surface Renderers (Apple-HIG Stripe Cards) (May 15, 9:34 PM)
935 10:17p ✅ DAG dot-grid texture themedified via CSS custom property
936 10:18p 🔵 TypeScript TS18047 errors in WebGLEdgeLayer.tsx — ctx possibly null
937 " 🔵 WebGLEdgeLayer TS18047 errors are in WebGL2 draw loop, not 2D fallback
938 10:19p 🔵 TypeScript flow narrowing fails for ctx inside draw() closure despite outer null guard
939 10:20p 🔴 Fixed WebGLEdgeLayer TS18047 null errors by re-narrowing glRef inside draw() closure
940 10:21p 🔴 TypeScript build passes clean after WebGLEdgeLayer closure fix
S43 Prompt 5 — Pencil/Annotation Layer for Hossein Starship Outliner, plus pre-work: WebGL2 edge rendering integration and TypeScript cleanup (May 15, 10:22 PM)
941 10:27p 🟣 Pencil / Annotation Layer — Hossein Starship Outliner Prompt 5
942 10:29p 🔵 WebGLEdgeLayer — GPU-rendered bezier edge layer exists in outliner
943 " 🔵 renderers.tsx surface dispatcher and DagRenderer architecture confirmed
944 10:30p 🔵 Outliner canvas CSS custom properties and surface transition animation
945 " 🔴 WebGLEdgeLayer default edge color updated for dark mode visibility
946 10:31p 🔴 WebGLEdgeLayer respects prefers-reduced-motion for flow-dash animation
947 " 🔴 WebGLEdgeLayer handles webglcontextlost event with SVG fallback
948 10:32p 🔵 TypeScript type check passes with zero errors after WebGLEdgeLayer fixes
950 10:36p 🟣 Scientifically accurate forgetting curve & readiness panels implemented
949 10:37p 🔵 urologynet2 opus_4.6 Project Structure Mapped
951 10:39p 🔵 Dashboard Directory Contains Minimal page.tsx (144 bytes)
952 " 🔵 Dashboard data pipeline architecture: two parallel data paths feed the cockpit panels
953 " 🔵 Dashboard page.tsx Delegates to @/components/dashboard/DashboardClient
954 10:40p 🔵 Retrievability stored as integer×1000 in flashcard_reviews table but not in flashcards table
956 " 🔵 study-cockpit-shell.tsx already contains a DecayCurvesSVG component with correct Ebbinghaus math
955 " 🔵 src/components/dashboard/ Directory Missing — Broken Dashboard Import
957 10:41p 🔵 src/components/dashboard/ Exists but DashboardClient.tsx Is Missing
958 " 🔵 DashboardClient.tsx EXISTS in src/components/dashboard/ Along with Parallel Study-Cockpit Files
960 " 🔵 Complete FSRS-to-dashboard data flow architecture mapped
959 " 🔵 src/components/dashboard/ Full Inventory with File Sizes Confirmed
961 " 🔵 planner.zip Artifact Found Loose in src/components/ Root
962 10:42p 🔵 Shell inverts SQL avgRetention back to stability via S = -1/ln(R) for curve rendering
963 " 🔵 DashboardClient Depends on study-cockpit Files — They Are Not Deletable Duplicates
966 10:43p 🔵 getDashboardStats() in useDb.ts reads avgRetrievability directly from flashcards.retrievability column (÷1000)
964 " 🔵 src/lib/ Directory Appears Missing or Empty — useDashboardData Hook Has No lib Backing
965 " 🔵 src/lib/ Exists with dashboard/ Subdirectory — import2.zip Artifact Found
967 10:44p 🔵 Parallel Dashboard File Found Alongside Main Dashboard
968 10:49p 🔵 Arbitrary Tailwind Duration Classes in exam-v2 Components
969 " 🔵 FrameMermaid Component Architecture: SSR-Safe Lazy Mermaid Rendering
970 10:50p 🔵 Tailwind CSS 3.4.17 Confirmed — Arbitrary Duration Classes Are Valid
971 10:51p 🔄 Replaced duration-[400ms] with [transition-duration:400ms] in SubjectRowExpand
972 " 🔄 Replaced duration-[600ms] with [transition-duration:600ms] in ResultsTable
973 10:52p 🔄 FrameMermaid Dynamic Import Switched from @vite-ignore to webpackIgnore
974 11:00p 🔵 Existing FSRS and Readiness Score Architecture in StudyCockpitShell
975 11:03p ⚖️ Plan: Scientific fixes for FSRS-5 formula, readiness score calculation, and avgStability wiring
976 " 🔴 Fixed FSRS-5 retrievability formula in dashboard queries
977 11:04p ✅ Wired avgStability metric to FSRS chapter statistics API response
978 11:05p 🔵 Dashboard Lib Directory Contains Two Files: lite-queries.ts and useDashboardData.ts
979 11:10p 🟣 Scientific Refinement of Forgetting Curve in Readiness Dashboard
980 " 🟣 FSRS-5 Scientific Readiness Score with Maturity Metric in Medical Board Dashboard
981 " 🟣 Weighted-Average FSRS-5 Retrievability Wired into Dashboard Readiness Call-Site
982 11:11p ✅ FsrsStatsByChapter Type Extended with avgStability in StudyCockpitShell
983 " 🟣 DecayCurvesSVG Upgraded to FSRS-5 Power Law with Live R̄ Marker
984 " 🔵 Parallel FsrsStatsByChapter Implementations Found in Both Dashboard Files

Access 473k tokens of past work via get_observations([IDs]) or mem-search skill.
</claude-mem-context>