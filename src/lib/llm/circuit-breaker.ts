/**
 * Circuit Breaker for LLM API calls.
 *
 * States: CLOSED (normal) → OPEN (blocked) → HALF_OPEN (probing)
 * - Opens after 5 consecutive failures (network/timeout/5xx only)
 * - Stays open for 60s, then allows 1 probe request (HALF_OPEN)
 * - If probe succeeds → CLOSED; if it fails → OPEN again
 *
 * Limitation: state is a module-level singleton, so all concurrent
 * requests in the same Node process share one breaker. In a single-user
 * self-hosted deploy this is fine; in a multi-user managed deploy one
 * user's failures can trip the breaker for everyone on that instance.
 */

type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

const FAILURE_THRESHOLD = 5;
const OPEN_DURATION_MS = 60_000;

let state: CircuitState = 'CLOSED';
let consecutiveFailures = 0;
let openedAt = 0;

/**
 * Check if a request should be allowed through the circuit.
 * Throws immediately if the circuit is OPEN and the cooldown hasn't elapsed.
 */
export function beforeRequest(): void {
  if (state === 'CLOSED') return;

  if (state === 'OPEN') {
    if (Date.now() - openedAt >= OPEN_DURATION_MS) {
      state = 'HALF_OPEN';
      return; // allow 1 probe
    }
    throw new Error(
      'Servicio de IA temporalmente no disponible. Intenta de nuevo en unos segundos.',
    );
  }

  // HALF_OPEN: allow the probe request through
}

/**
 * Record a successful response. Resets the circuit to CLOSED.
 */
export function onSuccess(): void {
  consecutiveFailures = 0;
  state = 'CLOSED';
}

/**
 * Record a failure. Only network/timeout/5xx errors should call this.
 * 4xx errors (bad request, auth) should NOT trip the circuit.
 */
export function onFailure(): void {
  consecutiveFailures++;
  if (consecutiveFailures >= FAILURE_THRESHOLD || state === 'HALF_OPEN') {
    state = 'OPEN';
    openedAt = Date.now();
  }
}

/**
 * Check if an error should trip the circuit breaker.
 * Returns true for network errors, timeouts, and 5xx status codes.
 */
export function isCircuitRelevantError(error: unknown): boolean {
  if (error instanceof DOMException) {
    return error.name === 'TimeoutError' || error.name === 'AbortError';
  }
  if (error instanceof TypeError) {
    // fetch network errors (DNS, connection refused, etc.)
    return true;
  }
  if (error instanceof Error) {
    const match = error.message.match(/\((\d{3})\)/);
    if (match) {
      const status = parseInt(match[1], 10);
      return status >= 500;
    }
  }
  return false;
}

/** Expose state for testing */
export function getCircuitState(): CircuitState {
  return state;
}

/** Reset circuit — for testing only */
export function resetCircuit(): void {
  state = 'CLOSED';
  consecutiveFailures = 0;
  openedAt = 0;
}
