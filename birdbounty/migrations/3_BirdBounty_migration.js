var BirdBounty = artifacts.require("BirdBounty");

module.exports = function(deployer) {
  // deployment steps
  deployer.deploy(BirdBounty, {gas: 6721975});
};
