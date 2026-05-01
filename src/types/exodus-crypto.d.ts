declare module "@exodus/crypto/hash" {
    export function hash(
        algorithm: string,
        data: Uint8Array,
        encoding: "uint8"
    ): Promise<Uint8Array>;
}
