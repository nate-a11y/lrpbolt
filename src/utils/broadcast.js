let chan = null;
let closed = false;

export function getChannel(name = "lrp-sync") {
  if (chan && !closed) return chan;
  try {
    chan = new BroadcastChannel(name);
    closed = false;
    chan.onmessageerror = () => {
      /* ignore */
    };
    return chan;
  } catch {
    /* ignore */
    chan = null;
    closed = true;
    return null;
  }
}

export function safePost(msg, name = "lrp-sync") {
  const c = getChannel(name);
  if (!c || closed) return false;
  try {
    c.postMessage(msg);
    return true;
  } catch {
    /* ignore */
    return false;
  }
}

export function closeChannel() {
  if (chan && !closed) {
    try {
      chan.close();
    } catch {
      /* ignore */
    }
  }
  closed = true;
  chan = null;
}
