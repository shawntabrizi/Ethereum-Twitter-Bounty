const { waitForEvent, PREFIX } = require('./utils')
const twitterBounty = artifacts.require('TwitterBounty')
const twitterOracle = artifacts.require('TwitterOracle')

contract('TwitterBounty.sol', function (accounts) {

    describe(`Testing functionality of the Twitter Bounty Contract (requires TwitterOracle)`, async () => {

        // 3 Twitter Posts that I made with controlled content
        let postUrl1 = 'deturbanator/status/1026355071624175616';
        let postUrl2 = 'deturb/status/1026354757718355968';
        let postUrl3 = 'deturb/status/1026354801381203968';

        // Content of those twitter posts above
        let postUrl1Text = 'test';
        let postUrl2Text = 'test';
        let postUrl3Text = 'test1';

        // Used to track the latest block when making certain calls. Used to find the right emitted events.
        let blockTracker = 0;

        // Check that the contract creator is set as the contract Owner for the Open-Zeppelin Ownable library
        it('Contract should be owned by contract creator (account[0])', async () => {
            let instance = await twitterBounty.deployed();
            let oracleOwner = await instance.owner();
            let owner = accounts[0]
            assert.equal(owner, oracleOwner, 'Owner is not correct!')
        })

        // Check that the Twitter Oracle address was automatically set during contract creation
        it('Contract should be connected to Twitter Oracle', async () => {
            let instance = await twitterBounty.deployed();
            let twitterOracleInstance = await twitterOracle.deployed();
            let oracleContractAddress = await instance.oracleContract()
            let twitterOracleInstanceAddress = await twitterOracleInstance.address;
            assert.equal(oracleContractAddress, twitterOracleInstanceAddress, 'Oracle set incorrectly!')
        })
        
        // Load the first tweet, check for the event that gets emitted
        it('[1] Contract should be able to oraclize tweet through Twitter Oracle', async () => {
            let instance = await twitterBounty.deployed();
            let twitterOracleInstance = await twitterOracle.deployed();
            await instance.oraclizeTweet(postUrl1);
            const { args: { description } } = await waitForEvent(twitterOracleInstance.LogInfo({}, { fromBlock: 0, toBlock: 'latest' }));
            blockTracker = await web3.eth.blockNumber;
            assert.equal(description, 'Oraclize query was sent, standing by for the answer..', 'Oraclize query incorrectly logged!');
        })

        // Listen for the success result when the tweet gets stored in the Twitter Oracle contract
        it('[1] Twitter Oracle should have logged an update event for tweet', async () => {
            let instance = await twitterOracle.deployed();
            let postLog = await waitForEvent(instance.LogTextUpdate({}, { fromBlock: blockTracker, toBlock: 'latest' }));
            blockTracker = await web3.eth.blockNumber;
            assert.equal(postLog.event, 'LogTextUpdate', 'Wrong event emitted for event!');
        })

        // Check that the twitter text matches what should be expected
        it('[1] Text should match what is expected from twitter', async () => {
            let instance = await twitterBounty.deployed();
            let savedPostText = await instance.getTweetText(postUrl1);
            assert.equal(savedPostText, postUrl1Text, 'Post not saved correctly!')
        })
        
        // Load the second tweet, check for the event that gets emitted
        it('[2] Contract should be able to oraclize tweet through Twitter Oracle', async () => {
            let instance = await twitterBounty.deployed();
            let twitterOracleInstance = await twitterOracle.deployed();
            await instance.oraclizeTweet(postUrl2);
            const { args: { description } } = await waitForEvent(twitterOracleInstance.LogInfo({}, { fromBlock: blockTracker, toBlock: 'latest' }));
            blockTracker = await web3.eth.blockNumber;
            assert.equal(description, 'Oraclize query was sent, standing by for the answer..', 'Oraclize query incorrectly logged!');
        })

        // Listen for the success result when the tweet gets stored in the Twitter Oracle contract
        it('[2] Twitter Oracle should have logged an update event for tweet', async () => {
            let instance = await twitterOracle.deployed();
            let postLog = await waitForEvent(instance.LogTextUpdate({}, { fromBlock: blockTracker, toBlock: 'latest' }));
            blockTracker = await web3.eth.blockNumber;
            assert.equal(postLog.event, 'LogTextUpdate', 'Wrong event emitted for event!');
        })

        // Check that the twitter text matches what should be expected
        it('[2] Text should match what is expected from twitter', async () => {
            let instance = await twitterBounty.deployed();
            let savedPostText = await instance.getTweetText(postUrl2);
            assert.equal(savedPostText, postUrl2Text, 'Post not saved correctly!')
        })

        // Load the third tweet, check for the event that gets emitted
        it('[3] Contract should be able to oraclize tweet through Twitter Oracle', async () => {
            let instance = await twitterBounty.deployed();
            let twitterOracleInstance = await twitterOracle.deployed();
            await instance.oraclizeTweet(postUrl3);
            const { args: { description } } = await waitForEvent(twitterOracleInstance.LogInfo({}, { fromBlock: blockTracker, toBlock: 'latest' }));
            blockTracker = await web3.eth.blockNumber;
            assert.equal(description, 'Oraclize query was sent, standing by for the answer..', 'Oraclize query incorrectly logged!');
        })

        // Listen for the success result when the tweet gets stored in the Twitter Oracle contract
        it('[3] Twitter Oracle should have logged an update event for tweet', async () => {
            let instance = await twitterOracle.deployed();
            let postLog = await waitForEvent(instance.LogTextUpdate({}, { fromBlock: blockTracker, toBlock: 'latest' }));
            assert.equal(postLog.event, 'LogTextUpdate', 'Wrong event emitted for event!');
        })

        // Check that the twitter text matches what should be expected
        it('[3] Text should match what is expected from twitter', async () => {
            let instance = await twitterBounty.deployed();
            let savedPostText = await instance.getTweetText(postUrl3);
            assert.equal(savedPostText, postUrl3Text, 'Post not saved correctly!')
        })
        
        // Check that bounty creation works as expected, and that the number of bounties gets incremented
        it('Contract should be able to create bounties', async () => {
            let instance = await twitterBounty.deployed();
            let fulfillmentAmount = web3.toWei('.1', 'ether')
            await instance.createBounty(fulfillmentAmount, postUrl1);
            let bountyNumber = await instance.getNumBounties();
            assert.equal(bountyNumber, 1, 'Bounty not created!')
        })

        // Check that any user can add funds to a bounty, and that the bounty balance reflects that contribution correctly
        it('Any user should be able to contribute to bounty', async () => {
            let instance = await twitterBounty.deployed();
            let contributionAmount = web3.toWei('1', 'ether')
            await instance.contribute(0, {value: contributionAmount, from: accounts[2]});
            let bountyObject = await instance.getBounty(0);
            //bountyObject[2] is the balance of the bounty
            let bountyBalance = web3.fromWei(bountyObject[2], 'ether');
            assert.equal(bountyBalance, 1, 'Contribution did not work!')
        })

        // Check that the bounty will not be fulfilled when using a tweet that has already been used.
        // In this case, the original tweet used to create the bounty was already used.
        it('Bounty should reject an already used tweet', async () => {
            let expectedError = 'revert';
            let expectedMessage = 'The tweet you are trying to use has already been used for this bounty.'
            let instance = await twitterBounty.deployed();
            try {
                let result = await instance.fulfillBounty.call(0, postUrl1);
                assert.fail('Fulfilment of bounty should have thrown an exception!');
            } catch (e) {
                assert.isTrue(e.message.startsWith(`${PREFIX}${expectedError}`), `Expected ${expectedError} but got ${e.message} instead!`);
            }
        })

        // Check that the bounty will not be fulfilled when using a tweet that has different text than required
        it('Bounty should reject a mismatched tweet', async () => {
            let expectedError = 'revert';
            let expectedMessage = 'The tweet you are trying to use does not match the bounty text.'
            let instance = await twitterBounty.deployed();
            try {
                await instance.fulfillBounty.call(0, postUrl3);
                assert.fail('Fulfilment of bounty should have thrown an exception!');
            } catch (e) {
                assert.isTrue(e.message.startsWith(`${PREFIX}${expectedError}`), `Expected ${expectedError} but got ${e.message} instead!`);
            }
        })

        // Check that the bounty does get fulfilled when the tweet text matches, and the tweet ID is new
        it('Bounty should accept a different, yet matching tweet', async () => {
            let instance = await twitterBounty.deployed();
            let result = await instance.fulfillBounty.call(0, postUrl2);
            assert.equal(result, true, 'Contract did not accept a matching tweet.')
        })

        // Check that the bounty pays out once the fulfillment is accepted, and that the balance is correctly updated
        it('Bounty should pay out when fulfilled', async () => {
            let instance = await twitterBounty.deployed();
            await instance.fulfillBounty(0, postUrl2);
            let bountyObject = await instance.getBounty(0);
            //bountyObject[2] is the balance of the bounty
            let bountyBalance = web3.fromWei(bountyObject[2], 'ether');
            assert.equal(bountyBalance, .9, 'Bounty did not pay out.')
        })

        // Check that someone who is NOT the bounty issuer is not able to modify the bounty
        it('Bounty cannot be modified by non-owner', async () => {
            let expectedError = 'revert';
            let expectedMessage = 'Only the issuer of this bounty can call this function.'
            let instance = await twitterBounty.deployed();
            try {
                await instance.closeBounty(0, {from: accounts[3]});
                assert.fail('Trying to edit the bounty should have thrown an exception!');
            } catch (e) {
                assert.isTrue(e.message.startsWith(`${PREFIX}${expectedError}`), `Expected ${expectedError} but got ${e.message} instead!`);
            }
        })

        // Check that the bounty issuer is able to close the bounty
        it('Bounty can be closed by owner', async () => {
            let instance = await twitterBounty.deployed();
            await instance.closeBounty(0);
            let bountyObject = await instance.getBounty(0);
            //bountyObject[4] is the bountyOpen state
            assert.equal(bountyObject[4], false, 'Bounty was not closed!')
        })
        
        // Check that the contract owner can pause the contract
        it('Contract should be pauseable', async () => {
            let instance = await twitterBounty.deployed()
            await instance.pause({ from: accounts[0] });
            let pauseLog = await waitForEvent(instance.Pause({}, { fromBlock: 0, toBlock: 'latest' }));
            assert.equal(pauseLog.event, "Pause", 'Contract not paused!')
        })

        // Check that while the contract is paused, that certain contract functions are not accessible
        it('Contract should not work when paused', async () => {
            let instance = await twitterBounty.deployed();
            let expectedError = 'revert';
            try {
                await instance.oraclizeTweet(postUrl1);
                assert.fail('Oraclize tweet should have failed!');
            } catch (e) {
                assert.isTrue(e.message.startsWith(`${PREFIX}${expectedError}`), `Expected ${expectedError} but got ${e.message} instead!`);
            }
        })

        // Check that the contract can be destroyed, and that the contract code is removed from the blockchain
        it('Contract should be destructible', async () => {
            let instance = await twitterBounty.deployed()
            await instance.destroy({ from: accounts[0] });
            let contractCode = await web3.eth.getCode(instance.address);
            assert.equal(contractCode, '0x0', 'Contract not destroyed!')
        })

    })
})