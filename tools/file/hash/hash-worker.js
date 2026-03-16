import {
  createMD5,
  createSHA1,
  createSHA256,
  createSHA384,
  createSHA512,
  createCRC32,
  createBLAKE2b,
  createXXHash64
} from "/assets/vendor/hash-wasm/index.esm.min.js";

let hashers = [];
let totalBytes = 0;

self.onmessage = async (event) => {
  const msg = event.data;

  try {
    if (msg.type === "start") {
      totalBytes = Number(msg.total || 0);
      hashers = await createHashers(msg.algorithms || []);

      self.postMessage({
        type: "ready"
      });
      return;
    }

    if (msg.type === "chunk") {
      const bytes = new Uint8Array(msg.chunk);

      for (const entry of hashers) {
        entry.hasher.update(bytes);
      }

      self.postMessage({
        type: "progress",
        loaded: Number(msg.loaded || 0),
        total: Number(msg.total || totalBytes || 0)
      });
      return;
    }

    if (msg.type === "end") {
      const results = hashers.map((entry) => ({
        algorithm: entry.algorithm,
        value: String(entry.hasher.digest())
      }));

      self.postMessage({
        type: "done",
        results
      });

      hashers = [];
      totalBytes = 0;
      return;
    }
  } catch (err) {
    self.postMessage({
      type: "error",
      message: err?.message || "Worker failure"
    });
  }
};

async function createHashers(algorithms) {
  const entries = [];

  for (const algorithm of algorithms) {
    entries.push({
      algorithm,
      hasher: await createHasher(algorithm)
    });
  }

  return entries;
}

async function createHasher(algorithm) {
  switch (algorithm) {
    case "MD5":
      return await createMD5();

    case "SHA-1":
      return await createSHA1();

    case "SHA-256":
      return await createSHA256();

    case "SHA-384":
      return await createSHA384();

    case "SHA-512":
      return await createSHA512();

    case "CRC32":
      return await createCRC32();

    case "BLAKE2b":
      return await createBLAKE2b(512);

    case "xxHash64":
      return await createXXHash64(0, 0);

    default:
      throw new Error(`Unsupported algorithm: ${algorithm}`);
  }
}