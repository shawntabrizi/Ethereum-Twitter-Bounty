pragma solidity ^0.4.23;

import "installed_contracts/zeppelin/contracts/ownership/Ownable.sol";
import "installed_contracts/zeppelin/contracts/lifecycle/Pausable.sol";
import "installed_contracts/zeppelin/contracts/lifecycle/Destructible.sol";

contract TwitterOracle {
    function getTweetText(string _postId) public view returns(string);
    function oraclizeTweet(string _postId) payable public;
}

contract BirdBounty is Ownable, Pausable, Destructible {
    
    address public owner;

    Bounty[] public bounties;

    mapping(uint=>Fulfillment[]) fulfillments;

    TwitterOracle oracleContract;

    struct Bounty {
        address issuer;
        uint256 fulfillmentAmount;
        uint256 balance;
        string data;
        bool bountyOpen;
        mapping (bytes32 => bool) tweetsUsed;
    }

    struct Fulfillment {
        bool accepted;
        address fulfiller;
        string data;
    }


    modifier amountIsNotZero(uint256 _amount) {
        require (_amount != 0);
        _;
    }

    modifier validateNotTooManyBounties() {
        require((bounties.length + 1) > bounties.length);
        _;
    }

    modifier validateBountyArrayIndex(uint _bountyId){
        require(_bountyId < bounties.length);
        _;
    }

    modifier isOpen(uint _bountyId) {
        require(bounties[_bountyId].bountyOpen == true);
        _;
    }

    modifier onlyIssuer(uint _bountyId) {
        require(bounties[_bountyId].issuer == msg.sender);
        _;
    }

    modifier newFulfillmentAmountIsIncrease(uint _bountyId, uint _newFulfillmentAmount) {
        require(bounties[_bountyId].fulfillmentAmount < _newFulfillmentAmount);
        _;
    }

    modifier fulfillmentNotYetAccepted(uint _bountyId, uint _fulfillmentId) {
        require(fulfillments[_bountyId][_fulfillmentId].accepted == false);
        _;
    }
    
    modifier enoughFundsToPay(uint _bountyId) {
        require(bounties[_bountyId].balance >= bounties[_bountyId].fulfillmentAmount);
        _;
    }

    modifier validateFulfillmentArrayIndex(uint _bountyId, uint _index) {
        require(_index < fulfillments[_bountyId].length);
        _;
    }

    modifier tweetTextNotEmpty(string _postId) {
        require(keccak256(abi.encodePacked(getTweetText(_postId))) != keccak256(""));
        _;
    }

    constructor(address addr)
    public
    {
        owner = msg.sender;
        setOracle(addr);
    }

    function setOracle(address addr)
    public
    onlyOwner
    {
        oracleContract = TwitterOracle(addr);
    }

    function createBounty(
        uint256 _fulfillmentAmount,
        string _postId
    )
    public
    payable
    whenNotPaused
    amountIsNotZero(_fulfillmentAmount)
    validateNotTooManyBounties
    tweetTextNotEmpty(_postId)
    returns (uint)
    {
        string memory postText = getTweetText(_postId);
        bounties.push(Bounty(msg.sender, _fulfillmentAmount, msg.value, postText, true));
        bounties[bounties.length - 1].tweetsUsed[keccak256(abi.encodePacked(_postId))] = true;
        return (bounties.length - 1);
    }

    function contribute (uint _bountyId)
    public
    payable
    whenNotPaused
    validateBountyArrayIndex(_bountyId)
    isOpen(_bountyId)
    {
        bounties[_bountyId].balance += msg.value;
    }

    function fulfillBounty(uint _bountyId, string _postId)
    public
    whenNotPaused
    validateBountyArrayIndex(_bountyId)
    isOpen(_bountyId)
    {
        string memory postText = getTweetText(_postId);
        require(bounties[_bountyId].tweetsUsed[keccak256(abi.encodePacked(_postId))] != true);
        require(keccak256(abi.encodePacked(bounties[_bountyId].data)) == keccak256(abi.encodePacked(postText)));
        bounties[_bountyId].tweetsUsed[keccak256(abi.encodePacked(_postId))] = true;
        fulfillments[_bountyId].push(Fulfillment(false, msg.sender, postText));
    }

    function acceptFulfillment(uint _bountyId, uint _fulfillmentId)
    public
    whenNotPaused
    validateBountyArrayIndex(_bountyId)
    validateFulfillmentArrayIndex(_bountyId, _fulfillmentId)
    isOpen(_bountyId)
    fulfillmentNotYetAccepted(_bountyId, _fulfillmentId)
    enoughFundsToPay(_bountyId)
    {
        fulfillments[_bountyId][_fulfillmentId].accepted = true;
        bounties[_bountyId].balance -= bounties[_bountyId].fulfillmentAmount;
        fulfillments[_bountyId][_fulfillmentId].fulfiller.transfer(bounties[_bountyId].fulfillmentAmount);
    }


    function increasePayout(uint _bountyId, uint _newFulfillmentAmount)
    public
    payable
    whenNotPaused
    validateBountyArrayIndex(_bountyId)
    onlyIssuer(_bountyId)
    newFulfillmentAmountIsIncrease(_bountyId, _newFulfillmentAmount)
    {
        bounties[_bountyId].balance += msg.value;
        require(bounties[_bountyId].balance >= _newFulfillmentAmount);
        bounties[_bountyId].fulfillmentAmount = _newFulfillmentAmount;
    }

    function closeBounty(uint _bountyId)
    public
    whenNotPaused
    validateBountyArrayIndex(_bountyId)
    onlyIssuer(_bountyId)
    {
        bounties[_bountyId].bountyOpen = false;
        uint tempBalance = bounties[_bountyId].balance;
        bounties[_bountyId].balance = 0;
        if (tempBalance > 0) {
            bounties[_bountyId].issuer.transfer(tempBalance);
        }
    }

    function getBounty(uint _bountyId)
    public
    view
    validateBountyArrayIndex(_bountyId)
    returns (address, uint, uint, string, bool)
    {
        return (
            bounties[_bountyId].issuer,
            bounties[_bountyId].fulfillmentAmount,
            bounties[_bountyId].balance,
            bounties[_bountyId].data,
            bounties[_bountyId].bountyOpen
        );
    }

    function checkBountyTweetsUsed(uint _bountyId, string _postId)
    public
    view
    validateBountyArrayIndex(_bountyId)
    returns (bool)
    {
        return (bounties[_bountyId].tweetsUsed[keccak256(abi.encodePacked(_postId))]);
    }

    function getNumBounties()
    public
    view
    returns (uint)
    {
        return bounties.length;
    }

    function getNumFulfillments(uint _bountyId)
    public
    view
    returns (uint)
    {
        return fulfillments[_bountyId].length;
    }

    function transitionToState(uint _bountyId, bool _state)
    internal
    whenNotPaused
    {
        bounties[_bountyId].bountyOpen = _state;
    }

    function getTweetText(string _postId)
    public
    view
    returns(string)
    {
        return oracleContract.getTweetText(_postId);
    }

    function oraclizeTweet(string _postId)
    public
    payable
    whenNotPaused
    {
        oracleContract.oraclizeTweet.value(msg.value)(_postId);
    }
}