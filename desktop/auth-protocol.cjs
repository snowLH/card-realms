"use strict";

function isAuthCallback(raw) {
  if (typeof raw !== "string" || raw.length > 4096) return false;
  try {
    const url = new URL(raw);
    return url.protocol === "folklard:" && url.hostname === "auth" && url.pathname === "/callback"
      && !url.username && !url.password && !url.port;
  } catch { return false; }
}

/** Queue only the latest callback, in memory, until the trusted renderer subscribes. */
function createAuthMailbox() {
  let pending = null;
  let receiver = null;
  return {
    accept(url) {
      if (!isAuthCallback(url)) return false;
      if (receiver) receiver(url); else pending = url;
      return true;
    },
    subscribe(next) {
      receiver = next;
      if (pending) { const url = pending; pending = null; receiver(url); }
    },
    disconnect() { receiver = null; },
  };
}

function findAuthCallback(args) { return args.find(isAuthCallback); }
module.exports = { isAuthCallback, createAuthMailbox, findAuthCallback };
