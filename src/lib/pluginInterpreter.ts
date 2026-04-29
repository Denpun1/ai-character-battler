
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
  let currentNodes = startNodeId 
    ? nodes.filter(n => n.id === startNodeId)
    : nodes.filter(n => n.type === 'start' && n.data.triggerType === triggerType);

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
          
          // Merge user's global system instructions with the node's specific prompt
          const combinedSystemPrompt = `${context.systemPrompt || ""}\n\n[Plugin Instruction]\n${nodePrompt}`;

          try {
            const aiResponse = await fetch("/api/battle", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                systemPrompt: combinedSystemPrompt,
                model: model || "gemini-1.5-flash",
                isEpilogue: true, // Use epilogue mode for better formatting
                context: JSON.stringify(context.battleResult)
              }),
            }).then(r => r.json());

            const text = aiResponse.result || "AI Response failed";
            variables[`${node.id}_trigger-out`] = text; // Store result for output
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
          
          window.dispatchEvent(new CustomEvent('plugin:ui:button', {
            detail: { label, slot, posMode, posX, posY, nodeId: node.id }
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
          
          window.dispatchEvent(new CustomEvent('plugin:ui:display', {
            detail: { message, mode, slot, posMode, posX, posY, id: node.id }
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
