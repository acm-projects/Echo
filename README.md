<p align="center">
  <img src="./jackblack-opening-book.gif" alt="Jack Black opening book" width="600"/>
</p>

<h1 align="center">ECHO</h1>

<div align="center">
Echo is a mobile app that creates fully produced, character-voiced audiobooks from any book file, ready to listen to anywhere.  
Upload a PDF or EPUB and Echo processes every line of text, identifies every character, builds a voice for them, and narrates the story with the weight and emotion it deserves.  
Don't like a voice Echo picked? Customize it to your liking, or clone a voice sample you're particularly fond of. Make your stories come to life with Echo.
</div>

---

## MVP

- Text extraction from PDF/EPUB/TXT/MD files
- LLM-generated narration script (JSON output with speaker, text, language, emotional tone)
- AI TTS audio output via Qwen3-TTS
- AWS S3 for audio storage, Supabase for database/auth
- Mobile app with Library, Upload, Media Player, Character Customization, and Profile screens
- Character voice customization (describe a voice or upload a clip to clone one)
- Offline playback position sync (remembers where you left off, synced across devices)
- Sleep timer

## Stretch Goals

- Voice activation with wake word + command
- Text tracking/highlighting in the book as each line is narrated
- Spoiler-free book/chapter/character summaries
- Generated pixel art character portraits (or user-uploaded pictures)
- Character Chat — talk to the characters and have them respond to you
- Audiobook sharing hub and community features (browse shared audiobooks, comments/reviews, favorites)
- Audiobook MP3 export with chapter markers
- A way to acknowledge pictures/illustrations, footnotes

---

## Timeline

