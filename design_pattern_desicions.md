# Design Pattern Decisions
When developing the Twitter Bounty smart contract, I considered the following design patterns to best

## Object-Oriented Design
Twitter Bounty uses two basic objects to simplify the management and access to the contract:
1)  A `Bounty` object:

        struct Bounty {
            address issuer; // Owner of a bounty
            uint256 fulfillmentAmount; // The amount that a user gets paid for fulfilling a bounty
            uint256 balance; // The amount of funds the bounty has available for fulfillment payouts
            string tweetText; // The specific text used to check for a fulfillment
            bool bountyOpen; // Bounty state machine, checking that the bounty is open
            mapping (bytes32 => bool) tweetsUsed; // Tweets already used to filfill the bounty
        }
2) A `Fulfillment` object:

        struct Fulfillment {
            uint256 fulfillmentAmount; // The amount the user got paid for fulfilling the bounty
            address fulfiller; // The user that fulfilled the bounty
            string tweetId; // The tweet ID used to fulfill the bounty
        }

## Fail early and fail loud
All functions check for valid conditions as early as possible, and thow an exception if they fail.
* Twitter Bounty has 9 function modifiers with `require` statements
* Every function has at least some number of relevant modifiers when possible
* Every require statment has an exception description customized for the failed condition
* Conditions are checked as early as possible in the function to reduce unnecessary code execution

## Contract Lifecycle
Twitter Bounty takes advantage of Open-Zeppelin libraries to manage the lifecycle of the contract.
### Circuit Breaker
* The contract is Pauseable, allowing the contract owner to disable all users from accessing all core functions
    > Read only functions are still available and accessible when the contract is paused.

### Mortal
* The contract is Destructible, allowing the contract owner to destroy the contract, release stored funds, and clean up data on the blockchain.

## Restricting Access
Throughout the Twitter Bounty contract, we ensure that only the certain people with specific roles can call certain functions.

### Contract Owner
Twitter Bounty uses the Open-Zeppelin Ownable library. When the contract gets deployed, the contract creator is automatically set as the owner. Only this owner can access the following contract functions:
* `setOracle()`: Allowing the owner to change the contract used to retrieve Twitter posts
* `pause` and `unpause`: Allowing the owner to pause the contract
* `destroy()` and `destroyAndSend()`: Allowing the owner to destroy the contract

### Bounty Issuer
Twitter Bounty has a "Bounty Issuer" role for the user account that created a bounty. When interacting with the following functions, we first check that the calling address is the bounty issuer:
* `changePayout()`: Allowing the bounty issuer to change how much users get paid when they fulfill a bounty they issued
* `closeBounty()`: Allowing the bounty issuer to close a bounty they issued, and draining the remaining balance of the bounty

## Pull Payments
Twitter Bounty uses a user-initated pull patern for paying users who fulfill a bounty. Fulfillers must initiate a transactions with the Twitter Bounty contract which validates that the bounty conditions were met, and then will pay the user for their efforts. At no point does the Twitter Bounty contract automatically send funds to any other users than the calling address.

## State Machine
Twitter Bounty manages a bounty lifecycle which manages which functions can be called for certain bounties. As mentioned earlier, the bounty lifecycle can only be managed by the bounty issuer, and is tracked on the bounty object by `Bounty.bountyOpen`. The following functions check that `Bounty.bountyOpen` is `true` before running:
* `contribute()`: Allowing any user to add additional funding to an open bounty
* `fulfillBounty()`: Allowing any user to fulfill an open bounty and get paid for their efforts
* `changePayout()`: Allowing the bounty issuer to change the fulfillment amount for an open bounty

## Speed Bump
Twitter Bounty has a natural speed bump built into its functionality since it relies on an Oracle to retrieve and store Twitter posts. This limits the number of times a user will be able to execute certain functions due to other restrictions like checking if a Twitter post was already used to fulfill a bounty.

## Upgradability
The Twitter Bounty dApp is built as two seperate contracts:
1) TwitterBounty.sol (The bounty management, and twitter verification logic)
2) TwitterOracle.sol (The Twitter oracle for retrieving and storing posts)

Since this contract is dependent on data reterieved from Twitter through an Oracle, any changes to Twitter can cause the contract to break. To prevent this, the Twitter Oracle contract can be redeployed with updated `XPath` logic, and the Twitter Bounty contract can be updated by the owner to point to the new Twitter Oracle. This transition will not break any existing bounties or future fulfillments.

