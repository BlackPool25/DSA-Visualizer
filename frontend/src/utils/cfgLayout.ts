/**
 * utils/cfgLayout.ts — Dagre-based layout for the CFG flowchart.
 *
 * Converts flat CFGNode/CFGEdge arrays into positioned React Flow nodes.
 * Uses @dagrejs/dagre for hierarchical top-down layout so branch nodes
 * visually fork and loop back-edges curve back up.
 *
 * Node sizing:
 *   - All nodes: 180px wide × 50px tall (compact for DSA programs)
 *   - Branch nodes: 200px wide (longer condition text)
 */

import dagre from "@dagrejs/dagre";
import type { Edge, Node } from "@xyflow/react";
import type { CFGEdge, CFGNode } from "../types/cfg";

const NODE_WIDTH = 180;
const NODE_HEIGHT = 50;
const BRANCH_WIDTH = 220;

export function layoutCFG(
  cfgNodes: CFGNode[],
  cfgEdges: CFGEdge[],
  activeId: string | null
): { nodes: Node[]; edges: Edge[] } {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({
    rankdir: "TB",   // top-to-bottom
    nodesep: 40,     // horizontal gap between nodes at same rank
    ranksep: 60,     // vertical gap between ranks
    edgesep: 20,
  });

  // Add nodes to dagre
  for (const n of cfgNodes) {
    const w = n.type === "branch" ? BRANCH_WIDTH : NODE_WIDTH;
    g.setNode(n.id, { width: w, height: NODE_HEIGHT });
  }

  // Add edges to dagre
  for (const e of cfgEdges) {
    g.setEdge(e.source, e.target);
  }

  dagre.layout(g);

  // Convert dagre positions to React Flow nodes
  const nodes: Node[] = cfgNodes.map((n) => {
    const pos = g.node(n.id);
    const w = n.type === "branch" ? BRANCH_WIDTH : NODE_WIDTH;
    return {
      id: n.id,
      type: n.type,
      // Dagre gives center position; React Flow wants top-left
      position: { x: pos.x - w / 2, y: pos.y - NODE_HEIGHT / 2 },
      data: {
        label: n.label,
        lines: n.lines,
        traceIndices: n.trace_indices,
        isActive: n.id === activeId,
        children: n.children,
      },
    };
  });

  // Convert edges with animated style for active path
  const edges: Edge[] = cfgEdges.map((e) => ({
    id: `${e.source}-${e.target}`,
    source: e.source,
    target: e.target,
    label: e.label || undefined,
    type: "trace",          // our custom animated edge
    animated: false,
    style: { stroke: "#52525b", strokeWidth: 1.5 },
    labelStyle: { fill: "#a1a1aa", fontSize: 10 },
    labelBgStyle: { fill: "#18181b" },
  }));

  return { nodes, edges };
}
