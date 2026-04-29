
import { supabase } from "@/lib/supabase";

export interface PluginContext {
  userId: string;
  queueId?: string;
  battleResult?: any;
  systemPrompt?: string;
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
  
  const variables: Record<string, any> = { ...context.variables };

  const resolveData = (nodeId: string, handleId: string, fallback: any) => {
    const edge = edges.find(e => e.target === nodeId && e.targetHandle === `in-${handleId}`);
    if (edge) {
      return variables[`${edge.source}_${edge.sourceHandle}`] ?? fallback;
    }
    return fallback;
  };

  // Find start node(s)
  let currentNodes: any[] = [];
  if (triggerType === 'node_click' && startNodeId) {
    // If it's a click, we start from the CHILDREN of the clicked node
    const nextEdges = edges.filter(e => e.source === startNodeId && e.sourceHandle === "trigger-out");
    currentNodes = nextEdges.map(e => nodes.find(n => n.id === e.target)).filter(Boolean);
    console.log(`[Plugin Interpreter] Resuming flow from node: ${startNodeId}, found ${currentNodes.length} children`);
  } else {
    currentNodes = nodes.filter(n => n.type === 'start' && n.data.triggerType === triggerType);
  }

  if (currentNodes.length === 0) {
    console.log(`[Plugin Interpreter] No nodes found for trigger/id: ${triggerType}/${startNodeId}`);
    return;
  }

  // Use a queue for traversal
  let queue = [...currentNodes];
  let visited = new Set();

  while (queue.length > 0) {
    const node = queue.shift();
    if (!node || visited.has(node.id)) continue;
    visited.add(node.id);

    console.log(`[Interpreter] Processing node: ${node.type} (${node.id})`);

    let nextHandle = "trigger-out";

    // Execute node logic
    switch (node.type) {
      case "start":
        // Start node just passes through
        break;

      case "ai":
        {
          const nodePrompt = resolveData(node.id, "prompt", node.data.prompt);
          const model = node.data.model === 'custom' ? node.data.customModel : node.data.model;
          
          const combinedSystemPrompt = context.systemPrompt 
            ? `${context.systemPrompt}\n\n${nodePrompt}`
            : nodePrompt;

          try {
            const response = await fetch("/api/battle", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                systemPrompt: combinedSystemPrompt,
                model: model || "gemini-1.5-flash",
                playerInfo: "Plugin context: " + JSON.stringify(context.battleResult)
              }),
            });

            if (!response.body) throw new Error("No response body");
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let text = "";
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              text += decoder.decode(value);
            }
            variables[`${node.id}_trigger-out`] = text;
          } catch (e) {
            console.error("AI Node Execution Error:", e);
          }
        }
        break;

      case "button":
        {
          const label = node.data.label || "Next";
          const slot = node.data.slot || "actions";
          const posMode = node.data.posMode || 'slot';
          const posX = node.data.posX || 0;
          const posY = node.data.posY || 0;
          const width = node.data.width || 150;
          const height = node.data.height || 40;
          
          window.dispatchEvent(new CustomEvent('plugin:ui:button', {
            detail: { label, slot, posMode, posX, posY, width, height, nodeId: node.id }
          }));
          
          // Stop this branch and wait for click
          console.log(`[Interpreter] Flow paused at button: ${node.id}`);
          continue; 
        }

      case "log":
        {
          const message = resolveData(node.id, "message", node.data.message);
          const mode = node.data.mode || "box";
          const slot = node.data.slot || "epilogue";
          const posMode = node.data.posMode || 'slot';
          const posX = node.data.posX || 0;
          const posY = node.data.posY || 0;
          const width = node.data.width || 300;
          const height = node.data.height || 100;
          
          window.dispatchEvent(new CustomEvent('plugin:ui:display', {
            detail: { message, mode, slot, posMode, posX, posY, width, height, id: node.id }
          }));
        }
        break;
    }

    // Find next nodes based on the output handle
    const nextEdges = edges.filter(e => e.source === node.id && e.sourceHandle === nextHandle);
    for (const edge of nextEdges) {
      const nextNode = nodes.find(n => n.id === edge.target);
      if (nextNode) {
        queue.push(nextNode);
      }
    }
  }
}
