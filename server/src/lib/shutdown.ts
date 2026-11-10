/** Graceful shutdown: stop accepting, let requests in flight finish, exit within a drain limit. */

/** The part of a Node http server that `drain` uses. */
interface Closable {
  close(cb?: () => void): unknown;
  closeIdleConnections?(): void;
}

/** Stops accepting, ends event streams via `onClose`, drops idle sockets, exits when requests are done or after `drainMs`. */
export function drain(server: Closable, onClose: () => void, drainMs: number, exit: (code: number) => void = process.exit): void {
  onClose();
  // sockets that turn idle after the first sweep would keep close() waiting for the 5 s keep-alive timeout
  const sweep = setInterval(() => server.closeIdleConnections?.(), 100);
  sweep.unref();
  server.close(() => { clearInterval(sweep); exit(0); });
  server.closeIdleConnections?.();
  setTimeout(() => exit(0), drainMs).unref();
}
