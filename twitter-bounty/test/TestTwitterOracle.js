const { waitForEvent, PREFIX } = require('./utils')
const twitterOracle = artifacts.require('TwitterOracle')

contract('TwitterOracle.sol', function (accounts) {

    describe(`Testing functionality of the Twitter Oracle Contract`, async () => {

        // A twitter post I made with controlled content
        let postUrl1 = 'deturbanator/status/1026355071624175616';
        let postUrl1Text = 'test';

        // Used to track that storage of the tweet happens sucessfully
        let postText = "";

        // Check that the contract creator is set as the contract Owner for the Open-Zeppelin Ownable library
        it('Contract should be owned by contract creator (account[9])', async () => {
            let instance = await twitterOracle.deployed()
            let oracleOwner = await instance.owner();
            let owner = accounts[9]
            assert.equal(owner, oracleOwner, 'Owner is not correct!')
        })

        // Check that when the contract initiates a new Oraclize Query, an event is created
        it('Should have logged a new Oraclize query', async () => {
            let instance = await twitterOracle.deployed();
            await instance.oraclizeTweet(postUrl1);
            const { args: { description } } = await waitForEvent(instance.LogInfo({}, { fromBlock: 0, toBlock: 'latest' }));
            assert.equal(description, 'Oraclize query was sent, standing by for the answer..', 'Oraclize query incorrectly logged!');
        })

        // Check that when the callback function is called, an event is created
        it('Callback should have logged an update event', async () => {
            let instance = await twitterOracle.deployed();
            let postLog = await waitForEvent(instance.LogTextUpdate({}, { fromBlock: 0, toBlock: 'latest' }));
            postText = postLog.args.text;
            assert.equal(postLog.event, 'LogTextUpdate', 'Wrong event emitted for event!');
        })

        // Check that storage of the Twitter text happens successfully
        it('Text should be stored from twitter post', async () => {
            let instance = await twitterOracle.deployed();
            let savedPostText = await instance.getTweetText(postUrl1);
            assert.equal(postText, savedPostText, 'Post not saved!')
        })

        // Check that the Twitter text itself is as expected from the controlled Twitter post
        it('Text should match what is expected from twitter', async () => {
            let instance = await twitterOracle.deployed();
            let savedPostText = await instance.getTweetText(postUrl1);
            assert.equal(savedPostText, postUrl1Text, 'Post not saved correctly!')
        })
        
        // Check that the contract owner can pause the contract
        it('Contract should be pauseable', async () => {
            let instance = await twitterOracle.deployed()
            await instance.pause({ from: accounts[9] });
            let pauseLog = await waitForEvent(instance.Pause({}, { fromBlock: 0, toBlock: 'latest' }));
            assert.equal(pauseLog.event, "Pause", 'Contract not paused!')
        })

        // Check that while the contract is paused, that certain contract functions are not accessible
        it('Contract should not work when paused', async () => {
            let instance = await twitterOracle.deployed();
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
            let instance = await twitterOracle.deployed()
            await instance.destroy({ from: accounts[9] });
            let contractCode = await web3.eth.getCode(instance.address);
            assert.equal(contractCode, '0x0', 'Contract not destroyed!')
        })

    })
})