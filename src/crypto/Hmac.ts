import * as crypto from "./crypto";
import * as utf8 from "@stablelib/utf8";

export enum HashAlgorithm {
    Sha256 = "SHA-256",
    Sha384 = "SHA-384",
    Sha512 = "SHA-512"
}

export class Hmac {
    public static async hash(
        algorithm: HashAlgorithm,
        secretKey: Uint8Array | string,
        data: Uint8Array | string
    ): Promise<Uint8Array> {
        const key = typeof secretKey === "string" ? utf8.encode(secretKey) : secretKey;
        const value = typeof data === "string" ? utf8.encode(data) : data;

        switch (algorithm) {
            case HashAlgorithm.Sha256:
                return crypto.createHmac("SHA256", key).update(value).digest();
            case HashAlgorithm.Sha384:
                return crypto.createHmac("SHA384", key).update(value).digest();
            case HashAlgorithm.Sha512:
                return crypto.createHmac("SHA512", key).update(value).digest();
            default: throw new Error("(BUG) Non-Exhaustive switch statement for algorithms");
        }
    }
}

