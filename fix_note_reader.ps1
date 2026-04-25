param()
$file = "src\components\notebooks\note-reader.tsx"
$content = [System.IO.File]::ReadAllText($file)
$nl = "`r`n"

Write-Host "Initial length: $($content.Length)"

# -------- FIX 1: Add new state vars after annotationComposerOpen line --------
$old1 = "  const [annotationDraft, setAnnotationDraft] = useState(`"`");$nl  const [annotationComposerOpen, setAnnotationComposerOpen] = useState(false);$nl$nl  const rawContent"
$new1 = "  const [annotationDraft, setAnnotationDraft] = useState(`"`");$nl  const [annotationComposerOpen, setAnnotationComposerOpen] = useState(false);$nl  const [selectionSnapshot, setSelectionSnapshot] = useState<SelectionSnapshot | null>(null);$nl  const [toolbar, setToolbar] = useState<ToolbarState | null>(null);$nl  const [notePopover, setNotePopover] = useState<NotePopoverState | null>(null);$nl  const [overlayMetrics, setOverlayMetrics] = useState<OverlayMetrics>({ width: 0, height: 0 });$nl  const [drawPaths, setDrawPaths] = useState<DrawPathData[]>([]);$nl  const [drawRedoStack, setDrawRedoStack] = useState<DrawPathData[]>([]);$nl  const [drawDraft, setDrawDraft] = useState<DrawDraft | null>(null);$nl  const drawingRef = useRef(false);$nl  const renderedHtmlRef = useRef<string>(`"`");$nl$nl  const rawContent"
if ($content.Contains($old1)) { $content = $content.Replace($old1, $new1); Write-Host "Fix 1 applied: new state vars" } else { Write-Host "Fix 1 SKIPPED (not found)" }

# -------- FIX 2: renderedHtmlRef.current sync after renderedHtml useMemo --------
$old2 = "    }, [rawContent]);$nl$nl  const srcDoc = useMemo(() => {"
$new2 = "    }, [rawContent]);$nl  // Keep ref in sync so applyAnnotationsToDocument can reset innerHTML when needed$nl  renderedHtmlRef.current = renderedHtml;$nl$nl  const srcDoc = useMemo(() => {"
if ($content.Contains($old2)) { $content = $content.Replace($old2, $new2); Write-Host "Fix 2 applied: renderedHtmlRef.current sync" } else { Write-Host "Fix 2 SKIPPED (not found - trying alt)" }

# -------- FIX 3a: syncAnnotationsInIframe - add 4th arg --------
$old3a = "    applyAnnotationsToDocument(documentNode, annotations, annotationsOpen);$nl  }, [annotations, annotationsOpen]);$nl$nl  const updateSelectedText"
$new3a = "    applyAnnotationsToDocument(documentNode, annotations, annotationsOpen, renderedHtmlRef.current);$nl  }, [annotations, annotationsOpen]);$nl$nl  const updateSelectedText"
if ($content.Contains($old3a)) { $content = $content.Replace($old3a, $new3a); Write-Host "Fix 3a applied: syncAnnotationsInIframe 4th arg" } else { Write-Host "Fix 3a SKIPPED" }

# -------- FIX 3b: clearSearchHits - add 4th arg --------
$old3b = "    applyAnnotationsToDocument(documentNode, annotations, annotationsOpen);$nl  }, [annotations, annotationsOpen]);$nl$nl  const executeSearch"
$new3b = "    applyAnnotationsToDocument(documentNode, annotations, annotationsOpen, renderedHtmlRef.current);$nl  }, [annotations, annotationsOpen]);$nl$nl  const executeSearch"
if ($content.Contains($old3b)) { $content = $content.Replace($old3b, $new3b); Write-Host "Fix 3b applied: clearSearchHits 4th arg" } else { Write-Host "Fix 3b SKIPPED" }

# -------- FIX 3c: bindIframe - add 4th arg --------
$old3c = "    applyAnnotationsToDocument(documentNode, annotations, annotationsOpen);$nl$nl    documentNode.querySelectorAll<HTMLAnchorElement>(`"a[href]`")"
$new3c = "    applyAnnotationsToDocument(documentNode, annotations, annotationsOpen, renderedHtmlRef.current);$nl$nl    documentNode.querySelectorAll<HTMLAnchorElement>(`"a[href]`")"
if ($content.Contains($old3c)) { $content = $content.Replace($old3c, $new3c); Write-Host "Fix 3c applied: bindIframe 4th arg" } else { Write-Host "Fix 3c SKIPPED" }

