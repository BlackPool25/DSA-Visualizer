/**
 * CodeEditor Component
 *
 * Monaco Editor wrapper for C++ code editing.
 * Provides syntax highlighting, auto-layout, line highlighting for traces,
 * and basic editor configuration.
 */

import { useRef, useEffect, useCallback } from "react";
import Editor, { type Monaco } from "@monaco-editor/react";
import type * as monaco from "monaco-editor";

/** Validation marker for displaying errors/warnings */
export interface ValidationMarker {
  /** Line number (1-based) */
  line: number;
  /** Error/warning message */
  message: string;
  /** Severity level */
  severity: "error" | "warning";
}

/** Props for the CodeEditor component */
interface CodeEditorProps {
  /** Current code value */
  value: string;
  /** Callback when code changes */
  onChange: (value: string) => void;
  /** Programming language for syntax highlighting (default: cpp) */
  language?: string;
  /** Whether the editor is read-only */
  readOnly?: boolean;
  /** Line number to highlight (1-based, for trace visualization) */
  highlightLine?: number;
  /** Validation markers to display (compilation errors, etc.) */
  markers?: ValidationMarker[];
}

/**
 * Monaco Editor wrapper for code editing
 *
 * Features:
 * - C++ syntax highlighting
 * - No minimap for cleaner UI
 * - Automatic layout adjustment
 * - Consistent font sizing
 * - Line highlighting for trace visualization
 *
 * @example
 * <CodeEditor
 *   value={code}
 *   onChange={setCode}
 *   language="cpp"
 *   highlightLine={currentTraceLine}
 * />
 */
export function CodeEditor({
  value,
  onChange,
  language = "cpp",
  readOnly = false,
  highlightLine,
  markers = [],
}: CodeEditorProps) {
  // Refs for editor and monaco instances
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<Monaco | null>(null);
  const decorationsRef = useRef<string[]>([]);

  /**
   * Handle editor mount - store refs for decoration updates
   */
  const handleEditorMount = useCallback(
    (editor: monaco.editor.IStandaloneCodeEditor, monaco: Monaco) => {
      editorRef.current = editor;
      monacoRef.current = monaco;
    },
    [],
  );

  /**
   * Update line highlighting decorations when highlightLine changes
   */
  useEffect(() => {
    const editor = editorRef.current;
    const monaco = monacoRef.current;

    if (!editor || !monaco) return;

    // Clear previous decorations
    decorationsRef.current = editor.deltaDecorations(
      decorationsRef.current,
      [],
    );

    // Add new decoration if highlightLine is valid
    if (highlightLine && highlightLine > 0) {
      const newDecorations: monaco.editor.IModelDeltaDecoration[] = [
        {
          range: new monaco.Range(highlightLine, 1, highlightLine, 1),
          options: {
            isWholeLine: true,
            className: "current-line-highlight",
            glyphMarginClassName: "current-line-glyph",
            overviewRuler: {
              color: "rgba(59, 130, 246, 0.5)",
              position: monaco.editor.OverviewRulerLane.Full,
            },
          },
        },
      ];

      decorationsRef.current = editor.deltaDecorations(
        decorationsRef.current,
        newDecorations,
      );

      // Scroll to highlighted line if not visible
      editor.revealLineInCenterIfOutsideViewport(highlightLine);
    }
  }, [highlightLine]);

  /**
   * Update validation markers when they change
   */
  useEffect(() => {
    const editor = editorRef.current;
    const monaco = monacoRef.current;

    if (!editor || !monaco || markers.length === 0) return;

    // Convert markers to Monaco model markers
    const modelMarkers = markers.map((marker) => ({
      startLineNumber: marker.line,
      startColumn: 1,
      endLineNumber: marker.line,
      endColumn: 1000, // Cover entire line
      message: marker.message,
      severity:
        marker.severity === "error"
          ? monaco.MarkerSeverity.Error
          : monaco.MarkerSeverity.Warning,
    }));

    // Set markers on the model
    monaco.editor.setModelMarkers(
      editor.getModel()!,
      "validation",
      modelMarkers,
    );

    // Cleanup function to clear markers when component unmounts or markers change
    return () => {
      monaco.editor.setModelMarkers(editor.getModel()!, "validation", []);
    };
  }, [markers]);

  return (
    <div className="h-full w-full min-h-[400px] border border-gray-200 rounded-lg overflow-hidden">
      {/* Custom CSS for line highlighting */}
      <style>{`
        .current-line-highlight {
          background-color: rgba(59, 130, 246, 0.25) !important;
          border-left: 3px solid #3b82f6 !important;
        }
        .current-line-glyph {
          background-color: #3b82f6;
          margin-left: 3px;
          border-radius: 2px;
        }
        .current-line-glyph::before {
          content: '▶';
          color: white;
          font-size: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          height: 100%;
        }
      `}</style>

      <Editor
        value={value}
        language={language}
        theme="vs-dark"
        onChange={(newValue) => onChange(newValue || "")}
        onMount={handleEditorMount}
        options={{
          // Editor appearance
          fontSize: 14,
          lineNumbers: "on",
          roundedSelection: false,
          scrollBeyondLastLine: false,
          readOnly,

          // Disable minimap for cleaner UI
          minimap: { enabled: false },

          // Automatic layout to handle resizing
          automaticLayout: true,

          // Tab settings for consistent formatting
          tabSize: 2,
          insertSpaces: true,

          // Show whitespace for debugging
          renderWhitespace: "selection",

          // Line wrapping
          wordWrap: "on",

          // Enable glyph margin for line indicators
          glyphMargin: true,
        }}
        loading={
          <div className="h-full w-full flex items-center justify-center bg-gray-900 text-white">
            Loading editor...
          </div>
        }
      />
    </div>
  );
}
