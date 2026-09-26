import {
  createAgentSession as __createAgentSession,
  ModelRuntime,
  SessionManager,
  AgentSession,
  type CreateAgentSessionResult,
} from '@earendil-works/pi-coding-agent'

export const createAgentSession = async () => {
  const modelRuntime = await ModelRuntime.create()

  const { extensionsResult, session, modelFallbackMessage } =
    await __createAgentSession({
      sessionManager: SessionManager.inMemory(),
      modelRuntime,
    })

  return {
    extensionsResult,
    session,
    modelFallbackMessage,
  }
}

export type { AgentSession, CreateAgentSessionResult }
