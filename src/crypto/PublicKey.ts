import * as pb from "../generated/BasicTypes_pb";

export abstract class PublicKey {
    public abstract _toProtoKey(): pb.Key;
}
