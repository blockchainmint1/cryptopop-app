# CryptoPOP App

So I need to build an app for CryptoPOP - a Proof of Participation project here in Sinagpore. Attached is the brand kit. And here are some brand assets:

https://drive.google.com/drive/folders/1GeKO3GzDBsVdjyQsLe7WAcjjWa95ib5a

So it goes like this:

* this is going to be a TXC wallet, but most of the wallet functions are going to be hidden.

* really, the core function of this app is going to be a QR code scanner. And it's explained like this:

We have an event. A participant comes to the event, enjoys the class, meets and mingles, and then scans a QR code that we provide. 

The QR code has to be dynamic. I'm not sure how/where/what goes into this yet (maybe you can help), but basically the APP decodes the QR and something happens.

What happens you wonder?

Well basically they get POP token. How many? Can they send their friend a pic of the QR even if they didn't show up and participate? 

So suppose they scan a QR - it geo-confirms their location in the app. Asks them a few questions about the event, maybe a quiz. Did they bring any friends? scan ___ and get an extra ___ POP for each friend. 

Once the app figures out what they're supposed to get, it mints up POP token and sends it to their wallet which they can see how many they've acquired.

they can see POP leaderboard, maybe add an image of themselves, it'll eventually be a social experience.

and it'll eventually be a full blown wallet (send, receive).

But for now, we need the scan QR code, fill in some fields, answer some questions, and then the server side will mint tokens and send to their wallet. 

CAN YOU DO IT?!

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://cryptopop-app.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/b8b9779f-344d-4518-a3e5-793851a03a68).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
