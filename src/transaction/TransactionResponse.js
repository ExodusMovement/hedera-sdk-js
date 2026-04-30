import ReceiptStatusError from "../ReceiptStatusError.js";
import Status from "../Status.js";
import TransactionReceiptQuery from "./TransactionReceiptQuery.js";
import TransactionRecordQuery from "./TransactionRecordQuery.js";

/**
 * @typedef {import("../client/Client.js").default<*, *>} Client
 * @typedef {import("../account/AccountId.js").default} AccountId
 * @typedef {import("./TransactionId.js").default} TransactionId
 * @typedef {import("./TransactionReceipt.js").default} TransactionReceipt
 * @typedef {import("./TransactionRecord.js").default} TransactionRecord
 */

/**
 * Build a node id list that puts the broadcast node first and adds healthy
 * fallback nodes from the network. Executable.execute() will iterate through
 * the list, preferring healthy candidates, so receipt queries no longer fail
 * just because the broadcast node became transiently unavailable.
 *
 * @param {Client} client
 * @param {AccountId} broadcastNodeId
 * @returns {AccountId[]}
 */
function buildReceiptNodeIds(client, broadcastNodeId) {
    const ids = [broadcastNodeId];
    // eslint-disable-next-line ie11/no-collection-args
    const seen = new Set();
    seen.add(broadcastNodeId.toString());

    if (
        client != null &&
        client._network != null &&
        typeof client._network.getNodeAccountIdsForExecute === "function"
    ) {
        try {
            const fallbacks = client._network.getNodeAccountIdsForExecute();
            for (const candidate of fallbacks) {
                const key = candidate.toString();
                if (seen.has(key)) {
                    continue;
                }
                seen.add(key);
                ids.push(candidate);
            }
        } catch (_) {
            // If the network has not been initialised yet, fall back to the
            // original single-node behaviour rather than failing the lookup.
        }
    }

    return ids;
}

export default class TransactionResponse {
    /**
     * @internal
     * @param {object} props
     * @param {AccountId} props.nodeId
     * @param {Uint8Array} props.transactionHash
     * @param {TransactionId} props.transactionId
     */
    constructor(props) {
        /** @readonly */
        this.nodeId = props.nodeId;

        /** @readonly */
        this.transactionHash = props.transactionHash;

        /** @readonly */
        this.transactionId = props.transactionId;

        Object.freeze(this);
    }

    /**
     * @param {Client} client
     * @returns {Promise<TransactionReceipt>}
     */
    async getReceipt(client) {
        const nodeIds = buildReceiptNodeIds(client, this.nodeId);
        const receipt = await new TransactionReceiptQuery()
            .setTransactionId(this.transactionId)
            .setNodeAccountIds(nodeIds)
            .execute(client);

        if (receipt.status !== Status.Success) {
            throw new ReceiptStatusError({
                transactionReceipt: receipt,
                status: receipt.status,
                transactionId: this.transactionId,
            });
        }

        return receipt;
    }

    /**
     * @param {Client} client
     * @returns {Promise<TransactionRecord>}
     */
    async getRecord(client) {
        await this.getReceipt(client);

        const nodeIds = buildReceiptNodeIds(client, this.nodeId);
        return new TransactionRecordQuery()
            .setTransactionId(this.transactionId)
            .setNodeAccountIds(nodeIds)
            .execute(client);
    }
}
