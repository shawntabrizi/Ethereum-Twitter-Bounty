var TwitterOracle = artifacts.require("TwitterOracle");
var BirdBounty = artifacts.require("BirdBounty");

module.exports = function (deployer) {
    deployer.deploy(TwitterOracle, { from: web3.eth.accounts[9], gas: 6721975, value: 500000000000000000 })
        .then(function () {
            return deployer.deploy(BirdBounty, TwitterOracle.address, { gas: 6721975 });
        });
}
