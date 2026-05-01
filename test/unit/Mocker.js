import { PrivateKey } from "../src/exports.js";
import Client from "../src/client/WebClient.js";
import http from "http";
import { Response as ProtoResponse, TransactionResponse } from "@exodus/hashgraph-proto";

/**
 * @template {*} RequestType
 * @template {*} ResponseType
 * @typedef {(request: RequestType, callback: (error: Error | null, response: ResponseType | null) => void) => void} grpc.handleUnaryCall<RequestType, ResponseType>
 */

/**
 * @namespace {proto}
 * @typedef {import("@hashgraph/proto").Response} proto.Response
 * @typedef {import("@hashgraph/proto").Query} proto.Query
 */

export const PRIVATE_KEY = PrivateKey.fromString(
    "302e020100300506032b657004220420d45e1557156908c967804615af59a000be88c7aa7058bfcbe0f46b16c28f887d"
);

export const ABORTED = {
    name: "ABORTED",
    message: "no response found",
    code: 10,
};
export const UNAVAILABLE = {
    name: "UNAVAILABLE",
    message: "node is UNAVAILABLE",
    code: 14,
};

/**
 * @namespace {proto}
 * @typedef {import("@hashgraph/proto").Response} proto.Response
 * @typedef {import("@hashgraph/proto").Query} proto.Query
 * @typedef {import("@hashgraph/proto").TransactionResponse} proto.TransactionResponse
 */

/**
 * @typedef {object} Response
 * @property {proto.Response | proto.TransactionResponse} [response]
 * @property {grpc.ServiceError} [error]
 */

class GrpcServer {
    /**
     */
    constructor() {
        /** @type {http.Server | null} */
        this.server = null;
        /** @type {Response[]} */
        this.responses = [];
    }

    /**
     * Adds a service to the gRPC server
     *
     * @param {Response[]} responses
     * @returns {this}
     */
    addResponses(responses) {
        this.responses = responses;
        return this;
    }

    /**
     * @param {string} port
     * @returns {Promise<this>}
     */
    listen(port) {
        let index = 0;

        this.server = http.createServer((_, res) => {
            const response = this.responses[index];
            index += 1;

            const error =
                response == null
                    ? ABORTED
                    : response.error != null
                    ? response.error
                    : response.response == null
                    ? ABORTED
                    : null;

            if (error != null) {
                res.writeHead(200, {
                    "content-type": "application/grpc-web+proto",
                    "grpc-status": String(error.code),
                    "grpc-message": error.message,
                });
                res.end();
                return;
            }

            const encoded = encodeResponse(response.response);
            const frame = new Uint8Array(encoded.byteLength + 5);
            new DataView(frame.buffer).setUint32(1, encoded.byteLength);
            frame.set(encoded, 5);

            res.writeHead(200, {
                "content-type": "application/grpc-web+proto",
            });
            res.end(frame);
        });

        return new Promise((resolve, reject) => {
            this.server.listen(parseInt(port), "127.0.0.1", (error) => {
                if (error != null) {
                    reject(error);
                    return;
                }

                resolve(this);
            });
        });
    }

    /**
     * @param {boolean} force
     * @param {() => void} callback
     */
    close() {
        this.server?.close();
    }
}

/**
 * @param {proto.Response | proto.TransactionResponse} response
 * @returns {Uint8Array}
 */
function encodeResponse(response) {
    if ("nodeTransactionPrecheckCode" in response) {
        return TransactionResponse.encode(response).finish();
    }

    return ProtoResponse.encode(response).finish();
}

export default class Mocker {
    /**
     * Creates a mock server and client with the given responses
     *
     * @param {Response[]} responses
     * @returns {Proimse<{ server: GrpcServer; client: Client }>}
     */
    static async withResponses(responses) {
        const server = await new GrpcServer()
            .addResponses(responses)
            .listen("50211");
        const client = Client.forNetwork({
            "http://127.0.0.1:50211": "0.0.3",
        }).setOperator("0.0.1854", PRIVATE_KEY);

        return { client, server };
    }
}