| **Week** | **Frontend**                                                                                                                                                                    | **Backend**                                                                                                                                                                                                                                    |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1        | Assign roles<br>Install Node, Expo CLI, Python<br>Learn Git<br>Come up with a basic layout and plan for the mobile app<br>Come up with a design theme and create pages in Figma | Download the Qwen3-TTS model and have everyone play with it for a bit<br>Download a local LLM model and test it out with text processing<br>Set up Supabase and S3 storage containers<br>Decide on a schema for how we will store all our data |
| 2        | Set up Expo and start building the frontend<br>Create barebones pages with just navigation                                                                                      | Create a basic version of the FastAPI laptop server: text → LLM processing → TTS → audio                                                                                                                                                       |
| 3        | Create media player screen with playback capabilities: play/pause, seek bar, rewind/skip, previous/next chapter, playback speed                                                 | Connect the laptop server to S3 and Supabase<br>Create a way to identify all characters in a story and create a profile for each                                                                                                               |
| 4        | Create Characters screen with components for creating/editing a voice and creating/editing a character sprite                                                                   | Get the laptop server working at the scale of an entire book — lots of testing                                                                                                                                                                 |
| 5        | Create home library screen, profile screen, and upload book screen                                                                                                              | Create playback position syncing feature (so you don't lose your place when listening offline)                                                                                                                                                 |
| 6        | Integration! Frontend features call actual data from S3 and Supabase instead of mock data                                                                                       | Create voice editing pipeline: changing a character's voice re-synthesizes all of that character's lines and re-stitches the audiobook                                                                                                         |
| 7        | Voice activation on the media player using wake word + command                                                                                                                  | Integrate laptop server with mobile app so processing is called from the app; gate these features so they're only available while connected to the laptop server                                                                               |
| 8        | Final polishing + stretch goals                                                                                                                                                 | Final polishing + stretch goals<br>Run the full pipeline on a few books and test the results                                                                                                                                                   |
| 9        | Presentation prep! ✨                                                                                                                                                           | Presentation prep! ✨                                                                                                                                                                                                                          |

---

## Tech Stack

- **Mobile App:** React Native with Expo
  - [Tutorial: Using React Native and Expo](https://docs.expo.dev/tutorial/introduction/)
  - [React Native Full Course 2026 | Build a Mobile App Using Expo](https://www.youtube.com/watch?v=RdJhqaOIWn0)
  - [React Native Full 8 Hours Course (Expo, Expo Router, Supabase)](https://www.youtube.com/watch?v=rIYzLhkG9TA)
- **Laptop Server:** FastAPI + Python
  - [FastAPI Course for Beginners](https://www.youtube.com/watch?v=tLKKmouUams)
  - [WebSockets - FastAPI](https://fastapi.tiangolo.com/advanced/websockets/)
- **LLM:** Up to yall
- **Voice Generation:** Also up to yall
- **Voice Activation:** Picovoice
  - [How to Add Wake Word Detection to React Native Apps](https://picovoice.ai/blog/wake-word-detection-in-react-native/)
  - [Porcupine Wake Word React Native Quick Start](https://picovoice.ai/docs/quick-start/porcupine-react-native/)
  - [React Native Speech Recognition Tutorial - DEV Community](https://dev.to/picovoice/react-native-speech-recognition-tutorial-3bih)
- **Database:** Supabase (everything except audio, books, and images)
  - [Learn Supabase (Firebase Alternative) – Full Tutorial for Beginners](https://www.youtube.com/watch?v=dU7GwCOgvNY)
  - [Supabase for Beginners | Complete Guide to Getting Started](https://www.youtube.com/watch?v=yKSK4wrvvqk)
- **Storage:** AWS S3 (audio, books, images)
  - [Getting started with Amazon S3 - Amazon Simple Storage Service](https://docs.aws.amazon.com/AmazonS3/latest/userguide/GetStartedWithS3.html)
  - [#3 - AWS S3 Full Tutorial for Beginners | Step-by-Step Guide (2025)](https://www.youtube.com/watch?v=LTik9Gqrj-M)
  - [Amazon S3 examples - Boto3 1.43.53 documentation](https://docs.aws.amazon.com/boto3/latest/guide/s3-examples.html)
  - [Presigned URLs - Boto3 1.43.54 documentation](https://docs.aws.amazon.com/boto3/latest/guide/s3-presigned-urls.html)

---

## Software to Install

- Node.js + npm + Expo CLI
- React Native + NativeWind (Tailwind for React Native)
- Python and pip
- Git + GitHub
- Ollama
- VS Code (or your preferred IDE)
- Supabase account + CLI
- AWS

## Local Voice Pipeline Setup

The current voice sample pipeline uses the Expo app, a Node server, Gemini 3.8 Flash TTS for voice design, and IndexTTS 2.5 for local CPU narration.

### Prerequisites

- Node.js 22.13 or newer
- Python 3.10 or 3.11 (IndexTTS does not support Python 3.12+)
- Git
- `uv` Python environment manager
- `ffmpeg` for later audio stitching
- A Google AI Studio API key with Gemini TTS access

Install `uv` and `ffmpeg` on macOS:

```bash
brew install uv ffmpeg
```

On Windows, install `uv` and `ffmpeg` using their official installers, then reopen the terminal.

### Configure Environment

Create a local `.env` file at the repository root. It is ignored by Git:

```env
GOOGLE_API_KEY=your_google_api_key
EXPO_PUBLIC_SUPABASE_URL=your_supabase_url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_key
```

Do not prefix the Google key with whitespace and never commit `.env`.

### Install the Expo App

```bash
npm install
npx expo install expo-audio expo-document-picker expo-file-system
```

### Install IndexTTS and Download Weights

The IndexTTS source is kept in `workers/indextts`. Its Python environment, checkpoints, generated outputs, and downloaded example audio are ignored by Git.

```bash
cd workers/indextts
uv sync --extra webui
uv tool install huggingface-hub
uv run hf download IndexTeam/IndexTTS-2.5 --local-dir checkpoints
uv run python -c "from indextts.utils.examples_downloader import ensure_examples_available; ensure_examples_available()"
cd ../..
```

The download requires roughly 6 GB of model storage, and the complete local checkpoint directory may be larger after auxiliary models are downloaded. IndexTTS loads once and runs one job at a time on CPU. On Apple Silicon, MPS may be detected automatically; CUDA is used when available on Windows/Linux.

Verify the installation:

```bash
workers/indextts/.venv/bin/python --version
workers/indextts/.venv/bin/python -c "import sys; sys.path.insert(0, 'workers/indextts'); from indextts.infer_v2_5 import IndexTTS2; print('IndexTTS ready')"
test -f workers/indextts/checkpoints/config.yaml && echo "checkpoints present"
```

### Install the Voice Server

```bash
npm --prefix server install
```

The server owns `GOOGLE_API_KEY`, creates Gemini voices, starts the persistent IndexTTS worker, stitches ordered segments with ffmpeg, and serves the generated audio back to the app. The API key is never placed in an Expo-public variable.

### Start the App and Server

Use two terminals from the repository root:

Terminal 1, start the local voice server:

```bash
npm --prefix server start
```

Verify it:

```bash
curl http://127.0.0.1:8787/health
```

Terminal 2, start Expo:

```bash
npm start
```

The hidden sample page is available only by manually entering `/Test/voice-lab`. It is intentionally not linked from the tab bar.

For a physical phone, set the app's server URL to a reachable computer address in `.env`:

```env
EXPO_PUBLIC_VOICE_SERVER_URL=http://YOUR_COMPUTER_LAN_IP:8787
```

The current server binds to `127.0.0.1`, which is suitable for the simulator or web on the same computer. A physical-device setup needs the server host binding and firewall configured for LAN access.

### Stop and Restart

Stop either process with `Ctrl+C`. If port `8787` is already occupied:

```bash
lsof -nP -iTCP:8787 -sTCP:LISTEN
kill <PID>
npm --prefix server start
```

### Git Safety Check

Before pushing, confirm secrets, weights, virtual environments, generated bundles, and temporary audio are ignored:

```bash
git status --short
git check-ignore -v .env workers/indextts/checkpoints/config.yaml workers/indextts/.venv server/node_modules server/tmp dist .expo
```

The IndexTTS source license is Bilibili's model license. Review it before making the repository public.

## GitHub Cheat Sheet

| Command | Description |
| ------ | ------ |
| **cd <director>** | Change directories over to our repository |
| **git status** | See what's changed, staged, or untracked in your working directory |
| **git branch** | Lists branches for you |
| **git branch "branch name"** | Makes new branch |
| **git checkout "branch name"** | Switch to branch |
| **git checkout -b "branch name"** | Same as 2 previous commands together |
| **git branch -d "branch name"** | Delete a local branch (safe — only works if merged) |
| **git branch -D "branch name"** | Force-delete a local branch (even if unmerged) |
| **git add .**| Finds all changed files and adds them to git tracking|
| **git commit -m "Testing123"** | Commit with message |
| **git push origin "branch"** | Push to branch |
| **git pull origin "branch"** | Pull updates from a specific branch |
| **git fetch origin** | Download changes from remote without merging them into your local branch |
| **git merge "branch name"** | Merge specified branch into your current branch |
| **git merge --abort** | Cancel a merge if you hit conflicts and want to back out |
| **git commit hash** (find on GitHub or run `git log --oneline` in the terminal), then run **`git revert <commit-hash> --no-edit`** | Undo a commit that has been pushed |
| **git reset --soft HEAD~** | Undo commit (not pushed) but *keep* the changes |
| **git rm --cached "filename"** | Remove a file from git tracking but keep it locally |
| **git rm -r --cached "foldername"** | Remove a folder from git tracking but keep it locally |

## The Team

- Project Manager: Allen Zheng
- Industry Mentor: Srinivas Bojja
- Team member: Nitish Raj
- Team Member: Nicole
- Team Member: Juwairiya
- Team Member: Zed Bradley
