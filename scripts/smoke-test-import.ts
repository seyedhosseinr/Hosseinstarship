import { promises as fs } from "node:fs"
import path from "node:path"
import { parseSemanticSignalsToAst } from "@/components/note/lib/parseSemanticSignalsToAst"
import type { NoteBlock, SemanticNoteAst } from "@/components/note/lib/noteTypes"

async function getDocument(html: string): Promise<Document> {
  try {
    const { JSDOM } = await import("jsdom")
    return new JSDOM(html).window.document
  } catch {}

  try {
    const { parseHTML } = await import("linkedom")
    return parseHTML(html).document
  } catch {}

  throw new Error("Install jsdom or linkedom first.")
}

const EXPECTED_BLOCK_TYPES = [
  "chapter-header",
  "section",
  "prose",
  "callout",
  "comparison-table",
  "staging-grid",
  "treatment-algorithm",
  "risk-grid",
  "accordion",
  "boundary-bar",
  "keypoints",
] as const

function collectAllBlockTypes(blocks: NoteBlock[]): Set<string> {
  const found = new Set<string>()
  for (const block of blocks) {
    found.add(block.type)
    if ("children" in block && Array.isArray(block.children)) {
      for (const childType of collectAllBlockTypes(block.children as NoteBlock[])) {
        found.add(childType)
      }
    }
  }
  return found
}

function collectCalloutVariants(blocks: NoteBlock[]): string[] {
  const variants: string[] = []
  for (const block of blocks) {
    if (block.type === "callout") variants.push(block.variant)
    if ("children" in block && Array.isArray(block.children)) {
      variants.push(...collectCalloutVariants(block.children as NoteBlock[]))
    }
  }
  return variants
}

function collectRiskKinds(blocks: NoteBlock[]): string[] {
  const kinds: string[] = []
  for (const block of blocks) {
    if (block.type === "risk-grid") {
      for (const category of block.categories) kinds.push(category.kind)
    }
    if ("children" in block && Array.isArray(block.children)) {
      kinds.push(...collectRiskKinds(block.children as NoteBlock[]))
    }
  }
  return kinds
}

function collectKeypointImportance(ast: SemanticNoteAst): string[] {
  const values: string[] = []
  for (const block of ast.blocks) {
    if (block.type === "keypoints") {
      for (const item of block.items) values.push(item.importance)
    }
  }
  return values
}

async function main() {
  const htmlPath = path.resolve(process.cwd(), "tmp/smoke-test.html")
  const html = await fs.readFile(htmlPath, "utf8")
  const document = await getDocument(html)
  const ast = parseSemanticSignalsToAst(document) as SemanticNoteAst

  console.log("\n── URO-ZERO Smoke Test ──────────────────────\n")

  const foundTypes = collectAllBlockTypes(ast.blocks)

  let allFound = true
  console.log("Block coverage:")
  for (const expected of EXPECTED_BLOCK_TYPES) {
    const found = foundTypes.has(expected)
    if (!found) allFound = false
    console.log(`  ${found ? "✓" : "✗"} ${expected}`)
  }

  console.log(`\nTOC entries: ${ast.toc.length}`)
  for (const item of ast.toc) {
    const anchorOk = /^ch99-k1-s\d{2}$/.test(item.id)
    console.log(`  ${anchorOk ? "✓" : "✗"} [${item.id}] ${item.text}`)
  }

  const calloutVariants = collectCalloutVariants(ast.blocks)
  const allowedVariants = ["info", "warning", "warn", "tip", "pearl"]
  const invalidVariants = calloutVariants.filter((v) => !allowedVariants.includes(v))
  console.log(`\nCallout variants found: ${calloutVariants.join(", ")}`)
  console.log(`  ${invalidVariants.length === 0 ? "✓" : "✗"} variant set valid`)

  const importance = collectKeypointImportance(ast)
  const hasModerate = importance.includes("moderate")
  console.log(`\nKeypoints importance values: ${importance.join(", ")}`)
  console.log(`  ${hasModerate ? "✓" : "✗"} moderate present`)

  const riskKinds = collectRiskKinds(ast.blocks)
  const expectedKinds = ["primary", "secondary", "protective"]
  console.log(`\nRisk categories found: ${riskKinds.join(", ")}`)
  for (const kind of expectedKinds) {
    console.log(`  ${riskKinds.includes(kind) ? "✓" : "✗"} ${kind}`)
  }

  const tocOk = ast.toc.every((item) => /^ch99-k1-s\d{2}$/.test(item.id))
  const riskOk = expectedKinds.every((kind) => riskKinds.includes(kind))

  if (!(allFound && tocOk && invalidVariants.length === 0 && hasModerate && riskOk)) {
    console.log("\n✗ Some checks failed — review above\n")
    process.exit(1)
  }

  console.log("\n✓ All checks passed — pipeline is canonical\n")
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})