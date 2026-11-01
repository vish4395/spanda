import type { IpcChannel, IpcRequest, IpcResponse, StudioApi } from '@studio/contracts/ipc';

declare global {
  interface Window {
    studio: StudioApi;
  }
}

/** Typed wrapper over the preload bridge. Errors arrive as rejected promises with safe messages. */
export function call<C extends IpcChannel>(channel: C, ...args: IpcRequest<C> extends void ? [] : [IpcRequest<C>]): Promise<IpcResponse<C>> {
  return window.studio.invoke(channel, ...args);
}
