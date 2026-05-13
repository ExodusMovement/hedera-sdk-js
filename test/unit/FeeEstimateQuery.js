import FeeEstimateQuery from "../src/network/FeeEstimateQuery.js";
import FeeEstimateMode from "../src/network/FeeEstimateMode.js";

describe("FeeEstimateQuery", function () {
    const buildFakeTransaction = (
        built = { signedTransactionBytes: new Uint8Array([1, 2, 3]) },
        chunks = 1
    ) => {
        return {
            isFrozen: () => true,
            freezeWith: () => {},
            getRequiredChunks: () => chunks,
            _buildAllTransactionsAsync: () => Promise.resolve(),
            _transactions: [built],
        };
    };

    const buildFakeClient = (mirrorRestApiBaseUrl = "https://mirror.example/api/v1") => ({
        mirrorRestApiBaseUrl,
    });

    const buildFetch = (responses) => {
        const calls = [];
        const queue = Array.isArray(responses) ? responses.slice() : [responses];
        const fetch = (url, init) => {
            calls.push({ url, init });
            const next = queue.shift();
            if (next == null) {
                return Promise.reject(new Error("no more responses"));
            }
            return Promise.resolve(next);
        };
        return { fetch, calls };
    };

    it("requires setTransaction()", async function () {
        const { fetch } = buildFetch({});
        const query = new FeeEstimateQuery({ fetch });
        let caught;
        try {
            await query.execute(buildFakeClient());
        } catch (err) {
            caught = err;
        }
        expect(caught).to.be.instanceOf(Error);
        expect(caught.message).to.match(/setTransaction/);
    });

    it("requires the client to have a mirror REST URL configured", async function () {
        const { fetch } = buildFetch({});
        const query = new FeeEstimateQuery({
            fetch,
            requestTimeoutMs: 5,
        }).setTransaction(buildFakeTransaction());
        let caught;
        try {
            await query.execute({ mirrorRestApiBaseUrl: null });
        } catch (err) {
            caught = err;
        }
        expect(caught).to.be.instanceOf(Error);
        expect(caught.message).to.match(/setMirrorRestApiBaseUrl/);
    });

    it("POSTs to /network/fees with mode=INTRINSIC by default and returns total tinybars", async function () {
        const { fetch, calls } = buildFetch({
            ok: true,
            status: 200,
            json: () => Promise.resolve({ total: 4321 }),
        });
        const query = new FeeEstimateQuery({
            fetch,
            requestTimeoutMs: 5,
        }).setTransaction(buildFakeTransaction());
        const total = await query.execute(buildFakeClient());

        expect(total).to.equal(4321);
        expect(calls).to.have.length(1);
        expect(calls[0].url).to.equal(
            "https://mirror.example/api/v1/network/fees?mode=INTRINSIC"
        );
        expect(calls[0].init.method).to.equal("POST");
        expect(calls[0].init.headers["Content-Type"]).to.equal(
            "application/protobuf"
        );
        expect(calls[0].init.body).to.be.instanceOf(Uint8Array);
    });

    it("supports STATE mode and high_volume_throttle", async function () {
        const { fetch, calls } = buildFetch({
            ok: true,
            status: 200,
            json: () => Promise.resolve({ total: "999" }),
        });
        const query = new FeeEstimateQuery({
            fetch,
            mode: FeeEstimateMode.STATE,
            highVolumeThrottle: 5000,
        }).setTransaction(buildFakeTransaction());

        const total = await query.execute(buildFakeClient());

        expect(total).to.equal(999);
        expect(calls[0].url).to.equal(
            "https://mirror.example/api/v1/network/fees?mode=STATE&high_volume_throttle=5000"
        );
    });

    it("rejects an out-of-range highVolumeThrottle", function () {
        const { fetch } = buildFetch({});
        const query = new FeeEstimateQuery({ fetch });
        expect(() => query.setHighVolumeThrottle(-1)).to.throw(/integer in/);
        expect(() => query.setHighVolumeThrottle(10001)).to.throw(/integer in/);
        expect(() => query.setHighVolumeThrottle(1.5)).to.throw(/integer in/);
    });

    it("rejects an unknown mode", function () {
        const { fetch } = buildFetch({});
        const query = new FeeEstimateQuery({ fetch });
        expect(() => query.setMode(42)).to.throw(/invalid mode/);
    });

    it("does not retry on HTTP 400 (malformed transaction)", async function () {
        const { fetch, calls } = buildFetch({
            ok: false,
            status: 400,
            text: () =>
                Promise.resolve(
                    JSON.stringify({
                        _status: {
                            messages: [
                                {
                                    message: "Bad Request",
                                    detail: "Unable to parse transaction",
                                },
                            ],
                        },
                    })
                ),
        });
        const query = new FeeEstimateQuery({
            fetch,
            requestTimeoutMs: 5,
        }).setTransaction(buildFakeTransaction());

        let caught;
        try {
            await query.execute(buildFakeClient());
        } catch (err) {
            caught = err;
        }

        expect(caught).to.be.instanceOf(Error);
        expect(caught.message).to.match(/HTTP 400/);
        expect(caught.message).to.match(/Unable to parse transaction/);
        expect(calls).to.have.length(1);
    });

    it("retries 503 then succeeds on the second attempt", async function () {
        const { fetch, calls } = buildFetch([
            {
                ok: false,
                status: 503,
                text: () => Promise.resolve(""),
            },
            {
                ok: true,
                status: 200,
                json: () => Promise.resolve({ total: 100 }),
            },
        ]);
        const query = new FeeEstimateQuery({
            fetch,
            requestTimeoutMs: 5,
        }).setTransaction(buildFakeTransaction());

        const total = await query.execute(buildFakeClient());
        expect(total).to.equal(100);
        expect(calls).to.have.length(2);
    });

    it("rejects multi-chunk transactions instead of under-estimating the first chunk", async function () {
        const { fetch, calls } = buildFetch({
            ok: true,
            status: 200,
            json: () => Promise.resolve({ total: 100 }),
        });
        const query = new FeeEstimateQuery({ fetch }).setTransaction(
            buildFakeTransaction(undefined, 2)
        );

        let caught;
        try {
            await query.execute(buildFakeClient());
        } catch (err) {
            caught = err;
        }

        expect(caught).to.be.instanceOf(Error);
        expect(caught.message).to.match(/multi-chunk/);
        expect(calls).to.have.length(0);
    });

    it("retries a timed-out request and then succeeds", async function () {
        const calls = [];
        const fetch = (url, init) => {
            calls.push({ url, init });
            if (calls.length === 1) {
                return new Promise(() => {});
            }
            return Promise.resolve({
                ok: true,
                status: 200,
                json: () => Promise.resolve({ total: 777 }),
            });
        };
        const query = new FeeEstimateQuery({
            fetch,
            requestTimeoutMs: 5,
        }).setTransaction(buildFakeTransaction());

        const total = await query.execute(buildFakeClient());

        expect(total).to.equal(777);
        expect(calls).to.have.length(2);
    });

    it("throws when the response is missing total", async function () {
        const { fetch } = buildFetch({
            ok: true,
            status: 200,
            json: () => Promise.resolve({ nodeFee: { base: 1 } }),
        });
        const query = new FeeEstimateQuery({ fetch }).setTransaction(
            buildFakeTransaction()
        );

        let caught;
        try {
            await query.execute(buildFakeClient());
        } catch (err) {
            caught = err;
        }
        expect(caught).to.be.instanceOf(Error);
        expect(caught.message).to.match(/total/);
    });
});
