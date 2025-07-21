# FREEGS

Tool to help claim free Epic Games Store (EGS) games. Supports semi-automatic (recommended) through a Discord bot, and working on adding a tool to automate the entire process and claim free EGS games with minimal interaction.

## Semi-Manual Setup

Semi-manual is made to *notify* you as soon as an EGS game is created; this is done through Discord. It is recommended that you enable push notifications for Discord, so this is more effective.

FREEGS crafts a **direct purchase link** when used on Discord, so you don't need to go through EGS to claim the game; using the direct link will bring you to the purchase page, where you then simply need to press "place order." All you need to do prior to using these direct purchase links is making sure that you're logged into the EGS website (https://store.epicgames.com/)

To speed up the process, I've created a [Tampermonkey Script](auto-buy/tampermonkey/auto-claimer.js) to automatically press the place order button when the purchase link is crafted by FREEGS. However, I haven't tested it all that much since it's really not that much work to press one button.


First, clone this GitHub repo (use `git clone`), then choose if you want to set up Semi-Manual (Discord Notifier Bot) or Fully Automatic.

To USE FREEGS Semi-Manual:

1. Go to [Discord Developers](https://discord.com/developers/applications)
2. Create a new application
3. Go to Installation and disable "User install," then add "applications.commands" and "bot" to scopes (under Guild Install)
4. Then, for permissions under Guild Install, add Administrator (this is so permissions isn't a hassle to set up, but not all permissions are necessary or will be used)
5. On that same page, press "Reset Token," and paste the token in discord/serverconf.json (rename `serverconf.json.example` to `serverconf.json`)
6. Go to General Information and copy the Application ID; this is the client ID, paste it in `serverconf.json`
7. `cd` into the repo and run `bun install` to install deps and `bun start` (you may have to install [Bun](https://bun.sh))
8. Visit the URL that the program gives you to add FREEGS to a server. You can change the profile picture of the bot in Discord Developers, if you want.

## Fully-Automatic

[This is a TO-DO but I plan to work on this]