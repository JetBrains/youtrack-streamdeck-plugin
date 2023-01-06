/// <reference path="../../../libs/js/property-inspector.js" />
/// <reference path="../../../libs/js/utils.js" />

$PI.onConnected(async (jsn) => {
    const {actionInfo, appInfo, connection, messageType, port, uuid} = jsn;
    const {payload, context} = actionInfo;
    const {settings} = payload;
    showSettings(settings);
    if (GetConnectionStatus(payload.settings["yt-url"], payload.settings["yt-token"]).ok) {
        $PI.sendToPlugin(payload)
    }

});

function showSettings(settings) {
    const form = document.querySelector('#property-inspector');
    Utils.setFormValue(settings, form);
    CheckAndUpdateConnectionStatus(settings);
    form.addEventListener(
        'input',
        Utils.debounce(150, () => {
            const value = Utils.getFormValue(form);
            $PI.setSettings(value);
            CheckAndUpdateConnectionStatus(value);
        })
    );
}


function CheckAndUpdateConnectionStatus(settings) {
    GetConnectionStatus(settings).then((connectionStatus) => {
        UpdateConnectionStatus(connectionStatus)
    })
}

function UpdateConnectionStatus(connectionStatus) {
    let StatusElement = document.querySelector('#yt-connection-status')
    if (!connectionStatus.ok) {
        StatusElement.innerHTML = "<span style='color: red'>Connection error.</span> Check the URL";
    } else if (connectionStatus.errorStatus) {
        StatusElement.innerHTML = "Error: " + connectionStatus.status;
    } else if (connectionStatus.ok) {
        StatusElement.innerHTML = "<span style='color: green'>Connected</span> as " + connectionStatus.data.login;
    }
}

async function GetConnectionStatus(settings) {
    let connectionStatus = {};
    let response = await GetLoginInfo(settings["yt-url"], settings["yt-token"])
    if (!response.ok) {
        connectionStatus.ok = false;
        return connectionStatus;
    }
    if (response.status !== 200) {
        connectionStatus.ok = false;
        connectionStatus.errorStatus = response.status
        return connectionStatus;
    }
    let data = await response.json();
    if (data.login.length > 0) {
        connectionStatus.data = data;
        connectionStatus.ok = true;
        return connectionStatus;
    }
    return connectionStatus.error = true;
}

async function GetLoginInfo(url, token) {
    return await fetch(url + '/api/users/me?fields=id,login,name', {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + token,
        }
    }).catch((error) => {
        return error
    })
}