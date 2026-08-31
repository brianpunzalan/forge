import { createAgentSession, ModelRuntime, SessionManager, AgentSession } from '@earendil-works/pi-coding-agent'

export const startAgentSession = async () => {
    const modelRuntime = await ModelRuntime.create();

    const { extensionsResult, session, modelFallbackMessage } = await createAgentSession({
        sessionManager: SessionManager.inMemory(),
        modelRuntime,
    })

    return {
        modelRuntime,
        extensionsResult,
        session,
        modelFallbackMessage
    }
}

export type { AgentSession }