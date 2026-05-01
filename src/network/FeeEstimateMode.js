/**
 * Mirror node fee estimation modes per HIP-1261. The default is `INTRINSIC`,
 * which estimates fees from the transaction body alone. `STATE` additionally
 * factors in current network state (used for queries that depend on storage
 * costs).
 *
 * Values are mapped to the mirror node REST `mode` query parameter as
 * uppercase strings.
 *
 * @enum {number}
 */
const FeeEstimateMode = Object.freeze({
    INTRINSIC: 0,
    STATE: 1,
});

export default FeeEstimateMode;
