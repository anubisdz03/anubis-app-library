import 'dart:convert';
import 'dart:io';
import 'package:cryptography/cryptography.dart';

const aad = 'ANUBIS-UPDATE-ED25519-KEY-V1';
const expectedPublicKey = 'Esa8TopnX2SwYS+65+YnCUmsvDWSztR3J/n80gMUcqY=';
const expectedFingerprint = '2424d6b5383ff52e2ee602123f8c555162ac6df7336a9bb9f52adaf75a92786a';
const maxManifestBytes = 64 * 1024;
const maxApkBytes = 250 * 1024 * 1024;

Map<String, dynamic> asMap(Object? value, String label) {
  if (value is! Map) throw FormatException('Invalid ' + label + ' object.');
  return Map<String, dynamic>.from(value);
}
String req(Map<String, dynamic> map, String key) {
  final value = map[key];
  if (value is! String || value.trim().isEmpty) throw FormatException('Invalid ' + key + '.');
  return value;
}
int reqInt(Map<String, dynamic> map, String key) {
  final value = map[key];
  if (value is! int) throw FormatException('Invalid ' + key + '.');
  return value;
}
List<int> b64(Map<String, dynamic> map, String key) => base64Decode(req(map, key));
String hex(List<int> bytes) => bytes.map((b) => b.toRadixString(16).padLeft(2, '0')).join();

void validateManifest(Map<String, dynamic> m) {
  if (!RegExp(r'^\d+(?:\.\d+){1,3}$').hasMatch(req(m, 'version').trim())) {
    throw const FormatException('Invalid version format.');
  }
  if (reqInt(m, 'build') < 0) throw const FormatException('Negative build number.');
  final u = Uri.tryParse(req(m, 'apk'));
  if (u == null || u.scheme != 'https' || u.host != 'github.com' || u.port != 443 ||
      u.userInfo.isNotEmpty || u.hasQuery || u.hasFragment || u.pathSegments.length != 6 ||
      u.pathSegments[0] != 'anubisdz03' || u.pathSegments[1] != 'anubis-app-library' ||
      u.pathSegments[2] != 'releases' || u.pathSegments[3] != 'download' ||
      u.pathSegments[4].isEmpty ||
      !RegExp(r'^[A-Za-z0-9][A-Za-z0-9._-]{0,119}\.apk$', caseSensitive: false).hasMatch(u.pathSegments[5])) {
    throw const FormatException('APK URL is not an official release URL.');
  }
  if (!RegExp(r'^[0-9a-fA-F]{64}$').hasMatch(req(m, 'sha256'))) {
    throw const FormatException('Invalid manifest SHA-256.');
  }
  if (m['force'] != null && m['force'] is! bool) throw const FormatException('Invalid force field.');
  for (final k in ['title', 'message']) {
    if (m[k] != null && m[k] is! String) throw FormatException('Invalid ' + k + ' field.');
  }
  final c = m['changelog'];
  if (c != null && (c is! List || c.length > 50 || c.any((x) => x is! String))) {
    throw const FormatException('Invalid changelog field.');
  }
}

Future<String> hashFile(File file) async {
  final sink = Sha256().newHashSink();
  await for (final chunk in file.openRead()) { sink.add(chunk); }
  sink.close();
  return hex((await sink.hash()).bytes);
}

Future<void> verifyReleaseApk(Map<String, dynamic> m) async {
  final uri = Uri.parse(req(m, 'apk'));
  final file = File('release.apk');
  final client = HttpClient();
  try {
    final request = await client.getUrl(uri);
    final response = await request.close();
    if (response.statusCode != HttpStatus.ok) {
      throw StateError('Release APK download returned HTTP ' + response.statusCode.toString() + '.');
    }
    final sink = file.openWrite();
    var size = 0;
    final header = <int>[];
    await for (final chunk in response) {
      size += chunk.length;
      if (size > maxApkBytes) {
        await sink.close();
        throw const FormatException('Release APK exceeds 250 MiB.');
      }
      if (header.length < 4) header.addAll(chunk.take(4 - header.length));
      sink.add(chunk);
    }
    await sink.close();
    if (size < 4 || header[0] != 0x50 || header[1] != 0x4b ||
        header[2] != 0x03 || header[3] != 0x04) {
      throw const FormatException('Downloaded release is not an APK/ZIP file.');
    }
    if (await hashFile(file) != req(m, 'sha256').toLowerCase()) {
      throw StateError('Downloaded APK SHA-256 does not match version.json.');
    }
  } finally { client.close(force: true); }
}

