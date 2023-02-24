/// <reference path="libs/js/action.js" />
/// <reference path="libs/js/stream-deck.js" />

const myAction = new Action('com.jetbrains.youtrack.get-ticket-count');
myAction.cache = {}
myAction.polls = {}

function APIRequest(context, settings) {
    const youTrack = {
        Ready: false,
        token: "",
        url: "",
        searchQuery: "",
        GetTicketsCount: async function () {
            try {
                if (youTrack.Ready) {
                    return await youTrack.RunQuery(youTrack.url, youTrack.token, youTrack.searchQuery);
                } else {
                    return -1;
                }
            } catch (e) {
                console.log(e.stack);
                return -1;
            }
        },
        RunQuery: async function (url, token, query) {
            url = url + '/api/issues?fields=idReadable,summary,votes,customFields(projectCustomField(field(name)),value(name))&$top=500&query=' + youTrack.EscapeQuery(query)
            console.log("executing: " + query);
            let response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer ' + token,
                }
            });
            const data = await response.json();
            return data.length;
        },
        EscapeQuery: function (query) {
            return query.replace(/ /g, '+').replace(/#/g, '%23');
        },
        OpenPage: function () {
            let url = youTrack.url + '/issues?q=' + youTrack.EscapeQuery(youTrack.searchQuery)
            $SD.openUrl(url);
        }
    };
    let firstRequestFinished = false;

    async function sendRequest() {
        try {
            let ticketCount = await youTrack.GetTicketsCount();
            let count = ticketCount.toString();

            if (settings["hide-zero"] === "on" && ticketCount === 0) {
                count = "";
            } else if (ticketCount === -1) {
                count = "N/A";
            }

            let name = settings["yt-search-name"] || "";
            let title = name.length > 0 ? name + "\n" + count : count;
            firstRequestFinished = true;
            console.log("updating title: " + title);
            $SD.setTitle(context, title);
        } catch (e) {
            console.error(e)
        }
    }

    function restartPeriodicPoll() {
        destroy();
        firstRequestFinished = false;
        youTrack.token = settings["yt-token"];
        youTrack.url = settings["yt-url"];
        youTrack.searchQuery = settings["yt-search-query"];
        youTrack.Ready = !!(youTrack.url && youTrack.token && youTrack.searchQuery);
        refreshTitleWhilePolling(Math.floor(Math.random() * 3000));
        startPollingLoop(Math.floor(Math.random() * 5) + 1);
    }

    function startPollingLoop(wait) {
        myAction.polls[context] = setTimeout(async () => {
            await sendRequest()
            let delay = settings["refresh-interval"] || 60
            startPollingLoop(delay);
        }, wait * 1000);
    }

    function refreshTitleWhilePolling(wait = 1000) {
        console.log("refreshing title while polling in " + wait);
        let dots = ""

        function sleep(wait) {
            return new Promise(resolve => setTimeout(resolve, wait));
        }

        sleep(wait).then(() => {
            let id = setInterval(() => {
                if (!firstRequestFinished) {
                    dots += ".";
                    if (dots.length > 3) {
                        dots = "";
                    }
                    let name = settings["yt-search-name"] || "";
                    let title = name.length > 0 ? name + "\n" + dots : dots;
                    $SD.setTitle(context, title);
                } else {
                    clearInterval(id);
                }
            }, 1000);
        });
    }

    function destroy() {
        if (myAction.polls[context]) {
            clearTimeout(myAction.polls[context]);
            myAction.polls[context] = {};
        }
    }

    function updateSettings(new_settings) {
        settings = new_settings;
        restartPeriodicPoll();
    }

    function OpenPage() {
        youTrack.OpenPage();
    }

    restartPeriodicPoll();

    return {
        sendRequest: sendRequest,
        updateSettings: updateSettings,
        destroy: destroy,
        OpenPage: OpenPage
    };

}

/**
 * The first event fired when Stream Deck starts
 */
$SD.onConnected(({actionInfo, appInfo, connection, messageType, port, uuid}) => {
    console.log('Stream Deck connected!');
});

myAction.onKeyUp(({action, context, device, event, payload}) => {
    const api_request = myAction.cache[context];
    if (!api_request)
        $SD.showAlert(context);
    else
        api_request.OpenPage();
});
myAction.onDidReceiveSettings(({action, context, device, event, payload}) => {
    const settings = payload.settings;
    const api_request = myAction.cache[context];

    if (!settings || !api_request) return;

    api_request.updateSettings(settings);
    myAction.cache[context] = api_request;
})
myAction.onSendToPlugin(async ({action, context, device, event, payload}) => {
    if (action === 'com.jetbrains.youtrack.get-ticket-count') {
        myAction.cache[context] = new APIRequest(context, payload.settings);
    }

});
myAction.onWillAppear(async ({action, context, device, event, payload}) => {
    myAction.cache[context] = new APIRequest(context, payload.settings);
})
myAction.onWillDisappear(async ({action, context, device, event, payload}) => {
    let api_request = myAction.cache[context];
    if (api_request) {
        api_request.destroy();
        delete myAction.cache[context];
    }
})
