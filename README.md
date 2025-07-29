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

## Enabling speech recognition (Presently fully disabled)

To enable speech recognition (and hotphrases) You will need to:

1. Set the `LISTEN_ENABLED=true` environment variable
2. Download a model (I.E. [this one](https://github.com/mozilla/DeepSpeech/releases/download/v0.8.1/deepspeech-0.8.1-models.pbmm)) to `/node/stt`
3. Have the bot listen (I.E. `/admin listen`)

I don't package the model with the Docker container, it's better to do with a permanent disk in kubernetes or something similar, as the model is pretty big.

## Using the app

The bot registers several slash commands on discord servers in which it is operational.
After changes to those command specifications (new subcommands etc...) or at bootstrap (initial setup) you will need to run:
`/update_commands` (prefixed if appropriate). This re-reads the commands and re-configures them on Discord's end.


## Warnings

This application is HUGELY open for abuse. Whether from users with admin permissions adding or removing sounds, or from guests spamming. It's intended for mature audiences that know not to drive everyone else insane. (But you do have `/admin silence` as a last resort).

It's also in an incredibly beta state, so things are subject to change, and the code is a mess that grew from 10 lines of a Discord bot test.

I need to add in the timeout stuff to prevent spamming
