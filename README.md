# Discord Soundboard

This application is designed to play sound clips to voice channels in Discord. It came out of a desire to have sound effects play for everyone listening.
It has two interfaces, chatops (ask the bot to play sounds), and a basic express webserver that allows you to click the sound effects to play them. (I make no guarantees as to the security or reliability of either).

## Prerequisites

You must create a Discord bot. There is a guide for this [here](https://discordjs.guide/#/preparations/setting-up-a-bot-application).

Once you have a bot you will need to (optionally) set up a callback url in the oauth page of: `<your_url>/api/discord/callback` for the web ui to work.

With that in place you'll want to record your Client Secret and Bot Token

You will then need to invite the bot to your server (use the 'bot' page to create a url)

## Running the app

```
docker build -t discord-soundboard .
docker run -e TOKEN=<Bot Token> -e CLIENT_SECRET=<Client secret> -p 3000:3000 discord-soundboard

```

## Using the app

You can type `!soundboard help` for some basic guidance at any time.

Administrative tasks are secured by command. Type: `!soundboard permit <username> <command>` to grant permissions. `!soundboard revoke <username> <command>` will do the opposite. Note that the global admin user is immune to changes, and always has all permissions.

Adding new clips will require you to do a media upload with the note `!soundboard add <shortcut>`
If you want to have a random selection, append a number to the end of the same shortcut, i.e. `wow1` `wow2` `wow3`. That will then let you use `!random wow` to have a random clip of those play.

You can use `!soundboard remove <shortcut>` to purge files as well.


## Warnings

This application is HUGELY open for abuse. Whether from users with admin permissions adding or removing sounds, or from guests spamming. It's intended for mature audiences that know not to drive everyone else insane. (But you do have `!soundboard silence` as a last resort).

It's also in an incredibly beta state, so things are subject to change, and the code is a mess that grew from 10 lines of a Discord bot test.
