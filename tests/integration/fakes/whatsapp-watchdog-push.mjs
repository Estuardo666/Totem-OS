let calls = [];

export async function sendPushNotification(input) {
  calls.push(structuredClone(input));
  return { success: true };
}

export function resetPushCalls() {
  calls = [];
}

export function readPushCalls() {
  return structuredClone(calls);
}
