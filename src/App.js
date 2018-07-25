import React, { Component } from 'react'
import WeightWagers from '../build/contracts/WeightWagers.json'
import getWeb3 from './utils/getWeb3'
import _ from 'underscore';

import './css/oswald.css'
import './css/open-sans.css'
import './css/pure-min.css'
import './App.css'

class App extends Component {
  constructor(props) {
    super(props);

    this.state = {
      storageValue: 0,
      web3: null,
      wagers: null,
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
        console.log({result, err});

        //Solidity can't return a deep object, so
        //in order to get all the user's wagers,
        //we have to deal with an array of arrays.
        const organizedWagers = _.zip(result[0], result[1], result[2]);
        const wagers = organizedWagers.length === 0 ? null : organizedWagers;
        this.setState({
          wagers: wagers
        });
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
    console.log({expiration, desiredWeightChange, scaleID, amountToWager});
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
              {this.state.wagers && 
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
                        return (
                          <tr>
                            <td>{(new Date(wager[0].toNumber() * 1000)).toUTCString()}</td>
                            <td>{wager[1].toNumber()}</td>
                            <td>{wager[2].toNumber()}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              }
              <h2>Create a new wager</h2>
              <input name="expiration" placeholder="expiration" onChange={this.handleInputChange.bind(this, "expiration")}/>
              <input name="desiredWeightChange" placeholder="desired weight change" onChange={this.handleInputChange.bind(this, "desiredWeightChange")}/>
              <input name="scaleID" placeholder="scaleID" onChange={this.handleInputChange.bind(this, "scaleID")}/>
              <input name="amountToWager" placeholder="amount to wager" onChange={this.handleInputChange.bind(this, "amountToWager")}/>
              <button type="submit" onClick={this.onFormSubmit.bind(this)}>Create Wager</button>
            </div>
          </div>
        </main>
      </div>
    );
  }
}

export default App
