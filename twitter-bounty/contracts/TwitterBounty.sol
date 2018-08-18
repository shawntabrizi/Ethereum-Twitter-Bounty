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

/// @title The Twitter Bounty contract which allows users to create bounties for posting tweets
/// @author Shawn Tabrizi
/// @notice This contract follows many similar patterns to Bounties Network's StandardBounties.sol
contract TwitterBounty is Ownable, Pausable, Destructible {
    /* Storage */
    address public owner;
    Bounty[] public bounties;
    mapping(uint => Fulfillment[]) fulfillments;
    TwitterOracle oracleContract;

    /* Structs */
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

    /* Modifiers */
    /// @notice Checks that the amount is not equal to zero
    /// @dev To be used in situations like funding a bounty and setting the bounty fulfillment reward
    /// @param _amount The amount to be checked
    modifier amountIsNotZero(uint256 _amount) {
        require (
            _amount != 0,
            "The amount cannot be zero."
            );
        _;
    }

    /// @notice Checks that the bounty array won't overflow
    /// @dev To be used before a new bounty is created
    modifier validateNotTooManyBounties() {
        require(
            (bounties.length + 1) > bounties.length,
            "There are too many bounties registered, causing an overflow."
            );
        _;
    }
    
    /// @notice Checks that the number of fulfillments won't overflow for a specific bounty
    /// @dev To be used before a new fulfillment is created for a bounty
    /// @param _bountyId The bounty to check fulfillments for
    modifier validateNotTooManyFulfillments(uint _bountyId){
        require(
            (fulfillments[_bountyId].length + 1) > fulfillments[_bountyId].length,
            "There are too many fulfillments for this bounty, causing an overflow."
            );
        _;
    }

    /// @notice Checks that a specific Bounty ID is within the range of registered bounties
    /// @dev To be used in any situation where we are accessing an existing bounty
    /// @param _bountyId The Bounty ID to validate
    modifier validateBountyArrayIndex(uint _bountyId){
        require(
            _bountyId < bounties.length,
            "Invalid Bounty ID."
            );
        _;
    }

    /// @notice Checks that a specific Bounty ID is open
    /// @dev To be used in any situation where a bounty is being modified or fulfilled
    /// @param _bountyId The Bounty ID to check if open
    modifier isOpen(uint _bountyId) {
        require(
            bounties[_bountyId].bountyOpen == true,
            "Bounty is not open."
            );
        _;
    }

    /// @notice Checks that the the function is being called by the owner of the bounty
    /// @dev To be used in any situation where the function performs a privledged action to the bounty
    /// @param _bountyId The Bounty ID to check the owner of
    modifier onlyIssuer(uint _bountyId) {
        require(
            bounties[_bountyId].issuer == msg.sender,
            "Only the issuer of this bounty can call this function."
            );
        _;
    }
    
    /// @notice Checks that the bounty has enough of a balance to pay a fulfillment
    /// @dev To be used before a fulfillment is completed
    /// @param _bountyId The Bounty ID to check the balance of
    modifier enoughFundsToPay(uint _bountyId) {
        require(
            bounties[_bountyId].balance >= bounties[_bountyId].fulfillmentAmount,
            "The fulfillment amount is more than the balance available for this bounty."
            );
        _;
    }

    /// @notice Checks that a specific Fulfillment ID is within the range of fullfillments for a bounty
    /// @dev To be used in any situation where we are accessing a fulfillment
    /// @param _bountyId The Bounty ID which has the fulfillment to be checked
    /// @param _index The index of the fulfillment to be checked
    modifier validateFulfillmentArrayIndex(uint _bountyId, uint _index) {
        require(
            _index < fulfillments[_bountyId].length,
            "Invalid Fulfillment ID."
            );
        _;
    }

    /// @notice Check that the text for a tweet is not empty
    /// @dev An empty tweet text implies that the tweet was not oraclized, or failed to oraclize
    /// @param _postId The tweet id to check. Expecting "<user>/status/<id>"
    modifier tweetTextNotEmpty(string _postId) {
        require(
            keccak256(abi.encodePacked(getTweetText(_postId))) != keccak256(""),
            "The tweet text is empty. This tweet may have never been oraclized, or may have run into an issue when oraclizing."
            );
        _;
    }

    /* Functions */
    /// @notice Constructor function which establishes the contract owner and initializes the Twitter Oracle address
    /// @dev Ownership can be managed through Open-Zeppelin's Ownable.sol which this contract uses. Oracle address can be updated using SetOracle
    /// @param _addr The address of the Twitter Oracle contract
    constructor(address _addr)
    public
    {
        owner = msg.sender;
        setOracle(_addr);
    }

    /// @notice The fallback function for the contract
    /// @dev Will simply revert any unexpected calls
    function()
    public
    {
        revert("Fallback function. Reverting...");
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

    /// @notice This function allows anyone to add additional funds to an open bounty
    /// @dev Note that these funds are under full control of the bounty creator, and the bounty can be closed and drained at any time
    /// @param _bountyId The bounty that the user wants to contribute to
    function contribute (uint _bountyId)
    public
    payable
    whenNotPaused
    validateBountyArrayIndex(_bountyId)
    isOpen(_bountyId)
    {
        bounties[_bountyId].balance += msg.value;
    }

    /// @notice This function allows any user to fulfill an open bounty using a post saved to the Twitter Oracle contract, and will automatically pay out
    /// @dev This function only works if there are enough funds to pay someone and if the bounty is open.
    /// @param _bountyId The bounty that the user is trying to fulfill
    /// @param _postId The Twitter post that will be used to try and fulfill the bounty
    /// @return Returns true if fulfillment completes. Can be used to check the function before it is actually run using .call()
    function fulfillBounty(uint _bountyId, string _postId)
    public
    whenNotPaused
    validateBountyArrayIndex(_bountyId)
    validateNotTooManyFulfillments(_bountyId)
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

    /// @notice This function allows the owner of a bounty to change the fulfillment amount for that bounty
    /// @dev This function requires that the new fulfillment amount is less than available balance for the bounty, which is why this function is also payable
    /// @param _bountyId The bounty the owner is trying to changet the fulfillment amount for
    /// @param _newFulfillmentAmount The new amount that users who fulfill the bounty will be paid 
    function changePayout(uint _bountyId, uint _newFulfillmentAmount)
    public
    payable
    whenNotPaused
    validateBountyArrayIndex(_bountyId)
    onlyIssuer(_bountyId)
    isOpen(_bountyId)
    {
        bounties[_bountyId].balance += msg.value;
        require(
            bounties[_bountyId].balance >= _newFulfillmentAmount,
            "Make sure"
            );
        bounties[_bountyId].fulfillmentAmount = _newFulfillmentAmount;
    }

    /// @notice This function allows the owner of a bounty to close that bounty, and drain all funds from the bounty
    /// @dev Only the bounty creator can call this function
    /// @param _bountyId The bounty the owner wants to close
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

    /// @notice Returns the details of a bounty
    /// @dev It does not include the mapping of tweets used to fulfill the bounty
    /// @param _bountyId The bounty that should be retrieved
    /// @return A tuple of the bounty details
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

    /// @notice Checks if a specific Tweet has already been used for a bounty
    /// @dev Can be used to proactively check for problems before the user submits a transaction
    /// @param _bountyId The bounty to check for tweets used
    /// @param _postId The twitter post to check if it was already used
    /// @return Returns true if the post has been used, otherwise it returns false
    function checkBountyTweetsUsed(uint _bountyId, string _postId)
    public
    view
    validateBountyArrayIndex(_bountyId)
    returns (bool)
    {
        return (bounties[_bountyId].tweetsUsed[keccak256(abi.encodePacked(_postId))]);
    }

    /// @notice Returns the number of bounties registered in the contract
    /// @dev Can be used to iterate over all the bounties in the contract
    /// @return Returns the number of bounties
    function getNumBounties()
    public
    view
    returns (uint)
    {
        return bounties.length;
    }

    /// @notice Returns the number of fulfillments completed for a bounty
    /// @dev Can be used to iterate over all the fulfillments for a bounty
    /// @param _bountyId The bounty to get the number of fulfillments for
    /// @return Returns the number of fulfillments for a bounty
    function getNumFulfillments(uint _bountyId)
    public
    view
    returns (uint)
    {
        return fulfillments[_bountyId].length;
    }

    /// @notice Gets the fulfillment details for a specific bounty and fulfillment
    /// @param _bountyId The bounty which has the fulfillment to be returned
    /// @param _fulfillmentId The fulfillment to be returned
    /// @return Returns a tuple of details for the fulfillment
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

    /* Twitter Oracle Functions */
    /// @notice Gets the tweet text for a twitter post from the Twitter Oracle
    /// @dev Simply a passthrough function for the Twitter Oracle contract
    /// @param _postId The twitter post to get the text for
    /// @return Returns text for the twitter post, or in the case where the post hasn't been stored yet, it will return an empty string
    function getTweetText(string _postId)
    public
    view
    returns(string)
    {
        return oracleContract.getTweetText(_postId);
    }

    /// @notice Requests the Twitter Oracle contract to retrieve and store the tweet text for a Twitter post
    /// @dev The Twitter Oracle contract requires funds to support storing the Oraclize callback, which is why this function is Payable, and will forward funds to the Twitter Oracle
    /// @param _postId The twitter post to retrieve and store in the Twitter Oracle contract
    function oraclizeTweet(string _postId)
    public
    payable
    whenNotPaused
    {
        oracleContract.oraclizeTweet.value(msg.value)(_postId);
    }
}