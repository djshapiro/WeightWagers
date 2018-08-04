import React, { Component } from 'react'
import WeightWagers from '../build/contracts/WeightWagers.json'
import getWeb3 from './utils/getWeb3'
import WeightWagersPng from './assets/WeightWagers.png'
import _ from 'underscore';
import NotificationSystem from 'react-notification-system';

import './css/oswald.css'
import './css/open-sans.css'
import './css/pure-min.css'
import './App.css'

class App extends Component {
  constructor(props) {
    super(props);

    this.state = {
      web3: null,
      wagers: null,
      weightWagersInstance: null,
      account: null,
    }

    this.instantiateContract = this.instantiateContract.bind(this);
    this.contractEvent = this.contractEvent.bind(this);
  }

  componentWillMount() {
    // Get network provider and web3 instance.
    // See utils/getWeb3 for more info.

    getWeb3
    .then(results => {
      this.setState({
        web3: results.web3
      })

      // Instantiate contract once web3 provided.
      this.instantiateContract()
    })
    .catch(() => {
      console.log('Error finding web3.')
    })
  }

  /*componentDidMount() {
    this._notificationSystem = this.refs.notificationSystem;
  }*/

  transformWagers(result) {
    let wagers;
    const organizedWagers = _.zip(result[0], result[1], result[2]);
    if (organizedWagers.length === 0) {
      wagers = null;
    } else {
      const unfilteredWagers = organizedWagers.map((wager) => {
        return [
          (new Date(wager[0].toNumber() * 1000)).toUTCString(),
          wager[1].toNumber(),
          wager[2].toNumber(),
        ];
      });
      wagers = _.filter(unfilteredWagers, (wager) => {
        return wager[1] !== 0;
      });
    }
    return wagers;
  }

  instantiateContract() {
    /*
     * SMART CONTRACT EXAMPLE
     *
     * Normally these functions would be called in the context of a
     * state management library, but for convenience I've placed them here.
     */

    const contract = require('truffle-contract')
    const weightWagers = contract(WeightWagers)
    weightWagers.setProvider(this.state.web3.currentProvider)

    // Declaring this for later so we can chain functions on SimpleStorage.
    var weightWagersInstance;
    var _this = this;

    // Get accounts.
    this.state.web3.eth.getAccounts((error, accounts) => {
      weightWagers.deployed().then((instance) => {
        weightWagersInstance = instance

        /*weightWagersInstance.WagerCreated((err, value) => {
          console.log(JSON.stringify(value, null, 2));
        });*/
        const createWagerEvent = weightWagersInstance.WagerCreated();
        const activateWagerEvent = weightWagersInstance.WagerActivated();
        const beingVerifiedEvent = weightWagersInstance.WagerBeingVerified();
        const verifiedWagerEvent = weightWagersInstance.WagerVerified();
        const expiredWagerEvent = weightWagersInstance.WagerExpired();
        const unchangedWagerEvent = weightWagersInstance.WagerUnchanged();

        /*createWagerEvent.watch(function(error, result){
          console.log('WagerCreated was emitted');
          console.log({error, result});
          if(!error) {
            console.log(result);
          }
        });

        activateWagerEvent.watch(function(error, result){
          console.log('WagerActivated was emitted');
          console.log({error, result});
          if(!error) {
            console.log(result);
          }
        });

        beingVerifiedEvent.watch(function(error, result){
          console.log('WagerBeingVerified was emitted');
          console.log({error, result});
          if(!error) {
            console.log(result);
          }
        });

        verifiedWagerEvent.watch(function(error, result){
          console.log('WagerVerified was emitted');
          console.log({error, result});
          if(!error) {
            console.log(result);
          }
        });

        expiredWagerEvent.watch(function(error, result){
          console.log('WagerExpired was emitted');
          console.log({error, result});
          if(!error) {
            console.log(result);
          }
        });

        unchangedWagerEvent.watch(function(error, result){
          console.log('WagerUnchanged was emitted');
          console.log({error, result});
          if(!error) {
            console.log(result);
          }
        });*/




        return weightWagersInstance.getWagers({from: accounts[0]});
      }).then((result, err) => {
        //Returning an array of arrays in the best way
        //Solidity can return all the user's wagers, so
        //lets transform the data into a useful format
        const wagers = this.transformWagers(result);
        _this.setState({
          wagers: wagers,
          weightWagersInstance: weightWagersInstance,
          account: accounts[0],
        });
        this._notificationSystem = this.refs.notificationSystem;
      //  return weightWagersInstance.verifyWagers({from: accounts[0]});
      //}).then((result, err) => {
      //  console.log(result);

        //return weightWagersInstance.createWager(20, 30, "always200Pounds", {from: accounts[0]});

        // Stores a given value, 5 by default.
      /*  return simpleStorageInstance.set(5, {from: accounts[0]})
      }).then((result) => {
        // Get the value from the contract to prove it worked.
        return simpleStorageInstance.get.call(accounts[0])
      }).then((result) => {
        // Update state with the result.
        return this.setState({ storageValue: result.c[0] })*/
      })
    })
  }

  contractEvent(err, value) {
    console.log(JSON.stringify(value, null, 2));
  }

