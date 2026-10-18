import type { AgentSessionEvent } from '@earendil-works/pi-coding-agent'

/** Event types that are purely streaming projections and must not be persisted. */
const STREAMING_TYPES = new Set(['message_update', 'tool_execution_update'])

export function isAuthoritativeEvent(event: AgentSessionEvent): boolean {
  return !STREAMING_TYPES.has(event.type)
}

/**
 * Remove fields that are redundant or too large for the wire/persistence.
 * Currently strips the unified `patch` from edit results (the TUI `diff` is kept).
 */
export function sanitizeEvent(event: AgentSessionEvent): AgentSessionEvent {
  if (event.type === 'tool_execution_end') {
    const result = event.result as { details?: { patch?: unknown } } | undefined
    if (result?.details && 'patch' in result.details) {
      const { patch: _patch, ...rest } = result.details as { patch: unknown }
      return { ...event, result: { ...result, details: rest } } as AgentSessionEvent
    }
  }
  return event
}

/** Event envelope that crosses the SSE boundary (and the durable replay). */
export type WireEvent =
  | { seq: number; kind: 'agent'; event: AgentSessionEvent }
  | { seq: number; kind: 'control'; type: string; data?: unknown }
