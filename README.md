# WeightWagers

This is a proof of concept app that allows users to bet money on whether they
can lose weight.

## Wager Creation

Users create a wager by sending Ether to the WeightWagers
contract. When a user creates a wager, he also sends

1) How much time he needs in order to lose the weight
2) How much weight he bets he can lose
3) His smart scale credentials (we will oraclize calls to his smart scale's
   API to verify his starting and ending weights)

Now, because this is a proof of concept, time is measured in seconds instead of
days. This is for ease of testing. If this were to go to production, it would
be days, and I'd have to introduce some extra tooling for controlling time
on a local blockchain in order to facilitate testing.

Also, since it's a proof of concept, the "smart scale credentials" are simply
a string that tell the Google Cloud App that mocks the scale data what
data to return. I had in mind the Naked scale (https://nakedlabs.com/) when
I made this app, but as that scale doesn't have an API yet, I went with this
very simplified approach.

## Wager Verification

Users can attempt to "win" their wagers at any time. There are three possible
outcomes for each of the user's wagers.

1) The wager can be expired. This happens if the user didn't lose enough
   weight in the amount of time he gave himself when creating the wager.
   In this case, the wager is deleted and the contract keeps the user's
   funds.
2) The wager is unchanged. This happens if the user didn't lose enough
   weight, but the wager still hasn't expired. In this case, the contract
   keeps the user's funds and doesn't delete the wager, so that the user
   can try to verify again in the future.
3) The wager is verified. This happens if the user did lose enough weight
   before the wager expires. In this case, the user gets his original
   funds back plus an additional 3.1% of his original wager.

## Admin functionality
The owner of the contract (the second address that ganache supplies) has
access to additional functionality in the app. They can perform an emergency
stop on the contract, which will prevent wager creation (but still allow
wager verification).

## How to install

### Install global dependencies
1) Make sure ganache-cli is installed globally. You can run `npm install -g ganache-cli`
   to install it globally.
2) Make sure truffle is installed globally. You can run `npm install -g truffle`
   to install it globally.

### Install the app
1) Clone the WeightWagers app from github with `git clone https://github.com/djshapiro/WeightWagers.git`.
2) Navigate into this app's directory with `cd WeightWagers`.
3) Run `npm install`
4) Run `truffle install oraclize-api`. Run this command from the top level of
   the WeightWagers directory. If you run truffle commands from a subdirectory
   of WeightWagers, it will fail.

### Install ethereum-bridge
1) Install ethereum-bridge in its own directory (not inside of WeightWagers) 
   for testing oraclize locally by running the following four commands.
  - `mkdir ethereum-bridge`
  - `git clone https://github.com/oraclize/ethereum-bridge ethereum-bridge`
  - `cd ethereum-bridge`
  - `npm install `

## How to run
1) In the WeightWagers directory, run `ganache-cli -m "$(cat ganacheMnemonic)"`.
   This will start ganache with a specific mnemonic.
2) Copy the ganache mnemonic so you can paste it into metamask later. Remember
   that the first account is a regular user while the second account is the admin.
3) In the ethereum-bridge directory, run `node bridge -a 9`. This will start
   ethereum-bridge.
4) After about a minute, ethereum-bridge will say something that looks like
   "OAR = OraclizeAddrResolverI(0x6f485C8BF6fc43eA212E93BBF8ce046C7f1cb475);".
   Copy this line and paste it into contracts/WeightWagers.sol in the
   constructor at around line 117. Delete the line in the contract that looks
   like that line.
5) Run `truffle compile; truffle migrate` from the top level of the WeightWagers
   directory. If you run truffle commands from a subdirectory of WeightWagers,
   it will fail.
6) Run `npm run start`
7) Navigate to localhost:3000 in your browser.

## Notes on using the app
Oraclizing is expensive and time-consuming. Expect your wager creation
and verification calls to take about 30 seconds.

## Further reading
- Notes on design choices I made can be found in [design_pattern_decisions.md](./design_pattern_decisions.md).
- Notes on security-related choices I made can be found in [avoiding_common_attacks.md](./avoiding_common_attacks.md).
- User stories can be found in [user_stories.md](./user_stories.md)

## Contact me
Please let me know if you have any problems installing or running the app.

