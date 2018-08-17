pragma solidity 0.4.24;

import "installed_contracts/zeppelin/contracts/ownership/Ownable.sol";
import "installed_contracts/zeppelin/contracts/lifecycle/Pausable.sol";
import "installed_contracts/zeppelin/contracts/lifecycle/Destructible.sol";

/// @title A skeleton for the Twitter Oracle contract
/// @author Shawn Tabrizi
/// @notice The Twitter Oracle contract allows users to retrieve and store twitter post text onto the blockchain
contract TwitterOracle {
    /// @notice Retrieve the tweet text for a given post stored in the contract
    /// @dev Returned string may come back in an array syntax and will need to be parsed by the front-end
    /// @param _postId The post id you want to retrieve text for. Expecting "<user>/status/<id>".
    /// @return string of the text for that post
    function getTweetText(string _postId) public view returns(string);

    /// @notice Oraclize tweet text for a given post and store it in the contract
    /// @dev Calling this function requires the Twitter Oracle contract has funds, thus this function is payable so the user can provide those funds
    /// @param _postId The post id you want to oraclize. Expecting "<user>/status/<id>".
    function oraclizeTweet(string _postId) public payable;
}

/// @title The Bird Bounty contract which allows users to create bounties for posting tweets
/// @author Shawn Tabrizi
/// @notice This contract follows many similar patterns to Bounties Network's StandardBounties.sol
contract BirdBounty is Ownable, Pausable, Destructible {
    /// Storage
    address public owner;
    Bounty[] public bounties;
    mapping(uint => Fulfillment[]) fulfillments;
    TwitterOracle oracleContract;

    /// Structs
    struct Bounty {
        address issuer;
        uint256 fulfillmentAmount;
        uint256 balance;
        string tweetText;
        bool bountyOpen;
        mapping (bytes32 => bool) tweetsUsed;
    }

    struct Fulfillment {
        uint256 fulfillmentAmount;
        address fulfiller;
        string tweetId;
    }

    /// Modifiers
    modifier amountIsNotZero(uint256 _amount) {
        require (
            _amount != 0,
            "The amount cannot be zero."
            );
        _;
    }

    modifier validateNotTooManyBounties() {
        require(
            (bounties.length + 1) > bounties.length,
            "There are too many bounties registered, causing an overflow."
            );
        _;
    }

    modifier validateBountyArrayIndex(uint _bountyId){
        require(
            _bountyId < bounties.length,
            "Invalid Bounty ID."
            );
        _;
    }

    modifier isOpen(uint _bountyId) {
        require(
            bounties[_bountyId].bountyOpen == true,
            "Bounty is not open."
            );
        _;
    }

    modifier onlyIssuer(uint _bountyId) {
        require(
            bounties[_bountyId].issuer == msg.sender,
            "Only the issuer of this bounty can call this function."
            );
        _;
    }
    
    modifier enoughFundsToPay(uint _bountyId) {
        require(
            bounties[_bountyId].balance >= bounties[_bountyId].fulfillmentAmount,
            "The fulfillment amount is more than the balance available for this bounty."
            );
        _;
    }

    modifier validateFulfillmentArrayIndex(uint _bountyId, uint _index) {
        require(
            _index < fulfillments[_bountyId].length,
            "Invalid Fulfillment ID."
            );
        _;
    }

    modifier tweetTextNotEmpty(string _postId) {
        require(
            keccak256(abi.encodePacked(getTweetText(_postId))) != keccak256(""),
            "The tweet text is empty. This tweet may have never been oraclized, or may have run into an issue when oraclizing."
            );
        _;
    }

    modifier transferredAmountEqualsValue(uint _bountyId, uint _amount) {
        require(
            (_amount * 1 wei) == msg.value,
            "The amount of ETH sent does not match the value indicated."
            );
        _;
    }

    /// @notice Constructor function which establishes the contract owner and initializes the Twitter Oracle address
    /// @dev Ownership can be managed through Open-Zeppelin's Ownable.sol which this contract uses. Oracle address can be updated using SetOracle
    /// @param _addr The address of the Twitter Oracle contract
    constructor(address _addr)
    public
    {
        owner = msg.sender;
        setOracle(_addr);
    }

    /// @notice Allows the contract to update the Twitter Oracle it uses for creating bounties
    /// @dev Only the owner of this contract can call this function
    /// @param _addr The address of the Twitter Oracle contract
    function setOracle(address _addr)
    public
    onlyOwner
    {
        oracleContract = TwitterOracle(_addr);
    }

    /// @notice This function will create a new open bounty using a stored tweet text
    /// @dev This function only works if the contract is not paused, if the fulfillment is greater than zero, there are room to make more bounties, and the tweet text has content.
    /// @param _fulfillmentAmount The amount a user will be paid when they fulfill a bounty
    /// @param _postId The post that will be used to establish the text requirements for this bounty
    /// @return The bountyId that was created as a result of this function call
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

    /// @notice A function that allows anyone to add additional funds to an open bounty
    /// @dev Note that these funds are under full control of the bounty creator, and the bounty can be closed and drained at any time
    /// @param _bountyId The bounty that the user wants to contribute to
    /// @param _value The amount that the user wants to contribute. Must match msg.value to make sure funds aren't accidentally deposited.
    function contribute (uint _bountyId, uint _value)
    public
    payable
    whenNotPaused
    validateBountyArrayIndex(_bountyId)
    isOpen(_bountyId)
    amountIsNotZero(_value)
    transferredAmountEqualsValue(_bountyId, _amount)
    {
        bounties[_bountyId].balance += msg.value;
    }

    function fulfillBounty(uint _bountyId, string _postId)
    public
    whenNotPaused
    validateBountyArrayIndex(_bountyId)
    isOpen(_bountyId)
    enoughFundsToPay(_bountyId)
    returns (bool)
    {
        string memory postText = getTweetText(_postId);
        require(
            bounties[_bountyId].tweetsUsed[keccak256(abi.encodePacked(_postId))] != true,
            "The tweet you are trying to use has already been used for this bounty."
            );
        require(
            keccak256(abi.encodePacked(bounties[_bountyId].tweetText)) == keccak256(abi.encodePacked(postText)),
            "The tweet you are trying to use does not match the bounty text."
            );
        bounties[_bountyId].tweetsUsed[keccak256(abi.encodePacked(_postId))] = true;
        fulfillments[_bountyId].push(Fulfillment(bounties[_bountyId].fulfillmentAmount, msg.sender, _postId));
        bounties[_bountyId].balance -= bounties[_bountyId].fulfillmentAmount;
        msg.sender.transfer(bounties[_bountyId].fulfillmentAmount);
        return true;
    }

    function changePayout(uint _bountyId, uint _newFulfillmentAmount)
    public
    payable
    whenNotPaused
    validateBountyArrayIndex(_bountyId)
    onlyIssuer(_bountyId)
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
            bounties[_bountyId].tweetText,
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

    function getFulfillment(uint _bountyId, uint _fulfillmentId)
    public
    view
    validateBountyArrayIndex(_bountyId)
    validateFulfillmentArrayIndex(_bountyId, _fulfillmentId)
    returns (uint256, address, string)
    {
        return (
            fulfillments[_bountyId][_fulfillmentId].fulfillmentAmount,
            fulfillments[_bountyId][_fulfillmentId].fulfiller,
            fulfillments[_bountyId][_fulfillmentId].tweetId
        );
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