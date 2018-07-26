pragma solidity ^0.4.24;

import "installed_contracts/oraclize-api/contracts/usingOraclize.sol";

contract WeightWagers is usingOraclize{

  uint rewardMultiplier;

  struct Wager {
    //DJSFIXME you have to store the start time, too, just so
    //the verify thing can do a time difference
    uint expiration; //timestamp after which the contract is deemed "expired"
    uint desiredWeightChange; //amount of weight wagerer wants to lose
    uint wagerAmount; //amount this person wagered
    string smartScaleID; //The user's "credentials" for their smart scale
    address wagerer; //the address of the person making the wager
    uint startWeight; //the starting weight of the wagerer
  }

  struct VerifyingWager {
    address wagerer; //the address of the person making the wager
    uint wagerIndex; //the index of the wager in the wagers array - we have to
                     //track this so the __callback function knows which wager
                     //to delete once the wager has been verified
  }

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

  // event for when a user attempts to create a wager
  event WagerCreated(uint expiration, uint desiredWeightChange, uint wagerAmount, string smartScaleID);
  // event for when the oraclized smart scale returns
  // data for a wager that a user is trying to create
  event WagerActivated(address wagerer, uint wagerAmount);
  // event for when a user attempts to verify a wager
  event WagerBeingVerified(address verifierAddress, uint wagerIndex);
  // event for when a wager is verified
  event WagerVerified(address wagerer, uint wagerAmount);
  //event WagerVerified(uint result, uint startWeight, uint desiredWeightChange);
  // event for when a wager is expired - called after a user
  // attempts to verify a wager and the contract discovers
  // that the wager has expired
  event WagerExpired(address wagerer, uint wagerAmount);
  // event for when the __callback recieves an invalid wager id
  event InvalidWager(bytes32 myid);
  // event for when the verify callback recieves a valid
  // wager but one where the user hasn't actually achieved
  // their goal weight yet
  event WagerUnchanged(bytes32 myid);

  function WeightWagers() payable {
    rewardMultiplier = 100;
    OAR = OraclizeAddrResolverI(0x6f485C8BF6fc43eA212E93BBF8ce046C7f1cb475);
  }

  //The user calls this function when they want to create a wager
  function createWager(uint _expiration, uint _desiredWeightChange, string _smartScaleID) public payable {
    //This payable function should automatically receive the ether
    //which is fine! because now if there are problems we can just revert.
    //But we need to remember to send the ether back in case the callback fails for some reason.

    string memory oraclizeURL = strConcat("json(http://eastern-period-211120.appspot.com/", _smartScaleID, "/0).value");

    //DJSFIXME Uncomment this when you're ready to test verification
    bytes32 myID = oraclize_query("URL", oraclizeURL);

    //DJSFIXME Uncomment this when you are just messing around. Delete this before submitting.
    //bytes32 myID = oraclize_query("URL", "json(https://api.coinbase.com/v2/prices/ETH-USD/spot).data.amount");
    wagersBeingActivated[myID] = Wager(now + _expiration, _desiredWeightChange, msg.value, _smartScaleID, msg.sender, 0);
    emit WagerCreated(now + _expiration, _desiredWeightChange, msg.value, _smartScaleID);
  }

  event WantToSend(uint, uint, uint);
  
  function __callback(bytes32 myid, string result) public {
    if (msg.sender != oraclize_cbAddress()) revert();
    if (wagersBeingActivated[myid].wagerer != address(0)) {
      Wager memory newWager = wagersBeingActivated[myid];
      newWager.startWeight = parseInt(result);
      wagers[newWager.wagerer].push(newWager);
      delete wagersBeingActivated[myid];
      emit WagerActivated(newWager.wagerer, newWager.wagerAmount);
      //DJSFIXME Maybe include a modifier to delete the wager from wagersBeingActivated
      //         on function exit no matter what, so that wagersBeingActivated doesn't
      //         slowly bloat into tons of data that no one needs
    } else if (wagersBeingVerified[myid].wagerer != address(0)) {
      VerifyingWager memory myVerifyingWager = wagersBeingVerified[myid];
      Wager memory wagerToVerify = wagers[myVerifyingWager.wagerer][myVerifyingWager.wagerIndex];
      delete wagersBeingVerified[myid];
      if (parseInt(result) <= (wagerToVerify.startWeight - wagerToVerify.desiredWeightChange)) {
        //DJSFIXME then Send wagerToVerify.wagerAmount * rewardMultipier / 100 to wagerToVerify.wagerer.
        emit WantToSend(rewardMultiplier, wagerToVerify.wagerAmount, wagerToVerify.wagerAmount * rewardMultiplier/100);
        emit WagerVerified(wagerToVerify.wagerer, wagerToVerify.wagerAmount);
        //emit WagerVerified(parseInt(result), wagerToVerify.startWeight, wagerToVerify.desiredWeightChange);
      } else {
        emit WagerUnchanged(myid);
        //DJSFIXME Maybe include a modifier to delete the wager from wagersBeingVerified
        //         on function exit no matter what, so that wagersBeingVerified doesn't
        //         slowly bloat into tons of data that no one needs
      }
    }
    //DJSFIXME else (if myid is nowhere)
    //DJSFIXME then emit InvalidWager(myid);
    //DJSFIXME then do nothing?
  }

  function verifyWager(uint _wagerIndex) public {
    Wager memory wagerToVerify = wagers[msg.sender][_wagerIndex];
    if (wagerToVerify.expiration < now) {
      delete wagers[msg.sender][_wagerIndex];
      emit WagerExpired(msg.sender, wagerToVerify.wagerAmount);
    } else {
      //DJSFIXME This is an artifact of when I was doing the time diff thing. Delete if you decide to not do time diffs.
      //string memory timeDiff = uint2str(now - wagerToVerify.expiration);
      string memory oraclizeURL = strConcat("json(http://eastern-period-211120.appspot.com/", wagerToVerify.smartScaleID, "/1).value");
      bytes32 myID = oraclize_query("URL", oraclizeURL);
      wagersBeingVerified[myID] = VerifyingWager(msg.sender, _wagerIndex);
      emit WagerBeingVerified(msg.sender, _wagerIndex);
    }
  }

  function getWagers() public view returns (uint[] expirations, uint[] desiredWeightChanges, uint[] values) {
    expirations = new uint[](wagers[msg.sender].length);
    desiredWeightChanges = new uint[](wagers[msg.sender].length);
    values = new uint[](wagers[msg.sender].length);

    for (uint ii = 0; ii < wagers[msg.sender].length; ii++) {
        Wager memory wager = wagers[msg.sender][ii];
        expirations[ii] = wager.expiration;
        desiredWeightChanges[ii] = wager.desiredWeightChange;
        values[ii] = wager.wagerAmount;
    }

    return (expirations, desiredWeightChanges, values);
  }

}

