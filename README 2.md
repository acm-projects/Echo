# Welcome to your Expo app 👋

## Running the demo

Start Expo in production mode (faster screens than dev mode):

```bash
npx expo start --no-dev --minify -c
```

If the internet is unreliable, add `--offline`:

```bash
npx expo start --no-dev --minify -c --offline
```

`--offline` only stops the Expo CLI from contacting Expo's servers (api.expo.dev). Without it, a network drop shows up as
`UnexpectedServerError: getaddrinfo ENOTFOUND api.expo.dev`, and Expo Go reports an HTTP 500. Metro still runs on the Mac,
so Expo Go opens the app the same way (scan the QR code, or enter `exp://<mac-ip>:8081`). The phone must be on the same
network as the Mac.

Things to keep in mind:

- **The voice server is a separate process.** Start it in its own terminal; `--offline` doesn't affect it. Set
  `VOICE_SERVER_HOST=0.0.0.0` in `.env`; with `127.0.0.1` the phone gets "fetch failed". Restart it after pulling new
  server code.
- **The app still needs internet.** Sign-in and the shelf go through Supabase, and audio comes from S3.
- **If the Mac's IP changes** (for example, switching from the hotspot to school Wi-Fi), rescan the new QR code. If
  `.env` sets `EXPO_PUBLIC_VOICE_SERVER_URL`, update it to the new IP. Find the Mac's IP with `ipconfig getifaddr en0`.

### Hidden demo switches (Profile → Help & support)

Nothing on screen changes when you flip either switch. Each is saved on this device only, per account.

| Switch | How | What it does |
| --- | --- | --- |
| **Night Ferry** | Five quick taps (within 2 s) on the line *"Questions from fellow night listeners."* | Hides or shows The Night Ferry on your shelf. Flipping it also sets the demo narrator to match: hiding the book hides the narrator, showing it shows the narrator. |
| **Demo narrator** | Five quick taps in the empty space under the questions | Hides or shows only the "Narrator" voice (British, male, confident). It never shows or hides the book. |

On the presenter account (dal363209@utdallas.edu), both start out hidden. To check where they are, open Voice Studio and your
shelf. To re-sync them, show The Night Ferry and hide it again; both are then hidden.

### Narrator failsafe

While the demo narrator is hidden, tapping **Create** in Voice Studio (Describe a voice or Upload a recording) starts a
timer. If the new voice isn't ready in time, the studio stops waiting, clears the form, and the "Narrator" voice appears in
the list as if it had just been made. When the slow voice finishes in the background, it's deleted automatically (even if
you've left Voice Studio), so it never shows up. It still counts toward the day's voice limit.

Once the narrator is shown, the timer is off and creating voices works as normal. It stays shown until you re-hide it with
either switch above.

**Changing the time:** edit `NARRATOR_FAILSAFE_SECONDS` in [src/data/demoSettings.ts](src/data/demoSettings.ts)
(currently `32`). Save the file and reload the app.

> Before presenting: make sure the "Narrator" voice isn't your selected narrator, so the voice list looks untouched until
> the failsafe fires. While it's hidden, the app treats your account as having no narrator selected.

### Will it work on school Wi-Fi?

It depends on the network. Campus Wi-Fi often blocks devices from talking to each other, and the phone has to reach the Mac
for both Expo and the voice server. Websites like Supabase and S3 work either way.

To check (about 30 seconds):

1. Put the Mac and phone on the same Wi-Fi, then start Expo and the voice server.
2. In Safari on the phone, open `http://<mac-ip>:8081`. If a page of text loads, the phone can reach Expo.
3. Open `http://<mac-ip>:8787` (the voice server). Any response, even an error, means it got through.

If both load, the network works. If they spin and time out, the network is blocking it.

**For the presentation:** use the phone's hotspot with the Mac connected to it (addresses look like `172.20.10.x`). It
doesn't depend on the venue's network, and the demo uses little data. Do at least one dry run on the hotspot.

If the hotspot isn't an option, `npx expo start --tunnel` gets Expo through a network that blocks devices from talking to
each other. It needs internet, can't be combined with `--offline`, and doesn't cover the voice server, so the hotspot is
simpler.



This is an [Expo](https://expo.dev) project created with [`create-expo-app`](https://www.npmjs.com/package/create-expo-app).

## Get started

1. Install dependencies

   ```bash
   npm install
   ```

2. Start the app

   ```bash
   npx expo start
   ```

In the output, you'll find options to open the app in a

- [development build](https://docs.expo.dev/develop/development-builds/introduction/)
- [Android emulator](https://docs.expo.dev/workflow/android-studio-emulator/)
- [iOS simulator](https://docs.expo.dev/workflow/ios-simulator/)
- [Expo Go](https://expo.dev/go), a limited sandbox for trying out app development with Expo

You can start developing by editing the files inside the **app** directory. This project uses [file-based routing](https://docs.expo.dev/router/introduction).

## Get a fresh project

When you're ready, run:

```bash
npm run reset-project
```

This command will move the starter code to the **app-example** directory and create a blank **app** directory where you can start developing.

### Other setup steps

- To set up ESLint for linting, run `npx expo lint`, or follow our guide on ["Using ESLint and Prettier"](https://docs.expo.dev/guides/using-eslint/)
- If you'd like to set up unit testing, follow our guide on ["Unit Testing with Jest"](https://docs.expo.dev/develop/unit-testing/)
- Learn more about the TypeScript setup in this template in our guide on ["Using TypeScript"](https://docs.expo.dev/guides/typescript/)

## Learn more

To learn more about developing your project with Expo, look at the following resources:

- [Expo documentation](https://docs.expo.dev/): Learn fundamentals, or go into advanced topics with our [guides](https://docs.expo.dev/guides).
- [Learn Expo tutorial](https://docs.expo.dev/tutorial/introduction/): Follow a step-by-step tutorial where you'll create a project that runs on Android, iOS, and the web.

## Join the community

Join our community of developers creating universal apps.

- [Expo on GitHub](https://github.com/expo/expo): View our open source platform and contribute.
- [Discord community](https://chat.expo.dev): Chat with Expo users and ask questions.
