import { Client } from "../src/browser.js";

describe("Client", function () {
    it("should support multiple IPs per node account ID", async function () {
        let nodes = {
            "0.testnet.hedera.com:50211": "0.0.3",
            "34.94.106.61:50211": "0.0.3",
            "50.18.132.211:50211": "0.0.3",
            "138.91.142.219:50211": "0.0.3",
        };

        const client = Client.forNetwork(nodes);

        let network = client.network;

        expect(Object.entries(network).length).to.be.equal(4);
        expect(network["0.testnet.hedera.com:50211"].toString()).to.be.equal(
            "0.0.3"
        );
        expect(network["34.94.106.61:50211"].toString()).to.be.equal("0.0.3");
        expect(network["50.18.132.211:50211"].toString()).to.be.equal("0.0.3");
        expect(network["138.91.142.219:50211"].toString()).to.be.equal("0.0.3");
    });

    describe("healthy node selection", function () {
        const buildClient = () => {
            const nodes = {
                "node-a:50211": "0.0.3",
                "node-b:50211": "0.0.4",
                "node-c:50211": "0.0.5",
                "node-d:50211": "0.0.6",
                "node-e:50211": "0.0.7",
                "node-f:50211": "0.0.8",
            };
            return Client.forNetwork(nodes);
        };

        it("should return at most the requested count of distinct node account ids", function () {
            const client = buildClient();
            const network = client._network;

            const accountIds = network.getNodeAccountIdsForExecute();

            const expectedCount = Math.ceil(network._nodes.length / 3);
            expect(accountIds.length).to.equal(expectedCount);

            const seen = new Set();
            for (const accountId of accountIds) {
                seen.add(accountId.toString());
            }
            expect(seen.size).to.equal(accountIds.length);
        });

        it("should respect setMaxNodesPerTransaction()", function () {
            const client = buildClient();
            client._network.setMaxNodesPerTransaction(2);

            const accountIds =
                client._network.getNodeAccountIdsForExecute();

            expect(accountIds.length).to.equal(2);
            const seen = new Set(accountIds.map((id) => id.toString()));
            expect(seen.size).to.equal(2);
        });

        it("should rank healthy nodes ahead of unhealthy ones", function () {
            const client = buildClient();
            const targetAccountId = "0.0.3";
            const unhealthyNode = client._network._network.get(
                targetAccountId
            )[0];

            unhealthyNode.increaseDelay();
            unhealthyNode.increaseDelay();

            const accountIds = client._network.getNodeAccountIdsForExecute();
            const includesUnhealthy = accountIds.some(
                (id) => id.toString() === targetAccountId
            );

            expect(includesUnhealthy).to.equal(false);
        });

        it("should update _lastUsed when a channel is acquired", function () {
            const client = buildClient();
            const node = client._network._nodes[0];
            const before = node._lastUsed;

            const wait = (ms) =>
                new Promise((resolve) => setTimeout(resolve, ms));

            return wait(5).then(() => {
                node.getChannel();
                expect(node._lastUsed).to.be.greaterThan(before);
            });
        });

        it("should count retryable failures through the existing delay path", function () {
            const client = buildClient();
            const node = client._network._nodes[0];

            node.increaseDelay();
            expect(node.attempts).to.equal(1);

            node.decreaseDelay();
            expect(node.attempts).to.equal(0);
        });
    });

    it("should correctly construct and update network", async function () {
        let nodes = {
            "0.testnet.hedera.com:50211": "0.0.3",
        };

        const client = Client.forNetwork(nodes);

        let network = client.network;

        expect(Object.entries(network).length).to.be.equal(1);
        expect(network["0.testnet.hedera.com:50211"].toString()).to.be.equal(
            "0.0.3"
        );

        client.setNetwork(nodes);
        network = client.network;

        expect(Object.entries(network).length).to.be.equal(1);
        expect(network["0.testnet.hedera.com:50211"].toString()).to.be.equal(
            "0.0.3"
        );

        nodes["1.testnet.hedera.com:50211"] = "0.0.4";

        client.setNetwork(nodes);
        network = client.network;

        expect(Object.entries(network).length).to.be.equal(2);
        expect(network["0.testnet.hedera.com:50211"].toString()).to.be.equal(
            "0.0.3"
        );
        expect(network["1.testnet.hedera.com:50211"].toString()).to.be.equal(
            "0.0.4"
        );

        nodes["2.testnet.hedera.com:50211"] = "0.0.5";

        client.setNetwork(nodes);
        network = client.network;

        expect(Object.entries(network).length).to.be.equal(3);
        expect(network["0.testnet.hedera.com:50211"].toString()).to.be.equal(
            "0.0.3"
        );
        expect(network["1.testnet.hedera.com:50211"].toString()).to.be.equal(
            "0.0.4"
        );
        expect(network["2.testnet.hedera.com:50211"].toString()).to.be.equal(
            "0.0.5"
        );

        nodes = {
            "2.testnet.hedera.com:50211": "0.0.5",
        };

        client.setNetwork(nodes);
        network = client.network;

        expect(Object.entries(network).length).to.be.equal(1);
        expect(network["2.testnet.hedera.com:50211"].toString()).to.be.equal(
            "0.0.5"
        );

        nodes = {
            "2.testnet.hedera.com:50211": "0.0.6",
        };

        client.setNetwork(nodes);
        network = client.network;

        expect(Object.entries(network).length).to.be.equal(1);
        expect(network["2.testnet.hedera.com:50211"].toString()).to.be.equal(
            "0.0.6"
        );
    });
});