  onFormSubmit(a, b, c) {
    const expiration = this.expiration || 0;
    const desiredWeightChange = this.desiredWeightChange || 0;
    const scaleID = this.scaleID || "losesAllWeightImmediately";
    const amountToWager = this.amountToWager || 0;

    //Notify the user that creation has begun
    this._notificationSystem.addNotification({
      message: 'Creating your wager...',
      level: 'success',
      uid: 'creating-wager',
      autoDismiss: 0,
    });

    var _this = this;

    //Create the wager
    this.state.weightWagersInstance.createWager(expiration, desiredWeightChange, scaleID, {from: this.state.account, value: amountToWager}).then( (result, err) => {

      //Listen to the activate wager event
      const activateWagerEvent = _this.state.weightWagersInstance.WagerActivated();
      activateWagerEvent.watch(function(error, result){
        
        //Wager was activated, so now let's get the wagers again
        _this.state.weightWagersInstance.getWagers({from: _this.state.account}).then( (result, err) => {
          const wagers = _this.transformWagers(result);
          _this.setState({
            wagers: wagers,
          });
          _this._notificationSystem.removeNotification({
            uid: 'creating-wager',
          });
        });
      });
    //DJSFIXME Have to add a listener to watch for a WagerActivated event with the sender's address
    });
  }

  onVerifyWagersClick() {
    this._notificationSystem.addNotification({
      message: 'Verifying your wagers...',
      level: 'success',
      uid: 'verifying-wagers',
      autoDismiss: 0,
    });

    var _this = this;
    this.state.weightWagersInstance.verifyWagers({from: this.state.account}).then( (result, err) => {
      const verifiedWagerEvent = _this.state.weightWagersInstance.WagerVerified();
      const expiredWagerEvent = _this.state.weightWagersInstance.WagerExpired();
      const unchangedWagerEvent = _this.state.weightWagersInstance.WagerUnchanged();

      const onEventCallback = () => {
        _this.state.weightWagersInstance.getWagers({from: _this.state.account}).then( (result, err) => {
          const wagers = _this.transformWagers(result);
          _this.setState({
            wagers: wagers,
          });
          _this._notificationSystem.removeNotification({
            uid: 'verifying-wagers',
          });
        });
      };

      verifiedWagerEvent.watch(function(error, result){
        onEventCallback();
      });

      expiredWagerEvent.watch(function(error, result){
        onEventCallback();
      });

      unchangedWagerEvent.watch(function(error, result){
        onEventCallback();
      });

    });
  }

  handleInputChange(inputName, e) {
    this[inputName] = e.target.value;
  }

  render() {
    return (
      <div className="App">
        <NotificationSystem ref="notificationSystem" />
        <nav className="navbar pure-menu pure-menu-horizontal">
            <a href="#" className="pure-menu-heading pure-menu-link">Truffle Box</a>
        </nav>

        <main className="container">
          <div className="pure-g">
            <div className="pure-u-1-1">
              <img src={WeightWagersPng} className="logoImage"/>
              {this.state.wagers && this.state.wagers.length > 0 && 
                <div>
                  <div>
                    <h1>Your wagers</h1>
                    <table>
                      <tbody>
                        <tr>
                          <th> expiration </th>
                          <th> desired weight change </th>
                          <th> wager amount </th>
                          <th> start weight </th>
                        </tr>
                        {this.state.wagers.map( (wager) => {
                          if (wager[0] !== 0) {
                            return (
                              <tr key={wager.expiration}>
                                <td>{wager[0]}</td>
                                <td>{wager[1]}</td>
                                <td>{wager[2]}</td>
                              </tr>
                            );
                          }})
                        }
                      </tbody>
                    </table>
                  </div>
                  <div className="submitButtonDiv">
                    <button type="submit" onClick={this.onVerifyWagersClick.bind(this)} className="submitButton">Verify Wagers</button>
                  </div>
                </div>
              }
              {(!this.state.wagers || this.state.wagers.length === 0) &&
                <div>
                  <h1>You have no active wagers</h1>
                </div>
              }
              {!this.state.account &&
                <div>
                  <h1>
                    Log in with metamask and refresh this page
                  </h1>
                </div>
              }
              {this.state.account && 
                <div>
                  <h1>Create a new wager</h1>
                  <div className="inputDiv">
                    <label htmlFor="expiration">Expiration (in seconds)</label>
                    <input name="expiration" id="expiration" onChange={this.handleInputChange.bind(this, "expiration")} autoFocus type="number" className="wagerInput"/>
                  </div>
                  <div className="inputDiv">
                    <label htmlFor="desiredWeightChange">Desired Weight Change (in lbs)</label>
                    <input name="desiredWeightChange" id="desiredWeightChange" onChange={this.handleInputChange.bind(this, "desiredWeightChange")} type="number" className="wagerInput"/>
                  </div>
                  <div className="inputDiv">
                    <label htmlFor="scaleID">Smart Scale ID</label>
                    <select name="scaleID" id="scaleID" onChange={this.handleInputChange.bind(this, "scaleID")} className="wagerInput">
                      <option value="losesAllWeightImmediately">Do lose the weight</option>
                      <option value="always200Pounds">Do NOT lose the weight</option>
                    </select>
                  </div>
                  <div className="inputDiv">
                    <label htmlFor="amountToWager">Amount to wager (in wei)</label>
                    <input name="amountToWager" id="amountToWager" onChange={this.handleInputChange.bind(this, "amountToWager")} type="number" className="wagerInput"/>
                  </div>
                  <div className="submitButtonDiv">
                    <button type="submit" onClick={this.onFormSubmit.bind(this)} className="submitButton">Create Wager</button>
                  </div>
                </div>
              }
            </div>
          </div>
        </main>
      </div>
    );
  }
}

export default App
