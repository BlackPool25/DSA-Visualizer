/**
 * components/Editor/CodeEditor.tsx — Monaco editor wrapper.
 *
 * Highlights the current trace line with a yellow gutter marker.
 * Reads code from uiStore, writes back on change.
 */

import Editor, { type Monaco } from "@monaco-editor/react";
import type { editor } from "monaco-editor";
import { useEffect, useRef } from "react";
import { useTraceStore } from "../../store/traceStore";
import { useUIStore } from "../../store/uiStore";

export function CodeEditor() {
  const code = useUIStore((s) => s.code);
  const setCode = useUIStore((s) => s.setCode);
  const currentEvent = useTraceStore((s) => s.currentEvent);
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const decorationsRef = useRef<editor.IEditorDecorationsCollection | null>(null);

  // Highlight the current trace line
  useEffect(() => {
    const ed = editorRef.current;
    if (!ed) return;

    if (decorationsRef.current) {
      decorationsRef.current.clear();
    }

    if (currentEvent) {
      decorationsRef.current = ed.createDecorationsCollection([
        {
          range: {
            startLineNumber: currentEvent.line,
            startColumn: 1,
            endLineNumber: currentEvent.line,
            endColumn: 1,
          },
          options: {
            isWholeLine: true,
            className: "current-line-highlight",
            glyphMarginClassName: "current-line-glyph",
          },
        },
      ]);
      // Scroll to the highlighted line
      ed.revealLineInCenterIfOutsideViewport(currentEvent.line);
    }
  }, [currentEvent]);

  function handleMount(ed: editor.IStandaloneCodeEditor, _monaco: Monaco) {
    editorRef.current = ed;
  }

  return (
    <Editor
      height="100%"
      language="cpp"
      theme="vs-dark"
      value={code}
      onChange={(v) => setCode(v ?? "")}
      onMount={handleMount}
      options={{
        fontSize: 13,
        minimap: { enabled: false },
        scrollBeyondLastLine: false,
        glyphMargin: true,
        lineNumbers: "on",
        wordWrap: "on",
      }}
    />
  );
}
