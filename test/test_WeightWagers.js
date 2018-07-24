const WeightWagers = artifacts.require('WeightWagers');

function logWatchPromise(_event) {
  return new Promise((resolve, reject) => {
    _event.watch((error, log) => {
      _event.stopWatching();
      if (error !== null)
        reject(error);

      resolve(log);
    });
  });
}

/*//helper function for waiting for the creation and activation of wagers
//DJSFIXME Try this at some point
function createAndActivateWager(wagerContract, args, txDetails) {

  //Wait for create
  const createResponse = await wagerContract.createWager(args.exp, args.target, args.scaleID, txDetails);

  //Wait for activate
  const logScaleWatcher = logWatchPromise(wagerContract.WagerActivated({ fromBlock: 'latest'} ));
  const activateResponse = await logScaleWatcher;

  //Great!
  return { createResponse, activateResponse };
}

function verifyWagerAndWaitForEvent(wagerContract, args, txDetails, eventToWaitFor) {
  //Verify
  const verifyResponse = await wagerContract.verifyWager(args.wagerIndex, txDetails);

  //Promisify
  const logScaleWatcher = logWatchPromise(wagerContract[eventToWaitFor]({ fromBlock: 'latest'} ));
  const eventResponse = await logScaleWatcher;

  //Bye!
  return { verifyResponse, eventResponse };
}*/

contract('WeightWagers', accounts => {
  const owner = accounts[0];
  const alice = accounts[1];
  const bob = accounts[2];
  
  
  it('calling createWager should emit a WagerCreated event follow by a WagerActivated event', async () => {
    const weightWagers = await WeightWagers.deployed();
    const expiration = 30;
    const weightChange = 20;
    const smartScaleId = "always200Pounds";

    //Alice creates a wager.
    const response = await weightWagers.createWager(expiration, weightChange, smartScaleId, {from: alice});
    let log = response.logs[0];
    assert.equal(log.event, 'WagerCreated', 'WagerCreated not emitted.');

    //Set up listener to make sure the wager gets
    //activated once the oracle returns data.
    const logScaleWatcher = logWatchPromise(weightWagers.WagerActivated({ fromBlock: 'latest'} ));
    log = await logScaleWatcher;
    assert.equal(log.event, 'WagerActivated', 'WagerActivated not emitted.');

    //Finally, call getWagers() for Alice to ensure
    //that she has a wager.
    const aliceWagers = await weightWagers.getWagers({from: alice});
    assert.equal(aliceWagers[0][0], expiration, 'alice does not have the correct expiration date on her wager');
    assert.equal(aliceWagers[1][0], weightChange, 'alice does not have the correct target weight');
    assert.equal(aliceWagers[2][0], 0, 'alice does not have the correct amount');

    //Just for a reality check, make sure bob has no wagers.
    const bobWagers = await weightWagers.getWagers();
    assert.deepEqual(bobWagers[0], [], "bob's expiration dates are not an empty array");
    assert.deepEqual(bobWagers[1], [], "bob's target weights are not an empty array");
    assert.deepEqual(bobWagers[2], [], "bob's wager amounts are not an empty array");

  });
  
  it('create a wager and attempt to verify it without having lost the weight', async () => {
    const weightWagers = await WeightWagers.deployed();

    //Alice creates a wager that expires very far in the future
    const response = await weightWagers.createWager(10000, 20, 'always200Pounds', {from: alice});
    let log = response.logs[0];
    assert.equal(log.event, 'WagerCreated', 'WagerCreated not emitted.');

    //Set up listener so we can pause execution
    //until wager is activated
    const logScaleWatcher = logWatchPromise(weightWagers.WagerActivated({ fromBlock: 'latest'} ));
    log = await logScaleWatcher;

    const verifyResponse = await weightWagers.verifyWager(0, {from: alice});
    log = verifyResponse.logs[0];
  });

  it('create a wager and attempt to verify it after having lost the weight', async () => {
    const weightWagers = await WeightWagers.deployed();
  });

  it('create a wager and attempt to verify it after it has expired', async () => {
    const weightWagers = await WeightWagers.deployed();
  });

  it('attempt to verify a wager that does not exist', async () => {
    const weightWagers = await WeightWagers.deployed();
  });

});



