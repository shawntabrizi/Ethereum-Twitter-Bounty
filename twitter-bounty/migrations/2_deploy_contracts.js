var TwitterOracle = artifacts.require("TwitterOracle");
var TwitterBounty = artifacts.require("TwitterBounty");

module.exports = function (deployer) {
    deployer.deploy(TwitterOracle, { from: web3.eth.accounts[9], gas: 6721975, value: 500000000000000000 })
        .then(function () {
            return deployer.deploy(TwitterBounty, TwitterOracle.address, { gas: 6721975 });
        });
}
