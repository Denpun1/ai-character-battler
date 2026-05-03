
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
  const logToUI = (msg: string) => {
    window.dispatchEvent(new CustomEvent('plugin:ui:display', {
      detail: { message: `[Mod Engine] ${msg}`, mode: 'plain', slot: 'sidebar', posMode: 'slot' }
    }));
  };

  logToUI(`Mod triggered: ${triggerType}`);

  const variables: Record<string, any> = { ...context.variables };

  const resolveData = (nodeId: string, handleId: string, fallback: any) => {
    const edge = edges.find(e => e.target === nodeId && e.targetHandle === `in-${handleId}`);
    if (edge) {
      return variables[`${edge.source}_${edge.sourceHandle}`] ?? fallback;
    }
    return fallback;
  };

  // 1. Find Start Nodes
  let currentNodes: any[] = [];
  if (triggerType === 'node_click' && startNodeId) {
    const nextEdges = edges.filter(e => e.source === startNodeId);
    currentNodes = nextEdges.map(e => nodes.find(n => n.id === e.target)).filter(Boolean);
  } else {
    currentNodes = nodes.filter(n => 
      n.type === 'start' && 
      (n.data.triggerType === triggerType || (!n.data.triggerType && triggerType === 'start'))
    );
  }

  if (currentNodes.length === 0) {
    console.log(`[Plugin Interpreter] No nodes found for trigger: ${triggerType}`);
    return;
  }

  logToUI(`Found ${currentNodes.length} start node(s). Executing flow...`);

  // 2. Traversal
  let queue = [...currentNodes];
  let visited = new Set();

  while (queue.length > 0) {
    const node = queue.shift();
    if (!node || visited.has(node.id)) continue;
    visited.add(node.id);

    logToUI(`Executing Node: ${node.type} (${node.id})`);

    let paused = false;

    try {
      switch (node.type) {
        case "start":
          break;

        case "ai":
          {
            const nodePrompt = resolveData(node.id, "prompt", node.data.prompt || "No prompt provided");
            const model = node.data.model === 'custom' ? node.data.customModel : node.data.model;
            
            logToUI(`AI Node generating text with model: ${model || 'default'}`);

            const combinedSystemPrompt = context.systemPrompt 
              ? `${context.systemPrompt}\n\n${nodePrompt}`
              : nodePrompt;

            const response = await fetch("/api/battle", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                systemPrompt: combinedSystemPrompt,
                model: model || "gemini-1.5-flash",
                playerInfo: "Plugin Context:\n" + JSON.stringify(context.battleResult || "No battle result yet")
              }),
            });

            if (!response.ok) throw new Error(`API returned ${response.status}`);
            if (!response.body) throw new Error("No response body");

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let text = "";
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              text += decoder.decode(value);
            }
            
            variables[`${node.id}_out-text`] = text;
            logToUI(`AI Node finished generation (${text.length} chars)`);
          }
          break;

        case "button":
          {
            const label = node.data.label || "Next";
            window.dispatchEvent(new CustomEvent('plugin:ui:button', {
              detail: { 
                label, 
                slot: node.data.slot || "actions", 
                posMode: node.data.posMode || 'slot', 
                posX: node.data.posX || 0, 
                posY: node.data.posY || 0, 
                width: node.data.width || 150, 
                height: node.data.height || 40, 
                nodeId: node.id 
              }
            }));
            
            paused = true;
            logToUI(`Flow paused, waiting for user click on button: [${label}]`);
          }
          break;

        case "log":
          {
            const message = resolveData(node.id, "message", node.data.message || "Empty log message");
            window.dispatchEvent(new CustomEvent('plugin:ui:display', {
              detail: { 
                message, 
                mode: node.data.mode || "box", 
                slot: node.data.slot || "battle", 
                posMode: node.data.posMode || 'slot', 
                posX: node.data.posX || 0, 
                posY: node.data.posY || 0, 
                width: node.data.width || 300, 
                height: node.data.height || 100, 
                id: node.id 
              }
            }));
          }
          break;
      }
    } catch (err: any) {
      logToUI(`ERROR at node ${node.type}: ${err.message}`);
      console.error(err);
    }

    if (paused) continue;

    // 3. Find next nodes using ANY outgoing edge from this node
    // This makes it foolproof even if the user connected the wrong output handle.
    const nextEdges = edges.filter(e => e.source === node.id);
    for (const edge of nextEdges) {
      const nextNode = nodes.find(n => n.id === edge.target);
      if (nextNode && !visited.has(nextNode.id)) {
        queue.push(nextNode);
      }
    }
  }
  
  logToUI(`Mod flow execution completed.`);
}
