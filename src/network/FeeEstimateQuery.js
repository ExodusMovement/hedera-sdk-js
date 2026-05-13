import { Transaction as ProtoTransaction } from "@exodus/hashgraph-proto";

import FeeEstimateMode from "./FeeEstimateMode.js";

/**
 * @typedef {import("../client/Client.js").default<*, *>} Client
 * @typedef {import("../transaction/Transaction.js").default} Transaction
 */

/**
 * @typedef {object} FetchResponse
 * @property {boolean} ok
 * @property {number} status
 * @property {() => Promise<unknown>} json
 * @property {() => Promise<string>} [text]
 */

/**
 * @typedef {(input: string, init?: object) => Promise<FetchResponse>} FetchImpl
 */

/**
 * @returns {FetchImpl | null}
 */
function defaultFetch() {
    // eslint-disable-next-line no-undef, node/no-unsupported-features/es-builtins
    const g = typeof globalThis !== "undefined" ? globalThis : null;
    if (g != null && typeof g.fetch === "function") {
        return /** @type {FetchImpl} */ (g.fetch.bind(g));
    }
    return null;
}

/**
 * Maximum value (basis points) for the high-volume throttle utilization.
 * 10000 = 100%. Mirrors upstream HIP-1261.
 */
const HIGH_VOLUME_THROTTLE_MAX_BPS = 10000;

const MAX_ATTEMPTS = 5;
const INITIAL_BACKOFF_MS = 250;
const MAX_BACKOFF_MS = 8000;
const REQUEST_TIMEOUT_MS = 15000;

const FEES_PATH = "/network/fees";

/**
 * Query the mirror node REST API for an estimated fee for a transaction
 * before submitting it to consensus nodes.
 *
 * Backports the public surface of upstream `hiero-ledger/hiero-sdk-js`'s
 * `FeeEstimateQuery` (HIP-1261 / PR #3478) to this fork. Only the
 * single-chunk transaction case is supported here; multi-chunk transactions
 * fail fast so callers can fall back to static fees instead of receiving an
 * under-estimated first-chunk-only value.
 *
 * Usage:
 *
 * ```js
 * const fee = await new FeeEstimateQuery()
 *     .setTransaction(tx)
 *     .execute(client);
 * // fee is a number of tinybars; callers can wrap with Hbar.fromTinybars().
 * ```
 *
 * The mirror REST URL must be configured on the client via
 * `client.setMirrorRestApiBaseUrl(...)`. If unconfigured, the request fails
 * fast so callers can fall back to a static fee schedule.
 */
export default class FeeEstimateQuery {
    /**
     * @param {object} [props]
     * @param {Transaction} [props.transaction]
     * @param {number} [props.mode]
     * @param {number} [props.highVolumeThrottle]
 * @param {FetchImpl} [props.fetch]
     *   Optional `fetch` impl. Defaults to `globalThis.fetch`. Tests can
     *   inject a stub here to avoid touching the network.
 * @param {number} [props.requestTimeoutMs] Optional per-attempt timeout
 *   override. Intended for tests.
     */
    constructor(props = {}) {
        /** @type {?Transaction} */
        this._transaction = null;
        /** @type {number} */
        this._mode = FeeEstimateMode.INTRINSIC;
        /** @type {number} */
        this._highVolumeThrottle = 0;
        /** @type {FetchImpl | null} */
        this._fetch =
            typeof props.fetch === "function"
                ? /** @type {FetchImpl} */ (props.fetch)
                : defaultFetch();
        /** @type {number} */
        this._requestTimeoutMs =
            typeof props.requestTimeoutMs === "number"
                ? props.requestTimeoutMs
                : REQUEST_TIMEOUT_MS;

        if (props.transaction != null) {
            this.setTransaction(props.transaction);
        }
        if (props.mode != null) {
            this.setMode(props.mode);
        }
        if (props.highVolumeThrottle != null) {
            this.setHighVolumeThrottle(props.highVolumeThrottle);
        }
    }

    /**
     * @returns {?Transaction}
     */
    get transaction() {
        return this._transaction;
    }

    /**
     * @param {Transaction} transaction
     * @returns {this}
     */
    setTransaction(transaction) {
        if (transaction == null) {
            throw new TypeError(
                "FeeEstimateQuery.setTransaction: transaction is required"
            );
        }
        this._transaction = transaction;
        return this;
    }

    /**
     * @returns {number}
     */
    get mode() {
        return this._mode;
    }

