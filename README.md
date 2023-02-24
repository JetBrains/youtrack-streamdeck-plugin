
# Stream Deck YouTrack Plugin

The `Stream Deck YouTrack Plugin` is a plugin to show the number of tickets in a YouTrack project on   [Stream Deck](https://developer.elgato.com/documentation/stream-deck/)

## Configuration

1. Clone repository and double-click `releases/com.jetbrains.youtrack.streamDeckPlugin` to install plugin
2. Add "Issues Count by Search query" action from YouTrack section to Stream Deck
3. Click on the action and enter the following parameters:
    * YouTrack URL (e.g. `https://youtrack.jetbrains.com`)
    * YouTrack API Token (see [YouTrack API Token](https://www.jetbrains.com/help/youtrack/standalone/Manage-Permanent-Token.html))
    * Search Query (e.g. `project: IDEA created: {This month},{Last month} #unresolved tag: -{reply needed} Triaged: No AND ((by: -jetbrains-team) OR (by: jetbrains-team AND (#Unassigned OR Subsystem: {Am uncertain I})))`)
    * Name of the tile (e.g. `Missed`)
    * Refresh interval (60 sec by default)
4. Wait until the number of tickets is displayed on the Stream Deck button.

Click on the button to open the search query in the browser.

## About 

Forked from [streamdeck plugin Template](https://github.com/elgatosf/streamdeck-plugintemplate)
