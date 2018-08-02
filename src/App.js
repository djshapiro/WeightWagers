import React, { Component } from 'react'
import WeightWagers from '../build/contracts/WeightWagers.json'
import getWeb3 from './utils/getWeb3'
import WeightWagersPng from './assets/WeightWagers.png'
import _ from 'underscore';

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

        /*weightWagersInstance.GettingWagers((err, value) => {
          console.log(JSON.stringify(value, null, 2));
        });
        weightWagersInstance.WagerCreated((err, value) => {
          console.log(JSON.stringify(value, null, 2));
        });*/
        return weightWagersInstance.getWagers({from: accounts[0]});
      }).then((result, err) => {
        //Returning an array of arrays in the best way
        //Solidity can return all the user's wagers, so
        //lets transform the data into a useful format
        let wagers;
        const organizedWagers = _.zip(result[0], result[1], result[2]);
        if (organizedWagers.length === 0) {
          wagers = null;
        } else {
          //DJSFIXME I think we need to underscore filter in order to not show
          //"deleted" wagers
          const unfilteredWagers = organizedWagers.map((wager) => {
            return [
              (new Date(wager[0].toNumber() * 1000)).toUTCString(),
              wager[1].toNumber(),
              wager[2].toNumber(),
            ];
          });
          wagers = _.filter(unfilteredWagers, (wager) => {
            return wager[1] != 0;
          });
        }
        _this.setState({
          wagers: wagers,
          weightWagersInstance: weightWagersInstance,
          account: accounts[0],
        });
        return weightWagersInstance.verifyWagers({from: accounts[0]});
      }).then((result, err) => {
        console.log(result);

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
    const expiration = this.expiration;
    const desiredWeightChange = this.desiredWeightChange;
    const scaleID = this.scaleID;
    const amountToWager = this.amountToWager;
    this.state.weightWagersInstance.createWager(expiration, desiredWeightChange, scaleID, {from: this.state.account, value: amountToWager});
    //DJSFIXME Have to add a listener to watch for a WagerActivated event with the sender's address
  }

  handleInputChange(inputName, e) {
    this[inputName] = e.target.value;
  }

  render() {
    return (
      <div className="App">
        <nav className="navbar pure-menu pure-menu-horizontal">
            <a href="#" className="pure-menu-heading pure-menu-link">Truffle Box</a>
        </nav>

        <main className="container">
          <div className="pure-g">
            <div className="pure-u-1-1">
              <img src={WeightWagersPng} className="logoImage">
              </img>
              {this.state.wagers && this.state.wagers.length > 0 && 
                <div>
                  <h2>Your wagers</h2>
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
              }
              {!this.state.wagers || this.state.wagers.length === 0 &&
                <div>
                  <h2>You have no active wagers</h2>
                </div>
              }
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
                <input name="scaleID" id="scaleID" onChange={this.handleInputChange.bind(this, "scaleID")} className="wagerInput"/>
              </div>
              <div className="inputDiv">
                <label htmlFor="amountToWager">Amount to wager (in wei)</label>
                <input name="amountToWager" id="amountToWager" onChange={this.handleInputChange.bind(this, "amountToWager")} type="number" className="wagerInput"/>
              </div>
              <div className="submitButtonDiv">
                <button type="submit" onClick={this.onFormSubmit.bind(this)} className="submitButton">Create Wager</button>
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }
}

export default App
