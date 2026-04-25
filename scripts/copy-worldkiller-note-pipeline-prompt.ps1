# FILE: scripts\copy-worldkiller-note-pipeline-prompt.ps1
# RUN:
# powershell -ExecutionPolicy Bypass -File .\scripts\copy-worldkiller-note-pipeline-prompt.ps1

$ErrorActionPreference = "Stop"

$root = "C:\Users\Hossein\Desktop\board\tests\app\urologynet2\opus_4.6"
Set-Location $root

function Write-Utf8NoBom {
  param([string]$Path,[string]$Content)
  $full = Join-Path (Get-Location) $Path
  $dir = Split-Path -Parent $full
  if ($dir -and -not (Test-Path $dir)) {
    New-Item -ItemType Directory -Force -Path $dir | Out-Null
  }
  $enc = New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::WriteAllText($full, $Content, $enc)
}

$prompt = @'
Patch mode. No explanations. No summaries. No redesign outside required surfaces. Return only changed-files report + validation notes.

PROJECT GOAL
Build a world-class AST-first note pipeline for URO-ZERO:
semantic HTML fragment per chunk -> validated fragment AST -> merged chapter AST -> canonical notebook document -> premium reader.
Use existing Next.js + TypeScript + Drizzle + shadcn architecture.
Preserve existing notebook reader UX unless a change is required to support the new pipeline safely.

NON-NEGOTIABLE RULES
- Do not introduce CSS-in-HTML requirements.
- Do not require FIRST / MIDDLE / LAST document wrapper logic from the model.
- Treat every note chunk as a fragment-only semantic input.
- Canonical rendered unit is chapter-level merged AST document, not raw chunk HTML.
- Keep current /notebooks and /notebooks/[id] routes working.
- Keep current reader-only notebook detail route intact.
- Prefer smallest safe patch set, but finish the whole pipeline.
- If legacy note renderer paths exist, keep compatibility shims only where needed.
- No fake mocks if real project data flow already exists.

TARGET ARCHITECTURE
1) Import semantic fragment HTML per chunk.
2) Detect chapter/chunk from filename and/or payload metadata.
3) Validate allowed tags / attrs / data-block contract.
4) Parse semantic HTML fragment into AST fragment.
5) Persist fragment record.
6) Merge all fragments of same chapter into one canonical chapter AST.
7) Regenerate section anchors and TOC deterministically.
8) Persist canonical chapter notebook document.
9) Reader consumes canonical notebook document.

IMPLEMENT ALL OF THE FOLLOWING

A. FILE NAMING + DETECTION
Support these note file patterns:
- 131-01.html
- 131_01.html
- ch131_ck01.html
- ch131-k01.html
- ch131_chunk01.html
Extract:
- chapterNo
- chunkNo
Normalize chunkNo to integer.
If metadata is embedded in payload, metadata may override filename only if valid.

B. SEMANTIC CONTRACT
Semantic HTML input is fragment-only.
No html/head/body required.
Allowed top-level data-block:
- chapter-header
- section
- callout
- comparison-table
- staging-grid
- treatment-algorithm
- risk-grid
- accordion
- boundary-bar
- keypoints
Nested prose is:
- p[data-block="prose"]
Use strict validation for:
- allowed tags only
- allowed attributes only
- allowed data-block values only
- no class
- no style
- no script
- no empty section
- exactly one terminal keypoints block per fragment
- section ids must be deterministic or regeneratable
Do not depend on split comment markers.

C. DRIZZLE SCHEMA
Add or patch schema for these tables if missing, using project conventions:
1. noteFragments
- id
- chapterNo
- chunkNo
- title
- sourceFile
- sourceHash
- semanticHtml
- astJson
- tocJson nullable
- validationJson nullable
- importBatchId nullable
- status
- createdAt
- updatedAt
Unique:
- chapterNo + chunkNo + sourceHash
Index:
- chapterNo + chunkNo

2. noteDocuments
- id
- chapterNo
- title
- mergedAstJson
- tocJson
- keypointsJson nullable
- fragmentCount
- status
- version
- createdAt
- updatedAt
Unique:
- chapterNo

3. noteSections
- id
- noteDocumentId
- chapterNo
- sectionIndex
- anchorId
- sectionType nullable
- title
- chunkStart nullable
- chunkEnd nullable
- createdAt
Unique:
- noteDocumentId + anchorId

4. optional linking tables only if project already has matching note/question/flashcard patterns:
- questionNoteLinks
- flashcardNoteLinks

Do not break existing schema exports.

D. TYPES
Create or patch note pipeline types:
- SemanticFragmentMeta
- SemanticFragmentAst
- SemanticChapterAst
- SemanticValidationIssue
- SemanticValidationResult
- NoteImportDetectionResult
- NoteMergeResult
- CanonicalSectionRecord
Use strict TypeScript. No any.

