import Executable, {
    ExecutionState,
    RST_STREAM,
} from "../src/Executable.js";
import GrpcServiceError from "../src/grpc/GrpcServiceError.js";
import GrpcStatus from "../src/grpc/GrpcStatus.js";
import AccountId from "../src/account/AccountId.js";

describe("Executable", function () {
    it("RST_STREAM regex matches actual response returned", function () {
        expect(
            RST_STREAM.test(
                "Error: 13 INTERNAL: Received RST_STREAM with code 0"
            )
        ).to.be.true;
    });

    describe("retry routing across frozen nodes", function () {
        class FakeNode {
            constructor(key, healthy = true) {
                this._key = key;
                this._healthy = healthy;
                this._channel = { _key: key };
                this.increaseDelayCalls = 0;
                this.decreaseDelayCalls = 0;
                this.waitCalls = 0;
            }

            getKey() {
                return this._key;
            }

            getChannel() {
                return this._channel;
            }

            isHealthy() {
                return this._healthy;
            }

            increaseDelay() {
                this.increaseDelayCalls += 1;
                this._healthy = false;
            }

            decreaseDelay() {
                this.decreaseDelayCalls += 1;
            }

            wait() {
                this.waitCalls += 1;
                this._healthy = true;
                return Promise.resolve();
            }
        }

        class FakeNetwork {
            constructor(nodes) {
                this._nodesByKey = new Map();
                for (const node of nodes) {
                    this._nodesByKey.set(node.getKey(), node);
                }
            }

            getNode(accountId) {
                return this._nodesByKey.get(accountId.toString());
            }
        }

        class FakeClient {
            constructor(nodes) {
                this._network = new FakeNetwork(nodes);
                this._maxAttempts = null;
                this.maxBackoff = 8000;
                this.minBackoff = 1;
            }
        }

        class FakeExecutable extends Executable {
            constructor(nodeIds, executionPlan) {
                super();
                this._nodeIds = nodeIds;
                this._executionPlan = executionPlan;
                this._executeCallNodeIds = [];
            }

            _beforeExecute() {
                return Promise.resolve();
            }

            _makeRequestAsync() {
                return Promise.resolve({});
            }

            _getNodeAccountId() {
                return this._nodeIds[this._nextNodeIndex];
            }

            _execute(channel) {
                this._executeCallNodeIds.push(channel._key);
                const action = this._executionPlan.shift();
                if (action == null) {
                    return Promise.resolve("ok");
                }
                if (action === "throw-unavailable") {
                    return Promise.reject(
                        new GrpcServiceError(GrpcStatus.Unavailable)
                    );
                }
                return Promise.resolve(action);
            }

            _shouldRetry() {
                return ExecutionState.Finished;
            }

            _mapResponse(response) {
                return Promise.resolve(response);
            }

            _mapStatusError() {
                return new Error("status error");
            }
        }

        it("retries on a healthy frozen node after a 503 failure on the first node", async function () {
            const accountIdA = AccountId.fromString("0.0.3");
            const accountIdB = AccountId.fromString("0.0.4");
            const nodeA = new FakeNode("0.0.3");
            const nodeB = new FakeNode("0.0.4");
            const client = new FakeClient([nodeA, nodeB]);

            const executable = new FakeExecutable(
                [accountIdA, accountIdB],
                ["throw-unavailable", "ok"]
            );

            const result = await executable.execute(client);

            expect(result).to.equal("ok");
            expect(executable._executeCallNodeIds).to.deep.equal([
                "0.0.3",
                "0.0.4",
            ]);
            expect(nodeA.increaseDelayCalls).to.be.greaterThan(0);
            expect(nodeB.decreaseDelayCalls).to.be.greaterThan(0);
            expect(nodeA.waitCalls).to.equal(0);
        });

        it("waits only when every frozen node is unhealthy", async function () {
            const accountIdA = AccountId.fromString("0.0.3");
            const accountIdB = AccountId.fromString("0.0.4");
            const nodeA = new FakeNode("0.0.3", false);
            const nodeB = new FakeNode("0.0.4", false);
            const client = new FakeClient([nodeA, nodeB]);

            const executable = new FakeExecutable(
                [accountIdA, accountIdB],
                ["ok"]
            );

            await executable.execute(client);

            const totalWaits = nodeA.waitCalls + nodeB.waitCalls;
            expect(totalWaits).to.be.greaterThan(0);
        });
    });
});
