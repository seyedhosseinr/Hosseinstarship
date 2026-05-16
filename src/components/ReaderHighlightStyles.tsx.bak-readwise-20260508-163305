"use client";

const CSS = `
@supports selector(::highlight(x)) {
  ::highlight(rdr-hl-DFFF4F) { background-color: #DFFF4F; color: inherit; }
  ::highlight(rdr-hl-B8F36B) { background-color: #B8F36B; color: inherit; }
  ::highlight(rdr-hl-98F0FF) { background-color: #98F0FF; color: inherit; }
  ::highlight(rdr-hl-F7A8D7) { background-color: #F7A8D7; color: inherit; }
  ::highlight(rdr-hl-F7BE62) { background-color: #F7BE62; color: inherit; }
  ::highlight(rdr-hl-default) { background-color: #DFFF4F; color: inherit; }
  ::highlight(rdr-ul) {
    text-decoration-line: underline;
    text-decoration-style: solid;
    text-decoration-thickness: 2px;
    text-underline-offset: 0.18em;
    text-decoration-color: color-mix(in oklab, hsl(var(--primary)) 65%, transparent);
  }
}
`;

export default function ReaderHighlightStyles() {
  return <style dangerouslySetInnerHTML={{ __html: CSS }} />;
}
