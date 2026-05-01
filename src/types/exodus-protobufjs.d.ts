declare module "@exodus/protobufjs/minimal.js" {
    export type RPCImpl = (
        method: { name: string },
        requestData: Uint8Array,
        callback: (error: Error | null, response: Uint8Array | null) => void
    ) => void;
}
