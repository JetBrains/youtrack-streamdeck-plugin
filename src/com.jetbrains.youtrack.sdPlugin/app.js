/// <reference path="libs/js/action.js" />
/// <reference path="libs/js/stream-deck.js" />

const myAction = new Action('com.jetbrains.youtrack.get-ticket-count');
myAction.cache = {}
function APIRequest(context, settings) {
    const youTrack = {
        Ready: false,
        token: "",
        url: "",
        searchQuery: "",
        GetTicketsCount: async function () {
            if (youTrack.ready) {
                return await youTrack.RunQuery(youTrack.url, youTrack.token, youTrack.searchQuery);
            } else {
                return "Error";
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
    let poll_timer = 0;
    function sendRequest() {
        youTrack.GetTicketsCount().then((ticketCount) => {
            let title = settings["yt-search-name"] + "\n" + ticketCount;
            $SD.setTitle(context, title);
        });
    }
    function restartPeriodicPoll() {
        destroy();
        youTrack.token = settings["yt-token"];
        youTrack.url = settings["yt-url"];
        youTrack.searchQuery = settings["yt-search-query"];
        youTrack.ready = true;
        let delay = settings["refreshInterval"]  || 10;
        sendRequest();
        poll_timer = setInterval(function (){
            sendRequest()
        },  1000 * delay)
    }
    function destroy() {
        if (poll_timer !== 0) {
            window.clearInterval(poll_timer);
            poll_timer = 0;
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
    //TODO: open Browser page with YouTrack query
    const api_request = myAction.cache[context];
    console.log(api_request);
    if (!api_request)
        $SD.showAlert(context);
    else
        api_request.OpenPage();
    console.log(payload)
    console.log('Your key code goes here!');
});
myAction.onSendToPlugin(async ({action, context, device, event, payload}) => {
    console.log(action, context, device, event, payload);
    if (action === 'com.jetbrains.youtrack.get-ticket-count') {
        const apiRequest = new APIRequest(context, payload.settings);
        myAction.cache[context] = apiRequest;
    }

});
myAction.onWillAppear(async ({action, context, device, event, payload}) => {
    // myAction.cache[context] = new APIRequest(context, payload.settings);
})
myAction.onWillDisappear(async ({action, context, device, event, payload}) => {
    let api_request = myAction.cache[context];
    if (api_request) {
        api_request.destroy();
        delete myAction.cache[context];
    }
})