# -------- FIX 4: persistAnnotations - fix type --------
$old4 = "    async (nextAnnotations: Annotation[]) => {$nl      setAnnotations(nextAnnotations);$nl      syncAnnotationsInIframe();$nl      await saveAnnotations(notebookId, nextAnnotations).catch"
$new4 = "    async (nextAnnotations: NotebookAnnotation[]) => {$nl      setAnnotations(nextAnnotations);$nl      syncAnnotationsInIframe();$nl      await saveAnnotations(notebookId, nextAnnotations as unknown as StoredAnnotation[]).catch"
if ($content.Contains($old4)) { $content = $content.Replace($old4, $new4); Write-Host "Fix 4 applied: persistAnnotations type" } else { Write-Host "Fix 4 SKIPPED" }

# -------- FIX 5: addAnnotation rewrite --------
$old5start = "  const addAnnotation = useCallback($nl    async (kind: Annotation[`"kind`"], noteText?: string) => {"
$old5end = "    [annotations, persistAnnotations, selectedText]$nl  );"
# find addAnnotation block
$idx5start = $content.IndexOf("  const addAnnotation = useCallback(")
$idx5end = $content.IndexOf("  const removeAnnotation = useCallback(")
if ($idx5start -gt 0 -and $idx5end -gt $idx5start) {
    $addAnnotationBlock = $content.Substring($idx5start, $idx5end - $idx5start)
    $newAddAnnotation = "  const addAnnotation = useCallback($nl    async (type: AnnotationKind, noteText?: string) => {$nl      const iframe = iframeRef.current;$nl      const documentNode = iframe?.contentDocument;$nl      if (!documentNode) return;$nl$nl      // Prefer the pre-serialized snapshot; fall back to current live selection$nl      let snapshot = selectionSnapshot;$nl      if (!snapshot) {$nl        const sel = documentNode.defaultView?.getSelection();$nl        if (!sel || sel.rangeCount === 0 || !selectedText) return;$nl        const liveRange = sel.getRangeAt(0);$nl        const root = getNoteRoot(documentNode);$nl        if (!root) return;$nl        const sr = serializeRange(liveRange, root);$nl        if (!sr) return;$nl        const rect = getSelectionRect(liveRange, iframe);$nl        snapshot = {$nl          serializedRange: sr,$nl          text: selectedText,$nl          rect: rect ?? { left: 0, top: 0, bottom: 0, width: 0, height: 0, centerX: 0 },$nl        };$nl      }$nl$nl      const annotation: NotebookAnnotation = {$nl        id: createMessageId(`"annot`"),$nl        type,$nl        serializedRange: snapshot.serializedRange,$nl        selectedText: snapshot.text,$nl        createdAt: Date.now(),$nl        color: type !== `"draw`" ? ANNOTATION_COLORS[type] : ANNOTATION_COLORS.highlight,$nl        metadata: noteText ? { noteText } : undefined,$nl      };$nl$nl      const nextAnnotations = [annotation, ...annotations];$nl      setAnnotationsOpen(true);$nl      setAnnotationComposerOpen(false);$nl      setAnnotationDraft(`"`");$nl      setSelectionSnapshot(null);$nl      setToolbar(null);$nl      await persistAnnotations(nextAnnotations);$nl      documentNode.defaultView?.getSelection()?.removeAllRanges();$nl    },$nl    [annotations, persistAnnotations, selectedText, selectionSnapshot]$nl  );$nl$nl"
    $content = $content.Replace($addAnnotationBlock, $newAddAnnotation)
    Write-Host "Fix 5 applied: addAnnotation rewrite"
} else { Write-Host "Fix 5 SKIPPED (block not found, start=$idx5start, end=$idx5end)" }

# -------- FIX 6: loadAnnotations - deserializeStoredAnnotations --------
$old6 = "          setAnnotations(storedAnnotations);"
$new6 = "          setAnnotations(deserializeStoredAnnotations(storedAnnotations));"
if ($content.Contains($old6)) { $content = $content.Replace($old6, $new6); Write-Host "Fix 6 applied: loadAnnotations deserialization" } else { Write-Host "Fix 6 SKIPPED" }

# -------- FIX 7: JSX annotation.kind -> annotation.type, annotation.noteText -> annotation.metadata?.noteText --------
$old7a = "                                      {annotation.kind === `"note`" ? `"Note`" : `"Highlight`"}"
$new7a = "                                      {annotation.type === `"note`" ? `"Note`" : `"Highlight`"}"
if ($content.Contains($old7a)) { $content = $content.Replace($old7a, $new7a); Write-Host "Fix 7a applied: annotation.kind -> type" } else { Write-Host "Fix 7a SKIPPED" }

$old7b = "                                    {annotation.noteText ? ($nl                                      <p className=`"text-sm text-muted-foreground`">{annotation.noteText}</p>$nl                                    ) : null}"
$new7b = "                                    {annotation.metadata?.noteText ? ($nl                                      <p className=`"text-sm text-muted-foreground`">{annotation.metadata.noteText}</p>$nl                                    ) : null}"
if ($content.Contains($old7b)) { $content = $content.Replace($old7b, $new7b); Write-Host "Fix 7b applied: annotation.noteText -> metadata.noteText" } else { Write-Host "Fix 7b SKIPPED" }

# -------- FIX 8: InkLayer -> SVG draw overlay --------
$old8 = "                  {inkOpen ? ($nl                    <InkLayer notebookId={notebookId} paperRef={paperRef} className=`"z-20`" />$nl                  ) : null}"
$new8 = "                  {inkOpen ? ($nl                    <svg$nl                      className=`"pointer-events-none absolute inset-0 z-20 h-full w-full`"$nl                      style={{ overflow: `"visible`" }}$nl                      aria-hidden$nl                    >$nl                      {drawPaths.map((path, i) => ($nl                        <path$nl                          key={i}$nl                          d={buildPathFromPoints(path.points, overlayMetrics.width, overlayMetrics.height)}$nl                          stroke={DRAW_STROKE_COLOR}$nl                          strokeWidth={path.strokeWidth}$nl                          fill=`"none`"$nl                          strokeLinecap=`"round`"$nl                          strokeLinejoin=`"round`"$nl                        />$nl                      ))}$nl                      {drawDraft ? ($nl                        <path$nl                          d={buildPathFromPoints(drawDraft.points, overlayMetrics.width, overlayMetrics.height)}$nl                          stroke={DRAW_STROKE_COLOR}$nl                          strokeWidth={DRAW_STROKE_WIDTH}$nl                          fill=`"none`"$nl                          strokeLinecap=`"round`"$nl                          strokeLinejoin=`"round`"$nl                        />$nl                      ) : null}$nl                    </svg>$nl                  ) : null}"
if ($content.Contains($old8)) { $content = $content.Replace($old8, $new8); Write-Host "Fix 8 applied: InkLayer -> SVG draw overlay" } else { Write-Host "Fix 8 SKIPPED" }

Write-Host "Final length: $($content.Length)"
[System.IO.File]::WriteAllText((Resolve-Path $file).Path, $content)
Write-Host "File written."
