pragma solidity 0.4.24;

import "installed_contracts/oraclize-api/contracts/usingOraclize.sol";
import "installed_contracts/zeppelin/contracts/ownership/Ownable.sol";
import "installed_contracts/zeppelin/contracts/lifecycle/Pausable.sol";
import "installed_contracts/zeppelin/contracts/lifecycle/Destructible.sol";

/// @title The Twitter Oracle contract which allows users to retrieve and store twitter posts
/// @author Shawn Tabrizi
/// @notice This contract uses Oraclize to retrieve post text from Twitter, and store it in this contract
contract TwitterOracle is Ownable, Pausable, Destructible, usingOraclize {
    /* Storage */
    address public owner;
    mapping(bytes32 => string) public tweetTexts;
    mapping(bytes32 => string) internal queryToPost;

    /* Events */
    event LogInfo(string description);
    event LogTextUpdate(string text);
    event LogUpdate(address indexed _owner, uint indexed _balance);

    /* Functions */
    /// @notice The constuctor function for this contract, establishing the owner of the oracle, the intial balance of the contract, and the Oraclize Resolver address
    /// @dev Owner management can be done through Open-Zeppelin's Ownable.sol, this contract needs ETH to function and should be initialized with funds
    constructor()
    payable
    public
    {
        owner = msg.sender;

        emit LogUpdate(owner, address(this).balance);

        // Replace the next line with your version:
        OAR = OraclizeAddrResolverI(0x6f485C8BF6fc43eA212E93BBF8ce046C7f1cb475);

        oraclize_setProof(proofType_TLSNotary | proofStorage_IPFS);
    }

    /// @notice The fallback function for the contract
    /// @dev Will simply revert any unexpected calls
    function()
    public
    {
        revert("Fallback function. Reverting...");
    }

    /// @notice An internal function which checks that a particular string is not empty
    /// @dev To be used in the Oraclize callback function to make sure the resulting text is not null
    /// @param _s The string to check if empty/null
    /// @return Returns false if the string is empty, and true otherwise
    function stringNotEmpty(string _s)
    internal
    pure
    returns(bool)
    {
        bytes memory tempString = bytes(_s);
        if (tempString.length == 0) {
            return false;
        } else {
            return true;
        }
    }

    /// @notice The callback function that Oraclize calls when returning a result
    /// @dev Will store the text of a Twitter post into this contract's storage
    /// @param _id The query ID generated when calling oraclize_query
    /// @param _result The result from Oraclize, should be the Twitter post text
    /// @param _proof The authenticity proof returned by Oraclize, not currently being used in this contract, but it can be upgraded to do so
    function __callback(bytes32 _id, string _result, bytes _proof)
    public
    whenNotPaused
    {
        require(
            msg.sender == oraclize_cbAddress(),
            "The caller of this function is not the offical Oraclize Callback Address."
            );
        require(
            stringNotEmpty(queryToPost[_id]),
            "The Oraclize query ID does not match an Oraclize request made from this contract."
            );

        bytes32 postHash = keccak256(abi.encodePacked(queryToPost[_id]));
        tweetTexts[postHash] = _result;

        emit LogTextUpdate(_result);
    }

    /// @notice Returns the balance of this contract
    /// @dev This contract needs ether to be able to interact with the oracle
    /// @return Returns the ether balance of this contract
    function getBalance()
    public
    view
    returns (uint _balance)
    {
        return address(this).balance;
    }

    /// @notice This function iniates the oraclize process for a Twitter post
    /// @dev This contract needs ether to be able to call the oracle, which is why this function is also payable
    /// @param _postId The twitter post to fetch with the oracle. Expecting "<user>/status/<id>"
    function oraclizeTweet(string _postId)
    public
    payable
    whenNotPaused
    {
        // Check if we have enough remaining funds
        if (oraclize_getPrice("URL") > address(this).balance) {
            emit LogInfo("Oraclize query was NOT sent, please add some ETH to cover for the query fee");
        } else {
            emit LogInfo("Oraclize query was sent, standing by for the answer..");
            // Using XPath to to fetch the right element in the JSON response
            string memory query = string(abi.encodePacked("html(https://twitter.com/", _postId, ").xpath(//div[contains(@class, 'permalink-tweet-container')]//p[contains(@class, 'tweet-text')]//text())"));

            bytes32 queryId = oraclize_query("URL", query, 6721975);
            queryToPost[queryId] = _postId;
        }
    }

    /// @notice This function returns the text of a specific Twitter post stored in this contract
    /// @dev This function will return an empty string in the situation where the Twitter post has not been stored yet
    /// @param _postId The twitter post to get the text of. Expeting "<user>/status/<id>"
    /// @return Returns the text of the twitter post, or an empty string in the case where the post has not been stored yet
    function getTweetText(string _postId)
    public
    view
    returns(string)
    {
        bytes32 postHash = keccak256(abi.encodePacked(_postId));
        return tweetTexts[postHash];
    }

}