# azurapi-js-setup
Setup for azurapi-js
## Function
* Updates `ships.json`, `ship-list.json`, `equipments.json` with fresh data

## Usage
### To update your own copy
* Fetch `https://raw.githubusercontent.com/AzurAPI/azurapi-js-setup/master/version-info.json`. `application/json`
* Check respective version numbers from `ships`/`equipments`.
  * Example: `ships['version-number']`
* If it is greater than the version number on your local copy. You need to update from either
  * `https://raw.githubusercontent.com/AzurAPI/azurapi-js-setup/master/ships.json`
  * `https://raw.githubusercontent.com/AzurAPI/azurapi-js-setup/master/equipments.json`
* Overwrite your local copy, and reload it into your program
### Cloning
* Clone this repository
* Update your local copy with
```javascript
const azurlane = require("./index.js");
azurlane.refreshShips(true);
azurlane.refreshImages(true);
azurlane.refreshEquipments(true);
azurlane.publish();
```
* Bewarned that this update program will use up a lot of bandwidth and processing power
* To rely on local cache, remove all the `true` parameters

![Graf Spee looking at you meaningfully](https://res.cloudinary.com/kumori/image/upload/v1576125260/Bg_graf_spee_1_dqumrm.png)

### Join our discord!
<a href="https://discord.gg/aAEdys8">
    <img src="https://discordapp.com/api/v6/guilds/648206344729526272/widget.png?style=banner2" alt="Discord server" />
</a> 
