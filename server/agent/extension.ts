import {
  createBashTool,
  createEditTool,
  createReadTool,
  createWriteTool,
  type ExtensionAPI,
  type InlineExtension,
} from '@earendil-works/pi-coding-agent'
import type { VM } from '@earendil-works/gondolin'
import { createBashOps, createEditOps, createReadOps, createWriteOps } from './gondolin-ops.ts'

/**
 * Re-registers pi's built-in read/write/edit/bash tools so they execute inside
 * the gondolin VM instead of on the host. The VM is owned by the control plane
 * and resolved lazily via `getVm()` so a respawned VM is picked up automatically.
 *
 * Fail-closed sandbox boundary: only these four names are registered, and the
 * session allowlist is limited to them. No host-side grep/find/ls exist.
 */
export type SandboxExtensionOpts = {
  getVm: () => Promise<VM>
  cwd: string
  onVmFailure?: () => void
}

export function createSandboxExtension(opts: SandboxExtensionOpts): InlineExtension {
  return {
    name: 'forge-sandbox',
    factory: (pi: ExtensionAPI) => {
      registerRead(pi, opts)
      registerWrite(pi, opts)
      registerEdit(pi, opts)
      registerBash(pi, opts)
    },
  }
}

type Execute = (id: string, params: any, signal?: AbortSignal, onUpdate?: any) => Promise<any>
type VmExecute = (
  vm: VM,
  id: string,
  params: any,
  signal?: AbortSignal,
  onUpdate?: any,
) => Promise<any>

function registerRead(pi: ExtensionAPI, opts: SandboxExtensionOpts): void {
  const base = createReadTool(opts.cwd)
  const execute: VmExecute = (vm, id, params, signal, onUpdate) =>
    createReadTool(opts.cwd, { operations: createReadOps(vm, opts.cwd) }).execute(
      id,
      params,
      signal,
      onUpdate,
    )
  pi.registerTool({ ...base, execute: wrap(opts, execute) } as any)
}

function registerWrite(pi: ExtensionAPI, opts: SandboxExtensionOpts): void {
  const base = createWriteTool(opts.cwd)
  const execute: VmExecute = (vm, id, params, signal, onUpdate) =>
    createWriteTool(opts.cwd, { operations: createWriteOps(vm, opts.cwd) }).execute(
      id,
      params,
      signal,
      onUpdate,
    )
  pi.registerTool({ ...base, execute: wrap(opts, execute) } as any)
}

function registerEdit(pi: ExtensionAPI, opts: SandboxExtensionOpts): void {
  const base = createEditTool(opts.cwd)
  const execute: VmExecute = (vm, id, params, signal, onUpdate) =>
    createEditTool(opts.cwd, { operations: createEditOps(vm, opts.cwd) }).execute(
      id,
      params,
      signal,
      onUpdate,
    )
  pi.registerTool({ ...base, execute: wrap(opts, execute) } as any)
}

function registerBash(pi: ExtensionAPI, opts: SandboxExtensionOpts): void {
  const base = createBashTool(opts.cwd)
  const execute: VmExecute = (vm, id, params, signal, onUpdate) =>
    createBashTool(opts.cwd, { operations: createBashOps(vm, opts.cwd) }).execute(
      id,
      params,
      signal,
      onUpdate,
    )
  pi.registerTool({ ...base, execute: wrap(opts, execute) } as any)
}

/** Resolve the lazily-created VM (auto-starts) and surface VM transport failures. */
function wrap(opts: SandboxExtensionOpts, execute: VmExecute): Execute {
  return async (id, params, signal, onUpdate) => {
    const vm = await opts.getVm()
    try {
      return await execute(vm, id, params, signal, onUpdate)
    } catch (err) {
      if (isVmTransportError(err)) opts.onVmFailure?.()
      throw err
    }
  }
}

function isVmTransportError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err)
  return /(closed|disconnect|eof|aborted|not connected|connection|transport|socket)/i.test(message)
}
