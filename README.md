# osu!lazer automatic accuracy bracket generator
Automatic equally-spaced accuracy bracket generator for [osu!lazer](https://github.com/ppy/osu)

## What it does?
It generates collections in osu! so you don't have to hunt down beatmaps you have a bad accuracy in to retry.  
All of the collections it makes end in **"[safe to delete]"** and such collections get discarded every time this is run.  
(If you have previous collections with numeric or otherwise conflicting names it renames them to "LEGACY oldname")  

## What is it for?
I run this, then go to one of the collections it generated in osu!,
sort by difficulty and work my way up.  
You can run this again part-way through to clean the auto-generated collections up.  
Maps that you have recently played go to the "graceperiod [safe to delete]" collection instead.
(Configurable via `--graceperiod-days` and `--graceperiod-play-count`, set either of these to `0` to disable this)

## How to run
**You need to have [Node.js](https://nodejs.org/en/download) with `npm` installed and in PATH**  
<sup>Node's MacOS and Linux `brew install node || emerge nodejs || pacman -S nodejs npm` [instructions here](https://nodejs.org/en/download/package-manager)</sup>


Run `build.bat` (Windows) or `build.sh` (Linux, MacOS) to make npm download the dependencies.  

Now you can use `run.bat` (Windows) or `run.sh` (Linux, MacOS) to generate the brackets.  
(`run.sh` takes command line arguments, and you can edit them into `run.bat` on Windows.)

### notes
* **I'm very inexperienced in JS and I fully expect things to look quite dumb [in there](https://github.com/mossymountain/osu-lazer-accuracy-brackets/blob/main/index.js). Please tell me what I'm doing wrong!**
* I already wrote something like this in Python for osu!classic in 2017 but that codebase is so janky and bloated I don't feel like publishing it...
<sub>I might want to revisit that at some point for a clean version that does just this, but I don't currently *need* that version as I use osu!lazer.</sub>
* [osu! forum post about this project](https://osu.ppy.sh/community/forums/topics/1801261)
