pragma solidity ^0.4.24;

import "installed_contracts/oraclize-api/contracts/usingOraclize.sol";
import 'openzeppelin-solidity/contracts/math/SafeMath.sol';

/**
 * @title WeightWagers
 */
contract WeightWagers is usingOraclize{
  using SafeMath for uint;

  /*
   * Data structures
   */

  // The structure of all wagers
  struct Wager {
    uint expiration; //timestamp after which the contract is deemed "expired"
    uint desiredWeightChange; //amount of weight wagerer wants to lose
    uint wagerAmount; //amount of wei this person wagered
    string smartScaleID; //the user's "credentials" for their smart scale
    address wagerer; //the address of the person making the wager
    uint startWeight; //the starting weight of the wagerer
  }

  /* A structure used temporarily while waiting
   * for smart scale data to finish verifying
   */ a wager
  struct VerifyingWager {
    address wagerer; //the address of the person making the wager
    uint wagerIndex; //the index of the wager in the wagers array - we have to
                     //track this so the __callback function knows which wager
                     //to delete once the wager has been verified
  }

  /*
   * Contract variables
   */

  //The current reward that users will receive (as a percentage
  //of their wager) after successfully verifying a wager.
  uint private rewardMultiplier;

  //Whether the contract has been emergency stopped
  bool private stopped;

  //The address that deployed the contract
  address private owner;

  // The official mapping of all activated wagers
  mapping(address => Wager[]) private wagers;

  // The mapping used to keep track of wagers as we
  // wait for the oraclized scale data to return so
  // that we can officially activate the wager
  mapping(bytes32 => Wager) private wagersBeingActivated;

  // The mapping used to keep track of wagers as we
  // wait for the oraclized scale data to return so
  // that we can officially verify the wager 
  mapping(bytes32 => VerifyingWager) private wagersBeingVerified;

  /*
   * Modifiers
   */

  // A simple modifier to prevent non-owners from using functions
  modifier isOwner () {
    require (msg.sender == owner);
    _;
  }

  // A simple modifier to prevent functions from running when the contract is stopped.
  modifier notWhenStopped () {
    require (!stopped);
    _;
  }

  /*
   * Events
   */

  // for when a user attempts to create a wager
  event WagerCreated(uint expiration, uint desiredWeightChange, uint wagerAmount, string smartScaleID);

  // for when the oraclized smart scale returns
  // data for a wager that a user is trying to create
  event WagerActivated(address wagerer, uint wagerAmount);

  // for when a user attempts to verify a wager
  event WagerBeingVerified(address verifierAddress, uint wagerIndex);

  // for when a wager is verified and the reward is paid out
  event WagerVerified(address wagerer, uint wagerAmount);

  // for when a wager is expired - emitted after a user
  // attempts to verify a wager and the contract discovers
  // that the wager has expired
  event WagerExpired(address wagerer, uint wagerAmount);

  // for when the verify callback discovers that the user
  // hasn't hit their goal weight AND that the wager
  // hasn't expired
  event WagerUnchanged(bytes32 myid);

  /*
   * Functions
   */

  /**
   * @dev WeightWagers constructor
   */
  function WeightWagers() payable {
    owner = msg.sender;
    stopped = false;
    rewardMultiplier = 1031; //reward multiplier. 1031 represents a 3.1% return.
    OAR = OraclizeAddrResolverI(0x6f485C8BF6fc43eA212E93BBF8ce046C7f1cb475);
  }

  /**
   * @dev Sets a new reward multiplier for the function. 1031 equals a 3.1% return.
   * @param newRewardMultpilier Desired new value for the reward multiplier 
   */
  function setRewardMultiplier(uint newRewardMultiplier) public isOwner {
    rewardMultiplier = newRewardMultiplier;
  }

  /**
   * @dev Sets the value of the stopped variable. This decides whether the contract is stopped.
   * @param newStopped Desired new value for the stopped variable
   */
  function setStopped(bool newStopped) public isOwner {
    stopped = newStopped;
  }

  /**
   * @return stopped The stopped variable for the contract
   * @return rewardMultiplier The current reward multiplier for the contract
   */
  function getAdminStuff() public view returns (bool, uint) {
    return (stopped, rewardMultiplier);
  }

  //The user calls this function when they want to create a wager
  function createWager(uint _expiration, uint _desiredWeightChange, string _smartScaleID) public payable notWhenStopped {
    require(_desiredWeightChange > 0 && _desiredWeightChange < 2000);
    require(_expiration > 0);
    string memory oraclizeURL = strConcat("json(http://eastern-period-211120.appspot.com/", _smartScaleID, "/0).value");
    bytes32 myID = oraclize_query("URL", oraclizeURL, 5000000);

    wagersBeingActivated[myID] = Wager(now.add(_expiration), _desiredWeightChange, msg.value, _smartScaleID, msg.sender, 0);
    emit WagerCreated(now.add(_expiration), _desiredWeightChange, msg.value, _smartScaleID);
  }

  function __callback(bytes32 myid, string result) public {
    if (msg.sender != oraclize_cbAddress()) revert();
    if (wagersBeingActivated[myid].wagerer != address(0)) {
      Wager memory newWager = wagersBeingActivated[myid];
      delete wagersBeingActivated[myid];
      newWager.startWeight = parseInt(result);
      wagers[newWager.wagerer].push(newWager);
      emit WagerActivated(newWager.wagerer, newWager.wagerAmount);
    } else if (wagersBeingVerified[myid].wagerer != address(0)) {
      VerifyingWager memory myVerifyingWager = wagersBeingVerified[myid];
      delete wagersBeingVerified[myid];
      Wager memory wagerToVerify = wagers[myVerifyingWager.wagerer][myVerifyingWager.wagerIndex];
      if (parseInt(result) <= (wagerToVerify.startWeight.sub(wagerToVerify.desiredWeightChange))) {
        delete wagers[wagerToVerify.wagerer][myVerifyingWager.wagerIndex];
        emit WagerVerified(wagerToVerify.wagerer, wagerToVerify.wagerAmount);
        wagerToVerify.wagerer.send((wagerToVerify.wagerAmount.mul(rewardMultiplier)).div(1000));
      } else {
        emit WagerUnchanged(myid);
      }
    }
  }

  function verifyWager(uint _wagerIndex) public {
    Wager memory wagerToVerify = wagers[msg.sender][_wagerIndex];
    if (wagerToVerify.expiration < now) {
      delete wagers[msg.sender][_wagerIndex];
      emit WagerExpired(msg.sender, wagerToVerify.wagerAmount);
    } else {
      string memory oraclizeURL = strConcat("json(http://eastern-period-211120.appspot.com/", wagerToVerify.smartScaleID, "/1).value");
      bytes32 myID = oraclize_query("URL", oraclizeURL, 5000000);
      wagersBeingVerified[myID] = VerifyingWager(msg.sender, _wagerIndex);
      emit WagerBeingVerified(msg.sender, _wagerIndex);
    }
  }

  function verifyWagers() public {
    for (uint ii = 0; ii < wagers[msg.sender].length; ii++) {
      if (wagers[msg.sender][ii].expiration != 0) {
        verifyWager(ii);
      }
    }
  }

  function getWagers() public view returns (uint[] memory expirations, uint[] memory desiredWeightChanges, uint[] memory values, uint[] memory weights) {
    expirations = new uint[](wagers[msg.sender].length);
    desiredWeightChanges = new uint[](wagers[msg.sender].length);
    values = new uint[](wagers[msg.sender].length);
    weights = new uint[](wagers[msg.sender].length);

    for (uint ii = 0; ii < wagers[msg.sender].length; ii++) {
        Wager memory wager = wagers[msg.sender][ii];
        expirations[ii] = wager.expiration;
        desiredWeightChanges[ii] = wager.desiredWeightChange;
        values[ii] = wager.wagerAmount;
        weights[ii] = wager.startWeight;
    }

    return (expirations, desiredWeightChanges, values, weights);
  }

}

