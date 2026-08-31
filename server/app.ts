import { startServer } from './server.ts'
import { startAgentSession, type AgentSession } from './agent-session.ts'

import type { Server } from './server.ts'
import { AppException } from './exceptions/AppException.ts';

export class App {
    private ready: boolean = false;
    private server: Server | null = null;
    private agentSession: AgentSession | null = null;

    constructor() {
        this.ready = false;
    }

    public async init() {
        try {
            this.server = await startServer();
            const { session } = await startAgentSession();
            this.agentSession = session;
            this.ready = true;
        } catch (error) {
            console.error(error);
            throw new AppException("Unable to initialize application");
        }
    }

    public isReady() {
        return this.ready;
    }

    public getServer() {
        return this.server;
    }

    public getAgentSession() {
        return this.agentSession;
    }
}
