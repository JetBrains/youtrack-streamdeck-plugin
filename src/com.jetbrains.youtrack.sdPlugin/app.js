/// <reference path="libs/js/action.js" />
/// <reference path="libs/js/stream-deck.js" />

const myAction = new Action('com.jetbrains.youtrack.get-ticket-count');
myAction.activeTiles = {}

class PeriodicYouTrackRequest {
    settings
    context
    //todo: convert youTrack to class
    youTrack = {
        Ready: false,
        token: "",
        url: "",
        searchQuery: "",
        GetTicketsCount: async function () {
            try {
                if (this.Ready) {
                    return await this.RunQuery(this.url, this.token, this.searchQuery);
                } else {
                    return -1;
                }
            } catch (e) {
                console.log(e.stack);
                return -1;
            }
        },
        RunQuery: async function (url, token, query) {
            url = url + '/api/issues?fields=idReadable,summary,votes,customFields(projectCustomField(field(name)),value(name))&$top=500&query=' + this.EscapeQuery(query)
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
            let url = this.url + '/issues?q=' + this.EscapeQuery(this.searchQuery)
            $SD.openUrl(url);
        }
    };
    timers = {
        activeTimers: [],
        addTimer: function (name, timer) {
            this.activeTimers.push({name: name, timer: timer});
        },
        newPeriodicTask: function (name, callback, delay, initialDelay = Math.floor(Math.random() * 1000)) {
            let tick = async () => {
                await callback();
                if (this.timerIdExists(timer)) {
                    setTimeout(tick, delay);
                }
            }
            let timer = setTimeout(tick, initialDelay);
            this.addTimer(name, timer);

        },
        timerIdExists: function (id) {
            return this.activeTimers.some(x => x.timer === id);
        },
        timerNameExists: function (name) {
            return this.activeTimers.some(x => x.name === name);
        },
        stopAll: function () {
            this.activeTimers.forEach(timer => {
                clearInterval(timer.timer);
                clearTimeout(timer.timer);
            })
            this.activeTimers = [];
        },
        stopByName: function (name) {
            for (let activeTimersKey in this.activeTimers) {
                if (this.activeTimers[activeTimersKey].name === name) {
                    clearInterval(this.activeTimers[activeTimersKey].timer);
                    clearTimeout(this.activeTimers[activeTimersKey].timer);
                    this.activeTimers.splice(activeTimersKey, 1);
                }
            }
        },
    }
    updateSettings = (new_settings) => {
        this.settings = new_settings;
        this.settings["last-result"] = "";
        this.restart()
    }

    destroy() {
        this.timers.stopAll();
        console.log("destroyed all timers. Active timers:" + this.timers.activeTimers);
    }

    restart() {
        this.destroy()
        this.start();
    }

    start() {
        let restartPeriodicPoll = () => {
            this.destroy();
            IndicateOngoingRefresh();
            this.timers.newPeriodicTask("periodic-poll", refreshValue, this.settings["refresh-interval"] * 1000 || 60 * 1000);
        }
        let sendRequest = async () => {
            let ticketCount = await this.youTrack.GetTicketsCount();
            let count = -1;
            try {
                count = ticketCount.toString();
            } catch (e) {
                console.error("Could not get ticket count from response: ", +ticketCount);
            }
            if (this.settings["hide-zero"] === "on" && ticketCount === 0) {
                count = "";
            }
            return count;
        }

        let refreshValue = async () => {
            let ticketCount = await sendRequest()
            this.timers.stopByName("refreshIndicator")
            if (ticketCount !== -1) {
                updateLastResult(ticketCount)
                setTileValue(ticketCount)
            } else {
                setTileValue("!ERR")
            }
        }

        let updateLastResult = (ticketCount) => {
            this.settings["last-result"] = ticketCount;
            $SD.setSettings(this.context, this.settings);
        }

        let IndicateOngoingRefresh = (wait = 500) => {
            let dots = "";
            let title = "";
            let indicatorFunction = () => {
                dots += ".";
                if (dots.length > 3) {
                    dots = "";
                }
                // If there is a cached result, blinks the title while polling (indicating that the cached result is shown)
                if (this.settings["last-result"] && this.settings["last-result"] !== "" && this.settings["last-result"] !== undefined) {
                    if (dots.length % 2 !== 0) {
                        title = this.settings["last-result"];
                    } else {
                        title = "♻"
                    }
                } else {
                    title = dots;
                }
                if (this.timers.timerNameExists("refreshIndicator")) {
                    setTileValue(title);
                }
            }
            this.timers.newPeriodicTask("refreshIndicator", indicatorFunction, wait);
        }

        let setTileValue = (str) => {
            let name = this.settings["yt-search-name"] || "";
            let title = name.length > 0 ? name + "\n" + str : str;
            // console.log("setting title to: " + title.replace(/\n/g, "\\n"));
            $SD.setTitle(this.context, title);
        }
        this.fillYTSettings(this.settings);
        restartPeriodicPoll()
    }

    //todo: move fillYTSettings to youTrack object
    fillYTSettings = () => {
        this.youTrack.token = this.settings["yt-token"];
        this.youTrack.url = this.settings["yt-url"];
        this.youTrack.searchQuery = this.settings["yt-search-query"];
        this.youTrack.Ready = !!(this.youTrack.url && this.youTrack.token && this.youTrack.searchQuery);
    }

    constructor(context, settings) {
        this.settings = settings;
        this.context = context;
        this.start();
    }
}

/**
 * The first event fired when Stream Deck starts
 */
$SD.onConnected(({actionInfo, appInfo, connection, messageType, port, uuid}) => {
    console.log('Stream Deck connected!');
});

myAction.onKeyUp(({action, context, device, event, payload}) => {
    const api_request = myAction.activeTiles[context];
    if (!api_request || !api_request.youTrack.Ready)
        $SD.showAlert(context);
    else
        api_request.youTrack.OpenPage();
});
myAction.onDidReceiveSettings(({action, context, device, event, payload}) => {
    const settings = payload.settings;
    const api_request = myAction.activeTiles[context];

    if (!settings || !api_request) return;

    api_request.updateSettings(settings);
})
myAction.onSendToPlugin(async ({action, context, device, event, payload}) => {
    if (action === 'com.jetbrains.youtrack.get-ticket-count') {
        myAction.activeTiles[context] = new PeriodicYouTrackRequest(context, payload.settings);
    }

});
myAction.onWillAppear(async ({action, context, device, event, payload}) => {
    myAction.activeTiles[context] = new PeriodicYouTrackRequest(context, payload.settings);
})
myAction.onWillDisappear(async ({action, context, device, event, payload}) => {
    let yt_request = myAction.activeTiles[context];
    if (yt_request) {
        yt_request.destroy();
        delete myAction.activeTiles[context];
    }
})