
import { supabase } from "@/lib/supabase";
import { Node, Edge } from "@xyflow/react";

const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

export interface PluginContext {
  userId: string;
  queueId?: string;
  battleResult?: any; // The result of the main AI battle
  variables: Record<string, any>;
}

export async function runPluginFlow(
  nodes: any[], 
  edges: any[], 
  triggerType: string, 
  context: PluginContext,
  startNodeId?: string
) {
  console.log(`[Plugin Interpreter] Running flow for trigger: ${triggerType}${startNodeId ? ' starting from ' + startNodeId : ''}`);
  
  const nodeDataResults: Record<string, any> = {};

  const variables = { ...context.variables };

  const resolveData = (nodeId: string, handleId: string, fallback: any) => {
    const edge = edges.find(e => e.target === nodeId && e.targetHandle === `in-${handleId}`);
    if (edge) {
      return variables[`${edge.source}_${edge.sourceHandle}`] ?? fallback;
    }
    return fallback;
  };

  // Find start node(s)
  let currentNodes = startNodeId 
    ? nodes.filter(n => n.id === startNodeId)
    : nodes.filter(n => n.type === 'start' && n.data.trigger === triggerType);

  if (currentNodes.length === 0) {
    console.log(`[Plugin Interpreter] No nodes found for trigger/id: ${triggerType}/${startNodeId}`);
    return;
  }

  // Basic BFS/DFS traversal
  let queue = [...currentNodes];
  let visited = new Set();

  while (queue.length > 0) {
    const node = queue.shift();
    if (!node || visited.has(node.id)) continue;
    visited.add(node.id);

    console.log(`[Interpreter] Processing node: ${node.type} (${node.id})`);

    // Execute node logic
    switch (node.type) {
      case "start":
        // Start node just passes through
        break;

      case "ai":
        {
          const prompt = resolveData(node.id, "prompt", node.data.prompt);
          
          // Call internal API for follow-up
          const model = node.data.model === 'custom' ? node.data.customModel : node.data.model;
          
          const aiResponse = await fetch("/api/battle", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              prompt: `${prompt}\n\n[Battle Context]\n${JSON.stringify(context.battleResult)}`,
              model: model || "gemini-1.5-flash",
            }),
          }).then(r => r.json());

          const text = aiResponse.result || "AI Response failed";
          nodeDataResults[node.id] = { text };
        }
        break;

      case "button":
        {
          const label = node.data.label || "Next";
          const slot = node.data.slot || "actions";
          
          // Dispatch button display event
          window.dispatchEvent(new CustomEvent('plugin:ui:button', {
            detail: { label, slot, nodeId: node.id }
          }));
          
          // STOP execution and wait for click
          console.log(`[Interpreter] Paused at button: ${node.id}`);
          return; 
        }

      case "log":
        {
          const message = resolveData(node.id, "message", node.data.message);
          const mode = node.data.mode || "box";
          const slot = node.data.slot || "epilogue";
          
          window.dispatchEvent(new CustomEvent('plugin:ui:display', {
            detail: { message, mode, slot, id: node.id }
          }));
        }
        break;
    }

    const nextEdges = edges.filter(e => e.source === node.id && e.sourceHandle === nextHandle);
    if (nextEdges.length > 0) {
      await Promise.all(nextEdges.map(e => executeNode(e.target)));
    }
  };

  await executeNode(startNode.id);
}