E. IMPORTER / VALIDATOR / PARSER / MERGER
Create or patch files in a coherent structure, preferably under:
- src/lib/notes/importer/*
- src/lib/notes/assembler/*
- src/lib/notes/contracts/*
- src/lib/notes/types/*
Implement:

1) detectSemanticNoteFile(...)
- infer chapterNo/chunkNo from filename
- infer title if possible
- return normalized detection result

2) validateSemanticFragmentHtml(...)
- DOM parse
- enforce contract
- return structured validation result
- support fail-fast severe errors + warnings

3) parseSemanticSignalsToAst(...)
- parse fragment into AST
- handle:
  - chapter-header
  - section
  - prose
  - callout
  - comparison-table
  - staging-grid
  - treatment-algorithm
  - risk-grid
  - accordion
  - boundary-bar
  - keypoints
- parseAccordion must exclude summary/title from children
- parseBoundaryBar must support multiple semantic children, not only first p
- no random IDs
- no Math.random

4) persistNoteFragment(...)
- store validated fragment + AST

5) mergeChapterFragments(...)
- load all fragments for one chapter
- sort by chunkNo ascending
- concatenate fragment blocks in order
- keep chapter-header only once
- collapse terminal per-fragment keypoints into a chapter-level derived keypoints set or store separately
- regenerate section anchors globally as:
  ch[CHAPTER]-k[CHUNK]-s[NN]
  or if canonical document is chapter-level:
  ch[CHAPTER]-s[NN]
Choose one deterministic contract and use it consistently across parser, document, toc, reader.
- regenerate TOC deterministically
- derive section records
- return canonical chapter AST

6) upsertCanonicalNoteDocument(...)
- write noteDocuments
- write noteSections
- maintain fragmentCount
- increment version on meaningful rebuild

F. IMPORT FLOW INTEGRATION
Patch current import flow so semantic note HTML import does this:
- detect file
- validate fragment
- parse AST
- persist fragment
- merge chapter
- upsert canonical document
- expose structured import result:
  - chapterNo
  - chunkNo
  - fragmentSaved
  - chapterMerged
  - documentId
  - warnings
If current import UI expects notebook content immediately, keep compatibility by writing canonical rendered source into the notebook/document store it already reads from.

G. NOTEBOOK READER INTEGRATION
Keep current /notebooks/[id] reader UX.
Patch data source so reader uses canonical merged notebook document.
If project currently stores notebook HTML/content, adapt canonical document output into that storage safely.
Do not revert to editor route.
Do not reintroduce ?edit=1 paths.
Keep iframe-based notebook reader pipeline for notebook content if already canonical.
If project has AST renderer stack under components/note/, wire canonical AST path so it can be used without breaking current notebooks.
Prefer:
- persisted mergedAstJson as source of truth
- derived HTML only as compatibility output if current reader still needs it

H. CANONICAL ENTRYPOINT
If legacy src/components/note/NoteRenderer.tsx exists:
- make it a compatibility shim to AstNoteRenderer
- do not leave multiple competing render entrypoints
Canonical renderer path should be clear.

I. AST RENDERER PATCHES
Patch these safely if present:
- AccordionBlock renderer
- BoundaryBar renderer
Make them production-safe and deterministic.
No broken JSX.
No visual regression beyond required cleanup.

J. QUERY HELPERS
Add helper queries/services:
- getNoteFragmentsByChapter(chapterNo)
- getCanonicalNoteDocumentByChapter(chapterNo)
- rebuildCanonicalNoteDocument(chapterNo)
- listCanonicalNoteDocuments()
Use project db conventions.

K. IMPORT REPORTING
Patch import response / logging so one import batch can report:
- parsed fragments
- merged chapters
- skipped duplicates
- validation failures
- warnings
Make the result useful for UI.

L. TEST / VALIDATION TARGETS
After patching, code should satisfy these scenarios:

1) Import files:
- 131-01.html
- 131-02.html
- 131-03.html
Result:
- 3 fragment records
- 1 merged chapter document for chapter 131

2) Re-import changed 131-02.html
Result:
- chunk 02 updated safely
- chapter 131 rebuilt
- canonical document version bumped

3) Reader loads chapter document without needing FIRST/MIDDLE/LAST wrappers

4) No random TOC ids
5) No comment-based split dependency
6) No duplicate competing note render paths

IMPORTANT SEARCH TARGETS
Search and patch all relevant usages for:
- NoteRenderer
- AstNoteRenderer
- parseSemanticSignalsToAst
- import note / notebook import
- notebook content persistence
- chapter metadata
- note reader data source
- import batch
- semantic html
- note AST
- chunk naming
- question-note links
- flashcard-note links

FILES TO CREATE OR PATCH AS NEEDED
Likely candidates:
- src/lib/notes/importer/detectSemanticNoteFile.ts
- src/lib/notes/importer/validateSemanticFragmentHtml.ts
- src/lib/notes/importer/parseSemanticSignalsToAst.ts
- src/lib/notes/importer/persistNoteFragment.ts
- src/lib/notes/assembler/mergeChapterFragments.ts
- src/lib/notes/assembler/upsertCanonicalNoteDocument.ts
- src/lib/notes/types.ts
- src/lib/db/schema.ts or schema split files
- src/components/note/NoteRenderer.tsx
- src/components/note/renderers/AccordionBlock.tsx
- src/components/note/renderers/BoundaryBar.tsx
- import route / import service files
- notebook data query layer

OUTPUT RULES
- Patch directly.
- No explanations.
- No TODO placeholders.
- No pseudocode.
- Return only:
  1) changed files
  2) brief validation notes
  3) any manual follow-up commands if absolutely required
'@

Write-Utf8NoBom "scripts\copilot-worldkiller-note-pipeline-prompt.txt" $prompt
Set-Clipboard -Value $prompt

Write-Host ""
Write-Host "Created:"
Write-Host "  scripts\copilot-worldkiller-note-pipeline-prompt.txt"
Write-Host ""
Write-Host "Copied to clipboard."
Write-Host ""
Write-Host "Paste into GitHub Copilot Chat in Patch mode."