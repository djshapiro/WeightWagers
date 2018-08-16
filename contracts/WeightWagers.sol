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

  // A structure used temporarily while waiting
  // for smart scale data to finish verifying
  //  a wager
  struct VerifyingWager {
    address wagerer; //the address of the person making the wager
    uint wagerIndex; //the index of the wager in the wagers array - we have to
                     //track this so the __callback function knows which wager
                     //to delete once the wager has been verified
  }

  /*
   * Contract variables
   */

  // The current reward that users will receive (as a percentage
  // of their wager) after successfully verifying a wager.
  uint private rewardMultiplier;

  // Whether the contract has been emergency stopped
  bool private stopped;

  // The address that deployed the contract
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
  function WeightWagers() public payable {
    owner = msg.sender;
    stopped = false;
    rewardMultiplier = 1031; // 1031 represents a 3.1% return.
    OAR = OraclizeAddrResolverI(0x6f485C8BF6fc43eA212E93BBF8ce046C7f1cb475);
  }

  /**
   * @dev Sets a new reward multiplier for the function. 1031 equals a 3.1% return.
   * @param newRewardMultiplier Desired new value for the reward multiplier 
   */
  function setRewardMultiplier(uint newRewardMultiplier) public isOwner {
    rewardMultiplier = newRewardMultiplier;
  }

  /**
   * @dev Sets the value of the stopped variable.
   *   This decides whether the contract is stopped.
   * @param newStopped Desired new value for the stopped variable
   */
  function setStopped(bool newStopped) public isOwner {
    stopped = newStopped;
  }

  /**
   * @dev Returns values of admin-related variables
   * @return stopped The stopped variable for the contract
   * @return rewardMultiplier The current reward multiplier for the contract
   */
  function getAdminStuff() public view returns (bool, uint) {
    return (stopped, rewardMultiplier);
  }

  /**
   * @dev Begins the wager creation process
   * @param _expiration A uint representing the number of seconds the user 
   *   gives themselves to meet their goal weight   
   * @param _desiredWeightChange A uint representing the amount of weight
   *   the user wants to lose
   * @param _smartScaleID A string representing the user's smart scale credentials
   */
  function createWager(uint _expiration, uint _desiredWeightChange, string _smartScaleID) public payable notWhenStopped {
    // Make sure the inputs make sense
    require(_desiredWeightChange > 0 && _desiredWeightChange < 2000);
    require(_expiration > 0);

    // Construct the URL to call
    string memory oraclizeURL = strConcat("json(http://eastern-period-211120.appspot.com/", _smartScaleID, "/0).value");
    // Call the URL
    bytes32 myID = oraclize_query("URL", oraclizeURL, 5000000);

    // Create a wager in the wagersBeingActivated mapping so that the
    // callback function will have access to everything the user passed in.
    // We use the ID returned by oraclize_query to uniquely identify
    // this user's wager.
    wagersBeingActivated[myID] = Wager(now.add(_expiration), _desiredWeightChange, msg.value, _smartScaleID, msg.sender, 0);
    emit WagerCreated(now.add(_expiration), _desiredWeightChange, msg.value, _smartScaleID);
  }

  /**
   * @dev This is the callback function used by Oraclize. This function will
   *   either complete the wager creation process or the wager verification
   *   process.
   * @param myid The unique ID of the call that we're getting data for
   * @param result The value returned from the URL we called with Oraclize
   */
  function __callback(bytes32 myid, string result) public {
    // Only let Oraclize call this function.
    if (msg.sender != oraclize_cbAddress()) revert();

    // Is this for a wager being activated?
    if (wagersBeingActivated[myid].wagerer != address(0)) {
      // This is for a wager being activated, so get that wager's information.
      Wager memory newWager = wagersBeingActivated[myid];

      // Remove the wager from the "being activated" mapping because it
      // has graduated to "activated"
      delete wagersBeingActivated[myid];

      // Add the user's start weight to the wager. This is all we needed
      // Oraclize for.
      newWager.startWeight = parseInt(result);

      // Add this wager to the user's wagers.
      wagers[newWager.wagerer].push(newWager);
      emit WagerActivated(newWager.wagerer, newWager.wagerAmount);

    // Is this for a wager being verified?
    } else if (wagersBeingVerified[myid].wagerer != address(0)) {
      // This is for a wager being verified, so get some of
      // that wager's information.
      VerifyingWager memory myVerifyingWager = wagersBeingVerified[myid];

      // Remove the wager from the "being verified" mapping because
      // we're about to finish the verification process.
      delete wagersBeingVerified[myid];

      // User the information we got from wagersBeingVerified to locate
      // the wager the user wants to verify.
      Wager memory wagerToVerify = wagers[myVerifyingWager.wagerer][myVerifyingWager.wagerIndex];

      // Did the user actually lose the weight?
      if (parseInt(result) <= (wagerToVerify.startWeight.sub(wagerToVerify.desiredWeightChange))) {
        // The user lost the weight! So remove their wager.
        delete wagers[wagerToVerify.wagerer][myVerifyingWager.wagerIndex];
        emit WagerVerified(wagerToVerify.wagerer, wagerToVerify.wagerAmount);

        // Send the user their wager plus a reward.
        wagerToVerify.wagerer.send((wagerToVerify.wagerAmount.mul(rewardMultiplier)).div(1000));
      } else {
        // The user didn't lose the weight. Don't do anything since the user
        // still has time to lose the weight.
        emit WagerUnchanged(myid);
      }
    }
  }

  /**
   * @dev Begins the wager verification process
   * @param _wagerIndex The index identifying which of
   *   the user's wagers to begin verifying
   */
  function verifyWager(uint _wagerIndex) public {
    // Find the wager the user wants to verify
    Wager memory wagerToVerify = wagers[msg.sender][_wagerIndex];

    if (wagerToVerify.expiration < now) {
      // The wager has expired. Delete the wager and be done. :( for user
      delete wagers[msg.sender][_wagerIndex];
      emit WagerExpired(msg.sender, wagerToVerify.wagerAmount);

    } else {
      // The wager is still active. Construct the URL to call.
      string memory oraclizeURL = strConcat("json(http://eastern-period-211120.appspot.com/", wagerToVerify.smartScaleID, "/1).value");
      // Call the URL
      bytes32 myID = oraclize_query("URL", oraclizeURL, 5000000);

      // Put the wager info into a VerifyingWager struct and store it
      // in the mapping so the callback function knows what the user
      // was trying to do.
      wagersBeingVerified[myID] = VerifyingWager(msg.sender, _wagerIndex);
      emit WagerBeingVerified(msg.sender, _wagerIndex);
    }
  }

  /**
   * @dev Begins the wager verification process for all the user's wagers
   */
  function verifyWagers() public {
    for (uint ii = 0; ii < wagers[msg.sender].length; ii++) {
      if (wagers[msg.sender][ii].expiration != 0) {
        // This wager is not a "deleted" wager, so begin verifying it
        verifyWager(ii);
      }
    }
  }

  /**
   * @dev Gets information on all the user's wagers. Users of this function
   *   will have to do some data transformations to get data in a useful format
   *   (i.e. an array of wagers). This is because Solidity cannot return an array
   *   of structs.
   * @return expirations an array of the expiration timestamps of all the user's wagers
   * @return desiredWeightChanges an array of the desired weight changes of all the 
   *   user's wagers
   * @return values an array of the wager values of all the user's wagers
   * @return weights an array of the start weights of all the user's wagers.
   */
  function getWagers() public view returns (uint[] memory expirations, uint[] memory desiredWeightChanges, uint[] memory values, uint[] memory weights) {
    // Create temporary arrays to hold the values
    expirations = new uint[](wagers[msg.sender].length);
    desiredWeightChanges = new uint[](wagers[msg.sender].length);
    values = new uint[](wagers[msg.sender].length);
    weights = new uint[](wagers[msg.sender].length);

    // Loop through arrays and gather their values
    for (uint ii = 0; ii < wagers[msg.sender].length; ii++) {
        Wager memory wager = wagers[msg.sender][ii];
        expirations[ii] = wager.expiration;
        desiredWeightChanges[ii] = wager.desiredWeightChange;
        values[ii] = wager.wagerAmount;
        weights[ii] = wager.startWeight;
    }

    // return the values
    return (expirations, desiredWeightChanges, values, weights);
  }

}

