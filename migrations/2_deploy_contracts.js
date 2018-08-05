var WeightWagers = artifacts.require("WeightWagers");

module.exports = function(deployer, network, accounts) {
  //Deploy WeightWagers with value because you have to pay for oraclize calls
  deployer.deploy(WeightWagers, { from: accounts[9], gas:6721975, value: 5000000000000000000 });
};
