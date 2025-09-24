#!/usr/bin/env node

/**
 * Example usage of @sky7/libsignal
 * This demonstrates basic key generation, session setup, and message encryption/decryption
 */

const {
  keyhelper,
  ProtocolAddress,
  SessionBuilder,
  SessionCipher,
  SessionRecord
} = require('./index.js');

// Simple in-memory storage implementation for demo purposes
function createInMemoryStorage({ ourIdentity, ourRegistrationId, preKeys, signedPreKeys }) {
  const sessions = new Map();
  const preKeyMap = new Map();
  const signedPreKeyMap = new Map();
  
  // Store preKeys
  if (preKeys) {
    preKeys.forEach(preKey => {
      preKeyMap.set(preKey.keyId, preKey.keyPair);
    });
  }
  
  // Store signedPreKeys
  if (signedPreKeys) {
    signedPreKeys.forEach(signedPreKey => {
      signedPreKeyMap.set(signedPreKey.keyId, signedPreKey.keyPair);
    });
  }

  return {
    async loadSession(id) { 
      const session = sessions.get(id);
      return session || null; 
    },
    async storeSession(id, record) { 
      sessions.set(id, record); 
    },
    async isTrustedIdentity(identifier, identityKey) { 
      // In production, implement proper identity verification
      return true; 
    },
    async loadPreKey(id) { 
      return preKeyMap.get(id); 
    },
    async removePreKey(id) { 
      preKeyMap.delete(id); 
    },
    async loadSignedPreKey(id) { 
      return signedPreKeyMap.get(id); 
    },
    async getOurRegistrationId() { 
      return ourRegistrationId; 
    },
    async getOurIdentity() { 
      return ourIdentity; 
    },
  };
}

async function demo() {
  console.log('🔐 @sky7/libsignal Demo\n');

  // 1. Generate Alice's keys
  console.log('1️⃣ Generating Alice\'s keys...');
  const aliceIdentity = keyhelper.generateIdentityKeyPair();
  const aliceRegistrationId = keyhelper.generateRegistrationId();
  const aliceSignedPreKey = keyhelper.generateSignedPreKey(aliceIdentity, 1);
  const alicePreKey = keyhelper.generatePreKey(1001);
  
  console.log(`   ✅ Alice Registration ID: ${aliceRegistrationId}`);
  console.log(`   ✅ Alice Identity Key: ${aliceIdentity.pubKey.slice(0, 8).toString('hex')}...`);

  // 2. Generate Bob's keys
  console.log('\n2️⃣ Generating Bob\'s keys...');
  const bobIdentity = keyhelper.generateIdentityKeyPair();
  const bobRegistrationId = keyhelper.generateRegistrationId();
  const bobSignedPreKey = keyhelper.generateSignedPreKey(bobIdentity, 1);
  const bobPreKey = keyhelper.generatePreKey(2001);
  
  console.log(`   ✅ Bob Registration ID: ${bobRegistrationId}`);
  console.log(`   ✅ Bob Identity Key: ${bobIdentity.pubKey.slice(0, 8).toString('hex')}...`);

  // 3. Create storage for both parties
  const aliceStorage = createInMemoryStorage({
    ourIdentity: aliceIdentity,
    ourRegistrationId: aliceRegistrationId,
    preKeys: [alicePreKey],
    signedPreKeys: [aliceSignedPreKey]
  });

  const bobStorage = createInMemoryStorage({
    ourIdentity: bobIdentity,
    ourRegistrationId: bobRegistrationId,
    preKeys: [bobPreKey],
    signedPreKeys: [bobSignedPreKey]
  });

  // 4. Alice initiates session to Bob
  console.log('\n3️⃣ Alice initiating session with Bob...');
  const bobAddress = new ProtocolAddress('bob', 1);
  
  // Bob's prekey bundle (what Alice gets from server)
  const bobBundle = {
    registrationId: bobRegistrationId,
    identityKey: bobIdentity.pubKey,
    signedPreKey: {
      keyId: bobSignedPreKey.keyId,
      publicKey: bobSignedPreKey.keyPair.pubKey,
      signature: bobSignedPreKey.signature
    },
    preKey: {
      keyId: bobPreKey.keyId,
      publicKey: bobPreKey.keyPair.pubKey
    }
  };

  const aliceSessionBuilder = new SessionBuilder(aliceStorage, bobAddress);
  await aliceSessionBuilder.initOutgoing(bobBundle);
  console.log('   ✅ Alice established session with Bob');

  // 5. Alice encrypts a message to Bob
  console.log('\n4️⃣ Alice encrypting message...');
  const aliceCipher = new SessionCipher(aliceStorage, bobAddress);
  const message = Buffer.from('Hello Bob! 👋');
  const ciphertext = await aliceCipher.encrypt(message);
  
  console.log(`   ✅ Message encrypted! Type: ${ciphertext.type}, Size: ${ciphertext.body.length} bytes`);
  console.log(`   📨 Ciphertext preview: ${ciphertext.body.slice(0, 16).toString('hex')}...`);

  // 6. Bob receives and decrypts the message
  console.log('\n5️⃣ Bob decrypting message...');
  const aliceAddress = new ProtocolAddress('alice', 1);
  const bobCipher = new SessionCipher(bobStorage, aliceAddress);
  
  let decrypted;
  if (ciphertext.type === 3) {
    // PreKey message (first message in session)
    decrypted = await bobCipher.decryptPreKeyWhisperMessage(ciphertext.body);
  } else {
    // Regular message
    decrypted = await bobCipher.decryptWhisperMessage(ciphertext.body);
  }
  
  console.log(`   ✅ Message decrypted: "${decrypted.toString()}"`);

  // 7. Bob replies to Alice
  console.log('\n6️⃣ Bob replying to Alice...');
  const replyMessage = Buffer.from('Hello Alice! Nice to meet you! 😊');
  const replyCiphertext = await bobCipher.encrypt(replyMessage);
  
  console.log(`   ✅ Reply encrypted! Type: ${replyCiphertext.type}, Size: ${replyCiphertext.body.length} bytes`);

  // 8. Alice decrypts Bob's reply
  console.log('\n7️⃣ Alice decrypting Bob\'s reply...');
  let decryptedReply;
  if (replyCiphertext.type === 3) {
    decryptedReply = await aliceCipher.decryptPreKeyWhisperMessage(replyCiphertext.body);
  } else {
    decryptedReply = await aliceCipher.decryptWhisperMessage(replyCiphertext.body);
  }
  
  console.log(`   ✅ Reply decrypted: "${decryptedReply.toString()}"`);

  console.log('\n🎉 Demo completed successfully!');
  console.log('\nThis demonstrates:');
  console.log('  • Key generation for two parties');
  console.log('  • Session establishment using PreKey bundles');
  console.log('  • Message encryption and decryption');
  console.log('  • Bidirectional communication');
  console.log('  • Forward secrecy through the Double Ratchet');
}

// Run the demo
if (require.main === module) {
  demo().catch(error => {
    console.error('❌ Demo failed:', error);
    process.exit(1);
  });
}

module.exports = { demo, createInMemoryStorage };