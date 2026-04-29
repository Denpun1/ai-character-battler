
import { supabase } from "@/lib/supabase";
import { Node, Edge } from "@xyflow/react";

const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

export interface PluginContext {
  userId: string;
  queueId?: string;
  battleResult?: any; // The result of the main AI battle
  variables: Record<string, any>;
}

export async function runPluginFlow(nodes: Node[], edges: Edge[], triggerType: string, context: PluginContext) {
  const startNode = nodes.find(n => n.type === 'start' && n.data?.triggerType === triggerType);
  if (!startNode) return;

  const variables = { ...context.variables };

  const resolveData = (nodeId: string, handleId: string, fallback: any) => {
    const edge = edges.find(e => e.target === nodeId && e.targetHandle === `in-${handleId}`);
    if (edge) {
      return variables[`${edge.source}_${edge.sourceHandle}`] ?? fallback;
    }
    return fallback;
  };

  const executeNode = async (nodeId: string): Promise<void> => {
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return;

    let nextHandle = "trigger-out";

    switch (node.type) {
      case "start":
        await delay(100);
        break;

      case "ai":
        {
          const prompt = resolveData(node.id, "prompt", node.data.prompt);
          const model = node.data.model === 'default' ? undefined : node.data.model;
          
          // Call internal API for follow-up
          try {
            const res = await fetch('/api/battle', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                isEpilogue: true,
                context: context.battleResult?.log_text || "",
                systemPrompt: prompt,
                model: model,
                players: context.battleResult?.participants || []
              })
            });
            
            if (res.ok) {
              const text = await res.text();
              variables[`${node.id}_out-text`] = text;
            }
          } catch (e) {
            console.error("AI Node Error:", e);
          }
        }
        break;

      case "log":
        {
          const message = resolveData(node.id, "message", node.data.message);
          const mode = node.data.mode || "sidebar";
          
          // Dispatch UI event to Battle page
          window.dispatchEvent(new CustomEvent('plugin:ui:display', {
            detail: { message, mode, id: node.id }
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
