var TwitterOracle = artifacts.require("TwitterOracle");

module.exports = function(deployer) {
  // deployment steps
  deployer.deploy(TwitterOracle,
    { from: web3.eth.accounts[9], gas:6721975, value: 500000000000000000 });
};
