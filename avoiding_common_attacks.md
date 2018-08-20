# Avoiding Common Attacks
Solidity development requires extra scrutiny when it comes to protecting against common attack patterns. Here are some of the things that Twitter Bounty has done:

## Logic Bugs
I have attempted to mitigate against logic bugs by doing the following:
* Created truffle tests across contract functions, testing for pass and fail scenarios
* Following latest Solidity coding standards
* Following general best practices for software development
* Keeping contract logic very simple, and abstracting complicated methods to the front-end

## Recursive Calls
* Adopting modify first, pay last design pattern
* Checking that any single input can only result in a single payment

## Integer Arithmetic Overflow
I have implimented checks to ensure that numbers do not overflow or underflow in unexpected ways:
* Validating that adding a new bounty wouldn't cause an overflow
* Validating that adding a new fulfillment wouln't cause an overflow
* Validating that new fulfillment amount is greater than balance
* Validating that bounty balance is greater than or equal to the fulfillment amount
* No user inputted variables affect balance tracking
* All arithmetic operations reviewed (4+'s, 5-'s)
* Chose not to use SafeMath to reduce contract size

## Poison Data
I avoid malicous user input in Twitter Bounty by:
* Adding `onlyOwner` checks on integral contract functions
* Adding `onlyIssuer` checks on bounty modification
* Getting bounty string data through the Oraclize contract, rathern than user input
* Validate `bountyId` whenever the user inputs it
* Validate `fulfillmentId` whenever the user inputs it

## Exposed Functions
All contract functions which are public have appropriate checks for:
* Contract Owner
* Bounty Issuer

## Exposed Secrets
Twitter Bounty does not store any secret information on the blockchain.

## Miner Vulnerabilities
Twitter Bounty does not rely on any timestamp or block information.

## `tx.origin` Problem
Twitter Bounty does not use `tx.origin` anywhere

## Gas Limit
I avoid gas limit issues by:
* Not using any loops in Twitter Bounty
* Not storing any user defined strings