    /**
     * @param {number} mode
     * @returns {this}
     */
    setMode(mode) {
        const value = Number(mode);
        const validValues = Object.values(FeeEstimateMode).map(Number);
        if (!validValues.includes(value)) {
            throw new RangeError(
                `FeeEstimateQuery.setMode: invalid mode ${String(mode)}. ` +
                    `Must be one of FeeEstimateMode.INTRINSIC or FeeEstimateMode.STATE.`
            );
        }
        this._mode = value;
        return this;
    }

    /**
     * @returns {number}
     */
    get highVolumeThrottle() {
        return this._highVolumeThrottle;
    }

    /**
     * @param {number} throttle Basis points (0–10000).
     * @returns {this}
     */
    setHighVolumeThrottle(throttle) {
        const value = Number(throttle);
        if (
            !Number.isInteger(value) ||
            value < 0 ||
            value > HIGH_VOLUME_THROTTLE_MAX_BPS
        ) {
            throw new RangeError(
                `FeeEstimateQuery.setHighVolumeThrottle: ${String(throttle)} ` +
                    `must be an integer in [0, ${HIGH_VOLUME_THROTTLE_MAX_BPS}].`
            );
        }
        this._highVolumeThrottle = value;
        return this;
    }

    /**
     * @param {Client} client
     * @returns {Promise<number>} Total estimated fee in tinybars.
     */
    async execute(client) {
        if (this._fetch == null) {
            throw new Error(
                "FeeEstimateQuery: a fetch implementation is required " +
                    "(globalThis.fetch is not available in this environment)"
            );
        }
        if (this._transaction == null) {
            throw new Error(
                "FeeEstimateQuery: setTransaction() must be called before execute()"
            );
        }
        if (
            client == null ||
            typeof client.mirrorRestApiBaseUrl !== "string" ||
            client.mirrorRestApiBaseUrl.length === 0
        ) {
            throw new Error(
                "FeeEstimateQuery: client.setMirrorRestApiBaseUrl(...) " +
                    "must be configured on the client"
            );
        }

        const tx = this._transaction;
        if (typeof tx.isFrozen === "function" && !tx.isFrozen()) {
            // HIP-1261: auto-freeze if not already frozen.
            tx.freezeWith(client);
        }
        const txWithChunks = /** @type {{ getRequiredChunks?: () => number }} */ (
            tx
        );
        const getRequiredChunks = txWithChunks.getRequiredChunks;
        if (typeof getRequiredChunks === "function" && getRequiredChunks() > 1) {
            throw new Error(
                "FeeEstimateQuery: multi-chunk transactions are not supported"
            );
        }
        await tx._buildAllTransactionsAsync();

        const built = tx._transactions[0];
        if (built == null) {
            throw new Error(
                "FeeEstimateQuery: transaction has no built representation"
            );
        }

        const buffer = ProtoTransaction.encode(built).finish();
        const url = this._buildUrl(client);

        const data = await this._postWithRetry(url, buffer);
        return parseTotalTinybars(data);
    }

    /**
     * @private
     * @param {Client} client
     * @returns {string}
     */
    _buildUrl(client) {
        const baseUrl = String(client.mirrorRestApiBaseUrl);
        const modeParam =
            this._mode === FeeEstimateMode.STATE ? "STATE" : "INTRINSIC";
        let query = `mode=${modeParam}`;
        if (this._highVolumeThrottle > 0) {
            query += `&high_volume_throttle=${this._highVolumeThrottle}`;
        }
        return `${baseUrl}${FEES_PATH}?${query}`;
    }

    /**
     * @private
     * @param {string} url
     * @param {Uint8Array} body
     * @returns {Promise<unknown>}
     */
    async _postWithRetry(url, body) {
        const fetchImpl = /** @type {FetchImpl} */ (this._fetch);
        /** @type {Error | null} */
        let lastError = null;
        let backoff = INITIAL_BACKOFF_MS;

        for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
            /** @type {FetchResponse} */
            let response;
            try {
                response = await withTimeout(
                    fetchImpl(url, {
                        method: "POST",
                        headers: { "Content-Type": "application/protobuf" },
                        body,
                    }),
                    this._requestTimeoutMs
                );
            } catch (err) {
                lastError =
                    err instanceof Error ? err : new Error(String(err));
                if (attempt < MAX_ATTEMPTS && isRetryableNetworkError(err)) {
                    await sleep(backoff);
                    backoff = Math.min(backoff * 2, MAX_BACKOFF_MS);
                    continue;
                }
                throw lastError;
            }

            if (response.ok) {
                return response.json();
            }

            const detail = await readErrorDetail(response);
            const status = response.status;

            if (status === 400) {
                throw new Error(
                    `FeeEstimateQuery: HTTP 400${
                        detail.length > 0 ? `: ${detail}` : ""
                    }`
                );
            }
            if (status === 500 || status === 503 || status === 504) {
                lastError = new Error(
                    `FeeEstimateQuery: HTTP ${status}${
                        detail.length > 0 ? `: ${detail}` : ""
                    }`
                );
                if (attempt < MAX_ATTEMPTS) {
                    await sleep(backoff);
                    backoff = Math.min(backoff * 2, MAX_BACKOFF_MS);
                    continue;
                }
                throw lastError;
            }

            throw new Error(
                `FeeEstimateQuery: HTTP ${status}${
                    detail.length > 0 ? `: ${detail}` : ""
                }`
            );
        }

