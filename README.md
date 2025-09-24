@sky7/libsignal
===============

End-to-end encryption primitives implementing a Signal-style double ratchet with PreKeys for Node.js. This package exposes a minimal API for building, persisting, and using sessions to encrypt and decrypt messages. This Signal protocol implementation for Node.js based on [libsignal-protocol-javascript](https://github.com/WhisperSystems/libsignal-protocol-javascript).

[![npm](https://img.shields.io/npm/v/libsignal.svg)](https://www.npmjs.com/package/libsignal)
[![npm](https://img.shields.io/npm/l/libsignal.svg)](https://github.com/ForstaLabs/libsignal-node)

[![license](https://img.shields.io/badge/license-GPL--3.0-blue.svg)](https://www.gnu.org/licenses/gpl-3.0)


Overview
--------
`@sky7/libsignal` provides the core building blocks of a Signal-like protocol:

- Double Ratchet state management (`SessionRecord`, `SessionCipher`).
- Asynchronous session bootstrapping with PreKeys (`SessionBuilder`).
- Curve25519/X25519 key agreement and signatures (`curve`).
- HKDF key derivation and message MACs (`crypto`).
- Small, promise-based job serialiser to avoid concurrent state races (`queue_job`).

The library is implemented in JavaScript and ships TypeScript declarations.


Features
--------
- Forward secrecy via Double Ratchet chains.
- Asynchronous session setup using Signed PreKeys and (optional) one-time PreKeys.
- Compact wire format using protobuf (`WhisperMessage`, `PreKeyWhisperMessage`).
- Works with Node's `crypto` when available, with a fallback to `curve25519-js`.
- Ships `index.d.ts` for TypeScript consumers.


Installation
------------
Install with your preferred package manager:

```powershell
npm install @sky7/libsignal
# or
yarn add @sky7/libsignal
# or
pnpm add @sky7/libsignal
```

Recommended: Node.js 14+.


Quick Start
-----------
Below is a minimal example showing how to prepare keys, create a session to a remote device, and encrypt/decrypt.

```js
const {
   keyhelper,
   ProtocolAddress,
   SessionBuilder,
   SessionCipher
} = require('@sky7/libsignal');

// 1) Your long-term identity + registration id
const ourIdentity = keyhelper.generateIdentityKeyPair();
const ourRegistrationId = keyhelper.generateRegistrationId();

// 2) Your Signed PreKey and optional one-time PreKey to publish server-side
const signed = keyhelper.generateSignedPreKey(ourIdentity, /*signedKeyId*/ 1);
const preKey = keyhelper.generatePreKey(/*keyId*/ 1001);

// 3) Minimal storage implementation (see Storage Interface below)
const storage = createInMemoryStorage({ ourIdentity, ourRegistrationId, preKey, signed });

// 4) Remote addressing (user id + device id)
const addr = new ProtocolAddress('alice', 1);

// 5) Remote device bundle (typically fetched from your server)
const remoteBundle = {
   registrationId: 2222,
   identityKey: /* Buffer */ Buffer.from('...', 'base64'),
   signedPreKey: {
      keyId: 1,
      publicKey: Buffer.from('...', 'base64'),
      signature: Buffer.from('...', 'base64'),
   },
   // Optional one-time preKey
   preKey: {
      keyId: 10001,
      publicKey: Buffer.from('...', 'base64'),
   },
};

// 6) Establish an outgoing session
const builder = new SessionBuilder(storage, addr);
await builder.initOutgoing(remoteBundle);

// 7) Encrypt a message
const cipher = new SessionCipher(storage, addr);
const { type, body, registrationId } = await cipher.encrypt(Buffer.from('hello'));
// Send { type, body } to the remote. type: 3 => PreKey message (first), 1 => normal.

// 8) Decrypt a message
// If first message from remote used a PreKey bundle:
//   const plaintext = await cipher.decryptPreKeyWhisperMessage(remoteBodyBuffer)
// Otherwise:
//   const plaintext = await cipher.decryptWhisperMessage(remoteBodyBuffer)
```


Storage Interface
-----------------
You provide persistent storage for identity, PreKeys, and session state. The library calls the following async methods on your storage object:

- `loadSession(id: string): Promise<SessionRecord | undefined | null>`: Load a previously stored session record for a fully-qualified address (e.g., `"alice.1"`).
- `storeSession(id: string, record: SessionRecord): Promise<void>`: Persist a session record.
- `isTrustedIdentity(identifier: string, identityKey: Buffer): Promise<boolean>`: Return whether `identityKey` is currently trusted for `identifier`.
- `loadPreKey(id: number): Promise<{ privKey: Buffer; pubKey: Buffer } | undefined>`: Load one-time PreKey pair by id.
- `removePreKey(id: number): Promise<void>`: Remove a consumed PreKey.
- `loadSignedPreKey(id: number): Promise<{ privKey: Buffer; pubKey: Buffer } | undefined>`: Load signed PreKey pair by id.
- `getOurRegistrationId(): Promise<number>`: Return our local registration id.
- `getOurIdentity(): Promise<{ privKey: Buffer; pubKey: Buffer } | { privKey: Buffer; pubKey: Buffer }>`: Return our identity key pair.

Minimal in-memory example for demos/tests:

```js
function createInMemoryStorage({ ourIdentity, ourRegistrationId, preKey, signed }) {
   const sessions = new Map();
   const preKeys = new Map([[preKey.keyId, preKey.keyPair]]);
   const signedPreKeys = new Map([[signed.keyId, signed.keyPair]]);

   return {
      async loadSession(id) { return sessions.get(id) || null; },
      async storeSession(id, record) { sessions.set(id, record); },
      async isTrustedIdentity(/*id, identityKey*/) { return true; },
      async loadPreKey(id) { return preKeys.get(id); },
      async removePreKey(id) { preKeys.delete(id); },
      async loadSignedPreKey(id) { return signedPreKeys.get(id); },
      async getOurRegistrationId() { return ourRegistrationId; },
      async getOurIdentity() { return ourIdentity; },
   };
}
```


API Surface
-----------
- `keyhelper`
   - `generateIdentityKeyPair()` → `{ pubKey: Buffer, privKey: Buffer }`
   - `generateRegistrationId()` → `number`
   - `generateSignedPreKey(identityKeyPair, signedKeyId)` → `{ keyId, keyPair, signature }`
   - `generatePreKey(keyId)` → `{ keyId, keyPair }`

- `ProtocolAddress`
   - `new ProtocolAddress(id: string, deviceId: number)`
   - `toString()` → `"<id>.<deviceId>"`

- `SessionBuilder`
   - `constructor(storage, remoteAddress)`
   - `initOutgoing(deviceBundle)` → Initializes a session using a remote bundle

- `SessionCipher`
   - `constructor(storage, remoteAddress)`
   - `encrypt(plaintext: Buffer)` → `{ type: 1|3, body: Buffer, registrationId: number }`
   - `decryptWhisperMessage(body: Buffer)` → `Buffer`
   - `decryptPreKeyWhisperMessage(body: Buffer)` → `Buffer`

- `SessionRecord`
   - Serialization helpers for persisting session state

- `errors`
   - `UntrustedIdentityKeyError`, `SessionError`, `MessageCounterError`, `PreKeyError`


Protobufs
---------
The wire messages are defined in `protos/WhisperTextProtocol.proto` and compiled to `src/WhisperTextProtocol.js` via `protobufjs`.

- Regenerate (requires `protobufjs-cli`):

```powershell
npx pbjs -t static-module -w commonjs -o ./src/WhisperTextProtocol.js ./protos/WhisperTextProtocol.proto
```

Alternatively, run the helper script in a Unix-like shell:

```bash
./generate-proto.sh
```


TypeScript
----------
Type definitions are provided via `index.d.ts`. Import using standard CJS/ESM interop and let your tooling infer types.


Security Notes
--------------
- Always verify and pin remote identity keys via your `isTrustedIdentity` policy.
- Persist session state atomically to avoid message key reuse after crashes.
- One-time PreKeys must be deleted after consumption (`removePreKey`).


License
-------
GPL-3.0-only. See https://www.gnu.org/licenses/gpl-3.0

* Copyright 2015-2016 Open Whisper Systems
* Copyright 2017-2018 Forsta Inc


