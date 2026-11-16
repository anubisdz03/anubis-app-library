import 'dart:convert';
import 'dart:io';

import 'package:cryptography/cryptography.dart';

const aad = 'ANUBIS-CATALOG-ED25519-KEY-V1';
const format = 'ANUBIS-CATALOG-SIGNATURE-V1';
const expectedFingerprint =
    '34ada0f989c397c34ce2d005b3720719bd811763405b4a45dc995a24e2893a58';
const expectedPublicKey = 'DKzP5JeMUTbiKceRh1d0ZGkipj3pV3GF2M3ewexvjf8=';

Map<String, dynamic> asMap(String value, String label) {
  final decoded = jsonDecode(value);
  if (decoded is! Map) throw FormatException('Invalid $label');
  return Map<String, dynamic>.from(decoded);
}

String req(Map<String, dynamic> map, String key) {
  final value = map[key];
  if (value is! String || value.isEmpty) throw FormatException('Invalid $key');
  return value;
}

List<int> b64(Map<String, dynamic> map, String key) =>
    base64Decode(req(map, key));

String fingerprint(List<int> bytes) => (bytes
    .map((b) => b.toRadixString(16).padLeft(2, '0'))
    .join());

Future<void> main() async {
  SecretKey? encryptionKey;
  SimpleKeyPair? keyPair;
  SensitiveBytes? seed;
  try {
    final encryptedText = Platform.environment['ANUBIS_CATALOG_PRIVATE_ENC'];
    final passphrase = Platform.environment['ANUBIS_CATALOG_SIGNING_PASSPHRASE'];
    if (encryptedText == null || passphrase == null || passphrase.length < 24) {
      throw StateError('Required signing secrets are missing.');
    }

    final privateDoc = asMap(encryptedText, 'encrypted private key');
    final kdf = Map<String, dynamic>.from(privateDoc['kdf'] as Map);
    final encryption = Map<String, dynamic>.from(privateDoc['encryption'] as Map);
    if (req(privateDoc, 'format') != aad ||
        privateDoc['version'] != 1 ||
        req(privateDoc, 'algorithm') != 'Ed25519' ||
        req(kdf, 'name') != 'Argon2id' ||
        kdf['memory_kib'] != 65536 ||
        kdf['iterations'] != 3 ||
        kdf['parallelism'] != 2 ||
        kdf['hash_length'] != 32 ||
        req(encryption, 'name') != 'AES-256-GCM' ||
        req(encryption, 'aad') != aad) {
      throw FormatException('Unsupported key protection parameters.');
    }

    final publicKey = base64Decode(expectedPublicKey);
    final embeddedPublic = b64(privateDoc, 'public_key');
    if (base64Encode(embeddedPublic) != expectedPublicKey ||
        req(privateDoc, 'public_key_sha256') != expectedFingerprint ||
        fingerprint((await Sha256().hash(publicKey)).bytes) != expectedFingerprint) {
      throw StateError('Pinned public key fingerprint mismatch.');
    }

    encryptionKey = await Argon2id(
      memory: 65536, iterations: 3, parallelism: 2, hashLength: 32,
    ).deriveKeyFromPassword(
      password: passphrase,
      nonce: b64(kdf, 'salt'),
    );

    seed = SensitiveBytes(
      await AesGcm.with256bits().decrypt(
        SecretBox(
          b64(encryption, 'ciphertext'),
          nonce: b64(encryption, 'nonce'),
          mac: Mac(b64(encryption, 'tag')),
        ),
        secretKey: encryptionKey,
        aad: utf8.encode(aad),
      ),
      overwriteWhenDestroyed: true,
    );

    if (seed.length != 32) throw StateError('Invalid private seed.');
    final algorithm = Ed25519();
    keyPair = await algorithm.newKeyPairFromSeed(seed);
    final derivedPublic = await keyPair.extractPublicKey();
    if (base64Encode(derivedPublic.bytes) != expectedPublicKey) {
      throw StateError('Private/public key consistency failed.');
    }

    for (final name in ['apps.json', 'tutorial.json']) {
      final file = File('../../$name');
      if (!await file.exists()) throw FileSystemException('Missing $name');
      final bytes = await file.readAsBytes();
      final decoded = jsonDecode(utf8.decode(bytes));
      if (name == 'apps.json' && decoded is! List) {
        throw FormatException('Invalid apps.json structure.');
      }
      if (name == 'tutorial.json' && decoded is! Map) {
        throw FormatException('Invalid tutorial.json structure.');
      }
      final signature = await algorithm.sign(bytes, keyPair: keyPair);
      if (!await algorithm.verify(bytes, signature: signature)) {
        throw StateError('Signature self-verification failed for $name.');
      }
      final document = const JsonEncoder.withIndent('  ').convert({
        'format': format,
        'algorithm': 'Ed25519',
        'key_id': expectedFingerprint,
        'signature': base64Encode(signature.bytes),
      });
      await File('../../$name.sig').writeAsString('$document\n', flush: true);
      stdout.writeln('$name.sig generated and verified.');
    }
  } finally {
    seed?.destroy();
    keyPair?.destroy();
    encryptionKey?.destroy();
  }
}
