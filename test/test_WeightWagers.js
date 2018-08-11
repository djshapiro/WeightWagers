const WeightWagers = artifacts.require('WeightWagers');

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

function logWatchPromiseTwice(_event) {
  return logWatchPromise(_event, 2);
}

contract('WeightWagers', accounts => {
  const chubbs = accounts[0]; // Chubbs will never lose weight :(
  const owner = "0x0000000000000000000000000000000000000000"
  const al_roker = accounts[2]; // Al will lose weight very quickly
  const billy_halleck = accounts[3]; // Billy is cursed and will lose weight gradually
  
  /*it('calling createWager should emit a WagerCreated event follow by a WagerActivated event', async () => {
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
    //that he has a wager.
    const chubbsWagers = await weightWagers.getWagers({from: chubbs});
    assert.equal(chubbsWagers[1][0], 20, 'Chubbs does not have the correct target weight');
    assert.equal(chubbsWagers[2][0], 23456, 'Chubbs does not have the correct amount');

    //And just for a reality check, make sure Al has no wagers.
    const alWagers = await weightWagers.getWagers({from: al_roker});
    assert.deepEqual(alWagers[1], [], "Al's target weights are not an empty array");
    assert.deepEqual(alWagers[2], [], "Al's wager amounts are not an empty array");

  });
  
  it('create a wager and attempt to verify it without having lost the weight', async () => {
    const weightWagers = await WeightWagers.deployed();

    const verifyResponse = await weightWagers.verifyWager(0, {from: chubbs});
    log = verifyResponse.logs[0];
    assert.equal(log.event, 'WagerBeingVerified', 'WagerBeingVerified not emitted.');

    //Set up listener to make sure the wager gets
    //activated once the oracle returns data.
    const logScaleWatcher = logWatchPromise(weightWagers.WagerUnchanged({ fromBlock: 'latest'} ));
    log = await logScaleWatcher;
    assert.equal(log.event, 'WagerUnchanged', 'WagerUnchanged not emitted.');

    //Finally, call getWagers() for Chubbs to ensure
    //that he still has a wager.
    const chubbsWagers = await weightWagers.getWagers({from: chubbs});
    assert.equal(chubbsWagers[1][0], 20, 'Chubbs does not have the correct target weight');
    assert.equal(chubbsWagers[2][0], 23456, 'Chubbs does not have the correct amount');
  });

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

    const verifyResponse = await weightWagers.verifyWager(0, {from: al_roker});
    log = verifyResponse.logs[0];
    assert.equal(log.event, 'WagerBeingVerified', 'WagerBeingVerified not emitted.');

    const alBeginningBalance = await web3.eth.getBalance(al_roker)

    //Set up listener to make sure the wager gets
    //activated once the oracle returns data.
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
  });*/
  
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

  it('Verify that owners can emergency stop the createWager function', async () => {
    const weightWagers = await WeightWagers.deployed();
    console.log(chubbs);
    console.log(owner);

    //Emergency stop the contract
    const response = await weightWagers.setStopped(true, {from: owner});
    console.log(response.logs[0].args);

    //await weightWagers.createWager(1000, 20, "always200Pounds", {from: owner, value: 23456});
    /*let log = response.logs[0];
    assert.equal(log.event, 'WagerCreated', 'WagerCreated not emitted.');*/
  });
});



