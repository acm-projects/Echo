<p align="center">
  <img src="./jackblack-opening-book.gif" alt="Jack Black opening book" width="600"/>
</p>

<h1 align="center">🎧 ECHO 🎧</h1>

<div align="center">
Echo is a mobile app that creates fully produced, character-voiced audiobooks from any book file, ready to listen to anywhere.  
Upload a PDF or EPUB and Echo processes every line of text, identifies every character, builds a voice for them, and narrates the story with the weight and emotion it deserves.  
Don't like a voice Echo picked? Customize it to your liking, or clone a voice sample you're particularly fond of. Make your stories come to life with Echo.
</div>

---

## 🔄 General Flow

1. User uploads a book file (PDF/EPUB/TXT/MD) on the mobile app
2. The file is sent to a laptop server for processing
3. Plain text is extracted from the book file
4. The laptop server runs a local LLM over the entire book to identify characters and generate a narration script for every line of text
5. The laptop server runs Qwen3-TTS to create audio narration for each line
6. Audio is stitched into chapters/segments and uploaded to S3, while the narration script and other metadata are stored in Supabase
7. All necessary audio and database info is synced from S3/Supabase down to local storage on the mobile device
8. Play the audiobook 🎉

> Processing and creating the audio requires a connection to the laptop server (which itself needs internet access for cloud storage), but once an audiobook is finished, it can be listened to completely offline.

---

## 🏆 MVP

- Text extraction from PDF/EPUB/TXT/MD files
- LLM-generated narration script (JSON output with speaker, text, language, emotional tone)
- AI TTS audio output via Qwen3-TTS
- AWS S3 for audio storage, Supabase for database/auth
- Mobile app with Library, Upload, Media Player, Character Customization, and Profile screens
- Character voice customization (describe a voice or upload a clip to clone one)
- Offline playback position sync (remembers where you left off, synced across devices)

## ⌛ Stretch Goals

- Voice activation with wake word + command (likely Picovoice)
- Text tracking/highlighting in the book as each line is narrated (requires character-aligned timing in the narration script)
- Spoiler-free book/chapter/character summaries
- Generated pixel art character portraits (or user-uploaded pictures)
- Character Chat — talk to the characters and have them respond to you
- Audiobook sharing hub and community features (browse shared audiobooks, comments/reviews, favorites)
- Audiobook MP3 export with chapter markers
- A way to acknowledge pictures/illustrations in the audio

---

## 📅 Milestones

| **Week** | **Frontend**                                                                                                                    | **Backend**                                                                                                                                                      |
| -------- | ------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1        | Assign roles<br>Install Node, Expo CLI, Python<br>Learn Git<br>Come up with a basic layout and plan for the mobile app          | Download the Qwen3-TTS model and have everyone play with it for a bit<br>Download a local LLM model and test it out with text processing                         |
| 2        | Come up with a design theme and create pages in Figma                                                                           | Set up Supabase and S3 storage containers<br>Decide on a schema for how we will store all our data                                                               |
| 3        | Set up Expo and start building the frontend<br>Create barebones pages with just navigation                                      | Create a basic version of the FastAPI laptop server: text → LLM processing → TTS → audio                                                                         |
| 4        | Create media player screen with playback capabilities: play/pause, seek bar, rewind/skip, previous/next chapter, playback speed | Connect the laptop server to S3 and Supabase<br>Create a way to identify all characters in a story and create a profile for each                                 |
| 5        | Create Characters screen with components for creating/editing a voice and creating/editing a character sprite                   | Get the laptop server working at the scale of an entire book — lots of testing                                                                                   |
| 6        | Create home library screen, profile screen, and upload book screen                                                              | Create playback position syncing feature (so you don't lose your place when listening offline)                                                                   |
| 7        | Integration! Frontend features call actual data from S3 and Supabase instead of mock data                                       | Create voice editing pipeline: changing a character's voice re-synthesizes all of that character's lines and re-stitches the audiobook                           |
| 8        | Voice activation on the media player using wake word + command                                                                  | Integrate laptop server with mobile app so processing is called from the app; gate these features so they're only available while connected to the laptop server |
| 9        | Final polishing + stretch goals                                                                                                 | Final polishing + stretch goals<br>Run the full pipeline on a few books and test the results                                                                     |
| 10       | Presentation prep! ✨                                                                                                           | Presentation prep! ✨                                                                                                                                            |

---

## 👨‍💻 Tech Stack

- **Mobile App:** React Native with Expo
  - Tutorial: Using React Native and Expo
  - React Native Full Course 2026 | Build a Mobile App Using Expo
  - React Native Full 8 Hours Course (Expo, Expo Router, Supabase)
- **Laptop Server:** FastAPI + Python
  - FastAPI Course for Beginners
  - WebSockets - FastAPI
- **Local LLM:** Ollama
  - Ollama Tutorial for Beginners (2026): Run LLM Models Locally for Free
  - How to Run Local LLMs with Ollama: A Step-by-Step Guide
- **Voice Generation:** Qwen3-TTS
  - [Qwen3-TTS (Official repo)](https://github.com/QwenLM/Qwen3-TTS)
  - [Qwen3-TTS-Openai-Fastapi (FastAPI wrapper)](https://github.com/groxaxo/Qwen3-TTS-Openai-Fastapi)
  - Elevenlabs just got wrecked. This free AI text to speech is WILD!
- **Voice Activation:** Picovoice
  - How to Add Wake Word Detection to React Native Apps
  - Porcupine Wake Word React Native Quick Start
  - React Native Speech Recognition Tutorial - DEV Community
- **Database:** Supabase (everything except audio, books, and images)
  - Learn Supabase (Firebase Alternative) – Full Tutorial for Beginners
  - Supabase for Beginners | Complete Guide to Getting Started
- **Storage:** AWS S3 (audio, books, images)
  - Getting started with Amazon S3 - Amazon Simple Storage Service
  - #3 - AWS S3 Full Tutorial for Beginners | Step-by-Step Guide (2025)
  - Amazon S3 examples - Boto3 1.43.53 documentation
  - Presigned URLs - Boto3 1.43.54 documentation

---

## 🛠️ Software to Install

- Node.js + npm + Expo CLI
- React Native + NativeWind (Tailwind for React Native)
- Python and pip
- Git + GitHub
- Ollama
- VS Code (or your preferred IDE)
- Supabase account + CLI
- AWS