        throw lastError != null
            ? lastError
            : new Error("FeeEstimateQuery: estimation failed");
    }
}

/**
 * @typedef {object} FeeEstimateResponseJSON
 * @property {number | string} [total]
 */

/**
 * @param {unknown} data
 * @returns {number}
 */
function parseTotalTinybars(data) {
    if (data == null || typeof data !== "object") {
        throw new Error("FeeEstimateQuery: empty response from mirror node");
    }
    const json = /** @type {FeeEstimateResponseJSON} */ (data);
    const value = json.total;
    if (typeof value === "number" && Number.isFinite(value)) {
        return value;
    }
    if (typeof value === "string" && value.length > 0) {
        const parsed = Number(value);
        if (Number.isFinite(parsed)) {
            return parsed;
        }
    }
    throw new Error(
        "FeeEstimateQuery: response is missing a numeric `total` field"
    );
}

/**
 * @param {number} ms
 * @returns {Promise<void>}
 */
function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * @template T
 * @param {Promise<T>} promise
 * @param {number} ms
 * @returns {Promise<T>}
 */
function withTimeout(promise, ms) {
    /** @type {ReturnType<typeof setTimeout>} */
    let timeoutId;
    /** @type {Promise<never>} */
    const timeout = new Promise((_, reject) => {
        timeoutId = setTimeout(() => {
            reject(new Error(`request timed out after ${ms}ms`));
        }, ms);
    });

    const raced = /** @type {Promise<T>} */ (Promise.race([promise, timeout]));
    return raced.finally(() => {
        clearTimeout(timeoutId);
    });
}

/**
 * @param {*} err
 * @returns {boolean}
 */
function isRetryableNetworkError(err) {
    if (!(err instanceof Error)) return false;
    const name = err.name || "";
    const message = err.message || "";
    if (name === "AbortError" || name === "TimeoutError") return true;
    if (/^FeeEstimateQuery: HTTP 5\d\d/.test(message)) return true;
    return /timeout|timed out|network|fetch failed|ECONN|ENETUNREACH/i.test(
        message
    );
}

/**
 * @typedef {object} MirrorErrorMessage
 * @property {string} [message]
 * @property {string} [detail]
 */

/**
 * @typedef {object} MirrorErrorEnvelope
 * @property {{ messages?: MirrorErrorMessage[] }} [_status]
 */

/**
 * Read a short, human-readable error detail from the mirror node response.
 * Mirror node REST errors are typically JSON of the form
 * `{"_status":{"messages":[{"message":"...","detail":"..."}]}}`. Plain text
 * responses are also handled. Returns an empty string if the body is empty
 * or unreadable.
 *
 * @param {FetchResponse} response
 * @returns {Promise<string>}
 */
async function readErrorDetail(response) {
    try {
        if (typeof response.text !== "function") return "";
        const text = await response.text();
        if (!text) return "";
        try {
            const raw = /** @type {unknown} */ (JSON.parse(text));
            const parsed = /** @type {MirrorErrorEnvelope} */ (raw);
            const messages =
                parsed._status != null &&
                Array.isArray(parsed._status.messages)
                    ? parsed._status.messages
                    : null;
            const first = messages != null ? messages[0] : null;
            const detail =
                first != null && typeof first.detail === "string"
                    ? first.detail
                    : "";
            const message =
                first != null && typeof first.message === "string"
                    ? first.message
                    : "";
            if (detail.length > 0) {
                return message.length > 0 ? `${message}: ${detail}` : detail;
            }
            if (message.length > 0) {
                return message;
            }
        } catch (_) {
            // not JSON — fall through to the raw text
        }
        return text.slice(0, 500);
    } catch (_) {
        return "";
    }
}
