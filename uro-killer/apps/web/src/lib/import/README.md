# Import Module - Dependency Notes

## Required (already installed)
- `fuse.js` - Fuzzy search for command palette

## Optional Dependencies

### For real PDF parsing:
```bash
npm install pdfjs-dist

### For real OCR (image to text):
bash
npm install tesseract.js

### For real-time voice (already uses Web Speech API - no install needed)
Web Speech API is built into Chrome, Edge, and Safari.
Firefox has limited support.

## Supported Import Formats

| Format | Extension | Parser | Notes |
|--------|-----------|--------|-------|
| JSON | .json | Built-in | Anki export, custom {front, back} arrays |
| CSV | .csv | Built-in | Header detection (front/back/question/answer) |
| HTML | .html/.htm | Built-in | Tables, definition lists, heading+paragraph |
| Plain Text | .txt | Built-in | Q:/A: format, tab-separated, double-newline |
| PDF | .pdf | pdfjs-dist | Falls back to mock if not installed |
| Image | .png/.jpg/etc | tesseract.js | Falls back to mock if not installed |