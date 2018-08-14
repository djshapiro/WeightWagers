const WeightWagers = artifacts.require('WeightWagers');

//Helper function for watching for asynchronous events.
//This is necessary when oraclizing.
function logWatchPromise(_event, numOfTimes = 1) {
  return new Promise((resolve, reject) => {
    let numCalls = 0;
    _event.watch((error, log) => {
      numCalls = numCalls + 1;
      if (numCalls >= numOfTimes) {
        _event.stopWatching();
        if (error !== null)
          reject(error);

        resolve(log);
      }
    });
    //Time out after 15 seconds
    setTimeout(() => reject('timed out'), 30000);
  });
}

//Helper functional for watching for two of an event
function logWatchPromiseTwice(_event) {
  return logWatchPromise(_event, 2);
}

contract('WeightWagers', accounts => {
  const chubbs = accounts[0]; // Chubbs will never lose weight :(
  const owner = accounts[1]; //The person who owns the contract
  const al_roker = accounts[2]; // Al will lose weight very quickly
  const billy_halleck = accounts[3]; // Billy is cursed and will lose weight gradually
  
  //This test is simply for
  //  1) creating a wager
  //  2) making sure that the oraclized smart scale data returns and activates the wager
  it('calling createWager should emit a WagerCreated event follow by a WagerActivated event', async () => {
    const weightWagers = await WeightWagers.deployed();

    //Chubbs creates a wager.
    const response = await weightWagers.createWager(1000, 20, "always200Pounds", {from: chubbs, value: 23456});
    let log = response.logs[0];
    assert.equal(log.event, 'WagerCreated', 'WagerCreated not emitted.');

    //Set up listener to make sure the wager gets
    //activated once the oracle returns data.
    const logScaleWatcher = logWatchPromise(weightWagers.WagerActivated({ fromBlock: 'latest'} ));
    log = await logScaleWatcher;
    assert.equal(log.event, 'WagerActivated', 'WagerActivated not emitted.');

    //Finally, call getWagers() for Chubbs to ensure
    //we can see his activated wager.
    const chubbsWagers = await weightWagers.getWagers({from: chubbs});
    assert.equal(chubbsWagers[1][0], 20, 'Chubbs does not have the correct target weight');
    assert.equal(chubbsWagers[2][0], 23456, 'Chubbs does not have the correct amount');

    //And just for a reality check, make sure Al has no wagers,
    //since he hasn't created any wagers.
    const alWagers = await weightWagers.getWagers({from: al_roker});
    assert.deepEqual(alWagers[1], [], "Al's target weights are not an empty array");
    assert.deepEqual(alWagers[2], [], "Al's wager amounts are not an empty array");

  });
  
  //This test relies on data from the first test.
  //Here we attempt to
  //  1) verify the wager created in the first test
  //  2) make sure that the oraclized smart scale data returns and continues the verification process
  //  3) make sure the contract emits the "WagerUnchanged" event since Chubbs hasn't lost the weight yet
  it('create a wager and attempt to verify it without having lost the weight', async () => {
    const weightWagers = await WeightWagers.deployed();

    //Begin the verification process
    const verifyResponse = await weightWagers.verifyWager(0, {from: chubbs});
    log = verifyResponse.logs[0];
    assert.equal(log.event, 'WagerBeingVerified', 'WagerBeingVerified not emitted.');

    //Make sure the wager is unchanged after verification completes
    const logScaleWatcher = logWatchPromise(weightWagers.WagerUnchanged({ fromBlock: 'latest'} ));
    log = await logScaleWatcher;
    assert.equal(log.event, 'WagerUnchanged', 'WagerUnchanged not emitted.');

    //Finally, call getWagers() for Chubbs to ensure
    //that he still has a wager.
    const chubbsWagers = await weightWagers.getWagers({from: chubbs});
    assert.equal(chubbsWagers[1][0], 20, 'Chubbs does not have the correct target weight');
    assert.equal(chubbsWagers[2][0], 23456, 'Chubbs does not have the correct amount');
  });

  //This test involves attempting to verify a wager after it has expired.
  //The steps involved:
  //  1) Create a wager that expires in one second
  //  2) Wait for that wager to get activated
  //  3) Verify the new wager
  //  4) Get the WagerExpired event
  //  5) Verify that the new wager has been deleted
  it('create a wager and attempt to verify it after it has expired', async () => {
    const weightWagers = await WeightWagers.deployed();

    //First, make sure Chubbs only has one wager to start with
    let chubbsWagers = await weightWagers.getWagers({from: chubbs});
    assert.equal(chubbsWagers[1][0], 20, "Chubbs' first wager has an incorrect desired weight change");
    assert.equal(chubbsWagers[1][1], undefined, "Chubbs' second wager has a desired weight change.");

    //Chubbs creates a wager.
    const response = await weightWagers.createWager(1, 40, "always200Pounds", {from: chubbs});
    let log = response.logs[0];
    assert.equal(log.event, 'WagerCreated', 'WagerCreated not emitted.');

    //Set up listener to make sure the wager gets
    //activated once the oracle returns data.
    const logScaleWatcher = logWatchPromise(weightWagers.WagerActivated({ fromBlock: 'latest'} ));
    log = await logScaleWatcher;
    assert.equal(log.event, 'WagerActivated', 'WagerActivated not emitted.');

    //Now that we created the second wager, let's check Chubbs' wagers again
    chubbsWagers = await weightWagers.getWagers({from: chubbs});
    assert.equal(chubbsWagers[1][0], 20, "Chubbs' first wager has an incorrect desired weight change");
    assert.equal(chubbsWagers[1][1], 40, "Chubbs' second wager has an incorrect desired weight change");

    //Begin the verification process on just the new wager and
    //immediately get back the WagerExpired event
    const verifyResponse = await weightWagers.verifyWager(1, {from: chubbs});
    log = verifyResponse.logs[0];
    assert.equal(log.event, 'WagerExpired', 'WagerExpired not emitted.');

    //Since that wager is expired, Chubbs should again only have one wager to his name
    chubbsWagers = await weightWagers.getWagers({from: chubbs});
    assert.equal(chubbsWagers[1][0], 20, "Chubbs' first wager has an incorrect desired weight change");
    //Because we deleted the wager, it still exists but all the fields are
    //reinitialized to zero
    assert.equal(chubbsWagers[1][1], 0, "Chubbs' second wager has a desired weight change that isn't zero.");
  });

  //This test is for verifying a wager that the user has successfully completed
  //  1) Create a wager
  //  2) Wait for the wager to activate
  //  3) Verify the wager
  //  4) Wait for contract to emit the "WagerVerified" event
  //  5) Verify that the user was given their initial wager plus a 3.1% reward
  //  6) Verify that the wager has been deleted
  it('create a wager and attempt to verify it after having lost the weight', async () => {
    const weightWagers = await WeightWagers.deployed();

    //Al creates a wager.
    const response = await weightWagers.createWager(1000, 100, "losesAllWeightImmediately", {from: al_roker, value: 195000});
    let log = response.logs[0];
    assert.equal(log.event, 'WagerCreated', 'WagerCreated not emitted.');

    //Set up listener to make sure the wager gets
    //activated once the oracle returns data.
    let logScaleWatcher = logWatchPromise(weightWagers.WagerActivated({ fromBlock: 'latest'} ));
    log = await logScaleWatcher;
    assert.equal(log.event, 'WagerActivated', 'WagerActivated not emitted.');

    //Begin the verification process
    const verifyResponse = await weightWagers.verifyWager(0, {from: al_roker});
    log = verifyResponse.logs[0];
    assert.equal(log.event, 'WagerBeingVerified', 'WagerBeingVerified not emitted.');

    const alBeginningBalance = await web3.eth.getBalance(al_roker)

    //Wait to get the WagerVerified event
    logScaleWatcher = logWatchPromise(weightWagers.WagerVerified({ fromBlock: 'latest'} ));
    log = await logScaleWatcher;
    assert.equal(log.event, 'WagerVerified', 'WagerVerified not emitted.');

    //let's find out if Al got paid
    const alEndingBalance = await web3.eth.getBalance(al_roker);

    //The Al should have earned a 3.1% return on his original wager
    assert.equal(alEndingBalance.minus(alBeginningBalance), Math.round(195000 * 1.031), "al didn't get paid the right amount");

    //Let's make sure Al has no wagers
    const alWagers = await weightWagers.getWagers({from: al_roker});
    assert.equal(alWagers[1][0], 0, 'Al does not have the correct target weight');
    assert.equal(alWagers[2][0], 0, 'Al does not have the correct amount');
  });

  //This test makes sure that the verifyWagers method verifies all
  //of the user's wagers
  //  1) Create two wagers
  //  2) Wait for both to activate
  //  3) Call verifyWagers
  //  4) Wait for contract to emit "WagerVerified" twice, denoting that both wagers were verified
  //  5) Verify that the wagers were deleted
  //  6) Verify that running verifyWagers again doesn't do anything
  it("verifyWagers verifies both of an address' active wagers", async () => {
    const weightWagers = await WeightWagers.deployed();

    //Create Billy's first wager
    let response = await weightWagers.createWager(1000, 20, "losesAllWeightImmediately", {from: billy_halleck, value: 34567});
    let log = response.logs[0];
    assert.equal(log.event, 'WagerCreated', 'WagerCreated not emitted.');

    let logScaleWatcher = logWatchPromise(weightWagers.WagerActivated({ fromBlock: 'latest'} ));
    log = await logScaleWatcher;
    assert.equal(log.event, 'WagerActivated', 'WagerActivated not emitted.');

    //Create Billy's second wager
    response = await weightWagers.createWager(1000, 20, "losesAllWeightImmediately", {from: billy_halleck, value: 45678});
    log = response.logs[0];
    assert.equal(log.event, 'WagerCreated', 'WagerCreated not emitted.');

    logScaleWatcher = logWatchPromise(weightWagers.WagerActivated({ fromBlock: 'latest' } ));
    log = await logScaleWatcher;
    assert.equal(log.event, 'WagerActivated', 'WagerActivated not emitted.');

    //Make sure we have two wagers
    let billyWagers = await weightWagers.getWagers({from: billy_halleck});
    assert.equal(billyWagers[2][0], 34567, 'Billy\' first wager does not have the correct amount');
    assert.equal(billyWagers[2][1], 45678, 'Billy\'s second wager does not have the correct amount');

    //Now let's try verifying both wagers
    weightWagers.verifyWagers({from: billy_halleck});

    logScaleWatcher = logWatchPromiseTwice(weightWagers.WagerVerified({ fromBlock: 'latest'} ));
    log = await logScaleWatcher;
    assert.equal(log.event, 'WagerVerified', 'WagerVerified not emitted.');

    //Make sure we have no wagers since both have been verified
    billyWagers = await weightWagers.getWagers({from: billy_halleck});
    assert.equal(billyWagers[2][0], 0, 'Billy\' first wager does not have the correct amount');
    assert.equal(billyWagers[2][1], 0, 'Billy\'s second wager does not have the correct amount');

    //Try verifying again to make sure that verified wagers don't go through the verification process again
    const verifyWagersResponse = await weightWagers.verifyWagers({from: billy_halleck});
    assert.equal(verifyWagersResponse.logs.length, 0, 'Billy\'s verifyWagers call emitted some events even though nothing should have been verified');
  });

  //This test ensures that addresses that aren't the owner
  //can't call functions that have the isOwner modifier
  it('Verify that non-owners cannot run functions that have the isOwner modifier', async () => {
    const weightWagers = await WeightWagers.deployed();

    //Chubbs tries to call setStopped
    try {
      const response = await weightWagers.setStopped(true, {from: chubbs});
    } catch (e) {
      //Chubbs should get a revert error because he's not the owner
      assert.isTrue(e.message.startsWith("VM Exception while processing transaction: revert"));
    }
  });

  //This test ensures thas the emergency stop does its job
  //  1) Emergency stop the contract
  //  2) Attempt to create a wager and get a revert error - this is the expected behavior when the contract is stopped
  //  3) Emergency start the contract
  //  4) Attempt to create a wager and don't get an error
  it('Verify that the owner can emergency stop the createWager function', async () => {
    const weightWagers = await WeightWagers.deployed();

    //Emergency stop the contract
    let response = await weightWagers.setStopped(true, {from: owner});

    //Owner now tries to make a wager
    try {
      response = await weightWagers.createWager(1000, 20, "always200Pounds", {from: owner, value: 23456});
    } catch (e) {
      //Owner can't make a wager!
      assert.isTrue(e.message.startsWith("VM Exception while processing transaction: revert"));
    }
    
    //Emergency start the contract
    await weightWagers.setStopped(false, {from: owner});

    //Owner now tries to make the same wager. If createWager doesn't error,
    //then this is a passing test for our purposes.
    await weightWagers.createWager(1000, 20, "always200Pounds", {from: owner, value: 23456});
  });
});



