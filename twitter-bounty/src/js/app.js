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
      App.web3Provider = new Web3.providers.HttpProvider('http://localhost:8545');
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

      // Use our contract to retrieve show any current bounties
      return App.showBounties();
    }).then(function () {
      // Add on-click events to all the buttons that get created on the page
      return App.bindEvents();
    });


  },

  bindEvents: function () {
    // Add events to all the buttons on the page
    $("#submit-oracle").click(App.oraclizeTweet);
    $("#submit-twitter-bounty").click(App.submitTwitterBounty);
    $("#create-bounty-jumbo").click(App.showCreateBountyInput);
    $("#fulfill-bounty-jumbo").click(App.showFulfillBountyInput);
    $("#fulfill-bountyid-input").change(App.checkBountyFulfill);
    $("#fulfill-twitter-bounty").click(App.claimBounty);
    // All bounty cards are marked with "data-id" property
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

    // Then add event listeners for the different contract events
    return App.eventListeners();
  },

  eventListeners: function () {
    // Add event listeners to update the UX when different contract events occur
    var twitterBountyInstance;
    App.contracts.TwitterBounty.deployed().then(function (instance) {
      twitterBountyInstance = instance;
      
      // Listen for a bounty to update its payout
      var PayoutChanged = twitterBountyInstance.PayoutChanged();
      PayoutChanged.watch(function (error, result) {
        if (!error) {
          console.log("Updating Bounty #" + result.args._bountyId.toNumber());
          App.updateBounty(result.args._bountyId.toNumber());
        }
      });

      // Listen for a bounty to be fulfilled
      var BountyFulfilled = twitterBountyInstance.BountyFulfilled();
      BountyFulfilled.watch(function (error, result) {
        if (!error) {
          console.log("Updating Bounty #" + result.args._bountyId.toNumber());
          App.updateBounty(result.args._bountyId.toNumber());
        }
      });

      // Listen for someone to contribute to a bounty
      var ContributionAdded = twitterBountyInstance.ContributionAdded();
      ContributionAdded.watch(function (error, result) {
        if (!error) {
          console.log("Updating Bounty #" + result.args._bountyId.toNumber());
          App.updateBounty(result.args._bountyId.toNumber());
        }
      });

      // Listen for the owner to close a bounty and update the UX
      var BountyClosed = twitterBountyInstance.BountyClosed();
      BountyClosed.watch(function (error, result) {
        if (!error) {
          console.log("Closing Bounty #" + result.args._bountyId.toNumber());
          App.updateBounty(result.args._bountyId.toNumber());
        }
      });

      // Listen for a bounty to be created and show it in the UX
      var BountyCreated = twitterBountyInstance.BountyCreated();
      BountyCreated.watch(function (error, result) {
        if (!error) {
          console.log("Adding Bounty #" + result.args._bountyId.toNumber());
          App.showCreatedBounty(result.args._bountyId.toNumber());
        }
      });

      console.log("Listeners Activated")
    });
  },

  // Update the properties on the bounty including "closing" it
  updateBounty: function (bountyId) {
    var twitterBountyInstance;
    App.contracts.TwitterBounty.deployed().then(function (instance) {
      twitterBountyInstance = instance;
      return twitterBountyInstance.getBounty(bountyId);
    }).then(function (result) {
      bountyObject = App.convertToBountyObject(result);
      if (bountyObject.bountyOpen){
        $(".fulfillment-amount[data-id='" + bountyId + "']").text(web3.fromWei(bountyObject.fulfillmentAmount, 'ether'));
        $(".bounty-balance[data-id='" + bountyId + "']").text(web3.fromWei(bountyObject.balance, 'ether'));
      } else {
        $(".fulfillment-amount-group[data-id='" + bountyId + "']").hide();
        $(".bounty-balance-group[data-id='" + bountyId + "']").hide();
        $(".btn-group[data-id='" + bountyId + "']").empty();
        $(".btn-group[data-id='" + bountyId + "']").append("<div class='btn btn-sm btn-outline-danger'>Bounty Closed</button>")
      }
    });
  },

  // Add a new card to the webpage for the bounty
  showCreatedBounty: function (bountyId) {
    var twitterBountyInstance;
    App.contracts.TwitterBounty.deployed().then(function (instance) {
      twitterBountyInstance = instance;
      twitterBountyInstance.getBounty(bountyId).then(function (result) {
        var bountyObject = App.convertToBountyObject(result);
        App.showBounty(bountyObject, bountyId);
      });
    });
  },

  // Add an error message to the jumbotron
  showErrorMessage: function (message) {
    $("#message-output").text(message);
    $("#message-output").addClass('alert-danger').removeClass('alert-secondary');
    $("#message-output-container").collapse('show');
  },

  // Add a normal message to the jumbotron
  showNormalMessage: function (message) {
    $("#message-output").text(message);
    $("#message-output").removeClass('alert-danger').addClass('alert-secondary');
    $("#message-output-container").collapse('show');
  },

  // Get the number of bounties stored in the contract
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

  // Convert the tuple returned from the contract into a bounty object
  convertToBountyObject: function (bountyArray) {
    return {
      bountyIssuer: bountyArray[0],
      fulfillmentAmount: bountyArray[1],
      balance: bountyArray[2],
      data: bountyArray[3],
      bountyOpen: bountyArray[4]
    }
  },

  // Given a bounty object, create a new card for it on the webpage
  showBounty: function (bountyObject, index) {
    var bountyRow = $('#bountyRow');
    // This is an HTML template for a bounty card
    var bountyTemplate = $('#bountyTemplate').clone(true, true);

    // Oraclize sometimes returns an array, which we want to join into a normal array
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
      // Add the data-id to all the properties on the bounty card template
      bountyTemplate.find('*').attr('data-id', index);
      // Check if the logged in user is NOT the bounty owner
      if (bountyObject.bountyIssuer != web3.eth.accounts[0]) {
        bountyTemplate.find('.btn-fulfillment').remove();
        bountyTemplate.find('.btn-close').remove();
      }
    } else {
      // If the bounty is closed
      bountyTemplate.find('.fulfillment-amount-group').hide();
      bountyTemplate.find('.bounty-balance-group').hide();
      bountyTemplate.find('.btn-group').empty();
      bountyTemplate.find('.btn-group').append("<div class='btn btn-sm btn-outline-danger'>Bounty Closed</button>")
    }

    //Add it to the front of the list
    bountyRow.prepend(bountyTemplate.html());
  },

  showBounties: function () {
    // Clear the bounty area
    $('#bountyRow').empty();

    var twitterBountyInstance;
    App.getNumOfBounties().then(function () {
      App.contracts.TwitterBounty.deployed().then(function (instance) {
        // Array of promises to store all "getBounty" requests
        var promises = [];
        // Show message if there are no bounties
        if (App.numOfBounties == 0) {
          console.log("No Bounties")
          $("#bountyRow").text("No bounties have been created yet!");
        } else {
          twitterBountyInstance = instance;
          // Push all bounties to Promise array, one for bounty index, one for bounty object
          for (i = 0; i < App.numOfBounties; i++) {
            promises.push(i);
            promises.push(twitterBountyInstance.getBounty(i))
          }
        }
        return promises;
      }).then(function (promises) {
        // Resolve all promises, and 'untangle' index data from bounty object
        Promise.all(promises).then(function (result) {
          for (i = 0; i < result.length; i += 2) {
            bountyObject = App.convertToBountyObject(result[i + 1]);
            // Show the bounty in the UX
            App.showBounty(bountyObject, result[i])
          }
        });
      })
    });
  },

  // Take the tweet input, check it, and then initiate the oraclize call
  oraclizeTweet: function () {
    var twitterBountyInstance;
    var tweetUrl = $('#twitter-url').val();

    // Check the URL is formatted correctly
    if (tweetUrl.includes("https://twitter.com/")) {
      tweetId = tweetUrl.replace("https://twitter.com/", "");

      App.contracts.TwitterBounty.deployed().then(function (instance) {
        twitterBountyInstance = instance;
        // Check if the tweet has already been oraclized
        return twitterBountyInstance.getTweetText(tweetId)

      }).then(function (result) {
        // If not, go and oraclize the tweet
        if (result == "") {
          $("#tweet-output").collapse('hide');
          return twitterBountyInstance.oraclizeTweet(tweetId);
        // Otherwise, just show the text we already stored
        } else {
          App.showOracleTweetText(result);
          return result;
        }
      }).then(function (result) {
        // Loop and check the oracle to successfully complete oraclizing
        App.checkOracle(0);
      });
    } else {
      App.showErrorMessage("Bad URL.")
    }
  },

  // Show the result from Oraclize in the Jumbotron
  showOracleTweetText: function (text) {
    // Oraclize sometimes returns an array, which we want to join into a normal array
    try {
      $("#tweet-oracle-text").text(JSON.parse(text).join(""));
    } catch {
      $("#tweet-oracle-text").text(text);
    }
    $("#message-output-container").collapse('hide');
    $("#create-bounty-input").collapse('hide');
    $("#fulfill-bounty-input").collapse('hide')
    $("#tweet-output").collapse('show');
  },

  // This function loops every second to check if the oracle has completed the process. After 1 minute, it returns an error message
  checkOracle: function (count) {
    // Adjust this count if you want to wait longer or shorter
    if (count > 60) {
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
        // We assume "" means the tweet was not retrieved
        if (result == "") {
          // Show loading message
          App.showNormalMessage("Loading... (" + count + ")");
          // Recursively call the function after 1 second
          setTimeout(function () {
            App.checkOracle(count + 1);
          }, 1000);
        } else {
          // When done, show the tweet text and end the loop
          App.showOracleTweetText(result);
        }
      });
    } else {
      console.log("Bad URL")
    }
  },

  // Calls the contract to create a new Twitter bounty
  createTwitterBounty: function (fulfillmentAmount, postId, initialBalance) {
    var twitterBountyInstance;
    var initialBalanceWei = web3.toWei(initialBalance, 'ether');
    var fulfillmentAmountWei = web3.toWei(fulfillmentAmount, 'ether');
    App.contracts.TwitterBounty.deployed().then(function (instance) {
      twitterBountyInstance = instance;
      var bountyId
      //First "call" to get which Bounty ID would be created
      twitterBountyInstance.createBounty.call(fulfillmentAmountWei, postId, { value: initialBalanceWei })
        .then(function (id) {
          bountyId = id;
          //Then actually make the call
          return twitterBountyInstance.createBounty(fulfillmentAmountWei, postId, { value: initialBalanceWei })
        });
    });
  },

  // Get the data from the UX to make the correct call to the contract
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

  // Acts as a toggle for Bounty over Fulfill
  showCreateBountyInput: function () {
    $("#create-bounty-input").collapse('show');
    $("#fulfill-bounty-input").collapse('hide');
  },

  // Acts as a toggle for Fulfill over Bounty, loads the options to select a bounty # to fulfill
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

  // Check if an oraclized tweet will fulfill a bounty
  checkBountyFulfill: function () {
    var twitterBountyInstance;
    var tweetUrl = $('#twitter-url').val();
    var bountyId = $('#fulfill-bountyid-input').val();

    if (tweetUrl.includes("https://twitter.com/")) {
      tweetId = tweetUrl.replace("https://twitter.com/", "");

      App.contracts.TwitterBounty.deployed().then(function (instance) {
        twitterBountyInstance = instance;
        // We can check without making any real contract calls. Check on the client side.
        return twitterBountyInstance.fulfillBounty.call(bountyId, tweetId)
      }).then(function (result) {
        // If it would work, let the user make the contract call
        if (result) {
          $("#fulfill-bountyid-message").text("Looks good! Claim your bounty.")
          $("#fulfill-twitter-bounty").addClass("btn-outline-success").removeClass("btn-outline-danger").removeClass("btn-outline-secondary")
          $("#fulfill-twitter-bounty").prop('disabled', false);
        }
      // If it won't work, stop the user from submitting the contract call
      }).catch(function () {
        $("#fulfill-bountyid-message").text("This tweet won't work...")
        $("#fulfill-twitter-bounty").prop('disabled', true);
        $("#fulfill-twitter-bounty").removeClass("btn-outline-success").addClass("btn-outline-danger").removeClass("btn-outline-secondary")
      })
    }
  },

  // Contract call to fulfill the bounty
  claimBounty: function () {
    var twitterBountyInstance;
    var tweetUrl = $('#twitter-url').val();
    var bountyId = $('#fulfill-bountyid-input').val();

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

  // Contract call to close the bounty
  closeBounty: function (id) {
    var twitterBountyInstance;
    App.contracts.TwitterBounty.deployed().then(function (instance) {
      twitterBountyInstance = instance;
      // When testing, I was running into out of gas issues with Metamask. I set a pretty high gas amount to prevent that
      return instance.closeBounty(id, {gas: 60000})
    });
  },

  // Allow the user to contribute to a bounty, add the listener function to the button to call the contract
  contributeToBounty: function (id) {
    $(".modify-bounty-container[data-id='" + id + "']").collapse('show')
    $(".modify-bounty-button[data-id='" + id + "']").text("Contribute")
    $(".modify-bounty-button[data-id='" + id + "']").addClass('btn-outline-success').removeClass('btn-outline-secondary')
    $(".modify-bounty-button[data-id='" + id + "']").unbind()
    $(".modify-bounty-button[data-id='" + id + "']").click(function () {
      var twitterBountyInstance;
      var amount = $(".modify-bounty-input[data-id='" + id + "']").val();
      var amountWei = web3.toWei(amount, 'ether');
      App.contracts.TwitterBounty.deployed().then(function (instance) {
        twitterBountyInstance = instance;
        return instance.contribute(id, { value: amountWei });
      });
    });
  },

  // Allow the user to edit the bounty payout, add a listner to the button to call the contract
  editBountyFulfillment: function (id) {
    $(".modify-bounty-container[data-id='" + id + "']").collapse('show')
    $(".modify-bounty-button[data-id='" + id + "']").text("Edit")
    $(".modify-bounty-button[data-id='" + id + "']").removeClass('btn-outline-success').addClass('btn-outline-secondary')
    $(".modify-bounty-button[data-id='" + id + "']").unbind()
    $(".modify-bounty-button[data-id='" + id + "']").click(function () {
      var twitterBountyInstance;
      var amount = $(".modify-bounty-input[data-id='" + id + "']").val();
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
