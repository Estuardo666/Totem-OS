let calls = [];

export const pusherServer = {
  async trigger(channel, event, data) {
    calls.push({ channel, event, data });
    return { ok: true };
  },
};

export function resetPusherCalls() {
  calls = [];
}

export function readPusherCalls() {
  return structuredClone(calls);
}
