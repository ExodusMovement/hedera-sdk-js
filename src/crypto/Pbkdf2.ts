import { HashAlgorithm } from "./Hmac";
import * as utf8 from "@stablelib/utf8";
import * as crypto from "./crypto";
const promisify = require("util.promisify");

export const pbkdf2 = promisify(crypto.pbkdf2);

export class Pbkdf2 {
    public static async deriveKey(
        algorithm: HashAlgorithm,
        password: Uint8Array | string,
        salt: Uint8Array | string,
        iterations: number,
        length: number
    ): Promise<Uint8Array> {
        const pass = typeof password === "string" ?
        // Valid ASCII is also valid UTF-8 so encoding the password as UTF-8
        // should be fine if only valid ASCII characters are used in the password
            utf8.encode(password) :
            password;

        const nacl = typeof salt === "string" ?
            utf8.encode(salt) :
            salt;

        switch (algorithm) {
            case HashAlgorithm.Sha256:
                return pbkdf2(password, nacl, iterations, length, "sha256");
            case HashAlgorithm.Sha384:
                return pbkdf2(password, nacl, iterations, length, "sha384");
            case HashAlgorithm.Sha512:
                return pbkdf2(password, nacl, iterations, length, "sha512");
            default: throw new Error("(BUG) Non-Exhaustive switch statement for algorithms");
        }
    }
}
