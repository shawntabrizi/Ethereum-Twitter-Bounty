# Bird Bounty - A Ethereum Based Twitter Bounty
### ConsenSys Academy 2018 Developer Program Final Project - Shawn Tabrizi

In short, this dApp is a bounty service which allows users to pay and get paid to post specific messages on Twitter.

## Quickstart
### Install prerequisites
1. Install the Truffle framework:

       npm install -g truffle
2. Install the Ganache CLI:

       npm install -g ganache-cli

### Running Bird Bounty Locally
1. Clone this repository
2. Initialize and install the `ethereum-bridge` submodule

       git submodule init
       git submodule update
3. You will need to open 4 seperate console windows:

    1. Use one to initialize the Ganache CLI

           ganache-cli
    2. Use one to initialize the `ethereum-bridge`

           cd /path/to/ethereum-bridge
           npm install
           node bridge -a 9 -H 127.0.0.1 -p 8545 --dev
    3. Use one to `migrate` the contracts using Truffle

           cd /path/to/birdbounty
           truffle compile
           truffle migrate --develop --reset

    4. Finally, use one to start the `lite-server`

           cd /path/to/birdbounty
           npm run dev

4. Your browser should automatically open up the Bird Bounty webpage. To interact, make sure you have [installed and configured MetaMask](https://truffleframework.com/tutorials/pet-shop#installing-and-configuring-metamask).

## How does it work?

![Bird Bounty Architecture](./birdbounty/src/img/bird-bounty-architecture.png)

Bird Bounty is broken up into two Ethereum smart contracts:

### TwitterOracle.sol
The Twitter Oracle smart contract uses [Oraclize.it's](http://www.oraclize.it/) `oraclize-api` library to retrieve the message text of posts on Twitter via URL. These messages are stored on the Ethereum blockchain within this smart contract, and is publicly accessible by any other smart contract.

Any user or contract can call this contract to store a new Twitter message. Storing the data from Oraclize callback requires this contract also has balance of Ether to function, and anyone can contribute ether to keep the oracle running.

### BirdBounty.sol
The main Bird Bounty smart contract is similar to [Bounties Network's](https://github.com/Bounties-Network/StandardBounties) `StandardBounties.sol`. Using the data on the Twitter Oracle smart contract, users are able to open new bounties or claim fulfillment rewards on existing ones.

Completing a bounty requires that a user prove that a new tweet that has not been used in the past contains the same text as the original Twitter post for the bounty. Because this proof can be done programatically, bounty verification and reward resolution can happen all at once, and without the need of the bounty creator to verify or accept fulfillments.

Bounty creators have control over their bounties, and can edit the fulfillment rewards or close open bounties. Anyone can contribute to existing bounties to continue to fund them and encourage others to keep fulfilling the bounty.

## How is this useful?
Bird Bounty enables a decentralized and simple way for people to advertise or spread messages in an organic way. Imagine that you just released a new product, and you want others to share your product. Rather than paying for an ad, you can harness a community of Twitter users to share your product with their networks. For their efforts, you can automatically pay them using this bounty system.

For example, the original bounty creator can make a post like:

> Hey have you heard about @BirdBountyETH?

Then using the Bird Bounty website and smart contracts, they can have others make the same post, and claim rewards for doing so.

## How do I create a bounty?