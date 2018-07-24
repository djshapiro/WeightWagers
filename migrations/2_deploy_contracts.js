var SimpleStorage = artifacts.require("./SimpleStorage.sol");
var WeightWagers = artifacts.require("WeightWagers");

module.exports = function(deployer, network, accounts) {
  deployer.deploy(SimpleStorage);
  deployer.deploy(WeightWagers, { from: accounts[9], gas:6721975, value: 500000000000000000 });
};
