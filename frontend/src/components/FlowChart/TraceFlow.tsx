/**
 * components/FlowChart/TraceFlow.tsx — React Flow root component.
 *
 * Converts CFGNode/CFGEdge from cfgStore into React Flow nodes/edges.
 * Highlights the active node based on traceStore.currentStep.
 *
 * Layout: simple top-to-bottom positioning (no Dagre for now — keeps
 * the dependency count low and works well for linear DSA programs).
 */

import {
  Background,
  Controls,
  ReactFlow,
  type Edge,
  type Node,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useMemo } from "react";
import { useCFGStore } from "../../store/cfgStore";
import { useTraceStore } from "../../store/traceStore";
import type { CFGNode } from "../../types/cfg";
import { BranchNode } from "./nodes/BranchNode";
import { LineNode } from "./nodes/LineNode";
import { LoopNode } from "./nodes/LoopNode";

const NODE_TYPES = {
  line:       LineNode,
  branch:     BranchNode,
  loop:       LoopNode,
  func_start: LineNode,
  func_end:   LineNode,
  func_call:  LineNode,
};

/** Simple vertical layout: each node is 160px tall, 200px wide. */
function layoutNodes(cfgNodes: CFGNode[], activeId: string | null): Node[] {
  return cfgNodes.map((n, i) => ({
    id: n.id,
    type: n.type,
    position: { x: 100, y: i * 80 },
    data: {
      label: n.label,
      lines: n.lines,
      traceIndices: n.trace_indices,
      isActive: n.id === activeId,
    },
  }));
}

export function TraceFlow() {
  const cfgNodes = useCFGStore((s) => s.nodes);
  const cfgEdges = useCFGStore((s) => s.edges);
  const activeNodeId = useCFGStore((s) => s.activeNodeId);
  const currentStep = useTraceStore((s) => s.currentStep);

  // Derive active node from current step
  const activeId = useMemo(() => {
    const node = cfgNodes.find((n) => n.trace_indices.includes(currentStep));
    return node?.id ?? activeNodeId;
  }, [cfgNodes, currentStep, activeNodeId]);

  const flowNodes = useMemo(
    () => layoutNodes(cfgNodes, activeId),
    [cfgNodes, activeId]
  );

  const flowEdges: Edge[] = useMemo(
    () =>
      cfgEdges.map((e) => ({
        id: `${e.source}-${e.target}`,
        source: e.source,
        target: e.target,
        label: e.label || undefined,
        animated: false,
        style: { stroke: "#52525b" },
      })),
    [cfgEdges]
  );

  if (cfgNodes.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-zinc-600 text-sm">
        Run a program to see the control flow graph.
      </div>
    );
  }

  return (
    <ReactFlow
      nodes={flowNodes}
      edges={flowEdges}
      nodeTypes={NODE_TYPES}
      fitView
      fitViewOptions={{ padding: 0.2 }}
      minZoom={0.3}
      maxZoom={2}
      proOptions={{ hideAttribution: true }}
    >
      <Background color="#27272a" gap={16} />
      <Controls showInteractive={false} />
    </ReactFlow>
  );
}
