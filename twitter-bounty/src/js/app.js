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

    $("#current-account-address").text(web3.eth.accounts[0]);

    return App.initContract();
  },

  initContract: function () {

    $.getJSON('TwitterBounty.json', function (data) {
      // Get the necessary contract artifact file and instantiate it with truffle-contract
      var TwitterBountyArtifact = data;
      App.contracts.TwitterBounty = TruffleContract(TwitterBountyArtifact);

      // Set the provider for our contract
      App.contracts.TwitterBounty.setProvider(App.web3Provider);

      // Use our contract to retrieve and mark the adopted pets
      return App.showBounties();
    }).then(function() {
      return App.bindEvents();
    });

    
  },

  bindEvents: function () {
    $("#submit-oracle").click(App.oraclizeTweet);
    $("#submit-twitter-bounty").click(App.submitTwitterBounty);
    $("#create-bounty-jumbo").click(App.showCreateBountyInput);
    $("#fulfill-bounty-jumbo").click(App.showFulfillBountyInput);
    $("#fulfill-bountyid-input").change(App.checkBountyFulfill);
    $("#fulfill-twitter-bounty").click(App.claimBounty);
    $(document).on('click', '.btn-close', (function () {
      var id = $(this).data('id');
      App.closeBounty(id);
    }));
    $(document).on('click', '.btn-contribute', (function () {
      var id = $(this).data('id');
      App.contributeToBounty(id);
    }));
    $(document).on('click', '.btn-fulfillment', (function () {
      var id = $(this).data('id');
      App.editBountyFulfillment(id);
    }));
  },

  showErrorMessage: function (message) {
    $("#message-output").text(message);
    $("#message-output").addClass('alert-danger').removeClass('alert-secondary');
    $("#message-output-container").collapse('show');
  },

  showNormalMessage: function (message) {
    $("#message-output").text(message);
    $("#message-output").removeClass('alert-danger').addClass('alert-secondary');
    $("#message-output-container").collapse('show');
  },

  getNumOfBounties: function () {
    var twitterBountyInstance;

    return App.contracts.TwitterBounty.deployed().then(function (instance) {
      twitterBountyInstance = instance;
      return twitterBountyInstance.getNumBounties()
    }).then(function (result) {
      console.log("Num of bounties: " + result);
      App.numOfBounties = result.toNumber();
      return App.numOfBounties;
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
    var bountyTemplate = $('#bountyTemplate').clone(true, true);

    try {
      bountyTemplate.find('.bounty-text').text(JSON.parse(bountyObject.data).join(""));
    } catch {
      bountyTemplate.find('.bounty-text').text(bountyObject.data);
    }


    bountyTemplate.find('.bounty-issuer').text(bountyObject.bountyIssuer);
    bountyTemplate.find('.fulfillment-amount').text(web3.fromWei(bountyObject.fulfillmentAmount, 'ether'));
    bountyTemplate.find('.bounty-balance').text(web3.fromWei(bountyObject.balance, 'ether'));
    bountyTemplate.find('.bounty-number').text(index);
    if (bountyObject.bountyOpen) {
      bountyTemplate.find('*').attr('data-id', index);
      if (bountyObject.bountyIssuer != web3.eth.accounts[0]) {
        bountyTemplate.find('.btn-fulfillment').remove();
        bountyTemplate.find('.btn-close').remove();
      }
    } else {
      bountyTemplate.find('.fulfillment-amount-group').hide();
      bountyTemplate.find('.bounty-balance-group').hide();
      bountyTemplate.find('.btn-group').empty();
      bountyTemplate.find('.btn-group').append("<div class='btn btn-sm btn-outline-danger'>Bounty Closed</button>")
    }

    bountyRow.prepend(bountyTemplate.html());
  },

  showBounties: function () {
    $('#bountyRow').empty();

    var twitterBountyInstance;

    App.getNumOfBounties().then(function () {
      App.contracts.TwitterBounty.deployed().then(function (instance) {
        var promises = [];

        twitterBountyInstance = instance;
        for (i = 0; i < App.numOfBounties; i++) {
          promises.push(i);
          promises.push(twitterBountyInstance.getBounty(i))
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
    });
  },

  oraclizeTweet: function () {
    var twitterBountyInstance;
    var tweetUrl = $('#twitter-url').val();

    if (tweetUrl.includes("https://twitter.com/")) {
      tweetId = tweetUrl.replace("https://twitter.com/", "");

      App.contracts.TwitterBounty.deployed().then(function (instance) {
        twitterBountyInstance = instance;
        return twitterBountyInstance.getTweetText(tweetId)

      }).then(function (result) {
        if (result == "") {
          $("#tweet-output").collapse('hide');
          return twitterBountyInstance.oraclizeTweet(tweetId);
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
    $("#message-output-container").collapse('hide');
    $("#create-bounty-input").collapse('hide');
    $("#fulfill-bounty-input").collapse('hide')
    $("#tweet-output").collapse('show');
  },

  checkOracle: function (count) {
    if (count > 30) {
      App.showErrorMessage("Something went wrong with oraclizing this tweet.");
      return;
    }

    var twitterBountyInstance;
    var tweetUrl = $('#twitter-url').val();

    if (tweetUrl.includes("https://twitter.com/")) {
      tweetId = tweetUrl.replace("https://twitter.com/", "");

      App.contracts.TwitterBounty.deployed().then(function (instance) {
        twitterBountyInstance = instance;

        return twitterBountyInstance.getTweetText(tweetId)
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

  createTwitterBounty: function (fulfillmentAmount, postId, initialBalance) {
    var twitterBountyInstance;
    console.log(fulfillmentAmount, postId, initialBalance)
    var initialBalanceWei = web3.toWei(initialBalance, 'ether');
    var fulfillmentAmountWei = web3.toWei(fulfillmentAmount, 'ether');
    App.contracts.TwitterBounty.deployed().then(function (instance) {
      twitterBountyInstance = instance;
      var bountyId
      twitterBountyInstance.createBounty.call(fulfillmentAmountWei, postId, { value: initialBalanceWei })
        .then(function (id) {
          bountyId = id;
        }).then(function () {
          twitterBountyInstance.createBounty(fulfillmentAmountWei, postId, { value: initialBalanceWei })
            .then(function () {
              bountyId = bountyId.toNumber();
              console.log(bountyId);
              twitterBountyInstance.getBounty(bountyId).then(function (result) {
                var bountyObject = App.convertToBountyObject(result);
                App.showBounties();
              });
            });
        });
    });
  },

  submitTwitterBounty: function () {
    var fulfillmentAmount = $("#fulfillment-amount-input").val();
    var initialBalance = $("#initial-balance-input").val();
    var tweetUrl = $('#twitter-url').val();

    if (tweetUrl.includes("https://twitter.com/")) {
      tweetId = tweetUrl.replace("https://twitter.com/", "");
      App.createTwitterBounty(fulfillmentAmount, tweetId, initialBalance);

    } else {
      App.showErrorMessage("Bad URL.")
    }

  },

  showCreateBountyInput: function () {
    $("#create-bounty-input").collapse('show');
    $("#fulfill-bounty-input").collapse('hide');
  },

  showFulfillBountyInput: function () {
    $("#fulfill-bountyid-input").empty();
    $("#fulfill-bountyid-message").empty();
    $("#fulfill-twitter-bounty").prop('disabled', true)
    $("#fulfill-twitter-bounty").removeClass("btn-outline-success").removeClass("btn-outline-danger").addClass("btn-outline-secondary")

    $("#fulfill-bountyid-input").append("<option selected>Choose...</option>")
    for (i = App.numOfBounties - 1; i >= 0; i--) {
      $("#fulfill-bountyid-input").append("<option val='" + i + "'>" + i + "</option>");
    }
    $("#create-bounty-input").collapse('hide');
    $("#fulfill-bounty-input").collapse('show');
  },

  checkBountyFulfill: function () {
    var twitterBountyInstance;
    var tweetUrl = $('#twitter-url').val();
    var bountyId = $('#fulfill-bountyid-input').val();

    console.log(tweetUrl, bountyId)

    if (tweetUrl.includes("https://twitter.com/")) {
      tweetId = tweetUrl.replace("https://twitter.com/", "");

      App.contracts.TwitterBounty.deployed().then(function (instance) {
        twitterBountyInstance = instance;

        return twitterBountyInstance.fulfillBounty.call(bountyId, tweetId)

      }).then(function (result) {
        if (result) {
          $("#fulfill-bountyid-message").text("Looks good! Claim your bounty.")
          $("#fulfill-twitter-bounty").addClass("btn-outline-success").removeClass("btn-outline-danger").removeClass("btn-outline-secondary")
          $("#fulfill-twitter-bounty").prop('disabled', false);
        }
      }).catch(function () {
        $("#fulfill-bountyid-message").text("This tweet won't work...")
        $("#fulfill-twitter-bounty").prop('disabled', true);
        $("#fulfill-twitter-bounty").removeClass("btn-outline-success").addClass("btn-outline-danger").removeClass("btn-outline-secondary")
      })
    }
  },

  claimBounty: function () {
    var twitterBountyInstance;
    var tweetUrl = $('#twitter-url').val();
    var bountyId = $('#fulfill-bountyid-input').val();

    console.log(tweetUrl, bountyId)

    if (tweetUrl.includes("https://twitter.com/")) {
      tweetId = tweetUrl.replace("https://twitter.com/", "");

      App.contracts.TwitterBounty.deployed().then(function (instance) {
        twitterBountyInstance = instance;

        return twitterBountyInstance.fulfillBounty(bountyId, tweetId);
      }).then(function () {
        $("#next-steps").empty();
        $("#next-steps").append(
          `<div class="alert alert-success" role="alert">
            <strong>Nice! You got paid.</strong> Now keep tweeting!
          </div>`
        );
      });
    }
  },

  closeBounty: function (id) {
    var twitterBountyInstance;
    App.contracts.TwitterBounty.deployed().then(function (instance) {
      twitterBountyInstance = instance;

      return instance.closeBounty(id)
    });
  },

  contributeToBounty: function (id) {
    $(".modify-bounty-container[data-id='" + id +"']").collapse('show')
    $(".modify-bounty-button[data-id='" + id +"']").text("Contribute")
    $(".modify-bounty-button[data-id='" + id +"']").addClass('btn-outline-success').removeClass('btn-outline-secondary')

    $(".modify-bounty-button[data-id='" + id +"']").unbind()
    $(".modify-bounty-button[data-id='" + id +"']").click( function () {
      var twitterBountyInstance;
      console.log("Contribute" + id)
      var amount = $(".modify-bounty-input[data-id='" + id +"']").val();
      console.log(amount);
      var amountWei = web3.toWei(amount, 'ether');
      App.contracts.TwitterBounty.deployed().then(function (instance) {
        twitterBountyInstance = instance;

        return instance.contribute(id, {value: amountWei});
      });
    });
  },
  
  editBountyFulfillment: function (id) {
    $(".modify-bounty-container[data-id='" + id +"']").collapse('show')
    $(".modify-bounty-button[data-id='" + id +"']").text("Edit")
    $(".modify-bounty-button[data-id='" + id +"']").removeClass('btn-outline-success').addClass('btn-outline-secondary')

    $(".modify-bounty-button[data-id='" + id +"']").unbind()
    $(".modify-bounty-button[data-id='" + id +"']").click( function () {
      var twitterBountyInstance;
      console.log("Contribute" + id)
      var amount = $(".modify-bounty-input[data-id='" + id +"']").val();
      console.log(amount);
      var amountWei = web3.toWei(amount, 'ether');
      App.contracts.TwitterBounty.deployed().then(function (instance) {
        twitterBountyInstance = instance;

        return instance.changePayout(id, amountWei);
      });
    });
  }

};

$(function () {
  $(window).load(function () {
    App.init();
  });
});