Future<void> main() async {
  SecretKey? encryptionKey;
  SimpleKeyPair? keyPair;
  SensitiveBytes? seed;
  try {
    final encryptedText = Platform.environment['ANUBIS_UPDATE_PRIVATE_ENC'];
    final passphrase = Platform.environment['ANUBIS_UPDATE_SIGNING_PASSPHRASE'];
    if (encryptedText == null || encryptedText.trim().isEmpty ||
        passphrase == null || passphrase.length < 24) {
      throw StateError('Required update-signing secrets are missing or invalid.');
    }

    final manifestBytes = await File('version.json').readAsBytes();
    if (manifestBytes.isEmpty || manifestBytes.length > maxManifestBytes) {
      throw const FormatException('version.json is empty or exceeds 64 KiB.');
    }
    final manifest = asMap(jsonDecode(utf8.decode(manifestBytes)), 'version.json');
    validateManifest(manifest);
    stdout.writeln('Manifest structure and official release URL: PASS');
    await verifyReleaseApk(manifest);
    stdout.writeln('Release APK and SHA-256: PASS');

    final doc = asMap(jsonDecode(encryptedText), 'encrypted private key');
    final kdf = asMap(doc['kdf'], 'KDF');
    final enc = asMap(doc['encryption'], 'encryption');
    if (req(doc, 'format') != aad || reqInt(doc, 'version') != 1 ||
        req(doc, 'algorithm') != 'Ed25519' || req(kdf, 'name') != 'Argon2id' ||
        reqInt(kdf, 'memory_kib') != 65536 || reqInt(kdf, 'iterations') != 3 ||
        reqInt(kdf, 'parallelism') != 2 || reqInt(kdf, 'hash_length') != 32 ||
        req(enc, 'name') != 'AES-256-GCM' || req(enc, 'aad') != aad) {
      throw const FormatException('Unsupported encrypted update-key parameters.');
    }

    final pub = base64Decode(expectedPublicKey);
    if (base64Encode(b64(doc, 'public_key')) != expectedPublicKey ||
        req(doc, 'public_key_sha256') != expectedFingerprint ||
        hex((await Sha256().hash(pub)).bytes) != expectedFingerprint) {
      throw StateError('Pinned update public-key fingerprint mismatch.');
    }

    encryptionKey = await Argon2id(memory: 65536, iterations: 3, parallelism: 2, hashLength: 32)
        .deriveKeyFromPassword(password: passphrase, nonce: b64(kdf, 'salt'));
    seed = SensitiveBytes(
      await AesGcm.with256bits().decrypt(
        SecretBox(b64(enc, 'ciphertext'), nonce: b64(enc, 'nonce'), mac: Mac(b64(enc, 'tag'))),
        secretKey: encryptionKey,
        aad: utf8.encode(aad),
      ),
      overwriteWhenDestroyed: true,
    );
    if (seed.length != 32) throw StateError('Invalid decrypted Ed25519 seed.');

    final algorithm = Ed25519();
    keyPair = await algorithm.newKeyPairFromSeed(seed);
    final publicKey = await keyPair.extractPublicKey();
    if (base64Encode(publicKey.bytes) != expectedPublicKey) {
      throw StateError('Decrypted key does not match the app-pinned public key.');
    }
    stdout.writeln('Encrypted update key and pinned public key: PASS');

    final signature = await algorithm.sign(manifestBytes, keyPair: keyPair);
    if (!await algorithm.verify(manifestBytes,
        signature: Signature(signature.bytes, publicKey: publicKey))) {
      throw StateError('Signature self-verification failed.');
    }

    final signatureDoc = <String, Object>{
      'algorithm': 'Ed25519',
      'signature': base64Encode(signature.bytes),
      'manifest_sha256': hex((await Sha256().hash(manifestBytes)).bytes),
    };
    final temp = File('version.json.sig.part');
    await temp.writeAsString(const JsonEncoder.withIndent('  ').convert(signatureDoc) + '\n', flush: true);
    await temp.rename('version.json.sig');
    stdout.writeln('version.json.sig created and self-verified.');
    stdout.writeln('UPDATE SIGNING PASSED.');
  } catch (e) {
    stderr.writeln('UPDATE SIGNING FAILED (' + e.runtimeType.toString() + ').');
    if (e is FormatException || e is StateError) stderr.writeln(e.toString());
    exitCode = 1;
  } finally {
    seed?.destroy();
    keyPair?.destroy();
    encryptionKey?.destroy();
  }
}
