export class Key {}
export class KeyList extends Key implements Iterable<Key> {
    static from(arrayLike: ArrayLike<Key>, mapFn?: (key: Key) => Key, thisArg?: unknown): KeyList;
    readonly threshold: number | null;
    setThreshold(threshold: number): this;
    toArray(): Key[];
    [Symbol.iterator](): Iterator<Key>;
}
export class PrivateKey extends Key {
    static fromString(text: string): PrivateKey;
    readonly publicKey: PublicKey;
    sign(bytes: Uint8Array): Uint8Array;
    toBytes(): Uint8Array;
}
export class PublicKey extends Key {
    static fromBytes(data: Uint8Array): PublicKey;
    static fromString(text: string): PublicKey;
    toBytes(): Uint8Array;
}
export class Mnemonic {}
export class BadKeyError extends Error {}
export class BadMnemonicError extends Error {}
export enum BadMnemonicReason {}
export namespace encoding {
    namespace base64 {
        function decode(data: string): Uint8Array;
        function encode(data: Uint8Array): string;
    }
    namespace hex {
        function decode(data: string): Uint8Array;
        function encode(data: Uint8Array): string;
    }
    namespace utf8 {
        function decode(data: Uint8Array): string;
        function encode(data: string): Uint8Array;
    }
}
