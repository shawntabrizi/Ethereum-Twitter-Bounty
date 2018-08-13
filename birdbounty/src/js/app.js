App = {
  web3Provider: null,
  contracts: {},
  numOfBounties: 0,

  init: function () {



    return App.initWeb3();
  },

  initWeb3: function () {

    // Is there an injected web3 instance?
    if (typeof web3 !== 'undefined') {
      App.web3Provider = web3.currentProvider;
    } else {
      // If no injected web3 instance is detected, fall back to Ganache
      App.web3Provider = new Web3.providers.HttpProvider('http://localhost:7545');
    }
    web3 = new Web3(App.web3Provider);

    return App.initContract();
  },

  initContract: function () {

    $.getJSON('BirdBounty.json', function (data) {
      // Get the necessary contract artifact file and instantiate it with truffle-contract
      var BirdBountyArtifact = data;
      App.contracts.BirdBounty = TruffleContract(BirdBountyArtifact);

      // Set the provider for our contract
      App.contracts.BirdBounty.setProvider(App.web3Provider);

      // Use our contract to retrieve and mark the adopted pets
      return App.getNumOfBounties();
    });

    return App.bindEvents();
  },

  bindEvents: function () {

    $("#submit-oracle").click(App.oraclizeTweet);

    $("#submit-bird-bounty").click(App.submitBirdBounty);

  },

  showErrorMessage: function (message) {
    $("#message-output").text(message);
    $("#message-output").addClass('alert-danger').removeClass('alert-secondary');
    $("#message-output").show();
  },

  showNormalMessage: function (message) {
    $("#message-output").text(message);
    $("#message-output").removeClass('alert-danger').addClass('alert-secondary');
    $("#message-output").show();
  },

  getNumOfBounties: function () {
    var birdBountyInstance;

    App.contracts.BirdBounty.deployed().then(function (instance) {
      birdBountyInstance = instance;
      birdBountyInstance.getNumBounties()
        .then(function (result) {
          console.log("Num of bounties: " + result);
          App.numOfBounties = result.toNumber();
          return App.showBounties();
        });
    });
  },

  convertToBountyObject: function (bountyArray) {
    return {
      bountyIssuer: bountyArray[0],
      fulfillmentAmount: bountyArray[1],
      balance: bountyArray[2],
      data: bountyArray[3],
      bountyOpen: bountyArray[4]
    }
  },

  showBounty: function (bountyObject, index) {
    var bountyRow = $('#bountyRow');
    var bountyTemplate = $('#bountyTemplate');

    try {
      bountyTemplate.find('.bounty-text').text(JSON.parse(bountyObject.data).join(""));
    } catch {
      bountyTemplate.find('.bounty-text').text(bountyObject.data);
    }


    bountyTemplate.find('.bounty-issuer').text(bountyObject.bountyIssuer);
    bountyTemplate.find('.fulfillment-amount').text(bountyObject.fulfillmentAmount);
    bountyTemplate.find('.bounty-balance').text(bountyObject.balance);
    bountyTemplate.find('.bounty-number').text(index);
    if (bountyObject.bountyOpen) {
      bountyTemplate.find('.btn-submit').attr('disabled', false);
    }

    bountyRow.prepend(bountyTemplate.html());

  },

  showBounties: function () {


    var birdBountyInstance;


    App.contracts.BirdBounty.deployed().then(function (instance) {
      var promises = [];

      birdBountyInstance = instance;
      for (i = App.numOfBounties - 1; i >= 0; i--) {
        promises.push(i);
        promises.push(birdBountyInstance.getBounty(i))
      }

      return promises;
    }).then(function (promises) {
      Promise.all(promises).then(function (result) {
        for (i = 0; i < result.length; i += 2) {
          bountyObject = App.convertToBountyObject(result[i + 1]);
          App.showBounty(bountyObject, result[i])
        }
      });
    })

  },

  oraclizeTweet: function () {
    var birdBountyInstance;
    $("#tweet-output").hide();
    var tweetUrl = $('#twitter-url').val();

    if (tweetUrl.includes("https://twitter.com/")) {
      tweetId = tweetUrl.replace("https://twitter.com/", "");

      App.contracts.BirdBounty.deployed().then(function (instance) {
        birdBountyInstance = instance;
        return birdBountyInstance.getTweetText(tweetId)

      }).then(function (result) {
        if (result == "") {
          return birdBountyInstance.oraclizeTweet(tweetId);
        } else {
          App.showOracleTweetText(result);
          return result;
        }
      }).then(function (result) {
        console.log("Oraclize Result:" + JSON.stringify(result));
        App.checkOracle(0);
      });
    } else {
      App.showErrorMessage("Bad URL.")
    }
  },

  showOracleTweetText: function (text) {
    $("#tweet-oracle-text").text(text);
    $("#message-output").hide();
    $("#tweet-output").show();
  },

  checkOracle: function (count) {
    if (count > 30) {
      App.showErrorMessage("Something went wrong with oraclizing this tweet.");
      return;
    }

    var birdBountyInstance;
    var tweetUrl = $('#twitter-url').val();

    if (tweetUrl.includes("https://twitter.com/")) {
      tweetId = tweetUrl.replace("https://twitter.com/", "");

      App.contracts.BirdBounty.deployed().then(function (instance) {
        birdBountyInstance = instance;

        return birdBountyInstance.getTweetText(tweetId)
      }).then(function (result) {
        if (result == "") {
          App.showNormalMessage("Loading... (" + count + ")");
          setTimeout(function () {
            App.checkOracle(count + 1);
          }, 1000);
        } else {
          App.showOracleTweetText(result);
        }

      })


    } else {
      console.log("Bad URL")
    }
  },

  createBirdBounty: function (fulfillmentAmount, postId, initialBalance) {
    var birdBountyInstance;
    console.log(fulfillmentAmount, postId, initialBalance)
    App.contracts.BirdBounty.deployed().then(function (instance) {
      birdBountyInstance = instance;
      var bountyId
      birdBountyInstance.createBounty.call(fulfillmentAmount, postId, { value: initialBalance })
        .then(function (id) {
          bountyId = id;
        }).then(function () {
          birdBountyInstance.createBounty(fulfillmentAmount, postId, { value: initialBalance })
            .then(function () {
              bountyId = bountyId.toNumber();
              console.log(bountyId);
              birdBountyInstance.getBounty(bountyId).then(function (result) {
                var bountyObject = App.convertToBountyObject(result);
                App.showBounty(bountyObject, bountyId);
              });
            });
        });
    });
  },

  submitBirdBounty: function () {
    var fulfillmentAmount = $("#fulfillment-amount-input").val();
    var initialBalance = $("#initial-balance-input").val();
    var tweetUrl = $('#twitter-url').val();

    if (tweetUrl.includes("https://twitter.com/")) {
      tweetId = tweetUrl.replace("https://twitter.com/", "");
      App.createBirdBounty(fulfillmentAmount, tweetId, initialBalance);

    } else {
      App.showErrorMessage("Bad URL.")
    }

  }

};

$(function () {
  $(window).load(function () {
    App.init();
  });
});