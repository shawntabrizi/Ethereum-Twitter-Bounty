pragma solidity ^0.4.23;
import "installed_contracts/oraclize-api/contracts/usingOraclize.sol";
import "installed_contracts/zeppelin/contracts/ownership/Ownable.sol";
import "installed_contracts/zeppelin/contracts/lifecycle/Pausable.sol";
import "installed_contracts/zeppelin/contracts/lifecycle/Destructible.sol";

contract TwitterOracle is Ownable, Pausable, Destructible, usingOraclize {


    address owner;
    mapping(bytes32 => string) public tweetTexts;
    mapping(bytes32 => string) public queryToPost;

    event LogInfo(string description);
    event LogTextUpdate(string text);
    event LogUpdate(address indexed _owner, uint indexed _balance);

    // Constructor
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

    // Fallback function
    function()
    public
    {
        revert();
    }

    function stringNotEmpty(string s)
    internal
    pure
    returns(bool)
    {
        bytes memory tempString = bytes(s);
        if (tempString.length == 0) {
            return false;
        } else {
            return true;
        }
    }

    function __callback(bytes32 id, string result, bytes proof)
    public
    whenNotPaused
    {
        require(stringNotEmpty(queryToPost[id]));
        require(msg.sender == oraclize_cbAddress());

        bytes32 postHash = keccak256(abi.encodePacked(queryToPost[id]));

        tweetTexts[postHash] = result;

        emit LogTextUpdate(result);
    }

    function getBalance()
    public
    view
    returns (uint _balance)
    {
        return address(this).balance;
    }

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

            
            bytes32 queryId = oraclize_query("URL", query);
            queryToPost[queryId] = _postId;
        }
    }

    function getTweetText(string _postId)
    public
    view
    returns(string)
    {
        bytes32 postHash = keccak256(abi.encodePacked(_postId));
        return tweetTexts[postHash];
    }

    function getPostId(bytes32 _queryId)
    public
    view
    returns(string)
    {
        return queryToPost[_queryId];
    }

}